import { User, IUser } from '../models/User';
import { StudentNotification } from '../models/StudentNotification';
import { AdminNotification } from '../models/AdminNotification';
import { sendSms } from './smsService';

/**
 * Calculates calendar month extension safely.
 * If user currently has an active future expiry date, extends from that date by 1 calendar month.
 * Otherwise starts from today and sets expiry to 1 calendar month from now.
 */
export function calculateNextMonthlyExpiry(currentExpiry?: Date | null): {
  startDate: Date;
  expiresAt: Date;
  gracePeriodExpiresAt: Date;
} {
  const now = new Date();
  const base = currentExpiry && new Date(currentExpiry) > now ? new Date(currentExpiry) : now;

  const expiresAt = new Date(base);
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  // 5 calendar days grace period after expiry
  const gracePeriodExpiresAt = new Date(expiresAt.getTime() + 5 * 24 * 60 * 60 * 1000);

  return {
    startDate: base,
    expiresAt,
    gracePeriodExpiresAt,
  };
}

/**
 * Formats a Date nicely for Indian locale (e.g. "15 Nov 2026")
 */
export function formatIndianDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Scans all student accounts to:
 * 1. Send reminders 2 days before expiry
 * 2. Transition expired passes to GRACE_PERIOD (5 calendar days) and notify student & admin
 * 3. Transition lapsed grace periods to EXPIRED and notify student & admin
 * Safe and idempotent: will not send duplicate alerts in the same cycle.
 */
export async function runAutomaticExpiryChecks(): Promise<{
  remindersSent: number;
  gracePeriodsStarted: number;
  membershipsExpired: number;
}> {
  const now = new Date();
  let remindersSent = 0;
  let gracePeriodsStarted = 0;
  let membershipsExpired = 0;

  // 1. BEFORE EXPIRY REMINDERS (Students expiring in next 48 hours who haven't received reminder)
  const twoDaysLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const dueStudents = await User.find({
    role: 'STUDENT',
    membershipStatus: 'ACTIVE',
    membershipExpiresAt: { $gt: now, $lte: twoDaysLater },
    $or: [{ lastReminderType: { $ne: 'BEFORE_EXPIRY' } }, { lastReminderSentAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }],
  });

  for (const student of dueStudents) {
    try {
      const expiryStr = formatIndianDate(student.membershipExpiresAt!);

      // In-App Notification (Exact prompt text)
      await StudentNotification.create({
        studentId: student._id,
        type: 'SYSTEM',
        title: 'Membership Renewal Reminder',
        message: 'Your Lakshya Smart Library membership is due for renewal. Please renew your ₹500 monthly membership to continue uninterrupted library access.',
      });

      // Real SMS
      if (student.phone) {
        await sendSms({
          phoneNumber: student.phone,
          message: `Lakshya Smart Library: Your membership expires on ${expiryStr}. Please renew your ₹500 monthly membership.`,
          templateType: 'BEFORE_EXPIRY',
        });
      }

      student.lastReminderType = 'BEFORE_EXPIRY';
      student.lastReminderSentAt = now;
      await student.save();
      remindersSent++;
    } catch (err: any) {
      console.warn(`[Expiry Check] Failed before-expiry reminder for student ${student._id}:`, err.message);
    }
  }

  // 2. EXPIRY TODAY -> ENTER 5-DAY GRACE PERIOD
  const expiredStudents = await User.find({
    role: 'STUDENT',
    membershipStatus: 'ACTIVE',
    membershipExpiresAt: { $lte: now },
  });

  for (const student of expiredStudents) {
    try {
      const gracePeriodExpiresAt = new Date(student.membershipExpiresAt!.getTime() + 5 * 24 * 60 * 60 * 1000);
      student.membershipStatus = 'GRACE_PERIOD';
      student.gracePeriodExpiresAt = gracePeriodExpiresAt;
      student.lastReminderType = 'AT_EXPIRY';
      student.lastReminderSentAt = now;
      await student.save();

      // In-App Notification (Exact prompt text)
      await StudentNotification.create({
        studentId: student._id,
        type: 'SYSTEM',
        title: 'Membership Expired',
        message: 'Your monthly membership has expired. You have 5 days to complete renewal of your ₹500 membership.',
      });

      // Admin In-App Notification
      await AdminNotification.create({
        type: 'SYSTEM',
        title: 'Student Membership Expired (Grace Period Active)',
        message: `${student.name} (${student.studentIdNumber || student.email})'s ₹500 monthly membership reached expiry. 5-day grace period active until ${formatIndianDate(gracePeriodExpiresAt)}.`,
        relatedStudentId: student._id,
        studentName: student.name,
      });

      // Real SMS
      if (student.phone) {
        await sendSms({
          phoneNumber: student.phone,
          message: 'Lakshya Smart Library: Your membership has expired. You have 5 days to renew your ₹500 membership.',
          templateType: 'AT_EXPIRY',
        });
      }

      gracePeriodsStarted++;
    } catch (err: any) {
      console.warn(`[Expiry Check] Failed grace period setup for student ${student._id}:`, err.message);
    }
  }

  // 3. GRACE PERIOD LAPSED WITHOUT RENEWAL -> FULLY EXPIRED
  const graceLapsedStudents = await User.find({
    role: 'STUDENT',
    membershipStatus: 'GRACE_PERIOD',
    gracePeriodExpiresAt: { $lte: now },
  });

  for (const student of graceLapsedStudents) {
    try {
      student.membershipStatus = 'EXPIRED';
      student.lastReminderType = 'GRACE_LAPSED';
      student.lastReminderSentAt = now;
      await student.save();

      // In-App Notification
      await StudentNotification.create({
        studentId: student._id,
        type: 'SYSTEM',
        title: 'Membership Expired',
        message: 'Your 5-day grace period has ended without renewal. Please renew your ₹500 monthly membership to restore access.',
      });

      // Admin In-App Notification
      await AdminNotification.create({
        type: 'SYSTEM',
        title: 'Grace Period Ended Without Renewal',
        message: `${student.name} (${student.studentIdNumber || student.email})'s 5-day renewal grace period has expired without renewal. Membership is now fully EXPIRED.`,
        relatedStudentId: student._id,
        studentName: student.name,
      });

      // Real SMS
      if (student.phone) {
        await sendSms({
          phoneNumber: student.phone,
          message: 'Lakshya Smart Library: Your membership renewal is pending. Please renew your ₹500 membership to continue library access.',
          templateType: 'GRACE_PERIOD',
        });
      }

      membershipsExpired++;
    } catch (err: any) {
      console.warn(`[Expiry Check] Failed grace lapse processing for student ${student._id}:`, err.message);
    }
  }

  return { remindersSent, gracePeriodsStarted, membershipsExpired };
}
