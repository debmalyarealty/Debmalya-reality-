import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Facebook,
  Instagram,
  Linkedin,
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
      <div className="fluid-container pt-[clamp(3.25rem,6.5vw,5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pb-[clamp(3rem,5vw,4.5rem)] space-y-[clamp(2rem,4vw,3.25rem)]">
        {/* Brand Name, Tagline & Contact Info from Settings */}
        <div className="border-b border-[var(--border-hairline)] pb-[clamp(1.75rem,3.5vw,2.75rem)] space-y-5">
          <div>
            <p className="font-display font-medium text-[clamp(2.25rem,8vw,6.75rem)] leading-[0.96] tracking-[-0.025em] text-[var(--text-primary)] select-none break-anywhere">
              {businessName}
            </p>
            <p className="mt-4 text-base text-[var(--text-secondary)] fluid-prose">
              {settings?.tagline ||
                'High-End Builder & Property Consultant | Buy • Sell • Rent with Confidence.'}
            </p>
          </div>
        </div>

        {/* Explore Navigation & Social Icons */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2.5">
              Explore
            </h3>
            <ul className="grid grid-cols-2 min-[420px]:grid-cols-3 md:flex md:flex-wrap md:items-center gap-x-6 gap-y-1.5 text-sm font-medium">
              <li>
                <Link
                  to="/"
                  onClick={handlePublicNavigation}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)]"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/properties"
                  onClick={handlePublicNavigation}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)]"
                >
                  All properties
                </Link>
              </li>
              <li>
                <Link
                  to="/#services"
                  onClick={(e) => handleSectionLink(e, 'services')}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)]"
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  to="/#about"
                  onClick={(e) => handleSectionLink(e, 'about')}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)]"
                >
                  About us
                </Link>
              </li>
              <li>
                <Link
                  to="/#reviews"
                  onClick={(e) => handleSectionLink(e, 'reviews')}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)]"
                >
                  Reviews
                </Link>
              </li>
              <li>
                <Link
                  to="/#contact"
                  onClick={(e) => handleSectionLink(e, 'contact')}
                  className="min-h-[44px] inline-flex items-center hover:text-[var(--accent-primary)]"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {validSocials.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {validSocials.map(({ name, url, Icon }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:text-[var(--accent-primary)]"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Copyright & Legal */}
        <div className="pt-6 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[13px] font-medium text-[var(--text-muted)]">
          <p className="text-[var(--text-secondary)] break-anywhere max-w-full">
            &copy; {new Date().getFullYear()} {businessName}, Siliguri. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link
              to="/privacy-policy"
              onClick={handlePublicNavigation}
              className="min-h-[44px] inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              onClick={handlePublicNavigation}
              className="min-h-[44px] inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
            >
              Terms &amp; Conditions
            </Link>
            <Link
              to="/disclaimer"
              onClick={handlePublicNavigation}
              className="min-h-[44px] inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
            >
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
