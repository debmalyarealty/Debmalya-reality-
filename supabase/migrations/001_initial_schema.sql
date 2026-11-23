-- ============================================================================
-- Debmalya Realty — Complete Supabase Schema, Trigger, RLS & Storage Script
-- Safe to re-run in the Supabase SQL Editor (uses IF NOT EXISTS / DROP IF EXISTS)
-- ============================================================================

-- 0. Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Profiles (1:1 with auth.users; holds app role 'owner' | 'client')
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Siliguri',
  role TEXT NOT NULL CHECK (role IN ('owner', 'client')) DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties catalog
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price BIGINT NOT NULL CHECK (price >= 0),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('buy', 'rent')),
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  address_detail TEXT NOT NULL DEFAULT '',
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  area_sqft INTEGER NOT NULL DEFAULT 0,
  furnishing TEXT NOT NULL DEFAULT 'Unfurnished',
  parking TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('available', 'under construction', 'sold', 'rented')) DEFAULT 'available',
  images TEXT[] NOT NULL DEFAULT '{}',
  amenities TEXT[] NOT NULL DEFAULT '{}',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_listing ON public.properties (is_published, status, listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties (location);

-- Inquiries (public or logged-in clients)
CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_title TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  interest TEXT NOT NULL DEFAULT 'Property Buying',
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'closed')) DEFAULT 'new',
  owner_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings / Site Visit Requests (logged-in clients)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL DEFAULT '11:00 AM',
  note TEXT NOT NULL DEFAULT '',
  owner_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reviews (moderated by owner; public reads ONLY approved)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Home Buyer',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Favourites (saved properties per user)
CREATE TABLE IF NOT EXISTS public.favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, property_id)
);

-- Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Site Settings (single 'default' configuration row)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  business_name TEXT NOT NULL DEFAULT 'Debmalya Realty',
  tagline TEXT NOT NULL DEFAULT 'High-End Builder & Property Consultant | Buy • Sell • Rent with Confidence.',
  phone TEXT NOT NULL DEFAULT '+91 86498 58954',
  whatsapp TEXT NOT NULL DEFAULT '918649858954',
  address TEXT NOT NULL DEFAULT 'Sevoke Road, Ward Number 13, Dasrath Pally, Bhanu Nagar, Siliguri, West Bengal 734001.',
  hours JSONB NOT NULL DEFAULT '{"monday":"9:00 AM – 9:30 PM","tuesday":"10:00 AM – 10:00 PM","wednesday":"9:00 AM – 9:30 PM","thursday_sunday":"9:00 AM – 5:00 PM"}'::jsonb,
  social_links JSONB NOT NULL DEFAULT '{"instagram":"","facebook":"","youtube":"","linkedin":""}'::jsonb,
  about_text TEXT NOT NULL DEFAULT 'Your trusted partner for construction, property buying, selling, and rental services. We specialize in creating modern landmarks with quality construction, transparent dealings, and customer-focused solutions.',
  hero_headline TEXT NOT NULL DEFAULT 'Find a Place You''ll Love to Call Home.',
  hero_subheadline TEXT NOT NULL DEFAULT 'Discover exceptional properties in Siliguri. Whether you want to buy, sell, rent, or build, Debmalya Realty is here to help.',
  hero_image_url TEXT NOT NULL DEFAULT '/src/assets/images/hero_siliguri_villa_1795102916572.jpg',
  about_image_url TEXT NOT NULL DEFAULT '/src/assets/images/about_siliguri_construction_1795235945880.jpg',
  logo_url TEXT NOT NULL DEFAULT '',
  locations TEXT[] NOT NULL DEFAULT ARRAY['Siliguri','Sevoke Road','Bhanu Nagar','Haiderpara','Gugni More'],
  property_types TEXT[] NOT NULL DEFAULT ARRAY['Flats / Apartments','Villas','Houses','Residential Plots','Land','Commercial Spaces'],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer Preferences (for tailored property recommendations)
CREATE TABLE IF NOT EXISTS public.customer_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_location TEXT NOT NULL DEFAULT 'All',
  property_type TEXT NOT NULL DEFAULT 'All',
  listing_type TEXT NOT NULL CHECK (listing_type IN ('Buy', 'Rent', 'Both')) DEFAULT 'Buy',
  min_budget BIGINT,
  max_budget BIGINT,
  min_bedrooms INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  notify_matches BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved Searches (one-click filter re-apply from Client Dashboard)
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  listing_type TEXT NOT NULL DEFAULT 'All',
  property_type TEXT NOT NULL DEFAULT 'All',
  location TEXT NOT NULL DEFAULT 'All',
  min_price BIGINT,
  max_price BIGINT,
  min_bedrooms INTEGER,
  furnishing TEXT NOT NULL DEFAULT 'All',
  sort_by TEXT NOT NULL DEFAULT 'newest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default website settings safely on first run
INSERT INTO public.site_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Check if current signed-in user has role = 'owner'
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'owner'
  );
$$;

-- Helper for RLS policy to prevent self-escalation without subquery recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Hard block on role self-escalation from client/browser sessions
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Users cannot modify their own role.';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- Auto-create profile when a new user signs up in auth.users.
-- First user ever becomes 'owner'; everyone after becomes 'client'.
-- Optional OWNER_EMAIL guard: replace 'REPLACE_WITH_OWNER_EMAIL' with your email
-- (e.g. 'debmalyarealty@gmail.com') to restrict owner assignment strictly to that email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_email CONSTANT TEXT := 'REPLACE_WITH_OWNER_EMAIL';
  v_has_owner BOOLEAN := FALSE;
  v_assigned_role TEXT := 'client';
BEGIN
  -- Serialize concurrent signups so only one user can claim initial owner
  PERFORM pg_advisory_xact_lock(9845123);

  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'owner'
  ) INTO v_has_owner;

  IF NOT v_has_owner THEN
    IF v_owner_email = 'REPLACE_WITH_OWNER_EMAIL'
       OR LOWER(COALESCE(NEW.email, '')) = LOWER(v_owner_email) THEN
      v_assigned_role := 'owner';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, city, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), 'Siliguri'),
    v_assigned_role
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.customer_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Generic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_inquiries_updated_at ON public.inquiries;
CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS) & TABLE GRANTS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Explicit schema & table grants (RLS policies below enforce per-row security)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.properties, public.team_members, public.site_settings, public.reviews TO anon, authenticated;
GRANT INSERT ON public.inquiries TO anon, authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.properties, public.team_members, public.reviews TO authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings, public.favourites, public.customer_preferences, public.saved_searches TO authenticated;

-- ============================================================================
-- 4. RLS POLICIES (IDEMPOTENT)
-- ============================================================================

-- PROFILES: user reads/updates own (never changes own role); owner reads all
DROP POLICY IF EXISTS "Profiles: read own or owner reads all" ON public.profiles;
CREATE POLICY "Profiles: read own or owner reads all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_owner());

DROP POLICY IF EXISTS "Profiles: users update own without role change" ON public.profiles;
CREATE POLICY "Profiles: users update own without role change"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = public.get_my_role());

-- PROPERTIES: public reads published; only owner can insert/update/delete/read drafts
DROP POLICY IF EXISTS "Properties: public read published" ON public.properties;
CREATE POLICY "Properties: public read published"
  ON public.properties FOR SELECT
  USING (is_published = TRUE OR public.is_owner());

DROP POLICY IF EXISTS "Properties: owner insert" ON public.properties;
CREATE POLICY "Properties: owner insert"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Properties: owner update" ON public.properties;
CREATE POLICY "Properties: owner update"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Properties: owner delete" ON public.properties;
CREATE POLICY "Properties: owner delete"
  ON public.properties FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- TEAM MEMBERS: public reads visible members; only owner manages all
DROP POLICY IF EXISTS "Team: public read visible" ON public.team_members;
CREATE POLICY "Team: public read visible"
  ON public.team_members FOR SELECT
  USING (is_visible = TRUE OR public.is_owner());

DROP POLICY IF EXISTS "Team: owner insert" ON public.team_members;
CREATE POLICY "Team: owner insert"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Team: owner update" ON public.team_members;
CREATE POLICY "Team: owner update"
  ON public.team_members FOR UPDATE
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Team: owner delete" ON public.team_members;
CREATE POLICY "Team: owner delete"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- SITE SETTINGS: public read; only owner can update/insert
DROP POLICY IF EXISTS "Site settings: public read" ON public.site_settings;
CREATE POLICY "Site settings: public read"
  ON public.site_settings FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Site settings: owner insert" ON public.site_settings;
CREATE POLICY "Site settings: owner insert"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Site settings: owner update" ON public.site_settings;
CREATE POLICY "Site settings: owner update"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- REVIEWS: public reads ONLY approved (authors can view own status); logged-in users insert forced to 'pending'; owner updates/deletes/reads all
DROP POLICY IF EXISTS "Reviews: public reads approved" ON public.reviews;
CREATE POLICY "Reviews: public reads approved"
  ON public.reviews FOR SELECT
  USING (status = 'approved' OR (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR public.is_owner());

DROP POLICY IF EXISTS "Reviews: authenticated insert pending" ON public.reviews;
CREATE POLICY "Reviews: authenticated insert pending"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Reviews: owner update" ON public.reviews;
CREATE POLICY "Reviews: owner update"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Reviews: owner delete" ON public.reviews;
CREATE POLICY "Reviews: owner delete"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- INQUIRIES: anyone (even logged out) can insert; client reads own; owner reads/updates/deletes all
DROP POLICY IF EXISTS "Inquiries: anyone can insert" ON public.inquiries;
CREATE POLICY "Inquiries: anyone can insert"
  ON public.inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Inquiries: client reads own or owner reads all" ON public.inquiries;
CREATE POLICY "Inquiries: client reads own or owner reads all"
  ON public.inquiries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Inquiries: owner update" ON public.inquiries;
CREATE POLICY "Inquiries: owner update"
  ON public.inquiries FOR UPDATE
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Inquiries: owner delete" ON public.inquiries;
CREATE POLICY "Inquiries: owner delete"
  ON public.inquiries FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- BOOKINGS: logged-in client inserts & reads own; owner reads/updates/deletes all
DROP POLICY IF EXISTS "Bookings: client inserts own" ON public.bookings;
CREATE POLICY "Bookings: client inserts own"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Bookings: client reads own or owner reads all" ON public.bookings;
CREATE POLICY "Bookings: client reads own or owner reads all"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_owner());

DROP POLICY IF EXISTS "Bookings: owner update" ON public.bookings;
CREATE POLICY "Bookings: owner update"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Bookings: owner delete" ON public.bookings;
CREATE POLICY "Bookings: owner delete"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- FAVOURITES: user manages own; owner can read save counts
DROP POLICY IF EXISTS "Favourites: read own" ON public.favourites;
DROP POLICY IF EXISTS "Favourites: read own or owner reads all" ON public.favourites;
CREATE POLICY "Favourites: read own or owner reads all"
  ON public.favourites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_owner());

DROP POLICY IF EXISTS "Favourites: insert own" ON public.favourites;
CREATE POLICY "Favourites: insert own"
  ON public.favourites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Favourites: delete own" ON public.favourites;
CREATE POLICY "Favourites: delete own"
  ON public.favourites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- CUSTOMER PREFERENCES: user manages own
DROP POLICY IF EXISTS "Customer preferences: manage own" ON public.customer_preferences;
CREATE POLICY "Customer preferences: manage own"
  ON public.customer_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SAVED SEARCHES: user manages own
DROP POLICY IF EXISTS "Saved searches: manage own" ON public.saved_searches;
CREATE POLICY "Saved searches: manage own"
  ON public.saved_searches FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 5. STORAGE BUCKETS & POLICIES ("property-images" & "team-photos")
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-photos', 'team-photos', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Storage: public read property-images and team-photos" ON storage.objects;
CREATE POLICY "Storage: public read property-images and team-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('property-images', 'team-photos'));

DROP POLICY IF EXISTS "Storage: owner upload property-images and team-photos" ON storage.objects;
CREATE POLICY "Storage: owner upload property-images and team-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('property-images', 'team-photos')
    AND public.is_owner()
  );

DROP POLICY IF EXISTS "Storage: owner update property-images and team-photos" ON storage.objects;
CREATE POLICY "Storage: owner update property-images and team-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('property-images', 'team-photos')
    AND public.is_owner()
  )
  WITH CHECK (
    bucket_id IN ('property-images', 'team-photos')
    AND public.is_owner()
  );

DROP POLICY IF EXISTS "Storage: owner delete property-images and team-photos" ON storage.objects;
CREATE POLICY "Storage: owner delete property-images and team-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('property-images', 'team-photos')
    AND public.is_owner()
  );
