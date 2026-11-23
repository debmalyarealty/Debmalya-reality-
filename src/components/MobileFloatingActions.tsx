import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const MobileFloatingActions: React.FC = () => {
  const { settings, authModalOpen, navDrawerOpen } = useApp();
  const { pathname } = useLocation();
  const [formFocused, setFormFocused] = useState(false);
  const [modalOpenInDom, setModalOpenInDom] = useState(false);
  const [overlappingSensitiveRegion, setOverlappingSensitiveRegion] =
    useState(false);

  useEffect(() => {
    const isFormField = (el: EventTarget | null) =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement;

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

    const checkOverlayAndModals = () => {
      const openDialog = document.querySelector(
        '[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])'
      );
      setModalOpenInDom(Boolean(openDialog));

      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const floatingTop = vh - 84;
      const floatingLeft = vw - 136;
      const targets = Array.from(
        document.querySelectorAll(
          'footer, form:not([data-allow-floating="true"]), [role="dialog"]:not([aria-hidden="true"]), [data-no-floating-overlap="true"], button[type="submit"]'
        )
      );
      const anyBlocking = targets.some((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const overlapsY = rect.bottom > floatingTop && rect.top < vh;
        if (!overlapsY) return false;
        if (el.matches('button[type="submit"]')) {
          return rect.right > floatingLeft && rect.left < vw;
        }
        return true;
      });
      setOverlappingSensitiveRegion(anyBlocking);
    };

    checkOverlayAndModals();
    window.addEventListener('scroll', checkOverlayAndModals, { passive: true });
    window.addEventListener('resize', checkOverlayAndModals, { passive: true });
    const mut = new MutationObserver(() => checkOverlayAndModals());
    mut.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'open'],
    });

    return () => {
      window.removeEventListener('scroll', checkOverlayAndModals);
      window.removeEventListener('resize', checkOverlayAndModals);
      mut.disconnect();
    };
  }, [pathname]);

  const isPrivatePortal =
    pathname.startsWith('/owner-dashboard') ||
    pathname.startsWith('/owner-login') ||
    pathname.startsWith('/my-account');

  if (
    isPrivatePortal ||
    navDrawerOpen ||
    authModalOpen ||
    modalOpenInDom ||
    formFocused ||
    overlappingSensitiveRegion
  ) {
    return null;
  }

  const phone = settings?.phone || '+91 86498 58954';
  const whatsapp = (settings?.whatsapp || '918649858954').replace(/[^\d]/g, '');

  return (
    <div
      className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] right-[calc(env(safe-area-inset-right,0px)+1rem)] z-30 flex items-center gap-2.5"
      aria-label="Quick Contact Actions"
    >
      <a
        href={`tel:${phone.replace(/\s+/g, '')}`}
        aria-label={`Call Debmalya Realty at ${phone}`}
        title={`Call ${phone}`}
        className="w-12 h-12 rounded-full bg-[var(--bg-surface)]/95 border border-[var(--btn-secondary-border)] backdrop-blur-xl shadow-[var(--shadow-elevated)] text-[var(--btn-secondary-text)] inline-flex items-center justify-center transition-transform active:scale-95"
      >
        <Phone className="w-5 h-5 text-[var(--accent-primary)]" />
      </a>
      <a
        href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
          'Hello Debmalya Realty, I would like to enquire about properties in Siliguri.'
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp with Debmalya Realty"
        title="WhatsApp"
        className="w-12 h-12 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] shadow-[var(--shadow-elevated)] text-[var(--cta-gold-ink)] inline-flex items-center justify-center transition-all active:scale-95"
      >
        <MessageCircle className="w-5 h-5" />
      </a>
    </div>
  );
};
