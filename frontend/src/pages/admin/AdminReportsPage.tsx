import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/api';
import {
  Calendar,
  Clock,
  LifeBuoy,
  Armchair,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const AdminReportsPage: React.FC = () => {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await reportService.getAnalytics(days);
      if (res.data.success) {
        setReport(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [days]);

  const attendanceTrend = report?.attendanceTrend || [];
  const categoryData = report?.categoryData || [];
  const seatSummary = report?.seatSummary || { available: 50, occupied: 0, maintenance: 0 };
  const summary = report?.summary || {};
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Library Attendance & Usage Reports
          </h2>
          <p className="text-xs text-slate-500">
            Attendance trends, average study duration, complaints breakdown, and seat usage.
          </p>
        </div>

        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold self-start sm:self-auto"
        >
          <option value={7}>Last 7 Days</option>
          <option value={14}>Last 14 Days</option>
          <option value={30}>Last 30 Days</option>
        </select>
      </div>

      {/* KPI Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-500 mb-1">
            <Calendar className="w-4 h-4" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Entries</p>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {summary.totalEntries || 0}
          </p>
          <span className="text-[10px] text-slate-500">During chosen {days} days</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <Clock className="w-4 h-4" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Visit Duration</p>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summary.avgDurationHours || '0.0'} Hours
          </p>
          <span className="text-[10px] text-slate-500">Per student session</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-rose-500 mb-1">
            <LifeBuoy className="w-4 h-4" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Complaints</p>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {summary.totalComplaints || 0}
          </p>
          <span className="text-[10px] text-slate-500">Total reported tickets</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-purple-500 mb-1">
            <Armchair className="w-4 h-4" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Seat Capacity</p>
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
            50 Seats
          </p>
          <span className="text-[10px] text-slate-500">
            {seatSummary.occupied} Occupied &bull; {seatSummary.available} Available
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-4">
            Daily Attendance Volume
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.3} name="Student Entries" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Complaints Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-4">
            Complaints by Category
          </h3>
          <div className="h-64 flex items-center justify-center">
            {categoryData.length === 0 ? (
              <p className="text-xs text-slate-400">No complaints reported.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {categoryData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
