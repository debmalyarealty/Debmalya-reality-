import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  Bookmark,
  Check,
  ChevronDown,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';
import {
  fetchPublicPropertiesWithMeta,
  getCachedPublicProperties,
  isPublicPropertiesCacheFresh,
  saveUserSearch,
} from '../lib/supabaseData';
import { DEMO_PROPERTIES } from '../lib/demoData';
import { goBackOrFallback, LUX_EASE } from '../lib/motion';
import {
  buildSavedSearchName,
  filterAndSortProperties,
  formatINRReadable,
} from '../lib/realtyLogic';
import { applyDocumentMeta, buildSiteMetaTags } from '../lib/metaTags';
import type { Property, PropertyFilters } from '../types/realty';
import { PropertyCard } from '../components/PropertyCard';
import { PropertyCardSkeleton } from '../components/PropertyCardSkeleton';
import { BackButton } from '../components/BackButton';

interface BudgetPreset {
  id: string;
  label: string;
  min: number | '';
  max: number | '';
}

const BUY_BUDGET_PRESETS: BudgetPreset[] = [
  { id: 'any', label: 'Any budget', min: '', max: '' },
  { id: 'under_50l', label: 'Under ₹50 Lakh', min: '', max: 5000000 },
  { id: '50l_1cr', label: '₹50 Lakh to ₹1 Cr', min: 5000000, max: 10000000 },
  { id: 'above_1cr', label: 'Above ₹1 Cr', min: 10000000, max: '' },
];

const RENT_BUDGET_PRESETS: BudgetPreset[] = [
  { id: 'any', label: 'Any budget', min: '', max: '' },
  { id: 'rent_under_25k', label: 'Under ₹25,000/mo', min: '', max: 25000 },
  {
    id: 'rent_25k_60k',
    label: '₹25,000 to ₹60,000/mo',
    min: 25000,
    max: 60000,
  },
  { id: 'rent_above_60k', label: 'Above ₹60,000/mo', min: 60000, max: '' },
];

const PROPERTY_TYPE_CHIPS = [
  { label: 'All', value: 'All' },
  { label: 'Flats', value: 'Flats / Apartments' },
  { label: 'Villas', value: 'Villas' },
  { label: 'Houses', value: 'Houses' },
  { label: 'Plots', value: 'Residential Plots' },
  { label: 'Land', value: 'Land' },
  { label: 'Commercial', value: 'Commercial Spaces' },
] as const;

const BEDROOM_CHIPS = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4+', value: 4 },
] as const;

const FURNISHING_CHIPS = [
  { label: 'Any', value: 'All' },
  { label: 'Furnished', value: 'Fully Furnished' },
  { label: 'Semi-furnished', value: 'Semi-Furnished' },
  { label: 'Unfurnished', value: 'Unfurnished' },
] as const;

const SORT_OPTIONS: Array<{
  value: NonNullable<PropertyFilters['sortBy']>;
  label: string;
}> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export const PropertiesPage: React.FC = () => {
  const { settings, user, openAuthModal, showToast } = useApp();
  const navigate = useNavigate();
  const prefersReduced = !!useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>(
    () => getCachedPublicProperties() ?? []
  );
  const [loading, setLoading] = useState(
    () => getCachedPublicProperties() === null
  );
  const [error, setError] = useState<string | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearchDone, setSavedSearchDone] = useState(false);
  const pendingSaveAfterAuthRef = useRef(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  const [filters, setFilters] = useState<PropertyFilters>(() => ({
    query: searchParams.get('q') || '',
    location: searchParams.get('location') || 'All',
    propertyType: searchParams.get('category') || 'All',
    listingType: (searchParams.get('type') as 'All' | 'Buy' | 'Rent') || 'All',
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : '',
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : '',
    minBedrooms: searchParams.get('minBedrooms')
      ? Number(searchParams.get('minBedrooms'))
      : '',
    minBathrooms: '',
    minArea: '',
    furnishing: searchParams.get('furnishing') || 'All',
    parking: 'All',
    status: 'ActiveOnly',
    sortBy: (searchParams.get('sort') as PropertyFilters['sortBy']) || 'newest',
  }));

  useEffect(() => {
    applyDocumentMeta(
      buildSiteMetaTags({
        title: 'Properties in Siliguri — Debmalya Realty',
        description:
          'Browse flats, villas, houses, residential plots, and commercial spaces for sale or rent across Siliguri, Sevoke Road, Bhanu Nagar, and Haiderpara.',
        pathname: '/properties',
        image: settings?.hero_image_url,
        siteName: settings?.business_name,
      })
    );
  }, [settings]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      query: searchParams.get('q') || '',
      location: searchParams.get('location') || 'All',
      propertyType: searchParams.get('category') || 'All',
      listingType:
        (searchParams.get('type') as 'All' | 'Buy' | 'Rent') || 'All',
      minPrice: searchParams.get('minPrice')
        ? Number(searchParams.get('minPrice'))
        : '',
      maxPrice: searchParams.get('maxPrice')
        ? Number(searchParams.get('maxPrice'))
        : '',
      minBedrooms: searchParams.get('minBedrooms')
        ? Number(searchParams.get('minBedrooms'))
        : '',
      furnishing: searchParams.get('furnishing') || 'All',
      sortBy:
        (searchParams.get('sort') as PropertyFilters['sortBy']) || 'newest',
    }));
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const cachedProps = getCachedPublicProperties();
    const forceRefresh = !isPublicPropertiesCacheFresh();
    if (cachedProps === null) {
      setLoading(true);
    }

    const slowTimer =
      cachedProps === null
        ? window.setTimeout(() => {
            if (!active) return;
            setProperties((prev) => {
              if (prev.length > 0) return prev;
              setLoading(false);
              return DEMO_PROPERTIES;
            });
          }, 2800)
        : undefined;

    fetchPublicPropertiesWithMeta({ force: forceRefresh })
      .then((res) => {
        if (!active) return;
        window.clearTimeout(slowTimer);
        setProperties(res.properties);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(slowTimer);
        setProperties((prev) => (prev.length > 0 ? prev : DEMO_PROPERTIES));
        setError(null);
      })
      .finally(() => {
        window.clearTimeout(slowTimer);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(slowTimer);
    };
  }, []);

  useEffect(() => {
    if (!sortOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSortOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sortOpen]);

  useEffect(() => {
    if (!moreFiltersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreFiltersOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreFiltersOpen]);

  const filtered = useMemo(
    () =>
      filterAndSortProperties(properties, filters, {
        publicOnly: true,
        allowClosedInAll: false,
      }),
    [properties, filters]
  );

  const resetFilters = () => {
    setFilters({
      query: '',
      location: 'All',
      propertyType: 'All',
      listingType: 'All',
      minPrice: '',
      maxPrice: '',
      minBedrooms: '',
      minBathrooms: '',
      minArea: '',
      furnishing: 'All',
      parking: 'All',
      status: 'ActiveOnly',
      sortBy: 'newest',
    });
    setSearchParams({});
  };

  const budgetPresets =
    filters.listingType === 'Rent' ? RENT_BUDGET_PRESETS : BUY_BUDGET_PRESETS;

  const matchedBudgetPreset = budgetPresets.find(
    (p) =>
      String(p.min) === String(filters.minPrice) &&
      String(p.max) === String(filters.maxPrice)
  );
  const hasCustomBudget =
    (filters.minPrice !== '' || filters.maxPrice !== '') && !matchedBudgetPreset;
  const activeBudgetId = matchedBudgetPreset
    ? matchedBudgetPreset.id
    : hasCustomBudget
    ? 'custom'
    : 'any';

  const handleListingTypeChange = (nextType: 'All' | 'Buy' | 'Rent') => {
    setFilters((prev) => {
      const switchingModes =
        (prev.listingType === 'Rent') !== (nextType === 'Rent');
      return {
        ...prev,
        listingType: nextType,
        ...(switchingModes ? { minPrice: '', maxPrice: '' } : {}),
      };
    });
  };

  const handleBudgetChange = (presetId: string) => {
    if (presetId === 'custom') return;
    const preset =
      budgetPresets.find((p) => p.id === presetId) || budgetPresets[0];
    setFilters((prev) => ({
      ...prev,
      minPrice: preset.min,
      maxPrice: preset.max,
    }));
  };

  const locations = settings?.locations || [
    'Siliguri',
    'Sevoke Road',
    'Bhanu Nagar',
    'Haiderpara',
    'Gugni More',
  ];

  const moreFiltersCount =
    (filters.minBedrooms !== '' ? 1 : 0) +
    (filters.furnishing && filters.furnishing !== 'All' ? 1 : 0);

  const activeChips: Array<{
    key: string;
    label: string;
    onRemove: () => void;
  }> = [];

  if (filters.query?.trim()) {
    activeChips.push({
      key: 'query',
      label: `Search: "${filters.query.trim()}"`,
      onRemove: () => setFilters((f) => ({ ...f, query: '' })),
    });
  }

  if (filters.listingType && filters.listingType !== 'All') {
    activeChips.push({
      key: 'listingType',
      label: filters.listingType,
      onRemove: () => handleListingTypeChange('All'),
    });
  }

  if (filters.propertyType && filters.propertyType !== 'All') {
    const typeLabel =
      PROPERTY_TYPE_CHIPS.find((t) => t.value === filters.propertyType)
        ?.label || filters.propertyType;
    activeChips.push({
      key: 'propertyType',
      label: typeLabel,
      onRemove: () => setFilters((f) => ({ ...f, propertyType: 'All' })),
    });
  }

  if (filters.location && filters.location !== 'All') {
    activeChips.push({
      key: 'location',
      label: filters.location,
      onRemove: () => setFilters((f) => ({ ...f, location: 'All' })),
    });
  }

  if (filters.minPrice !== '' || filters.maxPrice !== '') {
    let budgetLabel = matchedBudgetPreset?.label || '';
    if (!budgetLabel) {
      const lType = filters.listingType === 'Rent' ? 'Rent' : undefined;
      if (filters.minPrice !== '' && filters.maxPrice !== '') {
        budgetLabel = `${formatINRReadable(Number(filters.minPrice), lType)} – ${formatINRReadable(Number(filters.maxPrice), lType)}`;
      } else if (filters.minPrice !== '') {
        budgetLabel = `From ${formatINRReadable(Number(filters.minPrice), lType)}`;
      } else {
        budgetLabel = `Up to ${formatINRReadable(Number(filters.maxPrice), lType)}`;
      }
    }
    activeChips.push({
      key: 'budget',
      label: budgetLabel,
      onRemove: () => setFilters((f) => ({ ...f, minPrice: '', maxPrice: '' })),
    });
  }

  if (filters.minBedrooms !== '') {
    const beds = Number(filters.minBedrooms);
    activeChips.push({
      key: 'bedrooms',
      label: `${beds >= 4 ? '4+' : beds} BHK${beds < 4 ? '+' : ''}`,
      onRemove: () => setFilters((f) => ({ ...f, minBedrooms: '' })),
    });
  }

  if (filters.furnishing && filters.furnishing !== 'All') {
    const furnLabel =
      FURNISHING_CHIPS.find((c) => c.value === filters.furnishing)?.label ||
      filters.furnishing;
    activeChips.push({
      key: 'furnishing',
      label: furnLabel,
      onRemove: () => setFilters((f) => ({ ...f, furnishing: 'All' })),
    });
  }

  if (filters.sortBy && filters.sortBy !== 'newest') {
    const sortLabel =
      SORT_OPTIONS.find((s) => s.value === filters.sortBy)?.label ||
      filters.sortBy;
    activeChips.push({
      key: 'sortBy',
      label: sortLabel,
      onRemove: () => setFilters((f) => ({ ...f, sortBy: 'newest' })),
    });
  }

  const resultsTransitionKey = [
    filters.query,
    filters.listingType,
    filters.propertyType,
    filters.location,
    filters.minPrice,
    filters.maxPrice,
    filters.minBedrooms,
    filters.furnishing,
    filters.sortBy,
  ].join('|');

  useEffect(() => {
    setSavedSearchDone(false);
  }, [resultsTransitionKey]);

  const performSaveSearch = async () => {
    if (!user) return;
    setSavingSearch(true);
    try {
      await saveUserSearch(user.id, {
        name: buildSavedSearchName(filters),
        query: filters.query || '',
        listing_type: filters.listingType || 'All',
        property_type: filters.propertyType || 'All',
        location: filters.location || 'All',
        min_price: filters.minPrice !== '' ? Number(filters.minPrice) : null,
        max_price: filters.maxPrice !== '' ? Number(filters.maxPrice) : null,
        min_bedrooms:
          filters.minBedrooms !== '' ? Number(filters.minBedrooms) : null,
        furnishing: filters.furnishing || 'All',
        sort_by: filters.sortBy || 'newest',
      });
      setSavedSearchDone(true);
      showToast('Search saved', 'saved');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to save search right now.',
        'error'
      );
    } finally {
      setSavingSearch(false);
    }
  };

  useEffect(() => {
    if (user && pendingSaveAfterAuthRef.current) {
      pendingSaveAfterAuthRef.current = false;
      void performSaveSearch();
    }
  }, [user]);

  const handleSaveSearchClick = () => {
    if (!user) {
      pendingSaveAfterAuthRef.current = true;
      openAuthModal('login');
      return;
    }
    void performSaveSearch();
  };

  const countText = `${filtered.length} ${
    filtered.length === 1 ? 'property' : 'properties'
  }`;

  return (
    <main className="pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pb-16 fluid-container min-h-[80svh]">
      <div className="relative z-10 flex items-center justify-between gap-3 mb-3 sm:mb-5">
        <BackButton
          onClick={() => {
            setMoreFiltersOpen(false);
            setSortOpen(false);
            goBackOrFallback(navigate, '/', {
              skipPathPrefixes: ['/properties'],
            });
          }}
        />
      </div>

      <div className="mb-4 sm:mb-6">
        <h1 className="font-display text-[clamp(1.875rem,4.5vw,3rem)] font-medium text-[var(--text-primary)] leading-tight break-anywhere">
          Browse properties
        </h1>
      </div>

      {/* Compact Editorial Filter Panel */}
      <section
        aria-label="Property Filters"
        className="mb-5 sm:mb-7 rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)] shadow-[var(--shadow-subtle)] border border-[var(--border-hairline)] p-[clamp(0.875rem,2.5vw,1.25rem)] space-y-3"
      >
        {/* Row 1: Search Box + All / Buy / Rent Chips */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              id="filter-q"
              type="text"
              value={filters.query || ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, query: e.target.value }))
              }
              aria-label="Search area or property"
              placeholder="Search area or property"
              className="w-full min-h-[44px] pl-10 pr-12 rounded-full border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base font-medium text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, query: '' }))}
                aria-label="Clear search"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Buy or rent filter"
            className="grid grid-cols-3 sm:inline-flex items-center gap-1.5 p-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-hairline)] shrink-0"
          >
            {(['All', 'Buy', 'Rent'] as const).map((mode) => {
              const selected = (filters.listingType || 'All') === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleListingTypeChange(mode)}
                  aria-pressed={selected}
                  className={`tap-press min-h-[44px] px-4 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
                    selected
                      ? 'bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Horizontally Scrollable Property Type Chips */}
        <div
          role="group"
          aria-label="Property type"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 -mx-0.5 px-0.5"
        >
          {PROPERTY_TYPE_CHIPS.map((chip) => {
            const selected = (filters.propertyType || 'All') === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() =>
                  setFilters((f) => ({ ...f, propertyType: chip.value }))
                }
                aria-pressed={selected}
                className={`tap-press shrink-0 min-h-[44px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition-all cursor-pointer border ${
                  selected
                    ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold shadow-sm'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Row 3: Location & Budget Side-by-Side + More filters & Sort Buttons */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
          <div className="col-span-1 lg:col-span-4 min-w-0">
            <label
              htmlFor="filter-location"
              className="block text-[13px] font-medium text-[var(--text-muted)] mb-1 px-1"
            >
              Location
            </label>
            <div className="relative">
              <select
                id="filter-location"
                value={filters.location || 'All'}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, location: e.target.value }))
                }
                className="w-full min-h-[44px] pl-3.5 pr-8 rounded-full border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base font-medium text-[var(--text-primary)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent-primary)] transition-colors truncate"
              >
                <option value="All">All locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
            </div>
          </div>

          <div className="col-span-1 lg:col-span-4 min-w-0">
            <label
              htmlFor="filter-budget"
              className="block text-[13px] font-medium text-[var(--text-muted)] mb-1 px-1"
            >
              Budget
            </label>
            <div className="relative">
              <select
                id="filter-budget"
                value={activeBudgetId}
                onChange={(e) => handleBudgetChange(e.target.value)}
                className="w-full min-h-[44px] pl-3.5 pr-8 rounded-full border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base font-medium text-[var(--text-primary)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent-primary)] transition-colors truncate"
              >
                {budgetPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
                {hasCustomBudget && (
                  <option value="custom">Custom range</option>
                )}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
            </div>
          </div>

          <div className="min-[420px]:col-span-2 lg:col-span-4 flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMoreFiltersOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreFiltersOpen}
              className={`tap-press flex-1 min-w-0 min-h-[44px] px-3 min-[360px]:px-4 rounded-full text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-all cursor-pointer border whitespace-nowrap ${
                moreFiltersCount > 0
                  ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold shadow-sm'
                  : 'bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span className="truncate">More filters</span>
              {moreFiltersCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--cta-gold-ink)] text-[var(--cta-gold-bg)] text-[13px] font-semibold tabular-nums shrink-0">
                  {moreFiltersCount}
                </span>
              )}
            </button>

            <div ref={sortRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                className={`tap-press min-h-[44px] px-3 min-[360px]:px-4 rounded-full text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-all cursor-pointer border whitespace-nowrap ${
                  filters.sortBy && filters.sortBy !== 'newest'
                    ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold shadow-sm'
                    : 'bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)]'
                }`}
              >
                <ArrowUpDown className="w-4 h-4 shrink-0" />
                <span>Sort</span>
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    role="listbox"
                    aria-label="Sort properties"
                    initial={
                      prefersReduced
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.96, y: -4 }
                    }
                    animate={
                      prefersReduced
                        ? { opacity: 1 }
                        : { opacity: 1, scale: 1, y: 0 }
                    }
                    exit={
                      prefersReduced
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.96, y: -4 }
                    }
                    transition={{ duration: 0.18, ease: LUX_EASE }}
                    className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-2rem)] max-h-[min(90dvh,22rem)] overflow-y-auto z-30 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-elevated)] p-1.5 space-y-1"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const active = (filters.sortBy || 'newest') === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setFilters((f) => ({ ...f, sortBy: opt.value }));
                            setSortOpen(false);
                          }}
                          className={`w-full min-h-[44px] px-3.5 rounded-xl text-[13px] font-medium flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[var(--bg-surface-muted)] text-[var(--accent-primary)] font-semibold'
                              : 'text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {active && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Results Count + Active Removable Filter Chips + Save Search */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums mr-1">
          {loading ? 'Loading properties...' : countText}
        </p>

        {activeChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove ${chip.label} filter`}
            className="tap-press max-w-full min-h-[44px] px-3.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-strong)] text-[13px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="truncate">{chip.label}</span>
            <X className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          </button>
        ))}

        <button
          type="button"
          disabled={savingSearch}
          onClick={handleSaveSearchClick}
          className={`tap-press ml-auto min-h-[44px] px-4 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer border ${
            savedSearchDone
              ? 'bg-[var(--bg-surface)] border-emerald-500/45 text-emerald-500'
              : 'bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)]'
          }`}
        >
          {savingSearch ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)]" />
          ) : savedSearchDone ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Bookmark className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          )}
          <span>{savedSearchDone ? 'Search saved' : 'Save Search'}</span>
        </button>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="fluid-grid-cards">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <PropertyCardSkeleton key={idx} className="h-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-rose-500 font-medium">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          key={`empty-${resultsTransitionKey}`}
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: LUX_EASE }}
          className="rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)] shadow-[var(--shadow-subtle)] p-[clamp(1.5rem,4vw,3rem)] text-center space-y-4"
        >
          <p className="font-display text-2xl sm:text-3xl font-medium text-[var(--text-primary)]">
            No properties match. Try changing your filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold cursor-pointer"
          >
            Clear filters
          </button>
        </motion.div>
      ) : (
        <motion.div
          key={resultsTransitionKey}
          initial={prefersReduced ? false : { opacity: 0.45 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, ease: LUX_EASE }}
          className="fluid-grid-cards"
        >
          {filtered.map((prop) => (
            <PropertyCard key={prop.id} property={prop} className="h-full" />
          ))}
        </motion.div>
      )}

      {/* More Filters: Bottom Sheet on Mobile, Centered Modal on Desktop */}
      <AnimatePresence>
        {moreFiltersOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="More property filters"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: LUX_EASE }}
            onClick={() => setMoreFiltersOpen(false)}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:p-4"
          >
            <motion.div
              initial={
                prefersReduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              animate={
                prefersReduced
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                prefersReduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              transition={{ duration: 0.26, ease: LUX_EASE }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-[clamp(1.25rem,3vw,1.75rem)] sm:rounded-[28px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-elevated)] p-[clamp(1.25rem,3vw,1.5rem)] pl-[max(clamp(1.25rem,3vw,1.5rem),env(safe-area-inset-left,0px))] pr-[max(clamp(1.25rem,3vw,1.5rem),env(safe-area-inset-right,0px))] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] space-y-6"
            >
              <div>
                <div className="sm:hidden w-10 h-1 rounded-full bg-[var(--border-input)] mx-auto mb-3" />
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-2xl sm:text-3xl font-medium text-[var(--text-primary)]">
                    More filters
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMoreFiltersOpen(false)}
                    aria-label="Close more filters"
                    className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--border-strong)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bedrooms */}
              <div className="space-y-2.5">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">
                  Bedrooms
                </p>
                <div
                  role="group"
                  aria-label="Bedrooms"
                  className="flex flex-wrap gap-2"
                >
                  {BEDROOM_CHIPS.map((b) => {
                    const selected = Number(filters.minBedrooms) === b.value;
                    return (
                      <button
                        key={b.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            minBedrooms: selected ? '' : b.value,
                          }))
                        }
                        className={`tap-press min-h-[44px] min-w-[60px] px-4 rounded-full text-[13px] font-medium transition-all cursor-pointer border ${
                          selected
                            ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold shadow-sm'
                            : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Furnishing */}
              <div className="space-y-2.5">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">
                  Furnishing
                </p>
                <div
                  role="group"
                  aria-label="Furnishing"
                  className="flex flex-wrap gap-2"
                >
                  {FURNISHING_CHIPS.map((item) => {
                    const selected =
                      (filters.furnishing || 'All') === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setFilters((f) => ({ ...f, furnishing: item.value }))
                        }
                        className={`tap-press min-h-[44px] px-4 rounded-full text-[13px] font-medium transition-all cursor-pointer border ${
                          selected
                            ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold shadow-sm'
                            : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer CTA + Clear */}
              <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      minBedrooms: '',
                      furnishing: 'All',
                    }))
                  }
                  className="min-h-[44px] px-3 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] underline-offset-4 hover:underline cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setMoreFiltersOpen(false)}
                  className="btn-primary-lux flex-1 min-h-[48px] px-6 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold tabular-nums cursor-pointer"
                >
                  Show {countText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};
