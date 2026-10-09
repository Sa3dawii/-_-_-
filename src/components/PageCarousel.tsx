import React, { useState } from 'react';
import { Trash2, FileText, Check, X, BookOpen, RotateCw } from 'lucide-react';
import { ScannedPage } from '../utils/storage';
import { formatBytes } from '../utils/pdfExport';

interface PageCarouselProps {
  isOpen: boolean;
  onClose: () => void;
  pages: ScannedPage[];
  onSelectPage: (page: ScannedPage) => void;
  onDeletePage?: (id: string, e: React.MouseEvent) => void;
  onClearAll?: () => void;
  onOpenExport: () => void;
  onRotateAll?: () => void;
  isRotatingAll?: boolean;
}

export const PageCarousel: React.FC<PageCarouselProps> = ({
  isOpen,
  onClose,
  pages,
  onSelectPage,
  onDeletePage,
  onClearAll,
  onOpenExport,
  onRotateAll,
  isRotatingAll = false,
}) => {
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const totalBytes = pages.reduce((acc, p) => acc + p.sizeBytes, 0);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside to close backdrop */}
      <div className="flex-1 w-full" onClick={onClose} />

      {/* Slide-Up Drawer Container */}
      <div className="w-full bg-slate-950/98 border-t border-slate-800/90 rounded-t-3xl shadow-2xl p-4 flex flex-col gap-3 max-h-[75vh] overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-white">
              صفحات الكتاب الممسوحة ({pages.length})
            </span>
            {pages.length > 0 && (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                {formatBytes(totalBytes)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="إغلاق المعاينة والعودة للكاميرا"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Empty state or Thumbnails Carousel */}
        {pages.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <BookOpen className="w-8 h-8 text-emerald-400/60" />
            <p>لم يتم التقاط أي صفحات بعد 📚</p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="group relative flex-shrink-0 w-16 h-22 rounded-xl overflow-hidden border border-slate-800 hover:border-emerald-400 bg-slate-900 cursor-pointer transition shadow-md"
              >
                <button
                  type="button"
                  onClick={() => onSelectPage(page)}
                  className="w-full h-full block focus:outline-none"
                  title={`معاينة صفحة ${index + 1}`}
                >
                  <img
                    src={page.thumbnailUrl}
                    alt={`صفحة ${index + 1}`}
                    style={{
                      transform: page.rotation ? `rotate(${page.rotation}deg)` : undefined,
                    }}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  {/* Page Number & Cover Badges */}
                  <div className="absolute bottom-1 right-1 pointer-events-none">
                    {page.isFrontCover ? (
                      <span className="bg-amber-500 text-slate-950 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">
                        الغلاف
                      </span>
                    ) : page.isBackCover ? (
                      <span className="bg-sky-500 text-slate-950 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">
                        الظهر
                      </span>
                    ) : (
                      <span className="bg-black/85 text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded backdrop-blur border border-emerald-500/30">
                        {index + 1}
                      </span>
                    )}
                  </div>
                </button>

                {/* Quick Delete Single Photo Button */}
                {onDeletePage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(page.id, e);
                    }}
                    className="absolute top-1 left-1 w-6 h-6 rounded-md bg-rose-600/90 hover:bg-rose-500 active:scale-90 text-white flex items-center justify-center shadow-lg transition opacity-80 group-hover:opacity-100 z-10"
                    title={`حذف صفحة ${index + 1} فوراً`}
                    aria-label={`حذف صفحة ${index + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Controls: Rotate All + Clear All + Export */}
        {pages.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-900">
            {/* Quick Actions (Rotate All + Clear All) */}
            <div className="flex items-center gap-2">
              {/* Rotate All Pages 90° (Instantaneous) */}
              {onRotateAll && (
                <button
                  type="button"
                  onClick={onRotateAll}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-white text-xs font-medium transition active:scale-95 cursor-pointer"
                  title="تدوير كافة الصور 90 درجة معاً بلحظة واحدة"
                >
                  <RotateCw className="w-4 h-4 text-emerald-400" />
                  <span>تدوير الكل</span>
                </button>
              )}

              {/* Quick Clear All Button with Inline Confirmation */}
              {onClearAll && (
                isConfirmingClearAll ? (
                  <div key="confirm-clear-box" className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-600/70 p-1.5 rounded-xl shadow-lg animate-in fade-in">
                    <span className="text-[11px] text-rose-200 font-bold px-1 whitespace-nowrap">
                      مسح الكل؟
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmingClearAll(false);
                        onClearAll();
                      }}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                      title="تأكيد مسح كافة الصفحات"
                    >
                      <Check className="w-3 h-3" />
                      <span>نعم</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClearAll(false)}
                      className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                      title="إلغاء التراجع"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    key="btn-clear-action"
                    type="button"
                    onClick={() => setIsConfirmingClearAll(true)}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 text-xs font-medium transition active:scale-95 cursor-pointer"
                    title={`مسح كافة الصفحات (${pages.length}) وبدء كتاب جديد`}
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>مسح الكل</span>
                  </button>
                )
              )}
            </div>

            {/* Primary Export CTA Button */}
            <button
              onClick={onOpenExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 active:scale-95 transition"
            >
              <FileText className="w-4 h-4" />
              <div className="text-right leading-tight">
                <div>تصدير PDF ({pages.length})</div>
                <div className="text-[10px] text-emerald-200 font-normal">
                  {formatBytes(totalBytes)}
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
