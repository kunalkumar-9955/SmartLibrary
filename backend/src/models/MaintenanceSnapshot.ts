import mongoose, { Document, Schema } from 'mongoose';

export interface IMaintenanceSnapshot extends Document {
  snapshotType: 'PRE_CLEANUP_DEMO_DATA' | 'MANUAL_BACKUP';
  adminId?: mongoose.Types.ObjectId;
  adminEmail: string;
  summary: {
    paymentsCleanedCount: number;
    paymentsPreservedCount: number;
    qrsRevokedCount: number;
    studentsPreservedCount: number;
    attendancePreservedCount: number;
    notes?: string;
  };
  cleanedPaymentIds: string[];
  revokedQrIds: string[];
  rawSnapshotData?: Record<string, any>;
  createdAt: Date;
}

const MaintenanceSnapshotSchema = new Schema<IMaintenanceSnapshot>(
  {
    snapshotType: {
      type: String,
      enum: ['PRE_CLEANUP_DEMO_DATA', 'MANUAL_BACKUP'],
      required: true,
      index: true,
    },
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    adminEmail: { type: String, required: true },
    summary: {
      paymentsCleanedCount: { type: Number, default: 0 },
      paymentsPreservedCount: { type: Number, default: 0 },
      qrsRevokedCount: { type: Number, default: 0 },
      studentsPreservedCount: { type: Number, default: 0 },
      attendancePreservedCount: { type: Number, default: 0 },
      notes: { type: String },
    },
    cleanedPaymentIds: [{ type: String }],
    revokedQrIds: [{ type: String }],
    rawSnapshotData: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MaintenanceSnapshotSchema.index({ createdAt: -1 });

export const MaintenanceSnapshot = mongoose.model<IMaintenanceSnapshot>(
  'MaintenanceSnapshot',
  MaintenanceSnapshotSchema
);

