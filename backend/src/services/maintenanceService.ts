import mongoose from 'mongoose';
import { Payment } from '../models/Payment';
import { StudentPersonalQr } from '../models/StudentPersonalQr';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { MaintenanceSnapshot } from '../models/MaintenanceSnapshot';
import { logAdminAction } from './auditService';

export interface FreshStartOptions {
  adminId?: string | mongoose.Types.ObjectId;
  adminEmail?: string;
  adminName?: string;
  ipAddress?: string;
}

export interface FreshStartResult {
  success: boolean;
  message: string;
  snapshotId: string;
  summary: {
    paymentsCleanedCount: number;
    paymentsPreservedCount: number;
    qrsRevokedCount: number;
    studentsPreservedCount: number;
    attendancePreservedCount: number;
    ambiguousRecordsPreservedCount: number;
    timestamp: string;
  };
  cleanedPaymentOrderIds: string[];
  revokedQrTokens: string[];
}

export const getTestPaymentFilter = () => ({
  $or: [
    { isTestTransaction: true },
    { planId: { $in: ['test-gateway', 'gateway-test'] } },
    { orderId: { $regex: /^(LIB-TEST|LIB-ORD-TEST-)/i } },
    { idempotencyKey: { $regex: /_test_/i } },
    { studentEmail: { $in: ['admin@example.com', 'student@example.com'] } },
    { notes: 'Gateway Test' },
  ],
});

export const previewFreshStart = async () => {
  const testPaymentFilter = getTestPaymentFilter();
  const demoPayments = await Payment.find(testPaymentFilter).lean();
  const genuinePaymentsCount = await Payment.countDocuments({
    _id: { $nin: demoPayments.map((p) => p._id) },
  });

  const activeQrs = await StudentPersonalQr.find({ status: 'ACTIVE' }).lean();
  const studentsCount = await User.countDocuments({ role: 'STUDENT' });
  const attendanceCount = await Attendance.countDocuments();

  return {
    paymentsToClean: demoPayments.map((p) => ({
      _id: p._id,
      orderId: p.orderId,
      amount: p.amount,
      planName: p.planName,
      studentName: p.studentName,
      studentEmail: p.studentEmail,
      isTestTransaction: p.isTestTransaction,
      createdAt: p.createdAt,
    })),
    qrsToRevoke: activeQrs.map((q) => ({
      _id: q._id,
      studentName: q.studentName,
      studentIdNumber: q.studentIdNumber,
      assignedSeatNumber: q.assignedSeatNumber,
      generationCount: q.generationCount,
      qrToken: q.qrToken,
    })),
    preservedCounts: {
      genuinePayments: genuinePaymentsCount,
      students: studentsCount,
      attendanceRecords: attendanceCount,
    },
  };
};

export const executeSafeFreshStart = async (
  options: FreshStartOptions
): Promise<FreshStartResult> => {
  const adminEmail = options.adminEmail || 'admin@lakshyalibrary.com';
  const adminName = options.adminName || 'Library Admin';
  const adminIdObj = options.adminId ? new mongoose.Types.ObjectId(String(options.adminId)) : undefined;

  // 1. Identify confidently-known demo & test payments
  const testPaymentFilter = getTestPaymentFilter();

  const demoPayments = await Payment.find(testPaymentFilter);
  const demoPaymentIds = demoPayments.map((p) => p._id.toString());
  const demoPaymentOrderIds = demoPayments.map((p) => p.orderId);

  // Genuine payments to preserve:
  const genuinePaymentsCount = await Payment.countDocuments({
    _id: { $nin: demoPayments.map((p) => p._id) },
  });

  // 2. Identify existing active QR codes to revoke
  const activeQrs = await StudentPersonalQr.find({ status: 'ACTIVE' });
  const activeQrIds = activeQrs.map((q) => q._id.toString());
  const activeQrTokens = activeQrs.map((q) => q.qrToken);

  // Total students & attendance to preserve
  const studentsPreservedCount = await User.countDocuments({ role: 'STUDENT' });
  const attendancePreservedCount = await Attendance.countDocuments();

  // 3. Create Recoverable Snapshot BEFORE applying changes
  const snapshot = await MaintenanceSnapshot.create({
    snapshotType: 'PRE_CLEANUP_DEMO_DATA',
    adminId: adminIdObj,
    adminEmail,
    summary: {
      paymentsCleanedCount: demoPayments.length,
      paymentsPreservedCount: genuinePaymentsCount,
      qrsRevokedCount: activeQrs.length,
      studentsPreservedCount,
      attendancePreservedCount,
      notes: `Fresh start cleanup initiated by ${adminEmail}. Revoked ${activeQrs.length} active QR tokens. Removed ${demoPayments.length} demo/test payment records.`,
    },
    cleanedPaymentIds: demoPaymentOrderIds,
    revokedQrIds: activeQrTokens,
    rawSnapshotData: {
      demoPayments: demoPayments.map((p) => ({
        orderId: p.orderId,
        amount: p.amount,
        status: p.status,
        studentName: p.studentName,
        studentEmail: p.studentEmail,
        createdAt: p.createdAt,
      })),
      revokedQrs: activeQrs.map((q) => ({
        studentId: q.studentId,
        studentName: q.studentName,
        studentIdNumber: q.studentIdNumber,
        assignedSeatNumber: q.assignedSeatNumber,
        generationCount: q.generationCount,
        qrToken: q.qrToken,
      })),
    },
  });

  // 4. Clean only demo/test payments
  if (demoPayments.length > 0) {
    await Payment.deleteMany({ _id: { $in: demoPayments.map((p) => p._id) } });
  }

  // 5. Revoke all existing demo/testing attendance QR tokens
  // Sets status = 'REVOKED', revokedAt = now, revokedBy = adminId
  // They are immediately rejected by attendance scanner with 'QR_REVOKED'
  if (activeQrs.length > 0) {
    await StudentPersonalQr.updateMany(
      { status: 'ACTIVE' },
      {
        $set: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedBy: adminIdObj,
        },
      }
    );
  }

  // 6. Log Audit Action
  await logAdminAction({
    adminId: adminIdObj,
    adminEmail,
    adminName,
    action: 'DEMO_DATA_CLEANUP',
    targetType: 'SYSTEM',
    details: {
      snapshotId: snapshot._id.toString(),
      paymentsCleanedCount: demoPayments.length,
      paymentsPreservedCount: genuinePaymentsCount,
      qrsRevokedCount: activeQrs.length,
      studentsPreservedCount,
      attendancePreservedCount,
    },
    ipAddress: options.ipAddress,
  });

  return {
    success: true,
    message: `Safe fresh start executed successfully. Revoked ${activeQrs.length} active QR token(s) and cleaned ${demoPayments.length} test payment(s). Genuine data preserved.`,
    snapshotId: snapshot._id.toString(),
    summary: {
      paymentsCleanedCount: demoPayments.length,
      paymentsPreservedCount: genuinePaymentsCount,
      qrsRevokedCount: activeQrs.length,
      studentsPreservedCount,
      attendancePreservedCount,
      ambiguousRecordsPreservedCount: 0,
      timestamp: new Date().toISOString(),
    },
    cleanedPaymentOrderIds: demoPaymentOrderIds,
    revokedQrTokens: activeQrTokens,
  };
};

export const getCleanupHistory = async () => {
  return MaintenanceSnapshot.find().sort({ createdAt: -1 }).limit(20);
};

