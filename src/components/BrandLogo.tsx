import React from 'react';
import { useApp } from '../context/AppContext';

interface BrandLogoProps {
  compact?: boolean;
  onDarkOverlay?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  compact = false,
  onDarkOverlay = false,
}) => {
  const { settings } = useApp();
  const logoUrl = settings?.logo_url;
  const businessName = settings?.business_name || 'Debmalya Realty';

  return (
    <span className="inline-flex items-center gap-[clamp(0.4rem,1.4vw,0.75rem)] min-w-0 max-w-full overflow-hidden">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={businessName}
          referrerPolicy="no-referrer"
          className="h-[clamp(22px,5vw,32px)] w-[clamp(22px,5vw,32px)] rounded-full object-contain shrink-0"
        />
      ) : (
        <svg
          width="26"
          height="26"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
          className="w-[clamp(20px,5vw,28px)] h-[clamp(20px,5vw,28px)] shrink-0"
        >
          <path
            d="M6 28V15L18 6L30 15V28"
            className={
              onDarkOverlay
                ? 'stroke-[#CDAA6E]'
                : 'stroke-[var(--accent-secondary)]'
            }
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.5 28V19H22.5V28"
            className={
              onDarkOverlay
                ? 'stroke-[#F1ECE1]'
                : 'stroke-[var(--text-primary)]'
            }
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="4"
            y1="28"
            x2="32"
            y2="28"
            className={
              onDarkOverlay
                ? 'stroke-[#F1ECE1]/50'
                : 'stroke-[var(--text-muted)]'
            }
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span
        className={`font-display font-medium tracking-[-0.02em] truncate transition-colors ${
          onDarkOverlay ? 'text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.65)]' : 'text-[var(--text-primary)]'
        } ${compact ? 'text-[clamp(1rem,3.4vw,1.25rem)]' : 'text-[clamp(0.95rem,3.4vw,1.5rem)]'}`}
      >
        {businessName}
      </span>
    </span>
  );
};
