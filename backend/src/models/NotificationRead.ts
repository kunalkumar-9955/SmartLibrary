import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationRead extends Document {
  studentId: mongoose.Types.ObjectId;
  noticeId: mongoose.Types.ObjectId;
  readAt: Date;
}

const NotificationReadSchema = new Schema<INotificationRead>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    noticeId: { type: Schema.Types.ObjectId, ref: 'Notice', required: true, index: true },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

NotificationReadSchema.index({ studentId: 1, noticeId: 1 }, { unique: true });

export const NotificationRead = mongoose.model<INotificationRead>('NotificationRead', NotificationReadSchema);
