import React, { useState, useEffect } from 'react';
import { studentService } from '../../services/api';
import { User } from '../../types';
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
  Trash2,
} from 'lucide-react';

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [resetTargetStudent, setResetTargetStudent] = useState<User | null>(null);
  const [deleteTargetStudent, setDeleteTargetStudent] = useState<User | null>(null);

  // Form state
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

  useEffect(() => {
    fetchStudents();
  }, [search, statusFilter, page]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !studentIdNumber.trim() || !password.trim()) {
      error('Full Name, Email, Student ID, and initial Password are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await studentService.createStudent({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        phone: phone.trim(),
        studentIdNumber: studentIdNumber.trim(),
        course: course.trim(),
        assignedSeatNumber: assignedSeatNumber.trim() || undefined,
      });

      if (res.data.success) {
        success('Student registered successfully!');
        setIsAddModalOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
        setStudentIdNumber('');
        setCourse('');
        setAssignedSeatNumber('');
        fetchStudents();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to create student');
    } finally {
      setSubmitting(false);
    }
  };

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
        success('Student updated successfully');
        setIsEditModalOpen(false);
        fetchStudents();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update student');
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleDeleteOpen = (student: User) => {
    setDeleteTargetStudent(student);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetStudent) return;
    try {
      setSubmitting(true);
      const studentId = deleteTargetStudent._id || deleteTargetStudent.id;
      const res = await studentService.deleteStudent(studentId);
      if (res.data.success) {
        success('Student deleted successfully');
        setIsDeleteModalOpen(false);
        setDeleteTargetStudent(null);
        fetchStudents();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to delete student');
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleToggleStatus = async (student: User, newStatus: string) => {
    try {
      const res = await studentService.updateStatus(student._id || student.id, newStatus);
      if (res.data.success) {
        success(`Student marked as ${newStatus}`);
        fetchStudents();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Status update failed');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Student Management
          </h2>
          <p className="text-xs text-slate-500">
            Register students, manage login credentials, and inspect attendance history and complaints.
          </p>
        </div>

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
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, student ID, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="BLOCKED">Blocked Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Student ID</th>
                <th className="px-6 py-3.5">Course</th>
                <th className="px-6 py-3.5">Current Status</th>
                <th className="px-6 py-3.5">Account</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading students...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <p className="font-semibold">No students found.</p>
                    <p className="text-[11px] mt-1">Click "Add Student" to register student accounts.</p>
                  </td>
                </tr>
              ) : (
                students.map((s: User) => (
                  <tr key={s._id || s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold flex items-center justify-center text-xs">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                          <p className="text-slate-400 text-[11px]">{s.email}</p>
                          {s.phone && <p className="text-slate-400 text-[10px]">{s.phone}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {s.studentIdNumber || 'N/A'}
                    </td>

                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {s.course || 'Enrolled'}
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
                          {(s as any).assignedSeatNumber && (
                            <span className="block mt-0.5 text-[10px] text-slate-400">
                              Allotted: <span className="font-bold text-indigo-500">#{(s as any).assignedSeatNumber}</span>
                            </span>
                          )}
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
                          title="View Attendance & Complaints"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleEditOpen(s)}
                          title="Edit Student"
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

                        {s.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleToggleStatus(s, 'BLOCKED')}
                            title="Block Student"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(s, 'ACTIVE')}
                            title="Activate Student"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteOpen(s)}
                          title="Delete Student"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Student">
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
                Mobile Number
              </label>
              <input
                type="tel"
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
                placeholder="e.g. B.Tech / UPSC / NEET"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Allotted Seat No.
              </label>
              <input
                type="number"
                min={1}
                max={50}
                placeholder="1 – 50"
                value={assignedSeatNumber}
                onChange={(e) => setAssignedSeatNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Leave blank for no fixed seat</p>
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              Initial Login Password *
            </label>
            <input
              type="password"
              required
              placeholder="Set student login password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow"
            >
              {submitting ? 'Adding...' : 'Add Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Student">
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
                Phone
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
                Allotted Seat No.
              </label>
              <input
                type="number"
                min={1}
                max={50}
                placeholder="1 – 50"
                value={assignedSeatNumber}
                onChange={(e) => setAssignedSeatNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Leave blank to clear assignment</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title={`Reset Password: ${resetTargetStudent?.name || 'Student'}`}
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
          <p className="text-slate-500">
            Enter a new password for <span className="font-bold text-slate-800 dark:text-slate-200">{resetTargetStudent?.name}</span> ({resetTargetStudent?.email}).
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
              className="px-4 py-2 rounded-xl border font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow"
            >
              {submitting ? 'Resetting...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Student Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Student Account"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to permanently delete the student account for{' '}
            <span className="font-bold text-slate-900 dark:text-white">{deleteTargetStudent?.name}</span> ({deleteTargetStudent?.studentIdNumber})?
          </p>
          <p className="text-rose-500 text-[11px]">
            This action cannot be undone. If the student is currently occupying a seat, the seat will be automatically released.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDeleteConfirm}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow"
            >
              {submitting ? 'Deleting...' : 'Delete Student'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Student Modal */}
      {selectedStudent && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={`Student: ${selectedStudent.student?.name || 'Details'}`}
        >
          <div className="space-y-6 text-xs max-h-[75vh] overflow-y-auto pr-1">
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
              </div>
              <Badge variant={selectedStudent.student?.status === 'ACTIVE' ? 'success' : 'danger'}>
                {selectedStudent.student?.status}
              </Badge>
            </div>

            {/* Attendance History */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5 text-sm">
                <CalendarCheck className="w-4 h-4 text-indigo-600" />
                Recent Attendance History
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
                        <span className="font-bold text-indigo-600">
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
