import mongoose, { Document, Schema } from 'mongoose';

export type PersonalQrStatus = 'ACTIVE' | 'REVOKED';

export interface IStudentPersonalQr extends Document {
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  studentIdNumber: string;
  assignedSeatNumber?: string;
  qrToken: string;
  status: PersonalQrStatus;
  generationCount: number;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
  revokedBy?: mongoose.Types.ObjectId;
}

const StudentPersonalQrSchema = new Schema<IStudentPersonalQr>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentName: { type: String, required: true, trim: true },
    studentIdNumber: { type: String, required: true, trim: true, index: true },
    assignedSeatNumber: { type: String, trim: true },
    qrToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    generationCount: { type: Number, default: 1 },
    revokedAt: { type: Date },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Guarantee: Only ONE active QR token per student at any time
StudentPersonalQrSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

export const StudentPersonalQr = mongoose.model<IStudentPersonalQr>(
  'StudentPersonalQr',
  StudentPersonalQrSchema
);
