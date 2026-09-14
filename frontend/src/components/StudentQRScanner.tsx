import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import {
  Camera,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  SwitchCamera,
  ShieldAlert,
  HelpCircle,
  Lock,
  VideoOff,
  AlertTriangle,
  GlobeLock,
} from 'lucide-react';
import { QRPayload } from '../types';
import { CameraInstructionsModal } from './CameraInstructionsModal';

interface StudentQRScannerProps {
  expectedType?: 'ENTRY' | 'EXIT';
  onScanSuccess: (payload: QRPayload) => void;
  isLoading?: boolean;
}

// 7 Explicit UI States matching the specification:
// 1: NOT_REQUESTED (IDLE_PROMPT) - Camera permission not requested / prompt state
// 2: GRANTED (SCANNING) - Permission granted, camera & scanner active
// 3: DENIED - Camera access blocked / denied
// 4: NOT_FOUND - No camera found on device
// 5: IN_USE - Camera currently used by another app
// 6: INSECURE - HTTPS / security problem
// 7: NOT_SUPPORTED - Browser does not support required camera APIs
type ScannerUIState =
  | 'CHECKING'
  | 'IDLE_PROMPT'
  | 'STARTING'
  | 'SCANNING'
  | 'DENIED'
  | 'NOT_FOUND'
  | 'IN_USE'
  | 'INSECURE'
  | 'NOT_SUPPORTED';

export const StudentQRScanner: React.FC<StudentQRScannerProps> = ({
  expectedType,
  onScanSuccess,
  isLoading = false,
}) => {
  const [uiState, setUiState] = useState<ScannerUIState>('CHECKING');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<QRPayload | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const activeTracksRef = useRef<MediaStreamTrack[]>([]);
  const qrRegionId = 'html5qr-code-full-region';

  // Stop scanner and release all camera tracks cleanly
  const stopScanner = useCallback(async () => {
    // Release any lingering direct stream tracks
    if (activeTracksRef.current.length > 0) {
      activeTracksRef.current.forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      activeTracksRef.current = [];
    }

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.debug('[Scanner] Scanner stop notice:', e);
      }
      scannerRef.current = null;
    }
  }, []);

  // Initialize and run Html5Qrcode viewfinder
  const initializeHtml5Qrcode = useCallback(
    async (specificCameraId?: string) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      try {
        setUiState('STARTING');
        setStatusNotice(null);

        // Clean up previous instances completely
        await stopScanner();

        // Check browser environment for camera capability
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setUiState('NOT_SUPPORTED');
          isStartingRef.current = false;
          return;
        }

        // Check HTTPS security
        if (
          window.location.protocol !== 'https:' &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1'
        ) {
          setUiState('INSECURE');
          isStartingRef.current = false;
          return;
        }

        const html5QrCode = new Html5Qrcode(qrRegionId);
        scannerRef.current = html5QrCode;

        // Discover available cameras
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
          console.debug('[Scanner] Device enumeration deferred:', e);
        }

        // Configure camera selection: prefer environment (rear) camera
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
            () => {} // Frame without QR
          );
          setUiState('SCANNING');
        } catch (primaryErr: any) {
          console.warn('[Scanner] Primary camera config failed, trying fallback:', primaryErr);
          // Fallback to front camera or default media
          await html5QrCode.start(
            { facingMode: 'user' },
            scanConfig,
            (decodedText) => handleDecodedText(decodedText),
            () => {}
          );
          setUiState('SCANNING');
        }
      } catch (err: any) {
        console.error('[Scanner] Failed to start scanner viewfinder:', err);
        classifyAndHandleError(err);
      } finally {
        isStartingRef.current = false;
      }
    },
    [stopScanner]
  );

  // Helper to map error types to UI states
  const classifyAndHandleError = (err: any) => {
    const errMsg = err?.message || String(err);
    const errName = err?.name || '';

    if (
      errName === 'NotAllowedError' ||
      errName === 'PermissionDeniedError' ||
      errMsg.includes('Permission') ||
      errMsg.includes('NotAllowedError') ||
      errMsg.includes('denied')
    ) {
      setUiState('DENIED');
      setStatusNotice('Camera access is blocked in your browser.');
    } else if (
      errName === 'NotFoundError' ||
      errName === 'DevicesNotFoundError' ||
      errMsg.includes('NotFoundError') ||
      errMsg.includes('Requested device not found')
    ) {
      setUiState('NOT_FOUND');
    } else if (
      errName === 'NotReadableError' ||
      errName === 'TrackStartError' ||
      errMsg.includes('NotReadableError') ||
      errMsg.includes('in use')
    ) {
      setUiState('IN_USE');
      setStatusNotice('Camera is in use by another application or browser tab.');
    } else if (errName === 'SecurityError' || errMsg.includes('SecurityError')) {
      setUiState('INSECURE');
    } else {
      setUiState('DENIED');
      setStatusNotice('Unable to access device camera. Please verify permissions.');
    }
  };

  // Check initial permission status on component mount
  const checkInitialPermission = useCallback(async () => {
    // Check browser capability first
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setUiState('NOT_SUPPORTED');
      return;
    }

    // Check secure context
    if (
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setUiState('INSECURE');
      return;
    }

    // Attempt Permissions API query if supported
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName });

        if (status.state === 'granted') {
          // CASE A: Already granted -> Open camera immediately with no extra screens
          await initializeHtml5Qrcode();
        } else if (status.state === 'denied') {
          // CASE C: Already denied -> Show recovery UI immediately (do not call getUserMedia blindly)
          setUiState('DENIED');
        } else {
          // CASE B: 'prompt' -> Show user-friendly "Camera Access Required" with [ Allow Camera Access ]
          setUiState('IDLE_PROMPT');
        }

        // Listen for live permission changes (e.g. user toggles in site settings)
        status.onchange = () => {
          if (status.state === 'granted') {
            initializeHtml5Qrcode();
          } else if (status.state === 'denied') {
            stopScanner();
            setUiState('DENIED');
          } else if (status.state === 'prompt') {
            stopScanner();
            setUiState('IDLE_PROMPT');
          }
        };
        return;
      } catch (e) {
        console.debug('[Scanner] Permissions API query for camera not supported by this browser:', e);
      }
    }

    // Fallback when Permissions API is not supported (e.g. iOS Safari):
    // Show State 1 so user can tap [ Allow Camera Access ] with direct user gesture
    setUiState('IDLE_PROMPT');
  }, [initializeHtml5Qrcode, stopScanner]);

  // Action: Student clicks [ Allow Camera Access ]
  // MUST call the real browser camera API with direct user gesture
  const handleAllowCameraAccess = async () => {
    setUiState('STARTING');
    setStatusNotice(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setUiState('NOT_SUPPORTED');
        return;
      }

      // Call getUserMedia directly to trigger native browser prompt
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
      });

      // Permission was GRANTED!
      // Stop temporary test tracks cleanly before starting Html5Qrcode
      testStream.getTracks().forEach((track) => track.stop());

      // Start scanner cleanly
      await initializeHtml5Qrcode();
    } catch (err: any) {
      console.warn('[Scanner] getUserMedia prompt rejected or failed:', err);
      classifyAndHandleError(err);
    }
  };

  // Action: Student clicks [ Check Camera Access ]
  // Re-evaluates permission in-place without page reload or logout
  const handleCheckCameraAccess = async () => {
    setUiState('CHECKING');
    setStatusNotice(null);

    try {
      // 1. If Permissions API is available, check it first
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });

          if (status.state === 'granted') {
            await initializeHtml5Qrcode();
            return;
          } else if (status.state === 'denied') {
            setUiState('DENIED');
            setStatusNotice(
              'Camera access is still blocked. Please allow Camera in your browser settings and try again.'
            );
            return;
          }
          // If 'prompt', fall through to getUserMedia below
        } catch (e) {
          // Permissions API query failed, test with getUserMedia
        }
      }

      // 2. Active test via getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setUiState('NOT_SUPPORTED');
        return;
      }

      const testStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
      });

      // Camera allowed! Clean up test tracks and launch scanner
      testStream.getTracks().forEach((track) => track.stop());
      await initializeHtml5Qrcode();
    } catch (err: any) {
      console.warn('[Scanner] Check camera test failed:', err);
      const errName = err?.name || '';
      const errMsg = err?.message || '';

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.includes('denied')
      ) {
        setUiState('DENIED');
        setStatusNotice(
          'Camera access is still blocked. Follow the steps below or tap "How to Allow Camera".'
        );
      } else {
        classifyAndHandleError(err);
      }
    }
  };

  // Mount effect: check initial permissions and register return-from-settings listeners
  useEffect(() => {
    checkInitialPermission();

    // Auto-recheck when returning to the tab from browser settings
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions
            .query({ name: 'camera' as PermissionName })
            .then((status) => {
              if (status.state === 'granted') {
                initializeHtml5Qrcode();
              }
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      stopScanner();
    };
  }, [checkInitialPermission, initializeHtml5Qrcode, stopScanner]);

  // Flip camera between front and back
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await initializeHtml5Qrcode(cameras[nextIndex].id);
  };

  // Handle scanned QR payload
  const handleDecodedText = async (text: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const cleanText = text.trim();
      const payload: QRPayload = JSON.parse(cleanText);

      if (!payload.qrType || !payload.token || !payload.signature) {
        setStatusNotice('Invalid QR code format. Please scan the official Lakshya Smart Library QR screen.');
        isProcessingRef.current = false;
        return;
      }

      if (expectedType && payload.qrType !== expectedType) {
        setStatusNotice(`Scanned ${payload.qrType} QR code, but this gate requires an ${expectedType} QR code.`);
        isProcessingRef.current = false;
        return;
      }

      // Stop camera stream immediately upon successful detection
      await stopScanner();
      setScannedResult(payload);
      confetti({ particleCount: 65, spread: 60, origin: { y: 0.7 } });
      onScanSuccess(payload);
    } catch (e) {
      setStatusNotice('The scanned QR code is not a valid Smart Library Attendance QR.');
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center max-w-md mx-auto p-2 sm:p-4 font-sans">
      {/* Viewfinder Container */}
      <div className="relative w-full aspect-square bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 flex flex-col items-center justify-center">
        <div id={qrRegionId} className="w-full h-full object-cover" />

        {/* STATE: CHECKING / VERIFYING */}
        {uiState === 'CHECKING' && (
          <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm font-bold">Checking camera access...</p>
            <p className="text-xs text-slate-400 mt-1">Verifying browser camera permissions</p>
          </div>
        )}

        {/* STATE 1: CAMERA PERMISSION NOT REQUESTED (IDLE_PROMPT) */}
        {uiState === 'IDLE_PROMPT' && !scannedResult && (
          <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400 shadow-inner">
              <Camera className="w-8 h-8" />
            </div>
            <h4 className="font-extrabold text-lg mb-1 tracking-tight">Camera Access Required</h4>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed max-w-xs">
              To scan the library QR code, allow camera access for Lakshya Smart Library.
            </p>
            <button
              type="button"
              onClick={handleAllowCameraAccess}
              className="flex items-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/40 transition cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4" />
              Allow Camera Access
            </button>
          </div>
        )}

        {/* STATE: STARTING / REQUESTING */}
        {uiState === 'STARTING' && !scannedResult && (
          <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm font-bold">Starting camera viewfinder...</p>
            <p className="text-xs text-slate-400 mt-1">
              Please tap <strong>Allow</strong> if prompted by your browser.
            </p>
          </div>
        )}

        {/* STATE 2: PERMISSION GRANTED (SCANNING) - Viewfinder Reticle */}
        {uiState === 'SCANNING' && !scannedResult && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-56 h-56 border-2 border-indigo-400/80 rounded-2xl relative animate-pulse">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
            </div>
          </div>
        )}

        {/* STATE 3: PERMISSION DENIED (CAMERA ACCESS BLOCKED) */}
        {uiState === 'DENIED' && (
          <div className="absolute inset-0 bg-slate-950/98 p-5 sm:p-6 flex flex-col items-center justify-center text-center text-white z-20 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mb-3 text-rose-400 shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-base mb-1 text-rose-300">Camera Access Blocked</h4>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed max-w-xs">
              Camera permission is currently blocked for this website. Allow camera access in your browser settings to scan.
            </p>

            {statusNotice && (
              <div className="mb-3.5 px-3 py-2 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-200 text-[11px] font-medium max-w-xs w-full text-left">
                {statusNotice}
              </div>
            )}

            {/* Quick unblocking guide steps */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-left mb-5 max-w-xs w-full text-[11px] text-slate-300 space-y-1.5 font-medium shadow-inner">
              <p className="text-indigo-400 font-bold mb-1">To scan the library QR code:</p>
              <p>1. Open this site's browser permissions/settings.</p>
              <p>2. Find <strong>Camera</strong>.</p>
              <p>3. Change Camera permission to <strong>Allow</strong>.</p>
              <p>4. Return to this page.</p>
              <p>5. Tap <strong>"Check Camera Access"</strong>.</p>
            </div>

            {/* Action Buttons: [ Check Camera Access ] & [ How to Allow Camera ] */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs">
              <button
                type="button"
                onClick={handleCheckCameraAccess}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Check Camera Access
              </button>
              <button
                type="button"
                onClick={() => setIsInstructionsOpen(true)}
                className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                How to Allow Camera
              </button>
            </div>
          </div>
        )}

        {/* STATE 4: NO CAMERA FOUND */}
        {uiState === 'NOT_FOUND' && (
          <div className="absolute inset-0 bg-slate-950/98 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400">
              <VideoOff className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-base mb-1 text-amber-300">No Camera Found</h4>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed max-w-xs">
              No camera was found on this device. Please connect a webcam or scan using a mobile phone.
            </p>
            <button
              type="button"
              onClick={handleCheckCameraAccess}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check Camera Access
            </button>
          </div>
        )}

        {/* STATE 5: CAMERA CURRENTLY IN USE */}
        {uiState === 'IN_USE' && (
          <div className="absolute inset-0 bg-slate-950/98 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-base mb-1 text-amber-300">Camera In Use</h4>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed max-w-xs">
              Camera is being used by another application. Close the other camera/scanning app and try again.
            </p>
            <button
              type="button"
              onClick={handleCheckCameraAccess}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check Camera Access
            </button>
          </div>
        )}

        {/* STATE 6: HTTPS / SECURITY PROBLEM */}
        {uiState === 'INSECURE' && (
          <div className="absolute inset-0 bg-slate-950/98 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mb-3 text-rose-400">
              <GlobeLock className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-base mb-1 text-rose-300">Secure Connection Required</h4>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
              Camera scanning requires a secure HTTPS connection. Please ensure you are accessing via HTTPS or localhost.
            </p>
          </div>
        )}

        {/* STATE 7: BROWSER NOT SUPPORTED */}
        {uiState === 'NOT_SUPPORTED' && (
          <div className="absolute inset-0 bg-slate-950/98 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mb-3 text-rose-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-base mb-1 text-rose-300">Browser Unsupported</h4>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
              Your browser does not support camera scanning. Please use a recent version of Chrome, Safari, Edge, or another supported browser.
            </p>
          </div>
        )}

        {/* SCANNED SUCCESS ANIMATION */}
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

      {/* Switch Camera Controls (Front / Back camera if multiple detected) */}
      {cameras.length > 1 && uiState === 'SCANNING' && !scannedResult && (
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

      {/* Status Notice under scanner if any (e.g. invalid format) */}
      {statusNotice && uiState === 'SCANNING' && (
        <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium text-center max-w-xs">
          {statusNotice}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center mt-3 max-w-xs">
        Point your camera at the live attendance QR displayed on the Admin's screen.
      </p>

      {/* Device Instruction Modal */}
      <CameraInstructionsModal
        isOpen={isInstructionsOpen}
        onClose={() => setIsInstructionsOpen(false)}
        onCheckAccess={handleCheckCameraAccess}
      />
    </div>
  );
};
