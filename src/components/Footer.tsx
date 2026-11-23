import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Facebook,
  Instagram,
  Linkedin,
  MapPin,
  Phone,
  Youtube,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

function isValidHttpUrl(val?: string): boolean {
  if (!val) return false;
  try {
    const u = new URL(val);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export const Footer: React.FC = () => {
  const { settings, user, enterOwnerWebsiteView } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const handlePublicNavigation = () => {
    if (user?.role === 'owner') {
      enterOwnerWebsiteView();
    }
  };

  const handleSectionLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    sectionId: string
  ) => {
    e.preventDefault();
    handlePublicNavigation();
    if (location.pathname === '/') {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    navigate(`/#${sectionId}`);
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };
  const businessName = settings?.business_name || 'Debmalya Realty';
  const phone = settings?.phone || '+91 86498 58954';
  const address =
    settings?.address ||
    'Sevoke Road, Ward Number 13, Dasrath Pally, Bhanu Nagar, Siliguri, West Bengal 734001.';
  const social = settings?.social_links || {
    instagram: '',
    facebook: '',
    youtube: '',
    linkedin: '',
  };

  const validSocials = [
    { name: 'Instagram', url: social.instagram, Icon: Instagram },
    { name: 'Facebook', url: social.facebook, Icon: Facebook },
    { name: 'YouTube', url: social.youtube, Icon: Youtube },
    { name: 'LinkedIn', url: social.linkedin, Icon: Linkedin },
  ].filter((item) => isValidHttpUrl(item.url));

  const isOwnerDashboardRoute =
    location.pathname.startsWith('/owner-dashboard') ||
    location.pathname.startsWith('/owner-login/dashboard');

  if (isOwnerDashboardRoute) {
    return null;
  }

  return (
    <footer className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
      <div className="fluid-container pt-[clamp(3.75rem,7.5vw,6.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pb-[clamp(3rem,5vw,4.5rem)] space-y-[clamp(2.5rem,5vw,4rem)]">
        {/* Giant Architectural Brand Display */}
        <div className="border-b border-[var(--border-hairline)] pb-[clamp(2rem,4vw,3.5rem)]">
          <p className="font-display font-medium text-[clamp(2.25rem,8.5vw,7.5rem)] leading-[0.94] tracking-[-0.025em] text-[var(--text-primary)] select-none break-anywhere">
            {businessName}
          </p>
          <p className="mt-5 text-base text-[var(--text-secondary)] fluid-prose">
            {settings?.tagline ||
              'High-End Builder & Property Consultant | Buy • Sell • Rent with Confidence.'}
          </p>
        </div>

        {/* Clean Minimal Navigation & Real Contact Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-[clamp(1.75rem,4vw,3rem)]">
          <div className="lg:col-span-3 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Explore
            </h3>
            <ul className="space-y-1 text-sm font-medium">
              <li>
                <Link
                  to="/"
                  onClick={handlePublicNavigation}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/properties"
                  onClick={handlePublicNavigation}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  All properties
                </Link>
              </li>
              <li>
                <Link
                  to="/#services"
                  onClick={(e) => handleSectionLink(e, 'services')}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  to="/#about"
                  onClick={(e) => handleSectionLink(e, 'about')}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  About us
                </Link>
              </li>
              <li>
                <Link
                  to="/#reviews"
                  onClick={(e) => handleSectionLink(e, 'reviews')}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  Client reviews
                </Link>
              </li>
              <li>
                <Link
                  to="/#contact"
                  onClick={(e) => handleSectionLink(e, 'contact')}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-4 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Siliguri portfolio
            </h3>
            <ul className="space-y-1 text-sm font-medium">
              <li>
                <Link
                  to="/properties?type=Buy"
                  onClick={handlePublicNavigation}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  Buy property in Siliguri
                </Link>
              </li>
              <li>
                <Link
                  to="/properties?type=Rent"
                  onClick={handlePublicNavigation}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  Rental homes &amp; spaces
                </Link>
              </li>
              <li>
                <Link
                  to="/properties?category=Flats%20%2F%20Apartments"
                  onClick={handlePublicNavigation}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  Flats &amp; apartments
                </Link>
              </li>
              <li>
                <Link
                  to="/properties?category=Residential%20Plots"
                  onClick={handlePublicNavigation}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)] transition-colors"
                >
                  Residential plots &amp; land
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-5 space-y-4 text-base min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Office &amp; direct contact
            </h3>
            <div className="flex items-start gap-2.5 text-sm font-medium text-[var(--text-secondary)]">
              <MapPin className="w-4 h-4 mt-1 shrink-0 text-[var(--accent-primary)]" />
              <span className="leading-relaxed break-anywhere">{address}</span>
            </div>
            <div className="flex items-center gap-2.5 text-base">
              <Phone className="w-4 h-4 shrink-0 text-[var(--accent-primary)]" />
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="min-h-[44px] inline-flex items-center tabular-nums font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
              >
                {phone}
              </a>
            </div>
            {validSocials.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {validSocials.map(({ name, url, Icon }) => (
                  <a
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={name}
                    className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:text-[var(--accent-primary)] transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[13px] font-medium text-[var(--text-muted)]">
          <p className="text-[var(--text-secondary)]">
            &copy; {new Date().getFullYear()} {businessName}, Siliguri. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              to="/privacy-policy"
              onClick={handlePublicNavigation}
              className="min-h-[44px] inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              onClick={handlePublicNavigation}
              className="min-h-[44px] inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              Terms &amp; Conditions
            </Link>
            <Link
              to="/disclaimer"
              onClick={handlePublicNavigation}
              className="min-h-[44px] inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
