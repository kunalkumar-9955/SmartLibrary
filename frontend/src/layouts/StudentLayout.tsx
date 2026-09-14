import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogoutConfirmationModal } from '../components/LogoutConfirmationModal';
import { useAuthBoundaryBackGuard } from '../hooks/useAuthBoundaryBackGuard';
import { notificationService } from '../services/api';
import { syncPushSubscription } from '../utils/notificationManager';
import {
  Home,
  QrCode,
  CalendarCheck,
  LifeBuoy,
  User as UserIcon,
  LogOut,
  Bell,
} from 'lucide-react';

export const StudentLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const {
    showLogoutConfirm,
    isLoggingOut,
    handleCancelLogout,
    handleConfirmLogout,
    triggerLogoutConfirm,
  } = useAuthBoundaryBackGuard();

  // Sync push subscription if permission is already granted and fetch unread count
  useEffect(() => {
    syncPushSubscription();

    const fetchUnread = async () => {
      try {
        const res = await notificationService.getMyNotifications();
        if (res.data?.success) {
          setUnreadCount(res.data.data.unreadCount || 0);
        }
      } catch {
        // quiet fallback
      }
    };

    fetchUnread();
  }, [location.pathname]);

  const navItems = [
    { label: 'Home', path: '/student/dashboard', icon: Home },
    { label: 'Attendance', path: '/student/attendance', icon: CalendarCheck },
    { label: 'Scan QR', path: '/student/scan', icon: QrCode, isAction: true },
    { label: 'Complaints', path: '/student/tickets', icon: LifeBuoy },
    { label: 'Profile', path: '/student/profile', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-20 md:pb-0 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/student/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white p-0.5 flex items-center justify-center text-white font-black text-xs shadow-md border border-slate-200 dark:border-slate-700 shrink-0">
              <img src="/Logo.png" alt="Lakshya Smart Library" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight tracking-tight">
                LAKSHYA SMART LIBRARY
              </p>
              <p className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">Student Portal</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Bell with unread badge */}
            <Link
              to="/student/notifications"
              className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Profile Link */}
            <Link
              to="/student/profile"
              className="flex items-center gap-2 p-1.5 pr-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                {user?.name ? user.name.charAt(0) : 'S'}
              </div>
              <span className="text-xs font-semibold hidden sm:inline text-slate-800 dark:text-slate-200">
                {user?.name}
              </span>
            </Link>

            {/* Logout */}
            <button
              onClick={triggerLogoutConfirm}
              className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-around md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          if (item.isAction) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative -top-5 flex flex-col items-center group"
              >
                <div className="w-12 h-12 p-3 rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 group-hover:scale-105 transition-all flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  Scan QR
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs transition ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Confirmation Modal for Back-button & Manual Logout */}
      <LogoutConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={handleCancelLogout}
        onLogout={handleConfirmLogout}
        isLoggingOut={isLoggingOut}
      />
    </div>
  );
};
