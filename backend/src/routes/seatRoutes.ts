import { Router } from 'express';
import {
  getSeats,
  updateSeatStatus,
  assignSeat,
  releaseSeat,
} from '../controllers/seatController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);

router.get('/', getSeats);
router.patch('/:id/status', requireRole('ADMIN'), updateSeatStatus);
router.post('/assign', requireRole('ADMIN'), assignSeat);
router.post('/release', requireRole('ADMIN'), releaseSeat);

export default router;
