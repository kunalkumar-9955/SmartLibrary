/**
 * Lakshya Smart Library - Database Fresh Start Execution Script
 * 
 * Usage:
 *   node scripts/executeFreshStart.js
 *   node scripts/executeFreshStart.js "<MONGODB_URI>"
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
  console.error('To execute the reset against your live/production MongoDB Atlas database:');
  console.error('  node backend/scripts/executeFreshStart.js "<YOUR_MONGODB_ATLAS_URI>"');
  console.error('or set MONGODB_URI in backend/.env');
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

  const { executeSafeFreshStart, previewFreshStart } = require('../dist/services/maintenanceService');
  const { StudentPersonalQr } = require('../dist/models/StudentPersonalQr');
  const { Payment } = require('../dist/models/Payment');
  const { User } = require('../dist/models/User');
  const { Attendance } = require('../dist/models/Attendance');

  // Step 1: Preview current state
  console.log('--- 1. PRE-CLEANUP DATABASE INSPECTION ---');
  const preview = await previewFreshStart();
  console.log(`- Confirmed Demo/Test Payments found: ${preview.paymentsToClean.length}`);
  preview.paymentsToClean.forEach((p, idx) => {
    console.log(`  [${idx + 1}] Order: ${p.orderId} | ₹${p.amount} | Plan: ${p.planName || 'N/A'} | Student: ${p.studentName} (${p.studentEmail})`);
  });

  console.log(`\n- Active Attendance QRs found to revoke: ${preview.qrsToRevoke.length}`);
  preview.qrsToRevoke.forEach((q, idx) => {
    console.log(`  [${idx + 1}] Student: ${q.studentName} (ID: ${q.studentIdNumber}) | Gen #${q.generationCount} | Token: ${q.qrToken.substring(0, 16)}...`);
  });

  console.log(`\n- Genuine Records that will be PRESERVED:`);
  console.log(`  * Genuine Payments: ${preview.preservedCounts.genuinePayments}`);
  console.log(`  * Registered Students: ${preview.preservedCounts.students}`);
  console.log(`  * Attendance Records: ${preview.preservedCounts.attendanceRecords}`);

  // Step 2: Execute Fresh Start
  console.log('\n--- 2. EXECUTING SAFE FRESH START ---');
  const result = await executeSafeFreshStart({
    adminEmail: 'admin@lakshyalibrary.com',
    adminName: 'Authorized Admin CLI',
    ipAddress: '127.0.0.1 (CLI Execution)',
  });

  console.log(`✅ Snapshot ID Created: ${result.snapshotId}`);
  console.log(`✅ Demo Payments Cleaned: ${result.summary.paymentsCleanedCount}`);
  console.log(`✅ Attendance QR Tokens Revoked: ${result.summary.qrsRevokedCount}`);
  console.log(`✅ Genuine Payments Preserved: ${result.summary.paymentsPreservedCount}`);
  console.log(`✅ Registered Students Retained: ${result.summary.studentsPreservedCount}`);
  console.log(`✅ Attendance History Preserved: ${result.summary.attendancePreservedCount}`);

  // Step 3: Verify Post-Cleanup State
  console.log('\n--- 3. POST-CLEANUP VERIFICATION ---');
  const remainingActiveQrs = await StudentPersonalQr.countDocuments({ status: 'ACTIVE' });
  const remainingRevokedQrs = await StudentPersonalQr.countDocuments({ status: 'REVOKED' });
  const remainingTestPayments = await Payment.countDocuments({
    $or: [
      { isTestTransaction: true },
      { planId: { $in: ['test-gateway', 'gateway-test'] } },
      { orderId: { $regex: /^(LIB-TEST|LIB-ORD-TEST-)/i } },
    ],
  });

  console.log(`- Remaining Active QR codes: ${remainingActiveQrs} (Expected: 0)`);
  console.log(`- Total Revoked QR codes: ${remainingRevokedQrs}`);
  console.log(`- Remaining Test Payments: ${remainingTestPayments} (Expected: 0)`);

  if (remainingActiveQrs === 0 && remainingTestPayments === 0) {
    console.log('\n🎯 VERIFICATION RESULT: SUCCESS! Database is clean and ready for fresh launch.\n');
  } else {
    console.warn('\n⚠️ VERIFICATION RESULT: Some records may still require inspection.\n');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\n❌ Execution Error:', err.message);
  process.exit(1);
});
