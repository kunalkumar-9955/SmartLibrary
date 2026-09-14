import mongoose, { Document, Schema } from 'mongoose';

export type QRMode = 'ENTRY' | 'EXIT';
export type QRSessionStatus = 'ACTIVE' | 'ROTATED' | 'EXPIRED';

export interface IQrSession extends Document {
  qrType: QRMode;
  token: string;
  version: number;
  status: QRSessionStatus;
  expiresAt: Date;
  rotatedAt?: Date;
  graceExpiresAt?: Date;
  scanCount: number;
  signature: string;
  createdAt: Date;
  updatedAt: Date;
}

const QrSessionSchema = new Schema<IQrSession>(
  {
    qrType: {
      type: String,
      enum: ['ENTRY', 'EXIT'],
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ROTATED', 'EXPIRED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    rotatedAt: {
      type: Date,
    },
    graceExpiresAt: {
      type: Date,
      index: true,
    },
    scanCount: {
      type: Number,
      default: 0,
    },
    signature: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for fast retrieval of the active QR per type
QrSessionSchema.index({ qrType: 1, status: 1, createdAt: -1 });

// TTL index to automatically clean up expired sessions from MongoDB
QrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const QrSession = mongoose.model<IQrSession>('QrSession', QrSessionSchema);
