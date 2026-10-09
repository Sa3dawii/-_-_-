import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (isInstalled || justInstalled) {
    return null;
  }

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setJustInstalled(true);
    }
  };

  if (isInstallable) {
    return (
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 rounded-xl backdrop-blur transition active:scale-95"
        title="تثبيت التطبيق على الشاشة الرئيسية"
      >
        <Download className="w-3.5 h-3.5" />
        <span>تثبيت PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 rounded-xl backdrop-blur transition active:scale-95"
          title="تثبيت التطبيق على الآيفون"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>تثبيت في الآيفون</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  تثبيت على iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-xs">
                    1
                  </div>
                  <p>
                    اضغط على زر <strong className="text-white">المشاركة (Share)</strong> في شريط متصفح سفاري بالأسفل.
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-xs">
                    2
                  </div>
                  <p>
                    مرر لأسفل واختر <strong className="text-white">إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-xs">
                    3
                  </div>
                  <p>
                    افتح التطبيق من شاشتك وسيعمل بشاشة كاملة وبأعلى سرعة وكاميرا فورية!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                فهمت ذلك
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
