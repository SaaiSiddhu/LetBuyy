import { z } from 'zod';
import { SlugSchema, UuidSchema } from '@letbuyy/shared-types';

export * from './theme-registry';

export type BuiltInSectionType =
  | 'header'
  | 'heroBanner'
  | 'productGrid'
  | 'footer'
  | 'featuredProducts'
  | 'testimonials'
  | 'aboutSection'
  | 'collectionFilter'
  | 'newsletter'
  | 'contentPage'
  | 'instagramFeed'
  | 'faqAccordion'
  | 'videoHero'
  | 'trustBadges'
  | 'categoryGrid'
  | 'brandMarquee'
  | 'portfolioGrid'
  | 'servicesGrid'
  | 'skillsSection'
  | 'experienceTimeline'
  | 'contactForm'
  | 'ctaSection';

export type SectionType = BuiltInSectionType | (string & {});
export type LegacySectionType = 'hero' | 'product_grid' | 'featured_collection' | 'newsletter' | 'header' | 'footer';

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  headingFontFamily: string;
  borderRadius: number;
  enableAnimations: boolean;
  enableShadows: boolean;
  isDark?: boolean;
  surfaceColor?: string;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  primaryColor: '#00B3B3',
  secondaryColor: '#008080',
  accentColor: '#A4E500',
  backgroundColor: '#FFFFFF',
  textColor: '#1A1A2E',
  fontFamily: 'Inter',
  headingFontFamily: 'Inter',
  borderRadius: 12,
  enableAnimations: true,
  enableShadows: true,
  isDark: false,
  surfaceColor: '#F9FAFB',
};

export interface SectionModel {
  id: string;
  type: SectionType;
  order: number;
  rendererKey?: string;
  schemaVersion?: string;
  settings: Record<string, unknown>;
  blocks?: BlockModel[];
  isVisible: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlockModel {
  id: string;
  type: string;
  order: number;
  rendererKey?: string;
  schemaVersion?: string;
  settings: Record<string, unknown>;
  isVisible: boolean;
}

export interface StorefrontTemplateConfig {
  id?: string;
  type?: string;
  layoutKey?: string;
  sections: SectionModel[];
}

export interface StorefrontSectionGroupConfig {
  id?: string;
  role?: 'header' | 'footer' | 'aside' | 'custom';
  sections: SectionModel[];
}

export interface StoreTemplateConfig {
  storeId?: string;
  themeId: string;
  releaseId?: string;
  releaseVersion?: number;
  releasePublishedAt?: string;
  engineVersion?: string;
  themeSettings: ThemeSettings;
  sections: SectionModel[];
  sectionGroups?: Record<string, StorefrontSectionGroupConfig>;
  templates?: Record<string, StorefrontTemplateConfig>;
  releaseManifest?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemeRelease {
  id: string;
  store_id: string;
  theme_id: string;
  release_version: number;
  release_status: 'published' | 'superseded' | 'rolled_back';
  is_current: boolean;
  release_config: Record<string, unknown>;
  source_draft_id?: string | null;
  source_draft_version?: number | null;
  publish_message?: string | null;
  published_by?: string | null;
  published_at: string;
  rollback_of_release_id?: string | null;
}

export interface ThemeEditorPayload {
  store: {
    id: string;
    name?: string;
    subdomain?: string;
    status?: string;
  };
  theme: {
    id: string;
    slug: string;
    name: string;
    renderer_key: string;
  };
  template_config: Record<string, unknown>;
  draft: {
    exists: boolean;
    updated_at: string | null;
    version: number;
  };
  release: {
    id: string;
    version: number;
    published_at: string;
  } | null;
  schemas: {
    sections: Record<string, unknown>;
    settings: Record<string, unknown>;
  };
  version: number;
}

export interface ThemeDraftSaveResult {
  saved_at: string;
  version: number;
  draft: {
    id: string;
    version: number;
    auto_saved_at: string;
  };
}

export interface ThemePublishResult {
  store: {
    id: string;
    status: string;
    theme_id: string;
    current_theme_release_id?: string;
    storefront_release_version?: number;
    updated_at?: string;
  } | null;
  theme: {
    id: string;
    slug: string;
    name: string;
  };
  release: {
    release_id: string;
    release_version: number;
    published_at: string;
  };
  published_at: string;
}

export interface ThemePreviewSessionResult {
  preview_session_id: string;
  preview_token: string;
  expires_at: string;
  draft_version: number;
}

export interface HeroBannerSettings {
  image: string;
  heading: string;
  subheading: string;
  ctaText: string;
  ctaLink: string;
  ctaStyle: 'primary' | 'secondary' | 'outline';
  overlay: number;
  overlayColor: string;
  height: 'full' | 'large' | 'medium' | 'small';
  textAlign: 'left' | 'center' | 'right';
  textPosition: 'top' | 'center' | 'bottom';
  animation: 'none' | 'fade' | 'slide' | 'zoom';
}

export interface ProductGridSettings {
  title: string;
  subtitle?: string;
  columns: number;
  columnsTablet?: number;
  columnsMobile?: number;
  rows?: number;
  showTitle: boolean;
  showPrice: boolean;
  showRating: boolean;
  showAddToCart: boolean;
  productIds?: string[];
  sortBy?: 'newest' | 'price_low' | 'price_high' | 'popular';
  cardStyle?: 'standard' | 'minimal' | 'detailed';
}

export interface HeaderSettings {
  behavior: 'sticky' | 'scroll' | 'hide-on-scroll';
  logoPlacement: 'left' | 'center';
  logoUrl?: string;
  displayMode: 'logo' | 'name' | 'both';
  logoHeight?: number;
  navPlacement: 'left' | 'right';
  navPages: HeaderNavPage[];
  showSearch: boolean;
  showCart: boolean;
  showAccount: boolean;
  sticky?: boolean;
  transparent?: boolean;
  height?: 'small' | 'medium' | 'large';
  backgroundColor?: string;
  textColor?: string;
}

export interface HeaderNavPage {
  id: string;
  label: string;
  href: string;
  isDefault: boolean;
  isVisible: boolean;
  openInNewTab?: boolean;
  children?: HeaderNavPage[];
  targetType?: string;
  targetResourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FooterSettings {
  columns: number;
  showLogo: boolean;
  showNewsletter: boolean;
  showSocial: boolean;
  showPaymentIcons: boolean;
  copyrightText?: string;
  backgroundColor?: string;
  textColor?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  youtubeUrl?: string;
  contactEmail?: string;
}

export interface TestimonialsSettings {
  title: string;
  subtitle?: string;
  layout: 'carousel' | 'grid' | 'masonry';
  autoplay: boolean;
  showRating: boolean;
  showImage: boolean;
}

export interface AboutSectionSettings {
  heading: string;
  content: string;
  image?: string;
  imagePosition: 'left' | 'right';
  showButton: boolean;
  buttonText?: string;
  buttonLink?: string;
}

export interface PortfolioGridSettings {
  title: string;
  subtitle?: string;
  columns: number;
  layout: 'grid' | 'masonry';
}

export interface ServicesGridSettings {
  title: string;
  subtitle?: string;
  columns: number;
}

export interface SkillsSectionSettings {
  title: string;
  subtitle?: string;
  layout: 'bars' | 'tags';
}

export interface ExperienceTimelineSettings {
  title: string;
  subtitle?: string;
}

export interface ContactFormSettings {
  title: string;
  subtitle?: string;
  email?: string;
  showPhone?: boolean;
  showAddress?: boolean;
}

export interface CtaSectionSettings {
  heading: string;
  subheading?: string;
  ctaText: string;
  ctaLink: string;
  style: 'primary' | 'gradient' | 'dark';
}

export const ThemeSlugParamSchema = z.object({
  slug: SlugSchema,
});

export const ThemeStoreQuerySchema = z.object({
  store_id: UuidSchema,
});

export const InstallThemeSchema = z.object({
  store_id: UuidSchema,
  config_overrides: z.record(z.string(), z.unknown()).default({}),
});

export const SaveThemeDraftSchema = z.object({
  store_id: UuidSchema,
  template_config: z.record(z.string(), z.unknown()),
  base_version: z.number().int().positive().optional(),
  client: z.enum(['admin-web', 'flutter-builder', 'api']).default('api'),
});

export const PublishThemeSchema = z.object({
  store_id: UuidSchema,
  base_version: z.number().int().positive().optional(),
  make_store_live: z.boolean().default(true),
  publish_message: z.string().max(500).optional(),
});

export const PreviewTokenSchema = z.object({
  store_id: UuidSchema,
  ttl_seconds: z.number().int().min(60).max(3600).default(900),
});

export const RollbackThemeReleaseSchema = z.object({
  store_id: UuidSchema,
  make_store_live: z.boolean().default(true),
  rollback_message: z.string().max(500).optional(),
});

export const ThemePurchaseOrderSchema = z.object({
  currency: z.enum(['INR']).default('INR'),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const ThemePurchaseVerifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(200),
  razorpay_payment_id: z.string().min(1).max(200),
  razorpay_signature: z.string().min(1).max(500),
});

export interface ThemeEngineRenderContext {
  site_id: string;
  route_type: string;
  template_key?: string;
  preview_token?: string;
  release_id?: string;
}

export interface ThemeHydrationContract {
  section_id: string;
  renderer_key: string;
  data_dependencies: string[];
  client_required: boolean;
}

export type InstallThemeInput = z.infer<typeof InstallThemeSchema>;
export type SaveThemeDraftInput = z.infer<typeof SaveThemeDraftSchema>;
export type PublishThemeInput = z.infer<typeof PublishThemeSchema>;
export type PreviewTokenInput = z.infer<typeof PreviewTokenSchema>;
export type RollbackThemeReleaseInput = z.infer<typeof RollbackThemeReleaseSchema>;
export type ThemePurchaseOrderInput = z.infer<typeof ThemePurchaseOrderSchema>;
export type ThemePurchaseVerifyInput = z.infer<typeof ThemePurchaseVerifySchema>;

export type ThemeCategory = 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
export type ThemePricingType = 'free' | 'one_time' | 'subscription';

export interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string;
  long_description: string;
  category: ThemeCategory;
  industry: string[];
  theme_preset_id: string;
  version: string;
  is_active: boolean;
  letbuyy_pricing_type: ThemePricingType;
  letbuyy_price_usd: number;
  letbuyy_price_inr: number;
  wordpress_price_usd: number;
  shopify_price_usd: number;
  html_price_usd: number;
  react_price_usd: number;
  thumbnail_url: string;
  preview_url: string;
  screenshots: string[];
  demo_url: string;
  customizable_sections: Record<string, unknown>;
  color_presets: Array<{ name: string; colors: Record<string, string> }>;
  font_options: string[];
  author_id: string | null;
  author_name: string;
  tags: string[];
  features: string[];
  supported_platforms: string[];
  rating: number;
  review_count: number;
  install_count: number;
  download_count: number;
  purchase_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThemePurchase {
  id: string;
  user_id: string;
  theme_id: string;
  payment_provider: 'stripe' | 'razorpay';
  payment_id: string;
  amount_usd: number;
  amount_inr: number;
  currency: string;
  license_key: string;
  license_type: 'single' | 'multi' | 'unlimited';
  status: 'completed' | 'refunded' | 'pending';
  created_at: string;
}

export interface ThemeInstallation {
  id: string;
  site_id: string;
  theme_id: string;
  user_id: string;
  purchase_id: string | null;
  is_active: boolean;
  customizations: Record<string, unknown>;
  version_installed: string;
  installed_at: string;
  updated_at: string;
}

export interface ThemeReview {
  id: string;
  user_id: string;
  theme_id: string;
  rating: number;
  title: string;
  content: string;
  is_verified_purchase: boolean;
  status: 'published' | 'pending' | 'rejected';
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

export interface ThemeFilters {
  category?: ThemeCategory;
  pricing?: ThemePricingType | 'paid';
  sort?: 'popular' | 'newest' | 'rating' | 'price_low' | 'price_high';
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface ThemeSearchFilters {
  category?: string;
  pricingType?: string;
  siteType?: string;
  industry?: string;
  search?: string;
  sort?: 'popular' | 'rating' | 'recent' | 'name' | 'price_low' | 'price_high';
  limit?: number;
  offset?: number;
}

export interface ThemeSearchResult {
  themes: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}
