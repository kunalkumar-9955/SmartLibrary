import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import cors from 'cors';
import apiRoutes from '../routes';
import { errorHandler } from '../middleware/errorHandler';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';
import { StudentPersonalQr } from '../models/StudentPersonalQr';
import { Payment } from '../models/Payment';
import { AuditLog } from '../models/AuditLog';
import { MaintenanceSnapshot } from '../models/MaintenanceSnapshot';
import { Session } from '../models/Session';

let mongod: MongoMemoryServer;
let app: express.Application;

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-lakshya-2026';

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', apiRoutes);
  app.use(errorHandler);
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Student Management, Seat Release, QR Revocation & Safe Fresh Start', () => {
  let adminToken: string;
  let adminId: string;
  let studentAId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Attendance.deleteMany({});
    await Seat.deleteMany({});
    await StudentPersonalQr.deleteMany({});
    await Payment.deleteMany({});
    await AuditLog.deleteMany({});
    await MaintenanceSnapshot.deleteMany({});
    await Session.deleteMany({});

    // Populate 50 seats
    const seats = [];
    for (let i = 1; i <= 50; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      seats.push({ seatNumber: numStr, status: 'AVAILABLE' });
    }
    await Seat.insertMany(seats);

    // Create Admin
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@lakshya.com',
      password: 'password123',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    adminId = admin._id.toString();

    // Login Admin via API to establish valid session
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lakshya.com', password: 'password123' });
    adminToken = adminLoginRes.body?.data?.token;

    // Create Student A with assigned seat 05
    const studentA = await User.create({
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      password: 'password123',
      role: 'STUDENT',
      studentIdNumber: 'STU-001',
      assignedSeatNumber: '05',
      phone: '9876543210',
      status: 'ACTIVE',
      membershipStatus: 'ACTIVE',
    });
    studentAId = studentA._id.toString();

    // Assign seat in physical Seat collection
    await Seat.findOneAndUpdate(
      { seatNumber: '05' },
      { status: 'OCCUPIED', currentStudentId: studentA._id, currentStudentName: studentA.name }
    );

    // Generate active personal QR for Student A
    await StudentPersonalQr.create({
      studentId: studentA._id,
      studentName: studentA.name,
      studentIdNumber: studentA.studentIdNumber,
      assignedSeatNumber: '05',
      qrToken: 'TOKEN_ROHAN_001_ACTIVE',
      status: 'ACTIVE',
      generationCount: 1,
    });

    // Create an active attendance session for Student A
    await Attendance.create({
      studentId: studentA._id,
      studentName: studentA.name,
      studentIdNumber: studentA.studentIdNumber,
      seatNumber: '05',
      entryTime: new Date(),
      status: 'ACTIVE',
      attendanceDate: new Date().toISOString().split('T')[0],
      method: 'PERSONAL_QR',
    });
  });

  describe('1. Student Deactivation and Automatic Seat Release', () => {
    it('deactivates student, releases assigned seat, revokes QR token, and closes attendance session', async () => {
      const res = await request(app)
        .post(`/api/students/${studentAId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Completed exam preparation' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('INACTIVE');
      expect(!res.body.data.assignedSeatNumber).toBe(true);

      // Check physical seat 05: must now be AVAILABLE and clear of student
      const seat05 = await Seat.findOne({ seatNumber: '05' });
      expect(seat05?.status).toBe('AVAILABLE');
      expect(seat05?.currentStudentId).toBeNull();

      // Check personal QR: must be REVOKED
      const qrRecord = await StudentPersonalQr.findOne({ qrToken: 'TOKEN_ROHAN_001_ACTIVE' });
      expect(qrRecord?.status).toBe('REVOKED');
      expect(qrRecord?.revokedAt).toBeDefined();

      // Check active attendance session: must be COMPLETED
      const attendance = await Attendance.findOne({ studentId: studentAId });
      expect(attendance?.status).toBe('COMPLETED');
      expect(attendance?.exitTime).toBeDefined();
      expect(attendance?.exitMethod).toBe('MANUAL');

      // Attempting to scan revoked personal QR token must fail with 400 / QR_REVOKED
      const studentC = await User.create({
        name: 'Karan Kumar',
        email: 'karan@example.com',
        password: 'password123',
        role: 'STUDENT',
        status: 'ACTIVE',
      });
      const cLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'karan@example.com', password: 'password123' });
      const studentCToken = cLoginRes.body.data.token;

      const scanRes = await request(app)
        .post('/api/personal-qr/scan')
        .set('Authorization', `Bearer ${studentCToken}`)
        .send({ token: 'TOKEN_ROHAN_001_ACTIVE' });

      expect(scanRes.status).toBe(400);
      expect(scanRes.body.code).toBe('QR_REVOKED');

      // Audit log must exist
      const audit = await AuditLog.findOne({ action: 'STUDENT_DEACTIVATED', targetId: studentAId });
      expect(audit).toBeDefined();
      expect(audit?.details?.reason).toBe('Completed exam preparation');
    });
  });

  describe('2. Student Reactivation', () => {
    it('reactivates inactive student and optionally assigns vacant seat', async () => {
      // Deactivate first
      await request(app)
        .post(`/api/students/${studentAId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      // Reactivate with seat 08
      const res = await request(app)
        .post(`/api/students/${studentAId}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedSeatNumber: '08' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.assignedSeatNumber).toBe('08');

      // Audit log must record STUDENT_REACTIVATED
      const audit = await AuditLog.findOne({ action: 'STUDENT_REACTIVATED', targetId: studentAId });
      expect(audit).toBeDefined();
    });
  });

  describe('3. Student Replacement Workflow', () => {
    it('deactivates departing student, vacates seat, registers incoming student on the same seat, and generates fresh QR token', async () => {
      const res = await request(app)
        .post(`/api/students/${studentAId}/replace`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          departureReason: 'Shifted to different city',
          newStudent: {
            name: 'Priya Verma',
            email: 'priya@example.com',
            phone: '9812345678',
            studentIdNumber: 'STU-002',
            course: 'UPSC Civil Services',
            password: 'PriyaPassword123!',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const { oldStudent, newStudent, qr } = res.body.data;

      // Student A (Rohan) is deactivated and seat vacated
      expect(oldStudent._id).toBe(studentAId);
      expect(oldStudent.status).toBe('INACTIVE');

      const rohanInDb = await User.findById(studentAId);
      expect(!rohanInDb?.assignedSeatNumber).toBe(true);

      // Student B (Priya) is active and assigned Seat 05
      expect(newStudent.name).toBe('Priya Verma');
      expect(newStudent.status).toBe('ACTIVE');
      expect(newStudent.assignedSeatNumber).toBe('05');

      // Student B has fresh active QR token
      expect(qr).toBeDefined();
      expect(qr.status).toBe('ACTIVE');
      expect(qr.studentIdNumber).toBe('STU-002');
      expect(qr.assignedSeatNumber).toBe('05');

      // Old QR of Rohan remains permanently revoked
      const oldQr = await StudentPersonalQr.findOne({ qrToken: 'TOKEN_ROHAN_001_ACTIVE' });
      expect(oldQr?.status).toBe('REVOKED');

      // Audit log records STUDENT_REPLACED
      const audit = await AuditLog.findOne({ action: 'STUDENT_REPLACED' });
      expect(audit).toBeDefined();
      expect(audit?.details?.departingStudentId?.toString()).toBe(studentAId);
      expect(audit?.details?.newStudentId?.toString()).toBe(newStudent._id);
    });
  });

  describe('4. Seat Management: Assign and Release', () => {
    it('prevents assigning an occupied seat to another student', async () => {
      // Create Student B
      const studentB = await User.create({
        name: 'Amit Patel',
        email: 'amit@example.com',
        password: 'password123',
        role: 'STUDENT',
        studentIdNumber: 'STU-003',
        status: 'ACTIVE',
      });

      // Try assigning Seat 05 (already assigned to Rohan)
      const res = await request(app)
        .post('/api/seats/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentId: studentB._id.toString(), seatNumber: '05' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already assigned');
    });

    it('successfully releases seat and updates student record', async () => {
      const res = await request(app)
        .post('/api/seats/release')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ seatNumber: '05' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const seat05 = await Seat.findOne({ seatNumber: '05' });
      expect(seat05?.status).toBe('AVAILABLE');

      const rohan = await User.findById(studentAId);
      expect(!rohan?.assignedSeatNumber).toBe(true);
    });
  });

  describe('5. Safe Fresh Start Maintenance & Demo Data Cleanup', () => {
    it('purges only demo transactions, revokes active demo QRs, and preserves genuine records', async () => {
      // 1. Insert a dummy test payment
      const testPayment = await Payment.create({
        userId: studentAId,
        studentName: 'Rohan Sharma',
        studentEmail: 'rohan@example.com',
        orderId: 'LIB-ORD-TEST-123456',
        amount: 1,
        amountPaise: 100,
        currency: 'INR',
        status: 'PENDING',
        paymentType: 'ONLINE',
        planId: 'test-gateway',
        planName: 'Gateway Test',
        planDurationMonths: 1,
        isTestTransaction: true,
      });

      // 2. Insert a genuine payment
      const realPayment = await Payment.create({
        userId: studentAId,
        studentName: 'Rohan Sharma',
        studentEmail: 'rohan@example.com',
        orderId: 'LIB-ORD-REAL-999888',
        amount: 800,
        amountPaise: 80000,
        currency: 'INR',
        status: 'SUCCESS',
        paymentType: 'OFFLINE',
        planId: 'monthly-regular',
        planName: 'Monthly Regular',
        planDurationMonths: 1,
        isTestTransaction: false,
      });

      // Execute Fresh Start
      const res = await request(app)
        .post('/api/maintenance/fresh-start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.snapshotId).toBeDefined();
      expect(data.summary.paymentsCleanedCount).toBe(1);
      expect(data.summary.paymentsPreservedCount).toBe(1);
      expect(data.summary.qrsRevokedCount).toBeGreaterThanOrEqual(1);
      expect(data.summary.studentsPreservedCount).toBe(1);

      // Verify DB: Test payment removed, real payment preserved
      const testCheck = await Payment.findById(testPayment._id);
      expect(testCheck).toBeNull();

      const realCheck = await Payment.findById(realPayment._id);
      expect(realCheck).toBeDefined();
      expect(realCheck?.status).toBe('SUCCESS');

      // Verify DB: Rohan's active demo QR is now REVOKED
      const rohanQr = await StudentPersonalQr.findOne({ qrToken: 'TOKEN_ROHAN_001_ACTIVE' });
      expect(rohanQr?.status).toBe('REVOKED');

      // Verify snapshot created
      const snapshot = await MaintenanceSnapshot.findById(data.snapshotId);
      expect(snapshot).toBeDefined();
      expect(snapshot?.cleanedPaymentIds).toContain(testPayment.orderId);
    });
  });
});
