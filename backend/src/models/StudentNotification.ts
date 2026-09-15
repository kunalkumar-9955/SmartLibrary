import mongoose, { Document, Schema } from 'mongoose';

export type StudentNotificationType = 'COMPLAINT_REPLY' | 'COMPLAINT_STATUS' | 'SYSTEM' | 'NOTICE';

export interface IStudentNotification extends Document {
  studentId: mongoose.Types.ObjectId;
  type: StudentNotificationType;
  title: string;
  message: string;
  relatedTicketId?: mongoose.Types.ObjectId;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentNotificationSchema = new Schema<IStudentNotification>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['COMPLAINT_REPLY', 'COMPLAINT_STATUS', 'SYSTEM', 'NOTICE'],
      default: 'COMPLAINT_STATUS',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    relatedTicketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

StudentNotificationSchema.index({ studentId: 1, createdAt: -1 });
StudentNotificationSchema.index({ studentId: 1, isRead: 1 });

export const StudentNotification = mongoose.model<IStudentNotification>(
  'StudentNotification',
  StudentNotificationSchema
);
