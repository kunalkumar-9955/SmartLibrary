import { Request, Response, NextFunction } from 'express';
import { generateDynamicQR, validateDynamicQR } from '../utils/qrCrypto';
import { Library } from '../models/Library';
import { sendSuccess, sendError } from '../utils/response';

export const generateQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrType } = req.body;

    if (!qrType || !['ENTRY', 'EXIT'].includes(qrType)) {
      return sendError(res, 'qrType must be either ENTRY or EXIT', 400);
    }

    const settings = await Library.findOne();
    const ttl = settings?.qrExpirySeconds || 45;

    const qrPayload = generateDynamicQR(qrType, ttl);

    return sendSuccess(res, {
      ...qrPayload,
      libraryName: settings?.name || 'Smart Library',
      ttl,
    });
  } catch (error) {
    next(error);
  }
};

export const validateQRToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrPayload, expectedType } = req.body;
    const result = validateDynamicQR(qrPayload, expectedType);
    if (!result.isValid) {
      return sendError(res, result.error || 'Invalid attendance QR.', 400);
    }

    return sendSuccess(res, { valid: true }, 'QR Code is valid');
  } catch (error) {
    next(error);
  }
};
