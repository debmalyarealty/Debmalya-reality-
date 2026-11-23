export type UserRole = 'owner' | 'client';

export type ListingType = 'Buy' | 'Rent';

export type PropertyStatus =
  | 'Available'
  | 'Sold'
  | 'Rented'
  | 'Under Construction'
  | 'Upcoming';

export type FurnishingType =
  | 'Unfurnished'
  | 'Semi-Furnished'
  | 'Fully Furnished'
  | 'Not Applicable';

export type InquiryStatus = 'new' | 'contacted' | 'closed';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  caption?: string;
  sort_order: number;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_inr: number;
  listing_type: ListingType;
  property_type: string;
  location: string;
  address_detail?: string;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  furnishing: FurnishingType;
  parking: string;
  status: PropertyStatus;
  is_published: boolean;
  is_featured: boolean;
  is_demo: boolean;
  amenities: string[];
  images: PropertyImage[];
  created_at: string;
  updated_at: string;
}

export interface PropertyFilters {
  query?: string;
  location?: string;
  propertyType?: string;
  listingType?: 'All' | ListingType;
  minPrice?: number | '';
  maxPrice?: number | '';
  minBedrooms?: number | '';
  minBathrooms?: number | '';
  minArea?: number | '';
  furnishing?: string;
  parking?: string;
  status?: string;
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
}

export interface CustomerPreferences {
  user_id?: string;
  preferred_location: string;
  property_type: string;
  listing_type: 'Buy' | 'Rent' | 'Both';
  min_budget: number | null;
  max_budget: number | null;
  min_bedrooms: number | null;
  notes: string;
  notify_matches: boolean;
  updated_at?: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  query: string;
  listing_type: 'All' | ListingType;
  property_type: string;
  location: string;
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  furnishing: string;
  sort_by: 'newest' | 'price_asc' | 'price_desc';
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  city: string;
  role: UserRole;
  created_at: string;
}

export interface Inquiry {
  id: string;
  user_id: string | null;
  property_id: string | null;
  property_title?: string | null;
  name: string;
  phone: string;
  email: string;
  interested_in: string;
  message: string;
  status: InquiryStatus;
  owner_notes: string;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  property_id: string;
  property_title?: string;
  property_slug?: string;
  customer_name: string;
  phone: string;
  email: string;
  preferred_date: string;
  preferred_time: string;
  note: string;
  owner_note: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string | null;
  reviewer_name: string;
  reviewer_email?: string;
  customer_type: string;
  rating: number;
  review_text: string;
  status: ReviewStatus;
  is_featured: boolean;
  review_date: string;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  position: string;
  bio: string;
  phone: string;
  whatsapp: string;
  photo_url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface WebsiteSettings {
  business_name: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  logo_url: string;
  hero_headline: string;
  hero_subheadline: string;
  hero_image_url: string;
  about_image_url: string;
  operating_hours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday_sunday: string;
  };
  locations: string[];
  property_types: string[];
  social_links: {
    instagram: string;
    facebook: string;
    youtube: string;
    linkedin: string;
  };
  google_review_link?: string;
  service_images?: Record<string, string>;
}

export interface OwnerDashboardStats {
  total_properties: number;
  available_properties: number;
  under_construction_properties: number;
  sold_properties: number;
  rented_properties: number;
  new_inquiries: number;
  total_inquiries: number;
  pending_bookings: number;
  total_bookings: number;
  pending_reviews: number;
  total_reviews: number;
  client_accounts: number;
}
