import { Router } from 'express';
import {
  getAdminNotifications,
  getAdminUnreadCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '../controllers/adminNotificationController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN'));

router.get('/', getAdminNotifications);
router.get('/unread-count', getAdminUnreadCount);
router.post('/read/:id', markAdminNotificationRead);
router.post('/read-all', markAllAdminNotificationsRead);

export default router;
