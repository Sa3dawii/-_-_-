/**
 * SmartBook Scanner - Mobile-First High-Resolution Automated Textbook Scanner
 * Powered by Client-Side Computer Vision, Web Audio API, IndexedDB & pdf-lib
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { CameraViewport } from './components/CameraViewport';
import { CaptureControls, WizardStep } from './components/CaptureControls';
import { PageCarousel } from './components/PageCarousel';
import { PageDetailModal } from './components/PageDetailModal';
import { ExportModal } from './components/ExportModal';
import { WelcomeModal } from './components/WelcomeModal';
import {
  Point,
  FilterMode,
  BookFrameMode,
  getDefaultCorners,
  warpPerspective,
  applyEnhancedTextFilter,
  applyGrayscaleFilter,
  applyColorEnhancementFilter,
  mapContainerCornersToSource,
  compressCanvasToBlob,
  getStandardOutputDimensions,
  rotatePageImage,
} from './utils/imageProcessing';
import { storageService, ScannedPage } from './utils/storage';
import { audioFeedback } from './utils/audioFeedback';
import { X } from 'lucide-react';

export default function App() {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [corners, setCorners] = useState<Point[]>(getDefaultCorners());
  const [filterMode, setFilterMode] = useState<FilterMode>('color');

  // Wizard Step State
  const [wizardStep, setWizardStep] = useState<WizardStep>('front_cover');
  const [bookMode, setBookMode] = useState<BookFrameMode>('portrait');

  // Quality Mode: default ultra-sharp (4k) with toggle to standard fast (fhd)
  const [qualityMode, setQualityMode] = useState<'fhd' | '4k'>('4k');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Rhythm automation state
  const [autoIntervalSec] = useState<number>(4); // Default 4s
  const [isScanning, setIsScanning] = useState(false);
  const [motionGuardEnabled] = useState(true); // Default active in background

  // Processing indicator
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals & Drawers
  const [selectedPage, setSelectedPage] = useState<ScannedPage | null>(null);
  const [retakeTargetPage, setRetakeTargetPage] = useState<ScannedPage | null>(null);
  const [insertAfterTargetPage, setInsertAfterTargetPage] = useState<ScannedPage | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [showFrameHint, setShowFrameHint] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('al_imtiaz_camera_permission_granted') !== 'true';
    }
    return true;
  });
  const snapTriggerRef = useRef<(() => Promise<void>) | null>(null);

  // Display tips on spread_prompt and dismiss when the user touches the screen
  useEffect(() => {
    if (wizardStep === 'spread_prompt') {
      setShowFrameHint(true);
    } else {
      setShowFrameHint(false);
    }
  }, [wizardStep]);

  useEffect(() => {
    if (!showFrameHint) return;

    const handleDismiss = () => {
      setShowFrameHint(false);
    };

    // Slight delay so the click that switched to spread_prompt doesn't immediately dismiss the hint
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleDismiss, { once: true });
      window.addEventListener('touchstart', handleDismiss, { once: true });
    }, 350);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleDismiss);
      window.removeEventListener('touchstart', handleDismiss);
    };
  }, [showFrameHint]);

  // Load persisted pages from IndexedDB on mount and set appropriate step
  useEffect(() => {
    storageService
      .getAllPages()
      .then((items) => {
        setPages(items);
        if (items.length === 0) {
          setWizardStep('front_cover');
          setBookMode('portrait');
        } else if (items.length === 1 && items[0].isFrontCover) {
          setWizardStep('back_cover');
          setBookMode('portrait');
        } else {
          setWizardStep('body_loop');
          setBookMode('landscape');
        }
      })
      .catch((err) => {
        console.warn('Could not load IndexedDB pages:', err);
      });
  }, []);

  // Capture Frame Pipeline
  const handleCaptureFrame = useCallback(
    async (
      videoElOrCanvas: HTMLVideoElement | HTMLCanvasElement,
      _track: MediaStreamTrack | null,
      currentCorners: Point[]
    ) => {
      if (isProcessing) return;
      setIsProcessing(true);

      try {
        let sourceCanvas: HTMLCanvasElement;
        let containerW = window.innerWidth;
        let containerH = window.innerHeight;

        if (videoElOrCanvas instanceof HTMLCanvasElement) {
          sourceCanvas = videoElOrCanvas;
          const videoDom = document.querySelector('video');
          if (videoDom?.parentElement) {
            containerW = videoDom.parentElement.clientWidth;
            containerH = videoDom.parentElement.clientHeight;
          }
        } else {
          sourceCanvas = document.createElement('canvas');
          sourceCanvas.width = videoElOrCanvas.videoWidth || 1920;
          sourceCanvas.height = videoElOrCanvas.videoHeight || 1080;
          const ctx = sourceCanvas.getContext('2d', { alpha: false })!;
          ctx.drawImage(videoElOrCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
          audioFeedback.playCameraShutter();
          containerW = videoElOrCanvas.parentElement?.clientWidth || window.innerWidth;
          containerH = videoElOrCanvas.parentElement?.clientHeight || window.innerHeight;
        }

        // Yield to main thread for background processing
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Map container corners to source coordinates
        const mappedCorners = mapContainerCornersToSource(
          currentCorners,
          containerW,
          containerH,
          sourceCanvas.width,
          sourceCanvas.height
        );

        // 1. Perspective Warp with dynamic output dimensions matching physical book ratio
        const { width: targetW, height: targetH } = getStandardOutputDimensions(
          sourceCanvas.width,
          sourceCanvas.height,
          mappedCorners
        );

        const warpedCanvas = warpPerspective(sourceCanvas, mappedCorners, targetW, targetH);

        // 2. High clarity filter
        if (filterMode === 'enhanced') {
          applyEnhancedTextFilter(warpedCanvas);
        } else if (filterMode === 'grayscale') {
          applyGrayscaleFilter(warpedCanvas);
        } else if (filterMode === 'color') {
          applyColorEnhancementFilter(warpedCanvas);
        }

        // 3. Compress to lightweight WebP / JPEG
        const blob = await compressCanvasToBlob(warpedCanvas, 0.82);

        // Retake Mode: Replace targeted page in-place!
        if (retakeTargetPage) {
          const targetIndex = pages.findIndex((p) => p.id === retakeTargetPage.id);
          if (targetIndex !== -1) {
            if (retakeTargetPage.thumbnailUrl) {
              URL.revokeObjectURL(retakeTargetPage.thumbnailUrl);
            }
            const newThumbnailUrl = URL.createObjectURL(blob);
            const replacedPage: ScannedPage = {
              ...pages[targetIndex],
              blob,
              width: targetW,
              height: targetH,
              sizeBytes: blob.size,
              timestamp: Date.now(),
              corners: [...currentCorners],
              filterMode,
              thumbnailUrl: newThumbnailUrl,
            };

            await storageService.updatePage(replacedPage);
            setPages((prev) => {
              const copy = [...prev];
              copy[targetIndex] = replacedPage;
              return copy;
            });

            setRetakeTargetPage(null);
            setBookMode('landscape');
            return;
          }
        }

        // Insert Mode: Splice in-place right after the targeted page!
        if (insertAfterTargetPage) {
          const targetIndex = pages.findIndex((p) => p.id === insertAfterTargetPage.id);
          const insertIndex = targetIndex !== -1 ? targetIndex + 1 : pages.length;
          const newThumbnailUrl = URL.createObjectURL(blob);
          const insertedPage: ScannedPage = {
            id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            pageNumber: insertIndex + 1,
            blob,
            width: targetW,
            height: targetH,
            sizeBytes: blob.size,
            timestamp: Date.now(),
            corners: [...currentCorners],
            filterMode,
            thumbnailUrl: newThumbnailUrl,
            isFrontCover: false,
            isBackCover: false,
          };

          const updated = [...pages];
          updated.splice(insertIndex, 0, insertedPage);
          updated.forEach((p, idx) => {
            p.pageNumber = idx + 1;
          });

          await storageService.reorderPages(updated);
          setPages(updated);
          setInsertAfterTargetPage(null);
          setBookMode('landscape');
          setSelectedPage(insertedPage);
          return;
        }

        // 4. Determine Cover Flags based on wizard step
        const isFront = wizardStep === 'front_cover';
        const isBack = wizardStep === 'back_cover';

        const newPageData = {
          id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          pageNumber: pages.length + 1,
          blob,
          width: targetW,
          height: targetH,
          sizeBytes: blob.size,
          timestamp: Date.now(),
          corners: [...currentCorners],
          filterMode,
          isFrontCover: isFront,
          isBackCover: isBack,
        };

        const savedPage = await storageService.addPage(newPageData);
        setPages((prev) => [...prev, savedPage]);

        // Auto advance wizard steps
        if (wizardStep === 'front_cover') {
          setWizardStep('back_cover');
          setBookMode('portrait');
        } else if (wizardStep === 'back_cover') {
          setWizardStep('spread_prompt');
          setBookMode('landscape');
        }
      } catch (err) {
        console.error('Error processing scanned page:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [pages, filterMode, isProcessing, wizardStep, retakeTargetPage, insertAfterTargetPage]
  );

  // Manual Instant Snap button handler (routes through CameraViewport for synchronized flash + shutter click)
  const handleManualSnap = useCallback(() => {
    if (snapTriggerRef.current) {
      snapTriggerRef.current();
    } else {
      const video = document.querySelector('video');
      if (video) {
        const track = (video.srcObject as MediaStream)?.getVideoTracks()?.[0] || null;
        handleCaptureFrame(video, track, corners);
      }
    }
  }, [corners, handleCaptureFrame]);

  // Skip back cover button handler
  const handleSkipBackCover = useCallback(() => {
    setWizardStep('spread_prompt');
    setBookMode('landscape');
  }, []);

  // Corner changes handler
  const handleChangeCorners = useCallback((newCorners: Point[]) => {
    setCorners(newCorners);
    setShowFrameHint(false);
  }, []);

  // Torch capability handler
  const handleTorchSupportedChange = useCallback((sup: boolean) => {
    setTorchSupported(sup);
  }, []);

  // Confirm spread ready handler
  const handleConfirmSpreadReady = useCallback(
    (startAuto: boolean) => {
      setWizardStep('body_loop');
      setBookMode('landscape');
      if (startAuto && autoIntervalSec > 0) {
        setIsScanning(true);
      }
    },
    [autoIntervalSec]
  );

  // Page deletion with memory cleanup and auto-pause
  const handleDeletePage = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsScanning(false);

    const targetPage = pages.find((p) => p.id === id);
    if (targetPage?.thumbnailUrl) {
      URL.revokeObjectURL(targetPage.thumbnailUrl);
    }

    await storageService.deletePage(id);
    const updated = pages.filter((p) => p.id !== id);
    updated.forEach((p, idx) => {
      p.pageNumber = idx + 1;
    });
    setPages(updated);
    await storageService.reorderPages(updated);

    if (updated.length === 0) {
      setWizardStep('front_cover');
      setBookMode('portrait');
    }
  };

  // Retake targeted page handler
  const handleStartRetake = useCallback((targetPage: ScannedPage) => {
    setIsScanning(false);
    setSelectedPage(null);
    setIsGalleryOpen(false);
    setRetakeTargetPage(targetPage);
    if (targetPage.isFrontCover || targetPage.isBackCover) {
      setBookMode('portrait');
    } else {
      setBookMode('landscape');
    }
  }, []);

  const handleCancelRetake = useCallback(() => {
    setRetakeTargetPage(null);
    if (pages.length <= 1) {
      setBookMode('portrait');
    } else {
      setBookMode('landscape');
    }
  }, [pages.length]);

  // Insert after targeted page handler
  const handleStartInsertAfter = useCallback((targetPage: ScannedPage) => {
    setIsScanning(false);
    setSelectedPage(null);
    setIsGalleryOpen(false);
    setRetakeTargetPage(null);
    setInsertAfterTargetPage(targetPage);
    setBookMode('landscape');
  }, []);

  const handleCancelInsert = useCallback(() => {
    setInsertAfterTargetPage(null);
    if (pages.length <= 1) {
      setBookMode('portrait');
    } else {
      setBookMode('landscape');
    }
  }, [pages.length]);

  // Batch rotate all pages by 90 degrees clockwise (Instant Metadata Rotation in 0.01s!)
  const handleRotateAll = useCallback(() => {
    if (pages.length === 0) return;
    const updatedPages = pages.map((page) => ({
      ...page,
      rotation: ((page.rotation || 0) + 90) % 360,
    }));
    setPages(updatedPages);
    audioFeedback.playCountdownTick();
    // Persist rotation metadata to IndexedDB in background without blocking UI
    storageService.reorderPages(updatedPages).catch((err) => {
      console.warn('Failed to persist rotation metadata:', err);
    });
  }, [pages]);

  // Clear all pages with memory revocation
  const handleClearAll = async () => {
    pages.forEach((p) => {
      if (p.thumbnailUrl) {
        URL.revokeObjectURL(p.thumbnailUrl);
      }
    });
    await storageService.clearAll();
    setPages([]);
    setIsScanning(false);
    setWizardStep('front_cover');
    setBookMode('portrait');
  };

  return (
    <div className="fixed inset-0 flex flex-col w-full h-full h-[100dvh] max-h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden overscroll-none touch-none font-sans select-none">
      {/* Top Header Bar */}
      <HeaderBar
        pageCount={pages.length}
        isTorchOn={isTorchOn}
        onToggleTorch={() => setIsTorchOn(!isTorchOn)}
        torchSupported={torchSupported}
        qualityMode={qualityMode}
        onToggleQualityMode={() => setQualityMode(qualityMode === 'fhd' ? '4k' : 'fhd')}
        onOpenHelp={() => setIsWelcomeOpen(true)}
      />

      {/* Interactive Guidance Step: Compact Translucent Sub-Bar */}
      <div className={`border-b px-3 py-1.5 flex items-center gap-2 z-20 shrink-0 ${retakeTargetPage ? 'bg-amber-950/90 border-amber-500/40' : insertAfterTargetPage ? 'bg-emerald-950/90 border-emerald-500/50' : 'bg-slate-950/85 border-emerald-500/20'}`}>
        {retakeTargetPage ? (
          <div key="retake-bar" className="flex items-center justify-between w-full text-[11px] sm:text-xs text-amber-300 font-bold">
            <div className="flex items-center gap-2 truncate">
              <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50 flex items-center justify-center font-bold text-[10px] shrink-0">
                🔄
              </span>
              <span className="truncate">
                إعادة تصوير <strong>صفحة {retakeTargetPage.pageNumber}</strong>: ضع الصفحة في الإطار واضغط التقاط البديل 📸
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelRetake}
              className="text-[10px] text-slate-300 hover:text-white underline mr-2 shrink-0 cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        ) : insertAfterTargetPage ? (
          <div key="insert-bar" className="flex items-center justify-between w-full text-[11px] sm:text-xs text-emerald-300 font-bold">
            <div className="flex items-center gap-2 truncate">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold text-[10px] shrink-0">
                ➕
              </span>
              <span className="truncate">
                إدراج صفحة مفقودة بعد <strong>صفحة {insertAfterTargetPage.pageNumber}</strong>: وجّه الكاميرا والتقط الصورة 📸
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelInsert}
              className="text-[10px] text-slate-300 hover:text-white underline mr-2 shrink-0 cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <div key={`step-container-${wizardStep}`} className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-200 truncate">
            {wizardStep === 'front_cover' ? (
              <div key="step-front" className="flex items-center gap-2 truncate">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
                  1
                </span>
                <span className="truncate">
                  ضع <strong>غلاف الكتاب الأمامي</strong> داخل الإطار واضغط التقاط 📸
                </span>
              </div>
            ) : wizardStep === 'back_cover' ? (
              <div key="step-back" className="flex items-center gap-2 truncate">
                <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
                  2
                </span>
                <span className="truncate">
                  ضع <strong>غلاف الظهر</strong> في الإطار (أو اضغط تخطي) 🔄
                </span>
              </div>
            ) : wizardStep === 'spread_prompt' ? (
              <div key="step-spread" className="flex items-center gap-2 truncate">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
                  3
                </span>
                <span className="truncate">
                  افتح الكتاب وضع <strong>صفحتين متجاورتين</strong> داخل الإطار 📖
                </span>
              </div>
            ) : (
              <div key="step-loop" className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate font-semibold text-emerald-300">
                  اقلب الصفحة بعد سماع صوت التشيك 📸
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Fullscreen Camera Viewport (Occupies 85%+ of screen!) */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden flex flex-col">
        <CameraViewport
          onCaptureFrame={handleCaptureFrame}
          snapTriggerRef={snapTriggerRef}
          corners={corners}
          onChangeCorners={handleChangeCorners}
          bookMode={bookMode}
          autoIntervalSec={autoIntervalSec}
          motionGuardEnabled={motionGuardEnabled}
          isScanning={isScanning}
          onToggleScanning={(start) => setIsScanning(start)}
          isProcessing={isProcessing}
          qualityMode={qualityMode}
          isTorchOn={isTorchOn}
          onTorchSupportedChange={handleTorchSupportedChange}
          isActive={!isWelcomeOpen}
        />

        {/* Floating Non-Intrusive Tips Card (Wider horizontal presence, zero camera height consumed) */}
        {showFrameHint && (
          <div
            onClick={() => setShowFrameHint(false)}
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 cursor-pointer w-[95vw] sm:w-[90vw] max-w-xl animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="bg-slate-950/92 backdrop-blur-md border border-emerald-500/40 px-3.5 py-2.5 rounded-2xl shadow-2xl flex flex-col gap-1.5 text-slate-100 text-xs">
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <span>💡</span>
                  <span>نصائح لالتقاط ممتاز:</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFrameHint(false);
                  }}
                  className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                  title="إغلاق التلميح"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1 text-[11px] sm:text-xs text-slate-200 leading-normal pr-1">
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>اسحب زوايا وحواف الإطار الأخضر لضبطه بدقة على مقاس كتابك إن لزم.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <span>يُفضل تشغيل فلاش التطبيق (الكشاف) لجودة صور أفضل ونصوص أكثر وضوحاً ⚡</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Step Controls */}
      <CaptureControls
        wizardStep={wizardStep}
        onManualSnap={handleManualSnap}
        onSkipBackCover={handleSkipBackCover}
        onConfirmSpreadReady={handleConfirmSpreadReady}
        isScanning={isScanning}
        onToggleScanning={(start) => setIsScanning(start)}
        onFinishScan={() => {
          setIsScanning(false);
          if (pages.length > 0) {
            setIsExportOpen(true);
          }
        }}
        pageCount={pages.length}
        lastThumbnail={pages.length > 0 ? pages[pages.length - 1].thumbnailUrl : undefined}
        onOpenGallery={() => setIsGalleryOpen(true)}
        autoIntervalSec={autoIntervalSec}
        isProcessing={isProcessing}
        retakeTargetPage={retakeTargetPage}
        onCancelRetake={handleCancelRetake}
        insertAfterTargetPage={insertAfterTargetPage}
        onCancelInsert={handleCancelInsert}
      />

      {/* Scanned Pages Carousel Drawer (Slide-up Bottom Sheet, 0px when closed) */}
      <PageCarousel
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        pages={pages}
        onSelectPage={(p) => setSelectedPage(p)}
        onDeletePage={(id, e) => handleDeletePage(id, e)}
        onClearAll={handleClearAll}
        onOpenExport={() => {
          setIsGalleryOpen(false);
          setIsExportOpen(true);
        }}
        onRotateAll={handleRotateAll}
      />

      {/* Modal: Smooth Continuous Horizontal Snap PDF-like Reader */}
      {selectedPage && (
        <PageDetailModal
          pages={pages}
          initialPageId={selectedPage.id}
          onClose={() => setSelectedPage(null)}
          onDelete={(id) => {
            handleDeletePage(id);
          }}
          onRetake={handleStartRetake}
          onInsertAfter={handleStartInsertAfter}
        />
      )}

      {/* Modal: PDF Export & WhatsApp / Telegram Direct Share */}
      {isExportOpen && (
        <ExportModal
          pages={pages}
          onClose={() => setIsExportOpen(false)}
          onClearAll={handleClearAll}
        />
      )}

      {/* Modal: Welcome Onboarding & Camera Permission Dialog */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onPermissionGranted={() => setIsWelcomeOpen(false)}
      />
    </div>
  );
}
