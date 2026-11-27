-- ============================================================================
-- Debmalya Realty — Admin Dashboard RLS & Cascade Support Migration
-- Safe to re-run in the Supabase SQL Editor (uses DROP POLICY IF EXISTS)
-- ============================================================================

-- 1. Allow owner to read & delete client preferences and saved searches
--    (so owner can open a client's full dashboard view and clean up client data)
DROP POLICY IF EXISTS "Customer preferences: owner reads all" ON public.customer_preferences;
CREATE POLICY "Customer preferences: owner reads all"
  ON public.customer_preferences FOR SELECT
  TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "Customer preferences: owner delete" ON public.customer_preferences;
CREATE POLICY "Customer preferences: owner delete"
  ON public.customer_preferences FOR DELETE
  TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "Saved searches: owner reads all" ON public.saved_searches;
CREATE POLICY "Saved searches: owner reads all"
  ON public.saved_searches FOR SELECT
  TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "Saved searches: owner delete" ON public.saved_searches;
CREATE POLICY "Saved searches: owner delete"
  ON public.saved_searches FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- 2. Allow owner to delete client favourites directly if needed
DROP POLICY IF EXISTS "Favourites: owner delete" ON public.favourites;
CREATE POLICY "Favourites: owner delete"
  ON public.favourites FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- 3. Profiles: allow owner to delete client profiles only (never own or owner accounts)
GRANT DELETE ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Profiles: owner deletes client" ON public.profiles;
CREATE POLICY "Profiles: owner deletes client"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    public.is_owner()
    AND role = 'client'
    AND id <> auth.uid()
  );

-- 4. Verify strict owner-only DELETE policies on core tables
DROP POLICY IF EXISTS "Properties: owner delete" ON public.properties;
CREATE POLICY "Properties: owner delete"
  ON public.properties FOR DELETE
  TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "Inquiries: owner delete" ON public.inquiries;
CREATE POLICY "Inquiries: owner delete"
  ON public.inquiries FOR DELETE
  TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "Bookings: owner delete" ON public.bookings;
CREATE POLICY "Bookings: owner delete"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "Reviews: owner delete" ON public.reviews;
CREATE POLICY "Reviews: owner delete"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "Team: owner delete" ON public.team_members;
CREATE POLICY "Team: owner delete"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (public.is_owner());
