import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { SMART_BUDGET_RANGES, type SmartSearchState } from '../lib/searchHelpers';

interface SmartSearchBlockProps {
  searchState: SmartSearchState;
  onChangeState: React.Dispatch<React.SetStateAction<SmartSearchState>>;
  onSearchSubmit: (overrideState?: SmartSearchState) => void;
  serviceLocations: string[];
  propertyTypes: string[];
  prefersReduced: boolean;
  isSubmitting?: boolean;
  isLandscapeCompact?: boolean;
}

interface DropdownOption {
  value: string;
  label: string;
}

interface SearchSelectFieldProps {
  id: string;
  label: string;
  displayValue: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  prefersReduced: boolean;
  showLeftDividerOnTablet?: boolean;
  showLeftDividerOnDesktop?: boolean;
  alignPopoverRight?: boolean;
  staggerIndex: number;
  tabular?: boolean;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const SearchSelectField: React.FC<SearchSelectFieldProps> = ({
  id,
  label,
  displayValue,
  value,
  options,
  onSelect,
  isOpen,
  onToggleOpen,
  onClose,
  prefersReduced,
  showLeftDividerOnTablet = false,
  showLeftDividerOnDesktop = false,
  alignPopoverRight = false,
  staggerIndex,
  tabular = false,
}) => {
  const listboxId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasInteractedRef = useRef(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(() =>
    Math.max(
      0,
      options.findIndex((opt) => opt.value === value)
    )
  );

  // Sync highlighted option index when dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    const idx = options.findIndex((opt) => opt.value === value);
    setHighlightedIndex(idx >= 0 ? idx : 0);
  }, [isOpen, options, value]);

  // Close custom dropdown on outside pointer interaction
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (target && fieldRef.current && !fieldRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen, onClose]);

  const handleChoose = (nextValue: string) => {
    hasInteractedRef.current = true;
    onSelect(nextValue);
  };

  const handleDesktopKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        onToggleOpen();
      } else {
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : 0
        );
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        onToggleOpen();
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : options.length - 1
        );
      }
      return;
    }

    if (e.key === 'Home' && isOpen) {
      e.preventDefault();
      setHighlightedIndex(0);
      return;
    }

    if (e.key === 'End' && isOpen) {
      e.preventDefault();
      setHighlightedIndex(Math.max(0, options.length - 1));
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      if (isOpen && options[highlightedIndex]) {
        e.preventDefault();
        handleChoose(options[highlightedIndex].value);
        onClose();
        triggerRef.current?.focus();
      }
    }
  };

  const dividerClass = showLeftDividerOnTablet
    ? 'hidden md:block md:mx-1 min-[1025px]:mx-1.5'
    : showLeftDividerOnDesktop
    ? 'hidden min-[1025px]:block min-[1025px]:mx-1.5'
    : 'hidden';

  return (
    <motion.div
      ref={fieldRef}
      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: prefersReduced ? 0.01 : 0.34,
        delay: prefersReduced ? 0 : 0.08 + staggerIndex * 0.07,
        ease: EASE_OUT,
      }}
      className="relative min-w-0 flex items-center"
    >
      {/* Vertical divider on Tablet Row 2 & Desktop 1-Row */}
      {(showLeftDividerOnTablet || showLeftDividerOnDesktop) && (
        <span
          aria-hidden="true"
          className={`${dividerClass} w-px h-8 shrink-0 bg-[var(--border-hairline)]`}
        />
      )}

      <div
        className={`group/field relative flex-1 min-w-0 min-h-[52px] md:min-h-[54px] rounded-[14px] border transition-colors duration-200 ease-out motion-reduce:transition-none ${
          isOpen
            ? 'border-[#B08D57] dark:border-[#DEC085] bg-[var(--bg-surface-muted)]/60'
            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] md:border-transparent md:bg-transparent'
        }`}
      >
        {/* Subtle desktop hover background lift (opacity only) */}
        <span
          aria-hidden="true"
          className="pointer-events-none hidden md:block absolute inset-0 rounded-[14px] bg-[var(--bg-surface-muted)]/65 opacity-0 group-hover/field:opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none"
        />

        {/* Animated gold border & bottom draw-in indicator on focus/open (transform + opacity only) */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-[14px] border border-[#B08D57] dark:border-[#DEC085] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            isOpen
              ? 'opacity-100'
              : 'opacity-0 group-focus-within/field:opacity-100'
          }`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-[var(--accent-secondary)] origin-center transition-[transform,opacity] duration-250 ease-out motion-reduce:transition-none ${
            isOpen
              ? 'scale-x-100 opacity-100'
              : 'scale-x-0 opacity-0 group-focus-within/field:scale-x-100 group-focus-within/field:opacity-100'
          }`}
        />

        {/* Shared visual field layout: small label on top, selected value below, chevron on right */}
        <div className="relative z-10 flex items-center justify-between gap-1.5 sm:gap-2 min-h-[52px] md:min-h-[54px] px-3 sm:px-3.5 md:px-4 py-2 pointer-events-none">
          <div className="min-w-0 flex-1 text-left">
            <span
              className={`block text-xs font-medium leading-tight transition-colors duration-200 ease-out ${
                isOpen
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)] group-focus-within/field:text-[var(--accent-primary)]'
              }`}
            >
              {label}
            </span>

            <div className="mt-0.5 overflow-hidden">
              <motion.span
                key={`${id}-${value}`}
                initial={
                  !hasInteractedRef.current || prefersReduced
                    ? false
                    : { opacity: 0, y: 5 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: prefersReduced ? 0.01 : 0.22,
                  ease: EASE_OUT,
                }}
                className={`block text-[15px] leading-snug font-medium text-[var(--text-primary)] truncate ${
                  tabular ? 'tabular-nums' : ''
                }`}
              >
                {displayValue}
              </motion.span>
            </div>
          </div>

          <ChevronDown
            aria-hidden="true"
            className={`w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ease-out motion-reduce:transition-none ${
              isOpen
                ? 'rotate-180 text-[var(--accent-primary)]'
                : 'group-hover/field:translate-y-[1.5px] group-hover/field:text-[var(--text-primary)]'
            }`}
          />
        </div>

        {/* MOBILE (< 768px): Native OS <select> for accessible touch picking */}
        <select
          id={`${id}-mobile`}
          aria-label={label}
          value={value}
          onChange={(e) => handleChoose(e.target.value)}
          className="md:hidden absolute inset-0 z-20 w-full h-full opacity-0 cursor-pointer text-base"
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
            >
              {opt.label}
            </option>
          ))}
        </select>

        {/* TABLET & DESKTOP (>= 768px): Custom accessible dropdown button + animated listbox */}
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-label={`${label}: ${displayValue}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onClick={onToggleOpen}
          onKeyDown={handleDesktopKeyDown}
          className="hidden md:block absolute inset-0 z-20 w-full h-full rounded-[14px] bg-transparent cursor-pointer"
        />
      </div>

      {/* Custom Dropdown List (Tablet & Desktop >= 768px): soft fade + 8px slide */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={listboxId}
            role="listbox"
            aria-label={label}
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{
              duration: prefersReduced ? 0.01 : 0.22,
              ease: EASE_OUT,
            }}
            className={`hidden md:block absolute top-[calc(100%+10px)] z-40 rounded-2xl border border-[#B08D57]/40 dark:border-[#DEC085]/35 bg-[var(--bg-surface)] shadow-[0_22px_50px_-14px_rgba(28,26,23,0.22)] dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68)] py-1.5 max-h-[280px] overflow-y-auto ${
              alignPopoverRight
                ? 'right-0 min-w-[240px]'
                : 'left-0 right-0 min-w-[215px]'
            }`}
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => {
                    handleChoose(opt.value);
                    onClose();
                    triggerRef.current?.focus();
                  }}
                  className={`w-full min-h-[44px] px-3.5 py-2 text-left flex items-center justify-between gap-2.5 text-sm transition-colors duration-150 ease-out motion-reduce:transition-none cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--bg-surface-muted)] text-[var(--accent-primary)] font-semibold'
                      : isHighlighted
                      ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] font-normal'
                  } ${tabular ? 'tabular-nums' : ''}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check
                      className="w-4 h-4 shrink-0 text-[var(--accent-primary)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const SmartSearchBlock: React.FC<SmartSearchBlockProps> = ({
  searchState,
  onChangeState,
  onSearchSubmit,
  serviceLocations,
  propertyTypes,
  prefersReduced,
  isSubmitting = false,
  isLandscapeCompact = false,
}) => {
  const [openMenu, setOpenMenu] = useState<'location' | 'type' | 'budget' | null>(
    null
  );

  const handleToggleListing = (mode: 'Buy' | 'Rent') => {
    onChangeState((prev) => ({
      ...prev,
      listing: prev.listing === mode ? 'All' : mode,
    }));
  };

  const locationOptions: DropdownOption[] = [
    { value: 'All', label: 'All locations' },
    ...serviceLocations.map((loc) => ({ value: loc, label: loc })),
  ];

  const typeOptions: DropdownOption[] = [
    { value: 'All', label: 'All types' },
    ...propertyTypes.map((type) => ({ value: type, label: type })),
  ];

  const budgetOptions: DropdownOption[] = SMART_BUDGET_RANGES.map((b, idx) => ({
    value: String(idx),
    label: b.label,
  }));

  const currentLocationLabel =
    searchState.location === 'All' ? 'All locations' : searchState.location;
  const currentTypeLabel =
    searchState.propertyType === 'All' ? 'All types' : searchState.propertyType;
  const currentBudgetLabel =
    SMART_BUDGET_RANGES[searchState.budgetIdx]?.label || 'Any budget';

  // Clean top spacing so the visible "Search Bar" heading sits on the page canvas below the hero
  const overlapSpacingClass = isLandscapeCompact
    ? 'pt-4 pb-3'
    : 'pt-5 sm:pt-6 pb-3 md:pb-5';

  return (
    <section
      id="search"
      aria-label="Property search"
      className={`fluid-container relative z-20 ${overlapSpacingClass} scroll-mt-24`}
    >
      <div className="w-full max-w-[1100px] mx-auto mb-2.5 px-1">
        <h2 className="font-display text-lg sm:text-xl font-medium tracking-[-0.01em] text-[var(--text-primary)]">
          Search Bar
        </h2>
      </div>

      <motion.form
        data-testid="home-search-card"
        onSubmit={(e) => {
          e.preventDefault();
          setOpenMenu(null);
          onSearchSubmit();
        }}
        initial={prefersReduced ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{
          duration: prefersReduced ? 0.01 : 0.5,
          ease: EASE_OUT,
        }}
        className="w-full max-w-[1100px] mx-auto rounded-[22px] md:rounded-[26px] min-[1025px]:rounded-[28px] bg-[var(--bg-surface)] border border-[#B08D57]/45 dark:border-[#DEC085]/35 shadow-[0_22px_54px_-18px_rgba(28,26,23,0.16)] dark:shadow-[0_26px_62px_-18px_rgba(0,0,0,0.62)] p-2.5 sm:p-3 md:px-4 md:py-3.5"
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-x-0 md:gap-y-2.5 items-center">
          {/* Row 1: Full-width 50/50 Buy / Rent Toggle on Mobile, Tablet & Desktop */}
          <div className="col-span-2 md:col-span-4 grid grid-cols-1 gap-2 min-w-0">
            {/* 1. Buy / Rent Toggle */}
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: prefersReduced ? 0.01 : 0.34,
                delay: prefersReduced ? 0 : 0.08,
                ease: EASE_OUT,
              }}
              className="w-full min-w-0"
            >
              <div
                role="group"
                aria-label="Buy or Rent"
                className="relative grid grid-cols-2 p-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] w-full min-h-[52px] min-[1025px]:min-h-[54px]"
              >
                {/* Smooth sliding gold pill (transform & opacity only) */}
                <span
                  aria-hidden="true"
                  style={{
                    transform:
                      searchState.listing === 'Rent'
                        ? 'translate3d(100%, 0, 0)'
                        : 'translate3d(0%, 0, 0)',
                    opacity: searchState.listing === 'All' ? 0 : 1,
                  }}
                  className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-[var(--cta-gold-bg)] shadow-[0_2px_8px_-2px_rgba(28,26,23,0.18)] transition-[transform,opacity] duration-250 ease-out motion-reduce:transition-none"
                />

                <button
                  type="button"
                  aria-pressed={searchState.listing === 'Buy'}
                  onClick={() => handleToggleListing('Buy')}
                  className={`relative z-10 min-h-[42px] rounded-full text-sm inline-flex items-center justify-center whitespace-nowrap transition-colors duration-200 ease-out motion-reduce:transition-none cursor-pointer ${
                    searchState.listing === 'Buy'
                      ? 'text-[var(--cta-gold-ink)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
                  }`}
                >
                  Buy
                </button>

                <button
                  type="button"
                  aria-pressed={searchState.listing === 'Rent'}
                  onClick={() => handleToggleListing('Rent')}
                  className={`relative z-10 min-h-[42px] rounded-full text-sm inline-flex items-center justify-center whitespace-nowrap transition-colors duration-200 ease-out motion-reduce:transition-none cursor-pointer ${
                    searchState.listing === 'Rent'
                      ? 'text-[var(--cta-gold-ink)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
                  }`}
                >
                  Rent
                </button>
              </div>
            </motion.div>
          </div>

          {/* 3. Location Dropdown */}
          <SearchSelectField
            id="home-search-location"
            label="Location"
            displayValue={currentLocationLabel}
            value={searchState.location}
            options={locationOptions}
            onSelect={(next) =>
              onChangeState((prev) => ({ ...prev, location: next }))
            }
            isOpen={openMenu === 'location'}
            onToggleOpen={() =>
              setOpenMenu((prev) => (prev === 'location' ? null : 'location'))
            }
            onClose={() => setOpenMenu(null)}
            prefersReduced={prefersReduced}
            staggerIndex={1}
          />

          {/* 3. Type Dropdown */}
          <SearchSelectField
            id="home-search-type"
            label="Type"
            displayValue={currentTypeLabel}
            value={searchState.propertyType}
            options={typeOptions}
            onSelect={(next) =>
              onChangeState((prev) => ({ ...prev, propertyType: next }))
            }
            isOpen={openMenu === 'type'}
            onToggleOpen={() =>
              setOpenMenu((prev) => (prev === 'type' ? null : 'type'))
            }
            onClose={() => setOpenMenu(null)}
            prefersReduced={prefersReduced}
            showLeftDividerOnTablet
            staggerIndex={2}
          />

          {/* 4. Budget Dropdown */}
          <SearchSelectField
            id="home-search-budget"
            label="Budget"
            displayValue={currentBudgetLabel}
            value={String(searchState.budgetIdx)}
            options={budgetOptions}
            onSelect={(next) =>
              onChangeState((prev) => ({ ...prev, budgetIdx: Number(next) }))
            }
            isOpen={openMenu === 'budget'}
            onToggleOpen={() =>
              setOpenMenu((prev) => (prev === 'budget' ? null : 'budget'))
            }
            onClose={() => setOpenMenu(null)}
            prefersReduced={prefersReduced}
            showLeftDividerOnTablet
            alignPopoverRight
            staggerIndex={3}
            tabular
          />

          {/* 5. Search Button */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{
              duration: prefersReduced ? 0.01 : 0.34,
              delay: prefersReduced ? 0 : 0.08 + 4 * 0.07,
              ease: EASE_OUT,
            }}
            className="min-w-0 md:pl-2 min-[1025px]:pl-2.5"
          >
            <button
              type="submit"
              disabled={isSubmitting}
              aria-label={isSubmitting ? 'Searching properties' : 'Search properties'}
              className="group/btn w-full min-h-[52px] px-3 sm:px-4 rounded-[14px] md:w-[52px] md:h-[52px] min-[1025px]:w-[54px] min-[1025px]:h-[54px] md:px-0 md:rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] border border-black/15 dark:border-[#F5DFB0]/40 text-sm sm:text-[15px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_8px_22px_-8px_rgba(28,26,23,0.35)] transition-[transform,opacity,background-color] duration-200 ease-out hover:scale-[1.03] active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 cursor-pointer disabled:opacity-75"
            >
              {isSubmitting ? (
                <Loader2
                  className="w-[18px] h-[18px] md:w-5 md:h-5 shrink-0 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Search
                  className="w-[18px] h-[18px] md:w-5 md:h-5 shrink-0 transition-transform duration-200 ease-out group-hover/btn:translate-x-[1.5px] group-hover/btn:-translate-y-[1.5px] motion-reduce:transition-none motion-reduce:group-hover/btn:translate-x-0 motion-reduce:group-hover/btn:translate-y-0"
                  aria-hidden="true"
                />
              )}
              <span className="md:hidden">Search</span>
            </button>
          </motion.div>
        </div>
      </motion.form>
    </section>
  );
};
