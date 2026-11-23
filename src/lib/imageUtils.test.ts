import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPropertyImageAlt,
  computeTargetDimensions,
  formatFileSize,
  makeItemFirst,
  MAX_INPUT_IMAGE_BYTES,
  MAX_PROPERTY_PHOTOS,
  MAX_UPLOADED_IMAGE_BYTES,
  reorderItems,
} from './imageUtils.ts';

test('image limits match Part 4 specification', () => {
  assert.equal(MAX_INPUT_IMAGE_BYTES, 15 * 1024 * 1024);
  assert.equal(MAX_UPLOADED_IMAGE_BYTES, 500 * 1024);
  assert.equal(MAX_PROPERTY_PHOTOS, 20);
});

test('computeTargetDimensions caps longest side while preserving aspect ratio and avoiding upscale', () => {
  assert.deepEqual(computeTargetDimensions(4000, 3000, 1600), {
    width: 1600,
    height: 1200,
  });
  assert.deepEqual(computeTargetDimensions(3000, 4500, 1200), {
    width: 800,
    height: 1200,
  });
  assert.deepEqual(computeTargetDimensions(900, 600, 1200), {
    width: 900,
    height: 600,
  });
});

test('formatFileSize formats bytes, KB, and MB cleanly', () => {
  assert.equal(formatFileSize(800), '800 B');
  assert.equal(formatFileSize(245 * 1024), '245 KB');
  assert.equal(formatFileSize(3.5 * 1024 * 1024), '3.5 MB');
});

test('buildPropertyImageAlt produces descriptive alt text from title and location', () => {
  assert.equal(
    buildPropertyImageAlt('3 BHK Residence', 'Sevoke Road'),
    '3 BHK Residence, Sevoke Road'
  );
  assert.equal(
    buildPropertyImageAlt('3 BHK Residence — Sevoke Road', 'Sevoke Road'),
    '3 BHK Residence — Sevoke Road'
  );
  assert.equal(
    buildPropertyImageAlt('Sunlit Villa', 'Bhanu Nagar', 2),
    'Sunlit Villa, Bhanu Nagar — photo 3'
  );
});

test('reorderItems and makeItemFirst move cover photos cleanly', () => {
  assert.deepEqual(reorderItems(['a', 'b', 'c', 'd'], 3, 1), [
    'a',
    'd',
    'b',
    'c',
  ]);
  assert.deepEqual(makeItemFirst(['a', 'b', 'c'], 2), ['c', 'a', 'b']);
  assert.deepEqual(makeItemFirst(['a', 'b'], 0), ['a', 'b']);
});
