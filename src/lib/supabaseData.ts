import {
  BACKEND_NOT_CONFIGURED_MESSAGE,
  isSupabaseConfigured,
  supabase,
} from './supabaseClient';
import { DEFAULT_SITE_SETTINGS, DEMO_PROPERTIES } from './demoData';
import {
  CACHE_KEYS,
  clientDashboardCacheKey,
  invalidateDashboardCaches,
  invalidatePublicCaches,
  ownerDashboardCacheKey,
  readCache,
  userPreferencesCacheKey,
  writeCache,
} from './localCache';
import { slugify } from './realtyLogic';
import type {
  Agent,
  Booking,
  BookingStatus,
  CustomerPreferences,
  FurnishingType,
  Inquiry,
  InquiryStatus,
  ListingType,
  OwnerDashboardStats,
  Property,
  PropertyStatus,
  Review,
  ReviewStatus,
  SavedSearch,
  UserProfile,
  UserRole,
  WebsiteSettings,
} from '../types/realty';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(BACKEND_NOT_CONFIGURED_MESSAGE);
  }
  return supabase;
}

class QueryTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = 'QueryTimeoutError';
  }
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = 6500,
  label = 'Supabase query'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new QueryTimeoutError(label)), timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function fromDbListingType(val: string): ListingType {
  return String(val).toLowerCase() === 'rent' ? 'Rent' : 'Buy';
}

function toDbListingType(val: ListingType | string): 'buy' | 'rent' {
  return String(val).toLowerCase() === 'rent' ? 'rent' : 'buy';
}

function fromDbPropertyStatus(val: string): PropertyStatus {
  switch (String(val).toLowerCase()) {
    case 'under construction':
      return 'Under Construction';
    case 'sold':
      return 'Sold';
    case 'rented':
      return 'Rented';
    default:
      return 'Available';
  }
}

function toDbPropertyStatus(
  val: PropertyStatus | string
): 'available' | 'under construction' | 'sold' | 'rented' {
  switch (String(val).toLowerCase()) {
    case 'under construction':
      return 'under construction';
    case 'sold':
      return 'sold';
    case 'rented':
      return 'rented';
    default:
      return 'available';
  }
}

export function mapPropertyRow(row: Record<string, unknown>): Property {
  const id = String(row.id);
  const title = String(row.title || '');
  const rawImages = Array.isArray(row.images) ? row.images : [];
  const rawAmenities = Array.isArray(row.amenities) ? row.amenities : [];

  return {
    id,
    slug: String(row.slug || slugify(title) || id),
    title,
    description: String(row.description || ''),
    price_inr: Number(row.price ?? row.price_inr ?? 0),
    listing_type: fromDbListingType(String(row.listing_type || 'buy')),
    property_type: String(row.category || row.property_type || 'Flats / Apartments'),
    location: String(row.location || 'Siliguri'),
    address_detail: String(row.address_detail || ''),
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    bedrooms: Number(row.bedrooms || 0),
    bathrooms: Number(row.bathrooms || 0),
    area_sqft: Number(row.area_sqft || 0),
    furnishing: (row.furnishing || 'Unfurnished') as FurnishingType,
    parking: String(row.parking || ''),
    status: fromDbPropertyStatus(String(row.status || 'available')),
    is_published: row.is_published !== false,
    is_featured: Boolean(row.is_featured),
    is_demo: false,
    amenities: rawAmenities.map((a) => String(a)).filter(Boolean),
    images: rawImages
      .map((u) => String(u))
      .filter(Boolean)
      .map((url, idx) => ({
        id: `${id}-img-${idx}`,
        property_id: id,
        url,
        caption: title,
        sort_order: idx,
      })),
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

function mapAgentRow(row: Record<string, unknown>): Agent {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    position: String(row.designation || row.position || ''),
    bio: String(row.intro || row.bio || ''),
    phone: String(row.phone || ''),
    whatsapp: String(row.whatsapp || ''),
    photo_url: String(row.photo_url || ''),
    is_active: row.is_visible !== false,
    sort_order: Number(row.sort_order || 0),
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

function mapReviewRow(row: Record<string, unknown>): Review {
  const created = String(row.created_at || new Date().toISOString());
  return {
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : null,
    reviewer_name: String(row.name || row.reviewer_name || ''),
    reviewer_email: String(row.email || row.reviewer_email || ''),
    customer_type: String(row.category || row.customer_type || 'Home Buyer'),
    rating: Number(row.rating || 5),
    review_text: String(row.text || row.review_text || ''),
    status: (row.status || 'pending') as ReviewStatus,
    is_featured: Boolean(row.is_featured),
    review_date: created.slice(0, 10),
    created_at: created,
  };
}

function mapInquiryRow(row: Record<string, unknown>): Inquiry {
  return {
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : null,
    property_id: row.property_id ? String(row.property_id) : null,
    property_title: row.property_title ? String(row.property_title) : null,
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    interested_in: String(row.interest || row.interested_in || ''),
    message: String(row.message || ''),
    status: (row.status || 'new') as InquiryStatus,
    owner_notes: String(row.owner_notes || ''),
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

function mapBookingRow(row: Record<string, unknown>): Booking {
  const propObj = row.properties as Record<string, unknown> | null | undefined;
  return {
    id: String(row.id),
    user_id: String(row.user_id || ''),
    property_id: String(row.property_id || ''),
    property_title: propObj?.title
      ? String(propObj.title)
      : row.property_title
      ? String(row.property_title)
      : 'Selected Siliguri Property',
    property_slug: propObj?.slug ? String(propObj.slug) : undefined,
    customer_name: String(row.customer_name || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    preferred_date: String(row.preferred_date || ''),
    preferred_time: String(row.preferred_time || '11:00 AM'),
    note: String(row.note || ''),
    owner_note: String(row.owner_note || ''),
    status: (row.status || 'pending') as BookingStatus,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

function mapSettingsRow(row: Record<string, unknown> | null): WebsiteSettings {
  if (!row) return DEFAULT_SITE_SETTINGS;
  const hours = (row.hours as Record<string, unknown>) || {};
  const social = (row.social_links as Record<string, string>) || {};
  const rawServiceImages =
    (row.service_images as Record<string, unknown> | undefined) ??
    (hours.service_images as Record<string, unknown> | undefined) ??
    {};
  const service_images: Record<string, string> = {};
  if (rawServiceImages && typeof rawServiceImages === 'object') {
    for (const [k, v] of Object.entries(rawServiceImages)) {
      if (typeof v === 'string' && v.trim()) {
        service_images[k] = v.trim();
      }
    }
  }
  return {
    business_name: String(row.business_name || DEFAULT_SITE_SETTINGS.business_name),
    tagline: String(row.tagline || DEFAULT_SITE_SETTINGS.tagline),
    description: String(row.about_text || DEFAULT_SITE_SETTINGS.description),
    address: String(row.address || DEFAULT_SITE_SETTINGS.address),
    phone: String(row.phone || DEFAULT_SITE_SETTINGS.phone),
    whatsapp: String(row.whatsapp || DEFAULT_SITE_SETTINGS.whatsapp),
    logo_url: String(row.logo_url || ''),
    hero_headline: String(row.hero_headline || DEFAULT_SITE_SETTINGS.hero_headline),
    hero_subheadline: String(
      row.hero_subheadline || DEFAULT_SITE_SETTINGS.hero_subheadline
    ),
    hero_image_url: String(
      row.hero_image_url || DEFAULT_SITE_SETTINGS.hero_image_url
    ),
    about_image_url: String(
      row.about_image_url || DEFAULT_SITE_SETTINGS.about_image_url
    ),
    operating_hours: {
      monday:
        typeof hours.monday === 'string' && hours.monday
          ? hours.monday
          : DEFAULT_SITE_SETTINGS.operating_hours.monday,
      tuesday:
        typeof hours.tuesday === 'string' && hours.tuesday
          ? hours.tuesday
          : DEFAULT_SITE_SETTINGS.operating_hours.tuesday,
      wednesday:
        typeof hours.wednesday === 'string' && hours.wednesday
          ? hours.wednesday
          : DEFAULT_SITE_SETTINGS.operating_hours.wednesday,
      thursday_sunday:
        typeof hours.thursday_sunday === 'string' && hours.thursday_sunday
          ? hours.thursday_sunday
          : DEFAULT_SITE_SETTINGS.operating_hours.thursday_sunday,
    },
    locations: Array.isArray(row.locations) && row.locations.length > 0
      ? row.locations.map(String)
      : DEFAULT_SITE_SETTINGS.locations,
    property_types:
      Array.isArray(row.property_types) && row.property_types.length > 0
        ? row.property_types.map(String)
        : DEFAULT_SITE_SETTINGS.property_types,
    social_links: {
      instagram: social.instagram || '',
      facebook: social.facebook || '',
      youtube: social.youtube || '',
      linkedin: social.linkedin || '',
    },
    google_review_link: String(
      social.google_review || row.google_review_link || ''
    ),
    service_images,
  };
}

// ============================================================================
// AUTH & PROFILE
// ============================================================================

export async function getCurrentSessionProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const authUser = session.user;
  let { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, city, role, created_at')
    .eq('id', authUser.id)
    .maybeSingle();

  // Retry once shortly if auth signup trigger just fired
  if (!profile && !error) {
    await new Promise((r) => setTimeout(r, 350));
    const retry = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, city, role, created_at')
      .eq('id', authUser.id)
      .maybeSingle();
    profile = retry.data;
    error = retry.error;
  }

  if (error || !profile) {
    return null;
  }

  const role: UserRole = profile.role === 'owner' ? 'owner' : 'client';
  return {
    id: String(profile.id),
    email: String(profile.email || authUser.email || ''),
    full_name: String(
      profile.full_name || authUser.user_metadata?.full_name || ''
    ),
    phone: String(profile.phone || authUser.user_metadata?.phone || ''),
    city: String(profile.city || 'Siliguri'),
    role,
    created_at: String(profile.created_at || new Date().toISOString()),
  };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserProfile> {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      throw new Error(
        'Please confirm your email address using the link sent to your inbox before signing in.'
      );
    }
    throw new Error(error.message);
  }
  if (!data.user) {
    throw new Error('Unable to sign in. Please try again.');
  }
  const profile = await getCurrentSessionProfile();
  if (!profile) {
    throw new Error(
      'Your account profile is missing or pending setup. Please contact support.'
    );
  }
  return profile;
}

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  city?: string;
}): Promise<{ profile: UserProfile | null; needsEmailConfirmation: boolean }> {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      emailRedirectTo:
        typeof window !== 'undefined' ? window.location.origin : undefined,
      data: {
        full_name: params.full_name.trim(),
        phone: (params.phone || '').trim(),
        city: (params.city || 'Siliguri').trim() || 'Siliguri',
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  // When Supabase email confirmation is enabled, session is null until verified
  if (!data.session) {
    return { profile: null, needsEmailConfirmation: true };
  }

  const profile = await getCurrentSessionProfile();
  return { profile, needsEmailConfirmation: false };
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo:
        typeof window !== 'undefined'
          ? `${window.location.origin}/?mode=recovery`
          : undefined,
    }
  );
  if (error) throw new Error(error.message);
}

export async function updateOwnPassword(newPassword: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function signOutUser(): Promise<void> {
  invalidateDashboardCaches();
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function updateOwnProfile(
  userId: string,
  payload: { full_name: string; phone: string; city: string }
): Promise<UserProfile> {
  const client = requireClient();
  const { error } = await client
    .from('profiles')
    .update({
      full_name: payload.full_name.trim(),
      phone: payload.phone.trim(),
      city: payload.city.trim() || 'Siliguri',
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);

  invalidateDashboardCaches();
  const refreshed = await getCurrentSessionProfile();
  if (!refreshed) throw new Error('Unable to reload updated profile.');
  return refreshed;
}

// ============================================================================
// PUBLIC READS (Browser TTL cache + resilient timeout & demo fallback)
// ============================================================================

export interface PublicPropertiesLoadResult {
  properties: Property[];
  source: 'live' | 'cache' | 'demo' | 'fallback';
  errorKind?: 'unconfigured' | 'timeout' | 'unreachable';
}

export function getCachedSiteSettings(): WebsiteSettings | null {
  return readCache<WebsiteSettings>(CACHE_KEYS.SITE_SETTINGS)?.value ?? null;
}

export function isSiteSettingsCacheFresh(): boolean {
  return Boolean(readCache<WebsiteSettings>(CACHE_KEYS.SITE_SETTINGS)?.isFresh);
}

export function getCachedPublicProperties(): Property[] | null {
  const cached = readCache<Property[]>(CACHE_KEYS.PUBLIC_PROPERTIES);
  return cached && Array.isArray(cached.value) ? cached.value : null;
}

export function isPublicPropertiesCacheFresh(): boolean {
  return Boolean(readCache<Property[]>(CACHE_KEYS.PUBLIC_PROPERTIES)?.isFresh);
}

export function getCachedVisibleTeamMembers(): Agent[] | null {
  const cached = readCache<Agent[]>(CACHE_KEYS.VISIBLE_TEAM);
  return cached && Array.isArray(cached.value) ? cached.value : null;
}

export function getCachedApprovedReviews(): Review[] | null {
  const cached = readCache<Review[]>(CACHE_KEYS.APPROVED_REVIEWS);
  return cached && Array.isArray(cached.value) ? cached.value : null;
}

export async function fetchSiteSettings(options?: {
  force?: boolean;
}): Promise<WebsiteSettings> {
  if (!isSupabaseConfigured || !supabase) {
    return DEFAULT_SITE_SETTINGS;
  }

  const cached = readCache<WebsiteSettings>(CACHE_KEYS.SITE_SETTINGS);
  if (!options?.force && cached?.isFresh) {
    return cached.value;
  }

  try {
    const { data, error } = await withTimeout(
      supabase.from('site_settings').select('*').eq('id', 'default').maybeSingle(),
      6000,
      'Site settings'
    );
    if (error || !data) {
      return cached?.value ?? DEFAULT_SITE_SETTINGS;
    }
    const mapped = mapSettingsRow(data as Record<string, unknown>);
    writeCache(CACHE_KEYS.SITE_SETTINGS, mapped);
    return mapped;
  } catch {
    return cached?.value ?? DEFAULT_SITE_SETTINGS;
  }
}

export async function fetchPublicPropertiesWithMeta(options?: {
  force?: boolean;
}): Promise<PublicPropertiesLoadResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      properties: DEMO_PROPERTIES,
      source: 'demo',
      errorKind: 'unconfigured',
    };
  }

  const cached = readCache<Property[]>(CACHE_KEYS.PUBLIC_PROPERTIES);
  if (!options?.force && cached?.isFresh && Array.isArray(cached.value)) {
    return {
      properties: cached.value,
      source: 'cache',
    };
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('properties')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      6500,
      'Public properties'
    );
    if (error) {
      throw new Error(error.message);
    }
    const mapped = (data || []).map((r) =>
      mapPropertyRow(r as Record<string, unknown>)
    );
    writeCache(CACHE_KEYS.PUBLIC_PROPERTIES, mapped);
    return {
      properties: mapped,
      source: 'live',
    };
  } catch (err) {
    const errorKind =
      err instanceof QueryTimeoutError ? 'timeout' : 'unreachable';
    if (cached && Array.isArray(cached.value) && cached.value.length > 0) {
      return {
        properties: cached.value,
        source: 'fallback',
        errorKind,
      };
    }
    return {
      properties: DEMO_PROPERTIES,
      source: 'fallback',
      errorKind,
    };
  }
}

export async function fetchPublicProperties(options?: {
  force?: boolean;
}): Promise<Property[]> {
  const res = await fetchPublicPropertiesWithMeta(options);
  return res.properties;
}

export async function fetchPropertyBySlugOrId(
  slugOrId: string
): Promise<{
  property: Property;
  similar: Property[];
  isFallback?: boolean;
}> {
  const findFromPool = (pool: Property[], isFallback = false) => {
    const found = pool.find((p) => p.slug === slugOrId || p.id === slugOrId);
    if (!found) return null;
    const similar = pool
      .filter(
        (p) =>
          p.id !== found.id &&
          (p.status === 'Available' || p.status === 'Under Construction')
      )
      .slice(0, 3);
    return { property: found, similar, isFallback };
  };

  if (!isSupabaseConfigured || !supabase) {
    const demoHit = findFromPool(DEMO_PROPERTIES, false);
    if (!demoHit) throw new Error('Property not found.');
    return demoHit;
  }

  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        slugOrId
      );
    const query = supabase.from('properties').select('*');
    const { data, error } = await withTimeout(
      isUuid
        ? query.or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle()
        : query.eq('slug', slugOrId).maybeSingle(),
      6500,
      'Property detail'
    );

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Property not found.');

    const property = mapPropertyRow(data as Record<string, unknown>);

    const { data: similarRows } = await withTimeout(
      supabase
        .from('properties')
        .select('*')
        .eq('is_published', true)
        .neq('id', property.id)
        .in('status', ['available', 'under construction'])
        .order('created_at', { ascending: false })
        .limit(6),
      5000,
      'Similar properties'
    );

    const similar = (similarRows || [])
      .map((r) => mapPropertyRow(r as Record<string, unknown>))
      .sort((a, b) => {
        const scoreA =
          (a.location === property.location ? 2 : 0) +
          (a.property_type === property.property_type ? 1 : 0);
        const scoreB =
          (b.location === property.location ? 2 : 0) +
          (b.property_type === property.property_type ? 1 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 3);

    return { property, similar, isFallback: false };
  } catch (err) {
    const cachedPool = getCachedPublicProperties();
    if (cachedPool) {
      const cachedHit = findFromPool(cachedPool, true);
      if (cachedHit) return cachedHit;
    }
    const demoHit = findFromPool(DEMO_PROPERTIES, true);
    if (demoHit) return demoHit;
    throw err instanceof Error ? err : new Error('Property not found.');
  }
}

export async function fetchVisibleTeamMembers(options?: {
  force?: boolean;
}): Promise<Agent[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  const cached = readCache<Agent[]>(CACHE_KEYS.VISIBLE_TEAM);
  if (!options?.force && cached?.isFresh && Array.isArray(cached.value)) {
    return cached.value;
  }
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('team_members')
        .select('*')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      5500,
      'Team members'
    );
    if (error) throw new Error(error.message);
    const mapped = (data || []).map((r) =>
      mapAgentRow(r as Record<string, unknown>)
    );
    writeCache(CACHE_KEYS.VISIBLE_TEAM, mapped);
    return mapped;
  } catch {
    return cached?.value ?? [];
  }
}

export async function fetchApprovedReviews(options?: {
  force?: boolean;
}): Promise<Review[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  const cached = readCache<Review[]>(CACHE_KEYS.APPROVED_REVIEWS);
  if (!options?.force && cached?.isFresh && Array.isArray(cached.value)) {
    return cached.value;
  }
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('reviews')
        .select('*')
        .eq('status', 'approved')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false }),
      5500,
      'Approved reviews'
    );
    if (error) throw new Error(error.message);
    const mapped = (data || []).map((r) =>
      mapReviewRow(r as Record<string, unknown>)
    );
    writeCache(CACHE_KEYS.APPROVED_REVIEWS, mapped);
    return mapped;
  } catch {
    return cached?.value ?? [];
  }
}

// ============================================================================
// PUBLIC / CLIENT WRITES & CLIENT DASHBOARD
// ============================================================================

export async function submitInquiry(params: {
  user_id?: string | null;
  property_id?: string | null;
  property_title?: string | null;
  name: string;
  phone: string;
  email: string;
  interest: string;
  message: string;
}): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('inquiries').insert({
    user_id: params.user_id || null,
    property_id: params.property_id || null,
    property_title: params.property_title || '',
    name: params.name.trim(),
    phone: params.phone.trim(),
    email: params.email.trim(),
    interest: params.interest.trim(),
    message: params.message.trim(),
    status: 'new',
  });
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();
}

export async function submitBooking(params: {
  user_id: string;
  property_id: string;
  customer_name: string;
  phone: string;
  email: string;
  preferred_date: string;
  preferred_time: string;
  note: string;
}): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('bookings').insert({
    user_id: params.user_id,
    property_id: params.property_id,
    customer_name: params.customer_name.trim(),
    phone: params.phone.trim(),
    email: params.email.trim(),
    preferred_date: params.preferred_date,
    preferred_time: params.preferred_time,
    note: params.note.trim(),
    status: 'pending',
  });
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();
}

export async function submitReview(params: {
  user_id: string;
  name: string;
  email: string;
  category: string;
  rating: number;
  text: string;
}): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('reviews').insert({
    user_id: params.user_id,
    name: params.name.trim(),
    email: params.email.trim(),
    category: params.category.trim(),
    rating: params.rating,
    text: params.text.trim(),
    status: 'pending',
  });
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();
}

export async function fetchUserFavoriteIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('favourites')
    .select('property_id')
    .eq('user_id', userId);
  if (error) return [];
  return (data || []).map((r) => String(r.property_id));
}

export async function addUserFavorite(
  userId: string,
  propertyId: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('favourites')
    .upsert(
      { user_id: userId, property_id: propertyId },
      { onConflict: 'user_id,property_id' }
    );
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();
}

export async function removeUserFavorite(
  userId: string,
  propertyId: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('favourites')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId);
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();
}

export async function fetchUserPreferences(
  userId: string,
  options?: { force?: boolean }
): Promise<CustomerPreferences> {
  const defaults: CustomerPreferences = {
    preferred_location: 'All',
    property_type: 'All',
    listing_type: 'Buy',
    min_budget: null,
    max_budget: null,
    min_bedrooms: null,
    notes: '',
    notify_matches: true,
  };
  if (!isSupabaseConfigured || !supabase) return defaults;

  const cacheKey = userPreferencesCacheKey(userId);
  const cached = readCache<CustomerPreferences>(cacheKey);
  if (!options?.force && cached?.isFresh) {
    return cached.value;
  }

  const { data } = await supabase
    .from('customer_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) {
    writeCache(cacheKey, defaults);
    return defaults;
  }
  const mapped: CustomerPreferences = {
    user_id: String(data.user_id),
    preferred_location: String(data.preferred_location || 'All'),
    property_type: String(data.property_type || 'All'),
    listing_type: (data.listing_type || 'Buy') as 'Buy' | 'Rent' | 'Both',
    min_budget: data.min_budget !== null ? Number(data.min_budget) : null,
    max_budget: data.max_budget !== null ? Number(data.max_budget) : null,
    min_bedrooms:
      data.min_bedrooms !== null ? Number(data.min_bedrooms) : null,
    notes: String(data.notes || ''),
    notify_matches: data.notify_matches !== false,
    updated_at: data.updated_at ? String(data.updated_at) : undefined,
  };
  writeCache(cacheKey, mapped);
  return mapped;
}

export async function saveUserPreferences(
  userId: string,
  prefs: CustomerPreferences
): Promise<CustomerPreferences> {
  const client = requireClient();
  const payload = {
    user_id: userId,
    preferred_location: prefs.preferred_location || 'All',
    property_type: prefs.property_type || 'All',
    listing_type: prefs.listing_type || 'Buy',
    min_budget: prefs.min_budget,
    max_budget: prefs.max_budget,
    min_bedrooms: prefs.min_bedrooms,
    notes: prefs.notes || '',
    notify_matches: prefs.notify_matches,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client
    .from('customer_preferences')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  writeCache(userPreferencesCacheKey(userId), payload);
  invalidateDashboardCaches();
  return payload;
}

export async function saveUserSearch(
  userId: string,
  payload: Omit<SavedSearch, 'id' | 'user_id' | 'created_at'>
): Promise<SavedSearch> {
  const client = requireClient();
  // Deduplicate identical criteria for this user cleanly
  const { data: existingRows } = await client
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId);

  const match = (existingRows || []).find(
    (r) =>
      String(r.query || '') === (payload.query || '') &&
      String(r.listing_type || 'All') === (payload.listing_type || 'All') &&
      String(r.property_type || 'All') === (payload.property_type || 'All') &&
      String(r.location || 'All') === (payload.location || 'All') &&
      (r.min_price ?? null) === (payload.min_price ?? null) &&
      (r.max_price ?? null) === (payload.max_price ?? null) &&
      (r.min_bedrooms ?? null) === (payload.min_bedrooms ?? null) &&
      String(r.furnishing || 'All') === (payload.furnishing || 'All') &&
      String(r.sort_by || 'newest') === (payload.sort_by || 'newest')
  );

  if (match) {
    return {
      id: String(match.id),
      user_id: userId,
      name: String(match.name),
      query: String(match.query || ''),
      listing_type: (match.listing_type || 'All') as SavedSearch['listing_type'],
      property_type: String(match.property_type || 'All'),
      location: String(match.location || 'All'),
      min_price: match.min_price !== null ? Number(match.min_price) : null,
      max_price: match.max_price !== null ? Number(match.max_price) : null,
      min_bedrooms:
        match.min_bedrooms !== null ? Number(match.min_bedrooms) : null,
      furnishing: String(match.furnishing || 'All'),
      sort_by: (match.sort_by || 'newest') as SavedSearch['sort_by'],
      created_at: String(match.created_at),
    };
  }

  const { data, error } = await client
    .from('saved_searches')
    .insert({
      user_id: userId,
      name: payload.name,
      query: payload.query || '',
      listing_type: payload.listing_type || 'All',
      property_type: payload.property_type || 'All',
      location: payload.location || 'All',
      min_price: payload.min_price,
      max_price: payload.max_price,
      min_bedrooms: payload.min_bedrooms,
      furnishing: payload.furnishing || 'All',
      sort_by: payload.sort_by || 'newest',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();

  return {
    id: String(data.id),
    user_id: userId,
    name: String(data.name),
    query: String(data.query || ''),
    listing_type: (data.listing_type || 'All') as SavedSearch['listing_type'],
    property_type: String(data.property_type || 'All'),
    location: String(data.location || 'All'),
    min_price: data.min_price !== null ? Number(data.min_price) : null,
    max_price: data.max_price !== null ? Number(data.max_price) : null,
    min_bedrooms: data.min_bedrooms !== null ? Number(data.min_bedrooms) : null,
    furnishing: String(data.furnishing || 'All'),
    sort_by: (data.sort_by || 'newest') as SavedSearch['sort_by'],
    created_at: String(data.created_at),
  };
}

export async function removeSavedSearchById(
  userId: string,
  id: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();
}

export interface ClientDashboardData {
  favorites: Property[];
  savedSearches: SavedSearch[];
  bookings: Booking[];
  inquiries: Inquiry[];
  reviews: Review[];
  preferences: CustomerPreferences;
}

export function getCachedClientDashboardData(
  userId?: string | null
): ClientDashboardData | null {
  if (!userId) return null;
  return readCache<ClientDashboardData>(clientDashboardCacheKey(userId))?.value ?? null;
}

export function isClientDashboardCacheFresh(userId?: string | null): boolean {
  if (!userId) return false;
  return Boolean(
    readCache<ClientDashboardData>(clientDashboardCacheKey(userId))?.isFresh
  );
}

export async function fetchClientDashboardData(
  userId: string,
  options?: { force?: boolean }
): Promise<ClientDashboardData> {
  const cacheKey = clientDashboardCacheKey(userId);
  const cached = readCache<ClientDashboardData>(cacheKey);
  if (!options?.force && cached?.isFresh) {
    return cached.value;
  }

  const client = requireClient();

  const [favRes, searchRes, bookRes, inqRes, revRes, prefRes] = await Promise.all([
    client
      .from('favourites')
      .select('property_id, properties(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('saved_searches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('bookings')
      .select('*, properties(title, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('inquiries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    fetchUserPreferences(userId, { force: options?.force }),
  ]);

  if (favRes.error) throw new Error(favRes.error.message);
  if (searchRes.error) throw new Error(searchRes.error.message);
  if (bookRes.error) throw new Error(bookRes.error.message);
  if (inqRes.error) throw new Error(inqRes.error.message);
  if (revRes.error) throw new Error(revRes.error.message);

  const favorites = (favRes.data || [])
    .map((row) => row.properties as unknown as Record<string, unknown> | null)
    .filter((p): p is Record<string, unknown> => Boolean(p))
    .map(mapPropertyRow);

  const savedSearches: SavedSearch[] = (searchRes.data || []).map((s) => ({
    id: String(s.id),
    user_id: String(s.user_id),
    name: String(s.name),
    query: String(s.query || ''),
    listing_type: (s.listing_type || 'All') as SavedSearch['listing_type'],
    property_type: String(s.property_type || 'All'),
    location: String(s.location || 'All'),
    min_price: s.min_price !== null ? Number(s.min_price) : null,
    max_price: s.max_price !== null ? Number(s.max_price) : null,
    min_bedrooms: s.min_bedrooms !== null ? Number(s.min_bedrooms) : null,
    furnishing: String(s.furnishing || 'All'),
    sort_by: (s.sort_by || 'newest') as SavedSearch['sort_by'],
    created_at: String(s.created_at),
  }));

  const payload: ClientDashboardData = {
    favorites,
    savedSearches,
    bookings: (bookRes.data || []).map((r) =>
      mapBookingRow(r as Record<string, unknown>)
    ),
    inquiries: (inqRes.data || []).map((r) =>
      mapInquiryRow(r as Record<string, unknown>)
    ),
    reviews: (revRes.data || []).map((r) =>
      mapReviewRow(r as Record<string, unknown>)
    ),
    preferences: prefRes,
  };
  writeCache(cacheKey, payload);
  return payload;
}

// ============================================================================
// OWNER DASHBOARD OPERATIONS (RLS-enforced owner access)
// ============================================================================

export async function uploadStorageImage(
  bucket: 'property-images' | 'team-photos',
  file: File
): Promise<string> {
  const client = requireClient();
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only WebP, JPEG, and PNG images are supported.');
  }
  if (file.size > 500 * 1024) {
    throw new Error('Compressed photo is still larger than 500 KB. Please choose another image.');
  }

  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
      ? 'webp'
      : 'jpg';
  const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error } = await client.storage.from(bucket).upload(filePath, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    const detail = error.message ? ` (${error.message})` : '';
    throw new Error(`Could not upload photo to ${bucket}${detail}. Please try again.`);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error('Photo uploaded but its public URL could not be resolved.');
  }
  return data.publicUrl;
}

export interface OwnerDashboardData {
  stats: OwnerDashboardStats;
  properties: Property[];
  favoriteCounts: Record<string, number>;
  inquiries: Inquiry[];
  bookings: Booking[];
  reviews: Review[];
  agents: Agent[];
  settings: WebsiteSettings;
  clients: UserProfile[];
}

export function getCachedOwnerDashboardData(
  userId?: string | null
): OwnerDashboardData | null {
  if (!userId) return null;
  return readCache<OwnerDashboardData>(ownerDashboardCacheKey(userId))?.value ?? null;
}

export function isOwnerDashboardCacheFresh(userId?: string | null): boolean {
  if (!userId) return false;
  return Boolean(
    readCache<OwnerDashboardData>(ownerDashboardCacheKey(userId))?.isFresh
  );
}

export async function fetchOwnerDashboardData(
  userId?: string | null,
  options?: { force?: boolean }
): Promise<OwnerDashboardData> {
  if (userId) {
    const cacheKey = ownerDashboardCacheKey(userId);
    const cached = readCache<OwnerDashboardData>(cacheKey);
    if (!options?.force && cached?.isFresh) {
      return cached.value;
    }
  }

  const client = requireClient();

  const [propRes, inqRes, bookRes, revRes, teamRes, setRes, profRes, favRes] =
    await Promise.all([
      client
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false }),
      client
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false }),
      client
        .from('bookings')
        .select('*, properties(title, slug)')
        .order('created_at', { ascending: false }),
      client
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false }),
      client
        .from('team_members')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      client.from('site_settings').select('*').eq('id', 'default').maybeSingle(),
      client
        .from('profiles')
        .select('id, email, full_name, phone, city, role, created_at')
        .order('created_at', { ascending: false }),
      client.from('favourites').select('property_id'),
    ]);

  if (propRes.error) throw new Error(propRes.error.message);
  if (inqRes.error) throw new Error(inqRes.error.message);
  if (bookRes.error) throw new Error(bookRes.error.message);
  if (revRes.error) throw new Error(revRes.error.message);
  if (teamRes.error) throw new Error(teamRes.error.message);
  if (setRes.error) throw new Error(setRes.error.message);
  if (profRes.error) throw new Error(profRes.error.message);

  const favoriteCounts: Record<string, number> = {};
  if (!favRes.error && Array.isArray(favRes.data)) {
    for (const row of favRes.data) {
      const pid = row.property_id ? String(row.property_id) : '';
      if (pid) {
        favoriteCounts[pid] = (favoriteCounts[pid] || 0) + 1;
      }
    }
  }

  const properties = (propRes.data || []).map((r) =>
    mapPropertyRow(r as Record<string, unknown>)
  );
  const inquiries = (inqRes.data || []).map((r) =>
    mapInquiryRow(r as Record<string, unknown>)
  );
  const bookings = (bookRes.data || []).map((r) =>
    mapBookingRow(r as Record<string, unknown>)
  );
  const reviews = (revRes.data || []).map((r) =>
    mapReviewRow(r as Record<string, unknown>)
  );
  const agents = (teamRes.data || []).map((r) =>
    mapAgentRow(r as Record<string, unknown>)
  );
  const settings = mapSettingsRow(
    (setRes.data as Record<string, unknown> | null) || null
  );
  const clients: UserProfile[] = (profRes.data || [])
    .filter((p) => p.role !== 'owner')
    .map((p) => ({
      id: String(p.id),
      email: String(p.email || ''),
      full_name: String(p.full_name || ''),
      phone: String(p.phone || ''),
      city: String(p.city || 'Siliguri'),
      role: 'client',
      created_at: String(p.created_at),
    }));

  const stats: OwnerDashboardStats = {
    total_properties: properties.length,
    available_properties: properties.filter((p) => p.status === 'Available')
      .length,
    under_construction_properties: properties.filter(
      (p) => p.status === 'Under Construction'
    ).length,
    sold_properties: properties.filter((p) => p.status === 'Sold').length,
    rented_properties: properties.filter((p) => p.status === 'Rented').length,
    new_inquiries: inquiries.filter((i) => i.status === 'new').length,
    total_inquiries: inquiries.length,
    pending_bookings: bookings.filter((b) => b.status === 'pending').length,
    total_bookings: bookings.length,
    pending_reviews: reviews.filter((r) => r.status === 'pending').length,
    total_reviews: reviews.length,
    client_accounts: clients.length,
  };

  const payload: OwnerDashboardData = {
    stats,
    properties,
    favoriteCounts,
    inquiries,
    bookings,
    reviews,
    agents,
    settings,
    clients,
  };
  if (userId) {
    writeCache(ownerDashboardCacheKey(userId), payload);
  }
  return payload;
}

export async function ownerSaveProperty(
  editingId: string | null,
  input: {
    title: string;
    description: string;
    price_inr: number;
    listing_type: ListingType;
    property_type: string;
    location: string;
    address_detail: string;
    bedrooms: number;
    bathrooms: number;
    area_sqft: number;
    furnishing: string;
    parking: string;
    status: PropertyStatus;
    is_published: boolean;
    is_featured: boolean;
    amenities: string[];
    images: string[];
  }
): Promise<{ id: string; slug: string }> {
  const client = requireClient();
  const baseSlug = slugify(input.title) || 'siliguri-property';
  const dbPayload = {
    title: input.title.trim(),
    description: input.description.trim(),
    price: Math.max(0, Math.round(Number(input.price_inr) || 0)),
    listing_type: toDbListingType(input.listing_type),
    category: input.property_type.trim(),
    location: input.location.trim(),
    address_detail: input.address_detail.trim(),
    bedrooms: Math.max(0, Math.round(Number(input.bedrooms) || 0)),
    bathrooms: Math.max(0, Math.round(Number(input.bathrooms) || 0)),
    area_sqft: Math.max(0, Math.round(Number(input.area_sqft) || 0)),
    furnishing: input.furnishing || 'Unfurnished',
    parking: input.parking.trim(),
    status: toDbPropertyStatus(input.status),
    is_published: Boolean(input.is_published),
    is_featured: Boolean(input.is_featured),
    amenities: input.amenities,
    images: input.images,
  };

  let savedId = editingId || '';
  let savedSlug = baseSlug;

  if (editingId) {
    const { data, error } = await client
      .from('properties')
      .update(dbPayload)
      .eq('id', editingId)
      .select('id, slug')
      .single();
    if (error) throw new Error(error.message);
    savedId = data?.id ? String(data.id) : editingId;
    savedSlug = data?.slug ? String(data.slug) : baseSlug;
  } else {
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await client
      .from('properties')
      .insert({
        ...dbPayload,
        slug: uniqueSlug,
      })
      .select('id, slug')
      .single();
    if (error) throw new Error(error.message);
    savedId = data?.id ? String(data.id) : '';
    savedSlug = data?.slug ? String(data.slug) : uniqueSlug;
  }
  invalidatePublicCaches();
  invalidateDashboardCaches();
  return { id: savedId, slug: savedSlug };
}

export async function ownerTogglePropertyPublished(
  id: string,
  isPublished: boolean
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('properties')
    .update({ is_published: isPublished })
    .eq('id', id);
  if (error) throw new Error(error.message);
  invalidatePublicCaches();
  invalidateDashboardCaches();
}

export async function ownerDeleteProperty(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('properties').delete().eq('id', id);
  if (error) throw new Error(error.message);
  invalidatePublicCaches();
  invalidateDashboardCaches();
}

export async function ownerUpdateInquiry(
  id: string,
  status: InquiryStatus,
  ownerNotes: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('inquiries')
    .update({ status, owner_notes: ownerNotes })
    .eq('id', id);
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();
}

export async function ownerUpdateBooking(
  id: string,
  status: BookingStatus,
  ownerNote: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('bookings')
    .update({ status, owner_note: ownerNote })
    .eq('id', id);
  if (error) throw new Error(error.message);
  invalidateDashboardCaches();
}

export async function ownerUpdateReview(
  id: string,
  patch: { status?: ReviewStatus; is_featured?: boolean }
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('reviews').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  invalidatePublicCaches();
  invalidateDashboardCaches();
}

export async function ownerDeleteReview(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('reviews').delete().eq('id', id);
  if (error) throw new Error(error.message);
  invalidatePublicCaches();
  invalidateDashboardCaches();
}

export async function ownerSaveTeamMember(
  editingId: string | null,
  input: {
    name: string;
    designation: string;
    intro: string;
    phone: string;
    whatsapp: string;
    photo_url: string;
    sort_order: number;
    is_visible: boolean;
  }
): Promise<void> {
  const client = requireClient();
  const payload = {
    name: input.name.trim(),
    designation: input.designation.trim(),
    intro: input.intro.trim(),
    phone: input.phone.trim(),
    whatsapp: input.whatsapp.trim(),
    photo_url: input.photo_url.trim(),
    sort_order: Number(input.sort_order) || 0,
    is_visible: Boolean(input.is_visible),
  };

  if (editingId) {
    const { error } = await client
      .from('team_members')
      .update(payload)
      .eq('id', editingId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from('team_members').insert(payload);
    if (error) throw new Error(error.message);
  }
  invalidatePublicCaches();
  invalidateDashboardCaches();
}

export async function ownerToggleTeamMemberVisibility(
  id: string,
  isVisible: boolean
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('team_members')
    .update({ is_visible: isVisible })
    .eq('id', id);
  if (error) throw new Error(error.message);
  invalidatePublicCaches();
  invalidateDashboardCaches();
}

export async function ownerDeleteTeamMember(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('team_members').delete().eq('id', id);
  if (error) throw new Error(error.message);
  invalidatePublicCaches();
  invalidateDashboardCaches();
}

export async function ownerSaveSiteSettings(
  settings: WebsiteSettings
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('site_settings').upsert(
    {
      id: 'default',
      business_name: settings.business_name.trim(),
      tagline: settings.tagline.trim(),
      about_text: settings.description.trim(),
      address: settings.address.trim(),
      phone: settings.phone.trim(),
      whatsapp: settings.whatsapp.trim(),
      logo_url: settings.logo_url.trim(),
      hero_headline: settings.hero_headline.trim(),
      hero_subheadline: settings.hero_subheadline.trim(),
      hero_image_url: settings.hero_image_url.trim(),
      about_image_url: settings.about_image_url.trim(),
      hours: {
        ...settings.operating_hours,
        service_images: settings.service_images || {},
      },
      locations: settings.locations,
      property_types: settings.property_types,
      social_links: {
        ...settings.social_links,
        google_review: (settings.google_review_link || '').trim(),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
  invalidatePublicCaches();
  invalidateDashboardCaches();
}
