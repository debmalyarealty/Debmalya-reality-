import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  type MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  FileCheck2,
  Home,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Tag,
} from 'lucide-react';
import { LUX_EASE, navigateWithTransition } from '../lib/motion';
import { useApp } from '../context/AppContext';
import {
  fetchPublicPropertiesWithMeta,
  fetchUserPreferences,
  fetchVisibleTeamMembers,
  getCachedPublicProperties,
  getCachedVisibleTeamMembers,
  isPublicPropertiesCacheFresh,
  submitInquiry,
} from '../lib/supabaseData';
import {
  computeRecommendations,
  filterAndSortProperties,
  isPropertyActiveOpportunity,
  validateInquiryFields,
  type InquiryFieldErrors,
} from '../lib/realtyLogic';
import {
  buildSmartPropertyFilters,
  collectUniqueLocations,
  countActiveFilters,
  formatPropertiesCount,
  SMART_BUDGET_RANGES,
  type SmartSearchState,
} from '../lib/searchHelpers';
import { useKeyboardSafeForm } from '../lib/formKeyboard';
import { DEFAULT_SERVICES, DEMO_PROPERTIES } from '../lib/demoData';
import { resolveLocalResponsiveSources } from '../lib/imageUtils';
import { applyDocumentMeta, buildSiteMetaTags } from '../lib/metaTags';
import type { Agent, Property } from '../types/realty';
import { CoverFlowCarousel } from '../components/CoverFlowCarousel';
import { PropertyCard } from '../components/PropertyCard';
import {
  CarouselSkeleton,
  PropertyCardSkeleton,
} from '../components/PropertyCardSkeleton';
import { ReviewsCarousel } from '../components/ReviewsCarousel';
import { PropertyImage } from '../components/PropertyImage';
import { SmartSearchBlock } from '../components/SmartSearchBlock';
import type { RecommendedProperty } from '../lib/realtyLogic';

const SERVICE_TILE_VISUALS: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
  }
> = {
  construction: {
    icon: Building2,
    iconBg: 'bg-[#1F3A2E] text-[#F5DFB0] dark:bg-[#264234] dark:text-[#F5DFB0]',
  },
  buying: {
    icon: Home,
    iconBg: 'bg-[#7A5428] text-white dark:bg-[#9C6F38] dark:text-white',
  },
  selling: {
    icon: Tag,
    iconBg: 'bg-[#2C473C] text-[#F5DFB0] dark:bg-[#335246] dark:text-[#F5DFB0]',
  },
  rentals: {
    icon: KeyRound,
    iconBg: 'bg-[#294452] text-white dark:bg-[#355666] dark:text-white',
  },
  visits: {
    icon: Compass,
    iconBg: 'bg-[#63512B] text-[#FAF6EE] dark:bg-[#7D6637] dark:text-[#FAF6EE]',
  },
  documentation: {
    icon: FileCheck2,
    iconBg: 'bg-[#5A3F32] text-white dark:bg-[#735242] dark:text-white',
  },
};

const STATEMENT_WORDS =
  'Flats, houses, plots and construction in Siliguri, with honest advice and clear paperwork.'.split(
    ' '
  );

interface StatementWordProps {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  prefersReduced: boolean;
}

const StatementWord: React.FC<StatementWordProps> = ({
  word,
  index,
  total,
  progress,
  prefersReduced,
}) => {
  const start = (index / total) * 0.62;
  const end = Math.min(0.95, start + 0.24);
  const opacity = useTransform(progress, [start, end], [0.55, 1]);

  if (prefersReduced) {
    return (
      <>
        {word}
        {index < total - 1 ? ' ' : ''}
      </>
    );
  }

  return (
    <>
      <motion.span style={{ opacity }} className="inline">
        {word}
      </motion.span>
      {index < total - 1 ? ' ' : ''}
    </>
  );
};

function splitHeadlineLines(headline: string): string[] {
  const trimmed = headline.trim();
  if (trimmed === "Find a Place You'll Love to Call Home.") {
    return ["Find a Place You'll Love", 'to Call Home.'];
  }
  const words = trimmed.split(/\s+/);
  if (words.length <= 4) return [trimmed];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

export const HomePage: React.FC = () => {
  const { settings, user, openAuthModal, showToast } = useApp();
  const navigate = useNavigate();
  const prefersReduced = !!useReducedMotion();
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const [isLandscapeCompact, setIsLandscapeCompact] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(orientation: landscape) and (max-height: 540px)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqDesktop = window.matchMedia('(min-width: 768px)');
    const mqLandscape = window.matchMedia(
      '(orientation: landscape) and (max-height: 540px)'
    );
    const syncViewportFlags = () => {
      setIsDesktop(mqDesktop.matches);
      setIsLandscapeCompact(mqLandscape.matches);
    };
    syncViewportFlags();
    mqDesktop.addEventListener('change', syncViewportFlags);
    mqLandscape.addEventListener('change', syncViewportFlags);
    window.addEventListener('resize', syncViewportFlags);
    window.addEventListener('orientationchange', syncViewportFlags);
    return () => {
      mqDesktop.removeEventListener('change', syncViewportFlags);
      mqLandscape.removeEventListener('change', syncViewportFlags);
      window.removeEventListener('resize', syncViewportFlags);
      window.removeEventListener('orientationchange', syncViewportFlags);
    };
  }, []);

  const enableParallax = !prefersReduced && isDesktop && !isLandscapeCompact;

  const heroRef = useRef<HTMLElement>(null);
  const statementRef = useRef<HTMLElement>(null);
  const aboutImgRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroParallaxY = useTransform(heroScroll, [0, 1], ['0%', '14%']);

  const { scrollYProgress: statementScroll } = useScroll({
    target: statementRef,
    offset: ['start 0.88', 'center 0.56'],
  });

  const { scrollYProgress: aboutScroll } = useScroll({
    target: aboutImgRef,
    offset: ['start end', 'end start'],
  });
  const aboutParallaxY = useTransform(aboutScroll, [0, 1], ['-6%', '6%']);

  const [properties, setProperties] = useState<Property[]>(
    () => getCachedPublicProperties() ?? []
  );
  const [agents, setAgents] = useState<Agent[]>(
    () => getCachedVisibleTeamMembers() ?? []
  );
  const [recommendations, setRecommendations] = useState<RecommendedProperty[]>(
    () => {
      const cached = getCachedPublicProperties();
      return cached && cached.length > 0
        ? computeRecommendations(cached, null, 6)
        : [];
    }
  );
  const [personalized, setPersonalized] = useState(false);
  const [loadingProps, setLoadingProps] = useState(
    () => getCachedPublicProperties() === null
  );

  // Smart search state
  const [searchState, setSearchState] = useState<SmartSearchState>({
    query: '',
    listing: 'All',
    location: 'All',
    propertyType: 'All',
    budgetIdx: 0,
  });
  const [navigatingSearch, setNavigatingSearch] = useState(false);
  const searchNavTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (searchNavTimerRef.current !== null) {
        window.clearTimeout(searchNavTimerRef.current);
      }
    };
  }, []);

  // Properties section tab state ('all' | 'featured')
  const [propertyTab, setPropertyTab] = useState<'all' | 'featured'>('all');

  // Services accordion state (one open at a time)
  const [openServiceKey, setOpenServiceKey] = useState<string | null>(null);

  // Contact form state
  const contactFormRef = useRef<HTMLFormElement>(null);
  const { keyboardOpen: contactKeyboardOpen } = useKeyboardSafeForm(contactFormRef);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cInterest, setCInterest] = useState('Property Buying');
  const [cMessage, setCMessage] = useState('');
  const [cSubmitting, setCSubmitting] = useState(false);
  const [cSubmittedOk, setCSubmittedOk] = useState(false);
  const [cFieldErrors, setCFieldErrors] = useState<InquiryFieldErrors>({});
  const [cError, setCError] = useState<string | null>(null);
  const [cErrorKey, setCErrorKey] = useState(0);
  const [cSuccess, setCSuccess] = useState<string | null>(null);

  useEffect(() => {
    applyDocumentMeta(
      buildSiteMetaTags({
        pathname: '/',
        image: settings?.hero_image_url,
        siteName: settings?.business_name,
      })
    );
  }, [settings]);

  useEffect(() => {
    if (user) {
      if (!cName) setCName(user.full_name || '');
      if (!cPhone) setCPhone(user.phone || '');
      if (!cEmail) setCEmail(user.email || '');
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const cachedProps = getCachedPublicProperties();
    const forceRefresh = !isPublicPropertiesCacheFresh();
    if (cachedProps === null) {
      setLoadingProps(true);
    }

    const slowTimer =
      cachedProps === null
        ? window.setTimeout(() => {
            if (!active) return;
            setProperties((prev) => {
              if (prev.length > 0) return prev;
              setRecommendations(computeRecommendations(DEMO_PROPERTIES, null, 6));
              setLoadingProps(false);
              return DEMO_PROPERTIES;
            });
          }, 2800)
        : undefined;

    Promise.all([
      fetchPublicPropertiesWithMeta({ force: forceRefresh }),
      fetchVisibleTeamMembers({ force: forceRefresh }),
      user?.role === 'client' ? fetchUserPreferences(user.id) : Promise.resolve(null),
    ])
      .then(([propsResult, teamData, prefsData]) => {
        if (!active) return;
        window.clearTimeout(slowTimer);
        setProperties(propsResult.properties);
        setAgents(teamData);
        setRecommendations(
          computeRecommendations(propsResult.properties, prefsData, 6)
        );
        setPersonalized(Boolean(user?.role === 'client' && prefsData));
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(slowTimer);
        setProperties((prev) => {
          if (prev.length > 0) return prev;
          setRecommendations(computeRecommendations(DEMO_PROPERTIES, null, 6));
          return DEMO_PROPERTIES;
        });
      })
      .finally(() => {
        window.clearTimeout(slowTimer);
        if (active) setLoadingProps(false);
      });
    return () => {
      active = false;
      window.clearTimeout(slowTimer);
    };
  }, [user]);

  const activeProperties = useMemo(
    () =>
      filterAndSortProperties(
        properties,
        { status: 'ActiveOnly' },
        { publicOnly: true, allowClosedInAll: false }
      ),
    [properties]
  );

  const hasActiveSearchFilters = useMemo(
    () => countActiveFilters(searchState) > 0,
    [searchState]
  );

  const filteredAvailableProperties = useMemo(
    () =>
      filterAndSortProperties(
        properties,
        buildSmartPropertyFilters(searchState),
        { publicOnly: true, allowClosedInAll: false }
      ),
    [properties, searchState]
  );

  const displayedProperties = useMemo(() => {
    if (hasActiveSearchFilters) {
      return filteredAvailableProperties;
    }
    if (propertyTab === 'featured') {
      return activeProperties.filter((p) => p.is_featured);
    }
    return activeProperties;
  }, [
    hasActiveSearchFilters,
    filteredAvailableProperties,
    activeProperties,
    propertyTab,
  ]);

  const recommendedCarouselData = useMemo(() => {
    const reasonsById: Record<string, string[]> = {};
    const activeRecs = recommendations.filter((r) =>
      isPropertyActiveOpportunity(r.property.status)
    );

    if (user && activeRecs.length > 0) {
      for (const r of activeRecs) {
        if (r.reasons.length > 0) reasonsById[r.property.id] = r.reasons;
      }
      return {
        items: activeRecs.map((r) => r.property),
        reasonsById,
      };
    }

    const featured = activeProperties.filter(
      (p) => p.is_recommended || p.is_featured
    );
    const items = featured.length > 0 ? featured : activeProperties.slice(0, 6);
    for (const r of activeRecs) {
      if (r.reasons.length > 0) reasonsById[r.property.id] = r.reasons;
    }
    return { items, reasonsById };
  }, [user, recommendations, activeProperties]);

  const buildPropertiesHref = (state: SmartSearchState): string => {
    const params = new URLSearchParams();
    if (state.listing !== 'All') params.set('type', state.listing);
    if (state.location !== 'All') params.set('location', state.location);
    if (state.propertyType !== 'All') params.set('category', state.propertyType);
    const budget = SMART_BUDGET_RANGES[state.budgetIdx];
    if (budget?.min !== '' && budget?.min !== undefined) {
      params.set('minPrice', String(budget.min));
    }
    if (budget?.max !== '' && budget?.max !== undefined) {
      params.set('maxPrice', String(budget.max));
    }
    const qs = params.toString();
    return qs ? `/properties?${qs}` : '/properties';
  };

  const handleSearchSubmit = (overrideState?: SmartSearchState) => {
    const nextState = overrideState ?? searchState;
    if (overrideState) {
      setSearchState(overrideState);
    }
    const targetHref = buildPropertiesHref(nextState);
    setNavigatingSearch(true);
    if (searchNavTimerRef.current !== null) {
      window.clearTimeout(searchNavTimerRef.current);
    }
    if (prefersReduced) {
      navigateWithTransition(navigate, targetHref);
      return;
    }
    searchNavTimerRef.current = window.setTimeout(() => {
      navigateWithTransition(navigate, targetHref);
    }, 120);
  };

  const handleClearAllSearch = () => {
    setSearchState({
      query: '',
      listing: 'All',
      location: 'All',
      propertyType: 'All',
      budgetIdx: 0,
    });
  };

  const viewAllPropertiesHref = useMemo(
    () => buildPropertiesHref(searchState),
    [searchState]
  );

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cSubmitting) return;
    setCError(null);
    setCSuccess(null);
    const { fields, firstError } = validateInquiryFields({
      name: cName,
      phone: cPhone,
      email: cEmail,
      interested_in: cInterest,
      message: cMessage,
    });
    if (firstError) {
      setCFieldErrors(fields);
      setCError(firstError);
      setCErrorKey((k) => k + 1);
      const firstId = fields.name
        ? 'contact-name'
        : fields.phone
        ? 'contact-phone'
        : fields.email
        ? 'contact-email'
        : fields.interested_in
        ? 'contact-interest'
        : 'contact-message';
      document.getElementById(firstId)?.focus();
      return;
    }
    setCFieldErrors({});

    setCSubmitting(true);
    setCSubmittedOk(false);
    try {
      await submitInquiry({
        user_id: user?.id ?? null,
        name: cName,
        phone: cPhone,
        email: cEmail,
        interest: cInterest,
        message: cMessage,
      });
      const successMsg = 'Thank you. Your inquiry has been sent to Debmalya Realty.';
      setCSuccess(successMsg);
      showToast(successMsg, 'info');
      setCSubmittedOk(true);
      window.setTimeout(() => setCSubmittedOk(false), 2600);
      setCMessage('');
    } catch (error) {
      setCError(
        error instanceof Error ? error.message : 'Unable to send inquiry.'
      );
      setCErrorKey((k) => k + 1);
    } finally {
      setCSubmitting(false);
    }
  };

  const phone = settings?.phone || '+91 86498 58954';
  const whatsapp = (settings?.whatsapp || '918649858954').replace(/[^\d]/g, '');
  const emailAddr = settings?.email?.trim() || 'rounakdeysarkar90@gmail.com';
  const address =
    settings?.address ||
    'Sevoke Road, Ward Number 13, Dasrath Pally, Bhanu Nagar, Siliguri, West Bengal 734001.';
  const uniqueLocations = useMemo(
    () =>
      collectUniqueLocations(
        settings?.locations || [
          'Siliguri',
          'Sevoke Road',
          'Bhanu Nagar',
          'Haiderpara',
          'Gugni More',
        ],
        activeProperties
      ),
    [settings?.locations, activeProperties]
  );

  const propertyTypes = settings?.property_types || [
    'Flats / Apartments',
    'Villas',
    'Houses',
    'Residential Plots',
    'Land',
  ];

  const heroHeadlineLines = splitHeadlineLines(
    settings?.hero_headline || "Find a Place You'll Love to Call Home."
  );

  const heroSrc =
    settings?.hero_image_url ||
    '/src/assets/images/hero_siliguri_villa_1795102916572.jpg';
  const localHeroSources = resolveLocalResponsiveSources(heroSrc);

  return (
    <main>
      {/* 1. ARCHITECTURAL HERO (Portrait Phones: clean 4:5 photo above text fading into canvas; Landscape Phones: 4:5 side-by-side; Tablet/Desktop: full architectural bleed with >=90% opaque dark gradient backdrop) */}
      {isLandscapeCompact ? (
        <section
          id="hero"
          ref={heroRef}
          className="relative min-h-[min(80svh,440px)] flex items-center bg-[var(--bg-canvas)] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] pb-6 overflow-x-clip scroll-mt-24"
        >
          <div className="fluid-container w-full grid grid-cols-12 gap-5 items-center">
            <div className="col-span-5 min-w-0 flex justify-center">
              <div className="relative aspect-[4/5] w-full max-w-[min(100%,calc(70dvh*0.8))] rounded-2xl overflow-hidden bg-[#16201B] shadow-[var(--shadow-subtle)]">
                {localHeroSources ? (
                  <picture className="block w-full h-full">
                    <source
                      type="image/webp"
                      srcSet={localHeroSources.webpSrcSet}
                      sizes="42vw"
                    />
                    <source
                      type="image/jpeg"
                      srcSet={localHeroSources.jpegSrcSet}
                      sizes="42vw"
                    />
                    <img
                      src={localHeroSources.jpegSrc}
                      srcSet={localHeroSources.jpegSrcSet}
                      sizes="42vw"
                      alt="Contemporary architectural residence in Siliguri"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-[50%_50%]"
                    />
                  </picture>
                ) : (
                  <img
                    src={heroSrc}
                    alt="Contemporary architectural residence in Siliguri"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-[50%_50%]"
                  />
                )}
              </div>
            </div>

            <div className="col-span-7 min-w-0 space-y-3">
              <p className="text-[13px] font-medium text-[var(--accent-primary)]">
                Siliguri, West Bengal &middot; Buy, sell, rent &amp; build
              </p>

              <h1 className="font-display text-[clamp(1.65rem,4vw,2.5rem)] font-medium text-[var(--text-primary)] leading-[1.08] tracking-[-0.02em]">
                {heroHeadlineLines.join(' ')}
              </h1>

              <p className="text-base font-normal text-[var(--text-secondary)] leading-relaxed fluid-prose">
                {settings?.hero_subheadline ||
                  'Discover exceptional properties in Siliguri. Whether you want to buy, sell, rent, or build, Debmalya Realty is here to help.'}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/properties"
                  className="btn-primary-lux tap-press min-h-[46px] px-5 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] border border-black/15 dark:border-[#EED6A4]/50 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shadow-[var(--shadow-subtle)]"
                >
                  <span>Explore properties</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#contact"
                  className="lux-card-hover tap-press min-h-[46px] px-5 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <span>Schedule consultation</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : !isDesktop ? (
        <section
          id="hero"
          ref={heroRef}
          className="relative min-h-[min(74svh,640px)] flex flex-col bg-[var(--bg-canvas)] pt-[env(safe-area-inset-top,0px)] pb-[clamp(1.75rem,5vw,2.75rem)] overflow-x-clip scroll-mt-24"
        >
          {/* Clean 4:5 photo block fading softly into page canvas at bottom; heading and paragraph sit below */}
          <div
            data-testid="mobile-hero-photo-block"
            className="relative w-full aspect-[4/5] overflow-hidden bg-[#16201B]"
          >
            {localHeroSources ? (
              <picture className="block w-full h-full">
                <source
                  type="image/webp"
                  srcSet={localHeroSources.webpSrcSet}
                  sizes="100vw"
                />
                <source
                  type="image/jpeg"
                  srcSet={localHeroSources.jpegSrcSet}
                  sizes="100vw"
                />
                <img
                  src={localHeroSources.jpegSrc}
                  srcSet={localHeroSources.jpegSrcSet}
                  sizes="100vw"
                  alt="Contemporary architectural residence in Siliguri"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-[50%_52%]"
                />
              </picture>
            ) : (
              <img
                src={heroSrc}
                alt="Contemporary architectural residence in Siliguri"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_52%]"
              />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#0E1512]/50 via-[#0E1512]/15 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)]/70 to-transparent" />
          </div>

          <div
            data-testid="mobile-hero-text-block"
            className="fluid-container relative z-10 w-full pt-3 space-y-3.5"
          >
            <p className="text-sm font-medium text-[var(--accent-primary)]">
              Siliguri, West Bengal &middot; Buy, sell, rent &amp; build
            </p>

            <h1 className="font-display text-[clamp(2rem,8.5vw,2.75rem)] font-medium text-[var(--text-primary)] leading-[1.06] tracking-[-0.02em]">
              {heroHeadlineLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>

            <p className="text-base font-normal text-[var(--text-secondary)] leading-relaxed fluid-prose">
              {settings?.hero_subheadline ||
                'Discover exceptional properties in Siliguri. Whether you want to buy, sell, rent, or build, Debmalya Realty is here to help.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/properties"
                className="btn-primary-lux tap-press min-h-[48px] px-6 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] border border-black/15 dark:border-[#EED6A4]/50 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shadow-[var(--shadow-subtle)]"
              >
                <span>Explore properties</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#contact"
                className="lux-card-hover tap-press min-h-[48px] px-6 py-3 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span>Schedule consultation</span>
              </a>
            </div>
          </div>
        </section>
      ) : (
        <section
          id="hero"
          ref={heroRef}
          className="relative min-h-[clamp(500px,74svh,690px)] flex flex-col justify-end pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[clamp(2.5rem,5vw,4rem)] overflow-hidden scroll-mt-24 bg-[#0E1512]"
        >
          <motion.div
            style={enableParallax ? { y: heroParallaxY } : undefined}
            className="absolute inset-0"
          >
            <motion.div
              initial={prefersReduced ? false : { scale: 1.07 }}
              animate={{ scale: 1 }}
              transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full"
            >
              {localHeroSources ? (
                <picture className="block w-full h-full">
                  <source
                    type="image/webp"
                    srcSet={localHeroSources.webpSrcSet}
                    sizes="100vw"
                  />
                  <source
                    type="image/jpeg"
                    srcSet={localHeroSources.jpegSrcSet}
                    sizes="100vw"
                  />
                  <img
                    src={localHeroSources.jpegSrc}
                    srcSet={localHeroSources.jpegSrcSet}
                    sizes="100vw"
                    alt="Contemporary architectural residence in Siliguri"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-[55%_46%]"
                  />
                </picture>
              ) : (
                <img
                  src={heroSrc}
                  alt="Contemporary architectural residence in Siliguri"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-[55%_46%]"
                />
              )}
            </motion.div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#0E1512]/55 via-[#0E1512]/20 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[76%] bg-gradient-to-r from-[#0E1512]/90 via-[#0E1512]/50 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-[#0E1512]/95 via-[#0E1512]/80 to-transparent" />
          </motion.div>

          <div className="fluid-container relative z-10 w-full">
            <div className="max-w-4xl space-y-[clamp(0.875rem,2.2vw,1.35rem)]">
              <motion.p
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05, ease: LUX_EASE }}
                className="text-sm sm:text-base font-medium text-[#F5DFB0] [text-shadow:0_2px_12px_rgba(0,0,0,0.85)]"
              >
                Siliguri, West Bengal &middot; Buy, sell, rent &amp; build
              </motion.p>

              <h1 className="font-display text-[clamp(2.5rem,5.4vw,5.25rem)] font-medium text-white leading-[1.03] tracking-[-0.02em] [text-shadow:0_4px_24px_rgba(0,0,0,0.8)]">
                {heroHeadlineLines.map((line, i) => (
                  <span key={line} className="block overflow-hidden pb-1">
                    <motion.span
                      className="block"
                      initial={prefersReduced ? false : { y: '105%', opacity: 0 }}
                      animate={{ y: '0%', opacity: 1 }}
                      transition={{
                        duration: 0.85,
                        delay: 0.1 + i * 0.14,
                        ease: LUX_EASE,
                      }}
                    >
                      {line}
                    </motion.span>
                  </span>
                ))}
              </h1>

              <motion.p
                initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.34, ease: LUX_EASE }}
                className="text-base sm:text-lg font-medium text-white/95 leading-relaxed fluid-prose [text-shadow:0_2px_12px_rgba(0,0,0,0.85)]"
              >
                {settings?.hero_subheadline ||
                  'Discover exceptional properties in Siliguri. Whether you want to buy, sell, rent, or build, Debmalya Realty is here to help.'}
              </motion.p>

              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.46, ease: LUX_EASE }}
                className="flex flex-wrap items-center gap-3.5 pt-2"
              >
                <Link
                  to="/properties"
                  className="btn-primary-lux tap-press min-h-[48px] px-7 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] border border-[#F5DFB0]/70 text-sm font-semibold inline-flex items-center gap-2.5 whitespace-nowrap shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
                >
                  <span>Explore properties</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#contact"
                  className="lux-card-hover tap-press min-h-[48px] px-7 py-3 rounded-full bg-[#0E1512]/72 hover:bg-[#0E1512]/88 border border-white/80 backdrop-blur-md text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                >
                  <span>Schedule consultation</span>
                </a>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* 2. MODERN SMART SEARCH */}
      <SmartSearchBlock
        searchState={searchState}
        onChangeState={setSearchState}
        onSearchSubmit={handleSearchSubmit}
        serviceLocations={uniqueLocations}
        propertyTypes={propertyTypes}
        prefersReduced={prefersReduced}
        isSubmitting={navigatingSearch}
        isLandscapeCompact={isLandscapeCompact}
      />

      {/* 3. RECOMMENDED PROPERTIES — 3D COVER FLOW */}
      <motion.section
        id="properties"
        initial={prefersReduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6, ease: LUX_EASE }}
        className="fluid-container scroll-mt-28 pt-[clamp(1.25rem,3vw,2.5rem)] pb-[clamp(3rem,6vw,5.5rem)]"
      >
        {loadingProps ? (
          <div className="space-y-6">
            <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
              Recommended properties
            </h2>
            <CarouselSkeleton />
          </div>
        ) : recommendedCarouselData.items.length > 0 ? (
          <CoverFlowCarousel
            properties={recommendedCarouselData.items}
            title="Recommended properties"
            subtitle={
              personalized && user
                ? 'Tailored to your saved preferences'
                : undefined
            }
            reasonsById={recommendedCarouselData.reasonsById}
            actionSlot={
              user ? (
                <Link
                  to="/my-account?tab=preferences"
                  className="tap-press min-h-[44px] inline-flex items-center text-sm font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap"
                >
                  Update preferences &rarr;
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="tap-press min-h-[44px] inline-flex items-center text-sm font-medium text-[var(--accent-primary)] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Personalize feed &rarr;
                </button>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
              Recommended properties
            </h2>
            <div className="rounded-2xl sm:rounded-[1.75rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-8 shadow-[var(--shadow-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
              <p className="text-base text-[var(--text-secondary)] leading-relaxed fluid-prose">
                No recommended properties yet. Browse all active Siliguri listings or reach out for tailored suggestions.
              </p>
              <Link
                to="/properties"
                className="btn-primary-lux tap-press w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
              >
                <span>Browse properties</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            </div>
          </div>
        )}
      </motion.section>

      {/* 4. SCROLL-BRIGHTENING STATEMENT */}
      <section
        id="statement"
        ref={statementRef}
        className="scroll-mt-28 fluid-section bg-[var(--bg-secondary)]"
      >
        <div className="fluid-container">
          <div className="max-w-5xl mx-auto">
            <p className="font-display font-medium text-[clamp(1.85rem,4.8vw,4.15rem)] leading-[1.16] tracking-[-0.02em] text-left [word-spacing:normal] text-[var(--text-primary)]">
              {STATEMENT_WORDS.map((word, idx) => (
                <StatementWord
                  key={`${word}-${idx}`}
                  word={word}
                  index={idx}
                  total={STATEMENT_WORDS.length}
                  progress={statementScroll}
                  prefersReduced={prefersReduced}
                />
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* 5. PROPERTIES SECTION WITH ALL / FEATURED SWITCH & LIVE SEARCH RESULTS */}
      <motion.section
        id="available-properties"
        ref={resultsSectionRef}
        initial={prefersReduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, ease: LUX_EASE }}
        className="scroll-mt-28 fluid-section bg-[var(--bg-canvas)]"
      >
          <div className="fluid-container space-y-[clamp(1.75rem,3.5vw,2.5rem)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4 flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-3 min-w-0">
                  <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
                    {hasActiveSearchFilters ? 'Matching properties' : 'Properties'}
                  </h2>
                  {hasActiveSearchFilters && (
                    <span
                      data-testid="home-search-results-count"
                      className="text-sm font-medium text-[var(--text-muted)] tabular-nums"
                    >
                      {formatPropertiesCount(displayedProperties.length)}
                    </span>
                  )}
                </div>

                {/* Switch: All property | Featured property (hidden while search filter is active) */}
                {!hasActiveSearchFilters && (
                  <div
                    role="tablist"
                    aria-label="Filter home properties"
                    className="inline-grid grid-cols-2 gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 shrink-0"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={propertyTab === 'all'}
                      onClick={() => setPropertyTab('all')}
                      className={`tap-press min-h-[44px] px-3.5 sm:px-4 rounded-full text-[13px] sm:text-sm font-medium whitespace-nowrap cursor-pointer ${
                        propertyTab === 'all'
                          ? 'bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      All property
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={propertyTab === 'featured'}
                      onClick={() => setPropertyTab('featured')}
                      className={`tap-press min-h-[44px] px-3.5 sm:px-4 rounded-full text-[13px] sm:text-sm font-medium whitespace-nowrap cursor-pointer ${
                        propertyTab === 'featured'
                          ? 'bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Featured property
                    </button>
                  </div>
                )}
              </div>

              <Link
                to={viewAllPropertiesHref}
                className="tap-press min-h-[44px] px-5 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2 self-start md:self-auto whitespace-nowrap shrink-0"
              >
                <span>View all properties</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loadingProps ? (
              <div className="fluid-grid-cards">
                {[1, 2, 3].map((i) => (
                  <PropertyCardSkeleton key={i} />
                ))}
              </div>
            ) : displayedProperties.length === 0 ? (
              <div className="rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-base text-[var(--text-secondary)]">
                  {hasActiveSearchFilters
                    ? 'No properties match your active search filters.'
                    : propertyTab === 'featured'
                    ? 'No featured properties are marked right now.'
                    : 'No properties are published yet. Please check back soon or contact our Siliguri office.'}
                </p>
                {hasActiveSearchFilters ? (
                  <button
                    type="button"
                    onClick={handleClearAllSearch}
                    className="btn-primary-lux tap-press min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium self-start sm:self-auto cursor-pointer whitespace-nowrap"
                  >
                    Clear filters
                  </button>
                ) : propertyTab === 'featured' ? (
                  <button
                    type="button"
                    onClick={() => setPropertyTab('all')}
                    className="btn-primary-lux tap-press min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium self-start sm:self-auto cursor-pointer whitespace-nowrap"
                  >
                    Show all properties
                  </button>
                ) : (
                  <a
                    href="#contact"
                    className="btn-primary-lux tap-press min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium self-start sm:self-auto whitespace-nowrap inline-flex items-center"
                  >
                    Contact us
                  </a>
                )}
              </div>
            ) : (
              <div className="fluid-grid-cards">
                {displayedProperties.slice(0, hasActiveSearchFilters ? 12 : 6).map((prop, idx) => (
                  <motion.div
                    key={prop.id}
                    initial={prefersReduced ? false : { opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{
                      duration: 0.5,
                      delay: prefersReduced ? 0 : idx * 0.05,
                      ease: LUX_EASE,
                    }}
                    className="min-w-0"
                  >
                    <PropertyCard property={prop} className="h-full" />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.section>

      {/* 6. SERVICES — SINGLE FAQ-STYLE ACCORDION CARD */}
      <motion.section
        id="services"
        initial={prefersReduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, ease: LUX_EASE }}
        className="scroll-mt-28 fluid-section bg-[var(--bg-surface-alt)]"
      >
        <div className="fluid-container space-y-[clamp(1.5rem,3.5vw,2.25rem)]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
              Services
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-md">
              Construction, buying, selling and renting, from one team.
            </p>
          </div>

          <div className="rounded-[clamp(1.25rem,3vw,1.5rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-[var(--shadow-subtle)] divide-y divide-[var(--border-hairline)] overflow-hidden">
            {DEFAULT_SERVICES.map((svc) => {
              const isOpen = openServiceKey === svc.key;
              const uploadedPhoto = settings?.service_images?.[svc.key]?.trim();
              const visual =
                SERVICE_TILE_VISUALS[svc.key] ||
                SERVICE_TILE_VISUALS.construction;
              const IconComp = visual.icon;

              return (
                <div key={svc.key} className="min-w-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`service-panel-${svc.key}`}
                    onClick={() =>
                      setOpenServiceKey((curr) =>
                        curr === svc.key ? null : svc.key
                      )
                    }
                    className="tap-press w-full min-h-[64px] px-4 sm:px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-canvas)]/50 cursor-pointer"
                  >
                    <span className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`h-10 w-10 rounded-xl inline-flex items-center justify-center shrink-0 shadow-xs ${visual.iconBg}`}
                      >
                        <IconComp className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <span className="font-display text-lg sm:text-xl font-medium text-[var(--text-primary)] leading-snug break-anywhere">
                        {svc.title}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`w-5 h-5 shrink-0 text-[var(--text-secondary)] transition-transform duration-200 motion-reduce:transition-none ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`service-panel-${svc.key}`}
                        key={`panel-${svc.key}`}
                        initial={
                          prefersReduced
                            ? { opacity: 1 }
                            : { opacity: 0, y: -6 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={
                          prefersReduced
                            ? { opacity: 0 }
                            : { opacity: 0, y: -4 }
                        }
                        transition={{ duration: 0.2, ease: LUX_EASE }}
                        className="px-4 sm:px-6 pb-5 pt-1 pl-[4.25rem] sm:pl-[4.75rem] space-y-3"
                      >
                        <p className="text-base leading-relaxed text-[var(--text-secondary)] fluid-prose">
                          {svc.desc}
                        </p>

                        {uploadedPhoto && (
                          <div className="rounded-xl overflow-hidden aspect-[16/9] max-w-md bg-[var(--bg-surface-muted)]">
                            <PropertyImage
                              src={uploadedPhoto}
                              alt={svc.title}
                              className="w-full h-full object-cover object-center"
                              sizes="(max-width: 640px) 84vw, 448px"
                            />
                          </div>
                        )}

                        <div>
                          {svc.isRoute ? (
                            <Link
                              to={svc.ctaHref}
                              className="tap-press min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                            >
                              <span>{svc.ctaLabel}</span>
                              <ArrowUpRight className="w-4 h-4 shrink-0" />
                            </Link>
                          ) : (
                            <a
                              href={svc.ctaHref}
                              className="tap-press min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                            >
                              <span>{svc.ctaLabel}</span>
                              <ArrowUpRight className="w-4 h-4 shrink-0" />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* 7. ABOUT US */}
      <motion.section
        id="about"
        initial={prefersReduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, ease: LUX_EASE }}
        className="scroll-mt-28 fluid-section bg-[var(--bg-canvas)] overflow-hidden"
      >
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 items-center">
          <div
            ref={aboutImgRef}
            className="lg:col-span-7 min-w-0 relative h-[clamp(300px,52vw,620px)] overflow-hidden lg:rounded-r-[36px] bg-[var(--bg-surface-muted)]"
          >
            <motion.div
              style={enableParallax ? { y: aboutParallaxY } : undefined}
              className="w-full h-[114%] -mt-[7%]"
            >
              <PropertyImage
                src={
                  settings?.about_image_url ||
                  '/src/assets/images/about_siliguri_construction_1795235945880.jpg'
                }
                alt="Debmalya Realty residential construction and consultancy in Siliguri"
                className="w-full h-full object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </motion.div>
          </div>

          <div className="lg:col-span-5 min-w-0 relative z-10 px-[clamp(0.875rem,3.2vw,2rem)] lg:px-0 lg:-ml-24 -mt-10 lg:mt-0">
            <div className="rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)]/98 backdrop-blur-2xl p-[clamp(1.25rem,4vw,2.75rem)] shadow-[var(--shadow-elevated)] space-y-5">
              <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
                About us
              </h2>

              <p className="text-base leading-relaxed text-[var(--text-secondary)] fluid-prose">
                {settings?.description}
              </p>

              <ul className="divide-y divide-[var(--border-hairline)] text-base text-[var(--text-primary)]">
                {[
                  'Local Siliguri market expertise across Sevoke Road & Bhanu Nagar',
                  'Construction execution and real-estate advisory under one roof',
                  'Transparent dealings with clear property documentation',
                ].map((strength) => (
                  <li key={strength} className="py-3.5 first:pt-1 last:pb-0">
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 8. TEAM — PORTRAIT CARDS OR TALK TO US BLOCK */}
      <motion.section
        id="team"
        initial={prefersReduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, ease: LUX_EASE }}
        className="scroll-mt-28 fluid-section bg-[var(--bg-secondary)]"
      >
        <div className="fluid-container space-y-[clamp(1.75rem,3.5vw,2.5rem)]">
          {agents.length > 0 ? (
            <>
              <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
                Our team
              </h2>
              <div className="fluid-grid-team">
                {agents.map((agent) => (
                  <article
                    key={agent.id}
                    className="group lux-card-hover min-w-0 flex flex-col space-y-5 rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)] p-4 sm:p-5 border border-[var(--border-hairline)] shadow-[var(--shadow-subtle)]"
                  >
                    <div className="aspect-[3/4] rounded-[clamp(1rem,2.5vw,1.25rem)] bg-[var(--bg-surface-muted)] overflow-hidden">
                      <PropertyImage
                        src={agent.photo_url}
                        alt={agent.name}
                        className="lux-img-hover w-full h-full object-cover object-top"
                        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 360px"
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <h3 className="font-display text-[clamp(1.375rem,2.4vw,1.75rem)] font-medium text-[var(--text-primary)] break-anywhere">
                        {agent.name}
                      </h3>
                      <p className="text-sm font-medium text-[var(--accent-primary)]">
                        {agent.position}
                      </p>
                      {agent.bio && (
                        <p className="text-base text-[var(--text-secondary)] leading-relaxed pt-1 fluid-prose">
                          {agent.bio}
                        </p>
                      )}
                      {(agent.phone || agent.whatsapp) && (
                        <div className="flex flex-wrap items-center gap-3 pt-3">
                          {agent.phone && (
                            <a
                              href={`tel:${agent.phone.replace(/\s+/g, '')}`}
                              className="tap-press min-h-[44px] px-5 py-2 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5"
                            >
                              <Phone className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                              <span>Call</span>
                            </a>
                          )}
                          {agent.whatsapp && (
                            <a
                              href={`https://wa.me/${agent.whatsapp.replace(/[^\d]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary-lux tap-press min-h-[44px] px-5 py-2 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-4 h-4 shrink-0" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="py-10 sm:py-12 border-y border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-3 max-w-2xl">
                <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
                  Talk to us
                </h2>
                <p className="text-base text-[var(--text-secondary)] leading-relaxed fluid-prose">
                  Speak directly with our Siliguri office at Bhanu Nagar, Sevoke Road for site visits, property buying or selling, and construction quotes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3.5 shrink-0">
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="tap-press min-h-[48px] px-6 py-3 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shadow-[var(--shadow-subtle)]"
                >
                  <Phone className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Call</span>
                </a>
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                    'Hello Debmalya Realty, I would like to speak with your Siliguri team.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary-lux tap-press min-h-[48px] px-7 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* 9. REVIEWS */}
      <motion.section
        id="reviews"
        initial={prefersReduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, ease: LUX_EASE }}
        className="scroll-mt-28 fluid-section bg-[var(--bg-canvas)]"
      >
        <div className="fluid-container">
          <ReviewsCarousel />
        </div>
      </motion.section>

      {/* 10. CONTACT — MODERN LAYOUT + CALL/WHATSAPP/EMAIL + MODERN ENQUIRY FORM */}
      <motion.section
        id="contact"
        initial={prefersReduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, ease: LUX_EASE }}
        className="scroll-mt-28 fluid-section bg-[var(--bg-surface-alt)]"
      >
        <div className="fluid-container space-y-[clamp(1.5rem,3.5vw,2.25rem)]">
          <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
            Contact
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[clamp(1.25rem,3.5vw,2.25rem)] items-start">
            {/* Left Info Card */}
            <div className="lg:col-span-5 rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-[clamp(1.25rem,3.5vw,2rem)] shadow-[var(--shadow-subtle)] space-y-6 min-w-0">
              <div className="space-y-2">
                <h3 className="font-display text-[clamp(1.375rem,2.4vw,1.75rem)] font-medium text-[var(--text-primary)] leading-snug">
                  Visit or speak with us in Siliguri
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Reach our office directly by phone, WhatsApp, or email.
                </p>
              </div>

              {/* Quick Actions: Call, WhatsApp, Email */}
              <div className="flex flex-wrap gap-2.5">
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="tap-press flex-1 min-w-fit min-h-[48px] px-4 py-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Phone className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span>Call</span>
                </a>
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                    'Hello Debmalya Realty, I would like to enquire about properties in Siliguri.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary-lux tap-press flex-1 min-w-fit min-h-[48px] px-4 py-2.5 rounded-xl bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`mailto:${emailAddr}?subject=${encodeURIComponent(
                    'Property inquiry — Debmalya Realty'
                  )}`}
                  className="tap-press flex-1 min-w-fit min-h-[48px] px-4 py-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Mail className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span>Email</span>
                </a>
              </div>

              <div className="divide-y divide-[var(--border-hairline)] text-sm">
                <div className="py-4 first:pt-0 space-y-1.5">
                  <p className="text-[13px] font-medium text-[var(--text-muted)] flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    <span>Office address</span>
                  </p>
                  <p className="text-base text-[var(--text-primary)] leading-relaxed break-anywhere">
                    {address}
                  </p>
                </div>

                <div className="py-4 space-y-1">
                  <p className="text-[13px] font-medium text-[var(--text-muted)] flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    <span>Phone &amp; WhatsApp</span>
                  </p>
                  <a
                    href={`tel:${phone.replace(/\s+/g, '')}`}
                    className="min-h-[44px] w-full font-display text-xl font-semibold tabular-nums text-[var(--text-primary)] hover:text-[var(--accent-primary)] flex items-center break-anywhere"
                  >
                    {phone}
                  </a>
                </div>

                <div className="py-4 space-y-1">
                  <p className="text-[13px] font-medium text-[var(--text-muted)] flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    <span>Email</span>
                  </p>
                  <a
                    href={`mailto:${emailAddr}`}
                    className="min-h-[44px] w-full text-base font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] flex items-center break-anywhere"
                  >
                    {emailAddr}
                  </a>
                </div>

                <div className="py-4 last:pb-0 space-y-2.5">
                  <p className="text-[13px] font-medium text-[var(--text-muted)] flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    <span>Opening hours</span>
                  </p>
                  <dl className="space-y-1.5 text-sm tabular-nums">
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-[var(--text-secondary)]">Monday</dt>
                      <dd className="font-medium text-[var(--text-primary)]">
                        {settings?.operating_hours?.monday || '9:00 AM – 9:30 PM'}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-[var(--text-secondary)]">Tuesday</dt>
                      <dd className="font-medium text-[var(--text-primary)]">
                        {settings?.operating_hours?.tuesday || '10:00 AM – 10:00 PM'}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-[var(--text-secondary)]">Wednesday</dt>
                      <dd className="font-medium text-[var(--text-primary)]">
                        {settings?.operating_hours?.wednesday || '9:00 AM – 9:30 PM'}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-[var(--text-secondary)]">Thu – Sun</dt>
                      <dd className="font-medium text-[var(--text-primary)]">
                        {settings?.operating_hours?.thursday_sunday ||
                          '9:00 AM – 5:00 PM'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* Right Modern Enquiry Form Card */}
            <div className="lg:col-span-7 rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-[clamp(1.25rem,3.5vw,2.25rem)] shadow-[var(--shadow-subtle)] min-w-0">
              <h3 className="font-display text-[clamp(1.375rem,2.6vw,1.875rem)] font-medium text-[var(--text-primary)]">
                Send an inquiry
              </h3>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] mt-1 fluid-prose">
                Tell us whether you are looking to buy, sell, rent, or construct a project in Siliguri.
              </p>

              <form
                ref={contactFormRef}
                noValidate
                onSubmit={handleContactSubmit}
                className="mt-6 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor="contact-name"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                    >
                      Your name *
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      autoComplete="name"
                      aria-invalid={Boolean(cFieldErrors.name)}
                      aria-describedby={
                        cFieldErrors.name ? 'contact-name-error' : undefined
                      }
                      value={cName}
                      onChange={(e) => {
                        setCName(e.target.value);
                        if (cFieldErrors.name) {
                          setCFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }
                      }}
                      placeholder="Full name"
                      className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none scroll-mt-24 scroll-mb-24 ${
                        cFieldErrors.name
                          ? 'border-rose-500'
                          : 'border-[var(--border-input)] focus:border-[var(--accent-primary)]'
                      }`}
                    />
                    {cFieldErrors.name && (
                      <p
                        id="contact-name-error"
                        role="alert"
                        className="mt-1 text-[13px] text-rose-500"
                      >
                        {cFieldErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="contact-phone"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                    >
                      Mobile number *
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      aria-invalid={Boolean(cFieldErrors.phone)}
                      aria-describedby={
                        cFieldErrors.phone ? 'contact-phone-error' : undefined
                      }
                      value={cPhone}
                      onChange={(e) => {
                        setCPhone(e.target.value);
                        if (cFieldErrors.phone) {
                          setCFieldErrors((prev) => ({
                            ...prev,
                            phone: undefined,
                          }));
                        }
                      }}
                      placeholder="+91 98320 12345"
                      className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none tabular-nums scroll-mt-24 scroll-mb-24 ${
                        cFieldErrors.phone
                          ? 'border-rose-500'
                          : 'border-[var(--border-input)] focus:border-[var(--accent-primary)]'
                      }`}
                    />
                    {cFieldErrors.phone && (
                      <p
                        id="contact-phone-error"
                        role="alert"
                        className="mt-1 text-[13px] text-rose-500"
                      >
                        {cFieldErrors.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor="contact-email"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                    >
                      Email address
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      aria-invalid={Boolean(cFieldErrors.email)}
                      aria-describedby={
                        cFieldErrors.email ? 'contact-email-error' : undefined
                      }
                      value={cEmail}
                      onChange={(e) => {
                        setCEmail(e.target.value);
                        if (cFieldErrors.email) {
                          setCFieldErrors((prev) => ({
                            ...prev,
                            email: undefined,
                          }));
                        }
                      }}
                      placeholder="Optional"
                      className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none scroll-mt-24 scroll-mb-24 ${
                        cFieldErrors.email
                          ? 'border-rose-500'
                          : 'border-[var(--border-input)] focus:border-[var(--accent-primary)]'
                      }`}
                    />
                    {cFieldErrors.email && (
                      <p
                        id="contact-email-error"
                        role="alert"
                        className="mt-1 text-[13px] text-rose-500"
                      >
                        {cFieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="contact-interest"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                    >
                      Interested in *
                    </label>
                    <select
                      id="contact-interest"
                      aria-invalid={Boolean(cFieldErrors.interested_in)}
                      aria-describedby={
                        cFieldErrors.interested_in
                          ? 'contact-interest-error'
                          : undefined
                      }
                      value={cInterest}
                      onChange={(e) => {
                        setCInterest(e.target.value);
                        if (cFieldErrors.interested_in) {
                          setCFieldErrors((prev) => ({
                            ...prev,
                            interested_in: undefined,
                          }));
                        }
                      }}
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer scroll-mt-24 scroll-mb-24"
                    >
                      <option
                        value="Property Buying"
                        className="bg-[var(--bg-surface)]"
                      >
                        Property Buying
                      </option>
                      <option
                        value="Property Selling"
                        className="bg-[var(--bg-surface)]"
                      >
                        Property Selling
                      </option>
                      <option
                        value="Rental Services"
                        className="bg-[var(--bg-surface)]"
                      >
                        Rental Services
                      </option>
                      <option
                        value="Construction & Development"
                        className="bg-[var(--bg-surface)]"
                      >
                        Construction &amp; Development
                      </option>
                      <option
                        value="Site Visit & Estimate"
                        className="bg-[var(--bg-surface)]"
                      >
                        Site Visit &amp; Estimate
                      </option>
                    </select>
                    {cFieldErrors.interested_in && (
                      <p
                        id="contact-interest-error"
                        role="alert"
                        className="mt-1 text-[13px] text-rose-500"
                      >
                        {cFieldErrors.interested_in}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={3}
                    aria-invalid={Boolean(cFieldErrors.message)}
                    aria-describedby={
                      cFieldErrors.message ? 'contact-message-error' : undefined
                    }
                    value={cMessage}
                    onChange={(e) => {
                      setCMessage(e.target.value);
                      if (cFieldErrors.message) {
                        setCFieldErrors((prev) => ({
                          ...prev,
                          message: undefined,
                        }));
                      }
                    }}
                    placeholder="Share your preferred Siliguri locality, property size, or construction requirement..."
                    className={`w-full min-h-[96px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none scroll-mt-24 scroll-mb-24 ${
                      cFieldErrors.message
                        ? 'border-rose-500'
                        : 'border-[var(--border-input)] focus:border-[var(--accent-primary)]'
                    }`}
                  />
                  {cFieldErrors.message && (
                    <p
                      id="contact-message-error"
                      role="alert"
                      className="mt-1 text-[13px] text-rose-500"
                    >
                      {cFieldErrors.message}
                    </p>
                  )}
                </div>

                {cError && (
                  <p
                    key={`contact-err-${cErrorKey}`}
                    className="animate-shake-once text-sm text-rose-500"
                    role="alert"
                  >
                    {cError}
                  </p>
                )}
                {cSuccess && (
                  <p
                    className="text-sm text-emerald-500 inline-flex items-center gap-2"
                    role="status"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {cSuccess}
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={cSubmitting}
                    className="btn-primary-lux tap-press min-h-[48px] px-8 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-base font-medium inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed scroll-mt-24 scroll-mb-24"
                  >
                    {cSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : cSubmittedOk ? (
                      <Check className="w-4 h-4" />
                    ) : null}
                    <span>
                      {cSubmitting
                        ? 'Sending inquiry...'
                        : cSubmittedOk
                        ? 'Inquiry sent'
                        : 'Submit inquiry'}
                    </span>
                  </button>
                </div>
                <div
                  aria-hidden="true"
                  className={contactKeyboardOpen ? 'h-[42dvh]' : 'hidden'}
                />
              </form>
            </div>
          </div>
        </div>
      </motion.section>
    </main>
  );
};
