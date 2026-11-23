import React, { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LUX_EASE } from '../lib/motion';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  ariaLabel: string;
  variant?: 'overlay' | 'pill';
  label?: string;
  className?: string;
}

const BURST_ANGLES = [0, 60, 120, 180, 240, 300];

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  ariaLabel,
  variant = 'overlay',
  label,
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const prevFav = useRef(isFavorite);
  const [animKind, setAnimKind] = useState<'none' | 'pop' | 'shrink'>('none');
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (prevFav.current !== isFavorite) {
      if (isFavorite) {
        setAnimKind('pop');
        setBurstKey((k) => k + 1);
      } else {
        setAnimKind('shrink');
      }
      prevFav.current = isFavorite;
      const t = window.setTimeout(() => setAnimKind('none'), 380);
      return () => window.clearTimeout(t);
    }
  }, [isFavorite]);

  const iconMotion = prefersReduced
    ? undefined
    : animKind === 'pop'
    ? { scale: [1, 1.34, 0.94, 1], transition: { duration: 0.36, ease: LUX_EASE } }
    : animKind === 'shrink'
    ? { scale: [1, 0.8, 1], transition: { duration: 0.24, ease: LUX_EASE } }
    : { scale: 1 };

  const baseClass =
    variant === 'overlay'
      ? 'relative h-11 w-11 inline-flex items-center justify-center rounded-full bg-black/72 backdrop-blur-md border border-white/25 text-white hover:bg-black/90 transition-colors cursor-pointer'
      : 'relative min-h-[44px] px-4 py-2 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] shadow-[var(--shadow-subtle)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5 cursor-pointer transition-colors';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={ariaLabel}
      aria-pressed={isFavorite}
      className={`${baseClass} ${className}`}
    >
      <span className="relative inline-flex items-center justify-center">
        <motion.span animate={iconMotion} className="inline-flex">
          <Heart
            className={`${variant === 'overlay' ? 'w-4 h-4' : 'w-3.5 h-3.5'} transition-colors duration-200 ${
              isFavorite
                ? 'fill-rose-400 text-rose-400'
                : variant === 'overlay'
                ? 'text-white'
                : 'text-current'
            }`}
          />
        </motion.span>

        {/* Subtle particle burst when saved */}
        <AnimatePresence>
          {!prefersReduced && animKind === 'pop' && burstKey > 0 && (
            <span
              key={burstKey}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              {BURST_ANGLES.map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const tx = Math.cos(rad) * 16;
                const ty = Math.sin(rad) * 16;
                return (
                  <motion.span
                    key={deg}
                    initial={{ x: 0, y: 0, scale: 0.7, opacity: 0.95 }}
                    animate={{ x: tx, y: ty, scale: 0, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.38, ease: LUX_EASE }}
                    className="absolute w-1.5 h-1.5 rounded-full bg-rose-400"
                  />
                );
              })}
            </span>
          )}
        </AnimatePresence>
      </span>

      {label && <span>{label}</span>}
    </button>
  );
};
