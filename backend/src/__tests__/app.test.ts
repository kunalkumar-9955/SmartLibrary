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
import { Session } from '../models/Session';
import { AdminNotification } from '../models/AdminNotification';
import { QrSession } from '../models/QrSession';

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
}, 120000);

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
    await Session.deleteMany({});
    await AdminNotification.deleteMany({});
    await QrSession.deleteMany({});

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
  }, 30000);

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

    // Expired QR — use -20s to ensure it falls outside the 10s grace window in validateDynamicQR
    const expiredQR = generateDynamicQR('ENTRY', -20);
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
    // Message from attendanceController: 'You are already checked in.'
    expect(dupRes.body.message).toContain('already checked in');
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
    // Message from attendanceController: 'No active library session found.'
    expect(exitAgain.body.message).toContain('No active library session found');

  });

  it('should export genuine Excel workbook (.xlsx)', async () => {
    const exportRes = await request(app)
      .get('/api/attendance/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('spreadsheetml');
    expect(exportRes.headers['content-disposition']).toContain('.xlsx');
  });

  it('should allow student to login from multiple devices simultaneously (no single-device limit)', async () => {
    // studentToken was already obtained in beforeEach (Device 1)
    // Device 2: second login must succeed
    const device2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'Password@123' });

    expect(device2Login.status).toBe(200);
    expect(device2Login.body.success).toBe(true);
    const device2Token = device2Login.body.data.token;

    // Device 3: third login must also succeed
    const device3Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'Password@123' });

    expect(device3Login.status).toBe(200);
    expect(device3Login.body.success).toBe(true);

    // All tokens should be independently valid
    const me1 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(me1.status).toBe(200);

    const me2 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${device2Token}`);
    expect(me2.status).toBe(200);

    // Logout Device 1 — Device 2 and Device 3 must remain valid
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${studentToken}`);

    // Device 2 still works after Device 1 logout
    const me2After = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${device2Token}`);
    expect(me2After.status).toBe(200);

    // Login again on Device 1 after logout — must succeed
    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'Password@123' });
    expect(relogin.status).toBe(200);
  });

  it('should allow admin up to 4 sessions and reject the 5th attempt', async () => {
    // Session 1 is adminToken in beforeEach
    // Login session 2
    const s2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s2.status).toBe(200);

    // Login session 3
    const s3 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s3.status).toBe(200);

    // Login session 4
    const s4 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s4.status).toBe(200);

    // 5th attempt should be rejected with 429
    const s5 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s5.status).toBe(429);
    expect(s5.body.message).toContain('Maximum 4 active admin sessions reached');
  });

  it('should create AdminNotification when student registers a complaint', async () => {
    const ticketRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        category: 'Wi-Fi',
        title: 'Slow internet at seat 05',
        description: 'Connection drops frequently while downloading study notes',
        seatNumber: '05',
      });

    expect(ticketRes.status).toBe(201);
    expect(ticketRes.body.success).toBe(true);

    // Verify AdminNotification exists in DB
    const adminNotifRes = await request(app)
      .get('/api/admin-notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminNotifRes.status).toBe(200);
    expect(adminNotifRes.body.data.notifications.length).toBe(1);
    expect(adminNotifRes.body.data.unreadCount).toBe(1);
    expect(adminNotifRes.body.data.notifications[0].type).toBe('NEW_COMPLAINT');
    expect(adminNotifRes.body.data.notifications[0].studentName).toBe('Test Student');

    // Mark as read
    const notifId = adminNotifRes.body.data.notifications[0]._id;
    const markRes = await request(app)
      .post(`/api/admin-notifications/read/${notifId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(markRes.status).toBe(200);
    expect(markRes.body.data.unreadCount).toBe(0);
  });

  // ======================================================
  // QR ROTATION SYSTEM TESTS
  // ======================================================

  it('should create a new ACTIVE QR session via /api/qr/generate and return version 1', async () => {
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    expect(genRes.status).toBe(200);
    expect(genRes.body.success).toBe(true);
    expect(genRes.body.data.qrType).toBe('ENTRY');
    expect(genRes.body.data.token).toBeDefined();
    expect(genRes.body.data.version).toBeGreaterThanOrEqual(1);
    expect(genRes.body.data.ttl).toBeGreaterThan(0);

    // Verify session was stored in DB
    const dbSession = await QrSession.findOne({ token: genRes.body.data.token });
    expect(dbSession).toBeTruthy();
    expect(dbSession?.status).toBe('ACTIVE');
  });

  it('should rotate QR session after a successful entry scan (new version > old version)', async () => {
    // 1. Admin generates initial ENTRY QR
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    expect(genRes.status).toBe(200);
    const firstToken = genRes.body.data.token;
    const firstVersion = genRes.body.data.version;

    // 2. Student scans → marks entry
    const entryRes = await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: genRes.body.data });

    expect(entryRes.status).toBe(201);

    // Allow background rotation to complete
    await new Promise((r) => setTimeout(r, 300));

    // 3. Poll active QR — should now be a NEW session
    const activeRes = await request(app)
      .get('/api/qr/active?qrType=ENTRY')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(activeRes.status).toBe(200);
    const newToken = activeRes.body.data.token;
    const newVersion = activeRes.body.data.version;

    expect(newToken).not.toBe(firstToken);
    expect(newVersion).toBeGreaterThan(firstVersion);

    // Old session should be in ROTATED status
    const oldSession = await QrSession.findOne({ token: firstToken });
    expect(oldSession?.status).toBe('ROTATED');
    expect(oldSession?.graceExpiresAt).toBeDefined();
  });

  it('should accept a ROTATED QR within the 10-second grace window', async () => {
    // 1. Generate ENTRY QR
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    const firstQRPayload = genRes.body.data;

    // 2. Manually rotate the session so it becomes ROTATED with future graceExpiresAt
    const session = await QrSession.findOne({ token: firstQRPayload.token });
    expect(session).toBeTruthy();
    session!.status = 'ROTATED';
    session!.rotatedAt = new Date();
    session!.graceExpiresAt = new Date(Date.now() + 8000); // 8 seconds grace remaining
    await session!.save();

    // 3. Validate via /api/qr/validate — should pass due to grace window
    const validateRes = await request(app)
      .post('/api/qr/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrPayload: firstQRPayload, expectedType: 'ENTRY' });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.data.valid).toBe(true);
  });

  it('should reject a ROTATED QR after grace window has expired', async () => {
    // 1. Generate ENTRY QR
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    const firstQRPayload = genRes.body.data;

    // 2. Manually expire the session: ROTATED + past grace window
    const session = await QrSession.findOne({ token: firstQRPayload.token });
    expect(session).toBeTruthy();
    session!.status = 'ROTATED';
    session!.rotatedAt = new Date(Date.now() - 30000);
    session!.graceExpiresAt = new Date(Date.now() - 20000); // grace already expired
    await session!.save();

    // 3. Validate via /api/qr/validate — should fail
    const validateRes = await request(app)
      .post('/api/qr/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrPayload: firstQRPayload, expectedType: 'ENTRY' });

    expect(validateRes.status).toBe(400);
    expect(validateRes.body.message).toContain('expired');
  });

  it('should reject wrong QR type (EXIT QR used for ENTRY)', async () => {
    const exitQR = generateDynamicQR('EXIT', 60);
    const entryRes = await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: exitQR });

    expect(entryRes.status).toBe(400);
    expect(entryRes.body.message).toContain('EXIT');
  });
});

