import React, { useState, useEffect } from 'react';
import { attendanceService } from '../../services/api';
import { Attendance } from '../../types';
import { Badge } from '../../components/Badge';
import { Calendar, Clock, Armchair, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatISTTime, formatISTDateDisplay } from '../../utils/timeHelper';

export const StudentAttendancePage: React.FC = () => {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await attendanceService.getMyHistory({ filter, page, limit: 10 });
      if (res.data.success) {
        setRecords(res.data.data.records || []);
        setTotalPages(res.data.data.pagination?.pages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [filter, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            My Attendance History
          </h2>
          <p className="text-xs text-slate-500">
            Chronological record of study sessions, check-ins, check-outs, and durations.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
          {['all', 'today', 'week', 'month'].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider text-[10px] transition ${
                filter === f
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f === 'all' ? 'All Time' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Attendance Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading attendance records...</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No attendance entries recorded for this timeframe.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((att) => {
              const entryDate = new Date(att.entryTime);
              const exitDate = att.exitTime ? new Date(att.exitTime) : null;
              const durationHours = att.durationMinutes ? (att.durationMinutes / 60).toFixed(1) : null;

              return (
                <div
                  key={att._id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60 font-bold">
                      <span className="text-xs">{entryDate.getDate()}</span>
                      <span className="text-[9px] uppercase tracking-tighter">
                        {entryDate.toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {formatISTDateDisplay(att.entryTime, true)}
                        </span>
                        <Badge
                          variant={att.status === 'COMPLETED' ? 'success' : 'info'}
                          size="sm"
                        >
                          {att.status}
                        </Badge>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-500" />
                          Entry: {formatISTTime(att.entryTime)}
                        </span>
                        {att.exitTime ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-rose-500" />
                            Exit: {formatISTTime(att.exitTime)}
                          </span>
                        ) : (
                          <span className="text-indigo-600 font-semibold animate-pulse">
                            Currently In Session
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Armchair className="w-3.5 h-3.5 text-indigo-500" />
                          Seat: {att.seatNumber || 'General'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-slate-900 dark:text-white block">
                      {att.durationMinutes ? `${att.durationMinutes} mins` : '--'}
                    </span>
                    {durationHours && (
                      <span className="text-[10px] text-slate-400">~{durationHours} hours</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
