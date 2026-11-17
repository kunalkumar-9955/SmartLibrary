import { Request, Response, NextFunction } from 'express';
import { executeSafeFreshStart, getCleanupHistory, previewFreshStart } from '../services/maintenanceService';
import { AuditLog } from '../models/AuditLog';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Admin: Get preview of records that will be cleaned vs preserved
 * GET /api/maintenance/fresh-start/preview
 */
export const getFreshStartPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'ADMIN') {
      return sendError(res, 'Access denied. Administrator privileges required.', 403);
    }

    const preview = await previewFreshStart();
    return sendSuccess(res, preview);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Execute safe fresh start cleanup
 * POST /api/admin/maintenance/fresh-start
 */
export const runFreshStart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'ADMIN') {
      return sendError(res, 'Access denied. Administrator privileges required.', 403);
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    const result = await executeSafeFreshStart({
      adminId: admin.id,
      adminEmail: admin.email,
      adminName: admin.name,
      ipAddress,
    });

    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get snapshot and cleanup history
 * GET /api/admin/maintenance/snapshots
 */
export const listSnapshots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await getCleanupHistory();
    return sendSuccess(res, history);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get Audit Logs with pagination and filtering
 * GET /api/admin/maintenance/audit-logs
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const action = (req.query.action as string) || '';
    const search = (req.query.search as string) || '';

    const query: any = {};
    if (action) {
      query.action = action;
    }
    if (search) {
      query.$or = [
        { adminName: { $regex: search, $options: 'i' } },
        { adminEmail: { $regex: search, $options: 'i' } },
        { targetName: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return sendSuccess(res, {
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

