import React, { useState } from 'react';
import { X, FileText, Share2, Download, CheckCircle, RefreshCw, Trash2 } from 'lucide-react';
import { ScannedPage } from '../utils/storage';
import {
  generateBookPDF,
  formatBytes,
  downloadBlob,
  PDFExportProgress,
  getAlImtiazWhatsAppUrl,
} from '../utils/pdfExport';

interface ExportModalProps {
  pages: ScannedPage[];
  onClose: () => void;
  onClearAll: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  pages,
  onClose,
  onClearAll,
}) => {
  const [docTitle, setDocTitle] = useState(`كتاب_أزهر_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`);
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [progress, setProgress] = useState<PDFExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<{
    file: File;
    blob: Blob;
    sizeBytes: number;
  } | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const totalRawBytes = pages.reduce((acc, p) => acc + p.sizeBytes, 0);

  const handleStartExport = async () => {
    setIsExporting(true);
    setShareStatus(null);
    try {
      const result = await generateBookPDF(pages, docTitle, (p) => {
        setProgress(p);
      });
      setExportResult(result);
    } catch (err: unknown) {
      alert((err as Error)?.message || 'فشل في تصدير ملف الـ PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Solution 1: Direct File Share to WhatsApp / Telegram via OS Native Share Sheet
  const handleDirectShare = async () => {
    if (!exportResult) return;
    setShareStatus('جارٍ فتح نافذة المشاركة لنقل الملف مباشرة إلى واتساب أو تليجرام...');

    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [exportResult.file] })
    ) {
      try {
        await navigator.share({
          files: [exportResult.file],
          title: docTitle,
          text: `ملف PDF لكتاب: "${docTitle}" (${pages.length} صفحة) - لتلخيصه بمكتبة الامتياز`,
        });
        setShareStatus('تم فتح شاشة المشاركة بنجاح! اختر محادثة مكتبة الامتياز للإرسال فوراً 🚀');
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          setShareStatus('تم إغلاق نافذة المشاركة.');
          return;
        }
        console.warn('Native share error:', err);
      }
    }

    // Fallback if browser/device doesn't support file sharing (e.g. desktop)
    downloadBlob(exportResult.blob, exportResult.file.name);
    const waUrl = getAlImtiazWhatsAppUrl(docTitle, pages.length);
    window.open(waUrl, '_blank');
    setShareStatus('جهازك لا يدعم مشاركة الملفات المباشرة، تم حفظ الـ PDF وجارٍ فتح محادثة المكتبة.');
  };

  const handleDownload = () => {
    if (!exportResult) return;
    downloadBlob(exportResult.blob, exportResult.file.name);
    setShareStatus('تم حفظ نسخة الـ PDF في ملفات جهازك بنجاح 📥');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-white">تصدير ومشاركة PDF</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Document Title Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              اسم الكتاب:
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              disabled={isExporting || !!exportResult}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              placeholder="مثال: كتاب الفقه المقارن الفرقة الرابعة شريعة ترم ثاني"
            />
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-400 block mb-0.5">عدد الصفحات</span>
              <span className="font-bold text-sm text-white font-mono-num">{pages.length} صفحة</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">الحجم التقريبي للـ PDF</span>
              <span className="font-bold text-sm text-emerald-400 font-mono-num">
                {exportResult ? formatBytes(exportResult.sizeBytes) : formatBytes(totalRawBytes)}
              </span>
            </div>
          </div>

          {/* Progress Indicator */}
          {isExporting && progress && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>
                  {progress.stage === 'preparing'
                    ? 'تهيئة محرك التجميع...'
                    : progress.stage === 'embedding'
                    ? `جارٍ دمج صفحة ${progress.currentPage} من ${progress.totalPages}...`
                    : 'جارٍ ضغط وحفظ ملف الـ PDF...'}
                </span>
                <span className="font-mono-num font-bold text-emerald-400">
                  {Math.round((progress.currentPage / progress.totalPages) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{
                    width: `${Math.round((progress.currentPage / progress.totalPages) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Completed State */}
          {exportResult && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-sm">
                <CheckCircle className="w-5 h-5" />
                <span>تم إنشاء ملف الـ PDF بنجاح فائق!</span>
              </div>
              <p className="text-xs text-slate-300">
                جاهز للمشاركة المباشرة عبر واتساب أو تليجرام بحجم مضغوط ({formatBytes(exportResult.sizeBytes)}).
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {!exportResult ? (
            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-98 transition"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ تجميع المستند...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>تجميع الـ PDF الآن</span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-2.5">
              {/* PRIMARY ACTION: Direct File Share to WhatsApp / Telegram */}
              <button
                type="button"
                onClick={handleDirectShare}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/70 active:scale-98 transition cursor-pointer"
              >
                <Share2 className="w-5 h-5 text-white" />
                <span>مشاركة الكتاب مباشرة (واتساب / تليجرام) 🚀</span>
              </button>

              {/* Download to Device */}
              <button
                type="button"
                onClick={handleDownload}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>حفظ نسخة PDF على جهازي</span>
              </button>
            </div>
          )}

          {shareStatus && (
            <p className="text-center text-xs text-emerald-400 font-medium">
              {shareStatus}
            </p>
          )}
        </div>

        {/* Footer with Clear All */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          {isConfirmingClear ? (
            <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-600/70 p-1.5 rounded-xl">
              <span className="text-[11px] text-rose-200 font-bold px-1">
                تأكيد مسح كافة الصفحات؟
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  onClose();
                }}
                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
              >
                نعم، امسح الكل
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingClear(false)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                تراجع
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingClear(true)}
              className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح الكل وبدء كتاب جديد</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
