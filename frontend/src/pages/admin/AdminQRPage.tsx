import React from 'react';
import { DynamicQRDisplay } from '../../components/DynamicQRDisplay';

export const AdminQRPage: React.FC = () => {
  return (
    <div className="space-y-6 font-sans">
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Attendance QR
        </h2>
        <p className="text-xs text-slate-500">
          Display this dynamic QR on a desktop monitor, laptop, tablet, or TV screen at the library entrance.
        </p>
      </div>

      <div className="py-2">
        <DynamicQRDisplay initialType="ENTRY" />
      </div>
    </div>
  );
};
