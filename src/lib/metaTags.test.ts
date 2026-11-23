import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPropertyMetaTags,
  buildSiteMetaTags,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_SITE_TITLE,
  injectMetaIntoHtml,
  resolveAbsoluteUrl,
  resolveCanonicalUrl,
  resolveServerOrigin,
  truncateMetaText,
} from './metaTags';
import type { Property } from '../types/realty';

const sampleProperty: Property = {
  id: 'prop-1',
  slug: 'sevoke-road-3bhk-contemporary-residence',
  title: 'Sevoke Road 3 BHK Contemporary Residence',
  description:
    'Thoughtfully planned 3 BHK corner apartment near Sevoke Road with natural cross-ventilation, modular kitchen, and reserved covered parking.',
  price_inr: 7850000,
  listing_type: 'Buy',
  property_type: 'Flats / Apartments',
  location: 'Sevoke Road',
  address_detail: 'Sevoke Road, Ward 13, Siliguri',
  latitude: null,
  longitude: null,
  bedrooms: 3,
  bathrooms: 2,
  area_sqft: 1580,
  furnishing: 'Semi-Furnished',
  parking: '1 Covered Car Parking',
  status: 'Available',
  is_published: true,
  is_featured: true,
  is_demo: false,
  amenities: ['Lift', 'Power Backup'],
  images: [
    {
      id: 'img-1',
      property_id: 'prop-1',
      url: '/src/assets/images/prop_apartment_modern_1795102916667.jpg',
      caption: 'Sevoke Road 3 BHK Residence Exterior',
      sort_order: 0,
    },
  ],
  created_at: '2026-01-15T10:00:00.000Z',
  updated_at: '2026-01-15T10:00:00.000Z',
};

test('resolveServerOrigin prefers valid APP_URL over host headers', () => {
  assert.equal(
    resolveServerOrigin('https://debmalya.example.com/', 'http', 'localhost:3000'),
    'https://debmalya.example.com'
  );
  assert.equal(
    resolveServerOrigin('MY_APP_URL', 'https', 'example.run.app'),
    'https://example.run.app'
  );
  assert.equal(
    resolveServerOrigin(undefined, 'http', 'localhost:3000'),
    'http://localhost:3000'
  );
});

test('resolveCanonicalUrl and resolveAbsoluteUrl normalize paths and fall back safely', () => {
  assert.equal(
    resolveCanonicalUrl('/properties/my-home/?ref=wa#top', 'https://debmalya.in/'),
    'https://debmalya.in/properties/my-home'
  );
  assert.equal(
    resolveCanonicalUrl('/', 'https://debmalya.in/'),
    'https://debmalya.in/'
  );
  assert.equal(
    resolveAbsoluteUrl('/uploads/house.jpg', 'https://debmalya.in'),
    'https://debmalya.in/uploads/house.jpg'
  );
  assert.equal(
    resolveAbsoluteUrl('https://cdn.example.com/photo.jpg', 'https://debmalya.in'),
    'https://cdn.example.com/photo.jpg'
  );
  assert.equal(
    resolveAbsoluteUrl('data:image/png;base64,AAA', 'https://debmalya.in'),
    `https://debmalya.in${DEFAULT_OG_IMAGE_PATH}`
  );
});

test('truncateMetaText breaks cleanly on word boundaries', () => {
  const short = truncateMetaText('Hello Siliguri', 50);
  assert.equal(short, 'Hello Siliguri');

  const long = truncateMetaText(
    'Spacious contemporary apartment on Sevoke Road in Siliguri with landscaped terrace and covered parking.',
    60
  );
  assert.ok(long.length <= 60);
  assert.ok(long.endsWith('...'));
});

test('buildPropertyMetaTags generates rich OG, Twitter, canonical, and RealEstateListing JSON-LD', () => {
  const meta = buildPropertyMetaTags(sampleProperty, {
    origin: 'https://debmalya.in',
  });

  assert.equal(meta.title, 'Sevoke Road 3 BHK Contemporary Residence — Debmalya Realty');
  assert.ok(meta.ogTitle.includes('₹78.5 L'));
  assert.equal(meta.twitterCard, 'summary_large_image');
  assert.equal(meta.twitterTitle, meta.ogTitle);
  assert.equal(
    meta.canonicalUrl,
    'https://debmalya.in/properties/sevoke-road-3bhk-contemporary-residence'
  );
  assert.equal(meta.ogUrl, meta.canonicalUrl);
  assert.equal(
    meta.ogImage,
    'https://debmalya.in/src/assets/images/prop_apartment_modern_1795102916667.jpg'
  );
  assert.equal(meta.twitterImage, meta.ogImage);
  assert.equal(meta.ogImageAlt, 'Sevoke Road 3 BHK Residence Exterior');
  assert.ok(meta.description.length >= 120 && meta.description.length <= 160);
  assert.ok(meta.description.includes('3 BHK'));
  assert.ok(meta.description.includes('Sevoke Road'));
  assert.ok(meta.description.includes('₹78.5 L'));
  assert.equal(meta.robots, 'index, follow');

  assert.ok(meta.structuredData);
  assert.equal(meta.structuredData['@type'], 'RealEstateListing');
  assert.equal(
    (meta.structuredData.offers as Record<string, unknown>).price,
    7850000
  );
  assert.equal(
    (meta.structuredData.offers as Record<string, unknown>).priceCurrency,
    'INR'
  );
});

test('buildPropertyMetaTags handles rental plots without bedrooms or images cleanly', () => {
  const landProp: Property = {
    ...sampleProperty,
    id: 'prop-land',
    slug: 'bhanu-nagar-commercial-plot',
    title: 'Bhanu Nagar Corner Commercial Plot',
    description: 'Prime corner plot suitable for showroom or office lease.',
    price_inr: 45000,
    listing_type: 'Rent',
    property_type: 'Commercial Spaces',
    location: 'Bhanu Nagar',
    bedrooms: 0,
    bathrooms: 1,
    area_sqft: 2400,
    furnishing: 'Not Applicable',
    status: 'Upcoming',
    is_published: false,
    images: [],
  };

  const meta = buildPropertyMetaTags(landProp, {
    origin: 'https://debmalya.in',
  });

  assert.ok(!meta.description.includes('0 BHK'));
  assert.ok(meta.description.includes('for rent'));
  assert.ok(meta.description.includes('₹45,000/mo'));
  assert.equal(meta.ogImage, `https://debmalya.in${DEFAULT_OG_IMAGE_PATH}`);
  assert.equal(meta.robots, 'noindex, nofollow');
  assert.equal(
    (meta.structuredData?.offers as Record<string, unknown>).availability,
    'https://schema.org/PreOrder'
  );
});

test('buildSiteMetaTags resets cleanly to homepage defaults and supports noindex routes', () => {
  const homeMeta = buildSiteMetaTags({
    origin: 'https://debmalya.in',
    pathname: '/',
  });

  assert.equal(homeMeta.title, DEFAULT_SITE_TITLE);
  assert.equal(homeMeta.canonicalUrl, 'https://debmalya.in/');
  assert.equal(homeMeta.ogImage, `https://debmalya.in${DEFAULT_OG_IMAGE_PATH}`);
  assert.equal(homeMeta.robots, 'index, follow');
  assert.equal(homeMeta.structuredData, null);

  const privateMeta = buildSiteMetaTags({
    title: 'Owner Dashboard — Debmalya Realty',
    pathname: '/owner-login/dashboard',
    origin: 'https://debmalya.in',
    robots: 'noindex, nofollow',
  });
  assert.equal(privateMeta.robots, 'noindex, nofollow');
});

test('injectMetaIntoHtml replaces stale meta tags, escapes attributes/JSON-LD, and avoids duplicates', () => {
  const baseHtml = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Old Title</title>
    <meta name="description" content="Old description" />
    <meta property="og:title" content="Old OG" />
    <meta property="og:description" content="Old OG desc" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Debmalya Realty" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Old TW" />
    <meta name="twitter:description" content="Old TW desc" />
  </head>
  <body><div id="root"></div></body>
</html>`;

  const xssProp: Property = {
    ...sampleProperty,
    bedrooms: 0,
    area_sqft: 0,
    furnishing: 'Not Applicable',
    title: 'Villa "A" & <Garden>',
    description: 'Luxury "corner" villa <script>alert(1)</script> in Haiderpara.',
  };
  const meta = buildPropertyMetaTags(xssProp, { origin: 'https://debmalya.in' });
  const output = injectMetaIntoHtml(baseHtml, meta);

  assert.ok(!output.includes('Old Title'));
  assert.ok(!output.includes('Old OG'));
  assert.ok(!output.includes('<script>alert(1)</script>'));
  assert.ok(output.includes('&quot;A&quot; &amp; &lt;Garden&gt;'));
  assert.ok(output.includes('\\u003cscript>'));
  assert.equal((output.match(/<title>/g) || []).length, 1);
  assert.equal((output.match(/property="og:image"/g) || []).length, 1);
  assert.equal((output.match(/name="twitter:image"/g) || []).length, 1);
  assert.equal((output.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((output.match(/id="dynamic-page-jsonld"/g) || []).length, 1);
});
