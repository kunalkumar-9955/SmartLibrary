import { Request, Response, NextFunction } from 'express';
import { generateDynamicQR, validateDynamicQR, QRPayload } from '../utils/qrCrypto';
import { QrSession, QRMode, IQrSession } from '../models/QrSession';
import { Library } from '../models/Library';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Atomically rotates an active QR session for a given type,
 * transitioning the current session to ROTATED with a 10s grace window
 * and creating a new ACTIVE session.
 */
export const rotateQRSession = async (
  qrType: QRMode,
  scannedToken?: string
): Promise<IQrSession> => {
  const settings = await Library.findOne();
  const ttlSeconds = settings?.qrExpirySeconds ? Math.max(settings.qrExpirySeconds, 60) : 300; // 5 min fallback
  const now = new Date();
  const graceWindowMs = 10000; // 10 seconds concurrency grace

  // Find currently active session
  const currentActive = await QrSession.findOne({ qrType, status: 'ACTIVE' }).sort({ createdAt: -1 });

  let nextVersion = 1;

  if (currentActive) {
    nextVersion = currentActive.version + 1;

    // Transition current to ROTATED with grace window
    currentActive.status = 'ROTATED';
    currentActive.rotatedAt = now;
    currentActive.graceExpiresAt = new Date(now.getTime() + graceWindowMs);
    if (scannedToken && currentActive.token === scannedToken) {
      currentActive.scanCount += 1;
    }
    await currentActive.save();
  }

  // Generate new cryptographic payload
  const dynamicPayload = generateDynamicQR(qrType, ttlSeconds, nextVersion);

  const newSession = await QrSession.create({
    qrType,
    token: dynamicPayload.token,
    version: nextVersion,
    status: 'ACTIVE',
    expiresAt: new Date(dynamicPayload.expiresAt),
    signature: dynamicPayload.signature,
    scanCount: 0,
  });

  return newSession;
};

/**
 * Generate (or regenerate) an active QR code session.
 * Called by Admin Panel to start or reset attendance session.
 */
export const generateQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrType } = req.body;

    if (!qrType || !['ENTRY', 'EXIT'].includes(qrType)) {
      return sendError(res, 'qrType must be either ENTRY or EXIT', 400);
    }

    const settings = await Library.findOne();
    const newSession = await rotateQRSession(qrType as QRMode);

    const payload: QRPayload = {
      qrType: newSession.qrType,
      token: newSession.token,
      expiresAt: newSession.expiresAt.getTime(),
      signature: newSession.signature,
      version: newSession.version,
    };

    return sendSuccess(res, {
      ...payload,
      libraryName: settings?.name || 'Smart Library',
      ttl: Math.max(0, Math.floor((newSession.expiresAt.getTime() - Date.now()) / 1000)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get the currently ACTIVE QR session for the Admin display screen.
 * Polled lightly by Admin Panel (every 1.5s) to detect rotations.
 */
export const getActiveQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const qrType = (req.query.qrType as QRMode) || 'ENTRY';

    if (!['ENTRY', 'EXIT'].includes(qrType)) {
      return sendError(res, 'Invalid qrType parameter', 400);
    }

    const now = new Date();
    let activeSession: any = await QrSession.findOne({
      qrType,
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    // If no active session or expired by time, automatically create fresh active session
    if (!activeSession) {
      activeSession = await rotateQRSession(qrType);
    }

    const settings = await Library.findOne();

    const payload: QRPayload = {
      qrType: activeSession.qrType,
      token: activeSession.token,
      expiresAt: activeSession.expiresAt.getTime(),
      signature: activeSession.signature,
      version: activeSession.version,
    };

    return sendSuccess(res, {
      ...payload,
      libraryName: settings?.name || 'Smart Library',
      ttl: Math.max(0, Math.floor((activeSession.expiresAt.getTime() - Date.now()) / 1000)),
      status: activeSession.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * QR verification test endpoint.
 */
export const validateQRToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrPayload, expectedType } = req.body;
    const result = validateDynamicQR(qrPayload, expectedType);
    if (!result.isValid) {
      return sendError(res, result.error || 'Invalid attendance QR.', 400);
    }

    // Verify session in DB
    const session = await QrSession.findOne({ token: qrPayload.token });
    if (!session) {
      return sendError(res, 'QR session not found or invalid.', 404);
    }

    const now = new Date();
    const isCurrentActive = session.status === 'ACTIVE' && session.expiresAt > now;
    const isWithinGrace = session.status === 'ROTATED' && session.graceExpiresAt && session.graceExpiresAt > now;

    if (!isCurrentActive && !isWithinGrace) {
      return sendError(res, 'QR code has expired. Please scan the currently displayed QR.', 400);
    }

    return sendSuccess(res, { valid: true, version: session.version }, 'QR Code is valid');
  } catch (error) {
    next(error);
  }
};
