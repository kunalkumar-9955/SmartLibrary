import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Receipt,
  X,
  CreditCard,
  Building2,
  Calendar,
  FileText,
  Upload,
  AlertTriangle,
  Info,
  BadgeAlert,
} from 'lucide-react';
import { paymentService } from '../../services/api';
import { PaymentItem, StudentMembershipOverview, OfflinePaymentMethod } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export const StudentMembershipPage: React.FC = () => {
  const [membershipData, setMembershipData] = useState<StudentMembershipOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');

  // Option A (Online Payment) State
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<{
    orderId: string;
    amount: number;
    planName: string;
    checkoutUrl?: string;
  } | null>(null);
  const [utr, setUtr] = useState('');
  const [onlineNotes, setOnlineNotes] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<'INITIAL' | 'PENDING' | 'SUCCESS' | 'FAILED'>('INITIAL');
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Option B (Offline Payment) State
  const [offlineMethod, setOfflineMethod] = useState<OfflinePaymentMethod>('CASH');
  const [offlineUtr, setOfflineUtr] = useState('');
  const [offlineDate, setOfflineDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [offlineRemarks, setOfflineRemarks] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submittingOffline, setSubmittingOffline] = useState(false);
  const [offlineSubmitted, setOfflineSubmitted] = useState(false);
  const [offlineSubmittedOrderId, setOfflineSubmittedOrderId] = useState<string | null>(null);

  const { success, error, info } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const myPaymentsRes = await paymentService.getMyPayments();
      if (myPaymentsRes.data.success) {
        setMembershipData(myPaymentsRes.data.data);
      }
    } catch (err: any) {
      error('Failed to load membership details: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fast modal opening with immediate ₹500 fee display and asynchronous order creation
  const handleOpenPaymentModal = (tab: 'ONLINE' | 'OFFLINE' = 'ONLINE') => {
    setActiveTab(tab);
    setIsModalOpen(true);
    setOrderError(null);
    setOnlineStatus('INITIAL');
    setOfflineSubmitted(false);

    if (tab === 'ONLINE' && !activeOrder) {
      createOnlineOrder();
    }
  };

  const createOnlineOrder = async () => {
    try {
      setCreatingOrder(true);
      setOrderError(null);
      const idempotencyKey = `idem_monthly_${Date.now()}`;
      const res = await paymentService.createOrder({
        planId: 'monthly-membership',
        idempotencyKey,
      });

      if (res.data.success) {
        setActiveOrder({
          orderId: res.data.data.orderId,
          amount: res.data.data.amount,
          planName: res.data.data.planName,
          checkoutUrl: res.data.data.checkoutUrl,
        });
      }
    } catch (err: any) {
      setOrderError(err.response?.data?.message || 'Could not initialize gateway order. You can still scan the QR directly below.');
    } finally {
      setCreatingOrder(false);
    }
  };

  // Submit UTR for Online Payment
  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;

    const cleanUtr = utr.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      error('Please enter a valid 12-digit UPI Reference / UTR number');
      return;
    }

    try {
      setSubmittingUtr(true);
      const res = await paymentService.submitUtr({
        orderId: activeOrder.orderId,
        utr: cleanUtr,
        notes: onlineNotes.trim() || undefined,
      });

      if (res.data.success) {
        setOnlineStatus('PENDING');
        success('UPI Reference submitted! Verifying transaction...');
        fetchData();
        pollStatus(activeOrder.orderId);
      }
    } catch (err: any) {
      error('UTR Submission error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingUtr(false);
    }
  };

  // Poll online payment status
  const pollStatus = async (orderId: string) => {
    try {
      setCheckingStatus(true);
      const res = await paymentService.getOrderStatus(orderId);
      if (res.data.success) {
        const status = res.data.data.status;
        if (status === 'SUCCESS' || status === 'APPROVED') {
          setOnlineStatus('SUCCESS');
          success('Payment Verified & Monthly Membership Renewed!');
          fetchData();
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          setOnlineStatus('FAILED');
          error('Payment was marked as failed or cancelled.');
        } else {
          info('Payment status is still PENDING. Verification in progress.');
        }
      }
    } catch (err: any) {
      console.warn('Poll status error:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Submit Offline Payment Request
  const handleSubmitOffline = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmittingOffline(true);
      const formData = new FormData();
      formData.append('paymentMethod', offlineMethod);
      if (offlineUtr.trim()) formData.append('utr', offlineUtr.trim());
      formData.append('paymentDate', offlineDate);
      if (offlineRemarks.trim()) formData.append('remarks', offlineRemarks.trim());
      if (receiptFile) formData.append('receipt', receiptFile);

      const res = await paymentService.submitOfflineRequest(formData);

      if (res.data.success) {
        setOfflineSubmitted(true);
        setOfflineSubmittedOrderId(res.data.data.orderId);
        success('Offline payment request submitted for Admin approval!');
        fetchData();
      }
    } catch (err: any) {
      error('Failed to submit offline request: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingOffline(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active Member
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> 5-Day Grace Period
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <BadgeAlert className="w-3.5 h-3.5" /> Membership Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> No Active Plan
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium">Loading membership status...</p>
      </div>
    );
  }

  const membership = membershipData?.membership;
  const payments = membershipData?.payments || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-2 sm:px-6">
      {/* Header & Status Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Monthly Library Membership
              </h1>
              {getStatusBadge(membership?.status)}
            </div>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
              Fixed ₹500 monthly pass with complete library access, high-speed WiFi, reserved desk seating, and sovereign UPI QR settlement.
            </p>
          </div>

          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 flex flex-col sm:items-end">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Monthly Fee
            </span>
            <span className="text-2xl font-black text-emerald-400">
              ₹500 <span className="text-xs text-slate-400 font-normal">/ month</span>
            </span>
            {membership?.expiresAt && (
              <span className="text-xs text-slate-300 mt-1">
                Expiry:{' '}
                <strong className="text-white">
                  {new Date(membership.expiresAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </span>
            )}
            {membership?.status === 'GRACE_PERIOD' && membership.gracePeriodExpiresAt && (
              <span className="text-[11px] text-amber-400 font-medium mt-1">
                Grace ends:{' '}
                {new Date(membership.gracePeriodExpiresAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Pending Offline Request Warning Banner */}
        {membership?.hasPendingOfflineRequest && (
          <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs sm:text-sm">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-200">
                Offline Payment Request Pending Admin Approval
              </strong>
              <span>
                Your offline payment request (Ref: {membership.pendingOfflineOrderId}) has been submitted and is currently being reviewed by library administration. Your membership will be renewed only after approval.
              </span>
            </div>
          </div>
        )}

        {/* 5-Day Grace Period Alert */}
        {membership?.status === 'GRACE_PERIOD' && (
          <div className="mt-5 p-4 rounded-xl bg-amber-900/20 border border-amber-500/40 flex items-start gap-3 text-amber-200 text-xs sm:text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong className="font-bold block text-amber-300">
                Membership in 5-Day Renewal Grace Period
              </strong>
              <span>
                Your monthly membership has expired. You have 5 days to complete renewal of your ₹500 membership. You can pay online via UPI or submit an offline payment request before the grace period ends.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Single Fixed ₹500 Monthly Membership Plan Card */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Lakshya Monthly Membership Pass
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Exactly one monthly membership plan at ₹500 only. No hidden charges or separate tiers.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-b from-slate-800/90 to-slate-900 border border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-xl max-w-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 mb-2">
                Official Monthly Plan
              </div>
              <h3 className="text-2xl font-black text-white">Monthly Library Membership</h3>
              <p className="text-xs text-slate-400 mt-1">Calendar-month renewal with 5-calendar-day grace period</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-3xl sm:text-4xl font-extrabold text-white">₹500</span>
              <span className="text-xs text-slate-400 block font-medium">per month</span>
            </div>
          </div>

          <div className="py-6 space-y-3">
            {[
              'Full 1 Calendar Month Library Access',
              'Reserved Desk & Ergonomic Study Seat',
              'High-Speed Wi-Fi & Power Outlets',
              'QR Scanner Attendance Logging',
              '5-Calendar-Day Renewal Grace Period',
              'Two Payment Choices: Instant Online UPI or Offline Approval',
            ].map((feat, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </div>

          {/* Two Prominent Action Buttons: Online or Offline */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleOpenPaymentModal('ONLINE')}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Option A: Pay Online (UPI)</span>
            </button>
            <button
              onClick={() => handleOpenPaymentModal('OFFLINE')}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 flex items-center justify-center gap-2 transition"
            >
              <Building2 className="w-4 h-4 text-purple-400" />
              <span>Option B: Offline Payment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment & Renewal History */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-slate-400" /> Payment & Renewal History
          </h2>
          <button
            onClick={fetchData}
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            No transaction records found yet. Pay or renew above to start your membership.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Reference / UTR</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono text-xs text-slate-200">
                      {p.orderId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {p.paymentType || 'ONLINE'} {p.offlineMethod ? `(${p.offlineMethod})` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">₹{p.amount}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">
                      {p.utr || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {new Date(p.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      {p.status === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          SUCCESS
                        </span>
                      )}
                      {p.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          APPROVED
                        </span>
                      )}
                      {p.status === 'PENDING_APPROVAL' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          PENDING APPROVAL
                        </span>
                      )}
                      {p.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20" title={p.adminRejectionReason}>
                          REJECTED
                        </span>
                      )}
                      {p.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          PENDING
                        </span>
                      )}
                      {['FAILED', 'EXPIRED', 'CANCELLED'].includes(p.status) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {p.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two-Option Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                  ₹
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Lakshya Library Membership Payment
                  </h3>
                  <p className="text-xs text-slate-400">
                    Monthly Membership Fee: <strong className="text-emerald-400">₹500 only</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selection */}
            <div className="flex border-b border-slate-800 bg-slate-950/50">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ONLINE');
                  if (!activeOrder) createOnlineOrder();
                }}
                className={`flex-1 py-3 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${
                  activeTab === 'ONLINE'
                    ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Option A: Online Payment</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('OFFLINE')}
                className={`flex-1 py-3 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${
                  activeTab === 'OFFLINE'
                    ? 'text-purple-400 border-purple-500 bg-purple-500/5'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Option B: Offline Payment</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Fee Banner */}
              <div className="bg-gradient-to-r from-emerald-950/30 via-slate-800 to-slate-800 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold">
                    Amount to Pay
                  </span>
                  <span className="text-2xl font-black text-white">₹500</span>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold">
                    Plan
                  </span>
                  <span className="text-xs font-semibold text-emerald-300">
                    1 Month Library Membership
                  </span>
                </div>
              </div>

              {/* TAB 1: OPTION A — ONLINE PAYMENT */}
              {activeTab === 'ONLINE' && (
                <div className="space-y-5">
                  {onlineStatus === 'SUCCESS' ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center space-y-3">
                      <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-white">Payment Confirmed!</h4>
                      <p className="text-xs text-slate-300">
                        Your ₹500 online payment has been verified and your membership has been renewed.
                      </p>
                      <button
                        onClick={() => {
                          setIsModalOpen(false);
                          fetchData();
                        }}
                        className="mt-3 w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition"
                      >
                        Done & Refresh
                      </button>
                    </div>
                  ) : onlineStatus === 'PENDING' ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-center space-y-3">
                      <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Clock className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white">Verification in Progress</h4>
                      <p className="text-xs text-slate-300">
                        Your transaction reference <span className="font-mono text-amber-300">#{utr}</span> is being matched by the gateway observer.
                      </p>
                      <div className="flex gap-2 justify-center pt-2">
                        <button
                          type="button"
                          disabled={checkingStatus}
                          onClick={() => activeOrder && pollStatus(activeOrder.orderId)}
                          className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 border border-slate-700 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                          Check Verification Status
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Authentic PhonePe QR Display */}
                      <div className="flex flex-col items-center justify-center bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-center">
                        <div className="relative p-2 bg-white rounded-2xl shadow-xl max-w-[220px] sm:max-w-[240px] mx-auto">
                          <img
                            src="/api/payments/qr-image"
                            alt="Lakshya Library PhonePe QR"
                            className="w-full h-auto rounded-xl object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/qr/QR.jpeg';
                            }}
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Scan with <strong>PhonePe, GPay, Paytm, or BHIM</strong></span>
                        </div>
                      </div>

                      {orderError && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between">
                          <span>{orderError}</span>
                          <button
                            type="button"
                            onClick={createOnlineOrder}
                            className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded font-semibold text-[11px]"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {/* UTR Form */}
                      <form onSubmit={handleSubmitUtr} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            12-Digit UPI Reference / UTR Number <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={25}
                            placeholder="e.g. 529410849201"
                            value={utr}
                            onChange={(e) => setUtr(e.target.value.replace(/\s+/g, ''))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Remarks (Optional)
                          </label>
                          <input
                            type="text"
                            maxLength={100}
                            placeholder="e.g. Paid via PhonePe"
                            value={onlineNotes}
                            onChange={(e) => setOnlineNotes(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingUtr || !utr.trim()}
                          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                        >
                          {submittingUtr ? (
                            <>
                              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                              <span>Submitting Reference...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Submit UTR for Verification</span>
                            </>
                          )}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: OPTION B — OFFLINE PAYMENT (ADMIN APPROVAL REQUIRED) */}
              {activeTab === 'OFFLINE' && (
                <div className="space-y-5">
                  {offlineSubmitted ? (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6 text-center space-y-3">
                      <div className="w-14 h-14 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-white">Offline Payment Submitted!</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Your offline payment request (Ref: <span className="font-mono text-purple-300">{offlineSubmittedOrderId}</span>) has been submitted for Admin approval.
                      </p>
                      <div className="p-3 bg-slate-800/80 rounded-lg text-[11px] text-amber-300 border border-amber-500/20">
                        CRITICAL: Your membership will be renewed only after an authorized Admin verifies and approves your payment.
                      </div>
                      <button
                        onClick={() => {
                          setIsModalOpen(false);
                          fetchData();
                        }}
                        className="mt-3 w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl transition"
                      >
                        Close & View Status
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitOffline} className="space-y-4">
                      {/* Critical Rule Notice */}
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold block text-amber-200">
                            Admin Approval Required
                          </strong>
                          Submitting this request does not automatically renew your membership. An Admin will verify that payment was received before renewing your access.
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Payment Method / Type <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={offlineMethod}
                          onChange={(e) => setOfflineMethod(e.target.value as OfflinePaymentMethod)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition"
                        >
                          <option value="CASH">Cash Payment at Library Desk</option>
                          <option value="UPI_DIRECT">Direct UPI Transfer to Admin</option>
                          <option value="BANK_TRANSFER">Direct Bank Transfer / NEFT / IMPS</option>
                          <option value="OTHER">Other Offline Arrangement</option>
                        </select>
                      </div>

                      {/* Payment Date */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Payment Date <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={offlineDate}
                          onChange={(e) => setOfflineDate(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition"
                        />
                      </div>

                      {/* UTR / Reference (Optional) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          UTR / Transaction Reference (If Applicable)
                        </label>
                        <input
                          type="text"
                          maxLength={30}
                          placeholder="e.g. 529410849201 or Receipt Number"
                          value={offlineUtr}
                          onChange={(e) => setOfflineUtr(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                        />
                      </div>

                      {/* Optional Receipt Upload */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Receipt / Slip Upload (Optional, JPEG/PNG max 5MB)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setReceiptFile(e.target.files[0]);
                            }
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Remarks */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Remarks / Details (Optional)
                        </label>
                        <input
                          type="text"
                          maxLength={200}
                          placeholder="e.g. Handed cash to librarian at front desk"
                          value={offlineRemarks}
                          onChange={(e) => setOfflineRemarks(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingOffline}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                      >
                        {submittingOffline ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Submitting for Approval...</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4" />
                            <span>Submit Offline Request for Admin Approval</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Lakshya Smart Library Monthly System
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

