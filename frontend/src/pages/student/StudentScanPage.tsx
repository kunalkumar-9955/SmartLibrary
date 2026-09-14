import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { StudentQRScanner } from '../../components/StudentQRScanner';
import { attendanceService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { QRPayload } from '../../types';
import { CheckCircle2, ArrowLeft, Armchair, Clock, Calendar, User as UserIcon, ArrowRight } from 'lucide-react';

export const StudentScanPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as 'ENTRY' | 'EXIT') || 'ENTRY';
  const [activeType] = useState<'ENTRY' | 'EXIT'>(initialType);

  const [isLoading, setIsLoading] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [scannerKey, setScannerKey] = useState<number>(0);

  const { user, refreshUser } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  // Automatic countdown & redirection once attendance is confirmed
  useEffect(() => {
    if (!successResult) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/student/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [successResult, navigate]);

  const handleScanSuccess = async (payload: QRPayload) => {
    setIsLoading(true);
    setScanError(null);
    try {
      if (payload.qrType === 'ENTRY') {
        const res = await attendanceService.markEntry(payload);
        if (res.data.success) {
          setSuccessResult({
            type: 'ENTRY',
            data: res.data.data,
          });
          success('Entry Attendance Marked Successfully!');
          await refreshUser();
        }
      } else {
        const res = await attendanceService.markExit(payload);
        if (res.data.success) {
          setSuccessResult({
            type: 'EXIT',
            data: res.data.data,
          });
          success('Exit Attendance Marked Successfully!');
          await refreshUser();
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Attendance verification failed. Please try again.';
      setScanError(msg);
      error(msg);
      // Reset scanner so student can immediately scan again if needed
      setScannerKey((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-4 font-sans">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/student/dashboard')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Cancel
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Smart Library QR Gate
        </span>
      </div>

      {!successResult ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
            Scan Attendance QR
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Point your camera at the Admin's screen to mark attendance.
          </p>

          {scanError && (
            <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-semibold text-left">
              {scanError}
            </div>
          )}

          <StudentQRScanner
            key={scannerKey}
            expectedType={activeType}
            onScanSuccess={handleScanSuccess}
            isLoading={isLoading}
          />
        </div>
      ) : (
        /* Confirmation Screen with Live Countdown & Auto-Redirect */
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-emerald-200 dark:border-emerald-800/60 shadow-2xl text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
            {successResult.type === 'ENTRY'
              ? 'Entry Attendance Marked Successfully!'
              : 'Exit Attendance Marked Successfully!'}
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Verified by Smart Library attendance engine
          </p>

          {successResult.type === 'ENTRY' ? (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 text-left space-y-3 mb-6">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" /> Student Name
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {successResult.data.studentName || user?.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Date
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {successResult.data.date}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Entry Time
                </span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {new Date(successResult.data.entryTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Armchair className="w-3.5 h-3.5 text-indigo-500" /> Assigned Seat
                </span>
                <span className="font-black text-base text-indigo-600 dark:text-indigo-400">
                  Seat {successResult.data.seatNumber}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 text-left space-y-3 mb-6">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Entry Time
                </span>
                <span className="font-medium text-slate-900 dark:text-white font-mono">
                  {new Date(successResult.data.entryTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Exit Time
                </span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {new Date(successResult.data.exitTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">Total Duration</span>
                <span className="font-black text-base text-emerald-600 dark:text-emerald-400 font-mono">
                  {successResult.data.durationString}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 text-center pt-1">
                Seat {successResult.data.seatNumber || ''} has been released to AVAILABLE.
              </p>
            </div>
          )}

          {/* Auto-redirect status indicator */}
          <div className="mb-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5">
            <span>Redirecting to Dashboard in {countdown}s...</span>
          </div>

          <button
            onClick={() => navigate('/student/dashboard')}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Go to Dashboard Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
