import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'ADMIN' | 'STUDENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  studentIdNumber?: string;
  phone?: string;
  course?: string;
  avatar?: string;
  status: UserStatus;
  isCurrentlyInside: boolean;
  currentSeatNumber?: string;
  assignedSeatNumber?: string;
  membershipStatus?: 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'INACTIVE';
  membershipPlan?: string;
  membershipStartDate?: Date;
  membershipExpiresAt?: Date;
  gracePeriodExpiresAt?: Date;
  lastRenewalDate?: Date;
  lastReminderType?: string;
  lastReminderSentAt?: Date;
  lastPaymentId?: mongoose.Types.ObjectId;
  lastEntryTime?: Date;
  lastExitTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['ADMIN', 'STUDENT'],
      default: 'STUDENT',
      required: true,
      index: true,
    },
    studentIdNumber: { type: String, trim: true, index: true },
    phone: { type: String, trim: true },
    course: { type: String, trim: true },
    avatar: { type: String, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'ACTIVE',
      index: true,
    },
    isCurrentlyInside: { type: Boolean, default: false, index: true },
    currentSeatNumber: { type: String },
    assignedSeatNumber: { type: String, trim: true },
    membershipStatus: {
      type: String,
      enum: ['ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'INACTIVE'],
      default: 'INACTIVE',
      index: true,
    },
    membershipPlan: { type: String, default: 'Monthly Library Membership', trim: true },
    membershipStartDate: { type: Date },
    membershipExpiresAt: { type: Date, index: true },
    gracePeriodExpiresAt: { type: Date, index: true },
    lastRenewalDate: { type: Date },
    lastReminderType: { type: String },
    lastReminderSentAt: { type: Date },
    lastPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    lastEntryTime: { type: Date },
    lastExitTime: { type: Date },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model<IUser>('User', UserSchema);
