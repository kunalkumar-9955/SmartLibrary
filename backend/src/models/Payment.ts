import mongoose, { Document, Schema } from 'mongoose';

export type PaymentType = 'ONLINE' | 'OFFLINE';
export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PENDING_APPROVAL'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED';

export type VerificationSource =
  | 'YOUPI_WEBHOOK'
  | 'YOUPI_STATUS_API'
  | 'MANUAL_ADMIN'
  | 'PENDING_VERIFICATION'
  | 'OFFLINE_ADMIN_APPROVAL';

export type OfflinePaymentMethod = 'CASH' | 'UPI_DIRECT' | 'BANK_TRANSFER' | 'OTHER';

export interface IPayment extends Document {
  orderId: string;
  userId: mongoose.Types.ObjectId;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  studentIdNumber?: string;
  planId: string;
  planName: string;
  amount: number;
  amountPaise: number;
  currency: string;
  durationDays: number;
  isCustomAmount?: boolean;
  isTestTransaction?: boolean;
  paymentType: PaymentType;
  status: PaymentStatus;
  paymentMethod: string;
  // Online Gateway Fields
  gatewayPaymentId?: string;
  checkoutUrl?: string;
  deliveryId?: string;
  idempotencyKey?: string;
  gatewayRawResponse?: Record<string, any>;
  // Verification & Common Fields
  utr?: string;
  receiptNumber?: string;
  verificationSource?: VerificationSource;
  orderCreatedTime?: Date;
  paymentInitiatedAt?: Date;
  paymentCompletedAt?: Date;
  lastStatusUpdatedAt?: Date;
  webhookReceivedAt?: Date;
  verifiedAt?: Date;
  notes?: string;
  // Membership Accounting Fields
  membershipCyclePaidAmount?: number;
  membershipRemainingBalance?: number;
  membershipRenewed?: boolean;
  // Offline Payment Fields
  offlineMethod?: OfflinePaymentMethod;
  paymentDate?: Date;
  receiptUrl?: string;
  adminActionBy?: mongoose.Types.ObjectId;
  adminActionAt?: Date;
  adminRejectionReason?: string;
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
    studentIdNumber: { type: String, trim: true },
    planId: { type: String, default: 'monthly-membership', trim: true },
    planName: { type: String, default: 'Monthly Library Membership', trim: true },
    amount: { type: Number, default: 500, required: true },
    amountPaise: { type: Number, default: 50000, required: true },
    currency: { type: String, default: 'INR', uppercase: true },
    durationDays: { type: Number, default: 30 },
    isCustomAmount: { type: Boolean, default: false },
    isTestTransaction: { type: Boolean, default: false, index: true },
    paymentType: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'ONLINE',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'CREATED',
        'PENDING',
        'PENDING_APPROVAL',
        'PROCESSING',
        'APPROVED',
        'REJECTED',
        'SUCCESS',
        'FAILED',
        'EXPIRED',
        'CANCELLED',
        'REFUNDED',
      ],
      default: 'CREATED',
      index: true,
    },
    paymentMethod: { type: String, default: 'UPI' },
    gatewayPaymentId: { type: String, trim: true, index: true },
    checkoutUrl: { type: String, trim: true },
    utr: { type: String, trim: true, index: true },
    receiptNumber: { type: String, trim: true, index: true },
    verificationSource: {
      type: String,
      enum: [
        'YOUPI_WEBHOOK',
        'YOUPI_STATUS_API',
        'MANUAL_ADMIN',
        'PENDING_VERIFICATION',
        'OFFLINE_ADMIN_APPROVAL',
      ],
    },
    orderCreatedTime: { type: Date, default: Date.now },
    paymentInitiatedAt: { type: Date },
    paymentCompletedAt: { type: Date },
    lastStatusUpdatedAt: { type: Date, default: Date.now },
    webhookReceivedAt: { type: Date },
    verifiedAt: { type: Date },
    deliveryId: { type: String, trim: true, index: true },
    idempotencyKey: { type: String, trim: true, index: true },
    notes: { type: String, trim: true },
    gatewayRawResponse: { type: Schema.Types.Mixed },
    // Membership Accounting
    membershipCyclePaidAmount: { type: Number, default: 0 },
    membershipRemainingBalance: { type: Number, default: 0 },
    membershipRenewed: { type: Boolean, default: false },
    // Offline Details
    offlineMethod: {
      type: String,
      enum: ['CASH', 'UPI_DIRECT', 'BANK_TRANSFER', 'OTHER'],
    },
    paymentDate: { type: Date },
    receiptUrl: { type: String, trim: true },
    adminActionBy: { type: Schema.Types.ObjectId, ref: 'User' },
    adminActionAt: { type: Date },
    adminRejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
