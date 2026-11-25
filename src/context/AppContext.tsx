import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, Check, Heart } from 'lucide-react';
import {
  BACKEND_NOT_CONFIGURED_MESSAGE,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabaseClient';
import {
  exchangeAuthCodeForSession,
  fetchSiteSettings,
  fetchUserFavoriteIds,
  getCachedSiteSettings,
  getCurrentSessionProfile,
  isSiteSettingsCacheFresh,
  removeUserFavorite,
  signOutUser,
  verifyEmailOtpTokenHash,
  addUserFavorite,
} from '../lib/supabaseData';
import { parseSupabaseAuthCallbackUrl } from '../lib/authCallback';
import { DEFAULT_SITE_SETTINGS } from '../lib/demoData';
import { initGlobalTapFeedback, LUX_EASE } from '../lib/motion';
import { markSignInPromptShown } from '../lib/prompts';
import type { UserProfile, WebsiteSettings } from '../types/realty';

export type ThemeMode = 'dark' | 'light';

export interface ToastMessage {
  id: number;
  text: string;
  kind?: 'saved' | 'removed' | 'info' | 'error';
}

interface ThemeOrigin {
  x: number;
  y: number;
}

export type AuthModalMode =
  | 'login'
  | 'register'
  | 'forgot'
  | 'recovery'
  | 'verify-sent'
  | 'expired-link';

interface OpenAuthModalOptions {
  notice?: string | null;
  email?: string;
  suppressRedirect?: boolean;
  onSuccess?: () => void;
}

interface AppContextValue {
  theme: ThemeMode;
  toggleTheme: (origin?: ThemeOrigin | React.MouseEvent<HTMLElement>) => void;
  user: UserProfile | null;
  authLoading: boolean;
  settings: WebsiteSettings | null;
  favoriteIds: string[];
  authModalOpen: boolean;
  authModalMode: AuthModalMode;
  authModalNotice: string | null;
  authModalInitialEmail: string;
  pendingAuthRedirect: string | null;
  clearPendingAuthRedirect: () => void;
  navDrawerOpen: boolean;
  setNavDrawerOpen: (open: boolean) => void;
  firstVisitPromptOpen: boolean;
  setFirstVisitPromptOpen: (open: boolean) => void;
  openAuthModal: (mode?: AuthModalMode, options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
  consumeAuthSuccessOverride: () => { suppressRedirect: boolean; onSuccess?: () => void };
  refreshUser: () => Promise<UserProfile | null>;
  refreshSettings: () => Promise<void>;
  toggleFavorite: (propertyId: string) => Promise<void>;
  showToast: (text: string, kind?: ToastMessage['kind']) => void;
  logout: () => Promise<void>;
  ownerViewingWebsite: boolean;
  enterOwnerWebsiteView: () => void;
  exitOwnerWebsiteView: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const prefersReduced = useReducedMotion();
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem('debmalya_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [transitionOverlay, setTransitionOverlay] = useState<{
    color: string;
    x: number;
    y: number;
  } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [settings, setSettings] = useState<WebsiteSettings | null>(
    () => getCachedSiteSettings() ?? DEFAULT_SITE_SETTINGS
  );
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('register');
  const [authModalNotice, setAuthModalNotice] = useState<string | null>(null);
  const [authModalInitialEmail, setAuthModalInitialEmail] = useState('');
  const [pendingAuthRedirect, setPendingAuthRedirect] = useState<string | null>(null);
  const authCallbackStartedRef = useRef(false);
  const authSuccessOverrideRef = useRef<{
    suppressRedirect: boolean;
    onSuccess?: () => void;
  }>({ suppressRedirect: false });
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [firstVisitPromptOpen, setFirstVisitPromptOpen] = useState(false);
  const [ownerViewingWebsite, setOwnerViewingWebsite] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem('dr_owner_viewing_website') === '1';
    } catch {
      return false;
    }
  });

  const enterOwnerWebsiteView = useCallback(() => {
    try {
      window.sessionStorage.setItem('dr_owner_viewing_website', '1');
    } catch {
      // ignore storage errors
    }
    setOwnerViewingWebsite(true);
  }, []);

  const exitOwnerWebsiteView = useCallback(() => {
    try {
      window.sessionStorage.removeItem('dr_owner_viewing_website');
    } catch {
      // ignore storage errors
    }
    setOwnerViewingWebsite(false);
  }, []);

  useEffect(() => {
    return initGlobalTapFeedback();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.backgroundColor = '#16201B';
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = '#F7F4EE';
    }
    try {
      localStorage.setItem('debmalya_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const showToast = useCallback(
    (text: string, kind: ToastMessage['kind'] = 'info') => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-2), { id, text, kind }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    []
  );

  const toggleTheme = useCallback(
    (origin?: ThemeOrigin | React.MouseEvent<HTMLElement>) => {
      const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
      const isReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (isReduced) {
        setTheme(next);
        return;
      }

      let x = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
      let y = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

      if (origin && 'currentTarget' in origin && origin.currentTarget) {
        const rect = origin.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else if (origin && 'x' in origin && typeof origin.x === 'number') {
        x = origin.x;
        y = origin.y;
      }

      const savedScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => {
          ready: Promise<void>;
          finished: Promise<void>;
        };
      };

      if (typeof doc.startViewTransition === 'function') {
        const endRadius = Math.ceil(
          Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
          )
        );

        document.documentElement.classList.add('theme-transitioning');
        const vt = doc.startViewTransition(() => {
          flushSync(() => {
            if (next === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            setTheme(next);
          });
          if (window.scrollY !== savedScrollY) {
            window.scrollTo(0, savedScrollY);
          }
        });

        vt.finished
          .finally(() => {
            document.documentElement.classList.remove('theme-transitioning');
          })
          .catch(() => {});

        vt.ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: 620,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)',
              }
            );
          })
          .catch(() => {});
      } else {
        setTransitionOverlay({
          color: next === 'dark' ? '#16201B' : '#F7F4EE',
          x,
          y,
        });
        setTimeout(() => {
          setTheme(next);
          if (window.scrollY !== savedScrollY) {
            window.scrollTo(0, savedScrollY);
          }
        }, 220);
        setTimeout(() => {
          setTransitionOverlay(null);
        }, 680);
      }
    },
    [theme]
  );

  const refreshSettings = useCallback(async () => {
    try {
      const next = await fetchSiteSettings({ force: !isSiteSettingsCacheFresh() });
      setSettings(next);
    } catch {
      // keep existing settings cleanly
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured || !supabase) {
      setUser(null);
      setFavoriteIds([]);
      setAuthLoading(false);
      return null;
    }

    setAuthLoading(true);
    try {
      const profile = await getCurrentSessionProfile();
      setUser(profile);
      if (profile) {
        markSignInPromptShown();
        setFirstVisitPromptOpen(false);
        const favIds = await fetchUserFavoriteIds(profile.id);
        setFavoriteIds(favIds);
      } else {
        setFavoriteIds([]);
      }
      return profile;
    } catch {
      setUser(null);
      setFavoriteIds([]);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSettings();

    const handleInitialAuthCallback = async () => {
      if (authCallbackStartedRef.current) return;
      authCallbackStartedRef.current = true;

      if (typeof window === 'undefined') {
        await refreshUser();
        return;
      }

      const parsed = parseSupabaseAuthCallbackUrl(
        window.location.pathname,
        window.location.search,
        window.location.hash
      );

      if (parsed.kind === 'none') {
        await refreshUser();
        return;
      }

      if (parsed.kind === 'expired') {
        window.history.replaceState({}, '', parsed.cleanPath);
        await refreshUser();
        setAuthModalNotice(
          'Your verification link has expired or is no longer valid. Enter your email below to resend a fresh link.'
        );
        setAuthModalMode('expired-link');
        setAuthModalOpen(true);
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        window.history.replaceState({}, '', parsed.cleanPath);
        await refreshUser();
        return;
      }

      if (parsed.kind === 'recovery') {
        try {
          if (parsed.flow === 'token_hash' && parsed.tokenHash) {
            await verifyEmailOtpTokenHash(parsed.tokenHash, 'recovery');
          } else {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session && parsed.flow === 'pkce' && parsed.code) {
              await exchangeAuthCodeForSession(parsed.code);
            }
          }
          window.history.replaceState({}, '', parsed.cleanPath);
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            setAuthModalNotice(null);
            setAuthModalMode('recovery');
            setAuthModalOpen(true);
          } else {
            setAuthModalNotice(
              'This password reset link has expired or is no longer valid. Request a new reset link below.'
            );
            setAuthModalMode('forgot');
            setAuthModalOpen(true);
          }
        } catch {
          window.history.replaceState({}, '', parsed.cleanPath);
          setAuthModalNotice(
            'This password reset link has expired or is no longer valid. Request a new reset link below.'
          );
          setAuthModalMode('forgot');
          setAuthModalOpen(true);
        }
        await refreshUser();
        return;
      }

      // parsed.kind === 'verification'
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session && parsed.flow === 'token_hash' && parsed.tokenHash) {
          const otpType =
            parsed.otpType === 'email' || parsed.otpType === 'magiclink'
              ? parsed.otpType
              : 'signup';
          await verifyEmailOtpTokenHash(parsed.tokenHash, otpType);
          const next = await supabase.auth.getSession();
          session = next.data.session;
        } else if (!session && parsed.flow === 'pkce' && parsed.code) {
          await exchangeAuthCodeForSession(parsed.code);
          const next = await supabase.auth.getSession();
          session = next.data.session;
        }

        window.history.replaceState({}, '', parsed.cleanPath);

        if (session?.user) {
          const profile = await refreshUser();
          showToast('Email verified. Welcome!', 'info');
          setAuthModalOpen(false);
          let pendingReview = false;
          try {
            pendingReview =
              window.sessionStorage.getItem('dr_pending_review_after_auth') === '1';
          } catch {
            pendingReview = false;
          }
          if (pendingReview) {
            setPendingAuthRedirect('/#reviews');
          } else if (profile?.role === 'owner') {
            exitOwnerWebsiteView();
            setPendingAuthRedirect('/owner-dashboard');
          } else {
            setPendingAuthRedirect('/my-account');
          }
        } else {
          await refreshUser();
          setAuthModalNotice(
            'Your verification link has expired or is no longer valid. Enter your email below to resend a fresh link.'
          );
          setAuthModalMode('expired-link');
          setAuthModalOpen(true);
        }
      } catch {
        window.history.replaceState({}, '', parsed.cleanPath);
        await refreshUser();
        setAuthModalNotice(
          'Your verification link has expired or is no longer valid. Enter your email below to resend a fresh link.'
        );
        setAuthModalMode('expired-link');
        setAuthModalOpen(true);
      }
    };

    void handleInitialAuthCallback();

    if (!isSupabaseConfigured || !supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModalNotice(null);
        setAuthModalMode('recovery');
        setAuthModalOpen(true);
      } else if (event === 'SIGNED_OUT') {
        exitOwnerWebsiteView();
        setUser(null);
        setFavoriteIds([]);
        setAuthLoading(false);
      } else if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        void refreshUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSettings, refreshUser, exitOwnerWebsiteView, showToast]);

  const openAuthModal = useCallback(
    (mode: AuthModalMode = 'register', options?: OpenAuthModalOptions) => {
      markSignInPromptShown();
      setFirstVisitPromptOpen(false);
      setAuthModalNotice(options?.notice ?? null);
      if (options?.email !== undefined) {
        setAuthModalInitialEmail(options.email);
      }
      authSuccessOverrideRef.current = {
        suppressRedirect: Boolean(options?.suppressRedirect),
        onSuccess: options?.onSuccess,
      };
      setAuthModalMode(mode);
      setAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalNotice(null);
    authSuccessOverrideRef.current = { suppressRedirect: false };
  }, []);

  const consumeAuthSuccessOverride = useCallback(() => {
    const current = authSuccessOverrideRef.current;
    authSuccessOverrideRef.current = { suppressRedirect: false };
    return current;
  }, []);

  const clearPendingAuthRedirect = useCallback(() => {
    setPendingAuthRedirect(null);
  }, []);

  const toggleFavorite = useCallback(
    async (propertyId: string) => {
      if (!isSupabaseConfigured) {
        showToast(BACKEND_NOT_CONFIGURED_MESSAGE, 'error');
        return;
      }
      if (!user) {
        openAuthModal('login');
        return;
      }

      const isFav = favoriteIds.includes(propertyId);
      if (isFav) {
        setFavoriteIds((prev) => prev.filter((id) => id !== propertyId));
        try {
          await removeUserFavorite(user.id, propertyId);
          showToast('Removed from saved properties', 'removed');
        } catch (err) {
          setFavoriteIds((prev) => [...prev, propertyId]);
          showToast(
            err instanceof Error ? err.message : 'Unable to update saved properties.',
            'error'
          );
        }
      } else {
        setFavoriteIds((prev) => [...prev, propertyId]);
        try {
          await addUserFavorite(user.id, propertyId);
          showToast('Saved to your properties', 'saved');
        } catch (err) {
          setFavoriteIds((prev) => prev.filter((id) => id !== propertyId));
          showToast(
            err instanceof Error ? err.message : 'Unable to save property.',
            'error'
          );
        }
      }
    },
    [user, favoriteIds, openAuthModal, showToast]
  );

  const logout = useCallback(async () => {
    try {
      await signOutUser();
      exitOwnerWebsiteView();
      setUser(null);
      setFavoriteIds([]);
      showToast('Signed out', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to sign out.',
        'error'
      );
    }
  }, [showToast, exitOwnerWebsiteView]);

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        user,
        authLoading,
        settings,
        favoriteIds,
        authModalOpen,
        authModalMode,
        authModalNotice,
        authModalInitialEmail,
        pendingAuthRedirect,
        clearPendingAuthRedirect,
        navDrawerOpen,
        setNavDrawerOpen,
        firstVisitPromptOpen,
        setFirstVisitPromptOpen,
        openAuthModal,
        closeAuthModal,
        consumeAuthSuccessOverride,
        refreshUser,
        refreshSettings,
        toggleFavorite,
        showToast,
        logout,
        ownerViewingWebsite,
        enterOwnerWebsiteView,
        exitOwnerWebsiteView,
      }}
    >
      {children}

      {transitionOverlay && (
        <div
          aria-hidden="true"
          className="theme-circle-overlay"
          style={
            {
              backgroundColor: transitionOverlay.color,
              '--reveal-x': `${transitionOverlay.x}px`,
              '--reveal-y': `${transitionOverlay.y}px`,
            } as React.CSSProperties
          }
        />
      )}

      {/* Soft fading editorial toast notifications at top */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+4.6rem)] inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              onClick={() =>
                setToasts((prev) => prev.filter((item) => item.id !== toast.id))
              }
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: LUX_EASE }}
              className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-[var(--shadow-elevated)] text-sm font-medium max-w-md text-center cursor-pointer"
            >
              {toast.kind === 'saved' ? (
                <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400 shrink-0" />
              ) : toast.kind === 'removed' ? (
                <Heart className="w-3.5 h-3.5 text-[var(--bg-canvas)]/75 shrink-0" />
              ) : toast.kind === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
