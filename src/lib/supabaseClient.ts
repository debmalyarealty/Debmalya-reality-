import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL_ENV_NAMES = [
  'VITE_SUPABASE_URL',
  'VITE SUPABASE URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const;

export const SUPABASE_KEY_ENV_NAMES = [
  'VITE_SUPABASE_ANON_KEY',
  'VITE SUPABASE ANON KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;

export interface SupabaseConfigDiagnostics {
  urlSource: string | null;
  keySource: string | null;
  hasUrl: boolean;
  hasKey: boolean;
  urlValid: boolean;
  keyValid: boolean;
  issues: string[];
}

interface RuntimeConfigPayload {
  url?: string;
  anonKey?: string;
  diagnostics?: Partial<SupabaseConfigDiagnostics>;
}

declare global {
  interface Window {
    __DEBMALYA_RUNTIME_CONFIG__?: RuntimeConfigPayload;
  }
}

function stripOuterQuotes(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isPlaceholder(value: string): boolean {
  return (
    !value ||
    value.startsWith('MY_') ||
    value.includes('your-project') ||
    value.includes('your-anon-key') ||
    value === 'undefined' ||
    value === 'null'
  );
}

function isValidHttpUrl(value: string): boolean {
  if (isPlaceholder(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isServiceRoleBrowserKey(value: string): boolean {
  const clean = value.trim();
  if (!clean) return false;
  if (clean.startsWith('sb_secret_')) return true;
  const parts = clean.split('.');
  if (parts.length === 3) {
    try {
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(json) as { role?: unknown };
      if (payload?.role === 'service_role') return true;
    } catch {
      // ignore invalid base64
    }
  }
  return false;
}

function isValidAnonKey(value: string): boolean {
  if (isPlaceholder(value)) return false;
  if (isServiceRoleBrowserKey(value)) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  return value.length > 20;
}

function readMetaEnvFallback(): {
  url: string;
  urlSource: string | null;
  anonKey: string;
  keySource: string | null;
} {
  const metaEnv = import.meta.env as Record<string, string | undefined>;
  const metaUrlCandidates: Array<[string, string | undefined]> = [
    ['VITE_SUPABASE_URL', metaEnv.VITE_SUPABASE_URL],
    ['NEXT_PUBLIC_SUPABASE_URL', metaEnv.NEXT_PUBLIC_SUPABASE_URL],
  ];
  const metaKeyCandidates: Array<[string, string | undefined]> = [
    ['VITE_SUPABASE_ANON_KEY', metaEnv.VITE_SUPABASE_ANON_KEY],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY],
    [
      'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
      metaEnv.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    ],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    [
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ],
  ];

  let url = '';
  let urlSource: string | null = null;
  for (const [name, raw] of metaUrlCandidates) {
    if (typeof raw === 'string') {
      const clean = stripOuterQuotes(raw);
      if (clean && !isPlaceholder(clean)) {
        url = clean;
        urlSource = `import.meta.env.${name}`;
        break;
      }
    }
  }

  let anonKey = '';
  let keySource: string | null = null;
  for (const [name, raw] of metaKeyCandidates) {
    if (typeof raw === 'string') {
      const clean = stripOuterQuotes(raw);
      if (clean && !isPlaceholder(clean)) {
        anonKey = clean;
        keySource = `import.meta.env.${name}`;
        break;
      }
    }
  }

  return { url, urlSource, anonKey, keySource };
}

const runtimeInjected =
  typeof window !== 'undefined' ? window.__DEBMALYA_RUNTIME_CONFIG__ : undefined;
const metaFallback = readMetaEnvFallback();

const candidateUrl = stripOuterQuotes(
  runtimeInjected?.url || metaFallback.url || ''
);
const candidateKey = stripOuterQuotes(
  runtimeInjected?.anonKey || metaFallback.anonKey || ''
);

const urlValid = isValidHttpUrl(candidateUrl);
const keyValid = isValidAnonKey(candidateKey);

const resolvedIssues: string[] = [];
if (runtimeInjected?.diagnostics?.issues?.length && !(urlValid && keyValid)) {
  resolvedIssues.push(...runtimeInjected.diagnostics.issues);
} else {
  if (!candidateUrl) {
    resolvedIssues.push(
      `Missing Supabase URL. Checked: ${SUPABASE_URL_ENV_NAMES.join(', ')}.`
    );
  } else if (!urlValid) {
    resolvedIssues.push(
      `Invalid Supabase URL (${runtimeInjected?.diagnostics?.urlSource || metaFallback.urlSource || 'env'}). Expected https://<project>.supabase.co.`
    );
  }

  if (!candidateKey) {
    resolvedIssues.push(
      `Missing Supabase anon/publishable key. Checked: ${SUPABASE_KEY_ENV_NAMES.join(', ')}.`
    );
  } else if (isServiceRoleBrowserKey(candidateKey)) {
    resolvedIssues.push(
      'Detected a service_role / secret key instead of the public anon/publishable key.'
    );
  } else if (!keyValid) {
    resolvedIssues.push(
      `Invalid Supabase anon/publishable key (${runtimeInjected?.diagnostics?.keySource || metaFallback.keySource || 'env'}).`
    );
  }
}

export const supabaseConfigDiagnostics: SupabaseConfigDiagnostics = {
  urlSource: runtimeInjected?.diagnostics?.urlSource ?? metaFallback.urlSource,
  keySource: runtimeInjected?.diagnostics?.keySource ?? metaFallback.keySource,
  hasUrl: Boolean(runtimeInjected?.diagnostics?.hasUrl || candidateUrl),
  hasKey: Boolean(runtimeInjected?.diagnostics?.hasKey || candidateKey),
  urlValid,
  keyValid,
  issues: resolvedIssues,
};

export const isSupabaseConfigured: boolean = urlValid && keyValid;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(candidateUrl, candidateKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const BACKEND_NOT_CONFIGURED_MESSAGE =
  resolvedIssues[0] ||
  'Backend not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect Supabase.';

export interface SupabaseConnectionCheckResult {
  ok: boolean;
  message: string;
  hint?: string;
}

let cachedHealthyCheckAt = 0;
let cachedHealthyCheckResult: SupabaseConnectionCheckResult | null = null;
const CONNECTION_CHECK_TTL_MS = 4 * 60 * 1000;

export async function testSupabaseConnection(): Promise<SupabaseConnectionCheckResult> {
  if (!supabase) {
    return {
      ok: false,
      message: supabaseConfigDiagnostics.issues.join(' ') || BACKEND_NOT_CONFIGURED_MESSAGE,
      hint: 'Ensure both secrets are saved in AI Studio Secrets (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) and restart the app.',
    };
  }

  if (
    cachedHealthyCheckResult?.ok &&
    Date.now() - cachedHealthyCheckAt < CONNECTION_CHECK_TTL_MS
  ) {
    return cachedHealthyCheckResult;
  }

  try {
    const { error: settingsErr } = await supabase
      .from('site_settings')
      .select('id')
      .limit(1);

    if (settingsErr) {
      cachedHealthyCheckResult = null;
      return {
        ok: false,
        message: settingsErr.message,
        hint: inferConnectionErrorHint(settingsErr.message),
      };
    }

    const { error: propsErr } = await supabase
      .from('properties')
      .select('id')
      .limit(1);

    if (propsErr) {
      cachedHealthyCheckResult = null;
      return {
        ok: false,
        message: propsErr.message,
        hint: inferConnectionErrorHint(propsErr.message),
      };
    }

    const okResult: SupabaseConnectionCheckResult = {
      ok: true,
      message: 'Connected to Supabase',
    };
    cachedHealthyCheckAt = Date.now();
    cachedHealthyCheckResult = okResult;
    return okResult;
  } catch (err) {
    cachedHealthyCheckResult = null;
    const msg = err instanceof Error ? err.message : 'Failed to reach Supabase.';
    return {
      ok: false,
      message: msg,
      hint: inferConnectionErrorHint(msg),
    };
  }
}

function inferConnectionErrorHint(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('permission denied')) {
    return 'URL and key connected, but PostgreSQL denied table access (missing GRANT permissions). Re-run the updated SQL script (with GRANT statements for anon & authenticated) in your Supabase SQL Editor.';
  }
  if (
    lower.includes('does not exist') ||
    lower.includes('schema cache') ||
    lower.includes('could not find the table')
  ) {
    return 'URL and key connected, but tables are missing — run the complete SQL script in your Supabase SQL Editor.';
  }
  if (
    lower.includes('invalid api key') ||
    lower.includes('jwt') ||
    lower.includes('401') ||
    lower.includes('apikey')
  ) {
    return 'Wrong key for this Supabase project — copy the anon / publishable key from Supabase Project Settings -> API.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('enotfound') ||
    lower.includes('err_name_not_resolved')
  ) {
    return 'Could not reach Supabase URL — verify VITE_SUPABASE_URL matches https://<project-ref>.supabase.co and the project is not paused.';
  }
  return 'Check your Supabase URL, anon/publishable key, and ensure the SQL setup script has been executed.';
}
