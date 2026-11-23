import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
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
import { formatReviewDate, validateReviewInput } from '../lib/realtyLogic';
import type { Review } from '../types/realty';
import { useApp } from '../context/AppContext';

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
            className="min-h-[44px] inline-flex items-center text-[13px] font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
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
  const { user, openAuthModal } = useApp();
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [customerType, setCustomerType] = useState('Home Buyer');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorKey, setFormErrorKey] = useState(0);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (!name) setName(user.full_name || '');
      if (!email) setEmail(user.email || '');
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
    return () => window.removeEventListener('resize', syncVisibleCount);
  }, []);

  useEffect(() => {
    if (activeIdx >= reviews.length && reviews.length > 0) {
      setActiveIdx(0);
    }
  }, [reviews.length, activeIdx]);

  useEffect(() => {
    if (reviews.length <= 1 || isPaused || prefersReduced) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveIdx((i) => (i + 1) % reviews.length);
      }
    }, 6200);

    return () => window.clearInterval(timer);
  }, [reviews.length, isPaused, prefersReduced]);

  useEffect(() => {
    if (!showForm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForm]);

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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (reviews.length <= 1) return;
    swipeStartX.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (swipeStartX.current === null) return;
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
      openAuthModal('login');
      return;
    }
    setFormError(null);
    setFormSuccess(null);

    const err = validateReviewInput({
      reviewer_name: name,
      reviewer_email: email,
      rating,
      review_text: message,
    });
    if (err) {
      setFormError(err);
      setFormErrorKey((k) => k + 1);
      return;
    }

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
      setFormSuccess(
        'Thank you for sharing your experience. Your review has been sent for approval.'
      );
      setSubmittedOk(true);
      window.setTimeout(() => setSubmittedOk(false), 2600);
      setMessage('');
      setRating(5);
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
      ? Array.from({ length: displayCount }, (_, k) => reviews[(activeIdx + k) % reviews.length])
      : [];

  return (
    <div
      className="space-y-10"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-medium text-[var(--text-primary)] leading-[1.06]">
            Words from our clients
          </h2>
        </div>

        {(reviews.length > 0 || showForm) && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setFormSuccess(null);
                setShowForm((v) => !v);
              }}
              aria-expanded={showForm}
              className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>{showForm ? 'Close form' : 'Share your experience'}</span>
            </button>

            {reviews.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous review"
                  className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--cta-gold-bg)] hover:border-[var(--cta-gold-bg)] hover:text-[var(--cta-gold-ink)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next review"
                  className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--cta-gold-bg)] hover:border-[var(--cta-gold-bg)] hover:text-[var(--cta-gold-ink)] transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fluid Multi-Column / Swipeable Editorial Reviews */}
      {loading ? (
        <div className="py-12 max-w-4xl space-y-4">
          <div className="h-8 w-3/4 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-8 w-2/3 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
          <div className="h-4 w-48 rounded-full bg-[var(--bg-surface-muted)] shimmer-skeleton" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-10 sm:py-14 border-y border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <p className="font-display text-[clamp(1.5rem,3vw,2.25rem)] font-medium text-[var(--text-primary)] leading-snug max-w-2xl">
            No reviews yet. Worked with us? Share your experience.
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setFormSuccess(null);
                setShowForm(true);
              }}
              className="btn-primary-lux min-h-[44px] px-6 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2 self-start lg:self-auto transition-colors cursor-pointer whitespace-nowrap"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Share your experience</span>
            </button>
          )}
        </div>
      ) : (
        <div
          className="space-y-6 select-none touch-pan-y"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            swipeStartX.current = null;
          }}
        >
          <div className={visibleReviews.length === 1 ? 'grid grid-cols-1' : 'fluid-grid-reviews'}>
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
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
                >
                  <span
                    className={`block h-2 rounded-full transition-all duration-300 ${
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

      {/* Expandable Review Form (Minimal Underline Style) */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="review-form-panel"
            data-open-form="true"
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.24, ease: LUX_EASE }}
            className="rounded-[clamp(1.25rem,3vw,1.75rem)] bg-[var(--bg-surface)] p-[clamp(1.25rem,3.5vw,2.5rem)] shadow-[var(--shadow-subtle)]"
          >
            <div className="w-full">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-medium text-[var(--text-primary)]">
                    Share your experience
                  </h3>
                  <p className="text-base text-[var(--text-secondary)] mt-1">
                    Submitted experiences are reviewed for authenticity before appearing publicly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  aria-label="Close review form"
                  className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:opacity-80 transition-opacity cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!user ? (
                <div className="mt-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-base text-[var(--text-secondary)]">
                    Please sign in to share your experience and track its approval status.
                  </p>
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold cursor-pointer shrink-0"
                  >
                    Sign in / Sign up
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="underline-field">
                      <label
                        htmlFor="rev-name"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                      >
                        Your name *
                      </label>
                      <input
                        id="rev-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full name"
                        className="w-full min-h-[44px] py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="underline-field">
                      <label
                        htmlFor="rev-email"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                      >
                        Email (private)
                      </label>
                      <input
                        id="rev-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full min-h-[44px] py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="underline-field">
                      <label
                        htmlFor="rev-type"
                        className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                      >
                        Client category
                      </label>
                      <select
                        id="rev-type"
                        value={customerType}
                        onChange={(e) => setCustomerType(e.target.value)}
                        className="w-full min-h-[44px] py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] focus:outline-none cursor-pointer transition-colors"
                      >
                        <option value="Home Buyer" className="bg-[var(--bg-surface)]">Home Buyer</option>
                        <option value="Property Seller" className="bg-[var(--bg-surface)]">Property Seller</option>
                        <option value="Tenant" className="bg-[var(--bg-surface)]">Tenant</option>
                        <option value="Construction Client" className="bg-[var(--bg-surface)]">Construction Client</option>
                        <option value="Property Investor" className="bg-[var(--bg-surface)]">Property Investor</option>
                      </select>
                    </div>
                    <div>
                      <span className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                        Rating *
                      </span>
                      <div className="flex items-center justify-between min-h-[48px] border-b border-[var(--border-input)]">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setRating(num)}
                            aria-label={`Rate ${num} stars`}
                            className="h-11 w-11 inline-flex items-center justify-center rounded-full hover:bg-[var(--bg-surface-muted)] cursor-pointer transition-colors"
                          >
                            <Star
                              className={`w-4 h-4 transition-colors ${
                                num <= rating
                                  ? 'fill-[var(--accent-secondary)] text-[var(--accent-secondary)]'
                                  : 'text-[var(--border-input)]'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="underline-field">
                    <label
                      htmlFor="rev-message"
                      className="block text-[13px] font-medium text-[var(--text-primary)] mb-1"
                    >
                      Your review *
                    </label>
                    <textarea
                      id="rev-message"
                      required
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share how our Siliguri team supported your property search or construction project..."
                      className="w-full py-3 bg-transparent border-0 border-b border-[var(--border-input)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none transition-colors"
                    />
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
                  {formSuccess && (
                    <p
                      className="text-sm text-emerald-500 inline-flex items-center gap-2"
                      role="status"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      {formSuccess}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary-lux min-h-[44px] px-7 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-medium inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : submittedOk ? (
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
                        {submitting
                          ? 'Submitting...'
                          : submittedOk
                          ? 'Submitted'
                          : 'Submit review'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
