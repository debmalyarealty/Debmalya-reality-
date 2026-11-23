import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  GripVertical,
  Heart,
  Home,
  Loader2,
  LogOut,
  MessageCircle,
  Moon,
  Phone,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  fetchOwnerDashboardData,
  getCachedOwnerDashboardData,
  isOwnerDashboardCacheFresh,
  ownerDeleteProperty,
  ownerDeleteReview,
  ownerDeleteTeamMember,
  ownerSaveProperty,
  ownerSaveSiteSettings,
  ownerSaveTeamMember,
  ownerTogglePropertyPublished,
  ownerToggleTeamMemberVisibility,
  ownerUpdateBooking,
  ownerUpdateInquiry,
  ownerUpdateReview,
  uploadStorageImage,
  type OwnerDashboardData,
} from '../lib/supabaseData';
import {
  buildEnquiriesCsv,
  convertAreaInputToSqFt,
  formatAreaKatha,
  formatINRReadable,
  formatRelativeTimeAgo,
  formatReviewDate,
  SQFT_PER_KATHA,
  type AreaUnit,
} from '../lib/realtyLogic';
import { DEFAULT_SERVICES, DEFAULT_SITE_SETTINGS } from '../lib/demoData';
import {
  buildPropertyImageAlt,
  compressImageForUpload,
  formatFileSize,
  makeItemFirst,
  MAX_PROPERTY_PHOTOS,
  reorderItems,
} from '../lib/imageUtils';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LUX_EASE } from '../lib/motion';
import { applyDocumentMeta, buildSiteMetaTags } from '../lib/metaTags';
import { BackendNotice } from '../components/BackendNotice';
import { BackButton } from '../components/BackButton';
import { PropertyImage } from '../components/PropertyImage';
import type {
  Agent,
  Booking,
  BookingStatus,
  Inquiry,
  InquiryStatus,
  OwnerDashboardStats,
  Property,
  PropertyStatus,
  Review,
  UserProfile,
  WebsiteSettings,
} from '../types/realty';

type OwnerTab = 'overview' | 'properties' | 'inquiries' | 'reviews' | 'settings';
type UnifiedEnquiryStatus = 'new' | 'contacted' | 'done';
type PropertyWizardStep = 1 | 2 | 3 | 4;

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

const OWNER_TABS: {
  key: OwnerTab;
  label: string;
  titleLabel: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { key: 'overview', label: 'Home', titleLabel: 'Home', Icon: Home },
  {
    key: 'properties',
    label: 'Properties',
    titleLabel: 'Properties',
    Icon: Building2,
  },
  {
    key: 'inquiries',
    label: 'Enquiries',
    titleLabel: 'Enquiries',
    Icon: ClipboardList,
  },
  { key: 'reviews', label: 'Reviews', titleLabel: 'Reviews', Icon: Star },
  { key: 'settings', label: 'Settings', titleLabel: 'Settings', Icon: Settings },
];

const DEFAULT_AMENITY_OPTIONS = [
  'Lift',
  'Power backup',
  'Security',
  'Parking',
  'Water supply',
  'CCTV',
  'Modular kitchen',
  'Balcony',
  'Garden',
  'Gym',
  'Visitor parking',
  'Intercom',
];

const REVIEW_ASKED_STORAGE_KEY = 'dr_owner_review_asked';

function mapRawTab(raw: string | null): OwnerTab {
  if (raw === 'bookings') return 'inquiries';
  if (raw === 'team' || raw === 'clients') return 'settings';
  if (raw && OWNER_TABS.some((t) => t.key === raw)) {
    return raw as OwnerTab;
  }
  return 'overview';
}

function formatWaHref(phone: string | undefined, text: string): string | null {
  const digits = (phone || '').replace(/[^\d]/g, '');
  if (digits.length < 10) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

function inquiryToUnified(status: InquiryStatus): UnifiedEnquiryStatus {
  if (status === 'contacted') return 'contacted';
  if (status === 'closed') return 'done';
  return 'new';
}

function unifiedToInquiry(status: UnifiedEnquiryStatus): InquiryStatus {
  if (status === 'contacted') return 'contacted';
  if (status === 'done') return 'closed';
  return 'new';
}

function bookingToUnified(status: BookingStatus): UnifiedEnquiryStatus {
  if (status === 'confirmed') return 'contacted';
  if (status === 'cancelled') return 'done';
  return 'new';
}

function unifiedToBooking(status: UnifiedEnquiryStatus): BookingStatus {
  if (status === 'contacted') return 'confirmed';
  if (status === 'done') return 'cancelled';
  return 'pending';
}

function unifiedLabel(status: UnifiedEnquiryStatus): string {
  if (status === 'contacted') return 'Contacted';
  if (status === 'done') return 'Done';
  return 'New';
}

function unifiedChipStyle(status: UnifiedEnquiryStatus, active: boolean): string {
  if (status === 'new') {
    return active
      ? 'bg-amber-500/18 text-amber-800 dark:text-amber-300 border-amber-500/50'
      : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-amber-500/40';
  }
  if (status === 'contacted') {
    return active
      ? 'bg-sky-500/18 text-sky-800 dark:text-sky-300 border-sky-500/50'
      : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-sky-500/40';
  }
  return active
    ? 'bg-emerald-500/18 text-emerald-800 dark:text-emerald-300 border-emerald-500/50'
    : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-emerald-500/40';
}

function reviewStatusChipStyle(status: string): string {
  const s = status.toLowerCase();
  if (s === 'approved') {
    return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40';
  }
  if (s === 'rejected') {
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40';
  }
  return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40';
}

const SwitchControl: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="min-h-[44px] inline-flex items-center gap-2.5 cursor-pointer disabled:opacity-60 text-left"
  >
    <span
      aria-hidden="true"
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ${
        checked
          ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)]'
          : 'bg-[var(--bg-surface-muted)] border-[var(--border-input)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full transition-transform duration-200 shadow-xs ${
          checked
            ? 'translate-x-5 bg-[var(--cta-gold-ink)]'
            : 'translate-x-1 bg-[var(--text-secondary)]'
        }`}
      />
    </span>
    <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
  </button>
);

export const OwnerDashboardPage: React.FC = () => {
  const {
    user,
    authLoading,
    theme,
    toggleTheme,
    settings: appSettings,
    logout,
    refreshSettings,
    showToast,
    enterOwnerWebsiteView,
    exitOwnerWebsiteView,
  } = useApp();
  const navigate = useNavigate();
  const prefersReduced = !!useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCached =
    user?.role === 'owner' ? getCachedOwnerDashboardData(user.id) : null;

  const [tab, setTab] = useState<OwnerTab>(() => mapRawTab(searchParams.get('tab')));
  const [loading, setLoading] = useState(!initialCached);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [stats, setStats] = useState<OwnerDashboardStats | null>(
    initialCached?.stats ?? null
  );
  const [properties, setProperties] = useState<Property[]>(
    initialCached?.properties ?? []
  );
  const [favoriteCounts, setFavoriteCounts] = useState<Record<string, number>>(
    initialCached?.favoriteCounts ?? {}
  );
  const [inquiries, setInquiries] = useState<Inquiry[]>(
    initialCached?.inquiries ?? []
  );
  const [bookings, setBookings] = useState<Booking[]>(
    initialCached?.bookings ?? []
  );
  const [reviews, setReviews] = useState<Review[]>(
    initialCached?.reviews ?? []
  );
  const [agents, setAgents] = useState<Agent[]>(
    initialCached?.agents ?? []
  );
  const [clients, setClients] = useState<UserProfile[]>(
    initialCached?.clients ?? []
  );
  const [siteSettings, setSiteSettings] = useState<WebsiteSettings | null>(
    initialCached?.settings ?? null
  );

  // Filters & search
  const [enqFilter, setEnqFilter] = useState<'all' | UnifiedEnquiryStatus>('all');
  const [enqSearch, setEnqSearch] = useState('');
  const [revFilter, setRevFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all');

  // Quick copy feedback states
  const [reviewAskCopied, setReviewAskCopied] = useState(false);
  const [copiedPropId, setCopiedPropId] = useState<string | null>(null);
  const [reviewAskedRecorded, setReviewAskedRecorded] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(REVIEW_ASKED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Step-by-step Property Wizard State
  const [editingPropId, setEditingPropId] = useState<string | null>(null);
  const [showPropForm, setShowPropForm] = useState(false);
  const [propStep, setPropStep] = useState<PropertyWizardStep>(1);
  const [propStepError, setPropStepError] = useState<string | null>(null);
  const [propFieldErrors, setPropFieldErrors] = useState<
    Record<string, string>
  >({});
  const [publishedConfirmation, setPublishedConfirmation] = useState<{
    title: string;
    slug: string;
    isPublished: boolean;
  } | null>(null);

  const [pImages, setPImages] = useState<string[]>([]);
  const [pTitle, setPTitle] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pListingType, setPListingType] = useState<'' | 'Buy' | 'Rent'>('');
  const [pType, setPType] = useState('');
  const [pBeds, setPBeds] = useState('');
  const [pBaths, setPBaths] = useState('');
  const [pArea, setPArea] = useState('');
  const [pAreaUnit, setPAreaUnit] = useState<AreaUnit>('sqft');
  const [pFurnishing, setPFurnishing] = useState('');
  const [pParking, setPParking] = useState('');
  const [pAmenities, setPAmenities] = useState<string[]>([]);
  const [customAmenityInput, setCustomAmenityInput] = useState('');
  const [showCustomAmenity, setShowCustomAmenity] = useState(false);
  const [pLocation, setPLocation] = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pStatus, setPStatus] = useState<'' | PropertyStatus>('');
  const [pDesc, setPDesc] = useState('');
  const [pPublished, setPPublished] = useState(true);
  const [pFeatured, setPFeatured] = useState(false);

  const [uploadingImg, setUploadingImg] = useState(false);
  const [propUploadProgress, setPropUploadProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
    phase: 'compressing' | 'uploading';
  } | null>(null);
  const [propCompressionNote, setPropCompressionNote] = useState<string | null>(
    null
  );
  const [propUploadError, setPropUploadError] = useState<string | null>(null);
  const [dragPhotoIdx, setDragPhotoIdx] = useState<number | null>(null);
  const [dragOverPhotoIdx, setDragOverPhotoIdx] = useState<number | null>(null);
  const [savingProp, setSavingProp] = useState(false);

  // Team Member Form State
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [aName, setAName] = useState('');
  const [aPos, setAPos] = useState('');
  const [aBio, setABio] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aWhatsapp, setAWhatsapp] = useState('');
  const [aPhoto, setAPhoto] = useState('');
  const [aVisible, setAVisible] = useState(true);
  const [teamUploading, setTeamUploading] = useState(false);
  const [teamCompressionNote, setTeamCompressionNote] = useState<string | null>(
    null
  );
  const [teamUploadError, setTeamUploadError] = useState<string | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamSavedMsg, setTeamSavedMsg] = useState(false);

  // Website Photos (compressed WebP + immediate DB persistence)
  const [photoSlotBusy, setPhotoSlotBusy] = useState<Record<string, boolean>>(
    {}
  );
  const [photoSlotStats, setPhotoSlotStats] = useState<
    Record<
      string,
      { before: number; after: number; saved: boolean } | undefined
    >
  >({});
  const [photoSlotError, setPhotoSlotError] = useState<
    Record<string, string | undefined>
  >({});

  // Settings Editable List Helpers & Save Confirmation State
  const [newLocationInput, setNewLocationInput] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [savingSettingsSection, setSavingSettingsSection] = useState<
    null | 'contact' | 'text' | 'social' | 'googleReview'
  >(null);
  const [savedSection, setSavedSection] = useState<
    null | 'contact' | 'text' | 'social' | 'googleReview'
  >(null);

  useEffect(() => {
    setTab(mapRawTab(searchParams.get('tab')));
  }, [searchParams]);

  useEffect(() => {
    const activeTabMeta = OWNER_TABS.find((t) => t.key === tab);
    const sectionPrefix =
      tab === 'properties' && showPropForm
        ? editingPropId
          ? 'Edit property'
          : 'Add property'
        : activeTabMeta?.titleLabel || 'Home';
    applyDocumentMeta(
      buildSiteMetaTags({
        title: `${sectionPrefix} — Owner Dashboard`,
        pathname: '/owner-dashboard',
        robots: 'noindex, nofollow',
      })
    );
  }, [tab, showPropForm, editingPropId]);

  useEffect(() => {
    exitOwnerWebsiteView();
  }, [exitOwnerWebsiteView]);

  useEffect(() => {
    if (!confirmDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmBusy) {
        setConfirmDialog(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDialog, confirmBusy]);

  const applyOwnerData = (data: OwnerDashboardData) => {
    setStats(data.stats);
    setProperties(data.properties);
    setFavoriteCounts(data.favoriteCounts || {});
    setInquiries(data.inquiries);
    setBookings(data.bookings);
    setReviews(data.reviews);
    setAgents(data.agents);
    setClients(data.clients);
    setSiteSettings(data.settings);
  };

  const loadAll = async (force = false) => {
    const hasCached = Boolean(user?.id && getCachedOwnerDashboardData(user.id));
    if (!hasCached && !stats) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const data = await fetchOwnerDashboardData(user?.id, { force });
      applyOwnerData(data);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'owner') {
      const cached = getCachedOwnerDashboardData(user.id);
      if (cached) {
        applyOwnerData(cached);
        setLoading(false);
      }
      if (!cached || !isOwnerDashboardCacheFresh(user.id)) {
        void loadAll(false);
      }
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const combinedEnquiries = useMemo(() => {
    const enqItems = inquiries.map((item) => ({
      kind: 'enquiry' as const,
      id: item.id,
      sortTime: new Date(item.created_at).getTime() || 0,
      createdAt: item.created_at,
      name: item.name,
      email: item.email,
      phone: item.phone,
      subject: item.property_title || item.interested_in,
      visitSchedule: undefined as string | undefined,
      propertySlug: undefined as string | undefined,
      message: item.message,
      note: item.owner_notes || '',
      unifiedStatus: inquiryToUnified(item.status),
    }));

    const visitItems = bookings.map((item) => ({
      kind: 'visit' as const,
      id: item.id,
      sortTime: new Date(item.created_at).getTime() || 0,
      createdAt: item.created_at,
      name: item.customer_name,
      email: item.email,
      phone: item.phone,
      subject: item.property_title || 'Site visit request',
      propertySlug: item.property_slug,
      visitSchedule: `${item.preferred_date} at ${item.preferred_time}`,
      message: item.note,
      note: item.owner_note || '',
      unifiedStatus: bookingToUnified(item.status),
    }));

    return [...enqItems, ...visitItems].sort((a, b) => b.sortTime - a.sortTime);
  }, [inquiries, bookings]);

  const filteredCombinedEnquiries = useMemo(() => {
    const q = enqSearch.trim().toLowerCase();
    return combinedEnquiries.filter((e) => {
      if (enqFilter !== 'all' && e.unifiedStatus !== enqFilter) return false;
      if (!q) return true;
      const hay = `${e.name} ${e.phone} ${e.email} ${e.subject} ${
        e.visitSchedule || ''
      } ${e.message} ${e.note}`.toLowerCase();
      return hay.includes(q);
    });
  }, [combinedEnquiries, enqFilter, enqSearch]);

  const filteredReviews = useMemo(() => {
    if (revFilter === 'all') return reviews;
    return reviews.filter((r) => r.status === revFilter);
  }, [reviews, revFilter]);

  if (authLoading) {
    return (
      <main className="fluid-container pt-[calc(env(safe-area-inset-top,0px)+5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
        <div className="h-64 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] animate-pulse" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== 'owner') {
    return <Navigate to="/my-account" replace />;
  }

  const businessName =
    siteSettings?.business_name || appSettings?.business_name || 'Debmalya Realty';
  const logoUrl = siteSettings?.logo_url || appSettings?.logo_url;
  const availableLocations =
    siteSettings?.locations && siteSettings.locations.length > 0
      ? siteSettings.locations
      : ['Siliguri', 'Sevoke Road', 'Bhanu Nagar', 'Haiderpara', 'Gugni More'];
  const availableCategories =
    siteSettings?.property_types && siteSettings.property_types.length > 0
      ? siteSettings.property_types
      : ['Flats / Apartments', 'Villas', 'Houses', 'Residential Plots', 'Land'];

  const allAmenityChoices = Array.from(
    new Set([...DEFAULT_AMENITY_OPTIONS, ...pAmenities])
  );

  const siteOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';

  const shareWebsiteWaHref = `https://wa.me/?text=${encodeURIComponent(
    `Explore verified flats, houses, plots and construction services in Siliguri with ${businessName}: ${siteOrigin}`
  )}`;

  const switchOwnerTab = (key: OwnerTab) => {
    setTab(key);
    if (key === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: key }, { replace: true });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSettingsSection = (sectionId: string) => {
    switchOwnerTab('settings');
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };

  const handleCopyReviewRequest = async () => {
    const link =
      siteSettings?.google_review_link?.trim() || `${siteOrigin}/#reviews`;
    const msg = `Namaste! Thank you for choosing ${businessName}. If you liked our service, could you take 30 seconds to leave us a review here? ${link}`;
    try {
      await navigator.clipboard.writeText(msg);
      setReviewAskCopied(true);
      setReviewAskedRecorded(true);
      try {
        window.localStorage.setItem(REVIEW_ASKED_STORAGE_KEY, '1');
      } catch {
        // ignore storage restrictions
      }
      window.setTimeout(() => setReviewAskCopied(false), 3000);
      showToast(
        siteSettings?.google_review_link?.trim()
          ? 'Review request message copied — paste it in WhatsApp'
          : 'Copied website review link (you can add your Google link in Settings)',
        'saved'
      );
    } catch {
      showToast('Could not copy automatically. Please copy from Settings.', 'error');
    }
  };

  const handleCopyPropertyShareLink = async (prop: Property) => {
    const url = `${siteOrigin}/properties/${prop.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPropId(prop.id);
      window.setTimeout(() => {
        setCopiedPropId((prev) => (prev === prop.id ? null : prev));
      }, 2600);
      showToast('Property link copied — ready to paste in WhatsApp', 'saved');
    } catch {
      showToast('Could not copy link to clipboard.', 'error');
    }
  };

  const handleDownloadEnquiriesCsv = () => {
    if (filteredCombinedEnquiries.length === 0) {
      showToast('There are no enquiries in this list to download.', 'info');
      return;
    }
    const csv = buildEnquiriesCsv(
      filteredCombinedEnquiries.map((e) => ({
        kind: e.kind === 'visit' ? 'Site Visit' : 'Enquiry',
        name: e.name,
        phone: e.phone,
        email: e.email,
        subject: e.subject,
        schedule: e.visitSchedule || '',
        status: unifiedLabel(e.unifiedStatus),
        message: e.message,
        note: e.note,
        date: formatReviewDate(e.createdAt),
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    showToast('Enquiries CSV downloaded', 'saved');
  };

  const resetTeamForm = () => {
    setEditingTeamId(null);
    setAName('');
    setAPos('');
    setABio('');
    setAPhone('');
    setAWhatsapp('');
    setAPhoto('');
    setAVisible(true);
    setTeamCompressionNote(null);
    setTeamUploadError(null);
  };

  const resetPhotoUploadUi = () => {
    setPropUploadProgress(null);
    setPropCompressionNote(null);
    setPropUploadError(null);
    setDragPhotoIdx(null);
    setDragOverPhotoIdx(null);
  };

  const handleBackStep = () => {
    if (confirmDialog && !confirmBusy) {
      setConfirmDialog(null);
    }
    setShowPropForm(false);
    setEditingPropId(null);
    setPublishedConfirmation(null);
    setPropStepError(null);
    setPropFieldErrors({});
    resetPhotoUploadUi();
    resetTeamForm();
    setEnqFilter('all');
    setEnqSearch('');
    setRevFilter('all');
    switchOwnerTab('overview');
  };

  const handlePropertyPhotosUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPropUploadError(null);
    setPropCompressionNote(null);

    const remainingSlots = MAX_PROPERTY_PHOTOS - pImages.length;
    if (remainingSlots <= 0) {
      const msg = `You already have ${MAX_PROPERTY_PHOTOS} photos on this property. Delete one before adding more.`;
      setPropUploadError(msg);
      showToast(msg, 'error');
      return;
    }

    const incoming = Array.from(files);
    const filesToProcess = incoming.slice(0, remainingSlots);
    const skippedCount = incoming.length - filesToProcess.length;

    setUploadingImg(true);
    let uploadedCount = 0;
    let totalBefore = 0;
    let totalAfter = 0;
    const failures: string[] = [];

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        try {
          setPropUploadProgress({
            current: i + 1,
            total: filesToProcess.length,
            fileName: file.name,
            phase: 'compressing',
          });
          const compressed = await compressImageForUpload(file, {
            maxLongestSide: 1200,
            quality: 0.8,
          });

          setPropUploadProgress({
            current: i + 1,
            total: filesToProcess.length,
            fileName: compressed.file.name,
            phase: 'uploading',
          });
          const url = await uploadStorageImage('property-images', compressed.file);

          setPImages((prev) =>
            prev.length < MAX_PROPERTY_PHOTOS ? [...prev, url] : prev
          );
          uploadedCount += 1;
          totalBefore += compressed.originalBytes;
          totalAfter += compressed.compressedBytes;
        } catch (err) {
          failures.push(
            err instanceof Error
              ? err.message
              : `Could not upload "${file.name}".`
          );
        }
      }

      if (uploadedCount > 0) {
        setPropCompressionNote(
          `${uploadedCount} ${
            uploadedCount === 1 ? 'photo' : 'photos'
          } compressed & uploaded: ${formatFileSize(
            totalBefore
          )} → ${formatFileSize(totalAfter)} WebP`
        );
      }

      if (failures.length > 0 || skippedCount > 0) {
        const warningParts: string[] = [];
        if (skippedCount > 0) {
          warningParts.push(
            `${skippedCount} ${
              skippedCount === 1 ? 'photo was' : 'photos were'
            } skipped because a property can have up to ${MAX_PROPERTY_PHOTOS} photos.`
          );
        }
        if (failures.length > 0) {
          warningParts.push(failures[0]);
          if (failures.length > 1) {
            warningParts.push(`(${failures.length - 1} more failed.)`);
          }
        }
        const combinedMsg = warningParts.join(' ');
        setPropUploadError(combinedMsg);
        showToast(combinedMsg, 'error');
      } else if (uploadedCount > 0) {
        showToast(
          uploadedCount === 1
            ? 'Photo uploaded'
            : `${uploadedCount} photos uploaded`,
          'saved'
        );
      }
    } finally {
      setUploadingImg(false);
      setPropUploadProgress(null);
    }
  };

  const handleTeamPhotoUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setTeamUploadError(null);
    setTeamCompressionNote(null);
    setTeamUploading(true);
    try {
      const compressed = await compressImageForUpload(file, {
        maxLongestSide: 1200,
        quality: 0.8,
      });
      const url = await uploadStorageImage('team-photos', compressed.file);
      setAPhoto(url);
      setTeamCompressionNote(
        `${formatFileSize(compressed.originalBytes)} → ${formatFileSize(
          compressed.compressedBytes
        )} WebP`
      );
      showToast('Team photo uploaded', 'saved');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not upload team member photo. Please try again.';
      setTeamUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setTeamUploading(false);
    }
  };

  const handleReplaceWebsitePhoto = async (
    slotKey: string,
    files: FileList | null,
    maxLongestSide: number,
    applyUrl: (current: WebsiteSettings, url: string) => WebsiteSettings
  ) => {
    const file = files?.[0];
    if (!file || !siteSettings) return;

    setPhotoSlotBusy((prev) => ({ ...prev, [slotKey]: true }));
    setPhotoSlotError((prev) => ({ ...prev, [slotKey]: undefined }));
    setPhotoSlotStats((prev) => ({ ...prev, [slotKey]: undefined }));

    try {
      const compressed = await compressImageForUpload(file, {
        maxLongestSide,
        quality: 0.8,
      });
      const uploadedUrl = await uploadStorageImage(
        'property-images',
        compressed.file
      );
      const nextSettings = applyUrl(siteSettings, uploadedUrl);
      await ownerSaveSiteSettings(nextSettings);
      await refreshSettings();

      setSiteSettings(nextSettings);
      setPhotoSlotStats((prev) => ({
        ...prev,
        [slotKey]: {
          before: compressed.originalBytes,
          after: compressed.compressedBytes,
          saved: true,
        },
      }));
      showToast('Website photo saved', 'saved');
      void loadAll(true);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Upload failed — the photo was not saved.';
      setPhotoSlotError((prev) => ({ ...prev, [slotKey]: msg }));
      showToast(msg, 'error');
    } finally {
      setPhotoSlotBusy((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleRemoveWebsitePhoto = async (
    slotKey: string,
    clearUrl: (current: WebsiteSettings) => WebsiteSettings
  ) => {
    if (!siteSettings) return;
    setPhotoSlotBusy((prev) => ({ ...prev, [slotKey]: true }));
    setPhotoSlotError((prev) => ({ ...prev, [slotKey]: undefined }));
    setPhotoSlotStats((prev) => ({ ...prev, [slotKey]: undefined }));

    try {
      const nextSettings = clearUrl(siteSettings);
      await ownerSaveSiteSettings(nextSettings);
      await refreshSettings();
      setSiteSettings(nextSettings);
      showToast('Photo removed', 'removed');
      void loadAll(true);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not remove photo. Please try again.';
      setPhotoSlotError((prev) => ({ ...prev, [slotKey]: msg }));
      showToast(msg, 'error');
    } finally {
      setPhotoSlotBusy((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  const clearPropFieldError = (field: string) => {
    setPropFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setPropStepError(null);
  };

  const openNewProperty = () => {
    setEditingPropId(null);
    setPublishedConfirmation(null);
    setPropStep(1);
    setPropStepError(null);
    setPropFieldErrors({});
    resetPhotoUploadUi();
    setPImages([]);
    setPTitle('');
    setPPrice('');
    setPListingType('');
    setPType('');
    setPBeds('');
    setPBaths('');
    setPArea('');
    setPAreaUnit('sqft');
    setPFurnishing('');
    setPParking('');
    setPAmenities([]);
    setCustomAmenityInput('');
    setShowCustomAmenity(false);
    setPLocation('');
    setPAddress('');
    setPStatus('');
    setPDesc('');
    setPPublished(true);
    setPFeatured(false);
    setShowPropForm(true);
  };

  const openEditProperty = (prop: Property) => {
    setEditingPropId(prop.id);
    setPublishedConfirmation(null);
    setPropStep(1);
    setPropStepError(null);
    setPropFieldErrors({});
    resetPhotoUploadUi();
    setPImages(prop.images.map((i) => i.url));
    setPTitle(prop.title);
    setPPrice(String(prop.price_inr));
    setPListingType(prop.listing_type);
    setPType(prop.property_type);
    setPBeds(prop.bedrooms ? String(prop.bedrooms) : '');
    setPBaths(prop.bathrooms ? String(prop.bathrooms) : '');
    setPArea(prop.area_sqft ? String(prop.area_sqft) : '');
    setPAreaUnit('sqft');
    setPFurnishing(prop.furnishing);
    setPParking(prop.parking || '');
    setPAmenities(prop.amenities || []);
    setCustomAmenityInput('');
    setShowCustomAmenity(false);
    setPLocation(prop.location);
    setPAddress(prop.address_detail || '');
    setPStatus(prop.status);
    setPDesc(prop.description);
    setPPublished(prop.is_published);
    setPFeatured(prop.is_featured);
    setShowPropForm(true);
  };

  const toggleAmenity = (label: string) => {
    setPAmenities((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  };

  const addCustomAmenity = () => {
    const clean = customAmenityInput.trim();
    if (!clean) return;
    if (!pAmenities.includes(clean)) {
      setPAmenities((prev) => [...prev, clean]);
    }
    setCustomAmenityInput('');
    setShowCustomAmenity(false);
  };

  const validatePropertyStep = (
    step: PropertyWizardStep
  ): { summary: string | null; fields: Record<string, string> } => {
    const fields: Record<string, string> = {};
    if (step === 2) {
      if (!pTitle.trim()) {
        fields.title = 'Please enter a title for this property.';
      }
      const priceNum = Number(pPrice);
      if (!pPrice.trim() || !Number.isFinite(priceNum) || priceNum <= 0) {
        fields.price = 'Please enter a valid price.';
      }
      if (!pListingType) {
        fields.listingType = 'Please choose For sale or For rent.';
      }
      if (!pType.trim()) {
        fields.category = 'Please choose a property category.';
      }
    }
    if (step === 4) {
      if (!pLocation.trim()) {
        fields.location = 'Please choose an area or location.';
      }
      if (!pStatus) {
        fields.status = 'Please choose whether the property is available.';
      }
      if (!pDesc.trim()) {
        fields.description = 'Please write a short description.';
      }
    }
    const firstMsg = Object.values(fields)[0] || null;
    return {
      summary: firstMsg ? 'Please fill in all required fields below.' : null,
      fields,
    };
  };

  const goNextPropertyStep = () => {
    const result = validatePropertyStep(propStep);
    if (result.summary) {
      setPropFieldErrors(result.fields);
      setPropStepError(result.summary);
      return;
    }
    setPropFieldErrors({});
    setPropStepError(null);
    if (propStep < 4) {
      setPropStep((s) => (s + 1) as PropertyWizardStep);
    }
  };

  const handlePublishProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const s of [2, 4] as PropertyWizardStep[]) {
      const result = validatePropertyStep(s);
      if (result.summary) {
        setPropStep(s);
        setPropFieldErrors(result.fields);
        setPropStepError(result.summary);
        return;
      }
    }

    setPropFieldErrors({});
    setPropStepError(null);
    setSavingProp(true);
    try {
      const saved = await ownerSaveProperty(editingPropId, {
        title: pTitle,
        description: pDesc,
        price_inr: Number(pPrice),
        listing_type: pListingType as 'Buy' | 'Rent',
        property_type: pType,
        location: pLocation,
        address_detail: pAddress,
        bedrooms: Number(pBeds || 0),
        bathrooms: Number(pBaths || 0),
        area_sqft: convertAreaInputToSqFt(pArea, pAreaUnit),
        furnishing: pFurnishing || 'Not Applicable',
        parking: pParking,
        status: pStatus as PropertyStatus,
        is_published: pPublished,
        is_featured: pFeatured,
        amenities: pAmenities,
        images: pImages,
      });
      const wasEditing = Boolean(editingPropId);
      showToast(
        wasEditing ? 'Property updated' : pPublished ? 'Property published' : 'Saved',
        'saved'
      );
      setShowPropForm(false);
      setEditingPropId(null);
      setPublishedConfirmation({
        title: pTitle.trim(),
        slug: saved.slug,
        isPublished: pPublished,
      });
      await loadAll(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to save property.',
        'error'
      );
    } finally {
      setSavingProp(false);
    }
  };

  const togglePublish = async (prop: Property) => {
    try {
      await ownerTogglePropertyPublished(prop.id, !prop.is_published);
      showToast(
        prop.is_published ? 'Hidden from website' : 'Now visible on website',
        'info'
      );
      await loadAll(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to update visibility.',
        'error'
      );
    }
  };

  const requestDeleteProperty = (prop: Property) => {
    setConfirmDialog({
      title: 'Delete property?',
      message: `Remove "${prop.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await ownerDeleteProperty(prop.id);
        showToast('Property removed', 'removed');
        await loadAll(true);
      },
    });
  };

  const handleInquiryUpdate = async (
    id: string,
    status: InquiryStatus,
    notes: string
  ) => {
    try {
      await ownerUpdateInquiry(id, status, notes);
      showToast('Saved', 'saved');
      await loadAll(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to update enquiry.',
        'error'
      );
    }
  };

  const handleBookingUpdate = async (
    id: string,
    status: BookingStatus,
    note: string
  ) => {
    try {
      await ownerUpdateBooking(id, status, note);
      showToast('Saved', 'saved');
      await loadAll(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to update visit request.',
        'error'
      );
    }
  };

  const handleReviewUpdate = async (
    id: string,
    patch: { status?: 'pending' | 'approved' | 'rejected'; is_featured?: boolean }
  ) => {
    try {
      await ownerUpdateReview(id, patch);
      showToast(
        patch.status === 'approved'
          ? 'Review approved'
          : patch.status === 'rejected'
          ? 'Review rejected'
          : patch.is_featured === true
          ? 'Showing at top of website'
          : patch.is_featured === false
          ? 'Removed from top position'
          : 'Saved',
        'saved'
      );
      await loadAll(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to update review.',
        'error'
      );
    }
  };

  const requestDeleteReview = (rev: Review) => {
    setConfirmDialog({
      title: 'Delete review?',
      message: `Remove review by "${rev.reviewer_name}"?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await ownerDeleteReview(rev.id);
        showToast('Review deleted', 'removed');
        await loadAll(true);
      },
    });
  };

  const editTeamMember = (ag: Agent) => {
    setEditingTeamId(ag.id);
    setAName(ag.name);
    setAPos(ag.position);
    setABio(ag.bio);
    setAPhone(ag.phone);
    setAWhatsapp(ag.whatsapp);
    setAPhoto(ag.photo_url);
    setAVisible(ag.is_active);
    setTeamCompressionNote(null);
    setTeamUploadError(null);
  };

  const saveTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aName.trim() || !aPos.trim()) {
      showToast('Please enter team member name and role.', 'error');
      return;
    }
    setSavingTeam(true);
    try {
      await ownerSaveTeamMember(editingTeamId, {
        name: aName,
        designation: aPos,
        intro: aBio,
        phone: aPhone,
        whatsapp: aWhatsapp,
        photo_url: aPhoto,
        sort_order: agents.length,
        is_visible: aVisible,
      });
      showToast('Saved', 'saved');
      setTeamSavedMsg(true);
      window.setTimeout(() => setTeamSavedMsg(false), 3000);
      resetTeamForm();
      await loadAll(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to save team member.',
        'error'
      );
    } finally {
      setSavingTeam(false);
    }
  };

  const toggleTeamVisibility = async (ag: Agent) => {
    try {
      await ownerToggleTeamMemberVisibility(ag.id, !ag.is_active);
      showToast(ag.is_active ? 'Hidden from website' : 'Visible on website', 'info');
      await loadAll(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to update team visibility.',
        'error'
      );
    }
  };

  const requestDeleteTeamMember = (ag: Agent) => {
    setConfirmDialog({
      title: 'Remove team member?',
      message: `Remove "${ag.name}" from your team list?`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        await ownerDeleteTeamMember(ag.id);
        showToast('Team member removed', 'removed');
        await loadAll(true);
      },
    });
  };

  const handleSaveSettingsSection = async (
    section: 'contact' | 'text' | 'social' | 'googleReview'
  ) => {
    if (!siteSettings) return;
    setSavingSettingsSection(section);
    try {
      await ownerSaveSiteSettings(siteSettings);
      await refreshSettings();
      setSavedSection(section);
      window.setTimeout(() => {
        setSavedSection((prev) => (prev === section ? null : prev));
      }, 3000);
      showToast('Saved', 'saved');
      await loadAll(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to save settings.',
        'error'
      );
    } finally {
      setSavingSettingsSection(null);
    }
  };

  const addLocationTag = () => {
    const clean = newLocationInput.trim();
    if (!clean || !siteSettings) return;
    if (!siteSettings.locations.includes(clean)) {
      setSiteSettings({
        ...siteSettings,
        locations: [...siteSettings.locations, clean],
      });
    }
    setNewLocationInput('');
  };

  const addCategoryTag = () => {
    const clean = newCategoryInput.trim();
    if (!clean || !siteSettings) return;
    if (!siteSettings.property_types.includes(clean)) {
      setSiteSettings({
        ...siteSettings,
        property_types: [...siteSettings.property_types, clean],
      });
    }
    setNewCategoryInput('');
  };

  const attentionCounts: Record<OwnerTab, number> = {
    overview: 0,
    properties: 0,
    inquiries: (stats?.new_inquiries || 0) + (stats?.pending_bookings || 0),
    reviews: stats?.pending_reviews || 0,
    settings: 0,
  };

  const attentionRows = [
    {
      count: stats?.new_inquiries || 0,
      label:
        (stats?.new_inquiries || 0) === 1
          ? '1 new enquiry waiting for reply'
          : `${stats?.new_inquiries || 0} new enquiries waiting for reply`,
      onClick: () => {
        setEnqFilter('new');
        switchOwnerTab('inquiries');
      },
    },
    {
      count: stats?.pending_bookings || 0,
      label:
        (stats?.pending_bookings || 0) === 1
          ? '1 pending site visit request'
          : `${stats?.pending_bookings || 0} pending site visit requests`,
      onClick: () => {
        setEnqFilter('new');
        switchOwnerTab('inquiries');
      },
    },
    {
      count: stats?.pending_reviews || 0,
      label:
        (stats?.pending_reviews || 0) === 1
          ? '1 client review waiting for approval'
          : `${stats?.pending_reviews || 0} client reviews waiting for approval`,
      onClick: () => {
        setRevFilter('pending');
        switchOwnerTab('reviews');
      },
    },
  ].filter((row) => row.count > 0);

  const hasCustomHeroPhoto = Boolean(
    siteSettings?.hero_image_url?.trim() &&
      siteSettings.hero_image_url.trim() !==
        DEFAULT_SITE_SETTINGS.hero_image_url
  );
  const hasTeamOrContact = Boolean(
    agents.length > 0 ||
      (siteSettings &&
        (siteSettings.phone.trim() !== DEFAULT_SITE_SETTINGS.phone ||
          siteSettings.whatsapp.trim() !== DEFAULT_SITE_SETTINGS.whatsapp ||
          siteSettings.address.trim() !== DEFAULT_SITE_SETTINGS.address))
  );
  const hasAnySocialLink = Boolean(
    siteSettings &&
      (siteSettings.social_links.instagram.trim() ||
        siteSettings.social_links.facebook.trim() ||
        siteSettings.social_links.youtube.trim() ||
        siteSettings.social_links.linkedin.trim())
  );
  const hasAskedReview = Boolean(
    reviews.length > 0 ||
      siteSettings?.google_review_link?.trim() ||
      reviewAskedRecorded
  );

  const checklistItems = [
    {
      key: 'first-prop',
      label: 'Add your first property',
      done: properties.length >= 1,
      actionLabel: 'Add now',
      onClick: () => {
        switchOwnerTab('properties');
        openNewProperty();
      },
    },
    {
      key: 'five-props',
      label: 'Add 5 properties',
      done: properties.length >= 5,
      actionLabel: `${Math.min(properties.length, 5)} / 5`,
      onClick: () => {
        switchOwnerTab('properties');
        openNewProperty();
      },
    },
    {
      key: 'hero-photo',
      label: 'Upload a hero photo',
      done: hasCustomHeroPhoto,
      actionLabel: 'Upload photo',
      onClick: () => scrollToSettingsSection('settings-website-section'),
    },
    {
      key: 'team-contact',
      label: 'Add team or contact details',
      done: hasTeamOrContact,
      actionLabel: 'Open Settings',
      onClick: () => scrollToSettingsSection('settings-contact-section'),
    },
    {
      key: 'social-link',
      label: 'Add a social link',
      done: hasAnySocialLink,
      actionLabel: 'Add link',
      onClick: () => scrollToSettingsSection('settings-social-section'),
    },
    {
      key: 'first-review',
      label: 'Ask for your first review',
      done: hasAskedReview,
      actionLabel: 'Copy message',
      onClick: () => {
        void handleCopyReviewRequest();
      },
    },
  ];
  const checklistCompleted = checklistItems.filter((item) => item.done).length;
  const showSetupChecklist = checklistCompleted < checklistItems.length;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-x-clip">
      {/* Slim Dedicated Owner Top Bar */}
      <header className="fixed top-0 inset-x-0 z-40 pt-[env(safe-area-inset-top,0px)] h-[calc(4rem+env(safe-area-inset-top,0px))] bg-[var(--bg-canvas)]/92 backdrop-blur-2xl border-b border-[var(--border-hairline)]">
        <div className="fluid-container h-full flex items-center justify-between gap-2">
          <Link
            to="/"
            onClick={() => enterOwnerWebsiteView()}
            aria-label="Open website home"
            className="min-h-[44px] inline-flex items-center gap-2 min-w-0 shrink hover:opacity-85 transition-opacity"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={businessName}
                referrerPolicy="no-referrer"
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-contain shrink-0"
              />
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 36 36"
                fill="none"
                aria-hidden="true"
                className="w-[22px] h-[22px] sm:w-6 sm:h-6 shrink-0"
              >
                <path
                  d="M6 28V15L18 6L30 15V28"
                  className="stroke-[var(--accent-secondary)]"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.5 28V19H22.5V28"
                  className="stroke-[var(--text-primary)]"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="4"
                  y1="28"
                  x2="32"
                  y2="28"
                  className="stroke-[var(--text-muted)]"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <span className="font-display text-[clamp(0.95rem,3.4vw,1.25rem)] font-medium tracking-[-0.02em] text-[var(--text-primary)] truncate">
              {businessName}
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                enterOwnerWebsiteView();
                navigate('/');
              }}
              className="min-h-[44px] px-2.5 sm:px-4 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0 hidden sm:inline-block" />
              <span>View website</span>
            </button>

            <button
              type="button"
              onClick={(e) => toggleTheme(e)}
              aria-label={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              title={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              className="min-h-[44px] min-w-[44px] h-11 w-11 inline-flex items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] cursor-pointer shrink-0 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#F5DFB0]" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--accent-primary)]" />
              )}
            </button>

            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/', { replace: true });
              }}
              className="min-h-[44px] px-2.5 sm:px-4 rounded-full border border-[var(--border-hairline)] hover:border-rose-500 text-[13px] font-medium text-[var(--text-primary)] hover:text-rose-500 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0 hidden sm:inline-block" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="fluid-container pt-[calc(env(safe-area-inset-top,0px)+5.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] lg:pb-16">
        {tab !== 'overview' && (
          <div className="mb-4">
            <BackButton label="Back" onClick={handleBackStep} />
          </div>
        )}

        <BackendNotice showConnectionCheck className="mb-5" />

        <div className="lg:flex lg:items-start lg:gap-8">
          {/* Desktop Sticky Left Sidebar Navigation (from 1024px) */}
          <nav
            aria-label="Owner dashboard sections"
            className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 lg:sticky lg:top-24 gap-1.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-subtle)]"
          >
            {OWNER_TABS.map(({ key, label, Icon }) => {
              const count = attentionCounts[key];
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchOwnerTab(key)}
                  className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium inline-flex items-center justify-between gap-2 transition-colors cursor-pointer text-left ${
                    active
                      ? 'bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </span>
                  {count > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[13px] font-semibold tabular-nums leading-none shrink-0 ${
                        active
                          ? 'bg-black/15 text-[var(--cta-gold-ink)]'
                          : 'bg-[var(--bg-surface-muted)] text-[var(--accent-primary)]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
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

            {loading ? (
              <div className="space-y-4">
                <div className="h-24 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] animate-pulse" />
                <div className="fluid-grid-stats">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-28 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* 1. HOME */}
                {tab === 'overview' && stats && (
                  <div className="space-y-6">
                    {/* Welcome Header */}
                    <div>
                      <h1 className="font-display text-[clamp(1.75rem,4.2vw,2.5rem)] font-semibold text-[var(--text-primary)] leading-tight break-anywhere">
                        Welcome back, {user.full_name || 'Owner'}
                      </h1>
                      <p className="text-base text-[var(--text-secondary)] mt-1">
                        Manage your Siliguri listings, client requests, reviews, and website details.
                      </p>
                    </div>

                    {/* 4 Clean Counters */}
                    <div className="fluid-grid-stats">
                      {[
                        {
                          label: 'Properties',
                          val: stats.total_properties,
                          onClick: () => switchOwnerTab('properties'),
                        },
                        {
                          label: 'New enquiries',
                          val: stats.new_inquiries,
                          onClick: () => {
                            setEnqFilter('new');
                            switchOwnerTab('inquiries');
                          },
                        },
                        {
                          label: 'Visit requests',
                          val: stats.pending_bookings,
                          onClick: () => {
                            setEnqFilter('new');
                            switchOwnerTab('inquiries');
                          },
                        },
                        {
                          label: 'Reviews waiting',
                          val: stats.pending_reviews,
                          onClick: () => {
                            setRevFilter('pending');
                            switchOwnerTab('reviews');
                          },
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={item.onClick}
                          className="lux-card-hover text-left rounded-2xl border border-[var(--border-hairline)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-subtle)] transition-colors cursor-pointer"
                        >
                          <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                            {item.label}
                          </p>
                          <p className="font-display text-[clamp(2rem,4vw,2.5rem)] font-semibold tabular-nums text-[var(--text-primary)] mt-1.5 leading-none">
                            {item.val}
                          </p>
                        </button>
                      ))}
                    </div>

                    {/* Quick Actions */}
                    <section
                      aria-label="Quick actions"
                      className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-3"
                    >
                      <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                        Quick actions
                      </h2>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            switchOwnerTab('properties');
                            openNewProperty();
                          }}
                          className="btn-primary-lux min-h-[46px] px-5 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4 shrink-0" />
                          <span>Add property</span>
                        </button>

                        <a
                          href={shareWebsiteWaHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[46px] px-5 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2"
                        >
                          <Share2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                          <span>Share website on WhatsApp</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => void handleCopyReviewRequest()}
                          className="min-h-[46px] px-5 py-2.5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2 cursor-pointer"
                        >
                          {reviewAskCopied ? (
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Star className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                          )}
                          <span>
                            {reviewAskCopied ? 'Message copied!' : 'Ask for a review'}
                          </span>
                        </button>
                      </div>
                    </section>

                    {/* Needs Your Attention (only non-zero tappable rows) */}
                    {attentionRows.length > 0 && (
                      <section
                        aria-label="Needs your attention"
                        className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-3"
                      >
                        <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                          Needs your attention
                        </h2>
                        <div className="divide-y divide-[var(--border-hairline)]">
                          {attentionRows.map((row) => (
                            <button
                              key={row.label}
                              type="button"
                              onClick={row.onClick}
                              className="w-full min-h-[52px] py-3 flex items-center justify-between gap-3 text-left hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
                            >
                              <span className="text-base font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] break-anywhere">
                                {row.label}
                              </span>
                              <span className="inline-flex items-center gap-2 shrink-0 text-[13px] font-semibold text-[var(--accent-primary)] tabular-nums">
                                <span className="px-2.5 py-1 rounded-full bg-[var(--bg-surface-muted)]">
                                  {row.count}
                                </span>
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Setup Checklist (hidden automatically once all 6 items are done) */}
                    {showSetupChecklist && (
                      <section
                        aria-label="Setup checklist"
                        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                              Setup checklist
                            </h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                              Complete these steps to get the best response from your website.
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-[var(--accent-primary)] tabular-nums">
                            {checklistCompleted} of {checklistItems.length} done
                          </span>
                        </div>

                        <div
                          role="progressbar"
                          aria-label="Setup checklist progress"
                          aria-valuemin={0}
                          aria-valuemax={checklistItems.length}
                          aria-valuenow={checklistCompleted}
                          className="h-2.5 w-full rounded-full bg-[var(--bg-surface-muted)] overflow-hidden"
                        >
                          <div
                            className="h-full rounded-full bg-[var(--cta-gold-bg)] transition-all duration-300"
                            style={{
                              width: `${Math.round(
                                (checklistCompleted / checklistItems.length) * 100
                              )}%`,
                            }}
                          />
                        </div>

                        <div className="divide-y divide-[var(--border-hairline)]">
                          {checklistItems.map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={item.onClick}
                              className="w-full min-h-[48px] py-3 flex items-center justify-between gap-3 text-left cursor-pointer group"
                            >
                              <span className="inline-flex items-center gap-3 min-w-0">
                                <span
                                  aria-hidden="true"
                                  className={`h-6 w-6 rounded-full border inline-flex items-center justify-center shrink-0 transition-colors ${
                                    item.done
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'border-[var(--border-input)] bg-[var(--bg-canvas)] text-transparent'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                                <span
                                  className={`text-sm font-medium break-anywhere ${
                                    item.done
                                      ? 'line-through text-[var(--text-muted)]'
                                      : 'text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]'
                                  }`}
                                >
                                  {item.label}
                                </span>
                              </span>

                              {!item.done && (
                                <span className="text-[13px] font-semibold text-[var(--accent-primary)] inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                                  <span>{item.actionLabel}</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Latest Enquiries Preview */}
                    <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                          Latest enquiries
                        </h2>
                        <button
                          type="button"
                          onClick={() => switchOwnerTab('inquiries')}
                          className="min-h-[44px] inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                        >
                          <span>View all</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>

                      {combinedEnquiries.length === 0 ? (
                        <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[var(--border-hairline)]">
                          <p className="text-sm text-[var(--text-secondary)]">
                            No enquiries yet. Share your website link on WhatsApp so buyers and tenants can reach you directly.
                          </p>
                          <a
                            href={shareWebsiteWaHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] px-5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
                          >
                            <Share2 className="w-4 h-4" />
                            <span>Share website</span>
                          </a>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {combinedEnquiries.slice(0, 5).map((entry) => {
                            const waHref = formatWaHref(
                              entry.phone,
                              entry.kind === 'visit'
                                ? `Hello ${entry.name}, thank you for requesting a site visit for ${entry.subject} (${entry.visitSchedule || ''}). This is ${businessName}.`
                                : `Hello ${entry.name}, thank you for contacting ${businessName} about ${entry.subject}.`
                            );
                            return (
                              <div
                                key={`${entry.kind}-${entry.id}`}
                                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-semibold text-[var(--text-primary)] truncate">
                                      {entry.name}
                                    </p>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full border text-[13px] font-semibold shrink-0 ${unifiedChipStyle(
                                        entry.unifiedStatus,
                                        true
                                      )}`}
                                    >
                                      {unifiedLabel(entry.unifiedStatus)}
                                    </span>
                                    <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
                                      {formatRelativeTimeAgo(entry.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-[var(--text-secondary)] truncate">
                                    {entry.kind === 'visit' ? 'Site visit: ' : ''}
                                    {entry.subject}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  {entry.phone && (
                                    <a
                                      href={`tel:${entry.phone.replace(/\s+/g, '')}`}
                                      className="min-h-[44px] px-4 rounded-full border border-[var(--border-input)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-2 tabular-nums"
                                    >
                                      <Phone className="w-4 h-4 text-[var(--accent-primary)]" />
                                      <span>Call</span>
                                    </a>
                                  )}
                                  {waHref && (
                                    <a
                                      href={waHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="min-h-[44px] px-4 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                      <span>WhatsApp</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* 2. PROPERTIES */}
                {tab === 'properties' && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h1 className="font-display text-[clamp(1.75rem,4vw,2.35rem)] font-semibold text-[var(--text-primary)]">
                          Properties ({properties.length})
                        </h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                          Add, edit, share, or choose which homes show on your website.
                        </p>
                      </div>
                      {!showPropForm && (
                        <button
                          type="button"
                          onClick={openNewProperty}
                          className="btn-primary-lux min-h-[46px] px-5 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add property</span>
                        </button>
                      )}
                    </div>

                    {/* Published Confirmation Screen */}
                    {publishedConfirmation && !showPropForm && (
                      <div className="rounded-2xl border border-emerald-500/40 bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-subtle)] space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="h-11 w-11 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                              {publishedConfirmation.isPublished
                                ? 'Published on your website!'
                                : 'Property saved'}
                            </h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">
                              &ldquo;{publishedConfirmation.title}&rdquo; has been saved.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          {publishedConfirmation.isPublished && (
                            <button
                              type="button"
                              onClick={() => {
                                enterOwnerWebsiteView();
                                navigate(
                                  publishedConfirmation.slug
                                    ? `/properties/${publishedConfirmation.slug}`
                                    : '/properties'
                                );
                              }}
                              className="min-h-[44px] px-5 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                            >
                              <Globe className="w-4 h-4" />
                              <span>View on website</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={openNewProperty}
                            className="min-h-[44px] px-5 py-2.5 rounded-full border border-[var(--border-input)] hover:border-[var(--border-strong)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
                          >
                            <Plus className="w-4 h-4 text-[var(--accent-primary)]" />
                            <span>Add another</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step-by-Step Property Form (Add / Edit) */}
                    {showPropForm && (
                      <form
                        onSubmit={handlePublishProperty}
                        noValidate
                        className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 sm:p-7 shadow-[var(--shadow-subtle)] space-y-6"
                      >
                        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[var(--border-hairline)]">
                          <div>
                            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                              {editingPropId ? 'Edit property' : 'Add property'}
                            </h2>
                            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 tabular-nums">
                              Step {propStep} of 4
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPropForm(false);
                              setEditingPropId(null);
                              setPropStepError(null);
                              setPropFieldErrors({});
                              resetPhotoUploadUi();
                            }}
                            className="min-h-[44px] px-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        {/* Step Indicator */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { num: 1 as const, label: '1. Photos' },
                            { num: 2 as const, label: '2. Title and price' },
                            { num: 3 as const, label: '3. Details' },
                            { num: 4 as const, label: '4. Location and description' },
                          ].map((step) => {
                            const isCurrent = propStep === step.num;
                            const isDone = propStep > step.num;
                            return (
                              <button
                                key={step.num}
                                type="button"
                                onClick={() => {
                                  if (step.num <= propStep || editingPropId) {
                                    setPropStepError(null);
                                    setPropFieldErrors({});
                                    setPropStep(step.num);
                                  }
                                }}
                                className={`min-h-[44px] px-3 py-2 rounded-xl border text-[13px] font-medium text-left transition-colors ${
                                  isCurrent
                                    ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold cursor-default'
                                    : isDone || editingPropId
                                    ? 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--border-strong)] cursor-pointer'
                                    : 'bg-[var(--bg-canvas)]/50 border-[var(--border-hairline)] text-[var(--text-muted)] cursor-default'
                                }`}
                              >
                                {step.label}
                              </button>
                            );
                          })}
                        </div>

                        {propStepError && (
                          <div
                            role="alert"
                            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-500"
                          >
                            {propStepError}
                          </div>
                        )}

                        {/* STEP 1: PHOTOS */}
                        {propStep === 1 && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                                Property photos
                              </h3>
                              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                                Select up to {MAX_PROPERTY_PHOTOS} photos at once (up to 15 MB each). Photos are automatically resized for fast loading. Drag photos or use arrows to reorder — the first photo is the main cover picture.
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <label
                                className={`min-h-[48px] px-5 py-2.5 rounded-xl border border-dashed bg-[var(--bg-canvas)] text-sm font-medium inline-flex items-center gap-2 transition-colors ${
                                  uploadingImg || pImages.length >= MAX_PROPERTY_PHOTOS
                                    ? 'border-[var(--border-hairline)] text-[var(--text-muted)] opacity-60 cursor-not-allowed'
                                    : 'border-[var(--border-input)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer'
                                }`}
                              >
                                {uploadingImg ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                                ) : (
                                  <Upload className="w-4 h-4 text-[var(--accent-primary)]" />
                                )}
                                <span>
                                  {uploadingImg
                                    ? 'Preparing & uploading...'
                                    : pImages.length >= MAX_PROPERTY_PHOTOS
                                    ? 'Maximum 20 photos reached'
                                    : 'Select photos'}
                                </span>
                                <input
                                  type="file"
                                  multiple
                                  disabled={
                                    uploadingImg || pImages.length >= MAX_PROPERTY_PHOTOS
                                  }
                                  accept="image/jpeg,image/png,image/webp,image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    void handlePropertyPhotosUpload(e.target.files);
                                    e.currentTarget.value = '';
                                  }}
                                />
                              </label>
                              <span className="text-[13px] font-medium text-[var(--text-muted)] tabular-nums">
                                {pImages.length} / {MAX_PROPERTY_PHOTOS} photos
                              </span>
                            </div>

                            {propUploadProgress && (
                              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-2">
                                <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-[var(--text-primary)]">
                                  <span className="truncate">
                                    {propUploadProgress.phase === 'compressing'
                                      ? 'Optimising'
                                      : 'Uploading'}{' '}
                                    {propUploadProgress.current} of{' '}
                                    {propUploadProgress.total}:{' '}
                                    {propUploadProgress.fileName}
                                  </span>
                                  <span className="tabular-nums shrink-0 text-[var(--accent-primary)]">
                                    {Math.round(
                                      (propUploadProgress.current /
                                        Math.max(1, propUploadProgress.total)) *
                                        100
                                    )}
                                    %
                                  </span>
                                </div>
                                <div
                                  role="progressbar"
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={Math.round(
                                    (propUploadProgress.current /
                                      Math.max(1, propUploadProgress.total)) *
                                      100
                                  )}
                                  className="h-2 w-full rounded-full bg-[var(--bg-surface-muted)] overflow-hidden"
                                >
                                  <div
                                    className="h-full rounded-full bg-[var(--cta-gold-bg)] transition-all duration-200"
                                    style={{
                                      width: `${Math.round(
                                        (propUploadProgress.current /
                                          Math.max(1, propUploadProgress.total)) *
                                          100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {propCompressionNote && !propUploadProgress && (
                              <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5 break-anywhere">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>{propCompressionNote}</span>
                              </p>
                            )}

                            {propUploadError && (
                              <div
                                role="alert"
                                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 flex items-start gap-2 break-anywhere"
                              >
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{propUploadError}</span>
                              </div>
                            )}

                            {pImages.length > 0 && (
                              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3 pt-1">
                                {pImages.map((url, idx) => (
                                  <div
                                    key={`${url}-${idx}`}
                                    draggable
                                    onDragStart={() => {
                                      setDragPhotoIdx(idx);
                                      setDragOverPhotoIdx(idx);
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      if (dragOverPhotoIdx !== idx) {
                                        setDragOverPhotoIdx(idx);
                                      }
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      if (dragPhotoIdx !== null) {
                                        setPImages((prev) =>
                                          reorderItems(prev, dragPhotoIdx, idx)
                                        );
                                      }
                                      setDragPhotoIdx(null);
                                      setDragOverPhotoIdx(null);
                                    }}
                                    onDragEnd={() => {
                                      setDragPhotoIdx(null);
                                      setDragOverPhotoIdx(null);
                                    }}
                                    className={`rounded-xl overflow-hidden border bg-[var(--bg-canvas)] transition-colors ${
                                      dragOverPhotoIdx === idx && dragPhotoIdx !== idx
                                        ? 'border-[var(--cta-gold-bg)] ring-2 ring-[var(--cta-gold-bg)]/40'
                                        : 'border-[var(--border-hairline)]'
                                    }`}
                                  >
                                    <div className="relative aspect-[4/3] bg-[var(--bg-surface-muted)]">
                                      <img
                                        src={url}
                                        alt={buildPropertyImageAlt(
                                          pTitle || 'Property preview',
                                          pLocation,
                                          idx
                                        )}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover select-none"
                                      />
                                      <span
                                        title="Drag to reorder"
                                        className="absolute top-1.5 left-1.5 h-7 px-2 rounded-md bg-black/75 text-white inline-flex items-center gap-1 text-[13px] font-medium cursor-grab"
                                      >
                                        <GripVertical className="w-3.5 h-3.5" />
                                        <span className="tabular-nums">#{idx + 1}</span>
                                      </span>

                                      {idx === 0 && (
                                        <span className="absolute bottom-1.5 left-1.5 px-2.5 py-0.5 rounded-md bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] text-[13px] font-semibold shadow-xs">
                                          Cover photo
                                        </span>
                                      )}

                                      <button
                                        type="button"
                                        aria-label={`Delete photo ${idx + 1}`}
                                        onClick={() =>
                                          setPImages((prev) =>
                                            prev.filter((_, i) => i !== idx)
                                          )
                                        }
                                        className="absolute top-1 right-1 h-11 w-11 rounded-full bg-black/75 hover:bg-rose-600 text-white inline-flex items-center justify-center cursor-pointer transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                    <div className="p-2 flex flex-wrap items-center justify-between gap-1.5 bg-[var(--bg-canvas)]">
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          aria-label={`Move photo ${idx + 1} earlier`}
                                          onClick={() =>
                                            setPImages((prev) =>
                                              reorderItems(prev, idx, idx - 1)
                                            )
                                          }
                                          className="h-11 w-11 rounded-lg border border-[var(--border-hairline)] inline-flex items-center justify-center text-[var(--text-primary)] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                                        >
                                          <ArrowLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === pImages.length - 1}
                                          aria-label={`Move photo ${idx + 1} later`}
                                          onClick={() =>
                                            setPImages((prev) =>
                                              reorderItems(prev, idx, idx + 1)
                                            )
                                          }
                                          className="h-11 w-11 rounded-lg border border-[var(--border-hairline)] inline-flex items-center justify-center text-[var(--text-primary)] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                                        >
                                          <ArrowRight className="w-4 h-4" />
                                        </button>
                                      </div>

                                      {idx > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPImages((prev) =>
                                              makeItemFirst(prev, idx)
                                            )
                                          }
                                          className="min-h-[44px] px-2.5 rounded-lg border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[13px] font-semibold text-[var(--accent-primary)] cursor-pointer whitespace-nowrap"
                                        >
                                          Make cover photo
                                        </button>
                                      ) : (
                                        <span className="text-[13px] font-medium text-[var(--text-muted)] pr-1">
                                          Main cover
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* STEP 2: TITLE AND PRICE */}
                        {propStep === 2 && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                              Title and price
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <label
                                  htmlFor="prop-title"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Property title *
                                </label>
                                <input
                                  id="prop-title"
                                  type="text"
                                  placeholder="Example: Sunny 3 BHK flat near Sevoke Road"
                                  aria-invalid={Boolean(propFieldErrors.title)}
                                  value={pTitle}
                                  onChange={(e) => {
                                    setPTitle(e.target.value);
                                    clearPropFieldError('title');
                                  }}
                                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] ${
                                    propFieldErrors.title
                                      ? 'border-rose-500'
                                      : 'border-[var(--border-hairline)]'
                                  }`}
                                />
                                {propFieldErrors.title && (
                                  <p className="mt-1.5 text-[13px] font-medium text-rose-500">
                                    {propFieldErrors.title}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label
                                  htmlFor="prop-price"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Price (₹) *
                                </label>
                                <input
                                  id="prop-price"
                                  type="number"
                                  min={0}
                                  placeholder="Enter amount in rupees"
                                  aria-invalid={Boolean(propFieldErrors.price)}
                                  value={pPrice}
                                  onChange={(e) => {
                                    setPPrice(e.target.value);
                                    clearPropFieldError('price');
                                  }}
                                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums ${
                                    propFieldErrors.price
                                      ? 'border-rose-500'
                                      : 'border-[var(--border-hairline)]'
                                  }`}
                                />
                                {propFieldErrors.price && (
                                  <p className="mt-1.5 text-[13px] font-medium text-rose-500">
                                    {propFieldErrors.price}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label
                                  htmlFor="prop-listing-type"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  For sale / For rent *
                                </label>
                                <select
                                  id="prop-listing-type"
                                  aria-invalid={Boolean(propFieldErrors.listingType)}
                                  value={pListingType}
                                  onChange={(e) => {
                                    setPListingType(
                                      e.target.value as '' | 'Buy' | 'Rent'
                                    );
                                    clearPropFieldError('listingType');
                                  }}
                                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] ${
                                    propFieldErrors.listingType
                                      ? 'border-rose-500'
                                      : 'border-[var(--border-hairline)]'
                                  }`}
                                >
                                  <option value="">Choose one</option>
                                  <option value="Buy">For sale</option>
                                  <option value="Rent">For rent</option>
                                </select>
                                {propFieldErrors.listingType && (
                                  <p className="mt-1.5 text-[13px] font-medium text-rose-500">
                                    {propFieldErrors.listingType}
                                  </p>
                                )}
                              </div>

                              <div className="sm:col-span-2">
                                <label
                                  htmlFor="prop-category"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Property category *
                                </label>
                                <select
                                  id="prop-category"
                                  aria-invalid={Boolean(propFieldErrors.category)}
                                  value={pType}
                                  onChange={(e) => {
                                    setPType(e.target.value);
                                    clearPropFieldError('category');
                                  }}
                                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] ${
                                    propFieldErrors.category
                                      ? 'border-rose-500'
                                      : 'border-[var(--border-hairline)]'
                                  }`}
                                >
                                  <option value="">Choose property category</option>
                                  {availableCategories.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                                {propFieldErrors.category && (
                                  <p className="mt-1.5 text-[13px] font-medium text-rose-500">
                                    {propFieldErrors.category}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* STEP 3: DETAILS */}
                        {propStep === 3 && (
                          <div className="space-y-5">
                            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                              Property details
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label
                                  htmlFor="prop-beds"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Bedrooms
                                </label>
                                <input
                                  id="prop-beds"
                                  type="number"
                                  min={0}
                                  placeholder="Optional"
                                  value={pBeds}
                                  onChange={(e) => setPBeds(e.target.value)}
                                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor="prop-baths"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Bathrooms
                                </label>
                                <input
                                  id="prop-baths"
                                  type="number"
                                  min={0}
                                  placeholder="Optional"
                                  value={pBaths}
                                  onChange={(e) => setPBaths(e.target.value)}
                                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor="prop-area"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Area (sq ft / Katha)
                                </label>
                                <div className="flex items-stretch rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] overflow-hidden focus-within:border-[var(--accent-primary)]">
                                  <input
                                    id="prop-area"
                                    type="number"
                                    min={0}
                                    step="any"
                                    placeholder="Optional"
                                    value={pArea}
                                    onChange={(e) => setPArea(e.target.value)}
                                    className="min-w-0 flex-1 min-h-[46px] px-3.5 py-2.5 bg-transparent text-base text-[var(--text-primary)] tabular-nums focus:outline-none"
                                  />
                                  <div
                                    role="group"
                                    aria-label="Area unit"
                                    className="flex items-center p-1 gap-0.5 border-l border-[var(--border-hairline)] shrink-0"
                                  >
                                    {(
                                      [
                                        { id: 'sqft', label: 'sq ft' },
                                        { id: 'katha', label: 'Katha' },
                                      ] as const
                                    ).map((unit) => {
                                      const active = pAreaUnit === unit.id;
                                      return (
                                        <button
                                          key={unit.id}
                                          type="button"
                                          aria-pressed={active}
                                          onClick={() => setPAreaUnit(unit.id)}
                                          className={`min-h-[38px] px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                            active
                                              ? 'bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)]'
                                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                          }`}
                                        >
                                          {unit.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                {Number(pArea) > 0 && (
                                  <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
                                    {pAreaUnit === 'katha'
                                      ? `Equals ${convertAreaInputToSqFt(pArea, 'katha').toLocaleString('en-IN')} sq ft (1 Katha = ${SQFT_PER_KATHA} sq ft)`
                                      : `Equals ${formatAreaKatha(Number(pArea))} Katha`}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label
                                  htmlFor="prop-furnishing"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Furnishing
                                </label>
                                <select
                                  id="prop-furnishing"
                                  value={pFurnishing}
                                  onChange={(e) => setPFurnishing(e.target.value)}
                                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                                >
                                  <option value="">Choose furnishing</option>
                                  <option value="Unfurnished">Unfurnished</option>
                                  <option value="Semi-Furnished">Semi-Furnished</option>
                                  <option value="Fully Furnished">
                                    Fully Furnished
                                  </option>
                                  <option value="Not Applicable">
                                    Not Applicable
                                  </option>
                                </select>
                              </div>

                              <div>
                                <label
                                  htmlFor="prop-parking"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Parking
                                </label>
                                <input
                                  id="prop-parking"
                                  type="text"
                                  placeholder="Example: 1 covered car parking"
                                  value={pParking}
                                  onChange={(e) => setPParking(e.target.value)}
                                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                                />
                              </div>
                            </div>

                            {/* Amenities */}
                            <div className="space-y-2.5">
                              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                                Features &amp; amenities (tap to select)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {allAmenityChoices.map((item) => {
                                  const selected = pAmenities.includes(item);
                                  return (
                                    <button
                                      key={item}
                                      type="button"
                                      aria-pressed={selected}
                                      onClick={() => toggleAmenity(item)}
                                      className={`min-h-[44px] px-4 rounded-full border text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                                        selected
                                          ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold'
                                          : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                                      }`}
                                    >
                                      {selected && <Check className="w-3.5 h-3.5" />}
                                      <span>{item}</span>
                                    </button>
                                  );
                                })}

                                {!showCustomAmenity && (
                                  <button
                                    type="button"
                                    onClick={() => setShowCustomAmenity(true)}
                                    className="min-h-[44px] px-4 rounded-full border border-dashed border-[var(--border-input)] hover:border-[var(--accent-primary)] text-sm font-medium text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add other</span>
                                  </button>
                                )}
                              </div>

                              {showCustomAmenity && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <input
                                    type="text"
                                    placeholder="Type another feature"
                                    value={customAmenityInput}
                                    onChange={(e) =>
                                      setCustomAmenityInput(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addCustomAmenity();
                                      }
                                    }}
                                    className="flex-1 min-w-[200px] min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={addCustomAmenity}
                                    className="min-h-[44px] px-4 rounded-xl bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] text-sm font-semibold cursor-pointer"
                                  >
                                    Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowCustomAmenity(false);
                                      setCustomAmenityInput('');
                                    }}
                                    className="min-h-[44px] px-3 text-sm text-[var(--text-muted)] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* STEP 4: LOCATION AND DESCRIPTION */}
                        {propStep === 4 && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                              Location and description
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label
                                  htmlFor="prop-location"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Area / Location *
                                </label>
                                <select
                                  id="prop-location"
                                  aria-invalid={Boolean(propFieldErrors.location)}
                                  value={pLocation}
                                  onChange={(e) => {
                                    setPLocation(e.target.value);
                                    clearPropFieldError('location');
                                  }}
                                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] ${
                                    propFieldErrors.location
                                      ? 'border-rose-500'
                                      : 'border-[var(--border-hairline)]'
                                  }`}
                                >
                                  <option value="">Choose an area</option>
                                  {availableLocations.map((loc) => (
                                    <option key={loc} value={loc}>
                                      {loc}
                                    </option>
                                  ))}
                                </select>
                                {propFieldErrors.location && (
                                  <p className="mt-1.5 text-[13px] font-medium text-rose-500">
                                    {propFieldErrors.location}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label
                                  htmlFor="prop-status"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Availability *
                                </label>
                                <select
                                  id="prop-status"
                                  aria-invalid={Boolean(propFieldErrors.status)}
                                  value={pStatus}
                                  onChange={(e) => {
                                    setPStatus(
                                      e.target.value as '' | PropertyStatus
                                    );
                                    clearPropFieldError('status');
                                  }}
                                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] ${
                                    propFieldErrors.status
                                      ? 'border-rose-500'
                                      : 'border-[var(--border-hairline)]'
                                  }`}
                                >
                                  <option value="">Choose availability</option>
                                  <option value="Available">Available</option>
                                  <option value="Under Construction">
                                    Under Construction
                                  </option>
                                  <option value="Sold">Sold</option>
                                  <option value="Rented">Rented</option>
                                </select>
                                {propFieldErrors.status && (
                                  <p className="mt-1.5 text-[13px] font-medium text-rose-500">
                                    {propFieldErrors.status}
                                  </p>
                                )}
                              </div>

                              <div className="sm:col-span-2">
                                <label
                                  htmlFor="prop-address"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Street address or landmark
                                </label>
                                <input
                                  id="prop-address"
                                  type="text"
                                  placeholder="Optional landmark or road name"
                                  value={pAddress}
                                  onChange={(e) => setPAddress(e.target.value)}
                                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label
                                  htmlFor="prop-desc"
                                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                                >
                                  Description *
                                </label>
                                <textarea
                                  id="prop-desc"
                                  rows={4}
                                  placeholder="Describe rooms, sunlight, nearby landmarks, or special features..."
                                  aria-invalid={Boolean(propFieldErrors.description)}
                                  value={pDesc}
                                  onChange={(e) => {
                                    setPDesc(e.target.value);
                                    clearPropFieldError('description');
                                  }}
                                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] ${
                                    propFieldErrors.description
                                      ? 'border-rose-500'
                                      : 'border-[var(--border-hairline)]'
                                  }`}
                                />
                                {propFieldErrors.description && (
                                  <p className="mt-1.5 text-[13px] font-medium text-rose-500">
                                    {propFieldErrors.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-[var(--border-hairline)]">
                              <SwitchControl
                                checked={pPublished}
                                onChange={setPPublished}
                                label="Visible on website"
                              />
                              <SwitchControl
                                checked={pFeatured}
                                onChange={setPFeatured}
                                label="Show in Recommended"
                              />
                            </div>
                          </div>
                        )}

                        {/* Wizard Footer Navigation */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-hairline)]">
                          {propStep > 1 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPropStepError(null);
                                setPropFieldErrors({});
                                setPropStep(
                                  (s) => (s - 1) as PropertyWizardStep
                                );
                              }}
                              className="min-h-[46px] px-5 rounded-full border border-[var(--border-input)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
                            >
                              <ArrowLeft className="w-4 h-4" />
                              <span>Previous</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          {propStep < 4 ? (
                            <button
                              type="button"
                              onClick={goNextPropertyStep}
                              className="min-h-[46px] px-6 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                            >
                              <span>Next</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="submit"
                              disabled={savingProp}
                              className="min-h-[50px] px-8 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-base font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                            >
                              {savingProp && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              )}
                              <span>
                                {savingProp
                                  ? 'Saving...'
                                  : editingPropId
                                  ? 'Save changes'
                                  : 'Publish'}
                              </span>
                            </button>
                          )}
                        </div>
                      </form>
                    )}

                    {/* Properties Empty State or Cards (hidden while step-by-step form is active) */}
                    {!showPropForm &&
                      (properties.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 sm:p-10 shadow-[var(--shadow-subtle)] text-center space-y-4">
                        <Building2 className="w-10 h-10 mx-auto text-[var(--accent-primary)] opacity-85" />
                        <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                          No properties added yet
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                          Add your first home, flat, plot, or rental listing to display it to visitors in Siliguri.
                        </p>
                        <button
                          type="button"
                          onClick={openNewProperty}
                          className="btn-primary-lux min-h-[48px] px-7 py-3 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add your first property</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {properties.map((prop) => {
                          const savedCount = favoriteCounts[prop.id] || 0;
                          const linkCopied = copiedPropId === prop.id;
                          return (
                            <div
                              key={prop.id}
                              className="lux-card-hover rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-[var(--shadow-subtle)] space-y-4"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start sm:items-center gap-4 min-w-0">
                                  <div className="w-24 sm:w-28 aspect-[4/3] rounded-xl overflow-hidden shrink-0 bg-[var(--bg-surface-muted)]">
                                    <PropertyImage
                                      src={prop.images[0]?.url}
                                      alt={buildPropertyImageAlt(
                                        prop.title,
                                        prop.location
                                      )}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0 space-y-1">
                                    <h3 className="font-display text-xl font-semibold text-[var(--text-primary)] break-anywhere leading-snug">
                                      {prop.title}
                                    </h3>
                                    <p className="text-base font-semibold text-[var(--accent-primary)] tabular-nums">
                                      {formatINRReadable(
                                        prop.price_inr,
                                        prop.listing_type
                                      )}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[var(--text-muted)]">
                                      <span>
                                        {prop.listing_type === 'Rent'
                                          ? 'For rent'
                                          : 'For sale'}
                                      </span>
                                      <span aria-hidden="true">&middot;</span>
                                      <span>{prop.location}</span>
                                      <span aria-hidden="true">&middot;</span>
                                      <span>{prop.status}</span>
                                      <span aria-hidden="true">&middot;</span>
                                      <span className="inline-flex items-center gap-1 tabular-nums text-[var(--text-secondary)] font-medium">
                                        <Heart className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                                        <span>
                                          Saved {savedCount}{' '}
                                          {savedCount === 1 ? 'time' : 'times'}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="shrink-0">
                                  <SwitchControl
                                    checked={prop.is_published}
                                    onChange={() => void togglePublish(prop)}
                                    label="Visible on website"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[var(--border-hairline)]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCopyPropertyShareLink(prop)
                                  }
                                  className="min-h-[44px] px-4 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2 cursor-pointer"
                                >
                                  {linkCopied ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <MessageCircle className="w-4 h-4 text-[var(--accent-primary)]" />
                                  )}
                                  <span>
                                    {linkCopied
                                      ? 'Property link copied'
                                      : 'Share on WhatsApp'}
                                  </span>
                                </button>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditProperty(prop)}
                                    className="min-h-[44px] px-4 rounded-xl border border-[var(--border-hairline)] hover:border-[var(--border-strong)] text-[13px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4 text-[var(--accent-primary)]" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteProperty(prop)}
                                    className="min-h-[44px] px-4 rounded-xl border border-[var(--border-hairline)] hover:border-rose-500/50 text-[13px] font-medium text-rose-500 inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. ENQUIRIES (Enquiries + Site Visit Requests Combined) */}
                {tab === 'inquiries' && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h1 className="font-display text-[clamp(1.75rem,4vw,2.35rem)] font-semibold text-[var(--text-primary)]">
                          Enquiries ({filteredCombinedEnquiries.length})
                        </h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                          Customer enquiries and site visit requests together.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadEnquiriesCsv}
                        className="min-h-[44px] px-4 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-[13px] font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2 cursor-pointer shrink-0"
                      >
                        <Download className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span>Download as CSV</span>
                      </button>
                    </div>

                    {/* Search & Status Filter */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="relative flex-1 min-w-0">
                        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="search"
                          value={enqSearch}
                          onChange={(e) => setEnqSearch(e.target.value)}
                          placeholder="Search by name, phone, property, or message..."
                          aria-label="Search enquiries"
                          className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]"
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {(['all', 'new', 'contacted', 'done'] as const).map(
                          (st) => {
                            const active = enqFilter === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setEnqFilter(st)}
                                className={`min-h-[44px] px-4 rounded-full text-[13px] font-semibold border cursor-pointer transition-colors ${
                                  st === 'all'
                                    ? active
                                      ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)]'
                                      : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                                    : active
                                    ? unifiedChipStyle(st, true)
                                    : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                                }`}
                              >
                                {st === 'all' ? 'All' : unifiedLabel(st)}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {combinedEnquiries.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 sm:p-10 shadow-[var(--shadow-subtle)] text-center space-y-4">
                        <ClipboardList className="w-10 h-10 mx-auto text-[var(--accent-primary)] opacity-85" />
                        <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                          No enquiries or visit requests yet
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                          When a visitor contacts you or requests a site visit on your website, their details will show up here.
                        </p>
                        <a
                          href={shareWebsiteWaHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary-lux min-h-[46px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>Share website on WhatsApp</span>
                        </a>
                      </div>
                    ) : filteredCombinedEnquiries.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 shadow-[var(--shadow-subtle)] text-center space-y-4">
                        <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                          No matching enquiries
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)]">
                          Try clearing your search or switching back to all enquiries.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEnqFilter('all');
                            setEnqSearch('');
                          }}
                          className="min-h-[44px] px-5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] cursor-pointer"
                        >
                          Show all enquiries
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredCombinedEnquiries.map((entry) =>
                          entry.kind === 'enquiry' ? (
                            <OwnerUnifiedEnquiryCard
                              key={`inq-${entry.id}`}
                              type="enquiry"
                              name={entry.name}
                              email={entry.email}
                              phone={entry.phone}
                              subject={entry.subject}
                              message={entry.message}
                              initialNote={entry.note}
                              status={entry.unifiedStatus}
                              createdAt={entry.createdAt}
                              businessName={businessName}
                              onSave={async (nextStatus, nextNote) => {
                                await handleInquiryUpdate(
                                  entry.id,
                                  unifiedToInquiry(nextStatus),
                                  nextNote
                                );
                              }}
                            />
                          ) : (
                            <OwnerUnifiedEnquiryCard
                              key={`visit-${entry.id}`}
                              type="visit"
                              name={entry.name}
                              email={entry.email}
                              phone={entry.phone}
                              subject={entry.subject}
                              visitSchedule={entry.visitSchedule}
                              propertySlug={entry.propertySlug}
                              message={entry.message}
                              initialNote={entry.note}
                              status={entry.unifiedStatus}
                              createdAt={entry.createdAt}
                              businessName={businessName}
                              onOpenPropertyLink={enterOwnerWebsiteView}
                              onSave={async (nextStatus, nextNote) => {
                                await handleBookingUpdate(
                                  entry.id,
                                  unifiedToBooking(nextStatus),
                                  nextNote
                                );
                              }}
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. REVIEWS */}
                {tab === 'reviews' && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h1 className="font-display text-[clamp(1.75rem,4vw,2.35rem)] font-semibold text-[var(--text-primary)]">
                          Reviews ({filteredReviews.length})
                        </h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                          Approve client feedback to show it on your website and pin your favourites at the top.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { key: 'all', label: 'All' },
                            { key: 'pending', label: 'Waiting' },
                            { key: 'approved', label: 'Approved' },
                            { key: 'rejected', label: 'Rejected' },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setRevFilter(item.key)}
                            className={`min-h-[44px] px-4 rounded-full text-[13px] font-semibold border cursor-pointer transition-colors ${
                              revFilter === item.key
                                ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)]'
                                : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {reviews.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 sm:p-10 shadow-[var(--shadow-subtle)] text-center space-y-4">
                        <Star className="w-10 h-10 mx-auto text-[var(--accent-primary)] opacity-85" />
                        <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                          No client reviews yet
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                          Ask a happy buyer, seller, or tenant for a short review — reviews appear here for your approval before going live.
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleCopyReviewRequest()}
                          className="btn-primary-lux min-h-[46px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Star className="w-4 h-4" />
                          <span>Ask for a review</span>
                        </button>
                      </div>
                    ) : filteredReviews.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 shadow-[var(--shadow-subtle)] text-center space-y-4">
                        <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                          No reviews in this view
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)]">
                          No client reviews match the selected filter right now.
                        </p>
                        <button
                          type="button"
                          onClick={() => setRevFilter('all')}
                          className="min-h-[44px] px-5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] cursor-pointer"
                        >
                          Show all reviews
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredReviews.map((rev) => {
                          const reviewDateText = formatReviewDate(
                            rev.review_date || rev.created_at
                          );
                          const statusLabel =
                            rev.status === 'pending'
                              ? 'Waiting'
                              : rev.status === 'approved'
                              ? 'Approved'
                              : 'Rejected';
                          return (
                            <div
                              key={rev.id}
                              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-subtle)] space-y-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-base font-semibold text-[var(--text-primary)] break-anywhere">
                                      {rev.reviewer_name}
                                    </h2>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full border text-[13px] font-semibold ${reviewStatusChipStyle(
                                        rev.status
                                      )}`}
                                    >
                                      {statusLabel}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-muted)]">
                                    <span className="inline-flex items-center gap-0.5 text-[var(--accent-secondary)] tabular-nums font-medium">
                                      {rev.rating} / 5 stars
                                    </span>
                                    <span aria-hidden="true">&middot;</span>
                                    <span>{rev.customer_type}</span>
                                    {reviewDateText && (
                                      <>
                                        <span aria-hidden="true">&middot;</span>
                                        <span className="tabular-nums">
                                          {reviewDateText}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => requestDeleteReview(rev)}
                                  aria-label={`Delete review by ${rev.reviewer_name}`}
                                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-rose-500 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed break-anywhere">
                                &ldquo;{rev.review_text}&rdquo;
                              </p>

                              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[var(--border-hairline)]">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={rev.status === 'approved'}
                                    onClick={() =>
                                      void handleReviewUpdate(rev.id, {
                                        status: 'approved',
                                      })
                                    }
                                    className={`min-h-[44px] px-5 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55 ${
                                      rev.status === 'approved'
                                        ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                  >
                                    <Check className="w-4 h-4" />
                                    <span>
                                      {rev.status === 'approved'
                                        ? 'Approved'
                                        : 'Approve'}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={rev.status === 'rejected'}
                                    onClick={() =>
                                      void handleReviewUpdate(rev.id, {
                                        status: 'rejected',
                                      })
                                    }
                                    className={`min-h-[44px] px-5 rounded-full border text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55 ${
                                      rev.status === 'rejected'
                                        ? 'border-rose-500/40 bg-rose-500/12 text-rose-500'
                                        : 'border-[var(--border-hairline)] hover:border-rose-500 text-rose-500'
                                    }`}
                                  >
                                    <X className="w-4 h-4" />
                                    <span>
                                      {rev.status === 'rejected'
                                        ? 'Rejected'
                                        : 'Reject'}
                                    </span>
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  aria-pressed={rev.is_featured}
                                  onClick={() =>
                                    void handleReviewUpdate(rev.id, {
                                      is_featured: !rev.is_featured,
                                    })
                                  }
                                  className={`min-h-[44px] px-4 rounded-full border text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                                    rev.is_featured
                                      ? 'bg-[var(--cta-gold-bg)] border-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] font-semibold'
                                      : 'bg-[var(--btn-secondary-bg)] border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:border-[var(--border-strong)]'
                                  }`}
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      rev.is_featured ? 'fill-current' : ''
                                    }`}
                                  />
                                  <span>
                                    {rev.is_featured
                                      ? 'Showing at top'
                                      : 'Show at top'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. SETTINGS */}
                {tab === 'settings' && (
                  <div className="space-y-8">
                    <div>
                      <h1 className="font-display text-[clamp(1.75rem,4vw,2.35rem)] font-semibold text-[var(--text-primary)]">
                        Settings
                      </h1>
                      <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                        Manage your contact info, website text and photos, team members, social links, review link, and clients.
                      </p>
                    </div>

                    {/* Section 1: Contact and timings */}
                    {siteSettings && (
                      <section
                        id="settings-contact-section"
                        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-5"
                      >
                        <div>
                          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                            Contact and timings
                          </h2>
                          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                            Shown across your website header, contact form, and call buttons.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              Phone number
                            </label>
                            <input
                              type="text"
                              value={siteSettings.phone}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s ? { ...s, phone: e.target.value } : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              WhatsApp number (with country code)
                            </label>
                            <input
                              type="text"
                              value={siteSettings.whatsapp}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s ? { ...s, whatsapp: e.target.value } : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)] tabular-nums"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              Office address
                            </label>
                            <input
                              type="text"
                              value={siteSettings.address}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s ? { ...s, address: e.target.value } : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              Monday hours
                            </label>
                            <input
                              type="text"
                              value={siteSettings.operating_hours.monday}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        operating_hours: {
                                          ...s.operating_hours,
                                          monday: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              Tuesday hours
                            </label>
                            <input
                              type="text"
                              value={siteSettings.operating_hours.tuesday}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        operating_hours: {
                                          ...s.operating_hours,
                                          tuesday: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              Wednesday hours
                            </label>
                            <input
                              type="text"
                              value={siteSettings.operating_hours.wednesday}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        operating_hours: {
                                          ...s.operating_hours,
                                          wednesday: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              Thursday to Sunday hours
                            </label>
                            <input
                              type="text"
                              value={siteSettings.operating_hours.thursday_sunday}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        operating_hours: {
                                          ...s.operating_hours,
                                          thursday_sunday: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={savingSettingsSection === 'contact'}
                            onClick={() =>
                              void handleSaveSettingsSection('contact')
                            }
                            className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                          >
                            {savingSettingsSection === 'contact' && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            <span>
                              {savingSettingsSection === 'contact'
                                ? 'Saving...'
                                : 'Save'}
                            </span>
                          </button>
                          {savedSection === 'contact' && (
                            <span className="text-sm font-semibold text-emerald-500 inline-flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              Saved
                            </span>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Section 2: Website text and photos */}
                    {siteSettings && (
                      <section
                        id="settings-website-section"
                        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-7"
                      >
                        <div>
                          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                            Website text and photos
                          </h2>
                          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                            Update your headlines, description, service areas, and homepage or service pictures.
                          </p>
                        </div>

                        {/* Website text */}
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                Business name
                              </label>
                              <input
                                type="text"
                                value={siteSettings.business_name}
                                onChange={(e) =>
                                  setSiteSettings((s) =>
                                    s ? { ...s, business_name: e.target.value } : s
                                  )
                                }
                                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                Short tagline
                              </label>
                              <input
                                type="text"
                                value={siteSettings.tagline}
                                onChange={(e) =>
                                  setSiteSettings((s) =>
                                    s ? { ...s, tagline: e.target.value } : s
                                  )
                                }
                                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                Main homepage heading
                              </label>
                              <input
                                type="text"
                                value={siteSettings.hero_headline}
                                onChange={(e) =>
                                  setSiteSettings((s) =>
                                    s ? { ...s, hero_headline: e.target.value } : s
                                  )
                                }
                                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                Homepage intro sentence
                              </label>
                              <input
                                type="text"
                                value={siteSettings.hero_subheadline}
                                onChange={(e) =>
                                  setSiteSettings((s) =>
                                    s
                                      ? { ...s, hero_subheadline: e.target.value }
                                      : s
                                  )
                                }
                                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                About your company
                              </label>
                              <textarea
                                rows={3}
                                value={siteSettings.description}
                                onChange={(e) =>
                                  setSiteSettings((s) =>
                                    s ? { ...s, description: e.target.value } : s
                                  )
                                }
                                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                              />
                            </div>

                            {/* Areas we cover */}
                            <div className="sm:col-span-2 space-y-2">
                              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                                Areas we cover
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {siteSettings.locations.map((loc) => (
                                  <span
                                    key={loc}
                                    className="inline-flex items-center gap-1 pl-3.5 pr-1 min-h-[44px] rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[13px] font-medium text-[var(--text-primary)]"
                                  >
                                    <span>{loc}</span>
                                    <button
                                      type="button"
                                      aria-label={`Remove ${loc}`}
                                      onClick={() =>
                                        setSiteSettings((s) =>
                                          s
                                            ? {
                                                ...s,
                                                locations: s.locations.filter(
                                                  (item) => item !== loc
                                                ),
                                              }
                                            : s
                                        )
                                      }
                                      className="h-11 w-11 -my-1 rounded-full hover:bg-[var(--bg-surface-muted)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="text"
                                  placeholder="Add another area"
                                  value={newLocationInput}
                                  onChange={(e) =>
                                    setNewLocationInput(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addLocationTag();
                                    }
                                  }}
                                  className="flex-1 min-w-[180px] min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                                />
                                <button
                                  type="button"
                                  onClick={addLocationTag}
                                  className="min-h-[44px] px-4 rounded-xl border border-[var(--border-input)] text-sm font-medium text-[var(--text-primary)] cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            </div>

                            {/* Property categories */}
                            <div className="sm:col-span-2 space-y-2">
                              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                                Property categories
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {siteSettings.property_types.map((cat) => (
                                  <span
                                    key={cat}
                                    className="inline-flex items-center gap-1 pl-3.5 pr-1 min-h-[44px] rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[13px] font-medium text-[var(--text-primary)]"
                                  >
                                    <span>{cat}</span>
                                    <button
                                      type="button"
                                      aria-label={`Remove ${cat}`}
                                      onClick={() =>
                                        setSiteSettings((s) =>
                                          s
                                            ? {
                                                ...s,
                                                property_types:
                                                  s.property_types.filter(
                                                    (item) => item !== cat
                                                  ),
                                              }
                                            : s
                                        )
                                      }
                                      className="h-11 w-11 -my-1 rounded-full hover:bg-[var(--bg-surface-muted)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="text"
                                  placeholder="Add another category"
                                  value={newCategoryInput}
                                  onChange={(e) =>
                                    setNewCategoryInput(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addCategoryTag();
                                    }
                                  }}
                                  className="flex-1 min-w-[180px] min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                                />
                                <button
                                  type="button"
                                  onClick={addCategoryTag}
                                  className="min-h-[44px] px-4 rounded-xl border border-[var(--border-input)] text-sm font-medium text-[var(--text-primary)] cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <button
                              type="button"
                              disabled={savingSettingsSection === 'text'}
                              onClick={() => void handleSaveSettingsSection('text')}
                              className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                            >
                              {savingSettingsSection === 'text' && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              )}
                              <span>
                                {savingSettingsSection === 'text'
                                  ? 'Saving...'
                                  : 'Save'}
                              </span>
                            </button>
                            {savedSection === 'text' && (
                              <span className="text-sm font-semibold text-emerald-500 inline-flex items-center gap-1">
                                <Check className="w-4 h-4" />
                                Saved
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Website photos */}
                        <div className="space-y-4 pt-6 border-t border-[var(--border-hairline)]">
                          <div>
                            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                              Website photos
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                              Photos are resized for fast mobile loading and saved right away.
                            </p>
                          </div>

                          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
                            {[
                              {
                                key: 'hero',
                                label: 'Hero photo',
                                hint: 'Homepage top banner',
                                maxSide: 1600,
                                previewUrl:
                                  siteSettings.hero_image_url ||
                                  '/src/assets/images/hero_siliguri_villa_1795102916572.jpg',
                                optional: false,
                                applyUrl: (s: WebsiteSettings, url: string) => ({
                                  ...s,
                                  hero_image_url: url,
                                }),
                              },
                              {
                                key: 'about',
                                label: 'About photo',
                                hint: 'About us section',
                                maxSide: 1200,
                                previewUrl:
                                  siteSettings.about_image_url ||
                                  '/src/assets/images/about_siliguri_construction_1795235945880.jpg',
                                optional: false,
                                applyUrl: (s: WebsiteSettings, url: string) => ({
                                  ...s,
                                  about_image_url: url,
                                }),
                              },
                              {
                                key: 'logo',
                                label: 'Logo',
                                hint: 'Website header mark',
                                maxSide: 1200,
                                previewUrl: siteSettings.logo_url || '',
                                optional: true,
                                applyUrl: (s: WebsiteSettings, url: string) => ({
                                  ...s,
                                  logo_url: url,
                                }),
                                clearUrl: (s: WebsiteSettings) => ({
                                  ...s,
                                  logo_url: '',
                                }),
                              },
                            ].map((slot) => {
                              const busy = Boolean(photoSlotBusy[slot.key]);
                              const slotStats = photoSlotStats[slot.key];
                              const errMsg = photoSlotError[slot.key];
                              return (
                                <div
                                  key={slot.key}
                                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 flex flex-col justify-between gap-3"
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                                          {slot.label}
                                        </h4>
                                        <p className="text-[13px] text-[var(--text-muted)]">
                                          {slot.hint}
                                        </p>
                                      </div>
                                      {slot.optional &&
                                        slot.previewUrl &&
                                        slot.clearUrl && (
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              void handleRemoveWebsitePhoto(
                                                slot.key,
                                                slot.clearUrl!
                                              )
                                            }
                                            className="min-h-[44px] px-2 text-[13px] text-rose-500 hover:underline cursor-pointer disabled:opacity-50 shrink-0"
                                          >
                                            Remove
                                          </button>
                                        )}
                                    </div>

                                    <div className="aspect-[16/10] rounded-lg overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-center">
                                      {slot.previewUrl ? (
                                        <img
                                          src={slot.previewUrl}
                                          alt={slot.label}
                                          loading="lazy"
                                          decoding="async"
                                          className={`w-full h-full ${
                                            slot.key === 'logo'
                                              ? 'object-contain p-3'
                                              : 'object-cover'
                                          }`}
                                        />
                                      ) : (
                                        <span className="text-[13px] text-[var(--text-muted)] px-3 text-center">
                                          Using built-in icon mark
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label
                                      className={`min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-[var(--border-input)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)] text-[13px] font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 transition-colors ${
                                        busy ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                                      }`}
                                    >
                                      {busy ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                                      ) : (
                                        <Upload className="w-4 h-4 text-[var(--accent-primary)]" />
                                      )}
                                      <span>
                                        {busy ? 'Saving photo...' : 'Replace'}
                                      </span>
                                      <input
                                        type="file"
                                        disabled={busy}
                                        accept="image/jpeg,image/png,image/webp,image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          void handleReplaceWebsitePhoto(
                                            slot.key,
                                            e.target.files,
                                            slot.maxSide,
                                            slot.applyUrl
                                          );
                                          e.currentTarget.value = '';
                                        }}
                                      />
                                    </label>

                                    {slotStats?.saved && (
                                      <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 break-anywhere">
                                        <Check className="w-3.5 h-3.5 shrink-0" />
                                        <span>
                                          {formatFileSize(slotStats.before)} &rarr;{' '}
                                          {formatFileSize(slotStats.after)} WebP · Saved
                                        </span>
                                      </p>
                                    )}

                                    {errMsg && (
                                      <p
                                        role="alert"
                                        className="text-[13px] font-medium text-rose-500 flex items-start gap-1 break-anywhere"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span>{errMsg}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* 6 Service photos */}
                          <div className="space-y-3 pt-4 border-t border-[var(--border-hairline)]">
                            <div>
                              <h4 className="text-base font-semibold text-[var(--text-primary)]">
                                Service photos (6 services)
                              </h4>
                              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                                Each service card shows its photo, or a coloured tile with an icon until you upload one.
                              </p>
                            </div>

                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3.5">
                              {DEFAULT_SERVICES.map((svc) => {
                                const slotKey = `service:${svc.key}`;
                                const photoUrl =
                                  siteSettings.service_images?.[svc.key] || '';
                                const busy = Boolean(photoSlotBusy[slotKey]);
                                const slotStats = photoSlotStats[slotKey];
                                const errMsg = photoSlotError[slotKey];

                                return (
                                  <div
                                    key={svc.key}
                                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 flex flex-col justify-between gap-2.5"
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                                          {svc.title}
                                        </span>
                                        {photoUrl && (
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              void handleRemoveWebsitePhoto(
                                                slotKey,
                                                (s) => ({
                                                  ...s,
                                                  service_images: {
                                                    ...(s.service_images || {}),
                                                    [svc.key]: '',
                                                  },
                                                })
                                              )
                                            }
                                            className="min-h-[44px] px-2 text-[13px] text-rose-500 hover:underline cursor-pointer shrink-0 disabled:opacity-50"
                                          >
                                            Remove
                                          </button>
                                        )}
                                      </div>

                                      {photoUrl ? (
                                        <div className="aspect-[16/9] rounded-lg overflow-hidden bg-[var(--bg-surface-muted)]">
                                          <img
                                            src={photoUrl}
                                            alt={svc.title}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <div className="aspect-[16/9] rounded-lg border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-center text-[13px] text-[var(--text-muted)]">
                                          Using coloured tile
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-1.5">
                                      <label
                                        className={`min-h-[44px] w-full px-3 py-2 rounded-lg border border-[var(--border-input)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)] text-[13px] font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 transition-colors ${
                                          busy ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                                        }`}
                                      >
                                        {busy ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)]" />
                                        ) : (
                                          <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                                        )}
                                        <span>{busy ? 'Saving...' : 'Replace'}</span>
                                        <input
                                          type="file"
                                          disabled={busy}
                                          accept="image/jpeg,image/png,image/webp,image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            void handleReplaceWebsitePhoto(
                                              slotKey,
                                              e.target.files,
                                              1200,
                                              (s, url) => ({
                                                ...s,
                                                service_images: {
                                                  ...(s.service_images || {}),
                                                  [svc.key]: url,
                                                },
                                              })
                                            );
                                            e.currentTarget.value = '';
                                          }}
                                        />
                                      </label>

                                      {slotStats?.saved && (
                                        <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 break-anywhere">
                                          <Check className="w-3.5 h-3.5 shrink-0" />
                                          <span>
                                            {formatFileSize(slotStats.before)} &rarr;{' '}
                                            {formatFileSize(slotStats.after)} WebP · Saved
                                          </span>
                                        </p>
                                      )}

                                      {errMsg && (
                                        <p
                                          role="alert"
                                          className="text-[13px] font-medium text-rose-500 flex items-start gap-1 break-anywhere"
                                        >
                                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                          <span>{errMsg}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Section 3: Team members */}
                    <section
                      id="settings-team-section"
                      className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                            Team members
                          </h2>
                          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                            Add staff or property advisors to introduce your Siliguri team on the homepage.
                          </p>
                        </div>
                        {editingTeamId && (
                          <button
                            type="button"
                            onClick={resetTeamForm}
                            className="min-h-[44px] px-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                          >
                            Cancel edit
                          </button>
                        )}
                      </div>

                      <form onSubmit={saveTeamMember} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            id="team-member-name-input"
                            type="text"
                            required
                            placeholder="Full name *"
                            value={aName}
                            onChange={(e) => setAName(e.target.value)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Role or job title *"
                            value={aPos}
                            onChange={(e) => setAPos(e.target.value)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                          />
                          <input
                            type="tel"
                            placeholder="Phone number"
                            value={aPhone}
                            onChange={(e) => setAPhone(e.target.value)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                          />
                          <input
                            type="tel"
                            placeholder="WhatsApp number"
                            value={aWhatsapp}
                            onChange={(e) => setAWhatsapp(e.target.value)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                          />
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Short introduction"
                          value={aBio}
                          onChange={(e) => setABio(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                        />
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-4">
                            <label
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] text-[13px] font-medium inline-flex items-center gap-2 ${
                                teamUploading
                                  ? 'opacity-60 cursor-wait'
                                  : 'cursor-pointer'
                              }`}
                            >
                              {teamUploading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)]" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {teamUploading
                                  ? 'Uploading...'
                                  : aPhoto
                                  ? 'Replace photo'
                                  : 'Upload photo'}
                              </span>
                              <input
                                type="file"
                                disabled={teamUploading}
                                accept="image/jpeg,image/png,image/webp,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  void handleTeamPhotoUpload(e.target.files);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </label>

                            {aPhoto && (
                              <img
                                src={aPhoto}
                                alt={
                                  aName.trim()
                                    ? `${aName.trim()} portrait preview`
                                    : 'Team preview'
                                }
                                loading="lazy"
                                decoding="async"
                                className="w-11 h-11 rounded-full object-cover object-top border border-[var(--border-hairline)]"
                              />
                            )}

                            <SwitchControl
                              checked={aVisible}
                              onChange={setAVisible}
                              label="Visible on website"
                            />

                            <div className="flex items-center gap-3 sm:ml-auto">
                              {teamSavedMsg && (
                                <span className="text-sm font-semibold text-emerald-500 inline-flex items-center gap-1">
                                  <Check className="w-4 h-4" />
                                  Saved
                                </span>
                              )}
                              <button
                                type="submit"
                                disabled={savingTeam}
                                className="btn-primary-lux min-h-[44px] px-5 py-2 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                              >
                                {savingTeam && (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                                <span>
                                  {editingTeamId ? 'Save' : 'Add team member'}
                                </span>
                              </button>
                            </div>
                          </div>

                          {teamCompressionNote && (
                            <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5 break-anywhere">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{teamCompressionNote}</span>
                            </p>
                          )}

                          {teamUploadError && (
                            <p
                              role="alert"
                              className="text-[13px] font-medium text-rose-500 flex items-start gap-1.5 break-anywhere"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{teamUploadError}</span>
                            </p>
                          )}
                        </div>
                      </form>

                      {agents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <p className="text-sm text-[var(--text-secondary)]">
                            No team members added yet. Until you add someone, the team section stays hidden on the website.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              document
                                .getElementById('team-member-name-input')
                                ?.focus()
                            }
                            className="min-h-[44px] px-4 rounded-full border border-[var(--border-input)] text-[13px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
                          >
                            <Plus className="w-4 h-4 text-[var(--accent-primary)]" />
                            <span>Add first member</span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3 pt-2 border-t border-[var(--border-hairline)]">
                          {agents.map((ag) => (
                            <div
                              key={ag.id}
                              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {ag.photo_url ? (
                                  <img
                                    src={ag.photo_url}
                                    alt={ag.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-11 h-11 rounded-full object-cover object-top shrink-0 bg-[var(--bg-surface-muted)]"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-full bg-[var(--bg-surface-muted)] flex items-center justify-center shrink-0">
                                    <UserCheck className="w-5 h-5 text-[var(--accent-primary)]" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                    {ag.name}
                                  </p>
                                  <p className="text-[13px] text-[var(--accent-primary)] truncate">
                                    {ag.position}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => void toggleTeamVisibility(ag)}
                                  aria-label={
                                    ag.is_active
                                      ? 'Hide from website'
                                      : 'Show on website'
                                  }
                                  title={
                                    ag.is_active ? 'Visible on website' : 'Hidden'
                                  }
                                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                  {ag.is_active ? (
                                    <Eye className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <EyeOff className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => editTeamMember(ag)}
                                  aria-label={`Edit ${ag.name}`}
                                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteTeamMember(ag)}
                                  aria-label={`Remove ${ag.name}`}
                                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Section 4: Social links */}
                    {siteSettings && (
                      <section
                        id="settings-social-section"
                        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-5"
                      >
                        <div>
                          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                            Social links
                          </h2>
                          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                            Shown in your website footer only when filled in.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              Instagram link
                            </label>
                            <input
                              type="url"
                              placeholder="https://instagram.com/..."
                              value={siteSettings.social_links.instagram}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        social_links: {
                                          ...s.social_links,
                                          instagram: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              Facebook link
                            </label>
                            <input
                              type="url"
                              placeholder="https://facebook.com/..."
                              value={siteSettings.social_links.facebook}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        social_links: {
                                          ...s.social_links,
                                          facebook: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              YouTube link
                            </label>
                            <input
                              type="url"
                              placeholder="https://youtube.com/..."
                              value={siteSettings.social_links.youtube}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        social_links: {
                                          ...s.social_links,
                                          youtube: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                              LinkedIn link
                            </label>
                            <input
                              type="url"
                              placeholder="https://linkedin.com/..."
                              value={siteSettings.social_links.linkedin}
                              onChange={(e) =>
                                setSiteSettings((s) =>
                                  s
                                    ? {
                                        ...s,
                                        social_links: {
                                          ...s.social_links,
                                          linkedin: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              }
                              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={savingSettingsSection === 'social'}
                            onClick={() => void handleSaveSettingsSection('social')}
                            className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                          >
                            {savingSettingsSection === 'social' && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            <span>
                              {savingSettingsSection === 'social'
                                ? 'Saving...'
                                : 'Save'}
                            </span>
                          </button>
                          {savedSection === 'social' && (
                            <span className="text-sm font-semibold text-emerald-500 inline-flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              Saved
                            </span>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Section 5: Google review link */}
                    {siteSettings && (
                      <section
                        id="settings-google-review-section"
                        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-5"
                      >
                        <div>
                          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                            Google review link
                          </h2>
                          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                            Paste your Google Maps or Google Business review link once. When you tap &ldquo;Ask for a review&rdquo; on Home, it automatically prepares a WhatsApp message with this link.
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor="google-review-link-input"
                            className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                          >
                            Google review link
                          </label>
                          <input
                            id="google-review-link-input"
                            type="url"
                            placeholder="https://g.page/r/..."
                            value={siteSettings.google_review_link || ''}
                            onChange={(e) =>
                              setSiteSettings((s) =>
                                s
                                  ? { ...s, google_review_link: e.target.value }
                                  : s
                              )
                            }
                            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={savingSettingsSection === 'googleReview'}
                            onClick={() =>
                              void handleSaveSettingsSection('googleReview')
                            }
                            className="btn-primary-lux min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                          >
                            {savingSettingsSection === 'googleReview' && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            <span>
                              {savingSettingsSection === 'googleReview'
                                ? 'Saving...'
                                : 'Save'}
                            </span>
                          </button>
                          {savedSection === 'googleReview' && (
                            <span className="text-sm font-semibold text-emerald-500 inline-flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              Saved
                            </span>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Section 6: Clients */}
                    <section
                      id="settings-clients-section"
                      className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-subtle)] space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                            Clients ({clients.length})
                          </h2>
                          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                            Visitors who have created an account on your website.
                          </p>
                        </div>
                      </div>

                      {clients.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-6 text-center space-y-3">
                          <Users className="w-8 h-8 mx-auto text-[var(--accent-primary)] opacity-80" />
                          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                            No client accounts yet. When buyers or tenants create an account to save properties or book site visits, their details appear here.
                          </p>
                          <a
                            href={shareWebsiteWaHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] px-5 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2"
                          >
                            <Share2 className="w-4 h-4 text-[var(--accent-primary)]" />
                            <span>Share website on WhatsApp</span>
                          </a>
                        </div>
                      ) : (
                        <div className="divide-y divide-[var(--border-hairline)]">
                          {clients.map((c) => {
                            const joinedText = formatReviewDate(c.created_at);
                            return (
                              <div
                                key={c.id}
                                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <p className="text-base font-semibold text-[var(--text-primary)] truncate">
                                    {c.full_name || 'Client'}
                                  </p>
                                  <p className="text-[13px] text-[var(--text-secondary)] break-anywhere tabular-nums">
                                    {c.phone || 'Phone not added'}
                                    {c.city ? ` · ${c.city}` : ''}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 shrink-0">
                                  {c.phone && (
                                    <a
                                      href={`tel:${c.phone.replace(/\s+/g, '')}`}
                                      className="min-h-[44px] px-4 rounded-full border border-[var(--border-hairline)] hover:border-[var(--border-strong)] text-[13px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 tabular-nums"
                                    >
                                      <Phone className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                                      <span>Call</span>
                                    </a>
                                  )}
                                  {joinedText && (
                                    <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
                                      Joined {joinedText}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Fixed Bottom 5-Tab Bar (100% visible, zero sideways scroll) */}
      <nav
        aria-label="Owner mobile tabs"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/96 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)] px-[env(safe-area-inset-left,0px)]"
      >
        {OWNER_TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          const count = attentionCounts[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchOwnerTab(key)}
              className={`relative min-h-[60px] min-w-0 px-0.5 py-2 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                active
                  ? 'text-[var(--accent-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5 shrink-0" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--cta-gold-bg)] text-[var(--cta-gold-ink)] text-[11px] font-bold tabular-nums flex items-center justify-center leading-none">
                    {count}
                  </span>
                )}
              </div>
              <span className="text-[clamp(0.75rem,3vw,0.8125rem)] tracking-[-0.015em] leading-none truncate max-w-full">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            key="confirm-dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={confirmDialog.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: LUX_EASE }}
            onClick={() => {
              if (!confirmBusy) setConfirmDialog(null);
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
          >
            <motion.div
              key="confirm-dialog-card"
              initial={
                prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }
              }
              animate={
                prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }
              }
              transition={{ duration: 0.22, ease: LUX_EASE }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-elevated)] p-6 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1 break-anywhere">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={() => setConfirmDialog(null)}
                  className="min-h-[44px] px-4 rounded-full border border-[var(--border-hairline)] text-sm font-medium text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={async () => {
                    setConfirmBusy(true);
                    try {
                      await confirmDialog.onConfirm();
                      setConfirmDialog(null);
                    } catch (err) {
                      showToast(
                        err instanceof Error
                          ? err.message
                          : 'Unable to complete action.',
                        'error'
                      );
                    } finally {
                      setConfirmBusy(false);
                    }
                  }}
                  className="min-h-[44px] px-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {confirmBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{confirmDialog.confirmLabel}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const OwnerUnifiedEnquiryCard: React.FC<{
  type: 'enquiry' | 'visit';
  name: string;
  email: string;
  phone: string;
  subject: string;
  visitSchedule?: string;
  propertySlug?: string;
  message: string;
  initialNote: string;
  status: UnifiedEnquiryStatus;
  createdAt: string;
  businessName: string;
  onOpenPropertyLink?: () => void;
  onSave: (status: UnifiedEnquiryStatus, note: string) => Promise<void>;
}> = ({
  type,
  name,
  email,
  phone,
  subject,
  visitSchedule,
  propertySlug,
  message,
  initialNote,
  status: initialStatus,
  createdAt,
  businessName,
  onOpenPropertyLink,
  onSave,
}) => {
  const [status, setStatus] = useState<UnifiedEnquiryStatus>(initialStatus);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote]);

  const relativeTime = formatRelativeTimeAgo(createdAt);
  const exactDate = formatReviewDate(createdAt);

  const waHref = formatWaHref(
    phone,
    type === 'visit'
      ? `Namaste ${name}, thank you for requesting a site visit for ${subject}${
          visitSchedule ? ` (${visitSchedule})` : ''
        }. This is ${businessName}. How can we assist you best?`
      : `Namaste ${name}, thank you for your enquiry about ${subject}. This is ${businessName}. Would you like to schedule a call or visit?`
  );

  return (
    <div className="lux-card-hover rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-subtle)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1 font-medium text-[var(--accent-primary)]">
              {type === 'visit' ? (
                <Calendar className="w-3.5 h-3.5" />
              ) : (
                <ClipboardList className="w-3.5 h-3.5" />
              )}
              <span>{type === 'visit' ? 'Site visit request' : 'Enquiry'}</span>
            </span>
            {relativeTime && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span
                  title={exactDate || undefined}
                  className="inline-flex items-center gap-1 tabular-nums text-[var(--text-secondary)] font-medium"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{relativeTime}</span>
                </span>
              </>
            )}
          </div>

          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] break-anywhere leading-snug">
            {name}
          </h2>

          <p className="text-sm text-[var(--text-secondary)] break-anywhere">
            {propertySlug ? (
              <Link
                to={`/properties/${propertySlug}`}
                onClick={onOpenPropertyLink}
                className="hover:text-[var(--accent-primary)] underline-offset-2 hover:underline font-medium"
              >
                {subject}
              </Link>
            ) : (
              <span className="font-medium">{subject}</span>
            )}
            {email ? ` · ${email}` : ''}
          </p>

          {visitSchedule && (
            <p className="text-sm font-semibold text-[var(--accent-primary)] tabular-nums">
              Preferred visit: {visitSchedule}
            </p>
          )}
        </div>

        {/* Colour-coded Status Chip Selector: New / Contacted / Done */}
        <div
          role="group"
          aria-label={`Status for ${name}`}
          className="inline-flex flex-wrap items-center gap-1.5 shrink-0 self-start"
        >
          {(['new', 'contacted', 'done'] as const).map((st) => {
            const active = status === st;
            return (
              <button
                key={st}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStatus(st);
                  void onSave(st, note);
                }}
                className={`min-h-[44px] px-3.5 rounded-full border text-[13px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${unifiedChipStyle(
                  st,
                  active
                )}`}
              >
                {active && <Check className="w-3.5 h-3.5" />}
                <span>{unifiedLabel(st)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed break-anywhere">
          {message}
        </p>
      )}

      {/* Big Call and WhatsApp Buttons */}
      {(phone || waHref) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {phone && (
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              className="min-h-[46px] px-5 rounded-full border border-[var(--border-input)] hover:border-[var(--border-strong)] bg-[var(--bg-canvas)] text-sm font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 tabular-nums"
            >
              <Phone className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Call {phone}</span>
            </a>
          )}
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary-lux min-h-[46px] px-5 rounded-full bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>
      )}

      {/* Private Note */}
      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[var(--border-hairline)]">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for yourself or the client..."
          aria-label={`Note for ${name}`}
          className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-base text-[var(--text-primary)]"
        />
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(status, note);
            setSaving(false);
            setJustSaved(true);
            window.setTimeout(() => setJustSaved(false), 2500);
          }}
          className="min-h-[44px] px-4 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Check className="w-4 h-4" />
          <span>{justSaved ? 'Saved' : 'Save note'}</span>
        </button>
      </div>
    </div>
  );
};
