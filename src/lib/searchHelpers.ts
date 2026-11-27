import type { Property, PropertyFilters } from '../types/realty.ts';
import { isPropertyActiveOpportunity } from './realtyLogic.ts';

export interface SmartBudgetRange {
  label: string;
  min: number | '';
  max: number | '';
}

export const SMART_BUDGET_RANGES: readonly SmartBudgetRange[] = [
  { label: 'Any budget', min: '', max: '' },
  { label: 'Up to ₹30 Lakh', min: '', max: 3000000 },
  { label: 'Under ₹50 Lakh', min: '', max: 5000000 },
  { label: '₹30L – ₹60 Lakh', min: 3000000, max: 6000000 },
  { label: '₹60L – ₹1 Crore', min: 6000000, max: 10000000 },
  { label: 'Above ₹1 Crore', min: 10000000, max: '' },
  { label: 'Rent up to ₹25,000/mo', min: '', max: 25000 },
  { label: 'Rent ₹25,000 – ₹60,000/mo', min: 25000, max: 60000 },
];

export const UNDER_50_LAKH_BUDGET_INDEX = 2;

export type QuickFilterChip =
  | {
      id: string;
      label: string;
      kind: 'propertyType';
      value: string;
    }
  | {
      id: string;
      label: string;
      kind: 'budgetIdx';
      value: number;
    };

export const QUICK_FILTER_CHIPS: readonly QuickFilterChip[] = [
  { id: 'flats', label: 'Flats', kind: 'propertyType', value: 'Flats / Apartments' },
  { id: 'villas', label: 'Villas', kind: 'propertyType', value: 'Villas' },
  { id: 'houses', label: 'Houses', kind: 'propertyType', value: 'Houses' },
  { id: 'plots', label: 'Plots', kind: 'propertyType', value: 'Residential Plots' },
  {
    id: 'under-50l',
    label: 'Under ₹50 Lakh',
    kind: 'budgetIdx',
    value: UNDER_50_LAKH_BUDGET_INDEX,
  },
];

export interface SearchSuggestion {
  id: string;
  kind: 'location' | 'property';
  label: string;
  subtitle: string;
}

export interface SmartSearchState {
  query: string;
  listing: 'All' | 'Buy' | 'Rent';
  location: string;
  propertyType: string;
  budgetIdx: number;
}

export type ActiveFilterChipKey =
  | 'query'
  | 'listing'
  | 'location'
  | 'propertyType'
  | 'budget';

export interface ActiveFilterChip {
  key: ActiveFilterChipKey;
  label: string;
}

export function collectUniqueLocations(
  serviceLocations: readonly string[] = [],
  properties: readonly Property[] = []
): string[] {
  const seen = new Map<string, string>();
  const addLoc = (raw: string | undefined | null) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, trimmed);
    }
  };

  for (const loc of serviceLocations) {
    addLoc(loc);
  }
  for (const prop of properties) {
    if (!prop.is_published || !isPropertyActiveOpportunity(prop.status)) continue;
    addLoc(prop.location);
  }

  return Array.from(seen.values());
}

export function buildSearchSuggestions(
  query: string,
  properties: readonly Property[],
  serviceLocations: readonly string[] = []
): SearchSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const publishedActive = properties.filter(
    (p) => p.is_published && isPropertyActiveOpportunity(p.status)
  );

  const uniqueLocations = collectUniqueLocations(serviceLocations, publishedActive);
  const matchingLocations = uniqueLocations
    .filter((loc) => loc.toLowerCase().includes(q))
    .sort((a, b) => {
      const aPrefix = a.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.toLowerCase().startsWith(q) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.localeCompare(b);
    })
    .slice(0, 4)
    .map<SearchSuggestion>((loc) => ({
      id: `loc-${loc.toLowerCase()}`,
      kind: 'location',
      label: loc,
      subtitle: 'Locality',
    }));

  const seenTitles = new Set<string>();
  const matchingProperties = publishedActive
    .filter((prop) => {
      const titleMatch = prop.title.toLowerCase().includes(q);
      const locMatch = prop.location.toLowerCase().includes(q);
      const addrMatch = (prop.address_detail || '').toLowerCase().includes(q);
      return titleMatch || locMatch || addrMatch;
    })
    .sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(q) ? 0 : 1;
      const bTitle = b.title.toLowerCase().includes(q) ? 0 : 1;
      if (aTitle !== bTitle) return aTitle - bTitle;
      return a.title.localeCompare(b.title);
    })
    .filter((prop) => {
      const key = prop.title.trim().toLowerCase();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .slice(0, 5)
    .map<SearchSuggestion>((prop) => ({
      id: `prop-${prop.id}`,
      kind: 'property',
      label: prop.title,
      subtitle: `${prop.location} · ${prop.listing_type}`,
    }));

  return [...matchingLocations, ...matchingProperties].slice(0, 8);
}

export function buildSmartPropertyFilters(state: SmartSearchState): PropertyFilters {
  const budget = SMART_BUDGET_RANGES[state.budgetIdx] || SMART_BUDGET_RANGES[0];
  return {
    query: state.query.trim(),
    listingType: state.listing,
    location: state.location,
    propertyType: state.propertyType,
    minPrice: budget.min,
    maxPrice: budget.max,
    status: 'ActiveOnly',
    sortBy: 'newest',
  };
}

export function buildActiveFilterChips(state: SmartSearchState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (state.query.trim()) {
    chips.push({
      key: 'query',
      label: state.query.trim(),
    });
  }
  if (state.listing !== 'All') {
    chips.push({
      key: 'listing',
      label: state.listing,
    });
  }
  if (state.location !== 'All') {
    chips.push({
      key: 'location',
      label: state.location,
    });
  }
  if (state.propertyType !== 'All') {
    chips.push({
      key: 'propertyType',
      label: state.propertyType,
    });
  }
  if (state.budgetIdx > 0 && SMART_BUDGET_RANGES[state.budgetIdx]) {
    chips.push({
      key: 'budget',
      label: SMART_BUDGET_RANGES[state.budgetIdx].label,
    });
  }

  return chips;
}

export function countActiveFilters(state: SmartSearchState): number {
  return buildActiveFilterChips(state).length;
}

export function formatPropertiesCount(count: number): string {
  return `${count} ${count === 1 ? 'property' : 'properties'}`;
}
