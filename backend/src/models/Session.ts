import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from './User';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  role: UserRole;
  tokenHash: string;
  isRevoked: boolean;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['ADMIN', 'STUDENT'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    isRevoked: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound index for querying active sessions for a user
SessionSchema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });

// TTL index to automatically clean up expired sessions from MongoDB
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
