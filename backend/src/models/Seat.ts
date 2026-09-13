import mongoose, { Document, Schema } from 'mongoose';

export type SeatStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

export interface ISeat extends Document {
  seatNumber: string; // "01" to "50"
  status: SeatStatus;
  currentStudentId?: mongoose.Types.ObjectId;
  currentStudentName?: string;
  currentAttendanceId?: mongoose.Types.ObjectId;
  notes?: string;
  updatedAt: Date;
}

const SeatSchema = new Schema<ISeat>(
  {
    seatNumber: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'],
      default: 'AVAILABLE',
      index: true,
    },
    currentStudentId: { type: Schema.Types.ObjectId, ref: 'User' },
    currentStudentName: { type: String },
    currentAttendanceId: { type: Schema.Types.ObjectId, ref: 'Attendance' },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Seat = mongoose.model<ISeat>('Seat', SeatSchema);
