import { Router } from 'express';
import {
  listStudentsWithQr,
  generatePersonalQr,
  generateBulkPersonalQrs,
  regeneratePersonalQr,
  getStudentPersonalQr,
  scanPersonalQr,
} from '../controllers/personalQrController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { attendanceLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate);

// Admin: Student Personal QR Management
router.get('/students', requireRole('ADMIN'), listStudentsWithQr);
router.post('/generate-bulk', requireRole('ADMIN'), generateBulkPersonalQrs);
router.post('/generate/:studentId', requireRole('ADMIN'), generatePersonalQr);
router.post('/regenerate/:studentId', requireRole('ADMIN'), regeneratePersonalQr);
router.get('/student/:studentId', getStudentPersonalQr);

// Student: Scan Personal Table QR (Auto Entry / Exit)
router.post('/scan', requireRole('STUDENT'), attendanceLimiter, scanPersonalQr);

export default router;

