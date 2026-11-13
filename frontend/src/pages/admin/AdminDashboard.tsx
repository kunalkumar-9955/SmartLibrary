import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminService, attendanceService, reportService, adminNotificationService, maintenanceService } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';
import {
  Users,
  Radio,
  Armchair,
  LifeBuoy,
  CalendarCheck,
  QrCode,
  LogOut,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  UserX,
  FileText,
} from 'lucide-react';
import { formatISTTime } from '../../utils/timeHelper';

export const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [unreadComplaints, setUnreadComplaints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Fresh Start Modal state
  const [isFreshStartOpen, setIsFreshStartOpen] = useState(false);
  const [isRunningFreshStart, setIsRunningFreshStart] = useState(false);
  const [freshStartResult, setFreshStartResult] = useState<any>(null);

  const { success, error } = useToast();

  const loadDashboard = async () => {
    try {
      const [dashRes, statsRes, notifRes] = await Promise.all([
        adminService.getDashboard(),
        reportService.getStats(),
        adminNotificationService.getUnreadCount().catch(() => ({ data: { data: { unreadCount: 0 } } })),
      ]);

      if (dashRes.data.success) setDashboardData(dashRes.data.data);
      if (statsRes.data.success) setStatsData(statsRes.data.data);
      if (notifRes?.data?.data?.unreadCount !== undefined) {
        setUnreadComplaints(notifRes.data.data.unreadCount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // Real-time polling every 10s so entries/exits reflect immediately
    const interval = setInterval(loadDashboard, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleForceCheckout = async (attendanceId: string, studentName: string) => {
    try {
      const res = await attendanceService.forceCheckout(attendanceId);
      if (res.data.success) {
        success(`Checked out ${studentName} successfully`);
        loadDashboard();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to check out student');
    }
  };

  const handleExecuteFreshStart = async () => {
    try {
      setIsRunningFreshStart(true);
      const res = await maintenanceService.runFreshStart();
      if (res.data.success) {
        setFreshStartResult(res.data.data);
        success('Safe Fresh Start completed! Demo data cleaned & snapshot created.');
        await loadDashboard();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to execute fresh start');
    } finally {
      setIsRunningFreshStart(false);
    }
  };

  const metrics = dashboardData?.metrics || statsData?.metrics || {};
  const liveOccupancy = dashboardData?.liveOccupancy || [];
  const recentTickets = dashboardData?.recentTickets || statsData?.recentTickets || [];
  const recentAttendance = statsData?.recentAttendance || [];

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              LAKSHYA SMART LIBRARY DASHBOARD
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personal 50-seat library live occupancy, attendance stream & service tickets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFreshStartResult(null);
              setIsFreshStartOpen(true);
            }}
            className="px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            Safe Fresh Start
          </button>
          <Link
            to="/admin/qr"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Open Attendance QR
          </Link>
        </div>
      </div>

      {/* New Unread Complaints Alert Banner */}
      {unreadComplaints > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-700 dark:text-rose-300 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {unreadComplaints} New Complaint{unreadComplaints > 1 ? 's' : ''} Awaiting Attention
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Students have submitted maintenance or library issue tickets.
              </p>
            </div>
          </div>
          <Link
            to="/admin/tickets"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5 shrink-0"
          >
            Review Complaints <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Main 6 Cards from prompt */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          title="Total Students"
          value={metrics.totalStudents ?? '--'}
          icon={Users}
          color="indigo"
          subtitle="Enrolled members"
        />
        <StatCard
          title="Today's Entries"
          value={metrics.todayAttendance ?? metrics.todayEntries ?? '--'}
          icon={CalendarCheck}
          color="blue"
          subtitle="Total visits today"
        />
        <StatCard
          title="Currently Inside"
          value={metrics.currentlyInside ?? '--'}
          icon={Radio}
          color="emerald"
          subtitle="Live seated"
        />
        <StatCard
          title="Available Seats"
          value={metrics.availableSeats ?? '--'}
          icon={Armchair}
          color="emerald"
          subtitle="Out of 50 seats"
        />
        <StatCard
          title="Occupied Seats"
          value={metrics.occupiedSeats ?? '--'}
          icon={Users}
          color="purple"
          subtitle="Active study sessions"
        />
        <StatCard
          title="Open Complaints"
          value={metrics.openTickets ?? '--'}
          icon={LifeBuoy}
          color="rose"
          subtitle={unreadComplaints > 0 ? `${unreadComplaints} new unread` : 'Pending action'}
        />
      </div>

      {/* Student & QR Lifecycle Management Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Active Students</p>
            <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-0.5">{metrics.activeStudents ?? '--'}</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Regular members</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inactive Students</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-200 mt-0.5">{metrics.inactiveStudents ?? '--'}</p>
            <p className="text-[10px] text-slate-400">Archived / Left</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-600 text-white flex items-center justify-center font-bold">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Active Attendance QRs</p>
            <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100 mt-0.5">{metrics.activeQrs ?? '--'}</p>
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400">Valid scan cards</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-800/60 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Revoked QR Codes</p>
            <p className="text-2xl font-black text-rose-900 dark:text-rose-100 mt-0.5">{metrics.revokedQrs ?? '--'}</p>
            <p className="text-[10px] text-rose-600 dark:text-rose-400">Permanently blocked</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* CURRENTLY INSIDE Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              CURRENTLY INSIDE ({metrics.currentlyInside ?? liveOccupancy.length})
            </h3>
            <p className="text-xs text-slate-500">Live list of students seated in the library</p>
          </div>
          <Link
            to="/admin/occupancy"
            className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
          >
            Live Attendance View <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {liveOccupancy.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Radio className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium">No students are currently inside the library.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Student</th>
                    <th className="px-4 py-3">Student ID</th>
                    <th className="px-4 py-3 text-center">Seat</th>
                    <th className="px-4 py-3">Entry Time</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {liveOccupancy.map((s: any) => {
                    const entryTimeFormatted = formatISTTime(s.entryTime);

                    return (
                      <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {s.studentName}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {s.studentIdNumber || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg border border-indigo-200 dark:border-indigo-800">
                            Seat {s.seatNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono">
                          {entryTimeFormatted}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">
                          {s.durationString}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleForceCheckout(s._id, s.studentName)}
                            title="Force check-out"
                            className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold transition border border-rose-200 dark:border-rose-900 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <LogOut className="w-3 h-3" />
                            Check-out
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {liveOccupancy.map((s: any) => {
                const entryTimeFormatted = formatISTTime(s.entryTime);

                return (
                  <div key={s._id} className="py-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-white">{s.studentName}</p>
                        <p className="font-mono text-[11px] text-slate-500">{s.studentIdNumber || 'N/A'}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-lg border border-indigo-200 dark:border-indigo-800">
                        Seat {s.seatNumber}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Entry</span>
                        <span className="font-mono text-slate-700 dark:text-slate-200">{entryTimeFormatted}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Duration</span>
                        <span className="font-mono font-bold text-emerald-600">{s.durationString}</span>
                      </div>
                      <button
                        onClick={() => handleForceCheckout(s._id, s.studentName)}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold transition border border-rose-200 dark:border-rose-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" /> Check-out
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Two Columns: Recent Complaints & Recent Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Complaints */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-rose-500" />
              Recent Complaints ({recentTickets.length})
            </h3>
            <Link to="/admin/tickets" className="text-xs text-indigo-600 font-bold hover:underline">
              View All
            </Link>
          </div>

          {recentTickets.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No complaints registered.</p>
          ) : (
            <div className="space-y-2.5">
              {recentTickets.slice(0, 5).map((t: any) => (
                <div
                  key={t._id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-slate-400">#{t.ticketNumber}</span>
                      <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-semibold">
                        {t.category}
                      </span>
                      {t.seatNumber && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Seat {t.seatNumber}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white truncate">{t.title}</p>
                  </div>
                  <Badge
                    variant={
                      t.status === 'OPEN'
                        ? 'danger'
                        : t.status === 'IN_PROGRESS'
                        ? 'warning'
                        : 'success'
                    }
                    size="sm"
                  >
                    {t.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Attendance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-indigo-500" />
              Recent Attendance
            </h3>
            <Link to="/admin/attendance" className="text-xs text-indigo-600 font-bold hover:underline">
              Attendance History
            </Link>
          </div>

          {recentAttendance.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No recent attendance records.</p>
          ) : (
            <div className="space-y-2.5">
              {recentAttendance.slice(0, 5).map((att: any) => {
                const entryStr = formatISTTime(att.entryTime);
                const exitStr = att.exitTime
                  ? formatISTTime(att.exitTime)
                  : 'Active';

                return (
                  <div
                    key={att._id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {att.studentName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Seat {att.seatNumber || 'N/A'} • {att.attendanceDate}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300 block">
                        {entryStr} → {exitStr}
                      </span>
                      {att.durationMinutes && (
                        <span className="text-[10px] text-emerald-600 font-bold">
                          {Math.floor(att.durationMinutes / 60)}h {att.durationMinutes % 60}m
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Safe Fresh Start & Demo Cleanup Modal */}
      {isFreshStartOpen && (
        <Modal
          isOpen={isFreshStartOpen}
          onClose={() => setIsFreshStartOpen(false)}
          title="Safe Fresh Start & Demo Data Cleanup"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-sans">
            {freshStartResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black text-sm">Fresh Start Cleanup Completed Successfully!</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Demo data has been safely purged and a pre-cleanup snapshot was recorded.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Test Payments Purged</p>
                    <p className="text-xl font-black text-rose-600 mt-0.5">
                      {freshStartResult.purgedTestPaymentsCount}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Demo QR Tokens Revoked</p>
                    <p className="text-xl font-black text-amber-600 mt-0.5">
                      {freshStartResult.revokedDemoTokensCount}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Genuine Payments Preserved</p>
                    <p className="text-xl font-black text-emerald-600 mt-0.5">
                      {freshStartResult.preservedGenuinePaymentsCount}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Active Students Retained</p>
                    <p className="text-xl font-black text-indigo-600 mt-0.5">
                      {freshStartResult.activeStudentsRetainedCount}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-850 rounded-xl text-[11px] text-slate-600 dark:text-slate-400">
                  <p>
                    <span className="font-bold">Snapshot ID:</span>{' '}
                    <span className="font-mono">{freshStartResult.snapshotId}</span>
                  </p>
                  <p className="mt-1">
                    <span className="font-bold">Total Physical Seats:</span>{' '}
                    {freshStartResult.totalSeatsAvailable} (01 to 50)
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFreshStartOpen(false)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100">
                  <div className="flex items-center gap-2 mb-2 font-black text-sm">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Controlled, Non-Destructive Fresh Start
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    This maintenance operation prepares the library for a real-world launch by cleaning only demo data:
                  </p>
                  <ul className="list-disc pl-4 mt-2 space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
                    <li>Purges only dummy gateway test transactions and test payment records.</li>
                    <li>Revokes all existing demo/testing attendance QR tokens so old printed codes can never mark attendance again.</li>
                    <li>Resets QR activation state so you can generate and activate fresh QRs for students.</li>
                    <li>Takes a recoverable snapshot (<span className="font-mono font-bold">MaintenanceSnapshot</span>) before cleanup.</li>
                    <li>
                      <span className="font-bold">Strictly Preserved:</span> Real student accounts, genuine payments, attendance history, seat assignments, and gateway configuration.
                    </li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px]">
                  <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Audit Record:</p>
                  <p>
                    This action will be permanently recorded in the system audit logs under your administrator credentials.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFreshStartOpen(false)}
                    className="px-4 py-2 rounded-xl border font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteFreshStart}
                    disabled={isRunningFreshStart}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isRunningFreshStart ? 'Executing Cleanup...' : 'Confirm & Run Fresh Start'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
