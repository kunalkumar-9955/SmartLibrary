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

  // Calculate 1 calendar month renewal + 5-day grace period
  const { startDate, expiresAt, gracePeriodExpiresAt } = calculateNextMonthlyExpiry(
    user.membershipExpiresAt
  );

  // Update payment record
  payment.status = source === 'OFFLINE_ADMIN_APPROVAL' ? 'APPROVED' : 'SUCCESS';
  payment.verifiedAt = new Date();
  payment.verificationSource = source;
  if (utr && !payment.utr) {
    payment.utr = utr;
  }
  if (gatewayDetails) {
    payment.gatewayRawResponse = gatewayDetails;
  }
  await payment.save();

  // Update user subscription state
  user.membershipStatus = 'ACTIVE';
  user.membershipPlan = 'Monthly Library Membership';
  if (!user.membershipStartDate) {
    user.membershipStartDate = startDate;
  }
  user.membershipExpiresAt = expiresAt;
  user.gracePeriodExpiresAt = gracePeriodExpiresAt;
  user.lastRenewalDate = new Date();
  user.lastPaymentId = payment._id as mongoose.Types.ObjectId;
  user.lastReminderType = undefined; // Reset reminder for next cycle
  await user.save();

  const formattedExpiry = formatIndianDate(expiresAt);

  // 1. Notify Student via In-App Notification (Exact prompt text)
  try {
    const isOffline = source === 'OFFLINE_ADMIN_APPROVAL';
    const notifTitle = isOffline ? 'Payment Approved' : 'Membership Renewed Successfully';
    const notifMessage = isOffline
      ? `Your offline payment has been approved and your membership has been renewed. Your next expiry date is ${formattedExpiry}.`
      : `Your ₹500 online payment has been verified and your membership has been renewed. Your next expiry date is ${formattedExpiry}.`;

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
        message: `Lakshya Smart Library: Your membership has been renewed successfully. Your next expiry date is ${formattedExpiry}. Thank you.`,
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
      message: `${user.name} (${user.studentIdNumber || user.email}) renewed ₹500 monthly membership via ${source} (Ref: ${payment.orderId}). Active until ${formattedExpiry}.`,
      relatedStudentId: user._id,
      studentName: user.name,
      seatNumber: user.assignedSeatNumber || user.currentSeatNumber,
    });
  } catch (err: any) {
    console.warn('[Notification Error] Failed to create admin notification:', err.message);
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
        'membershipStatus membershipPlan membershipStartDate membershipExpiresAt gracePeriodExpiresAt lastRenewalDate assignedSeatNumber currentSeatNumber'
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

    return sendSuccess(res, {
      membership: {
        status: effectiveStatus,
        plan: fullUser?.membershipPlan || 'Monthly Library Membership',
        startDate: fullUser?.membershipStartDate || null,
        expiresAt: fullUser?.membershipExpiresAt || null,
        gracePeriodExpiresAt: fullUser?.gracePeriodExpiresAt || null,
        lastRenewalDate: fullUser?.lastRenewalDate || null,
        monthlyFee: 500,
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

    const { idempotencyKey } = req.body;
    const plan = getPlanById(); // Strictly ₹500 plan
    const amount = 500;
    const amountPaise = 50000;

    // Check for existing pending order with same idempotency key
    if (idempotencyKey) {
      const existing = await Payment.findOne({
        idempotencyKey,
        userId: user._id,
        paymentType: 'ONLINE',
      });
      if (existing && existing.status !== 'FAILED' && existing.status !== 'CANCELLED') {
        return sendSuccess(
          res,
          {
            orderId: existing.orderId,
            paymentId: existing.gatewayPaymentId,
            amount: existing.amount,
            planName: existing.planName,
            checkoutUrl: existing.checkoutUrl,
            status: existing.status,
            isExisting: true,
          },
          'Returning existing order session'
        );
      }
    }

    const orderId = `LIB-ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Call YouPI-PG Gateway (falls back to direct PhonePe UPI QR mode if daemon offline)
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
        planId: plan.id,
        planName: plan.name,
        monthlyFee: 500,
      },
      idempotencyKey,
    });

    const payment = await Payment.create({
      orderId,
      userId: user._id,
      studentName: user.name,
      studentEmail: user.email,
      studentPhone: user.phone,
      studentIdNumber: user.studentIdNumber,
      planId: plan.id,
      planName: plan.name,
      amount,
      amountPaise,
      currency: 'INR',
      durationDays: 30,
      paymentType: 'ONLINE',
      status: 'CREATED',
      paymentMethod: 'UPI',
      gatewayPaymentId: gatewayResult.paymentId,
      checkoutUrl: gatewayResult.checkoutUrl,
      idempotencyKey: idempotencyKey || undefined,
    });

    return sendSuccess(
      res,
      {
        orderId: payment.orderId,
        paymentId: payment.gatewayPaymentId,
        amount: payment.amount,
        planName: payment.planName,
        durationDays: 30,
        checkoutUrl: payment.checkoutUrl,
        status: payment.status,
        isGatewayOnline: gatewayResult.isGatewayOnline,
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

    const { paymentMethod, utr, paymentDate, remarks } = req.body;

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
      planId: 'monthly-membership',
      planName: 'Monthly Library Membership',
      amount: 500, // Strictly ₹500
      amountPaise: 50000,
      currency: 'INR',
      durationDays: 30,
      paymentType: 'OFFLINE',
      status: 'PENDING_APPROVAL', // CRITICAL: NEVER ACTIVATES MEMBERSHIP HERE
      paymentMethod: selectedMethod,
      offlineMethod: selectedMethod,
      paymentDate: effectivePaymentDate,
      utr: cleanUtr,
      receiptUrl,
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
        message: `${user.name} (${user.studentIdNumber || user.email}) submitted a ₹500 offline payment (${selectedMethod}, UTR: ${cleanUtr || 'N/A'}). Admin review and approval required.`,
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
        amount: 500,
        offlineMethod: selectedMethod,
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
    const { action, rejectionReason, remarks } = req.body; // action: 'APPROVE' | 'REJECT'

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

    if (action === 'APPROVE') {
      payment.status = 'APPROVED';
      payment.adminActionBy = new mongoose.Types.ObjectId(authUser.id);
      payment.adminActionAt = new Date();
      payment.notes = remarks ? String(remarks).trim() : payment.notes;
      payment.verifiedAt = new Date();
      payment.verificationSource = 'OFFLINE_ADMIN_APPROVAL';
      await payment.save();

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
      student.lastRenewalDate = new Date();
      student.lastPaymentId = payment._id as mongoose.Types.ObjectId;
      student.lastReminderType = undefined;
      await student.save();

      const formattedExpiry = formatIndianDate(expiresAt);

      // Student In-App Notification (Exact prompt text)
      try {
        await StudentNotification.create({
          studentId: student._id,
          type: 'SYSTEM',
          title: 'Payment Approved',
          message: `Your offline payment has been approved and your membership has been renewed. Your next expiry date is ${formattedExpiry}.`,
        });
      } catch (err: any) {
        console.warn('Failed to notify student:', err.message);
      }

      // Real SMS to Student
      if (student.phone) {
        try {
          await sendSms({
            phoneNumber: student.phone,
            message: `Lakshya Smart Library: Your membership has been renewed successfully. Your next expiry date is ${formattedExpiry}. Thank you.`,
            templateType: 'RENEWAL_SUCCESS',
          });
        } catch (err: any) {
          console.warn('Failed to send SMS to student:', err.message);
        }
      }

      return sendSuccess(
        res,
        {
          orderId: payment.orderId,
          status: payment.status,
          membershipStatus: student.membershipStatus,
          membershipExpiresAt: student.membershipExpiresAt,
        },
        'Offline payment approved and membership renewed successfully'
      );
    } else if (action === 'REJECT') {
      payment.status = 'REJECTED';
      payment.adminActionBy = new mongoose.Types.ObjectId(authUser.id);
      payment.adminActionAt = new Date();
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

    return sendSuccess(res, {
      orderId: payment.orderId,
      paymentType: payment.paymentType,
      status: payment.status,
      amount: payment.amount,
      planName: payment.planName,
      utr: payment.utr,
      receiptUrl: payment.receiptUrl,
      offlineMethod: payment.offlineMethod,
      adminRejectionReason: payment.adminRejectionReason,
      verificationSource: payment.verificationSource,
      verifiedAt: payment.verifiedAt,
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
    const { status, type, search, page = 1, limit = 15 } = req.query;

    const query: any = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (type && type !== 'ALL') {
      query.paymentType = type;
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { orderId: searchRegex },
        { studentName: searchRegex },
        { studentEmail: searchRegex },
        { utr: searchRegex },
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

    // Aggregate statistics
    const statsAgg = await Payment.aggregate([
      {
        $group: {
          _id: { status: '$status', type: '$paymentType' },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const stats = {
      totalCollected: 0,
      onlineSuccess: 0,
      offlineApproved: 0,
      pendingOfflineApproval: 0,
      pendingOnline: 0,
    };

    statsAgg.forEach((item) => {
      const { status } = item._id;
      if (status === 'SUCCESS' || status === 'APPROVED') {
        stats.totalCollected += item.totalAmount;
        if (status === 'SUCCESS') stats.onlineSuccess += item.count;
        if (status === 'APPROVED') stats.offlineApproved += item.count;
      }
      if (status === 'PENDING_APPROVAL') {
        stats.pendingOfflineApproval += item.count;
      }
      if (status === 'PENDING') {
        stats.pendingOnline += item.count;
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
