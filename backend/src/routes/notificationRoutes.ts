import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController';

const router = Router();

// Public route to retrieve public VAPID key
router.get('/vapid-key', getVapidPublicKey);

// Authenticated notification routes
router.use(authenticate);

router.post('/subscribe', subscribePush);
router.post('/unsubscribe', unsubscribePush);
router.get('/my', getMyNotifications);
router.post('/read/:id', markNotificationRead);
router.post('/read-all', markAllNotificationsRead);

export default router;
