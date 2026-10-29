import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Payment, IPayment } from '../models/Payment';
import { User, IUser } from '../models/User';
import { AdminNotification } from '../models/AdminNotification';
import { StudentNotification } from '../models/StudentNotification';
import { MEMBERSHIP_PLANS, getPlanById } from '../config/membershipPlans';
import { youpiPaymentService } from '../services/youpiPaymentService';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Helper to fulfill and activate a student's membership after verified payment.
 * Ensures strict idempotency: if already activated, does not extend twice.
 */
export async function fulfillPaymentAndActivate(
  payment: IPayment,
  source: 'YOUPI_WEBHOOK' | 'YOUPI_STATUS_API' | 'MANUAL_ADMIN',
  utr?: string,
  gatewayDetails?: Record<string, any>
): Promise<{ success: boolean; alreadyProcessed: boolean }> {
  // Atomic check on payment status
  if (payment.status === 'SUCCESS') {
    return { success: true, alreadyProcessed: true };
  }

  const user = await User.findById(payment.userId);
  if (!user) {
    throw new Error(`User not found for payment: ${payment.userId}`);
  }

  // Calculate new membership expiration
  const durationMs = (payment.durationDays || 30) * 24 * 60 * 60 * 1000;
  const now = new Date();
  let newExpiresAt: Date;

  if (user.membershipExpiresAt && new Date(user.membershipExpiresAt) > now) {
    // Extend from current expiration date
    newExpiresAt = new Date(new Date(user.membershipExpiresAt).getTime() + durationMs);
  } else {
    // Start fresh from today
    newExpiresAt = new Date(now.getTime() + durationMs);
  }

  // Update payment record
  payment.status = 'SUCCESS';
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
  user.membershipPlan = payment.planName;
  user.membershipExpiresAt = newExpiresAt;
  user.lastPaymentId = payment._id as mongoose.Types.ObjectId;
  await user.save();

  // Notify the student
  try {
    const formattedDate = newExpiresAt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    await StudentNotification.create({
      studentId: user._id,
      type: 'SYSTEM',
      title: 'Payment Successful & Membership Activated!',
      message: `Your payment of ₹${payment.amount} for "${payment.planName}" is confirmed. Your membership is now active until ${formattedDate}.`,
    });
  } catch (err) {
    console.warn('[Notification Error] Could not create student payment notification:', err);
  }

  // Notify the admin
  try {
    await AdminNotification.create({
      type: 'SYSTEM',
      title: 'Payment Confirmed',
      message: `${user.name} successfully paid ₹${payment.amount} for ${payment.planName} (Order: ${payment.orderId}, UTR: ${payment.utr || 'N/A'}, via ${source}).`,
      relatedStudentId: user._id,
      studentName: user.name,
      seatNumber: user.assignedSeatNumber || user.currentSeatNumber,
    });
  } catch (err) {
    console.warn('[Notification Error] Could not create admin payment notification:', err);
  }

  return { success: true, alreadyProcessed: false };
}

/**
 * GET /api/payments/plans
 * Returns all available membership plans.
 */
export const getPlans = async (req: Request, res: Response) => {
  return sendSuccess(res, MEMBERSHIP_PLANS, 'Membership plans retrieved successfully');
};

/**
 * GET /api/payments/my-payments
 * Returns logged-in student's payment history and membership overview.
 */
export const getMyPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }

    const userId = new mongoose.Types.ObjectId(authUser.id);
    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const fullUser = await User.findById(userId).select(
      'membershipStatus membershipPlan membershipExpiresAt'
    );

    const isExpired =
      fullUser?.membershipExpiresAt &&
      new Date(fullUser.membershipExpiresAt) < new Date();

    const effectiveStatus = isExpired ? 'EXPIRED' : (fullUser?.membershipStatus || 'INACTIVE');

    return sendSuccess(res, {
      membership: {
        status: effectiveStatus,
        plan: fullUser?.membershipPlan || null,
        expiresAt: fullUser?.membershipExpiresAt || null,
      },
      payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/create-order
 * Initializes a payment order for a selected membership plan.
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

    const { planId, idempotencyKey } = req.body;
    if (!planId) {
      return sendError(res, 'planId is required', 400);
    }

    const plan = getPlanById(planId);
    if (!plan) {
      return sendError(res, `Invalid planId: "${planId}"`, 400);
    }

    // Check for duplicate pending order created within the last 5 minutes to prevent double clicks
    if (idempotencyKey) {
      const existing = await Payment.findOne({ idempotencyKey, userId: user._id });
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
    const amount = plan.price;
    const amountPaise = Math.round(amount * 100);

    // Call YouPI-PG Gateway
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
      },
      idempotencyKey,
    });

    // Save payment record in local database
    const payment = await Payment.create({
      orderId,
      userId: user._id,
      studentName: user.name,
      studentEmail: user.email,
      studentPhone: user.phone,
      planId: plan.id,
      planName: plan.name,
      amount,
      amountPaise,
      currency: 'INR',
      durationDays: plan.durationDays,
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
        durationDays: payment.durationDays,
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
 * POST /api/payments/submit-utr
 * Student scans the user's PhonePe QR image and submits the 12-digit UTR reference.
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
    const payment = await Payment.findOne({ orderId, userId });
    if (!payment) {
      return sendError(res, 'Payment order not found', 404);
    }

    if (payment.status === 'SUCCESS') {
      return sendSuccess(res, payment, 'This payment is already confirmed and active');
    }

    // Check if another payment has already consumed this exact UTR successfully
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

    // Alert administrators in real-time
    try {
      await AdminNotification.create({
        type: 'SYSTEM',
        title: 'New UPI Payment Submitted',
        message: `${authUser.name} submitted UTR #${cleanUtr} for ₹${payment.amount} (${payment.planName}). Verification pending.`,
        relatedStudentId: userId,
        studentName: authUser.name,
      });
    } catch (err) {
      console.warn('Failed to notify admin of UTR submission:', err);
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
 * GET /api/payments/status/:orderId
 * Check verification status of a payment.
 * Automatically queries YouPI-PG Gateway observer if order is pending and has a gateway session.
 */
export const getOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return sendError(res, 'Unauthorized', 401);
    }
    const { orderId } = req.params;

    const query: any = { orderId };
    // Students can only check their own orders; admins can check any
    if (authUser.role !== 'ADMIN') {
      query.userId = new mongoose.Types.ObjectId(authUser.id);
    }

    const payment = await Payment.findOne(query);
    if (!payment) {
      return sendError(res, 'Payment order not found', 404);
    }

    // If still PENDING and has YouPI gatewayPaymentId, poll gateway status
    if (
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
      status: payment.status,
      amount: payment.amount,
      planName: payment.planName,
      durationDays: payment.durationDays,
      utr: payment.utr,
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
  // Check qr/QR.jpeg, qr/qr.jpeg, or root QR.jpeg
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
      message: 'Payment QR image is not available yet. Please place QR.jpeg in the qr folder.',
    });
  }

  const ext = path.extname(foundPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = fs.createReadStream(foundPath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).end();
    }
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

  // The raw body is captured by our express.json verify hook
  const rawBody: Buffer | string = (req as any).rawBody || JSON.stringify(req.body);

  const verification = youpiPaymentService.verifyWebhook(
    rawBody,
    signature,
    timestamp,
    deliveryId
  );

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
      console.log(`[YouPI Webhook] Duplicate delivery ${deliveryId} already received`);
      return res.status(200).json({ received: true, duplicate: true });
    }
  }

  if (payload.event !== 'SUCCESS') {
    // If failed/cancelled/expired, record it if payment exists
    if (payload.orderId) {
      await Payment.updateOne(
        { orderId: payload.orderId, status: { $ne: 'SUCCESS' } },
        { status: payload.event, gatewayRawResponse: payload }
      );
    }
    return res.status(200).json({ received: true, status: payload.event });
  }

  // Find payment order
  const payment = await Payment.findOne({ orderId: payload.orderId });
  if (!payment) {
    console.error(`[YouPI Webhook] Payment order not found: ${payload.orderId}`);
    return res.status(404).json({ error: 'Order not found' });
  }

  // Amount validation (sanity check to prevent amount manipulation)
  const incomingAmount = Number(payload.amount);
  if (Number.isFinite(incomingAmount) && Math.abs(payment.amount - incomingAmount) > 0.01) {
    console.error(
      `[YouPI Webhook] Amount mismatch! Expected ₹${payment.amount}, received ₹${incomingAmount}`
    );
    return res.status(409).json({ error: 'Amount mismatch with order' });
  }

  // Idempotent fulfillment & membership activation
  try {
    if (deliveryId) {
      payment.deliveryId = deliveryId;
    }
    const result = await fulfillPaymentAndActivate(
      payment,
      'YOUPI_WEBHOOK',
      payload.utr,
      payload
    );

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
 * Administrator endpoint to inspect all payment transactions.
 */
export const getAdminPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, page = 1, limit = 15 } = req.query;

    const query: any = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { orderId: searchRegex },
        { studentName: searchRegex },
        { studentEmail: searchRegex },
        { utr: searchRegex },
        { planName: searchRegex },
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
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const stats: Record<string, { count: number; totalAmount: number }> = {
      SUCCESS: { count: 0, totalAmount: 0 },
      PENDING: { count: 0, totalAmount: 0 },
      CREATED: { count: 0, totalAmount: 0 },
      FAILED: { count: 0, totalAmount: 0 },
    };

    statsAgg.forEach((item) => {
      if (stats[item._id]) {
        stats[item._id] = { count: item.count, totalAmount: item.totalAmount };
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
 * POST /api/payments/admin/verify/:orderId
 * Administrator manual approval or rejection for a pending payment.
 */
export const verifyPaymentAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { action, notes } = req.body; // action: 'APPROVE' | 'REJECT'

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return sendError(res, 'Payment not found', 404);
    }

    if (action === 'APPROVE') {
      if (payment.status === 'SUCCESS') {
        return sendError(res, 'Payment is already marked as SUCCESS', 400);
      }

      if (notes) payment.notes = String(notes).trim();
      await fulfillPaymentAndActivate(payment, 'MANUAL_ADMIN', payment.utr);

      return sendSuccess(res, payment, 'Payment verified and membership activated successfully');
    } else if (action === 'REJECT') {
      payment.status = 'FAILED';
      if (notes) payment.notes = String(notes).trim();
      await payment.save();

      return sendSuccess(res, payment, 'Payment marked as rejected');
    } else {
      return sendError(res, 'Invalid action. Expected "APPROVE" or "REJECT"', 400);
    }
  } catch (error) {
    next(error);
  }
};
