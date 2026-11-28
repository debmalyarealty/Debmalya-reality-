import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFLINE_ERROR_MESSAGE,
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

test('withRetryOnce does not retry on 401/403/auth errors', async () => {
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
