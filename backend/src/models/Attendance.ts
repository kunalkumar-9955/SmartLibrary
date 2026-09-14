import mongoose, { Document, Schema } from 'mongoose';

export type AttendanceStatus = 'ACTIVE' | 'COMPLETED';

export interface IAttendance extends Document {
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  studentIdNumber: string;
  seatNumber?: string;
  seatId?: mongoose.Types.ObjectId;
  entryTime: Date;
  exitTime?: Date;
  durationMinutes?: number;
  attendanceDate: string; // YYYY-MM-DD
  entryMethod: 'QR';
  exitMethod?: 'QR' | 'MANUAL';
  status: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, required: true },
    studentIdNumber: { type: String, default: '' },
    seatNumber: { type: String, index: true },
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat' },
    entryTime: { type: Date, required: true, default: Date.now, index: true },
    exitTime: { type: Date, index: true },
    durationMinutes: { type: Number },
    attendanceDate: { type: String, required: true, index: true },
    entryMethod: { type: String, default: 'QR' },
    exitMethod: { type: String },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true }
);

AttendanceSchema.index({ studentId: 1, status: 1 });
AttendanceSchema.index({ attendanceDate: 1, status: 1 });
// Concurrency guarantee: strictly only ONE ACTIVE attendance session per student
AttendanceSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
