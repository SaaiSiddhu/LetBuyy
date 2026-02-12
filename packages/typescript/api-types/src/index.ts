// =============================================
// LETBUYY API TYPES
// Shared TypeScript types for API requests/responses
// =============================================

// =============================================
// STORES
// =============================================

export type SiteType = 'store' | 'portfolio' | 'resume' | 'landing';

export type StoreStatus = 'draft' | 'published' | 'frozen' | 'suspended';

export interface Store {
  id: string;
  user_id: string;
  name: string;
  subdomain: string;
  custom_domain?: string;
  site_type: SiteType;
  status: StoreStatus;
  theme_id?: string;
  theme_config: Record<string, unknown>;
  settings: Record<string, unknown>;
  meta_title?: string;
  meta_description?: string;
  favicon_url?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface CreateStoreRequest {
  name: string;
  subdomain: string;
  site_type: SiteType;
  template_id?: string;
}

export interface UpdateStoreRequest {
  name?: string;
  theme_config?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  meta_title?: string;
  meta_description?: string;
}

// =============================================
// PRODUCTS
// =============================================

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface Product {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  sku?: string;
  barcode?: string;
  stock_quantity: number;
  track_inventory: boolean;
  status: ProductStatus;
  images: string[];
  variants: ProductVariant[];
  tags: string[];
  categories: string[];
  seo_title?: string;
  seo_description?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  sku?: string;
  stock_quantity: number;
  options: Record<string, string>;
}

export interface CreateProductRequest {
  name: string;
  price: number;
  description?: string;
  images?: string[];
  variants?: Omit<ProductVariant, 'id'>[];
  tags?: string[];
  categories?: string[];
}

// =============================================
// ORDERS
// =============================================

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';

export interface Order {
  id: string;
  store_id: string;
  order_number: string;
  customer_email: string;
  customer_phone?: string;
  customer_name?: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  payment_method?: string;
  payment_gateway?: string;
  payment_id?: string;
  shipping_address?: Address;
  billing_address?: Address;
  shipping_method?: string;
  tracking_number?: string;
  notes?: string;
  coupon_code?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
}

// =============================================
// USERS
// =============================================

export type SubscriptionTier = 'free' | 'starter' | 'business' | 'enterprise';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  subscription_tier: SubscriptionTier;
  created_at: string;
  updated_at: string;
}

// =============================================
// PORTFOLIO
// =============================================

export interface PortfolioProject {
  id: string;
  store_id: string;
  title: string;
  slug: string;
  description?: string;
  content?: string;
  cover_image?: string;
  images: string[];
  video_url?: string;
  client_name?: string;
  project_date?: string;
  project_url?: string;
  github_url?: string;
  technologies: string[];
  categories: string[];
  is_featured: boolean;
  display_order: number;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  store_id: string;
  name: string;
  category?: string;
  proficiency: 1 | 2 | 3 | 4 | 5;
  years_experience?: number;
  icon?: string;
  display_order: number;
}

export interface Education {
  id: string;
  store_id: string;
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  gpa?: string;
  description?: string;
  logo_url?: string;
  display_order: number;
}

// =============================================
// RESUME
// =============================================

export interface WorkExperience {
  id: string;
  store_id: string;
  company: string;
  position: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  description?: string;
  achievements: string[];
  company_logo?: string;
  display_order: number;
}

// =============================================
// API RESPONSES
// =============================================

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
