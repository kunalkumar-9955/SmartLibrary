import { Router } from 'express';
import {
  getPlans,
  getMyPayments,
  createOrder,
  submitUtr,
  getOrderStatus,
  serveQrImage,
  handleWebhook,
  getAdminPayments,
  verifyPaymentAdmin,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

// Public / Gateway routes
router.get('/plans', getPlans);
router.get('/qr-image', serveQrImage);
router.post('/webhook', handleWebhook);

// Student & Authenticated user routes
router.get('/my-payments', authenticate, getMyPayments);
router.post('/create-order', authenticate, createOrder);
router.post('/submit-utr', authenticate, submitUtr);
router.get('/status/:orderId', authenticate, getOrderStatus);

// Admin routes
router.get('/admin/all', authenticate, requireRole('ADMIN'), getAdminPayments);
router.post('/admin/verify/:orderId', authenticate, requireRole('ADMIN'), verifyPaymentAdmin);

export default router;
