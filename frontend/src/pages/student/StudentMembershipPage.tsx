import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Receipt,
  X,
  ExternalLink,
} from 'lucide-react';
import { paymentService } from '../../services/api';
import { MembershipPlan, PaymentItem, StudentMembershipOverview } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export const StudentMembershipPage: React.FC = () => {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [membershipData, setMembershipData] = useState<StudentMembershipOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Checkout modal states
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [activeOrder, setActiveOrder] = useState<{
    orderId: string;
    amount: number;
    planName: string;
    checkoutUrl?: string;
  } | null>(null);

  // UTR submission state
  const [utr, setUtr] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    'INITIAL' | 'PENDING' | 'SUCCESS' | 'FAILED'
  >('INITIAL');
  const [checkingStatus, setCheckingStatus] = useState(false);

  const { success, error, info } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, myPaymentsRes] = await Promise.all([
        paymentService.getPlans(),
        paymentService.getMyPayments(),
      ]);

      if (plansRes.data.success) {
        setPlans(plansRes.data.data);
      }
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

  const handleOpenCheckout = async (plan: MembershipPlan) => {
    try {
      setSelectedPlan(plan);
      setPaymentStatus('INITIAL');
      setUtr('');
      setNotes('');
      setCreatingOrder(true);
      setIsModalOpen(true);

      const idempotencyKey = `idem_${plan.id}_${Date.now()}`;
      const res = await paymentService.createOrder({
        planId: plan.id,
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
      error('Could not create payment order: ' + (err.response?.data?.message || err.message));
      setIsModalOpen(false);
    } finally {
      setCreatingOrder(false);
    }
  };

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
        notes: notes.trim() || undefined,
      });

      if (res.data.success) {
        setPaymentStatus('PENDING');
        success('UPI Reference submitted! Verifying payment...');
        fetchData();
        pollStatus(activeOrder.orderId);
      }
    } catch (err: any) {
      error('UTR Submission error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingUtr(false);
    }
  };

  const pollStatus = async (orderId: string) => {
    try {
      setCheckingStatus(true);
      const res = await paymentService.getOrderStatus(orderId);
      if (res.data.success) {
        const status = res.data.data.status;
        if (status === 'SUCCESS') {
          setPaymentStatus('SUCCESS');
          success('Payment Verified & Membership Activated!');
          fetchData();
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          setPaymentStatus('FAILED');
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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active Member
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Membership Expired
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
        <p className="text-sm font-medium">Loading membership options...</p>
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
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Library Membership & Passes
              </h1>
              {getStatusBadge(membership?.status)}
            </div>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
              Subscribe or renew your library access pass via instant UPI QR payment.
              Powered by sovereign YouPI-PG Gateway & direct PhonePe settlement.
            </p>
          </div>

          {membership?.status === 'ACTIVE' && membership.expiresAt && (
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 flex flex-col sm:items-end">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Current Plan
              </span>
              <span className="text-lg font-bold text-white text-emerald-400">
                {membership.plan || 'Standard Study Pass'}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                Valid until:{' '}
                <strong className="text-slate-200">
                  {new Date(membership.expiresAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Available Plans */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Choose Your Study Pass
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Select the pass that fits your study schedule. Instant activation upon verification.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                plan.popular
                  ? 'bg-gradient-to-b from-slate-800/90 to-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
              }`}
            >
              {plan.popular && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider text-center py-1 px-4">
                  Most Popular
                </div>
              )}

              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">
                    ₹{plan.price}
                  </span>
                  <span className="text-xs text-slate-400">
                    / {plan.durationDays} days
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  {plan.description}
                </p>

                <div className="space-y-2.5 mb-6">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={() => handleOpenCheckout(plan)}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
                    plan.popular
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  <span>Subscribe Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment History */}
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
            No transaction records found yet. Subscribe to a pass above to start your membership.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Pass Name</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">UPI Reference / UTR</th>
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
                    <td className="py-3 px-4 font-medium text-white">{p.planName}</td>
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
                      {p.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          PENDING
                        </span>
                      )}
                      {p.status === 'CREATED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          CREATED
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

      {/* Checkout Modal with PhonePe QR Code & Instant UTR Submission */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                  ₹
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Scan & Pay with UPI
                  </h3>
                  <p className="text-xs text-slate-400">
                    Order Ref: <span className="font-mono text-slate-300">{activeOrder?.orderId}</span>
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

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Order Amount Banner */}
              <div className="bg-gradient-to-r from-purple-900/20 via-slate-800 to-slate-800 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold">
                    Amount to Pay
                  </span>
                  <span className="text-2xl font-black text-white">
                    ₹{activeOrder?.amount}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold">
                    Selected Pass
                  </span>
                  <span className="text-sm font-semibold text-purple-300">
                    {activeOrder?.planName}
                  </span>
                </div>
              </div>

              {/* Status Indicator */}
              {paymentStatus === 'SUCCESS' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-white">Payment Confirmed!</h4>
                  <p className="text-xs text-slate-300">
                    Your {activeOrder?.planName} has been verified and activated successfully.
                    Your attendance check-ins are now unlocked.
                  </p>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      fetchData();
                    }}
                    className="mt-3 w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition"
                  >
                    Done & View Dashboard
                  </button>
                </div>
              ) : paymentStatus === 'PENDING' ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-center space-y-3">
                  <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-white">Verification in Progress</h4>
                  <p className="text-xs text-slate-300">
                    Your transaction reference <span className="font-mono text-amber-300">#{utr}</span> is being matched by the YouPI-PG banking observer or library admin.
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
                  {/* Authentic PhonePe Payment QR Display */}
                  <div className="flex flex-col items-center justify-center bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-6 text-center">
                    <div className="relative p-2 bg-white rounded-2xl shadow-xl max-w-[240px] sm:max-w-[260px] mx-auto">
                      <img
                        src="/api/payments/qr-image"
                        alt="PhonePe Payment QR"
                        className="w-full h-auto rounded-xl object-contain"
                        onError={(e) => {
                          // Fallback to static direct route
                          (e.target as HTMLImageElement).src = '/qr/QR.jpeg';
                        }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Scan with <strong>PhonePe, Google Pay, Paytm, or BHIM</strong></span>
                    </div>
                  </div>

                  {/* Instructions & UTR Input Form */}
                  <form onSubmit={handleSubmitUtr} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        12-Digit UPI Transaction Reference / UTR Number <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={25}
                        placeholder="e.g. 529410849201"
                        value={utr}
                        onChange={(e) => setUtr(e.target.value.replace(/\s+/g, ''))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Find the 12-digit UTR in your payment app (PhonePe/GPay/Paytm) under payment details.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Notes / Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={100}
                        placeholder="e.g. Paid from HDFC account"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingUtr || !utr.trim()}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                    >
                      {submittingUtr ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Submitting UTR...</span>
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

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Zero gateway fee direct settlement
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
