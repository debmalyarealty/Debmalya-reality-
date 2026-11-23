import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { signInWithEmail } from '../lib/supabaseData';
import { applyDocumentMeta, buildSiteMetaTags } from '../lib/metaTags';
import { BackButton } from '../components/BackButton';

export const OwnerAuthPage: React.FC = () => {
  const { user, authLoading, refreshUser, exitOwnerWebsiteView } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    applyDocumentMeta(
      buildSiteMetaTags({
        title: 'Account Sign In — Debmalya Realty',
        pathname: '/owner-login',
        robots: 'noindex, nofollow',
      })
    );
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === 'owner') {
      exitOwnerWebsiteView();
      navigate('/owner-dashboard', { replace: true });
    } else if (user?.role === 'client') {
      navigate('/my-account', { replace: true });
    }
  }, [user, authLoading, navigate, exitOwnerWebsiteView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const profile = await signInWithEmail(email, password);
      await refreshUser();
      if (profile.role === 'owner') {
        exitOwnerWebsiteView();
        navigate('/owner-dashboard', { replace: true });
      } else {
        navigate('/my-account', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pt-[calc(env(safe-area-inset-top,0px)+6rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] fluid-container min-h-[80vh]">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-[clamp(1.25rem,4vw,2rem)] shadow-[var(--shadow-subtle)] space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-hairline)] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                Account Access
              </p>
              <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                Sign In
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="owner-email"
                className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Email Address *
              </label>
              <input
                id="owner-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="owner-password"
                className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Password *
              </label>
              <input
                id="owner-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
              />
            </div>

            {error && (
              <p className="text-[13px] text-rose-500" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{submitting ? 'Verifying...' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};
