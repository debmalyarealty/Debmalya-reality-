import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { formatINRReadable } from '../lib/realtyLogic';
import { buildPropertyImageAlt } from '../lib/imageUtils';
import { LUX_EASE, navigateWithTransition } from '../lib/motion';
import type { Property } from '../types/realty';
import { PropertyImage } from './PropertyImage';

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
  title = 'Recommended properties',
  subtitle,
  eyebrow,
  actionSlot,
}) => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [revealedPropId, setRevealedPropId] = useState<string | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const interactionTimeout = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const safeProperties = Array.isArray(properties) ? properties : [];
  const count = safeProperties.length;

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

  // Hide the revealed Details button when tapping anywhere outside the active photo/details wrapper
  useEffect(() => {
    if (!revealedPropId) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) {
        setRevealedPropId(null);
        return;
      }
      const insideRevealed = target.closest(
        `[data-coverflow-interactive="${revealedPropId}"]`
      );
      if (!insideRevealed) {
        setRevealedPropId(null);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [revealedPropId]);

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
    setRevealedPropId(null);
    pauseBriefly();
    setActiveIndex((prev) => (prev - 1 + count) % count);
  }, [count, pauseBriefly]);

  const goNext = useCallback(() => {
    if (count <= 1) return;
    setRevealedPropId(null);
    pauseBriefly();
    setActiveIndex((prev) => (prev + 1) % count);
  }, [count, pauseBriefly]);

  useEffect(() => {
    if (count <= 1 || isPaused || prefersReduced || revealedPropId !== null) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveIndex((prev) => (prev + 1) % count);
      }
    }, 5200);

    return () => window.clearInterval(timer);
  }, [count, isPaused, prefersReduced, revealedPropId]);

  if (count === 0) return null;

  const getOffset = (idx: number): number => {
    let diff = idx - activeIndex;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    return diff;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0]?.clientX;
    if (typeof x === 'number') {
      dragStartX.current = x;
      dragMovedRef.current = false;
    }
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartX.current === null) return;
    const x = e.touches[0]?.clientX;
    if (typeof x !== 'number') return;
    const raw = x - dragStartX.current;
    if (Math.abs(raw) > 10) {
      dragMovedRef.current = true;
    }
    if (!prefersReduced) {
      setDragOffsetPx(Math.max(-64, Math.min(64, raw * 0.35)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    const startX = dragStartX.current;
    dragStartX.current = null;
    setDragOffsetPx(0);
    if (typeof endX === 'number') {
      const delta = endX - startX;
      if (delta > 42) {
        goPrev();
      } else if (delta < -42) {
        goNext();
      } else {
        pauseBriefly();
      }
    } else {
      pauseBriefly();
    }
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 80);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    dragStartX.current = e.clientX;
    dragMovedRef.current = false;
    setIsPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || dragStartX.current === null) return;
    const raw = e.clientX - dragStartX.current;
    if (Math.abs(raw) > 10) {
      dragMovedRef.current = true;
    }
    if (!prefersReduced) {
      setDragOffsetPx(Math.max(-64, Math.min(64, raw * 0.35)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || dragStartX.current === null) return;
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
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 80);
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
      className="space-y-6 sm:space-y-8 min-w-0 overflow-hidden"
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
      <div className="relative z-20 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          {eyebrow && (
            <p className="text-sm font-medium text-[var(--accent-primary)]">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] tracking-[-0.015em] leading-[1.15] break-anywhere">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm sm:text-base text-[var(--text-secondary)] fluid-prose leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actionSlot}
          {count > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous recommended property"
                className="tap-press h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--cta-gold-bg)] hover:border-[var(--cta-gold-bg)] hover:text-[var(--cta-gold-ink)] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next recommended property"
                className="tap-press h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--cta-gold-bg)] hover:border-[var(--cta-gold-bg)] hover:text-[var(--cta-gold-ink)] cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3D Cover Flow Stage */}
      <div
        ref={stageRef}
        data-testid="recommended-coverflow-stage"
        className="relative h-[400px] sm:h-[465px] lg:h-[510px] xl:h-[540px] w-full overflow-hidden select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
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
          {safeProperties.map((prop, idx) => {
            const offset = getOffset(idx);
            const absOffset = Math.abs(offset);
            const maxVisibleOffset = count >= 5 ? 2 : 1;
            if (absOffset > maxVisibleOffset) return null;

            const isCenter = offset === 0;
            const isRevealed = isCenter && revealedPropId === prop.id;
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
            const opacity = isCenter ? 1 : absOffset === 1 ? 0.74 : 0.34;
            const safeLocation = prop.location || 'Siliguri';
            const safeTitle = prop.title || 'Siliguri Property';
            const safeImages = Array.isArray(prop.images) ? prop.images : [];
            const safeBeds = Number(prop.bedrooms) || 0;
            const safeArea = Number(prop.area_sqft) || 0;
            const locText = safeLocation.toLowerCase().includes('siliguri')
              ? safeLocation
              : `${safeLocation}, Siliguri`;
            const detailSummary = [
              prop.property_type,
              safeBeds > 0 ? `${safeBeds} BHK` : null,
              safeArea > 0
                ? `${safeArea.toLocaleString('en-IN')} sq ft`
                : null,
            ]
              .filter(Boolean)
              .join(' · ');

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
                      : 'transform 620ms cubic-bezier(0.22, 1, 0.36, 1), opacity 460ms ease',
                }}
                onClick={() => {
                  if (!isCenter && !dragMovedRef.current) {
                    setRevealedPropId(null);
                    pauseBriefly();
                    setActiveIndex(idx);
                  }
                }}
                className={`absolute w-[min(88%,400px)] sm:w-[min(64%,480px)] lg:w-[min(48%,540px)] flex flex-col rounded-[clamp(1.25rem,3vw,1.75rem)] overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)] ${
                  isCenter
                    ? 'shadow-[var(--shadow-elevated)]'
                    : 'cursor-pointer shadow-[var(--shadow-subtle)]'
                } ${absOffset === 2 ? 'hidden md:block' : ''}`}
              >
                {/* Clean photograph only — zero text overlays or badges on the image */}
                <div
                  data-coverflow-interactive={isCenter ? prop.id : undefined}
                  className="flex flex-col"
                >
                  <button
                    type="button"
                    disabled={!isCenter}
                    onClick={(e) => {
                      if (!isCenter || dragMovedRef.current) return;
                      e.stopPropagation();
                      pauseBriefly();
                      setRevealedPropId((curr) =>
                        curr === prop.id ? null : prop.id
                      );
                    }}
                    aria-label={
                      isCenter
                        ? `${safeTitle} photo — tap to ${isRevealed ? 'hide' : 'show'} Details button`
                        : `Select ${safeTitle}`
                    }
                    aria-expanded={isCenter ? isRevealed : undefined}
                    className={`tap-press relative block w-full aspect-[16/10] overflow-hidden bg-[var(--bg-surface-muted)] [&_img]:pointer-events-none focus-visible:outline-none ${
                      isCenter ? 'cursor-pointer' : 'cursor-pointer'
                    }`}
                  >
                    <PropertyImage
                      src={safeImages[0]?.url}
                      alt={buildPropertyImageAlt(safeTitle, safeLocation)}
                      className="w-full h-full object-cover object-center"
                      sizes="(max-width: 640px) 88vw, (max-width: 1024px) 64vw, 48vw"
                    />
                    {!isCenter && (
                      <div className="pointer-events-none absolute inset-0 bg-black/22" />
                    )}
                  </button>

                  {/* Price, title, location and key details sit cleanly below the photo */}
                  <div className="p-3.5 sm:p-5 flex flex-col gap-1.5 text-left min-w-0">
                    <div className="flex items-baseline justify-between gap-2 min-w-0">
                      <span className="font-display text-[clamp(1.25rem,2.4vw,1.65rem)] font-semibold tabular-nums text-[var(--accent-primary)] leading-tight">
                        {formatINRReadable(
                          prop.price_inr,
                          prop.listing_type,
                          prop.price_unit
                        )}
                      </span>
                      <span className="text-[13px] font-medium text-[var(--text-muted)] whitespace-nowrap">
                        {prop.listing_type || 'Buy'}
                      </span>
                    </div>

                    <h3 className="font-display text-[clamp(1.1rem,2.2vw,1.375rem)] font-medium text-[var(--text-primary)] leading-snug truncate">
                      {safeTitle}
                    </h3>

                    <p className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                      <span className="truncate">{locText}</span>
                    </p>

                    {detailSummary && (
                      <p className="text-[13px] text-[var(--text-muted)] tabular-nums truncate">
                        {detailSummary}
                      </p>
                    )}

                    <AnimatePresence initial={false}>
                      {isRevealed && (
                        <motion.div
                          key={`details-${prop.id}`}
                          initial={
                            prefersReduced ? { opacity: 1 } : { opacity: 0, y: 6 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            prefersReduced ? { opacity: 0 } : { opacity: 0, y: 4 }
                          }
                          transition={{ duration: 0.2, ease: LUX_EASE }}
                          className="pt-2"
                        >
                          <Link
                            to={`/properties/${prop.slug}`}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                                return;
                              e.preventDefault();
                              navigateWithTransition(
                                navigate,
                                `/properties/${prop.slug}`
                              );
                            }}
                            className="btn-primary-lux tap-press min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center whitespace-nowrap shadow-xs"
                          >
                            Details
                          </Link>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
          {safeProperties.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setRevealedPropId(null);
                pauseBriefly();
                setActiveIndex(idx);
              }}
              aria-label={`View recommended property ${idx + 1}: ${p.title || 'Property'}`}
              className="tap-press min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
            >
              <span
                className={`block h-2 rounded-full transition-transform duration-300 ${
                  idx === activeIndex
                    ? 'w-8 bg-[var(--accent-secondary)]'
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
