import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Calendar,
  Check,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Home,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Settings,
  Star,
  User,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';
import {
  fetchClientDashboardData,
  fetchPublicProperties,
  getCachedClientDashboardData,
  getCachedPublicProperties,
  isClientDashboardCacheFresh,
  isPublicPropertiesCacheFresh,
  ownerSetClientPassword,
  saveUserPreferences,
  updateOwnPassword,
  updateOwnProfile,
  type ClientDashboardData,
} from '../lib/supabaseData';
import {
  generateTemporaryPassword,
  validateNewPassword,
} from '../lib/adminHelpers';
import { LUX_EASE } from '../lib/motion';
import {
  buildSearchQueryString,
  formatINR,
  formatReviewDate,
} from '../lib/realtyLogic';
import { applyDocumentMeta, buildSiteMetaTags } from '../lib/metaTags';
import { useKeyboardSafeForm } from '../lib/formKeyboard';
import type {
  Booking,
  CustomerPreferences,
  Inquiry,
  Property,
  Review,
  UserProfile,
} from '../types/realty';
import { PropertyCard } from '../components/PropertyCard';
import { BackButton } from '../components/BackButton';

type TabKey =
  | 'overview'
  | 'bookings'
  | 'inquiries'
  | 'reviews'
  | 'saved'
  | 'profile';

const CLIENT_TABS: {
  key: TabKey;
  mobileLabel: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { key: 'overview', mobileLabel: 'Home', label: 'Home', Icon: Home },
  { key: 'bookings', mobileLabel: 'Visits', label: 'My visit requests', Icon: Calendar },
  { key: 'inquiries', mobileLabel: 'Enquiries', label: 'My enquiries', Icon: ClipboardList },
  { key: 'reviews', mobileLabel: 'Reviews', label: 'My reviews', Icon: Star },
  { key: 'saved', mobileLabel: 'Saved', label: 'My saved properties', Icon: Bookmark },
  { key: 'profile', mobileLabel: 'Profile', label: 'My profile', Icon: Settings },
];

function mapClientTab(raw: string | null): TabKey {
  if (raw === 'preferences' || raw === 'recommended') return 'profile';
  if (raw === 'searches') return 'saved';
  if (raw && CLIENT_TABS.some((t) => t.key === raw)) {
    return raw as TabKey;
  }
  return 'overview';
}

function friendlyVisitStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'cancelled') return 'Cancelled';
  return 'Waiting confirmation';
}

function friendlyEnquiryStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === 'contacted') return 'Contacted';
  if (s === 'closed') return 'Done';
  return 'New';
}

function friendlyReviewStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === 'approved') return 'Approved on website';
  if (s === 'rejected') return 'Not approved';
  return 'Waiting approval';
}

function badgeToneClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'confirmed' || s === 'approved' || s === 'contacted' || s === 'closed') {
    return 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  }
  if (s === 'cancelled' || s === 'rejected') {
    return 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/30';
  }
  return 'bg-[var(--bg-surface-muted)] text-[var(--accent-primary)] border-[var(--border-hairline)]';
}

export interface CustomerDashboardPageProps {
  viewedProfile?: UserProfile;
  isOwnerViewing?: boolean;
  onBackToClients?: () => void;
}

export const CustomerDashboardPage: React.FC<CustomerDashboardPageProps> = ({
  viewedProfile,
  isOwnerViewing = false,
  onBackToClients,
}) => {
  const {
    user,
    authLoading,
    settings,
    openAuthModal,
    refreshUser,
    showToast,
    logout,
  } = useApp();
  const navigate = useNavigate();
  const prefersReduced = !!useReducedMotion();
  const manualSignOutRef = useRef(false);
  const promptedDashboardAuthRef = useRef(false);

  const isOwnerMode = Boolean(
    isOwnerViewing && viewedProfile && user?.role === 'owner'
  );
  const targetProfile = isOwnerMode ? viewedProfile! : user;

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    isOwnerMode ? 'overview' : mapClientTab(searchParams.get('tab'))
  );

  const initialCached =
    targetProfile && (isOwnerMode || targetProfile.role === 'client')
      ? getCachedClientDashboardData(targetProfile.id)
      : null;

  const [favorites, setFavorites] = useState<Property[]>(
    initialCached?.favorites ?? []
  );
  const [bookings, setBookings] = useState<Booking[]>(
    initialCached?.bookings ?? []
  );
  const [inquiries, setInquiries] = useState<Inquiry[]>(
    initialCached?.inquiries ?? []
  );
  const [reviews, setReviews] = useState<Review[]>(
    initialCached?.reviews ?? []
  );
  const [loadingData, setLoadingData] = useState(!initialCached);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Profile form
  const profileFormRef = useRef<HTMLFormElement>(null);
  const prefsFormRef = useRef<HTMLFormElement>(null);
  const passwordFormRef = useRef<HTMLFormElement>(null);
  const { keyboardOpen: profileKeyboardOpen } = useKeyboardSafeForm(profileFormRef);
  const { keyboardOpen: prefsKeyboardOpen } = useKeyboardSafeForm(prefsFormRef);
  const { keyboardOpen: passwordKeyboardOpen } = useKeyboardSafeForm(passwordFormRef);
  const [fullName, setFullName] = useState(targetProfile?.full_name || '');
  const [phone, setPhone] = useState(targetProfile?.phone || '');
  const [city, setCity] = useState(targetProfile?.city || '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  // Client self-service Change Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savedPassword, setSavedPassword] = useState(false);

  // Owner "Set new password" state (Edge Function + confirmation + one-time reveal)
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPasswordInput, setShowAdminPasswordInput] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null);
  const [confirmAdminPasswordOpen, setConfirmAdminPasswordOpen] = useState(false);
  const [settingAdminPassword, setSettingAdminPassword] = useState(false);
  const [oneTimeRevealedPassword, setOneTimeRevealedPassword] = useState<string | null>(null);
  const [copiedOneTimePw, setCopiedOneTimePw] = useState(false);

  // Preferences form
  const [prefs, setPrefs] = useState<CustomerPreferences>(
    initialCached?.preferences ?? {
      preferred_location: 'All',
      property_type: 'All',
      listing_type: 'Buy',
      min_budget: null,
      max_budget: null,
      min_bedrooms: null,
      notes: '',
      notify_matches: true,
    }
  );
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  useEffect(() => {
    const activeMeta = CLIENT_TABS.find((t) => t.key === activeTab);
    if (isOwnerMode && viewedProfile) {
      const displayName =
        viewedProfile.full_name || viewedProfile.email || 'Client';
      applyDocumentMeta(
        buildSiteMetaTags({
          title: `${displayName} (${activeMeta?.mobileLabel || 'Home'}) — Owner Dashboard`,
          pathname: '/owner-dashboard',
          robots: 'noindex, nofollow',
        })
      );
      return;
    }
    applyDocumentMeta(
      buildSiteMetaTags({
        title: `${activeMeta?.label || 'Home'} — My Account`,
        pathname: '/my-account',
        robots: 'noindex, nofollow',
        image: settings?.hero_image_url,
        siteName: settings?.business_name,
      })
    );
  }, [settings, activeTab, isOwnerMode, viewedProfile]);

  useEffect(() => {
    if (!isOwnerMode) {
      setActiveTab(mapClientTab(searchParams.get('tab')));
    }
  }, [searchParams, isOwnerMode]);

  useEffect(() => {
    if (isOwnerMode) {
      setActiveTab('overview');
      setAdminPasswordInput('');
      setAdminPasswordError(null);
      setConfirmAdminPasswordOpen(false);
      setOneTimeRevealedPassword(null);
      setCopiedOneTimePw(false);
    }
  }, [isOwnerMode, viewedProfile?.id]);

  const applyClientData = (dashboardData: ClientDashboardData) => {
    setFavorites(Array.isArray(dashboardData?.favorites) ? dashboardData.favorites : []);
    setBookings(Array.isArray(dashboardData?.bookings) ? dashboardData.bookings : []);
    setInquiries(Array.isArray(dashboardData?.inquiries) ? dashboardData.inquiries : []);
    setReviews(Array.isArray(dashboardData?.reviews) ? dashboardData.reviews : []);
    if (dashboardData?.preferences) {
      setPrefs(dashboardData.preferences);
    }
  };

  const loadClientData = async (uid: string, force = false) => {
    const hasCached = Boolean(getCachedClientDashboardData(uid));
    if (!hasCached) {
      setLoadingData(true);
    }
    setLoadError(null);
    try {
      const [dashboardData] = await Promise.all([
        fetchClientDashboardData(uid, { force }),
        fetchPublicProperties({ force }),
      ]);
      applyClientData(dashboardData);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load account details.'
      );
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (targetProfile && (isOwnerMode || targetProfile.role === 'client')) {
      setFullName(targetProfile.full_name || '');
      setPhone(targetProfile.phone || '');
      setCity(targetProfile.city || '');
      const cached = getCachedClientDashboardData(targetProfile.id);
      if (cached) {
        applyClientData(cached);
        setLoadingData(false);
      }
      if (
        isOwnerMode ||
        !cached ||
        !isClientDashboardCacheFresh(targetProfile.id) ||
        !isPublicPropertiesCacheFresh()
      ) {
        void loadClientData(targetProfile.id, isOwnerMode);
      }
    } else if (!authLoading) {
      setLoadingData(false);
    }
  }, [targetProfile?.id, isOwnerMode, authLoading]);

  useEffect(() => {
    if (
      !authLoading &&
      !user &&
      !isOwnerMode &&
      !manualSignOutRef.current &&
      !promptedDashboardAuthRef.current
    ) {
      promptedDashboardAuthRef.current = true;
      openAuthModal('login', {
        notice: 'Sign in to open your client dashboard',
        suppressRedirect: true,
      });
    }
    if (user) {
      promptedDashboardAuthRef.current = false;
      manualSignOutRef.current = false;
    }
  }, [authLoading, user, isOwnerMode, openAuthModal]);

  if (authLoading) {
    return (
      <main className="fluid-container pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
        <div className="h-64 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] animate-pulse" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="fluid-container pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] min-h-[75svh] flex items-center justify-center">
        <div className="max-w-md w-full rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-[clamp(1.5rem,4vw,2rem)] shadow-[var(--shadow-subtle)] text-center space-y-4">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
            Client dashboard
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            Sign in or create a free account to view your saved properties, site visit requests, and enquiries.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={() =>
                openAuthModal('login', {
                  notice: 'Sign in to open your client dashboard',
                  suppressRedirect: true,
                })
              }
              className="btn-primary-lux flex-1 min-h-[48px] px-5 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold cursor-pointer"
            >
              Sign in / Create account
            </button>
            <Link
              to="/"
              className="min-h-[48px] px-5 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] text-sm font-medium inline-flex items-center justify-center"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!isOwnerMode && user.role === 'owner') {
    return <Navigate to="/owner-dashboard" replace />;
  }

  if (!targetProfile) {
    return null;
  }

  const clientDisplayName =
    targetProfile.full_name || targetProfile.email || 'Client';

  const switchTab = (key: TabKey) => {
    setActiveTab(key);
    if (!isOwnerMode) {
      if (key === 'overview') {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ tab: key }, { replace: true });
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackStep = () => {
    if (isOwnerMode && activeTab === 'overview') {
      onBackToClients?.();
      return;
    }
    switchTab('overview');
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwnerMode) return;
    if (!fullName.trim()) {
      setProfileError('Please enter your full name.');
      return;
    }
    setProfileError(null);
    setSavingProfile(true);
    try {
      await updateOwnProfile(targetProfile.id, { full_name: fullName, phone, city });
      await refreshUser();
      setSavedProfile(true);
      window.setTimeout(() => setSavedProfile(false), 3000);
      showToast('Saved', 'saved');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to save profile.',
        'error'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOwnPasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwnerMode) return;
    const validationErr = validateNewPassword(newPassword, confirmPassword);
    if (validationErr) {
      setPasswordError(validationErr);
      return;
    }
    setPasswordError(null);
    setSavingPassword(true);
    try {
      await updateOwnPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setSavedPassword(true);
      window.setTimeout(() => setSavedPassword(false), 3000);
      showToast('Password updated', 'saved');
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Could not update password. Please try again.';
      setPasswordError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRequestAdminSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerMode) return;
    const validationErr = validateNewPassword(adminPasswordInput);
    if (validationErr) {
      setAdminPasswordError(validationErr);
      return;
    }
    setAdminPasswordError(null);
    setConfirmAdminPasswordOpen(true);
  };

  const handleConfirmAdminSetPassword = async () => {
    if (!isOwnerMode || !targetProfile) return;
    const validationErr = validateNewPassword(adminPasswordInput);
    if (validationErr) {
      setAdminPasswordError(validationErr);
      setConfirmAdminPasswordOpen(false);
      return;
    }
    const candidate = adminPasswordInput;
    setSettingAdminPassword(true);
    try {
      await ownerSetClientPassword(targetProfile.id, candidate);
      setConfirmAdminPasswordOpen(false);
      setAdminPasswordInput('');
      setShowAdminPasswordInput(false);
      setAdminPasswordError(null);
      setCopiedOneTimePw(false);
      setOneTimeRevealedPassword(candidate);
      showToast(`New password set for ${clientDisplayName}`, 'saved');
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Could not update password. Please try again.';
      setConfirmAdminPasswordOpen(false);
      setAdminPasswordError(msg);
      showToast(msg, 'error');
    } finally {
      setSettingAdminPassword(false);
    }
  };

  const handleCopyOneTimePassword = async () => {
    if (!oneTimeRevealedPassword) return;
    try {
      await navigator.clipboard.writeText(oneTimeRevealedPassword);
      setCopiedOneTimePw(true);
      showToast('Password copied — share it with the client safely', 'saved');
    } catch {
      showToast('Please copy the password manually.', 'info');
    }
  };

  const handlePrefsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwnerMode) return;
    setSavingPrefs(true);
    try {
      const saved = await saveUserPreferences(targetProfile.id, prefs);
      setPrefs(saved);
      setSavedPrefs(true);
      window.setTimeout(() => setSavedPrefs(false), 3000);
      showToast('Saved', 'saved');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to save preferences.',
        'error'
      );
    } finally {
      setSavingPrefs(false);
    }
  };

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

  const OuterTag = isOwnerMode ? 'div' : 'main';
  const outerClass = isOwnerMode
    ? 'min-h-[70svh] overflow-x-clip'
    : 'fluid-container pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] lg:pb-16 min-h-[80svh] overflow-x-clip';

  return (
    <OuterTag className={outerClass}>
      {isOwnerMode ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
          <BackButton
            label="Back"
            onClick={() => {
              setOneTimeRevealedPassword(null);
              onBackToClients?.();
            }}
            className="min-h-[48px]"
          />
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[13px] font-semibold text-[var(--accent-primary)] max-w-full truncate">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Viewing {clientDisplayName}</span>
          </span>
        </div>
      ) : (
        activeTab !== 'overview' && (
          <div className="mb-4">
            <BackButton label="Back" onClick={handleBackStep} />
          </div>
        )
      )}

      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[var(--border-hairline)]">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.65rem,4vw,2.25rem)] font-semibold text-[var(--text-primary)] break-anywhere">
            {isOwnerMode
              ? clientDisplayName
              : `Welcome, ${targetProfile.full_name || 'Friend'}`}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 break-anywhere">
            {targetProfile.email || 'No email on file'}
            {isOwnerMode && targetProfile.phone ? ` · ${targetProfile.phone}` : ''}
            {isOwnerMode && targetProfile.city ? ` · ${targetProfile.city}` : ''}
          </p>
        </div>

        {!isOwnerMode && (
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-h-[48px] px-4 py-2 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Globe className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <span>View website</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                manualSignOutRef.current = true;
                await logout();
                navigate('/', { replace: true });
              }}
              className="min-h-[48px] px-4 py-2 rounded-full border border-[var(--border-hairline)] text-[13px] font-medium text-[var(--text-primary)] hover:border-rose-500 hover:text-rose-500 inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>

      <div className="lg:flex lg:items-start lg:gap-8">
        {/* Desktop Sticky Left Sidebar Navigation */}
        <nav
          aria-label="Account sections"
          className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 lg:sticky lg:top-24 gap-1.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3"
        >
          {CLIENT_TABS.map(({ key, label, Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key)}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                  active
                    ? 'bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          {loadError && (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-500 break-anywhere"
            >
              {loadError}
            </div>
          )}

          {loadingData ? (
            <div className="space-y-4">
              <div className="fluid-grid-stats">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] animate-pulse"
                  />
                ))}
              </div>
              <div className="h-48 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] animate-pulse" />
            </div>
          ) : (
            <>
              {/* 1. HOME */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="fluid-grid-stats">
                {[
                  {
                    label: 'Visit requests',
                    val: bookings.length,
                    onClick: () => switchTab('bookings'),
                  },
                  {
                    label: 'Enquiries',
                    val: inquiries.length,
                    onClick: () => switchTab('inquiries'),
                  },
                  {
                    label: 'Reviews',
                    val: reviews.length,
                    onClick: () => switchTab('reviews'),
                  },
                  {
                    label: 'Saved homes',
                    val: favorites.length,
                    onClick: () => switchTab('saved'),
                  },
                ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={c.onClick}
                      className="lux-card-hover text-left rounded-2xl border border-[var(--border-hairline)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-subtle)] transition-colors cursor-pointer"
                    >
                      <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                        {c.label}
                      </p>
                      <p className="font-display text-3xl sm:text-4xl font-semibold tabular-nums text-[var(--text-primary)] mt-1.5 leading-none">
                        {c.val}
                      </p>
                    </button>
                ))}
                  </div>
                </div>
              )}

          {/* 2. MY VISIT REQUESTS */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
                My visit requests
              </h2>
              {bookings.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center space-y-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    You have not requested any site visits yet. Open any property listing to pick a date and time.
                  </p>
                  <Link
                    to="/properties"
                    className="inline-flex min-h-[44px] items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold"
                  >
                    <span>Browse properties</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {b.property_slug ? (
                          <Link
                            to={`/properties/${b.property_slug}`}
                            className="text-base font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)] min-w-0 break-anywhere"
                          >
                            {b.property_title}
                          </Link>
                        ) : (
                          <h3 className="text-base font-semibold text-[var(--text-primary)] min-w-0 break-anywhere">
                            {b.property_title}
                          </h3>
                        )}
                        <span
                          className={`px-3 py-1 rounded-full border text-[13px] font-semibold shrink-0 ${badgeToneClass(
                            b.status
                          )}`}
                        >
                          {friendlyVisitStatus(b.status)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] tabular-nums">
                        Requested time: {b.preferred_date} at {b.preferred_time}
                      </p>
                      {b.note && (
                        <p className="text-[13px] text-[var(--text-muted)] break-anywhere">
                          Your note: {b.note}
                        </p>
                      )}
                      {b.owner_note && (
                        <p className="text-sm text-[var(--text-primary)] pt-2 border-t border-[var(--border-hairline)] break-anywhere">
                          Reply from team: {b.owner_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. MY ENQUIRIES */}
          {activeTab === 'inquiries' && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
                My enquiries
              </h2>
              {inquiries.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center space-y-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    You have not sent any property enquiries yet.
                  </p>
                  <Link
                    to="/properties"
                    className="inline-flex min-h-[44px] items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold"
                  >
                    <span>Browse properties</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-[var(--text-primary)] min-w-0 break-anywhere">
                          {inq.property_title || inq.interested_in}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full border text-[13px] font-semibold shrink-0 ${badgeToneClass(
                            inq.status
                          )}`}
                        >
                          {friendlyEnquiryStatus(inq.status)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] break-anywhere">
                        {inq.message}
                      </p>
                      {inq.owner_notes && (
                        <p className="text-sm text-[var(--text-primary)] pt-2 border-t border-[var(--border-hairline)] break-anywhere">
                          Reply from team: {inq.owner_notes}
                        </p>
                      )}
                      <p className="text-[13px] text-[var(--text-muted)] tabular-nums">
                        Sent {formatReviewDate(inq.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. MY REVIEWS AND STATUS */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
                My reviews
              </h2>
              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center space-y-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    You have not shared a review yet.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link
                      to="/#reviews"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/#reviews');
                        window.setTimeout(() => {
                          document
                            .getElementById('reviews')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }, 120);
                      }}
                      className="btn-primary-lux inline-flex min-h-[44px] items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold"
                    >
                      <span>Write a review</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/properties"
                      className="inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border-input)] text-sm font-medium text-[var(--text-primary)]"
                    >
                      <span>Browse properties</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-subtle)] space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 ${
                                s <= rev.rating
                                  ? 'fill-[var(--accent-secondary)] text-[var(--accent-secondary)]'
                                  : 'text-[var(--border-input)]'
                              }`}
                            />
                          ))}
                          <span className="ml-2 text-[13px] text-[var(--text-muted)]">
                            {rev.customer_type}
                          </span>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full border text-[13px] font-semibold shrink-0 ${badgeToneClass(
                            rev.status
                          )}`}
                        >
                          {friendlyReviewStatus(rev.status)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed break-anywhere">
                        &ldquo;{rev.review_text}&rdquo;
                      </p>
                      <p className="text-[13px] text-[var(--text-muted)] tabular-nums">
                        Submitted {formatReviewDate(rev.review_date || rev.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. MY SAVED PROPERTIES */}
          {activeTab === 'saved' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
                  {isOwnerMode ? 'Saved properties' : 'My saved properties'}
                </h2>
                {!isOwnerMode && (
                  <Link
                    to="/properties"
                    className="min-h-[48px] px-4 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5"
                  >
                    <span>Browse properties</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {favorites.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center space-y-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    {isOwnerMode
                      ? 'This client has not saved any properties yet.'
                      : 'You have not saved any properties yet. Tap the heart icon on any listing to save it here.'}
                  </p>
                  {!isOwnerMode && (
                    <Link
                      to="/properties"
                      className="inline-flex min-h-[48px] items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold"
                    >
                      <span>Browse properties</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="fluid-grid-cards">
                  {favorites.map((p) => (
                    <PropertyCard
                      key={p.id}
                      property={p}
                      hideFavoriteButton={isOwnerMode}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6. MY PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-[var(--accent-primary)]" />
                    <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                      {isOwnerMode ? 'Client profile' : 'My profile'}
                    </h2>
                  </div>
                  {targetProfile.created_at && (
                    <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
                      Joined {formatReviewDate(targetProfile.created_at)}
                    </span>
                  )}
                </div>

                {isOwnerMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Full name</p>
                      <p className="text-base font-medium text-[var(--text-primary)] mt-0.5 break-anywhere">
                        {targetProfile.full_name || 'Not added'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Email</p>
                      <p className="text-base font-medium text-[var(--text-primary)] mt-0.5 break-anywhere">
                        {targetProfile.email || 'Not added'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Phone or WhatsApp</p>
                      <p className="text-base font-medium text-[var(--text-primary)] mt-0.5 tabular-nums">
                        {targetProfile.phone || 'Not added'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">City</p>
                      <p className="text-base font-medium text-[var(--text-primary)] mt-0.5">
                        {targetProfile.city || 'Siliguri'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <form ref={profileFormRef} onSubmit={handleProfileSave} noValidate className="space-y-4 max-w-lg">
                    <div>
                      <label
                        htmlFor="cust-full-name"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        Full name *
                      </label>
                      <input
                        id="cust-full-name"
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          setProfileError(null);
                        }}
                        className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] scroll-mt-24 scroll-mb-24 ${
                          profileError ? 'border-rose-500' : 'border-[var(--border-hairline)]'
                        }`}
                      />
                      {profileError && (
                        <p role="alert" className="mt-1.5 text-[13px] font-medium text-rose-500">
                          {profileError}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="cust-phone"
                          className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                        >
                          Phone or WhatsApp
                        </label>
                        <input
                          id="cust-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums scroll-mt-24 scroll-mb-24"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="cust-city"
                          className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                        >
                          City
                        </label>
                        <input
                          id="cust-city"
                          type="text"
                          autoComplete="address-level2"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] scroll-mt-24 scroll-mb-24"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="btn-primary-lux min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 scroll-mt-24 scroll-mb-24"
                      >
                        {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{savingProfile ? 'Saving...' : 'Save profile'}</span>
                      </button>
                      {savedProfile && (
                        <span className="text-sm font-semibold text-emerald-500 inline-flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Saved
                        </span>
                      )}
                    </div>
                    <div aria-hidden="true" className={profileKeyboardOpen ? 'h-[32dvh]' : 'hidden'} />
                  </form>
                )}
              </div>

              {/* Password Management (Client: Change password | Owner viewing client: Set new password) */}
              {isOwnerMode ? (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5">
                  <div className="flex items-start gap-2.5">
                    <KeyRound className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-1" />
                    <div>
                      <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                        Set new password
                      </h2>
                      <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                        Create a new sign-in password for {clientDisplayName}. It is never stored in plain text and will only be shown once after confirmation so you can share it directly.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleRequestAdminSetPassword}
                    noValidate
                    className="space-y-4 max-w-lg"
                  >
                    <div>
                      <label
                        htmlFor="owner-set-client-password"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        New password (minimum 8 characters)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="owner-set-client-password"
                          type={showAdminPasswordInput ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={adminPasswordInput}
                          onChange={(e) => {
                            setAdminPasswordInput(e.target.value);
                            setAdminPasswordError(null);
                          }}
                          placeholder="Enter or generate a new password"
                          className={`w-full min-h-[48px] pl-3.5 pr-12 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] ${
                            adminPasswordError
                              ? 'border-rose-500'
                              : 'border-[var(--border-hairline)]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPasswordInput((v) => !v)}
                          aria-label={
                            showAdminPasswordInput
                              ? 'Hide password'
                              : 'Show password'
                          }
                          className="absolute right-0 top-0 h-[48px] w-[48px] inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          {showAdminPasswordInput ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {adminPasswordError && (
                        <p
                          role="alert"
                          className="mt-1.5 text-[13px] font-medium text-rose-500"
                        >
                          {adminPasswordError}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="submit"
                        disabled={settingAdminPassword}
                        className="btn-primary-lux min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Set new password</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAdminPasswordInput(generateTemporaryPassword(12));
                          setShowAdminPasswordInput(true);
                          setAdminPasswordError(null);
                        }}
                        className="min-h-[48px] px-4 py-2 rounded-full border border-[var(--border-hairline)] hover:border-[var(--border-strong)] bg-[var(--bg-canvas)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span>Generate</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5">
                  <div className="flex items-start gap-2.5">
                    <KeyRound className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-1" />
                    <div>
                      <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                        Change password
                      </h2>
                      <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                        Choose a strong password with at least 8 characters.
                      </p>
                    </div>
                  </div>

                  <form
                    ref={passwordFormRef}
                    onSubmit={handleOwnPasswordSave}
                    noValidate
                    className="space-y-4 max-w-lg"
                  >
                    <div>
                      <label
                        htmlFor="cust-new-password"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        New password
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="cust-new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          placeholder="Minimum 8 characters"
                          className={`w-full min-h-[48px] pl-3.5 pr-12 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] scroll-mt-24 scroll-mb-24 ${
                            passwordError
                              ? 'border-rose-500'
                              : 'border-[var(--border-hairline)]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          aria-label={
                            showNewPassword
                              ? 'Hide new password'
                              : 'Show new password'
                          }
                          className="absolute right-0 top-0 h-[48px] w-[48px] inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="cust-confirm-password"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        Confirm new password
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="cust-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          placeholder="Re-enter new password"
                          className={`w-full min-h-[48px] pl-3.5 pr-12 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] scroll-mt-24 scroll-mb-24 ${
                            passwordError
                              ? 'border-rose-500'
                              : 'border-[var(--border-hairline)]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          aria-label={
                            showConfirmPassword
                              ? 'Hide confirm password'
                              : 'Show confirm password'
                          }
                          className="absolute right-0 top-0 h-[48px] w-[48px] inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {passwordError && (
                      <p
                        role="alert"
                        className="text-[13px] font-medium text-rose-500"
                      >
                        {passwordError}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="btn-primary-lux min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 scroll-mt-24 scroll-mb-24"
                      >
                        {savingPassword && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        <span>
                          {savingPassword ? 'Updating...' : 'Change password'}
                        </span>
                      </button>
                      {savedPassword && (
                        <span className="text-sm font-semibold text-emerald-500 inline-flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Updated
                        </span>
                      )}
                    </div>
                    <div
                      aria-hidden="true"
                      className={passwordKeyboardOpen ? 'h-[32dvh]' : 'hidden'}
                    />
                  </form>
                </div>
              )}

              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                    {isOwnerMode
                      ? 'Client property preferences'
                      : 'What kind of property are you looking for?'}
                  </h2>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1">
                    {isOwnerMode
                      ? 'Saved preferences chosen by this client.'
                      : 'Save your preferences so recommended properties match what you want.'}
                  </p>
                </div>

                {isOwnerMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-2xl">
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Preferred area</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                        {prefs.preferred_location === 'All' ? 'Any Siliguri area' : prefs.preferred_location}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Property category</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                        {prefs.property_type === 'All' ? 'Any category' : prefs.property_type}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Looking for</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                        {prefs.listing_type === 'Buy'
                          ? 'For sale'
                          : prefs.listing_type === 'Rent'
                          ? 'For rent'
                          : 'Both'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Min budget</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                        {prefs.min_budget ? formatINR(prefs.min_budget) : 'No minimum'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Max budget</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                        {prefs.max_budget ? formatINR(prefs.max_budget) : 'No limit'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">Min bedrooms</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                        {prefs.min_bedrooms ? `${prefs.min_bedrooms}+ BHK` : 'Any'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <form ref={prefsFormRef} onSubmit={handlePrefsSave} className="space-y-4 max-w-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="pref-area"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        Preferred area
                      </label>
                      <select
                        id="pref-area"
                        value={prefs.preferred_location}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            preferred_location: e.target.value,
                          }))
                        }
                        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] scroll-mt-24 scroll-mb-24"
                      >
                        <option value="All">Any Siliguri area</option>
                        {locations.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="pref-category"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        Property category
                      </label>
                      <select
                        id="pref-category"
                        value={prefs.property_type}
                        onChange={(e) =>
                          setPrefs((p) => ({ ...p, property_type: e.target.value }))
                        }
                        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] scroll-mt-24 scroll-mb-24"
                      >
                        <option value="All">Any category</option>
                        {propertyTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="pref-listing"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        For sale / For rent
                      </label>
                      <select
                        id="pref-listing"
                        value={prefs.listing_type}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            listing_type: e.target.value as 'Buy' | 'Rent' | 'Both',
                          }))
                        }
                        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] scroll-mt-24 scroll-mb-24"
                      >
                        <option value="Buy">For sale</option>
                        <option value="Rent">For rent</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="pref-min-budget"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        Min budget (₹)
                      </label>
                      <input
                        id="pref-min-budget"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={prefs.min_budget ?? ''}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            min_budget: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        placeholder={formatINR(2500000)}
                        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums scroll-mt-24 scroll-mb-24"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pref-max-budget"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        Max budget (₹)
                      </label>
                      <input
                        id="pref-max-budget"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={prefs.max_budget ?? ''}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            max_budget: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        placeholder={formatINR(8000000)}
                        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums scroll-mt-24 scroll-mb-24"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pref-min-bedrooms"
                        className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5"
                      >
                        Min bedrooms
                      </label>
                      <select
                        id="pref-min-bedrooms"
                        value={prefs.min_bedrooms ?? ''}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            min_bedrooms: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] scroll-mt-24 scroll-mb-24"
                      >
                        <option value="">Any</option>
                        <option value="1">1+ BHK</option>
                        <option value="2">2+ BHK</option>
                        <option value="3">3+ BHK</option>
                        <option value="4">4+ BHK</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={savingPrefs}
                      className="min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 scroll-mt-24 scroll-mb-24"
                    >
                      {savingPrefs && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{savingPrefs ? 'Saving...' : 'Save preferences'}</span>
                    </button>
                    <div aria-hidden="true" className={prefsKeyboardOpen ? 'h-[32dvh] w-full' : 'hidden'} />
                    {savedPrefs && (
                      <span className="text-sm font-semibold text-emerald-500 inline-flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Saved
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const qs = buildSearchQueryString({
                          location: prefs.preferred_location,
                          propertyType: prefs.property_type,
                          listingType:
                            prefs.listing_type === 'Both'
                              ? 'All'
                              : prefs.listing_type,
                          minPrice: prefs.min_budget ?? '',
                          maxPrice: prefs.max_budget ?? '',
                          minBedrooms: prefs.min_bedrooms ?? '',
                        });
                        navigate(`/properties${qs}`);
                      }}
                      className="min-h-[44px] px-4 rounded-full border border-[var(--border-hairline)] hover:border-[var(--border-strong)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>Browse properties</span>
                      <ArrowRight className="w-4 h-4 text-[var(--accent-primary)]" />
                    </button>
                  </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </>
      )}
        </div>
      </div>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Client mobile tabs"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-6 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/96 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
      >
        {CLIENT_TABS.map(({ key, mobileLabel, Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`min-h-[58px] min-w-0 px-0.5 py-2 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                active
                  ? 'text-[var(--accent-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[clamp(0.6875rem,2.7vw,0.8125rem)] tracking-[-0.015em] leading-none truncate max-w-full">
                {mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Confirmation Sheet for Owner Setting Client Password */}
      <AnimatePresence>
        {confirmAdminPasswordOpen && isOwnerMode && (
          <motion.div
            key="admin-set-pw-confirm-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm setting new client password"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: LUX_EASE }}
            onClick={() => {
              if (!settingAdminPassword) setConfirmAdminPasswordOpen(false);
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div
              key="admin-set-pw-confirm-sheet"
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: 0.24, ease: LUX_EASE }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-elevated)] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--bg-tint)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                    Set new password?
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1 break-anywhere">
                    Replace the login password for {clientDisplayName}? Their old password will stop working immediately.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={settingAdminPassword}
                  onClick={() => setConfirmAdminPasswordOpen(false)}
                  className="min-h-[48px] px-4 rounded-full border border-[var(--border-hairline)] text-sm font-medium text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={settingAdminPassword}
                  onClick={() => void handleConfirmAdminSetPassword()}
                  className="min-h-[48px] px-5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {settingAdminPassword && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>{settingAdminPassword ? 'Updating...' : 'Confirm'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One-time Password Reveal Sheet (never persisted anywhere) */}
      <AnimatePresence>
        {oneTimeRevealedPassword && isOwnerMode && (
          <motion.div
            key="admin-set-pw-reveal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="New client password"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: LUX_EASE }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div
              key="admin-set-pw-reveal-sheet"
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: 0.24, ease: LUX_EASE }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-elevated)] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4"
            >
              <div className="space-y-1">
                <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                  Password updated
                </h3>
                <p className="text-sm text-[var(--text-secondary)] break-anywhere">
                  Share this password with {clientDisplayName} now. It is shown once and will not be saved or displayed again.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-4 py-3 flex items-center justify-between gap-2">
                <code className="font-mono text-base font-semibold text-[var(--text-primary)] select-all break-anywhere">
                  {oneTimeRevealedPassword}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyOneTimePassword()}
                  className="min-h-[48px] px-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedOneTimePw ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-[var(--accent-primary)]" />
                  )}
                  <span>{copiedOneTimePw ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOneTimeRevealedPassword(null);
                    setCopiedOneTimePw(false);
                  }}
                  className="w-full min-h-[48px] px-5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OuterTag>
  );
};
