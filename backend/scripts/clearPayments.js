/**
 * Lakshya Smart Library - Clear All Test Payment History
 * 
 * Usage:
 *   node scripts/clearPayments.js "<MONGODB_URI>"
 *   npm run clear-payments "<MONGODB_URI>"
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
  console.error('  node backend/scripts/clearPayments.js "<YOUR_MONGODB_ATLAS_URI>"');
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

  const { clearAllPaymentHistory } = require('../dist/services/maintenanceService');
  const { Payment } = require('../dist/models/Payment');
  const { User } = require('../dist/models/User');

  const beforeCount = await Payment.countDocuments();
  console.log(`📊 Found ${beforeCount} total payment record(s) in database.\n`);

  if (beforeCount === 0) {
    console.log('✨ Payment history is already completely empty (0 records). No cleanup needed.\n');
    await mongoose.disconnect();
    return;
  }

  console.log('🚀 Executing safe payment history cleanup...');
  const result = await clearAllPaymentHistory({
    adminEmail: 'admin@lakshyalibrary.com',
    adminName: 'Authorized Admin CLI',
    ipAddress: '127.0.0.1 (CLI Execution)',
  });

  console.log(`\n✅ ${result.message}`);
  console.log(`🔒 Recoverable Snapshot ID: ${result.snapshotId}`);

  const afterCount = await Payment.countDocuments();
  const studentsCount = await User.countDocuments({ role: 'STUDENT' });

  console.log('\n--- VERIFICATION ---');
  console.log(`- Remaining Payment Records: ${afterCount} (Expected: 0)`);
  console.log(`- Active Student Accounts Preserved: ${studentsCount}`);
  console.log('🎯 Payment ledger is now reset to a clean state ready for new real payments!\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\n❌ Execution Error:', err.message);
  process.exit(1);
});

