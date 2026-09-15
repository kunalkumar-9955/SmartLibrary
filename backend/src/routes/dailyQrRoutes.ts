import { Router } from 'express';
import { getTodayDailyQR, generateDailyQR, scanDailyQR } from '../controllers/dailyQrController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);

// Admin: Get active Daily QR for today
router.get('/today', requireRole('ADMIN'), getTodayDailyQR);

// Admin: Generate Daily QR for today
router.post('/generate', requireRole('ADMIN'), generateDailyQR);

// Student: Scan Daily QR (Auto Entry / Exit determination)
router.post('/scan', requireRole('STUDENT'), scanDailyQR);

export default router;
