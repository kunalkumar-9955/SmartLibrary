import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import apiRoutes from '../routes';
import { errorHandler } from '../middleware/errorHandler';
import { User } from '../models/User';
import { Payment } from '../models/Payment';
import { Session } from '../models/Session';
import { youpiPaymentService } from '../services/youpiPaymentService';

let mongod: MongoMemoryServer;
let app: express.Application;

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_123';
const WEBHOOK_SECRET = 'test_youpi_webhook_secret_xyz';

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.YOUPI_WEBHOOK_SECRET = WEBHOOK_SECRET;

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(cors());
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use('/api', apiRoutes);
  app.use(errorHandler);
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('YouPI-PG Payment Gateway Integration Test Suite', () => {
  let studentToken: string;
  let studentId: string;
  let adminToken: string;
  let adminId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Payment.deleteMany({});
    await Session.deleteMany({});

    // Create Student
    const student = await User.create({
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      password: 'password123',
      role: 'STUDENT',
      studentIdNumber: 'STU-001',
      phone: '9876543210',
      status: 'ACTIVE',
      membershipStatus: 'INACTIVE',
    });
    studentId = String(student._id);

    // Create Admin
    const admin = await User.create({
      name: 'Admin Sonu',
      email: 'admin@example.com',
      password: 'password123',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    adminId = String(admin._id);

    // Login to obtain valid session tokens
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rohan@example.com', password: 'password123' });
    studentToken = studentLogin.body.data.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' });
    adminToken = adminLogin.body.data.token;
  });

  describe('1. Plans & Public Endpoints', () => {
    it('should return exactly one monthly membership plan for strictly ₹500', async () => {
      const res = await request(app).get('/api/payments/plans');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('monthly-membership');
      expect(res.body.data[0].price).toBe(500);
    });

    it('should serve the PhonePe QR image', async () => {
      const res = await request(app).get('/api/payments/qr-image');
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.headers['content-type']).toMatch(/image/);
      }
    });

    it('should serve authentic YouPI-PG dynamic vector SVG QR code', async () => {
      const res = await request(app).get('/api/payments/qr.svg');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
      const svgText = res.text || res.body.toString('utf8');
      expect(svgText).toContain('<svg');
      expect(svgText).toContain('shape-rendering="crispEdges"');
      expect(svgText).toContain('</svg>');
    });

    it('should serve dynamic order-linked SVG QR code for specific order', async () => {
      const res = await request(app).get('/api/payments/qr.svg/LIB-ORD-TEST123');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
      const svgText = res.text || res.body.toString('utf8');
      expect(svgText).toContain('<svg');
      expect(svgText).toContain('shape-rendering="crispEdges"');
    });

    it('should return raw UPI payload and YouPI-PG SVG from /qr-payload endpoint', async () => {
      const res = await request(app).get('/api/payments/qr-payload');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(500);
      expect(res.body.data.upiString).toContain('pa=');
      expect(res.body.data.qrSvg).toContain('<svg');
    });
  });

  describe('2. Option A: Online Payment Flow (Strictly ₹500)', () => {
    it('should create an online payment order for exactly ₹500', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('orderId');
      expect(res.body.data.amount).toBe(500);
      expect(res.body.data.planName).toBe('Monthly Library Membership');
      expect(res.body.data.status).toBe('CREATED');

      const saved = await Payment.findOne({ orderId: res.body.data.orderId });
      expect(saved).not.toBeNull();
      expect(saved?.userId.toString()).toBe(studentId);
      expect(saved?.amount).toBe(500);
      expect(saved?.paymentType).toBe('ONLINE');
    });

    it('should allow student to submit 12-digit UTR reference after online payment', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      const orderId = orderRes.body.data.orderId;

      const utrRes = await request(app)
        .post('/api/payments/submit-utr')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ orderId, utr: '123456789012', notes: 'Paid via PhonePe' });

      expect(utrRes.status).toBe(200);
      expect(utrRes.body.success).toBe(true);
      expect(utrRes.body.data.status).toBe('PENDING');
      expect(utrRes.body.data.utr).toBe('123456789012');

      const updated = await Payment.findOne({ orderId });
      expect(updated?.status).toBe('PENDING');
      expect(updated?.utr).toBe('123456789012');
    });
  });

  describe('3. Option B: Offline Payment Flow & Admin Approval Process', () => {
    it('CRITICAL: Submitting an offline payment request must NOT renew membership', async () => {
      const res = await request(app)
        .post('/api/payments/offline-request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          paymentMethod: 'CASH',
          utr: 'CASH-REC-101',
          paymentDate: '2026-10-30',
          remarks: 'Handed ₹500 cash to librarian at front desk',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING_APPROVAL');
      expect(res.body.data.amount).toBe(500);

      // Verify payment saved with PENDING_APPROVAL
      const offlinePayment = await Payment.findOne({ orderId: res.body.data.orderId });
      expect(offlinePayment?.status).toBe('PENDING_APPROVAL');
      expect(offlinePayment?.paymentType).toBe('OFFLINE');
      expect(offlinePayment?.offlineMethod).toBe('CASH');

      // CRITICAL CHECK: User membership MUST REMAIN INACTIVE / UNCHANGED
      const student = await User.findById(studentId);
      expect(student?.membershipStatus).toBe('INACTIVE');
      expect(student?.membershipExpiresAt).toBeUndefined();
    });

    it('Unauthorized students cannot approve offline requests', async () => {
      // Create offline request
      const reqRes = await request(app)
        .post('/api/payments/offline-request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ paymentMethod: 'UPI_DIRECT', utr: 'DIRECT-UPI-999' });

      const orderId = reqRes.body.data.orderId;

      // Student tries to approve -> 403 Forbidden
      const approveRes = await request(app)
        .post(`/api/payments/admin/offline-action/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ action: 'APPROVE', remarks: 'Trying to self-approve' });

      expect(approveRes.status).toBe(403);
    });

    it('Admin approval renews student membership by 1 calendar month and sets 5-day grace period', async () => {
      const reqRes = await request(app)
        .post('/api/payments/offline-request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          paymentMethod: 'CASH',
          remarks: 'Paid at desk',
        });

      const orderId = reqRes.body.data.orderId;

      // Admin approves
      const actionRes = await request(app)
        .post(`/api/payments/admin/offline-action/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE', remarks: 'Cash received and confirmed' });

      expect(actionRes.status).toBe(200);
      expect(actionRes.body.data.status).toBe('APPROVED');
      expect(actionRes.body.data.membershipStatus).toBe('ACTIVE');

      // Verify student in DB
      const student = await User.findById(studentId);
      expect(student?.membershipStatus).toBe('ACTIVE');
      expect(student?.membershipExpiresAt).toBeDefined();
      expect(student?.gracePeriodExpiresAt).toBeDefined();

      // Grace period should be exactly 5 days after expiry
      const diffMs =
        new Date(student!.gracePeriodExpiresAt!).getTime() -
        new Date(student!.membershipExpiresAt!).getTime();
      expect(diffMs).toBe(5 * 24 * 60 * 60 * 1000);
    });

    it('Admin rejection marks request as REJECTED and leaves membership unchanged', async () => {
      const reqRes = await request(app)
        .post('/api/payments/offline-request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ paymentMethod: 'BANK_TRANSFER', utr: 'INVALID-UTR-000' });

      const orderId = reqRes.body.data.orderId;

      // Admin rejects
      const actionRes = await request(app)
        .post(`/api/payments/admin/offline-action/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'REJECT',
          rejectionReason: 'Bank transfer not found in library account',
        });

      expect(actionRes.status).toBe(200);
      expect(actionRes.body.data.status).toBe('REJECTED');

      const payment = await Payment.findOne({ orderId });
      expect(payment?.status).toBe('REJECTED');
      expect(payment?.adminRejectionReason).toBe('Bank transfer not found in library account');

      const student = await User.findById(studentId);
      expect(student?.membershipStatus).toBe('INACTIVE');
    });
  });

  describe('4. Webhook HMAC-SHA256 Signature Verification & Idempotency', () => {
    it('should reject webhooks with missing or invalid signature', async () => {
      const res = await request(app)
        .post('/api/payments/webhook')
        .set('X-Gateway-Signature', 'sha256=invalidhash')
        .send({ event: 'SUCCESS', orderId: 'NONEXISTENT' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should process a valid HMAC-SHA256 signed SUCCESS webhook and activate membership for ₹500', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      const orderId = orderRes.body.data.orderId;

      const webhookPayload = JSON.stringify({
        event: 'SUCCESS',
        orderId,
        amount: '500.00',
        amountPaise: 50000,
        currency: 'INR',
        method: 'UPI',
        utr: '987654321098',
        timestamp: Date.now(),
        deliveryId: 'deliv-uuid-101',
      });

      const signature =
        'sha256=' +
        crypto.createHmac('sha256', WEBHOOK_SECRET).update(webhookPayload, 'utf8').digest('hex');

      const webhookRes = await request(app)
        .post('/api/payments/webhook')
        .set('X-Gateway-Signature', signature)
        .set('X-Gateway-Delivery-Id', 'deliv-uuid-101')
        .set('X-Gateway-Timestamp', String(Date.now()))
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.success).toBe(true);

      const payment = await Payment.findOne({ orderId });
      expect(payment?.status).toBe('SUCCESS');
      expect(payment?.utr).toBe('987654321098');

      const student = await User.findById(studentId);
      expect(student?.membershipStatus).toBe('ACTIVE');
      expect(student?.membershipPlan).toBe('Monthly Library Membership');
      expect(student?.membershipExpiresAt).toBeDefined();
    });

    it('should reject webhook if amount does not match ₹500 order', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      const orderId = orderRes.body.data.orderId;

      // Tampered amount: 100.00 instead of 500.00
      const tamperedPayload = JSON.stringify({
        event: 'SUCCESS',
        orderId,
        amount: '100.00',
        amountPaise: 10000,
        currency: 'INR',
        method: 'UPI',
        utr: '555555555555',
      });

      const signature =
        'sha256=' +
        crypto.createHmac('sha256', WEBHOOK_SECRET).update(tamperedPayload, 'utf8').digest('hex');

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('X-Gateway-Signature', signature)
        .set('Content-Type', 'application/json')
        .send(tamperedPayload);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/mismatch/i);
    });
  });

  describe('5. Automated Expiry Checks & Grace Period Management', () => {
    it('should trigger automated expiry scan endpoint safely', async () => {
      const res = await request(app).post('/api/payments/cron/check-expiries');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('remindersSent');
      expect(res.body.data).toHaveProperty('gracePeriodsStarted');
      expect(res.body.data).toHaveProperty('membershipsExpired');
    });
  });

  describe('6. Custom Payment Amount (Flexible Student Payment & Admin Testing)', () => {
    it('should create an online payment order for a custom amount (e.g. ₹200)', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 200, isCustomAmount: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(200);
      expect(res.body.data.isCustomAmount).toBe(true);
      expect(res.body.data.planName).toBe('Custom Payment (₹200)');
      expect(res.body.data.upiString).toContain('am=200.00');
      expect(res.body.data.qrSvg).toContain('<svg');

      const saved = await Payment.findOne({ orderId: res.body.data.orderId });
      expect(saved?.amount).toBe(200);
      expect(saved?.amountPaise).toBe(20000);
      expect(saved?.isCustomAmount).toBe(true);
    });

    it('should allow admin to create a ₹1 or ₹2 gateway test order', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 1, isCustomAmount: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(1);
      expect(res.body.data.upiString).toContain('am=1.00');

      const saved = await Payment.findOne({ orderId: res.body.data.orderId });
      expect(saved?.amount).toBe(1);
      expect(saved?.amountPaise).toBe(100);
    });

    it('should reject invalid, 0, or negative payment amounts', async () => {
      const resZero = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 0 });

      expect(resZero.status).toBe(400);
      expect(resZero.body.message).toMatch(/at least ₹1/i);

      const resNegative = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: -100 });

      expect(resNegative.status).toBe(400);
      expect(resNegative.body.message).toMatch(/at least ₹1/i);
    });

    it('should verify custom payment as SUCCESS without auto-renewing 1-month membership', async () => {
      // 1. Create ₹200 custom order
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 200, isCustomAmount: true });

      const orderId = orderRes.body.data.orderId;

      // 2. Admin verifies the custom payment
      const verifyRes = await request(app)
        .post(`/api/payments/admin/verify/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE', notes: 'Verified ₹200 custom contribution' });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.status).toBe('SUCCESS');

      // 3. Verify user membership status remains INACTIVE (membership only renews on ₹500 standard pass)
      const user = await User.findById(studentId);
      expect(user?.membershipStatus).toBe('INACTIVE');

      const payment = await Payment.findOne({ orderId });
      expect(payment?.status).toBe('SUCCESS');
      expect(payment?.amount).toBe(200);
    });

    it('should renew membership when standard ₹500 payment is verified', async () => {
      // 1. Create standard ₹500 order
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 500 });

      const orderId = orderRes.body.data.orderId;

      // 2. Admin verifies
      const verifyRes = await request(app)
        .post(`/api/payments/admin/verify/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.status).toBe('SUCCESS');

      // 3. User membership becomes ACTIVE
      const user = await User.findById(studentId);
      expect(user?.membershipStatus).toBe('ACTIVE');
      expect(user?.membershipExpiresAt).toBeDefined();
    });

    it('should accumulate partial payments: ₹200 + ₹300 = ₹500 and activate membership', async () => {
      // 1. First partial payment: ₹200
      const order1Res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 200, isCustomAmount: true });
      const order1Id = order1Res.body.data.orderId;

      await request(app)
        .post(`/api/payments/admin/verify/${order1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      let user = await User.findById(studentId);
      expect(user?.currentCyclePaidAmount).toBe(200);
      expect(user?.membershipStatus).toBe('INACTIVE');

      // 2. Second partial payment: ₹300 (total = 500)
      const order2Res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 300, isCustomAmount: true });
      const order2Id = order2Res.body.data.orderId;

      await request(app)
        .post(`/api/payments/admin/verify/${order2Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      user = await User.findById(studentId);
      expect(user?.membershipStatus).toBe('ACTIVE');
      expect(user?.membershipExpiresAt).toBeDefined();

      const payment2 = await Payment.findOne({ orderId: order2Id });
      expect(payment2?.membershipRenewed).toBe(true);
      expect(payment2?.receiptNumber).toBeDefined();
    });

    it('should not count test transactions towards membership renewal or production revenue', async () => {
      const testOrderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 2, isTestTransaction: true, planId: 'gateway-test' });

      expect(testOrderRes.status).toBe(200);
      const testOrderId = testOrderRes.body.data.orderId;
      expect(testOrderId).toMatch(/^LIB-TEST-/);

      // Verify test order
      const verifyRes = await request(app)
        .post(`/api/payments/admin/verify/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      expect(verifyRes.status).toBe(200);

      // Verify admin ledger stats
      const adminAllRes = await request(app)
        .get('/api/payments/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminAllRes.status).toBe(200);
      expect(adminAllRes.body.data.stats.totalCollected).toBe(0); // Production revenue is 0
      expect(adminAllRes.body.data.stats.testTransactions).toBe(1);
      expect(adminAllRes.body.data.stats.testRevenue).toBe(2);
    });

    it('should return official receipt for completed verified payment', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 500 });
      const orderId = orderRes.body.data.orderId;

      await request(app)
        .post(`/api/payments/admin/verify/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      const receiptRes = await request(app)
        .get(`/api/payments/receipt/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(receiptRes.status).toBe(200);
      expect(receiptRes.body.success).toBe(true);
      expect(receiptRes.body.data.orderId).toBe(orderId);
      expect(receiptRes.body.data.receiptNumber).toBeDefined();
      expect(receiptRes.body.data.studentName).toBe('Rohan Sharma');
      expect(receiptRes.body.data.amount).toBe(500);
      expect(receiptRes.body.data.status).toBe('SUCCESS');
    });

    it('should allow student to submit offline request with custom amount', async () => {
      const res = await request(app)
        .post('/api/payments/offline-request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ paymentMethod: 'CASH', amount: 350, remarks: 'Partial monthly fee' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(350);

      const saved = await Payment.findOne({ orderId: res.body.data.orderId });
      expect(saved?.amount).toBe(350);
      expect(saved?.amountPaise).toBe(35000);
      expect(saved?.isCustomAmount).toBe(true);
    });

    it('should set expiresAt (5 minutes) on order creation and return it in status', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 500 });

      expect(orderRes.status).toBe(200);
      expect(orderRes.body.data.expiresAt).toBeDefined();

      const statusRes = await request(app)
        .get(`/api/payments/status/${orderRes.body.data.orderId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.expiresAt).toBeDefined();
      expect(statusRes.body.data.isSessionExpired).toBe(false);
    });

    it('should allow student to request a refund on completed payment and prevent duplicate requests', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 500 });
      const orderId = orderRes.body.data.orderId;

      await request(app)
        .post(`/api/payments/admin/verify/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      // Request refund
      const refundRes = await request(app)
        .post(`/api/payments/refund-request/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reason: 'Paid twice by mistake' });

      expect(refundRes.status).toBe(200);
      expect(refundRes.body.success).toBe(true);
      expect(refundRes.body.data.refundStatus).toBe('REFUND_REQUESTED');

      // Attempt duplicate refund request
      const dupRes = await request(app)
        .post(`/api/payments/refund-request/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reason: 'Another reason' });

      expect(dupRes.status).toBe(409);
    });

    it('should allow admin to approve refund and reverse membership accounting', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 500 });
      const orderId = orderRes.body.data.orderId;

      await request(app)
        .post(`/api/payments/admin/verify/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      // Verify membership active
      let user = await User.findById(studentId);
      expect(user?.membershipStatus).toBe('ACTIVE');

      // Admin approves refund
      const adminRefundRes = await request(app)
        .post(`/api/payments/admin/refund-action/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE', refundReference: 'REFUND_TX_12345' });

      expect(adminRefundRes.status).toBe(200);
      expect(adminRefundRes.body.success).toBe(true);
      expect(adminRefundRes.body.data.refundStatus).toBe('REFUNDED');

      // Verify membership reversed
      user = await User.findById(studentId);
      expect(user?.membershipStatus).toBe('INACTIVE');
    });

    it('should allow admin to reject a refund request', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ amount: 500 });
      const orderId = orderRes.body.data.orderId;

      await request(app)
        .post(`/api/payments/admin/verify/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      await request(app)
        .post(`/api/payments/refund-request/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reason: 'Need money back' });

      const rejectRes = await request(app)
        .post(`/api/payments/admin/refund-action/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'REJECT', rejectionReason: 'Non-refundable after access started' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.refundStatus).toBe('REFUND_REJECTED');
    });
  });
});
