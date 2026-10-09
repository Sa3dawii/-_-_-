import React, { useState } from 'react';
import { Camera, BookOpen, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onPermissionGranted: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onPermissionGranted,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setPermissionError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('متصفحك الحالي لا يدعم الوصول للكاميرا، يرجى استخدام متصفح حديث مثل Chrome أو Safari.');
      }

      // Request media stream directly inside user gesture
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      // Stop test stream immediately so CameraViewport can acquire it cleanly
      stream.getTracks().forEach((track) => track.stop());

      // Save permission consent flag
      localStorage.setItem('al_imtiaz_camera_permission_granted', 'true');
      setIsRequesting(false);
      onPermissionGranted();
    } catch (err: unknown) {
      console.warn('Camera permission request error:', err);
      setIsRequesting(false);
      const isDenied = (err as Error)?.name === 'NotAllowedError' || (err as Error)?.name === 'PermissionDeniedError';
      if (isDenied) {
        setPermissionError('تم رفض إذن الكاميرا. يرجى الضغط على علامة القفل 🔒 في أعلى المتصفح وتفعيل إذن الكاميرا، ثم الضغط على "إعادة المحاولة".');
      } else {
        setPermissionError('تعذر فتح الكاميرا. تأكد من إغلاق أي تطبيق آخر يستخدم الكاميرا أو استخدام متصفح حديث.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl text-slate-100 flex flex-col gap-5 relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
        <div className="absolute -top-24 right-1/2 translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header with Azhar Library Badge */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-emerald-400 tracking-wider uppercase block">
              مكتبة الامتياز الأزهرية
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              مرحباً بك في مصور الكتب الجامعية
            </h2>
          </div>
        </div>

        {/* Primary Description as requested */}
        <div className="space-y-3 text-sm sm:text-base text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800">
          <p className="font-medium text-slate-200">
            صُمم هذا النظام لمساعدة طلاب مكتبة الامتياز الأزهرية علي تصوير كتبهم الجامعية الورقية في دقائق
            وإرسالها مباشرة لمكتبة الامتياز لتلخيصها.
          </p>
          <div className="flex items-start gap-2.5 pt-1 text-emerald-300 font-medium">
            <Camera className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <p className="text-xs sm:text-sm">
              نحتاج إذن الكاميرا لمسح وتصوير صفحات الكتاب بدقة عالية وتجهيز الـ PDF داخل جهازك بأمان.
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>خصوصية تامة ومعالجة داخل جهازك</span>
        </div>

        {/* Permission Error State */}
        {permissionError && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-200 text-xs sm:text-sm flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">تنبيه الصلاحية:</span>
              <p>{permissionError}</p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleRequestPermission}
          disabled={isRequesting}
          className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 cursor-pointer"
        >
          {isRequesting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>جاري طلب الإذن من المتصفح...</span>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" />
              <span>السماح بالكاميرا وبدء التصوير</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-slate-500">
          يمكنك البدء فوراً بمجرد الضغط والموافقة في نافذة المتصفح المنبثقة
        </p>
      </div>
    </div>
  );
};
