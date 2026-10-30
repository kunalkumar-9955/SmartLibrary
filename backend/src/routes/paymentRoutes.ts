import { Router } from 'express';
import {
  getPlans,
  getMyPayments,
  createOrder,
  submitUtr,
  getOrderStatus,
  serveQrImage,
  getQrPayload,
  handleWebhook,
  getAdminPayments,
  verifyPaymentAdmin,
  submitOfflineRequest,
  adminOfflineAction,
  checkExpiriesEndpoint,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { upload } from '../middleware/upload';

const router = Router();

// Public / Gateway / Cron routes
router.get('/plans', getPlans);
router.get('/qr-image', serveQrImage);
router.get('/qr-payload', getQrPayload);
router.post('/webhook', handleWebhook);
router.post('/cron/check-expiries', checkExpiriesEndpoint);

// Student & Authenticated user routes (Online + Offline)
router.get('/my-payments', authenticate, getMyPayments);
router.post('/create-order', authenticate, createOrder);
router.post('/submit-utr', authenticate, submitUtr);
router.post('/offline-request', authenticate, upload.single('receipt'), submitOfflineRequest);
router.get('/status/:orderId', authenticate, getOrderStatus);

// Admin routes
router.get('/admin/all', authenticate, requireRole('ADMIN'), getAdminPayments);
router.post('/admin/verify/:orderId', authenticate, requireRole('ADMIN'), verifyPaymentAdmin);
router.post('/admin/offline-action/:orderId', authenticate, requireRole('ADMIN'), adminOfflineAction);

export default router;
