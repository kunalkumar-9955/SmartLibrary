import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Payment, IPayment, PaymentType, OfflinePaymentMethod } from '../models/Payment';
import { User, IUser } from '../models/User';
import { AdminNotification } from '../models/AdminNotification';
import { StudentNotification } from '../models/StudentNotification';
import { MEMBERSHIP_PLANS, getPlanById } from '../config/membershipPlans';
import { youpiPaymentService } from '../services/youpiPaymentService';
import {
  calculateNextMonthlyExpiry,
  formatIndianDate,
  runAutomaticExpiryChecks,
} from '../services/membershipExpiryService';
import { sendSms } from '../services/smsService';
import { sendSuccess, sendError } from '../utils/response';
import { generateQrSvg, buildCanonicalUpiUri } from '../lib/youpi-qr';

/**
 * Fulfills an online or approved payment and extends membership by exactly 1 calendar month.
 * Strictly idempotent: prevents duplicate grants from retried callbacks or double clicks.
 */
export async function fulfillPaymentAndActivate(
  payment: IPayment,
  source: 'YOUPI_WEBHOOK' | 'YOUPI_STATUS_API' | 'MANUAL_ADMIN' | 'OFFLINE_ADMIN_APPROVAL',
  utr?: string,
  gatewayDetails?: Record<string, any>
): Promise<{ success: boolean; alreadyProcessed: boolean }> {
  // If already confirmed, return idempotently
  if (payment.status === 'SUCCESS' || payment.status === 'APPROVED') {
    return { success: true, alreadyProcessed: true };
  }

  const user = await User.findById(payment.userId);
  if (!user) {
    throw new Error(`User not found for payment: ${payment.userId}`);
  }

  // Update payment record
  payment.status = source === 'OFFLINE_ADMIN_APPROVAL' ? 'APPROVED' : 'SUCCESS';
  payment.verifiedAt = new Date();
  payment.paymentCompletedAt = new Date();
  payment.lastStatusUpdatedAt = new Date();
  payment.verificationSource = source;
  if (!payment.receiptNumber) {
    payment.receiptNumber = `LSL-REC-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }
  if (utr && !payment.utr) {
    payment.utr = utr;
  }
  if (gatewayDetails) {
    payment.gatewayRawResponse = gatewayDetails;
  }

  // Admin Gateway Test payments must NOT renew membership, NOT alter student balances, and NOT count towards revenue
  if (payment.isTestTransaction) {
    payment.membershipRenewed = false;
    payment.membershipRemainingBalance = 0;
    payment.membershipCyclePaidAmount = 0;
    await payment.save();
    return { success: true, alreadyProcessed: false };
  }

  // Accounting: Check if standard ₹500 pass OR partial payment accumulation reaches ₹500
  const isDirectMonthlyPass = payment.amount === 500 && !payment.isCustomAmount && payment.planId !== 'custom-amount';
  let shouldRenew = false;
  let newCyclePaid = 0;
  let remaining = 0;

  if (isDirectMonthlyPass) {
    shouldRenew = true;
    newCyclePaid = 500;
    remaining = 0;
    user.currentCyclePaidAmount = 0;
  } else {
    // Custom / partial payment accounting
    const prevPaid = user.currentCyclePaidAmount || 0;
    const accumulated = prevPaid + payment.amount;
    if (accumulated >= 500) {
      shouldRenew = true;
      user.currentCyclePaidAmount = Math.max(0, accumulated - 500);
      newCyclePaid = accumulated;
      remaining = 0;
    } else {
      shouldRenew = false;
      user.currentCyclePaidAmount = accumulated;
      newCyclePaid = accumulated;
      remaining = 500 - accumulated;
    }
  }

  payment.membershipCyclePaidAmount = newCyclePaid;
  payment.membershipRemainingBalance = remaining;
  payment.membershipRenewed = shouldRenew;
  await payment.save();

  if (shouldRenew) {
    const { startDate, expiresAt, gracePeriodExpiresAt } = calculateNextMonthlyExpiry(
      user.membershipExpiresAt
    );

    user.membershipStatus = 'ACTIVE';
    user.membershipPlan = 'Monthly Library Membership';
    if (!user.membershipStartDate) {
      user.membershipStartDate = startDate;
    }
    user.membershipExpiresAt = expiresAt;
    user.gracePeriodExpiresAt = gracePeriodExpiresAt;
    user.lastRenewalDate = new Date();
    user.lastPaymentId = payment._id as mongoose.Types.ObjectId;
    user.lastReminderType = undefined;
    await user.save();

    const formattedExpiry = formatIndianDate(expiresAt);

    // 1. Notify Student via In-App Notification
    try {
      const isOffline = source === 'OFFLINE_ADMIN_APPROVAL';
      const notifTitle = isOffline ? 'Payment Approved & Membership Renewed' : 'Membership Renewed Successfully';
      const notifMessage = isOffline
        ? `Your offline payment has been approved and your membership has been renewed. Next expiry date: ${formattedExpiry}. (Receipt #${payment.receiptNumber})`
        : `Your payment has fulfilled the ₹500 monthly pass requirement and your membership has been renewed. Next expiry date: ${formattedExpiry}. (Receipt #${payment.receiptNumber})`;

      await StudentNotification.create({
        studentId: user._id,
        type: 'SYSTEM',
        title: notifTitle,
        message: notifMessage,
      });
    } catch (err: any) {
      console.warn('[Notification Error] Failed to create student confirmation notification:', err.message);
    }

    // 2. Send Real SMS to Student
    if (user.phone) {
      try {
        await sendSms({
          phoneNumber: user.phone,
          message: `Lakshya Smart Library: Your membership has been renewed successfully. Next expiry date: ${formattedExpiry}. Thank you.`,
          templateType: 'RENEWAL_SUCCESS',
        });
      } catch (err: any) {
        console.warn('[SMS Error] Failed to send renewal confirmation SMS:', err.message);
      }
    }

    // 3. Notify Admin in Real-Time
    try {
      await AdminNotification.create({
        type: 'SYSTEM',
        title: 'Membership Payment Confirmed',
        message: `${user.name} (${user.studentIdNumber || user.email}) fulfilled ₹500 monthly membership via ${source} (Ref: ${payment.orderId}). Active until ${formattedExpiry}.`,
        relatedStudentId: user._id,
        studentName: user.name,
        seatNumber: user.assignedSeatNumber || user.currentSeatNumber,
      });
    } catch (err: any) {
      console.warn('[Notification Error] Failed to create admin notification:', err.message);
    }
  } else {
    // Partial payment verified without reaching ₹500 target
    await user.save();

    try {
      await StudentNotification.create({
        studentId: user._id,
        type: 'SYSTEM',
        title: 'Partial Payment Verified',
        message: `Your payment of ₹${payment.amount} has been verified and credited. Total paid: ₹${newCyclePaid}/₹500. Remaining balance: ₹${remaining}. (Ref: ${payment.orderId})`,
      });
    } catch (err: any) {
      console.warn('[Notification Error] Failed to create student custom payment notification:', err.message);
    }

    if (user.phone) {
      try {
        await sendSms({
          phoneNumber: user.phone,
          message: `Lakshya Smart Library: Partial payment of ₹${payment.amount} verified. Remaining balance for monthly renewal: ₹${remaining}. Thank you.`,
          templateType: 'RENEWAL_SUCCESS',
        });
      } catch (err: any) {
        console.warn('[SMS Error] Failed to send custom payment SMS:', err.message);
      }
    }

    try {
      await AdminNotification.create({
        type: 'SYSTEM',
        title: 'Partial Payment Received',
        message: `${user.name} (${user.studentIdNumber || user.email}) paid partial amount ₹${payment.amount} via ${source}. Cumulative: ₹${newCyclePaid}/₹500. Remaining: ₹${remaining}. (Ref: ${payment.orderId})`,
        relatedStudentId: user._id,
        studentName: user.name,
        seatNumber: user.assignedSeatNumber || user.currentSeatNumber,
      });
    } catch (err: any) {
      console.warn('[Notification Error] Failed to create admin custom payment notification:', err.message);
    }
  }

  return { success: true, alreadyProcessed: false };
}

/**
 * GET /api/payments/plans
 * Returns the single ₹500 monthly membership plan.
 */
export const getPlans = async (req: Request, res: Response) => {
  return sendSuccess(res, MEMBERSHIP_PLANS, 'Membership plan retrieved successfully');
};

/**
 * GET /api/payments/my-payments
 * Returns logged-in student's active membership validity, grace period, and payment history.
 */
export const getMyPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }

    const userId = new mongoose.Types.ObjectId(authUser.id);
    const [payments, fullUser] = await Promise.all([
      Payment.find({ userId }).sort({ createdAt: -1 }).limit(50),
      User.findById(userId).select(
        'membershipStatus membershipPlan membershipStartDate membershipExpiresAt gracePeriodExpiresAt currentCyclePaidAmount lastRenewalDate assignedSeatNumber currentSeatNumber'
      ),
    ]);

    const now = new Date();
    let effectiveStatus = fullUser?.membershipStatus || 'INACTIVE';

    if (fullUser?.membershipExpiresAt) {
      const expiry = new Date(fullUser.membershipExpiresAt);
      const graceExpiry = fullUser.gracePeriodExpiresAt
        ? new Date(fullUser.gracePeriodExpiresAt)
        : new Date(expiry.getTime() + 5 * 24 * 60 * 60 * 1000);

      if (now > graceExpiry) {
        effectiveStatus = 'EXPIRED';
      } else if (now > expiry) {
        effectiveStatus = 'GRACE_PERIOD';
      } else {
        effectiveStatus = 'ACTIVE';
      }
    }

    // Check if student has an existing offline request pending approval
    const pendingOffline = payments.find(
      (p) => p.paymentType === 'OFFLINE' && p.status === 'PENDING_APPROVAL'
    );

    const currentCyclePaid = fullUser?.currentCyclePaidAmount || 0;
    const remainingBalance = Math.max(0, 500 - currentCyclePaid);

    return sendSuccess(res, {
      membership: {
        status: effectiveStatus,
        plan: fullUser?.membershipPlan || 'Monthly Library Membership',
        startDate: fullUser?.membershipStartDate || null,
        expiresAt: fullUser?.membershipExpiresAt || null,
        gracePeriodExpiresAt: fullUser?.gracePeriodExpiresAt || null,
        lastRenewalDate: fullUser?.lastRenewalDate || null,
        monthlyFee: 500,
        currentCyclePaid,
        remainingBalance,
        hasPendingOfflineRequest: Boolean(pendingOffline),
        pendingOfflineOrderId: pendingOffline?.orderId || null,
      },
      payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/create-order (OPTION A: ONLINE PAYMENT)
 * Creates an online payment order for strictly ₹500.
 */
export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }

    const user = await User.findById(authUser.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const { idempotencyKey, amount: reqAmount, isCustomAmount, isTestTransaction } = req.body;
    let amount = 500;
    let isCustom = Boolean(isCustomAmount);
    const isTest = Boolean(isTestTransaction || req.body.planId === 'gateway-test');

    if (reqAmount !== undefined && reqAmount !== null && reqAmount !== '') {
      const parsedAmount = Number(reqAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
        return sendError(res, 'Payment amount must be at least ₹1.00', 400);
      }
      if (parsedAmount > 50000) {
        return sendError(res, 'Payment amount cannot exceed ₹50,000.00', 400);
      }
      amount = Math.round(parsedAmount * 100) / 100;
      if (amount !== 500 && !isTest) {
        isCustom = true;
      }
    }

    const amountPaise = Math.round(amount * 100);
    const plan = getPlanById();
    let planId = isCustom ? 'custom-amount' : plan.id;
    let planName = isCustom ? `Custom Payment (₹${amount})` : plan.name;

    if (isTest) {
      planId = 'gateway-test';
      planName = `Admin Gateway Test (₹${amount})`;
    }

    const upiId = process.env.MERCHANT_UPI_ID || '9955008447-7@axl';
    const merchantName = process.env.MERCHANT_NAME || 'Lakshya Smart Library';

    // Check for existing pending order with same idempotency key and amount
    if (idempotencyKey) {
      const existing = await Payment.findOne({
        idempotencyKey,
        userId: user._id,
        paymentType: 'ONLINE',
      });
      if (existing && existing.status !== 'FAILED' && existing.status !== 'CANCELLED' && existing.amount === amount) {
        const existingUpiString = buildCanonicalUpiUri({
          payeeVpa: upiId,
          payeeName: merchantName,
          amountRupees: existing.amount,
          transactionRef: existing.orderId,
          transactionNote: isTest ? 'Gateway Test' : (isCustom ? 'Lakshya Library Payment' : 'Lakshya Smart Library Membership'),
        });
        const existingQrSvg = generateQrSvg(existingUpiString, 240);
        return sendSuccess(
          res,
          {
            orderId: existing.orderId,
            paymentId: existing.gatewayPaymentId,
            amount: existing.amount,
            planName: existing.planName,
            isCustomAmount: existing.isCustomAmount,
            isTestTransaction: existing.isTestTransaction,
            checkoutUrl: existing.checkoutUrl,
            status: existing.status,
            isExisting: true,
            expiresAt: existing.expiresAt,
            upiId,
            merchantName,
            upiString: existingUpiString,
            qrSvg: existingQrSvg,
            qrSvgUrl: `/api/payments/qr.svg/${existing.orderId}`,
          },
          'Returning existing order session'
        );
      }
    }

    const orderPrefix = isTest ? 'LIB-TEST' : 'LIB-ORD';
    const orderId = `${orderPrefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const upiString = buildCanonicalUpiUri({
      payeeVpa: upiId,
      payeeName: merchantName,
      amountRupees: amount,
      transactionRef: orderId,
      transactionNote: isTest ? 'Gateway Test' : (isCustom ? 'Lakshya Library Payment' : 'Lakshya Smart Library Membership'),
    });
    const qrSvg = generateQrSvg(upiString, 240);

    // Call YouPI-PG Gateway with EXACT validated amount
    const gatewayResult = await youpiPaymentService.createPayment({
      orderId,
      amount,
      currency: 'INR',
      customer: {
        name: user.name,
        email: user.email,
        phoneNumber: user.phone,
      },
      metadata: {
        userId: String(user._id),
        planId,
        planName,
        isCustomAmount: isCustom,
        isTestTransaction: isTest,
        amount,
      },
      idempotencyKey,
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5-minute validity
    const payment = await Payment.create({
      orderId,
      userId: user._id,
      studentName: user.name,
      studentEmail: user.email,
      studentPhone: user.phone,
      studentIdNumber: user.studentIdNumber,
      planId,
      planName,
      amount,
      amountPaise,
      currency: 'INR',
      durationDays: (isCustom || isTest) ? 0 : 30,
      paymentType: 'ONLINE',
      status: 'CREATED',
      paymentMethod: 'UPI',
      isCustomAmount: isCustom,
      isTestTransaction: isTest,
      gatewayPaymentId: gatewayResult.paymentId,
      checkoutUrl: gatewayResult.checkoutUrl,
      idempotencyKey: idempotencyKey || undefined,
      orderCreatedTime: now,
      expiresAt,
      lastStatusUpdatedAt: now,
      paymentInitiatedAt: now,
    });

    return sendSuccess(
      res,
      {
        orderId: payment.orderId,
        paymentId: payment.gatewayPaymentId,
        amount: payment.amount,
        planName: payment.planName,
        durationDays: payment.durationDays,
        isCustomAmount: payment.isCustomAmount,
        isTestTransaction: payment.isTestTransaction,
        checkoutUrl: payment.checkoutUrl,
        status: payment.status,
        expiresAt: payment.expiresAt,
        isGatewayOnline: gatewayResult.isGatewayOnline,
        upiId,
        merchantName,
        upiString,
        qrSvg,
        qrSvgUrl: `/api/payments/qr.svg/${payment.orderId}`,
      },
      'Payment order created successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/submit-utr (ONLINE FLOW)
 * Student scans the authentic PhonePe QR image and submits the 12-digit UTR reference.
 */
export const submitUtr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { orderId, utr, notes } = req.body;
    if (!orderId || !utr) {
      return sendError(res, 'orderId and utr are required', 400);
    }

    const cleanUtr = String(utr).trim();
    if (cleanUtr.length < 6 || cleanUtr.length > 30) {
      return sendError(res, 'Invalid UPI Transaction Reference / UTR format (must be 6-30 characters)', 400);
    }

    const userId = new mongoose.Types.ObjectId(authUser.id);
    const payment = await Payment.findOne({ orderId, userId, paymentType: 'ONLINE' });
    if (!payment) {
      return sendError(res, 'Payment order not found', 404);
    }

    if (payment.status === 'SUCCESS') {
      return sendSuccess(res, payment, 'This payment is already confirmed and active');
    }

    // Verify duplicate UTR hasn't already been consumed by another confirmed transaction
    const existingUtr = await Payment.findOne({
      utr: cleanUtr,
      status: 'SUCCESS',
      _id: { $ne: payment._id },
    });
    if (existingUtr) {
      return sendError(res, 'This UPI Reference number has already been verified for another transaction', 409);
    }

    payment.utr = cleanUtr;
    payment.status = 'PENDING';
    payment.verificationSource = 'PENDING_VERIFICATION';
    if (notes) payment.notes = String(notes).trim().slice(0, 200);
    await payment.save();

    // Alert Admin
    try {
      await AdminNotification.create({
        type: 'SYSTEM',
        title: 'New Online UPI Payment Submitted',
        message: `${authUser.name} submitted UTR #${cleanUtr} for ₹${payment.amount} monthly membership. Verification pending.`,
        relatedStudentId: userId,
        studentName: authUser.name,
      });
    } catch (err: any) {
      console.warn('Failed to notify admin of UTR submission:', err.message);
    }

    return sendSuccess(
      res,
      {
        orderId: payment.orderId,
        status: payment.status,
        utr: payment.utr,
        amount: payment.amount,
        planName: payment.planName,
      },
      'UPI Transaction Reference submitted. Verification is in progress.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/offline-request (OPTION B: OFFLINE PAYMENT)
 * For students paying cash at desk, direct transfer, or outside the gateway.
 * CRITICAL RULE: Submitting an offline request DOES NOT renew membership.
 * It is saved as PENDING_APPROVAL and requires Admin review.
 */
export const submitOfflineRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }

    const user = await User.findById(authUser.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const { paymentMethod, utr, paymentDate, remarks, amount: reqAmount, isCustomAmount } = req.body;

    let amount = 500;
    let isCustom = Boolean(isCustomAmount);

    if (reqAmount !== undefined && reqAmount !== null && reqAmount !== '') {
      const parsedAmount = Number(reqAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
        return sendError(res, 'Offline payment amount must be at least ₹1.00', 400);
      }
      if (parsedAmount > 50000) {
        return sendError(res, 'Offline payment amount cannot exceed ₹50,000.00', 400);
      }
      amount = Math.round(parsedAmount * 100) / 100;
      if (amount !== 500) {
        isCustom = true;
      }
    }

    // Validate method
    const validMethods: OfflinePaymentMethod[] = ['CASH', 'UPI_DIRECT', 'BANK_TRANSFER', 'OTHER'];
    const selectedMethod = (paymentMethod || 'CASH').toUpperCase() as OfflinePaymentMethod;
    if (!validMethods.includes(selectedMethod)) {
      return sendError(res, 'Invalid offline payment method. Supported: CASH, UPI_DIRECT, BANK_TRANSFER, OTHER', 400);
    }

    // Check if student already has a pending offline request
    const existingPending = await Payment.findOne({
      userId: user._id,
      paymentType: 'OFFLINE',
      status: 'PENDING_APPROVAL',
    });
    if (existingPending) {
      return sendError(
        res,
        'You already have an offline payment request pending Admin approval. Please wait for the Admin to review it or visit the library desk.',
        409
      );
    }

    // File upload receipt if present
    let receiptUrl: string | undefined;
    if (req.file) {
      receiptUrl = `/uploads/${req.file.filename}`;
    }

    const orderId = `OFFLINE-ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const cleanUtr = utr ? String(utr).trim() : undefined;
    const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    const offlinePayment = await Payment.create({
      orderId,
      userId: user._id,
      studentName: user.name,
      studentEmail: user.email,
      studentPhone: user.phone,
      studentIdNumber: user.studentIdNumber,
      planId: isCustom ? 'custom-amount' : 'monthly-membership',
      planName: isCustom ? `Custom Offline Payment (₹${amount})` : 'Monthly Library Membership',
      amount,
      amountPaise: Math.round(amount * 100),
      currency: 'INR',
      durationDays: isCustom ? 0 : 30,
      paymentType: 'OFFLINE',
      status: 'PENDING_APPROVAL', // CRITICAL: NEVER ACTIVATES MEMBERSHIP HERE
      paymentMethod: selectedMethod,
      offlineMethod: selectedMethod,
      isCustomAmount: isCustom,
      paymentDate: effectivePaymentDate,
      utr: cleanUtr,
      receiptUrl,
      orderCreatedTime: new Date(),
      lastStatusUpdatedAt: new Date(),
      notes: remarks ? String(remarks).trim().slice(0, 300) : undefined,
    });

    // 1. In-App Notification to Student (Exact prompt text)
    try {
      await StudentNotification.create({
        studentId: user._id,
        type: 'SYSTEM',
        title: 'Offline Payment Submitted',
        message: 'Your offline payment request has been submitted for Admin approval. Your membership will be renewed only after approval.',
      });
    } catch (err: any) {
      console.warn('Failed to notify student of offline submission:', err.message);
    }

    // 2. In-App Notification to Admin
    try {
      await AdminNotification.create({
        type: 'SYSTEM',
        title: 'New Offline Payment Submitted',
        message: `${user.name} (${user.studentIdNumber || user.email}) submitted a ₹${offlinePayment.amount} offline payment (${selectedMethod}, UTR: ${cleanUtr || 'N/A'}). Admin review and approval required.`,
        relatedStudentId: user._id,
        studentName: user.name,
        seatNumber: user.assignedSeatNumber || user.currentSeatNumber,
      });
    } catch (err: any) {
      console.warn('Failed to notify admin of offline submission:', err.message);
    }

    return sendSuccess(
      res,
      {
        orderId: offlinePayment.orderId,
        status: offlinePayment.status,
        amount: offlinePayment.amount,
        offlineMethod: selectedMethod,
        isCustomAmount: offlinePayment.isCustomAmount,
        message: 'Your offline payment request has been submitted for Admin approval. Your membership will be renewed only after approval.',
      },
      'Offline payment request submitted successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/admin/offline-action/:orderId
 * Administrator approves or rejects an offline payment request.
 * Enforces backend RBAC, verifies request is still PENDING_APPROVAL, and renews membership on APPROVE.
 */
export const adminOfflineAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser || authUser.role !== 'ADMIN') {
      return sendError(res, 'Unauthorized: Admin role required', 403);
    }

    const { orderId } = req.params;
    const { action, rejectionReason, remarks, grantMembershipException } = req.body; // action: 'APPROVE' | 'REJECT'

    const payment = await Payment.findOne({ orderId, paymentType: 'OFFLINE' });
    if (!payment) {
      return sendError(res, 'Offline payment request not found', 404);
    }

    if (payment.status !== 'PENDING_APPROVAL') {
      return sendError(
        res,
        `Cannot perform action: This request is already marked as "${payment.status}"`,
        400
      );
    }

    const student = await User.findById(payment.userId);
    if (!student) {
      return sendError(res, 'Student account associated with this request was not found', 404);
    }

    const now = new Date();

    if (action === 'APPROVE') {
      payment.status = 'APPROVED';
      payment.adminActionBy = new mongoose.Types.ObjectId(authUser.id);
      payment.adminActionAt = now;
      payment.paymentCompletedAt = now;
      payment.verifiedAt = now;
      payment.lastStatusUpdatedAt = now;
      payment.verificationSource = 'OFFLINE_ADMIN_APPROVAL';
      if (!payment.receiptNumber) {
        payment.receiptNumber = `LSL-REC-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      }
      payment.notes = remarks ? String(remarks).trim() : payment.notes;

      const isDirectMonthlyPass = payment.amount === 500 && !payment.isCustomAmount && payment.planId !== 'custom-amount';
      const allowException = Boolean(grantMembershipException);

      let shouldRenew = false;
      let newCyclePaid = 0;
      let remaining = 0;

      if (isDirectMonthlyPass || allowException) {
        shouldRenew = true;
        newCyclePaid = 500;
        remaining = 0;
        student.currentCyclePaidAmount = 0;
      } else {
        const prevPaid = student.currentCyclePaidAmount || 0;
        const accumulated = prevPaid + payment.amount;
        if (accumulated >= 500) {
          shouldRenew = true;
          student.currentCyclePaidAmount = Math.max(0, accumulated - 500);
          newCyclePaid = accumulated;
          remaining = 0;
        } else {
          shouldRenew = false;
          student.currentCyclePaidAmount = accumulated;
          newCyclePaid = accumulated;
          remaining = 500 - accumulated;
        }
      }

      payment.membershipCyclePaidAmount = newCyclePaid;
      payment.membershipRemainingBalance = remaining;
      payment.membershipRenewed = shouldRenew;
      await payment.save();

      if (shouldRenew) {
        // Extend / Activate Student Membership by 1 Calendar Month + 5 Days Grace Period
        const { startDate, expiresAt, gracePeriodExpiresAt } = calculateNextMonthlyExpiry(
          student.membershipExpiresAt
        );

        student.membershipStatus = 'ACTIVE';
        student.membershipPlan = 'Monthly Library Membership';
        if (!student.membershipStartDate) {
          student.membershipStartDate = startDate;
        }
        student.membershipExpiresAt = expiresAt;
        student.gracePeriodExpiresAt = gracePeriodExpiresAt;
        student.lastRenewalDate = now;
        student.lastPaymentId = payment._id as mongoose.Types.ObjectId;
        student.lastReminderType = undefined;
        await student.save();

        const formattedExpiry = formatIndianDate(expiresAt);

        // Student In-App Notification
        try {
          await StudentNotification.create({
            studentId: student._id,
            type: 'SYSTEM',
            title: 'Offline Payment Approved',
            message: `Your offline payment of ₹${payment.amount} has been approved and your membership has been renewed. Next expiry: ${formattedExpiry}. (Receipt #${payment.receiptNumber})`,
          });
        } catch (err: any) {
          console.warn('Failed to notify student:', err.message);
        }

        // Real SMS to Student
        if (student.phone) {
          try {
            await sendSms({
              phoneNumber: student.phone,
              message: `Lakshya Smart Library: Your offline payment has been approved and membership renewed. Next expiry: ${formattedExpiry}. Thank you.`,
              templateType: 'RENEWAL_SUCCESS',
            });
          } catch (err: any) {
            console.warn('Failed to send SMS to student:', err.message);
          }
        }
      } else {
        // Custom amount offline partial payment
        await student.save();
        try {
          await StudentNotification.create({
            studentId: student._id,
            type: 'SYSTEM',
            title: 'Offline Payment Approved (Partial)',
            message: `Your offline payment of ₹${payment.amount} has been approved. Total paid: ₹${newCyclePaid}/₹500. Remaining balance: ₹${remaining}. (Ref: ${payment.orderId})`,
          });
        } catch (err: any) {
          console.warn('Failed to notify student:', err.message);
        }

        if (student.phone) {
          try {
            await sendSms({
              phoneNumber: student.phone,
              message: `Lakshya Smart Library: Offline payment of ₹${payment.amount} approved. Remaining balance: ₹${remaining}. Thank you.`,
              templateType: 'RENEWAL_SUCCESS',
            });
          } catch (err: any) {
            console.warn('Failed to send SMS to student:', err.message);
          }
        }
      }

      return sendSuccess(
        res,
        {
          orderId: payment.orderId,
          status: payment.status,
          receiptNumber: payment.receiptNumber,
          amount: payment.amount,
          membershipRenewed: payment.membershipRenewed,
          remainingBalance: remaining,
          membershipStatus: student.membershipStatus,
          membershipExpiresAt: student.membershipExpiresAt,
        },
        shouldRenew
          ? 'Offline payment approved and membership renewed successfully'
          : 'Offline partial payment approved and credited to balance'
      );
    } else if (action === 'REJECT') {
      payment.status = 'REJECTED';
      payment.adminActionBy = new mongoose.Types.ObjectId(authUser.id);
      payment.adminActionAt = now;
      payment.lastStatusUpdatedAt = now;
      payment.adminRejectionReason = rejectionReason
        ? String(rejectionReason).trim()
        : 'Payment could not be verified by administration.';
      await payment.save();

      // Student In-App Notification (Exact prompt text)
      try {
        await StudentNotification.create({
          studentId: student._id,
          type: 'SYSTEM',
          title: 'Payment Request Not Approved',
          message: `Your offline payment request could not be approved. Please check the Admin's response and contact the library if you need assistance. Reason: ${payment.adminRejectionReason}`,
        });
      } catch (err: any) {
        console.warn('Failed to notify student of rejection:', err.message);
      }

      return sendSuccess(
        res,
        {
          orderId: payment.orderId,
          status: payment.status,
          rejectionReason: payment.adminRejectionReason,
        },
        'Offline payment request rejected'
      );
    } else {
      return sendError(res, 'Invalid action. Expected "APPROVE" or "REJECT"', 400);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/admin/verify/:orderId
 * Administrator manually approves or rejects an online payment transaction.
 */
export const verifyPaymentAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser || authUser.role !== 'ADMIN') {
      return sendError(res, 'Unauthorized: Admin role required', 403);
    }

    const { orderId } = req.params;
    const { action, notes } = req.body; // action: 'APPROVE' | 'REJECT'

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return sendError(res, 'Payment transaction not found', 404);
    }

    if (action === 'APPROVE') {
      const result = await fulfillPaymentAndActivate(
        payment,
        'MANUAL_ADMIN',
        payment.utr,
        { adminNotes: notes }
      );
      return sendSuccess(
        res,
        {
          orderId: payment.orderId,
          status: 'SUCCESS',
          alreadyProcessed: result.alreadyProcessed,
        },
        'Payment verified and student membership activated'
      );
    } else if (action === 'REJECT') {
      payment.status = 'FAILED';
      payment.notes = notes || 'Rejected by Admin';
      await payment.save();
      return sendSuccess(res, { orderId: payment.orderId, status: 'FAILED' }, 'Payment marked as rejected');
    } else {
      return sendError(res, 'Invalid action. Expected "APPROVE" or "REJECT"', 400);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/status/:orderId
 * Check verification status of a payment.
 */
export const getOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }
    const { orderId } = req.params;

    const query: any = { orderId };
    if (authUser.role !== 'ADMIN') {
      query.userId = new mongoose.Types.ObjectId(authUser.id);
    }

    const payment = await Payment.findOne(query);
    if (!payment) {
      return sendError(res, 'Payment order not found', 404);
    }

    // If still PENDING online payment, check YouPI-PG Gateway observer
    if (
      payment.paymentType === 'ONLINE' &&
      payment.status === 'PENDING' &&
      payment.gatewayPaymentId &&
      !payment.gatewayPaymentId.startsWith('LOCAL_UPI_')
    ) {
      try {
        const gatewayStatus = await youpiPaymentService.getPaymentStatus(payment.gatewayPaymentId);
        if (gatewayStatus && gatewayStatus.status === 'SUCCESS') {
          await fulfillPaymentAndActivate(
            payment,
            'YOUPI_STATUS_API',
            gatewayStatus.utr || payment.utr,
            gatewayStatus
          );
        } else if (gatewayStatus && ['FAILED', 'EXPIRED', 'CANCELLED'].includes(gatewayStatus.status)) {
          payment.status = gatewayStatus.status;
          await payment.save();
        }
      } catch (err: any) {
        console.warn(`Could not poll YouPI status for order ${orderId}: ${err.message}`);
      }
    }

    const now = new Date();
    const isSessionExpired = Boolean(payment.expiresAt && now > payment.expiresAt);

    return sendSuccess(res, {
      orderId: payment.orderId,
      paymentType: payment.paymentType,
      status: payment.status,
      amount: payment.amount,
      planName: payment.planName,
      isCustomAmount: payment.isCustomAmount,
      isTestTransaction: payment.isTestTransaction,
      receiptNumber: payment.receiptNumber,
      membershipRemainingBalance: payment.membershipRemainingBalance,
      membershipCyclePaidAmount: payment.membershipCyclePaidAmount,
      membershipRenewed: payment.membershipRenewed,
      expiresAt: payment.expiresAt,
      isSessionExpired,
      utr: payment.utr,
      receiptUrl: payment.receiptUrl,
      offlineMethod: payment.offlineMethod,
      adminRejectionReason: payment.adminRejectionReason,
      verificationSource: payment.verificationSource,
      verifiedAt: payment.verifiedAt,
      orderCreatedTime: payment.orderCreatedTime || payment.createdAt,
      paymentCompletedAt: payment.paymentCompletedAt || payment.verifiedAt,
      lastStatusUpdatedAt: payment.lastStatusUpdatedAt || payment.updatedAt,
      refundStatus: payment.refundStatus,
      refundRequestedAt: payment.refundRequestedAt,
      refundReason: payment.refundReason,
      refundCompletedAt: payment.refundCompletedAt,
      refundReference: payment.refundReference,
      refundRejectionReason: payment.refundRejectionReason,
      createdAt: payment.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/qr-image
 * Securely streams the authentic user's PhonePe QR image from the project's qr folder.
 */
export const serveQrImage = (req: Request, res: Response) => {
  const possiblePaths = [
    path.join(process.cwd(), 'qr', 'QR.jpeg'),
    path.join(process.cwd(), 'qr', 'qr.jpeg'),
    path.join(process.cwd(), 'qr', 'qr.png'),
    path.join(process.cwd(), 'qr', 'QR.png'),
    path.join(process.cwd(), 'QR.jpeg'),
    path.join(__dirname, '..', '..', 'qr', 'QR.jpeg'),
    path.join(__dirname, '..', '..', '..', 'qr', 'QR.jpeg'),
    path.join(process.cwd(), '..', 'qr', 'QR.jpeg'),
    path.join(process.cwd(), '..', 'QR.jpeg'),
  ];

  let foundPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  if (!foundPath) {
    return res.status(404).json({
      success: false,
      message: 'Payment QR image is not available. Please place QR.jpeg in the qr folder.',
    });
  }

  const ext = path.extname(foundPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = fs.createReadStream(foundPath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
  });
  stream.pipe(res);
};

/**
 * GET /api/payments/qr-payload
 * Returns raw UPI payload and details for generating clean vector QR code directly without full poster.
 */
export const getQrPayload = (req: Request, res: Response) => {
  const upiId = process.env.MERCHANT_UPI_ID || '9955008447-7@axl';
  const merchantName = process.env.MERCHANT_NAME || 'Lakshya Smart Library';
  const amount = 500;
  const upiString = buildCanonicalUpiUri({
    payeeVpa: upiId,
    payeeName: merchantName,
    amountRupees: amount,
    transactionNote: 'Lakshya Smart Library Membership',
  });
  const qrSvg = generateQrSvg(upiString, 240);

  return sendSuccess(
    res,
    {
      upiId,
      merchantName,
      amount,
      currency: 'INR',
      note: 'Lakshya Smart Library Membership',
      upiString,
      qrSvg,
      qrSvgUrl: '/api/payments/qr.svg',
    },
    'UPI QR payload retrieved successfully'
  );
};

/**
 * GET /api/payments/qr.svg
 * GET /api/payments/qr.svg/:orderId
 * Serves authentic YouPI-PG dynamic vector SVG QR code (pure vector, no poster, no center logo).
 */
export const serveQrSvg = async (req: Request, res: Response) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : undefined;
  const upiId = process.env.MERCHANT_UPI_ID || '9955008447-7@axl';
  const merchantName = process.env.MERCHANT_NAME || 'Lakshya Smart Library';
  let amount = 500;
  let note = 'Lakshya Smart Library Membership';

  if (orderId) {
    const payment = await Payment.findOne({ orderId }).select('amount planName isCustomAmount');
    if (payment) {
      amount = payment.amount;
      note = payment.isCustomAmount || payment.amount !== 500 ? 'Lakshya Library Payment' : 'Lakshya Smart Library Membership';
    }
  } else if (req.query.amount) {
    const queryAmount = Number(req.query.amount);
    if (Number.isFinite(queryAmount) && queryAmount >= 1 && queryAmount <= 50000) {
      amount = Math.round(queryAmount * 100) / 100;
      note = 'Lakshya Library Payment';
    }
  }

  const upiString = buildCanonicalUpiUri({
    payeeVpa: upiId,
    payeeName: merchantName,
    amountRupees: amount,
    transactionRef: orderId,
    transactionNote: note,
  });

  const svg = generateQrSvg(upiString, 240);

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(svg);
};

/**
 * POST /api/payments/webhook
 * Official YouPI-PG Server-to-Server HMAC-SHA256 Signed Webhook Handler.
 */
export const handleWebhook = async (req: Request, res: Response) => {
  const signature = (req.headers['x-gateway-signature'] || req.headers['X-Gateway-Signature']) as string;
  const deliveryId = (req.headers['x-gateway-delivery-id'] || req.headers['X-Gateway-Delivery-Id']) as string;
  const timestamp = (req.headers['x-gateway-timestamp'] || req.headers['X-Gateway-Timestamp']) as string;

  const rawBody: Buffer | string = (req as any).rawBody || JSON.stringify(req.body);

  const verification = youpiPaymentService.verifyWebhook(rawBody, signature, timestamp, deliveryId);

  if (!verification.isValid || !verification.payload) {
    console.warn(`[YouPI Webhook] Signature verification failed: ${verification.error}`);
    return res.status(401).json({ error: verification.error || 'Invalid webhook signature' });
  }

  const payload = verification.payload;
  console.log(`[YouPI Webhook] Verified event: ${payload.event} for order ${payload.orderId}`);

  // Deduplicate deliveries on deliveryId
  if (deliveryId) {
    const existingDelivery = await Payment.findOne({ deliveryId });
    if (existingDelivery) {
      return res.status(200).json({ received: true, duplicate: true });
    }
  }

  if (payload.event !== 'SUCCESS') {
    if (payload.orderId) {
      await Payment.updateOne(
        { orderId: payload.orderId, status: { $ne: 'SUCCESS' } },
        { status: payload.event, gatewayRawResponse: payload }
      );
    }
    return res.status(200).json({ received: true, status: payload.event });
  }

  const payment = await Payment.findOne({ orderId: payload.orderId });
  if (!payment) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Amount verification (must match ₹500)
  const incomingAmount = Number(payload.amount);
  if (Number.isFinite(incomingAmount) && Math.abs(payment.amount - incomingAmount) > 0.01) {
    return res.status(409).json({ error: 'Amount mismatch with order' });
  }

  try {
    if (deliveryId) payment.deliveryId = deliveryId;
    const result = await fulfillPaymentAndActivate(payment, 'YOUPI_WEBHOOK', payload.utr, payload);
    return res.status(200).json({
      received: true,
      success: true,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err: any) {
    console.error('[YouPI Webhook] Error fulfilling payment:', err);
    return res.status(500).json({ error: 'Internal server error activating subscription' });
  }
};

/**
 * GET /api/payments/admin/all
 * Administrator endpoint to inspect all payment transactions (both Online and Offline).
 */
export const getAdminPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type, testClassification, search, page = 1, limit = 15 } = req.query;

    const query: any = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (type && type !== 'ALL') {
      query.paymentType = type;
    }
    if (testClassification === 'TEST') {
      query.isTestTransaction = true;
    } else if (testClassification === 'PROD') {
      query.isTestTransaction = { $ne: true };
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { orderId: searchRegex },
        { studentName: searchRegex },
        { studentEmail: searchRegex },
        { utr: searchRegex },
        { receiptNumber: searchRegex },
        { refundReference: searchRegex },
        { studentIdNumber: searchRegex },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Payment.countDocuments(query),
    ]);

    // Aggregate statistics across entire database
    const statsAgg = await Payment.aggregate([
      {
        $group: {
          _id: {
            status: '$status',
            type: '$paymentType',
            refundStatus: '$refundStatus',
            isCustom: { $ifNull: ['$isCustomAmount', false] },
            isTest: { $ifNull: ['$isTestTransaction', false] },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const stats = {
      totalCollected: 0,
      totalOnlineRevenue: 0,
      totalOfflineRevenue: 0,
      onlineSuccess: 0,
      offlineApproved: 0,
      pendingOfflineApproval: 0,
      pendingOnline: 0,
      totalFailed: 0,
      customPayments: 0,
      monthlyPayments: 0,
      testTransactions: 0,
      testRevenue: 0,
      totalRefundedAmount: 0,
      totalRefundsCount: 0,
      pendingRefundRequestsCount: 0,
    };

    statsAgg.forEach((item) => {
      const { status, type: paymentType, refundStatus, isCustom, isTest } = item._id;

      if (isTest) {
        stats.testTransactions += item.count;
        if (status === 'SUCCESS' || status === 'APPROVED') {
          stats.testRevenue += item.totalAmount;
        }
        return; // Test transactions do not increment production revenue or production counters
      }

      // Refund tracking
      if (status === 'REFUNDED' || refundStatus === 'REFUNDED') {
        stats.totalRefundsCount += item.count;
        stats.totalRefundedAmount += item.totalAmount;
      }
      if (refundStatus === 'REFUND_REQUESTED' || refundStatus === 'REFUND_UNDER_REVIEW') {
        stats.pendingRefundRequestsCount += item.count;
      }

      // Production counts and revenues (exclude refunded payments from active revenue)
      if ((status === 'SUCCESS' || status === 'APPROVED') && refundStatus !== 'REFUNDED') {
        stats.totalCollected += item.totalAmount;
        if (status === 'SUCCESS' && paymentType === 'ONLINE') {
          stats.onlineSuccess += item.count;
          stats.totalOnlineRevenue += item.totalAmount;
        }
        if (status === 'APPROVED' && paymentType === 'OFFLINE') {
          stats.offlineApproved += item.count;
          stats.totalOfflineRevenue += item.totalAmount;
        }
      }

      if (status === 'PENDING_APPROVAL') {
        stats.pendingOfflineApproval += item.count;
      }
      if (status === 'PENDING' || status === 'PROCESSING') {
        stats.pendingOnline += item.count;
      }
      if (status === 'FAILED' || status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED') {
        stats.totalFailed += item.count;
      }

      if (isCustom) {
        stats.customPayments += item.count;
      } else {
        stats.monthlyPayments += item.count;
      }
    });

    return sendSuccess(res, {
      payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/refund-request/:orderId
 * Student submits a refund request for an eligible verified payment.
 */
export const requestRefund = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }
    const { orderId } = req.params;
    const { reason } = req.body;

    const payment = await Payment.findOne({
      orderId,
      userId: new mongoose.Types.ObjectId(authUser.id),
    });

    if (!payment) {
      return sendError(res, 'Payment transaction not found', 404);
    }

    if (payment.status !== 'SUCCESS' && payment.status !== 'APPROVED') {
      return sendError(res, 'Only successful or approved payments are eligible for a refund request', 400);
    }

    if (
      payment.refundStatus &&
      ['REFUND_REQUESTED', 'REFUND_UNDER_REVIEW', 'REFUND_APPROVED', 'REFUND_PROCESSING', 'REFUNDED'].includes(
        payment.refundStatus
      )
    ) {
      return sendError(res, `A refund request is already active or completed with status: ${payment.refundStatus}`, 409);
    }

    const cleanReason = reason ? String(reason).trim().slice(0, 500) : 'Student requested refund';

    payment.refundStatus = 'REFUND_REQUESTED';
    payment.refundRequestedAt = new Date();
    payment.refundReason = cleanReason;
    payment.lastStatusUpdatedAt = new Date();
    await payment.save();

    // Notify Student
    try {
      await StudentNotification.create({
        studentId: payment.userId,
        type: 'SYSTEM',
        title: 'Refund Request Submitted',
        message: `Your refund request for ₹${payment.amount} (Ref: ${payment.orderId}) has been submitted for Admin review.`,
      });
    } catch (err: any) {
      console.warn('Student notification error:', err.message);
    }

    // Notify Admin
    try {
      await AdminNotification.create({
        type: 'SYSTEM',
        title: 'New Refund Request Submitted',
        message: `${payment.studentName} (${payment.studentIdNumber || payment.studentEmail}) requested a refund of ₹${payment.amount} (Ref: ${payment.orderId}). Reason: ${cleanReason}`,
        relatedStudentId: payment.userId,
        studentName: payment.studentName,
      });
    } catch (err: any) {
      console.warn('Admin notification error:', err.message);
    }

    return sendSuccess(
      res,
      {
        orderId: payment.orderId,
        refundStatus: payment.refundStatus,
        refundRequestedAt: payment.refundRequestedAt,
        refundReason: payment.refundReason,
      },
      'Refund request submitted successfully and is under Admin review'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/admin/refund-action/:orderId
 * Admin approves or rejects a refund request and updates accounting.
 */
export const adminProcessRefund = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser || authUser.role !== 'ADMIN') {
      return sendError(res, 'Unauthorized: Admin role required', 403);
    }

    const { orderId } = req.params;
    const { action, rejectionReason, refundReference, remarks } = req.body; // 'APPROVE' | 'REJECT'

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return sendError(res, 'Payment transaction not found', 404);
    }

    if (payment.refundStatus === 'REFUNDED') {
      return sendError(res, 'This payment has already been refunded', 400);
    }

    const student = await User.findById(payment.userId);
    if (!student) {
      return sendError(res, 'Student account not found', 404);
    }

    const now = new Date();

    if (action === 'APPROVE') {
      payment.refundStatus = 'REFUNDED';
      payment.status = 'REFUNDED';
      payment.refundAdminActionAt = now;
      payment.refundAdminActionBy = new mongoose.Types.ObjectId(authUser.id);
      payment.refundCompletedAt = now;
      payment.refundAmount = payment.amount;
      payment.refundReference = refundReference ? String(refundReference).trim() : `REF-${Date.now()}`;
      payment.lastStatusUpdatedAt = now;
      if (remarks) payment.notes = `${payment.notes ? payment.notes + ' | ' : ''}Refund notes: ${remarks}`;
      await payment.save();

      // Reverse membership accounting
      student.currentCyclePaidAmount = Math.max(0, (student.currentCyclePaidAmount || 0) - payment.amount);
      if (payment.membershipRenewed) {
        student.membershipStatus = 'INACTIVE';
      }
      await student.save();

      // Notify Student
      try {
        await StudentNotification.create({
          studentId: student._id,
          type: 'SYSTEM',
          title: 'Refund Processed Successfully',
          message: `Your refund of ₹${payment.amount} has been approved and processed (Ref: ${payment.refundReference}). Your membership balance has been adjusted.`,
        });
      } catch (err: any) {
        console.warn('Failed to notify student:', err.message);
      }

      // Send SMS
      if (student.phone) {
        try {
          await sendSms({
            phoneNumber: student.phone,
            message: `Lakshya Smart Library: Your refund of ₹${payment.amount} has been processed (Ref: ${payment.refundReference}). Thank you.`,
            templateType: 'RENEWAL_SUCCESS',
          });
        } catch (err: any) {
          console.warn('Failed to send SMS:', err.message);
        }
      }

      return sendSuccess(
        res,
        {
          orderId: payment.orderId,
          status: payment.status,
          refundStatus: payment.refundStatus,
          refundReference: payment.refundReference,
          refundAmount: payment.refundAmount,
          membershipStatus: student.membershipStatus,
          currentCyclePaidAmount: student.currentCyclePaidAmount,
        },
        'Refund approved and processed successfully'
      );
    } else if (action === 'REJECT') {
      payment.refundStatus = 'REFUND_REJECTED';
      payment.refundAdminActionAt = now;
      payment.refundAdminActionBy = new mongoose.Types.ObjectId(authUser.id);
      payment.refundRejectionReason = rejectionReason
        ? String(rejectionReason).trim()
        : 'Refund request was rejected by library administration';
      payment.lastStatusUpdatedAt = now;
      await payment.save();

      // Notify Student
      try {
        await StudentNotification.create({
          studentId: student._id,
          type: 'SYSTEM',
          title: 'Refund Request Not Approved',
          message: `Your refund request for ₹${payment.amount} (Ref: ${payment.orderId}) was not approved. Reason: ${payment.refundRejectionReason}`,
        });
      } catch (err: any) {
        console.warn('Failed to notify student:', err.message);
      }

      return sendSuccess(
        res,
        {
          orderId: payment.orderId,
          refundStatus: payment.refundStatus,
          refundRejectionReason: payment.refundRejectionReason,
        },
        'Refund request marked as rejected'
      );
    } else {
      return sendError(res, 'Invalid action. Expected "APPROVE" or "REJECT"', 400);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/receipt/:orderId
 * Returns full verified official payment receipt.
 */
export const getPaymentReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }
    const { orderId } = req.params;

    const query: any = { orderId };
    if (authUser.role !== 'ADMIN') {
      query.userId = new mongoose.Types.ObjectId(authUser.id);
    }

    const payment = await Payment.findOne(query);
    if (!payment) {
      return sendError(res, 'Payment transaction not found', 404);
    }

    if (payment.status !== 'SUCCESS' && payment.status !== 'APPROVED') {
      return sendError(res, 'Receipt can only be generated for verified and completed payments', 400);
    }

    const receipt = {
      receiptNumber: payment.receiptNumber || `LSL-REC-${payment.orderId.slice(-6)}`,
      orderId: payment.orderId,
      gatewayPaymentId: payment.gatewayPaymentId || null,
      utr: payment.utr || null,
      studentName: payment.studentName,
      studentEmail: payment.studentEmail,
      studentPhone: payment.studentPhone || null,
      studentIdNumber: payment.studentIdNumber || null,
      amount: payment.amount,
      currency: payment.currency,
      paymentType: payment.paymentType,
      paymentMethod: payment.paymentMethod,
      offlineMethod: payment.offlineMethod || null,
      isCustomAmount: payment.isCustomAmount,
      isTestTransaction: payment.isTestTransaction,
      status: payment.status,
      refundStatus: payment.refundStatus || null,
      refundReference: payment.refundReference || null,
      planName: payment.planName,
      createdAt: payment.createdAt,
      verifiedAt: payment.verifiedAt || payment.updatedAt,
      paymentCompletedAt: payment.paymentCompletedAt || payment.verifiedAt || payment.updatedAt,
      verificationSource: payment.verificationSource,
      membershipCyclePaidAmount: payment.membershipCyclePaidAmount,
      membershipRemainingBalance: payment.membershipRemainingBalance,
      membershipRenewed: payment.membershipRenewed,
      notes: payment.notes || null,
      organization: {
        name: 'Lakshya Smart Library',
        tagline: 'Personal Library Management & Attendance System',
        address: 'Lakshya Smart Library, Main Road, Study Center',
        supportEmail: 'support@lakshyalibrary.com',
      },
    };

    return sendSuccess(res, receipt, 'Receipt retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/cron/check-expiries
 * Automated scheduled job endpoint to process expiries, grace periods, and SMS reminders.
 */
export const checkExpiriesEndpoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runAutomaticExpiryChecks();
    return sendSuccess(res, result, 'Membership expiry and reminder scan completed');
  } catch (error) {
    next(error);
  }
};
