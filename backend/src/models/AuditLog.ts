import mongoose, { Document, Schema } from 'mongoose';

export type AuditAction =
  | 'STUDENT_CREATED'
  | 'STUDENT_UPDATED'
  | 'STUDENT_DEACTIVATED'
  | 'STUDENT_REACTIVATED'
  | 'STUDENT_REPLACED'
  | 'SEAT_ASSIGNED'
  | 'SEAT_CHANGED'
  | 'SEAT_RELEASED'
  | 'QR_GENERATED'
  | 'QR_ACTIVATED'
  | 'QR_REVOKED'
  | 'BULK_QR_GENERATED'
  | 'BULK_QR_ACTIVATED'
  | 'DEMO_DATA_CLEANUP'
  | 'PASSWORD_RESET'
  | 'ATTENDANCE_CHECKOUT';

export interface IAuditLog extends Document {
  adminId?: mongoose.Types.ObjectId;
  adminEmail: string;
  adminName: string;
  action: AuditAction;
  targetId?: mongoose.Types.ObjectId;
  targetName?: string;
  targetType: 'STUDENT' | 'SEAT' | 'QR' | 'SYSTEM' | 'ATTENDANCE';
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    adminEmail: { type: String, required: true, trim: true },
    adminName: { type: String, required: true, trim: true },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetId: { type: Schema.Types.ObjectId },
    targetName: { type: String, trim: true },
    targetType: {
      type: String,
      enum: ['STUDENT', 'SEAT', 'QR', 'SYSTEM', 'ATTENDANCE'],
      required: true,
      index: true,
    },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ targetId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

