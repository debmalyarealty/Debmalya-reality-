import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  MailCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useApp, type AuthModalMode } from '../context/AppContext';
import {
  resendSignupVerificationEmail,
  sendPasswordResetEmail,
  signInWithEmail,
  signUpWithEmail,
  updateOwnPassword,
} from '../lib/supabaseData';
import { mapSignInAuthError } from '../lib/authCallback';
import { isValidEmail, isValidPhone } from '../lib/realtyLogic';
import { useKeyboardSafeForm } from '../lib/formKeyboard';
import { toUserFriendlyNetworkError } from '../lib/networkUtils';
import { LUX_EASE } from '../lib/motion';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalMode,
    authModalNotice,
    authModalInitialEmail,
    closeAuthModal,
    consumeAuthSuccessOverride,
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
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const { keyboardOpen } = useKeyboardSafeForm(formRef);
  const prefersReduced = !!useReducedMotion();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [shakePassword, setShakePassword] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(authModalMode);
    if (authModalInitialEmail) {
      setEmail(authModalInitialEmail);
    }
    setShowPassword(false);
    setShakePassword(false);
    setError(null);
    setStatusMsg(null);
  }, [authModalMode, authModalOpen, authModalInitialEmail]);

  const switchMode = (nextMode: AuthModalMode) => {
    setMode(nextMode);
    setShowPassword(false);
    setShakePassword(false);
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

  const handleResendVerification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (resending) return;
    setError(null);
    setStatusMsg(null);
    if (!email.trim()) {
      setError('Please enter your email address.');
      setErrorShakeKey((k) => k + 1);
      return;
    }
    setResending(true);
    try {
      await resendSignupVerificationEmail(email);
      const sentMsg =
        'Verification email sent. Please check your inbox and spam folder.';
      setStatusMsg(sentMsg);
      showToast(sentMsg, 'info');
    } catch (err) {
      const normalized = toUserFriendlyNetworkError(
        err,
        'Unable to resend verification email right now.'
      ).message;
      setError(normalized);
      showToast(normalized, 'error');
      setErrorShakeKey((k) => k + 1);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setShakePassword(false);
    setStatusMsg(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        if (!isValidEmail(email)) {
          throw new Error('Please enter a valid email address.');
        }
        if (!password) {
          throw new Error('Please enter your password.');
        }
        const profile = await signInWithEmail(email, password);
        await refreshUser();
        const override = consumeAuthSuccessOverride();
        showToast(`Welcome back, ${profile.full_name || 'friend'}`, 'info');
        handleDismiss();
        if (override.onSuccess) {
          await override.onSuccess(profile);
        }
        if (!override.suppressRedirect) {
          if (profile.role === 'owner') {
            exitOwnerWebsiteView();
            navigate('/owner-dashboard', { replace: true });
          } else {
            navigate('/my-account', { replace: true });
          }
        }
      } else if (mode === 'register') {
        if (fullName.trim().length < 2) {
          throw new Error('Please enter your full name (at least 2 characters).');
        }
        if (!isValidPhone(phone)) {
          throw new Error('Please enter a valid 10-digit phone number.');
        }
        if (!isValidEmail(email)) {
          throw new Error('Please enter a valid email address.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const res = await signUpWithEmail({
          email,
          password,
          full_name: fullName,
          phone,
          city: 'Siliguri',
        });
        if (res.needsEmailConfirmation) {
          setPassword('');
          setStatusMsg(null);
          setError(null);
          setMode('verify-sent');
          showToast('Check your email to verify your account', 'info');
        } else {
          const profile = (await refreshUser()) ?? res.profile;
          const override = consumeAuthSuccessOverride();
          showToast('Account created successfully', 'info');
          handleDismiss();
          if (override.onSuccess && profile) {
            await override.onSuccess(profile);
          }
          if (!override.suppressRedirect) {
            if (profile?.role === 'owner') {
              exitOwnerWebsiteView();
              navigate('/owner-dashboard', { replace: true });
            } else {
              navigate('/my-account', { replace: true });
            }
          }
        }
      } else if (mode === 'forgot') {
        if (!isValidEmail(email)) {
          throw new Error('Please enter a valid email address.');
        }
        await sendPasswordResetEmail(email);
        setStatusMsg(
          'Password reset link sent. Please check your inbox and follow the link to choose a new password.'
        );
        showToast('Password reset link sent to your email', 'info');
      } else if (mode === 'recovery') {
        if (newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
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
      let friendlyMsg = 'Authentication failed.';
      if (mode === 'login') {
        const rawMsg = err instanceof Error ? err.message : '';
        friendlyMsg = mapSignInAuthError(rawMsg);
        setShakePassword(true);
      } else {
        friendlyMsg = err instanceof Error ? err.message : 'Authentication failed.';
      }
      setError(friendlyMsg);
      setErrorShakeKey((k) => k + 1);
      showToast(friendlyMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isMainSwitchMode = mode === 'register' || mode === 'login';

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
          className="fixed inset-0 z-50 flex items-center justify-center pt-[max(0.75rem,env(safe-area-inset-top,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] bg-black/60 backdrop-blur-xs overflow-y-auto"
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
            className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)] p-[clamp(1.125rem,4vw,2rem)] shadow-[var(--shadow-elevated)]"
          >
            {/* Top-right close button */}
            <div className="flex items-center justify-between gap-2 mb-3">
              {mode === 'forgot' ? (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="group min-h-[44px] inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                  <span>Back to Sign in</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close dialog"
                className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Top two-option plain switch */}
            {isMainSwitchMode && (
              <div
                role="tablist"
                aria-label="Account action"
                className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => switchMode('login')}
                  className={`min-h-[44px] px-2.5 py-2 rounded-lg text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-normal'
                  }`}
                >
                  <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Sign in</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => switchMode('register')}
                  className={`min-h-[44px] px-2.5 py-2 rounded-lg text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-normal'
                  }`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Create account</span>
                </button>
              </div>
            )}

            {/* Check your email confirmation screen */}
            {mode === 'verify-sent' ? (
              <div data-testid="auth-check-email-screen" className="space-y-5 py-2">
                <div className="h-12 w-12 rounded-2xl bg-[var(--bg-surface-muted)] border border-[var(--border-hairline)] text-[var(--accent-primary)] inline-flex items-center justify-center">
                  <MailCheck className="w-6 h-6" aria-hidden="true" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-display text-[clamp(1.6rem,4vw,1.9rem)] font-medium text-[var(--text-primary)]">
                    Check your email
                  </h2>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed break-anywhere">
                    We sent a verification link to{' '}
                    <span className="font-medium text-[var(--text-primary)]">
                      {email}
                    </span>
                    . Click the link in your email to verify your account and sign in.
                  </p>
                </div>

                {error && (
                  <p
                    key={`verify-err-${errorShakeKey}`}
                    role="alert"
                    className="animate-shake-once text-sm text-rose-500"
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

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={resending}
                    onClick={() => void handleResendVerification()}
                    className="btn-primary-lux w-full min-h-[48px] py-2.5 px-6 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {resending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{resending ? 'Sending...' : 'Resend email'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full min-h-[44px] py-2 text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                  >
                    Back to Sign in
                  </button>
                </div>
              </div>
            ) : mode === 'expired-link' ? (
              <form
                ref={formRef}
                onSubmit={handleResendVerification}
                className="space-y-4 py-1"
              >
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 inline-flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" aria-hidden="true" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="font-display text-[clamp(1.6rem,4vw,1.9rem)] font-medium text-[var(--text-primary)]">
                    Verification link expired
                  </h2>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                    {authModalNotice ||
                      'This verification link has expired or is no longer valid. Enter your email to receive a new link.'}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="auth-expired-email"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Email Address *
                  </label>
                  <input
                    id="auth-expired-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                {error && (
                  <p
                    key={`expired-err-${errorShakeKey}`}
                    role="alert"
                    className="animate-shake-once text-sm text-rose-500"
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
                  disabled={resending}
                  className="btn-primary-lux w-full min-h-[48px] py-2.5 px-6 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {resending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{resending ? 'Sending...' : 'Resend email'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full min-h-[44px] py-2 text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                >
                  Back to Sign in
                </button>

                <div aria-hidden="true" className={keyboardOpen ? 'h-[26dvh]' : 'hidden'} />
              </form>
            ) : (
              <>
                <h2 className="font-display text-[clamp(1.65rem,4vw,2rem)] font-medium text-[var(--text-primary)]">
                  {mode === 'login'
                    ? 'Sign in'
                    : mode === 'register'
                    ? 'Create account'
                    : mode === 'recovery'
                    ? 'Set new password'
                    : 'Reset password'}
                </h2>
                {authModalNotice && isMainSwitchMode ? (
                  <p className="mt-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3.5 py-2 text-[13px] font-medium text-[var(--accent-primary)]">
                    {authModalNotice}
                  </p>
                ) : (
                  <p className="text-sm sm:text-base text-[var(--text-secondary)] mt-1">
                    {mode === 'login'
                      ? 'Save Siliguri properties, track site visit requests, and access your dashboard.'
                      : mode === 'register'
                      ? 'Create a free account to shortlist properties and schedule site visits.'
                      : mode === 'recovery'
                      ? 'Enter a new password for your Debmalya Realty account.'
                      : authModalNotice ||
                        'Enter your email address and we will send a password reset link.'}
                  </p>
                )}

                <form ref={formRef} noValidate onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                          autoComplete="name"
                          placeholder="Your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="auth-phone"
                          className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                        >
                          Phone *
                        </label>
                        <input
                          id="auth-phone"
                          type="tel"
                          required
                          inputMode="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>
                    </>
                  )}

                  {mode !== 'recovery' && (
                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                      >
                        Email *
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)]"
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
                          autoComplete={
                            mode === 'login' ? 'current-password' : 'new-password'
                          }
                          aria-invalid={Boolean(error && mode === 'login')}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (shakePassword) setShakePassword(false);
                          }}
                          onAnimationEnd={() => setShakePassword(false)}
                          className={`w-full min-h-[48px] pl-3.5 pr-12 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none ${
                            shakePassword ? 'animate-shake-once ' : ''
                          }${
                            error && mode === 'login'
                              ? 'border-rose-500 focus:border-rose-500'
                              : 'border-[var(--border-input)] focus:border-[var(--accent-primary)]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                          title={showPassword ? 'Hide password' : 'Show password'}
                          className={`absolute right-0.5 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-xl transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer ${
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
                          className="w-full min-h-[48px] pl-3.5 pr-12 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                          title={showPassword ? 'Hide password' : 'Show password'}
                          className={`absolute right-0.5 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-xl transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer ${
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
                    className="btn-primary-lux w-full min-h-[48px] py-2.5 px-6 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>
                      {submitting
                        ? 'Please wait...'
                        : mode === 'login'
                        ? 'Sign in'
                        : mode === 'register'
                        ? 'Create account'
                        : mode === 'recovery'
                        ? 'Update password'
                        : 'Send reset link'}
                    </span>
                  </button>

                  {error && (
                    <p
                      key={`auth-err-${errorShakeKey}`}
                      className="animate-shake-once text-sm text-rose-500"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}

                  <div aria-hidden="true" className={keyboardOpen ? 'h-[26dvh]' : 'hidden'} />
                </form>

                {mode === 'login' && (
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="min-h-[44px] px-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
