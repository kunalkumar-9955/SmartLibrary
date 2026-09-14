import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { qrService } from '../services/api';
import { QRPayload } from '../types';
import { RefreshCw, Maximize2, Minimize2, ShieldCheck, Clock, AlertTriangle, Sparkles } from 'lucide-react';

interface DynamicQRDisplayProps {
  initialType?: 'ENTRY' | 'EXIT';
}

export const DynamicQRDisplay: React.FC<DynamicQRDisplayProps> = ({ initialType = 'ENTRY' }) => {
  const [qrType, setQrType] = useState<'ENTRY' | 'EXIT'>(initialType);
  const [qrData, setQrData] = useState<QRPayload | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTokenRef = useRef<string | null>(null);

  // Manual regenerate: explicitly call backend generateQR to rotate immediately
  const handleManualRegenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await qrService.generateQR(qrType);
      if (res.data.success) {
        const payload: QRPayload = res.data.data;
        currentTokenRef.current = payload.token;
        setQrData({
          qrType: payload.qrType,
          token: payload.token,
          expiresAt: payload.expiresAt,
          signature: payload.signature,
          version: payload.version,
        });
        setSecondsRemaining(60);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate dynamic QR');
    } finally {
      setLoading(false);
    }
  };

  // Poll for active QR (lightweight 1.5s poll)
  // CRITICAL: Polling ONLY checks if the backend rotated the token after a student scan.
  // Polling will NEVER regenerate or alter the QR if the token is unchanged.
  useEffect(() => {
    let isMounted = true;
    currentTokenRef.current = null;
    setQrData(null);
    setLoading(true);

    const syncActiveQR = async () => {
      try {
        const res = await qrService.getActiveQR(qrType);
        if (!isMounted || !res.data.success) return;

        const payload: QRPayload = res.data.data;
        const incomingToken = payload.token;

        // If the token hasn't changed, DO NOT update qrData (preserves static QR rendering)
        if (currentTokenRef.current === incomingToken && qrData !== null) {
          return;
        }

        // Detect if QR was rotated by backend after student attendance
        if (currentTokenRef.current && currentTokenRef.current !== incomingToken) {
          setIsRotating(true);
          setTimeout(() => {
            if (isMounted) setIsRotating(false);
          }, 600);
          setSecondsRemaining(60);
        }

        currentTokenRef.current = incomingToken;
        setQrData({
          qrType: payload.qrType,
          token: payload.token,
          expiresAt: payload.expiresAt,
          signature: payload.signature,
          version: payload.version,
        });
        setError(null);
        setLoading(false);
      } catch (err: any) {
        if (isMounted && !qrData) {
          setError(err.response?.data?.message || 'Failed to sync live QR');
          setLoading(false);
        }
      }
    };

    // Initial fetch
    syncActiveQR();

    // Live sync polling interval (1.5 seconds)
    const pollInterval = setInterval(syncActiveQR, 1500);

    // 1-second visual countdown tick (UI display only, does NOT regenerate QR)
    const countdownInterval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  }, [qrType]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const formattedCountdown = `00:${secondsRemaining < 10 ? '0' : ''}${secondsRemaining}`;

  // Stable, bit-for-bit immutable string representation for the QR SVG
  const qrString = useMemo(() => {
    if (!qrData || !qrData.token) return '';
    return JSON.stringify({
      qrType: qrData.qrType,
      token: qrData.token,
      expiresAt: qrData.expiresAt,
      signature: qrData.signature,
      version: qrData.version,
    });
  }, [qrData?.token, qrData?.version]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center justify-center p-6 sm:p-10 rounded-3xl transition-all duration-300 font-sans ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-950 text-white justify-center h-screen'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl mx-auto'
      }`}
    >
      {/* Header controls: [ ENTRY ] [ EXIT ] Toggle */}
      <div className="w-full flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setQrType('ENTRY')}
            className={`px-5 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition cursor-pointer ${
              qrType === 'ENTRY'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            ENTRY QR
          </button>
          <button
            type="button"
            onClick={() => setQrType('EXIT')}
            className={`px-5 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition cursor-pointer ${
              qrType === 'EXIT'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            EXIT QR
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRegenerate}
            disabled={loading}
            title="Regenerate QR"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Regenerate QR
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Display Mode'}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
          LAKSHYA SMART LIBRARY ATTENDANCE QR
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Scan to mark {qrType === 'ENTRY' ? 'entry and occupy seat' : 'exit and release seat'}
        </p>
        <div className="mt-2.5 flex items-center justify-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              qrType === 'ENTRY'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Active {qrType} Session
          </span>
          {qrData?.version && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              v{qrData.version}
            </span>
          )}
        </div>
      </div>

      {/* QR Code Canvas */}
      <div
        className={`relative p-6 bg-white rounded-3xl shadow-inner border-4 transition-all duration-300 flex items-center justify-center ${
          isRotating
            ? 'border-indigo-500 scale-[1.02] shadow-indigo-500/20'
            : 'border-slate-100'
        }`}
      >
        {loading && !qrData ? (
          <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
            <span className="text-xs font-medium">Connecting to QR session...</span>
          </div>
        ) : error ? (
          <div className="w-64 h-64 flex flex-col items-center justify-center text-rose-500 p-4 text-center">
            <AlertTriangle className="w-10 h-10 mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${isRotating ? 'opacity-40' : 'opacity-100'}`}>
            <QRCodeSVG
              value={qrString}
              size={isFullscreen ? 320 : 250}
              level="M"
              includeMargin={true}
            />
          </div>
        )}
      </div>

      {/* Expiry / Rotation Indicator */}
      <div className="mt-6 flex flex-col items-center">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono text-xs sm:text-sm">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>Auto-rotates after each scan • Fallback:</span>
          <span
            className={`font-bold text-sm sm:text-base px-2.5 py-0.5 rounded ${
              secondsRemaining <= 10
                ? 'bg-rose-100 text-rose-700 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
            }`}
          >
            {formattedCountdown}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400 text-center max-w-sm">
          QR rotates automatically after each student check-in with a 10s safe in-flight grace window.
        </p>
      </div>
    </div>
  );
};
