import { useEffect, useState } from 'react';

export const OFFLINE_ERROR_MESSAGE = 'No internet connection, please try again';

export class TransientSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientSessionError';
  }
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function assertOnline(): void {
  if (isBrowserOffline()) {
    throw new Error(OFFLINE_ERROR_MESSAGE);
  }
}

export function isNetworkFailureError(err: unknown): boolean {
  if (isBrowserOffline()) return true;
  if (!err) return false;
  const errObj = err as { name?: unknown; message?: unknown };
  if (errObj?.name === 'QueryTimeoutError' || errObj?.name === 'AbortError') {
    return true;
  }
  const msg = String(errObj?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('timed out') ||
    msg.includes('no internet connection')
  );
}

export function toUserFriendlyNetworkError(err: unknown, fallback: string): Error {
  if (isBrowserOffline() || isNetworkFailureError(err)) {
    return new Error(OFFLINE_ERROR_MESSAGE);
  }
  if (err instanceof Error && err.message.trim()) {
    return err;
  }
  const raw = (err as { message?: unknown } | null)?.message;
  if (typeof raw === 'string' && raw.trim()) {
    return new Error(raw.trim());
  }
  return new Error(fallback);
}

function parseNumericStatus(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && /^\d{3}$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  return 0;
}

export function extractHttpAuthError(
  err: unknown
): { status: 401 | 403; message: string } | null {
  if (!err || typeof err !== 'object') return null;
  const errObj = err as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
    error_description?: unknown;
  };
  const status =
    parseNumericStatus(errObj.status) || parseNumericStatus(errObj.statusCode);
  const code = String(errObj.code || '').toUpperCase();
  const rawMessage =
    typeof errObj.message === 'string' && errObj.message.trim()
      ? errObj.message.trim()
      : typeof errObj.error_description === 'string' &&
        errObj.error_description.trim()
      ? errObj.error_description.trim()
      : '';

  if (status === 401 || code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303') {
    return {
      status: 401,
      message: rawMessage || 'Your session expired. Please sign in again.',
    };
  }
  if (status === 403) {
    return {
      status: 403,
      message: rawMessage || 'Only the owner account can do this.',
    };
  }
  return null;
}

export function toSupabaseActionError(
  err: unknown,
  fallback: string,
  formatFallback?: (rawMessage: unknown, fb: string) => string
): Error {
  if (isBrowserOffline() || isNetworkFailureError(err)) {
    return new Error(OFFLINE_ERROR_MESSAGE);
  }
  const authErr = extractHttpAuthError(err);
  if (authErr) {
    if (authErr.status === 401) {
      notifySessionExpired(authErr.message);
    }
    return Object.assign(new Error(authErr.message), { status: authErr.status });
  }
  const rawMessage =
    err instanceof Error
      ? err.message
      : (err as { message?: unknown } | null)?.message;
  if (formatFallback) {
    return new Error(formatFallback(rawMessage, fallback));
  }
  return toUserFriendlyNetworkError(err, fallback);
}

export function isRetryableTransientError(err: unknown): boolean {
  if (isBrowserOffline()) return false;
  if (!err) return false;
  const errObj = err as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };
  const status =
    parseNumericStatus(errObj.status) || parseNumericStatus(errObj.statusCode);
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 422) {
    return false;
  }
  const code = String(errObj.code || '').toUpperCase();
  if (
    code === 'PGRST116' ||
    code === 'PGRST301' ||
    code === 'PGRST302' ||
    code === 'PGRST303' ||
    code === '42501' ||
    code === '23505' ||
    code === '23503'
  ) {
    return false;
  }
  const msg = String(errObj.message || err || '').toLowerCase();
  if (
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('only the owner') ||
    msg.includes('invalid login') ||
    msg.includes('session expired') ||
    msg.includes('jwt') ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('not found')
  ) {
    return false;
  }
  return isNetworkFailureError(err) || status >= 500 || msg.includes('fetch') || msg.includes('timeout') || msg.includes('temporarily');
}

export async function withRetryOnce<T>(
  fn: () => Promise<T>,
  shouldRetry: (err: unknown) => boolean = isRetryableTransientError,
  delayMs = 250
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isBrowserOffline() || !shouldRetry(err)) {
      throw err;
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (isBrowserOffline()) {
      throw new Error(OFFLINE_ERROR_MESSAGE);
    }
    return await fn();
  }
}

type SessionExpiredListener = (message?: string) => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function notifySessionExpired(message?: string): void {
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener(message);
    } catch {
      // ignore listener errors
    }
  });
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    if (typeof value === 'string' && value === '') {
      setDebounced(value);
      return;
    }
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
