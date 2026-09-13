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

const router = Router();

router.use(authenticate);

// Student actions
router.post('/entry', requireRole('STUDENT'), markEntryAttendance);
router.post('/exit', requireRole('STUDENT'), markExitAttendance);
router.get('/my', requireRole('STUDENT'), getMyAttendanceHistory);

// Admin actions
router.get('/currently-inside', requireRole('ADMIN'), getCurrentlyInside);
router.get('/export', requireRole('ADMIN'), exportAttendanceExcel);
router.get('/', requireRole('ADMIN'), getAllAttendance);
router.post('/force-checkout/:id', requireRole('ADMIN'), forceCheckout);

export default router;

