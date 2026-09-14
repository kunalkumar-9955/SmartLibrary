import { Router } from 'express';
import { generateQR, getActiveQR, validateQRToken } from '../controllers/qrController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);

// Admin generates QR token for display screen (students can also access if running simulator)
router.post('/generate', requireRole('ADMIN', 'STUDENT'), generateQR);

// Admin fetches currently active QR code (polled smoothly by display screen)
router.get('/active', requireRole('ADMIN', 'STUDENT'), getActiveQR);

// QR verification test
router.post('/validate', validateQRToken);

export default router;

