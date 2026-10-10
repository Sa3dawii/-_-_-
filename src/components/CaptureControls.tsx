import React from 'react';
import { Camera, Play, Pause, CheckCircle2, FastForward, BookOpen } from 'lucide-react';

export type WizardStep = 'front_cover' | 'back_cover' | 'spread_prompt' | 'body_loop';

interface CaptureControlsProps {
  wizardStep: WizardStep;
  onManualSnap: () => void;
  onSkipBackCover?: () => void;
  onConfirmSpreadReady?: (startAuto: boolean) => void;
  isScanning: boolean;
  onToggleScanning: (start: boolean) => void;
  onFinishScan?: () => void;
  pageCount?: number;
  lastThumbnail?: string;
  onOpenGallery?: () => void;
  autoIntervalSec?: number;
  onChangeAutoIntervalSec?: (sec: number) => void;
  isProcessing: boolean;
  retakeTargetPage?: { pageNumber: number } | null;
  onCancelRetake?: () => void;
  insertAfterTargetPage?: { pageNumber: number } | null;
  onCancelInsert?: () => void;
}

export const CaptureControls: React.FC<CaptureControlsProps> = ({
  wizardStep,
  onManualSnap,
  onSkipBackCover,
  onConfirmSpreadReady,
  isScanning,
  onToggleScanning,
  onFinishScan,
  pageCount = 0,
  lastThumbnail,
  onOpenGallery,
  autoIntervalSec = 4,
  isProcessing,
  retakeTargetPage,
  onCancelRetake,
  insertAfterTargetPage,
  onCancelInsert,
}) => {
  // INSERT MODE: Dedicated insert after target page button and cancel button
  if (insertAfterTargetPage) {
    return (
      <div className="bg-slate-950/95 border-t border-emerald-500/40 px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shrink-0 flex items-center justify-center gap-2.5 z-20">
        <div className="w-full max-w-sm flex items-center gap-2">
          <button
            type="button"
            onClick={onManualSnap}
            disabled={isProcessing}
            className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-100 fill-current" />
            <span>التقاط وإدراج بعد صفحة {insertAfterTargetPage.pageNumber} 📸</span>
          </button>

          {onCancelInsert && (
            <button
              type="button"
              onClick={onCancelInsert}
              className="px-3.5 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center border border-slate-700 transition cursor-pointer shrink-0"
              title="إلغاء وضع إدراج الصفحة والعودة"
            >
              <span>إلغاء</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // RETAKE MODE: Dedicated replace button and cancel button
  if (retakeTargetPage) {
    return (
      <div className="bg-slate-950/95 border-t border-amber-500/40 px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shrink-0 flex items-center justify-center gap-2.5 z-20">
        <div className="w-full max-w-sm flex items-center gap-2">
          <button
            type="button"
            onClick={onManualSnap}
            disabled={isProcessing}
            className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/60 transition cursor-pointer"
          >
            <Camera className="w-4 h-4 text-slate-950 fill-current" />
            <span>التقاط واستبدال صفحة {retakeTargetPage.pageNumber} 📸</span>
          </button>

          {onCancelRetake && (
            <button
              type="button"
              onClick={onCancelRetake}
              className="px-3.5 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center border border-slate-700 transition cursor-pointer shrink-0"
              title="إلغاء إعادة التصوير والاحتفاظ بالصورة السابقة"
            >
              <span>إلغاء</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // STEP 1: Front Cover Capture
  if (wizardStep === 'front_cover') {
    return (
      <div className="bg-slate-950/95 border-t border-slate-800/80 px-4 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shrink-0 flex items-center justify-center gap-3 z-20">
        <button
          type="button"
          onClick={onManualSnap}
          disabled={isProcessing}
          className="w-full max-w-sm h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition cursor-pointer"
        >
          <Camera className="w-5 h-5 text-emerald-100" />
          <span>التقاط الغلاف الأمامي 📸</span>
        </button>
      </div>
    );
  }

  // STEP 2: Back Cover Capture with Skip option
  if (wizardStep === 'back_cover') {
    return (
      <div className="bg-slate-950/95 border-t border-slate-800/80 px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shrink-0 flex items-center justify-center gap-2 z-20">
        <div className="w-full max-w-sm flex items-center gap-2">
          {pageCount > 0 && onOpenGallery && (
            <button
              type="button"
              onClick={onOpenGallery}
              className="relative w-11 h-11 rounded-xl overflow-hidden border-2 border-emerald-400/80 bg-slate-900 shadow-md active:scale-95 transition cursor-pointer flex items-center justify-center shrink-0"
              title={`معاينة الغلاف (${pageCount})`}
            >
              {lastThumbnail ? (
                <img src={lastThumbnail} alt="الغلاف" className="w-full h-full object-cover" />
              ) : (
                <BookOpen className="w-5 h-5 text-emerald-400" />
              )}
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                {pageCount}
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={onManualSnap}
            disabled={isProcessing}
            className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition cursor-pointer"
          >
            <Camera className="w-5 h-5 text-emerald-100" />
            <span>التقاط غلاف الظهر 📸</span>
          </button>

          <button
            type="button"
            onClick={onSkipBackCover}
            className="px-3 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1 border border-slate-700 transition cursor-pointer shrink-0"
            title="تخطي هذه الخطوة إذا لم يكن للكتاب أو المذكرة غلاف خلفي"
          >
            <FastForward className="w-4 h-4 text-slate-400" />
            <span>تخطي</span>
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: Spread Confirmation Prompt
  if (wizardStep === 'spread_prompt') {
    return (
      <div className="bg-slate-950/95 border-t border-slate-800/80 px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shrink-0 flex flex-col items-center gap-2 z-20">
        <div className="w-full max-w-md flex flex-col sm:flex-row items-center gap-2">
          <button
            type="button"
            onClick={() => onConfirmSpreadReady?.(true)}
            className="w-full sm:flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current text-white shrink-0" />
            <span>نعم، جاهز.. ابدأ التصوير التلقائي (صورة كل 4ث) 🚀</span>
          </button>

          <button
            type="button"
            onClick={() => onConfirmSpreadReady?.(false)}
            className="w-full sm:w-auto px-4 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer shrink-0"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>سأصور يدوياً</span>
          </button>
        </div>
      </div>
    );
  }

  // STEP 4: Standard Continuous Body Scanning Loop (Clean Single-Row Layout)
  return (
    <div className="bg-slate-950/95 border-t border-slate-800/80 px-2 sm:px-4 pt-1.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shrink-0 flex flex-col gap-1 z-20">
      {/* Main Action Shutter Row */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 py-0.5 flex-nowrap w-full">
        {/* Left: Native Camera Gallery Preview Bubble */}
        <div className="w-11 flex justify-start shrink-0">
          {pageCount > 0 && onOpenGallery ? (
            <button
              type="button"
              onClick={onOpenGallery}
              className="relative w-11 h-11 rounded-xl overflow-hidden border-2 border-emerald-400/80 bg-slate-900 shadow-md active:scale-95 transition cursor-pointer group flex items-center justify-center shrink-0"
              title={`معاينة الصفحات الملتقطة (${pageCount})`}
            >
              {lastThumbnail ? (
                <img src={lastThumbnail} alt="آخر صفحة" className="w-full h-full object-cover" />
              ) : (
                <BookOpen className="w-5 h-5 text-emerald-400" />
              )}
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                {pageCount}
              </div>
            </button>
          ) : (
            <div className="w-11 h-11" />
          )}
        </div>

        {/* Center: Main Shutter & Auto Play/Pause */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Auto Scan Mode Toggle Button (Two-line compact layout) */}
          <button
            type="button"
            onClick={() => onToggleScanning(!isScanning)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 h-11 sm:h-12 rounded-xl font-bold transition-all shadow-lg active:scale-95 cursor-pointer shrink-0 ${
              isScanning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
            }`}
            title={
              isScanning
                ? 'إيقاف مؤقت للتصوير التلقائي'
                : pageCount > 0
                ? `استمرار التصوير التلقائي بمعدل صورة كل ${autoIntervalSec} ثوانٍ`
                : `بدء التصوير التلقائي بمعدل صورة كل ${autoIntervalSec} ثوانٍ`
            }
          >
            {isScanning ? (
              <>
                <Pause className="w-4 h-4 fill-current shrink-0" />
                <span className="text-xs font-bold whitespace-nowrap">إيقاف مؤقت</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current shrink-0" />
                <div className="flex flex-col items-start leading-none text-right">
                  <span className="text-xs font-black whitespace-nowrap">
                    {pageCount > 0 ? 'استمرار' : 'تلقائي'}
                  </span>
                  <span className="text-[9px] text-emerald-100 font-medium whitespace-nowrap mt-0.5">
                    (صورة كل {autoIntervalSec}ث)
                  </span>
                </div>
              </>
            )}
          </button>

          {/* Manual Instant Shutter Button (Pill with camera core + 'يدوي' label) */}
          <button
            type="button"
            onClick={onManualSnap}
            disabled={isProcessing}
            className={`flex items-center gap-1.5 pl-2.5 pr-1.5 h-11 sm:h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-emerald-400/80 text-white transition-all shadow-md shadow-emerald-950/40 active:scale-95 shrink-0 ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="التقاط لقطة يدوية الآن"
            aria-label="التقاط يدوي"
          >
            {/* Inner Shutter Core */}
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-md shrink-0">
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
            </div>
            <span className="text-xs font-bold text-white whitespace-nowrap">يدوي</span>
          </button>
        </div>

        {/* Right: Finish & Review Book Button */}
        <div className="w-auto flex justify-end shrink-0">
          {pageCount > 0 && onFinishScan ? (
            <button
              type="button"
              onClick={onFinishScan}
              className="flex items-center gap-1 px-2.5 sm:px-4 h-11 sm:h-12 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950/50 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="إنهاء المسح والانتقال لمراجعة الكتاب وتصديره PDF لمكتبة الامتياز"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
              <span>إنهاء ({pageCount})</span>
            </button>
          ) : (
            <div className="w-11 h-11" />
          )}
        </div>
      </div>
    </div>
  );
};
