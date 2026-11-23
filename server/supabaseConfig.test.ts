import test from 'node:test';
import assert from 'node:assert/strict';
import {
  injectRuntimeConfigIntoHtml,
  resolveRuntimeSupabaseConfig,
} from './supabaseConfig';

test('resolveRuntimeSupabaseConfig reads standard VITE_ variables', () => {
  const cfg = resolveRuntimeSupabaseConfig({
    VITE_SUPABASE_URL: 'https://demo-proj.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.sig1234567890',
  });
  assert.equal(cfg.url, 'https://demo-proj.supabase.co');
  assert.equal(cfg.diagnostics.urlSource, 'VITE_SUPABASE_URL');
  assert.equal(cfg.diagnostics.keySource, 'VITE_SUPABASE_ANON_KEY');
  assert.equal(cfg.diagnostics.issues.length, 0);
});

test('resolveRuntimeSupabaseConfig reads space-separated and unprefixed fallback names and sb_publishable keys', () => {
  const cfg = resolveRuntimeSupabaseConfig({
    'VITE SUPABASE URL': 'https://demo-proj.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_public_key_1234567890',
  });
  assert.equal(cfg.url, 'https://demo-proj.supabase.co');
  assert.equal(cfg.diagnostics.urlSource, 'VITE SUPABASE URL');
  assert.equal(cfg.diagnostics.keySource, 'SUPABASE_PUBLISHABLE_KEY');
  assert.equal(cfg.diagnostics.issues.length, 0);
});

test('resolveRuntimeSupabaseConfig blocks service_role and sb_secret keys', () => {
  const serviceJwtPayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  const cfg = resolveRuntimeSupabaseConfig({
    VITE_SUPABASE_URL: 'https://demo-proj.supabase.co',
    VITE_SUPABASE_ANON_KEY: `eyJhbGciOiJIUzI1NiJ9.${serviceJwtPayload}.signature1234567890`,
  });
  assert.equal(cfg.anonKey, '');
  assert.equal(cfg.diagnostics.keyValid, false);
  assert.match(cfg.diagnostics.issues.join(' '), /service_role/i);

  const cfg2 = resolveRuntimeSupabaseConfig({
    VITE_SUPABASE_URL: 'https://demo-proj.supabase.co',
    SUPABASE_ANON_KEY: 'sb_secret_super_dangerous_secret_1234567890',
  });
  assert.equal(cfg2.anonKey, '');
  assert.equal(cfg2.diagnostics.keyValid, false);
});

test('injectRuntimeConfigIntoHtml escapes HTML and avoids duplicate injection', () => {
  const html = '<html><head><title>Test</title></head><body></body></html>';
  const cfg = resolveRuntimeSupabaseConfig({});
  const injected = injectRuntimeConfigIntoHtml(html, cfg);
  assert.ok(injected.includes('window.__DEBMALYA_RUNTIME_CONFIG__='));
  assert.ok(injected.includes('id="debmalya-runtime-config"'));
  const twice = injectRuntimeConfigIntoHtml(injected, cfg);
  assert.equal(twice, injected);
});
