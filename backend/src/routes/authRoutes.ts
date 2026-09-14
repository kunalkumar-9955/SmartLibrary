import { Router } from 'express';
import { login, getMe, logout, changePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.get('/me', authenticate, getMe);
router.post('/logout', logout);
router.put('/change-password', authenticate, authLimiter, changePassword);

export default router;

