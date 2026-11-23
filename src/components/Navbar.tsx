import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  Phone,
  Sun,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';

const SECTIONS = [
  { id: 'hero', label: 'Home' },
  { id: 'properties', label: 'Properties' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About us' },
  { id: 'team', label: 'Our team' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'contact', label: 'Contact' },
];

export const Navbar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    user,
    openAuthModal,
    settings,
    logout,
    enterOwnerWebsiteView,
    exitOwnerWebsiteView,
    setNavDrawerOpen,
  } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const location = useLocation();
  const navigate = useNavigate();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  const isHome = location.pathname === '/';
  const overHero = isHome && !scrolled;
  const isOwnerOnPublicSite =
    user?.role === 'owner' &&
    !location.pathname.startsWith('/owner-dashboard') &&
    !location.pathname.startsWith('/owner-login/dashboard');

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 36);
      if (location.pathname !== '/') return;
      const scrollPos = window.scrollY + 180;
      let current = 'hero';
      for (const sec of SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el && el.offsetTop <= scrollPos) {
          current = sec.id;
        }
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  useEffect(() => {
    setNavDrawerOpen(drawerOpen);
    if (!drawerOpen) {
      setPropertiesExpanded(false);
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        menuBtnRef.current?.focus();
      }
      return;
    }

    wasOpenRef.current = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.getClientRects().length > 0);

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (!drawerRef.current.contains(document.activeElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen, setNavDrawerOpen]);

  useEffect(() => {
    return () => setNavDrawerOpen(false);
  }, [setNavDrawerOpen]);

  const navigateToSection = (sectionId: string) => {
    setDrawerOpen(false);
    if (user?.role === 'owner') {
      enterOwnerWebsiteView();
    }
    if (location.pathname === '/') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate(`/#${sectionId}`);
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };

  const navigateToPath = (path: string) => {
    setDrawerOpen(false);
    if (
      user?.role === 'owner' &&
      !path.startsWith('/owner-dashboard') &&
      !path.startsWith('/owner-login')
    ) {
      enterOwnerWebsiteView();
    }
    navigate(path);
  };

  const phoneDisplay = settings?.phone || '+91 86498 58954';
  const phoneHref = `tel:${phoneDisplay.replace(/\s+/g, '')}`;
  const addressDisplay =
    settings?.address ||
    'Sevoke Road, Ward Number 13, Dasrath Pally, Bhanu Nagar, Siliguri 734001';

  const navItems: Array<
    | { kind: 'section'; id: string; label: string }
    | { kind: 'properties'; label: string }
  > = [
    { kind: 'section', id: 'hero', label: 'Home' },
    { kind: 'properties', label: 'Properties' },
    { kind: 'section', id: 'services', label: 'Services' },
    { kind: 'section', id: 'about', label: 'About us' },
    { kind: 'section', id: 'team', label: 'Our team' },
    { kind: 'section', id: 'reviews', label: 'Reviews' },
    { kind: 'section', id: 'contact', label: 'Contact' },
  ];

  const isOwnerDashboardRoute =
    location.pathname.startsWith('/owner-dashboard') ||
    location.pathname.startsWith('/owner-login/dashboard');

  if (isOwnerDashboardRoute) {
    return null;
  }

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-40 w-full max-w-[100vw] overflow-x-clip transition-all duration-500 ${
          overHero
            ? 'bg-gradient-to-b from-[#16201B]/65 via-[#16201B]/25 to-transparent pt-[calc(env(safe-area-inset-top,0px)+clamp(0.75rem,2vw,1.25rem))] pb-[clamp(0.75rem,2vw,1.25rem)]'
            : 'bg-[var(--bg-canvas)]/90 backdrop-blur-2xl shadow-[var(--shadow-subtle)] pt-[calc(env(safe-area-inset-top,0px)+0.625rem)] pb-2.5 sm:pb-3'
        }`}
      >
        <div className="fluid-container flex items-center justify-between gap-2 pl-[max(env(safe-area-inset-left,0px),clamp(0.75rem,3vw,2rem))] pr-[max(env(safe-area-inset-right,0px),clamp(0.75rem,3vw,2rem))]">
          <Link
            to="/"
            onClick={() => {
              setDrawerOpen(false);
              if (user?.role === 'owner') {
                enterOwnerWebsiteView();
              }
            }}
            aria-label="Debmalya Realty Home"
            className="min-h-[44px] min-w-0 max-w-full shrink overflow-hidden inline-flex items-center rounded-full py-1 px-0.5 sm:px-1 transition-opacity hover:opacity-85"
          >
            <BrandLogo onDarkOverlay={overHero} />
          </Link>

          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {user ? (
              <Link
                id="navbar-dashboard-btn"
                data-dashboard-trigger="true"
                to={user.role === 'owner' ? '/owner-dashboard' : '/my-account'}
                onClick={() => {
                  setDrawerOpen(false);
                  if (user.role === 'owner') {
                    exitOwnerWebsiteView();
                  }
                }}
                aria-label="Dashboard"
                title="Dashboard"
                className={`h-11 w-11 inline-flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shrink-0 ${
                  overHero
                    ? 'bg-black/45 border border-white/40 text-white hover:bg-black/65 backdrop-blur-md'
                    : 'bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)]'
                }`}
              >
                <LayoutDashboard
                  className={`w-4 h-4 shrink-0 ${
                    overHero ? 'text-[#F5DFB0]' : 'text-[var(--accent-primary)]'
                  }`}
                />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  openAuthModal('login');
                }}
                aria-label="Sign in or create account"
                title="Sign in or create account"
                className={`min-h-[44px] min-w-[44px] px-0 min-[420px]:px-3.5 inline-flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
                  overHero
                    ? 'bg-black/45 border border-white/40 text-white hover:bg-black/65 backdrop-blur-md'
                    : 'bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)]'
                }`}
              >
                <User
                  className={`w-4 h-4 shrink-0 ${
                    overHero ? 'text-[#F5DFB0]' : 'text-[var(--accent-primary)]'
                  }`}
                />
                <span className="hidden min-[420px]:inline text-[13px] font-medium whitespace-nowrap">
                  Sign in
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => toggleTheme(e)}
              aria-label={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              title={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              className={`h-11 w-11 inline-flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shrink-0 ${
                overHero
                  ? 'bg-black/45 border border-white/40 text-white hover:bg-black/65 backdrop-blur-md'
                  : 'bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)]'
              }`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#F5DFB0]" />
              ) : (
                <Moon
                  className={`w-4 h-4 ${
                    overHero ? 'text-white' : 'text-[var(--accent-primary)]'
                  }`}
                />
              )}
            </button>

            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Open navigation menu"
              title="Menu"
              aria-expanded={drawerOpen}
              aria-controls="universal-nav-drawer"
              className={`h-11 w-11 inline-flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shrink-0 ${
                overHero
                  ? 'bg-black/45 border border-white/45 text-white hover:bg-black/65 backdrop-blur-md'
                  : 'bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)]'
              }`}
            >
              <span aria-hidden="true" className="relative w-4 h-3.5 flex flex-col justify-between">
                <span
                  className={`block h-[1.5px] w-4 rounded-full bg-current origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    drawerOpen ? 'translate-y-[6px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200 ${
                    drawerOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-4 rounded-full bg-current origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    drawerOpen ? '-translate-y-[6px] -rotate-45' : ''
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Blurred Dark Backdrop Overlay */}
      <div
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-50 bg-black/55 backdrop-blur-sm transition-opacity duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          drawerOpen
            ? 'opacity-100 pointer-events-auto visible'
            : 'opacity-0 pointer-events-none invisible'
        }`}
      />

      {/* Sliding Architectural Navigation Drawer */}
      <aside
        ref={drawerRef}
        id="universal-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={`fixed inset-0 h-[100dvh] max-h-[100dvh] z-50 bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col overflow-hidden transition-[transform,opacity,visibility] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          drawerOpen
            ? 'opacity-100 translate-x-0 pointer-events-auto visible'
            : 'opacity-0 translate-x-6 pointer-events-none invisible'
        }`}
      >
        {/* Top Row inside Overlay */}
        <div className="fluid-container flex items-center justify-between gap-2 pt-[calc(env(safe-area-inset-top,0px)+clamp(0.75rem,2vw,1.25rem))] pb-3 shrink-0">
          <div className="min-w-0 shrink">
            <BrandLogo compact />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => toggleTheme(e)}
              aria-label={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[var(--accent-primary)]" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--accent-primary)]" />
              )}
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="h-11 px-4 sm:px-5 inline-flex items-center gap-2 rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)] transition-colors cursor-pointer text-sm font-medium shrink-0"
            >
              <span aria-hidden="true" className="relative w-4 h-3.5 flex flex-col justify-between">
                <span
                  className={`block h-[1.5px] w-4 rounded-full bg-current origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    drawerOpen ? 'translate-y-[6px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200 ${
                    drawerOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-4 rounded-full bg-current origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    drawerOpen ? '-translate-y-[6px] -rotate-45' : ''
                  }`}
                />
              </span>
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Main Navigation Split */}
        <div className="flex-1 min-h-0 overflow-y-auto fluid-container pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start lg:items-end">
          <nav
            className="lg:col-span-7 flex flex-col items-start gap-1 sm:gap-2.5 min-w-0"
            aria-label="Primary drawer menu"
          >
            {navItems.map((item, idx) => {
              const delayMs = drawerOpen ? idx * 55 : 0;

              if (item.kind === 'properties') {
                const isPropActive =
                  location.pathname.startsWith('/properties') ||
                  (isHome && activeSection === 'properties');
                return (
                  <div
                    key="properties-group"
                    style={{
                      transitionDelay: `${delayMs}ms`,
                    }}
                    className={`w-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      drawerOpen
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-4'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPropertiesExpanded((v) => !v)}
                      aria-expanded={propertiesExpanded}
                      className={`font-display text-[clamp(1.75rem,4.6vw,3.5rem)] font-medium leading-[1.15] min-h-[44px] inline-flex items-center gap-3 transition-colors cursor-pointer ${
                        isPropActive
                          ? 'text-[var(--accent-primary)]'
                          : 'text-[var(--text-primary)] hover:text-[var(--accent-primary)]'
                      }`}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={`w-6 h-6 transition-transform duration-300 ${
                          propertiesExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {propertiesExpanded && (
                      <div className="mt-2 mb-2 pl-4 sm:pl-6 flex flex-wrap gap-x-5 gap-y-1.5 border-l border-[var(--border-input)]">
                        {[
                          { label: 'Buy property', path: '/properties?type=Buy' },
                          { label: 'Rent property', path: '/properties?type=Rent' },
                          { label: 'Sell property', section: 'contact' },
                          { label: 'All listings', path: '/properties' },
                        ].map((sub) => (
                          <button
                            key={sub.label}
                            type="button"
                            onClick={() =>
                              sub.path
                                ? navigateToPath(sub.path)
                                : navigateToSection(sub.section!)
                            }
                            className="min-h-[44px] py-2 text-base font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = isHome && activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateToSection(item.id)}
                  style={{
                    transitionDelay: `${delayMs}ms`,
                  }}
                  className={`font-display text-[clamp(1.75rem,4.6vw,3.5rem)] font-medium leading-[1.15] min-h-[44px] text-left transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
                    drawerOpen
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4'
                  } ${
                    isActive
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-primary)] hover:text-[var(--accent-primary)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Editorial Office Info & Account Block */}
          <div
            style={{ transitionDelay: drawerOpen ? '260ms' : '0ms' }}
            className={`lg:col-span-5 space-y-5 pb-2 min-w-0 transition-all duration-500 ${
              drawerOpen
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="space-y-2 text-base text-[var(--text-secondary)]">
              <p className="inline-flex items-start gap-2 leading-relaxed break-anywhere">
                <MapPin className="w-4 h-4 mt-1 shrink-0 text-[var(--accent-primary)]" />
                <span>{addressDisplay}</span>
              </p>
            </div>

            <div className="flex flex-col items-start gap-3.5">
              <button
                type="button"
                onClick={() => navigateToSection('contact')}
                className="btn-primary-lux min-h-[44px] px-7 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium cursor-pointer"
              >
                Get in touch
              </button>
              <a
                href={phoneHref}
                className="min-h-[44px] px-6 py-3 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Phone className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span className="tabular-nums">{phoneDisplay}</span>
              </a>
            </div>

            <div className="pt-4 border-t border-[var(--border-hairline)]">
              {user ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (user.role === 'owner') {
                        exitOwnerWebsiteView();
                        navigateToPath('/owner-dashboard');
                      } else {
                        navigateToPath('/my-account');
                      }
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>Dashboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setDrawerOpen(false);
                      await logout();
                    }}
                    className="min-h-[44px] px-4 rounded-full border border-[var(--border-hairline)] hover:border-rose-500/50 text-[13px] font-medium text-[var(--text-secondary)] hover:text-rose-500 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    openAuthModal('login');
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Sign in / Create account</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
