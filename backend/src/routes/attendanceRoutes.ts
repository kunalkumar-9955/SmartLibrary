import { Router } from 'express';
import {
  markEntryAttendance,
  markExitAttendance,
  getMyAttendanceHistory,
  getAllAttendance,
  getCurrentlyInside,
  forceCheckout,
} from '../controllers/attendanceController';
import { exportAttendanceExcel } from '../controllers/excelController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { attendanceLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate);

// Student actions
router.post('/entry', requireRole('STUDENT'), attendanceLimiter, markEntryAttendance);
router.post('/exit', requireRole('STUDENT'), attendanceLimiter, markExitAttendance);
router.get('/my', requireRole('STUDENT'), getMyAttendanceHistory);

// Admin actions
router.get('/currently-inside', requireRole('ADMIN'), getCurrentlyInside);
router.get('/export', requireRole('ADMIN'), exportAttendanceExcel);
router.get('/', requireRole('ADMIN'), getAllAttendance);
router.post('/force-checkout/:id', requireRole('ADMIN'), forceCheckout);
router.post('/reconcile', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { reconcileActiveAttendanceAndSeats } = await import('../services/reconciliationService');
    const report = await reconcileActiveAttendanceAndSeats();
    res.json({ success: true, data: report, message: 'Reconciliation completed successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;

