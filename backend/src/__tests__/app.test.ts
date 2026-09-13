import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import cors from 'cors';
import apiRoutes from '../routes';
import { errorHandler } from '../middleware/errorHandler';
import { generateDynamicQR, validateDynamicQR } from '../utils/qrCrypto';
import { User } from '../models/User';
import { Library } from '../models/Library';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';

let mongod: MongoMemoryServer;
let app: express.Application;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', apiRoutes);
  app.use(errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Smart Personal Library Management System Suite', () => {
  let adminToken: string;
  let studentToken: string;
  let studentUserId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Library.deleteMany({});
    await Attendance.deleteMany({});
    await Seat.deleteMany({});

    // Create Library Settings
    await Library.create({
      name: 'Smart Personal Library',
      totalSeats: 50,
      qrExpirySeconds: 45,
    });

    // Create exactly 50 seats (01 - 50)
    const seats = [];
    for (let i = 1; i <= 50; i++) {
      seats.push({
        seatNumber: i < 10 ? `0${i}` : `${i}`,
        status: 'AVAILABLE',
      });
    }
    await Seat.insertMany(seats);

    // Create Single Admin
    await User.create({
      name: 'Library Admin',
      email: 'admin@test.com',
      password: 'Password@123',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    // Create Student
    const student = await User.create({
      name: 'Test Student',
      email: 'student@test.com',
      password: 'Password@123',
      role: 'STUDENT',
      studentIdNumber: 'ST001',
      phone: '9876543210',
      course: 'B.Tech',
      status: 'ACTIVE',
      isCurrentlyInside: false,
    });
    studentUserId = student._id.toString();

    // Get Tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    adminToken = adminLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'Password@123' });
    studentToken = studentLogin.body.data.token;
  });

  it('should authenticate Admin and Student with valid roles', async () => {
    expect(adminToken).toBeDefined();
    expect(studentToken).toBeDefined();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role).toBe('STUDENT');
    expect(meRes.body.data.studentIdNumber).toBe('ST001');
  });

  it('should generate dynamic QR tokens with HMAC signature and validate expiry', () => {
    const entryQR = generateDynamicQR('ENTRY', 45);
    expect(entryQR.qrType).toBe('ENTRY');
    expect(entryQR.token).toBeDefined();
    expect(entryQR.signature).toBeDefined();

    const validResult = validateDynamicQR(entryQR, 'ENTRY');
    expect(validResult.isValid).toBe(true);

    // Expired QR
    const expiredQR = generateDynamicQR('ENTRY', -5);
    const expiredResult = validateDynamicQR(expiredQR, 'ENTRY');
    expect(expiredResult.isValid).toBe(false);
    expect(expiredResult.error).toContain('expired');
  });

  it('should successfully mark entry attendance, occupy a seat, and reject duplicate entry', async () => {
    const entryQR = generateDynamicQR('ENTRY', 45);

    const entryRes = await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: entryQR, preferredSeatNumber: '05' });

    expect(entryRes.status).toBe(201);
    expect(entryRes.body.success).toBe(true);
    expect(entryRes.body.data.seatNumber).toBe('05');

    // Seat 05 should now be OCCUPIED
    const seat05 = await Seat.findOne({ seatNumber: '05' });
    expect(seat05?.status).toBe('OCCUPIED');

    // Rule 1: Attempt duplicate entry while inside
    const entryQR2 = generateDynamicQR('ENTRY', 45);
    const dupRes = await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: entryQR2 });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.message).toContain('already marked inside');
  });

  it('should successfully mark exit attendance, calculate duration, and release seat to AVAILABLE', async () => {
    // 1. Entry
    const entryQR = generateDynamicQR('ENTRY', 45);
    await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: entryQR, preferredSeatNumber: '10' });

    // 2. Exit
    const exitQR = generateDynamicQR('EXIT', 45);
    const exitRes = await request(app)
      .post('/api/attendance/exit')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: exitQR });

    expect(exitRes.status).toBe(200);
    expect(exitRes.body.success).toBe(true);
    expect(exitRes.body.data.durationMinutes).toBeGreaterThanOrEqual(1);

    // Seat 10 should be AVAILABLE again
    const seat10 = await Seat.findOne({ seatNumber: '10' });
    expect(seat10?.status).toBe('AVAILABLE');

    // Rule 2: Cannot mark exit without active entry (generate new fresh QR so replay doesn't trigger first)
    const freshExitQR = generateDynamicQR('EXIT', 45);
    const exitAgain = await request(app)
      .post('/api/attendance/exit')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: freshExitQR });

    expect(exitAgain.status).toBe(404);
    expect(exitAgain.body.message).toContain('No active attendance found');

  });

  it('should export genuine Excel workbook (.xlsx)', async () => {
    const exportRes = await request(app)
      .get('/api/attendance/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('spreadsheetml');
    expect(exportRes.headers['content-disposition']).toContain('.xlsx');
  });
});
