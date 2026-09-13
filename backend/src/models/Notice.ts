import mongoose, { Document, Schema } from 'mongoose';

export interface INotice extends Document {
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const NoticeSchema = new Schema<INotice>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Notice = mongoose.model<INotice>('Notice', NoticeSchema);
