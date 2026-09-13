import { Router } from 'express';
import { getLibraryAdminDashboard, getLiveOccupancy } from '../controllers/libraryAdminController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/dashboard', getLibraryAdminDashboard);
router.get('/occupancy', getLiveOccupancy);

export default router;

