import React, { useState, useEffect } from 'react';
import { ticketService } from '../../services/api';
import { Ticket, TicketCategory } from '../../types';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';
import {
  LifeBuoy,
  Plus,
  MessageSquare,
  CheckCircle2,
  Send,
} from 'lucide-react';

const TICKET_CATEGORIES: TicketCategory[] = [
  'Wi-Fi',
  'AC',
  'Light',
  'Fan',
  'Charging Point',
  'Chair/Seat',
  'Cleanliness',
  'Water',
  'Other',
];

export const StudentTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New ticket state
  const [category, setCategory] = useState<TicketCategory>('Wi-Fi');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [seatNumber, setSeatNumber] = useState('');

  // Active viewing ticket for comments
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [commentText, setCommentText] = useState('');

  const { success, error } = useToast();

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await ticketService.getTickets();
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
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      error('Please provide a category, title, and description.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await ticketService.createTicket({
        category,
        title,
        description,
        seatNumber: seatNumber || undefined,
      });

      if (res.data.success) {
        success('Complaint submitted successfully!');
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        setSeatNumber('');
        fetchTickets();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    if (!selectedTicket || !commentText.trim()) return;
    try {
      const res = await ticketService.addComment(selectedTicket._id, commentText);
      if (res.data.success) {
        success('Message posted');
        setCommentText('');
        const refreshed = await ticketService.getTicketById(selectedTicket._id);
        setSelectedTicket(refreshed.data.data);
        fetchTickets();
      }
    } catch (err: any) {
      error('Failed to post message');
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            My Complaints
          </h2>
          <p className="text-xs text-slate-500">
            Submit issues regarding Wi-Fi, AC, electricity, charging points, cleanliness, or seats.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Raise Complaint
        </button>
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading your complaints...</div>
        ) : tickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
            <LifeBuoy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">No Active Complaints</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Everything in the library running smoothly! If you face any issues, feel free to submit a ticket.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Submit Complaint
            </button>
          </div>
        ) : (
          tickets.map((t) => (
            <div
              key={t._id}
              onClick={() => setSelectedTicket(t)}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 transition cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    #{t.ticketNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
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

              {t.resolutionNote && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Admin Resolution: </span>
                    {t.resolutionNote}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                <span className="flex items-center gap-1 text-indigo-600 font-semibold">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {t.comments?.length || 0} Comments &bull; Click to View
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Ticket Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Raise Library Complaint" maxWidth="md">
        <form onSubmit={handleCreateTicket} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                Optional Seat Number
              </label>
              <input
                type="text"
                placeholder="e.g. 12"
                value={seatNumber}
                onChange={(e) => setSeatNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AC not cooling or Wi-Fi disconnected"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              Description *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Please describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ticket Details & Discussion Thread Modal */}
      {selectedTicket && (
        <Modal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket #${selectedTicket.ticketNumber}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-extrabold text-base text-slate-900 dark:text-white">
                  {selectedTicket.category}
                </span>
                {selectedTicket.seatNumber && (
                  <span className="ml-2 text-xs text-slate-500 font-semibold">
                    (Seat: {selectedTicket.seatNumber})
                  </span>
                )}
              </div>
              <Badge
                variant={
                  selectedTicket.status === 'RESOLVED'
                    ? 'success'
                    : selectedTicket.status === 'IN_PROGRESS'
                    ? 'warning'
                    : 'info'
                }
              >
                {selectedTicket.status}
              </Badge>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl">
              <h5 className="font-bold text-slate-900 dark:text-white mb-1">{selectedTicket.title}</h5>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedTicket.description}
              </p>
            </div>

            {selectedTicket.resolutionNote && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="font-bold text-emerald-800 dark:text-emerald-200 block mb-0.5">
                  Resolution Note:
                </span>
                <p className="text-emerald-700 dark:text-emerald-300">
                  {selectedTicket.resolutionNote}
                </p>
              </div>
            )}

            {/* Comments Thread */}
            <div className="space-y-2 pt-2">
              <h5 className="font-bold text-slate-700 dark:text-slate-300">
                Messages & Updates ({selectedTicket.comments?.length || 0})
              </h5>
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {selectedTicket.comments?.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No comments on this ticket yet</p>
                ) : (
                  selectedTicket.comments.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-indigo-600">
                          {c.userName} ({c.userRole})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{c.comment}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Reply to admin..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                  className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleSendComment}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
