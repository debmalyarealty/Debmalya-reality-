import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEnquiriesCsv,
  buildSavedSearchName,
  buildSearchQueryString,
  computeRecommendations,
  convertAreaInputToSqFt,
  doesPropertyMatchPreferences,
  escapeCsvCell,
  filterAndSortProperties,
  formatAreaKatha,
  formatINR,
  formatINRReadable,
  formatRelativeTimeAgo,
  formatReviewDate,
  getPropertyGridSpanClass,
  isValidEmail,
  isValidPhone,
  savedSearchToFilters,
  slugify,
  SQFT_PER_KATHA,
  validateAppointmentFields,
  validateAppointmentInput,
  validateInquiryFields,
  validateInquiryInput,
  validateReviewFields,
  validateReviewInput,
} from './realtyLogic';
import type { CustomerPreferences, Property, SavedSearch } from '../types/realty';

const makeProperty = (overrides: Partial<Property> = {}): Property => ({
  id: 'p1',
  slug: 'sevoke-road-3bhk',
  title: 'Sevoke Road 3 BHK Residence',
  description: 'Spacious modern apartment near Sevoke Road.',
  price_inr: 6500000,
  listing_type: 'Buy',
  property_type: 'Flats / Apartments',
  location: 'Sevoke Road',
  address_detail: 'Ward 13, Siliguri',
  bedrooms: 3,
  bathrooms: 2,
  area_sqft: 1550,
  furnishing: 'Semi-Furnished',
  parking: '1 Covered Car Parking',
  status: 'Available',
  is_published: true,
  is_featured: true,
  is_demo: true,
  amenities: ['Lift', '24x7 Security', 'Power Backup'],
  images: [],
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  ...overrides,
});

test('formatINR formats Indian currency accurately', () => {
  assert.equal(formatINR(6500000, 'Buy'), '₹65,00,000');
  assert.equal(formatINR(28000, 'Rent'), '₹28,000/mo');
  assert.equal(formatINR(12500000, 'Buy', true), '₹1.25 Cr');
  assert.equal(formatINR(4850000, 'Buy', true), '₹48.5 L');
});

test('formatINRReadable formats readable Indian currency units for UI cards', () => {
  assert.equal(formatINRReadable(6850000, 'Buy'), '₹68.5 Lakh');
  assert.equal(formatINRReadable(13500000, 'Buy'), '₹1.35 Cr');
  assert.equal(formatINRReadable(28000, 'Rent'), '₹28,000/mo');
  assert.equal(formatINRReadable(3500, 'Rent', 'night'), '₹3,500 / night');
  assert.equal(formatINRReadable(28000, 'Rent', 'month'), '₹28,000 / month');
  assert.equal(formatINRReadable(6850000, 'Buy', 'total'), '₹68.5 Lakh');
  assert.equal(formatINRReadable(4400000, 'Buy'), '₹44 Lakh');
  assert.equal(formatINR(null), 'Price on request');
  assert.equal(formatINR(undefined), 'Price on request');
  assert.equal(formatINR(0), 'Price on request');
  assert.equal(formatINRReadable(null), 'Price on request');
  assert.equal(formatINRReadable(0), 'Price on request');
});

test('filterAndSortProperties handles null/missing fields safely', () => {
  const partial = {
    ...makeProperty({ id: 'partial' }),
    amenities: undefined as unknown as string[],
    location: undefined as unknown as string,
    title: undefined as unknown as string,
    price_inr: undefined as unknown as number,
  };
  const result = filterAndSortProperties([partial], { query: 'anything' });
  assert.equal(result.length, 0);
  assert.equal(filterAndSortProperties(null as unknown as Property[], {}).length, 0);
});

test('formatReviewDate outputs editorial DD MMM YYYY format without timezone drift', () => {
  assert.equal(formatReviewDate('2026-11-22'), '22 Nov 2026');
  assert.equal(formatReviewDate('2026-01-05T00:00:00.000Z'), '5 Jan 2026');
  assert.equal(formatReviewDate(''), '');
});

test('slugify creates clean URL slugs', () => {
  assert.equal(
    slugify('3 BHK Luxury Flat — Sevoke Road!'),
    '3-bhk-luxury-flat-sevoke-road'
  );
});

test('filterAndSortProperties enforces publicOnly and multi-facet filtering', () => {
  const list: Property[] = [
    makeProperty({ id: '1', price_inr: 6500000, location: 'Sevoke Road', is_published: true }),
    makeProperty({ id: '2', price_inr: 4200000, location: 'Haiderpara', is_published: true, status: 'Sold' }),
    makeProperty({ id: '3', price_inr: 25000, listing_type: 'Rent', location: 'Bhanu Nagar', is_published: true }),
    makeProperty({ id: '4', price_inr: 9000000, location: 'Sevoke Road', is_published: false }),
  ];

  const publicAll = filterAndSortProperties(list, {}, { publicOnly: true });
  assert.equal(publicAll.length, 3);

  const activeBuySevoke = filterAndSortProperties(
    list,
    { location: 'Sevoke Road', listingType: 'Buy', status: 'ActiveOnly' },
    { publicOnly: true }
  );
  assert.equal(activeBuySevoke.length, 1);
  assert.equal(activeBuySevoke[0].id, '1');

  const noSoldAsActive = filterAndSortProperties(
    list,
    { location: 'Haiderpara' },
    { publicOnly: true, allowClosedInAll: false }
  );
  assert.equal(noSoldAsActive.length, 0);

  const sortedAsc = filterAndSortProperties(
    list,
    { sortBy: 'price_asc' },
    { publicOnly: true }
  );
  assert.deepEqual(
    sortedAsc.map((p) => p.id),
    ['3', '2', '1']
  );
});

test('computeRecommendations excludes Sold/Rented and ranks matching preferences highest', () => {
  const list: Property[] = [
    makeProperty({ id: 'sold', status: 'Sold', location: 'Sevoke Road' }),
    makeProperty({
      id: 'match',
      location: 'Sevoke Road',
      property_type: 'Flats / Apartments',
      price_inr: 6200000,
      bedrooms: 3,
      status: 'Available',
    }),
    makeProperty({
      id: 'other',
      location: 'Gugni More',
      property_type: 'Residential Plots',
      price_inr: 3200000,
      bedrooms: 0,
      status: 'Available',
    }),
  ];

  const prefs: CustomerPreferences = {
    preferred_location: 'Sevoke Road',
    property_type: 'Flats / Apartments',
    listing_type: 'Buy',
    min_budget: 5000000,
    max_budget: 8000000,
    min_bedrooms: 3,
    notes: '',
    notify_matches: true,
  };

  const recs = computeRecommendations(list, prefs, 5);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].property.id, 'match');
  assert.ok(recs[0].score > recs[1].score);
  assert.equal(doesPropertyMatchPreferences(list[1], prefs), true);
  assert.equal(doesPropertyMatchPreferences(list[0], prefs), false);
});

test('validation helpers enforce Indian mobile numbers, valid emails, and required fields', () => {
  assert.equal(isValidPhone('9832012345'), true);
  assert.equal(isValidPhone('+91 98320 11223'), true);
  assert.equal(isValidPhone('+91-6000012345'), true);
  assert.equal(isValidPhone('7890123456'), true);
  assert.equal(isValidPhone('8123456789'), true);
  assert.equal(isValidPhone('5832012345'), false);
  assert.equal(isValidPhone('1234567890'), false);
  assert.equal(isValidPhone('983201234'), false);
  assert.equal(isValidPhone('919832012345'), false);
  assert.equal(isValidEmail('buyer@example.com'), true);
  assert.equal(isValidEmail('bad-email'), false);

  const inqErrs = validateInquiryFields({
    name: 'A',
    phone: '5123456789',
    email: 'bad',
    interested_in: '',
    message: 'hi',
  });
  assert.ok(inqErrs.fields.name);
  assert.equal(inqErrs.fields.phone, 'Enter a 10-digit mobile number.');
  assert.ok(inqErrs.fields.email);
  assert.ok(inqErrs.fields.message);

  assert.equal(
    validateInquiryInput({
      name: 'Anirban Sen',
      phone: '+91 98320 11223',
      email: '',
      interested_in: 'Property Buying',
      message: 'Interested in visiting properties near Sevoke Road.',
    }),
    null
  );

  assert.equal(
    validateAppointmentInput({
      customer_name: 'Riya Das',
      phone: '9832012345',
      email: '',
      property_id: 'p1',
      preferred_date: '2026-12-01',
      preferred_time: '11:00 AM',
    }),
    null
  );

  const apptErrs = validateAppointmentFields({
    customer_name: 'R',
    phone: '1234567890',
    email: 'wrong@',
    property_id: 'p1',
    preferred_date: '',
    preferred_time: '11:00 AM',
  });
  assert.ok(apptErrs.fields.customer_name);
  assert.equal(apptErrs.fields.phone, 'Enter a 10-digit mobile number.');
  assert.ok(apptErrs.fields.email);
  assert.ok(apptErrs.fields.preferred_date);

  const revErrs = validateReviewFields({
    reviewer_name: '',
    reviewer_email: 'not-email',
    rating: 5,
    review_text: 'Short',
  });
  assert.ok(revErrs.fields.reviewer_name);
  assert.ok(revErrs.fields.reviewer_email);
  assert.ok(revErrs.fields.review_text);
});

test('getPropertyGridSpanClass balances tablet and desktop rows without orphan cards', () => {
  assert.equal(getPropertyGridSpanClass(0, 1), 'md:col-span-2 lg:col-span-6');

  // 5 items: md spans item 0 across 2 cols (1 + 2 + 2); lg spans 3 cards (col-span-2) + 2 cards (col-span-3)
  assert.equal(getPropertyGridSpanClass(0, 5), 'md:col-span-2 lg:col-span-2');
  assert.equal(getPropertyGridSpanClass(2, 5), 'md:col-span-1 lg:col-span-2');
  assert.equal(getPropertyGridSpanClass(3, 5), 'md:col-span-1 lg:col-span-3');
  assert.equal(getPropertyGridSpanClass(4, 5), 'md:col-span-1 lg:col-span-3');

  // 4 items: even on md, 2x2 on lg
  assert.equal(getPropertyGridSpanClass(0, 4), 'md:col-span-1 lg:col-span-3');
  assert.equal(getPropertyGridSpanClass(3, 4), 'md:col-span-1 lg:col-span-3');

  // 6 items: 2x3 on md, 3x2 on lg
  assert.equal(getPropertyGridSpanClass(5, 6), 'md:col-span-1 lg:col-span-2');
});

test('saved search helpers generate concise labels and round-trip filters via URL query strings', () => {
  const filters = {
    query: 'terrace',
    listingType: 'Buy' as const,
    propertyType: 'Flats / Apartments',
    location: 'Sevoke Road',
    minPrice: 5000000,
    maxPrice: 10000000,
    minBedrooms: 3,
    furnishing: 'Semi-Furnished',
    sortBy: 'price_asc' as const,
  };

  const name = buildSavedSearchName(filters);
  assert.equal(
    name,
    'Buy · Flats · in Sevoke Road · 3+ BHK · ₹50 Lakh–₹1 Cr · Semi-Furnished · "terrace"'
  );

  const qs = buildSearchQueryString(filters);
  assert.ok(qs.includes('type=Buy'));
  assert.ok(qs.includes('location=Sevoke+Road'));
  assert.ok(qs.includes('minBedrooms=3'));
  assert.ok(qs.includes('furnishing=Semi-Furnished'));
  assert.ok(qs.includes('sort=price_asc'));

  const saved: SavedSearch = {
    id: 's1',
    user_id: 'u1',
    name,
    query: 'terrace',
    listing_type: 'Buy',
    property_type: 'Flats / Apartments',
    location: 'Sevoke Road',
    min_price: 5000000,
    max_price: 10000000,
    min_bedrooms: 3,
    furnishing: 'Semi-Furnished',
    sort_by: 'price_asc',
    created_at: '2026-11-20T00:00:00.000Z',
  };
  const roundTripped = savedSearchToFilters(saved);
  assert.equal(roundTripped.location, 'Sevoke Road');
  assert.equal(roundTripped.minBedrooms, 3);
  assert.equal(roundTripped.furnishing, 'Semi-Furnished');
  assert.equal(roundTripped.sortBy, 'price_asc');
  assert.equal(buildSavedSearchName({}), 'All active Siliguri properties');
});

test('formatRelativeTimeAgo outputs friendly relative durations', () => {
  const now = new Date('2026-11-23T12:00:00.000Z').getTime();
  assert.equal(formatRelativeTimeAgo('2026-11-23T11:59:45.000Z', now), 'Just now');
  assert.equal(formatRelativeTimeAgo('2026-11-23T11:45:00.000Z', now), '15 minutes ago');
  assert.equal(formatRelativeTimeAgo('2026-11-23T10:00:00.000Z', now), '2 hours ago');
  assert.equal(formatRelativeTimeAgo('2026-11-22T12:00:00.000Z', now), 'Yesterday');
  assert.equal(formatRelativeTimeAgo('2026-11-18T12:00:00.000Z', now), '5 days ago');
  assert.equal(formatRelativeTimeAgo('2025-10-01T12:00:00.000Z', now), '1 Oct 2025');
});

test('escapeCsvCell and buildEnquiriesCsv quote commas and newlines safely', () => {
  assert.equal(escapeCsvCell('Simple'), 'Simple');
  assert.equal(escapeCsvCell('Line 1, "BHK"\nLine 2'), '"Line 1, ""BHK""\nLine 2"');

  const csv = buildEnquiriesCsv([
    {
      kind: 'Enquiry',
      name: 'Anita Roy',
      phone: '+91 98320 00001',
      email: 'anita@example.com',
      subject: '3 BHK Flat, Sevoke Road',
      schedule: '',
      status: 'New',
      message: 'Please share "floor plan"',
      note: 'Call tomorrow',
      date: '22 Nov 2026',
    },
  ]);

  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('Type,Name,Phone'));
  assert.ok(lines[1].includes('"3 BHK Flat, Sevoke Road"'));
  assert.ok(lines[1].includes('"Please share ""floor plan"""'));
});

test('convertAreaInputToSqFt and formatAreaKatha convert Katha and sq ft cleanly', () => {
  assert.equal(SQFT_PER_KATHA, 720);
  assert.equal(convertAreaInputToSqFt('', 'katha'), 0);
  assert.equal(convertAreaInputToSqFt('-3', 'sqft'), 0);
  assert.equal(convertAreaInputToSqFt('1', 'katha'), 720);
  assert.equal(convertAreaInputToSqFt('2.5', 'katha'), 1800);
  assert.equal(convertAreaInputToSqFt('1350', 'sqft'), 1350);
  assert.equal(formatAreaKatha(1440), '2');
  assert.equal(formatAreaKatha(1800), '2.5');
  assert.equal(formatAreaKatha(0), '0');
});
