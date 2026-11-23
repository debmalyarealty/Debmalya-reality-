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

export interface SupabaseRuntimeDiagnostics {
  urlSource: string | null;
  keySource: string | null;
  hasUrl: boolean;
  hasKey: boolean;
  urlValid: boolean;
  keyValid: boolean;
  issues: string[];
}

export interface RuntimeSupabaseConfig {
  url: string;
  anonKey: string;
  diagnostics: SupabaseRuntimeDiagnostics;
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

function isPlaceholder(val: string): boolean {
  return (
    !val ||
    val.startsWith('MY_') ||
    val.includes('your-project') ||
    val.includes('your-anon-key') ||
    val === 'undefined' ||
    val === 'null'
  );
}

function isValidHttpUrl(val: string): boolean {
  if (isPlaceholder(val)) return false;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isServiceRoleKey(val: string): boolean {
  const clean = val.trim();
  if (!clean) return false;
  if (clean.startsWith('sb_secret_')) return true;
  const parts = clean.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8')
      ) as { role?: unknown };
      if (payload?.role === 'service_role') return true;
    } catch {
      // ignore malformed base64
    }
  }
  return false;
}

function isValidPublicSupabaseKey(val: string): boolean {
  if (isPlaceholder(val)) return false;
  if (isServiceRoleKey(val)) return false;
  if (val.startsWith('http://') || val.startsWith('https://')) return false;
  return val.length > 20;
}

function firstNonEmptyEnv(
  env: Record<string, string | undefined>,
  names: readonly string[]
): { name: string | null; value: string } {
  for (const name of names) {
    const raw = env[name];
    if (typeof raw === 'string') {
      const clean = stripOuterQuotes(raw);
      if (clean && !isPlaceholder(clean)) {
        return { name, value: clean };
      }
    }
  }
  return { name: null, value: '' };
}

export function resolveRuntimeSupabaseConfig(
  env: Record<string, string | undefined> = process.env
): RuntimeSupabaseConfig {
  const urlMatch = firstNonEmptyEnv(env, SUPABASE_URL_ENV_NAMES);
  const keyMatch = firstNonEmptyEnv(env, SUPABASE_KEY_ENV_NAMES);

  const issues: string[] = [];
  let resolvedUrl = urlMatch.value;
  let resolvedKey = keyMatch.value;

  const urlValid = isValidHttpUrl(resolvedUrl);
  const keyIsSecret = resolvedKey ? isServiceRoleKey(resolvedKey) : false;
  const keyValid = isValidPublicSupabaseKey(resolvedKey);

  if (!urlMatch.name) {
    issues.push(
      `Missing Supabase URL. Checked: ${SUPABASE_URL_ENV_NAMES.join(', ')}.`
    );
  } else if (!urlValid) {
    if (resolvedUrl.startsWith('eyJ') || resolvedUrl.startsWith('sb_')) {
      issues.push(
        `${urlMatch.name} appears to hold an API key instead of your https://...supabase.co project URL.`
      );
    } else {
      issues.push(
        `${urlMatch.name} is set, but its value is not a valid https:// Supabase project URL.`
      );
    }
    resolvedUrl = '';
  }

  if (!keyMatch.name) {
    issues.push(
      `Missing Supabase anon/publishable key. Checked: ${SUPABASE_KEY_ENV_NAMES.join(', ')}.`
    );
  } else if (keyIsSecret) {
    issues.push(
      `${keyMatch.name} contains a secret/service_role key. Never expose service_role in the browser; use your public anon or publishable key (sb_publishable_... or anon JWT) from Supabase Project Settings -> API.`
    );
    resolvedKey = '';
  } else if (!keyValid) {
    if (resolvedKey.startsWith('http://') || resolvedKey.startsWith('https://')) {
      issues.push(
        `${keyMatch.name} appears to hold a URL instead of your Supabase anon/publishable key.`
      );
    } else {
      issues.push(
        `${keyMatch.name} is set, but does not look like a valid Supabase anon or publishable key.`
      );
    }
    resolvedKey = '';
  }

  return {
    url: urlValid && keyValid ? resolvedUrl : '',
    anonKey: urlValid && keyValid ? resolvedKey : '',
    diagnostics: {
      urlSource: urlMatch.name,
      keySource: keyMatch.name,
      hasUrl: Boolean(urlMatch.name),
      hasKey: Boolean(keyMatch.name),
      urlValid,
      keyValid,
      issues,
    },
  };
}

export function injectRuntimeConfigIntoHtml(
  html: string,
  config: RuntimeSupabaseConfig
): string {
  if (html.includes('id="debmalya-runtime-config"')) {
    return html;
  }
  const safeJson = JSON.stringify(config).replace(/</g, '\\u003c');
  const scriptTag = `<script id="debmalya-runtime-config">window.__DEBMALYA_RUNTIME_CONFIG__=${safeJson};</script>`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `  ${scriptTag}\n  </head>`);
  }
  return `${scriptTag}\n${html}`;
}
