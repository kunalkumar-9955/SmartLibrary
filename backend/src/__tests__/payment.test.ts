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
    it('should return available library membership plans', async () => {
      const res = await request(app).get('/api/payments/plans');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('price');
    });

    it('should serve the PhonePe QR image', async () => {
      const res = await request(app).get('/api/payments/qr-image');
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.headers['content-type']).toMatch(/image/);
      }
    });
  });

  describe('2. Order Creation & UTR Submission Flow', () => {
    it('should create a payment order for a selected membership plan', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ planId: 'monthly-standard' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('orderId');
      expect(res.body.data.amount).toBe(600);
      expect(res.body.data.planName).toBe('Monthly Standard Study Pass');
      expect(res.body.data.status).toBe('CREATED');

      const saved = await Payment.findOne({ orderId: res.body.data.orderId });
      expect(saved).not.toBeNull();
      expect(saved?.userId.toString()).toBe(studentId);
      expect(saved?.amount).toBe(600);
    });

    it('should allow student to submit 12-digit UTR reference after payment', async () => {
      // First create order
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ planId: 'monthly-standard' });

      const orderId = orderRes.body.data.orderId;

      // Submit UTR
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

    it('should check order status and return current lifecycle state', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ planId: 'dedicated-seat' });

      const orderId = orderRes.body.data.orderId;

      const statusRes = await request(app)
        .get(`/api/payments/status/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.orderId).toBe(orderId);
      expect(statusRes.body.data.amount).toBe(1000);
    });
  });

  describe('3. Webhook HMAC-SHA256 Signature Verification & Idempotency', () => {
    it('should reject webhooks with missing or invalid signature', async () => {
      const res = await request(app)
        .post('/api/payments/webhook')
        .set('X-Gateway-Signature', 'sha256=invalidhash')
        .send({ event: 'SUCCESS', orderId: 'NONEXISTENT' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should process a valid HMAC-SHA256 signed SUCCESS webhook and activate membership', async () => {
      // Create payment order
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ planId: 'monthly-standard' });

      const orderId = orderRes.body.data.orderId;

      const webhookPayload = JSON.stringify({
        event: 'SUCCESS',
        orderId,
        amount: '600.00',
        amountPaise: 60000,
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

      // Verify payment in DB
      const payment = await Payment.findOne({ orderId });
      expect(payment?.status).toBe('SUCCESS');
      expect(payment?.utr).toBe('987654321098');
      expect(payment?.verificationSource).toBe('YOUPI_WEBHOOK');

      // Verify user membership in DB
      const student = await User.findById(studentId);
      expect(student?.membershipStatus).toBe('ACTIVE');
      expect(student?.membershipPlan).toBe('Monthly Standard Study Pass');
      expect(student?.membershipExpiresAt).toBeDefined();
      expect(new Date(student!.membershipExpiresAt!).getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle repeated webhook delivery idempotently without extending twice', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ planId: 'monthly-standard' });

      const orderId = orderRes.body.data.orderId;
      const deliveryId = 'delivery-unique-abc';

      const webhookPayload = JSON.stringify({
        event: 'SUCCESS',
        orderId,
        amount: '600.00',
        amountPaise: 60000,
        currency: 'INR',
        method: 'UPI',
        utr: '111122223333',
        timestamp: Date.now(),
        deliveryId,
      });

      const signature =
        'sha256=' +
        crypto.createHmac('sha256', WEBHOOK_SECRET).update(webhookPayload, 'utf8').digest('hex');

      // First delivery
      const res1 = await request(app)
        .post('/api/payments/webhook')
        .set('X-Gateway-Signature', signature)
        .set('X-Gateway-Delivery-Id', deliveryId)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      expect(res1.status).toBe(200);
      const studentAfterFirst = await User.findById(studentId);
      const expiry1 = studentAfterFirst?.membershipExpiresAt?.getTime();

      // Second delivery (replay)
      const res2 = await request(app)
        .post('/api/payments/webhook')
        .set('X-Gateway-Signature', signature)
        .set('X-Gateway-Delivery-Id', deliveryId)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.duplicate).toBe(true);

      const studentAfterSecond = await User.findById(studentId);
      expect(studentAfterSecond?.membershipExpiresAt?.getTime()).toBe(expiry1);
    });

    it('should reject webhook if amount does not match the order', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ planId: 'monthly-standard' });

      const orderId = orderRes.body.data.orderId;

      // Tampered amount: 1.00 instead of 600.00
      const tamperedPayload = JSON.stringify({
        event: 'SUCCESS',
        orderId,
        amount: '1.00',
        amountPaise: 100,
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

  describe('4. Admin Payments Visibility & Verification', () => {
    it('should allow admin to list all payments and block students', async () => {
      // Student creates an order
      await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ planId: 'monthly-standard' });

      // Student tries to access admin endpoint -> 403
      const studentAccess = await request(app)
        .get('/api/payments/admin/all')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(studentAccess.status).toBe(403);

      // Admin accesses -> 200
      const adminAccess = await request(app)
        .get('/api/payments/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminAccess.status).toBe(200);
      expect(adminAccess.body.success).toBe(true);
      expect(adminAccess.body.data.payments.length).toBeGreaterThanOrEqual(1);
      expect(adminAccess.body.data.stats).toBeDefined();
    });

    it('should allow admin to manually approve a pending payment', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ planId: 'monthly-standard' });

      const orderId = orderRes.body.data.orderId;

      await request(app)
        .post('/api/payments/submit-utr')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ orderId, utr: '777888999000' });

      // Admin approves
      const verifyRes = await request(app)
        .post(`/api/payments/admin/verify/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE', notes: 'Verified in bank account statement' });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.status).toBe('SUCCESS');

      const updatedUser = await User.findById(studentId);
      expect(updatedUser?.membershipStatus).toBe('ACTIVE');
    });
  });
});
