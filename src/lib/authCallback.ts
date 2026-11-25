export type AuthCallbackKind =
  | 'none'
  | 'verification'
  | 'recovery'
  | 'expired';

export interface ParsedAuthCallback {
  kind: AuthCallbackKind;
  flow?: 'pkce' | 'token_hash' | 'implicit';
  code?: string;
  tokenHash?: string;
  otpType?: string;
  errorCode?: string;
  errorDescription?: string;
  cleanPath: string;
}

const AUTH_QUERY_KEYS = [
  'code',
  'token_hash',
  'type',
  'error',
  'error_code',
  'error_description',
  'mode',
  'sb',
] as const;

const AUTH_HASH_KEYS = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'provider_token',
  'provider_refresh_token',
  'type',
  'error',
  'error_code',
  'error_description',
] as const;

export function buildCleanAuthPath(
  pathname: string,
  search: string,
  hash: string
): string {
  const safePath = pathname && pathname.startsWith('/') ? pathname : '/';
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of AUTH_QUERY_KEYS) {
    searchParams.delete(key);
  }
  const cleanSearch = searchParams.toString();

  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(rawHash);
  const hasAuthHashParam = AUTH_HASH_KEYS.some((key) => hashParams.has(key));
  const cleanHash = !hasAuthHashParam && rawHash ? `#${rawHash}` : '';

  return `${safePath}${cleanSearch ? `?${cleanSearch}` : ''}${cleanHash}`;
}

export function parseSupabaseAuthCallbackUrl(
  pathname: string,
  search: string,
  hash: string
): ParsedAuthCallback {
  const searchParams = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(rawHash);
  const cleanPath = buildCleanAuthPath(pathname, search, hash);

  const error = hashParams.get('error') || searchParams.get('error');
  const errorCode =
    hashParams.get('error_code') || searchParams.get('error_code');
  const errorDescription =
    hashParams.get('error_description') || searchParams.get('error_description');

  if (error || errorCode || errorDescription) {
    return {
      kind: 'expired',
      errorCode: errorCode || error || undefined,
      errorDescription: errorDescription || undefined,
      cleanPath,
    };
  }

  const queryMode = searchParams.get('mode');
  const otpType =
    hashParams.get('type') || searchParams.get('type') || undefined;
  const code = searchParams.get('code') || undefined;
  const tokenHash = searchParams.get('token_hash') || undefined;
  const hasAccessToken = hashParams.has('access_token');

  if (queryMode === 'recovery' || otpType === 'recovery') {
    const flow = code
      ? 'pkce'
      : tokenHash
      ? 'token_hash'
      : hasAccessToken
      ? 'implicit'
      : undefined;
    return {
      kind: 'recovery',
      flow,
      code,
      tokenHash,
      otpType: otpType || 'recovery',
      cleanPath,
    };
  }

  if (code) {
    return {
      kind: 'verification',
      flow: 'pkce',
      code,
      otpType,
      cleanPath,
    };
  }

  if (tokenHash && otpType) {
    return {
      kind: 'verification',
      flow: 'token_hash',
      tokenHash,
      otpType,
      cleanPath,
    };
  }

  if (hasAccessToken) {
    return {
      kind: 'verification',
      flow: 'implicit',
      otpType,
      cleanPath,
    };
  }

  return {
    kind: 'none',
    cleanPath,
  };
}

export function mapSignInAuthError(rawMessage: string | undefined | null): string {
  const msg = (rawMessage || '').trim();
  const lower = msg.toLowerCase();

  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address using the link sent to your inbox before signing in.';
  }

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('user not found') ||
    lower.includes('wrong password') ||
    lower.includes('invalid credentials') ||
    lower.includes('email or password')
  ) {
    return 'Incorrect email or password.';
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('timeout')
  ) {
    return 'Unable to reach the server right now. Please check your connection and try again.';
  }

  return msg || 'Incorrect email or password.';
}

export function isExpiredAuthLinkMessage(rawMessage: string | undefined | null): boolean {
  const lower = (rawMessage || '').toLowerCase();
  return (
    lower.includes('expired') ||
    lower.includes('otp_expired') ||
    lower.includes('invalid') ||
    lower.includes('access_denied') ||
    lower.includes('already been used') ||
    lower.includes('token not found')
  );
}
