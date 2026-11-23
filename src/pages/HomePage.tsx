import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
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
  Compass,
  FileCheck2,
  Home,
  IndianRupee,
  KeyRound,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Tag,
} from 'lucide-react';
import { LUX_EASE } from '../lib/motion';
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
  validateInquiryInput,
} from '../lib/realtyLogic';
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
import type { RecommendedProperty } from '../lib/realtyLogic';

const BUDGET_RANGES = [
  { label: 'Any budget', min: '', max: '' },
  { label: 'Up to ₹30 Lakhs', min: '', max: '3000000' },
  { label: '₹30L – ₹60 Lakhs', min: '3000000', max: '6000000' },
  { label: '₹60L – ₹1 Crore', min: '6000000', max: '10000000' },
  { label: 'Above ₹1 Crore', min: '10000000', max: '' },
  { label: 'Rent up to ₹25,000/mo', min: '', max: '25000' },
  { label: 'Rent ₹25,000 – ₹60,000/mo', min: '25000', max: '60000' },
];

const SERVICE_TILE_VISUALS: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    tileBg: string;
    iconBg: string;
  }
> = {
  construction: {
    icon: Building2,
    tileBg: 'bg-[#E9ECE4] dark:bg-[#19231D]',
    iconBg: 'bg-[#1F3A2E] text-[#F5DFB0] dark:bg-[#264234] dark:text-[#F5DFB0]',
  },
  buying: {
    icon: Home,
    tileBg: 'bg-[#F0E9DF] dark:bg-[#241E18]',
    iconBg: 'bg-[#7A5428] text-white dark:bg-[#9C6F38] dark:text-white',
  },
  selling: {
    icon: Tag,
    tileBg: 'bg-[#EAECE7] dark:bg-[#1B221F]',
    iconBg: 'bg-[#2C473C] text-[#F5DFB0] dark:bg-[#335246] dark:text-[#F5DFB0]',
  },
  rentals: {
    icon: KeyRound,
    tileBg: 'bg-[#E7ECEE] dark:bg-[#172125]',
    iconBg: 'bg-[#294452] text-white dark:bg-[#355666] dark:text-white',
  },
  visits: {
    icon: Compass,
    tileBg: 'bg-[#EFECE2] dark:bg-[#222017]',
    iconBg: 'bg-[#63512B] text-[#FAF6EE] dark:bg-[#7D6637] dark:text-[#FAF6EE]',
  },
  documentation: {
    icon: FileCheck2,
    tileBg: 'bg-[#EDE8E4] dark:bg-[#221C19]',
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
    return <span className="inline-block mr-[0.26em]">{word}{' '}</span>;
  }

  return (
    <>
      <motion.span style={{ opacity }} className="inline-block mr-[0.26em]">
        {word}
      </motion.span>{' '}
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
  const { settings, user, openAuthModal } = useApp();
  const navigate = useNavigate();
  const prefersReduced = !!useReducedMotion();
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const enableParallax = !prefersReduced && isDesktop;

  const heroRef = useRef<HTMLElement>(null);
  const statementRef = useRef<HTMLElement>(null);
  const aboutImgRef = useRef<HTMLDivElement>(null);

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
  const [searchLocation, setSearchLocation] = useState('All');
  const [searchType, setSearchType] = useState('All');
  const [searchListing, setSearchListing] = useState<'All' | 'Buy' | 'Rent'>('All');
  const [searchBudgetIdx, setSearchBudgetIdx] = useState(0);

  // Contact form state
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cInterest, setCInterest] = useState('Property Buying');
  const [cMessage, setCMessage] = useState('');
  const [cSubmitting, setCSubmitting] = useState(false);
  const [cSubmittedOk, setCSubmittedOk] = useState(false);
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

    const featured = activeProperties.filter((p) => p.is_featured);
    const items = featured.length > 0 ? featured : activeProperties.slice(0, 6);
    for (const r of activeRecs) {
      if (r.reasons.length > 0) reasonsById[r.property.id] = r.reasons;
    }
    return { items, reasonsById };
  }, [user, recommendations, activeProperties]);

  const handleSmartSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchLocation !== 'All') params.set('location', searchLocation);
    if (searchType !== 'All') params.set('category', searchType);
    if (searchListing !== 'All') params.set('type', searchListing);
    const budget = BUDGET_RANGES[searchBudgetIdx];
    if (budget?.min) params.set('minPrice', budget.min);
    if (budget?.max) params.set('maxPrice', budget.max);
    navigate(`/properties?${params.toString()}`);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cSubmitting) return;
    setCError(null);
    setCSuccess(null);
    const err = validateInquiryInput({
      name: cName,
      phone: cPhone,
      email: cEmail,
      interested_in: cInterest,
      message: cMessage,
    });
    if (err) {
      setCError(err);
      setCErrorKey((k) => k + 1);
      return;
    }

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
      setCSuccess('Thank you. Your inquiry has been sent to Debmalya Realty.');
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
  const whatsapp = settings?.whatsapp || '918649858954';
  const address =
    settings?.address ||
    'Sevoke Road, Ward Number 13, Dasrath Pally, Bhanu Nagar, Siliguri, West Bengal 734001.';
  const locations = settings?.locations || [
    'Siliguri',
    'Sevoke Road',
    'Bhanu Nagar',
    'Haiderpara',
    'Gugni More',
  ];
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
      {/* 1. FULL-SCREEN ARCHITECTURAL HERO */}
      <section
        id="hero"
        ref={heroRef}
        className="relative min-h-[max(520px,88svh)] sm:min-h-[90dvh] flex flex-col justify-end pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[clamp(4.5rem,9vw,6.5rem)] overflow-hidden scroll-mt-24 bg-[#16201B]"
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
                  className="w-full h-full object-cover object-[64%_35%] md:object-[55%_42%]"
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
                className="w-full h-full object-cover object-[64%_35%] md:object-[55%_42%]"
              />
            )}
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/58 to-black/18" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/88 via-black/48 to-transparent" />
        </motion.div>

        <div className="fluid-container relative z-10 w-full">
          <div className="max-w-4xl space-y-[clamp(1rem,2.5vw,1.5rem)]">
            <motion.p
              initial={prefersReduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05, ease: LUX_EASE }}
              className="text-sm sm:text-base font-medium text-[#F5DFB0] [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]"
            >
              Siliguri, West Bengal &middot; Buy, sell, rent &amp; build
            </motion.p>

            <h1 className="font-display text-[clamp(2rem,6vw,5.75rem)] font-medium text-white leading-[1.03] tracking-[-0.02em] [text-shadow:0_4px_24px_rgba(0,0,0,0.72)]">
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
              className="text-base sm:text-lg font-medium text-white/95 leading-relaxed fluid-prose [text-shadow:0_2px_12px_rgba(0,0,0,0.78)]"
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
                className="btn-primary-lux min-h-[48px] px-7 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2.5 whitespace-nowrap shadow-[var(--shadow-subtle)]"
              >
                <span>Explore properties</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#contact"
                className="lux-card-hover min-h-[48px] px-7 py-3 rounded-full bg-white/20 hover:bg-white/30 border border-white/60 backdrop-blur-md text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shadow-[0_6px_22px_rgba(0,0,0,0.35)]"
              >
                <span>Schedule consultation</span>
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. FLOATING SEARCH BAR OVERLAPPING HERO BOTTOM */}
      <section
        id="search"
        aria-label="Property search"
        className="fluid-container relative z-20 -mt-10 sm:-mt-12 scroll-mt-24"
      >
        <form
          onSubmit={handleSmartSearch}
          data-allow-floating="true"
          className="search-bar-container rounded-[clamp(1.25rem,3vw,2.5rem)] bg-[var(--bg-surface)]/98 border border-[var(--border-input)] backdrop-blur-2xl shadow-[var(--shadow-elevated)] p-[clamp(0.75rem,2vw,1rem)]"
        >
          <div className="search-bar-grid">
            <div className="search-bar-field flex items-center gap-3 px-3 py-1.5 min-w-0">
              <MapPin className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="search-location"
                  className="block text-[13px] font-medium text-[var(--text-secondary)]"
                >
                  Location
                </label>
                <select
                  id="search-location"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full min-h-[44px] bg-transparent text-base font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer truncate"
                >
                  <option value="All" className="bg-[var(--bg-surface)]">
                    All Siliguri areas
                  </option>
                  {locations.map((loc) => (
                    <option
                      key={loc}
                      value={loc}
                      className="bg-[var(--bg-surface)]"
                    >
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="search-bar-field flex items-center gap-3 px-3 py-1.5 min-w-0">
              <Home className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="search-type"
                  className="block text-[13px] font-medium text-[var(--text-secondary)]"
                >
                  Property type
                </label>
                <select
                  id="search-type"
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-full min-h-[44px] bg-transparent text-base font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer truncate"
                >
                  <option value="All" className="bg-[var(--bg-surface)]">
                    All property types
                  </option>
                  {propertyTypes.map((t) => (
                    <option
                      key={t}
                      value={t}
                      className="bg-[var(--bg-surface)]"
                    >
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="search-bar-field flex items-center gap-3 px-3 py-1.5 min-w-0">
              <IndianRupee className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="search-budget"
                  className="block text-[13px] font-medium text-[var(--text-secondary)]"
                >
                  Budget range
                </label>
                <select
                  id="search-budget"
                  value={searchBudgetIdx}
                  onChange={(e) => setSearchBudgetIdx(Number(e.target.value))}
                  className="w-full min-h-[44px] bg-transparent text-base font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer tabular-nums truncate"
                >
                  {BUDGET_RANGES.map((b, idx) => (
                    <option
                      key={b.label}
                      value={idx}
                      className="bg-[var(--bg-surface)]"
                    >
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="search-bar-field flex items-center gap-3 px-3 py-1.5 min-w-0">
              <Tag className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="search-listing"
                  className="block text-[13px] font-medium text-[var(--text-secondary)]"
                >
                  Buy or rent
                </label>
                <select
                  id="search-listing"
                  value={searchListing}
                  onChange={(e) =>
                    setSearchListing(e.target.value as 'All' | 'Buy' | 'Rent')
                  }
                  className="w-full min-h-[44px] bg-transparent text-base font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer truncate"
                >
                  <option value="All" className="bg-[var(--bg-surface)]">
                    Buy &amp; rent
                  </option>
                  <option value="Buy" className="bg-[var(--bg-surface)]">
                    Buy property
                  </option>
                  <option value="Rent" className="bg-[var(--bg-surface)]">
                    Rent property
                  </option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="search-bar-submit btn-primary-lux min-h-[48px] px-7 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. RECOMMENDED PROPERTIES — 3D COVER FLOW */}
      {loadingProps || recommendedCarouselData.items.length > 0 ? (
        <motion.section
          id="properties"
          initial={prefersReduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.65, ease: LUX_EASE }}
          className="fluid-container scroll-mt-28 pt-[clamp(2.5rem,5vw,4rem)] pb-[clamp(3.5rem,7vw,6.5rem)]"
        >
          {loadingProps ? (
            <CarouselSkeleton />
          ) : (
            <CoverFlowCarousel
              properties={recommendedCarouselData.items}
              title={
                personalized && user
                  ? 'Recommended for you'
                  : 'Recommended Properties'
              }
              reasonsById={recommendedCarouselData.reasonsById}
              actionSlot={
                user ? (
                  <Link
                    to="/my-account?tab=preferences"
                    className="min-h-[44px] inline-flex items-center text-sm font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap"
                  >
                    Update preferences &rarr;
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAuthModal('register')}
                    className="min-h-[44px] inline-flex items-center text-sm font-medium text-[var(--accent-primary)] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Personalize feed &rarr;
                  </button>
                )
              }
            />
          )}
        </motion.section>
      ) : null}

      {/* 4. SCROLL-BRIGHTENING STATEMENT */}
      <section
        id="statement"
        ref={statementRef}
        className="scroll-mt-28 fluid-section bg-[var(--bg-secondary)] transition-colors duration-700"
      >
        <div className="fluid-container">
          <div className="max-w-5xl mx-auto">
            <p className="font-display font-medium text-[clamp(1.85rem,4.8vw,4.15rem)] leading-[1.16] tracking-[-0.02em] text-[var(--text-primary)]">
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

      {/* 5. AVAILABLE OPPORTUNITIES — AUTO-FIT FLUID CARDS */}
      {(loadingProps || activeProperties.length > 0) && (
        <section
          id="available-properties"
          className="scroll-mt-28 fluid-section bg-[var(--bg-canvas)]"
        >
          <div className="fluid-container space-y-[clamp(2rem,4vw,3rem)]">
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: LUX_EASE }}
              className="flex flex-col sm:flex-row sm:items-end justify-between gap-6"
            >
              <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-medium text-[var(--text-primary)] leading-[1.06]">
                Available opportunities
              </h2>
              <Link
                to="/properties"
                className="min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap transition-colors"
              >
                <span>View all properties</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {loadingProps ? (
              <div className="fluid-grid-cards">
                {[1, 2, 3].map((i) => (
                  <PropertyCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="fluid-grid-cards">
                {activeProperties.slice(0, 6).map((prop, idx) => (
                  <motion.div
                    key={prop.id}
                    initial={prefersReduced ? false : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{
                      duration: 0.6,
                      delay: prefersReduced ? 0 : idx * 0.06,
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
        </section>
      )}

      {/* 6. SERVICES — 6 CLEAN TILES (UPLOADED PHOTO OR COLOURED ICON TILE) */}
      <section
        id="services"
        className="scroll-mt-28 fluid-section bg-[var(--bg-surface-alt)]"
      >
        <div className="fluid-container space-y-[clamp(2rem,4vw,3rem)]">
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: LUX_EASE }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-6"
          >
            <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-medium text-[var(--text-primary)] leading-[1.06] max-w-2xl">
              Construction &amp; advisory services
            </h2>
            <p className="text-base text-[var(--text-secondary)] max-w-sm">
              Construction, buying, selling and renting, from one team.
            </p>
          </motion.div>

          <div className="fluid-grid-tiles">
            {DEFAULT_SERVICES.map((svc, idx) => {
              const uploadedPhoto = settings?.service_images?.[svc.key]?.trim();
              const visual =
                SERVICE_TILE_VISUALS[svc.key] || SERVICE_TILE_VISUALS.construction;
              const IconComp = visual.icon;

              return (
                <motion.article
                  key={svc.key}
                  initial={prefersReduced ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{
                    duration: 0.55,
                    delay: prefersReduced ? 0 : idx * 0.05,
                    ease: LUX_EASE,
                  }}
                  className={`group lux-card-hover min-w-0 relative rounded-[clamp(1.25rem,3vw,1.5rem)] overflow-hidden shadow-[var(--shadow-subtle)] border border-[var(--border-hairline)] min-h-[clamp(230px,28vw,272px)] flex flex-col justify-between ${
                    uploadedPhoto ? 'bg-[#16201B]' : visual.tileBg
                  }`}
                >
                  {uploadedPhoto ? (
                    <>
                      <PropertyImage
                        src={uploadedPhoto}
                        alt={svc.title}
                        className="lux-img-hover absolute inset-0 w-full h-full object-cover object-center"
                        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 380px"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/58 to-black/20" />
                      <div className="relative z-10 mt-auto p-[clamp(1.25rem,3vw,1.75rem)] space-y-2.5 text-white min-w-0">
                        <h3 className="font-display text-[clamp(1.375rem,2.4vw,1.65rem)] font-medium text-white leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.7)]">
                          {svc.title}
                        </h3>
                        <p className="text-sm text-white/90 truncate [text-shadow:0_1px_8px_rgba(0,0,0,0.65)]">
                          {svc.desc}
                        </p>
                        <div className="pt-1">
                          {svc.isRoute ? (
                            <Link
                              to={svc.ctaHref}
                              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[#F5DFB0] hover:underline"
                            >
                              <span>{svc.ctaLabel}</span>
                              <ArrowUpRight className="lux-arrow-hover w-4 h-4 shrink-0" />
                            </Link>
                          ) : (
                            <a
                              href={svc.ctaHref}
                              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[#F5DFB0] hover:underline"
                            >
                              <span>{svc.ctaLabel}</span>
                              <ArrowUpRight className="lux-arrow-hover w-4 h-4 shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="relative z-10 flex-1 p-[clamp(1.25rem,3vw,1.75rem)] flex flex-col justify-between gap-6 min-w-0">
                      <div
                        className={`h-12 w-12 rounded-2xl inline-flex items-center justify-center shadow-sm ${visual.iconBg}`}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="space-y-2 min-w-0">
                        <h3 className="font-display text-[clamp(1.375rem,2.4vw,1.65rem)] font-medium text-[var(--text-primary)] leading-tight">
                          {svc.title}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] truncate">
                          {svc.desc}
                        </p>
                        <div className="pt-1">
                          {svc.isRoute ? (
                            <Link
                              to={svc.ctaHref}
                              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                            >
                              <span>{svc.ctaLabel}</span>
                              <ArrowUpRight className="lux-arrow-hover w-4 h-4 shrink-0" />
                            </Link>
                          ) : (
                            <a
                              href={svc.ctaHref}
                              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                            >
                              <span>{svc.ctaLabel}</span>
                              <ArrowUpRight className="lux-arrow-hover w-4 h-4 shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. ABOUT — EDGE-BLEEDING PHOTOGRAPH + OVERLAPPING EDITORIAL BLOCK */}
      <section
        id="about"
        className="scroll-mt-28 fluid-section bg-[var(--bg-canvas)] overflow-hidden"
      >
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 items-center">
          <div
            ref={aboutImgRef}
            className="lg:col-span-7 relative h-[clamp(300px,52vw,620px)] overflow-hidden lg:rounded-r-[36px] bg-[var(--bg-surface-muted)]"
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

          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.65, ease: LUX_EASE }}
            className="lg:col-span-5 relative z-10 px-[clamp(0.875rem,3.2vw,2rem)] lg:px-0 lg:-ml-24 -mt-10 lg:mt-0"
          >
            <div className="rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)]/98 backdrop-blur-2xl p-[clamp(1.25rem,4vw,2.75rem)] shadow-[var(--shadow-elevated)] space-y-6">
              <h2 className="font-display text-[clamp(1.75rem,4vw,3rem)] font-medium text-[var(--text-primary)] leading-[1.06]">
                Siliguri building &amp; property consultancy
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
          </motion.div>
        </div>
      </section>

      {/* 8. TEAM — PORTRAIT CARDS OR TALK TO US BLOCK */}
      <section
        id="team"
        className="scroll-mt-28 fluid-section bg-[var(--bg-secondary)]"
      >
        <div className="fluid-container space-y-[clamp(2rem,4vw,3rem)]">
          {agents.length > 0 ? (
            <>
              <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-medium text-[var(--text-primary)] leading-[1.06]">
                Our team
              </h2>
              <div className="fluid-grid-team">
                {agents.map((agent) => (
                  <article
                    key={agent.id}
                    className="group min-w-0 flex flex-col space-y-5"
                  >
                    <div className="aspect-[3/4] rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface-muted)] overflow-hidden shadow-[var(--shadow-subtle)]">
                      <PropertyImage
                        src={agent.photo_url}
                        alt={agent.name}
                        className="lux-img-hover w-full h-full object-cover object-top"
                        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 360px"
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <h3 className="font-display text-[clamp(1.5rem,2.6vw,1.875rem)] font-medium text-[var(--text-primary)] break-anywhere">
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
                              className="min-h-[44px] px-5 py-2 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5 transition-colors"
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
                              className="btn-primary-lux min-h-[44px] px-5 py-2 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-1.5"
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
                <h2 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-medium text-[var(--text-primary)] leading-[1.06]">
                  Talk to us
                </h2>
                <p className="text-base text-[var(--text-secondary)] leading-relaxed fluid-prose">
                  Speak directly with our Siliguri office at Bhanu Nagar, Sevoke Road for site visits, property buying or selling, and construction quotes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3.5 shrink-0">
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="min-h-[48px] px-6 py-3 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors shadow-[var(--shadow-subtle)]"
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
                  className="btn-primary-lux min-h-[48px] px-7 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 9. REVIEWS — MULTI-COLUMN / SWIPEABLE CLIENT QUOTES */}
      <section
        id="reviews"
        className="scroll-mt-28 fluid-section bg-[var(--bg-canvas)]"
      >
        <div className="fluid-container">
          <ReviewsCarousel />
        </div>
      </section>

      {/* 10. CONTACT — SPLIT EDITORIAL WITH UNDERLINE INPUTS */}
      <section
        id="contact"
        className="scroll-mt-28 fluid-section bg-[var(--bg-surface-alt)]"
      >
        <div className="fluid-container grid grid-cols-1 lg:grid-cols-12 gap-[clamp(2rem,5vw,4rem)] items-start">
          {/* Left Info Column */}
          <div className="lg:col-span-5 space-y-8 min-w-0">
            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-medium text-[var(--text-primary)] leading-[1.06]">
              Visit or speak with us in Siliguri
            </h2>

            <div className="divide-y divide-[var(--border-hairline)] text-base">
              <div className="py-5 space-y-1.5">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                  Office address
                </p>
                <p className="text-base text-[var(--text-primary)] leading-relaxed break-anywhere">
                  {address}
                </p>
              </div>

              <div className="py-5 space-y-1.5">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                  Phone &amp; WhatsApp
                </p>
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="min-h-[44px] font-display text-[clamp(1.5rem,3vw,1.875rem)] font-semibold tabular-nums text-[var(--text-primary)] hover:text-[var(--accent-primary)] inline-flex items-center transition-colors break-anywhere"
                >
                  {phone}
                </a>
              </div>

              <div className="py-5 space-y-2.5">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                  Operating hours
                </p>
                <dl className="space-y-2 text-sm tabular-nums">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="font-medium text-[var(--text-secondary)]">Monday</dt>
                    <dd className="font-medium text-[var(--text-primary)]">
                      {settings?.operating_hours.monday || '9:00 AM – 9:30 PM'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="font-medium text-[var(--text-secondary)]">Tuesday</dt>
                    <dd className="font-medium text-[var(--text-primary)]">
                      {settings?.operating_hours.tuesday || '10:00 AM – 10:00 PM'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="font-medium text-[var(--text-secondary)]">Wednesday</dt>
                    <dd className="font-medium text-[var(--text-primary)]">
                      {settings?.operating_hours.wednesday || '9:00 AM – 9:30 PM'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="font-medium text-[var(--text-secondary)]">Thu – Sun</dt>
                    <dd className="font-medium text-[var(--text-primary)]">
                      {settings?.operating_hours.thursday_sunday ||
                        '9:00 AM – 5:00 PM'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="min-h-[48px] px-7 py-3 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center justify-center gap-2 transition-colors shadow-[var(--shadow-subtle)]"
              >
                <Phone className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Call now</span>
              </a>
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                  'Hello Debmalya Realty, I would like to enquire about properties in Siliguri.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary-lux min-h-[48px] px-7 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Right Underline-Input Form */}
          <div className="lg:col-span-7 lg:pl-6 min-w-0">
            <h3 className="font-display text-[clamp(1.75rem,3.5vw,2.25rem)] font-medium text-[var(--text-primary)]">
              Send an inquiry
            </h3>
            <p className="text-base text-[var(--text-secondary)] mt-1.5 fluid-prose">
              Tell us whether you are looking to buy, sell, rent, or construct a project in Siliguri.
            </p>

            <form onSubmit={handleContactSubmit} className="mt-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="underline-field">
                  <label
                    htmlFor="contact-name"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                  >
                    Your name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="Full name"
                    className="w-full min-h-[44px] py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none transition-colors"
                  />
                </div>
                <div className="underline-field">
                  <label
                    htmlFor="contact-phone"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                  >
                    Phone / WhatsApp *
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    required
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="+91 98..."
                    className="w-full min-h-[44px] py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none transition-colors tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="underline-field">
                  <label
                    htmlFor="contact-email"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                  >
                    Email address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    placeholder="Optional"
                    className="w-full min-h-[44px] py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none transition-colors"
                  />
                </div>
                <div className="underline-field">
                  <label
                    htmlFor="contact-interest"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                  >
                    Interested in *
                  </label>
                  <select
                    id="contact-interest"
                    value={cInterest}
                    onChange={(e) => setCInterest(e.target.value)}
                    className="w-full min-h-[44px] py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] focus:outline-none cursor-pointer transition-colors"
                  >
                    <option value="Property Buying" className="bg-[var(--bg-surface)]">Property Buying</option>
                    <option value="Property Selling" className="bg-[var(--bg-surface)]">Property Selling</option>
                    <option value="Rental Services" className="bg-[var(--bg-surface)]">Rental Services</option>
                    <option value="Construction & Development" className="bg-[var(--bg-surface)]">
                      Construction &amp; Development
                    </option>
                    <option value="Site Visit & Estimate" className="bg-[var(--bg-surface)]">
                      Site Visit &amp; Estimate
                    </option>
                  </select>
                </div>
              </div>

              <div className="underline-field">
                <label
                  htmlFor="contact-message"
                  className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                >
                  Message *
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={3}
                  value={cMessage}
                  onChange={(e) => setCMessage(e.target.value)}
                  placeholder="Share your preferred Siliguri locality, property size, or construction requirement..."
                  className="w-full py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none transition-colors"
                />
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
                  <CheckCircle2 className="w-4 h-4" />
                  {cSuccess}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={cSubmitting}
                  className="btn-primary-lux min-h-[48px] px-8 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {cSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : cSubmittedOk ? (
                    <motion.span
                      initial={prefersReduced ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.24, ease: LUX_EASE }}
                      className="inline-flex text-emerald-800"
                    >
                      <Check className="w-4 h-4" />
                    </motion.span>
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
            </form>
          </div>
        </div>
      </section>
    </main>
  );
};
