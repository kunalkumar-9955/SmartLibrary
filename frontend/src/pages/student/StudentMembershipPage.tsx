import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
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
  Printer,
  Copy,
  Check,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { paymentService } from '../../services/api';
import { PaymentItem, PaymentReceipt, StudentMembershipOverview } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../components/Modal';
import { formatISTDateTime } from '../../utils/timeHelper';

interface PaymentSuccessDetails {
  studentName: string;
  paymentId: string;
  transactionId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  planName: string;
  membershipRenewed?: boolean;
}

export const StudentMembershipPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
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
    receiptNumber?: string;
  } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [showManualUtrFallback, setShowManualUtrFallback] = useState(false);
  const [manualUtr, setManualUtr] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<'INITIAL' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('INITIAL');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<PaymentSuccessDetails | null>(null);

  // Countdown / session expiry state
  const [sessionExpired, setSessionExpired] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Receipt modal state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Option B (Offline Payment) State
  const [offlineRemarks, setOfflineRemarks] = useState('');
  const [submittingOffline, setSubmittingOffline] = useState(false);
  const [offlineSubmitted, setOfflineSubmitted] = useState(false);
  const [offlineSubmittedOrderId, setOfflineSubmittedOrderId] = useState<string | null>(null);

  // Refund modal state
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<PaymentItem | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const { success, error, info } = useToast();

  const DEFAULT_UPI_ID = 'chhotu6826-1@oksbi';
  const DEFAULT_MERCHANT_NAME = 'Chhotu Kumar';
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
        const orderData = res.data.data;
        if (orderData.status === 'SUCCESS' || orderData.status === 'APPROVED') {
          setOnlineStatus('SUCCESS');
          setPaymentSuccessData({
            studentName: orderData.studentName || user?.name || 'Student',
            paymentId: orderData.orderId,
            transactionId: orderData.utr || orderData.orderId,
            amountPaid: orderData.amount,
            paymentDate: orderData.paymentCompletedAt || new Date().toISOString(),
            paymentMethod: 'UPI QR Scan',
            planName: orderData.planName || 'Monthly Library Membership',
            membershipRenewed: orderData.membershipRenewed ?? true,
          });
          confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
          success(
            orderData.membershipRenewed
              ? 'Payment Verified & Monthly Membership Renewed!'
              : `Payment of ₹${orderData.amount} Verified & Credited to Balance!`
          );
          setManualUtr('');
          setShowManualUtrFallback(false);
          await fetchData();
          if (refreshUser) await refreshUser();
        } else {
          success('Reference submitted. Verification is in progress.');
          setManualUtr('');
          setShowManualUtrFallback(false);
          await pollStatus(activeOrder.orderId, false);
        }
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to submit UPI reference.');
    } finally {
      setSubmittingUtr(false);
    }
  };

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

    if (tab === 'ONLINE' && mode !== 'CUSTOM_AMOUNT') {
      createOnlineOrder(500, false);
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
          receiptNumber: res.data.data.receiptNumber,
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

  const pollStatus = async (orderId: string, showToast = true) => {
    try {
      setCheckingStatus(true);
      const res = await paymentService.getOrderStatus(orderId);
      if (res.data.success) {
        const orderData = res.data.data;
        const status = orderData.status;

        if (status === 'SUCCESS' || status === 'APPROVED') {
          setOnlineStatus('SUCCESS');
          setPaymentSuccessData({
            studentName: orderData.studentName || user?.name || 'Student',
            paymentId: orderData.orderId,
            transactionId: orderData.transactionId || orderData.utr || orderData.orderId,
            amountPaid: orderData.amount,
            paymentDate: orderData.paymentDate || orderData.paymentCompletedAt || orderData.verifiedAt || new Date().toISOString(),
            paymentMethod: 'UPI QR Scan',
            planName: orderData.planName || 'Monthly Library Membership',
            membershipRenewed: orderData.membershipRenewed,
          });

          if (showToast) {
            success(
              orderData.membershipRenewed
                ? 'Payment Verified & Monthly Membership Renewed!'
                : `Payment of ₹${orderData.amount} Verified & Credited to Balance!`
            );
          }
          await fetchData();
          if (refreshUser) await refreshUser();
        } else if (status === 'PROCESSING' || status === 'PENDING_VERIFICATION') {
          setOnlineStatus('PROCESSING');
        } else if (status === 'FAILED' || status === 'CANCELLED' || status === 'REJECTED') {
          setOnlineStatus('FAILED');
          if (showToast) error('Payment was marked as failed or cancelled.');
        } else if (orderData.isSessionExpired) {
          setSessionExpired(true);
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

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (
      isModalOpen &&
      activeTab === 'ONLINE' &&
      activeOrder?.orderId &&
      onlineStatus !== 'SUCCESS' &&
      onlineStatus !== 'FAILED' &&
      !sessionExpired
    ) {
      // Fast polling (3 seconds) for instant payment status detection
      interval = setInterval(() => {
        pollStatus(activeOrder.orderId, false);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isModalOpen, activeTab, activeOrder, onlineStatus, sessionExpired]);

  // Immediate payment re-verification when returning to tab from UPI app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        isModalOpen &&
        activeTab === 'ONLINE' &&
        activeOrder?.orderId &&
        onlineStatus === 'PENDING'
      ) {
        pollStatus(activeOrder.orderId, false);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isModalOpen, activeTab, activeOrder, onlineStatus]);

  // Countdown timer effect
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!activeOrder?.orderId || onlineStatus !== 'PENDING') {
      setCountdown(null);
      setSessionExpired(false);
      return;
    }
    const FIVE_MIN = 5 * 60;
    setCountdown(FIVE_MIN);
    setSessionExpired(false);
    let remaining = FIVE_MIN;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setSessionExpired(true);
        setCountdown(0);
      }
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [activeOrder?.orderId, onlineStatus]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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

  const handleOpenRefundModal = (payment: PaymentItem) => {
    setRefundTarget(payment);
    setRefundReason('');
    setRefundModalOpen(true);
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget || submittingRefund) return;
    try {
      setSubmittingRefund(true);
      const res = await paymentService.requestRefund(refundTarget.orderId, {
        reason: refundReason.trim() || undefined,
      });
      if (res.data.success) {
        success('Refund request submitted. The Admin will review it shortly.');
        setRefundModalOpen(false);
        setRefundTarget(null);
        fetchData();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to submit refund request.');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active Member
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> 5-Day Grace Period
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            <BadgeAlert className="w-3.5 h-3.5" /> Membership Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <AlertCircle className="w-3.5 h-3.5" /> No Active Plan
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
        <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold">Loading membership status...</p>
      </div>
    );
  }

  const membership = membershipData?.membership;
  const payments = membershipData?.payments || [];
  const currentCyclePaid = membership?.currentCyclePaid || 0;
  const remainingBalance = membership?.remainingBalance !== undefined ? membership.remainingBalance : Math.max(0, 500 - currentCyclePaid);

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-4 sm:px-6 font-sans">
      {/* Header & Status Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Membership &amp; Pass Renewal
              </h1>
              {getStatusBadge(membership?.status)}
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
              Standard ₹500 monthly pass with complete library access, high-speed Wi-Fi, reserved study desk, and instant QR attendance check-in.
            </p>
          </div>

          {/* Membership Balance Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex flex-col sm:items-end shrink-0 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Monthly Fee: ₹500
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-500">Paid:</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{currentCyclePaid}
              </span>
              <span className="text-xs text-slate-500">| Due:</span>
              <span className="text-base font-extrabold text-slate-900 dark:text-white">
                ₹{remainingBalance}
              </span>
            </div>
            {membership?.expiresAt && (
              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                Expires:{' '}
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
              <span className="text-[11px] text-amber-600 dark:text-amber-300 font-semibold">
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
                Offline Cash Request Pending Admin Approval
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

      {/* Official Monthly Membership Plan Card */}
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
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">per calendar month</span>
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
            <span>
              {remainingBalance > 0 && remainingBalance < 500
                ? `Pay Remaining ₹${remainingBalance}`
                : 'Pay ₹500 (Monthly Pass)'}
            </span>
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
            <Receipt className="w-5 h-5 text-slate-400" /> Payment &amp; Renewal History
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
                  <th scope="col" className="py-3 px-4 text-left">Date &amp; Time (IST)</th>
                  <th scope="col" className="py-3 px-4 text-left">Status</th>
                  <th scope="col" className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-left">
                {payments.map((p) => {
                  const s = (p.status || 'PENDING').toUpperCase();
                  const isVerified = s === 'SUCCESS' || s === 'APPROVED';
                  return (
                    <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-slate-200">
                        <abbr title={p.orderId} className="no-underline cursor-help">
                          {p.orderId.length > 20
                            ? `${p.orderId.slice(0, 11)}…${p.orderId.slice(-6)}`
                            : p.orderId}
                        </abbr>
                        {p.receiptNumber && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            {p.receiptNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {p.paymentType === 'OFFLINE' ? 'Cash at Desk' : 'Online UPI'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white tabular-nums">
                        ₹{p.amount}
                        {p.isCustomAmount || p.amount !== 500 ? (
                          <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            Custom
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {p.utr || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatISTDateTime(p.orderCreatedTime || p.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        {(s === 'SUCCESS' || s === 'APPROVED') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            {s === 'APPROVED' ? 'Approved' : 'Completed'}
                          </span>
                        )}
                        {s === 'PENDING_APPROVAL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                            <Clock className="w-3 h-3" /> Pending Review
                          </span>
                        )}
                        {s === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                            <Clock className="w-3 h-3 animate-pulse" /> Processing
                          </span>
                        )}
                        {(s === 'REJECTED' || s === 'FAILED' || s === 'EXPIRED' || s === 'CANCELLED') && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                            title={p.adminRejectionReason}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {s === 'REJECTED' ? 'Rejected' : 'Failed'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col gap-1 items-end">
                          {isVerified ? (
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(p.orderId)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            >
                              <Receipt className="w-3 h-3 text-indigo-500" />
                              <span>Receipt</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                          {isVerified && !p.refundStatus && (
                            <button
                              type="button"
                              onClick={() => handleOpenRefundModal(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                            >
                              <span>Refund?</span>
                            </button>
                          )}
                          {p.refundStatus && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              p.refundStatus === 'REFUNDED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                              p.refundStatus === 'REFUND_REJECTED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                              'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}>
                              {p.refundStatus.replace('REFUND_', '').replace('_', ' ')}
                            </span>
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
      </div>

      {/* Professional Razorpay/Cashfree-Inspired Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-sm">
                  ₹
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Lakshya Smart Library Checkout</span>
                    <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    256-Bit SSL Encrypted • Direct UPI Settlement
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {/* Fee Breakdown Card */}
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-semibold">
                      Total Payable
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                      ₹{activeOrder?.amount ?? (paymentMode === 'CUSTOM_AMOUNT' ? (customAmountInput || '200') : '500')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-semibold">
                      Fee Breakdown
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Gateway Fee: ₹0.00 (Free)
                    </span>
                  </div>
                </div>

                {remainingBalance > 0 && remainingBalance < 500 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Already Paid this Cycle: ₹{currentCyclePaid}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Balance: ₹{remainingBalance}</span>
                  </div>
                )}
              </div>

              {/* TAB 1: ONLINE PAYMENT */}
              {activeTab === 'ONLINE' && (
                <div className="space-y-4">
                  {/* Mode Selector */}
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
                        setActiveOrder(null);
                        setOnlineStatus('INITIAL');
                        setOrderError(null);
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
                            onChange={(e) => {
                              setCustomAmountInput(e.target.value);
                              if (activeOrder) {
                                setActiveOrder(null);
                                setOnlineStatus('INITIAL');
                                setOrderError(null);
                              }
                            }}
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
                          Generate QR
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
                        Partial payments accumulate towards your monthly renewal. Total ₹500 activates standard 1-month access.
                      </p>
                    </div>
                  )}

                  {onlineStatus === 'SUCCESS' ? (
                    /* PROFESSIONAL PAYMENT SUCCESS SCREEN */
                    <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 sm:p-7 text-center space-y-4 animate-fade-in shadow-sm">
                      {/* Green Success Animation / Icon */}
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20 animate-bounce">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>

                      <div>
                        <h4 className="text-2xl font-black text-slate-900 dark:text-white">
                          Payment Successful!
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Your transaction has been verified and your membership has been activated.
                        </p>
                      </div>

                      {/* Payment Details Card */}
                      <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 text-left text-xs space-y-2 shadow-xs">
                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                          <span className="font-medium">Student Name:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {paymentSuccessData?.studentName || user?.name || 'Student'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                          <span className="font-medium">Student ID:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {user?.studentIdNumber || user?.id || 'STU-50'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                          <span className="font-medium">Order ID:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {paymentSuccessData?.paymentId || activeOrder?.orderId || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                          <span className="font-medium">Gateway Transaction ID / UTR:</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {paymentSuccessData?.transactionId || manualUtr || activeOrder?.orderId || 'CONFIRMED'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                          <span className="font-medium">Verified Amount:</span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            ₹{paymentSuccessData?.amountPaid ?? (activeOrder?.amount || 500)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                          <span className="font-medium">Payment Method:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            UPI QR Scan
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                          <span className="font-medium">Payment Date &amp; Time (IST):</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {formatISTDateTime(paymentSuccessData?.paymentDate || new Date().toISOString())}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="font-medium">Membership Status:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            Active / Renewed
                          </span>
                        </div>
                      </div>

                      {/* Success Banner */}
                      <div className="p-3 bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        🎉 Your Lakshya Smart Library membership has been activated successfully.
                      </div>

                      {/* Action Buttons: [Download Receipt] & [Return to Dashboard] */}
                      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const orderId = paymentSuccessData?.paymentId || activeOrder?.orderId;
                            if (orderId) {
                              handleViewReceipt(orderId);
                            }
                          }}
                          className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Receipt className="w-4 h-4" />
                          <span>Download Receipt</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsModalOpen(false);
                            navigate('/student/dashboard');
                          }}
                          className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Return to Dashboard
                        </button>
                      </div>
                    </div>
                  ) : onlineStatus === 'PROCESSING' ? (
                    /* PAYMENT PROCESSING SCREEN */
                    <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-2xl p-6 text-center space-y-4 animate-fade-in shadow-sm">
                      <div className="w-16 h-16 bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-md">
                        <RefreshCw className="w-10 h-10 animate-spin" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">
                          Payment Processing...
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          We detected payment activity. Awaiting final confirmation from your bank...
                        </p>
                        {activeOrder?.orderId && (
                          <p className="text-[11px] font-mono text-slate-500 mt-1">
                            Order Ref: {activeOrder.orderId}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : onlineStatus === 'FAILED' ? (
                    /* PAYMENT FAILURE SCREEN */
                    <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 text-center space-y-4 animate-fade-in shadow-sm">
                      <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto shadow-md">
                        <AlertCircle className="w-10 h-10" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">
                          Payment Failed
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Your payment could not be confirmed or was cancelled.
                        </p>
                        {activeOrder?.orderId && (
                          <p className="text-[11px] font-mono text-slate-500 mt-1">
                            Order Ref: {activeOrder.orderId}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOnlineStatus('INITIAL');
                            setSessionExpired(false);
                            createOnlineOrder(paymentMode === 'CUSTOM_AMOUNT' ? Number(customAmountInput) : 500);
                          }}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Retry Payment
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('OFFLINE')}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                        >
                          Choose Another Method
                        </button>
                      </div>
                    </div>
                  ) : sessionExpired ? (
                    /* PAYMENT EXPIRY */
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center space-y-4 animate-fade-in shadow-sm">
                      <div className="w-16 h-16 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-md">
                        <Clock className="w-10 h-10" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">
                          Payment Session Expired
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          To protect your security, UPI payment sessions expire after 5 minutes.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSessionExpired(false);
                            setActiveOrder(null);
                            setOnlineStatus('INITIAL');
                            createOnlineOrder(paymentMode === 'CUSTOM_AMOUNT' ? Number(customAmountInput) : 500, paymentMode === 'CUSTOM_AMOUNT');
                          }}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Generate New QR
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(onlineStatus !== 'INITIAL' || paymentMode !== 'CUSTOM_AMOUNT') ? (
                        /* PROFESSIONAL RAZORPAY/CASHFREE-INSPIRED QR-ONLY CHECKOUT */
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md">
                          {/* Header: Lakshya Smart Library Branding + Order Ref Badge */}
                          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-white text-base">
                                  L
                                </div>
                                <div>
                                  <div className="text-[11px] font-semibold tracking-wide text-emerald-100 uppercase">
                                    Lakshya Smart Library
                                  </div>
                                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                                    <span>UPI Verified Checkout</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/20 text-white backdrop-blur-xs">
                                  {activeOrder?.orderId || 'PENDING'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Order Summary Strip */}
                          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {paymentMode === 'CUSTOM_AMOUNT' ? 'Custom Library Payment' : '1 Month Library Membership'}
                              </div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span>Payee:</span>
                                <span className="text-emerald-600 dark:text-emerald-400">{activeMerchant}</span>
                                <span className="text-slate-400 font-mono text-[10px]">({activeUpiId})</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount to Pay</div>
                              <div className="text-xl font-black text-slate-900 dark:text-white">
                                ₹{activeOrder?.amount ? Number(activeOrder.amount).toFixed(2) : effectiveAmount}
                              </div>
                            </div>
                          </div>

                          {/* Pure Dynamic Vector QR Code Display */}
                          <div className="p-5 flex flex-col items-center justify-center text-center">
                            <div className="relative p-3.5 bg-white rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 inline-flex items-center justify-center">
                              {creatingOrder ? (
                                <div className="w-[210px] h-[210px] flex flex-col items-center justify-center gap-2">
                                  <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-xs font-medium text-slate-500">Generating secure QR...</span>
                                </div>
                              ) : activeOrder?.qrSvg ? (
                                <div
                                  className="w-[210px] h-[210px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                                  dangerouslySetInnerHTML={{ __html: activeOrder.qrSvg }}
                                />
                              ) : (
                                <QRCodeSVG
                                  value={activeUpiString}
                                  size={210}
                                  level="M"
                                  includeMargin={false}
                                />
                              )}
                            </div>

                            {/* Primary Instruction */}
                            <div className="mt-3.5 flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                              <QrCode className="w-4 h-4 text-emerald-600" />
                              <span>Scan &amp; Pay Using Any UPI App</span>
                            </div>

                            {/* Informational Supported Apps Indicator Badges (Non-Clickable) */}
                            <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4]" /> Google Pay
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#5f259f]" /> PhonePe
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#00baf2]" /> Paytm
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#097937]" /> BHIM / Any UPI
                              </span>
                            </div>

                            {/* Live Verification Status Notice (3s polling) */}
                            <div className="mt-4 w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 flex items-center justify-between text-left">
                              <div className="flex items-center gap-2.5">
                                <div className="relative flex items-center justify-center">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>Waiting for payment</span>
                                    {checkingStatus && <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Checking every 3s. Screen updates automatically.
                                  </div>
                                </div>
                              </div>
                              {countdown !== null && !sessionExpired && (
                                <div className={`text-right text-xs font-mono font-bold ${
                                  countdown <= 60 ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-600 dark:text-slate-300'
                                }`}>
                                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Expires in</div>
                                  {formatCountdown(countdown)}
                                </div>
                              )}
                            </div>

                            {/* Instructions */}
                            <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                              Open PhonePe, Google Pay, or Paytm &bull; Tap <strong>Scan QR</strong> &bull; Point at this screen to pay ₹{activeOrder?.amount ? Number(activeOrder.amount).toFixed(2) : effectiveAmount}
                            </p>

                            {/* Instant Verification via UPI Reference (UTR) */}
                            <div className="mt-4 w-full p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl text-left shadow-xs">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span>Paid using PhonePe, GPay, or Paytm?</span>
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                                  Instant Activation
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-2.5 leading-relaxed">
                                Enter the 12-digit UPI Reference Number / UTR from your payment receipt to instantly confirm payment and activate your membership:
                              </p>
                              <form onSubmit={handleManualUtrSubmit} className="flex gap-2">
                                <input
                                  type="text"
                                  maxLength={30}
                                  placeholder="e.g. 432109876543 (12-digit UTR)"
                                  value={manualUtr}
                                  onChange={(e) => setManualUtr(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                                  className="flex-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                                <button
                                  type="submit"
                                  disabled={submittingUtr || !manualUtr.trim()}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 shrink-0"
                                >
                                  {submittingUtr ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      <span>Verifying...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Confirm &amp; Activate</span>
                                    </>
                                  )}
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
                          <QrCode className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Enter your amount above and click Generate QR
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: OFFLINE PAYMENT (CASH AT DESK ONLY) */}
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
                      Standard monthly pass is ₹500. Enter custom amount if paying partial fee or installment.
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
                        Close &amp; View Dashboard
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
                          Please hand over the exact cash to the desk librarian. Submitting this request alerts the Admin to confirm receipt and renew your membership.
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
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-purple-500"
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
                Lakshya Smart Library Secured Payment
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

      {/* Refund Request Modal */}
      {refundModalOpen && refundTarget && (
        <Modal
          isOpen={refundModalOpen}
          onClose={() => setRefundModalOpen(false)}
          title="Request Refund"
        >
          <form onSubmit={handleSubmitRefund} className="space-y-4 p-1">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
              <strong className="block mb-1">Refund Request</strong>
              Requesting refund for payment of <strong>₹{refundTarget.amount}</strong> (Order: {refundTarget.orderId.slice(0, 18)}…). The Admin will review and process your request.
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Refund (Optional)
              </label>
              <textarea
                rows={3}
                maxLength={300}
                placeholder="e.g. Duplicate payment, unable to attend..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRefund}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {submittingRefund ? 'Submitting...' : 'Submit Refund Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Official Receipt Modal for Student */}
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
            <div className="space-y-4">
              <div id="student-receipt" className="p-6 bg-white border border-slate-300 rounded-2xl text-slate-900 font-sans space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <img src="/Logo.png" alt="Lakshya Smart Library" className="w-9 h-9 object-contain rounded-lg border border-slate-200 p-0.5" />
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{receiptData.organization.name}</h4>
                      <p className="text-[10px] text-slate-500">{receiptData.organization.address}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                      Official Receipt
                    </span>
                    <p className="font-mono text-xs font-bold text-slate-800 mt-0.5">
                      {receiptData.receiptNumber}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Student Name:</span>
                    <strong className="text-slate-900">{receiptData.studentName}</strong>
                    {receiptData.studentIdNumber && (
                      <span className="text-emerald-700 font-mono block text-[11px]">
                        ID: {receiptData.studentIdNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 text-[11px] block">Date (IST):</span>
                    <strong className="text-slate-900">
                      {formatISTDateTime(receiptData.paymentCompletedAt || receiptData.verifiedAt)}
                    </strong>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <strong className="text-slate-900 block">{receiptData.planName}</strong>
                    <span className="text-slate-500 text-[11px] font-mono">
                      Ref: {receiptData.orderId}
                      {receiptData.utr ? ` • UTR: ${receiptData.utr}` : ''}
                    </span>
                  </div>
                  <span className="text-lg font-black text-emerald-600">
                    ₹{Number(receiptData.amount).toFixed(2)}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="text-slate-600 text-[11px]">
                    Status: <strong className="text-emerald-700">Verified &amp; Confirmed</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
