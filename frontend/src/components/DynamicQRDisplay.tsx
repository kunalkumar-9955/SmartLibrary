import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { qrService } from '../services/api';
import { QRPayload } from '../types';
import { RefreshCw, Maximize2, Minimize2, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

interface DynamicQRDisplayProps {
  initialType?: 'ENTRY' | 'EXIT';
}

export const DynamicQRDisplay: React.FC<DynamicQRDisplayProps> = ({ initialType = 'ENTRY' }) => {
  const [qrType, setQrType] = useState<'ENTRY' | 'EXIT'>(initialType);
  const [qrData, setQrData] = useState<QRPayload | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchQR = async (type: 'ENTRY' | 'EXIT') => {
    try {
      setLoading(true);
      setError(null);
      const res = await qrService.generateQR(type);
      if (res.data.success) {
        const payload: QRPayload = res.data.data;
        setQrData(payload);
        const diff = Math.max(0, Math.floor((payload.expiresAt - Date.now()) / 1000));
        setSecondsRemaining(diff || 45);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate dynamic QR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQR(qrType);
  }, [qrType]);

  // Countdown timer & auto-regeneration
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchQR(qrType);
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
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
  const qrString = qrData ? JSON.stringify(qrData) : '';

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
            className={`px-5 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition ${
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
            className={`px-5 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition ${
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
            onClick={() => fetchQR(qrType)}
            disabled={loading}
            title="Regenerate QR"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Regenerate QR
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Display Mode'}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
        <div className="mt-2 flex items-center justify-center">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              qrType === 'ENTRY'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Active {qrType} Session
          </span>
        </div>
      </div>

      {/* QR Code Canvas */}
      <div className="relative p-6 bg-white rounded-3xl shadow-inner border-4 border-slate-100 flex items-center justify-center">
        {loading && !qrData ? (
          <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
            <span className="text-xs font-medium">Generating Fresh QR...</span>
          </div>
        ) : error ? (
          <div className="w-64 h-64 flex flex-col items-center justify-center text-rose-500 p-4 text-center">
            <AlertTriangle className="w-10 h-10 mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : (
          <QRCodeSVG
            value={qrString}
            size={isFullscreen ? 320 : 250}
            level="M"
            includeMargin={true}
          />
        )}
      </div>

      {/* Expiry Countdown */}
      <div className="mt-6 flex flex-col items-center">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono text-sm">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>Expires in:</span>
          <span
            className={`font-bold text-base px-2.5 py-0.5 rounded ${
              secondsRemaining <= 10
                ? 'bg-rose-100 text-rose-700 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
            }`}
          >
            {formattedCountdown}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400 text-center max-w-xs">
          Dynamic short-lived token with HMAC security. Does not expose student identity.
        </p>
      </div>
    </div>
  );
};
