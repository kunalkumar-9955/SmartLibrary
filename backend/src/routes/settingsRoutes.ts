import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);

router.get('/', getSettings);
router.put('/', requireRole('ADMIN'), updateSettings);

export default router;
