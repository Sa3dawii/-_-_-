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
    <header className="h-14 px-3 sm:px-4 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between z-30 shrink-0">
      {/* Zone 1: Al-Imtiaz Library Branding */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm shadow-sm">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <span className="font-extrabold text-sm tracking-tight text-white block">
            سكانر مكتبة الامتياز
          </span>
          <span className="text-[10px] text-slate-400 block -mt-0.5">
            {pageCount > 0 ? `${pageCount} صفحة ممسوحة` : 'ماسح كتب الأزهر والجامعات'}
          </span>
        </div>
      </div>

      {/* Zone 2: Actions & Testing Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quality Mode Switcher Pill */}
        <button
          onClick={onToggleQualityMode}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold border transition ${
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
          <Sparkles className="w-3 h-3" />
          <span>{qualityMode === '4k' ? 'أعلى جودة' : 'جودة عادية'}</span>
        </button>

        {/* Torch / Flash Toggle */}
        {torchSupported && (
          <button
            onClick={onToggleTorch}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
              isTorchOn
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:text-white'
            }`}
            title={isTorchOn ? 'إطفاء كشاف الإضاءة' : 'تشغيل كشاف الإضاءة لمزيد من الوضوح'}
            aria-label="كشاف الإضاءة"
          >
            {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
          </button>
        )}

        <PWAInstallButton />

        {onOpenHelp && (
          <button
            onClick={onOpenHelp}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition"
            title="عن مصور الكتب والتعليمات"
            aria-label="تعليمات النظام"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
