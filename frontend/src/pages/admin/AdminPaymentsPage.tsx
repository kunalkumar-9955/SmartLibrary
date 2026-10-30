import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Eye,
  ShieldCheck,
  AlertCircle,
  Check,
  X,
  Building2,
  Sparkles,
  Copy,
  Receipt,
  Printer,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { paymentService } from '../../services/api';
import { PaymentItem, PaymentReceipt } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/Modal';
import { formatISTDateTime } from '../../utils/timeHelper';

export const AdminPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [classificationFilter, setClassificationFilter] = useState<'ALL' | 'PROD' | 'TEST'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Verification modal state for online / offline
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [grantMembershipException, setGrantMembershipException] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Receipt modal state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Refund Management State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundPayment, setRefundPayment] = useState<PaymentItem | null>(null);
  const [refundAction, setRefundAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [refundReference, setRefundReference] = useState('');
  const [refundRejectionReason, setRefundRejectionReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Gateway Testing State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testAmountInput, setTestAmountInput] = useState<string>('1');
  const [testOrder, setTestOrder] = useState<any>(null);
  const [creatingTestOrder, setCreatingTestOrder] = useState(false);
  const [checkingTestStatus, setCheckingTestStatus] = useState(false);
  const [testPaymentStatus, setTestPaymentStatus] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const { success, error, info } = useToast();

  const handleCreateTestOrder = async (amt: number) => {
    try {
      setCreatingTestOrder(true);
      setTestPaymentStatus(null);
      const res = await paymentService.createOrder({
        amount: amt,
        isCustomAmount: true,
        isTestTransaction: true,
        planId: 'gateway-test',
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
      }, 3500);
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
        testClassification: classificationFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res.data.success) {
        setPayments(res.data.data.payments || []);
        setStats(res.data.data.stats || {});
        setTotalPages(res.data.data.pagination?.pages || 1);
        setTotalCount(res.data.data.pagination?.total || 0);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to fetch payment records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, typeFilter, classificationFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  const handleOpenActionModal = (payment: PaymentItem, action: 'APPROVE' | 'REJECT') => {
    setSelectedPayment(payment);
    setSelectedAction(action);
    setGrantMembershipException(false);
    setAdminNotes(action === 'APPROVE' ? 'Cash verified at library desk' : '');
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
          grantMembershipException: selectedAction === 'APPROVE' ? grantMembershipException : undefined,
        });

        if (res.data.success) {
          success(
            selectedAction === 'APPROVE'
              ? 'Offline cash payment approved & recorded!'
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
              ? 'Online payment verified & membership updated!'
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

  const handleOpenRefundModal = (payment: PaymentItem, action: 'APPROVE' | 'REJECT') => {
    setRefundPayment(payment);
    setRefundAction(action);
    setRefundReference('');
    setRefundRejectionReason('');
    setRefundModalOpen(true);
  };

  const handleConfirmRefundAction = async () => {
    if (!refundPayment || submittingRefund) return;
    try {
      setSubmittingRefund(true);
      const res = await paymentService.adminProcessRefund(refundPayment.orderId, {
        action: refundAction,
        refundReference: refundAction === 'APPROVE' ? refundReference.trim() || undefined : undefined,
        rejectionReason: refundAction === 'REJECT' ? refundRejectionReason.trim() || undefined : undefined,
      });
      if (res.data.success) {
        success(refundAction === 'APPROVE' ? 'Refund approved & processed!' : 'Refund request rejected.');
        setRefundModalOpen(false);
        setRefundPayment(null);
        fetchPayments();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Refund action failed');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleViewReceipt = async (orderId: string) => {
    try {
      setLoadingReceipt(true);
      setReceiptModalOpen(true);
      const res = await paymentService.getPaymentReceipt(orderId);
      if (res.data.success) {
        setReceiptData(res.data.data);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load official receipt');
      setReceiptModalOpen(false);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const totalCollected = stats.totalCollected || 0;
  const pendingOffline = stats.pendingOfflineApproval || 0;
  const onlineSuccess = stats.onlineSuccess || 0;
  const offlineApproved = stats.offlineApproved || 0;
  const totalFailed = stats.totalFailed || 0;
  const customPayments = stats.customPayments || 0;
  const monthlyPayments = stats.monthlyPayments || 0;
  const testTransactions = stats.testTransactions || 0;
  const testRevenue = stats.testRevenue || 0;
  const pendingRefundRequests = stats.pendingRefundRequestsCount || 0;
  const totalRefundedAmount = stats.totalRefundedAmount || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CreditCard className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Membership Payments & Approvals
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Ledger • ₹500 Standard
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
              Real-time audit log of student online UPI transactions, desk cash approvals, partial payment balances, and gateway test orders.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => {
                setTestModalOpen(true);
                if (!testOrder) {
                  handleCreateTestOrder(Number(testAmountInput) || 1);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Test Gateway (₹1 / Custom)</span>
            </button>
            <button
              type="button"
              onClick={fetchPayments}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Total Verified Revenue
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
            ₹{totalCollected.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5">
            {onlineSuccess} online + {offlineApproved} cash verified
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">
              Pending Desk Approvals
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-amber-700 dark:text-amber-400 tabular-nums">
            {pendingOffline}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Requires Admin verification at desk
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Active Payment Breakdown
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <FileCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">
            {monthlyPayments} Monthly <span className="text-slate-400 font-normal">/</span> {customPayments} Custom
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Standard ₹500 passes vs partial custom payments
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Gateway Tests (Separate)
            </span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
            {testTransactions} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">(₹{testRevenue} tested)</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Excluded from student revenue & balances
          </div>
        </div>
      </div>

      {/* Refund Requests Alert Banner */}
      {pendingRefundRequests > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <strong className="text-sm font-bold text-rose-800 dark:text-rose-200">{pendingRefundRequests} Pending Refund Request{pendingRefundRequests > 1 ? 's' : ''}</strong>
              <p className="text-xs text-rose-700 dark:text-rose-300">Student(s) have requested a refund. Total refunded to date: ₹{totalRefundedAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setStatusFilter('SUCCESS'); setPage(1); }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shrink-0"
          >
            Review
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Method and Classification Filter Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Channels (Online & Offline)</option>
              <option value="ONLINE">Online Payments Only (UPI)</option>
              <option value="OFFLINE">Offline Cash Desk Only</option>
            </select>

            <select
              value={classificationFilter}
              onChange={(e) => {
                setClassificationFilter(e.target.value as any);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Records (Prod & Test)</option>
              <option value="PROD">Production Students Only</option>
              <option value="TEST">Gateway Test Orders Only</option>
            </select>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-96">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student, ID, UTR, Order, Receipt..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
            >
              Search
            </button>
          </form>
        </div>

        {/* Status Quick Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">Status:</span>
          {[
            { id: 'ALL', label: 'All Transactions' },
            { id: 'PENDING_APPROVAL', label: `Desk Approvals (${pendingOffline})` },
            { id: 'PENDING', label: 'Processing' },
            { id: 'SUCCESS', label: 'Online Success' },
            { id: 'APPROVED', label: 'Desk Approved' },
            { id: 'REJECTED', label: 'Rejected / Failed' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-sm flex flex-col items-center justify-center">
            <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            Loading transaction ledger...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-sm space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No payment records found.</p>
            <p className="text-xs">Try adjusting your search criteria or filter selections.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Order / Receipt</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Method & Type</th>
                  <th className="py-3.5 px-4">Amount & Balance</th>
                  <th className="py-3.5 px-4">UTR / Gateway Ref</th>
                  <th className="py-3.5 px-4">Date & Time (IST)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p) => {
                  const s = (p.status || 'PENDING').toUpperCase();
                  const isSuccess = s === 'SUCCESS' || s === 'APPROVED';
                  return (
                    <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      {/* Order Ref & Receipt Number */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {p.orderId}
                        </div>
                        {p.receiptNumber && (
                          <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            <Receipt className="w-3 h-3" /> {p.receiptNumber}
                          </div>
                        )}
                        {p.isTestTransaction && (
                          <span className="mt-1 inline-block text-[10px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-300 dark:border-purple-800">
                            TEST TRANSACTION
                          </span>
                        )}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {p.studentName}
                        </div>
                        {p.studentIdNumber && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                            ID: {p.studentIdNumber}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.studentEmail}</div>
                        {p.studentPhone && (
                          <div className="text-[10px] text-slate-400">{p.studentPhone}</div>
                        )}
                      </td>

                      {/* Method & Type */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {p.paymentType === 'OFFLINE' ? (
                            <>
                              <Building2 className="w-3.5 h-3.5 text-purple-500" />
                              <span>Cash Desk</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Online UPI</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Amount & Remaining Balance */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 dark:text-white text-sm tabular-nums">
                          ₹{p.amount}
                        </div>
                        {p.isCustomAmount || p.amount !== 500 ? (
                          <div className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded inline-block border border-amber-200 dark:border-amber-800">
                            Custom Partial
                            {p.membershipRemainingBalance !== undefined && (
                              <span className="ml-1 text-slate-500 dark:text-slate-400">
                                (Rem: ₹{p.membershipRemainingBalance})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded inline-block border border-emerald-200 dark:border-emerald-800">
                            Monthly Pass (1 Mo)
                          </div>
                        )}
                      </td>

                      {/* UTR / Reference */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {p.utr ? (
                          <span className="font-semibold text-slate-900 dark:text-amber-300">{p.utr}</span>
                        ) : p.gatewayPaymentId ? (
                          <span className="text-[11px] text-slate-500">{p.gatewayPaymentId}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Accurate Timestamps in IST */}
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {formatISTDateTime(p.orderCreatedTime || p.createdAt)}
                        </div>
                        {p.verifiedAt && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Verified: {formatISTDateTime(p.verifiedAt)}
                          </div>
                        )}
                      </td>

                      {/* Status Badges */}
                      <td className="py-3.5 px-4">
                        {(s === 'SUCCESS' || s === 'APPROVED') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {s === 'APPROVED' ? 'Approved' : 'Success'}
                          </span>
                        )}
                        {s === 'PENDING_APPROVAL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                            <Clock className="w-3.5 h-3.5" /> Desk Review
                          </span>
                        )}
                        {s === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                            <Clock className="w-3.5 h-3.5 animate-pulse" /> Processing
                          </span>
                        )}
                        {(s === 'REJECTED' || s === 'FAILED' || s === 'EXPIRED' || s === 'CANCELLED') && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                            title={p.adminRejectionReason}
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            {s === 'REJECTED' ? 'Rejected' : 'Failed'}
                          </span>
                        )}
                        {/* Refund Status Badge */}
                        {p.refundStatus && (
                          <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.refundStatus === 'REFUNDED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                              : p.refundStatus === 'REFUND_REJECTED'
                              ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800'
                          }`}>
                            {p.refundStatus === 'REFUNDED' ? '↩ Refunded' :
                             p.refundStatus === 'REFUND_REQUESTED' ? '⚑ Refund Req.' :
                             p.refundStatus === 'REFUND_REJECTED' ? '✕ Refund Rej.' :
                             p.refundStatus.replace('REFUND_', '').replace(/_/g, ' ')}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status === 'PENDING_APPROVAL' && (
                            <button
                              type="button"
                              onClick={() => handleOpenActionModal(p, 'APPROVE')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                            >
                              Review Cash
                            </button>
                          )}

                          {isSuccess && (
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(p.orderId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              title="Print official receipt"
                            >
                              <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Receipt</span>
                            </button>
                          )}

                          {p.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleOpenActionModal(p, 'APPROVE')}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              Verify
                            </button>
                          )}
                          {/* Refund Action Button */}
                          {isSuccess && p.refundStatus === 'REFUND_REQUESTED' && (
                            <button
                              type="button"
                              onClick={() => handleOpenRefundModal(p, 'APPROVE')}
                              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              Showing Page <strong className="text-slate-900 dark:text-white">{page}</strong> of{' '}
              <strong className="text-slate-900 dark:text-white">{totalPages}</strong> ({totalCount} records)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Review Modal (Offline Cash & Online Verification) */}
      {actionModalOpen && selectedPayment && (
        <Modal
          isOpen={actionModalOpen}
          onClose={() => setActionModalOpen(false)}
          title={`Review ${selectedPayment.paymentType === 'OFFLINE' ? 'Offline Cash' : 'Online'} Payment`}
        >
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Student:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedPayment.studentName} ({selectedPayment.studentIdNumber || 'No ID'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Amount:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                  ₹{selectedPayment.amount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Channel / Method:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedPayment.paymentType} • {selectedPayment.offlineMethod || 'UPI'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Order Reference:</span>
                <span className="font-mono text-slate-900 dark:text-white">{selectedPayment.orderId}</span>
              </div>
              {selectedPayment.utr && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">UTR / Ref:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {selectedPayment.utr}
                  </span>
                </div>
              )}
            </div>

            {/* Action Selector */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
              <button
                type="button"
                onClick={() => setSelectedAction('APPROVE')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedAction === 'APPROVE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Approve Payment
              </button>
              <button
                type="button"
                onClick={() => setSelectedAction('REJECT')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedAction === 'REJECT'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Reject Request
              </button>
            </div>

            {selectedAction === 'APPROVE' ? (
              <div className="space-y-3">
                {selectedPayment.amount < 500 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                      This payment is ₹{selectedPayment.amount} (less than ₹500 standard monthly fee). By default, it will be credited to student's balance as a partial payment.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={grantMembershipException}
                        onChange={(e) => setGrantMembershipException(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Admin Exception: Grant Full 1-Month Renewal Anyway
                      </span>
                    </label>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Approval Remarks
                  </label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="e.g. Received ₹500 cash at library desk"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rejection Reason (will be shown to student)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Cash was not received at desk / Invalid reference"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleConfirmAction}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition ${
                  selectedAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingAction ? 'Processing...' : `Confirm ${selectedAction}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Refund Processing Modal */}
      {refundModalOpen && refundPayment && (
        <Modal
          isOpen={refundModalOpen}
          onClose={() => setRefundModalOpen(false)}
          title="Process Refund Request"
        >
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Student:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {refundPayment.studentName} ({refundPayment.studentIdNumber || 'No ID'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Refund Amount:</span>
                <span className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                  ₹{refundPayment.amount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Order ID:</span>
                <span className="font-mono text-slate-900 dark:text-white">{refundPayment.orderId}</span>
              </div>
              {refundPayment.refundReason && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/50">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block mb-0.5">Student's Reason:</span>
                  <p className="text-xs text-rose-900 dark:text-rose-200">{refundPayment.refundReason}</p>
                </div>
              )}
            </div>

            {/* Action Toggle */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
              <button
                type="button"
                onClick={() => setRefundAction('APPROVE')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  refundAction === 'APPROVE'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Approve & Refund
              </button>
              <button
                type="button"
                onClick={() => setRefundAction('REJECT')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  refundAction === 'REJECT'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Reject Request
              </button>
            </div>

            {refundAction === 'APPROVE' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Approving this refund will mark the payment as <strong>REFUNDED</strong>, reverse any membership extension granted, and adjust the student's payment balance.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Refund Reference / UTR (Optional)
                  </label>
                  <input
                    type="text"
                    value={refundReference}
                    onChange={(e) => setRefundReference(e.target.value)}
                    placeholder="e.g. Bank UTR, UPI Ref, or Cash Refund ID"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={refundRejectionReason}
                  onChange={(e) => setRefundRejectionReason(e.target.value)}
                  placeholder="e.g. Policy does not permit refunds after 7 days"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRefund}
                onClick={handleConfirmRefundAction}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                {submittingRefund ? 'Processing...' : `Confirm ${refundAction === 'APPROVE' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Official Printable Receipt Modal */}
      {receiptModalOpen && (
        <Modal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          title="Official Payment Receipt"
        >
          {loadingReceipt || !receiptData ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading verified receipt...
            </div>
          ) : (
            <div className="space-y-4 print:p-0">
              {/* Receipt Document Card */}
              <div id="printable-receipt" className="p-6 bg-white border border-slate-300 rounded-2xl text-slate-900 font-sans space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <img src="/Logo.png" alt="Lakshya Smart Library" className="w-10 h-10 object-contain rounded-lg border border-slate-200 p-0.5" />
                    <div>
                      <h3 className="font-extrabold text-base tracking-tight text-slate-900">
                        {receiptData.organization.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">{receiptData.organization.tagline}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                      Paid & Verified
                    </span>
                    <p className="font-mono text-xs font-bold text-slate-800 mt-1">
                      {receiptData.receiptNumber}
                    </p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Billed To:</span>
                    <strong className="text-slate-900 text-sm block">{receiptData.studentName}</strong>
                    <span className="text-slate-600 block text-[11px]">{receiptData.studentEmail}</span>
                    {receiptData.studentIdNumber && (
                      <span className="text-emerald-700 font-mono font-bold block text-[11px]">
                        ID: {receiptData.studentIdNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[11px]">Date & Time (IST):</span>
                    <strong className="text-slate-900 block text-xs">
                      {formatISTDateTime(receiptData.paymentCompletedAt || receiptData.verifiedAt)}
                    </strong>
                    <span className="text-slate-500 block text-[11px] mt-1">Payment Channel:</span>
                    <strong className="text-slate-800 text-xs">
                      {receiptData.paymentType === 'OFFLINE' ? 'Cash at Desk' : 'Online UPI'}
                    </strong>
                  </div>
                </div>

                {/* Line Item Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between text-xs font-bold text-slate-700">
                    <span>Description</span>
                    <span>Amount</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-slate-900 block">{receiptData.planName}</strong>
                      <span className="text-slate-500 text-[11px]">
                        Order Ref: {receiptData.orderId}
                        {receiptData.utr ? ` • UTR: ${receiptData.utr}` : ''}
                      </span>
                    </div>
                    <span className="text-base font-black text-slate-900">
                      ₹{Number(receiptData.amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Total & Accounting */}
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs">
                  <div>
                    {receiptData.membershipRenewed ? (
                      <span className="text-emerald-700 font-bold">
                        ✓ Membership renewed for 1 calendar month
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold">
                        Partial payment credited. Remaining balance: ₹{receiptData.membershipRemainingBalance ?? 0}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 text-[11px] block">Total Amount Paid</span>
                    <span className="text-xl font-black text-emerald-600">
                      ₹{Number(receiptData.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
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
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-800 dark:text-purple-200 space-y-1">
              <strong className="block font-bold">Safe Gateway Diagnostic Mode</strong>
              <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
                Test transactions verify end-to-end UPI URI generation, vector QR rendering, app intent hooks, and webhook verification. Test transactions do not renew memberships or inflate student balances.
              </p>
            </div>

            {/* Test Amount Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Test Payment Amount (₹):
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    value={testAmountInput}
                    onChange={(e) => setTestAmountInput(e.target.value)}
                    placeholder="e.g. 1, 2, 5"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={creatingTestOrder}
                  onClick={() => handleCreateTestOrder(Number(testAmountInput) || 1)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer shrink-0"
                >
                  {creatingTestOrder ? 'Generating...' : 'Create Test QR'}
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400">Presets:</span>
                {[1, 2, 5, 10].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setTestAmountInput(String(val));
                      handleCreateTestOrder(val);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      Number(testAmountInput) === val
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    ₹{val}
                  </button>
                ))}
              </div>
            </div>

            {testOrder && (
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                {/* Clean Vector SVG QR Code */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 inline-flex items-center justify-center">
                    {testOrder.qrSvg ? (
                      <div
                        className="w-[180px] h-[180px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: testOrder.qrSvg }}
                      />
                    ) : (
                      <div className="w-[180px] h-[180px] flex items-center justify-center text-xs text-slate-400">
                        Loading QR...
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-xs font-bold text-slate-900 dark:text-white">
                    Amount: <span className="text-emerald-600 dark:text-emerald-400">₹{testOrder.amount}</span> • Order:{' '}
                    <span className="font-mono text-[11px]">{testOrder.orderId}</span>
                  </div>
                </div>

                {/* 1-Tap App Intent Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <a
                    href={`phonepe://pay?pa=9955008447-7@axl&pn=Lakshya%20Smart%20Library&am=${testOrder.amount}&cu=INR&tn=Gateway%20Test&tr=${testOrder.orderId}`}
                    className="py-2 px-2 text-center text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    PhonePe
                  </a>
                  <a
                    href={`gpay://upi/pay?pa=9955008447-7@axl&pn=Lakshya%20Smart%20Library&am=${testOrder.amount}&cu=INR&tn=Gateway%20Test&tr=${testOrder.orderId}`}
                    className="py-2 px-2 text-center text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    Google Pay
                  </a>
                  <a
                    href={`paytmmp://pay?pa=9955008447-7@axl&pn=Lakshya%20Smart%20Library&am=${testOrder.amount}&cu=INR&tn=Gateway%20Test&tr=${testOrder.orderId}`}
                    className="py-2 px-2 text-center text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    Paytm
                  </a>
                  <a
                    href={`upi://pay?pa=9955008447-7@axl&pn=Lakshya%20Smart%20Library&am=${testOrder.amount}&cu=INR&tn=Gateway%20Test&tr=${testOrder.orderId}`}
                    className="py-2 px-2 text-center text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800"
                  >
                    Any UPI
                  </a>
                </div>

                {/* Real-time Status Banner */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 text-emerald-500 ${checkingTestStatus ? 'animate-spin' : ''}`} />
                    <span>
                      Status:{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400 uppercase">
                        {testPaymentStatus || 'Awaiting Payment'}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={checkingTestStatus}
                    onClick={() => pollTestStatus(testOrder.orderId)}
                    className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg font-bold text-[11px] cursor-pointer"
                  >
                    Check Now
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
