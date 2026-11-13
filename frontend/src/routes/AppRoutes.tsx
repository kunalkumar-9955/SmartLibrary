import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

// Layouts
import { LibraryAdminLayout } from '../layouts/LibraryAdminLayout';
import { StudentLayout } from '../layouts/StudentLayout';

// Lightweight Page Loading Shell
const PageLoader: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 font-sans">
    <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
    <span className="text-xs font-semibold text-slate-400">Loading Lakshya Smart Library...</span>
  </div>
);

// Route-Based Code Splitting via React.lazy for Maximum Performance
// Public Pages
const LoginPage = React.lazy(() => import('../pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const LandingPage = React.lazy(() => import('../pages/LandingPage').then(m => ({ default: m.LandingPage })));

// Student Pages
const StudentDashboard = React.lazy(() => import('../pages/student/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const StudentScanPage = React.lazy(() => import('../pages/student/StudentScanPage').then(m => ({ default: m.StudentScanPage })));
const StudentAttendancePage = React.lazy(() => import('../pages/student/StudentAttendancePage').then(m => ({ default: m.StudentAttendancePage })));
const StudentTicketsPage = React.lazy(() => import('../pages/student/StudentTicketsPage').then(m => ({ default: m.StudentTicketsPage })));
const StudentProfilePage = React.lazy(() => import('../pages/student/StudentProfilePage').then(m => ({ default: m.StudentProfilePage })));
const StudentNotificationsPage = React.lazy(() => import('../pages/student/StudentNotificationsPage').then(m => ({ default: m.StudentNotificationsPage })));
const StudentMembershipPage = React.lazy(() => import('../pages/student/StudentMembershipPage').then(m => ({ default: m.StudentMembershipPage })));

// Admin Pages
const AdminDashboard = React.lazy(() => import('../pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminStudentsPage = React.lazy(() => import('../pages/admin/AdminStudentsPage').then(m => ({ default: m.AdminStudentsPage })));
const AdminAttendancePage = React.lazy(() => import('../pages/admin/AdminAttendancePage').then(m => ({ default: m.AdminAttendancePage })));
const AdminOccupancyPage = React.lazy(() => import('../pages/admin/AdminOccupancyPage').then(m => ({ default: m.AdminOccupancyPage })));
const AdminSeatsPage = React.lazy(() => import('../pages/admin/AdminSeatsPage').then(m => ({ default: m.AdminSeatsPage })));
const AdminQRPage = React.lazy(() => import('../pages/admin/AdminQRPage').then(m => ({ default: m.AdminQRPage })));
const AdminTicketsPage = React.lazy(() => import('../pages/admin/AdminTicketsPage').then(m => ({ default: m.AdminTicketsPage })));
const AdminNoticesPage = React.lazy(() => import('../pages/admin/AdminNoticesPage').then(m => ({ default: m.AdminNoticesPage })));
const AdminReportsPage = React.lazy(() => import('../pages/admin/AdminReportsPage').then(m => ({ default: m.AdminReportsPage })));
const AdminSettingsPage = React.lazy(() => import('../pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const AdminPaymentsPage = React.lazy(() => import('../pages/admin/AdminPaymentsPage').then(m => ({ default: m.AdminPaymentsPage })));

const ProtectedRoute: React.FC<{
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isAuthenticated && user) {
    if (!allowedRoles.includes(user.role)) {
      if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
      return <Navigate to="/student/dashboard" replace />;
    }
    if (!location.pathname.includes('/login')) {
      localStorage.setItem('smart_library_last_route', location.pathname);
    }
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-sans transition-opacity">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">Loading session...</p>
      </div>
    );
  }

  return <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isAuthenticated && user) {
    const lastRoute = localStorage.getItem('smart_library_last_route');
    if (
      lastRoute &&
      ((user.role === 'ADMIN' && lastRoute.startsWith('/admin')) ||
        (user.role === 'STUDENT' && lastRoute.startsWith('/student')))
    ) {
      return <Navigate to={lastRoute} replace />;
    }
    if (user.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/student/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-sans transition-opacity">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="scan" element={<StudentScanPage />} />
          <Route path="attendance" element={<StudentAttendancePage />} />
          <Route path="tickets" element={<StudentTicketsPage />} />
          <Route path="membership" element={<StudentMembershipPage />} />
          <Route path="notifications" element={<StudentNotificationsPage />} />
          <Route path="profile" element={<StudentProfilePage />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <LibraryAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="students" element={<AdminStudentsPage />} />
          <Route path="qr" element={<AdminQRPage />} />
          <Route path="occupancy" element={<AdminOccupancyPage />} />
          <Route path="seats" element={<AdminSeatsPage />} />
          <Route path="attendance" element={<AdminAttendancePage />} />
          <Route path="tickets" element={<AdminTicketsPage />} />
          <Route path="notices" element={<AdminNoticesPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
