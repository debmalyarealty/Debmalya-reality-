import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { applyDocumentMeta, buildSiteMetaTags } from '../lib/metaTags';

export const NotFoundPage: React.FC = () => {
  const { settings } = useApp();

  useEffect(() => {
    applyDocumentMeta(
      buildSiteMetaTags({
        title: `Page Not Found — ${settings?.business_name || 'Debmalya Realty'}`,
        description:
          'The page you requested could not be found. Browse verified properties and construction services in Siliguri with Debmalya Realty.',
        pathname:
          typeof window !== 'undefined' ? window.location.pathname : '/404',
        robots: 'noindex, nofollow',
        image: settings?.hero_image_url,
        siteName: settings?.business_name,
      })
    );
  }, [settings]);

  return (
    <main className="fluid-container pt-[calc(env(safe-area-inset-top,0px)+6.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] min-h-[75svh] flex items-center justify-center">
      <div className="max-w-lg w-full rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-[clamp(1.5rem,4vw,2.5rem)] shadow-[var(--shadow-subtle)] text-center space-y-5">
        <div className="mx-auto h-12 w-12 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-[var(--accent-primary)] inline-flex items-center justify-center">
          <Building2 className="w-5 h-5" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
            404 &middot; Page not found
          </p>
          <h1 className="font-display text-[clamp(2rem,5vw,2.75rem)] font-medium leading-[1.1] text-[var(--text-primary)]">
            We couldn&apos;t find that page
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            The listing or link you opened may have moved or is no longer available. Explore our active properties across Siliguri.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
          <Link
            to="/"
            className="btn-primary-lux tap-press min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to home</span>
          </Link>
          <Link
            to="/properties"
            className="tap-press min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>Browse properties</span>
          </Link>
        </div>
      </div>
    </main>
  );
};
