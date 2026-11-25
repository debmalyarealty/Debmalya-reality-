import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { LUX_EASE } from '../lib/motion';
import {
  computeCoachmarkLayout,
  hasShownDashboardCoachmark,
  isLocalStorageAvailable,
  markDashboardCoachmarkShown,
  type CoachmarkLayout,
} from '../lib/prompts';

const AUTO_CLOSE_MS = 8_000;

export const DashboardCoachmark: React.FC = () => {
  const {
    user,
    authLoading,
    authModalOpen,
    navDrawerOpen,
    firstVisitPromptOpen,
  } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const prefersReduced = !!useReducedMotion();

  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState<CoachmarkLayout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const measureAnchor = useCallback((): CoachmarkLayout | null => {
    if (typeof window === 'undefined') return null;
    const anchor = document.getElementById('navbar-dashboard-btn');
    if (!anchor) return null;
    const style = window.getComputedStyle(anchor);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return null;
    }
    const rect = anchor.getBoundingClientRect();
    const next = computeCoachmarkLayout(
      rect,
      window.innerWidth,
      window.innerHeight
    );
    return next.anchorVisible ? next : null;
  }, []);

  // Show once for a newly signed-in client after sign-in/first-visit modals close
  useEffect(() => {
    if (
      authLoading ||
      !user ||
      user.role !== 'client' ||
      authModalOpen ||
      navDrawerOpen ||
      firstVisitPromptOpen
    ) {
      return;
    }

    if (!isLocalStorageAvailable() || hasShownDashboardCoachmark(user.id)) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const measured = measureAnchor();
      if (!measured) return;
      markDashboardCoachmarkShown(user.id);
      setLayout(measured);
      setVisible(true);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    authLoading,
    user,
    authModalOpen,
    navDrawerOpen,
    firstVisitPromptOpen,
    pathname,
    measureAnchor,
  ]);

  // Dismiss immediately if signed out or owner takes over or menu opens
  useEffect(() => {
    if (!visible) return;
    if (!user || user.role !== 'client' || navDrawerOpen || authModalOpen) {
      setVisible(false);
    }
  }, [visible, user, navDrawerOpen, authModalOpen]);

  // Keep arrow locked to navbar Dashboard icon across resizes/scrolls, auto-close at 8s, dismiss on tap outside
  useEffect(() => {
    if (!visible) return;

    const autoTimer = window.setTimeout(() => {
      setVisible(false);
    }, AUTO_CLOSE_MS);

    let rafId = 0;
    const syncPosition = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const next = measureAnchor();
        if (!next) {
          setVisible(false);
          return;
        }
        setLayout(next);
      });
    };

    const onPointerDownOutside = (e: PointerEvent) => {
      const target = e.target;
      if (cardRef.current && target instanceof Node && cardRef.current.contains(target)) {
        return;
      }
      setVisible(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false);
      }
    };

    window.addEventListener('resize', syncPosition, { passive: true });
    window.addEventListener('orientationchange', syncPosition, { passive: true });
    window.addEventListener('scroll', syncPosition, { passive: true });
    document.addEventListener('pointerdown', onPointerDownOutside, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(autoTimer);
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('orientationchange', syncPosition);
      window.removeEventListener('scroll', syncPosition);
      document.removeEventListener('pointerdown', onPointerDownOutside);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, measureAnchor]);

  return (
    <AnimatePresence>
      {visible && layout && layout.anchorVisible && (
        <motion.div
          ref={cardRef}
          key="client-dashboard-coachmark"
          role="status"
          aria-live="polite"
          data-dashboard-coachmark="true"
          initial={
            prefersReduced
              ? { opacity: 0 }
              : { opacity: 0, y: -6, scale: 0.97 }
          }
          animate={
            prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
          }
          exit={
            prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }
          }
          transition={{ duration: prefersReduced ? 0.01 : 0.22, ease: LUX_EASE }}
          style={{
            left: `${layout.cardLeft}px`,
            top: `${layout.cardTop}px`,
            width: `${layout.cardWidth}px`,
          }}
          className="fixed z-[45] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] p-4 shadow-[var(--shadow-elevated)]"
        >
          {/* Upward arrow pointing accurately at navbar Dashboard button */}
          <span
            aria-hidden="true"
            data-coachmark-arrow="true"
            style={{ left: `${layout.arrowLeftInCard}px` }}
            className="absolute -top-[7px] -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-t border-l border-[var(--border-hairline)] bg-[var(--bg-surface)]"
          />

          <div className="relative space-y-1.5">
            <h3 className="font-display text-lg font-semibold leading-snug text-[var(--text-primary)]">
              This is your dashboard
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Saved properties, visit requests and your enquiries, all in one place.
            </p>
          </div>

          <div className="relative mt-3.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="min-h-[44px] px-4 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-[13px] font-medium cursor-pointer transition-colors"
            >
              Got it
            </button>
            <button
              type="button"
              onClick={() => {
                setVisible(false);
                if (pathname === '/my-account') {
                  window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
                } else {
                  navigate('/my-account');
                }
              }}
              className="btn-primary-lux min-h-[44px] px-4 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-[13px] font-semibold cursor-pointer"
            >
              Open dashboard
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
