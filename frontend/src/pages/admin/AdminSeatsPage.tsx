import React, { useState, useEffect } from 'react';
import { seatService, studentService } from '../../services/api';
import { Seat, SeatStatus, User } from '../../types';
import { SeatGrid } from '../../components/SeatGrid';
import { Modal } from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';
import {
  Armchair,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  User as UserIcon,
  UserPlus,
  UserMinus,
  Check,
  Search,
} from 'lucide-react';

export const AdminSeatsPage: React.FC = () => {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<User[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Seat detail / status modal
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [newStatus, setNewStatus] = useState<SeatStatus>('AVAILABLE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Direct Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignSeatNumber, setAssignSeatNumber] = useState('');
  const [assignSearch, setAssignSearch] = useState('');

  // Release confirmation modal
  const [seatToRelease, setSeatToRelease] = useState<Seat | null>(null);

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

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true);
      const res = await studentService.getStudents({ status: 'ACTIVE' });
      if (res.data.success) {
        setStudents(res.data.data.students || res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchSeats();
    fetchStudents();
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
        await fetchSeats();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update seat status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAssignModal = (seat?: Seat) => {
    if (seat) {
      setAssignSeatNumber(seat.seatNumber);
    } else {
      // Pick first unassigned seat
      const firstUnassigned = seats.find((s) => !s.assignedStudent && s.status !== 'MAINTENANCE');
      setAssignSeatNumber(firstUnassigned?.seatNumber || '01');
    }
    setAssignStudentId('');
    setAssignSearch('');
    setIsAssignModalOpen(true);
  };

  const handleAssignSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudentId || !assignSeatNumber) {
      error('Please select both a student and a seat number.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await seatService.assignSeat({
        studentId: assignStudentId,
        seatNumber: assignSeatNumber,
      });
      if (res.data.success) {
        success(`Seat ${assignSeatNumber} successfully assigned!`);
        setIsAssignModalOpen(false);
        setSelectedSeat(null);
        await Promise.all([fetchSeats(), fetchStudents()]);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to assign seat');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReleaseSeat = async () => {
    if (!seatToRelease) return;

    try {
      setSubmitting(true);
      const res = await seatService.releaseSeat({ seatNumber: seatToRelease.seatNumber });
      if (res.data.success) {
        success(`Seat ${seatToRelease.seatNumber} released successfully`);
        setSeatToRelease(null);
        setSelectedSeat(null);
        await Promise.all([fetchSeats(), fetchStudents()]);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to release seat');
    } finally {
      setSubmitting(false);
    }
  };

  const availableCount = seats.filter((s) => s.status === 'AVAILABLE').length;
  const occupiedCount = seats.filter((s) => s.status === 'OCCUPIED').length;
  const maintenanceCount = seats.filter((s) => s.status === 'MAINTENANCE').length;
  const assignedCount = seats.filter((s) => !!s.assignedStudent).length;
  const vacantAssignedCount = seats.length - assignedCount;

  // Filter students for assignment: only active students without a seat (or current student)
  const unassignedStudents = students.filter(
    (st) =>
      !st.assignedSeatNumber ||
      st.assignedSeatNumber === '' ||
      st._id === selectedSeat?.assignedStudent?._id
  );

  const filteredStudents = unassignedStudents.filter((st) => {
    const q = assignSearch.toLowerCase();
    return (
      st.name.toLowerCase().includes(q) ||
      (st.studentIdNumber && st.studentIdNumber.toLowerCase().includes(q)) ||
      st.email.toLowerCase().includes(q) ||
      (st.phone && st.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Library Seats Management (50 Seats)
          </h2>
          <p className="text-xs text-slate-500">
            Real-time status of all 50 physical seats. View occupancy, assign seats, and toggle maintenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAssignModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition text-xs font-bold shadow shadow-indigo-600/20 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Assign Seat
          </button>
          <button
            onClick={fetchSeats}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Seats
          </button>
        </div>
      </div>

      {/* Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-emerald-900 dark:text-emerald-100">{availableCount}</p>
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Physically Free</p>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-rose-900 dark:text-rose-100">{occupiedCount}</p>
            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">Live Seated</p>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0">
            <Armchair className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-indigo-900 dark:text-indigo-100">{assignedCount}</p>
            <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Assigned</p>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-sky-50 dark:bg-sky-950/30 rounded-2xl border border-sky-200 dark:border-sky-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-sky-900 dark:text-sky-100">{vacantAssignedCount}</p>
            <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase">Vacant Seats</p>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-amber-900 dark:text-amber-100">{maintenanceCount}</p>
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Maintenance</p>
          </div>
        </div>
      </div>

      {/* Visual Seat Map */}
      <SeatGrid
        seats={seats}
        isAdminView={true}
        onToggleStatus={handleSeatClick}
      />

      {/* Seat Details & Management Modal */}
      {selectedSeat && (
        <Modal
          isOpen={!!selectedSeat}
          onClose={() => setSelectedSeat(null)}
          title={`Seat ${selectedSeat.seatNumber} Details & Management`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-sans">
            {/* Seat Summary Box */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seat Number</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">#{selectedSeat.seatNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Status</p>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-black uppercase mt-1 ${
                    selectedSeat.status === 'AVAILABLE'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : selectedSeat.status === 'OCCUPIED'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  }`}
                >
                  {selectedSeat.status}
                </span>
              </div>
            </div>

            {/* Assigned Student Section */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                  Assigned Student
                </p>
                {selectedSeat.assignedStudent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSeatToRelease(selectedSeat);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition flex items-center gap-1"
                  >
                    <UserMinus className="w-3 h-3" />
                    Release Seat
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal(selectedSeat)}
                    className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    Assign Student
                  </button>
                )}
              </div>

              {selectedSeat.assignedStudent ? (
                <div className="flex items-center justify-between p-3 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {selectedSeat.assignedStudent.name}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Student ID: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedSeat.assignedStudent.studentIdNumber || 'N/A'}</span>
                      {selectedSeat.assignedStudent.phone && ` • Phone: ${selectedSeat.assignedStudent.phone}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal(selectedSeat)}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-slate-400">
                  <p className="text-xs font-medium">No student is assigned to Seat {selectedSeat.seatNumber}.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">This seat is vacant and ready to be assigned.</p>
                </div>
              )}
            </div>

            {/* Live Seated Occupant Section (If occupied) */}
            {selectedSeat.status === 'OCCUPIED' && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800">
                <p className="font-bold text-rose-800 dark:text-rose-200 text-xs mb-1">
                  Active Attendance Session
                </p>
                <p className="text-rose-700 dark:text-rose-300 text-xs">
                  Live Occupant: <span className="font-black">{selectedSeat.currentStudentName || 'Student'}</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  This seat is currently in use. When the student checks out, the seat becomes available.
                </p>
              </div>
            )}

            {/* Maintenance Toggle Form */}
            {selectedSeat.status !== 'OCCUPIED' && (
              <form onSubmit={handleUpdateStatus} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Set Physical Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as SeatStatus)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value="AVAILABLE">AVAILABLE (Normal operation)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Temporarily out of service)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Maintenance Note (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g., Socket repair, cushion fix..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSeat(null)}
                    className="px-4 py-2 rounded-xl border font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Update Status'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* Assign Seat Modal */}
      {isAssignModalOpen && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Assign Seat to Student"
          maxWidth="md"
        >
          <form onSubmit={handleAssignSeatSubmit} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Select Seat Number (01 to 50)
              </label>
              <select
                value={assignSeatNumber}
                onChange={(e) => setAssignSeatNumber(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-sm"
              >
                {seats.map((s) => {
                  const isAssigned = !!s.assignedStudent;
                  const isMaint = s.status === 'MAINTENANCE';
                  return (
                    <option
                      key={s._id}
                      value={s.seatNumber}
                      disabled={isMaint}
                    >
                      Seat #{s.seatNumber} {isMaint ? '(Under Maintenance)' : isAssigned ? `(Assigned: ${s.assignedStudent?.name})` : '(Vacant)'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Select Active Student
              </label>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search student by name, ID or phone..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50 dark:bg-slate-900">
                {filteredStudents.length === 0 ? (
                  <p className="text-center py-4 text-slate-400 text-xs">
                    {loadingStudents ? 'Loading students...' : 'No active students without a seat found.'}
                  </p>
                ) : (
                  filteredStudents.map((st) => {
                    const isSelected = assignStudentId === st._id || assignStudentId === st.id;
                    return (
                      <button
                        key={st.id || st._id}
                        type="button"
                        onClick={() => setAssignStudentId(st.id || st._id || '')}
                        className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs">{st.name}</p>
                          <p className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                            ID: {st.studentIdNumber || 'N/A'} • {st.phone || st.email}
                          </p>
                        </div>
                        {st.assignedSeatNumber && (
                          <span className={`text-[10px] px-2 py-0.5 rounded ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'}`}>
                            Currently #{st.assignedSeatNumber}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl border font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !assignStudentId}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow disabled:opacity-50"
              >
                {submitting ? 'Assigning...' : `Assign Seat #${assignSeatNumber}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Release Confirmation Dialog */}
      {seatToRelease && (
        <Modal
          isOpen={!!seatToRelease}
          onClose={() => setSeatToRelease(null)}
          title={`Confirm Release of Seat #${seatToRelease.seatNumber}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
              <p className="font-bold text-sm mb-1">Release Assigned Seat</p>
              <p>
                Are you sure you want to release Seat #{seatToRelease.seatNumber} from{' '}
                <span className="font-bold">{seatToRelease.assignedStudent?.name}</span>?
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                The seat will become vacant immediately. The student's account and personal attendance history will remain intact.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSeatToRelease(null)}
                className="px-4 py-2 rounded-xl border font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReleaseSeat}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow disabled:opacity-50"
              >
                {submitting ? 'Releasing...' : 'Confirm Release'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
