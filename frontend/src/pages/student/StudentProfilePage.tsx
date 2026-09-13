import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/Badge';
import { User, Phone, Mail, GraduationCap, Armchair } from 'lucide-react';

export const StudentProfilePage: React.FC = () => {
  const { user } = useAuth();

  return (
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
            <span className="font-bold text-slate-900 dark:text-white font-mono">{user?.phone || '9876543210'}</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <GraduationCap className="w-4 h-4" /> Course / Program
            </span>
            <span className="font-bold text-slate-900 dark:text-white">{user?.course || 'B.Tech'}</span>
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
    </div>
  );
};
