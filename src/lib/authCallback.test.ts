import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCleanAuthPath,
  mapSignInAuthError,
  parseSupabaseAuthCallbackUrl,
} from './authCallback.ts';

test('parseSupabaseAuthCallbackUrl handles PKCE code verification callback and cleans URL', () => {
  const parsed = parseSupabaseAuthCallbackUrl(
    '/',
    '?code=abc-123-pkce&type=signup&utm_source=email',
    ''
  );
  assert.equal(parsed.kind, 'verification');
  assert.equal(parsed.flow, 'pkce');
  assert.equal(parsed.code, 'abc-123-pkce');
  assert.equal(parsed.cleanPath, '/?utm_source=email');
});

test('parseSupabaseAuthCallbackUrl handles token_hash signup verification callback', () => {
  const parsed = parseSupabaseAuthCallbackUrl(
    '/properties',
    '?token_hash=tok-999&type=signup',
    ''
  );
  assert.equal(parsed.kind, 'verification');
  assert.equal(parsed.flow, 'token_hash');
  assert.equal(parsed.tokenHash, 'tok-999');
  assert.equal(parsed.otpType, 'signup');
  assert.equal(parsed.cleanPath, '/properties');
});

test('parseSupabaseAuthCallbackUrl handles implicit hash access_token callback and strips auth hash', () => {
  const parsed = parseSupabaseAuthCallbackUrl(
    '/',
    '',
    '#access_token=jwt123&refresh_token=ref123&expires_in=3600&type=signup'
  );
  assert.equal(parsed.kind, 'verification');
  assert.equal(parsed.flow, 'implicit');
  assert.equal(parsed.otpType, 'signup');
  assert.equal(parsed.cleanPath, '/');
});

test('parseSupabaseAuthCallbackUrl handles expired link errors in hash or query', () => {
  const fromHash = parseSupabaseAuthCallbackUrl(
    '/',
    '',
    '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
  );
  assert.equal(fromHash.kind, 'expired');
  assert.equal(fromHash.errorCode, 'otp_expired');
  assert.equal(fromHash.cleanPath, '/');

  const fromQuery = parseSupabaseAuthCallbackUrl(
    '/',
    '?error=access_denied&error_code=otp_expired',
    ''
  );
  assert.equal(fromQuery.kind, 'expired');
  assert.equal(fromQuery.cleanPath, '/');
});

test('parseSupabaseAuthCallbackUrl handles recovery links distinctly from signup verification', () => {
  const recoveryPkce = parseSupabaseAuthCallbackUrl(
    '/',
    '?mode=recovery&code=rec-123',
    ''
  );
  assert.equal(recoveryPkce.kind, 'recovery');
  assert.equal(recoveryPkce.flow, 'pkce');
  assert.equal(recoveryPkce.cleanPath, '/');
});

test('buildCleanAuthPath preserves normal section hashes', () => {
  assert.equal(buildCleanAuthPath('/', '', '#contact'), '/#contact');
});

test('mapSignInAuthError never reveals whether email or password was wrong', () => {
  assert.equal(
    mapSignInAuthError('Invalid login credentials'),
    'Incorrect email or password.'
  );
  assert.equal(
    mapSignInAuthError('User not found'),
    'Incorrect email or password.'
  );
  assert.equal(
    mapSignInAuthError('Wrong password'),
    'Incorrect email or password.'
  );
  assert.equal(
    mapSignInAuthError(''),
    'Incorrect email or password.'
  );
});
