import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

// Layouts
import { LibraryAdminLayout } from '../layouts/LibraryAdminLayout';
import { StudentLayout } from '../layouts/StudentLayout';

// Public Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { LandingPage } from '../pages/LandingPage';

// Student Pages
import { StudentDashboard } from '../pages/student/StudentDashboard';
import { StudentScanPage } from '../pages/student/StudentScanPage';
import { StudentAttendancePage } from '../pages/student/StudentAttendancePage';
import { StudentTicketsPage } from '../pages/student/StudentTicketsPage';
import { StudentProfilePage } from '../pages/student/StudentProfilePage';
import { StudentNotificationsPage } from '../pages/student/StudentNotificationsPage';

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { AdminStudentsPage } from '../pages/admin/AdminStudentsPage';
import { AdminAttendancePage } from '../pages/admin/AdminAttendancePage';
import { AdminOccupancyPage } from '../pages/admin/AdminOccupancyPage';
import { AdminSeatsPage } from '../pages/admin/AdminSeatsPage';
import { AdminQRPage } from '../pages/admin/AdminQRPage';
import { AdminTicketsPage } from '../pages/admin/AdminTicketsPage';
import { AdminNoticesPage } from '../pages/admin/AdminNoticesPage';
import { AdminReportsPage } from '../pages/admin/AdminReportsPage';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';

const ProtectedRoute: React.FC<{
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // 1. Instant App Shell: If authenticated locally, render immediately without blocking
  if (isAuthenticated && user) {
    if (!allowedRoles.includes(user.role)) {
      if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
      return <Navigate to="/student/dashboard" replace />;
    }
    // Track safe last-visited route for automatic session restoration
    if (!location.pathname.includes('/login')) {
      localStorage.setItem('smart_library_last_route', location.pathname);
    }
    return <>{children}</>;
  }

  // 2. Non-blocking fallback: only if a token exists without user profile is minimal loader shown
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-sans transition-opacity">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">Loading session...</p>
      </div>
    );
  }

  // 3. Not authenticated -> redirect to login immediately with zero delay
  return <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // 1. Instant Redirect: If already authenticated, redirect to role dashboard or last route immediately
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

  // 2. Token-resolving edge case
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-sans transition-opacity">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  // 3. Unauthenticated visitor -> render landing/login page instantly
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
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
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
