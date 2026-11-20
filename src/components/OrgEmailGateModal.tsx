import React, { useState } from 'react';
import {
  Mail,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Lock,
  Clock,
} from 'lucide-react';
import { TAPF_LOGO_URL, OrgVerificationSession } from '../types';
import { verifyOrgEmailWithFirebase } from '../utils/security';

interface OrgEmailGateModalProps {
  isOpen: boolean;
  onVerified: (session: OrgVerificationSession) => void;
  onOpenAdminLogin: () => void;
  theme?: 'dark' | 'light';
}

export const OrgEmailGateModal: React.FC<OrgEmailGateModalProps> = ({
  isOpen,
  onVerified,
  onOpenAdminLogin,
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  const [emailInput, setEmailInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsVerifying(true);

    try {
      const result = await verifyOrgEmailWithFirebase(emailInput);
      setIsVerifying(false);

      if (result.success && result.session) {
        setEmailInput('');
        onVerified(result.session);
      } else {
        setErrorMsg(
          result.error ||
            'This email ID is not authorized to open this application. Please enter a valid organization email ID.'
        );
      }
    } catch {
      setIsVerifying(false);
      setErrorMsg('Unable to verify your email right now. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{
        zIndex: 6500,
        backgroundColor: isLight ? 'rgba(241, 245, 249, 0.96)' : 'rgba(8, 15, 11, 0.96)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        className={`relative w-full max-w-[440px] border rounded-[28px] shadow-2xl overflow-hidden p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#12221a] border-[#284234] text-[#f2ede0]'
        }`}
      >
        {/* Top Brand Header */}
        <div
          className={`flex items-center gap-3.5 pb-5 border-b ${
            isLight ? 'border-slate-200' : 'border-[#22382c]'
          }`}
        >
          <img
            src={TAPF_LOGO_URL}
            alt="Organization Logo"
            className={`h-11 w-auto object-contain rounded-xl bg-white px-2 py-1 shadow-xs shrink-0 ${
              isLight ? 'border border-slate-200' : ''
            }`}
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <h1
              className={`text-xl font-heading font-bold tracking-tight leading-tight ${
                isLight ? 'text-slate-900' : 'text-[#f2ede0]'
              }`}
            >
              MDM Route Finder
            </h1>
            <p
              className={`text-xs font-medium mt-0.5 flex items-center gap-1.5 ${
                isLight ? 'text-emerald-700' : 'text-[#7fb298]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Organization Access Verification</span>
            </p>
          </div>
        </div>

        {/* Required Verification Prompt */}
        <div className="mt-5">
          <p
            className={`text-sm font-medium leading-relaxed ${
              isLight ? 'text-slate-700' : 'text-[#dce5df]'
            }`}
          >
            Please enter your organization email ID to open this application.
          </p>
        </div>

        {/* Error Alert (Zero domain restriction exposed) */}
        {errorMsg && (
          <div
            className={`mt-4 p-3.5 border rounded-2xl text-xs flex items-start gap-2.5 ${
              isLight
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-red-950/75 border-red-800/80 text-red-200'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                isLight ? 'text-red-600' : 'text-red-400'
              }`}
            />
            <div className="space-y-0.5">
              <p className={`font-bold ${isLight ? 'text-red-800' : 'text-red-300'}`}>
                Verification Failed
              </p>
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Email Verification Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="org-email-verify-input"
              className={`block text-xs font-semibold mb-1.5 ${
                isLight ? 'text-slate-700' : 'text-[#9bb0a5]'
              }`}
            >
              Organization Email ID
            </label>
            <div className="relative">
              <div
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
                  isLight ? 'text-slate-400' : 'text-[#6ca388]'
                }`}
              >
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="org-email-verify-input"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Enter your organization email"
                className={`w-full pl-10 pr-4 py-3 border rounded-2xl text-sm outline-hidden transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 focus:border-blue-600 focus:bg-white text-slate-900 placeholder-slate-400'
                    : 'bg-[#0d1913] border-[#263f32] focus:border-[#e5a93c] text-[#f2ede0] placeholder-[#5e7468]'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60 ${
              isLight
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                : 'bg-[#e5a93c] hover:bg-[#eeb64f] text-[#101c15] shadow-[#e5a93c]/15'
            }`}
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Verify &amp; Open Application</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Session Info & Discreet Admin Access Footer */}
        <div
          className={`mt-6 pt-4 border-t flex flex-col items-center gap-3 text-center ${
            isLight ? 'border-slate-200' : 'border-[#22382c]'
          }`}
        >
          <div
            className={`inline-flex items-center justify-center gap-1.5 text-[11px] font-medium ${
              isLight ? 'text-slate-500' : 'text-[#8fa69a]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Verified access remains remembered on this device for 2 days.</span>
          </div>

          <button
            type="button"
            onClick={onOpenAdminLogin}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isLight
                ? 'text-slate-500 hover:text-blue-600'
                : 'text-[#7fb298] hover:text-amber-400'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin Sign In</span>
          </button>
        </div>
      </div>
    </div>
  );
};
