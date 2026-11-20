import React, { useState } from 'react';
import {
  Shield,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Activity,
  Video,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import {
  FIREBASE_AUTH_CONSOLE_URL,
  loginWithEmailPassword,
  mapFirebaseAuthError,
  registerWithEmailPassword,
  resetOperatorPassword,
  signInWithGoogle,
} from '../lib/firebase';
import type { UserAccountRecord } from '../types/crowguard';

type AuthMode = 'login' | 'register' | 'forgot';

interface AuthPortalProps {
  onAuthenticated: (profile: UserAccountRecord) => void;
  externalNotice?: string | null;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({
  onAuthenticated,
  externalNotice,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setSuccessMessage(null);
  };

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid operator email address.');
      return;
    }

    if (mode === 'forgot') {
      setBusy(true);
      try {
        await resetOperatorPassword(email);
        setSuccessMessage(
          `Password reset link sent to ${email.trim()}. Check your inbox (and spam folder) to complete the reset.`
        );
      } catch (err) {
        setError(mapFirebaseAuthError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      if (displayName.trim().length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      const profile =
        mode === 'login'
          ? await loginWithEmailPassword(email, password)
          : await registerWithEmailPassword({
              displayName: displayName.trim(),
              email,
              password,
            });
      onAuthenticated(profile);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMessage(null);
    setBusy(true);
    try {
      const profile = await signInWithGoogle();
      onAuthenticated(profile);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col lg:flex-row">
      {/* Left Operational Architecture Brief */}
      <div className="lg:w-[46%] xl:w-[50%] bg-[#0A101D] border-b lg:border-b-0 lg:border-r border-slate-800/80 p-8 sm:p-12 lg:p-16 flex flex-col justify-between gap-10">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-xl tracking-tight text-white">
                CROWGUARD
              </span>
              <p className="text-xs text-slate-400">
                Crowd Crush Early Warning &amp; Prevention Command
              </p>
            </div>
          </div>

          <div className="space-y-4 max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight text-balance">
              Intelligent Venue Safety &amp; Role-Controlled Operations
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Authenticate to access real-time OpenCV crowd density heatmaps, Optical Flow anomaly tracking, evacuation routing, and human-approved gate management.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-2">
              <Video className="w-4 h-4 text-blue-400" />
              <p className="text-xs font-semibold text-white">Multi-Camera OpenCV</p>
              <p className="text-xs text-slate-400">
                Frame-by-frame pedestrian detection, density grids &amp; bottleneck alerts.
              </p>
            </div>
            <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-2">
              <Activity className="w-4 h-4 text-red-400" />
              <p className="text-xs font-semibold text-white">Optical Flow Risk</p>
              <p className="text-xs text-slate-400">
                Detects shockwave stalls, counterflow surges &amp; 0–100 risk scores.
              </p>
            </div>
            <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-semibold text-white">Verified RBAC</p>
              <p className="text-xs text-slate-400">
                Strict separation between Admin user governance and Security Operators.
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-6 flex flex-wrap items-center justify-between gap-2">
          <span>Firebase Authentication · Server-Verified ID Tokens · Firestore Security Rules</span>
          <span>Human-in-the-Loop Gate Safety</span>
        </div>
      </div>

      {/* Right Login / Registration / Reset Card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-[#0D1424] border border-slate-800/90 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Segmented Auth Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#070B14] border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'forgot' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Reset
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-white">
              {mode === 'login'
                ? 'Operator & Admin Sign In'
                : mode === 'register'
                ? 'Create Security Operator Account'
                : 'Reset Account Password'}
            </h2>
            <p className="text-xs text-slate-400">
              {mode === 'login'
                ? 'Sign in to access your role-authorized CROWGUARD workspace.'
                : mode === 'register'
                ? 'New accounts register as Security Operator. Administrators can assign elevated roles.'
                : 'Enter your registered email address to receive a Firebase password reset link.'}
            </p>
          </div>

          {externalNotice && (
            <div className="bg-red-950/50 border border-red-500/40 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{externalNotice}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-950/50 border border-red-500/40 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p>{error}</p>
                {error.includes('Firebase Console') && (
                  <div className="pt-1 border-t border-red-500/20 space-y-1 text-[11px] text-red-100/90">
                    <p>
                      Or click <span className="font-semibold text-white">Continue with Google</span> below right now (already enabled).
                    </p>
                    <a
                      href={FIREBASE_AUTH_CONSOLE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 underline"
                    >
                      Open Firebase Sign-in Providers
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@venue-command.org"
                  className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label htmlFor="auth-confirm" className="block text-xs font-medium text-slate-300">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              <span>
                {busy
                  ? 'Authenticating...'
                  : mode === 'login'
                  ? 'Sign In to Dashboard'
                  : mode === 'register'
                  ? 'Register Security Operator'
                  : 'Send Password Reset Email'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-800" />
                <span className="shrink mx-3 text-xs text-slate-500">or continue with</span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg bg-[#070B14] hover:bg-slate-800/80 border border-slate-700/80 text-slate-100 text-sm font-medium transition-colors disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
