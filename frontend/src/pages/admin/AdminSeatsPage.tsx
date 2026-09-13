import React, { useState, useEffect } from 'react';
import { seatService } from '../../services/api';
import { Seat, SeatStatus } from '../../types';
import { SeatGrid } from '../../components/SeatGrid';
import { Modal } from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';
import { Armchair, RefreshCw, AlertTriangle, CheckCircle2, User as UserIcon } from 'lucide-react';

export const AdminSeatsPage: React.FC = () => {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);

  // Status edit modal
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [newStatus, setNewStatus] = useState<SeatStatus>('AVAILABLE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToast();

  const fetchSeats = async () => {
    try {
      setLoading(true);
      const res = await seatService.getSeats();
      if (res.data.success) {
        setSeats(res.data.data.seats || res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeats();
  }, []);

  const handleSeatClick = (seat: Seat) => {
    setSelectedSeat(seat);
    setNewStatus(seat.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE');
    setNotes(seat.notes || '');
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat) return;

    if (selectedSeat.status === 'OCCUPIED' && newStatus !== 'OCCUPIED') {
      error('Cannot manually change status of an occupied seat. Please check out the student first.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await seatService.updateStatus(selectedSeat._id, newStatus, notes);
      if (res.data.success) {
        success(`Seat ${selectedSeat.seatNumber} marked as ${newStatus}`);
        setSelectedSeat(null);
        fetchSeats();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update seat status');
    } finally {
      setSubmitting(false);
    }
  };

  const availableCount = seats.filter((s) => s.status === 'AVAILABLE').length;
  const occupiedCount = seats.filter((s) => s.status === 'OCCUPIED').length;
  const maintenanceCount = seats.filter((s) => s.status === 'MAINTENANCE').length;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Library Seats Management (50 Seats)
          </h2>
          <p className="text-xs text-slate-500">
            Real-time status of all 50 physical seats. View occupancy and toggle maintenance status.
          </p>
        </div>

        <button
          onClick={fetchSeats}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-semibold self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Seats
        </button>
      </div>

      {/* Summary Badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-emerald-900 dark:text-emerald-100">{availableCount}</p>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Available</p>
          </div>
        </div>

        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-rose-900 dark:text-rose-100">{occupiedCount}</p>
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase">Occupied</p>
          </div>
        </div>

        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-amber-900 dark:text-amber-100">{maintenanceCount}</p>
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase">Maintenance</p>
          </div>
        </div>
      </div>

      {/* Visual Seat Map */}
      <SeatGrid
        seats={seats}
        isAdminView={true}
        onToggleStatus={handleSeatClick}
      />

      {/* Seat Edit Modal */}
      {selectedSeat && (
        <Modal
          isOpen={!!selectedSeat}
          onClose={() => setSelectedSeat(null)}
          title={`Seat ${selectedSeat.seatNumber} Details & Status`}
          maxWidth="sm"
        >
          <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs font-sans">
            {selectedSeat.status === 'OCCUPIED' ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800">
                <p className="font-bold text-rose-800 dark:text-rose-200 text-sm mb-1">
                  Seat Currently Occupied
                </p>
                <p className="text-rose-700 dark:text-rose-300">
                  Occupant: <span className="font-bold">{selectedSeat.currentStudentName || 'Student'}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Seats in use cannot be put under maintenance until the student scans out or is checked out.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Set Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as SeatStatus)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value="AVAILABLE">AVAILABLE (Ready for students)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Temporarily out of service)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Maintenance Note (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g., Charging socket loose, chair cushion repair..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSeat(null)}
                className="px-4 py-2 rounded-xl border font-semibold text-slate-600 dark:text-slate-300"
              >
                Close
              </button>
              {selectedSeat.status !== 'OCCUPIED' && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Update Status'}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
