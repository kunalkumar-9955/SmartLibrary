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
  Building2,
  FileText,
  ExternalLink,
  Calendar,
  Sparkles,
  QrCode,
  Copy,
} from 'lucide-react';
import { paymentService } from '../../services/api';
import { PaymentItem } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/Modal';

export const AdminPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Verification modal state for online / offline
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Receipt preview modal
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);

  // Gateway Testing State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testAmountInput, setTestAmountInput] = useState<string>('1');
  const [testOrder, setTestOrder] = useState<any>(null);
  const [creatingTestOrder, setCreatingTestOrder] = useState(false);
  const [checkingTestStatus, setCheckingTestStatus] = useState(false);
  const [testPaymentStatus, setTestPaymentStatus] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const { success, error } = useToast();

  const handleCreateTestOrder = async (amt: number) => {
    try {
      setCreatingTestOrder(true);
      setTestPaymentStatus(null);
      const res = await paymentService.createOrder({
        amount: amt,
        isCustomAmount: true,
        idempotencyKey: `idem_admintest_${Date.now()}_${amt}`,
      });
      if (res.data.success) {
        setTestOrder(res.data.data);
        setTestPaymentStatus(res.data.data.status || 'CREATED');
        success(`Live test order generated for ₹${amt}. Scan QR with PhonePe or GPay.`);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to create test payment order');
    } finally {
      setCreatingTestOrder(false);
    }
  };

  const pollTestStatus = async (orderId: string) => {
    try {
      setCheckingTestStatus(true);
      const res = await paymentService.getOrderStatus(orderId);
      if (res.data.success) {
        const s = res.data.data.status;
        setTestPaymentStatus(s);
        if (s === 'SUCCESS' || s === 'APPROVED') {
          success(`Test Payment of ₹${res.data.data.amount} Verified & Recorded in Ledger!`);
          fetchPayments();
        } else if (s === 'FAILED' || s === 'CANCELLED') {
          error(`Payment marked as ${s}`);
        }
      }
    } catch (err: any) {
      console.warn('Poll test status error:', err);
    } finally {
      setCheckingTestStatus(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (testModalOpen && testOrder?.orderId && testPaymentStatus !== 'SUCCESS' && testPaymentStatus !== 'FAILED') {
      timer = setInterval(() => {
        pollTestStatus(testOrder.orderId);
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [testModalOpen, testOrder, testPaymentStatus]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await paymentService.getAdminPayments({
        status: statusFilter,
        type: typeFilter,
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
  }, [statusFilter, typeFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  const handleOpenActionModal = (payment: PaymentItem, action: 'APPROVE' | 'REJECT') => {
    setSelectedPayment(payment);
    setSelectedAction(action);
    setAdminNotes(action === 'APPROVE' ? 'Verified in payment records' : '');
    setRejectionReason(
      action === 'REJECT' ? 'Payment could not be verified by library administration' : ''
    );
    setActionModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedPayment) return;
    try {
      setSubmittingAction(true);

      if (selectedPayment.paymentType === 'OFFLINE') {
        const res = await paymentService.adminOfflineAction(selectedPayment.orderId, {
          action: selectedAction,
          rejectionReason: selectedAction === 'REJECT' ? rejectionReason.trim() : undefined,
          remarks: adminNotes.trim() || undefined,
        });

        if (res.data.success) {
          success(
            selectedAction === 'APPROVE'
              ? 'Offline payment approved & membership renewed by 1 calendar month!'
              : 'Offline payment rejected'
          );
          setActionModalOpen(false);
          fetchPayments();
        }
      } else {
        // Online manual verification
        const res = await paymentService.verifyPaymentAdmin(selectedPayment.orderId, {
          action: selectedAction,
          notes: adminNotes.trim() || undefined,
        });

        if (res.data.success) {
          success(
            selectedAction === 'APPROVE'
              ? 'Online payment verified & membership renewed!'
              : 'Payment marked as rejected'
          );
          setActionModalOpen(false);
          fetchPayments();
        }
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const totalCollected = stats.totalCollected || 0;
  const pendingOffline = stats.pendingOfflineApproval || 0;
  const onlineSuccess = stats.onlineSuccess || 0;
  const offlineApproved = stats.offlineApproved || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Lakshya Membership Payments & Approvals
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review online UPI settlements and process offline cash/transfer requests. Strictly ₹500 monthly fee.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => {
              setTestModalOpen(true);
              if (!testOrder) {
                handleCreateTestOrder(Number(testAmountInput) || 1);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Test Gateway (₹1 / Custom)</span>
          </button>
          <button
            onClick={fetchPayments}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1">
            Total Revenue Collected
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white">
              ₹{totalCollected.toLocaleString('en-IN')}
            </span>
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 block">
            {onlineSuccess} online + {offlineApproved} offline
          </span>
        </div>

        <div className="bg-slate-800/80 border border-purple-500/30 rounded-2xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider text-purple-300 font-semibold block mb-1">
            Pending Offline Approvals
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-400">
              {pendingOffline}
            </span>
            <span className="text-xs text-slate-400">requests</span>
          </div>
          <span className="text-[11px] text-purple-300/80 mt-1 block">
            Requires Admin verification
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1">
            Monthly Fee Standard
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white">
              ₹500
            </span>
            <span className="text-xs text-slate-400">/ student</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Calendar month + 5-day grace
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1">
            Gateway Protocol
          </span>
          <div className="flex items-center gap-2 mt-1">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">
              YouPI-PG + PhonePe
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Zero gateway fee direct settlement
          </span>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Type & Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Types (Online & Offline)</option>
            <option value="ONLINE">Online Payments Only</option>
            <option value="OFFLINE">Offline Payments Only</option>
          </select>

          <div className="flex items-center gap-1">
            {['ALL', 'PENDING_APPROVAL', 'PENDING', 'SUCCESS', 'APPROVED', 'REJECTED'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setStatusFilter(tab);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === tab
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab === 'ALL'
                  ? 'All Statuses'
                  : tab === 'PENDING_APPROVAL'
                  ? 'Offline Approvals'
                  : tab}
              </button>
            ))}
          </div>
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
                  <th className="py-3.5 px-4">Order Ref</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Method / Type</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">UTR / Ref</th>
                  <th className="py-3.5 px-4">Receipt</th>
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
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white text-xs">{p.studentName}</div>
                      {p.studentIdNumber && (
                        <div className="text-[10px] text-emerald-400 font-mono font-semibold">ID: {p.studentIdNumber}</div>
                      )}
                      <div className="text-[11px] text-slate-400">{p.studentEmail}</div>
                      {p.studentPhone && (
                        <div className="text-[10px] text-slate-500">{p.studentPhone}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {p.paymentType || 'ONLINE'} {p.offlineMethod ? `• ${p.offlineMethod}` : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">₹{p.amount}</div>
                      {p.isCustomAmount || p.amount !== 500 ? (
                        <span className="inline-block mt-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          Custom
                        </span>
                      ) : (
                        <span className="inline-block mt-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Monthly Pass
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-amber-300">
                      {p.utr || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => setReceiptPreviewUrl(p.receiptUrl!)}
                          className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.status === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> SUCCESS
                        </span>
                      )}
                      {p.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> APPROVED
                        </span>
                      )}
                      {p.status === 'PENDING_APPROVAL' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse">
                          <Clock className="w-3 h-3" /> PENDING APPROVAL
                        </span>
                      )}
                      {p.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" /> PENDING
                        </span>
                      )}
                      {p.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20" title={p.adminRejectionReason}>
                          <XCircle className="w-3 h-3" /> REJECTED
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
                      {p.status === 'PENDING_APPROVAL' || p.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenActionModal(p, 'APPROVE')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(p, 'REJECT')}
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

      {/* Admin Action Modal (Approve / Reject) */}
      {actionModalOpen && selectedPayment && (
        <Modal
          isOpen={actionModalOpen}
          onClose={() => setActionModalOpen(false)}
          title={
            selectedAction === 'APPROVE'
              ? `Approve ${selectedPayment.paymentType === 'OFFLINE' ? 'Offline' : 'Online'} Payment`
              : `Reject Payment Request`
          }
        >
          <div className="space-y-4">
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-mono text-white">{selectedPayment.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Type:</span>
                <span className="text-purple-300 font-semibold">
                  {selectedPayment.paymentType} {selectedPayment.offlineMethod ? `(${selectedPayment.offlineMethod})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <span className="text-white font-medium">{selectedPayment.studentName} ({selectedPayment.studentEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="text-emerald-400 font-bold text-sm">₹{selectedPayment.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Submitted UTR / Ref:</span>
                <span className="font-mono text-amber-300 font-bold">{selectedPayment.utr || 'None'}</span>
              </div>
              {selectedPayment.notes && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Student Remarks:</span>
                  <span className="text-slate-300 italic">{selectedPayment.notes}</span>
                </div>
              )}
            </div>

            {selectedAction === 'APPROVE' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Approval Notes / Audit Remark
                </label>
                <input
                  type="text"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Cash received at front desk by admin"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  CRITICAL: Approving will extend student membership by exactly 1 calendar month and send confirmation notification & SMS.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rejection Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Cash was not received, or UTR number could not be found in bank statement."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <p className="text-[11px] text-rose-300/80 mt-1">
                  Student membership will remain unchanged. The student will be notified with this reason.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction || (selectedAction === 'REJECT' && !rejectionReason.trim())}
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-md transition ${
                  selectedAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {submittingAction ? 'Processing...' : `Confirm ${selectedAction}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Gateway Live Testing Modal */}
      {testModalOpen && (
        <Modal
          isOpen={testModalOpen}
          onClose={() => setTestModalOpen(false)}
          title="Payment Gateway Live Testing"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Generate a real payment order with ₹1, ₹2 or any custom amount to test UPI scanning, mobile apps, and automatic webhook verification.
            </p>

            <div className="p-3 bg-slate-800 rounded-xl space-y-2 border border-slate-700">
              <label className="text-xs font-bold text-white block">
                Test Amount (₹):
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    value={testAmountInput}
                    onChange={(e) => setTestAmountInput(e.target.value)}
                    placeholder="e.g. 1, 2, 5"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={creatingTestOrder}
                  onClick={() => {
                    const amt = Number(testAmountInput);
                    if (!Number.isFinite(amt) || amt < 1) {
                      error('Amount must be at least ₹1');
                      return;
                    }
                    handleCreateTestOrder(amt);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-60 cursor-pointer"
                >
                  {creatingTestOrder ? 'Generating...' : 'Generate Test QR'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-slate-400">Quick Test:</span>
                {[1, 2, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setTestAmountInput(String(preset));
                      handleCreateTestOrder(preset);
                    }}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold border transition cursor-pointer ${
                      Number(testAmountInput) === preset
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>
            </div>

            {testOrder && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-center space-y-3">
                <div className="p-3 bg-white rounded-xl shadow-sm inline-flex items-center justify-center mx-auto overflow-hidden">
                  {testOrder.qrSvg ? (
                    <div
                      className="w-[180px] h-[180px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: testOrder.qrSvg }}
                    />
                  ) : (
                    <img
                      src={paymentService.getQrSvgUrl(testOrder.orderId)}
                      alt="Test QR"
                      className="w-[180px] h-[180px]"
                    />
                  )}
                </div>

                <div className="text-xs space-y-1 text-slate-300">
                  <div className="font-bold text-sm text-white">Amount: ₹{testOrder.amount}</div>
                  <div className="font-mono text-[11px] text-slate-400">Order: {testOrder.orderId}</div>
                  <div className="font-mono text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                    <span>UPI: {testOrder.upiId || '9955008447-7@axl'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(testOrder.upiId || '9955008447-7@axl');
                        setCopiedUpi(true);
                        setTimeout(() => setCopiedUpi(false), 2000);
                      }}
                      className="text-slate-400 hover:text-white"
                      title="Copy UPI"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 1-Tap UPI Intent buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <a
                    href={`phonepe://pay?pa=${encodeURIComponent(testOrder.upiId || '9955008447-7@axl')}&pn=Lakshya%20Smart%20Library&am=${testOrder.amount}&cu=INR&tn=Gateway%20Test&tr=${testOrder.orderId}`}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700"
                  >
                    PhonePe
                  </a>
                  <a
                    href={`gpay://upi/pay?pa=${encodeURIComponent(testOrder.upiId || '9955008447-7@axl')}&pn=Lakshya%20Smart%20Library&am=${testOrder.amount}&cu=INR&tn=Gateway%20Test&tr=${testOrder.orderId}`}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700"
                  >
                    GPay
                  </a>
                  <a
                    href={`paytmmp://pay?pa=${encodeURIComponent(testOrder.upiId || '9955008447-7@axl')}&pn=Lakshya%20Smart%20Library&am=${testOrder.amount}&cu=INR&tn=Gateway%20Test&tr=${testOrder.orderId}`}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700"
                  >
                    Paytm
                  </a>
                </div>

                {/* Status indicator */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs">
                  <span className="text-slate-400">
                    Status: <strong className={testPaymentStatus === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-300'}>{testPaymentStatus || 'PENDING'}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={checkingTestStatus}
                    onClick={() => pollTestStatus(testOrder.orderId)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-semibold border border-slate-700 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${checkingTestStatus ? 'animate-spin' : ''}`} />
                    <span>Check Status</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Receipt Image Preview Modal */}
      {receiptPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h4 className="text-sm font-bold text-white">Payment Receipt Preview</h4>
              <button
                onClick={() => setReceiptPreviewUrl(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl bg-slate-950 p-2">
              <img
                src={receiptPreviewUrl}
                alt="Uploaded Payment Receipt"
                className="w-full h-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
