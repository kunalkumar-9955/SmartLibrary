import mongoose, { Document, Schema } from 'mongoose';

export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
export type VerificationSource = 'YOUPI_WEBHOOK' | 'YOUPI_STATUS_API' | 'MANUAL_ADMIN' | 'PENDING_VERIFICATION';

export interface IPayment extends Document {
  orderId: string;
  userId: mongoose.Types.ObjectId;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  planId: string;
  planName: string;
  amount: number;
  amountPaise: number;
  currency: string;
  durationDays: number;
  status: PaymentStatus;
  paymentMethod: string;
  gatewayPaymentId?: string;
  checkoutUrl?: string;
  utr?: string;
  verificationSource?: VerificationSource;
  verifiedAt?: Date;
  deliveryId?: string;
  idempotencyKey?: string;
  notes?: string;
  gatewayRawResponse?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentName: { type: String, required: true, trim: true },
    studentEmail: { type: String, required: true, trim: true, lowercase: true },
    studentPhone: { type: String, trim: true },
    planId: { type: String, required: true, trim: true },
    planName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true },
    durationDays: { type: Number, default: 30, min: 1 },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'],
      default: 'CREATED',
      index: true,
    },
    paymentMethod: { type: String, default: 'UPI' },
    gatewayPaymentId: { type: String, trim: true, index: true },
    checkoutUrl: { type: String, trim: true },
    utr: { type: String, trim: true, index: true },
    verificationSource: {
      type: String,
      enum: ['YOUPI_WEBHOOK', 'YOUPI_STATUS_API', 'MANUAL_ADMIN', 'PENDING_VERIFICATION'],
    },
    verifiedAt: { type: Date },
    deliveryId: { type: String, trim: true, index: true },
    idempotencyKey: { type: String, trim: true, index: true },
    notes: { type: String, trim: true },
    gatewayRawResponse: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
