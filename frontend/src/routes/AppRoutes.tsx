import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-300">Checking your session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-300">Checking your session...</p>
      </div>
    );
  }

  if (isAuthenticated && user) {
    if (user.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/student/dashboard" replace />;
  }

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
