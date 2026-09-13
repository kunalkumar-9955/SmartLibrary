import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val: any) => val.message);
    return sendError(res, messages.join(', '), 422, 'VALIDATION_ERROR', req.originalUrl);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `Duplicate entry for ${field}. Please use another value.`, 409, 'DUPLICATE_KEY', req.originalUrl);
  }

  // Multer errors
  if (err.name === 'MulterError') {
    return sendError(res, `Upload error: ${err.message}`, 400, 'UPLOAD_ERROR', req.originalUrl);
  }

  // Cast error (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, `Resource not found or invalid ID format`, 404, 'RESOURCE_NOT_FOUND', req.originalUrl);
  }

  // Custom or standard errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  return sendError(res, message, statusCode, 'INTERNAL_SERVER_ERROR', req.originalUrl);
};
