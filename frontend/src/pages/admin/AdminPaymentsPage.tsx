import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ShieldCheck,
  User,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { paymentService } from '../../services/api';
import { PaymentItem } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/Modal';

export const AdminPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [stats, setStats] = useState<Record<string, { count: number; totalAmount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Verification modal state
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyAction, setVerifyAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const { success, error } = useToast();

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await paymentService.getAdminPayments({
        status: statusFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res.data.success) {
        setPayments(res.data.data.payments || []);
        setStats(res.data.data.stats || {});
        setTotalPages(res.data.data.pagination?.pages || 1);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to fetch payment records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  const handleOpenVerifyModal = (payment: PaymentItem, action: 'APPROVE' | 'REJECT') => {
    setSelectedPayment(payment);
    setVerifyAction(action);
    setVerifyNotes(action === 'APPROVE' ? 'Bank transaction verified' : 'Payment not received');
    setVerifyModalOpen(true);
  };

  const handleConfirmVerification = async () => {
    if (!selectedPayment) return;
    try {
      setSubmittingAction(true);
      const res = await paymentService.verifyPaymentAdmin(selectedPayment.orderId, {
        action: verifyAction,
        notes: verifyNotes.trim() || undefined,
      });

      if (res.data.success) {
        success(
          verifyAction === 'APPROVE'
            ? 'Payment confirmed and student membership activated!'
            : 'Payment marked as rejected'
        );
        setVerifyModalOpen(false);
        fetchPayments();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const totalCollected = stats.SUCCESS?.totalAmount || 0;
  const pendingCount = stats.PENDING?.count || 0;
  const successCount = stats.SUCCESS?.count || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Payment History & Memberships
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time YouPI-PG Gateway & PhonePe UPI collections and verification ledger.
          </p>
        </div>
        <button
          onClick={fetchPayments}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Ledger
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1">
            Total Verified Revenue
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              ₹{totalCollected.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-emerald-400 font-semibold">
              ({successCount} active passes)
            </span>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1">
            Pending Verifications
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              {pendingCount}
            </span>
            <span className="text-xs text-slate-400">awaiting bank match</span>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1">
            Gateway Protocol
          </span>
          <div className="flex items-center gap-2 mt-1">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">
              YouPI-PG V2 (HMAC-SHA256)
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Direct PhonePe settlement • 0% aggregator fees
          </span>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['ALL', 'PENDING', 'SUCCESS', 'FAILED'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === tab
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab === 'ALL' ? 'All Transactions' : tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student, UTR, order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
            Loading transaction records...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No payments found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Order ID</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Pass Name</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">UPI UTR / Ref</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-200">
                      {p.orderId}
                      {p.gatewayPaymentId && !p.gatewayPaymentId.startsWith('LOCAL_') && (
                        <span className="block text-[10px] text-slate-500 truncate max-w-[140px]">
                          GW: {p.gatewayPaymentId}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white text-xs">{p.studentName}</div>
                      <div className="text-[11px] text-slate-400">{p.studentEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white text-xs">
                      {p.planName}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white text-sm">
                      ₹{p.amount}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-amber-300">
                      {p.utr || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.status === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> SUCCESS
                        </span>
                      )}
                      {p.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                          <Clock className="w-3 h-3" /> PENDING
                        </span>
                      )}
                      {p.status === 'CREATED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          CREATED
                        </span>
                      )}
                      {['FAILED', 'EXPIRED', 'CANCELLED'].includes(p.status) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" /> {p.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {p.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenVerifyModal(p, 'APPROVE')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenVerifyModal(p, 'REJECT')}
                            className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Verification Modal */}
      {verifyModalOpen && selectedPayment && (
        <Modal
          isOpen={verifyModalOpen}
          onClose={() => setVerifyModalOpen(false)}
          title={verifyAction === 'APPROVE' ? 'Approve & Activate Pass' : 'Reject Payment'}
        >
          <div className="space-y-4">
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-mono text-white">{selectedPayment.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <span className="text-white font-medium">{selectedPayment.studentName} ({selectedPayment.studentEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pass Plan:</span>
                <span className="text-emerald-400 font-semibold">{selectedPayment.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="text-white font-bold text-sm">₹{selectedPayment.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Submitted UTR:</span>
                <span className="font-mono text-amber-300 font-bold">{selectedPayment.utr || 'None'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Verification Notes / Remark
              </label>
              <input
                type="text"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="e.g. Verified in PhonePe merchant statement"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVerifyModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleConfirmVerification}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-md transition ${
                  verifyAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {submittingAction ? 'Processing...' : `Confirm ${verifyAction}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
