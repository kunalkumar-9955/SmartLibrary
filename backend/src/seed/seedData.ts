import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Library } from '../models/Library';
import { Seat } from '../models/Seat';

export const seedDatabase = async () => {
  console.log('[Seed] Initializing personal library system...');
  await connectDB();

  const adminEmail = (process.env.ADMIN_EMAIL || 'sonusingh7759@gmail.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe@123';

  // 1. Single Library Settings
  const existingLibrary = await Library.findOne();
  if (!existingLibrary) {
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
    console.log('[Seed] Library settings initialized.');
  }

  // 2. Single Admin Account
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: 'Library Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'ADMIN',
      phone: '+91 9876543210',
      status: 'ACTIVE',
    });
    console.log(`[Seed] Admin user created: ${adminEmail}`);
  } else {
    existingAdmin.role = 'ADMIN';
    existingAdmin.status = 'ACTIVE';
    await existingAdmin.save();
    console.log(`[Seed] Admin user verified: ${adminEmail}`);
  }

  // 3. Exactly 50 Seats: 01 to 50
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
    console.log('[Seed] Exactly 50 seats initialized.');
  }

  console.log('[Seed] Database initialization complete.');
};

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}
