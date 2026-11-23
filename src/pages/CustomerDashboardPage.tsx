import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  Calendar,
  Check,
  ClipboardList,
  Globe,
  Home,
  Loader2,
  LogOut,
  Settings,
  Star,
  Trash2,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  fetchClientDashboardData,
  fetchPublicProperties,
  getCachedClientDashboardData,
  getCachedPublicProperties,
  isClientDashboardCacheFresh,
  isPublicPropertiesCacheFresh,
  removeSavedSearchById,
  saveUserPreferences,
  submitInquiry,
  updateOwnProfile,
  type ClientDashboardData,
} from '../lib/supabaseData';
import {
  buildSearchQueryString,
  formatINR,
  formatReviewDate,
  savedSearchToFilters,
} from '../lib/realtyLogic';
import { navigateWithTransition } from '../lib/motion';
import { applyDocumentMeta, buildSiteMetaTags } from '../lib/metaTags';
import type {
  Booking,
  CustomerPreferences,
  Inquiry,
  Property,
  Review,
  SavedSearch,
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

export const CustomerDashboardPage: React.FC = () => {
  const {
    user,
    authLoading,
    settings,
    refreshUser,
    showToast,
    logout,
  } = useApp();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    mapClientTab(searchParams.get('tab'))
  );

  const initialCached =
    user?.role === 'client' ? getCachedClientDashboardData(user.id) : null;

  const [favorites, setFavorites] = useState<Property[]>(
    initialCached?.favorites ?? []
  );
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(
    initialCached?.savedSearches ?? []
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
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

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

  // Quick message form on Home (starts empty with friendly validation)
  const [qInterest, setQInterest] = useState('');
  const [qMsg, setQMsg] = useState('');
  const [qError, setQError] = useState<string | null>(null);
  const [sendingInq, setSendingInq] = useState(false);

  useEffect(() => {
    const activeMeta = CLIENT_TABS.find((t) => t.key === activeTab);
    applyDocumentMeta(
      buildSiteMetaTags({
        title: `${activeMeta?.label || 'Home'} — My Account`,
        pathname: '/my-account',
        robots: 'noindex, nofollow',
        image: settings?.hero_image_url,
        siteName: settings?.business_name,
      })
    );
  }, [settings, activeTab]);

  useEffect(() => {
    setActiveTab(mapClientTab(searchParams.get('tab')));
  }, [searchParams]);

  const applyClientData = (dashboardData: ClientDashboardData) => {
    setFavorites(dashboardData.favorites);
    setSavedSearches(dashboardData.savedSearches);
    setBookings(dashboardData.bookings);
    setInquiries(dashboardData.inquiries);
    setReviews(dashboardData.reviews);
    setPrefs(dashboardData.preferences);
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
        err instanceof Error ? err.message : 'Unable to load your account details.'
      );
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'client') {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setCity(user.city || '');
      const cached = getCachedClientDashboardData(user.id);
      if (cached) {
        applyClientData(cached);
        setLoadingData(false);
      }
      if (
        !cached ||
        !isClientDashboardCacheFresh(user.id) ||
        !isPublicPropertiesCacheFresh()
      ) {
        void loadClientData(user.id, false);
      }
    } else if (!authLoading) {
      setLoadingData(false);
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <main className="fluid-container pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
        <div className="h-64 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] animate-pulse" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role === 'owner') {
    return <Navigate to="/owner-dashboard" replace />;
  }

  const switchTab = (key: TabKey) => {
    setActiveTab(key);
    if (key === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: key }, { replace: true });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackStep = () => {
    switchTab('overview');
  };

  const applySavedSearch = (saved: SavedSearch) => {
    const qs = buildSearchQueryString(savedSearchToFilters(saved));
    navigateWithTransition(navigate, `/properties${qs}`);
  };

  const removeSavedSearch = async (id: string) => {
    const prev = savedSearches;
    setSavedSearches((list) => list.filter((s) => s.id !== id));
    try {
      await removeSavedSearchById(user.id, id);
      showToast('Saved search removed', 'removed');
    } catch (err) {
      setSavedSearches(prev);
      showToast(
        err instanceof Error ? err.message : 'Unable to remove saved search.',
        'error'
      );
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setProfileError('Please enter your full name.');
      return;
    }
    setProfileError(null);
    setSavingProfile(true);
    try {
      await updateOwnProfile(user.id, { full_name: fullName, phone, city });
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

  const handlePrefsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const saved = await saveUserPreferences(user.id, prefs);
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

  const handleQuickInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qInterest.trim()) {
      setQError('Please choose what you need help with.');
      return;
    }
    if (!qMsg.trim()) {
      setQError('Please write a short message before sending.');
      return;
    }
    setQError(null);
    setSendingInq(true);
    try {
      await submitInquiry({
        user_id: user.id,
        name: user.full_name || fullName || 'Client',
        phone: user.phone || phone || '',
        email: user.email,
        interest: qInterest,
        message: qMsg,
      });
      setQInterest('');
      setQMsg('');
      showToast('Message sent', 'saved');
      await loadClientData(user.id, true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to send message.',
        'error'
      );
    } finally {
      setSendingInq(false);
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

  return (
    <main className="fluid-container pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] lg:pb-16 min-h-[80vh] overflow-x-clip">
      {activeTab !== 'overview' && (
        <div className="mb-4">
          <BackButton label="Back" onClick={handleBackStep} />
        </div>
      )}

      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[var(--border-hairline)]">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.65rem,4vw,2.25rem)] font-semibold text-[var(--text-primary)] break-anywhere">
            Welcome, {user.full_name || 'Friend'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 break-anywhere">
            {user.email}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="min-h-[44px] px-4 py-2 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Globe className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>View website</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/', { replace: true });
            }}
            className="min-h-[44px] px-4 py-2 rounded-full border border-[var(--border-hairline)] text-[13px] font-medium text-[var(--text-primary)] hover:border-rose-500 hover:text-rose-500 inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
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

              {/* Saved Searches Quick Access */}
              <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                      Saved searches
                    </h2>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                      Quickly re-open your saved property filters.
                    </p>
                  </div>
                  <Link
                    to="/properties"
                    className="min-h-[44px] px-4 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5"
                  >
                    <span>Browse properties</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {savedSearches.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No saved searches yet. Tap &ldquo;Save search&rdquo; when filtering listings on Browse properties.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {savedSearches.slice(0, 3).map((saved) => (
                      <div
                        key={saved.id}
                        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {saved.name}
                          </p>
                          <p className="text-[13px] text-[var(--text-muted)] tabular-nums mt-0.5">
                            Saved {formatReviewDate(saved.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => applySavedSearch(saved)}
                            className="btn-primary-lux min-h-[44px] px-4 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Apply filters</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeSavedSearch(saved.id)}
                            aria-label={`Remove saved search ${saved.name}`}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Quick Message */}
              <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-4">
                <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                  Ask Debmalya Realty
                </h2>
                <form onSubmit={handleQuickInquiry} noValidate className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      aria-label="Topic"
                      value={qInterest}
                      onChange={(e) => {
                        setQInterest(e.target.value);
                        setQError(null);
                      }}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                    >
                      <option value="">Choose a topic *</option>
                      <option value="Property Buying">Buying a home or plot</option>
                      <option value="Property Selling">Selling a property</option>
                      <option value="Rental Services">Renting a place</option>
                      <option value="Construction & Development">Construction help</option>
                      <option value="Site Visit & Estimate">Site visit or estimate</option>
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Write what you are looking for in Siliguri..."
                    value={qMsg}
                    onChange={(e) => {
                      setQMsg(e.target.value);
                      setQError(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                  />
                  {qError && (
                    <p role="alert" className="text-[13px] font-medium text-rose-500">
                      {qError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={sendingInq}
                    className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {sendingInq && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{sendingInq ? 'Sending...' : 'Send message'}</span>
                  </button>
                </form>
              </section>
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
                <div className="space-y-3">
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
                <div className="space-y-3">
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
                <div className="space-y-3">
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
                  My saved properties
                </h2>
                <Link
                  to="/properties"
                  className="min-h-[44px] px-4 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5"
                >
                  <span>Browse properties</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {favorites.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center space-y-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    You have not saved any properties yet. Tap the heart icon on any listing to save it here.
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
                <div className="fluid-grid-cards">
                  {favorites.map((p) => (
                    <PropertyCard key={p.id} property={p} />
                  ))}
                </div>
              )}

              {savedSearches.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[var(--border-hairline)]">
                  <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                    Saved searches ({savedSearches.length})
                  </h3>
                  <div className="space-y-2.5">
                    {savedSearches.map((saved) => (
                      <div
                        key={saved.id}
                        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {saved.name}
                          </p>
                          <p className="text-[13px] text-[var(--text-muted)] tabular-nums">
                            Saved {new Date(saved.created_at).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => applySavedSearch(saved)}
                            className="min-h-[44px] px-4 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Apply filters</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeSavedSearch(saved.id)}
                            aria-label={`Remove saved search ${saved.name}`}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. MY PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                    My profile
                  </h2>
                </div>

                <form onSubmit={handleProfileSave} noValidate className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                      Full name *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setProfileError(null);
                      }}
                      className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] ${
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
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        Phone or WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        City
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
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
                </form>
              </div>

              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                    What kind of property are you looking for?
                  </h2>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1">
                    Save your preferences so recommended properties match what you want.
                  </p>
                </div>

                <form onSubmit={handlePrefsSave} className="space-y-4 max-w-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        Preferred area
                      </label>
                      <select
                        value={prefs.preferred_location}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            preferred_location: e.target.value,
                          }))
                        }
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
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
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        Property category
                      </label>
                      <select
                        value={prefs.property_type}
                        onChange={(e) =>
                          setPrefs((p) => ({ ...p, property_type: e.target.value }))
                        }
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
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
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        For sale / For rent
                      </label>
                      <select
                        value={prefs.listing_type}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            listing_type: e.target.value as 'Buy' | 'Rent' | 'Both',
                          }))
                        }
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                      >
                        <option value="Buy">For sale</option>
                        <option value="Rent">For rent</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        Min budget (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prefs.min_budget ?? ''}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            min_budget: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        placeholder={formatINR(2500000)}
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        Max budget (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prefs.max_budget ?? ''}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            max_budget: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        placeholder={formatINR(8000000)}
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        Min bedrooms
                      </label>
                      <select
                        value={prefs.min_bedrooms ?? ''}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            min_bedrooms: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
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
                      className="min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {savingPrefs && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{savingPrefs ? 'Saving...' : 'Save preferences'}</span>
                    </button>
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
                        navigateWithTransition(navigate, `/properties${qs}`);
                      }}
                      className="min-h-[44px] px-4 rounded-full border border-[var(--border-hairline)] hover:border-[var(--border-strong)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>Browse properties</span>
                      <ArrowRight className="w-4 h-4 text-[var(--accent-primary)]" />
                    </button>
                  </div>
                </form>
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
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-6 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/96 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)] px-[env(safe-area-inset-left,0px)]"
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
    </main>
  );
};
