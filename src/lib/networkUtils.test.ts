import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractHttpAuthError,
  OFFLINE_ERROR_MESSAGE,
  onSessionExpired,
  toSupabaseActionError,
  toUserFriendlyNetworkError,
  withRetryOnce,
} from './networkUtils.ts';

test('withRetryOnce retries once on transient network error and succeeds', async () => {
  let calls = 0;
  const result = await withRetryOnce(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('Failed to fetch');
      }
      return 'ok';
    },
    undefined,
    0
  );
  assert.equal(calls, 2);
  assert.equal(result, 'ok');
});

test('withRetryOnce does not retry on 401/403/statusCode/PostgREST auth errors', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetryOnce(
        async () => {
          calls += 1;
          const err = Object.assign(new Error('Only the owner account can do this.'), { status: 403 });
          throw err;
        },
        undefined,
        0
      ),
    /Only the owner account can do this\./
  );
  assert.equal(calls, 1);

  let storageCalls = 0;
  await assert.rejects(
    () =>
      withRetryOnce(
        async () => {
          storageCalls += 1;
          throw { statusCode: '401', message: 'JWT expired' };
        },
        undefined,
        0
      )
  );
  assert.equal(storageCalls, 1);

  let pgrstCalls = 0;
  await assert.rejects(
    () =>
      withRetryOnce(
        async () => {
          pgrstCalls += 1;
          throw { code: 'PGRST301', message: 'JWT expired' };
        },
        undefined,
        0
      )
  );
  assert.equal(pgrstCalls, 1);
});

test('toUserFriendlyNetworkError normalizes network failures to offline message', () => {
  const err = toUserFriendlyNetworkError(new Error('TypeError: Failed to fetch'), 'Fallback');
  assert.equal(err.message, OFFLINE_ERROR_MESSAGE);

  const timeoutErr = toUserFriendlyNetworkError(
    Object.assign(new Error('Request timed out'), { name: 'QueryTimeoutError' }),
    'Fallback'
  );
  assert.equal(timeoutErr.message, OFFLINE_ERROR_MESSAGE);

  const authErr = toUserFriendlyNetworkError(new Error('Invalid credentials'), 'Fallback');
  assert.equal(authErr.message, 'Invalid credentials');
});

test('extractHttpAuthError and toSupabaseActionError preserve exact 401/403 messages and notify on 401', () => {
  const exact403 = extractHttpAuthError({ statusCode: '403', message: 'Storage bucket policy forbids insert' });
  assert.deepEqual(exact403, { status: 403, message: 'Storage bucket policy forbids insert' });

  let notifiedMsg: string | undefined;
  const unsub = onSessionExpired((msg) => {
    notifiedMsg = msg;
  });

  try {
    const err401 = toSupabaseActionError(
      { status: 401, message: 'Exact server 401 token error' },
      'Generic fallback',
      () => 'Should not hide 401'
    );
    assert.equal(err401.message, 'Exact server 401 token error');
    assert.equal((err401 as { status?: number }).status, 401);
    assert.equal(notifiedMsg, 'Exact server 401 token error');

    const err403 = toSupabaseActionError(
      { statusCode: '403', message: 'Exact server 403 denied message' },
      'Generic fallback',
      () => 'Should not hide 403'
    );
    assert.equal(err403.message, 'Exact server 403 denied message');
    assert.equal((err403 as { status?: number }).status, 403);
  } finally {
    unsub();
  }
});

