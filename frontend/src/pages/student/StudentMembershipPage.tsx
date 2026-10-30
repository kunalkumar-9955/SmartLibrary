import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
  Building2,
  AlertTriangle,
  Info,
  BadgeAlert,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { paymentService } from '../../services/api';
import { PaymentItem, StudentMembershipOverview } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export const StudentMembershipPage: React.FC = () => {
  const [membershipData, setMembershipData] = useState<StudentMembershipOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [paymentMode, setPaymentMode] = useState<'MONTHLY_PLAN' | 'CUSTOM_AMOUNT'>('MONTHLY_PLAN');
  const [customAmountInput, setCustomAmountInput] = useState<string>('200');
  const [offlineAmountInput, setOfflineAmountInput] = useState<string>('500');

  // Option A (Online Payment) State
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<{
    orderId: string;
    amount: number;
    planName: string;
    isCustomAmount?: boolean;
    checkoutUrl?: string;
    upiString?: string;
    upiId?: string;
    merchantName?: string;
    qrSvg?: string;
  } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [showManualUtrFallback, setShowManualUtrFallback] = useState(false);
  const [manualUtr, setManualUtr] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<'INITIAL' | 'PENDING' | 'SUCCESS' | 'FAILED'>('INITIAL');
  const [checkingStatus, setCheckingStatus] = useState(false);

  const DEFAULT_UPI_ID = '9955008447-7@axl';
  const DEFAULT_MERCHANT_NAME = 'Lakshya Smart Library';
  const activeUpiId = activeOrder?.upiId || DEFAULT_UPI_ID;
  const activeMerchant = activeOrder?.merchantName || DEFAULT_MERCHANT_NAME;
  const effectiveAmount = activeOrder?.amount
    ? Number(activeOrder.amount).toFixed(2)
    : (paymentMode === 'CUSTOM_AMOUNT' ? (Number(customAmountInput) || 200).toFixed(2) : '500.00');

  const activeUpiString =
    activeOrder?.upiString ||
    `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activeMerchant)}&am=${effectiveAmount}&cu=INR&tn=${encodeURIComponent(paymentMode === 'CUSTOM_AMOUNT' ? 'Lakshya Library Payment' : 'Lakshya Smart Library Membership')}${activeOrder?.orderId ? `&tr=${activeOrder.orderId}` : ''}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(activeUpiId);
    setCopiedUpi(true);
    success('UPI ID copied to clipboard');
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const getAppIntentUrl = (appScheme: string) => {
    const params = `pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activeMerchant)}&am=${effectiveAmount}&cu=INR&tn=${encodeURIComponent(activeOrder?.isCustomAmount || paymentMode === 'CUSTOM_AMOUNT' ? 'Lakshya Library Payment' : 'Lakshya Smart Library Membership')}${activeOrder?.orderId ? `&tr=${activeOrder.orderId}` : ''}`;
    if (appScheme === 'upi') return `upi://pay?${params}`;
    if (appScheme === 'phonepe') return `phonepe://pay?${params}`;
    if (appScheme === 'gpay') return `gpay://upi/pay?${params}`;
    if (appScheme === 'paytm') return `paytmmp://pay?${params}`;
    return `upi://pay?${params}`;
  };

  const handleManualUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder?.orderId || !manualUtr.trim() || submittingUtr) return;
    try {
      setSubmittingUtr(true);
      const res = await paymentService.submitUtr({
        orderId: activeOrder.orderId,
        utr: manualUtr.trim(),
        notes: 'Submitted via student dashboard',
      });
      if (res.data.success) {
        success('Reference submitted. Verification is in progress.');
        setManualUtr('');
        setShowManualUtrFallback(false);
        pollStatus(activeOrder.orderId, false);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to submit UPI reference.');
    } finally {
      setSubmittingUtr(false);
    }
  };

  // Option B (Offline Payment) State
  const [offlineRemarks, setOfflineRemarks] = useState('');
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

  // Open modal with instant UI rendering and async order preparation
  const handleOpenPaymentModal = (
    tab: 'ONLINE' | 'OFFLINE' = 'ONLINE',
    mode: 'MONTHLY_PLAN' | 'CUSTOM_AMOUNT' = 'MONTHLY_PLAN'
  ) => {
    setActiveTab(tab);
    setPaymentMode(mode);
    setIsModalOpen(true);
    setOrderError(null);
    setOnlineStatus('INITIAL');
    setOfflineSubmitted(false);
    setActiveOrder(null);

    if (tab === 'ONLINE') {
      const initialAmount = mode === 'CUSTOM_AMOUNT' ? (Number(customAmountInput) || 200) : 500;
      createOnlineOrder(initialAmount, mode === 'CUSTOM_AMOUNT');
    }
  };

  const createOnlineOrder = async (targetAmount?: number, isCustom?: boolean) => {
    if (creatingOrder) return;
    try {
      setCreatingOrder(true);
      setOrderError(null);

      const amountToPay = targetAmount !== undefined
        ? targetAmount
        : (paymentMode === 'CUSTOM_AMOUNT' ? Number(customAmountInput) : 500);

      if (!Number.isFinite(amountToPay) || amountToPay < 1) {
        setOrderError('Please enter a valid payment amount of at least ₹1.00');
        return;
      }
      if (amountToPay > 50000) {
        setOrderError('Payment amount cannot exceed ₹50,000.00');
        return;
      }

      const isCustomOrder = isCustom !== undefined ? isCustom : (amountToPay !== 500 || paymentMode === 'CUSTOM_AMOUNT');
      const idempotencyKey = `idem_${isCustomOrder ? 'custom' : 'monthly'}_${Date.now()}_${amountToPay}`;
      const res = await paymentService.createOrder({
        planId: isCustomOrder ? 'custom-amount' : 'monthly-membership',
        amount: amountToPay,
        isCustomAmount: isCustomOrder,
        idempotencyKey,
      });

      if (res.data.success) {
        setActiveOrder({
          orderId: res.data.data.orderId,
          amount: res.data.data.amount || amountToPay,
          planName: res.data.data.planName || (isCustomOrder ? `Custom Payment (₹${amountToPay})` : 'Monthly Library Membership'),
          isCustomAmount: res.data.data.isCustomAmount ?? isCustomOrder,
          checkoutUrl: res.data.data.checkoutUrl,
          upiString: res.data.data.upiString,
          upiId: res.data.data.upiId || DEFAULT_UPI_ID,
          merchantName: res.data.data.merchantName || DEFAULT_MERCHANT_NAME,
          qrSvg: res.data.data.qrSvg,
        });
        setOnlineStatus('PENDING');
      }
    } catch (err: any) {
      setOrderError(
        err.response?.data?.message ||
          'Payment order session could not be established. You can still scan the QR directly.'
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  // Poll online payment status
  const pollStatus = async (orderId: string, showToast = true) => {
    try {
      setCheckingStatus(true);
      const res = await paymentService.getOrderStatus(orderId);
      if (res.data.success) {
        const status = res.data.data.status;
        if (status === 'SUCCESS' || status === 'APPROVED') {
          setOnlineStatus('SUCCESS');
          if (showToast) {
            success(activeOrder?.isCustomAmount ? 'Custom Payment Verified & Credited!' : 'Payment Verified & Monthly Membership Renewed!');
          }
          fetchData();
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          setOnlineStatus('FAILED');
          if (showToast) error('Payment was marked as failed or cancelled.');
        } else {
          if (showToast) info('Payment is being verified. Please wait a moment.');
        }
      }
    } catch (err: any) {
      console.warn('Poll status error:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Automatic background polling every 4 seconds while modal is open in ONLINE mode
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (
      isModalOpen &&
      activeTab === 'ONLINE' &&
      activeOrder?.orderId &&
      onlineStatus !== 'SUCCESS' &&
      onlineStatus !== 'FAILED'
    ) {
      interval = setInterval(() => {
        pollStatus(activeOrder.orderId, false);
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isModalOpen, activeTab, activeOrder, onlineStatus]);

  // Submit Offline Payment Request
  const handleSubmitOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingOffline) return;

    try {
      setSubmittingOffline(true);
      const offlineAmt = Number(offlineAmountInput);
      if (!Number.isFinite(offlineAmt) || offlineAmt < 1) {
        error('Please enter a valid offline amount of at least ₹1.00');
        setSubmittingOffline(false);
        return;
      }
      const res = await paymentService.submitOfflineRequest({
        paymentMethod: 'CASH',
        amount: offlineAmt,
        isCustomAmount: offlineAmt !== 500,
        remarks: offlineRemarks.trim() || undefined,
      });

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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active Member
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> 5-Day Grace Period
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            <BadgeAlert className="w-3.5 h-3.5" /> Membership Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <AlertCircle className="w-3.5 h-3.5" /> No Active Plan
          </span>
        );
    }
  };

  const qrImageUrl = paymentService.getQrImageUrl ? paymentService.getQrImageUrl() : '/api/payments/qr-image';

  if (loading) {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
        <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium">Loading membership status...</p>
      </div>
    );
  }

  const membership = membershipData?.membership;
  const payments = membershipData?.payments || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-4 sm:px-6 font-sans">
      {/* Header & Status Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Membership & Pass Renewal
              </h1>
              {getStatusBadge(membership?.status)}
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
              Standard ₹500 monthly pass with complete library access, high-speed Wi-Fi, reserved study desk, and instant QR attendance check-in.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex flex-col sm:items-end shrink-0">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Monthly Fee
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹500 <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">/ month</span>
            </span>
            {membership?.expiresAt && (
              <span className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Expiry:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {new Date(membership.expiresAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </span>
            )}
            {membership?.status === 'GRACE_PERIOD' && membership.gracePeriodExpiresAt && (
              <span className="text-[11px] text-amber-600 dark:text-amber-300 font-semibold mt-1">
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
          <div className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs sm:text-sm">
            <Info className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-900 dark:text-amber-100">
                Offline Payment Request Pending Admin Approval
              </strong>
              <span>
                Your offline payment request (Ref: {membership.pendingOfflineOrderId}) has been submitted and is currently being reviewed by library administration. Your membership will be renewed once approved.
              </span>
            </div>
          </div>
        )}

        {/* 5-Day Grace Period Alert */}
        {membership?.status === 'GRACE_PERIOD' && (
          <div className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs sm:text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong className="font-bold block text-amber-900 dark:text-amber-100">
                Membership in 5-Day Renewal Grace Period
              </strong>
              <span>
                Your monthly membership has expired. You have a 5-calendar-day grace period to renew your ₹500 membership. Choose Option A to pay online or Option B for offline payment.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Single Fixed ₹500 Monthly Membership Plan Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 mb-2">
              Official Plan
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Monthly Library Membership
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Fixed ₹500/month with 1 full calendar-month renewal and 5-calendar-day grace period
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">₹500</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">per month</span>
          </div>
        </div>

        <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            'Full 1 Calendar Month Library Access',
            'Reserved Desk & Comfortable Study Chair',
            'High-Speed Wi-Fi & Charging Sockets',
            'QR Attendance Logging',
            '5-Day Renewal Grace Period',
            'Online (UPI) & Offline (Cash Desk) Payment',
          ].map((feat, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* Three Action Buttons: Monthly Pass, Custom Amount, Offline */}
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleOpenPaymentModal('ONLINE', 'MONTHLY_PLAN')}
            className="w-full py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span>Pay ₹500 (Monthly Pass)</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenPaymentModal('ONLINE', 'CUSTOM_AMOUNT')}
            className="w-full py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Pay Custom Amount</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenPaymentModal('OFFLINE')}
            className="w-full py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Offline Cash (Desk)</span>
          </button>
        </div>
      </div>

      {/* Payment & Renewal History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-slate-400" /> Payment & Renewal History
          </h2>
          <button
            type="button"
            onClick={fetchData}
            aria-label="Refresh transaction history"
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">
            No transaction records found yet. Click Pay Online or Offline above to start your membership.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th scope="col" className="py-3 px-4 text-left">Order Ref</th>
                  <th scope="col" className="py-3 px-4 text-left">Type</th>
                  <th scope="col" className="py-3 px-4 text-left">Amount</th>
                  <th scope="col" className="py-3 px-4 text-left">Reference / UTR</th>
                  <th scope="col" className="py-3 px-4 text-left">Date</th>
                  <th scope="col" className="py-3 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-left">
                {payments.map((p) => {
                  const s = (p.status || 'PENDING').toUpperCase();
                  return (
                    <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-slate-200">
                        <abbr title={p.orderId} className="no-underline cursor-help">
                          {p.orderId.length > 20
                            ? `${p.orderId.slice(0, 11)}…${p.orderId.slice(-6)}`
                            : p.orderId}
                        </abbr>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {p.isCustomAmount || p.amount !== 500
                          ? `Custom ${p.paymentType === 'OFFLINE' ? 'Cash' : 'Online'}`
                          : (p.paymentType === 'OFFLINE' ? 'Offline (Cash)' : 'Online (UPI)')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white tabular-nums">
                        ₹{p.amount}
                        {p.isCustomAmount || p.amount !== 500 ? (
                          <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                            (Custom)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {p.utr || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        {(s === 'SUCCESS' || s === 'APPROVED') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            {s === 'APPROVED' ? 'Approved' : 'Completed'}
                          </span>
                        )}
                        {s === 'PENDING_APPROVAL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                            <Clock className="w-3 h-3" /> Pending Approval
                          </span>
                        )}
                        {s === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                            <Clock className="w-3 h-3 animate-pulse" /> Processing
                          </span>
                        )}
                        {(s === 'REJECTED' || s === 'FAILED' || s === 'EXPIRED' || s === 'CANCELLED') && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                            title={p.adminRejectionReason}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {s === 'REJECTED' ? 'Rejected' : 'Failed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two-Option Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center font-bold">
                  ₹
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Library Membership Payment
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Monthly Fee: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₹500 only</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selection */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ONLINE');
                  if (!activeOrder) createOnlineOrder();
                }}
                className={`flex-1 py-3 px-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
                  activeTab === 'ONLINE'
                    ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Option A: Online (UPI)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('OFFLINE')}
                className={`flex-1 py-3 px-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
                  activeTab === 'OFFLINE'
                    ? 'text-purple-600 dark:text-purple-400 border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Option B: Offline (Cash)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              {/* Fee Banner */}
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-semibold">
                    Amount Due
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    ₹{activeOrder?.amount ?? (paymentMode === 'CUSTOM_AMOUNT' ? (customAmountInput || '200') : '500')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-semibold">
                    {activeOrder?.isCustomAmount || paymentMode === 'CUSTOM_AMOUNT' ? 'Payment Type' : 'Plan Duration'}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {activeOrder?.isCustomAmount || paymentMode === 'CUSTOM_AMOUNT' ? 'Custom Amount Payment' : '1 Month Library Access'}
                  </span>
                </div>
              </div>

              {/* TAB 1: OPTION A — ONLINE PAYMENT */}
              {activeTab === 'ONLINE' && (
                <div className="space-y-4">
                  {/* Mode Selector within Online Tab */}
                  <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode('MONTHLY_PLAN');
                        createOnlineOrder(500, false);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                        paymentMode === 'MONTHLY_PLAN'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      ₹500 Monthly Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode('CUSTOM_AMOUNT');
                        const amt = Number(customAmountInput) || 200;
                        createOnlineOrder(amt, true);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                        paymentMode === 'CUSTOM_AMOUNT'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Pay Custom Amount
                    </button>
                  </div>

                  {paymentMode === 'CUSTOM_AMOUNT' && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Enter Custom Amount (₹):
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                          <input
                            type="number"
                            min="1"
                            max="50000"
                            value={customAmountInput}
                            onChange={(e) => setCustomAmountInput(e.target.value)}
                            placeholder="e.g. 200, 300..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const amt = Number(customAmountInput);
                            if (!Number.isFinite(amt) || amt < 1) {
                              setOrderError('Please enter a valid amount of at least ₹1');
                              return;
                            }
                            createOnlineOrder(amt, true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                        >
                          Update QR
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Quick options:</span>
                        {[100, 200, 300, 500].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setCustomAmountInput(String(preset));
                              createOnlineOrder(preset, preset !== 500);
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-semibold border transition cursor-pointer ${
                              Number(customAmountInput) === preset
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            ₹{preset}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-normal">
                        Note: Custom payments are credited to your student ledger. Full 1-month membership extension requires the ₹500 monthly pass.
                      </p>
                    </div>
                  )}

                  {onlineStatus === 'SUCCESS' ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 text-center space-y-3">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white">Payment Confirmed!</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {activeOrder?.isCustomAmount
                          ? `Your payment of ₹${activeOrder?.amount} has been verified and recorded on your student account ledger.`
                          : `Your ₹500 online payment has been verified. Your membership has been renewed for 1 calendar month.`}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          fetchData();
                        }}
                        className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition cursor-pointer"
                      >
                        Done & Refresh Dashboard
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Clean Square QR Display without full PhonePe poster */}
                      <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-center">
                        <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-slate-200 inline-flex items-center justify-center mx-auto overflow-hidden">
                          {activeOrder?.qrSvg ? (
                            <div
                              className="w-[200px] h-[200px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                              dangerouslySetInnerHTML={{ __html: activeOrder.qrSvg }}
                            />
                          ) : (
                            <QRCodeSVG
                              value={activeUpiString}
                              size={200}
                              level="M"
                              includeMargin={false}
                            />
                          )}
                        </div>

                        {/* Scannable Badge */}
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Scan with PhonePe, GPay, Paytm, or BHIM</span>
                        </div>

                        {/* Verified Payment Details */}
                        <div className="mt-3.5 w-full max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-2 text-left">
                          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                            <span>Library / Payee:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{activeMerchant}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                            <span>Amount:</span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                              ₹{activeOrder?.amount ? Number(activeOrder.amount).toFixed(2) : effectiveAmount}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                            <span>UPI ID:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium text-slate-900 dark:text-white text-[11px]">
                                {activeUpiId}
                              </span>
                              <button
                                type="button"
                                onClick={handleCopyUpi}
                                title="Copy UPI ID"
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                              >
                                {copiedUpi ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 1-Tap Direct UPI App Buttons */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                          Or Pay Directly Via Installed App
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <a
                            href={getAppIntentUrl('phonepe')}
                            className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition"
                          >
                            <span>PhonePe</span>
                          </a>
                          <a
                            href={getAppIntentUrl('gpay')}
                            className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition"
                          >
                            <span>Google Pay</span>
                          </a>
                          <a
                            href={getAppIntentUrl('paytm')}
                            className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition"
                          >
                            <span>Paytm</span>
                          </a>
                          <a
                            href={getAppIntentUrl('upi')}
                            className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition"
                          >
                            <span>Any UPI</span>
                          </a>
                        </div>
                      </div>

                      {orderError && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                          <span>{orderError}</span>
                          <button
                            type="button"
                            onClick={() => createOnlineOrder()}
                            className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-900 dark:text-white rounded font-bold text-[11px]"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {/* Supported Gateway Checkout Link (if available) */}
                      {activeOrder?.checkoutUrl && (
                        <a
                          href={activeOrder.checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                        >
                          <span>Open Hosted Payment Checkout</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Automatic Verification Status Notice */}
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <Clock className={`w-4 h-4 text-emerald-500 ${checkingStatus ? 'animate-spin' : ''}`} />
                          <span>Automatic Settlement Verification Active</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Once you complete the payment on your UPI app, our system detects the incoming settlement and automatically renews your membership.
                        </p>
                      </div>

                      {/* Manual Verification Check Button */}
                      <button
                        type="button"
                        disabled={checkingStatus || !activeOrder}
                        onClick={() => activeOrder && pollStatus(activeOrder.orderId, true)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                        <span>{checkingStatus ? 'Checking Verification...' : 'I Have Paid / Check Status'}</span>
                      </button>

                      {/* Optional Fallback for Network Lag / Manual UTR Entry */}
                      <div className="pt-1 text-center">
                        <button
                          type="button"
                          onClick={() => setShowManualUtrFallback(!showManualUtrFallback)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline cursor-pointer"
                        >
                          {showManualUtrFallback ? 'Hide Manual Reference Submission' : 'Having trouble? Enter UPI reference manually'}
                        </button>
                        {showManualUtrFallback && (
                          <form onSubmit={handleManualUtrSubmit} className="mt-2.5 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-left">
                            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              12-Digit UPI Transaction Reference (UTR)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={30}
                                placeholder="e.g. 123456789012"
                                value={manualUtr}
                                onChange={(e) => setManualUtr(e.target.value)}
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                              <button
                                type="submit"
                                disabled={submittingUtr || !manualUtr.trim()}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                              >
                                {submittingUtr ? 'Submitting...' : 'Submit'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: OPTION B — OFFLINE PAYMENT (SIMPLIFIED CASH AT DESK) */}
              {activeTab === 'OFFLINE' && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Offline Cash Amount (₹):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="1"
                        max="50000"
                        value={offlineAmountInput}
                        onChange={(e) => setOfflineAmountInput(e.target.value)}
                        placeholder="e.g. 500, 200, 300"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Standard monthly pass is ₹500. Enter custom amount if paying partial fee or donation.
                    </p>
                  </div>

                  {offlineSubmitted ? (
                    <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-6 text-center space-y-3">
                      <div className="w-14 h-14 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                        Offline Request Submitted!
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Your offline payment request (Ref: <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{offlineSubmittedOrderId}</span>) has been submitted.
                      </p>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 font-medium">
                        Your membership will be renewed only after the Admin verifies and approves your cash payment at the library desk.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          fetchData();
                        }}
                        className="mt-2 w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition cursor-pointer"
                      >
                        Close & View Dashboard
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitOffline} className="space-y-4">
                      {/* Fixed Payment Method Display */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Payment Method
                        </label>
                        <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm font-semibold flex items-center justify-between">
                          <span>Cash Payment at Library Desk</span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold">
                            Desk Only
                          </span>
                        </div>
                      </div>

                      {/* Notice Banner */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <strong className="block text-slate-900 dark:text-white">Desk Payment Instructions</strong>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Please hand over ₹500 cash to the desk librarian. Submitting this request notifies the Admin to review and approve your membership.
                        </p>
                      </div>

                      {/* Optional Remarks */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Optional Remarks
                        </label>
                        <input
                          type="text"
                          maxLength={150}
                          placeholder="e.g. Paid cash to librarian at front desk"
                          value={offlineRemarks}
                          onChange={(e) => setOfflineRemarks(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingOffline}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {submittingOffline ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Submitting Request...</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4" />
                            <span>Submit for Admin Approval</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Lakshya Smart Library Monthly System
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="hover:text-slate-800 dark:hover:text-white font-medium transition cursor-pointer"
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
