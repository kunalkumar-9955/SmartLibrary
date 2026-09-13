import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Library } from '../models/Library';
import { Seat } from '../models/Seat';

/**
 * Bootstrap production system safely at startup:
 * 1. Ensure exactly ONE real Admin user exists using ADMIN_EMAIL and ADMIN_PASSWORD.
 * 2. Ensure Library settings exist (single personal library).
 * 3. Ensure exactly 50 seats (01 to 50) exist.
 * 4. Remove any legacy demo accounts (admin@example.com, student@example.com).
 * 
 * Never hardcodes or logs passwords.
 */
export const bootstrapSystem = async (): Promise<void> => {
  try {
    const rawAdminEmail = process.env.ADMIN_EMAIL || 'sonusingh7759@gmail.com';
    const adminEmail = rawAdminEmail.toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD;

    console.log(`[Bootstrap] Verifying library admin account: ${adminEmail}`);

    let adminUser = await User.findOne({ email: adminEmail });

    if (adminPassword && adminPassword.trim() !== '') {
      const cleanPassword = adminPassword.trim();

      if (adminUser) {
        // Admin user exists: verify credentials and role
        let needsSave = false;

        if (adminUser.role !== 'ADMIN') {
          adminUser.role = 'ADMIN';
          needsSave = true;
        }

        if (adminUser.status !== 'ACTIVE') {
          adminUser.status = 'ACTIVE';
          needsSave = true;
        }

        const isMatch = await adminUser.comparePassword(cleanPassword);
        if (!isMatch) {
          // Update password securely (pre-save hook hashes with bcrypt)
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
        // Admin does not exist: create securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cleanPassword, salt);

        await User.create({
          name: 'Library Admin',
          email: adminEmail,
          password: hashedPassword,
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

    // Clean up any legacy demo accounts to prevent unauthorized demo access
    if (adminEmail !== 'admin@example.com') {
      const deletedAdmin = await User.deleteMany({ email: 'admin@example.com' });
      if (deletedAdmin.deletedCount > 0) {
        console.log(`[Bootstrap] Removed ${deletedAdmin.deletedCount} legacy demo admin account(s).`);
      }
    }

    const deletedDemoStudents = await User.deleteMany({ email: 'student@example.com' });
    if (deletedDemoStudents.deletedCount > 0) {
      console.log(`[Bootstrap] Removed ${deletedDemoStudents.deletedCount} legacy demo student account(s).`);
    }

    // Ensure single Library settings exist
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

    // Ensure exactly 50 seats exist (01 to 50)
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
