import axios from 'axios';
import { QRPayload } from '../types';

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || envUrl.trim() === '' || envUrl === '/api') {
    return '/api';
  }
  const cleanUrl = envUrl.trim().replace(/\/$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smart_library_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('smart_library_token');
      localStorage.removeItem('smart_library_user');
      window.location.href = '/login?expired=true';
    }
    return Promise.reject(error);
  }
);

let inFlightMePromise: Promise<any> | null = null;

// Auth Services
export const authService = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  getMe: () => {
    if (inFlightMePromise) {
      return inFlightMePromise;
    }
    inFlightMePromise = api.get('/auth/me').finally(() => {
      inFlightMePromise = null;
    });
    return inFlightMePromise;
  },
  logout: () => api.post('/auth/logout'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', data),
};

// Admin Services
export const adminService = {
  getDashboard: () => api.get('/library-admin/dashboard'),
  getLiveOccupancy: (params?: any) => api.get('/library-admin/occupancy', { params }),
};

// Student Management Services
export const studentService = {
  getStudents: (params?: any) => api.get('/students', { params }),
  createStudent: (data: any) => api.post('/students', data),
  getStudentById: (id: string) => api.get(`/students/${id}`),
  updateStudent: (id: string, data: any) => api.put(`/students/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/students/${id}/status`, { status }),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/students/${id}/reset-password`, { newPassword }),
  deleteStudent: (id: string) => api.delete(`/students/${id}`),
};

// QR Services (Live Dynamic QR)
export const qrService = {
  generateQR: (qrType: 'ENTRY' | 'EXIT') => api.post('/qr/generate', { qrType }),
  getActiveQR: (qrType: 'ENTRY' | 'EXIT') => api.get('/qr/active', { params: { qrType } }),
  validateQR: (qrPayload: QRPayload) => api.post('/qr/validate', { qrPayload }),
};

// Daily QR Services (Fixed QR for days when Admin is absent)
export const dailyQrService = {
  getTodayQR: () => api.get('/daily-qr/today'),
  generateQR: (forceRegenerate: boolean = false) =>
    api.post('/daily-qr/generate', { forceRegenerate }),
  scanQR: (qrPayload: any, mode: 'ENTRY' | 'EXIT', preferredSeatNumber?: string) =>
    api.post('/daily-qr/scan', { qrPayload, mode, preferredSeatNumber }),
};

// Attendance Services
export const attendanceService = {
  markEntry: (qrPayload: QRPayload, preferredSeatNumber?: string) =>
    api.post('/attendance/entry', { qrPayload, preferredSeatNumber }),
  markExit: (qrPayload: QRPayload) => api.post('/attendance/exit', { qrPayload }),
  getMyHistory: (params?: any) => api.get('/attendance/my', { params }),
  getAllAttendance: (params?: any) => api.get('/attendance', { params }),
  getCurrentlyInside: (params?: any) => api.get('/attendance/currently-inside', { params }),
  forceCheckout: (attendanceId: string) => api.post(`/attendance/force-checkout/${attendanceId}`),
  exportAttendancePDF: (params?: { date?: string; startDate?: string; endDate?: string; studentId?: string }) =>
    api.get('/attendance/export', {
      params,
      responseType: 'blob',
    }),
  exportAttendanceExcel: (params?: { date?: string; startDate?: string; endDate?: string; studentId?: string }) =>
    api.get('/attendance/export', {
      params,
      responseType: 'blob',
    }),
};

// Seat Services
export const seatService = {
  getSeats: (params?: any) => api.get('/seats', { params }),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/seats/${id}/status`, { status, notes }),
};

// Ticket / Complaint Services
export const ticketService = {
  createTicket: (data: { category: string; title: string; description: string; seatNumber?: string }) =>
    api.post('/tickets', data),
  getTickets: (params?: any) => api.get('/tickets', { params }),
  getTicketById: (id: string) => api.get(`/tickets/${id}`),
  updateStatus: (id: string, data: { status: string; resolutionNote?: string; adminComment?: string }) =>
    api.patch(`/tickets/${id}/status`, data),
  addComment: (id: string, comment: string) => api.post(`/tickets/${id}/comments`, { comment }),
};

// Notice Services
export const noticeService = {
  getNotices: () => api.get('/notices'),
  createNotice: (data: { title: string; description: string }) => api.post('/notices', data),
  deleteNotice: (id: string) => api.delete(`/notices/${id}`),
};

// Report Services
export const reportService = {
  getStats: () => api.get('/reports/stats'),
  getAnalytics: (days: number = 7) => api.get('/reports/analytics', { params: { days } }),
};

// Settings Services
export const settingsService = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data: any) => api.put('/settings', data),
};

// Notification Services
export const notificationService = {
  getVapidPublicKey: () => api.get('/notifications/vapid-key'),
  subscribePush: (data: { subscription: any; userAgent?: string }) =>
    api.post('/notifications/subscribe', data),
  unsubscribePush: (data: { endpoint: string }) =>
    api.post('/notifications/unsubscribe', data),
  getMyNotifications: () => api.get('/notifications/my'),
  markAsRead: (id: string) => api.post(`/notifications/read/${id}`),
  markAllAsRead: () => api.post('/notifications/read-all'),
};

// Admin Notification Services
export const adminNotificationService = {
  getNotifications: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get('/admin-notifications', { params }),
  getUnreadCount: () => api.get('/admin-notifications/unread-count'),
  markAsRead: (id: string) => api.post(`/admin-notifications/read/${id}`),
  markAllAsRead: () => api.post('/admin-notifications/read-all'),
};

// Payment & Subscription Services (YouPI-PG Gateway, Direct UPI & Admin Offline Approval)
export const paymentService = {
  getPlans: () => api.get('/payments/plans'),
  getMyPayments: () => api.get('/payments/my-payments'),
  createOrder: (data: { planId?: string; idempotencyKey?: string; amount?: number; isCustomAmount?: boolean; isTestTransaction?: boolean }) =>
    api.post('/payments/create-order', data),
  submitUtr: (data: { orderId: string; utr: string; notes?: string }) =>
    api.post('/payments/submit-utr', data),
  submitOfflineRequest: (data: FormData | { paymentMethod?: string; remarks?: string; amount?: number; isCustomAmount?: boolean }) => {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return api.post('/payments/offline-request', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/payments/offline-request', data);
  },
  getQrImageUrl: () => `${API_BASE_URL}/payments/qr-image`,
  getQrPayload: () => api.get('/payments/qr-payload'),
  getQrSvgUrl: (orderId?: string) => orderId ? `${API_BASE_URL}/payments/qr.svg/${orderId}` : `${API_BASE_URL}/payments/qr.svg`,
  getOrderStatus: (orderId: string) => api.get(`/payments/status/${orderId}`),
  getPaymentReceipt: (orderId: string) => api.get(`/payments/receipt/${orderId}`),
  getAdminPayments: (params?: { status?: string; type?: string; testClassification?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/payments/admin/all', { params }),
  verifyPaymentAdmin: (orderId: string, data: { action: 'APPROVE' | 'REJECT'; notes?: string }) =>
    api.post(`/payments/admin/verify/${orderId}`, data),
  adminOfflineAction: (
    orderId: string,
    data: { action: 'APPROVE' | 'REJECT'; rejectionReason?: string; remarks?: string; grantMembershipException?: boolean }
  ) => api.post(`/payments/admin/offline-action/${orderId}`, data),
  triggerExpiryCheck: () => api.post('/payments/cron/check-expiries'),
  requestRefund: (orderId: string, data: { reason?: string }) =>
    api.post(`/payments/refund-request/${orderId}`, data),
  adminProcessRefund: (
    orderId: string,
    data: { action: 'APPROVE' | 'REJECT'; rejectionReason?: string; refundReference?: string; remarks?: string }
  ) => api.post(`/payments/admin/refund-action/${orderId}`, data),
};
