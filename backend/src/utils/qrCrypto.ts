import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const QR_SECRET = process.env.QR_SECRET || 'smart_library_personal_qr_secret_salt_2026';

export interface QRPayload {
  qrType: 'ENTRY' | 'EXIT';
  token: string;
  expiresAt: number; // epoch ms
  signature: string;
}

// In-memory replay cache: Set of used tokens with TTL cleanup
const usedTokens = new Set<string>();

export const generateDynamicQR = (
  qrType: 'ENTRY' | 'EXIT',
  ttlSeconds: number = 45
): QRPayload => {
  const token = uuidv4();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const raw = `${qrType}:${token}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', QR_SECRET).update(raw).digest('hex');

  return {
    qrType,
    token,
    expiresAt,
    signature,
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

  // Check expiration
  if (Date.now() > payload.expiresAt) {
    return { isValid: false, error: 'QR code has expired. Please scan the new QR.' };
  }

  // Verify HMAC signature
  const raw = `${payload.qrType}:${payload.token}:${payload.expiresAt}`;
  const expectedSig = crypto.createHmac('sha256', QR_SECRET).update(raw).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expectedSig))) {
    return { isValid: false, error: 'Invalid attendance QR.' };
  }

  // Check replay protection
  if (usedTokens.has(payload.token)) {
    return { isValid: false, error: 'This QR code was already scanned. Please scan the latest QR.' };
  }

  // Mark token as used
  usedTokens.add(payload.token);

  // Auto clean up after expiry
  const cleanupDelay = Math.max(0, payload.expiresAt - Date.now() + 10000);
  const timer = setTimeout(() => {
    usedTokens.delete(payload.token);
  }, cleanupDelay);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }

  return { isValid: true };
};
