import React from 'react';
import { DynamicQRDisplay } from '../../components/DynamicQRDisplay';
import { DailyQRDisplay } from '../../components/DailyQRDisplay';

export const AdminQRPage: React.FC = () => {
  return (
    <div className="space-y-10 font-sans pb-12">
      {/* Page Heading */}
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Attendance QR Management
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Choose between real-time in-library Live QR (auto-rotating) or offline Daily QR (downloadable & shareable).
        </p>
      </div>

      {/* SECTION 1: LIVE QR (100% untouched existing implementation) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Option 1: Live Library QR (On-Premise Screen)
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Display this dynamic rotating QR on a monitor, tablet, or TV screen at the library gate.
        </p>
        <div className="py-2">
          <DynamicQRDisplay initialType="ENTRY" />
        </div>
      </div>

      {/* Section Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
          <span className="bg-slate-50 dark:bg-slate-900 px-4 text-slate-400">
            OR
          </span>
        </div>
      </div>

      {/* SECTION 2: DAILY QR (New feature for days when Admin is absent) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Option 2: Daily Attendance QR (Remote / Absent Admin)
          </h3>
        </div>
        <DailyQRDisplay />
      </div>
    </div>
  );
};

