import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Property, PropertyImage, WebsiteSettings } from '../src/types/realty.ts';

function ensureWritableDir(preferred: string, fallback: string): string {
  try {
    if (!fs.existsSync(preferred)) fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

const DATA_DIR = ensureWritableDir(
  path.resolve(process.cwd(), 'data'),
  '/tmp/debmalya-data'
);
export const UPLOADS_DIR = ensureWritableDir(
  path.resolve(process.cwd(), 'uploads'),
  '/tmp/debmalya-uploads'
);

const DB_PATH = path.join(DATA_DIR, 'debmalya.sqlite');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export const DEFAULT_SETTINGS: WebsiteSettings = {
  business_name: 'Debmalya Realty',
  tagline: 'High-End Builder & Property Consultant | Buy • Sell • Rent with Confidence.',
  description:
    'Your trusted partner for construction, property buying, selling, and rental services. We specialize in creating modern landmarks with quality construction, transparent dealings, and customer-focused solutions. Whether you are looking to build your dream project, buy a property, sell your land or flat, or find the perfect rental space, our team is committed to delivering reliable and professional service with complete trust and satisfaction.',
  address:
    'Sevoke Road, Ward Number 13, Dasrath Pally, Bhanu Nagar, Siliguri, West Bengal 734001.',
  phone: '+91 86498 58954',
  whatsapp: '918649858954',
  logo_url: '',
  hero_headline: "Find a Place You'll Love to Call Home.",
  hero_subheadline:
    'Discover exceptional properties in Siliguri. Whether you want to buy, sell, rent, or build, Debmalya Realty is here to help.',
  hero_image_url: '/src/assets/images/hero_siliguri_villa_1795102916572.jpg',
  about_image_url: '/src/assets/images/about_siliguri_construction_1795235945880.jpg',
  operating_hours: {
    monday: '9:00 AM – 9:30 PM',
    tuesday: '10:00 AM – 10:00 PM',
    wednesday: '9:00 AM – 9:30 PM',
    thursday_sunday: '9:00 AM – 5:00 PM',
  },
  locations: [
    'Siliguri',
    'Sevoke Road',
    'Bhanu Nagar',
    'Haiderpara',
    'Gugni More',
  ],
  property_types: [
    'Flats / Apartments',
    'Villas',
    'Houses',
    'Residential Plots',
    'Land',
    'Commercial Spaces',
  ],
  social_links: {
    instagram: '',
    facebook: '',
    youtube: '',
    linkedin: '',
  },
};

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Siliguri',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'customer')) DEFAULT 'customer',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price_inr INTEGER NOT NULL,
      listing_type TEXT NOT NULL CHECK (listing_type IN ('Buy', 'Rent')),
      property_type TEXT NOT NULL,
      location TEXT NOT NULL,
      address_detail TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      bedrooms INTEGER NOT NULL DEFAULT 0,
      bathrooms INTEGER NOT NULL DEFAULT 0,
      area_sqft INTEGER NOT NULL DEFAULT 0,
      furnishing TEXT NOT NULL DEFAULT 'Unfurnished',
      parking TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('Available', 'Sold', 'Rented', 'Under Construction', 'Upcoming')) DEFAULT 'Available',
      is_published INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS property_images (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS property_amenities (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      amenity TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_preferences (
      user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      preferred_location TEXT NOT NULL DEFAULT 'All',
      property_type TEXT NOT NULL DEFAULT 'All',
      listing_type TEXT NOT NULL CHECK (listing_type IN ('Buy', 'Rent', 'Both')) DEFAULT 'Buy',
      min_budget INTEGER,
      max_budget INTEGER,
      min_bedrooms INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      notify_matches INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, property_id)
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      query TEXT NOT NULL DEFAULT '',
      listing_type TEXT NOT NULL DEFAULT 'All',
      property_type TEXT NOT NULL DEFAULT 'All',
      location TEXT NOT NULL DEFAULT 'All',
      min_price INTEGER,
      max_price INTEGER,
      min_bedrooms INTEGER,
      furnishing TEXT NOT NULL DEFAULT 'All',
      sort_by TEXT NOT NULL DEFAULT 'newest',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      interested_in TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Request Submitted', 'Under Review', 'Contacted', 'Appointment Scheduled', 'Completed')) DEFAULT 'Request Submitted',
      owner_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT NOT NULL,
      proposed_date TEXT,
      proposed_time TEXT,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rescheduled', 'Rejected', 'Completed')) DEFAULT 'Pending',
      owner_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS booking_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      offer_notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('Pending Review', 'Under Discussion', 'Confirmed Next Step', 'Declined')) DEFAULT 'Pending Review',
      owner_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      reviewer_name TEXT NOT NULL,
      reviewer_email TEXT NOT NULL DEFAULT '',
      customer_type TEXT NOT NULL DEFAULT 'Client',
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review_text TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('direct', 'imported')) DEFAULT 'direct',
      source_label TEXT NOT NULL DEFAULT 'Submitted via Website',
      avatar_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')) DEFAULT 'pending',
      is_featured INTEGER NOT NULL DEFAULT 0,
      review_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      whatsapp TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      link_url TEXT NOT NULL DEFAULT '/my-account',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS website_settings (
      id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const existingSettings = db
    .prepare('SELECT id, settings_json FROM website_settings WHERE id = ?')
    .get('default') as { id: string; settings_json: string } | undefined;
  if (!existingSettings) {
    db.prepare(
      'INSERT INTO website_settings (id, settings_json, updated_at) VALUES (?, ?, ?)'
    ).run('default', JSON.stringify(DEFAULT_SETTINGS), new Date().toISOString());
  } else {
    try {
      const parsed = JSON.parse(existingSettings.settings_json);
      if (
        parsed.about_image_url ===
        '/src/assets/images/about_architecture_studio_1795102916292.jpg'
      ) {
        parsed.about_image_url =
          '/src/assets/images/about_siliguri_construction_1795235945880.jpg';
        db.prepare(
          'UPDATE website_settings SET settings_json = ?, updated_at = ? WHERE id = ?'
        ).run(JSON.stringify(parsed), new Date().toISOString(), 'default');
      }
    } catch {
      // ignore malformed settings JSON
    }
  }

  const propCount = db
    .prepare('SELECT COUNT(*) as c FROM properties')
    .get() as { c: number };
  if (propCount.c === 0) {
    seedDemoProperties();
  } else {
    db.prepare(
      `UPDATE property_images
       SET url = '/src/assets/images/prop_gugni_house_1795235403197.jpg'
       WHERE property_id = 'demo-gugni-more-upcoming-house'
         AND sort_order = 0
         AND url = '/src/assets/images/hero_siliguri_villa_1795102916572.jpg'`
    ).run();
  }
}

function seedDemoProperties(): void {
  const now = new Date().toISOString();
  const demos = [
    {
      id: 'demo-sevoke-skyline-3bhk',
      slug: 'sevoke-road-3bhk-contemporary-residence',
      title: '3 BHK Contemporary Balcony Residence — Sevoke Road',
      description:
        'Sample portfolio listing: Sun-filled 3 BHK apartment positioned off Sevoke Road with wide landscaped balcony views, travertine-style vitrified flooring, modular kitchen provision, and dedicated covered car parking. Ideal for families seeking central Siliguri connectivity.',
      price_inr: 6850000,
      listing_type: 'Buy',
      property_type: 'Flats / Apartments',
      location: 'Sevoke Road',
      address_detail: 'Near Ward 13 Corridor, Sevoke Road, Siliguri',
      latitude: 26.7315,
      longitude: 88.4317,
      bedrooms: 3,
      bathrooms: 2,
      area_sqft: 1580,
      furnishing: 'Semi-Furnished',
      parking: '1 Covered Car Parking',
      status: 'Available',
      is_published: 1,
      is_featured: 1,
      is_demo: 1,
      amenities: [
        'Passenger Lift',
        'Power Backup',
        '24x7 Security',
        'Landscaped Balcony',
        'Intercom Facility',
      ],
      images: [
        '/src/assets/images/prop_sevoke_apartment_1795102917013.jpg',
        '/src/assets/images/prop_interior_suite_1795102917447.jpg',
      ],
    },
    {
      id: 'demo-bhanu-nagar-duplex',
      slug: 'bhanu-nagar-independent-duplex-villa',
      title: '4 BHK Independent Duplex Villa — Bhanu Nagar',
      description:
        'Sample portfolio listing: Architect-planned independent two-story residence in peaceful Bhanu Nagar featuring limestone-inspired elevation, timber louver shading, private landscaped courtyard, and dual vehicle parking.',
      price_inr: 13500000,
      listing_type: 'Buy',
      property_type: 'Villas',
      location: 'Bhanu Nagar',
      address_detail: 'Dasrath Pally, Bhanu Nagar, Siliguri 734001',
      latitude: 26.7279,
      longitude: 88.4368,
      bedrooms: 4,
      bathrooms: 4,
      area_sqft: 2650,
      furnishing: 'Semi-Furnished',
      parking: '2 Covered Parking Bays',
      status: 'Available',
      is_published: 1,
      is_featured: 1,
      is_demo: 1,
      amenities: [
        'Private Garden Courtyard',
        'Modular Kitchen',
        'Solar Water Heating Provision',
        'Rainwater Harvesting',
        'CCTV Perimeter',
      ],
      images: [
        '/src/assets/images/prop_bhanu_house_1795102916929.jpg',
        '/src/assets/images/hero_siliguri_villa_1795102916572.jpg',
      ],
    },
    {
      id: 'demo-haiderpara-residential-plot',
      slug: 'haiderpara-gated-residential-plot',
      title: 'Gated Residential Corner Plot — Haiderpara',
      description:
        'Sample portfolio listing: Clear-title residential land parcel with paved internal avenue access, perimeter boundary wall, drainage readiness, and serene foothill backdrop in Haiderpara.',
      price_inr: 4400000,
      listing_type: 'Buy',
      property_type: 'Residential Plots',
      location: 'Haiderpara',
      address_detail: 'Haiderpara Main Approach, Siliguri',
      latitude: 26.7124,
      longitude: 88.4419,
      bedrooms: 0,
      bathrooms: 0,
      area_sqft: 2880,
      furnishing: 'Not Applicable',
      parking: 'Private Driveway Scope',
      status: 'Available',
      is_published: 1,
      is_featured: 1,
      is_demo: 1,
      amenities: [
        '24 ft Paved Road',
        'Boundary Wall',
        'Electricity Pole Ready',
        'Stormwater Drainage',
      ],
      images: [
        '/src/assets/images/prop_haiderpara_plot_1795102917179.jpg',
      ],
    },
    {
      id: 'demo-siliguri-penthouse-rent',
      slug: 'sevoke-corridor-furnished-2bhk-rental',
      title: 'Furnished Executive 2 BHK Suite — Siliguri Central',
      description:
        'Sample portfolio listing: Move-in-ready furnished apartment ideal for executives and small families, featuring custom island dining, warm oak cabinetry, high-speed fiber readiness, and quick access to Sevoke Road.',
      price_inr: 28000,
      listing_type: 'Rent',
      property_type: 'Flats / Apartments',
      location: 'Siliguri',
      address_detail: 'Central Residential Pocket, Siliguri',
      latitude: 26.7271,
      longitude: 88.4253,
      bedrooms: 2,
      bathrooms: 2,
      area_sqft: 1180,
      furnishing: 'Fully Furnished',
      parking: '1 Reserved Car Space',
      status: 'Available',
      is_published: 1,
      is_featured: 1,
      is_demo: 1,
      amenities: [
        'Fully Equipped Kitchen',
        'Air Conditioning',
        'Lift Access',
        'Power Backup',
      ],
      images: [
        '/src/assets/images/prop_interior_suite_1795102917447.jpg',
        '/src/assets/images/prop_sevoke_apartment_1795102917013.jpg',
      ],
    },
    {
      id: 'demo-gugni-more-upcoming-house',
      slug: 'gugni-more-custom-build-3bhk-house',
      title: '3 BHK Architectural Independent Home — Gugni More',
      description:
        'Sample portfolio listing: Under-construction turnkey residential build near Gugni More offering customizable interior finishes, vaastu-aligned layout, and structural engineering supervision by Debmalya Realty.',
      price_inr: 7900000,
      listing_type: 'Buy',
      property_type: 'Houses',
      location: 'Gugni More',
      address_detail: 'Gugni More Connectivity Zone, Siliguri',
      latitude: 26.7042,
      longitude: 88.4501,
      bedrooms: 3,
      bathrooms: 3,
      area_sqft: 1950,
      furnishing: 'Unfurnished',
      parking: '2 Car Driveway',
      status: 'Under Construction',
      is_published: 1,
      is_featured: 0,
      is_demo: 1,
      amenities: [
        'Custom Interior Option',
        'Earthquake-Resistant RCC Frame',
        'Terrace Lounge',
        'Private Borewell & Tank',
      ],
      images: [
        '/src/assets/images/prop_gugni_house_1795235403197.jpg',
        '/src/assets/images/prop_bhanu_house_1795102916929.jpg',
      ],
    },
  ];

  const insertProp = db.prepare(`
    INSERT INTO properties (
      id, slug, title, description, price_inr, listing_type, property_type,
      location, address_detail, latitude, longitude, bedrooms, bathrooms,
      area_sqft, furnishing, parking, status, is_published, is_featured, is_demo,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertImg = db.prepare(
    'INSERT INTO property_images (id, property_id, url, caption, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const insertAmenity = db.prepare(
    'INSERT INTO property_amenities (id, property_id, amenity) VALUES (?, ?, ?)'
  );

  for (const item of demos) {
    insertProp.run(
      item.id,
      item.slug,
      item.title,
      item.description,
      item.price_inr,
      item.listing_type,
      item.property_type,
      item.location,
      item.address_detail,
      item.latitude,
      item.longitude,
      item.bedrooms,
      item.bathrooms,
      item.area_sqft,
      item.furnishing,
      item.parking,
      item.status,
      item.is_published,
      item.is_featured,
      item.is_demo,
      now,
      now
    );
    item.images.forEach((url, idx) => {
      insertImg.run(crypto.randomUUID(), item.id, url, item.title, idx);
    });
    item.amenities.forEach((amenity) => {
      insertAmenity.run(crypto.randomUUID(), item.id, amenity);
    });
  }
}

export function getWebsiteSettings(): WebsiteSettings {
  const row = db
    .prepare('SELECT settings_json FROM website_settings WHERE id = ?')
    .get('default') as { settings_json: string } | undefined;
  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings_json) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function hydrateProperties(rows: Record<string, unknown>[]): Property[] {
  if (rows.length === 0) return [];
  const allImages = db
    .prepare('SELECT * FROM property_images ORDER BY sort_order ASC')
    .all() as unknown as PropertyImage[];
  const allAmenities = db
    .prepare('SELECT property_id, amenity FROM property_amenities')
    .all() as { property_id: string; amenity: string }[];

  const imgMap = new Map<string, PropertyImage[]>();
  for (const img of allImages) {
    const arr = imgMap.get(img.property_id) || [];
    arr.push(img);
    imgMap.set(img.property_id, arr);
  }

  const amenMap = new Map<string, string[]>();
  for (const row of allAmenities) {
    const arr = amenMap.get(row.property_id) || [];
    arr.push(row.amenity);
    amenMap.set(row.property_id, arr);
  }

  return rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    description: String(r.description),
    price_inr: Number(r.price_inr),
    listing_type: r.listing_type as Property['listing_type'],
    property_type: String(r.property_type),
    location: String(r.location),
    address_detail: String(r.address_detail || ''),
    latitude: r.latitude !== null ? Number(r.latitude) : null,
    longitude: r.longitude !== null ? Number(r.longitude) : null,
    bedrooms: Number(r.bedrooms),
    bathrooms: Number(r.bathrooms),
    area_sqft: Number(r.area_sqft),
    furnishing: r.furnishing as Property['furnishing'],
    parking: String(r.parking || ''),
    status: r.status as Property['status'],
    is_published: Boolean(r.is_published),
    is_featured: Boolean(r.is_featured),
    is_demo: Boolean(r.is_demo),
    amenities: amenMap.get(String(r.id)) || [],
    images: imgMap.get(String(r.id)) || [],
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
}

export function createNotification(params: {
  user_id: string;
  title: string;
  message: string;
  type: 'inquiry' | 'appointment' | 'booking' | 'property_match' | 'system';
  link_url?: string;
}): void {
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, message, type, link_url, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    crypto.randomUUID(),
    params.user_id,
    params.title,
    params.message,
    params.type,
    params.link_url || '/my-account',
    new Date().toISOString()
  );
}
