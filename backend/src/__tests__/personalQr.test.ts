import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import apiRoutes from '../routes';
import { errorHandler } from '../middleware/errorHandler';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';
import { StudentPersonalQr } from '../models/StudentPersonalQr';

let mongod: MongoMemoryServer;
let app: express.Application;

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-lakshya-2026';

const generateToken = (id: string, role: string, email: string) => {
  return jwt.sign({ id, role, email }, JWT_SECRET, { expiresIn: '1d' });
};

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

describe('Permanent Personal Student QR Attendance Suite', () => {
  let adminToken: string;
  let studentAId: string;
  let studentAToken: string;
  let studentBId: string;
  let studentBToken: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Attendance.deleteMany({});
    await Seat.deleteMany({});
    await StudentPersonalQr.deleteMany({});

    // Create 50 seats
    const seatsToInsert = [];
    for (let i = 1; i <= 50; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      seatsToInsert.push({ seatNumber: numStr, status: 'AVAILABLE' });
    }
    await Seat.insertMany(seatsToInsert);

    // Create Admin
    const admin = await User.create({
      name: 'Library Admin',
      email: 'admin@lakshya.com',
      password: 'password123',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    // Create Student A (assigned seat 01)
    const studentA = await User.create({
      name: 'Aarav Patel',
      email: 'aarav@lakshya.com',
      password: 'password123',
      role: 'STUDENT',
      studentIdNumber: 'LSL-01',
      assignedSeatNumber: '01',
      status: 'ACTIVE',
    });
    studentAId = studentA._id.toString();

    // Create Student B (assigned seat 02)
    const studentB = await User.create({
      name: 'Bhavna Sharma',
      email: 'bhavna@lakshya.com',
      password: 'password123',
      role: 'STUDENT',
      studentIdNumber: 'LSL-02',
      assignedSeatNumber: '02',
      status: 'ACTIVE',
    });
    studentBId = studentB._id.toString();

    // Login to get valid sessions
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lakshya.com', password: 'password123' });
    adminToken = adminLogin.body?.data?.token;

    const studentALogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aarav@lakshya.com', password: 'password123' });
    studentAToken = studentALogin.body?.data?.token;

    const studentBLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bhavna@lakshya.com', password: 'password123' });
    studentBToken = studentBLogin.body?.data?.token;
  }, 30000);

  test('1. Admin generates personal QR for individual student', async () => {
    const res = await request(app)
      .post(`/api/personal-qr/generate/${studentAId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.qr).toBeDefined();
    expect(res.body.data.qr.qrToken).toHaveLength(64);
    expect(res.body.data.qr.status).toBe('ACTIVE');

    // Generating again should return the existing active QR
    const repeatRes = await request(app)
      .post(`/api/personal-qr/generate/${studentAId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.data.isExisting).toBe(true);
    expect(repeatRes.body.data.qr.qrToken).toBe(res.body.data.qr.qrToken);
  });

  test('2. Admin generates bulk QRs for all students without QR', async () => {
    const res = await request(app)
      .post('/api/personal-qr/generate-bulk')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.generatedCount).toBe(2);
    expect(res.body.data.totalActive).toBe(2);

    // Running again when all have QRs
    const repeatRes = await request(app)
      .post('/api/personal-qr/generate-bulk')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.data.generatedCount).toBe(0);
  });

  test('3. Student A scans own Personal QR -> Marks ENTRY & Occupies Seat', async () => {
    // Generate QR for Student A
    const genRes = await request(app)
      .post(`/api/personal-qr/generate/${studentAId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const tokenA = genRes.body.data.qr.qrToken;

    // Student A scans token A
    const scanRes = await request(app)
      .post('/api/personal-qr/scan')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ token: tokenA });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body.success).toBe(true);
    expect(scanRes.body.data.type).toBe('ENTRY');
    expect(scanRes.body.data.studentName).toBe('Aarav Patel');
    expect(scanRes.body.data.seatNumber).toBe('01');

    // Verify Seat 01 is now OCCUPIED
    const seat01 = await Seat.findOne({ seatNumber: '01' });
    expect(seat01?.status).toBe('OCCUPIED');
    expect(seat01?.currentStudentId?.toString()).toBe(studentAId);

    // Verify User state
    const userA = await User.findById(studentAId);
    expect(userA?.isCurrentlyInside).toBe(true);
    expect(userA?.currentSeatNumber).toBe('01');
  });

  test('4. Student A scans own QR again -> Marks EXIT & Releases Seat', async () => {
    // Setup Entry
    const genRes = await request(app)
      .post(`/api/personal-qr/generate/${studentAId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const tokenA = genRes.body.data.qr.qrToken;

    await request(app)
      .post('/api/personal-qr/scan')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ token: tokenA });

    // Simulate time elapsed (set entryTime back by 45 minutes)
    const activeAtt = await Attendance.findOne({ studentId: studentAId, status: 'ACTIVE' });
    if (activeAtt) {
      activeAtt.entryTime = new Date(Date.now() - 45 * 60 * 1000);
      await activeAtt.save();
    }

    // Student A scans same QR for Exit
    const exitRes = await request(app)
      .post('/api/personal-qr/scan')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ token: tokenA });

    expect(exitRes.status).toBe(200);
    expect(exitRes.body.success).toBe(true);
    expect(exitRes.body.data.type).toBe('EXIT');
    expect(exitRes.body.data.durationMinutes).toBeGreaterThanOrEqual(44);
    expect(exitRes.body.data.durationString).toMatch(/\d+m/);

    // Verify Seat 01 is released to AVAILABLE
    const seat01 = await Seat.findOne({ seatNumber: '01' });
    expect(seat01?.status).toBe('AVAILABLE');
    expect(seat01?.currentStudentId).toBeNull();

    // Verify User state
    const userA = await User.findById(studentAId);
    expect(userA?.isCurrentlyInside).toBe(false);
    expect(userA?.currentSeatNumber).toBeUndefined();
  });

  test('5. CRITICAL SECURITY: Student A scans Student B\'s QR -> REJECTED (403)', async () => {
    // Generate QR for Student B
    const genRes = await request(app)
      .post(`/api/personal-qr/generate/${studentBId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const tokenB = genRes.body.data.qr.qrToken;

    // Student A attempts to scan Student B's QR
    const scanRes = await request(app)
      .post('/api/personal-qr/scan')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ token: tokenB });

    expect(scanRes.status).toBe(403);
    expect(scanRes.body.success).toBe(false);
    expect(scanRes.body.code).toBe('QR_OWNERSHIP_MISMATCH');
    expect(scanRes.body.message).toBe('This QR code does not belong to your account. Please scan your own library table QR.');

    // Confirm neither student had attendance marked
    const attCount = await Attendance.countDocuments();
    expect(attCount).toBe(0);
  });

  test('6. Admin revokes QR -> Old QR immediately fails, new QR succeeds', async () => {
    // Generate initial QR for Student A
    const genRes = await request(app)
      .post(`/api/personal-qr/generate/${studentAId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const oldToken = genRes.body.data.qr.qrToken;

    // Admin regenerates QR for Student A (revokes old)
    const regenRes = await request(app)
      .post(`/api/personal-qr/regenerate/${studentAId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(regenRes.status).toBe(201);
    const newToken = regenRes.body.data.qr.qrToken;
    expect(newToken).not.toBe(oldToken);
    expect(regenRes.body.data.generationCount).toBe(2);

    // Old QR scan should fail with QR_REVOKED
    const oldScanRes = await request(app)
      .post('/api/personal-qr/scan')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ token: oldToken });

    expect(oldScanRes.status).toBe(400);
    expect(oldScanRes.body.code).toBe('QR_REVOKED');

    // New QR scan succeeds
    const newScanRes = await request(app)
      .post('/api/personal-qr/scan')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ token: newToken });

    expect(newScanRes.status).toBe(201);
    expect(newScanRes.body.data.type).toBe('ENTRY');
  });

  test('7. Admin lists students with QR status and search', async () => {
    await request(app)
      .post(`/api/personal-qr/generate/${studentAId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/personal-qr/students')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.students).toHaveLength(2);
    expect(res.body.data.summary.totalStudents).toBe(2);
    expect(res.body.data.summary.activeQrsCount).toBe(1);
    expect(res.body.data.summary.missingQrsCount).toBe(1);

    // Search filter
    const searchRes = await request(app)
      .get('/api/personal-qr/students?search=Aarav')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.students).toHaveLength(1);
    expect(searchRes.body.data.students[0].name).toBe('Aarav Patel');
  });
});
