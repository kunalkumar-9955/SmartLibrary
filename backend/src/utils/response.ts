import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  timestamp: string;
  path?: string;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 400,
  code?: string,
  path?: string
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    code: code || 'BAD_REQUEST',
    timestamp: new Date().toISOString(),
    path,
  });
};
