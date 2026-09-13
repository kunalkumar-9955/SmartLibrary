import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Badge } from '../../components/Badge';
import { authService } from '../../services/api';
import {
  User,
  Phone,
  Mail,
  GraduationCap,
  Armchair,
  Shield,
  Lock,
  Eye,
  EyeOff,
  X,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Change Password Modal
// ---------------------------------------------------------------------------
interface ChangePasswordModalProps {
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const { success, error } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Field-level errors
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!currentPassword.trim()) {
      newErrors.currentPassword = 'Current password is required.';
    }
    if (!newPassword) {
      newErrors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password.';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      await authService.changePassword({
        currentPassword: currentPassword.trim(),
        newPassword,
      });
      setDone(true);
      success('Password updated successfully!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update password.';
      if (msg.toLowerCase().includes('incorrect') || err.response?.data?.code === 'WRONG_PASSWORD') {
        setErrors({ currentPassword: 'Current password is incorrect.' });
      } else {
        error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Overlay close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <KeyRound className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Change Password
              </h3>
              <p className="text-xs text-slate-500">Update your account password</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {done ? (
          <div className="px-6 py-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-base font-black text-slate-900 dark:text-white">
                Password Changed!
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Your password has been updated successfully. Use your new password next time you log in.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition shadow-md shadow-indigo-600/20"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (errors.currentPassword) setErrors((p) => ({ ...p, currentPassword: undefined }));
                  }}
                  placeholder="Enter current password"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                    errors.currentPassword
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: undefined }));
                  }}
                  placeholder="At least 8 characters"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                    errors.newPassword
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined }));
                  }}
                  placeholder="Re-enter new password"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                    errors.confirmPassword
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Student Profile Page
// ---------------------------------------------------------------------------
export const StudentProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="max-w-lg mx-auto space-y-6 font-sans">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Student Profile
          </h2>
          <p className="text-xs text-slate-500">
            Your registered student information in the Smart Library database.
          </p>
        </div>

        {/* Profile Overview Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 text-xs">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-indigo-600/30">
              {user?.name ? user.name.charAt(0) : 'S'}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{user?.name}</h3>
              <p className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                ID: {user?.studentIdNumber || 'ST001'}
              </p>
              <div className="mt-1">
                <Badge variant={user?.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                  {user?.status || 'ACTIVE'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
            <div className="py-3 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Mail className="w-4 h-4" /> Email Address
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{user?.email}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Phone className="w-4 h-4" /> Mobile Number
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {user?.phone || '—'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <GraduationCap className="w-4 h-4" /> Course / Program
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {user?.course || '—'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Armchair className="w-4 h-4" /> Currently Seated
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {user?.isCurrentlyInside && user?.currentSeatNumber
                  ? `Seat ${user.currentSeatNumber}`
                  : 'Not Seated (Outside)'}
              </span>
            </div>
          </div>
        </div>

        {/* Security Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Security
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Change your account password to keep your account secure.
          </p>
          <button
            id="change-password-btn"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition-all"
          >
            <Lock className="w-4 h-4" />
            Change Password
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showModal && <ChangePasswordModal onClose={() => setShowModal(false)} />}
    </>
  );
};
