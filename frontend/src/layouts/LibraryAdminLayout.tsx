import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogoutConfirmationModal } from '../components/LogoutConfirmationModal';
import { useAuthBoundaryBackGuard } from '../hooks/useAuthBoundaryBackGuard';
import { syncPushSubscription } from '../utils/notificationManager';
import { adminNotificationService } from '../services/api';
import {
  LayoutDashboard,
  Users,
  QrCode,
  Radio,
  Armchair,
  CalendarCheck,
  Ticket,
  BellRing,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export const LibraryAdminLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadComplaints, setUnreadComplaints] = useState<number>(0);
  const {
    showLogoutConfirm,
    isLoggingOut,
    handleCancelLogout,
    handleConfirmLogout,
    triggerLogoutConfirm,
  } = useAuthBoundaryBackGuard();

  useEffect(() => {
    syncPushSubscription();
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await adminNotificationService.getUnreadCount();
        if (res.data.success) {
          setUnreadComplaints(res.data.data.unreadCount || 0);
        }
      } catch (err) {
        // Silently ignore polling errors
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 20000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  // Exact 10 navigation items from requirements
  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Students', path: '/admin/students', icon: Users },
    { label: 'Attendance QR', path: '/admin/qr', icon: QrCode },
    { label: 'Live Attendance', path: '/admin/occupancy', icon: Radio },
    { label: 'Seats', path: '/admin/seats', icon: Armchair },
    { label: 'Attendance History', path: '/admin/attendance', icon: CalendarCheck },
    { label: 'Complaints', path: '/admin/tickets', icon: Ticket },
    { label: 'Notices', path: '/admin/notices', icon: BellRing },
    { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 p-4 shrink-0">
        <div className="px-3 py-4 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center text-white font-black text-sm shadow shrink-0">
              <img src="/Logo.png" alt="Lakshya Smart Library" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-white text-sm truncate leading-tight tracking-tight">
                LAKSHYA SMART LIBRARY
              </h1>
              <span className="text-[10px] font-semibold text-[#d62976] block mt-0.5">
                Admin Panel • 50 Seats
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isComplaints = item.path === '/admin/tickets';
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {isComplaints && unreadComplaints > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full animate-pulse shadow-sm">
                    {unreadComplaints}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="pt-3 mt-2 border-t border-slate-800">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/50 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-700 text-white font-bold flex items-center justify-center text-xs">
              {user?.name ? user.name.charAt(0) : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name || 'Administrator'}</p>
              <p className="text-[10px] text-slate-400">Personal Library Admin</p>
            </div>
          </div>
          <button
            onClick={triggerLogoutConfirm}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center shadow shrink-0">
              <img src="/Logo.png" alt="Lakshya Smart Library" className="w-full h-full object-contain rounded-md" />
            </div>
            <div className="text-xs">
              <p className="font-extrabold text-sm tracking-tight text-white">LAKSHYA SMART LIBRARY</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-300 hover:text-white"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isComplaints = item.path === '/admin/tickets';
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {isComplaints && unreadComplaints > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full">
                      {unreadComplaints}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileOpen(false);
                triggerLogoutConfirm();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}

        {/* Dynamic Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          <Outlet />
        </main>
      </div>

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
