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
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  recommendationReasons,
  className = '',
}) => {
  const { favoriteIds, toggleFavorite } = useApp();
  const navigate = useNavigate();
  const isFav = favoriteIds.includes(property.id);
  const coverImage = property.images[0]?.url;
  const detailPath = `/properties/${property.slug}`;

  const locationDisplay = property.location.toLowerCase().includes('siliguri')
    ? property.location
    : `${property.location}, Siliguri`;

  const calmSummary = [
    locationDisplay,
    property.bedrooms > 0 ? `${property.bedrooms} BHK` : null,
    property.bathrooms > 0 ? `${property.bathrooms} Bath` : null,
    property.area_sqft > 0
      ? `${property.area_sqft.toLocaleString('en-IN')} sq ft`
      : null,
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
          aria-label={`View details for ${property.title}`}
        >
          <PropertyImage
            src={coverImage}
            alt={buildPropertyImageAlt(property.title, property.location)}
            className="lux-img-hover w-full h-full object-cover object-center"
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 380px"
          />
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/72 via-black/28 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/28 to-transparent" />

        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-[calc(100%-3.25rem)]">
            <span className="px-3 py-1 rounded-full bg-black/78 backdrop-blur-md text-[13px] font-medium text-white shadow-sm truncate max-w-full">
              {property.listing_type} &middot; {property.status}
            </span>
            {property.is_featured && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-[13px] font-semibold shadow-sm whitespace-nowrap">
                Featured
              </span>
            )}
          </div>

          <FavoriteButton
            isFavorite={isFav}
            onToggle={() => toggleFavorite(property.id)}
            ariaLabel={
              isFav
                ? `Remove ${property.title} from saved properties`
                : `Save ${property.title} to favourites`
            }
          />
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
            {property.property_type}
          </span>
        </div>

        <h3 className="font-display text-[clamp(1.25rem,2vw,1.5rem)] font-medium leading-snug tracking-[-0.015em] text-[var(--text-primary)] min-w-0">
          <Link
            to={detailPath}
            onClick={handleNavigate}
            className="min-h-[44px] w-full flex items-center -my-2 hover:text-[var(--accent-primary)] transition-colors min-w-0"
          >
            <span className="truncate">{property.title}</span>
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
