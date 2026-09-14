import React, { useState, useEffect } from 'react';
import { ticketService, adminNotificationService } from '../../services/api';
import { Ticket, TicketStatus } from '../../types';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';
import {
  LifeBuoy,
  Search,
  MessageSquare,
  User,
  ExternalLink,
} from 'lucide-react';

export const AdminTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Status update modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [status, setStatus] = useState<TicketStatus>('OPEN');
  const [resolutionNote, setResolutionNote] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [updating, setUpdating] = useState(false);

  const { success, error } = useToast();

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await ticketService.getTickets({
        search,
        status: statusFilter,
        category: categoryFilter,
      });
      if (res.data.success) {
        setTickets(res.data.data.tickets || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    // Clear unread notification badge once admin reviews tickets
    adminNotificationService.markAllAsRead().catch(() => {});
  }, []);

  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setStatus(ticket.status);
    setResolutionNote(ticket.resolutionNote || '');
    setAdminComment('');
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setUpdating(true);
      const res = await ticketService.updateStatus(selectedTicket._id, {
        status,
        resolutionNote: status === 'RESOLVED' || status === 'CLOSED' ? resolutionNote : undefined,
        adminComment: adminComment.trim() ? adminComment.trim() : undefined,
      });

      if (res.data.success) {
        success(`Ticket #${selectedTicket.ticketNumber} marked as ${status}`);
        setSelectedTicket(null);
        fetchTickets();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Complaints Management
          </h2>
          <p className="text-xs text-slate-500">
            Inspect, respond to, and resolve complaints submitted by library students.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search complaints by ID, student, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
        >
          <option value="">All Categories</option>
          <option value="Wi-Fi">Wi-Fi</option>
          <option value="AC">AC</option>
          <option value="Light">Light</option>
          <option value="Fan">Fan</option>
          <option value="Charging Point">Charging Point</option>
          <option value="Chair/Seat">Chair/Seat</option>
          <option value="Cleanliness">Cleanliness</option>
          <option value="Water">Water</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading complaints...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border">
            No complaints found matching filters.
          </div>
        ) : (
          tickets.map((t: any) => (
            <div
              key={t._id}
              onClick={() => handleOpenTicket(t)}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 transition cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-400">#{t.ticketNumber}</span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {t.category}
                  </span>
                  {t.seatNumber && (
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-semibold">
                      Seat {t.seatNumber}
                    </span>
                  )}
                </div>

                <Badge
                  variant={
                    t.status === 'RESOLVED'
                      ? 'success'
                      : t.status === 'IN_PROGRESS'
                      ? 'warning'
                      : t.status === 'OPEN'
                      ? 'danger'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {t.status}
                </Badge>
              </div>

              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{t.title}</h4>
              <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {t.studentName || t.studentId?.name || 'Student'} ({t.studentIdNumber || t.studentId?.studentIdNumber || 'ST001'})
                </span>
                <span className="flex items-center gap-1 text-indigo-600 font-semibold">
                  <MessageSquare className="w-3.5 h-3.5" /> {t.comments?.length || 0} Messages &bull; Click to Manage
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Ticket Management Modal */}
      {selectedTicket && (
        <Modal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={`Complaint #${selectedTicket.ticketNumber}`}
          maxWidth="lg"
        >
          <form onSubmit={handleUpdateTicket} className="space-y-4 text-xs font-sans">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {selectedTicket.title}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Category: {selectedTicket.category} {selectedTicket.seatNumber && `• Seat ${selectedTicket.seatNumber}`}
                  </p>
                </div>
                <Badge variant={selectedTicket.status === 'RESOLVED' ? 'success' : 'warning'}>
                  {selectedTicket.status}
                </Badge>
              </div>

              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {selectedTicket.description}
              </p>

              {selectedTicket.attachmentUrl && (
                <div className="mt-2">
                  <a
                    href={selectedTicket.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 font-bold"
                  >
                    View Attached Photo <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Change Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  className="w-full p-2.5 rounded-xl border font-bold bg-white dark:bg-slate-800"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Resolution Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wi-Fi router restarted / Electrician fixed AC"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Admin Response / Comment
              </label>
              <textarea
                rows={2}
                placeholder="Response to student..."
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-800"
              />
            </div>

            {/* Existing Comments */}
            {selectedTicket.comments && selectedTicket.comments.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                <span className="font-bold text-slate-500 text-[10px] uppercase">
                  Comment Thread
                </span>
                {selectedTicket.comments.map((c, i) => (
                  <div key={i} className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                    <span className="font-bold text-indigo-600">{c.userName}: </span>
                    <span>{c.comment}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-xl border font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow disabled:opacity-50"
              >
                {updating ? 'Saving...' : 'Update Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
