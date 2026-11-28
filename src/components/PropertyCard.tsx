import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatINRReadable } from '../lib/realtyLogic';
import { buildPropertyImageAlt } from '../lib/imageUtils';
import { navigateWithTransition } from '../lib/motion';
import type { Property } from '../types/realty';
import { PropertyImage } from './PropertyImage';
import { FavoriteButton } from './FavoriteButton';

interface PropertyCardProps {
  property: Property;
  recommendationReasons?: string[];
  className?: string;
  hideFavoriteButton?: boolean;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  recommendationReasons,
  className = '',
  hideFavoriteButton = false,
}) => {
  const { favoriteIds, toggleFavorite } = useApp();
  const navigate = useNavigate();
  const isFav = favoriteIds.includes(property.id);
  const safeImages = Array.isArray(property.images) ? property.images : [];
  const coverImage = safeImages[0]?.url;
  const safeSlug = property.slug || property.id;
  const safeLocation = property.location || 'Siliguri';
  const safeTitle = property.title || 'Siliguri Property';
  const detailPath = `/properties/${safeSlug}`;

  const locationDisplay = safeLocation.toLowerCase().includes('siliguri')
    ? safeLocation
    : `${safeLocation}, Siliguri`;

  const beds = Number(property.bedrooms) || 0;
  const baths = Number(property.bathrooms) || 0;
  const areaSqFt = Number(property.area_sqft) || 0;

  const calmSummary = [
    locationDisplay,
    beds > 0 ? `${beds} BHK` : null,
    baths > 0 ? `${baths} Bath` : null,
    areaSqFt > 0 ? `${areaSqFt.toLocaleString('en-IN')} sq ft` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateWithTransition(navigate, detailPath);
  };

  return (
    <article
      className={`group property-card-container lux-card-hover tap-press min-w-0 flex flex-col rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-subtle)] ${className}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--bg-surface-muted)]">
        <Link
          to={detailPath}
          onClick={handleNavigate}
          className="block w-full h-full"
          aria-label={`View details for ${safeTitle}`}
        >
          <PropertyImage
            src={coverImage}
            alt={buildPropertyImageAlt(safeTitle, safeLocation)}
            className="lux-img-hover w-full h-full object-cover object-center"
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 380px"
          />
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/72 via-black/28 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/28 to-transparent" />

        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-[calc(100%-3.25rem)]">
            <span className="px-3 py-1 rounded-full bg-black/78 backdrop-blur-md text-[13px] font-medium text-white shadow-sm truncate max-w-full">
              {property.listing_type || 'Buy'} &middot; {property.status || 'Available'}
            </span>
            {property.is_featured && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-[13px] font-semibold shadow-sm whitespace-nowrap">
                Featured
              </span>
            )}
          </div>

          {!hideFavoriteButton && (
            <FavoriteButton
              isFavorite={isFav}
              onToggle={() => toggleFavorite(property.id)}
              ariaLabel={
                isFav
                  ? `Remove ${safeTitle} from saved properties`
                  : `Save ${safeTitle} to favourites`
              }
            />
          )}
        </div>

        {property.is_demo && (
          <span className="absolute bottom-3.5 left-3.5 px-3 py-1 rounded-full bg-black/78 backdrop-blur-md text-[13px] font-medium text-white shadow-sm">
            Sample listing
          </span>
        )}
      </div>

      <div className="flex-1 p-[clamp(1rem,2.8vw,1.75rem)] flex flex-col gap-3 min-w-0">
        <div className="property-card-header">
          <p className="font-display text-[clamp(1.375rem,2.4vw,1.875rem)] font-semibold tabular-nums text-[var(--accent-primary)] leading-none tracking-[-0.015em]">
            {formatINRReadable(
              property.price_inr,
              property.listing_type,
              property.price_unit
            )}
          </p>
          <span className="text-[13px] font-medium text-[var(--text-muted)] whitespace-nowrap">
            {property.property_type || 'Property'}
          </span>
        </div>

        <h3 className="font-display text-[clamp(1.25rem,2vw,1.5rem)] font-medium leading-snug tracking-[-0.015em] text-[var(--text-primary)] min-w-0">
          <Link
            to={detailPath}
            onClick={handleNavigate}
            className="min-h-[44px] w-full flex items-center -my-2 hover:text-[var(--accent-primary)] transition-colors min-w-0"
          >
            <span className="truncate">{safeTitle}</span>
          </Link>
        </h3>

        <p className="text-sm font-medium text-[var(--text-secondary)] truncate tabular-nums">
          {calmSummary}
        </p>

        {recommendationReasons && recommendationReasons.length > 0 && (
          <p className="text-[13px] font-medium text-[var(--accent-primary)] break-anywhere">
            {recommendationReasons.join(' · ')}
          </p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-[var(--border-hairline)]">
          <Link
            to={detailPath}
            onClick={handleNavigate}
            className="min-h-[44px] w-full inline-flex items-center justify-between text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <span>View details</span>
            <span className="h-10 w-10 rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] group-hover:bg-[var(--cta-gold-bg)] group-hover:border-[var(--cta-gold-bg)] group-hover:text-[var(--cta-gold-ink)] inline-flex items-center justify-center transition-colors shrink-0">
              <ArrowUpRight className="lux-arrow-hover w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
};
