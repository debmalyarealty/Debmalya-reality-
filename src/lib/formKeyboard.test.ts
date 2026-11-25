import test from 'node:test';
import assert from 'node:assert/strict';
import { computeKeyboardSafeScrollDelta } from './formKeyboard';

test('computeKeyboardSafeScrollDelta reveals field hidden beneath keyboard', () => {
  const delta = computeKeyboardSafeScrollDelta({
    fieldTop: 420,
    fieldBottom: 472,
    submitBottom: 560,
    viewportTop: 0,
    viewportBottom: 430,
  });
  // Field bottom (472) > safeBottom (414) -> scrolls down at least 58px, and shifts submit up if room allows
  assert.ok(delta >= 58);
});

test('computeKeyboardSafeScrollDelta scrolls field and submit together when both fit', () => {
  const delta = computeKeyboardSafeScrollDelta({
    fieldTop: 220,
    fieldBottom: 268,
    submitBottom: 460,
    viewportTop: 0,
    viewportBottom: 450,
  });
  // safeTop = 88, safeBottom = 434. Extra needed for submit = 460 - 434 = 26, room above field = 220 - 88 = 132 -> scrolls 26px
  assert.equal(delta, 26);
});

test('computeKeyboardSafeScrollDelta clears fixed top navbar when field is too high', () => {
  const delta = computeKeyboardSafeScrollDelta({
    fieldTop: 40,
    fieldBottom: 88,
    submitBottom: 200,
    viewportTop: 0,
    viewportBottom: 500,
  });
  assert.equal(delta, -48);
});
