import React, { useEffect } from 'react';
import { LogOut, X } from 'lucide-react';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
}

export const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  isLoggingOut = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoggingOut) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isLoggingOut]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!isLoggingOut) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all z-10 p-6 text-center">
        {/* Close Icon in Top Corner */}
        <button
          onClick={onClose}
          disabled={isLoggingOut}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-100 dark:border-rose-900/50 shadow-sm">
          <LogOut className="w-6 h-6" />
        </div>

        {/* Heading */}
        <h3
          id="logout-modal-title"
          className="text-base font-extrabold text-slate-900 dark:text-white"
        >
          Leave Your Dashboard?
        </h3>

        {/* Message */}
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
          You are currently logged in.
          <br />
          To return to the public website, you need to logout first.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoggingOut}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-98 transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md active:scale-98 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
};
