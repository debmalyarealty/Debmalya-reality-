import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import {
  clearSessionCookie,
  hashPassword,
  optionalAuth,
  requireAuth,
  requireOwner,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  type AuthedRequest,
} from './auth';
import {
  createNotification,
  db,
  getWebsiteSettings,
  hydrateProperties,
  UPLOADS_DIR,
} from './db';
import {
  computeRecommendations,
  doesPropertyMatchPreferences,
  isPropertyActiveOpportunity,
  isValidEmail,
  isValidPhone,
  sanitizeText,
  slugify,
  validateAppointmentInput,
  validateInquiryInput,
  validateReviewInput,
} from '../src/lib/realtyLogic';
import type {
  CustomerPreferences,
  Property,
  WebsiteSettings,
} from '../src/types/realty';

export const apiRouter = Router();

function getUserById(id: string) {
  const row = db
    .prepare(
      `SELECT p.id, p.email, p.full_name, p.phone, p.city, p.created_at, ur.role
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row || null;
}

function getOwnerUserIds(): string[] {
  const rows = db
    .prepare("SELECT user_id FROM user_roles WHERE role = 'owner'")
    .all() as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

// ---------- PUBLIC ENDPOINTS ----------

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

apiRouter.get('/settings', (_req, res) => {
  res.json({ settings: getWebsiteSettings() });
});

apiRouter.get('/properties', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM properties WHERE is_published = 1 ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  res.json({ properties: hydrateProperties(rows) });
});

apiRouter.get('/properties/:slugOrId', optionalAuth, (req: AuthedRequest, res: Response) => {
  const key = req.params.slugOrId;
  const row = db
    .prepare('SELECT * FROM properties WHERE slug = ? OR id = ?')
    .get(key, key) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Property not found.' });
    return;
  }

  const isOwner = req.auth?.role === 'owner';
  if (!row.is_published && !isOwner) {
    res.status(404).json({ error: 'Property not found.' });
    return;
  }

  const [property] = hydrateProperties([row]);
  const similarRows = db
    .prepare(
      `SELECT * FROM properties
       WHERE is_published = 1 AND id != ? AND status IN ('Available', 'Under Construction', 'Upcoming')
       ORDER BY (location = ?) DESC, (property_type = ?) DESC, created_at DESC
       LIMIT 3`
    )
    .all(property.id, property.location, property.property_type) as Record<
    string,
    unknown
  >[];

  res.json({
    property,
    similar: hydrateProperties(similarRows),
  });
});

apiRouter.get('/agents', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM agents WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC')
    .all();
  res.json({ agents: rows });
});

apiRouter.get('/reviews', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, reviewer_name, customer_type, rating, review_text, source, source_label,
              avatar_url, status, is_featured, review_date, created_at
       FROM reviews
       WHERE status = 'approved'
       ORDER BY is_featured DESC, review_date DESC, created_at DESC`
    )
    .all();
  res.json({ reviews: rows });
});

// ---------- AUTH & OWNER BOOTSTRAP ----------

apiRouter.get('/auth/me', optionalAuth, (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    res.json({ user: null });
    return;
  }
  const user = getUserById(req.auth.userId);
  if (!user) {
    clearSessionCookie(res);
    res.json({ user: null });
    return;
  }
  res.json({ user });
});

apiRouter.get('/auth/owner-status', (_req, res) => {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM user_roles WHERE role = 'owner'")
    .get() as { count: number };
  res.json({ ownerExists: row.count > 0 });
});

apiRouter.post('/auth/owner-bootstrap', (req: Request, res: Response) => {
  const countRow = db
    .prepare("SELECT COUNT(*) as count FROM user_roles WHERE role = 'owner'")
    .get() as { count: number };
  if (countRow.count > 0) {
    res.status(403).json({
      error: 'Initial owner setup has already been completed and is permanently locked.',
    });
    return;
  }

  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const fullName = sanitizeText(req.body?.full_name, 120);
  const phone = sanitizeText(req.body?.phone, 30);

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please provide a valid owner email address.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Owner password must be at least 8 characters.' });
    return;
  }
  if (fullName.length < 2) {
    res.status(400).json({ error: 'Please enter the owner full name.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM profiles WHERE email = ?')
    .get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  db.prepare(
    `INSERT INTO profiles (id, email, password_hash, full_name, phone, city, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'Siliguri', ?, ?)`
  ).run(id, email, passwordHash, fullName, phone, now, now);

  db.prepare(
    `INSERT INTO user_roles (user_id, role, created_at) VALUES (?, 'owner', ?)`
  ).run(id, now);

  const token = signSessionToken({ userId: id, email, role: 'owner' });
  setSessionCookie(res, token);

  res.status(201).json({
    user: getUserById(id),
    token,
  });
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const fullName = sanitizeText(req.body?.full_name, 120);
  const phone = sanitizeText(req.body?.phone, 30);
  const city = sanitizeText(req.body?.city || 'Siliguri', 80) || 'Siliguri';

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }
  if (fullName.length < 2) {
    res.status(400).json({ error: 'Please enter your full name.' });
    return;
  }
  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM profiles WHERE email = ?')
    .get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  db.prepare(
    `INSERT INTO profiles (id, email, password_hash, full_name, phone, city, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, email, passwordHash, fullName, phone, city, now, now);

  // Never trust client role on registration; always enforce customer
  db.prepare(
    `INSERT INTO user_roles (user_id, role, created_at) VALUES (?, 'customer', ?)`
  ).run(id, now);

  db.prepare(
    `INSERT INTO customer_preferences (user_id, preferred_location, property_type, listing_type, notify_matches, updated_at)
     VALUES (?, 'All', 'All', 'Buy', 1, ?)`
  ).run(id, now);

  // Link any guest inquiries, site visits, or reviews submitted with the same email prior to registering
  db.prepare(
    'UPDATE inquiries SET user_id = ?, updated_at = ? WHERE user_id IS NULL AND LOWER(email) = ?'
  ).run(id, now, email);
  db.prepare(
    'UPDATE appointments SET user_id = ?, updated_at = ? WHERE user_id IS NULL AND LOWER(email) = ?'
  ).run(id, now, email);
  db.prepare(
    'UPDATE reviews SET user_id = ? WHERE user_id IS NULL AND LOWER(reviewer_email) = ?'
  ).run(id, email);

  createNotification({
    user_id: id,
    title: 'Welcome to Debmalya Realty',
    message:
      'Set your Siliguri property preferences to receive personalized recommendations and track your site visits.',
    type: 'system',
    link_url: '/my-account',
  });

  const token = signSessionToken({ userId: id, email, role: 'customer' });
  setSessionCookie(res, token);

  res.status(201).json({
    user: getUserById(id),
    token,
  });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const requiredRole = req.body?.expectedRole as 'owner' | 'customer' | undefined;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT p.id, p.email, p.password_hash, ur.role
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.email = ?`
    )
    .get(email) as
    | { id: string; email: string; password_hash: string; role: 'owner' | 'customer' }
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (requiredRole && row.role !== requiredRole) {
    res.status(403).json({
      error:
        requiredRole === 'owner'
          ? 'This portal is restricted to authorized Debmalya Realty owner accounts.'
          : 'Please sign in through the Owner Portal for administrator access.',
    });
    return;
  }

  const token = signSessionToken({
    userId: row.id,
    email: row.email,
    role: row.role,
  });
  setSessionCookie(res, token);

  res.json({
    user: getUserById(row.id),
    token,
  });
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

apiRouter.post('/auth/forgot-password', (req: Request, res: Response) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  const user = db
    .prepare('SELECT id FROM profiles WHERE email = ?')
    .get(email) as { id: string } | undefined;

  if (!user) {
    // Do not leak email existence unnecessarily, return generic success without token
    res.json({
      ok: true,
      message:
        'If an account matches this email, a password reset code has been generated.',
    });
    return;
  }

  const resetCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = Date.now() + 1000 * 60 * 30; // 30 mins
  db.prepare(
    'INSERT INTO password_resets (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)'
  ).run(resetCode, user.id, expiresAt);

  res.json({
    ok: true,
    message:
      'Password reset token generated (SMTP email delivery is not configured in local mode; use the verification code below within 30 minutes).',
    devResetToken: resetCode,
  });
});

apiRouter.post('/auth/reset-password', (req: Request, res: Response) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const resetToken = sanitizeText(req.body?.token, 40).toUpperCase();
  const newPassword =
    typeof req.body?.new_password === 'string' ? req.body.new_password : '';

  if (!isValidEmail(email) || !resetToken || newPassword.length < 6) {
    res.status(400).json({
      error: 'Valid email, reset code, and new password (min 6 chars) are required.',
    });
    return;
  }

  const user = db
    .prepare('SELECT id FROM profiles WHERE email = ?')
    .get(email) as { id: string } | undefined;
  if (!user) {
    res.status(400).json({ error: 'Invalid reset request.' });
    return;
  }

  const row = db
    .prepare(
      'SELECT token, expires_at, used FROM password_resets WHERE token = ? AND user_id = ?'
    )
    .get(resetToken, user.id) as
    | { token: string; expires_at: number; used: number }
    | undefined;

  if (!row || row.used || row.expires_at < Date.now()) {
    res.status(400).json({ error: 'Reset code is invalid or expired.' });
    return;
  }

  db.prepare(
    'UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?'
  ).run(hashPassword(newPassword), new Date().toISOString(), user.id);

  db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').run(resetToken);

  res.json({ ok: true, message: 'Your password has been updated. You may now sign in.' });
});

// ---------- CUSTOMER PRIVATE ENDPOINTS ----------

apiRouter.patch('/customer/profile', requireAuth, (req: AuthedRequest, res: Response) => {
  const fullName = sanitizeText(req.body?.full_name, 120);
  const phone = sanitizeText(req.body?.phone, 30);
  const city = sanitizeText(req.body?.city || 'Siliguri', 80);

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    return;
  }

  db.prepare(
    'UPDATE profiles SET full_name = ?, phone = ?, city = ?, updated_at = ? WHERE id = ?'
  ).run(fullName, phone, city, new Date().toISOString(), req.auth!.userId);

  res.json({ user: getUserById(req.auth!.userId) });
});

apiRouter.get('/customer/preferences', requireAuth, (req: AuthedRequest, res: Response) => {
  const row = db
    .prepare('SELECT * FROM customer_preferences WHERE user_id = ?')
    .get(req.auth!.userId) as Record<string, unknown> | undefined;

  if (!row) {
    res.json({
      preferences: {
        preferred_location: 'All',
        property_type: 'All',
        listing_type: 'Buy',
        min_budget: null,
        max_budget: null,
        min_bedrooms: null,
        notes: '',
        notify_matches: true,
      },
    });
    return;
  }

  res.json({
    preferences: {
      ...row,
      notify_matches: Boolean(row.notify_matches),
    },
  });
});

apiRouter.put('/customer/preferences', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.auth!.userId;
  const preferredLocation = sanitizeText(req.body?.preferred_location || 'All', 80);
  const propertyType = sanitizeText(req.body?.property_type || 'All', 80);
  const listingType = ['Buy', 'Rent', 'Both'].includes(req.body?.listing_type)
    ? req.body.listing_type
    : 'Buy';
  const minBudget =
    req.body?.min_budget !== null &&
    req.body?.min_budget !== '' &&
    Number.isFinite(Number(req.body?.min_budget))
      ? Number(req.body.min_budget)
      : null;
  const maxBudget =
    req.body?.max_budget !== null &&
    req.body?.max_budget !== '' &&
    Number.isFinite(Number(req.body?.max_budget))
      ? Number(req.body.max_budget)
      : null;
  const minBedrooms =
    req.body?.min_bedrooms !== null &&
    req.body?.min_bedrooms !== '' &&
    Number.isFinite(Number(req.body?.min_bedrooms))
      ? Number(req.body.min_bedrooms)
      : null;
  const notes = sanitizeText(req.body?.notes || '', 500);
  const notifyMatches = req.body?.notify_matches === false ? 0 : 1;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO customer_preferences
     (user_id, preferred_location, property_type, listing_type, min_budget, max_budget, min_bedrooms, notes, notify_matches, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       preferred_location = excluded.preferred_location,
       property_type = excluded.property_type,
       listing_type = excluded.listing_type,
       min_budget = excluded.min_budget,
       max_budget = excluded.max_budget,
       min_bedrooms = excluded.min_bedrooms,
       notes = excluded.notes,
       notify_matches = excluded.notify_matches,
       updated_at = excluded.updated_at`
  ).run(
    userId,
    preferredLocation,
    propertyType,
    listingType,
    minBudget,
    maxBudget,
    minBedrooms,
    notes,
    notifyMatches,
    now
  );

  res.json({
    preferences: {
      user_id: userId,
      preferred_location: preferredLocation,
      property_type: propertyType,
      listing_type: listingType,
      min_budget: minBudget,
      max_budget: maxBudget,
      min_bedrooms: minBedrooms,
      notes,
      notify_matches: Boolean(notifyMatches),
      updated_at: now,
    },
  });
});

apiRouter.get('/customer/recommendations', optionalAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM properties WHERE is_published = 1')
    .all() as Record<string, unknown>[];
  const properties = hydrateProperties(rows);

  let prefs: CustomerPreferences | null = null;
  if (req.auth) {
    const prefRow = db
      .prepare('SELECT * FROM customer_preferences WHERE user_id = ?')
      .get(req.auth.userId) as Record<string, unknown> | undefined;
    if (prefRow) {
      prefs = {
        user_id: String(prefRow.user_id),
        preferred_location: String(prefRow.preferred_location),
        property_type: String(prefRow.property_type),
        listing_type: prefRow.listing_type as CustomerPreferences['listing_type'],
        min_budget: prefRow.min_budget !== null ? Number(prefRow.min_budget) : null,
        max_budget: prefRow.max_budget !== null ? Number(prefRow.max_budget) : null,
        min_bedrooms:
          prefRow.min_bedrooms !== null ? Number(prefRow.min_bedrooms) : null,
        notes: String(prefRow.notes || ''),
        notify_matches: Boolean(prefRow.notify_matches),
      };
    }
  }

  const recommendations = computeRecommendations(properties, prefs, 6);
  res.json({ recommendations, personalized: Boolean(prefs) });
});

apiRouter.get('/customer/favorites', requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT p.* FROM properties p
       JOIN favorites f ON f.property_id = p.id
       WHERE f.user_id = ? AND p.is_published = 1
       ORDER BY f.created_at DESC`
    )
    .all(req.auth!.userId) as Record<string, unknown>[];
  const properties = hydrateProperties(rows);
  res.json({
    favorites: properties,
    favoriteIds: properties.map((p) => p.id),
  });
});

apiRouter.post(
  '/customer/favorites/:propertyId',
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    const prop = db
      .prepare('SELECT id FROM properties WHERE id = ? AND is_published = 1')
      .get(req.params.propertyId);
    if (!prop) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }

    db.prepare(
      `INSERT OR IGNORE INTO favorites (id, user_id, property_id, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      req.auth!.userId,
      req.params.propertyId,
      new Date().toISOString()
    );
    res.status(201).json({ ok: true });
  }
);

apiRouter.delete(
  '/customer/favorites/:propertyId',
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND property_id = ?').run(
      req.auth!.userId,
      req.params.propertyId
    );
    res.json({ ok: true });
  }
);

apiRouter.get(
  '/customer/saved-searches',
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT * FROM saved_searches
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(req.auth!.userId) as Record<string, unknown>[];
    res.json({
      savedSearches: rows.map((row) => ({
        id: String(row.id),
        user_id: String(row.user_id),
        name: String(row.name),
        query: String(row.query || ''),
        listing_type: ['Buy', 'Rent'].includes(String(row.listing_type))
          ? row.listing_type
          : 'All',
        property_type: String(row.property_type || 'All'),
        location: String(row.location || 'All'),
        min_price: row.min_price !== null ? Number(row.min_price) : null,
        max_price: row.max_price !== null ? Number(row.max_price) : null,
        min_bedrooms: row.min_bedrooms !== null ? Number(row.min_bedrooms) : null,
        furnishing: String(row.furnishing || 'All'),
        sort_by: ['price_asc', 'price_desc'].includes(String(row.sort_by))
          ? row.sort_by
          : 'newest',
        created_at: String(row.created_at),
      })),
    });
  }
);

apiRouter.post(
  '/customer/saved-searches',
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    const userId = req.auth!.userId;
    const query = sanitizeText(req.body?.query || '', 120);
    const listingType = ['Buy', 'Rent'].includes(req.body?.listing_type)
      ? req.body.listing_type
      : 'All';
    const propertyType = sanitizeText(req.body?.property_type || 'All', 80) || 'All';
    const location = sanitizeText(req.body?.location || 'All', 80) || 'All';
    const minPrice =
      req.body?.min_price !== null &&
      req.body?.min_price !== '' &&
      req.body?.min_price !== undefined &&
      Number.isFinite(Number(req.body.min_price))
        ? Math.max(0, Math.round(Number(req.body.min_price)))
        : null;
    const maxPrice =
      req.body?.max_price !== null &&
      req.body?.max_price !== '' &&
      req.body?.max_price !== undefined &&
      Number.isFinite(Number(req.body.max_price))
        ? Math.max(0, Math.round(Number(req.body.max_price)))
        : null;
    const minBedrooms =
      req.body?.min_bedrooms !== null &&
      req.body?.min_bedrooms !== '' &&
      req.body?.min_bedrooms !== undefined &&
      Number.isFinite(Number(req.body.min_bedrooms))
        ? Math.max(1, Math.round(Number(req.body.min_bedrooms)))
        : null;
    const furnishing = sanitizeText(req.body?.furnishing || 'All', 60) || 'All';
    const sortBy = ['price_asc', 'price_desc'].includes(req.body?.sort_by)
      ? req.body.sort_by
      : 'newest';
    const name =
      sanitizeText(req.body?.name || '', 160) || 'Saved Siliguri search';
    const now = new Date().toISOString();

    const existing = db
      .prepare(
        `SELECT id FROM saved_searches
         WHERE user_id = ?
           AND query = ?
           AND listing_type = ?
           AND property_type = ?
           AND location = ?
           AND (min_price IS ? OR min_price = ?)
           AND (max_price IS ? OR max_price = ?)
           AND (min_bedrooms IS ? OR min_bedrooms = ?)
           AND furnishing = ?
           AND sort_by = ?`
      )
      .get(
        userId,
        query,
        listingType,
        propertyType,
        location,
        minPrice,
        minPrice,
        maxPrice,
        maxPrice,
        minBedrooms,
        minBedrooms,
        furnishing,
        sortBy
      ) as { id: string } | undefined;

    if (existing) {
      db.prepare('UPDATE saved_searches SET created_at = ?, name = ? WHERE id = ?').run(
        now,
        name,
        existing.id
      );
      const updated = db
        .prepare('SELECT * FROM saved_searches WHERE id = ?')
        .get(existing.id) as Record<string, unknown>;
      res.status(200).json({ savedSearch: updated, duplicate: true });
      return;
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO saved_searches
       (id, user_id, name, query, listing_type, property_type, location, min_price, max_price, min_bedrooms, furnishing, sort_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      name,
      query,
      listingType,
      propertyType,
      location,
      minPrice,
      maxPrice,
      minBedrooms,
      furnishing,
      sortBy,
      now
    );

    const created = db
      .prepare('SELECT * FROM saved_searches WHERE id = ?')
      .get(id) as Record<string, unknown>;
    res.status(201).json({ savedSearch: created });
  }
);

apiRouter.delete(
  '/customer/saved-searches/:id',
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM saved_searches WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.auth!.userId
    );
    res.json({ ok: true });
  }
);

apiRouter.get('/customer/inquiries', requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT i.*, p.title as property_title
       FROM inquiries i
       LEFT JOIN properties p ON p.id = i.property_id
       WHERE i.user_id = ?
       ORDER BY i.created_at DESC`
    )
    .all(req.auth!.userId);
  res.json({ inquiries: rows });
});

apiRouter.get('/customer/appointments', requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT a.*, p.title as property_title, p.slug as property_slug
       FROM appointments a
       JOIN properties p ON p.id = a.property_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC`
    )
    .all(req.auth!.userId);
  res.json({ appointments: rows });
});

apiRouter.get(
  '/customer/booking-requests',
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT b.*, p.title as property_title, p.slug as property_slug
         FROM booking_requests b
         JOIN properties p ON p.id = b.property_id
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC`
      )
      .all(req.auth!.userId);
    res.json({ bookingRequests: rows });
  }
);

apiRouter.get('/customer/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    )
    .all(req.auth!.userId) as Record<string, unknown>[];
  res.json({
    notifications: rows.map((n) => ({ ...n, is_read: Boolean(n.is_read) })),
  });
});

apiRouter.patch(
  '/customer/notifications/:id/read',
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.auth!.userId);
    res.json({ ok: true });
  }
);

apiRouter.patch(
  '/customer/notifications/read-all',
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(
      req.auth!.userId
    );
    res.json({ ok: true });
  }
);

// ---------- PUBLIC & CUSTOMER SUBMISSIONS ----------

apiRouter.post('/inquiries', optionalAuth, (req: AuthedRequest, res: Response) => {
  const payload = {
    name: sanitizeText(req.body?.name, 120),
    phone: sanitizeText(req.body?.phone, 30),
    email: sanitizeText(req.body?.email || '', 160),
    interested_in: sanitizeText(req.body?.interested_in, 120),
    message: sanitizeText(req.body?.message, 2000),
    property_id: req.body?.property_id ? String(req.body.property_id) : null,
  };

  const err = validateInquiryInput(payload);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO inquiries (id, user_id, property_id, name, phone, email, interested_in, message, status, owner_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Request Submitted', '', ?, ?)`
  ).run(
    id,
    req.auth?.userId || null,
    payload.property_id,
    payload.name,
    payload.phone,
    payload.email,
    payload.interested_in,
    payload.message,
    now,
    now
  );

  if (req.auth?.userId) {
    createNotification({
      user_id: req.auth.userId,
      title: 'Inquiry Received',
      message: `Your inquiry regarding "${payload.interested_in}" has been received by Debmalya Realty.`,
      type: 'inquiry',
      link_url: '/my-account',
    });
  }

  for (const ownerId of getOwnerUserIds()) {
    createNotification({
      user_id: ownerId,
      title: 'New Customer Inquiry',
      message: `${payload.name} (${payload.phone}) enquired about ${payload.interested_in}.`,
      type: 'inquiry',
      link_url: '/owner-login/dashboard',
    });
  }

  res.status(201).json({
    id,
    status: 'Request Submitted',
    message: 'Your inquiry has been submitted. Our team will reach out shortly.',
  });
});

apiRouter.post('/appointments', optionalAuth, (req: AuthedRequest, res: Response) => {
  const payload = {
    customer_name: sanitizeText(req.body?.customer_name, 120),
    phone: sanitizeText(req.body?.phone, 30),
    email: sanitizeText(req.body?.email, 160),
    property_id: sanitizeText(req.body?.property_id, 100),
    preferred_date: sanitizeText(req.body?.preferred_date, 30),
    preferred_time: sanitizeText(req.body?.preferred_time, 40),
    message: sanitizeText(req.body?.message || '', 1200),
  };

  const err = validateAppointmentInput(payload);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }

  const prop = db
    .prepare('SELECT id, title, status FROM properties WHERE id = ? AND is_published = 1')
    .get(payload.property_id) as
    | { id: string; title: string; status: Property['status'] }
    | undefined;

  if (!prop) {
    res.status(404).json({ error: 'Selected property is not available.' });
    return;
  }

  if (!isPropertyActiveOpportunity(prop.status)) {
    res.status(400).json({
      error: `Site visits cannot be scheduled because this property is currently marked as ${prop.status}.`,
    });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO appointments (id, user_id, property_id, customer_name, phone, email, preferred_date, preferred_time, message, status, owner_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '', ?, ?)`
  ).run(
    id,
    req.auth?.userId || null,
    payload.property_id,
    payload.customer_name,
    payload.phone,
    payload.email,
    payload.preferred_date,
    payload.preferred_time,
    payload.message,
    now,
    now
  );

  if (req.auth?.userId) {
    createNotification({
      user_id: req.auth.userId,
      title: 'Site Visit Request Submitted',
      message: `Your site visit request for ${prop.title} on ${payload.preferred_date} at ${payload.preferred_time} is pending owner confirmation.`,
      type: 'appointment',
      link_url: '/my-account',
    });
  }

  for (const ownerId of getOwnerUserIds()) {
    createNotification({
      user_id: ownerId,
      title: 'New Site Visit Request',
      message: `${payload.customer_name} requested a visit for ${prop.title} on ${payload.preferred_date}.`,
      type: 'appointment',
      link_url: '/owner-login/dashboard',
    });
  }

  res.status(201).json({
    id,
    status: 'Pending',
    message:
      'Your site visit request has been submitted and awaits confirmation from Debmalya Realty.',
  });
});

apiRouter.post('/booking-requests', requireAuth, (req: AuthedRequest, res: Response) => {
  const propertyId = sanitizeText(req.body?.property_id, 100);
  const customerName = sanitizeText(req.body?.customer_name, 120);
  const phone = sanitizeText(req.body?.phone, 30);
  const email = sanitizeText(req.body?.email, 160);
  const offerNotes = sanitizeText(req.body?.offer_notes || '', 1500);

  if (!propertyId || customerName.length < 2 || !isValidPhone(phone) || !isValidEmail(email)) {
    res.status(400).json({
      error: 'Please enter a valid name, phone number, email, and property selection.',
    });
    return;
  }

  const prop = db
    .prepare('SELECT id, title, status FROM properties WHERE id = ? AND is_published = 1')
    .get(propertyId) as
    | { id: string; title: string; status: Property['status'] }
    | undefined;

  if (!prop || !isPropertyActiveOpportunity(prop.status)) {
    res.status(400).json({
      error: 'This property is not open for booking requests.',
    });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO booking_requests (id, user_id, property_id, customer_name, phone, email, offer_notes, status, owner_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review', '', ?, ?)`
  ).run(
    id,
    req.auth!.userId,
    propertyId,
    customerName,
    phone,
    email,
    offerNotes,
    now,
    now
  );

  createNotification({
    user_id: req.auth!.userId,
    title: 'Booking Request Submitted for Review',
    message: `Your expression of interest for ${prop.title} is pending owner review. Submitting a request does not guarantee reservation until confirmed by Debmalya Realty.`,
    type: 'booking',
    link_url: '/my-account',
  });

  for (const ownerId of getOwnerUserIds()) {
    createNotification({
      user_id: ownerId,
      title: 'New Property Booking Request',
      message: `${customerName} submitted a booking request for ${prop.title}.`,
      type: 'booking',
      link_url: '/owner-login/dashboard',
    });
  }

  res.status(201).json({
    id,
    status: 'Pending Review',
    message:
      'Booking request submitted for owner review. Our team will confirm next steps directly with you.',
  });
});

apiRouter.post('/reviews', optionalAuth, (req: AuthedRequest, res: Response) => {
  const payload = {
    reviewer_name: sanitizeText(req.body?.reviewer_name, 100),
    reviewer_email: sanitizeText(req.body?.reviewer_email || '', 160),
    customer_type: sanitizeText(req.body?.customer_type || 'Property Client', 60),
    rating: Number(req.body?.rating),
    review_text: sanitizeText(req.body?.review_text, 1500),
  };

  const err = validateReviewInput(payload);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  db.prepare(
    `INSERT INTO reviews (id, user_id, reviewer_name, reviewer_email, customer_type, rating, review_text, source, source_label, avatar_url, status, is_featured, review_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'direct', 'Submitted via Website', '', 'pending', 0, ?, ?)`
  ).run(
    id,
    req.auth?.userId || null,
    payload.reviewer_name,
    payload.reviewer_email,
    payload.customer_type,
    payload.rating,
    payload.review_text,
    today,
    now
  );

  for (const ownerId of getOwnerUserIds()) {
    createNotification({
      user_id: ownerId,
      title: 'New Client Review Pending Moderation',
      message: `${payload.reviewer_name} submitted a ${payload.rating}-star review awaiting your approval.`,
      type: 'system',
      link_url: '/owner-login/dashboard',
    });
  }

  res.status(201).json({
    id,
    status: 'pending',
    message:
      'Thank you! Your review has been submitted and will appear publicly once approved by Debmalya Realty.',
  });
});

// ---------- OWNER PRIVILEGED ENDPOINTS ----------

apiRouter.get('/owner/overview', requireOwner, (_req: AuthedRequest, res: Response) => {
  const propStats = db
    .prepare(
      `SELECT
         COUNT(*) as total_properties,
         SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as available_properties,
         SUM(CASE WHEN status = 'Sold' THEN 1 ELSE 0 END) as sold_properties,
         SUM(CASE WHEN status = 'Rented' THEN 1 ELSE 0 END) as rented_properties
       FROM properties`
    )
    .get() as Record<string, number>;

  const inqStats = db
    .prepare(
      `SELECT
         COUNT(*) as total_inquiries,
         SUM(CASE WHEN status != 'Completed' THEN 1 ELSE 0 END) as pending_inquiries
       FROM inquiries`
    )
    .get() as Record<string, number>;

  const apptStats = db
    .prepare(
      `SELECT
         COUNT(*) as site_visit_requests,
         SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_site_visits
       FROM appointments`
    )
    .get() as Record<string, number>;

  const bookingCount = (
    db.prepare('SELECT COUNT(*) as c FROM booking_requests').get() as { c: number }
  ).c;
  const customerCount = (
    db
      .prepare("SELECT COUNT(*) as c FROM user_roles WHERE role = 'customer'")
      .get() as { c: number }
  ).c;
  const pendingReviewCount = (
    db
      .prepare("SELECT COUNT(*) as c FROM reviews WHERE status = 'pending'")
      .get() as { c: number }
  ).c;

  res.json({
    stats: {
      total_properties: propStats.total_properties || 0,
      available_properties: propStats.available_properties || 0,
      sold_properties: propStats.sold_properties || 0,
      rented_properties: propStats.rented_properties || 0,
      total_inquiries: inqStats.total_inquiries || 0,
      pending_inquiries: inqStats.pending_inquiries || 0,
      site_visit_requests: apptStats.site_visit_requests || 0,
      pending_site_visits: apptStats.pending_site_visits || 0,
      booking_requests: bookingCount,
      customer_accounts: customerCount,
      pending_reviews: pendingReviewCount,
    },
  });
});

apiRouter.post('/owner/upload', requireOwner, (req: AuthedRequest, res: Response) => {
  const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    res.status(400).json({
      error: 'Invalid image format. Only JPEG, PNG, and WebP images are permitted.',
    });
    return;
  }

  const mime = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.byteLength > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'Image size must be 5 MB or less.' });
    return;
  }

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const fullPath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(fullPath, buffer);

  res.status(201).json({ url: `/uploads/${filename}` });
});

apiRouter.get('/owner/properties', requireOwner, (_req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM properties ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  res.json({ properties: hydrateProperties(rows) });
});

function notifyMatchingCustomersForProperty(property: Property): void {
  if (!property.is_published || !isPropertyActiveOpportunity(property.status)) {
    return;
  }
  const prefsRows = db
    .prepare('SELECT * FROM customer_preferences WHERE notify_matches = 1')
    .all() as Record<string, unknown>[];

  for (const row of prefsRows) {
    const prefs: CustomerPreferences = {
      user_id: String(row.user_id),
      preferred_location: String(row.preferred_location),
      property_type: String(row.property_type),
      listing_type: row.listing_type as CustomerPreferences['listing_type'],
      min_budget: row.min_budget !== null ? Number(row.min_budget) : null,
      max_budget: row.max_budget !== null ? Number(row.max_budget) : null,
      min_bedrooms: row.min_bedrooms !== null ? Number(row.min_bedrooms) : null,
      notes: String(row.notes || ''),
      notify_matches: true,
    };
    if (doesPropertyMatchPreferences(property, prefs)) {
      createNotification({
        user_id: String(row.user_id),
        title: 'New Matching Property Published',
        message: `"${property.title}" in ${property.location} matches your saved preferences.`,
        type: 'property_match',
        link_url: `/properties/${property.slug}`,
      });
    }
  }
}

apiRouter.post('/owner/properties', requireOwner, (req: AuthedRequest, res: Response) => {
  const title = sanitizeText(req.body?.title, 180);
  const description = sanitizeText(req.body?.description, 4000);
  const priceInr = Number(req.body?.price_inr);
  const listingType = req.body?.listing_type === 'Rent' ? 'Rent' : 'Buy';
  const propertyType = sanitizeText(req.body?.property_type || 'Flats / Apartments', 80);
  const location = sanitizeText(req.body?.location || 'Siliguri', 100);
  const addressDetail = sanitizeText(req.body?.address_detail || '', 300);
  const bedrooms = Math.max(0, Number(req.body?.bedrooms || 0));
  const bathrooms = Math.max(0, Number(req.body?.bathrooms || 0));
  const areaSqft = Math.max(0, Number(req.body?.area_sqft || 0));
  const furnishing = sanitizeText(req.body?.furnishing || 'Unfurnished', 50);
  const parking = sanitizeText(req.body?.parking || '', 120);
  const status = [
    'Available',
    'Sold',
    'Rented',
    'Under Construction',
    'Upcoming',
  ].includes(req.body?.status)
    ? req.body.status
    : 'Available';
  const isPublished = req.body?.is_published ? 1 : 0;
  const isFeatured = req.body?.is_featured ? 1 : 0;
  const isDemo = req.body?.is_demo ? 1 : 0;
  const amenities: string[] = Array.isArray(req.body?.amenities)
    ? req.body.amenities.map((a: unknown) => sanitizeText(a, 80)).filter(Boolean)
    : [];
  const images: string[] = Array.isArray(req.body?.images)
    ? req.body.images
        .map((u: unknown) => (typeof u === 'string' ? u.trim() : ''))
        .filter(Boolean)
    : [];

  if (title.length < 3 || description.length < 10 || !Number.isFinite(priceInr) || priceInr < 0) {
    res.status(400).json({
      error: 'Please provide a valid title, description, and price in INR.',
    });
    return;
  }

  const id = crypto.randomUUID();
  const baseSlug = slugify(title) || `property-${id.slice(0, 6)}`;
  const slug = `${baseSlug}-${id.slice(0, 4)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO properties (
       id, slug, title, description, price_inr, listing_type, property_type,
       location, address_detail, latitude, longitude, bedrooms, bathrooms,
       area_sqft, furnishing, parking, status, is_published, is_featured, is_demo,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    slug,
    title,
    description,
    Math.round(priceInr),
    listingType,
    propertyType,
    location,
    addressDetail,
    req.body?.latitude ?? null,
    req.body?.longitude ?? null,
    bedrooms,
    bathrooms,
    areaSqft,
    furnishing,
    parking,
    status,
    isPublished,
    isFeatured,
    isDemo,
    now,
    now
  );

  const imgStmt = db.prepare(
    'INSERT INTO property_images (id, property_id, url, caption, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  images.forEach((url, idx) => {
    imgStmt.run(crypto.randomUUID(), id, url, title, idx);
  });

  const amenStmt = db.prepare(
    'INSERT INTO property_amenities (id, property_id, amenity) VALUES (?, ?, ?)'
  );
  amenities.forEach((amenity) => {
    amenStmt.run(crypto.randomUUID(), id, amenity);
  });

  const row = db
    .prepare('SELECT * FROM properties WHERE id = ?')
    .get(id) as Record<string, unknown>;
  const [created] = hydrateProperties([row]);

  notifyMatchingCustomersForProperty(created);
  res.status(201).json({ property: created });
});

apiRouter.patch(
  '/owner/properties/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM properties WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }

    const wasPublished = Boolean(existing.is_published);
    const title = sanitizeText(req.body?.title ?? existing.title, 180);
    const description = sanitizeText(
      req.body?.description ?? existing.description,
      4000
    );
    const priceInr =
      req.body?.price_inr !== undefined
        ? Math.max(0, Math.round(Number(req.body.price_inr)))
        : Number(existing.price_inr);
    const listingType =
      req.body?.listing_type === 'Rent'
        ? 'Rent'
        : req.body?.listing_type === 'Buy'
        ? 'Buy'
        : String(existing.listing_type);
    const propertyType = sanitizeText(
      req.body?.property_type ?? existing.property_type,
      80
    );
    const location = sanitizeText(req.body?.location ?? existing.location, 100);
    const addressDetail = sanitizeText(
      req.body?.address_detail ?? existing.address_detail,
      300
    );
    const bedrooms =
      req.body?.bedrooms !== undefined
        ? Math.max(0, Number(req.body.bedrooms))
        : Number(existing.bedrooms);
    const bathrooms =
      req.body?.bathrooms !== undefined
        ? Math.max(0, Number(req.body.bathrooms))
        : Number(existing.bathrooms);
    const areaSqft =
      req.body?.area_sqft !== undefined
        ? Math.max(0, Number(req.body.area_sqft))
        : Number(existing.area_sqft);
    const furnishing = sanitizeText(
      req.body?.furnishing ?? existing.furnishing,
      50
    );
    const parking = sanitizeText(req.body?.parking ?? existing.parking, 120);
    const status = [
      'Available',
      'Sold',
      'Rented',
      'Under Construction',
      'Upcoming',
    ].includes(req.body?.status)
      ? String(req.body.status)
      : String(existing.status);
    const isPublished =
      req.body?.is_published !== undefined
        ? req.body.is_published
          ? 1
          : 0
        : Number(existing.is_published);
    const isFeatured =
      req.body?.is_featured !== undefined
        ? req.body.is_featured
          ? 1
          : 0
        : Number(existing.is_featured);
    const isDemo =
      req.body?.is_demo !== undefined
        ? req.body.is_demo
          ? 1
          : 0
        : Number(existing.is_demo);

    db.prepare(
      `UPDATE properties SET
         title = ?, description = ?, price_inr = ?, listing_type = ?, property_type = ?,
         location = ?, address_detail = ?, bedrooms = ?, bathrooms = ?, area_sqft = ?,
         furnishing = ?, parking = ?, status = ?, is_published = ?, is_featured = ?,
         is_demo = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      title,
      description,
      priceInr,
      listingType,
      propertyType,
      location,
      addressDetail,
      bedrooms,
      bathrooms,
      areaSqft,
      furnishing,
      parking,
      status,
      isPublished,
      isFeatured,
      isDemo,
      new Date().toISOString(),
      req.params.id
    );

    if (Array.isArray(req.body?.images)) {
      db.prepare('DELETE FROM property_images WHERE property_id = ?').run(
        req.params.id
      );
      const imgStmt = db.prepare(
        'INSERT INTO property_images (id, property_id, url, caption, sort_order) VALUES (?, ?, ?, ?, ?)'
      );
      req.body.images
        .map((u: unknown) => (typeof u === 'string' ? u.trim() : ''))
        .filter(Boolean)
        .forEach((url: string, idx: number) => {
          imgStmt.run(crypto.randomUUID(), req.params.id, url, title, idx);
        });
    }

    if (Array.isArray(req.body?.amenities)) {
      db.prepare('DELETE FROM property_amenities WHERE property_id = ?').run(
        req.params.id
      );
      const amenStmt = db.prepare(
        'INSERT INTO property_amenities (id, property_id, amenity) VALUES (?, ?, ?)'
      );
      req.body.amenities
        .map((a: unknown) => sanitizeText(a, 80))
        .filter(Boolean)
        .forEach((amenity: string) => {
          amenStmt.run(crypto.randomUUID(), req.params.id, amenity);
        });
    }

    const updatedRow = db
      .prepare('SELECT * FROM properties WHERE id = ?')
      .get(req.params.id) as Record<string, unknown>;
    const [updated] = hydrateProperties([updatedRow]);

    if (!wasPublished && updated.is_published) {
      notifyMatchingCustomersForProperty(updated);
    }

    res.json({ property: updated });
  }
);

apiRouter.delete(
  '/owner/properties/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  }
);

apiRouter.get('/owner/customers', requireOwner, (_req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.email, p.full_name, p.phone, p.city, p.created_at,
              cp.preferred_location, cp.property_type as preferred_type, cp.listing_type as preferred_listing,
              cp.min_budget, cp.max_budget,
              (SELECT COUNT(*) FROM inquiries i WHERE i.user_id = p.id) as inquiry_count,
              (SELECT COUNT(*) FROM appointments a WHERE a.user_id = p.id) as appointment_count,
              (SELECT COUNT(*) FROM booking_requests b WHERE b.user_id = p.id) as booking_count
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id
       LEFT JOIN customer_preferences cp ON cp.user_id = p.id
       WHERE ur.role = 'customer'
       ORDER BY p.created_at DESC`
    )
    .all();
  res.json({ customers: rows });
});

apiRouter.get('/owner/inquiries', requireOwner, (_req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT i.*, p.title as property_title
       FROM inquiries i
       LEFT JOIN properties p ON p.id = i.property_id
       ORDER BY i.created_at DESC`
    )
    .all();
  res.json({ inquiries: rows });
});

apiRouter.patch(
  '/owner/inquiries/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM inquiries WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Inquiry not found.' });
      return;
    }

    const validStatuses = [
      'Request Submitted',
      'Under Review',
      'Contacted',
      'Appointment Scheduled',
      'Completed',
    ];
    const status = validStatuses.includes(req.body?.status)
      ? req.body.status
      : existing.status;
    const ownerNotes = sanitizeText(
      req.body?.owner_notes ?? existing.owner_notes,
      1000
    );

    db.prepare(
      'UPDATE inquiries SET status = ?, owner_notes = ?, updated_at = ? WHERE id = ?'
    ).run(status, ownerNotes, new Date().toISOString(), req.params.id);

    if (existing.user_id && status !== existing.status) {
      createNotification({
        user_id: String(existing.user_id),
        title: `Inquiry Status: ${status}`,
        message: `Your inquiry (${existing.interested_in}) has been updated to "${status}".`,
        type: 'inquiry',
        link_url: '/my-account',
      });
    }

    res.json({ ok: true });
  }
);

apiRouter.get(
  '/owner/appointments',
  requireOwner,
  (_req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT a.*, p.title as property_title, p.slug as property_slug
         FROM appointments a
         JOIN properties p ON p.id = a.property_id
         ORDER BY a.created_at DESC`
      )
      .all();
    res.json({ appointments: rows });
  }
);

apiRouter.patch(
  '/owner/appointments/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    const existing = db
      .prepare(
        `SELECT a.*, p.title as property_title
         FROM appointments a
         JOIN properties p ON p.id = a.property_id
         WHERE a.id = ?`
      )
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const validStatuses = [
      'Pending',
      'Approved',
      'Rescheduled',
      'Rejected',
      'Completed',
    ];
    const status = validStatuses.includes(req.body?.status)
      ? req.body.status
      : existing.status;
    const proposedDate =
      req.body?.proposed_date !== undefined
        ? sanitizeText(req.body.proposed_date, 30) || null
        : (existing.proposed_date as string | null);
    const proposedTime =
      req.body?.proposed_time !== undefined
        ? sanitizeText(req.body.proposed_time, 40) || null
        : (existing.proposed_time as string | null);
    const ownerNote = sanitizeText(
      req.body?.owner_note ?? existing.owner_note,
      1000
    );

    db.prepare(
      `UPDATE appointments
       SET status = ?, proposed_date = ?, proposed_time = ?, owner_note = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      status,
      proposedDate,
      proposedTime,
      ownerNote,
      new Date().toISOString(),
      req.params.id
    );

    if (existing.user_id) {
      const detail =
        status === 'Rescheduled' && proposedDate
          ? `Suggested new slot: ${proposedDate} at ${proposedTime || 'flexible time'}.`
          : ownerNote || `Status updated to ${status}.`;
      createNotification({
        user_id: String(existing.user_id),
        title: `Site Visit ${status}`,
        message: `${existing.property_title}: ${detail}`,
        type: 'appointment',
        link_url: '/my-account',
      });
    }

    res.json({ ok: true });
  }
);

apiRouter.get(
  '/owner/booking-requests',
  requireOwner,
  (_req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT b.*, p.title as property_title, p.slug as property_slug
         FROM booking_requests b
         JOIN properties p ON p.id = b.property_id
         ORDER BY b.created_at DESC`
      )
      .all();
    res.json({ bookingRequests: rows });
  }
);

apiRouter.patch(
  '/owner/booking-requests/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    const existing = db
      .prepare(
        `SELECT b.*, p.title as property_title
         FROM booking_requests b
         JOIN properties p ON p.id = b.property_id
         WHERE b.id = ?`
      )
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Booking request not found.' });
      return;
    }

    const validStatuses = [
      'Pending Review',
      'Under Discussion',
      'Confirmed Next Step',
      'Declined',
    ];
    const status = validStatuses.includes(req.body?.status)
      ? req.body.status
      : existing.status;
    const ownerNote = sanitizeText(
      req.body?.owner_note ?? existing.owner_note,
      1000
    );

    db.prepare(
      'UPDATE booking_requests SET status = ?, owner_note = ?, updated_at = ? WHERE id = ?'
    ).run(status, ownerNote, new Date().toISOString(), req.params.id);

    if (existing.user_id) {
      createNotification({
        user_id: String(existing.user_id),
        title: `Booking Request: ${status}`,
        message: `${existing.property_title}: ${ownerNote || `Status updated to ${status}.`}`,
        type: 'booking',
        link_url: '/my-account',
      });
    }

    res.json({ ok: true });
  }
);

apiRouter.get('/owner/reviews', requireOwner, (_req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM reviews ORDER BY created_at DESC')
    .all();
  res.json({ reviews: rows });
});

apiRouter.post('/owner/reviews', requireOwner, (req: AuthedRequest, res: Response) => {
  const reviewerName = sanitizeText(req.body?.reviewer_name, 100);
  const customerType = sanitizeText(req.body?.customer_type || 'Client', 60);
  const rating = Math.min(5, Math.max(1, Number(req.body?.rating || 5)));
  const reviewText = sanitizeText(req.body?.review_text, 1500);
  const sourceLabel = sanitizeText(
    req.body?.source_label || 'Verified Client Feedback',
    100
  );
  const reviewDate = sanitizeText(
    req.body?.review_date || new Date().toISOString().slice(0, 10),
    20
  );

  if (reviewerName.length < 2 || reviewText.length < 10) {
    res.status(400).json({ error: 'Reviewer name and review text are required.' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO reviews (id, user_id, reviewer_name, reviewer_email, customer_type, rating, review_text, source, source_label, avatar_url, status, is_featured, review_date, created_at)
     VALUES (?, NULL, ?, '', ?, ?, ?, 'imported', ?, '', 'approved', ?, ?, ?)`
  ).run(
    id,
    reviewerName,
    customerType,
    rating,
    reviewText,
    sourceLabel,
    req.body?.is_featured ? 1 : 0,
    reviewDate,
    now
  );

  res.status(201).json({ id });
});

apiRouter.patch(
  '/owner/reviews/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM reviews WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'hidden'];
    const status = validStatuses.includes(req.body?.status)
      ? req.body.status
      : existing.status;
    const reviewerName = sanitizeText(
      req.body?.reviewer_name ?? existing.reviewer_name,
      100
    );
    const customerType = sanitizeText(
      req.body?.customer_type ?? existing.customer_type,
      60
    );
    const reviewText = sanitizeText(
      req.body?.review_text ?? existing.review_text,
      1500
    );
    const isFeatured =
      req.body?.is_featured !== undefined
        ? req.body.is_featured
          ? 1
          : 0
        : Number(existing.is_featured);

    db.prepare(
      `UPDATE reviews SET status = ?, reviewer_name = ?, customer_type = ?, review_text = ?, is_featured = ? WHERE id = ?`
    ).run(status, reviewerName, customerType, reviewText, isFeatured, req.params.id);

    res.json({ ok: true });
  }
);

apiRouter.delete(
  '/owner/reviews/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  }
);

apiRouter.get('/owner/agents', requireOwner, (_req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM agents ORDER BY sort_order ASC, created_at DESC')
    .all();
  res.json({ agents: rows });
});

apiRouter.post('/owner/agents', requireOwner, (req: AuthedRequest, res: Response) => {
  const name = sanitizeText(req.body?.name, 100);
  const position = sanitizeText(req.body?.position, 100);
  const bio = sanitizeText(req.body?.bio || '', 600);
  const phone = sanitizeText(req.body?.phone || '', 30);
  const whatsapp = sanitizeText(req.body?.whatsapp || '', 30);
  const photoUrl = sanitizeText(req.body?.photo_url || '', 300);

  if (name.length < 2 || position.length < 2) {
    res.status(400).json({ error: 'Team member name and position are required.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO agents (id, name, position, bio, phone, whatsapp, photo_url, is_active, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`
  ).run(id, name, position, bio, phone, whatsapp, photoUrl, new Date().toISOString());

  res.status(201).json({ id });
});

apiRouter.patch(
  '/owner/agents/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM agents WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Team member not found.' });
      return;
    }

    db.prepare(
      `UPDATE agents SET name = ?, position = ?, bio = ?, phone = ?, whatsapp = ?, photo_url = ?, is_active = ? WHERE id = ?`
    ).run(
      sanitizeText(req.body?.name ?? existing.name, 100),
      sanitizeText(req.body?.position ?? existing.position, 100),
      sanitizeText(req.body?.bio ?? existing.bio, 600),
      sanitizeText(req.body?.phone ?? existing.phone, 30),
      sanitizeText(req.body?.whatsapp ?? existing.whatsapp, 30),
      sanitizeText(req.body?.photo_url ?? existing.photo_url, 300),
      req.body?.is_active !== undefined
        ? req.body.is_active
          ? 1
          : 0
        : Number(existing.is_active),
      req.params.id
    );

    res.json({ ok: true });
  }
);

apiRouter.delete(
  '/owner/agents/:id',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  }
);

apiRouter.get(
  '/owner/notifications',
  requireOwner,
  (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
      )
      .all(req.auth!.userId) as Record<string, unknown>[];
    res.json({
      notifications: rows.map((n) => ({ ...n, is_read: Boolean(n.is_read) })),
    });
  }
);

apiRouter.put('/owner/settings', requireOwner, (req: AuthedRequest, res: Response) => {
  const current = getWebsiteSettings();
  const incoming = (req.body?.settings || {}) as Partial<WebsiteSettings>;

  const merged: WebsiteSettings = {
    ...current,
    ...incoming,
    operating_hours: {
      ...current.operating_hours,
      ...(incoming.operating_hours || {}),
    },
    social_links: {
      ...current.social_links,
      ...(incoming.social_links || {}),
    },
    locations: Array.isArray(incoming.locations)
      ? incoming.locations.map((l) => sanitizeText(l, 60)).filter(Boolean)
      : current.locations,
    property_types: Array.isArray(incoming.property_types)
      ? incoming.property_types.map((t) => sanitizeText(t, 60)).filter(Boolean)
      : current.property_types,
  };

  db.prepare(
    'UPDATE website_settings SET settings_json = ?, updated_at = ? WHERE id = ?'
  ).run(JSON.stringify(merged), new Date().toISOString(), 'default');

  res.json({ settings: merged });
});
