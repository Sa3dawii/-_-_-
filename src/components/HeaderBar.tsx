import React from 'react';
import { Zap, ZapOff, Sparkles, BookOpen, Info } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderBarProps {
  pageCount: number;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  torchSupported: boolean;
  qualityMode: 'fhd' | '4k';
  onToggleQualityMode: () => void;
  onOpenHelp?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  pageCount,
  isTorchOn,
  onToggleTorch,
  torchSupported,
  qualityMode,
  onToggleQualityMode,
  onOpenHelp,
}) => {
  return (
    <header className="h-13 px-2 sm:px-4 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between z-30 shrink-0 w-full select-none overflow-hidden">
      {/* Zone 1: Al-Imtiaz Library Branding */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm shadow-sm shrink-0">
          <BookOpen className="w-4 h-4" />
        </div>
        <div className="min-w-0 overflow-hidden">
          <span className="font-extrabold text-xs sm:text-sm tracking-tight text-white block truncate whitespace-nowrap">
            سكانر مكتبة الامتياز
          </span>
          <span className="text-[10px] text-slate-400 block -mt-0.5 truncate whitespace-nowrap">
            {pageCount > 0 ? `${pageCount} صفحة مُصوّرة` : 'مصور الكتب الآلي'}
          </span>
        </div>
      </div>

      {/* Zone 2: Actions & Testing Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Quality Mode Switcher Pill */}
        <button
          type="button"
          onClick={onToggleQualityMode}
          className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold border transition whitespace-nowrap shrink-0 cursor-pointer ${
            qualityMode === '4k'
              ? 'bg-amber-950/70 border-amber-500/40 text-amber-300'
              : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
          }`}
          title={
            qualityMode === '4k'
              ? 'الوضع الحالي: أعلى جودة (4K) لنقاء النصوص - اضغط للتبديل للجودة العادية'
              : 'الوضع الحالي: جودة عادية (FHD) سريعة وموفرة - اضغط للتبديل لأعلى جودة'
          }
        >
          <Sparkles className="w-3 h-3 shrink-0" />
          <span className="whitespace-nowrap">{qualityMode === '4k' ? 'أعلى جودة' : 'جودة عادية'}</span>
        </button>

        {/* Torch / Flash Toggle */}
        {torchSupported && (
          <button
            type="button"
            onClick={onToggleTorch}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition shrink-0 cursor-pointer ${
              isTorchOn
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:text-white'
            }`}
            title={isTorchOn ? 'إطفاء كشاف الإضاءة' : 'تشغيل كشاف الإضاءة لمزيد من الوضوح'}
            aria-label="كشاف الإضاءة"
          >
            {isTorchOn ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
          </button>
        )}

        <PWAInstallButton />

        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition shrink-0 cursor-pointer"
            title="عن مصور الكتب والتعليمات"
            aria-label="تعليمات النظام"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
