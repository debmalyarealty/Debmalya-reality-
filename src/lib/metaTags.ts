import type { Property, WebsiteSettings } from '../types/realty';
import { formatINR } from './realtyLogic';

export const SITE_NAME = 'Debmalya Realty';
export const DEFAULT_SITE_TITLE =
  'Debmalya Realty — Siliguri Real Estate & Construction';
export const DEFAULT_SITE_DESCRIPTION =
  'Debmalya Realty is a high-end builder and property consultant in Siliguri, West Bengal. Buy, sell, rent, or construct residential and commercial properties with confidence.';
export const DEFAULT_OG_DESCRIPTION =
  'Discover curated homes, apartments, residential plots, and construction consultancy across Siliguri, Sevoke Road, Bhanu Nagar, and Haiderpara.';
export const DEFAULT_TWITTER_DESCRIPTION =
  'High-End Builder & Property Consultant in Siliguri | Buy • Sell • Rent with Confidence.';
export const DEFAULT_OG_IMAGE_PATH =
  '/src/assets/images/hero_siliguri_villa_1795102916572.jpg';

export interface PageMetaConfig {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogType: 'website' | 'article';
  ogSiteName: string;
  ogUrl: string;
  ogImage: string;
  ogImageAlt: string;
  twitterCard: 'summary_large_image' | 'summary';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterImageAlt: string;
  robots: string;
  structuredData: Record<string, unknown> | null;
}

export function normalizeOrigin(origin?: string | null): string {
  if (!origin) return '';
  const trimmed = origin.trim();
  if (!trimmed || trimmed === 'MY_APP_URL') return '';
  return trimmed.replace(/\/+$/, '');
}

export function resolveClientOrigin(): string {
  if (typeof window === 'undefined' || !window.location?.origin) return '';
  return normalizeOrigin(window.location.origin);
}

export function resolveServerOrigin(
  appUrl: string | undefined,
  protocol: string | undefined,
  host: string | undefined
): string {
  const configured = normalizeOrigin(appUrl);
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  const safeHost = (host || '').trim();
  if (!safeHost) return '';
  const safeProto = (protocol || 'https').replace(/:$/, '');
  return normalizeOrigin(`${safeProto}://${safeHost}`);
}

export function resolveCanonicalUrl(pathname: string, origin?: string | null): string {
  const cleanOrigin = normalizeOrigin(origin);
  let cleanPath = (pathname || '/').split('?')[0].split('#')[0].trim();
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }
  if (cleanPath.length > 1) {
    cleanPath = cleanPath.replace(/\/+$/, '');
  }
  return cleanOrigin ? `${cleanOrigin}${cleanPath}` : cleanPath;
}

export function resolveAbsoluteUrl(
  pathOrUrl: string | undefined | null,
  origin?: string | null,
  fallbackPath: string = DEFAULT_OG_IMAGE_PATH
): string {
  const cleanOrigin = normalizeOrigin(origin);
  const candidate = (pathOrUrl || '').trim();

  // Social link-preview crawlers cannot fetch inline data: URIs or empty values
  const effective =
    !candidate || candidate.startsWith('data:') ? fallbackPath : candidate;

  if (/^https?:\/\//i.test(effective)) {
    return effective;
  }
  const normalizedPath = effective.startsWith('/') ? effective : `/${effective}`;
  return cleanOrigin ? `${cleanOrigin}${normalizedPath}` : normalizedPath;
}

export function truncateMetaText(text: string, maxLen: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  const slice = cleaned.slice(0, Math.max(0, maxLen - 3));
  const lastSpace = slice.lastIndexOf(' ');
  const cutoff = lastSpace > Math.floor(maxLen * 0.55) ? lastSpace : slice.length;
  const trimmed = slice
    .slice(0, cutoff)
    .trimEnd()
    .replace(/[-–—,|•:;]+$/g, '')
    .trimEnd();
  return `${trimmed}...`;
}

export interface SiteMetaOptions {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  image?: string;
  imageAlt?: string;
  pathname?: string;
  origin?: string | null;
  robots?: string;
  siteName?: string;
  structuredData?: Record<string, unknown> | null;
}

export function buildSiteMetaTags(options: SiteMetaOptions = {}): PageMetaConfig {
  const siteName = (options.siteName || SITE_NAME).trim() || SITE_NAME;
  const origin = options.origin !== undefined ? options.origin : resolveClientOrigin();
  const pathname =
    options.pathname !== undefined
      ? options.pathname
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '/';

  const title = options.title || DEFAULT_SITE_TITLE;
  const description = options.description || DEFAULT_SITE_DESCRIPTION;
  const ogTitle = options.ogTitle || title;
  const ogDescription = options.ogDescription || description || DEFAULT_OG_DESCRIPTION;
  const twitterTitle = options.twitterTitle || ogTitle;
  const twitterDescription =
    options.twitterDescription || description || DEFAULT_TWITTER_DESCRIPTION;

  const canonicalUrl = resolveCanonicalUrl(pathname, origin);
  const imageUrl = resolveAbsoluteUrl(
    options.image || DEFAULT_OG_IMAGE_PATH,
    origin,
    DEFAULT_OG_IMAGE_PATH
  );
  const imageAlt =
    options.imageAlt || `${siteName} — Siliguri Real Estate & Construction`;

  return {
    title,
    description,
    canonicalUrl,
    ogTitle,
    ogDescription,
    ogType: 'website',
    ogSiteName: siteName,
    ogUrl: canonicalUrl,
    ogImage: imageUrl,
    ogImageAlt: imageAlt,
    twitterCard: 'summary_large_image',
    twitterTitle,
    twitterDescription,
    twitterImage: imageUrl,
    twitterImageAlt: imageAlt,
    robots: options.robots || 'index, follow',
    structuredData: options.structuredData ?? null,
  };
}

function mapPropertyAvailabilitySchema(status: Property['status']): string {
  if (status === 'Sold' || status === 'Rented') {
    return 'https://schema.org/SoldOut';
  }
  if (status === 'Under Construction' || status === 'Upcoming') {
    return 'https://schema.org/PreOrder';
  }
  return 'https://schema.org/InStock';
}

export function buildPropertyStructuredData(
  property: Property,
  canonicalUrl: string,
  imageUrl: string,
  description: string,
  settings?: Partial<WebsiteSettings> | null
): Record<string, unknown> {
  const businessName = settings?.business_name?.trim() || SITE_NAME;
  const phone = settings?.phone?.trim() || '+91 86498 58954';
  const street =
    property.address_detail?.trim() || property.location || 'Siliguri';

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description,
    url: canonicalUrl,
    image: imageUrl,
    datePosted: property.created_at,
    address: {
      '@type': 'PostalAddress',
      streetAddress: street,
      addressLocality: property.location || 'Siliguri',
      addressRegion: 'West Bengal',
      addressCountry: 'IN',
    },
    offers: {
      '@type': 'Offer',
      price: property.price_inr,
      priceCurrency: 'INR',
      availability: mapPropertyAvailabilitySchema(property.status),
      url: canonicalUrl,
      seller: {
        '@type': 'RealEstateAgent',
        name: businessName,
        telephone: phone,
      },
    },
  };

  if (property.bedrooms > 0) {
    data.numberOfRooms = property.bedrooms;
  }
  if (property.area_sqft > 0) {
    data.floorSize = {
      '@type': 'QuantitativeValue',
      value: property.area_sqft,
      unitCode: 'FTK',
    };
  }

  return data;
}

export interface PropertyMetaOptions {
  origin?: string | null;
  pathname?: string;
  settings?: Partial<WebsiteSettings> | null;
}

export function buildPropertyMetaTags(
  property: Property,
  options: PropertyMetaOptions = {}
): PageMetaConfig {
  const settings = options.settings || null;
  const siteName = settings?.business_name?.trim() || SITE_NAME;
  const origin = options.origin !== undefined ? options.origin : resolveClientOrigin();
  const pathname = options.pathname || `/properties/${property.slug}`;
  const fallbackImage = settings?.hero_image_url || DEFAULT_OG_IMAGE_PATH;

  const compactPrice = formatINR(property.price_inr, property.listing_type, true);
  const actionLabel = property.listing_type === 'Rent' ? 'for rent' : 'for sale';

  // Keep <title> concise and branded while preserving readable property title
  const rawTitlePrefix =
    property.title.trim().length <= 54
      ? property.title.trim()
      : truncateMetaText(property.title, 48);
  const title = `${rawTitlePrefix} — ${siteName}`;

  // Rich social title keeps both compact INR price and brand visible without clipping brand
  const socialPrefix =
    property.title.trim().length <= 48
      ? property.title.trim()
      : truncateMetaText(property.title, 46);
  const socialTitle = `${socialPrefix} (${compactPrice}) | ${siteName}`;

  // Build accurate, compelling 120–160 char description strictly from real property fields
  const specParts: string[] = [];
  if (property.bedrooms > 0) specParts.push(`${property.bedrooms} BHK`);
  specParts.push(property.property_type);
  if (property.area_sqft > 0) {
    specParts.push(`${property.area_sqft.toLocaleString('en-IN')} sq. ft.`);
  }
  if (property.furnishing && property.furnishing !== 'Not Applicable') {
    specParts.push(property.furnishing);
  }

  const leadSentence = `${specParts.join(' • ')} ${actionLabel} in ${property.location}, Siliguri at ${compactPrice}.`;
  const cleanBody = (property.description || '')
    .replace(/^sample portfolio listing:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cta = `Schedule a site visit with ${siteName}.`;
  const conciseDesc = `${leadSentence} ${cta}`;
  const description =
    conciseDesc.length >= 120 && conciseDesc.length <= 160
      ? conciseDesc
      : cleanBody
        ? truncateMetaText(`${leadSentence} ${cleanBody} ${cta}`, 158)
        : truncateMetaText(conciseDesc, 158);

  const canonicalUrl = resolveCanonicalUrl(pathname, origin);
  const primaryImage = property.images?.[0];
  const imageUrl = resolveAbsoluteUrl(primaryImage?.url, origin, fallbackImage);
  const imageAlt =
    primaryImage?.caption?.trim() ||
    `${property.title} in ${property.location}, Siliguri — ${siteName}`;

  const structuredData = buildPropertyStructuredData(
    property,
    canonicalUrl,
    imageUrl,
    description,
    settings
  );

  return {
    title,
    description,
    canonicalUrl,
    ogTitle: socialTitle,
    ogDescription: description,
    ogType: 'website',
    ogSiteName: siteName,
    ogUrl: canonicalUrl,
    ogImage: imageUrl,
    ogImageAlt: imageAlt,
    twitterCard: 'summary_large_image',
    twitterTitle: socialTitle,
    twitterDescription: description,
    twitterImage: imageUrl,
    twitterImageAlt: imageAlt,
    robots: property.is_published ? 'index, follow' : 'noindex, nofollow',
    structuredData,
  };
}

function upsertMetaTag(
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attrName}="${attrValue}"]`
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLinkTag(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function applyDocumentMeta(config: PageMetaConfig): void {
  if (typeof document === 'undefined' || !document.head) return;

  document.title = config.title;
  upsertMetaTag('name', 'description', config.description);
  upsertMetaTag('name', 'robots', config.robots);
  upsertLinkTag('canonical', config.canonicalUrl);

  upsertMetaTag('property', 'og:type', config.ogType);
  upsertMetaTag('property', 'og:site_name', config.ogSiteName);
  upsertMetaTag('property', 'og:title', config.ogTitle);
  upsertMetaTag('property', 'og:description', config.ogDescription);
  upsertMetaTag('property', 'og:url', config.ogUrl);
  upsertMetaTag('property', 'og:image', config.ogImage);
  upsertMetaTag('property', 'og:image:alt', config.ogImageAlt);

  upsertMetaTag('name', 'twitter:card', config.twitterCard);
  upsertMetaTag('name', 'twitter:title', config.twitterTitle);
  upsertMetaTag('name', 'twitter:description', config.twitterDescription);
  upsertMetaTag('name', 'twitter:image', config.twitterImage);
  upsertMetaTag('name', 'twitter:image:alt', config.twitterImageAlt);

  const scriptId = 'dynamic-page-jsonld';
  const existingScript = document.getElementById(scriptId);
  if (config.structuredData) {
    const scriptEl =
      existingScript instanceof HTMLScriptElement
        ? existingScript
        : document.createElement('script');
    scriptEl.id = scriptId;
    scriptEl.type = 'application/ld+json';
    scriptEl.textContent = JSON.stringify(config.structuredData);
    if (!existingScript) {
      document.head.appendChild(scriptEl);
    }
  } else if (existingScript) {
    existingScript.remove();
  }
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function renderServerMetaTags(config: PageMetaConfig): string {
  const lines = [
    `<title>${escapeHtmlText(config.title)}</title>`,
    `<meta name="description" content="${escapeHtmlAttr(config.description)}" />`,
    `<meta name="robots" content="${escapeHtmlAttr(config.robots)}" />`,
    `<link rel="canonical" href="${escapeHtmlAttr(config.canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(config.ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(config.ogDescription)}" />`,
    `<meta property="og:type" content="${escapeHtmlAttr(config.ogType)}" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(config.ogSiteName)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(config.ogUrl)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(config.ogImage)}" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(config.ogImageAlt)}" />`,
    `<meta name="twitter:card" content="${escapeHtmlAttr(config.twitterCard)}" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(config.twitterTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(config.twitterDescription)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(config.twitterImage)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtmlAttr(config.twitterImageAlt)}" />`,
  ];

  if (config.structuredData) {
    lines.push(
      `<script id="dynamic-page-jsonld" type="application/ld+json">${escapeJsonLd(config.structuredData)}</script>`
    );
  }

  return lines.map((line) => `    ${line}`).join('\n');
}

const MANAGED_TAG_PATTERNS: RegExp[] = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\b[^>]*\bname=["'](?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image|twitter:image:alt)["'][^>]*\/?>\s*/gi,
  /<meta\b[^>]*\bproperty=["'](?:og:title|og:description|og:type|og:site_name|og:url|og:image|og:image:alt)["'][^>]*\/?>\s*/gi,
  /<link\b[^>]*\brel=["']canonical["'][^>]*\/?>\s*/gi,
  /<script\b[^>]*\bid=["']dynamic-page-jsonld["'][^>]*>[\s\S]*?<\/script>\s*/gi,
];

export function injectMetaIntoHtml(html: string, config: PageMetaConfig): string {
  let cleaned = html;
  for (const pattern of MANAGED_TAG_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  const block = renderServerMetaTags(config);
  const viewportMatch = cleaned.match(/<meta\b[^>]*\bname=["']viewport["'][^>]*\/?>/i);
  if (viewportMatch && viewportMatch.index !== undefined) {
    const insertPos = viewportMatch.index + viewportMatch[0].length;
    return `${cleaned.slice(0, insertPos)}\n${block}${cleaned.slice(insertPos)}`;
  }

  const headCloseIdx = cleaned.search(/<\/head>/i);
  if (headCloseIdx !== -1) {
    return `${cleaned.slice(0, headCloseIdx)}${block}\n  ${cleaned.slice(headCloseIdx)}`;
  }

  return `${block}\n${cleaned}`;
}
