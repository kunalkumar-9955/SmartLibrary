import mongoose from 'mongoose';
import { AuditLog, AuditAction } from '../models/AuditLog';

export interface LogAuditParams {
  adminId?: string | mongoose.Types.ObjectId;
  adminEmail?: string;
  adminName?: string;
  action: AuditAction;
  targetId?: string | mongoose.Types.ObjectId;
  targetName?: string;
  targetType: 'STUDENT' | 'SEAT' | 'QR' | 'SYSTEM' | 'ATTENDANCE';
  details?: Record<string, any>;
  ipAddress?: string;
}

export const logAdminAction = async (params: LogAuditParams): Promise<void> => {
  try {
    const adminEmail = params.adminEmail || 'admin@lakshyalibrary.com';
    const adminName = params.adminName || 'Library Admin';

    await AuditLog.create({
      adminId: params.adminId ? new mongoose.Types.ObjectId(String(params.adminId)) : undefined,
      adminEmail,
      adminName,
      action: params.action,
      targetId: params.targetId ? new mongoose.Types.ObjectId(String(params.targetId)) : undefined,
      targetName: params.targetName,
      targetType: params.targetType,
      details: params.details,
      ipAddress: params.ipAddress,
    });
  } catch (err: any) {
    console.error('[AuditLog Error] Failed to record audit log:', err.message);
  }
};

