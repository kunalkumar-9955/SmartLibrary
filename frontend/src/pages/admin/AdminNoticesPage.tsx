import React, { useState, useEffect } from 'react';
import { noticeService } from '../../services/api';
import { Notice } from '../../types';
import { Modal } from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Trash2, BellRing } from 'lucide-react';

export const AdminNoticesPage: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToast();

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const res = await noticeService.getNotices();
      if (res.data.success) {
        setNotices(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    try {
      setSubmitting(true);
      const res = await noticeService.createNotice({ title, description });
      if (res.data.success) {
        success('Notice published successfully!');
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        fetchNotices();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to publish notice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!window.confirm('Delete this notice?')) return;
    try {
      await noticeService.deleteNotice(id);
      success('Notice deleted');
      fetchNotices();
    } catch (err: any) {
      error('Failed to delete notice');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Library Notices
          </h2>
          <p className="text-xs text-slate-500">
            Publish announcements and alerts displayed directly on student dashboards.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Notice
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading notices...</div>
        ) : notices.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            No notices published yet.
          </div>
        ) : (
          notices.map((n) => (
            <div
              key={n._id}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-indigo-500 shrink-0" />
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                    {n.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {n.description}
                </p>
                <span className="text-[10px] text-slate-400 block pt-1">
                  Posted on {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>

              <button
                onClick={() => handleDeleteNotice(n._id)}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                title="Delete Notice"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Simple Notice">
        <form onSubmit={handleCreateNotice} className="space-y-4 text-xs font-sans">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              Notice Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Library will be closed tomorrow."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
              Message / Description *
            </label>
            <textarea
              required
              rows={4}
              placeholder="e.g., Wi-Fi maintenance from 2 PM. Please maintain silence."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border font-semibold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : 'Publish Notice'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
