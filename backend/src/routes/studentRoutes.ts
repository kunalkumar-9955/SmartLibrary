import { Router } from 'express';
import {
  getStudents,
  createStudent,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  resetStudentPassword,
  deleteStudent,
} from '../controllers/studentController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(authenticate);

// Admin student management routes
router.get('/', requireRole('ADMIN'), getStudents);
router.post('/', requireRole('ADMIN'), createStudent);
router.get('/:id', getStudentById);
router.put('/:id', requireRole('ADMIN'), updateStudent);
router.patch('/:id/status', requireRole('ADMIN'), updateStudentStatus);
router.post('/:id/reset-password', requireRole('ADMIN'), resetStudentPassword);
router.delete('/:id', requireRole('ADMIN'), deleteStudent);

export default router;
