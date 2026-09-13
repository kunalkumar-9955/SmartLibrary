import { Router } from 'express';
import {
  getSeats,
  updateSeatStatus,
} from '../controllers/seatController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);

router.get('/', getSeats);
router.patch('/:id/status', requireRole('ADMIN'), updateSeatStatus);

export default router;

