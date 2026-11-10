import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  X, 
  LogOut, 
  RefreshCw,
  Lock,
  Mail,
  Key,
  LogIn,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  signInWithGoogleAdmin, 
  signOutAdmin, 
  isAuthorizedAdminUser,
  AUTHORIZED_ADMIN_EMAIL, 
  User 
} from '../firebase';
import { StaffMember, TAPF_LOGO_URL } from '../types';
import { verifyStaffLogin } from '../utils/security';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (staffMember?: StaffMember) => void;
  actionTitle?: string;
  currentUser: User | null;
  theme?: 'dark' | 'light';
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const [staffLoginId, setStaffLoginId] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isSigningInStaff, setIsSigningInStaff] = useState(false);

  // If the modal opens while the user is already authenticated as the authorized Super Admin, proceed immediately
  useEffect(() => {
    if (isOpen && isAuthorizedAdminUser(currentUser)) {
      onSuccess();
    }
  }, [isOpen, currentUser, onSuccess]);

  if (!isOpen) return null;

  const isWrongGoogleAccount =
    currentUser &&
    currentUser.email &&
    currentUser.email.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase();

  const handleGoogleLogin = async () => {
    setIsSigningInGoogle(true);
    setErrorMsg(null);

    const res = await signInWithGoogleAdmin();
    setIsSigningInGoogle(false);

    if (res.success && res.isAuthorized) {
      onSuccess();
    } else {
      setErrorMsg(
        res.error || 'Unauthorized Google account. Only the Main Super Admin is permitted via Google Sign-In.'
      );
    }
  };

  const handleSwitchAccount = async () => {
    setErrorMsg(null);
    await signOutAdmin();
    await handleGoogleLogin();
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSigningInStaff(true);

    try {
      const result = await verifyStaffLogin(staffLoginId, staffPassword);
      setIsSigningInStaff(false);

      if (result.success && result.staff) {
        setStaffLoginId('');
        setStaffPassword('');
        onSuccess(result.staff);
      } else {
        setErrorMsg(result.error || 'Invalid Office Staff credentials.');
      }
    } catch (err: any) {
      setIsSigningInStaff(false);
      setErrorMsg(err?.message || 'Unable to verify staff login. Please try again.');
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{
        zIndex: 7000,
        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(6, 12, 9, 0.88)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div 
        className={`relative w-full max-w-[420px] border rounded-[28px] shadow-2xl overflow-hidden p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#12221a] border-[#284234] text-[#f2ede0]'
        }`}
      >
        {/* Top Header */}
        <div
          className={`flex items-center justify-between pb-5 border-b ${
            isLight ? 'border-slate-200' : 'border-[#22382c]'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-[#272617] border-[#614e24] text-[#e5a93c]'
              }`}
            >
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className={`text-xl font-heading font-bold tracking-tight leading-tight ${
                    isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                  }`}
                >
                  Admin Sign In
                </h2>
                <img
                  src={TAPF_LOGO_URL}
                  alt="The Akshaya Patra Foundation"
                  className={`h-6 w-auto object-contain rounded-md bg-white px-1.5 py-0.5 shadow-xs ${
                    isLight ? 'border border-slate-200' : ''
                  }`}
                  referrerPolicy="no-referrer"
                />
              </div>
              <p
                className={`text-xs font-medium mt-0.5 ${
                  isLight ? 'text-emerald-700' : 'text-[#6ca388]'
                }`}
              >
                Restricted Access Portal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors border ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border-slate-200'
                : 'bg-[#0d1812] hover:bg-[#1a2e23] text-slate-400 hover:text-white border-[#1f3328]'
            }`}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error / Unauthorized Notice */}
        {(isWrongGoogleAccount || errorMsg) && (
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
            <div className="space-y-1">
              <p className={`font-bold ${isLight ? 'text-red-800' : 'text-red-300'}`}>
                Authentication Alert
              </p>
              <p className="leading-relaxed">
                {errorMsg ||
                  'This Google account does not have Super Admin permissions. Please switch accounts or use your TAPF Office Staff credentials below.'}
              </p>
            </div>
          </div>
        )}

        {/* Super Admin Google Sign-In Button (Zero credentials exposed on UI) */}
        <div className="mt-5">
          {isWrongGoogleAccount ? (
            <button
              type="button"
              onClick={handleSwitchAccount}
              disabled={isSigningInGoogle}
              className={`w-full py-3.5 px-4 rounded-2xl border font-semibold text-sm flex items-center justify-center gap-3 transition-all active:scale-98 disabled:opacity-50 ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-[#1a3125] hover:bg-[#223f30] border-[#2e4d3d] text-[#f2ede0]'
              }`}
            >
              {isSigningInGoogle ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              ) : (
                <LogOut className="w-4 h-4 text-amber-500" />
              )}
              <span>Switch Google Account (Super Admin)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSigningInGoogle}
              className={`w-full py-3.5 px-4 rounded-2xl border font-semibold text-sm flex items-center justify-center gap-3 transition-all active:scale-98 disabled:opacity-50 shadow-sm ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-[#1a3125] hover:bg-[#223f30] border-[#2e4d3d] text-[#f2ede0]'
              }`}
            >
              {isSigningInGoogle ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#e5a93c]" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>
                {isSigningInGoogle ? 'Verifying Super Admin...' : 'Sign in with Google (Super Admin)'}
              </span>
            </button>
          )}
        </div>

        {/* Divider: OR OFFICE STAFF LOGIN */}
        <div className="my-5 flex items-center gap-3">
          <div className={`h-px flex-1 ${isLight ? 'bg-slate-200' : 'bg-[#22382c]'}`} />
          <span
            className={`text-[11px] font-mono uppercase tracking-widest ${
              isLight ? 'text-slate-400' : 'text-[#688576]'
            }`}
          >
            OR OFFICE STAFF LOGIN
          </span>
          <div className={`h-px flex-1 ${isLight ? 'bg-slate-200' : 'bg-[#22382c]'}`} />
        </div>

        {/* Office Staff / TAPF Member Form */}
        <form onSubmit={handleStaffSubmit} className="space-y-4">
          <div>
            <label
              className={`block text-xs font-semibold mb-1.5 ${
                isLight ? 'text-slate-700' : 'text-[#9bb0a5]'
              }`}
            >
              Office Staff Email / Login ID
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
                type="text"
                required
                autoComplete="username"
                value={staffLoginId}
                onChange={(e) => {
                  setStaffLoginId(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="staff@tapf.org"
                className={`w-full pl-10 pr-4 py-3 border rounded-2xl text-sm outline-hidden transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 focus:border-blue-600 focus:bg-white text-slate-900 placeholder-slate-400'
                    : 'bg-[#0d1913] border-[#263f32] focus:border-[#e5a93c] text-[#f2ede0] placeholder-[#5e7468]'
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-xs font-semibold mb-1.5 ${
                isLight ? 'text-slate-700' : 'text-[#9bb0a5]'
              }`}
            >
              Password
            </label>
            <div className="relative">
              <div
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
                  isLight ? 'text-slate-400' : 'text-[#6ca388]'
                }`}
              >
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder="Enter password"
                className={`w-full pl-10 pr-10 py-3 border rounded-2xl text-sm outline-hidden transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 focus:border-blue-600 focus:bg-white text-slate-900 placeholder-slate-400'
                    : 'bg-[#0d1913] border-[#263f32] focus:border-[#e5a93c] text-[#f2ede0] placeholder-[#5e7468]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={`absolute inset-y-0 right-0 pr-3.5 flex items-center ${
                  isLight
                    ? 'text-slate-400 hover:text-slate-700'
                    : 'text-[#5e7468] hover:text-[#f2ede0]'
                }`}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSigningInStaff}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#e5a93c] hover:bg-[#eeb64f] text-[#101c15] font-bold text-sm shadow-lg shadow-[#e5a93c]/15 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 mt-2"
          >
            {isSigningInStaff ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>{isSigningInStaff ? 'Signing In...' : 'Staff Sign In'}</span>
          </button>
        </form>

        {/* Security Footer */}
        <div
          className={`mt-6 pt-4 border-t text-center ${
            isLight ? 'border-slate-200' : 'border-[#22382c]'
          }`}
        >
          <div
            className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium ${
              isLight ? 'text-slate-600' : 'text-[#8fa69a]'
            }`}
          >
            <ShieldCheck
              className={`w-4 h-4 shrink-0 ${
                isLight ? 'text-emerald-600' : 'text-[#2dd48f]'
              }`}
            />
            <span>Public registration is disabled for security.</span>
          </div>
          <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-400' : 'text-[#5e7468]'}`}>
            Office sub-admins must be added by the Main Admin.
          </p>
        </div>
      </div>
    </div>
  );
};
