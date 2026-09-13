import React, { useState, useEffect } from 'react';
import { attendanceService } from '../../services/api';
import { Attendance } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { FileSpreadsheet, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export const AdminAttendancePage: React.FC = () => {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Custom date range for export modal
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  const { success, error } = useToast();

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await attendanceService.getAllAttendance({
        search,
        date: dateFilter,
        page,
        limit: 15,
      });
      if (res.data.success) {
        setRecords(res.data.data.records || []);
        setTotalPages(res.data.data.pagination?.pages || 1);
        setTotalCount(res.data.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [search, dateFilter, page]);

  const handleExportToday = async () => {
    try {
      setExporting(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await attendanceService.exportAttendanceExcel({ date: todayStr });
      
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Library_Attendance_${todayStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success("Today's Attendance Excel report exported successfully!");
    } catch (err) {
      error('Failed to export Excel report.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCustomRange = async () => {
    if (!startDate || !endDate) {
      error('Please select both start date and end date.');
      return;
    }

    try {
      setExporting(true);
      const res = await attendanceService.exportAttendanceExcel({ startDate, endDate });
      
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Library_Attendance_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
      success('Attendance Excel report downloaded successfully!');
    } catch (err) {
      error('Failed to export Excel report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Attendance History
          </h2>
          <p className="text-xs text-slate-500">
            Database records of all student entry and exit logs ({totalCount} total entries).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportToday}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'Generating...' : "Export Today's Excel"}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
          >
            Custom Range Export
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by student name, ID, or seat number..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
          {dateFilter && (
            <button
              onClick={() => {
                setDateFilter('');
                setPage(1);
              }}
              className="text-xs text-rose-500 font-bold hover:underline px-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table with Required Columns: Date, Student ID, Student Name, Seat, Entry, Exit, Duration */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading attendance logs...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No attendance records found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Student ID</th>
                  <th className="px-5 py-3.5">Student Name</th>
                  <th className="px-5 py-3.5 text-center">Seat</th>
                  <th className="px-5 py-3.5">Entry Time</th>
                  <th className="px-5 py-3.5">Exit Time</th>
                  <th className="px-5 py-3.5">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {records.map((att: any) => {
                  const student = att.studentId;
                  const entryTimeStr = new Date(att.entryTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const exitTimeStr = att.exitTime ? (
                    new Date(att.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  ) : (
                    <span className="text-emerald-500 font-bold">Currently Inside</span>
                  );

                  const durationStr = att.durationMinutes
                    ? `${Math.floor(att.durationMinutes / 60)}h ${att.durationMinutes % 60}m`
                    : '--';

                  return (
                    <tr key={att._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-300">
                        {att.attendanceDate || new Date(att.entryTime).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-700 dark:text-slate-200">
                        {student?.studentIdNumber || att.studentIdNumber || 'ST001'}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                        {student?.name || att.studentName}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg border border-indigo-200 dark:border-indigo-800">
                          {att.seatNumber ? `Seat ${att.seatNumber}` : 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-700 dark:text-slate-200">
                        {entryTimeStr}
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-700 dark:text-slate-200">
                        {exitTimeStr}
                      </td>
                      <td className="px-5 py-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {durationStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
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

      {/* Custom Range Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Export Attendance to Excel (.xlsx)
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Download formatted Excel workbook containing columns: Date, Student ID, Student Name, Mobile, Seat, Entry Time, Exit Time, and Duration.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={handleExportCustomRange}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Download .xlsx'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
