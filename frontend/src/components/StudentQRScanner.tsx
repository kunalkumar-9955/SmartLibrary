import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { Camera, AlertCircle, RefreshCw, CheckCircle2, SwitchCamera } from 'lucide-react';
import { QRPayload } from '../types';

interface StudentQRScannerProps {
  expectedType?: 'ENTRY' | 'EXIT';
  onScanSuccess: (payload: QRPayload) => void;
  isLoading?: boolean;
}

export const StudentQRScanner: React.FC<StudentQRScannerProps> = ({
  expectedType,
  onScanSuccess,
  isLoading = false,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<QRPayload | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = 'html5qr-code-full-region';

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.debug('Failed to cleanly stop scanner', e);
      }
    }
    setIsScanning(false);
  };

  const startScanner = async (specificCameraId?: string) => {
    try {
      setCameraError(null);
      setScannedResult(null);

      // Stop any existing instance
      await stopScanner();

      const html5QrCode = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5QrCode;

      // Discover cameras
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
        console.debug('Camera enumeration deferred until permission granted');
      }

      // Determine camera target
      let cameraConfig: any = { facingMode: 'environment' };

      if (specificCameraId) {
        cameraConfig = specificCameraId;
      } else if (detectedCameras.length > 0) {
        // Look for rear/environment camera on phones, else fallback to first available
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
          () => {} // frame without QR, ignore
        );
        setIsScanning(true);
      } catch (primaryErr: any) {
        console.warn('Primary camera config failed, falling back to front/user webcam:', primaryErr);
        // Fallback to front camera (laptop webcam, etc.)
        await html5QrCode.start(
          { facingMode: 'user' },
          scanConfig,
          (decodedText) => handleDecodedText(decodedText),
          () => {}
        );
        setIsScanning(true);
      }
    } catch (err: any) {
      console.error('[Scanner] Failed to start camera:', err);
      setIsScanning(false);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('OverconstrainedError')) {
        setCameraError('No suitable camera detected on this device.');
      } else {
        setCameraError('Unable to start live camera viewfinder. Please verify camera permissions.');
      }
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
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
    try {
      const cleanText = text.trim();
      const payload: QRPayload = JSON.parse(cleanText);

      if (!payload.qrType || !payload.token || !payload.signature) {
        setCameraError('Invalid QR code format. Please scan the official Smart Library attendance screen.');
        return;
      }

      if (payload.expiresAt && payload.expiresAt < Date.now()) {
        setCameraError('This QR code has expired. Please ask Admin to display the fresh QR.');
        return;
      }

      await stopScanner();
      setScannedResult(payload);
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.7 } });
      onScanSuccess(payload);
    } catch (e) {
      setCameraError('The scanned QR code is not a valid Smart Library Attendance QR.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center max-w-md mx-auto p-2 sm:p-4">
      {/* Viewfinder Container */}
      <div className="relative w-full aspect-square bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 flex flex-col items-center justify-center">
        <div id={qrRegionId} className="w-full h-full object-cover" />

        {/* Reticle / Target Box Overlay */}
        {!scannedResult && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-56 h-56 border-2 border-indigo-400/80 rounded-2xl relative animate-pulse">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
            </div>
          </div>
        )}

        {/* Camera Permission / Unavailable Error Notice */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center text-white z-10">
            <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
            <h4 className="font-bold text-base mb-1">Camera Notice</h4>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed max-w-xs">{cameraError}</p>
            <button
              type="button"
              onClick={() => startScanner()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Camera
            </button>
          </div>
        )}

        {/* Real Scanned Result Animation */}
        {scannedResult && (
          <div className="absolute inset-0 bg-emerald-950/95 p-6 flex flex-col items-center justify-center text-center text-white z-10 animate-fade-in">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-3 animate-bounce" />
            <h4 className="font-extrabold text-xl text-emerald-200">
              {scannedResult.qrType} QR Scanned!
            </h4>
            <p className="text-xs text-emerald-300/80 mt-1">Verifying with secure attendance engine...</p>
          </div>
        )}
      </div>

      {/* Camera Controls bar (Only Flip Camera if multiple cameras exist) */}
      {cameras.length > 1 && (
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

      <p className="text-[11px] text-slate-400 text-center mt-3">
        Align the Admin's live dynamic QR code inside the box to automatically record attendance.
      </p>
    </div>
  );
};
