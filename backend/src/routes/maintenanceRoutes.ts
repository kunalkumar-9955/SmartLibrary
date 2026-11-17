import { Router } from 'express';
import {
  runFreshStart,
  getFreshStartPreview,
  clearPaymentsController,
  listSnapshots,
  getAuditLogs,
} from '../controllers/maintenanceController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN'));

router.get('/fresh-start/preview', getFreshStartPreview);
router.post('/fresh-start', runFreshStart);
router.post('/clear-payments', clearPaymentsController);
router.get('/snapshots', listSnapshots);
router.get('/audit-logs', getAuditLogs);

export default router;

