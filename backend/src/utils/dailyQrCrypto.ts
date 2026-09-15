import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const QR_SECRET = process.env.QR_SECRET || 'smart_library_personal_qr_secret_salt_2026';

export interface DailyQRPayload {
  qrType: 'DAILY';
  dailyQrId: string;
  date: string; // YYYY-MM-DD
  token: string;
  expiresAt: number; // epoch ms
  signature: string;
}

export const createDailyQRSignature = (
  dailyQrId: string,
  token: string,
  date: string,
  expiresAt: number
): string => {
  const raw = `DAILY:${dailyQrId}:${token}:${date}:${expiresAt}`;
  return crypto.createHmac('sha256', QR_SECRET).update(raw).digest('hex');
};

export const generateDailyQRPayload = (
  dateStr: string,
  expiresAtMs: number,
  existingDailyQrId?: string,
  existingToken?: string
): DailyQRPayload => {
  const dailyQrId = existingDailyQrId || `daily-${dateStr}-${uuidv4().slice(0, 8)}`;
  const token = existingToken || uuidv4();
  const signature = createDailyQRSignature(dailyQrId, token, dateStr, expiresAtMs);

  return {
    qrType: 'DAILY',
    dailyQrId,
    date: dateStr,
    token,
    expiresAt: expiresAtMs,
    signature,
  };
};

export const validateDailyQRPayload = (
  payload: any,
  currentServerDate: string
): { isValid: boolean; error?: string } => {
  if (
    !payload ||
    payload.qrType !== 'DAILY' ||
    !payload.dailyQrId ||
    !payload.token ||
    !payload.date ||
    !payload.expiresAt ||
    !payload.signature
  ) {
    return { isValid: false, error: 'Invalid Daily QR structure' };
  }

  // Date Check: Daily QR is valid strictly for the date it was generated for
  if (payload.date !== currentServerDate) {
    return {
      isValid: false,
      error: `This Daily QR was generated for ${payload.date} and is not valid for today (${currentServerDate}).`,
    };
  }

  // Expiration Check: Current server timestamp must not exceed expiresAt
  if (Date.now() > Number(payload.expiresAt)) {
    return {
      isValid: false,
      error: 'Daily QR has expired for today.',
    };
  }

  // HMAC Cryptographic Signature Check
  const expectedSignature = createDailyQRSignature(
    payload.dailyQrId,
    payload.token,
    payload.date,
    Number(payload.expiresAt)
  );

  try {
    const sigBuffer = Buffer.from(payload.signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { isValid: false, error: 'Invalid Daily QR signature. Fraudulent or altered QR detected.' };
    }
  } catch (e) {
    return { isValid: false, error: 'Cryptographic signature verification failed' };
  }

  return { isValid: true };
};
