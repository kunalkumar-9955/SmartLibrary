import { Router } from 'express';
import { runFreshStart, listSnapshots, getAuditLogs } from '../controllers/maintenanceController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN'));

router.post('/fresh-start', runFreshStart);
router.get('/snapshots', listSnapshots);
router.get('/audit-logs', getAuditLogs);

export default router;
