import React, { useState, useEffect } from 'react';
import { attendanceService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Search, LogOut, Armchair, RefreshCw } from 'lucide-react';
import { formatISTTime } from '../../utils/timeHelper';

export const AdminOccupancyPage: React.FC = () => {
  const [occupants, setOccupants] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  const fetchOccupancy = async () => {
    try {
      setLoading(true);
      const res = await attendanceService.getCurrentlyInside({ search });
      if (res.data.success) {
        setOccupants(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOccupancy();
    const interval = setInterval(fetchOccupancy, 10000);
    return () => clearInterval(interval);
  }, [search]);

  const handleCheckout = async (attendanceId: string, studentName: string) => {
    try {
      const res = await attendanceService.forceCheckout(attendanceId);
      if (res.data.success) {
        success(`Successfully checked out ${studentName}`);
        fetchOccupancy();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Check out failed');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            Live Attendance ({occupants.length} Currently Inside)
          </h2>
          <p className="text-xs text-slate-500">
            Real-time feed of all students currently occupying seats inside the library.
          </p>
        </div>

        <button
          onClick={fetchOccupancy}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search currently inside students by name, student ID, mobile, or seat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Occupants Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading && occupants.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading current occupants...</div>
        ) : occupants.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400">
            <Armchair className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            No students currently inside the library.
          </div>
        ) : (
          <>
            {/* Desktop Table (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Student</th>
                    <th className="px-6 py-3.5">Student ID</th>
                    <th className="px-6 py-3.5">Mobile</th>
                    <th className="px-6 py-3.5 text-center">Seat</th>
                    <th className="px-6 py-3.5">Entry Time</th>
                    <th className="px-6 py-3.5">Duration</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {occupants.map((o) => (
                    <tr key={o._id || o.attendanceId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        {o.studentName}
                      </td>

                      <td className="px-6 py-4 font-mono font-bold text-slate-600 dark:text-slate-300">
                        {o.studentIdNumber || 'N/A'}
                      </td>

                      <td className="px-6 py-4 font-mono text-slate-500">
                        {o.studentPhone || 'N/A'}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                          Seat {o.seatNumber}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-200">
                        {formatISTTime(o.entryTime)}
                      </td>

                      <td className="px-6 py-4 font-mono font-bold text-emerald-600">
                        {o.durationString || o.duration}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleCheckout(o._id || o.attendanceId, o.studentName)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Check Out
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards (visible on mobile only) */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {occupants.map((o) => (
                <div key={o._id || o.attendanceId} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{o.studentName}</p>
                      <p className="font-mono text-xs text-slate-500">{o.studentIdNumber || 'N/A'}</p>
                    </div>
                    <span className="font-black text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      Seat {o.seatNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Entry Time</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        {formatISTTime(o.entryTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Duration</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {o.durationString || o.duration}
                      </span>
                    </div>
                    {o.studentPhone && o.studentPhone !== 'N/A' && (
                      <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mobile</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300">{o.studentPhone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleCheckout(o._id || o.attendanceId, o.studentName)}
                      className="w-full py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Check Out
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
