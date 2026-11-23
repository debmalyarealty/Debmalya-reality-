import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import {
  isSupabaseConfigured,
  supabaseConfigDiagnostics,
  testSupabaseConnection,
  type SupabaseConnectionCheckResult,
} from '../lib/supabaseClient';

interface BackendNoticeProps {
  compact?: boolean;
  className?: string;
  showConnectionCheck?: boolean;
}

/**
 * Shown on authenticated / dashboard surfaces only.
 * Never displays a "Connected to Supabase" banner; only appears when
 * configuration is missing or a live connection check returns an error.
 */
export const BackendNotice: React.FC<BackendNoticeProps> = ({
  compact = false,
  className = '',
  showConnectionCheck = false,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [checkResult, setCheckResult] =
    useState<SupabaseConnectionCheckResult | null>(null);

  const shouldCheck = showConnectionCheck && isSupabaseConfigured;

  useEffect(() => {
    if (!shouldCheck) return;
    let active = true;
    testSupabaseConnection()
      .then((res) => {
        if (active) setCheckResult(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shouldCheck]);

  if (dismissed) {
    return null;
  }

  if (isSupabaseConfigured) {
    if (!shouldCheck || !checkResult || checkResult.ok) {
      return null;
    }

    return (
      <div
        role="status"
        className={`rounded-2xl border border-amber-500/40 bg-[var(--bg-surface)]/95 backdrop-blur-md px-4 py-3 shadow-[var(--shadow-subtle)] flex items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-[13px] font-medium text-[var(--text-primary)] leading-snug">
            <span className="font-semibold">Supabase connection error:</span>{' '}
            <span>{checkResult.message}</span>
            {checkResult.hint ? (
              <span className="block text-[var(--text-secondary)] mt-0.5">
                {checkResult.hint}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss connection error"
          className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const issueSummary =
    supabaseConfigDiagnostics.issues.length > 0
      ? supabaseConfigDiagnostics.issues.join(' ')
      : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication and live data.';

  if (compact) {
    return (
      <div
        role="status"
        className={`rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5 text-xs text-[var(--text-primary)] ${className}`}
      >
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Backend not configured:</strong>{' '}
          {issueSummary} Currently showing clearly labelled demo data.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={`rounded-2xl border border-amber-500/40 bg-[var(--bg-surface)]/95 backdrop-blur-md px-4 py-3 shadow-[var(--shadow-subtle)] flex items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-[13px] font-medium text-[var(--text-primary)] leading-snug min-w-0">
          <p>
            <span className="font-semibold">Backend not configured</span> — displaying
            demo listings &amp; sample portfolio data.
          </p>
          <p className="text-[var(--text-secondary)] mt-0.5 break-words">
            {issueSummary}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss backend notice"
        className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
