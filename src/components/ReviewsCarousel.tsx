import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MessageSquarePlus,
  Star,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  fetchApprovedReviews,
  getCachedApprovedReviews,
  submitReview,
} from '../lib/supabaseData';
import { LUX_EASE } from '../lib/motion';
import {
  formatReviewDate,
  validateReviewFields,
  type ReviewFieldErrors,
} from '../lib/realtyLogic';
import { useKeyboardSafeForm } from '../lib/formKeyboard';
import type { Review } from '../types/realty';
import { useApp } from '../context/AppContext';

const PENDING_REVIEW_AFTER_AUTH_KEY = 'dr_pending_review_after_auth';

const ReviewCardItem: React.FC<{ review: Review; isSingleCard: boolean }> = ({
  review,
  isSingleCard,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const quoteRef = useRef<HTMLQuoteElement | null>(null);

  useEffect(() => {
    setExpanded(false);
    const el = quoteRef.current;
    if (!el) return;
    const measure = () => {
      if (!quoteRef.current) return;
      setIsOverflowing(
        quoteRef.current.scrollHeight > quoteRef.current.clientHeight + 2 ||
          review.review_text.trim().length > 180
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [review.id, review.review_text]);

  const dateText = formatReviewDate(review.review_date || review.created_at);

  return (
    <figure className="min-w-0 flex flex-col justify-between gap-6 rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-[clamp(1.25rem,3vw,2rem)] shadow-[var(--shadow-subtle)]">
      <div className="space-y-4">
        <div
          className="flex items-center gap-1.5"
          aria-label={`Rated ${review.rating} out of 5`}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-4 h-4 ${
                star <= review.rating
                  ? 'fill-[var(--accent-secondary)] text-[var(--accent-secondary)]'
                  : 'text-[var(--border-input)]'
              }`}
            />
          ))}
        </div>

        <blockquote
          ref={quoteRef}
          className={`font-display ${
            isSingleCard
              ? 'text-[clamp(1.375rem,3vw,2.25rem)] leading-[1.32]'
              : 'text-[clamp(1.25rem,2vw,1.625rem)] leading-[1.35]'
          } font-medium text-[var(--text-primary)] break-anywhere ${
            expanded ? '' : 'line-clamp-4'
          }`}
        >
          &ldquo;{review.review_text}&rdquo;
        </blockquote>

        {(isOverflowing || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="tap-press min-h-[44px] inline-flex items-center text-[13px] font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      <figcaption className="pt-4 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-medium text-[var(--text-secondary)]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
          <span className="font-semibold text-[var(--text-primary)] break-anywhere">
            {review.reviewer_name}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span className="text-[13px]">{review.customer_type}</span>
        </div>
        {dateText && (
          <span className="tabular-nums text-[13px] text-[var(--text-muted)] whitespace-nowrap">
            {dateText}
          </span>
        )}
      </figcaption>
    </figure>
  );
};

export const ReviewsCarousel: React.FC = () => {
  const { user, openAuthModal, showToast, authModalOpen, authModalMode } = useApp();
  const prefersReduced = !!useReducedMotion();
  const [reviews, setReviews] = useState<Review[]>(
    () => getCachedApprovedReviews() ?? []
  );
  const [loading, setLoading] = useState(
    () => getCachedApprovedReviews() === null
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [visibleCount, setVisibleCount] = useState(1);
  const swipeStartX = useRef<number | null>(null);

  // Review form state
  const reviewFormRef = useRef<HTMLFormElement>(null);
  const { keyboardOpen: reviewKeyboardOpen } = useKeyboardSafeForm(reviewFormRef);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [customerType, setCustomerType] = useState('Home Buyer');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ReviewFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorKey, setFormErrorKey] = useState(0);

  useEffect(() => {
    if (user) {
      if (!name) setName(user.full_name || '');
      if (!email) setEmail(user.email || '');
    }
  }, [user, name, email]);

  // Clear pending review intent if user cancels auth modal without confirming
  useEffect(() => {
    if (!authModalOpen && !user && authModalMode !== 'verify-sent') {
      try {
        window.sessionStorage.removeItem(PENDING_REVIEW_AFTER_AUTH_KEY);
      } catch {
        // ignore storage errors
      }
    }
  }, [authModalOpen, authModalMode, user]);

  // Resume opening the review modal if user returned from email verification
  useEffect(() => {
    if (!user) return;
    try {
      if (window.sessionStorage.getItem(PENDING_REVIEW_AFTER_AUTH_KEY) === '1') {
        window.sessionStorage.removeItem(PENDING_REVIEW_AFTER_AUTH_KEY);
        setFormError(null);
        setShowForm(true);
      }
    } catch {
      // ignore storage errors
    }
  }, [user]);

  useEffect(() => {
    fetchApprovedReviews()
      .then((list) => setReviews(list))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const syncVisibleCount = () => {
      const w = window.innerWidth;
      setVisibleCount(w < 700 ? 1 : w < 1080 ? 2 : 3);
    };
    syncVisibleCount();
    window.addEventListener('resize', syncVisibleCount);
    window.addEventListener('orientationchange', syncVisibleCount);
    return () => {
      window.removeEventListener('resize', syncVisibleCount);
      window.removeEventListener('orientationchange', syncVisibleCount);
    };
  }, []);

  useEffect(() => {
    if (activeIdx >= reviews.length && reviews.length > 0) {
      setActiveIdx(0);
    }
  }, [reviews.length, activeIdx]);

  useEffect(() => {
    if (reviews.length <= 1 || isPaused || prefersReduced || showForm) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveIdx((i) => (i + 1) % reviews.length);
      }
    }, 6200);

    return () => window.clearInterval(timer);
  }, [reviews.length, isPaused, prefersReduced, showForm]);

  useEffect(() => {
    if (!showForm) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showForm]);

  const handleOpenReviewFlow = useCallback(() => {
    setFormError(null);
    if (!user) {
      try {
        window.sessionStorage.setItem(PENDING_REVIEW_AFTER_AUTH_KEY, '1');
      } catch {
        // ignore storage errors
      }
      openAuthModal('register', {
        suppressRedirect: true,
        onSuccess: () => {
          try {
            window.sessionStorage.removeItem(PENDING_REVIEW_AFTER_AUTH_KEY);
          } catch {
            // ignore storage errors
          }
          setFormError(null);
          setShowForm(true);
        },
      });
      return;
    }
    setShowForm(true);
  }, [user, openAuthModal]);

  const goPrev = () => {
    if (reviews.length <= 1) return;
    setIsPaused(true);
    setActiveIdx((i) => (i - 1 + reviews.length) % reviews.length);
  };

  const goNext = () => {
    if (reviews.length <= 1) return;
    setIsPaused(true);
    setActiveIdx((i) => (i + 1) % reviews.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (reviews.length <= 1) return;
    swipeStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    if (typeof endX !== 'number') return;
    const delta = endX - startX;
    if (delta > 45) {
      goPrev();
    } else if (delta < -45) {
      goNext();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || reviews.length <= 1) return;
    swipeStartX.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || swipeStartX.current === null) return;
    const delta = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (delta > 45) {
      goPrev();
    } else if (delta < -45) {
      goNext();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!user) {
      setShowForm(false);
      handleOpenReviewFlow();
      return;
    }
    setFormError(null);

    const { fields, firstError } = validateReviewFields({
      reviewer_name: name,
      reviewer_email: email,
      rating,
      review_text: message,
    });
    if (firstError) {
      setFieldErrors(fields);
      setFormError(firstError);
      setFormErrorKey((k) => k + 1);
      const firstId = fields.reviewer_name
        ? 'rev-name'
        : fields.reviewer_email
        ? 'rev-email'
        : 'rev-message';
      document.getElementById(firstId)?.focus();
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    setSubmittedOk(false);
    try {
      await submitReview({
        user_id: user.id,
        name,
        email,
        category: customerType,
        rating,
        text: message,
      });
      setSubmittedOk(true);
      setMessage('');
      setRating(5);
      setShowForm(false);
      showToast(
        'Thank you! Your review has been submitted and is pending approval.',
        'info'
      );
      window.setTimeout(() => setSubmittedOk(false), 1800);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Unable to submit review.'
      );
      setFormErrorKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const displayCount = Math.min(visibleCount, reviews.length);
  const visibleReviews =
    reviews.length > 0
      ? Array.from(
          { length: displayCount },
          (_, k) => reviews[(activeIdx + k) % reviews.length]
        )
      : [];

  return (
    <div
      className="space-y-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium text-[var(--text-primary)] leading-[1.15]">
            Reviews
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenReviewFlow}
            className="btn-primary-lux tap-press min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>Share your experience</span>
          </button>

          {reviews.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous review"
                className="tap-press h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--cta-gold-bg)] hover:border-[var(--cta-gold-bg)] hover:text-[var(--cta-gold-ink)] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next review"
                className="tap-press h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--cta-gold-bg)] hover:border-[var(--cta-gold-bg)] hover:text-[var(--cta-gold-ink)] cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fluid Multi-Column / Swipeable Editorial Reviews */}
      {loading ? (
        <div className="py-10 max-w-4xl space-y-4">
          <div className="h-8 w-3/4 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-8 w-2/3 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-4 w-48 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-base sm:text-lg font-medium text-[var(--text-secondary)]">
            No approved reviews yet. Worked with Debmalya Realty? Share your experience.
          </p>
          <button
            type="button"
            onClick={handleOpenReviewFlow}
            className="btn-primary-lux tap-press min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer whitespace-nowrap"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>Share your experience</span>
          </button>
        </div>
      ) : (
        <div
          className="space-y-6 select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            swipeStartX.current = null;
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            swipeStartX.current = null;
          }}
        >
          <div
            className={
              visibleReviews.length === 1
                ? 'grid grid-cols-1'
                : 'fluid-grid-reviews'
            }
          >
            {visibleReviews.map((rev) => (
              <ReviewCardItem
                key={rev.id}
                review={rev}
                isSingleCard={visibleReviews.length === 1}
              />
            ))}
          </div>

          {reviews.length > 1 && (
            <div className="flex items-center justify-center gap-1">
              {reviews.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setIsPaused(true);
                    setActiveIdx(idx);
                  }}
                  aria-label={`Show review by ${r.reviewer_name}`}
                  className="tap-press min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
                >
                  <span
                    className={`block h-2 rounded-full transition-transform duration-300 ${
                      idx === activeIdx
                        ? 'w-7 bg-[var(--accent-secondary)]'
                        : 'w-2 bg-[var(--border-input)] hover:bg-[var(--text-muted)]'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popup / Mobile Bottom-Sheet Review Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="review-modal-backdrop"
            onClick={() => setShowForm(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: LUX_EASE }}
            role="dialog"
            aria-modal="true"
            aria-label="Share your experience"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs"
          >
            <motion.div
              key="review-modal-sheet"
              onClick={(e) => e.stopPropagation()}
              data-open-form="true"
              initial={
                prefersReduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              animate={
                prefersReduced
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                prefersReduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: 18, scale: 0.98 }
              }
              transition={{ duration: 0.24, ease: LUX_EASE }}
              className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-5 sm:p-7 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] shadow-[var(--shadow-elevated)]"
            >
              {/* Mobile drag indicator */}
              <div
                aria-hidden="true"
                className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-input)]"
              />

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-[clamp(1.4rem,3vw,1.85rem)] font-medium text-[var(--text-primary)]">
                    Share your experience
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Submitted reviews stay pending until verified and approved by our team.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  aria-label="Close review form"
                  className="tap-press h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:opacity-80 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                ref={reviewFormRef}
                noValidate
                onSubmit={handleSubmit}
                className="mt-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor="rev-name"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                    >
                      Your name *
                    </label>
                    <input
                      id="rev-name"
                      type="text"
                      required
                      autoComplete="name"
                      aria-invalid={Boolean(fieldErrors.reviewer_name)}
                      aria-describedby={
                        fieldErrors.reviewer_name ? 'rev-name-error' : undefined
                      }
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (fieldErrors.reviewer_name) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            reviewer_name: undefined,
                          }));
                        }
                      }}
                      placeholder="Full name"
                      className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none scroll-mt-24 scroll-mb-24 ${
                        fieldErrors.reviewer_name
                          ? 'border-rose-500'
                          : 'border-[var(--border-input)] focus:border-[var(--accent-primary)]'
                      }`}
                    />
                    {fieldErrors.reviewer_name && (
                      <p
                        id="rev-name-error"
                        role="alert"
                        className="mt-1 text-[13px] text-rose-500"
                      >
                        {fieldErrors.reviewer_name}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="rev-email"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                    >
                      Email (private)
                    </label>
                    <input
                      id="rev-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      aria-invalid={Boolean(fieldErrors.reviewer_email)}
                      aria-describedby={
                        fieldErrors.reviewer_email ? 'rev-email-error' : undefined
                      }
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.reviewer_email) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            reviewer_email: undefined,
                          }));
                        }
                      }}
                      placeholder="you@example.com"
                      className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none scroll-mt-24 scroll-mb-24 ${
                        fieldErrors.reviewer_email
                          ? 'border-rose-500'
                          : 'border-[var(--border-input)] focus:border-[var(--accent-primary)]'
                      }`}
                    />
                    {fieldErrors.reviewer_email && (
                      <p
                        id="rev-email-error"
                        role="alert"
                        className="mt-1 text-[13px] text-rose-500"
                      >
                        {fieldErrors.reviewer_email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor="rev-type"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                    >
                      Client category
                    </label>
                    <select
                      id="rev-type"
                      value={customerType}
                      onChange={(e) => setCustomerType(e.target.value)}
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer scroll-mt-24 scroll-mb-24"
                    >
                      <option value="Home Buyer" className="bg-[var(--bg-surface)]">
                        Home Buyer
                      </option>
                      <option
                        value="Property Seller"
                        className="bg-[var(--bg-surface)]"
                      >
                        Property Seller
                      </option>
                      <option value="Tenant" className="bg-[var(--bg-surface)]">
                        Tenant
                      </option>
                      <option
                        value="Construction Client"
                        className="bg-[var(--bg-surface)]"
                      >
                        Construction Client
                      </option>
                      <option
                        value="Property Investor"
                        className="bg-[var(--bg-surface)]"
                      >
                        Property Investor
                      </option>
                    </select>
                  </div>

                  <div className="min-w-0">
                    <span className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
                      Rating *
                    </span>
                    <div className="flex items-center justify-between min-h-[48px] px-2 rounded-xl border border-[var(--border-input)] bg-[var(--bg-canvas)]">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setRating(num);
                            if (fieldErrors.rating) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                rating: undefined,
                              }));
                            }
                          }}
                          aria-label={`Rate ${num} stars`}
                          className="tap-press h-11 min-w-[44px] flex-1 inline-flex items-center justify-center rounded-full hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              num <= rating
                                ? 'fill-[var(--accent-secondary)] text-[var(--accent-secondary)]'
                                : 'text-[var(--border-input)]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {fieldErrors.rating && (
                      <p role="alert" className="mt-1 text-[13px] text-rose-500">
                        {fieldErrors.rating}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="rev-message"
                    className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Your review *
                  </label>
                  <textarea
                    id="rev-message"
                    required
                    rows={3}
                    aria-invalid={Boolean(fieldErrors.review_text)}
                    aria-describedby={
                      fieldErrors.review_text ? 'rev-message-error' : undefined
                    }
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (fieldErrors.review_text) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          review_text: undefined,
                        }));
                      }
                    }}
                    placeholder="Share how our Siliguri team supported your property search or construction project..."
                    className={`w-full min-h-[96px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none scroll-mt-24 scroll-mb-24 ${
                      fieldErrors.review_text
                        ? 'border-rose-500'
                        : 'border-[var(--border-input)] focus:border-[var(--accent-primary)]'
                    }`}
                  />
                  {fieldErrors.review_text && (
                    <p
                      id="rev-message-error"
                      role="alert"
                      className="mt-1 text-[13px] text-rose-500"
                    >
                      {fieldErrors.review_text}
                    </p>
                  )}
                </div>

                {formError && (
                  <p
                    key={`rev-err-${formErrorKey}`}
                    className="animate-shake-once text-sm text-rose-500"
                    role="alert"
                  >
                    {formError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary-lux tap-press flex-1 sm:flex-none min-h-[48px] px-7 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-base font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed scroll-mt-24 scroll-mb-24"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : submittedOk ? (
                      <Check className="w-4 h-4" />
                    ) : null}
                    <span>{submitting ? 'Submitting...' : 'Submit review'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="tap-press min-h-[48px] px-5 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div
                  aria-hidden="true"
                  className={reviewKeyboardOpen ? 'h-[28dvh]' : 'hidden'}
                />
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
