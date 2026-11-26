import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const MobileFloatingActions: React.FC = () => {
  const { settings, authModalOpen, navDrawerOpen, firstVisitPromptOpen } = useApp();
  const { pathname } = useLocation();
  const [formFocused, setFormFocused] = useState(false);
  const [modalOpenInDom, setModalOpenInDom] = useState(false);
  const [contactInView, setContactInView] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
  const [scrollingDown, setScrollingDown] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const isFormField = (el: EventTarget | null) =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLElement && el.isContentEditable);

    const onFocusIn = (e: FocusEvent) => {
      if (isFormField(e.target)) {
        setFormFocused(true);
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isFormField(document.activeElement)) {
          setFormFocused(false);
        }
      }, 60);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    lastScrollYRef.current = Math.max(0, window.scrollY);
    setScrollingDown(false);

    const checkModalsAndSections = () => {
      const openDialog = document.querySelector(
        '[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])'
      );
      setModalOpenInDom(Boolean(openDialog));

      const contactEl = document.getElementById('contact');
      if (contactEl) {
        const rect = contactEl.getBoundingClientRect();
        setContactInView(rect.top < window.innerHeight && rect.bottom > 0);
      } else {
        setContactInView(false);
      }

      const footerEl = document.querySelector('footer');
      if (footerEl) {
        const fRect = footerEl.getBoundingClientRect();
        setFooterInView(fRect.top < window.innerHeight && fRect.bottom > 0);
      } else {
        setFooterInView(false);
      }
    };

    const onScroll = () => {
      const currentY = Math.max(0, window.scrollY);
      if (currentY <= 32) {
        setScrollingDown(false);
        lastScrollYRef.current = currentY;
      } else {
        const delta = currentY - lastScrollYRef.current;
        if (delta > 6) {
          setScrollingDown(true);
          lastScrollYRef.current = currentY;
        } else if (delta < -6) {
          setScrollingDown(false);
          lastScrollYRef.current = currentY;
        }
      }
      checkModalsAndSections();
    };

    checkModalsAndSections();

    let contactObserver: IntersectionObserver | null = null;
    const contactEl = document.getElementById('contact');
    if (contactEl && typeof IntersectionObserver !== 'undefined') {
      contactObserver = new IntersectionObserver(
        (entries) => {
          setContactInView(entries.some((entry) => entry.isIntersecting));
        },
        { threshold: 0.01 }
      );
      contactObserver.observe(contactEl);
    }

    let footerObserver: IntersectionObserver | null = null;
    const footerEl = document.querySelector('footer');
    if (footerEl && typeof IntersectionObserver !== 'undefined') {
      footerObserver = new IntersectionObserver(
        (entries) => {
          setFooterInView(entries.some((entry) => entry.isIntersecting));
        },
        { threshold: 0.01 }
      );
      footerObserver.observe(footerEl);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', checkModalsAndSections, { passive: true });
    window.addEventListener('orientationchange', checkModalsAndSections, { passive: true });
    const mut = new MutationObserver(() => checkModalsAndSections());
    mut.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'open'],
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', checkModalsAndSections);
      window.removeEventListener('orientationchange', checkModalsAndSections);
      contactObserver?.disconnect();
      footerObserver?.disconnect();
      mut.disconnect();
    };
  }, [pathname]);

  const isPrivatePortal =
    pathname.startsWith('/owner-dashboard') ||
    pathname.startsWith('/owner-login') ||
    pathname.startsWith('/my-account');

  const isPropertyDetail =
    pathname.startsWith('/properties/') && pathname !== '/properties/';

  if (
    isPrivatePortal ||
    isPropertyDetail ||
    navDrawerOpen ||
    authModalOpen ||
    firstVisitPromptOpen ||
    modalOpenInDom ||
    formFocused
  ) {
    return null;
  }

  const barHidden = contactInView || scrollingDown;
  const desktopHidden = contactInView || footerInView;
  const phone = settings?.phone || '+91 86498 58954';
  const whatsapp = (settings?.whatsapp || '918649858954').replace(/[^\d]/g, '');

  return (
    <>
      {/* Phones (< 768px): slim bottom action bar (~56px + safe-area) */}
      <div
        data-testid="mobile-bottom-action-bar"
        aria-label="Quick Contact Actions"
        aria-hidden={barHidden}
        className={`md:hidden fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom,0px)] bg-[var(--bg-surface)]/95 border-t border-[var(--border-hairline)] backdrop-blur-xl shadow-[0_-8px_28px_-12px_rgba(0,0,0,0.22)] transition-[transform,opacity,visibility] duration-250 ease-out motion-reduce:transition-none ${
          barHidden
            ? 'translate-y-full opacity-0 pointer-events-none invisible'
            : 'translate-y-0 opacity-100 visible'
        }`}
      >
        <div className="h-[56px] w-full pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] grid grid-cols-2 gap-3 items-center">
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            aria-label={`Call Debmalya Realty at ${phone}`}
            tabIndex={barHidden ? -1 : undefined}
            className="w-full h-11 min-h-[44px] px-4 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
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
            aria-label="Chat on WhatsApp with Debmalya Realty"
            tabIndex={barHidden ? -1 : undefined}
            className="w-full h-11 min-h-[44px] px-4 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] border border-black/15 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Tablets & Desktops (768px+): small round floating Call / WhatsApp buttons */}
      <div
        data-testid="desktop-floating-actions"
        aria-label="Quick Contact Actions"
        aria-hidden={desktopHidden}
        className={`hidden md:flex fixed right-[max(1.5rem,env(safe-area-inset-right,0px))] bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] z-30 flex-col gap-3 transition-[transform,opacity,visibility] duration-250 ease-out motion-reduce:transition-none ${
          desktopHidden
            ? 'translate-y-4 opacity-0 pointer-events-none invisible'
            : 'translate-y-0 opacity-100 visible'
        }`}
      >
        <a
          href={`tel:${phone.replace(/\s+/g, '')}`}
          aria-label={`Call Debmalya Realty at ${phone}`}
          title={`Call ${phone}`}
          tabIndex={desktopHidden ? -1 : undefined}
          className="tap-press h-12 w-12 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--accent-primary)] ring-1 ring-black/10 dark:ring-white/15 shadow-[var(--shadow-elevated)] inline-flex items-center justify-center transition-colors"
        >
          <Phone className="w-4 h-4 shrink-0" />
        </a>
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
            'Hello Debmalya Realty, I would like to enquire about properties in Siliguri.'
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp with Debmalya Realty"
          title="WhatsApp"
          tabIndex={desktopHidden ? -1 : undefined}
          className="tap-press h-12 w-12 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] border border-black/15 ring-1 ring-white/30 dark:ring-black/25 shadow-[var(--shadow-elevated)] inline-flex items-center justify-center transition-colors"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
        </a>
      </div>
    </>
  );
};
