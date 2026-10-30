import { Router } from 'express';
import {
  getPlans,
  getMyPayments,
  createOrder,
  submitUtr,
  getOrderStatus,
  serveQrImage,
  getQrPayload,
  serveQrSvg,
  handleWebhook,
  getAdminPayments,
  verifyPaymentAdmin,
  submitOfflineRequest,
  adminOfflineAction,
  checkExpiriesEndpoint,
  getPaymentReceipt,
  requestRefund,
  adminProcessRefund,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { upload } from '../middleware/upload';

const router = Router();

// Public / Gateway / Cron routes
router.get('/plans', getPlans);
router.get('/qr-image', serveQrImage);
router.get('/qr-payload', getQrPayload);
router.get('/qr.svg', serveQrSvg);
router.get('/qr.svg/:orderId', serveQrSvg);
router.post('/webhook', handleWebhook);
router.post('/cron/check-expiries', checkExpiriesEndpoint);

// Student & Authenticated user routes (Online + Offline)
router.get('/my-payments', authenticate, getMyPayments);
router.post('/create-order', authenticate, createOrder);
router.post('/submit-utr', authenticate, submitUtr);
router.post('/offline-request', authenticate, upload.single('receipt'), submitOfflineRequest);
router.get('/status/:orderId', authenticate, getOrderStatus);
router.get('/receipt/:orderId', authenticate, getPaymentReceipt);
router.post('/refund-request/:orderId', authenticate, requestRefund);

// Admin routes
router.get('/admin/all', authenticate, requireRole('ADMIN'), getAdminPayments);
router.post('/admin/verify/:orderId', authenticate, requireRole('ADMIN'), verifyPaymentAdmin);
router.post('/admin/offline-action/:orderId', authenticate, requireRole('ADMIN'), adminOfflineAction);
router.post('/admin/refund-action/:orderId', authenticate, requireRole('ADMIN'), adminProcessRefund);

export default router;
