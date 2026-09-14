import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { Camera, AlertCircle, RefreshCw, CheckCircle2, SwitchCamera, ShieldAlert, KeyRound } from 'lucide-react';
import { QRPayload } from '../types';

interface StudentQRScannerProps {
  expectedType?: 'ENTRY' | 'EXIT';
  onScanSuccess: (payload: QRPayload) => void;
  isLoading?: boolean;
}

type CameraPermissionState = 'IDLE_PROMPT' | 'REQUESTING' | 'GRANTED' | 'DENIED';

export const StudentQRScanner: React.FC<StudentQRScannerProps> = ({
  expectedType,
  onScanSuccess,
  isLoading = false,
}) => {
  const [permissionState, setPermissionState] = useState<CameraPermissionState>('IDLE_PROMPT');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<QRPayload | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const qrRegionId = 'html5qr-code-full-region';

  // Stop scanner and release all camera tracks cleanly
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.debug('[Scanner] Clean shutdown notice:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanner = async (specificCameraId?: string) => {
    try {
      setCameraError(null);
      setPermissionState('REQUESTING');
      isProcessingRef.current = false;

      // Ensure any existing camera stream is stopped first
      await stopScanner();

      // Check browser environment for camera capability
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported on this browser or requires a secure HTTPS connection.');
        setPermissionState('DENIED');
        return;
      }

      const html5QrCode = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5QrCode;

      // Discover available camera devices
      let detectedCameras: { id: string; label: string }[] = [];
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          detectedCameras = devices.map((d, idx) => ({
            id: d.id,
            label: d.label || `Camera ${idx + 1}`,
          }));
          setCameras(detectedCameras);
        }
      } catch (e) {
        console.debug('[Scanner] Camera discovery deferred until user grants permission');
      }

      // Camera config: prioritize rear/environment camera for handheld mobile scanning
      let cameraConfig: any = { facingMode: 'environment' };

      if (specificCameraId) {
        cameraConfig = specificCameraId;
      } else if (detectedCameras.length > 0) {
        const backCamIdx = detectedCameras.findIndex(
          (c) =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('rear') ||
            c.label.toLowerCase().includes('environment')
        );
        if (backCamIdx !== -1) {
          cameraConfig = detectedCameras[backCamIdx].id;
          setCurrentCameraIndex(backCamIdx);
        } else {
          cameraConfig = detectedCameras[0].id;
          setCurrentCameraIndex(0);
        }
      }

      const scanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.72);
          return {
            width: Math.max(180, qrboxSize),
            height: Math.max(180, qrboxSize),
          };
        },
        aspectRatio: 1.0,
      };

      try {
        await html5QrCode.start(
          cameraConfig,
          scanConfig,
          (decodedText) => handleDecodedText(decodedText),
          () => {} // Frame without QR, ignore
        );
        setPermissionState('GRANTED');
        setIsScanning(true);
      } catch (primaryErr: any) {
        console.warn('[Scanner] Primary camera config failed, falling back to front/user camera:', primaryErr);
        // Fallback to front camera or default user media
        await html5QrCode.start(
          { facingMode: 'user' },
          scanConfig,
          (decodedText) => handleDecodedText(decodedText),
          () => {}
        );
        setPermissionState('GRANTED');
        setIsScanning(true);
      }
    } catch (err: any) {
      console.error('[Scanner] Failed to start camera:', err);
      setIsScanning(false);
      const errMsg = err?.message || String(err);
      const errName = err?.name || '';

      if (errName === 'NotAllowedError' || errMsg.includes('Permission') || errMsg.includes('NotAllowedError')) {
        setCameraError('Camera access is blocked. Please allow camera permissions in your browser to scan the QR.');
        setPermissionState('DENIED');
      } else if (errName === 'NotFoundError' || errMsg.includes('NotFoundError')) {
        setCameraError('No camera was found on this device.');
        setPermissionState('DENIED');
      } else if (errName === 'NotReadableError' || errMsg.includes('NotReadableError')) {
        setCameraError('Camera is currently being used by another application or browser tab.');
        setPermissionState('DENIED');
      } else if (errName === 'SecurityError' || errMsg.includes('SecurityError')) {
        setCameraError('Camera scanning requires a secure HTTPS connection.');
        setPermissionState('DENIED');
      } else {
        setCameraError('Unable to access device camera. Please verify permissions and try again.');
        setPermissionState('DENIED');
      }
    }
  };

  // Check initial permission status if supported by browser Permissions API
  useEffect(() => {
    let isMounted = true;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((status) => {
          if (!isMounted) return;
          if (status.state === 'granted') {
            startScanner();
          } else if (status.state === 'denied') {
            setPermissionState('DENIED');
            setCameraError('Camera access is blocked. Please allow camera permissions in your browser to scan the QR.');
          } else {
            // 'prompt': Show user the Allow Camera Access button
            setPermissionState('IDLE_PROMPT');
          }
        })
        .catch(() => {
          // If Permissions API doesn't support camera query, start camera directly
          if (isMounted) startScanner();
        });
    } else {
      startScanner();
    }

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, []);

  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(cameras[nextIndex].id);
  };

  const handleDecodedText = async (text: string) => {
    // Debounce & Lock: Ensure only one attendance request is fired per scan event
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const cleanText = text.trim();
      const payload: QRPayload = JSON.parse(cleanText);

      if (!payload.qrType || !payload.token || !payload.signature) {
        setCameraError('Invalid QR code format. Please scan the official Lakshya Smart Library QR screen.');
        isProcessingRef.current = false;
        return;
      }

      if (expectedType && payload.qrType !== expectedType) {
        setCameraError(`Scanned ${payload.qrType} QR code, but this gate requires an ${expectedType} QR code.`);
        isProcessingRef.current = false;
        return;
      }

      // Stop camera stream immediately upon successful detection
      await stopScanner();
      setScannedResult(payload);
      confetti({ particleCount: 60, spread: 55, origin: { y: 0.7 } });
      onScanSuccess(payload);
    } catch (e) {
      setCameraError('The scanned QR code is not a valid Smart Library Attendance QR.');
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center max-w-md mx-auto p-2 sm:p-4 font-sans">
      {/* Viewfinder Container */}
      <div className="relative w-full aspect-square bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 flex flex-col items-center justify-center">
        <div id={qrRegionId} className="w-full h-full object-cover" />

        {/* State A: Initial Camera Prompt (Permission Not Yet Requested or Prompt State) */}
        {permissionState === 'IDLE_PROMPT' && !scannedResult && (
          <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400 shadow-inner">
              <Camera className="w-8 h-8" />
            </div>
            <h4 className="font-extrabold text-lg mb-1 tracking-tight">Camera Access Required</h4>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed max-w-xs">
              Allow camera access to scan the live Lakshya Smart Library attendance QR code.
            </p>
            <button
              type="button"
              onClick={() => startScanner()}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Allow Camera Access
            </button>
          </div>
        )}

        {/* State B: Requesting / Initializing Camera */}
        {permissionState === 'REQUESTING' && !scannedResult && (
          <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm font-bold">Initializing camera viewfinder...</p>
            <p className="text-xs text-slate-400 mt-1">Please tap "Allow" if your browser prompts for permission.</p>
          </div>
        )}

        {/* State C: Reticle / Target Box Overlay when actively scanning */}
        {permissionState === 'GRANTED' && !scannedResult && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-56 h-56 border-2 border-indigo-400/80 rounded-2xl relative animate-pulse">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
            </div>
          </div>
        )}

        {/* State D: Camera Denied / Blocked Instructions */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/98 p-6 flex flex-col items-center justify-center text-center text-white z-20 overflow-y-auto">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mb-3 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-base mb-1 text-rose-300">Camera Access Blocked</h4>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed max-w-xs">{cameraError}</p>

            {/* Helpful step-by-step unblocking guide */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-left mb-5 max-w-xs w-full text-[11px] text-slate-300 space-y-1.5 font-medium">
              <p className="text-indigo-400 font-bold mb-1">To enable camera:</p>
              <p>1. Tap the lock/info icon in your browser URL bar.</p>
              <p>2. Open Permissions / Site Settings.</p>
              <p>3. Set Camera to "Allow".</p>
              <p>4. Return here and tap "Try Again".</p>
            </div>

            <button
              type="button"
              onClick={() => startScanner()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        )}

        {/* State E: Scanned Result Animation */}
        {scannedResult && (
          <div className="absolute inset-0 bg-emerald-950/95 p-6 flex flex-col items-center justify-center text-center text-white z-20 animate-fade-in">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-3 animate-bounce" />
            <h4 className="font-extrabold text-xl text-emerald-200">
              {scannedResult.qrType} QR Captured!
            </h4>
            <p className="text-xs text-emerald-300/80 mt-1">Recording attendance with library engine...</p>
          </div>
        )}
      </div>

      {/* Camera Controls bar (Flip Camera if device has multiple cameras) */}
      {cameras.length > 1 && permissionState === 'GRANTED' && !scannedResult && (
        <div className="mt-4 w-full flex items-center justify-center gap-2 px-1">
          <button
            type="button"
            onClick={handleSwitchCamera}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            <SwitchCamera className="w-3.5 h-3.5 text-indigo-500" />
            Flip Camera
          </button>
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center mt-3 max-w-xs">
        Point your camera at the live attendance QR displayed on the Admin's screen.
      </p>
    </div>
  );
};
