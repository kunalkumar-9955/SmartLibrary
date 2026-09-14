import mongoose, { Document, Schema } from 'mongoose';

export type TicketCategory =
  | 'Wi-Fi'
  | 'AC'
  | 'Light'
  | 'Fan'
  | 'Charging Point'
  | 'Chair/Seat'
  | 'Cleanliness'
  | 'Water'
  | 'Other';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface ITicketComment {
  userName: string;
  userRole: string;
  comment: string;
  createdAt: Date;
}

export interface ITicket extends Document {
  ticketNumber: string;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  studentIdNumber?: string;
  category: TicketCategory;
  title: string;
  description: string;
  seatNumber?: string;
  status: TicketStatus;
  attachmentUrl?: string;
  comments: ITicketComment[];
  resolvedAt?: Date;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TicketCommentSchema = new Schema<ITicketComment>(
  {
    userName: { type: String, required: true },
    userRole: { type: String, required: true },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TicketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentName: { type: String, required: true },
    studentIdNumber: { type: String },
    category: {
      type: String,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    seatNumber: { type: String },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    attachmentUrl: { type: String },
    comments: [TicketCommentSchema],
    resolvedAt: { type: Date },
    resolutionNote: { type: String },
  },
  { timestamps: true }
);

TicketSchema.index({ studentId: 1, createdAt: -1 });
TicketSchema.index({ status: 1, createdAt: -1 });

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
