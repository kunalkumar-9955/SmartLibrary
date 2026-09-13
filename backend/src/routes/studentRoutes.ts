import { Router } from 'express';
import {
  getStudents,
  createStudent,
  getStudentById,
  updateStudent,
  updateStudentStatus,
} from '../controllers/studentController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);

// Admin routes
router.get('/', requireRole('ADMIN'), getStudents);
router.post('/', requireRole('ADMIN'), createStudent);
router.get('/:id', getStudentById);
router.put('/:id', requireRole('ADMIN'), updateStudent);
router.patch('/:id/status', requireRole('ADMIN'), updateStudentStatus);

export default router;

