"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.getNotifications = void 0;
const Notification_1 = require("../models/Notification");
const response_1 = require("../utils/response");
const getNotifications = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const notifications = await Notification_1.Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(30);
        const unreadCount = await Notification_1.Notification.countDocuments({ userId, isRead: false });
        return (0, response_1.sendSuccess)(res, { notifications, unreadCount });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (id === 'all') {
            await Notification_1.Notification.updateMany({ userId, isRead: false }, { isRead: true });
            return (0, response_1.sendSuccess)(res, null, 'All notifications marked as read');
        }
        const notification = await Notification_1.Notification.findOneAndUpdate({ _id: id, userId }, { isRead: true }, { new: true });
        if (!notification) {
            return (0, response_1.sendError)(res, 'Notification not found', 404);
        }
        return (0, response_1.sendSuccess)(res, notification, 'Notification marked as read');
    }
    catch (error) {
        next(error);
    }
};
exports.markAsRead = markAsRead;
