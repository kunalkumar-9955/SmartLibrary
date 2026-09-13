import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../models/User';
import { sendError } from '../utils/response';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token missing or invalid format', 401, 'UNAUTHORIZED', req.originalUrl);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'smart_library_jwt_secret_key_2026';

    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err: any) {
      return sendError(res, 'Invalid or expired authentication session. Please login again.', 401, 'TOKEN_EXPIRED', req.originalUrl);
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return sendError(res, 'User account not found', 401, 'USER_NOT_FOUND', req.originalUrl);
    }

    if (user.status === 'BLOCKED') {
      return sendError(res, 'Your account has been blocked. Please contact your library administrator.', 403, 'ACCOUNT_BLOCKED', req.originalUrl);
    }

    if (user.status === 'INACTIVE') {
      return sendError(res, 'Your account is currently inactive.', 403, 'ACCOUNT_INACTIVE', req.originalUrl);
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      status: user.status,
    };

    next();

  } catch (error: any) {
    return sendError(res, 'Authentication failed', 401, 'AUTH_ERROR', req.originalUrl);
  }
};
