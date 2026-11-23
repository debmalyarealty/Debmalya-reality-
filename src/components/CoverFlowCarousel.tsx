import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatINRReadable } from '../lib/realtyLogic';
import { buildPropertyImageAlt } from '../lib/imageUtils';
import { navigateWithTransition } from '../lib/motion';
import type { Property } from '../types/realty';
import { PropertyImage } from './PropertyImage';
import { FavoriteButton } from './FavoriteButton';

interface CoverFlowCarouselProps {
  properties: Property[];
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  actionSlot?: React.ReactNode;
  reasonsById?: Record<string, string[]>;
}

export const CoverFlowCarousel: React.FC<CoverFlowCarouselProps> = ({
  properties,
  title = 'Recommended Properties',
  subtitle,
  eyebrow,
  actionSlot,
  reasonsById,
}) => {
  const { favoriteIds, toggleFavorite } = useApp();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const interactionTimeout = useRef<number | null>(null);

  const count = properties.length;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (activeIndex >= count && count > 0) {
      setActiveIndex(0);
    }
  }, [count, activeIndex]);

  useEffect(() => {
    return () => {
      if (interactionTimeout.current) {
        window.clearTimeout(interactionTimeout.current);
      }
    };
  }, []);

  const pauseBriefly = useCallback(() => {
    setIsPaused(true);
    if (interactionTimeout.current) {
      window.clearTimeout(interactionTimeout.current);
    }
    interactionTimeout.current = window.setTimeout(() => {
      setIsPaused(false);
    }, 6500);
  }, []);

  const goPrev = useCallback(() => {
    if (count <= 1) return;
    pauseBriefly();
    setActiveIndex((prev) => (prev - 1 + count) % count);
  }, [count, pauseBriefly]);

  const goNext = useCallback(() => {
    if (count <= 1) return;
    pauseBriefly();
    setActiveIndex((prev) => (prev + 1) % count);
  }, [count, pauseBriefly]);

  useEffect(() => {
    if (count <= 1 || isPaused || prefersReduced) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveIndex((prev) => (prev + 1) % count);
      }
    }, 5200);

    return () => window.clearInterval(timer);
  }, [count, isPaused, prefersReduced]);

  if (count === 0) return null;

  const getOffset = (idx: number): number => {
    let diff = idx - activeIndex;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    return diff;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    setIsPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null || prefersReduced) return;
    const raw = e.clientX - dragStartX.current;
    // Soft rubber-band damping for responsive inertia under finger/mouse
    setDragOffsetPx(Math.max(-64, Math.min(64, raw * 0.35)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    setDragOffsetPx(0);
    if (delta > 42) {
      goPrev();
    } else if (delta < -42) {
      goNext();
    } else {
      pauseBriefly();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    }
  };

  return (
    <div
      className="space-y-10"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={title}
    >
      <div className="relative z-20 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          {eyebrow && (
            <p className="text-sm font-medium text-[var(--accent-primary)]">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-medium text-[var(--text-primary)] tracking-[-0.02em] leading-[1.06]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-base text-[var(--text-secondary)] fluid-prose leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0">
          {actionSlot}
          {count > 1 && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous recommended property"
                className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--cta-gold-bg)] hover:border-[var(--cta-gold-bg)] hover:text-[var(--cta-gold-ink)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next recommended property"
                className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--cta-gold-bg)] hover:border-[var(--cta-gold-bg)] hover:text-[var(--cta-gold-ink)] transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3D Cover Flow Stage */}
      <div
        className="relative h-[clamp(360px,54vw,510px)] w-full overflow-hidden select-none touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ perspective: '1600px' }}
      >
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {properties.map((prop, idx) => {
            const offset = getOffset(idx);
            const absOffset = Math.abs(offset);
            const maxVisibleOffset = count >= 5 ? 2 : 1;
            if (absOffset > maxVisibleOffset) return null;

            const isCenter = offset === 0;
            const translateX =
              offset === 0
                ? 0
                : offset === -1
                ? -56
                : offset === 1
                ? 56
                : offset < 0
                ? -96
                : 96;
            const translateZ = isCenter ? 0 : absOffset === 1 ? -140 : -280;
            const scale = isCenter ? 1 : absOffset === 1 ? 0.84 : 0.7;
            const rotateY = prefersReduced
              ? 0
              : offset === 0
              ? 0
              : offset === -1
              ? 22
              : offset === 1
              ? -22
              : offset < 0
              ? 32
              : -32;
            const zIndex = 30 - absOffset * 10;
            const opacity = isCenter ? 1 : absOffset === 1 ? 0.72 : 0.32;
            const isFav = favoriteIds.includes(prop.id);
            const locText = prop.location.toLowerCase().includes('siliguri')
              ? prop.location
              : `${prop.location}, Siliguri`;
            const reasons = reasonsById?.[prop.id];

            return (
              <div
                key={prop.id}
                style={{
                  transform: `translate3d(calc(${translateX}% + ${dragOffsetPx}px), 0, ${translateZ}px) scale(${scale}) rotateY(${rotateY}deg)`,
                  zIndex,
                  opacity,
                  transition:
                    dragOffsetPx !== 0
                      ? 'none'
                      : prefersReduced
                      ? 'opacity 200ms ease'
                      : 'transform 680ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms ease, box-shadow 520ms ease',
                }}
                onClick={() => {
                  if (!isCenter) {
                    pauseBriefly();
                    setActiveIndex(idx);
                  }
                }}
                className={`absolute w-[min(88%,440px)] sm:w-[68%] lg:w-[54%] h-[clamp(330px,50vw,470px)] rounded-[clamp(1.25rem,3vw,1.75rem)] overflow-hidden bg-[var(--bg-surface)] ${
                  isCenter
                    ? 'cursor-default shadow-[var(--shadow-elevated)]'
                    : 'cursor-pointer shadow-[var(--shadow-subtle)]'
                } ${absOffset === 2 ? 'hidden md:block' : ''}`}
              >
                <PropertyImage
                  src={prop.images[0]?.url}
                  alt={buildPropertyImageAlt(prop.title, prop.location)}
                  className="w-full h-full object-cover object-center"
                  sizes="(max-width: 640px) 88vw, (max-width: 1024px) 68vw, 54vw"
                />

                {/* Soft vignette over non-center cards; clean photography without clipped text */}
                {!isCenter && (
                  <div className="pointer-events-none absolute inset-0 bg-black/28" />
                )}

                {/* Center card badges */}
                <div
                  className={`absolute top-4 left-4 right-4 sm:top-5 sm:left-5 sm:right-5 flex items-center justify-between gap-2 transition-opacity duration-300 ${
                    isCenter ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="px-3.5 py-1.5 rounded-full bg-black/78 backdrop-blur-md text-[13px] font-medium text-white shadow-sm truncate max-w-full">
                      {prop.listing_type} &middot; {prop.status}
                    </span>
                    {prop.is_demo && (
                      <span className="px-3 py-1.5 rounded-full bg-black/78 backdrop-blur-md text-[13px] font-medium text-white shadow-sm">
                        Sample listing
                      </span>
                    )}
                  </div>

                  {isCenter && (
                    <FavoriteButton
                      isFavorite={isFav}
                      onToggle={() => toggleFavorite(prop.id)}
                      ariaLabel={`Save ${prop.title}`}
                    />
                  )}
                </div>

                {/* Dedicated Dark Gradient Bottom Panel (shown only on active center card) */}
                <div
                  className={`absolute inset-x-0 bottom-0 pt-14 p-[clamp(1rem,3vw,2rem)] bg-gradient-to-t from-black/92 via-black/78 to-transparent text-white transition-opacity duration-300 ${
                    isCenter ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  {reasons && reasons.length > 0 && isCenter && (
                    <p className="text-[13px] font-medium text-[#F5DFB0] mb-1.5 [text-shadow:0_1px_8px_rgba(0,0,0,0.65)]">
                      {reasons.slice(0, 2).join(' · ')}
                    </p>
                  )}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                    <span className="font-display text-[clamp(1.375rem,3vw,1.875rem)] font-semibold tabular-nums text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.65)]">
                      {formatINRReadable(prop.price_inr, prop.listing_type)}
                    </span>
                    <span className="text-[13px] font-medium text-white/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.65)]">
                      {prop.property_type}
                      {prop.bedrooms > 0 ? ` · ${prop.bedrooms} BHK` : ''}
                      {prop.area_sqft > 0
                        ? ` · ${prop.area_sqft.toLocaleString('en-IN')} sq ft`
                        : ''}
                    </span>
                  </div>
                  <h3 className="font-display text-[clamp(1.25rem,2.8vw,1.875rem)] font-medium tracking-[-0.015em] line-clamp-1 text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.7)]">
                    {prop.title}
                  </h3>
                  <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/95 truncate max-w-full [text-shadow:0_1px_8px_rgba(0,0,0,0.65)]">
                      <MapPin className="w-4 h-4 text-[#F5DFB0] shrink-0" />
                      {locText}
                    </span>
                    {isCenter && (
                      <Link
                        to={`/properties/${prop.slug}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                          e.preventDefault();
                          navigateWithTransition(navigate, `/properties/${prop.slug}`);
                        }}
                        className="btn-primary-lux min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium whitespace-nowrap shrink-0 shadow-sm"
                      >
                        View details
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Minimal Indicator Dots */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-0.5">
          {properties.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                pauseBriefly();
                setActiveIndex(idx);
              }}
              aria-label={`View recommended property ${idx + 1}: ${p.title}`}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
            >
              <span
                className={`block h-2 rounded-full transition-all duration-300 ${
                  idx === activeIndex
                    ? 'w-9 bg-[var(--accent-secondary)]'
                    : 'w-2 bg-[var(--border-hairline)] hover:bg-[var(--text-muted)]'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
