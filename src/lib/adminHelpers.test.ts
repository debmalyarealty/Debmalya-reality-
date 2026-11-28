import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWhatsappChatHref,
  extractStoragePathsFromUrls,
  filterClientsBySearch,
  formatFriendlyActionError,
  generateTemporaryPassword,
  isOwnerRole,
  normalizeIdentifier,
  validateNewPassword,
} from './adminHelpers.ts';
import type { UserProfile } from '../types/realty.ts';

describe('extractStoragePathsFromUrls', () => {
  it('extracts public storage object paths for the matching bucket', () => {
    const paths = extractStoragePathsFromUrls(
      [
        'https://abcxyz.supabase.co/storage/v1/object/public/property-images/1700-photo%201.webp',
        'https://abcxyz.supabase.co/storage/v1/object/public/property-images/folder/a.jpg?width=800',
        'https://abcxyz.supabase.co/storage/v1/object/public/team-photos/agent.webp',
        '/src/assets/images/demo.jpg',
        'data:image/png;base64,AAA',
      ],
      'property-images'
    );
    assert.deepEqual(paths, ['1700-photo 1.webp', 'folder/a.jpg']);
  });

  it('deduplicates repeated URLs and handles empty input', () => {
    const paths = extractStoragePathsFromUrls(
      [
        'https://proj.supabase.co/storage/v1/object/public/property-images/x.webp',
        'https://proj.supabase.co/storage/v1/object/public/property-images/x.webp',
      ],
      'property-images'
    );
    assert.deepEqual(paths, ['x.webp']);
    assert.deepEqual(extractStoragePathsFromUrls([], 'property-images'), []);
  });
});

describe('filterClientsBySearch', () => {
  const sample: UserProfile[] = [
    {
      id: '1',
      email: 'ananya@example.com',
      full_name: 'Ananya Sen',
      phone: '+91 98320 11223',
      city: 'Siliguri',
      role: 'client',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      email: 'rohit.sharma@example.com',
      full_name: 'Rohit Sharma',
      phone: '8649858954',
      city: 'Siliguri',
      role: 'client',
      created_at: '2026-01-02T00:00:00Z',
    },
  ];

  it('matches by name, email, and normalized phone digits', () => {
    assert.equal(filterClientsBySearch(sample, 'ananya').length, 1);
    assert.equal(filterClientsBySearch(sample, 'rohit.sharma').length, 1);
    assert.equal(filterClientsBySearch(sample, '9832011223').length, 1);
    assert.equal(filterClientsBySearch(sample, 'unknown').length, 0);
    assert.equal(filterClientsBySearch(sample, '   ').length, 2);
  });
});

describe('validateNewPassword & generateTemporaryPassword', () => {
  it('enforces minimum length and matching confirmation', () => {
    assert.equal(
      validateNewPassword('short'),
      'Password must be at least 8 characters long.'
    );
    assert.equal(
      validateNewPassword('validPass1!', 'mismatchPass1!'),
      'Passwords do not match.'
    );
    assert.equal(validateNewPassword('validPass1!', 'validPass1!'), null);
    assert.equal(validateNewPassword('validPass1!'), null);
  });

  it('generates passwords meeting policy requirements', () => {
    const pw = generateTemporaryPassword(12);
    assert.equal(pw.length, 12);
    assert.equal(validateNewPassword(pw), null);
  });
});

describe('buildWhatsappChatHref', () => {
  it('normalizes Indian 10-digit numbers and rejects short numbers', () => {
    assert.equal(buildWhatsappChatHref('12345'), null);
    assert.equal(
      buildWhatsappChatHref('98320 11223'),
      'https://wa.me/919832011223'
    );
    assert.equal(
      buildWhatsappChatHref('+91 86498 58954', 'Hello'),
      'https://wa.me/918649858954?text=Hello'
    );
  });
});

describe('formatFriendlyActionError', () => {
  it('hides raw Postgres/HTTP text behind clear human-readable copy', () => {
    assert.equal(
      formatFriendlyActionError(
        'new row violates row-level security policy for table "properties"',
        'Could not delete. Please try again.'
      ),
      'Only the owner account can do this.'
    );
    assert.equal(
      formatFriendlyActionError(
        'Edge Function returned a non-2xx status code',
        'Could not delete. Please try again.'
      ),
      'Could not delete. Please try again.'
    );
    assert.equal(
      formatFriendlyActionError(
        'Invalid or expired session.',
        'Could not delete. Please try again.'
      ),
      'Your session expired. Please sign in again.'
    );
  });
});

describe('isOwnerRole & normalizeIdentifier', () => {
  it('performs case-insensitive and whitespace-trimmed owner & identifier checks', () => {
    assert.equal(isOwnerRole('owner'), true);
    assert.equal(isOwnerRole('  Owner  '), true);
    assert.equal(isOwnerRole('OWNER'), true);
    assert.equal(isOwnerRole('client'), false);
    assert.equal(isOwnerRole(null), false);
    assert.equal(
      normalizeIdentifier('  DebmalyaRealty@GMAIL.com '),
      'debmalyarealty@gmail.com'
    );
  });
});
