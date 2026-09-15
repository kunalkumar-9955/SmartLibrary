import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { dailyQrService } from '../services/api';
import { DailyQRPayload } from '../types';
import {
  QrCode,
  Download,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Share2,
  Sparkles,
  Users,
  Info,
} from 'lucide-react';

export const DailyQRDisplay: React.FC = () => {
  const [dailyData, setDailyData] = useState<DailyQRPayload | null>(null);
  const [validDate, setValidDate] = useState<string>('');
  const [scanCount, setScanCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState<boolean>(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Fetch today's existing Daily QR on mount (never auto-generates on fetch)
  const fetchTodayQR = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await dailyQrService.getTodayQR();
      if (res.data.success && res.data.data?.exists) {
        setDailyData(res.data.data.qrPayload);
        setValidDate(res.data.data.date);
        setScanCount(res.data.data.scanCount || 0);
      } else {
        setDailyData(null);
      }
    } catch (err: any) {
      console.error('[Daily QR] Fetch error:', err);
      setError(err.response?.data?.message || 'Failed to check today’s Daily QR.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayQR();
  }, []);

  // Generate Daily QR
  const handleGenerate = async (force: boolean = false) => {
    try {
      setGenerating(true);
      setError(null);
      setConfirmRegenOpen(false);
      const res = await dailyQrService.generateQR(force);
      if (res.data.success) {
        setDailyData(res.data.data.qrPayload);
        setValidDate(res.data.data.date);
        setScanCount(res.data.data.scanCount || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate Daily QR.');
    } finally {
      setGenerating(false);
    }
  };

  // Format date display (e.g. "15 September 2026")
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    } catch (e) {
      // fallback
    }
    return dateStr;
  };

  // Download High-Resolution QR Poster PNG
  // Does NOT regenerate or change QR in any way
  const handleDownload = () => {
    if (!dailyData || !canvasRef.current) return;

    try {
      const rawCanvas = canvasRef.current.querySelector('canvas');
      if (!rawCanvas) return;

      // Construct a styled card on a new high-res canvas (800x1050)
      const exportCanvas = document.createElement('canvas');
      const width = 800;
      const height = 1050;
      exportCanvas.width = width;
      exportCanvas.height = height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, width, height);

      // Gradient Header Accent
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, '#4f46e5');
      grad.addColorStop(0.5, '#7c3aed');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 12);

      // Card Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LAKSHYA SMART LIBRARY', width / 2, 80);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 20px sans-serif';
      ctx.fillText('DAILY ATTENDANCE QR', width / 2, 115);

      // Date Pill Badge
      const dateText = `Valid for: ${formatDateDisplay(validDate)}`;
      ctx.font = 'bold 18px sans-serif';
      const textWidth = ctx.measureText(dateText).width;
      const badgeWidth = textWidth + 40;
      const badgeHeight = 38;
      const badgeX = (width - badgeWidth) / 2;
      const badgeY = 145;

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 19);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.fillText(dateText, width / 2, 170);

      // White QR Container Card
      const qrCardSize = 520;
      const qrCardX = (width - qrCardSize) / 2;
      const qrCardY = 210;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrCardX, qrCardY, qrCardSize, qrCardSize, 28);
      ctx.fill();

      // Draw QR Image onto Card
      const qrInnerSize = 440;
      const qrInnerX = (width - qrInnerSize) / 2;
      const qrInnerY = qrCardY + (qrCardSize - qrInnerSize) / 2;
      ctx.drawImage(rawCanvas, qrInnerX, qrInnerY, qrInnerSize, qrInnerSize);

      // Instructions Section
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('How to Mark Attendance', width / 2, 780);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '18px sans-serif';
      ctx.fillText('1. Open Lakshya Smart Library app on your phone', width / 2, 825);
      ctx.fillText('2. Tap [ Scan QR ] and scan this image', width / 2, 860);
      ctx.fillText('3. First scan = ENTRY • Next scan = EXIT', width / 2, 895);

      // Status pill at bottom
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('● ACTIVE & VALID FOR TODAY ONLY', width / 2, 955);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText('Powered by Lakshya Smart Library Management Engine', width / 2, 995);

      // Trigger download
      const filename = `Lakshya-Smart-Library-Daily-QR-${validDate || new Date().toISOString().split('T')[0]}.png`;
      const link = document.createElement('a');
      link.download = filename;
      link.href = exportCanvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('[Daily QR] Download error:', e);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden font-sans">
      {/* Top Banner Accent */}
      <div className="h-1.5 bg-gradient-to-r from-amber-500 via-indigo-600 to-emerald-500" />

      <div className="p-6 sm:p-8 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <QrCode className="w-4 h-4" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Daily Attendance QR
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                For Days Admin is Absent
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
              Generate one QR for today's attendance. Download it and share it with library members in WhatsApp or your group. Students scan the exact same QR for both <strong className="text-slate-700 dark:text-slate-200">ENTRY</strong> and <strong className="text-slate-700 dark:text-slate-200">EXIT</strong>.
            </p>
          </div>

          {dailyData && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE
              </span>
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                {scanCount} Scans Today
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Checking today's Daily QR status...</span>
          </div>
        ) : !dailyData ? (
          /* Empty State: Prompt Admin to generate Daily QR */
          <div className="py-10 px-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
              <Calendar className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                No Daily QR Generated for Today Yet
              </h4>
              <p className="text-xs text-slate-500">
                Click below to generate today's attendance QR. It will remain fixed and valid for the entire day without rotating.
              </p>
            </div>
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/25 transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Daily QR...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Daily QR
                </>
              )}
            </button>
          </div>
        ) : (
          /* Generated State: Display QR & Action Controls */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-2">
            {/* Left / Center: The QR Display */}
            <div className="md:col-span-6 flex flex-col items-center">
              <div
                ref={canvasRef}
                className="p-5 bg-white rounded-3xl shadow-2xl border-4 border-slate-100 dark:border-slate-800 inline-block transition-transform hover:scale-102"
              >
                <QRCodeCanvas
                  value={JSON.stringify(dailyData)}
                  size={260}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="mt-4 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Valid for: {formatDateDisplay(validDate)}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Authoritative Server Date • Expires at 23:59:59
                </p>
              </div>
            </div>

            {/* Right: Explanations and Actions */}
            <div className="md:col-span-6 space-y-5">
              {/* Feature Highlights Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">One QR for Entry & Exit</strong>
                    <p className="text-slate-500 text-[11px]">
                      Students scan this same QR. First scan logs Entry; second scan logs Exit.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">Never Rotates on Scan</strong>
                    <p className="text-slate-500 text-[11px]">
                      This QR stays static throughout the day so all 50 members can use the same image.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">Shareable Anywhere</strong>
                    <p className="text-slate-500 text-[11px]">
                      Download as high-res poster and post to your library WhatsApp/Telegram group.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleDownload}
                  className="w-full sm:w-auto flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download QR (PNG Poster)
                </button>

                <button
                  onClick={() => setConfirmRegenOpen(true)}
                  disabled={generating}
                  className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>

              {/* Confirmation Modal / Alert for Regenerate */}
              {confirmRegenOpen && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs space-y-3">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200 font-semibold">
                    <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      Regenerating will revoke the previous Daily QR for today. Anyone with the older image will need the new one. Are you sure?
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setConfirmRegenOpen(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleGenerate(true)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Yes, Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
