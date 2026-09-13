import { Router } from 'express';
import {
  getDashboardStats,
  getAdminReports,
} from '../controllers/reportController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/analytics', getAdminReports);

export default router;

