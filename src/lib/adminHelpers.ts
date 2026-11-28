import type { UserProfile } from '../types/realty';

/**
 * Extracts Supabase Storage object paths belonging to `bucket` from an array of image URLs.
 * Ignores local bundled assets (/src/assets/...), data URIs, blob URIs, and unrelated external URLs.
 */
export function extractStoragePathsFromUrls(
  urls: readonly string[],
  bucket: string
): string[] {
  const cleanBucket = bucket.trim().replace(/^\/+|\/+$/g, '');
  if (!cleanBucket || !Array.isArray(urls)) return [];

  const markers = [
    `/storage/v1/object/public/${cleanBucket}/`,
    `/storage/v1/object/sign/${cleanBucket}/`,
    `/storage/v1/object/authenticated/${cleanBucket}/`,
  ];

  const paths = new Set<string>();
  for (const raw of urls) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    for (const marker of markers) {
      const idx = trimmed.indexOf(marker);
      if (idx !== -1) {
        const afterMarker = trimmed.slice(idx + marker.length);
        const withoutQuery = afterMarker.split('?')[0].split('#')[0];
        if (withoutQuery) {
          try {
            paths.add(decodeURIComponent(withoutQuery));
          } catch {
            paths.add(withoutQuery);
          }
        }
        break;
      }
    }
  }

  return Array.from(paths);
}

/**
 * Filters registered clients by name, phone number, or email address.
 */
export function filterClientsBySearch(
  clients: readonly UserProfile[],
  query: string
): UserProfile[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...clients];

  const queryDigits = q.replace(/[^\d]/g, '');
  return clients.filter((c) => {
    const name = (c.full_name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    if (name.includes(q) || email.includes(q) || phone.includes(q)) {
      return true;
    }
    if (queryDigits.length >= 3) {
      const phoneDigits = (c.phone || '').replace(/[^\d]/g, '');
      if (phoneDigits.includes(queryDigits)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Validates a new password (and optional confirmation) without mutating or storing it.
 */
export function validateNewPassword(
  password: string,
  confirmPassword?: string
): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}

/**
 * Generates an unambiguous random temporary password using crypto.getRandomValues when available.
 */
export function generateTemporaryPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;

  const targetLen = Math.max(8, Math.min(32, length));
  const randomByte = (max: number): number => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      globalThis.crypto.getRandomValues(arr);
      return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  const chars: string[] = [
    upper[randomByte(upper.length)],
    lower[randomByte(lower.length)],
    digits[randomByte(digits.length)],
    symbols[randomByte(symbols.length)],
  ];
  while (chars.length < targetLen) {
    chars.push(all[randomByte(all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomByte(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

/**
 * Builds a safe https://wa.me/... URL for an enquiry or client phone number.
 */
export function buildWhatsappChatHref(
  phone: string | undefined,
  text?: string
): string | null {
  const digits = (phone || '').replace(/[^\d]/g, '');
  if (digits.length < 10) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  if (text && text.trim()) {
    return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/${full}`;
}

/**
 * Normalizes an email, role, or UUID string with trim + lowercase for safe comparisons.
 */
export function normalizeIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Checks whether a profile role string represents the owner account (case-insensitive, trimmed).
 */
export function isOwnerRole(role: unknown): boolean {
  return normalizeIdentifier(role) === 'owner';
}

/**
 * Converts raw database/auth/Edge-Function errors into concise, human-readable copy.
 */
export function formatFriendlyActionError(
  rawMessage: unknown,
  fallback: string
): string {
  const msg = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  const lower = msg.toLowerCase();

  if (
    lower.includes('jwt') ||
    lower.includes('expired') ||
    lower.includes('invalid or expired session') ||
    lower.includes('authentication required') ||
    lower.includes('auth session missing') ||
    lower.includes('401')
  ) {
    return 'Your session expired. Please sign in again.';
  }

  if (
    lower.includes('only the owner') ||
    lower.includes('owner check failed') ||
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('forbidden') ||
    lower.includes('403')
  ) {
    return 'Only the owner account can do this.';
  }

  if (
    lower.includes('different from the old') ||
    lower.includes('same_password')
  ) {
    return 'Please choose a different password from the current one.';
  }

  if (
    lower.includes('between 8 and 128') ||
    lower.includes('at least 8') ||
    lower.includes('weak_password')
  ) {
    return 'Password must be between 8 and 128 characters.';
  }

  if (lower.includes('active owner account') || lower.includes('owner accounts cannot be deleted')) {
    return 'Owner accounts cannot be deleted here.';
  }

  if (lower.includes('client account not found') || lower.includes('cannot be modified')) {
    return 'Client account could not be found.';
  }

  return fallback;
}

