import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActiveFilterChips,
  buildSearchSuggestions,
  buildSmartPropertyFilters,
  collectUniqueLocations,
  countActiveFilters,
  formatPropertiesCount,
  QUICK_FILTER_CHIPS,
  SMART_BUDGET_RANGES,
  UNDER_50_LAKH_BUDGET_INDEX,
} from './searchHelpers.ts';
import { filterAndSortProperties } from './realtyLogic.ts';
import type { Property } from '../types/realty.ts';

const makeProp = (overrides: Partial<Property> = {}): Property => ({
  id: 'p1',
  slug: 'sevoke-road-3bhk',
  title: '3 BHK Contemporary Balcony Residence — Sevoke Road',
  description: 'Modern apartment near Sevoke Road.',
  price_inr: 6850000,
  listing_type: 'Buy',
  property_type: 'Flats / Apartments',
  location: 'Sevoke Road',
  address_detail: 'Ward 13, Siliguri',
  bedrooms: 3,
  bathrooms: 2,
  area_sqft: 1580,
  furnishing: 'Semi-Furnished',
  parking: '1 Covered Car Parking',
  status: 'Available',
  is_published: true,
  is_featured: true,
  is_demo: false,
  amenities: ['Lift'],
  images: [],
  created_at: '2026-10-05T10:00:00Z',
  updated_at: '2026-10-05T10:00:00Z',
  ...overrides,
});

test('collectUniqueLocations merges service locations and published active properties without duplicates', () => {
  const props: Property[] = [
    makeProp({ id: '1', location: 'Sevoke Road', is_published: true }),
    makeProp({ id: '2', location: 'Matigara', is_published: true }),
    makeProp({ id: '3', location: 'HiddenDraftArea', is_published: false }),
    makeProp({ id: '4', location: 'SoldOutArea', is_published: true, status: 'Sold' }),
  ];

  const locs = collectUniqueLocations(['Siliguri', 'Sevoke Road'], props);
  assert.deepEqual(locs, ['Siliguri', 'Sevoke Road', 'Matigara']);
});

test('buildSearchSuggestions returns matching real locations and published property titles, and empty array on no match', () => {
  const props: Property[] = [
    makeProp({
      id: '1',
      title: '3 BHK Contemporary Balcony Residence — Sevoke Road',
      location: 'Sevoke Road',
    }),
    makeProp({
      id: '2',
      title: 'Gated Residential Corner Plot — Haiderpara',
      location: 'Haiderpara',
      price_inr: 4400000,
      property_type: 'Residential Plots',
    }),
    makeProp({
      id: '3',
      title: 'Private Unpublished Villa',
      location: 'Sevoke Road',
      is_published: false,
    }),
  ];

  const emptyQuery = buildSearchSuggestions('   ', props, ['Siliguri', 'Sevoke Road']);
  assert.equal(emptyQuery.length, 0);

  const sevokeMatches = buildSearchSuggestions('sevoke', props, ['Siliguri', 'Sevoke Road']);
  assert.equal(sevokeMatches.some((s) => s.kind === 'location' && s.label === 'Sevoke Road'), true);
  assert.equal(
    sevokeMatches.some((s) => s.kind === 'property' && s.label.includes('Contemporary Balcony')),
    true
  );
  assert.equal(
    sevokeMatches.some((s) => s.label === 'Private Unpublished Villa'),
    false
  );

  const noMatch = buildSearchSuggestions('zzzznonexistent', props, ['Siliguri', 'Sevoke Road']);
  assert.equal(noMatch.length, 0);
});

test('quick filter chips map Under ₹50 Lakh accurately and buildActiveFilterChips reflects active state', () => {
  const under50Chip = QUICK_FILTER_CHIPS.find((c) => c.label === 'Under ₹50 Lakh');
  assert.ok(under50Chip);
  assert.equal(under50Chip.kind, 'budgetIdx');
  assert.equal(under50Chip.value, UNDER_50_LAKH_BUDGET_INDEX);
  assert.equal(SMART_BUDGET_RANGES[UNDER_50_LAKH_BUDGET_INDEX].max, 5000000);

  const props: Property[] = [
    makeProp({ id: '1', price_inr: 4400000, property_type: 'Residential Plots' }),
    makeProp({ id: '2', price_inr: 6850000, property_type: 'Flats / Apartments' }),
  ];

  const filters = buildSmartPropertyFilters({
    query: '',
    listing: 'Buy',
    location: 'All',
    propertyType: 'All',
    budgetIdx: UNDER_50_LAKH_BUDGET_INDEX,
  });
  const matched = filterAndSortProperties(props, filters, {
    publicOnly: true,
    allowClosedInAll: false,
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, '1');

  const chips = buildActiveFilterChips({
    query: 'Haiderpara',
    listing: 'Buy',
    location: 'Haiderpara',
    propertyType: 'Residential Plots',
    budgetIdx: UNDER_50_LAKH_BUDGET_INDEX,
  });
  assert.equal(chips.length, 5);
  assert.equal(countActiveFilters({
    query: 'Haiderpara',
    listing: 'Buy',
    location: 'Haiderpara',
    propertyType: 'Residential Plots',
    budgetIdx: UNDER_50_LAKH_BUDGET_INDEX,
  }), 5);
});

test('formatPropertiesCount formats singular and plural labels cleanly', () => {
  assert.equal(formatPropertiesCount(0), '0 properties');
  assert.equal(formatPropertiesCount(1), '1 property');
  assert.equal(formatPropertiesCount(12), '12 properties');
});
