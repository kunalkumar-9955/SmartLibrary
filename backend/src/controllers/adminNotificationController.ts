import { Request, Response, NextFunction } from 'express';
import { AdminNotification } from '../models/AdminNotification';
import { sendSuccess, sendError } from '../utils/response';

export const getAdminNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const filter: any = {};
    if (unreadOnly) {
      filter.isRead = false;
    }

    const total = await AdminNotification.countDocuments(filter);
    const unreadCount = await AdminNotification.countDocuments({ isRead: false });

    const notifications = await AdminNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('relatedTicketId', 'ticketNumber category title status')
      .populate('relatedStudentId', 'name studentIdNumber');

    return sendSuccess(res, {
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unreadCount = await AdminNotification.countDocuments({ isRead: false });
    return sendSuccess(res, { unreadCount });
  } catch (error) {
    next(error);
  }
};

export const markAdminNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const notification = await AdminNotification.findByIdAndUpdate(
      id,
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return sendError(res, 'Notification not found', 404);
    }

    const unreadCount = await AdminNotification.countDocuments({ isRead: false });
    return sendSuccess(res, { notification, unreadCount }, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

export const markAllAdminNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await AdminNotification.updateMany(
      { isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return sendSuccess(res, { unreadCount: 0 }, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};
