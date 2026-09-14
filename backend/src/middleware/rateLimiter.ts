import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';

/**
 * Generous rate limiter for Authentication & Password Change.
 * Allows 100 requests per 15 minutes per IP so 50 students can easily log in.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      'Too many login/auth attempts from this device. Please try again in 15 minutes.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  },
});

/**
 * Rate limiter for QR Attendance scan operations.
 * Allows 300 requests per 15 minutes per IP.
 */
export const attendanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      'Too many attendance requests in a short time. Please wait a moment and try again.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  },
});

/**
 * General API Limiter.
 * Allows 1500 requests per 15 minutes.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      'Too many requests. Please slow down.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  },
});
