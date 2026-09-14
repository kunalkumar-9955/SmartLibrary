import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Library } from '../models/Library';
import { Seat } from '../models/Seat';
import { Ticket } from '../models/Ticket';
import { Notice } from '../models/Notice';
import { Attendance } from '../models/Attendance';

/**
 * Bootstrap production system safely at startup:
 * 1. Purge legacy demo / sample records from MongoDB (fake students, fake tickets, fake notices, fake attendance).
 * 2. Ensure exactly ONE real Admin user exists using ADMIN_EMAIL and ADMIN_PASSWORD.
 * 3. Ensure single Library settings exist.
 * 4. Ensure exactly 50 seats (01 to 50) exist.
 * 
 * Never hardcodes or logs passwords.
 */
export const bootstrapSystem = async (): Promise<void> => {
  try {
    const sanitizeEnv = (val?: string): string => {
      if (!val) return '';
      let clean = val.trim();
      if (
        (clean.startsWith('"') && clean.endsWith('"')) ||
        (clean.startsWith("'") && clean.endsWith("'"))
      ) {
        clean = clean.slice(1, -1).trim();
      }
      return clean;
    };

    const rawAdminEmail = process.env.ADMIN_EMAIL;
    const adminEmail = (sanitizeEnv(rawAdminEmail) || 'sonusingh7759@gmail.com').toLowerCase().trim();
    const rawPassword = process.env.ADMIN_PASSWORD;

    console.log(`[Bootstrap] Verifying library admin account: ${adminEmail}`);

    // --- 1. Clean Up Legacy Demo / Sample Records ---
    const legacyDemoEmails = [
      'admin@example.com',
      'student@example.com',
      'ananya@example.com',
      'rohan@example.com',
      'priya@example.com',
      'amit@example.com',
      'sneha@example.com',
      'kavita@example.com',
      'siddharth@example.com',
      'neha@example.com',
      'arjun@example.com',
    ];

    const deletedDemoUsers = await User.deleteMany({ email: { $in: legacyDemoEmails } });
    if (deletedDemoUsers.deletedCount > 0) {
      console.log(`[Bootstrap] Purged ${deletedDemoUsers.deletedCount} legacy demo user account(s).`);
    }

    const legacyTicketNumbers = ['LIB-1001', 'LIB-1002', 'LIB-1003', 'LIB-1004'];
    const deletedDemoTickets = await Ticket.deleteMany({ ticketNumber: { $in: legacyTicketNumbers } });
    if (deletedDemoTickets.deletedCount > 0) {
      console.log(`[Bootstrap] Purged ${deletedDemoTickets.deletedCount} legacy demo complaint ticket(s).`);
    }

    const legacyNoticeTitles = [
      'Maintain Complete Silence',
      'Wi-Fi Scheduled Maintenance',
      'Library Open on Sunday',
    ];
    const deletedDemoNotices = await Notice.deleteMany({ title: { $in: legacyNoticeTitles } });
    if (deletedDemoNotices.deletedCount > 0) {
      console.log(`[Bootstrap] Purged ${deletedDemoNotices.deletedCount} legacy demo notice(s).`);
    }

    // Clean up orphan attendance from demo students
    const demoStudentIds = ['ST001', 'ST002', 'ST003', 'ST004', 'ST005', 'ST006', 'ST007', 'ST008', 'ST009', 'ST010'];
    const deletedDemoAttendance = await Attendance.deleteMany({
      $or: [
        { studentIdNumber: { $in: demoStudentIds } },
        { studentName: { $in: ['Rahul Kumar', 'Ananya Roy', 'Rohan Verma', 'Priya Singh', 'Amit Patel'] } },
      ],
    });
    if (deletedDemoAttendance.deletedCount > 0) {
      console.log(`[Bootstrap] Purged ${deletedDemoAttendance.deletedCount} legacy demo attendance record(s).`);
    }

    // Reset any seat that was occupied by a removed demo student
    const validOccupiedStudentIds = (await User.find({ isCurrentlyInside: true }).select('_id')).map(u => u._id);
    await Seat.updateMany(
      { status: 'OCCUPIED', currentStudentId: { $nin: validOccupiedStudentIds } },
      {
        status: 'AVAILABLE',
        $unset: { currentStudentId: 1, currentStudentName: 1, currentAttendanceId: 1 },
      }
    );

    // --- 2. Admin Account Initialization ---
    let adminUser = await User.findOne({ email: adminEmail });

    if (rawPassword && rawPassword.trim() !== '') {
      const cleanPassword = sanitizeEnv(rawPassword);

      if (adminUser) {
        let needsSave = false;

        if (adminUser.role !== 'ADMIN') {
          adminUser.role = 'ADMIN';
          needsSave = true;
        }

        if (adminUser.status !== 'ACTIVE') {
          adminUser.status = 'ACTIVE';
          needsSave = true;
        }

        const isBcryptHash =
          cleanPassword.startsWith('$2a$') ||
          cleanPassword.startsWith('$2b$') ||
          cleanPassword.startsWith('$2y$');

        let isMatch = false;
        if (isBcryptHash) {
          isMatch = adminUser.password === cleanPassword;
        } else {
          isMatch = await adminUser.comparePassword(cleanPassword);
        }

        if (!isMatch) {
          adminUser.password = cleanPassword;
          needsSave = true;
        }

        if (needsSave) {
          await adminUser.save();
          console.log(`[Bootstrap] Admin credentials and role synchronized for ${adminEmail}.`);
        } else {
          console.log(`[Bootstrap] Admin account verified and active for ${adminEmail}.`);
        }
      } else {
        // Pass cleanPassword directly to User.create; UserSchema.pre('save') handles bcrypt hashing once
        await User.create({
          name: 'Library Admin',
          email: adminEmail,
          password: cleanPassword,
          role: 'ADMIN',
          status: 'ACTIVE',
          phone: '+91 9876543210',
        });
        console.log(`[Bootstrap] Created new Admin account for ${adminEmail}.`);
      }
    } else {
      if (adminUser) {
        if (adminUser.role !== 'ADMIN') {
          adminUser.role = 'ADMIN';
          await adminUser.save();
        }
        console.log(`[Bootstrap] Admin user ${adminEmail} verified in database.`);
      } else {
        console.warn(
          `[Bootstrap] ATTENTION: Admin account ${adminEmail} does not exist yet. Please set ADMIN_PASSWORD in your Render environment variables to initialize it.`
        );
      }
    }

    // --- 3. Single Library Settings ---
    const libraryCount = await Library.countDocuments();
    if (libraryCount === 0) {
      await Library.create({
        name: 'Smart Personal Library',
        address: 'Plot 42, Connaught Place, New Delhi',
        phone: '+91 9876543210',
        email: adminEmail,
        openingTime: '08:00 AM',
        closingTime: '10:00 PM',
        totalSeats: 50,
        qrExpirySeconds: 45,
      });
      console.log('[Bootstrap] Initialized single Personal Library settings.');
    }

    // --- 4. Exactly 50 Seats: 01 to 50 ---
    const seatCount = await Seat.countDocuments();
    if (seatCount === 0) {
      const seatDocs = [];
      for (let i = 1; i <= 50; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        seatDocs.push({
          seatNumber: numStr,
          status: 'AVAILABLE',
        });
      }
      await Seat.insertMany(seatDocs);
      console.log('[Bootstrap] Initialized exactly 50 library seats (01 to 50).');
    }
  } catch (error: any) {
    console.error('[Bootstrap Error] Failed to initialize system:', error.message);
  }
};
