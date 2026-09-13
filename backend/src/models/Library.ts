import mongoose, { Document, Schema } from 'mongoose';

export interface ILibrarySettings extends Document {
  name: string;
  address: string;
  phone: string;
  email: string;
  openingTime: string;
  closingTime: string;
  totalSeats: number;
  qrExpirySeconds: number;
  updatedAt: Date;
}

const LibrarySettingsSchema = new Schema<ILibrarySettings>(
  {
    name: { type: String, default: 'Smart Library' },
    address: { type: String, default: 'Plot 42, Connaught Place, New Delhi' },
    phone: { type: String, default: '+91 9876543210' },
    email: { type: String, default: 'contact@smartlibrary.com' },
    openingTime: { type: String, default: '08:00 AM' },
    closingTime: { type: String, default: '10:00 PM' },
    totalSeats: { type: Number, default: 50 },
    qrExpirySeconds: { type: Number, default: 45 },
  },
  { timestamps: true }
);

export const Library = mongoose.model<ILibrarySettings>('Library', LibrarySettingsSchema);
