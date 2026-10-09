import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Download,
  Check,
  Camera,
  PlusCircle,
  FileText,
} from 'lucide-react';
import { ScannedPage } from '../utils/storage';
import { formatBytes } from '../utils/pdfExport';
import { rotatePageImage } from '../utils/imageProcessing';

interface PageDetailModalProps {
  pages: ScannedPage[];
  initialPageId?: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRetake?: (page: ScannedPage) => void;
  onInsertAfter?: (page: ScannedPage) => void;
}

export const PageDetailModal: React.FC<PageDetailModalProps> = ({
  pages,
  initialPageId,
  onClose,
  onDelete,
  onRetake,
  onInsertAfter,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElementsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Determine initial index
  const getInitialIndex = () => {
    if (!initialPageId || pages.length === 0) return 0;
    const idx = pages.findIndex((p) => p.id === initialPageId);
    return idx !== -1 ? idx : 0;
  };

  const [currentIndex, setCurrentIndex] = useState<number>(getInitialIndex);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const currentPage = pages[currentIndex] || pages[0];

  // Scroll to index using direction-agnostic standard scrollIntoView
  const scrollToIndex = (index: number, smooth = true) => {
    if (index < 0 || index >= pages.length) return;
    const targetEl = pageElementsRef.current[index];
    if (targetEl) {
      targetEl.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        inline: 'center',
        block: 'nearest',
      });
      setCurrentIndex(index);
      setIsConfirmingDelete(false);
    }
  };

  // Scroll to initial page on mount
  useEffect(() => {
    const idx = getInitialIndex();
    setCurrentIndex(idx);
    const timer = setTimeout(() => {
      scrollToIndex(idx, false);
    }, 50);
    return () => clearTimeout(timer);
  }, [initialPageId]);

  // Robust IntersectionObserver for RTL & Android Chrome tracking (avoids negative scrollLeft quirks)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idxStr = entry.target.getAttribute('data-page-index');
            if (idxStr !== null) {
              const idx = parseInt(idxStr, 10);
              if (!isNaN(idx)) {
                setCurrentIndex(idx);
                setIsConfirmingDelete(false);
              }
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.55,
      }
    );

    pageElementsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pages.length]);

  // Handle keyboard arrows (in Arabic book: ArrowLeft goes forward, ArrowRight goes backward)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        scrollToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowRight') {
        scrollToIndex(currentIndex - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, pages.length]);

  const downloadCurrentPage = async () => {
    if (!currentPage) return;
    let downloadUrl = currentPage.thumbnailUrl;
    let tempBlobUrl: string | null = null;
    if (currentPage.rotation && currentPage.rotation % 360 !== 0) {
      const { blob: rotatedBlob } = await rotatePageImage(currentPage.blob, currentPage.rotation);
      tempBlobUrl = URL.createObjectURL(rotatedBlob);
      downloadUrl = tempBlobUrl;
    }
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Page_${currentPage.pageNumber}.webp`;
    a.click();
    if (tempBlobUrl) {
      setTimeout(() => URL.revokeObjectURL(tempBlobUrl!), 1500);
    }
  };

  if (!currentPage || pages.length === 0) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-xl flex flex-col select-none animate-in fade-in duration-200"
    >
      {/* Top Header Controls Bar */}
      <div className="h-14 px-3 sm:px-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-white shrink-0 z-30">
        {/* Right side in RTL: Close and Page Index Counter */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition cursor-pointer"
            title="إغلاق والعودة للكاميرا"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-xs sm:text-sm text-white">
                صفحة {currentIndex + 1} من {pages.length}
              </h3>
              {currentPage.isFrontCover ? (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                  الغلاف الأمامي
                </span>
              ) : currentPage.isBackCover ? (
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-bold border border-sky-500/30">
                  الغلاف الخلفي
                </span>
              ) : null}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>{currentPage.width} × {currentPage.height}</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(currentPage.sizeBytes)}</span>
            </div>
          </div>
        </div>

        {/* Left side in RTL: Retake, Download, Delete Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Retake / Replace Page Button */}
          {onRetake && (
            <button
              type="button"
              onClick={() => onRetake(currentPage)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 active:scale-95 text-xs font-bold transition cursor-pointer"
              title="إعادة تصوير هذه الصفحة واستبدالها"
            >
              <Camera className="w-3.5 h-3.5 text-amber-300" />
              <span>إعادة تصوير</span>
            </button>
          )}

          {/* Download Page Button */}
          <button
            type="button"
            onClick={downloadCurrentPage}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition cursor-pointer"
            title="تحميل الصورة بصيغة عالية الوضوح"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Delete Page with In-place Confirmation */}
          {isConfirmingDelete ? (
            <div
              key="confirm-delete-box"
              className="flex items-center gap-1 bg-rose-950/90 border border-rose-700/60 p-1 rounded-xl animate-in fade-in"
            >
              <span className="text-[11px] text-rose-200 px-1 font-semibold">حذف؟</span>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingDelete(false);
                  onDelete(currentPage.id);
                  if (pages.length <= 1) {
                    onClose();
                  }
                }}
                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
              >
                <Check className="w-3 h-3" />
                <span>نعم</span>
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                لا
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="p-2 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 hover:text-white hover:bg-rose-900 active:scale-95 transition cursor-pointer"
              title="حذف هذه الصفحة من الكتاب"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Arabic Book Horizontal Snap Track (Right-to-Left: Page 1 on far right, swipe left for Page 2, 3...) */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden flex items-center justify-center">
        {/* Right Floating Step Button (In Arabic: Goes to PREVIOUS page towards the right) */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={() => scrollToIndex(currentIndex - 1)}
            className="absolute right-2 sm:right-4 z-20 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 active:scale-90 border border-slate-700 text-white flex items-center justify-center shadow-xl backdrop-blur transition cursor-pointer"
            title={`الصفحة السابقة (صفحة ${currentIndex})`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Left Floating Step Button (In Arabic: Goes to NEXT page towards the left) */}
        {currentIndex < pages.length - 1 && (
          <button
            type="button"
            onClick={() => scrollToIndex(currentIndex + 1)}
            className="absolute left-2 sm:left-4 z-20 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 active:scale-90 border border-slate-700 text-white flex items-center justify-center shadow-xl backdrop-blur transition cursor-pointer"
            title={`الصفحة التالية (صفحة ${currentIndex + 2})`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Smooth Horizontal Track with Android Gesture Shield (overscroll-contain & touch-pan-x) */}
        <div
          ref={scrollContainerRef}
          dir="rtl"
          className="w-full h-full flex flex-row items-center overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar select-none overscroll-x-contain touch-pan-x"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x',
          }}
        >
          {pages.map((page, index) => {
            const isNear = Math.abs(index - currentIndex) <= 2;
            return (
              <div
                key={page.id}
                ref={(el) => {
                  pageElementsRef.current[index] = el;
                }}
                data-page-index={index}
                className="flex-shrink-0 w-full h-full flex flex-col items-center justify-center p-3 sm:p-6 snap-center snap-always"
              >
                {/* Physical Book Page Frame */}
                <div className="relative max-h-[76vh] max-w-[94vw] sm:max-w-[85vw] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 bg-white">
                  {isNear ? (
                    <img
                      src={page.thumbnailUrl}
                      alt={`صفحة ${page.pageNumber}`}
                      style={{
                        transform: page.rotation ? `rotate(${page.rotation}deg)` : undefined,
                        maxHeight: (page.rotation || 0) % 180 !== 0 ? '68vw' : '74vh',
                        maxWidth: (page.rotation || 0) % 180 !== 0 ? '70vh' : '100%',
                      }}
                      className="w-auto object-contain pointer-events-none select-none transition-transform duration-300"
                      loading={index === currentIndex ? 'eager' : 'lazy'}
                    />
                  ) : (
                    <div className="w-64 h-96 bg-slate-900 flex items-center justify-center text-slate-500 text-xs">
                      <FileText className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  {/* High Contrast Page Badge in Bottom Corner */}
                  <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur border border-white/20 text-white font-black text-[11px] shadow">
                    {page.isFrontCover ? (
                      <span className="text-amber-300">الغلاف الأمامي</span>
                    ) : page.isBackCover ? (
                      <span className="text-sky-300">الغلاف الخلفي</span>
                    ) : (
                      <span className="text-emerald-300">صفحة {page.pageNumber}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Fluid Scrubber Bar & Quick Insert Pill */}
      <div className="h-14 px-4 bg-slate-950/95 border-t border-slate-800/80 flex items-center justify-between shrink-0 z-30">
        {/* Quick Position Tracker Text */}
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <span className="text-slate-400">اسحب أفقياً للتمرير:</span>
          <span className="text-emerald-400 font-bold">
            {currentIndex + 1} / {pages.length}
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            (اسحب لليسار لتقليب صفحات الكتاب للأمام 📖)
          </span>
        </div>

        {/* Floating Quick Action: Insert Missing Page in Current Slot */}
        {onInsertAfter && (
          <button
            type="button"
            onClick={() => onInsertAfter(currentPage)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm"
            title="تصوير صفحة مفقودة وإدراجها فوراً في هذا المكان"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ إدراج صفحة مفقودة بعد {currentPage.pageNumber}</span>
          </button>
        )}
      </div>
    </div>
  );
};
