import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';
import { sendError } from '../utils/response';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED', req.originalUrl);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`,
        403,
        'FORBIDDEN',
        req.originalUrl
      );
    }

    next();
  };
};
