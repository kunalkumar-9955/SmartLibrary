import { Router } from 'express';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  addTicketComment,
} from '../controllers/ticketController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.post('/', upload.single('attachment'), createTicket);
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.patch('/:id/status', requireRole('ADMIN'), updateTicketStatus);
router.post('/:id/comments', addTicketComment);

export default router;

