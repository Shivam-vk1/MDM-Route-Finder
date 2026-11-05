import React, { useState, useEffect } from 'react';
import { NOTICE_DISMISSED_KEY } from '../data/schoolsData';
import { TAPF_LOGO_URL } from '../types';
import { Search, MapPin, CheckCircle, X } from 'lucide-react';

interface NoticeModalProps {
  forceShow?: boolean;
  onClose?: () => void;
  theme?: 'dark' | 'light';
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  forceShow,
  onClose,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      return;
    }
    try {
      const dismissed = localStorage.getItem(NOTICE_DISMISSED_KEY);
      if (!dismissed) {
        setIsOpen(true);
      }
    } catch {
      // LocalStorage error fallback
      setIsOpen(true);
    }
  }, [forceShow]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(NOTICE_DISMISSED_KEY, 'true');
    } catch (e) {
      console.warn('LocalStorage error saving notice dismissal:', e);
    }
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 6500,
        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(10, 18, 14, 0.85)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div 
        className={`relative w-full max-w-lg border rounded-2xl shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#1a2e24] border-[#2c4436] text-[#f2ede0]'
        }`}
      >
        {/* Top header */}
        <div
          className={`flex items-start justify-between pb-4 border-b ${
            isLight ? 'border-slate-200' : 'border-[#2c4436]'
          }`}
        >
          <div className="flex items-center gap-3">
            <img
              src={TAPF_LOGO_URL}
              alt="The Akshaya Patra Foundation"
              className={`h-11 w-auto max-w-[150px] rounded-xl object-contain border bg-white px-2 py-1 shrink-0 shadow-xs ${
                isLight ? 'border-slate-200' : 'border-[#e8a33d]/40'
              }`}
              referrerPolicy="no-referrer"
            />
            <div>
              <span
                className={`text-xs font-mono uppercase tracking-wider font-semibold ${
                  isLight ? 'text-blue-600' : 'text-[#e8a33d]'
                }`}
              >
                Kanpur Kitchen · TAPF
              </span>
              <h2
                className={`text-xl font-heading font-semibold leading-tight ${
                  isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                }`}
              >
                MDM Route Finder
              </h2>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight
                ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-[#21382b]'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Beta disclaimer */}
        <div
          className={`mt-4 p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed ${
            isLight
              ? 'bg-amber-50/70 border-amber-200 text-slate-700'
              : 'bg-[#12211a] border-[#2c4436]/70 text-[#d4decb]'
          }`}
        >
          <p className={`font-semibold mb-1 ${isLight ? 'text-amber-700' : 'text-[#e8a33d]'}`}>
            Notice: Beta Release
          </p>
          This application is currently in active beta testing. Minor coordinate offsets or route sequence updates may occur and are continuously updated in real-time.
        </div>

        {/* 2 Usage Tips */}
        <div className="mt-4 space-y-3">
          <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold">
            Quick Usage Tips
          </h3>

          <div
            className={`flex items-start gap-3 p-3 rounded-xl border ${
              isLight
                ? 'bg-slate-50 border-slate-200'
                : 'bg-[#21382b]/60 border-[#2c4436]/60'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-[#7fb298]/20 text-[#7fb298]'
              }`}
            >
              <Search className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm">
              <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                1. Live Search & Route Filter
              </p>
              <p className={`mt-0.5 ${isLight ? 'text-slate-600' : 'text-[#a4b3ab]'}`}>
                Type any school name, UDISE, node code, address, or SPOC name. Tap route chips to isolate delivery routes and visualize their sequential path on the map.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 p-3 rounded-xl border ${
              isLight
                ? 'bg-slate-50 border-slate-200'
                : 'bg-[#21382b]/60 border-[#2c4436]/60'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                isLight ? 'bg-blue-100 text-blue-700' : 'bg-[#7c9ee0]/20 text-[#7c9ee0]'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm">
              <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                2. School Profile & 1-Tap Calling
              </p>
              <p className={`mt-0.5 ${isLight ? 'text-slate-600' : 'text-[#a4b3ab]'}`}>
                Tap any school card or map marker to view comprehensive details: one-touch Google Maps navigation, direct phone calls to the School SPOC and Vehicle Driver.
              </p>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleDismiss}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 font-semibold text-sm rounded-xl transition-all shadow-lg active:scale-98 ${
              isLight
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                : 'bg-[#e8a33d] hover:bg-[#d6932e] text-[#12211a] shadow-[#e8a33d]/20'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Got it, Let's Start
          </button>
        </div>
      </div>
    </div>
  );
};
