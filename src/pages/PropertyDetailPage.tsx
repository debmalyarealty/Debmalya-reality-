import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize2,
  MessageCircle,
  Phone,
  Share2,
  Sofa,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  fetchPropertyBySlugOrId,
  getCachedPublicProperties,
  submitBooking,
  submitInquiry,
} from '../lib/supabaseData';
import { goBackOrFallback, LUX_EASE } from '../lib/motion';
import {
  formatINRReadable,
  isPropertyActiveOpportunity,
  validateAppointmentFields,
  validateInquiryFields,
  type AppointmentFieldErrors,
  type InquiryFieldErrors,
} from '../lib/realtyLogic';
import { useKeyboardSafeForm } from '../lib/formKeyboard';
import {
  applyDocumentMeta,
  buildPropertyMetaTags,
  buildSiteMetaTags,
} from '../lib/metaTags';
import { buildPropertyImageAlt } from '../lib/imageUtils';
import type { Property } from '../types/realty';
import { PropertyImage } from '../components/PropertyImage';
import { PropertyCard } from '../components/PropertyCard';
import { FavoriteButton } from '../components/FavoriteButton';

export const PropertyDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const {
    settings,
    user,
    favoriteIds,
    toggleFavorite,
    openAuthModal,
    authModalOpen,
    navDrawerOpen,
    firstVisitPromptOpen,
  } = useApp();

  const [property, setProperty] = useState<Property | null>(() => {
    if (!slug) return null;
    const cached = getCachedPublicProperties();
    return cached?.find((p) => p.slug === slug || p.id === slug) ?? null;
  });
  const [similar, setSimilar] = useState<Property[]>(() => {
    if (!slug) return [];
    const cached = getCachedPublicProperties();
    const hit = cached?.find((p) => p.slug === slug || p.id === slug);
    if (!cached || !hit) return [];
    return cached
      .filter((p) => p.id !== hit.id && isPropertyActiveOpportunity(p.status))
      .slice(0, 3);
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!slug) return false;
    const cached = getCachedPublicProperties();
    return !cached?.some((p) => p.slug === slug || p.id === slug);
  });
  const [error, setError] = useState<string | null>(null);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const gallerySwipeStartX = useRef<number | null>(null);
  const lightboxSwipeStartX = useRef<number | null>(null);

  // Interested? Card Mode
  const [interestedMode, setInterestedMode] = useState<null | 'visit' | 'question'>(null);

  // Site Visit / Booking Form
  const siteVisitFormRef = useRef<HTMLFormElement>(null);
  const { keyboardOpen: visitKeyboardOpen } = useKeyboardSafeForm(siteVisitFormRef);
  const [vName, setVName] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vDate, setVDate] = useState('');
  const [vTime, setVTime] = useState('11:00 AM');
  const [vMsg, setVMsg] = useState('');
  const [vSubmitting, setVSubmitting] = useState(false);
  const [vFieldErrors, setVFieldErrors] = useState<AppointmentFieldErrors>({});
  const [vError, setVError] = useState<string | null>(null);
  const [vShakeKey, setVShakeKey] = useState(0);
  const [vSuccess, setVSuccess] = useState<string | null>(null);

  // Quick Enquiry Form
  const enquiryFormRef = useRef<HTMLFormElement>(null);
  const { keyboardOpen: enquiryKeyboardOpen } = useKeyboardSafeForm(enquiryFormRef);
  const [eName, setEName] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [eMsg, setEMsg] = useState('');
  const [eSubmitting, setESubmitting] = useState(false);
  const [eFieldErrors, setEFieldErrors] = useState<InquiryFieldErrors>({});
  const [eError, setEError] = useState<string | null>(null);
  const [eShakeKey, setEShakeKey] = useState(0);
  const [eSuccess, setESuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const cachedPool = getCachedPublicProperties();
    const cachedHit = cachedPool?.find((p) => p.slug === slug || p.id === slug) ?? null;

    if (cachedHit) {
      setProperty(cachedHit);
      setSimilar(
        (cachedPool || [])
          .filter((p) => p.id !== cachedHit.id && isPropertyActiveOpportunity(p.status))
          .slice(0, 3)
      );
      setLoading(false);
    } else {
      setLoading(true);
    }
    setActiveImageIdx(0);
    setInterestedMode(null);

    fetchPropertyBySlugOrId(slug)
      .then((res) => {
        if (!active) return;
        setProperty(res.property);
        setSimilar(res.similar);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        if (!cachedHit) {
          setProperty(null);
          setError(err instanceof Error ? err.message : 'Property not found.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (loading) return;
    if (property && (property.slug === slug || property.id === slug)) {
      applyDocumentMeta(
        buildPropertyMetaTags(property, {
          pathname: `/properties/${property.slug}`,
          settings,
        })
      );
    } else if (error) {
      applyDocumentMeta(
        buildSiteMetaTags({
          title: 'Property Not Found — Debmalya Realty',
          description:
            'The requested property listing could not be found. Browse properties across Siliguri with Debmalya Realty.',
          pathname: window.location.pathname,
          robots: 'noindex, nofollow',
          image: settings?.hero_image_url,
          siteName: settings?.business_name,
        })
      );
    }
  }, [property, error, loading, slug, settings]);

  useEffect(() => {
    if (user) {
      setVName((v) => v || user.full_name || '');
      setVPhone((v) => v || user.phone || '');
      setVEmail((v) => v || user.email || '');
      setEName((v) => v || user.full_name || '');
      setEPhone((v) => v || user.phone || '');
      setEEmail((v) => v || user.email || '');
    }
  }, [user]);

  useEffect(() => {
    if (!lightboxOpen || !property) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight' && property.images.length > 1) {
        setActiveImageIdx((i) => (i + 1) % property.images.length);
      }
      if (e.key === 'ArrowLeft' && property.images.length > 1) {
        setActiveImageIdx(
          (i) => (i - 1 + property.images.length) % property.images.length
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [lightboxOpen, property]);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    setLightboxOpen(false);
    const currentSlugPath = property?.slug
      ? `/properties/${property.slug}`
      : slug
      ? `/properties/${slug}`
      : undefined;
    goBackOrFallback(navigate, '/', {
      skipPathPrefixes: currentSlugPath ? [currentSlugPath] : undefined,
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share && property) {
      try {
        await navigator.share({
          title: property.title,
          text: `${property.title} — ${formatINRReadable(
            property.price_inr,
            property.listing_type,
            property.price_unit
          )}`,
          url,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleGalleryPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    gallerySwipeStartX.current = e.clientX;
  };

  const handleGalleryPointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    total: number
  ) => {
    if (gallerySwipeStartX.current === null || total <= 1) {
      gallerySwipeStartX.current = null;
      return;
    }
    const delta = e.clientX - gallerySwipeStartX.current;
    gallerySwipeStartX.current = null;
    if (delta > 40) {
      setActiveImageIdx((i) => (i - 1 + total) % total);
    } else if (delta < -40) {
      setActiveImageIdx((i) => (i + 1) % total);
    }
  };

  const handleGalleryTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.touches.length === 1) {
      gallerySwipeStartX.current = e.touches[0].clientX;
    }
  };

  const handleGalleryTouchEnd = (
    e: React.TouchEvent<HTMLDivElement>,
    total: number
  ) => {
    if (gallerySwipeStartX.current === null || total <= 1) {
      gallerySwipeStartX.current = null;
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) return;
    const delta = touch.clientX - gallerySwipeStartX.current;
    gallerySwipeStartX.current = null;
    if (delta > 40) {
      setActiveImageIdx((i) => (i - 1 + total) % total);
    } else if (delta < -40) {
      setActiveImageIdx((i) => (i + 1) % total);
    }
  };

  const handleStickyBookVisit = () => {
    setInterestedMode('visit');
    window.setTimeout(() => {
      document.getElementById('property-enquiry-panel')?.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start',
      });
    }, 40);
  };

  const handleSiteVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || vSubmitting) return;
    if (!user) {
      openAuthModal('login');
      return;
    }
    setVError(null);
    setVSuccess(null);

    const { fields, firstError } = validateAppointmentFields({
      customer_name: vName,
      phone: vPhone,
      email: vEmail,
      property_id: property.id,
      preferred_date: vDate,
      preferred_time: vTime,
    });
    if (firstError) {
      setVFieldErrors(fields);
      setVError(firstError);
      setVShakeKey((k) => k + 1);
      const firstId = fields.customer_name
        ? 'visit-name'
        : fields.phone
        ? 'visit-phone'
        : fields.email
        ? 'visit-email'
        : fields.preferred_date
        ? 'visit-date'
        : 'visit-time';
      document.getElementById(firstId)?.focus();
      return;
    }
    setVFieldErrors({});

    setVSubmitting(true);
    try {
      await submitBooking({
        user_id: user.id,
        property_id: property.id,
        customer_name: vName,
        phone: vPhone,
        email: vEmail,
        preferred_date: vDate,
        preferred_time: vTime,
        note: vMsg,
      });
      setVSuccess(
        'Site visit request saved. Track confirmation status in your dashboard.'
      );
      setVMsg('');
    } catch (error) {
      setVError(
        error instanceof Error
          ? error.message
          : 'Unable to submit site visit request.'
      );
      setVShakeKey((k) => k + 1);
    } finally {
      setVSubmitting(false);
    }
  };

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || eSubmitting) return;
    setEError(null);
    setESuccess(null);

    const { fields, firstError } = validateInquiryFields({
      name: eName,
      phone: ePhone,
      email: eEmail,
      interested_in: property.title,
      message: eMsg,
    });
    if (firstError) {
      setEFieldErrors(fields);
      setEError(firstError);
      setEShakeKey((k) => k + 1);
      const firstId = fields.name
        ? 'enquiry-name'
        : fields.phone
        ? 'enquiry-phone'
        : fields.email
        ? 'enquiry-email'
        : 'enquiry-message';
      document.getElementById(firstId)?.focus();
      return;
    }
    setEFieldErrors({});

    setESubmitting(true);
    try {
      await submitInquiry({
        user_id: user?.id ?? null,
        property_id: property.id,
        property_title: property.title,
        name: eName,
        phone: ePhone,
        email: eEmail,
        interest: property.title,
        message: eMsg,
      });
      setESuccess('Your inquiry has been sent to Debmalya Realty.');
      setEMsg('');
    } catch (error) {
      setEError(error instanceof Error ? error.message : 'Unable to send inquiry.');
      setEShakeKey((k) => k + 1);
    } finally {
      setESubmitting(false);
    }
  };

  const phone = settings?.phone || '+91 86498 58954';
  const whatsapp = settings?.whatsapp || '918649858954';

  if (loading) {
    return (
      <main className="pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] fluid-container space-y-8">
        <div className="h-6 w-40 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        <div className="aspect-[16/9] max-h-[540px] w-full rounded-2xl bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-4">
            <div className="h-10 w-3/4 rounded-lg bg-[var(--bg-surface-muted)] shimmer-skeleton" />
            <div className="h-8 w-44 rounded-lg bg-[var(--bg-surface-muted)] shimmer-skeleton" />
            <div className="h-44 w-full rounded-2xl bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          </div>
          <div className="lg:col-span-5 h-96 rounded-2xl bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        </div>
      </main>
    );
  }

  if (error || !property) {
    return (
      <main className="pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] fluid-container text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] text-[var(--text-primary)]">
            Property Not Found
          </h1>
          <p className="text-base text-[var(--text-secondary)]">
            {error || 'This listing may have been unpublished or removed.'}
          </p>
          <Link
            to="/"
            onClick={handleBack}
            className="btn-primary-lux relative z-10 min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
        </div>
      </main>
    );
  }

  const isFav = favoriteIds.includes(property.id);
  const isActive = isPropertyActiveOpportunity(property.status);
  const images = property.images;
  const activeImg = images[activeImageIdx]?.url;
  const googleMapsUrl =
    property.latitude != null && property.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${property.address_detail ? `${property.address_detail}, ` : ''}${property.location}, Siliguri, West Bengal`
        )}`;

  return (
    <main className="pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] lg:pb-20 fluid-container space-y-[clamp(2rem,4.5vw,3.5rem)]">
      {/* Breadcrumb & Actions */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/"
          onClick={handleBack}
          className="group relative z-10 min-h-[44px] inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span>Back</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleShare}
            className="min-h-[44px] px-4 py-2 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] shadow-[var(--shadow-subtle)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {copiedShare ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Link copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </>
            )}
          </button>

          <FavoriteButton
            variant="pill"
            isFavorite={isFav}
            onToggle={() => toggleFavorite(property.id)}
            ariaLabel={isFav ? 'Remove from saved' : 'Save property'}
            label={isFav ? 'Saved' : 'Save'}
          />
        </div>
      </div>

      {/* Gallery */}
      <section aria-label="Property Image Gallery" className="space-y-3">
        <div
          onDragStart={(e) => e.preventDefault()}
          onTouchStart={handleGalleryTouchStart}
          onTouchEnd={(e) => handleGalleryTouchEnd(e, images.length)}
          onPointerDown={handleGalleryPointerDown}
          onPointerUp={(e) => handleGalleryPointerUp(e, images.length)}
          onPointerCancel={() => {
            gallerySwipeStartX.current = null;
          }}
          className="relative aspect-[4/3] sm:aspect-[16/9] max-h-[540px] w-full rounded-2xl overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface-muted)] touch-pan-y select-none [&_img]:pointer-events-none"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeImg || activeImageIdx}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0.3, scale: 1.015 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0.3 }}
              transition={{ duration: 0.32, ease: LUX_EASE }}
              className="w-full h-full"
            >
              <PropertyImage
                src={activeImg}
                alt={buildPropertyImageAlt(
                  property.title,
                  property.location,
                  activeImageIdx
                )}
                className="w-full h-full object-cover object-center"
                sizes="(max-width: 1024px) 94vw, 1140px"
                priority
              />
            </motion.div>
          </AnimatePresence>

          {images.length > 0 && (
            <span
              data-testid="gallery-counter"
              aria-live="polite"
              className="pointer-events-none absolute bottom-3.5 left-3.5 z-10 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-sm text-white text-[13px] font-medium tabular-nums shadow-sm"
            >
              {activeImageIdx + 1}/{images.length}
            </span>
          )}

          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Open full-screen image viewer"
            className="absolute bottom-3.5 right-3.5 z-10 min-h-[44px] px-4 py-2 rounded-xl bg-black/72 backdrop-blur-sm text-white text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-black/85 cursor-pointer"
          >
            <Expand className="w-4 h-4" />
            <span>Full Screen ({images.length})</span>
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveImageIdx((i) => (i - 1 + images.length) % images.length)
                }
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-black/62 text-white inline-flex items-center justify-center hover:bg-black/82 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveImageIdx((i) => (i + 1) % images.length)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-black/62 text-white inline-flex items-center justify-center hover:bg-black/82 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveImageIdx(idx)}
                className={`shrink-0 w-28 h-20 rounded-xl overflow-hidden border transition-all cursor-pointer ${
                  idx === activeImageIdx
                    ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/40'
                    : 'border-[var(--border-hairline)] opacity-75 hover:opacity-100'
                }`}
              >
                <PropertyImage
                  src={img.url}
                  alt={buildPropertyImageAlt(property.title, property.location, idx)}
                  className="w-full h-full object-cover object-center"
                  sizes="112px"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Content + Sticky Desktop Enquiry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[clamp(1.75rem,4vw,2.5rem)] items-start">
        <div className="lg:col-span-7 space-y-8 min-w-0">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5 text-[13px] font-medium text-[var(--text-secondary)]">
              <span className="px-3.5 py-1 rounded-full bg-[#16201B] text-white font-medium text-[13px]">
                {property.listing_type} &middot; {property.status}
              </span>
              <span>{property.property_type}</span>
              {property.is_demo && (
                <span className="px-3 py-1 rounded-full bg-[#16201B] text-white font-medium text-[13px]">
                  Sample listing
                </span>
              )}
            </div>

            <h1 className="font-display text-[clamp(1.875rem,4.5vw,3rem)] font-medium text-[var(--text-primary)] leading-[1.08] break-anywhere">
              {property.title}
            </h1>

            <p className="font-display text-[clamp(1.75rem,3.8vw,2.5rem)] font-semibold tabular-nums text-[var(--accent-primary)]">
              {formatINRReadable(
                property.price_inr,
                property.listing_type,
                property.price_unit
              )}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-start gap-2 text-base text-[var(--text-secondary)] min-w-0 break-anywhere">
                <MapPin className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-1" />
                <span>
                  {property.address_detail
                    ? `${property.address_detail}, `
                    : ''}
                  {property.location}, Siliguri, West Bengal
                </span>
              </p>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5 transition-colors shrink-0"
              >
                <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>View on map</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-75" />
              </a>
            </div>
          </div>

          {/* Specifications: Beds, Baths, Area, Furnishing */}
          <div
            data-testid="property-key-specs"
            className="grid grid-cols-4 gap-1 sm:gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 sm:p-5 py-3"
          >
            <div className="space-y-1 min-w-0">
              <span className="text-[13px] font-medium text-[var(--text-muted)] inline-flex items-center gap-1 max-w-full">
                <BedDouble className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Beds</span>
              </span>
              <p className="text-[13px] sm:text-base font-semibold tabular-nums text-[var(--text-primary)] truncate">
                {property.bedrooms > 0 ? property.bedrooms : '—'}
              </p>
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-[13px] font-medium text-[var(--text-muted)] inline-flex items-center gap-1 max-w-full">
                <Bath className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Baths</span>
              </span>
              <p className="text-[13px] sm:text-base font-semibold tabular-nums text-[var(--text-primary)] truncate">
                {property.bathrooms > 0 ? property.bathrooms : '—'}
              </p>
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-[13px] font-medium text-[var(--text-muted)] inline-flex items-center gap-1 max-w-full">
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Area</span>
              </span>
              <p
                title={
                  property.area_sqft > 0
                    ? `${property.area_sqft.toLocaleString('en-IN')} sq ft`
                    : undefined
                }
                className="text-[13px] sm:text-base font-semibold tabular-nums text-[var(--text-primary)] leading-snug break-words"
              >
                {property.area_sqft > 0
                  ? `${property.area_sqft.toLocaleString('en-IN')} sq ft`
                  : '—'}
              </p>
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-[13px] font-medium text-[var(--text-muted)] inline-flex items-center gap-1 max-w-full">
                <Sofa className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Furnishing</span>
              </span>
              <p
                title={property.furnishing || undefined}
                className="text-[13px] sm:text-base font-semibold text-[var(--text-primary)] leading-snug truncate"
              >
                {property.furnishing || '—'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
              Property Overview
            </h2>
            <p className="text-base leading-relaxed text-[var(--text-secondary)] whitespace-pre-line fluid-prose break-anywhere">
              {property.description}
            </p>
          </div>

          {/* Amenities as simple chips */}
          {property.amenities.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                Amenities
              </h2>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((item) => (
                  <span
                    key={item}
                    className="px-3.5 py-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Interested? Card */}
        <aside id="property-enquiry-panel" className="scroll-mt-28 lg:col-span-5 lg:sticky lg:top-24 min-w-0">
          <div className="rounded-[clamp(1.25rem,3vw,1.5rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-[clamp(1.125rem,3vw,1.5rem)] shadow-[var(--shadow-subtle)] space-y-5">
            {!isActive && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-strong)] text-[13px] text-[var(--text-primary)]">
                This property is currently marked as <strong>{property.status}</strong> and is shown for portfolio reference only. Contact us for similar available Siliguri options.
              </div>
            )}

            <div className="space-y-1">
              <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                Interested?
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Book a visit or ask a question about this property.
              </p>
            </div>

            {interestedMode === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInterestedMode('visit')}
                  className="btn-primary-lux min-h-[46px] py-2.5 px-4 rounded-xl bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Book a site visit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInterestedMode('question')}
                  className="min-h-[46px] py-2.5 px-4 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-semibold text-[var(--btn-secondary-text)] inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span>Ask a question</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-[var(--border-hairline)]">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {interestedMode === 'visit' ? 'Book a site visit' : 'Ask a question'}
                </span>
                <button
                  type="button"
                  onClick={() => setInterestedMode(null)}
                  className="min-h-[44px] px-2.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer"
                >
                  Change option
                </button>
              </div>
            )}

            {interestedMode === 'visit' && (
              <form
                ref={siteVisitFormRef}
                noValidate
                onSubmit={handleSiteVisitSubmit}
                className="space-y-3.5"
              >
                {!user ? (
                  <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 space-y-3">
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      Please sign in to schedule a guided site visit and track its confirmation status in your dashboard.
                    </p>
                    <button
                      type="button"
                      onClick={() => openAuthModal('login')}
                      className="btn-primary-lux w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-base font-semibold cursor-pointer"
                    >
                      Sign In to Book a Site Visit
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label
                        htmlFor="visit-name"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                      >
                        Full Name *
                      </label>
                      <input
                        id="visit-name"
                        type="text"
                        required
                        autoComplete="name"
                        aria-invalid={Boolean(vFieldErrors.customer_name)}
                        aria-describedby={
                          vFieldErrors.customer_name ? 'visit-name-error' : undefined
                        }
                        placeholder="Your full name"
                        value={vName}
                        onChange={(e) => {
                          setVName(e.target.value);
                          if (vFieldErrors.customer_name) {
                            setVFieldErrors((prev) => ({
                              ...prev,
                              customer_name: undefined,
                            }));
                          }
                        }}
                        className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors scroll-mt-24 scroll-mb-24 ${
                          vFieldErrors.customer_name
                            ? 'border-rose-500'
                            : 'border-[var(--border-input)]'
                        }`}
                      />
                      {vFieldErrors.customer_name && (
                        <p
                          id="visit-name-error"
                          role="alert"
                          className="mt-1 text-[13px] text-rose-500"
                        >
                          {vFieldErrors.customer_name}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="visit-phone"
                          className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                        >
                          Phone / WhatsApp *
                        </label>
                        <input
                          id="visit-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          required
                          aria-invalid={Boolean(vFieldErrors.phone)}
                          aria-describedby={
                            vFieldErrors.phone ? 'visit-phone-error' : undefined
                          }
                          placeholder="+91 98320 12345"
                          value={vPhone}
                          onChange={(e) => {
                            setVPhone(e.target.value);
                            if (vFieldErrors.phone) {
                              setVFieldErrors((prev) => ({ ...prev, phone: undefined }));
                            }
                          }}
                          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors tabular-nums scroll-mt-24 scroll-mb-24 ${
                            vFieldErrors.phone
                              ? 'border-rose-500'
                              : 'border-[var(--border-input)]'
                          }`}
                        />
                        {vFieldErrors.phone && (
                          <p
                            id="visit-phone-error"
                            role="alert"
                            className="mt-1 text-[13px] text-rose-500"
                          >
                            {vFieldErrors.phone}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="visit-email"
                          className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                        >
                          Email Address
                        </label>
                        <input
                          id="visit-email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          aria-invalid={Boolean(vFieldErrors.email)}
                          aria-describedby={
                            vFieldErrors.email ? 'visit-email-error' : undefined
                          }
                          placeholder="Optional"
                          value={vEmail}
                          onChange={(e) => {
                            setVEmail(e.target.value);
                            if (vFieldErrors.email) {
                              setVFieldErrors((prev) => ({ ...prev, email: undefined }));
                            }
                          }}
                          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors scroll-mt-24 scroll-mb-24 ${
                            vFieldErrors.email
                              ? 'border-rose-500'
                              : 'border-[var(--border-input)]'
                          }`}
                        />
                        {vFieldErrors.email && (
                          <p
                            id="visit-email-error"
                            role="alert"
                            className="mt-1 text-[13px] text-rose-500"
                          >
                            {vFieldErrors.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="visit-date"
                          className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                        >
                          Preferred Date *
                        </label>
                        <input
                          id="visit-date"
                          type="date"
                          required
                          aria-invalid={Boolean(vFieldErrors.preferred_date)}
                          aria-describedby={
                            vFieldErrors.preferred_date ? 'visit-date-error' : undefined
                          }
                          min={new Date().toISOString().slice(0, 10)}
                          value={vDate}
                          onChange={(e) => {
                            setVDate(e.target.value);
                            if (vFieldErrors.preferred_date) {
                              setVFieldErrors((prev) => ({
                                ...prev,
                                preferred_date: undefined,
                              }));
                            }
                          }}
                          className={`w-full min-h-[48px] px-3 py-2 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors scroll-mt-24 scroll-mb-24 ${
                            vFieldErrors.preferred_date
                              ? 'border-rose-500'
                              : 'border-[var(--border-hairline)]'
                          }`}
                        />
                        {vFieldErrors.preferred_date && (
                          <p
                            id="visit-date-error"
                            role="alert"
                            className="mt-1 text-[13px] text-rose-500"
                          >
                            {vFieldErrors.preferred_date}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="visit-time"
                          className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                        >
                          Preferred Time *
                        </label>
                        <select
                          id="visit-time"
                          aria-invalid={Boolean(vFieldErrors.preferred_time)}
                          value={vTime}
                          onChange={(e) => {
                            setVTime(e.target.value);
                            if (vFieldErrors.preferred_time) {
                              setVFieldErrors((prev) => ({
                                ...prev,
                                preferred_time: undefined,
                              }));
                            }
                          }}
                          className="w-full min-h-[48px] px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors scroll-mt-24 scroll-mb-24"
                        >
                          <option value="10:00 AM">10:00 AM</option>
                          <option value="11:00 AM">11:00 AM</option>
                          <option value="12:30 PM">12:30 PM</option>
                          <option value="03:00 PM">03:00 PM</option>
                          <option value="04:30 PM">04:30 PM</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="visit-message"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                      >
                        Additional Notes
                      </label>
                      <textarea
                        id="visit-message"
                        rows={2}
                        placeholder="Optional notes or questions for your visit"
                        value={vMsg}
                        onChange={(e) => setVMsg(e.target.value)}
                        className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors scroll-mt-24 scroll-mb-24"
                      />
                    </div>

                    {vError && (
                      <p
                        key={vShakeKey}
                        className="text-[13px] text-rose-500 animate-shake-once"
                        role="alert"
                      >
                        {vError}
                      </p>
                    )}
                    {vSuccess && (
                      <p className="text-[13px] text-emerald-500 flex items-center gap-1.5" role="status">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{vSuccess}</span>
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={!isActive || vSubmitting}
                      className="btn-primary-lux w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-base font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed scroll-mt-24 scroll-mb-24"
                    >
                      {vSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {!vSubmitting && vSuccess && <Check className="w-4 h-4 text-emerald-800" />}
                      <span>
                        {vSubmitting
                          ? 'Submitting...'
                          : vSuccess
                          ? 'Visit Requested'
                          : 'Book a site visit'}
                      </span>
                    </button>
                    <div
                      aria-hidden="true"
                      className={visitKeyboardOpen ? 'h-[42dvh]' : 'hidden'}
                    />
                  </>
                )}
              </form>
            )}

            {interestedMode === 'question' && (
              <form
                ref={enquiryFormRef}
                noValidate
                onSubmit={handleEnquirySubmit}
                className="space-y-3.5"
              >
                <div>
                  <label
                    htmlFor="enquiry-name"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                  >
                    Full Name *
                  </label>
                  <input
                    id="enquiry-name"
                    type="text"
                    required
                    autoComplete="name"
                    aria-invalid={Boolean(eFieldErrors.name)}
                    aria-describedby={eFieldErrors.name ? 'enquiry-name-error' : undefined}
                    placeholder="Your full name"
                    value={eName}
                    onChange={(e) => {
                      setEName(e.target.value);
                      if (eFieldErrors.name) {
                        setEFieldErrors((prev) => ({ ...prev, name: undefined }));
                      }
                    }}
                    className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors scroll-mt-24 scroll-mb-24 ${
                      eFieldErrors.name
                        ? 'border-rose-500'
                        : 'border-[var(--border-input)]'
                    }`}
                  />
                  {eFieldErrors.name && (
                    <p
                      id="enquiry-name-error"
                      role="alert"
                      className="mt-1 text-[13px] text-rose-500"
                    >
                      {eFieldErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="enquiry-phone"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                  >
                    Phone / WhatsApp *
                  </label>
                  <input
                    id="enquiry-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    aria-invalid={Boolean(eFieldErrors.phone)}
                    aria-describedby={
                      eFieldErrors.phone ? 'enquiry-phone-error' : undefined
                    }
                    placeholder="+91 98320 12345"
                    value={ePhone}
                    onChange={(e) => {
                      setEPhone(e.target.value);
                      if (eFieldErrors.phone) {
                        setEFieldErrors((prev) => ({ ...prev, phone: undefined }));
                      }
                    }}
                    className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors tabular-nums scroll-mt-24 scroll-mb-24 ${
                      eFieldErrors.phone
                        ? 'border-rose-500'
                        : 'border-[var(--border-input)]'
                    }`}
                  />
                  {eFieldErrors.phone && (
                    <p
                      id="enquiry-phone-error"
                      role="alert"
                      className="mt-1 text-[13px] text-rose-500"
                    >
                      {eFieldErrors.phone}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="enquiry-email"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="enquiry-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    aria-invalid={Boolean(eFieldErrors.email)}
                    aria-describedby={
                      eFieldErrors.email ? 'enquiry-email-error' : undefined
                    }
                    placeholder="Optional"
                    value={eEmail}
                    onChange={(e) => {
                      setEEmail(e.target.value);
                      if (eFieldErrors.email) {
                        setEFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors scroll-mt-24 scroll-mb-24 ${
                      eFieldErrors.email
                        ? 'border-rose-500'
                        : 'border-[var(--border-input)]'
                    }`}
                  />
                  {eFieldErrors.email && (
                    <p
                      id="enquiry-email-error"
                      role="alert"
                      className="mt-1 text-[13px] text-rose-500"
                    >
                      {eFieldErrors.email}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="enquiry-message"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                  >
                    Your Question *
                  </label>
                  <textarea
                    id="enquiry-message"
                    rows={3}
                    required
                    aria-invalid={Boolean(eFieldErrors.message)}
                    aria-describedby={
                      eFieldErrors.message ? 'enquiry-message-error' : undefined
                    }
                    placeholder="Ask about price, floor plan, or paperwork..."
                    value={eMsg}
                    onChange={(e) => {
                      setEMsg(e.target.value);
                      if (eFieldErrors.message) {
                        setEFieldErrors((prev) => ({ ...prev, message: undefined }));
                      }
                    }}
                    className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors scroll-mt-24 scroll-mb-24 ${
                      eFieldErrors.message
                        ? 'border-rose-500'
                        : 'border-[var(--border-input)]'
                    }`}
                  />
                  {eFieldErrors.message && (
                    <p
                      id="enquiry-message-error"
                      role="alert"
                      className="mt-1 text-[13px] text-rose-500"
                    >
                      {eFieldErrors.message}
                    </p>
                  )}
                </div>

                {eError && (
                  <p
                    key={eShakeKey}
                    className="text-[13px] text-rose-500 animate-shake-once"
                    role="alert"
                  >
                    {eError}
                  </p>
                )}
                {eSuccess && (
                  <p className="text-[13px] text-emerald-500 flex items-center gap-1.5" role="status">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{eSuccess}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={eSubmitting}
                  className="btn-primary-lux w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-base font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed scroll-mt-24 scroll-mb-24"
                >
                  {eSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {!eSubmitting && eSuccess && <Check className="w-4 h-4 text-emerald-800" />}
                  <span>
                    {eSubmitting
                      ? 'Sending...'
                      : eSuccess
                      ? 'Question Sent'
                      : 'Send question'}
                  </span>
                </button>
                <div
                  aria-hidden="true"
                  className={enquiryKeyboardOpen ? 'h-[42dvh]' : 'hidden'}
                />
              </form>
            )}

            {/* Direct Call & WhatsApp */}
            <div className="pt-4 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-3">
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="min-h-[44px] py-2.5 px-3 rounded-xl bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[13px] font-semibold text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)] inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Call</span>
              </a>
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                  `Hello Debmalya Realty, I am interested in ${property.title}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] py-2.5 px-3 rounded-xl bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[13px] font-semibold text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)] inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </aside>
      </div>

      {/* Similar Properties */}
      {similar.length > 0 && (
        <section className="pt-10 border-t border-[var(--border-hairline)] space-y-6">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[var(--text-primary)]">
            Similar Siliguri Properties
          </h2>
          <div className="fluid-grid-cards">
            {similar.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        </section>
      )}

      {/* Fullscreen Lightbox Viewer */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Full screen property gallery"
            onClick={() => setLightboxOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: LUX_EASE }}
            className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(false);
              }}
              aria-label="Close full-screen viewer"
              className="fixed top-[calc(env(safe-area-inset-top,0px)+1rem)] right-[calc(env(safe-area-inset-right,0px)+1rem)] z-20 h-11 w-11 rounded-full bg-white/15 text-white inline-flex items-center justify-center hover:bg-white/25 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx((i) => (i - 1 + images.length) % images.length);
                }}
                aria-label="Previous image"
                className="fixed left-[calc(env(safe-area-inset-left,0px)+0.75rem)] top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/15 text-white inline-flex items-center justify-center hover:bg-white/25 cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <motion.div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                lightboxSwipeStartX.current = e.clientX;
              }}
              onPointerUp={(e) => {
                if (lightboxSwipeStartX.current === null || images.length <= 1) {
                  lightboxSwipeStartX.current = null;
                  return;
                }
                const delta = e.clientX - lightboxSwipeStartX.current;
                lightboxSwipeStartX.current = null;
                if (delta > 40) {
                  setActiveImageIdx((i) => (i - 1 + images.length) % images.length);
                } else if (delta < -40) {
                  setActiveImageIdx((i) => (i + 1) % images.length);
                }
              }}
              onPointerCancel={() => {
                lightboxSwipeStartX.current = null;
              }}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: LUX_EASE }}
              className="relative z-10 max-w-5xl max-h-[85dvh] w-full flex flex-col items-center touch-pan-y select-none"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={activeImg}
                  src={activeImg}
                  alt={buildPropertyImageAlt(
                    property.title,
                    property.location,
                    activeImageIdx
                  )}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  initial={prefersReduced ? { opacity: 0 } : { opacity: 0.35, scale: 0.985 }}
                  animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={prefersReduced ? { opacity: 0 } : { opacity: 0.35 }}
                  transition={{ duration: 0.24, ease: LUX_EASE }}
                  className="max-h-[75dvh] w-auto object-contain rounded-lg"
                />
              </AnimatePresence>
              <p className="text-[13px] text-white/85 mt-3 tabular-nums">
                {activeImageIdx + 1}/{images.length}
              </p>
            </motion.div>

            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx((i) => (i + 1) % images.length);
                }}
                aria-label="Next image"
                className="fixed right-[calc(env(safe-area-inset-right,0px)+0.75rem)] top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/15 text-white inline-flex items-center justify-center hover:bg-white/25 cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Bottom Bar (replaces Call / WhatsApp bar on property details) */}
      {!lightboxOpen &&
        !authModalOpen &&
        !navDrawerOpen &&
        !firstVisitPromptOpen &&
        !visitKeyboardOpen &&
        !enquiryKeyboardOpen && (
          <div
            data-testid="property-sticky-bottom-bar"
            className="md:hidden fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom,0px)] bg-[var(--bg-surface)]/95 border-t border-[var(--border-hairline)] backdrop-blur-xl shadow-[0_-8px_28px_-12px_rgba(0,0,0,0.22)]"
          >
            <div className="h-[56px] w-full pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold tabular-nums text-[var(--accent-primary)] truncate leading-tight">
                  {formatINRReadable(
                    property.price_inr,
                    property.listing_type,
                    property.price_unit
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleStickyBookVisit}
                className="btn-primary-lux min-h-[44px] px-4 py-2 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Book a visit</span>
              </button>
            </div>
          </div>
        )}
    </main>
  );
};
