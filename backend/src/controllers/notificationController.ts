import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { PushSubscription } from '../models/PushSubscription';
import { Notice } from '../models/Notice';
import { NotificationRead } from '../models/NotificationRead';
import { StudentNotification } from '../models/StudentNotification';
import { sendSuccess, sendError } from '../utils/response';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BLuxYmNTqtp7DHf0UvMonl7kF5XPNmsp7RQvGlajvf27d7r3SBIsGoZewQl7wE6uP0yz__toPvKjAxLjnb_AGPk';

export const getVapidPublicKey = async (req: Request, res: Response) => {
  return sendSuccess(res, { publicKey: VAPID_PUBLIC_KEY });
};

export const subscribePush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { subscription, userAgent } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return sendError(res, 'Invalid push subscription data', 400);
    }

    const saved = await PushSubscription.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), endpoint: subscription.endpoint },
      {
        userId: new mongoose.Types.ObjectId(userId),
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        userAgent: userAgent || req.headers['user-agent'] || '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, saved, 'Push subscription saved successfully');
  } catch (error) {
    next(error);
  }
};

export const unsubscribePush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return sendError(res, 'Endpoint is required', 400);
    }

    await PushSubscription.deleteOne({ userId: new mongoose.Types.ObjectId(userId), endpoint });
    return sendSuccess(res, null, 'Push subscription removed successfully');
  } catch (error) {
    next(error);
  }
};

export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // 1. Fetch public library notices
    const notices = await Notice.find().sort({ createdAt: -1 }).limit(100);
    const readDocs = await NotificationRead.find({ studentId: studentObjectId });
    const readNoticeIds = new Set(readDocs.map((r) => r.noticeId.toString()));

    const noticeItems = notices.map((n) => {
      const isRead = readNoticeIds.has(n._id.toString());
      return {
        _id: n._id.toString(),
        title: n.title,
        message: n.description,
        description: n.description,
        type: 'NOTICE' as const,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        isRead,
      };
    });

    // 2. Fetch private student notifications (Complaint updates, replies, etc.)
    const privateNotifications = await StudentNotification.find({
      studentId: studentObjectId,
    })
      .sort({ createdAt: -1 })
      .limit(100);

    const privateItems = privateNotifications.map((p) => ({
      _id: p._id.toString(),
      title: p.title,
      message: p.message,
      description: p.message,
      type: p.type,
      relatedTicketId: p.relatedTicketId ? p.relatedTicketId.toString() : undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      isRead: p.isRead,
    }));

    // 3. Merge & sort by createdAt descending
    const allNotifications = [...noticeItems, ...privateItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const unreadCount = allNotifications.filter((n) => !n.isRead).length;

    return sendSuccess(res, {
      notifications: allNotifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.user?.id;
    const { id } = req.params;

    if (!studentId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!id) {
      return sendError(res, 'Notification ID is required', 400);
    }

    const notifIdStr = Array.isArray(id) ? id[0] : (id as string);
    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // 1. Try marking private StudentNotification first
    const privateUpdated = await StudentNotification.findOneAndUpdate(
      { _id: notifIdStr, studentId: studentObjectId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (privateUpdated) {
      return sendSuccess(res, null, 'Notification marked as read');
    }

    // 2. Fall back to marking public Notice as read in NotificationRead
    const noticeObjectId = new mongoose.Types.ObjectId(notifIdStr);
    await NotificationRead.findOneAndUpdate(
      { studentId: studentObjectId, noticeId: noticeObjectId },
      { studentId: studentObjectId, noticeId: noticeObjectId, readAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, null, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // 1. Mark all private StudentNotification items as read
    await StudentNotification.updateMany(
      { studentId: studentObjectId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    // 2. Mark all public Notice items as read
    const notices = await Notice.find().select('_id');
    const bulkOps: any[] = notices.map((n) => ({
      updateOne: {
        filter: { studentId: studentObjectId, noticeId: n._id },
        update: { $set: { studentId: studentObjectId, noticeId: n._id, readAt: new Date() } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await NotificationRead.bulkWrite(bulkOps);
    }

    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};
