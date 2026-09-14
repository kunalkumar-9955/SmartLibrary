import mongoose, { Document, Schema } from 'mongoose';

export type AdminNotificationType = 'NEW_COMPLAINT' | 'SYSTEM' | 'ATTENDANCE_ALERT';

export interface IAdminNotification extends Document {
  type: AdminNotificationType;
  title: string;
  message: string;
  relatedTicketId?: mongoose.Types.ObjectId;
  relatedStudentId?: mongoose.Types.ObjectId;
  studentName?: string;
  seatNumber?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdminNotificationSchema = new Schema<IAdminNotification>(
  {
    type: {
      type: String,
      enum: ['NEW_COMPLAINT', 'SYSTEM', 'ATTENDANCE_ALERT'],
      default: 'NEW_COMPLAINT',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    relatedTicketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
    relatedStudentId: { type: Schema.Types.ObjectId, ref: 'User' },
    studentName: { type: String, trim: true },
    seatNumber: { type: String, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

AdminNotificationSchema.index({ isRead: 1, createdAt: -1 });

export const AdminNotification = mongoose.model<IAdminNotification>(
  'AdminNotification',
  AdminNotificationSchema
);
