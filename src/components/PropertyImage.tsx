import React, { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { resolveLocalResponsiveSources } from '../lib/imageUtils';

interface PropertyImageProps {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export const PropertyImage: React.FC<PropertyImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  priority = false,
  sizes = '(max-width: 640px) 92vw, (max-width: 1024px) 48vw, 460px',
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const localSources = resolveLocalResponsiveSources(src);

  useEffect(() => {
    setFailed(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-[var(--bg-surface-muted)] text-[var(--text-muted)] px-4 text-center ${className}`}
      >
        <Building2 className="w-8 h-8 mb-2 opacity-60 text-[var(--accent-primary)]" />
        <span className="text-xs font-medium line-clamp-2 max-w-[180px]">
          {alt}
        </span>
      </div>
    );
  }

  const imageElement = (
    <img
      ref={imgRef}
      src={localSources ? localSources.jpegSrc : src}
      srcSet={localSources ? localSources.jpegSrcSet : undefined}
      sizes={localSources ? sizes : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={`${className} transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        loaded ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--bg-surface-muted)]">
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--bg-surface-muted)] shimmer-skeleton"
        />
      )}
      {localSources ? (
        <picture className="block w-full h-full">
          <source
            type="image/webp"
            srcSet={localSources.webpSrcSet}
            sizes={sizes}
          />
          <source
            type="image/jpeg"
            srcSet={localSources.jpegSrcSet}
            sizes={sizes}
          />
          {imageElement}
        </picture>
      ) : (
        imageElement
      )}
    </div>
  );
};
