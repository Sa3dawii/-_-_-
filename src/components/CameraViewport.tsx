import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Move,
  Crosshair,
} from 'lucide-react';
import {
  Point,
  RectBox,
  BookFrameMode,
  rectToCorners,
  cornersToRect,
  getBookPresetRect,
  analyzeFrameQuality,
} from '../utils/imageProcessing';
import { audioFeedback } from '../utils/audioFeedback';

interface CameraViewportProps {
  onCaptureFrame: (videoElOrCanvas: HTMLVideoElement | HTMLCanvasElement, track: MediaStreamTrack | null, corners: Point[]) => Promise<void>;
  snapTriggerRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  corners: Point[];
  onChangeCorners: (newCorners: Point[]) => void;
  bookMode?: BookFrameMode;
  autoIntervalSec: number; // 0 = off, 2..5 = seconds
  motionGuardEnabled: boolean;
  isScanning: boolean;
  onToggleScanning?: (start: boolean) => void;
  isProcessing: boolean;
  qualityMode?: 'fhd' | '4k';
  isTorchOn?: boolean;
  onTorchSupportedChange?: (supported: boolean) => void;
  isActive?: boolean;
}

type DragTarget =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'tl'
  | 'tr'
  | 'br'
  | 'bl'
  | 'move'
  | null;

export const CameraViewport: React.FC<CameraViewportProps> = ({
  onCaptureFrame,
  snapTriggerRef,
  corners,
  onChangeCorners,
  bookMode = 'portrait',
  autoIntervalSec,
  motionGuardEnabled,
  isScanning,
  isProcessing,
  qualityMode = 'fhd',
  isTorchOn = false,
  onTorchSupportedChange,
  isActive = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(true);

  // Callback refs to break infinite render loops
  const onChangeCornersRef = useRef(onChangeCorners);
  useEffect(() => {
    onChangeCornersRef.current = onChangeCorners;
  }, [onChangeCorners]);

  const onTorchSupportedChangeRef = useRef(onTorchSupportedChange);
  useEffect(() => {
    onTorchSupportedChangeRef.current = onTorchSupportedChange;
  }, [onTorchSupportedChange]);

  const lastAppliedModeRef = useRef<BookFrameMode | null>(null);

  // Hardware capabilities
  const [torchSupported, setTorchSupported] = useState(false);

  // Motion, Sharpness & Rhythm state
  const [motionScore, setMotionScore] = useState(0);
  const [sharpnessScore, setSharpnessScore] = useState(0);
  const [isHandMoving, setIsHandMoving] = useState(false);
  const [isSharp, setIsSharp] = useState(true);
  const [isWaitingForSharpness, setIsWaitingForSharpness] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  // Sync ref for immediate thread-safe stop / pause
  const isScanningRef = useRef(isScanning);
  useEffect(() => {
    isScanningRef.current = isScanning;
    if (!isScanning) {
      setCountdownLeft(null);
      setIsWaitingForSharpness(false);
    }
  }, [isScanning]);

  // Quality state ref so high-frequency sampling (180ms) doesn't tear down countdown effect
  const qualityStateRef = useRef({
    isHandMoving: false,
    isSharp: true,
    sharpnessScore: 0,
    motionScore: 0,
  });

  // Orthogonal Bounding Box Drag State (horizontal & vertical adjustments)
  const currentRect = useMemo(() => cornersToRect(corners), [corners]);
  const [activeDrag, setActiveDrag] = useState<DragTarget>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; rect: RectBox } | null>(null);
  const [activePreset, setActivePreset] = useState<BookFrameMode>('portrait');
  const [isCustomized, setIsCustomized] = useState(false);

  const cornersRef = useRef(corners);
  useEffect(() => {
    cornersRef.current = corners;
  }, [corners]);

  // Resolution info
  const [activeResolution, setActiveResolution] = useState<{ width: number; height: number } | null>(null);

  // 90-degree Horizontal Spirit Level (Tilt) State
  const [tiltState, setTiltState] = useState<{
    pitch: number;
    roll: number;
    tiltDegrees: number;
    isLevel: boolean;
    supported: boolean;
  }>({
    pitch: 0,
    roll: 0,
    tiltDegrees: 0,
    isLevel: true,
    supported: false,
  });
  const [showLevelGuide, setShowLevelGuide] = useState(true);

  useEffect(() => {
    let lastUpdate = 0;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      const now = Date.now();
      if (now - lastUpdate < 60) return; // throttle to ~16 FPS
      lastUpdate = now;

      // When phone is horizontal over a book (screen up, camera pointing down to desk)
      // pitch is front-to-back tilt, roll is left-to-right tilt
      const pitch = Math.max(-45, Math.min(45, e.beta));
      const roll = Math.max(-45, Math.min(45, e.gamma));
      const tiltDegrees = Math.round(Math.hypot(pitch, roll));
      // Level if within +/- 3.5 degrees of flat 90° horizontal
      const isLevel = tiltDegrees <= 3.5;

      setTiltState({
        pitch,
        roll,
        tiltDegrees,
        isLevel,
        supported: true,
      });
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // Start Camera Stream
  const initCamera = useCallback(async () => {
    setIsLoadingCamera(true);
    setCameraError(null);

    // Stop old stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    try {
      // Find main rear camera if multiple back cameras exist (prefer 1.0x primary wide, avoid ultra-wide, telephoto or macro)
      let chosenDeviceId: string | undefined = undefined;
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          const backCameras = videoDevices.filter((d) => {
            const label = d.label.toLowerCase();
            return label.includes('back') || label.includes('rear') || label.includes('environment');
          });
          if (backCameras.length > 0) {
            // Filter out auxiliary specialized lenses that are NOT the primary 1x sensor
            const primaryCandidates = backCameras.filter((d) => {
              const label = d.label.toLowerCase();
              const isUltra = label.includes('ultra') || label.includes('0.5') || label.includes('0.6');
              const isMacro = label.includes('macro');
              const isTele = label.includes('tele') || label.includes('zoom') || label.includes('2x') || label.includes('3x') || label.includes('5x');
              const isDepth = label.includes('depth') || label.includes('tof');
              return !isUltra && !isMacro && !isTele && !isDepth;
            });

            // From primary candidates, prioritize ones explicitly labeled 'main', 'primary', 'wide', or '0'
            const bestMatch =
              primaryCandidates.find((d) => {
                const label = d.label.toLowerCase();
                return label.includes('main') || label.includes('primary') || label.includes('0') || label.includes('wide');
              }) ||
              primaryCandidates[0] ||
              backCameras[0];

            chosenDeviceId = bestMatch.deviceId;
          }
        } catch {
          // Device enumeration fallback
        }
      }

      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: qualityMode === '4k' ? { ideal: 3840, min: 1920 } : { ideal: 1920, min: 1280 },
        height: qualityMode === '4k' ? { ideal: 2160, min: 1080 } : { ideal: 1080, min: 720 },
        frameRate: { ideal: 30 },
      };
      if (chosenDeviceId) {
        videoConstraints.deviceId = { ideal: chosenDeviceId };
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: videoConstraints,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      const track = mediaStream.getVideoTracks()[0];
      setVideoTrack(track);

      // Inspect hardware capabilities
      if (track.getCapabilities) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = track.getCapabilities() as any;
        const hasTorch = !!caps.torch;
        setTorchSupported(hasTorch);
        onTorchSupportedChangeRef.current?.(hasTorch);

        // Apply continuous white balance, auto-exposure, and auto-focus
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const advanced: any = {};
        if (caps.whiteBalanceMode?.includes('continuous')) advanced.whiteBalanceMode = 'continuous';
        if (caps.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous';
        if (caps.focusMode?.includes('continuous')) advanced.focusMode = 'continuous';
        if (hasTorch && isTorchOn) advanced.torch = true;

        if (Object.keys(advanced).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (track as any).applyConstraints({ advanced: [advanced] }).catch(() => {});
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          if (videoRef.current) {
            setActiveResolution({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
          }
          if (track && 'applyConstraints' in track && isTorchOn) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (track as any)
              .applyConstraints({ advanced: [{ torch: true }] })
              .catch(() => {});
          }
        };
      }
      setIsLoadingCamera(false);
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      const message =
        (err as Error)?.name === 'NotAllowedError'
          ? 'تم رفض إذن الوصول للكاميرا. يرجى تفعيل إذن الكاميرا في إعدادات المتصفح.'
          : 'تعذر فتح الكاميرا. يرجى التأكد من عدم استخدام الكاميرا في تطبيق آخر.';
      setCameraError(message);
      setIsLoadingCamera(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityMode]);

  useEffect(() => {
    if (!isActive) return;
    initCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityMode, isActive]);

  // Synchronize torch state whenever isTorchOn prop changes
  useEffect(() => {
    if (videoTrack && 'applyConstraints' in videoTrack && torchSupported) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (videoTrack as any)
        .applyConstraints({ advanced: [{ torch: isTorchOn }] })
        .catch(() => {});
    }
  }, [isTorchOn, videoTrack, torchSupported]);

  // Perform single snap with guaranteed 100% synchronized flash and shutter click
  const triggerSnap = useCallback(async () => {
    if (!videoRef.current || isProcessing) return;

    // 1. Freeze the optical camera frame synchronously into canvas memory FIRST
    const videoEl = videoRef.current;
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = videoEl.videoWidth || 1920;
    sourceCanvas.height = videoEl.videoHeight || 1080;
    const ctx = sourceCanvas.getContext('2d', { alpha: false })!;
    ctx.drawImage(videoEl, 0, 0, sourceCanvas.width, sourceCanvas.height);

    // 2. Trigger the White Flash and the Camera Shutter Sound SIMULTANEOUSLY in the exact same tick!
    setShutterFlash(true);
    audioFeedback.playCameraShutter();
    setTimeout(() => setShutterFlash(false), 100);

    // 3. Delegate to background processing with immutable frozen canvas
    await onCaptureFrame(sourceCanvas, videoTrack, cornersRef.current);
  }, [videoTrack, isProcessing, onCaptureFrame]);

  const triggerSnapRef = useRef(triggerSnap);
  useEffect(() => {
    triggerSnapRef.current = triggerSnap;
    if (snapTriggerRef) {
      snapTriggerRef.current = triggerSnap;
    }
    return () => {
      if (snapTriggerRef) {
        snapTriggerRef.current = null;
      }
    };
  }, [triggerSnap, snapTriggerRef]);

  // Motion & Sharpness Quality Detection Loop (Samples every 180ms)
  useEffect(() => {
    let animId: number;
    let prevData: Uint8Array | null = null;
    let stillFramesCount = 0;

    const checkQuality = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const quality = analyzeFrameQuality(videoRef.current, prevData, 120, 90);
        prevData = quality.currentData;

        setMotionScore(quality.motionScore);
        setSharpnessScore(quality.sharpnessScore);

        let isMoving = quality.isHandMoving;
        if (quality.isHandMoving) {
          stillFramesCount = 0;
          setIsHandMoving(true);
        } else {
          stillFramesCount++;
          // Require 3 consecutive still frames (~540ms) to confirm hand has withdrawn and page is stationary
          if (stillFramesCount >= 3) {
            isMoving = false;
            setIsHandMoving(false);
          }
        }

        setIsSharp(quality.isSharp);

        // Keep ref updated so countdown loop always has real-time quality metrics without re-running effect
        qualityStateRef.current = {
          isHandMoving: isMoving,
          isSharp: quality.isSharp,
          sharpnessScore: quality.sharpnessScore,
          motionScore: quality.motionScore,
        };
      }
      animId = window.setTimeout(checkQuality, 180);
    };

    animId = window.setTimeout(checkQuality, 300);

    return () => {
      clearTimeout(animId);
    };
  }, []);

  // Rhythm Auto-Capture Countdown Loop with Clockwork Precision & Sharpness Gate at 0
  useEffect(() => {
    if (!isScanning || autoIntervalSec <= 0) {
      setCountdownLeft(null);
      setIsWaitingForSharpness(false);
      return;
    }

    let activeTimerId: number | null = null;
    let isCancelled = false;
    let currentSeconds = autoIntervalSec;
    setCountdownLeft(currentSeconds);
    setIsWaitingForSharpness(false);

    const scheduleStep = (delayMs: number) => {
      if (isCancelled || !isScanningRef.current) return;
      activeTimerId = window.setTimeout(step, delayMs);
    };

    const step = async () => {
      if (isCancelled || !isScanningRef.current) return;

      const { isHandMoving: handMoving, isSharp: sharp } = qualityStateRef.current;

      // 1. While countdown is above 0: Count down steadily (gives student predictable pace to flip page)
      if (currentSeconds > 0) {
        currentSeconds -= 1;
        setCountdownLeft(currentSeconds);

        if (currentSeconds > 0) {
          audioFeedback.playCountdownTick();
          scheduleStep(1000);
        } else {
          // Reached 0: evaluate sharpness & stillness gate
          scheduleStep(60);
        }
        return;
      }

      // 2. Reached 0: Stillness & Sharpness Gate
      // If motion guard is active and hand is still in frame or page is fluttering: WAIT momentarily!
      if (motionGuardEnabled && (handMoving || !sharp)) {
        setIsWaitingForSharpness(true);
        // Re-check every 200ms until page is stationary and sharp
        scheduleStep(200);
        return;
      }

      // 3. Clear and sharp: Fire the snap!
      setIsWaitingForSharpness(false);
      try {
        await triggerSnapRef.current();
      } catch (err) {
        console.warn('Capture error in auto loop:', err);
      }

      // Immediately verify cancellation state after async snap
      if (isCancelled || !isScanningRef.current) {
        setCountdownLeft(null);
        return;
      }

      // Reset for next page
      currentSeconds = autoIntervalSec;
      setCountdownLeft(currentSeconds);
      scheduleStep(1000);
    };

    scheduleStep(1000);

    return () => {
      isCancelled = true;
      if (activeTimerId !== null) {
        clearTimeout(activeTimerId);
        activeTimerId = null;
      }
    };
  }, [isScanning, autoIntervalSec, motionGuardEnabled]);

  // Reset frame to standard textbook proportions
  const handleResetFrame = useCallback(() => {
    setIsCustomized(false);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const newBox = getBookPresetRect(bookMode, rect.width, rect.height);
        onChangeCornersRef.current(rectToCorners(newBox));
      }
    }
  }, [bookMode]);

  // Set initial frame on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const bookRect = getBookPresetRect(bookMode, rect.width, rect.height);
      onChangeCornersRef.current(rectToCorners(bookRect));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-switch frame proportion ONLY when user switches between single-page and double-spread modes
  useEffect(() => {
    if (lastAppliedModeRef.current === bookMode) return;
    lastAppliedModeRef.current = bookMode;
    setIsCustomized(false);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const newBox = getBookPresetRect(bookMode, rect.width, rect.height);
        setActivePreset(bookMode);
        onChangeCornersRef.current(rectToCorners(newBox));
      }
    }
  }, [bookMode]);

  // Handle Dragging
  const handlePointerDown = (target: DragTarget, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - containerRect.left) / containerRect.width;
    const currentY = (e.clientY - containerRect.top) / containerRect.height;

    setActiveDrag(target);
    setDragStart({ x: currentX, y: currentY, rect: currentRect });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDrag || !dragStart || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - containerRect.left) / containerRect.width;
    const currentY = (e.clientY - containerRect.top) / containerRect.height;

    const dx = currentX - dragStart.x;
    const dy = currentY - dragStart.y;
    const init = dragStart.rect;

    let newX = init.x;
    let newY = init.y;
    let newW = init.width;
    let newH = init.height;

    const MIN_SIZE = 0.08;

    switch (activeDrag) {
      case 'move': {
        newX = Math.max(0.01, Math.min(0.99 - init.width, init.x + dx));
        newY = Math.max(0.01, Math.min(0.99 - init.height, init.y + dy));
        break;
      }
      case 'top': {
        const targetY = Math.max(0.01, Math.min(init.y + init.height - MIN_SIZE, init.y + dy));
        newY = targetY;
        newH = init.y + init.height - targetY;
        break;
      }
      case 'bottom': {
        newH = Math.max(MIN_SIZE, Math.min(0.99 - init.y, init.height + dy));
        break;
      }
      case 'left': {
        const targetX = Math.max(0.01, Math.min(init.x + init.width - MIN_SIZE, init.x + dx));
        newX = targetX;
        newW = init.x + init.width - targetX;
        break;
      }
      case 'right': {
        newW = Math.max(MIN_SIZE, Math.min(0.99 - init.x, init.width + dx));
        break;
      }
      case 'tl': {
        const targetX = Math.max(0.01, Math.min(init.x + init.width - MIN_SIZE, init.x + dx));
        const targetY = Math.max(0.01, Math.min(init.y + init.height - MIN_SIZE, init.y + dy));
        newX = targetX;
        newY = targetY;
        newW = init.x + init.width - targetX;
        newH = init.y + init.height - targetY;
        break;
      }
      case 'tr': {
        const targetY = Math.max(0.01, Math.min(init.y + init.height - MIN_SIZE, init.y + dy));
        newY = targetY;
        newH = init.y + init.height - targetY;
        newW = Math.max(MIN_SIZE, Math.min(0.99 - init.x, init.width + dx));
        break;
      }
      case 'br': {
        newW = Math.max(MIN_SIZE, Math.min(0.99 - init.x, init.width + dx));
        newH = Math.max(MIN_SIZE, Math.min(0.99 - init.y, init.height + dy));
        break;
      }
      case 'bl': {
        const targetX = Math.max(0.01, Math.min(init.x + init.width - MIN_SIZE, init.x + dx));
        newX = targetX;
        newW = init.x + init.width - targetX;
        newH = Math.max(MIN_SIZE, Math.min(0.99 - init.y, init.height + dy));
        break;
      }
    }

    const updatedRect: RectBox = {
      x: Math.max(0.01, Math.min(0.95, newX)),
      y: Math.max(0.01, Math.min(0.95, newY)),
      width: Math.max(MIN_SIZE, Math.min(0.98, newW)),
      height: Math.max(MIN_SIZE, Math.min(0.98, newH)),
    };

    setIsCustomized(true);
    onChangeCorners(rectToCorners(updatedRect));
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
    setDragStart(null);
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex-1 w-full bg-black overflow-hidden flex items-center justify-center select-none touch-none"
    >
      {/* Hidden motion calculation canvas */}
      <canvas ref={motionCanvasRef} className="hidden" />

      {/* Camera Video Stream with hardware-accelerated contrast and vivid text clarity filter */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          filter: 'contrast(1.12) saturate(1.24) brightness(1.04)',
        }}
        className="w-full h-full object-cover pointer-events-none"
      />

      {/* Shutter White Flash Feedback */}
      {shutterFlash && (
        <div className="absolute inset-0 bg-white/90 z-40 transition-opacity duration-100 pointer-events-none" />
      )}

      {/* Loading & Error States */}
      {isLoadingCamera && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 text-slate-200 z-30">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-medium">جارٍ تهيئة كاميرا المستشعر العالي...</p>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center text-slate-200 z-30">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
          <p className="text-base font-bold text-white mb-2">تعذر الوصول إلى الكاميرا</p>
          <p className="text-sm text-slate-400 max-w-xs mb-5 leading-relaxed">{cameraError}</p>
          <button
            onClick={initCamera}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Interactive Orthogonal Book Bounding Box SVG Overlay */}
      {!isLoadingCamera && !cameraError && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Shaded Mask Outside the Book Box */}
          <path
            d={`
              M 0 0 L 100 0 L 100 100 L 0 100 Z
              M ${currentRect.x * 100} ${currentRect.y * 100}
              L ${(currentRect.x + currentRect.width) * 100} ${currentRect.y * 100}
              L ${(currentRect.x + currentRect.width) * 100} ${(currentRect.y + currentRect.height) * 100}
              L ${currentRect.x * 100} ${(currentRect.y + currentRect.height) * 100} Z
            `}
            fill="rgba(0, 0, 0, 0.46)"
            fillRule="evenodd"
          />

          {/* Glowing Boundary of the Book */}
          <rect
            x={currentRect.x * 100}
            y={currentRect.y * 100}
            width={currentRect.width * 100}
            height={currentRect.height * 100}
            rx="0.5"
            fill="rgba(16, 185, 129, 0.04)"
            stroke={isScanning ? '#10b981' : '#34d399'}
            strokeWidth="0.6"
            strokeDasharray={isScanning ? 'none' : '1.5 1'}
          />

          {/* Book Spine Center Guide Line */}
          <line
            x1={(currentRect.x + currentRect.width / 2) * 100}
            y1={currentRect.y * 100}
            x2={(currentRect.x + currentRect.width / 2) * 100}
            y2={(currentRect.y + currentRect.height) * 100}
            stroke="rgba(52, 211, 153, 0.35)"
            strokeWidth="0.4"
            strokeDasharray="1 1"
          />
        </svg>
      )}

      {/* Orthogonal Edge Drag Handles (Horizontal & Vertical ONLY) */}
      {!isLoadingCamera && !cameraError && (
        <>
          {/* Top Edge Handle (Vertical drag only) */}
          <div
            onPointerDown={(e) => handlePointerDown('top', e)}
            style={{
              left: `${(currentRect.x + currentRect.width / 2) * 100}%`,
              top: `${currentRect.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-20 w-20 h-10 flex items-center justify-center cursor-ns-resize touch-none select-none group"
            title="سحب عمودي لضبط الحافة العلوية للكتاب"
          >
            <div className="w-12 h-2.5 rounded-full bg-emerald-400 border border-slate-950 shadow-md group-hover:scale-110 group-active:scale-125 transition-transform" />
          </div>

          {/* Bottom Edge Handle (Vertical drag only) */}
          <div
            onPointerDown={(e) => handlePointerDown('bottom', e)}
            style={{
              left: `${(currentRect.x + currentRect.width / 2) * 100}%`,
              top: `${(currentRect.y + currentRect.height) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-20 w-20 h-10 flex items-center justify-center cursor-ns-resize touch-none select-none group"
            title="سحب عمودي لضبط الحافة السفلية للكتاب"
          >
            <div className="w-12 h-2.5 rounded-full bg-emerald-400 border border-slate-950 shadow-md group-hover:scale-110 group-active:scale-125 transition-transform" />
          </div>

          {/* Left Edge Handle (Horizontal drag only) */}
          <div
            onPointerDown={(e) => handlePointerDown('left', e)}
            style={{
              left: `${currentRect.x * 100}%`,
              top: `${(currentRect.y + currentRect.height / 2) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-20 w-10 h-20 flex items-center justify-center cursor-ew-resize touch-none select-none group"
            title="سحب أفقي لضبط الحافة اليسرى للكتاب"
          >
            <div className="w-2.5 h-12 rounded-full bg-emerald-400 border border-slate-950 shadow-md group-hover:scale-110 group-active:scale-125 transition-transform" />
          </div>

          {/* Right Edge Handle (Horizontal drag only) */}
          <div
            onPointerDown={(e) => handlePointerDown('right', e)}
            style={{
              left: `${(currentRect.x + currentRect.width) * 100}%`,
              top: `${(currentRect.y + currentRect.height / 2) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-20 w-10 h-20 flex items-center justify-center cursor-ew-resize touch-none select-none group"
            title="سحب أفقي لضبط الحافة اليمنى للكتاب"
          >
            <div className="w-2.5 h-12 rounded-full bg-emerald-400 border border-slate-950 shadow-md group-hover:scale-110 group-active:scale-125 transition-transform" />
          </div>

          {/* 4 Corner Knobs (Orthogonal Corner Resizing) */}
          {[
            { target: 'tl' as const, x: currentRect.x, y: currentRect.y, label: 'أعلى-يسار' },
            { target: 'tr' as const, x: currentRect.x + currentRect.width, y: currentRect.y, label: 'أعلى-يمين' },
            { target: 'br' as const, x: currentRect.x + currentRect.width, y: currentRect.y + currentRect.height, label: 'أسفل-يمين' },
            { target: 'bl' as const, x: currentRect.x, y: currentRect.y + currentRect.height, label: 'أسفل-يسار' },
          ].map((corner) => (
            <div
              key={corner.target}
              onPointerDown={(e) => handlePointerDown(corner.target, e)}
              style={{
                left: `${corner.x * 100}%`,
                top: `${corner.y * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-20 w-12 h-12 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none hover:scale-110 active:scale-125 transition-transform"
              title={`زاوية ${corner.label} (اسحب لضبط الأبعاد)`}
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500/35 border-2 border-emerald-400 flex items-center justify-center shadow-lg">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-300 border border-slate-950" />
              </div>
            </div>
          ))}

          {/* Center Move Handle (Compact Non-Intrusive Knob) */}
          <div
            onPointerDown={(e) => handlePointerDown('move', e)}
            style={{
              left: `${(currentRect.x + currentRect.width / 2) * 100}%`,
              top: `${(currentRect.y + currentRect.height / 2) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-20 w-8 h-8 rounded-full bg-slate-950/85 hover:bg-slate-900 border border-emerald-400/80 text-emerald-300 flex items-center justify-center shadow-lg cursor-move active:cursor-grabbing touch-none select-none active:scale-95 transition backdrop-blur-md group"
            title="اضغط واسحب لتحريك كادر الكتاب بالكامل"
          >
            <Move className="w-3.5 h-3.5 text-emerald-300 group-hover:scale-110 transition-transform" />
          </div>

          {/* Level Guide (if supported) */}
          {tiltState.supported && showLevelGuide && (
            <div className="absolute top-2 right-2 z-30 pointer-events-none">
              <button
                type="button"
                onClick={() => setShowLevelGuide(false)}
                className={`pointer-events-auto px-2 py-1 rounded-full border text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-md cursor-pointer transition select-none active:scale-95 whitespace-nowrap ${
                  tiltState.isLevel
                    ? 'bg-emerald-950/85 border-emerald-500/60 text-emerald-300 shadow-emerald-950/50'
                    : 'bg-amber-950/85 border-amber-500/50 text-amber-300 shadow-amber-950/50'
                }`}
                title="ميزان تعامد الكاميرا: حافظ على زاوية 90° أفقية مستوية فوق الكتاب (اضغط للإخفاء)"
              >
                <div className="relative w-3 h-3 flex items-center justify-center">
                  <Crosshair
                    className={`w-3 h-3 ${tiltState.isLevel ? 'text-emerald-400' : 'text-amber-400'}`}
                  />
                  <div
                    className={`absolute w-1 h-1 rounded-full transition-transform duration-75 ${
                      tiltState.isLevel ? 'bg-emerald-300 scale-110' : 'bg-amber-400'
                    }`}
                    style={{
                      transform: `translate(${Math.max(-2.5, Math.min(2.5, (tiltState.roll / 15) * 2.5))}px, ${Math.max(
                        -2.5,
                        Math.min(2.5, (tiltState.pitch / 15) * 2.5)
                      )}px)`,
                    }}
                  />
                </div>
                <span>{tiltState.isLevel ? '90° مستوٍ ✓' : `${tiltState.tiltDegrees}°`}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Prominent Center Rhythm Countdown Display */}
      {isScanning && countdownLeft !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="flex flex-col items-center gap-1.5 animate-pulse">
            <div
              className={`w-20 h-20 rounded-full backdrop-blur-md flex items-center justify-center shadow-2xl transition-all ${
                isWaitingForSharpness || (countdownLeft === 0 && (!isSharp || isHandMoving))
                  ? 'bg-amber-500/25 border-2 border-amber-400 shadow-amber-500/40'
                  : 'bg-emerald-500/20 border-2 border-emerald-400 shadow-emerald-500/40'
              }`}
            >
              <span className="text-4xl font-black text-white font-mono-num">
                {isWaitingForSharpness || (countdownLeft === 0 && (!isSharp || isHandMoving))
                  ? '⏳'
                  : countdownLeft === 0
                  ? '📸'
                  : countdownLeft}
              </span>
            </div>
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg backdrop-blur-md border ${
                isWaitingForSharpness || (countdownLeft === 0 && (!isSharp || isHandMoving))
                  ? 'bg-amber-950/85 text-amber-200 border-amber-500/50 shadow-lg'
                  : 'bg-black/75 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {isWaitingForSharpness || (countdownLeft === 0 && (!isSharp || isHandMoving))
                ? !isSharp
                  ? 'في انتظار وضوح الفوكس ومنع الغباش...'
                  : 'في انتظار رفع اليد وثبات الصفحة...'
                : countdownLeft === 0
                ? 'تم الالتقاط بوضوح تام!'
                : `سيتم التقاط صورة بعد (${countdownLeft}ث)`}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Frame Drag Advice (Only visible when dragging) */}
      {activeDrag !== null && (
        <div className="absolute bottom-4 inset-x-4 flex justify-center z-20 pointer-events-none">
          <div className="bg-slate-900/95 text-emerald-300 text-xs px-3.5 py-1.5 rounded-xl border border-emerald-500/40 shadow-2xl backdrop-blur font-medium flex items-center gap-2">
            <span>
              {activeDrag === 'move'
                ? 'تحريك كادر الكتاب بالكامل'
                : activeDrag === 'top' || activeDrag === 'bottom'
                ? 'سحب عمودي لتحديد ارتفاع صفحة الكتاب'
                : activeDrag === 'left' || activeDrag === 'right'
                ? 'سحب أفقي لتحديد عرض صفحة الكتاب'
                : 'ضبط أبعاد زاوية الكتاب'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
