import React from 'react';
import { Seat, SeatStatus } from '../types';
import { User as UserIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SeatGridProps {
  seats: Seat[];
  selectedSeatId?: string;
  onSelectSeat?: (seat: Seat) => void;
  isAdminView?: boolean;
  onToggleStatus?: (seat: Seat) => void;
}

export const SeatGrid: React.FC<SeatGridProps> = ({
  seats,
  selectedSeatId,
  onSelectSeat,
  isAdminView = false,
  onToggleStatus,
}) => {
  // Sort seats numerically from 01 to 50
  const sortedSeats = [...seats].sort((a, b) => parseInt(a.seatNumber) - parseInt(b.seatNumber));

  const getStatusColor = (status: SeatStatus, isSelected: boolean) => {
    if (isSelected) return 'ring-2 ring-indigo-600 bg-indigo-50 border-indigo-500 text-indigo-900';

    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300';
      case 'OCCUPIED':
        return 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300';
      case 'MAINTENANCE':
        return 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getStatusIcon = (status: SeatStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'OCCUPIED':
        return <UserIcon className="w-3.5 h-3.5 text-rose-600" />;
      case 'MAINTENANCE':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Status Legend */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-500 uppercase tracking-wider">Seats (50 Total):</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-400" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">AVAILABLE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-400" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">OCCUPIED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-400" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">MAINTENANCE</span>
          </div>
        </div>

        {isAdminView && (
          <span className="text-[11px] text-slate-400">
            Click any Available or Maintenance seat to toggle status
          </span>
        )}
      </div>

      {/* 50 Seats Grid: Clean Responsive Grid */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {sortedSeats.map((seat) => {
            const isSelected = selectedSeatId === seat._id;
            const isClickable = isAdminView || seat.status === 'AVAILABLE';
            const occupantName = seat.currentStudentName || seat.currentStudentId?.name;

            return (
              <button
                key={seat._id}
                type="button"
                disabled={!isClickable && !isAdminView}
                onClick={() => {
                  if (isAdminView && onToggleStatus) {
                    onToggleStatus(seat);
                  } else if (onSelectSeat && seat.status === 'AVAILABLE') {
                    onSelectSeat(seat);
                  }
                }}
                className={`relative group p-3 rounded-xl border flex flex-col items-center justify-between transition-all duration-150 ${getStatusColor(
                  seat.status,
                  isSelected
                )} ${isClickable ? 'cursor-pointer hover:scale-105 shadow-sm' : 'cursor-default opacity-85'}`}
              >
                <div className="w-full flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono text-[9px] opacity-60">#</span>
                  {getStatusIcon(seat.status)}
                </div>

                <span className="my-1.5 text-base font-black tracking-tight">
                  {seat.seatNumber}
                </span>

                <span className="text-[9px] font-bold tracking-wider uppercase truncate w-full text-center">
                  {seat.status}
                </span>

                {occupantName && (
                  <div className="absolute inset-x-0 -bottom-9 hidden group-hover:block z-30 bg-slate-900 text-white text-[11px] py-1 px-2 rounded-lg shadow-xl whitespace-nowrap text-center">
                    {occupantName}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
