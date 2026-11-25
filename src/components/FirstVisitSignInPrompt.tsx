import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LUX_EASE } from '../lib/motion';
import {
  hasShownSignInPrompt,
  isDisallowedPromptRoute,
  isLocalStorageAvailable,
  markSignInPromptShown,
} from '../lib/prompts';

const DWELL_DELAY_MS = 10_000;
const TYPING_COOLDOWN_MS = 2_000;
const ACTION_COOLDOWN_MS = 3_500;

function isTypingInField(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (active instanceof HTMLElement && active.isContentEditable) {
    return true;
  }
  return false;
}

function isAnyModalOrOpenFormInDom(): boolean {
  if (
    document.querySelector(
      '[role="dialog"][aria-modal="true"]:not([aria-hidden="true"]):not([data-first-visit-prompt="true"])'
    )
  ) {
    return true;
  }
  if (document.querySelector('[data-open-form="true"]')) {
    return true;
  }
  return false;
}

export const FirstVisitSignInPrompt: React.FC = () => {
  const {
    user,
    authLoading,
    authModalOpen,
    navDrawerOpen,
    firstVisitPromptOpen,
    setFirstVisitPromptOpen,
    openAuthModal,
  } = useApp();
  const { pathname } = useLocation();
  const prefersReduced = !!useReducedMotion();

  const [dwellReady, setDwellReady] = useState(false);
  const dialogCardRef = useRef<HTMLDivElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastTypingAtRef = useRef(0);
  const interactionCooldownUntilRef = useRef(0);

  // Start the 10-second page load timer once on first mount (only if eligible)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLocalStorageAvailable()) return;
    if (hasShownSignInPrompt()) return;

    const timer = window.setTimeout(() => {
      setDwellReady(true);
    }, DWELL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  // Track active typing, form submissions, and Call / WhatsApp taps so we never interrupt them
  useEffect(() => {
    const onInputOrKey = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        lastTypingAtRef.current = Date.now();
      }
    };

    const onSubmit = () => {
      interactionCooldownUntilRef.current = Date.now() + ACTION_COOLDOWN_MS;
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const contactAnchor = target.closest('a[href^="tel:"], a[href*="wa.me"]');
      if (contactAnchor) {
        interactionCooldownUntilRef.current = Date.now() + ACTION_COOLDOWN_MS;
      }
    };

    document.addEventListener('input', onInputOrKey, true);
    document.addEventListener('keydown', onInputOrKey, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('click', onClick, true);

    return () => {
      document.removeEventListener('input', onInputOrKey, true);
      document.removeEventListener('keydown', onInputOrKey, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  // If the user becomes signed in or opens auth, never show the prompt
  useEffect(() => {
    if (user || authModalOpen) {
      markSignInPromptShown();
      if (firstVisitPromptOpen) {
        setFirstVisitPromptOpen(false);
      }
    }
  }, [user, authModalOpen, firstVisitPromptOpen, setFirstVisitPromptOpen]);

  // Evaluate whether we can reveal the prompt once 10s dwell finishes
  useEffect(() => {
    if (!dwellReady || firstVisitPromptOpen || authLoading || user) return;
    if (!isLocalStorageAvailable() || hasShownSignInPrompt()) return;

    const tryShow = (): boolean => {
      if (authLoading || user) return true;
      if (hasShownSignInPrompt()) return true;
      if (isDisallowedPromptRoute(pathname)) return false;
      if (authModalOpen || navDrawerOpen) return false;
      if (isAnyModalOrOpenFormInDom()) return false;
      if (isTypingInField()) return false;
      const now = Date.now();
      if (now - lastTypingAtRef.current < TYPING_COOLDOWN_MS) return false;
      if (now < interactionCooldownUntilRef.current) return false;

      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      markSignInPromptShown();
      setFirstVisitPromptOpen(true);
      return true;
    };

    if (tryShow()) return;

    const poller = window.setInterval(() => {
      if (tryShow()) {
        window.clearInterval(poller);
      }
    }, 350);

    return () => window.clearInterval(poller);
  }, [
    dwellReady,
    firstVisitPromptOpen,
    authLoading,
    user,
    pathname,
    authModalOpen,
    navDrawerOpen,
    setFirstVisitPromptOpen,
  ]);

  const dismissPrompt = useCallback(
    (restoreFocus: boolean) => {
      markSignInPromptShown();
      setFirstVisitPromptOpen(false);
      if (restoreFocus) {
        window.setTimeout(() => {
          const prev = previousFocusRef.current;
          if (prev && prev.isConnected && typeof prev.focus === 'function') {
            prev.focus();
          }
          previousFocusRef.current = null;
        }, 30);
      } else {
        previousFocusRef.current = null;
      }
    },
    [setFirstVisitPromptOpen]
  );

  // Focus trap + Escape handling while open
  useEffect(() => {
    if (!firstVisitPromptOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      createBtnRef.current?.focus();
    }, 40);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissPrompt(true);
        return;
      }
      if (e.key === 'Tab' && dialogCardRef.current) {
        const focusables = Array.from(
          dialogCardRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.getClientRects().length > 0);

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (!dialogCardRef.current.contains(document.activeElement)) {
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
  }, [firstVisitPromptOpen, dismissPrompt]);

  return (
    <AnimatePresence>
      {firstVisitPromptOpen && (
        <motion.div
          key="first-visit-signin-backdrop"
          data-first-visit-prompt="true"
          role="dialog"
          aria-modal="true"
          aria-labelledby="first-visit-signin-title"
          aria-describedby="first-visit-signin-desc"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReduced ? 0.01 : 0.22, ease: LUX_EASE }}
          onClick={() => dismissPrompt(true)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-[2px]"
        >
          <motion.div
            ref={dialogCardRef}
            key="first-visit-signin-sheet"
            initial={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, y: 40, scale: 0.98 }
            }
            animate={
              prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, y: 32, scale: 0.98 }
            }
            transition={{ duration: prefersReduced ? 0.01 : 0.28, ease: LUX_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-[420px] max-h-[85dvh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] bg-[var(--bg-surface)] text-[var(--text-primary)] border-t sm:border border-[var(--border-hairline)] shadow-[var(--shadow-elevated)] pt-3 pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pb-[calc(env(safe-area-inset-bottom,0px)+1.35rem)] sm:p-7"
          >
            {/* Mobile bottom-sheet handle bar */}
            <div
              aria-hidden="true"
              className="sm:hidden w-10 h-1 rounded-full bg-[var(--border-input)] mx-auto mb-3.5"
            />

            <button
              type="button"
              onClick={() => dismissPrompt(true)}
              aria-label="Close"
              title="Close"
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-11 space-y-2">
              <h2
                id="first-visit-signin-title"
                className="font-display text-[clamp(1.5rem,4vw,1.85rem)] font-semibold leading-tight text-[var(--text-primary)]"
              >
                Save the homes you love
              </h2>
              <p
                id="first-visit-signin-desc"
                className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed"
              >
                Create a free account to save properties and track your site visit requests.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                ref={createBtnRef}
                type="button"
                onClick={() => {
                  dismissPrompt(false);
                  openAuthModal('register');
                }}
                className="btn-primary-lux w-full min-h-[48px] px-6 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold cursor-pointer"
              >
                Create account
              </button>

              <button
                type="button"
                onClick={() => {
                  dismissPrompt(false);
                  openAuthModal('login');
                }}
                className="w-full min-h-[46px] px-6 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium cursor-pointer transition-colors"
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => dismissPrompt(true)}
                className="w-full min-h-[44px] px-4 py-2 rounded-full text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
