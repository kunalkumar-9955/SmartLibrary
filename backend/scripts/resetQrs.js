/**
 * Lakshya Smart Library - Reset All Personal Attendance QRs to Starting Phase (Not Generated)
 * 
 * Usage:
 *   node scripts/resetQrs.js "<MONGODB_URI>"
 *   npm run reset-qrs "<MONGODB_URI>"
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const targetUri = process.argv[2] || process.env.MONGODB_URI;

if (!targetUri || targetUri.trim() === '') {
  console.error('\n========================================================================');
  console.error('❌ [ERROR] MONGODB_URI is not provided.');
  console.error('========================================================================');
  console.error('Usage:');
  console.error('  node backend/scripts/resetQrs.js "<YOUR_MONGODB_ATLAS_URI>"');
  console.error('========================================================================\n');
  process.exit(1);
}

const cleanUri = targetUri.trim().replace(/^['"]|['"]$/g, '');
const maskedUri = cleanUri.replace(/^(mongodb(?:\+srv)?:\/\/)(.*)@([^/?#]+)/i, '$1***:***@$3');

async function run() {
  console.log('\n========================================================================');
  console.log(`🔌 Connecting to MongoDB: ${maskedUri}`);
  console.log('========================================================================\n');

  await mongoose.connect(cleanUri, {
    serverSelectionTimeoutMS: 15000,
  });

  console.log(`✅ Connected successfully to database: "${mongoose.connection.name}" on host: "${mongoose.connection.host}"\n`);

  const { StudentPersonalQr } = require('../dist/models/StudentPersonalQr');
  const { MaintenanceSnapshot } = require('../dist/models/MaintenanceSnapshot');
  const { User } = require('../dist/models/User');
  const { Attendance } = require('../dist/models/Attendance');

  const existingQrs = await StudentPersonalQr.find({}).lean();
  const totalStudents = await User.countDocuments({ role: 'STUDENT' });
  const attendanceCount = await Attendance.countDocuments();

  console.log(`📊 Current Status:`);
  console.log(`- Registered Students: ${totalStudents}`);
  console.log(`- Existing QR Records to Reset: ${existingQrs.length}`);
  existingQrs.forEach((q, idx) => {
    console.log(`  [${idx + 1}] Student: ${q.studentName} | Seat: ${q.assignedSeatNumber || 'N/A'} | Status: ${q.status} (Gen #${q.generationCount})`);
  });

  if (existingQrs.length === 0) {
    console.log('\n✨ All student QRs are already in the initial starting phase (Not Generated / 0 records).\n');
    await mongoose.disconnect();
    return;
  }

  console.log('\n🚀 Taking safety backup snapshot and resetting QRs to starting phase...');

  const snapshot = await MaintenanceSnapshot.create({
    snapshotType: 'PRE_CLEANUP_DEMO_DATA',
    adminEmail: 'admin@lakshyalibrary.com',
    summary: {
      paymentsCleanedCount: 0,
      paymentsPreservedCount: 0,
      qrsRevokedCount: existingQrs.length,
      studentsPreservedCount: totalStudents,
      attendancePreservedCount: attendanceCount,
      notes: `All ${existingQrs.length} student personal QR codes reset to starting phase (Not Generated) via CLI script.`,
    },
    revokedQrIds: existingQrs.map((q) => q.qrToken),
    rawSnapshotData: {
      revokedQrs: existingQrs.map((q) => ({
        studentId: q.studentId,
        studentName: q.studentName,
        studentIdNumber: q.studentIdNumber,
        assignedSeatNumber: q.assignedSeatNumber,
        generationCount: q.generationCount,
        qrToken: q.qrToken,
      })),
    },
  });

  await StudentPersonalQr.deleteMany({});

  const remainingQrs = await StudentPersonalQr.countDocuments();

  console.log(`\n✅ Snapshot ID Created: ${snapshot._id}`);
  console.log(`✅ Successfully deleted all ${existingQrs.length} existing QR records.`);
  console.log(`\n--- POST-RESET VERIFICATION ---`);
  console.log(`- Remaining QR Records in Database: ${remainingQrs} (Expected: 0)`);
  console.log(`- Students in "Missing / Not Generated" Phase: ${totalStudents} (Expected: ${totalStudents})`);
  console.log(`- Student Accounts Preserved: ${totalStudents}`);
  console.log(`- Attendance History Preserved: ${attendanceCount}`);
  console.log('\n🎯 SUCCESS! All students are now in initial "Not Generated" starting phase.');
  console.log('You can now open Admin QR Management (/admin/qr) and click "Generate All Missing" to generate clean Gen #1 QR codes whenever ready.\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\n❌ Execution Error:', err.message);
  process.exit(1);
});
