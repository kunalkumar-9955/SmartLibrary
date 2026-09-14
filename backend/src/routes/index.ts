import { Router } from 'express';
import authRoutes from './authRoutes';
import libraryAdminRoutes from './libraryAdminRoutes';
import studentRoutes from './studentRoutes';
import attendanceRoutes from './attendanceRoutes';
import qrRoutes from './qrRoutes';
import seatRoutes from './seatRoutes';
import ticketRoutes from './ticketRoutes';
import noticeRoutes from './noticeRoutes';
import reportRoutes from './reportRoutes';
import settingsRoutes from './settingsRoutes';
import notificationRoutes from './notificationRoutes';
import adminNotificationRoutes from './adminNotificationRoutes';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply general rate limiter to API router
router.use(apiLimiter);

router.use('/auth', authRoutes);
router.use('/library-admin', libraryAdminRoutes);
router.use('/students', studentRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/qr', qrRoutes);
router.use('/seats', seatRoutes);
router.use('/tickets', ticketRoutes);
router.use('/notices', noticeRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin-notifications', adminNotificationRoutes);

export default router;
