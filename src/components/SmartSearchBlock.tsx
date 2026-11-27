import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { LUX_EASE } from '../lib/motion';
import type { Property } from '../types/realty';
import {
  buildActiveFilterChips,
  buildSearchSuggestions,
  formatPropertiesCount,
  QUICK_FILTER_CHIPS,
  SMART_BUDGET_RANGES,
  type ActiveFilterChipKey,
  type SearchSuggestion,
  type SmartSearchState,
} from '../lib/searchHelpers';

interface SmartSearchBlockProps {
  searchState: SmartSearchState;
  onChangeState: React.Dispatch<React.SetStateAction<SmartSearchState>>;
  onSearchSubmit: (overrideState?: SmartSearchState) => void;
  onClearAll: () => void;
  activeProperties: Property[];
  serviceLocations: string[];
  propertyTypes: string[];
  liveMatchingCount: number;
  prefersReduced: boolean;
}

export const SmartSearchBlock: React.FC<SmartSearchBlockProps> = ({
  searchState,
  onChangeState,
  onSearchSubmit,
  onClearAll,
  activeProperties,
  serviceLocations,
  propertyTypes,
  liveMatchingCount,
  prefersReduced,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dropdownTarget, setDropdownTarget] = useState<
    'mobile' | 'desktop' | null
  >(null);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [sheetDragY, setSheetDragY] = useState(0);

  const mobileCardRef = useRef<HTMLDivElement>(null);
  const desktopCardRef = useRef<HTMLFormElement>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeStartTimeRef = useRef<number>(0);

  const mobileListboxId = useId();
  const desktopListboxId = useId();

  const suggestions = useMemo(
    () =>
      buildSearchSuggestions(
        searchState.query,
        activeProperties,
        serviceLocations
      ),
    [searchState.query, activeProperties, serviceLocations]
  );

  const activeChips = useMemo(
    () => buildActiveFilterChips(searchState),
    [searchState]
  );

  // Close suggestions dropdown on outside click
  useEffect(() => {
    if (!dropdownTarget) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const inMobile = mobileCardRef.current?.contains(target);
      const inDesktop = desktopCardRef.current?.contains(target);
      if (!inMobile && !inDesktop) {
        setDropdownTarget(null);
        setHighlightedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [dropdownTarget]);

  // Body scroll lock & Escape handler for Filters bottom sheet
  useEffect(() => {
    if (!sheetOpen) {
      setSheetDragY(0);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sheetOpen]);

  const hasQueryText = searchState.query.trim().length > 0;
  const showMobileDropdown = dropdownTarget === 'mobile' && hasQueryText;
  const showDesktopDropdown = dropdownTarget === 'desktop' && hasQueryText;

  const handleToggleListing = (mode: 'Buy' | 'Rent') => {
    onChangeState((prev) => ({
      ...prev,
      listing: prev.listing === mode ? 'All' : mode,
    }));
  };

  const handleToggleQuickChip = (
    chip: (typeof QUICK_FILTER_CHIPS)[number]
  ) => {
    onChangeState((prev) => {
      if (chip.kind === 'propertyType') {
        return {
          ...prev,
          propertyType: prev.propertyType === chip.value ? 'All' : chip.value,
        };
      }
      return {
        ...prev,
        budgetIdx: prev.budgetIdx === chip.value ? 0 : chip.value,
      };
    });
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    const nextState: SmartSearchState = {
      ...searchState,
      query: suggestion.label,
    };
    onChangeState(nextState);
    setDropdownTarget(null);
    setHighlightedIdx(-1);
    onSearchSubmit(nextState);
  };

  const handleRemoveChip = (key: ActiveFilterChipKey) => {
    onChangeState((prev) => {
      switch (key) {
        case 'query':
          return { ...prev, query: '' };
        case 'listing':
          return { ...prev, listing: 'All' };
        case 'location':
          return { ...prev, location: 'All' };
        case 'propertyType':
          return { ...prev, propertyType: 'All' };
        case 'budget':
          return { ...prev, budgetIdx: 0 };
        default:
          return prev;
      }
    });
  };

  const handleInputChange = (
    value: string,
    target: 'mobile' | 'desktop'
  ) => {
    onChangeState((prev) => ({ ...prev, query: value }));
    setHighlightedIdx(-1);
    setDropdownTarget(value.trim().length > 0 ? target : null);
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    isDropdownVisible: boolean
  ) => {
    if (e.key === 'Escape') {
      setDropdownTarget(null);
      setHighlightedIdx(-1);
      return;
    }
    if (isDropdownVisible && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIdx((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIdx((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }
      if (
        e.key === 'Enter' &&
        highlightedIdx >= 0 &&
        suggestions[highlightedIdx]
      ) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightedIdx]);
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      setDropdownTarget(null);
      setHighlightedIdx(-1);
      onSearchSubmit();
    }
  };

  // Swipe-down gesture handlers for bottom sheet (supports both touch & pointer drag)
  const handlePointerDownSheet = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement)?.closest('button')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    swipeStartYRef.current = e.clientY;
    swipeStartTimeRef.current = Date.now();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable in synthetic test environments
    }
  };

  const handlePointerMoveSheet = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartYRef.current === null) return;
    const delta = e.clientY - swipeStartYRef.current;
    if (delta > 0) {
      setSheetDragY(prefersReduced ? 0 : Math.min(delta, 220));
    } else {
      setSheetDragY(0);
    }
  };

  const handlePointerEndSheet = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartYRef.current === null) return;
    const delta = e.clientY - swipeStartYRef.current;
    const elapsed = Math.max(1, Date.now() - swipeStartTimeRef.current);
    const velocity = delta / elapsed; // px per ms
    swipeStartYRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    if (delta > 64 || (delta > 24 && velocity > 0.4)) {
      setSheetOpen(false);
    }
    setSheetDragY(0);
  };

  const renderSuggestionsDropdown = (listboxId: string, isVisible: boolean) => {
    if (!isVisible) return null;
    return (
      <div
        id={listboxId}
        role="listbox"
        aria-label="Search suggestions"
        data-testid="search-suggestions-dropdown"
        className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-surface)] shadow-[0_12px_28px_-8px_rgba(28,26,23,0.18)] dark:shadow-[0_14px_34px_-8px_rgba(0,0,0,0.52)] max-h-[264px] overflow-y-auto"
      >
        {suggestions.length === 0 ? (
          <div
            role="status"
            className="px-3.5 py-3 text-sm font-medium text-[var(--text-secondary)]"
          >
            No match. Try another locality.
          </div>
        ) : (
          suggestions.map((item, idx) => {
            const isHighlighted = idx === highlightedIdx;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  // Prevent input blur before selection fires
                  e.preventDefault();
                }}
                onClick={() => handleSelectSuggestion(item)}
                className={`w-full min-h-[44px] px-3.5 py-2 text-left flex items-center gap-2.5 border-b last:border-b-0 border-[var(--border-hairline)] transition-colors motion-reduce:transition-none cursor-pointer ${
                  isHighlighted
                    ? 'bg-[var(--bg-secondary)]'
                    : 'hover:bg-[var(--bg-secondary)]'
                }`}
              >
                {item.kind === 'location' ? (
                  <MapPin
                    className="w-4 h-4 shrink-0 text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Building2
                    className="w-4 h-4 shrink-0 text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {item.label}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    );
  };

  return (
    <motion.section
      id="search"
      aria-label="Property search"
      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, ease: LUX_EASE }}
      className="fluid-container relative z-20 pt-3 pb-2 md:pt-7 md:pb-3 scroll-mt-24"
    >
      <h2 className="sr-only">Search properties</h2>

      {/* ─── PHONES (< 768px): ONE COMPACT ~150px CARD ────────────────────── */}
      <div
        ref={mobileCardRef}
        data-testid="mobile-smart-search-card"
        className="md:hidden relative rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-input)] shadow-[0_4px_16px_-6px_rgba(28,26,23,0.08)] dark:shadow-[0_6px_20px_-6px_rgba(0,0,0,0.34)] p-[6px]"
      >
        {/* Row 1: Buy | Rent switch (44px high) */}
        <div
          role="group"
          aria-label="Buy or rent"
          className="h-[44px] grid grid-cols-2 p-[3px] rounded-[12px] border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
        >
          <button
            type="button"
            aria-pressed={searchState.listing === 'Buy'}
            onClick={() => handleToggleListing('Buy')}
            className={`tap-press h-full rounded-[9px] text-sm font-semibold inline-flex items-center justify-center transition-colors motion-reduce:transition-none cursor-pointer ${
              searchState.listing === 'Buy'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            aria-pressed={searchState.listing === 'Rent'}
            onClick={() => handleToggleListing('Rent')}
            className={`tap-press h-full rounded-[9px] text-sm font-semibold inline-flex items-center justify-center transition-colors motion-reduce:transition-none cursor-pointer ${
              searchState.listing === 'Rent'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Rent
          </button>
        </div>

        {/* Row 2: Search input (52px high, 12px radius, 16px text) + Filters button */}
        <div className="relative mt-[5px] flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              id="mobile-smart-search-input"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              role="combobox"
              aria-expanded={showMobileDropdown}
              aria-controls={mobileListboxId}
              aria-autocomplete="list"
              aria-label="Search locality or property"
              value={searchState.query}
              onFocus={() => {
                if (hasQueryText) {
                  setDropdownTarget('mobile');
                }
              }}
              onChange={(e) => handleInputChange(e.target.value, 'mobile')}
              onKeyDown={(e) => handleInputKeyDown(e, showMobileDropdown)}
              placeholder="Search locality or property"
              className="w-full h-[52px] pl-9 pr-8 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base font-medium text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--accent-primary)] transition-colors motion-reduce:transition-none"
            />
            {searchState.query && (
              <button
                type="button"
                aria-label="Clear search text"
                onClick={() => {
                  onChangeState((prev) => ({ ...prev, query: '' }));
                  setDropdownTarget(null);
                }}
                className="tap-press absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="mobile-smart-search-trigger"
            aria-label="Filters"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => {
              setDropdownTarget(null);
              setSheetOpen(true);
            }}
            className={`tap-press relative h-[52px] shrink-0 px-3 rounded-[12px] border inline-flex items-center justify-center gap-1.5 transition-colors motion-reduce:transition-none cursor-pointer ${
              activeChips.length > 0
                ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                : 'border-[var(--border-input)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]'
            }`}
          >
            <SlidersHorizontal
              className="w-4 h-4 shrink-0 text-[var(--accent-primary)]"
              aria-hidden="true"
            />
            <span className="hidden min-[390px]:inline text-sm font-medium">
              Filters
            </span>
            {activeChips.length > 0 && (
              <span
                aria-hidden="true"
                className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-[11px] font-semibold inline-flex items-center justify-center tabular-nums"
              >
                {activeChips.length}
              </span>
            )}
          </button>

          {renderSuggestionsDropdown(mobileListboxId, showMobileDropdown)}
        </div>

        {/* Row 3: Horizontally scrollable quick filter chips */}
        <div
          role="group"
          aria-label="Quick property filters"
          className="mt-[5px] flex items-center gap-1.5 overflow-x-auto no-scrollbar"
        >
          {QUICK_FILTER_CHIPS.map((chip) => {
            const isSelected =
              chip.kind === 'propertyType'
                ? searchState.propertyType === chip.value
                : searchState.budgetIdx === chip.value;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleToggleQuickChip(chip)}
                className={`tap-press h-[30px] px-2.5 rounded-[12px] border text-[13px] font-medium whitespace-nowrap shrink-0 inline-flex items-center justify-center transition-colors motion-reduce:transition-none cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)] font-semibold'
                    : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--border-input)] hover:text-[var(--text-primary)]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TABLETS & DESKTOPS (>= 768px): ONE ALIGNED 48px ROW CARD ──────── */}
      <form
        ref={desktopCardRef}
        data-testid="desktop-smart-search-card"
        onSubmit={(e) => {
          e.preventDefault();
          setDropdownTarget(null);
          onSearchSubmit();
        }}
        className="hidden md:flex items-center gap-1.5 lg:gap-2 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-input)] shadow-[0_4px_18px_-6px_rgba(28,26,23,0.08)] dark:shadow-[0_6px_22px_-6px_rgba(0,0,0,0.34)] p-2"
      >
        {/* 1. Buy | Rent switch (48px) */}
        <div
          role="group"
          aria-label="Buy or rent"
          className="h-12 w-[104px] lg:w-[118px] shrink-0 grid grid-cols-2 p-[3px] rounded-[12px] border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
        >
          <button
            type="button"
            aria-pressed={searchState.listing === 'Buy'}
            onClick={() => handleToggleListing('Buy')}
            className={`tap-press h-full rounded-[9px] text-sm font-semibold inline-flex items-center justify-center transition-colors motion-reduce:transition-none cursor-pointer ${
              searchState.listing === 'Buy'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            aria-pressed={searchState.listing === 'Rent'}
            onClick={() => handleToggleListing('Rent')}
            className={`tap-press h-full rounded-[9px] text-sm font-semibold inline-flex items-center justify-center transition-colors motion-reduce:transition-none cursor-pointer ${
              searchState.listing === 'Rent'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Rent
          </button>
        </div>

        {/* 2. Search input with live suggestions dropdown (48px) */}
        <div className="relative flex-[1.45] min-w-[150px]">
          <Search
            aria-hidden="true"
            className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            id="desktop-smart-search-input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            role="combobox"
            aria-expanded={showDesktopDropdown}
            aria-controls={desktopListboxId}
            aria-autocomplete="list"
            aria-label="Search locality or property"
            value={searchState.query}
            onFocus={() => {
              if (hasQueryText) {
                setDropdownTarget('desktop');
              }
            }}
            onChange={(e) => handleInputChange(e.target.value, 'desktop')}
            onKeyDown={(e) => handleInputKeyDown(e, showDesktopDropdown)}
            placeholder="Search locality or property"
            className="w-full h-12 pl-9 pr-8 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base font-medium text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--accent-primary)] transition-colors motion-reduce:transition-none"
          />
          {searchState.query && (
            <button
              type="button"
              aria-label="Clear search text"
              onClick={() => {
                onChangeState((prev) => ({ ...prev, query: '' }));
                setDropdownTarget(null);
              }}
              className="tap-press absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {renderSuggestionsDropdown(desktopListboxId, showDesktopDropdown)}
        </div>

        {/* 3. Location dropdown (48px) */}
        <div className="relative flex-1 min-w-[100px] max-w-[160px]">
          <select
            id="search-location"
            aria-label="Location"
            value={searchState.location}
            onChange={(e) =>
              onChangeState((prev) => ({ ...prev, location: e.target.value }))
            }
            className="w-full h-12 pl-3 pr-7 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base font-medium text-[var(--text-primary)] appearance-none cursor-pointer truncate focus:border-[var(--accent-primary)] transition-colors motion-reduce:transition-none"
          >
            <option value="All" className="bg-[var(--bg-surface)]">
              Location
            </option>
            {serviceLocations.map((loc) => (
              <option
                key={loc}
                value={loc}
                className="bg-[var(--bg-surface)]"
              >
                {loc}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="w-4 h-4 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        </div>

        {/* 4. Type dropdown (48px) */}
        <div className="relative flex-1 min-w-[96px] max-w-[165px]">
          <select
            id="search-type"
            aria-label="Property type"
            value={searchState.propertyType}
            onChange={(e) =>
              onChangeState((prev) => ({
                ...prev,
                propertyType: e.target.value,
              }))
            }
            className="w-full h-12 pl-3 pr-7 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base font-medium text-[var(--text-primary)] appearance-none cursor-pointer truncate focus:border-[var(--accent-primary)] transition-colors motion-reduce:transition-none"
          >
            <option value="All" className="bg-[var(--bg-surface)]">
              Type
            </option>
            {propertyTypes.map((t) => (
              <option
                key={t}
                value={t}
                className="bg-[var(--bg-surface)]"
              >
                {t}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="w-4 h-4 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        </div>

        {/* 5. Budget dropdown (48px) */}
        <div className="relative flex-1 min-w-[100px] max-w-[170px]">
          <select
            id="search-budget"
            aria-label="Budget range"
            value={searchState.budgetIdx}
            onChange={(e) =>
              onChangeState((prev) => ({
                ...prev,
                budgetIdx: Number(e.target.value),
              }))
            }
            className="w-full h-12 pl-3 pr-7 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base font-medium text-[var(--text-primary)] tabular-nums appearance-none cursor-pointer truncate focus:border-[var(--accent-primary)] transition-colors motion-reduce:transition-none"
          >
            {SMART_BUDGET_RANGES.map((b, idx) => (
              <option
                key={b.label}
                value={idx}
                className="bg-[var(--bg-surface)]"
              >
                {idx === 0 ? 'Budget' : b.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="w-4 h-4 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        </div>

        {/* 6. Search button (48px, solid colour, no gradient) */}
        <button
          type="submit"
          className="tap-press h-12 px-4 lg:px-5 shrink-0 rounded-[12px] bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] border border-black/15 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors motion-reduce:transition-none cursor-pointer"
        >
          <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Search</span>
        </button>
      </form>

      {/* ─── ACTIVE FILTERS REMOVABLE CHIPS UNDER SEARCH CARD ─────────────── */}
      {activeChips.length > 0 && (
        <div
          data-testid="active-filter-chips"
          aria-label="Active filters"
          className="mt-2.5 flex flex-wrap items-center gap-1.5"
        >
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => handleRemoveChip(chip.key)}
              aria-label={`Remove ${chip.label} filter`}
              className="tap-press min-h-[32px] px-2.5 py-1 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors motion-reduce:transition-none cursor-pointer"
            >
              <span>{chip.label}</span>
              <X
                className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0"
                aria-hidden="true"
              />
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="tap-press min-h-[32px] px-2 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ─── PHONE FILTERS BOTTOM SHEET (max-h 90dvh, portaled above fixed header) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {sheetOpen && (
              <motion.div
                key="mobile-filters-sheet-backdrop"
                onClick={() => setSheetOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReduced ? 0.01 : 0.18, ease: LUX_EASE }}
                role="dialog"
                aria-modal="true"
                aria-label="Property filters"
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-xs"
              >
                <motion.div
                  key="mobile-filters-sheet-panel"
                  data-testid="mobile-filters-bottom-sheet"
                  onClick={(e) => e.stopPropagation()}
                  style={
                    sheetDragY > 0 && !prefersReduced
                      ? { transform: `translateY(${sheetDragY}px)` }
                      : undefined
                  }
                  initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 32 }}
                  animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
                  transition={{ duration: prefersReduced ? 0.01 : 0.22, ease: LUX_EASE }}
                  className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-t-[16px] bg-[var(--bg-surface)] border border-b-0 border-[var(--border-hairline)] shadow-[0_-12px_36px_-10px_rgba(0,0,0,0.28)] overflow-hidden"
                >
                  {/* Drag Handle + Header (supports swipe-down close) */}
                  <div
                    data-testid="filters-sheet-drag-header"
                    onPointerDown={handlePointerDownSheet}
                    onPointerMove={handlePointerMoveSheet}
                    onPointerUp={handlePointerEndSheet}
                    onPointerCancel={handlePointerEndSheet}
                    className="touch-none select-none px-4 pt-2.5 pb-3 border-b border-[var(--border-hairline)] shrink-0"
                  >
                    <div
                      aria-hidden="true"
                      className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[var(--border-input)]"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-xl font-medium text-[var(--text-primary)]">
                        Filters
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        aria-label="Close filters"
                        className="tap-press h-10 w-10 inline-flex items-center justify-center rounded-[12px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Form Controls */}
                  <form
                    id="mobile-filters-sheet-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSheetOpen(false);
                      onSearchSubmit();
                    }}
                    className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5"
                  >
                    {/* Buy or Rent */}
                    <div>
                      <span className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
                        Buy or Rent
                      </span>
                      <div
                        role="group"
                        aria-label="Buy or Rent"
                        className="h-[44px] grid grid-cols-3 p-[3px] rounded-[12px] border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                      >
                        {(['All', 'Buy', 'Rent'] as const).map((mode) => {
                          const selected = searchState.listing === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                onChangeState((prev) => ({ ...prev, listing: mode }))
                              }
                              className={`tap-press h-full rounded-[9px] text-sm font-semibold transition-colors motion-reduce:transition-none cursor-pointer ${
                                selected
                                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {mode === 'All' ? 'Any' : mode}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <label
                        htmlFor="sheet-search-location"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                      >
                        Location
                      </label>
                      <div className="relative">
                        <select
                          id="sheet-search-location"
                          value={searchState.location}
                          onChange={(e) =>
                            onChangeState((prev) => ({
                              ...prev,
                              location: e.target.value,
                            }))
                          }
                          className="w-full h-12 pl-3.5 pr-9 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] appearance-none focus:border-[var(--accent-primary)]"
                        >
                          <option value="All" className="bg-[var(--bg-surface)]">
                            All Siliguri areas
                          </option>
                          {serviceLocations.map((loc) => (
                            <option
                              key={loc}
                              value={loc}
                              className="bg-[var(--bg-surface)]"
                            >
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

                    {/* Property type */}
                    <div>
                      <label
                        htmlFor="sheet-search-type"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                      >
                        Property type
                      </label>
                      <div className="relative">
                        <select
                          id="sheet-search-type"
                          value={searchState.propertyType}
                          onChange={(e) =>
                            onChangeState((prev) => ({
                              ...prev,
                              propertyType: e.target.value,
                            }))
                          }
                          className="w-full h-12 pl-3.5 pr-9 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] appearance-none focus:border-[var(--accent-primary)]"
                        >
                          <option value="All" className="bg-[var(--bg-surface)]">
                            All property types
                          </option>
                          {propertyTypes.map((t) => (
                            <option
                              key={t}
                              value={t}
                              className="bg-[var(--bg-surface)]"
                            >
                              {t}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          aria-hidden="true"
                          className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* Budget range */}
                    <div>
                      <label
                        htmlFor="sheet-search-budget"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                      >
                        Budget range
                      </label>
                      <div className="relative">
                        <select
                          id="sheet-search-budget"
                          value={searchState.budgetIdx}
                          onChange={(e) =>
                            onChangeState((prev) => ({
                              ...prev,
                              budgetIdx: Number(e.target.value),
                            }))
                          }
                          className="w-full h-12 pl-3.5 pr-9 rounded-[12px] border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums appearance-none focus:border-[var(--accent-primary)]"
                        >
                          {SMART_BUDGET_RANGES.map((b, idx) => (
                            <option
                              key={b.label}
                              value={idx}
                              className="bg-[var(--bg-surface)]"
                            >
                              {b.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          aria-hidden="true"
                          className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                      </div>
                    </div>
                  </form>

                  {/* Sticky Footer: Show results (live count) + Clear all */}
                  <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] shrink-0 space-y-2">
                    <button
                      type="submit"
                      form="mobile-filters-sheet-form"
                      data-testid="sheet-show-results-btn"
                      className="tap-press w-full h-12 px-5 rounded-[12px] bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] border border-black/15 text-base font-semibold inline-flex items-center justify-center gap-2 transition-colors motion-reduce:transition-none cursor-pointer"
                    >
                      <span>Show results ({formatPropertiesCount(liveMatchingCount)})</span>
                    </button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={onClearAll}
                        className="tap-press min-h-[36px] px-3 text-sm font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </motion.section>
  );
};
