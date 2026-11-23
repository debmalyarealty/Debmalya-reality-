import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useApp, type AuthModalMode } from '../context/AppContext';
import {
  sendPasswordResetEmail,
  signInWithEmail,
  signUpWithEmail,
  updateOwnPassword,
} from '../lib/supabaseData';
import { LUX_EASE } from '../lib/motion';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    refreshUser,
    showToast,
    exitOwnerWebsiteView,
  } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthModalMode>(authModalMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Siliguri');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const prefersReduced = !!useReducedMotion();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(authModalMode);
    setShowPassword(false);
    setError(null);
    setStatusMsg(null);
  }, [authModalMode, authModalOpen]);

  const switchMode = (nextMode: AuthModalMode) => {
    setMode(nextMode);
    setShowPassword(false);
    setError(null);
    setStatusMsg(null);
  };

  useEffect(() => {
    if (!authModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authModalOpen, closeAuthModal]);

  const handleDismiss = () => {
    closeAuthModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMsg(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const profile = await signInWithEmail(email, password);
        await refreshUser();
        showToast(`Welcome back, ${profile.full_name || 'friend'}`, 'info');
        handleDismiss();
        if (profile.role === 'owner') {
          exitOwnerWebsiteView();
          navigate('/owner-dashboard', { replace: true });
        } else {
          navigate('/my-account', { replace: true });
        }
      } else if (mode === 'register') {
        const res = await signUpWithEmail({
          email,
          password,
          full_name: fullName,
          phone,
          city,
        });
        if (res.needsEmailConfirmation) {
          setStatusMsg(
            'Check your email to confirm your account before signing in.'
          );
          setPassword('');
        } else {
          const profile = await refreshUser();
          showToast('Account created successfully', 'info');
          handleDismiss();
          if (profile?.role === 'owner') {
            exitOwnerWebsiteView();
            navigate('/owner-dashboard', { replace: true });
          } else {
            navigate('/my-account', { replace: true });
          }
        }
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(email);
        setStatusMsg(
          'Password reset link sent. Please check your inbox and follow the link to choose a new password.'
        );
      } else if (mode === 'recovery') {
        await updateOwnPassword(newPassword);
        const profile = await refreshUser();
        setNewPassword('');
        showToast('Password updated', 'info');
        handleDismiss();
        if (profile?.role === 'owner') {
          exitOwnerWebsiteView();
          navigate('/owner-dashboard', { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
      setErrorShakeKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {authModalOpen && (
        <motion.div
          key="auth-modal-backdrop"
          onClick={handleDismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: LUX_EASE }}
          className="fixed inset-0 z-50 flex items-center justify-center p-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] bg-black/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Account authentication"
        >
          <motion.div
            key="auth-modal-card"
            onClick={(e) => e.stopPropagation()}
            initial={
              prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }
            }
            animate={
              prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }
            }
            transition={{ duration: 0.24, ease: LUX_EASE }}
            className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)] p-[clamp(1.25rem,4vw,2rem)] shadow-[var(--shadow-elevated)]"
          >
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Close sign in dialog"
              className="absolute top-4 right-4 z-10 h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {(mode === 'forgot' || mode === 'register') && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="group mb-3 min-h-[44px] inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                <span>Back to Sign In</span>
              </button>
            )}

            <h2 className="font-display text-[clamp(1.65rem,4vw,2rem)] font-medium text-[var(--text-primary)] pr-12">
              {mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : mode === 'recovery'
                ? 'Set New Password'
                : 'Reset Password'}
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] mt-1">
              {mode === 'login'
                ? 'Save Siliguri properties, track site visit requests, and access your dashboard.'
                : mode === 'register'
                ? 'Create a free account to shortlist properties and schedule site visits.'
                : mode === 'recovery'
                ? 'Enter a new password for your Debmalya Realty account.'
                : 'Enter your email address and we will send a password reset link.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label
                      htmlFor="auth-fullname"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                    >
                      Full Name *
                    </label>
                    <input
                      id="auth-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="auth-phone"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                      >
                        Phone / WhatsApp
                      </label>
                      <input
                        id="auth-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91..."
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="auth-city"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                      >
                        City
                      </label>
                      <input
                        id="auth-city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  </div>
                </>
              )}

              {mode !== 'recovery' && (
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Email Address *
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              )}

              {(mode === 'login' || mode === 'register') && (
                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[44px] pl-3.5 pr-12 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className={`absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-xl transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer ${
                        showPassword
                          ? 'text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'recovery' && (
                <div>
                  <label
                    htmlFor="auth-new-pass"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    New Password * (minimum 6 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="auth-new-pass"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full min-h-[44px] pl-3.5 pr-12 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className={`absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-xl transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer ${
                        showPassword
                          ? 'text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p
                  key={`auth-err-${errorShakeKey}`}
                  className="animate-shake-once text-sm text-rose-500"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {statusMsg && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 flex items-start gap-2 text-[13px] text-emerald-500"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{statusMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary-lux w-full min-h-[46px] py-2.5 px-6 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {submitting
                    ? 'Please wait...'
                    : mode === 'login'
                    ? 'Sign In'
                    : mode === 'register'
                    ? 'Create Account'
                    : mode === 'recovery'
                    ? 'Update Password'
                    : 'Send Reset Link'}
                </span>
              </button>
            </form>

            {mode !== 'recovery' && (
              <div className="mt-6 pt-4 border-t border-[var(--border-hairline)] flex flex-col items-start gap-2">
                {mode === 'login' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="w-full min-h-[44px] py-1.5 text-left text-sm font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="w-full min-h-[44px] py-1.5 text-left text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full min-h-[44px] py-1.5 text-left text-sm font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                  >
                    Already have an account? Sign in
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full min-h-[44px] py-1.5 text-left text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Continue as guest
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
