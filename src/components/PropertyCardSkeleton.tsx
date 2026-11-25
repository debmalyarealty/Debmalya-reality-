import React from 'react';

interface PropertyCardSkeletonProps {
  className?: string;
}

export const PropertyCardSkeleton: React.FC<PropertyCardSkeletonProps> = ({
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      className={`min-w-0 flex flex-col rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-subtle)] ${className}`}
    >
      <div className="relative aspect-[4/5] bg-[var(--bg-surface-muted)] shimmer-skeleton" />
      <div className="flex-1 p-[clamp(1rem,2.8vw,1.75rem)] flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="h-7 w-28 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-4 w-20 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        </div>
        <div className="space-y-2 min-h-[3.35rem]">
          <div className="h-5 w-11/12 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-5 w-2/3 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        </div>
        <div className="h-4 w-4/5 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-[var(--border-hairline)]">
          <div className="h-4 w-32 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-10 w-10 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        </div>
      </div>
    </div>
  );
};

export const CarouselSkeleton: React.FC = () => {
  return (
    <div aria-hidden="true" className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="h-4 w-48 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-11 sm:h-14 w-72 sm:w-96 max-w-full rounded-2xl bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-4 w-80 max-w-full rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-11 w-11 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-11 w-11 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        </div>
      </div>

      <div className="relative h-[clamp(360px,54vw,510px)] w-full flex items-center justify-center overflow-hidden">
        <div className="w-[min(88%,440px)] sm:w-[68%] lg:w-[54%] h-[clamp(330px,50vw,470px)] rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface-muted)] shimmer-skeleton shadow-[var(--shadow-subtle)]" />
      </div>
    </div>
  );
};
