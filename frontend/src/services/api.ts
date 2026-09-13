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

// Auth Services
export const authService = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
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

// QR Services
export const qrService = {
  generateQR: (qrType: 'ENTRY' | 'EXIT') => api.post('/qr/generate', { qrType }),
  validateQR: (qrPayload: QRPayload) => api.post('/qr/validate', { qrPayload }),
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
