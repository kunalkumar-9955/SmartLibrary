import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const QR_SECRET = process.env.QR_SECRET || 'smart_library_personal_qr_secret_salt_2026';

export interface QRPayload {
  qrType: 'ENTRY' | 'EXIT';
  token: string;
  expiresAt: number; // epoch ms
  signature: string;
  version?: number;
}

export const createQRSignature = (qrType: string, token: string, expiresAt: number): string => {
  const raw = `${qrType}:${token}:${expiresAt}`;
  return crypto.createHmac('sha256', QR_SECRET).update(raw).digest('hex');
};

export const generateDynamicQR = (
  qrType: 'ENTRY' | 'EXIT',
  ttlSeconds: number = 60,
  version: number = 1
): QRPayload => {
  const token = uuidv4();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const signature = createQRSignature(qrType, token, expiresAt);

  return {
    qrType,
    token,
    expiresAt,
    signature,
    version,
  };
};

export const validateDynamicQR = (
  payload: QRPayload,
  expectedType?: 'ENTRY' | 'EXIT'
): { isValid: boolean; error?: string } => {
  if (!payload || !payload.qrType || !payload.token || !payload.expiresAt || !payload.signature) {
    return { isValid: false, error: 'Invalid QR code structure' };
  }

  // Check expected QR type
  if (expectedType && payload.qrType !== expectedType) {
    return {
      isValid: false,
      error: `Scanned ${payload.qrType} QR but expected ${expectedType} QR. Please scan the correct screen.`,
    };
  }

  // Check expiration (with 10-second grace window for network transmission)
  if (Date.now() > payload.expiresAt + 10000) {
    return { isValid: false, error: 'QR code has expired. Please scan the currently displayed QR.' };
  }

  // Verify HMAC signature
  const expectedSig = createQRSignature(payload.qrType, payload.token, payload.expiresAt);
  try {
    if (
      payload.signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expectedSig))
    ) {
      return { isValid: false, error: 'Invalid attendance QR.' };
    }
  } catch {
    return { isValid: false, error: 'Invalid attendance QR.' };
  }

  return { isValid: true };
};
