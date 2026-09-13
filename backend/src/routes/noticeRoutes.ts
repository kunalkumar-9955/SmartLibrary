import { Router } from 'express';
import {
  getNotices,
  createNotice,
  deleteNotice,
} from '../controllers/noticeController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);

router.get('/', getNotices);
router.post('/', requireRole('ADMIN'), createNotice);
router.delete('/:id', requireRole('ADMIN'), deleteNotice);

export default router;

