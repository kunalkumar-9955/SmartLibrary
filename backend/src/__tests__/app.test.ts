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

  it('should authenticate Admin using environment variables (even with surrounding quotes) and reject invalid passwords', async () => {
    process.env.ADMIN_EMAIL = '"envadmin@lakshyalibrary.com"';
    process.env.ADMIN_PASSWORD = '"SuperSecretEnvPass@2026"';

    // 1. Login with exact env credentials (case-insensitive email, surrounding quotes in env handled)
    const envLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'EnvAdmin@LakshyaLibrary.com ', password: 'SuperSecretEnvPass@2026' });

    expect(envLoginRes.status).toBe(200);
    expect(envLoginRes.body.success).toBe(true);
    expect(envLoginRes.body.data.user.role).toBe('ADMIN');

    // 2. Reject wrong password for Admin
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'envadmin@lakshyalibrary.com', password: 'WrongPassword@999' });

    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body.message).toContain('Invalid email or password');

    // Clean up env vars
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
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

  it('should allow admin to login from unlimited devices simultaneously (no 4-session limit)', async () => {
    // Session 1 is adminToken in beforeEach
    // Login session 2
    const s2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s2.status).toBe(200);
    expect(s2.body.success).toBe(true);

    // Login session 3
    const s3 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s3.status).toBe(200);
    expect(s3.body.success).toBe(true);

    // Login session 4
    const s4 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s4.status).toBe(200);
    expect(s4.body.success).toBe(true);

    // 5th, 6th attempts must ALSO succeed (unlimited devices)
    const s5 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s5.status).toBe(200);
    expect(s5.body.success).toBe(true);

    const s6 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password@123' });
    expect(s6.status).toBe(200);
    expect(s6.body.success).toBe(true);

    // All tokens are valid
    const me5 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${s5.body.data.token}`);
    expect(me5.status).toBe(200);
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

  // ======================================================
  // EXACT USER REQUIREMENTS VERIFICATION SUITE
  // ======================================================

  it('TEST 1 & 3: QR stays completely fixed when nobody scans; polling does NOT rotate QR', async () => {
    // 1. Generate QR-A
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    expect(genRes.status).toBe(200);
    const tokenA = genRes.body.data.token;
    const versionA = genRes.body.data.version;

    // Simulate multiple poll calls across time
    for (let i = 0; i < 5; i++) {
      const pollRes = await request(app)
        .get('/api/qr/active?qrType=ENTRY')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(pollRes.status).toBe(200);
      expect(pollRes.body.data.token).toBe(tokenA);
      expect(pollRes.body.data.version).toBe(versionA);
    }
  });

  it('TEST 2 & 4: Successful scan rotates QR-A to QR-B, and second scan rotates to QR-C', async () => {
    // 1. Initial QR-A
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    const qrA = genRes.body.data;

    // Student A scans QR-A
    const scanARes = await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: qrA });

    expect(scanARes.status).toBe(201);
    expect(scanARes.body.success).toBe(true);

    // Allow rotation to complete
    await new Promise((r) => setTimeout(r, 200));

    // Admin panel polls -> gets QR-B
    const pollB = await request(app)
      .get('/api/qr/active?qrType=ENTRY')
      .set('Authorization', `Bearer ${adminToken}`);

    const qrB = pollB.body.data;
    expect(qrB.token).not.toBe(qrA.token);
    expect(qrB.version).toBe(qrA.version + 1);

    // Create Student B
    const studentBUser = await User.create({
      name: 'Student B',
      email: 'student_b@test.com',
      password: 'Password@123',
      role: 'STUDENT',
      studentIdNumber: 'ST002',
      phone: '9876543211',
      status: 'ACTIVE',
    });

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student_b@test.com', password: 'Password@123' });
    const studentBToken = loginB.body.data.token;

    // Student B scans QR-B
    const scanBRes = await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentBToken}`)
      .send({ qrPayload: qrB });

    expect(scanBRes.status).toBe(201);

    await new Promise((r) => setTimeout(r, 200));

    // Admin panel polls -> gets QR-C
    const pollC = await request(app)
      .get('/api/qr/active?qrType=ENTRY')
      .set('Authorization', `Bearer ${adminToken}`);

    const qrC = pollC.body.data;
    expect(qrC.token).not.toBe(qrB.token);
    expect(qrC.version).toBe(qrB.version + 1);
  });

  it('TEST 5: Failed scan does NOT change or rotate the QR', async () => {
    // Generate QR-A
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    const qrA = genRes.body.data;

    // First scan marks student inside
    const firstScan = await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: qrA });

    expect(firstScan.status).toBe(201);
    await new Promise((r) => setTimeout(r, 200));

    // Now active QR is QR-B
    const activeB = await request(app)
      .get('/api/qr/active?qrType=ENTRY')
      .set('Authorization', `Bearer ${adminToken}`);
    const tokenB = activeB.body.data.token;

    // Student attempts duplicate check-in with QR-B (should fail with ALREADY_INSIDE)
    const failedScan = await request(app)
      .post('/api/attendance/entry')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ qrPayload: activeB.body.data });

    expect(failedScan.status).toBe(409);
    expect(failedScan.body.message).toContain('already checked in');

    await new Promise((r) => setTimeout(r, 200));

    // Active QR must remain tokenB
    const activeAfterFail = await request(app)
      .get('/api/qr/active?qrType=ENTRY')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(activeAfterFail.body.data.token).toBe(tokenB);
  });

  it('TEST 6: Duplicate camera callbacks on same QR produce only 1 attendance and 1 rotation', async () => {
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    const qrA = genRes.body.data;

    // Simulate 3 rapid concurrent camera callbacks with the same QR token
    const [res1, res2, res3] = await Promise.all([
      request(app)
        .post('/api/attendance/entry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ qrPayload: qrA }),
      request(app)
        .post('/api/attendance/entry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ qrPayload: qrA }),
      request(app)
        .post('/api/attendance/entry')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ qrPayload: qrA }),
    ]);

    // Exactly one should succeed with 201; the duplicate attempts should be rejected (409)
    const successCount = [res1, res2, res3].filter((r) => r.status === 201).length;
    expect(successCount).toBe(1);

    await new Promise((r) => setTimeout(r, 300));

    // Active sessions: exactly ONE new ACTIVE session version
    const activeQR = await request(app)
      .get('/api/qr/active?qrType=ENTRY')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(activeQR.body.data.version).toBe(qrA.version + 1);
  });

  it('TEST 7: Supports 20+ sequential student scans without any 15-scan limit', async () => {
    const genRes = await request(app)
      .post('/api/qr/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrType: 'ENTRY' });

    let currentQR = genRes.body.data;

    // Create and scan 20 students sequentially
    for (let i = 1; i <= 20; i++) {
      const email = `student_seq_${i}@test.com`;
      await User.create({
        name: `Student Seq ${i}`,
        email,
        password: 'Password@123',
        role: 'STUDENT',
        studentIdNumber: `ST${100 + i}`,
        phone: `98765432${i < 10 ? '0' + i : i}`,
        status: 'ACTIVE',
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'Password@123' });

      const sToken = loginRes.body.data.token;

      const scanRes = await request(app)
        .post('/api/attendance/entry')
        .set('Authorization', `Bearer ${sToken}`)
        .send({ qrPayload: currentQR });

      expect(scanRes.status).toBe(201);
      expect(scanRes.body.success).toBe(true);

      await new Promise((r) => setTimeout(r, 100));

      const pollRes = await request(app)
        .get('/api/qr/active?qrType=ENTRY')
        .set('Authorization', `Bearer ${adminToken}`);

      currentQR = pollRes.body.data;
    }

    // Verify 20 attendance records created in DB for 20 students
    const count = await Attendance.countDocuments({ status: 'ACTIVE' });
    expect(count).toBe(20);
  });

  it('TEST 8 & 9: Unlimited student login/logout cycles and multi-device simultaneous sessions', async () => {
    // 1. studentToken was created in beforeEach (Device 1 is logged in).
    // Device 2 logs in concurrently -> SUCCEEDS (no device restriction)
    const device2Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'Password@123' });
    expect(device2Res.status).toBe(200);
    expect(device2Res.body.success).toBe(true);
    const device2Token = device2Res.body.data.token;

    // Device 3 logs in concurrently -> SUCCEEDS
    const device3Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'Password@123' });
    expect(device3Res.status).toBe(200);
    expect(device3Res.body.success).toBe(true);

    // 2. Device 1 logs out -> server session for Device 1 is revoked
    const logoutInitial = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(logoutInitial.status).toBe(200);

    // 3. Device 2 is still logged in and active
    const meDevice2 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${device2Token}`);
    expect(meDevice2.status).toBe(200);

    let currentTok = device2Token;

    // 4. Repeat Login -> Logout cycle 5 times (Unlimited cycles test)
    for (let cycle = 1; cycle <= 5; cycle++) {
      // Logout current
      const logoutCycle = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${currentTok}`);
      expect(logoutCycle.status).toBe(200);

      // Login again
      const loginCycle = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@test.com', password: 'Password@123' });

      expect(loginCycle.status).toBe(200);
      expect(loginCycle.body.success).toBe(true);
      currentTok = loginCycle.body.data.token;
    }

    // 5. Concurrent login while logged in succeeds (unlimited devices)
    const concurrentAllowed = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'Password@123' });
    expect(concurrentAllowed.status).toBe(200);
    expect(concurrentAllowed.body.success).toBe(true);

    // Final logout
    const finalLogout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${currentTok}`);
    expect(finalLogout.status).toBe(200);

    // Final re-login succeeds
    const finalLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@test.com', password: 'Password@123' });
    expect(finalLogin.status).toBe(200);
  });
});


