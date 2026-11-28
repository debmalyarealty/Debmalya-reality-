import type {
  CustomerPreferences,
  ListingType,
  PriceUnit,
  Property,
  PropertyFilters,
  PropertyStatus,
  SavedSearch,
} from '../types/realty.ts';

function formatPriceSuffix(
  listingType?: ListingType,
  priceUnit?: PriceUnit
): string {
  if (priceUnit === 'night') return ' / night';
  if (priceUnit === 'month') return ' / month';
  if (priceUnit === 'total') return '';
  return listingType === 'Rent' ? '/mo' : '';
}

export function formatINR(
  amount: number | null | undefined,
  listingType?: ListingType,
  compact = false,
  priceUnit?: PriceUnit
): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return 'Price on request';
  }

  let formatted = '';
  if (compact) {
    if (amount >= 10000000) {
      const cr = amount / 10000000;
      formatted = `₹${Number.isInteger(cr) ? cr : cr.toFixed(2).replace(/\.?0+$/, '')} Cr`;
    } else if (amount >= 100000) {
      const lakh = amount / 100000;
      formatted = `₹${Number.isInteger(lakh) ? lakh : lakh.toFixed(1).replace(/\.0$/, '')} L`;
    } else {
      formatted = `₹${amount.toLocaleString('en-IN')}`;
    }
  } else {
    formatted = `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }

  return `${formatted}${formatPriceSuffix(listingType, priceUnit)}`;
}

export function formatINRReadable(
  amount: number | null | undefined,
  listingType?: ListingType,
  priceUnit?: PriceUnit
): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return 'Price on request';
  }

  let formatted = '';
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    formatted = `₹${Number.isInteger(cr) ? cr : cr.toFixed(2).replace(/\.?0+$/, '')} Cr`;
  } else if (amount >= 100000) {
    const lakh = amount / 100000;
    formatted = `₹${Number.isInteger(lakh) ? lakh : lakh.toFixed(2).replace(/\.?0+$/, '')} Lakh`;
  } else {
    formatted = `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }

  return `${formatted}${formatPriceSuffix(listingType, priceUnit)}`;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Formats an ISO date or YYYY-MM-DD string into clean editorial format: "22 Nov 2026".
 */
export function formatReviewDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (ymd) {
    const year = Number(ymd[1]);
    const monthIdx = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    if (
      monthIdx >= 0 &&
      monthIdx < 12 &&
      day >= 1 &&
      day <= 31 &&
      Number.isFinite(year)
    ) {
      return `${day} ${SHORT_MONTHS[monthIdx]} ${year}`;
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return `${parsed.getUTCDate()} ${SHORT_MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
}

export function formatRelativeTimeAgo(
  dateStr?: string | null,
  nowMs: number = Date.now()
): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
  }
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  }
  return formatReviewDate(dateStr);
}

export interface CsvEnquiryExportRow {
  kind: 'Enquiry' | 'Site Visit';
  name: string;
  phone: string;
  email: string;
  subject: string;
  schedule: string;
  status: string;
  message: string;
  note: string;
  date: string;
}

export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildEnquiriesCsv(rows: CsvEnquiryExportRow[]): string {
  const headers = [
    'Type',
    'Name',
    'Phone',
    'Email',
    'Property / Interest',
    'Preferred Visit',
    'Status',
    'Message',
    'Owner Note',
    'Received Date',
  ];
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) =>
      [
        r.kind,
        r.name,
        r.phone,
        r.email,
        r.subject,
        r.schedule,
        r.status,
        r.message,
        r.note,
        r.date,
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];
  return lines.join('\r\n');
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isPropertyActiveOpportunity(status: PropertyStatus): boolean {
  return (
    status === 'Available' ||
    status === 'Under Construction' ||
    status === 'Upcoming'
  );
}

export function filterAndSortProperties(
  properties: Property[],
  filters: PropertyFilters,
  options: { publicOnly?: boolean; allowClosedInAll?: boolean } = {}
): Property[] {
  const { publicOnly = true, allowClosedInAll = true } = options;

  const q = (filters.query || '').trim().toLowerCase();
  const loc = (filters.location || '').trim().toLowerCase();
  const pType = (filters.propertyType || '').trim().toLowerCase();
  const furnishing = (filters.furnishing || '').trim().toLowerCase();
  const parking = (filters.parking || '').trim().toLowerCase();
  const statusFilter = (filters.status || '').trim();

  const safeProperties = Array.isArray(properties)
    ? properties.filter((p): p is Property => Boolean(p))
    : [];

  const filtered = safeProperties.filter((prop) => {
    const propPrice = Number(prop.price_inr) || 0;
    const propBedrooms = Number(prop.bedrooms) || 0;
    const propBathrooms = Number(prop.bathrooms) || 0;
    const propArea = Number(prop.area_sqft) || 0;
    const propLocation = prop.location || '';
    const propType = prop.property_type || '';
    const propFurnishing = prop.furnishing || '';
    const propParking = prop.parking || '';
    const propAmenities = Array.isArray(prop.amenities) ? prop.amenities : [];

    if (publicOnly && !prop.is_published) return false;

    // Sold / Rented properties are excluded when user filters for active availability
    // or when allowClosedInAll is false. If user explicitly selects Sold or Rented status, allow viewing them as archived reference.
    if (!statusFilter || statusFilter === 'All') {
      if (!allowClosedInAll && !isPropertyActiveOpportunity(prop.status)) {
        return false;
      }
    } else if (statusFilter === 'ActiveOnly') {
      if (!isPropertyActiveOpportunity(prop.status)) return false;
    } else if (prop.status !== statusFilter) {
      return false;
    }

    if (
      filters.listingType &&
      filters.listingType !== 'All' &&
      prop.listing_type !== filters.listingType
    ) {
      return false;
    }

    if (loc && loc !== 'all' && loc !== 'all locations') {
      const propLoc = propLocation.toLowerCase();
      const propAddr = (prop.address_detail || '').toLowerCase();
      if (!propLoc.includes(loc) && !propAddr.includes(loc)) {
        return false;
      }
    }

    if (pType && pType !== 'all' && pType !== 'all types') {
      if (propType.toLowerCase() !== pType) {
        return false;
      }
    }

    if (
      filters.minPrice !== undefined &&
      filters.minPrice !== '' &&
      Number.isFinite(Number(filters.minPrice))
    ) {
      if (propPrice < Number(filters.minPrice)) return false;
    }

    if (
      filters.maxPrice !== undefined &&
      filters.maxPrice !== '' &&
      Number.isFinite(Number(filters.maxPrice))
    ) {
      if (propPrice > Number(filters.maxPrice)) return false;
    }

    if (
      filters.minBedrooms !== undefined &&
      filters.minBedrooms !== '' &&
      Number.isFinite(Number(filters.minBedrooms))
    ) {
      if (propBedrooms < Number(filters.minBedrooms)) return false;
    }

    if (
      filters.minBathrooms !== undefined &&
      filters.minBathrooms !== '' &&
      Number.isFinite(Number(filters.minBathrooms))
    ) {
      if (propBathrooms < Number(filters.minBathrooms)) return false;
    }

    if (
      filters.minArea !== undefined &&
      filters.minArea !== '' &&
      Number.isFinite(Number(filters.minArea))
    ) {
      if (propArea < Number(filters.minArea)) return false;
    }

    if (furnishing && furnishing !== 'all') {
      if (propFurnishing.toLowerCase() !== furnishing) return false;
    }

    if (parking && parking !== 'all') {
      const hasParking =
        propParking.trim() !== '' &&
        !propParking.toLowerCase().includes('none') &&
        propParking.toLowerCase() !== 'no';
      if (parking === 'available' && !hasParking) return false;
      if (parking === 'none' && hasParking) return false;
    }

    if (q) {
      const haystack = [
        prop.title || '',
        prop.description || '',
        propLocation,
        prop.address_detail || '',
        propType,
        ...propAmenities,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const sortBy = filters.sortBy || 'newest';
  return [...filtered].sort((a, b) => {
    const aPrice = Number(a.price_inr) || 0;
    const bPrice = Number(b.price_inr) || 0;
    if (sortBy === 'price_asc') return aPrice - bPrice;
    if (sortBy === 'price_desc') return bPrice - aPrice;
    return (
      (new Date(b.created_at || 0).getTime() || 0) -
      (new Date(a.created_at || 0).getTime() || 0)
    );
  });
}

export interface RecommendedProperty {
  property: Property;
  score: number;
  reasons: string[];
}

export function computeRecommendations(
  properties: Property[],
  preferences: CustomerPreferences | null,
  limit = 6
): RecommendedProperty[] {
  const safeProperties = Array.isArray(properties)
    ? properties.filter((p): p is Property => Boolean(p))
    : [];
  const activePublished = safeProperties.filter(
    (p) => p.is_published && isPropertyActiveOpportunity(p.status)
  );

  if (!preferences) {
    return activePublished
      .sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return (
          (new Date(b.created_at || 0).getTime() || 0) -
          (new Date(a.created_at || 0).getTime() || 0)
        );
      })
      .slice(0, limit)
      .map((property) => ({
        property,
        score: property.is_featured ? 10 : 5,
        reasons: property.is_featured
          ? ['Featured Siliguri Listing']
          : ['Currently Available'],
      }));
  }

  const scored: RecommendedProperty[] = activePublished.map((property) => {
    let score = 0;
    const reasons: string[] = [];
    const propLocation = property.location || '';
    const propType = property.property_type || '';
    const propPrice = Number(property.price_inr) || 0;
    const propBedrooms = Number(property.bedrooms) || 0;

    if (
      preferences.listing_type === 'Both' ||
      property.listing_type === preferences.listing_type
    ) {
      score += 25;
      if (preferences.listing_type !== 'Both') {
        reasons.push(`Matches ${preferences.listing_type}`);
      }
    }

    if (
      preferences.preferred_location &&
      preferences.preferred_location !== 'All'
    ) {
      const prefLoc = preferences.preferred_location.toLowerCase();
      if (
        propLocation.toLowerCase().includes(prefLoc) ||
        (property.address_detail || '').toLowerCase().includes(prefLoc)
      ) {
        score += 35;
        reasons.push(`In ${propLocation}`);
      }
    }

    if (
      preferences.property_type &&
      preferences.property_type !== 'All' &&
      propType.toLowerCase() === preferences.property_type.toLowerCase()
    ) {
      score += 25;
      reasons.push(propType);
    }

    const minB = preferences.min_budget ?? 0;
    const maxB = preferences.max_budget ?? Number.MAX_SAFE_INTEGER;
    if (propPrice >= minB && propPrice <= maxB) {
      score += 20;
      if (preferences.max_budget || preferences.min_budget) {
        reasons.push('Within budget');
      }
    } else if (
      preferences.max_budget &&
      propPrice <= preferences.max_budget * 1.15
    ) {
      score += 8;
    }

    if (preferences.min_bedrooms && propBedrooms >= preferences.min_bedrooms) {
      score += 10;
      reasons.push(`${propBedrooms} BHK+`);
    }

    if (property.status === 'Available') {
      score += 10;
    }

    if (property.is_featured) {
      score += 3;
    }

    if (reasons.length === 0) {
      reasons.push('Available in Siliguri');
    }

    return { property, score, reasons };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function doesPropertyMatchPreferences(
  property: Property,
  preferences: CustomerPreferences
): boolean {
  if (!property.is_published || !isPropertyActiveOpportunity(property.status)) {
    return false;
  }
  if (
    preferences.listing_type !== 'Both' &&
    property.listing_type !== preferences.listing_type
  ) {
    return false;
  }
  if (
    preferences.preferred_location &&
    preferences.preferred_location !== 'All' &&
    !property.location
      .toLowerCase()
      .includes(preferences.preferred_location.toLowerCase())
  ) {
    return false;
  }
  if (
    preferences.property_type &&
    preferences.property_type !== 'All' &&
    property.property_type.toLowerCase() !==
      preferences.property_type.toLowerCase()
  ) {
    return false;
  }
  if (
    preferences.min_budget !== null &&
    property.price_inr < preferences.min_budget
  ) {
    return false;
  }
  if (
    preferences.max_budget !== null &&
    property.price_inr > preferences.max_budget
  ) {
    return false;
  }
  if (
    preferences.min_bedrooms !== null &&
    property.bedrooms < preferences.min_bedrooms
  ) {
    return false;
  }
  return true;
}

export function sanitizeText(value: unknown, maxLen = 2000): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return /^(?:\+91)?[6-9]\d{9}$/.test(cleaned);
}

export interface InquiryFieldErrors {
  name?: string;
  phone?: string;
  email?: string;
  interested_in?: string;
  message?: string;
}

export function validateInquiryFields(input: {
  name: string;
  phone: string;
  email: string;
  interested_in: string;
  message: string;
}): { fields: InquiryFieldErrors; firstError: string | null } {
  const fields: InquiryFieldErrors = {};
  if (!input.name || input.name.trim().length < 2) {
    fields.name = 'Please enter your name (at least 2 characters).';
  }
  if (!isValidPhone(input.phone)) {
    fields.phone = 'Enter a 10-digit mobile number.';
  }
  if (input.email.trim().length > 0 && !isValidEmail(input.email)) {
    fields.email = 'Enter a valid email address.';
  }
  if (!input.interested_in || input.interested_in.trim().length < 2) {
    fields.interested_in = 'Please choose what you are interested in.';
  }
  if (!input.message || input.message.trim().length < 5) {
    fields.message = 'Please enter your message (at least 5 characters).';
  }
  const firstError = Object.values(fields)[0] ?? null;
  return { fields, firstError };
}

export function validateInquiryInput(input: {
  name: string;
  phone: string;
  email: string;
  interested_in: string;
  message: string;
}): string | null {
  return validateInquiryFields(input).firstError;
}

export interface AppointmentFieldErrors {
  customer_name?: string;
  phone?: string;
  email?: string;
  property_id?: string;
  preferred_date?: string;
  preferred_time?: string;
}

export function validateAppointmentFields(input: {
  customer_name: string;
  phone: string;
  email: string;
  property_id: string;
  preferred_date: string;
  preferred_time: string;
}): { fields: AppointmentFieldErrors; firstError: string | null } {
  const fields: AppointmentFieldErrors = {};
  if (!input.customer_name || input.customer_name.trim().length < 2) {
    fields.customer_name = 'Please enter your name.';
  }
  if (!isValidPhone(input.phone)) {
    fields.phone = 'Enter a 10-digit mobile number.';
  }
  if (input.email.trim().length > 0 && !isValidEmail(input.email)) {
    fields.email = 'Enter a valid email address.';
  }
  if (!input.property_id) {
    fields.property_id = 'Please select a property for the site visit.';
  }
  if (!input.preferred_date) {
    fields.preferred_date = 'Please choose a preferred date.';
  }
  if (!input.preferred_time) {
    fields.preferred_time = 'Please choose a preferred time slot.';
  }
  const firstError = Object.values(fields)[0] ?? null;
  return { fields, firstError };
}

export function validateAppointmentInput(input: {
  customer_name: string;
  phone: string;
  email: string;
  property_id: string;
  preferred_date: string;
  preferred_time: string;
}): string | null {
  return validateAppointmentFields(input).firstError;
}

export interface ReviewFieldErrors {
  reviewer_name?: string;
  reviewer_email?: string;
  rating?: string;
  review_text?: string;
}

export function validateReviewFields(input: {
  reviewer_name: string;
  reviewer_email?: string;
  rating: number;
  review_text: string;
}): { fields: ReviewFieldErrors; firstError: string | null } {
  const fields: ReviewFieldErrors = {};
  if (!input.reviewer_name || input.reviewer_name.trim().length < 2) {
    fields.reviewer_name = 'Please enter your name.';
  }
  if (
    input.reviewer_email &&
    input.reviewer_email.trim().length > 0 &&
    !isValidEmail(input.reviewer_email)
  ) {
    fields.reviewer_email = 'Enter a valid email address.';
  }
  if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
    fields.rating = 'Please select a rating between 1 and 5.';
  }
  if (!input.review_text || input.review_text.trim().length < 10) {
    fields.review_text = 'Please write your review (at least 10 characters).';
  }
  const firstError = Object.values(fields)[0] ?? null;
  return { fields, firstError };
}

export function validateReviewInput(input: {
  reviewer_name: string;
  reviewer_email?: string;
  rating: number;
  review_text: string;
}): string | null {
  return validateReviewFields(input).firstError;
}

/**
 * Computes responsive grid column spans for a `grid-cols-1 md:grid-cols-2 lg:grid-cols-6`
 * property grid so neither tablet (2-col) nor desktop (3-card/2-card rows) leaves an orphan card.
 */
export function getPropertyGridSpanClass(index: number, total: number): string {
  if (total <= 1) {
    return 'md:col-span-2 lg:col-span-6';
  }

  // Tablet (md:grid-cols-2): if odd count, lead card spans full 2 cols so remaining pairs balance cleanly
  const mdClass =
    total % 2 === 1 && index === 0 ? 'md:col-span-2' : 'md:col-span-1';

  // Desktop (lg:grid-cols-6): 2 = 1/3 width (3-up), 3 = 1/2 width (2-up)
  const remainder = total % 3;
  let lgClass = 'lg:col-span-2';
  if (remainder === 2 && index >= total - 2) {
    lgClass = 'lg:col-span-3';
  } else if (remainder === 1 && index >= total - 4) {
    lgClass = 'lg:col-span-3';
  }

  return `${mdClass} ${lgClass}`;
}

export function buildSavedSearchName(filters: PropertyFilters): string {
  const parts: string[] = [];

  if (filters.listingType && filters.listingType !== 'All') {
    parts.push(filters.listingType);
  }

  if (filters.propertyType && filters.propertyType !== 'All') {
    const shortType =
      filters.propertyType === 'Flats / Apartments'
        ? 'Flats'
        : filters.propertyType === 'Residential Plots'
        ? 'Plots'
        : filters.propertyType;
    parts.push(shortType);
  }

  if (filters.location && filters.location !== 'All') {
    parts.push(`in ${filters.location}`);
  }

  if (filters.minBedrooms !== undefined && filters.minBedrooms !== '') {
    const beds = Number(filters.minBedrooms);
    if (Number.isFinite(beds) && beds > 0) {
      parts.push(beds >= 4 ? '4+ BHK' : `${beds}+ BHK`);
    }
  }

  const lType = filters.listingType === 'Rent' ? 'Rent' : undefined;
  if (
    filters.minPrice !== undefined &&
    filters.minPrice !== '' &&
    filters.maxPrice !== undefined &&
    filters.maxPrice !== ''
  ) {
    parts.push(
      `${formatINRReadable(Number(filters.minPrice), lType)}–${formatINRReadable(
        Number(filters.maxPrice),
        lType
      )}`
    );
  } else if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
    parts.push(`Under ${formatINRReadable(Number(filters.maxPrice), lType)}`);
  } else if (filters.minPrice !== undefined && filters.minPrice !== '') {
    parts.push(`Above ${formatINRReadable(Number(filters.minPrice), lType)}`);
  }

  if (filters.furnishing && filters.furnishing !== 'All') {
    parts.push(
      filters.furnishing === 'Fully Furnished'
        ? 'Furnished'
        : filters.furnishing
    );
  }

  if (filters.query && filters.query.trim()) {
    parts.push(`"${filters.query.trim()}"`);
  }

  return parts.length > 0
    ? parts.join(' · ')
    : 'All active Siliguri properties';
}

export function buildSearchQueryString(filters: PropertyFilters): string {
  const params = new URLSearchParams();
  if (filters.query?.trim()) params.set('q', filters.query.trim());
  if (filters.listingType && filters.listingType !== 'All') {
    params.set('type', filters.listingType);
  }
  if (filters.propertyType && filters.propertyType !== 'All') {
    params.set('category', filters.propertyType);
  }
  if (filters.location && filters.location !== 'All') {
    params.set('location', filters.location);
  }
  if (
    filters.minPrice !== undefined &&
    filters.minPrice !== '' &&
    Number.isFinite(Number(filters.minPrice))
  ) {
    params.set('minPrice', String(filters.minPrice));
  }
  if (
    filters.maxPrice !== undefined &&
    filters.maxPrice !== '' &&
    Number.isFinite(Number(filters.maxPrice))
  ) {
    params.set('maxPrice', String(filters.maxPrice));
  }
  if (
    filters.minBedrooms !== undefined &&
    filters.minBedrooms !== '' &&
    Number.isFinite(Number(filters.minBedrooms))
  ) {
    params.set('minBedrooms', String(filters.minBedrooms));
  }
  if (filters.furnishing && filters.furnishing !== 'All') {
    params.set('furnishing', filters.furnishing);
  }
  if (filters.sortBy && filters.sortBy !== 'newest') {
    params.set('sort', filters.sortBy);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function savedSearchToFilters(saved: SavedSearch): PropertyFilters {
  return {
    query: saved.query || '',
    listingType: saved.listing_type || 'All',
    propertyType: saved.property_type || 'All',
    location: saved.location || 'All',
    minPrice: saved.min_price !== null && saved.min_price !== undefined ? saved.min_price : '',
    maxPrice: saved.max_price !== null && saved.max_price !== undefined ? saved.max_price : '',
    minBedrooms:
      saved.min_bedrooms !== null && saved.min_bedrooms !== undefined
        ? saved.min_bedrooms
        : '',
    furnishing: saved.furnishing || 'All',
    sortBy: saved.sort_by || 'newest',
    status: 'ActiveOnly',
  };
}

export type AreaUnit = 'sqft' | 'katha';

export const SQFT_PER_KATHA = 720;

export function convertAreaInputToSqFt(
  rawValue: string | number,
  unit: AreaUnit
): number {
  const num =
    typeof rawValue === 'number' ? rawValue : Number(String(rawValue).trim());
  if (!Number.isFinite(num) || num <= 0) return 0;
  const sqft = unit === 'katha' ? num * SQFT_PER_KATHA : num;
  return Math.max(0, Math.round(sqft));
}

export function formatAreaKatha(sqFt: number): string {
  if (!Number.isFinite(sqFt) || sqFt <= 0) return '0';
  const katha = sqFt / SQFT_PER_KATHA;
  return Number.isInteger(katha)
    ? String(katha)
    : katha.toFixed(2).replace(/\.?0+$/, '');
}

