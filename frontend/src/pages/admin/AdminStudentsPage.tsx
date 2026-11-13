import React, { useState, useEffect } from 'react';
import { studentService, seatService } from '../../services/api';
import { User, Seat } from '../../types';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';
import {
  UserPlus,
  Search,
  ShieldCheck,
  Ban,
  Eye,
  CalendarCheck,
  LifeBuoy,
  Edit2,
  KeyRound,
  UserCheck,
  UserX,
  UserCog,
  RefreshCw,
  Armchair,
  QrCode,
} from 'lucide-react';

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Available seats for assignment
  const [availableSeats, setAvailableSeats] = useState<string[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);

  // Targets
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [resetTargetStudent, setResetTargetStudent] = useState<User | null>(null);
  const [deactivateTargetStudent, setDeactivateTargetStudent] = useState<User | null>(null);
  const [reactivateTargetStudent, setReactivateTargetStudent] = useState<User | null>(null);
  const [replaceTargetStudent, setReplaceTargetStudent] = useState<User | null>(null);

  // Form states
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [course, setCourse] = useState('');
  const [assignedSeatNumber, setAssignedSeatNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Replacement Form State
  const [replaceName, setReplaceName] = useState('');
  const [replaceEmail, setReplaceEmail] = useState('');
  const [replacePhone, setReplacePhone] = useState('');
  const [replaceStudentId, setReplaceStudentId] = useState('');
  const [replaceCourse, setReplaceCourse] = useState('');

  const { success, error } = useToast();

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await studentService.getStudents({ search, status: statusFilter, page, limit: 10 });
      if (res.data.success) {
        setStudents(res.data.data.students || []);
        setTotalPages(res.data.data.pagination?.pages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSeats = async () => {
    try {
      const res = await seatService.getSeats();
      if (res.data.success) {
        const allSeats: Seat[] = res.data.data.seats || [];
        const vacant = allSeats
          .filter((s: any) => !s.assignedStudent && s.status === 'AVAILABLE')
          .map((s) => s.seatNumber);
        setAvailableSeats(vacant);
      }
    } catch (err) {
      console.error('Failed to load vacant seats:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchAvailableSeats();
  }, [search, statusFilter, page]);

  // 1. Add Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectivePassword = password.trim() || phone.trim();
    if (!name.trim() || !email.trim() || !studentIdNumber.trim() || !effectivePassword) {
      error('Full Name, Email, Student ID, and Mobile Number (as initial Password) are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await studentService.createStudent({
        name: name.trim(),
        email: email.trim(),
        password: effectivePassword,
        phone: phone.trim(),
        studentIdNumber: studentIdNumber.trim(),
        course: course.trim(),
        assignedSeatNumber: assignedSeatNumber.trim() || undefined,
      });

      if (res.data.success) {
        success('Student registered successfully.');
        setIsAddModalOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
        setStudentIdNumber('');
        setCourse('');
        setAssignedSeatNumber('');
        fetchStudents();
        fetchAvailableSeats();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to create student');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Edit Student
  const handleEditOpen = (student: User) => {
    setEditId(student._id || student.id);
    setName(student.name);
    setEmail(student.email);
    setPhone(student.phone || '');
    setStudentIdNumber(student.studentIdNumber || '');
    setCourse(student.course || '');
    setAssignedSeatNumber((student as any).assignedSeatNumber || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await studentService.updateStudent(editId, {
        name: name.trim(),
        phone: phone.trim(),
        studentIdNumber: studentIdNumber.trim(),
        course: course.trim(),
        assignedSeatNumber: assignedSeatNumber.trim(),
      });
      if (res.data.success) {
        success('Student profile updated successfully. QR card remains synchronized.');
        setIsEditModalOpen(false);
        fetchStudents();
        fetchAvailableSeats();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update student');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Deactivate Student (Automatic Seat Release & QR Revocation)
  const handleDeactivateOpen = (student: User) => {
    setDeactivateTargetStudent(student);
    setIsDeactivateModalOpen(true);
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTargetStudent) return;
    try {
      setSubmitting(true);
      const studentId = deactivateTargetStudent._id || deactivateTargetStudent.id;
      const res = await studentService.deactivateStudent(studentId);
      if (res.data.success) {
        success(`Student ${deactivateTargetStudent.name} deactivated. Seat released and QR revoked.`);
        setIsDeactivateModalOpen(false);
        setDeactivateTargetStudent(null);
        fetchStudents();
        fetchAvailableSeats();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to deactivate student');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Reactivate Student
  const handleReactivateOpen = (student: User) => {
    setReactivateTargetStudent(student);
    setAssignedSeatNumber('');
    setIsReactivateModalOpen(true);
  };

  const handleReactivateConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactivateTargetStudent) return;
    try {
      setSubmitting(true);
      const studentId = reactivateTargetStudent._id || reactivateTargetStudent.id;
      const res = await studentService.reactivateStudent(studentId, {
        assignedSeatNumber: assignedSeatNumber.trim() || undefined,
      });
      if (res.data.success) {
        success(`Student ${reactivateTargetStudent.name} reactivated successfully.`);
        setIsReactivateModalOpen(false);
        setReactivateTargetStudent(null);
        fetchStudents();
        fetchAvailableSeats();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to reactivate student');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Replace Student Workflow
  const handleReplaceOpen = (student: User) => {
    setReplaceTargetStudent(student);
    setReplaceName('');
    setReplaceEmail('');
    setReplacePhone('');
    setReplaceStudentId('');
    setReplaceCourse('');
    setIsReplaceModalOpen(true);
  };

  const handleReplaceConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTargetStudent) return;

    if (!replaceName.trim() || !replaceEmail.trim() || !replaceStudentId.trim() || !replacePhone.trim()) {
      error('All new student details (Name, Email, Student ID, Mobile Number) are required.');
      return;
    }

    try {
      setSubmitting(true);
      const studentId = replaceTargetStudent._id || replaceTargetStudent.id;
      const res = await studentService.replaceStudent(studentId, {
        newStudent: {
          name: replaceName.trim(),
          email: replaceEmail.trim(),
          phone: replacePhone.trim(),
          studentIdNumber: replaceStudentId.trim(),
          course: replaceCourse.trim(),
        },
      });

      if (res.data.success) {
        success(`Replacement successful! ${replaceTargetStudent.name} archived and ${replaceName} assigned to Seat ${(replaceTargetStudent as any).assignedSeatNumber || 'vacant'}.`);
        setIsReplaceModalOpen(false);
        setReplaceTargetStudent(null);
        fetchStudents();
        fetchAvailableSeats();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to replace student');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Reset Password
  const handleResetPasswordOpen = (student: User) => {
    setResetTargetStudent(student);
    setNewPassword('');
    setIsResetModalOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetStudent) return;
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      error('New password must be at least 6 characters');
      return;
    }

    try {
      setSubmitting(true);
      const studentId = resetTargetStudent._id || resetTargetStudent.id;
      const res = await studentService.resetPassword(studentId, newPassword.trim());
      if (res.data.success) {
        success(`Password reset successfully for ${resetTargetStudent.name}`);
        setIsResetModalOpen(false);
        setNewPassword('');
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  // 7. View Student
  const handleViewOpen = async (student: User) => {
    try {
      const res = await studentService.getStudentById(student._id || student.id);
      if (res.data.success) {
        setSelectedStudent(res.data.data);
        setIsViewModalOpen(true);
      }
    } catch (err: any) {
      error('Failed to load student details');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Complete Student Management
          </h2>
          <p className="text-xs text-slate-500">
            Add, edit, deactivate, reactivate, or replace students with automatic seat release and QR synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchStudents();
              fetchAvailableSeats();
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setName('');
              setEmail('');
              setPassword('');
              setPhone('');
              setStudentIdNumber('');
              setCourse('');
              setAssignedSeatNumber('');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* Filter and Status Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by name, student ID, seat number, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === ''
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            All Students
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'INACTIVE'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Inactive / Archived
          </button>
        </div>
      </div>

      {/* Vacant Seats Notice Bar */}
      <div className="flex items-center justify-between p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs">
        <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
          <Armchair className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>{availableSeats.length} Vacant Seat(s)</strong> available for assignment in the 50-seat library.
          </span>
        </div>
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
          Seats: 50 Total
        </span>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Student ID</th>
                <th className="px-6 py-3.5">Assigned Seat</th>
                <th className="px-6 py-3.5">Library State</th>
                <th className="px-6 py-3.5">Account Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    <span className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading students...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <p className="font-semibold">No students found.</p>
                    <p className="text-[11px] mt-1">Click &quot;Add Student&quot; to register new accounts.</p>
                  </td>
                </tr>
              ) : (
                students.map((s: User) => (
                  <tr key={s._id || s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                          <p className="text-slate-400 text-[11px]">{s.email}</p>
                          {s.phone && <p className="text-slate-400 text-[10px]">{s.phone}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {s.studentIdNumber || 'N/A'}
                    </td>

                    <td className="px-6 py-4">
                      {(s as any).assignedSeatNumber ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          <Armchair className="w-3 h-3" />
                          Seat #{(s as any).assignedSeatNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No seat assigned</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {s.isCurrentlyInside ? (
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            INSIDE
                          </span>
                          <span className="block mt-0.5 font-bold text-indigo-600 text-[11px]">
                            Seat {s.currentSeatNumber || 'Assigned'}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            OUTSIDE
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          s.status === 'ACTIVE'
                            ? 'success'
                            : s.status === 'BLOCKED'
                            ? 'danger'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {s.status}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewOpen(s)}
                          title="View Profile & Details"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleEditOpen(s)}
                          title="Edit Student Profile"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleResetPasswordOpen(s)}
                          title="Reset Password"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Replace Student Workflow Button */}
                        <button
                          onClick={() => handleReplaceOpen(s)}
                          title="Replace Student (Assign seat to new student)"
                          className="p-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                        </button>

                        {/* Deactivate vs Reactivate Actions */}
                        {s.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleDeactivateOpen(s)}
                            title="Deactivate Student (Releases seat & revokes QR)"
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateOpen(s)}
                            title="Reactivate Student"
                            className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        {!loading && students.length > 0 && (
          <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {students.map((s: User) => (
              <div key={s._id || s.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 font-bold flex items-center justify-center text-xs shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</p>
                      <p className="text-[11px] text-slate-500">{s.email}</p>
                      {s.phone && <p className="text-[10px] text-slate-400">{s.phone}</p>}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shrink-0">
                    {s.studentIdNumber || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Assigned Seat</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {(s as any).assignedSeatNumber ? `Seat #${(s as any).assignedSeatNumber}` : 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block text-right">Status</span>
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                      {s.status}
                    </Badge>
                  </div>
                </div>

                {/* Mobile Actions Bar */}
                <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                  <button
                    onClick={() => handleViewOpen(s)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button
                    onClick={() => handleEditOpen(s)}
                    className="px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleReplaceOpen(s)}
                    className="px-2.5 py-1.5 rounded-xl border border-blue-200 text-blue-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <UserCog className="w-3.5 h-3.5" /> Replace
                  </button>
                  {s.status === 'ACTIVE' ? (
                    <button
                      onClick={() => handleDeactivateOpen(s)}
                      className="px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" /> Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivateOpen(s)}
                      className="px-2.5 py-1.5 rounded-xl border border-emerald-200 text-emerald-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Reactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Add Student */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Student">
        <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Student Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Student ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ST001"
                value={studentIdNumber}
                onChange={(e) => setStudentIdNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="student@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Course / Exam Goal
              </label>
              <input
                type="text"
                placeholder="e.g. UPSC / NEET"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Assign Fixed Seat No. (01 - 50)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                placeholder="e.g. 05"
                value={assignedSeatNumber}
                onChange={(e) => setAssignedSeatNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow cursor-pointer"
            >
              {submitting ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Edit Student */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Student Profile">
        <form onSubmit={handleUpdateStudent} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Student ID
              </label>
              <input
                type="text"
                value={studentIdNumber}
                onChange={(e) => setStudentIdNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Course
              </label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Assigned Seat (01 - 50)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={assignedSeatNumber}
                onChange={(e) => setAssignedSeatNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Deactivate Student (Safe Seat Release & QR Revocation) */}
      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        title="Deactivate Student Account"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to deactivate <strong className="text-slate-900 dark:text-white">{deactivateTargetStudent?.name}</strong> ({deactivateTargetStudent?.studentIdNumber})?
          </p>

          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-1.5 text-rose-800 dark:text-rose-200">
            <p className="font-bold">⚠️ Automatic Actions upon Deactivation:</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>The student account will be marked <strong>INACTIVE</strong>.</li>
              <li>Assigned seat ({(deactivateTargetStudent as any)?.assignedSeatNumber ? `Seat #${(deactivateTargetStudent as any).assignedSeatNumber}` : 'none'}) will be <strong>released immediately</strong> and marked VACANT.</li>
              <li>Personal attendance QR code will be <strong>permanently revoked</strong>.</li>
              <li>Active attendance session will be safely closed.</li>
              <li>All historical payments, attendance, and refunds are <strong>permanently preserved</strong>.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDeactivateModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDeactivateConfirm}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow cursor-pointer"
            >
              {submitting ? 'Deactivating...' : 'Confirm Deactivation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: Reactivate Student */}
      <Modal
        isOpen={isReactivateModalOpen}
        onClose={() => setIsReactivateModalOpen(false)}
        title={`Reactivate Student: ${reactivateTargetStudent?.name || ''}`}
      >
        <form onSubmit={handleReactivateConfirm} className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Reactivate student account for <strong className="text-slate-900 dark:text-white">{reactivateTargetStudent?.name}</strong> ({reactivateTargetStudent?.email}).
          </p>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              Optionally Assign Vacant Seat (01 - 50)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              placeholder="e.g. 12"
              value={assignedSeatNumber}
              onChange={(e) => setAssignedSeatNumber(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsReactivateModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow cursor-pointer"
            >
              {submitting ? 'Reactivating...' : 'Reactivate Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: Student Replacement Workflow */}
      <Modal
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        title="Student Replacement Workflow"
      >
        <form onSubmit={handleReplaceConfirm} className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-bold">
              Replacing: {replaceTargetStudent?.name} (Seat #{(replaceTargetStudent as any)?.assignedSeatNumber || 'Unassigned'})
            </p>
            <p className="text-[11px] leading-relaxed">
              The departing student will be marked Inactive and their QR revoked. The new student will receive an independent account, inherit this seat, and be issued a fresh personal QR.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                New Student Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rohit Kumar"
                value={replaceName}
                onChange={(e) => setReplaceName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                New Student ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ST055"
                value={replaceStudentId}
                onChange={(e) => setReplaceStudentId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                New Email *
              </label>
              <input
                type="email"
                required
                placeholder="newstudent@email.com"
                value={replaceEmail}
                onChange={(e) => setReplaceEmail(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                New Mobile Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 9812345678"
                value={replacePhone}
                onChange={(e) => setReplacePhone(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              Course / Exam Goal
            </label>
            <input
              type="text"
              placeholder="e.g. B.Tech / GATE"
              value={replaceCourse}
              onChange={(e) => setReplaceCourse(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsReplaceModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow cursor-pointer"
            >
              {submitting ? 'Replacing...' : 'Confirm Replacement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: Reset Password */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title={`Reset Password: ${resetTargetStudent?.name || 'Student'}`}
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
          <p className="text-slate-500">
            Enter a new password for <strong className="text-slate-800 dark:text-slate-200">{resetTargetStudent?.name}</strong> ({resetTargetStudent?.email}).
          </p>
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              New Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow cursor-pointer"
            >
              {submitting ? 'Resetting...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 7: View Student */}
      {selectedStudent && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={`Student Profile: ${selectedStudent.student?.name || 'Details'}`}
        >
          <div className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-1">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-base font-black text-slate-900 dark:text-white">
                  {selectedStudent.student?.name}
                </p>
                <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                  ID: {selectedStudent.student?.studentIdNumber} • {selectedStudent.student?.email}
                </p>
                {selectedStudent.student?.phone && (
                  <p className="text-slate-500 text-[11px] mt-0.5">Phone: {selectedStudent.student?.phone}</p>
                )}
                {selectedStudent.student?.assignedSeatNumber && (
                  <span className="inline-block mt-1 font-bold text-indigo-600">
                    Assigned Seat: #{selectedStudent.student?.assignedSeatNumber}
                  </span>
                )}
              </div>
              <Badge variant={selectedStudent.student?.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {selectedStudent.student?.status}
              </Badge>
            </div>

            {/* Attendance QR Card Status */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">Attendance QR Status</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedStudent.activeQr ? `Active (Token: ${selectedStudent.activeQr.qrToken?.substring(0, 12)}...)` : 'No active personal QR'}
                  </span>
                </div>
              </div>
              <Badge variant={selectedStudent.activeQr ? 'success' : 'neutral'} size="sm">
                {selectedStudent.activeQr ? 'ACTIVE' : 'REVOKED / NONE'}
              </Badge>
            </div>

            {/* Attendance History */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5 text-sm">
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                Recent Attendance Logs
              </h4>
              {selectedStudent.recentAttendance?.length === 0 ? (
                <p className="text-slate-400 py-3">No attendance logs recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedStudent.recentAttendance.map((a: any) => (
                    <div
                      key={a._id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {new Date(a.entryTime).toLocaleDateString()}
                        </span>
                        <span className="text-slate-400 ml-2 font-mono text-[11px]">
                          Seat {a.seatNumber || 'N/A'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-600">
                          {a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : 'In Session'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Complaints */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5 text-sm">
                <LifeBuoy className="w-4 h-4 text-rose-500" />
                Complaints Raised
              </h4>
              {selectedStudent.recentTickets?.length === 0 ? (
                <p className="text-slate-400 py-3">No complaints submitted by this student.</p>
              ) : (
                <div className="space-y-2">
                  {selectedStudent.recentTickets.map((t: any) => (
                    <div
                      key={t._id}
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-[10px] text-slate-400">#{t.ticketNumber} • {t.category}</span>
                        <p className="font-bold text-slate-900 dark:text-white">{t.title}</p>
                      </div>
                      <Badge variant={t.status === 'RESOLVED' ? 'success' : 'warning'} size="sm">
                        {t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
