import { Request, Response, NextFunction } from 'express';
import { generateDynamicQR, validateDynamicQR, QRPayload } from '../utils/qrCrypto';
import { QrSession, QRMode, IQrSession } from '../models/QrSession';
import { Library } from '../models/Library';
import { sendSuccess, sendError } from '../utils/response';

const GRACE_WINDOW_MS = 10000; // 10 seconds in-flight grace window for rotated QRs
const DEFAULT_QR_TTL_SECONDS = 86400; // 24 hours validity so active QR never expires while displayed

/**
 * Helper to create a new ACTIVE QR session in DB
 */
const createNewActiveSession = async (
  qrType: QRMode,
  version: number,
  ttlSeconds: number = DEFAULT_QR_TTL_SECONDS
): Promise<IQrSession> => {
  const dynamicPayload = generateDynamicQR(qrType, ttlSeconds, version);

  return await QrSession.create({
    qrType,
    token: dynamicPayload.token,
    version,
    status: 'ACTIVE',
    expiresAt: new Date(dynamicPayload.expiresAt),
    signature: dynamicPayload.signature,
    scanCount: 0,
  });
};

/**
 * Atomically rotates an active QR session.
 * 
 * CORE RULES:
 * 1. If scannedToken is provided, ONLY rotate if the session with that token is currently ACTIVE.
 *    If that token was already rotated (e.g. duplicate camera frames or in-flight scan),
 *    return the existing ACTIVE session WITHOUT creating another new QR (idempotent).
 * 2. If no scannedToken is provided (e.g. Admin clicked Regenerate QR), rotate the latest ACTIVE session.
 * 3. Rotated QRs retain a 10-second grace window (graceExpiresAt) so legitimate in-flight scans succeed.
 */
export const rotateQRSession = async (
  qrType: QRMode,
  scannedToken?: string
): Promise<IQrSession> => {
  const now = new Date();

  if (scannedToken) {
    // Atomically find and transition the specific ACTIVE session to ROTATED
    const currentActive = await QrSession.findOneAndUpdate(
      { qrType, token: scannedToken, status: 'ACTIVE' },
      {
        $set: {
          status: 'ROTATED',
          rotatedAt: now,
          graceExpiresAt: new Date(now.getTime() + GRACE_WINDOW_MS),
        },
        $inc: { scanCount: 1 },
      },
      { new: false }
    );

    if (!currentActive) {
      // Scanned token is NOT active (already rotated or invalid).
      // Idempotency guard: Return the currently active session without rotating again!
      const existingActive = await QrSession.findOne({ qrType, status: 'ACTIVE' }).sort({ createdAt: -1 });
      if (existingActive) {
        return existingActive;
      }
      return await createNewActiveSession(qrType, 1);
    }

    // Successfully rotated this specific token -> generate exactly ONE next version
    const nextVersion = currentActive.version + 1;
    return await createNewActiveSession(qrType, nextVersion);
  }

  // Admin manual generate / regenerate: atomically rotate latest ACTIVE session
  const currentActive = await QrSession.findOneAndUpdate(
    { qrType, status: 'ACTIVE' },
    {
      $set: {
        status: 'ROTATED',
        rotatedAt: now,
        graceExpiresAt: new Date(now.getTime() + GRACE_WINDOW_MS),
      },
    },
    { sort: { createdAt: -1 }, new: false }
  );

  const nextVersion = currentActive ? currentActive.version + 1 : 1;
  return await createNewActiveSession(qrType, nextVersion);
};

/**
 * Generate (or regenerate) an active QR code session.
 * Called by Admin Panel to explicitly start or reset attendance session.
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
 * 
 * CRITICAL RULE:
 * This endpoint NEVER generates or rotates a QR automatically based on timer or polling.
 * QR-A stays fixed until a student successfully scans and completes attendance.
 */
export const getActiveQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const qrType = (req.query.qrType as QRMode) || 'ENTRY';

    if (!['ENTRY', 'EXIT'].includes(qrType)) {
      return sendError(res, 'Invalid qrType parameter', 400);
    }

    // Find current active session
    let activeSession: any = await QrSession.findOne({
      qrType,
      status: 'ACTIVE',
    }).sort({ createdAt: -1 });

    // Only create an initial session if none exists in the database at all
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
    const isCurrentActive = session.status === 'ACTIVE';
    const isWithinGrace = session.status === 'ROTATED' && session.graceExpiresAt && session.graceExpiresAt > now;

    if (!isCurrentActive && !isWithinGrace) {
      return sendError(res, 'QR code has expired. Please scan the currently displayed QR.', 400);
    }

    return sendSuccess(res, { valid: true, version: session.version }, 'QR Code is valid');
  } catch (error) {
    next(error);
  }
};
