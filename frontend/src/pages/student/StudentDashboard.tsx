import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceService, noticeService, ticketService, notificationService } from '../../services/api';
import { Notice, Ticket, Attendance, NotificationItem } from '../../types';
import { Badge } from '../../components/Badge';
import {
  QrCode,
  LifeBuoy,
  CalendarCheck,
  User as UserIcon,
  BellRing,
  Clock,
  Armchair,
  ArrowRight,
  ChevronRight,
  Bell,
  X,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [latestUnreadNotice, setLatestUnreadNotice] = useState<NotificationItem | null>(null);
  const [showUnreadToast, setShowUnreadToast] = useState<boolean>(false);

  const isInside = user?.isCurrentlyInside;
  const currentSeat = user?.currentSeatNumber;

  const loadData = async () => {
    try {
      setLoading(true);
      await refreshUser();
      const [noticesRes, attRes, ticketsRes, notifRes] = await Promise.all([
        noticeService.getNotices(),
        attendanceService.getMyHistory({ limit: 5 }),
        ticketService.getTickets({ limit: 3 }),
        notificationService.getMyNotifications().catch(() => ({ data: { success: false, data: { notifications: [], unreadCount: 0 } } })),
      ]);

      if (noticesRes.data.success) setNotices(noticesRes.data.data || []);
      if (attRes.data.success) setRecentAttendance(attRes.data.data.records || []);
      if (ticketsRes.data.success) setRecentTickets(ticketsRes.data.data.tickets || []);

      if (notifRes.data?.success) {
        const notifList: NotificationItem[] = notifRes.data.data?.notifications || [];
        const count = notifRes.data.data?.unreadCount || 0;
        setUnreadCount(count);

        const unreadItems = notifList.filter((n) => !n.isRead);
        if (unreadItems.length > 0) {
          setLatestUnreadNotice(unreadItems[0]);
          setShowUnreadToast(true);
        }
      }
    } catch (err: any) {
      console.error('Error loading student dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 5-second auto-dismiss for unread notification popup toast
  useEffect(() => {
    if (showUnreadToast) {
      const timer = setTimeout(() => {
        setShowUnreadToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showUnreadToast]);

  // Calculate elapsed duration if currently inside
  let durationStr = '--';
  let entryTimeFormatted = '--';
  if (isInside && user?.lastEntryTime) {
    const entryMs = new Date(user.lastEntryTime).getTime();
    const elapsedMinutes = Math.max(1, Math.floor((Date.now() - entryMs) / 60000));
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    durationStr = `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;
    entryTimeFormatted = new Date(user.lastEntryTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6 font-sans max-w-lg mx-auto">
      {/* 5-Second Toast Popup for Unread Notification */}
      {showUnreadToast && latestUnreadNotice && (
        <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-2xl shadow-xl border border-indigo-500/30 flex items-start gap-3 transition-all">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                🔔 New Notification
              </span>
              <button
                onClick={() => setShowUnreadToast(false)}
                className="text-slate-400 hover:text-white p-1"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h4 className="text-xs font-bold text-white mt-1">
              {latestUnreadNotice.title}
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {latestUnreadNotice.message || latestUnreadNotice.description}
            </p>
            <div className="mt-2.5 flex items-center justify-between">
              <Link
                to="/student/notifications"
                onClick={() => setShowUnreadToast(false)}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
              >
                Open Notification Center <ArrowRight className="w-3 h-3" />
              </Link>
              <span className="text-[10px] text-slate-500">Auto-closing in 5s</span>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Student Dashboard
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Welcome, {user?.name?.split(' ')[0] || 'Student'}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              ID: {user?.studentIdNumber || 'ST001'} {user?.course && `• ${user.course}`}
            </p>
          </div>

          <div
            className={`w-3 h-3 rounded-full ${
              isInside ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
        </div>

        {/* Current Status Box */}
        <div
          className={`mt-5 p-4 rounded-2xl border transition ${
            isInside
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Current Status
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${
                isInside
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {isInside ? 'INSIDE LIBRARY' : 'OUTSIDE LIBRARY'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Current Seat</span>
              <span className="text-base font-black text-slate-900 dark:text-white">
                {isInside && currentSeat ? currentSeat : '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Entry</span>
              <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                {entryTimeFormatted}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Duration</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {durationStr}
              </span>
            </div>
          </div>
        </div>

        {/* Main Buttons: [SCAN ENTRY] [SCAN EXIT] */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <Link
            to="/student/scan?type=ENTRY"
            className="py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            SCAN ENTRY
          </Link>

          <Link
            to="/student/scan?type=EXIT"
            className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            SCAN EXIT
          </Link>
        </div>
      </div>

      {/* Active Notices Section */}
      {notices.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/25 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
              <BellRing className="w-4 h-4 text-amber-600" />
              Notice: {notices[0].title}
            </div>
            <Link
              to="/student/notifications"
              className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
            >
              View All
            </Link>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
            {notices[0].description}
          </p>
        </div>
      )}

      {/* Quick Links Menu: My Attendance, My Complaints, Notifications, Profile */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 text-xs">
        <Link
          to="/student/attendance"
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">My Attendance</p>
              <p className="text-[10px] text-slate-400">View visit history and time logs</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>

        <Link
          to="/student/notifications"
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900 dark:text-white">Notifications</p>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-500 text-white shadow-sm shadow-rose-500/30">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">Library notices & announcements history</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>

        <Link
          to="/student/tickets"
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
              <LifeBuoy className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">My Complaints</p>
              <p className="text-[10px] text-slate-400">Raise maintenance or Wi-Fi ticket</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>

        <Link
          to="/student/profile"
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Profile</p>
              <p className="text-[10px] text-slate-400">Contact info & student details</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>
      </div>

      {/* Recent Attendance Glance */}
      {recentAttendance.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">Recent Attendance Logs</h4>
            <Link to="/student/attendance" className="text-[11px] text-indigo-600 font-bold hover:underline">
              Full History
            </Link>
          </div>

          <div className="space-y-2">
            {recentAttendance.slice(0, 3).map((att) => (
              <div
                key={att._id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold block">
                    {att.attendanceDate}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Seat {att.seatNumber || 'N/A'}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-slate-600 dark:text-slate-300 block text-[11px]">
                    {new Date(att.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">
                    {att.durationMinutes ? `${att.durationMinutes}m` : 'In Progress'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
