import mongoose, { Document, Schema } from 'mongoose';

export type DailyQRSessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface IDailyQrSession extends Document {
  dailyQrId: string;
  date: string; // YYYY-MM-DD
  token: string;
  signature: string;
  status: DailyQRSessionStatus;
  expiresAt: Date;
  scanCount: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DailyQrSessionSchema = new Schema<IDailyQrSession>(
  {
    dailyQrId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    signature: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    scanCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Optimize query for active daily QR for a given date
DailyQrSessionSchema.index({ date: 1, status: 1, expiresAt: 1 });

export const DailyQrSession = mongoose.model<IDailyQrSession>('DailyQrSession', DailyQrSessionSchema);
