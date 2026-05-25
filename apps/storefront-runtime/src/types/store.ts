// Storefront runtime compatibility facade.
// Canonical commerce, checkout, tenant, CMS, auth, and theme contracts live in packages/*.

export {
  type SiteType,
  type PaymentGateway,
  type NavPage,
  type StoreNavigation,
  DEFAULT_NAV_PAGES,
  type StoreModel,
} from '@letbuyy/tenant-core';

export {
  type ProductModel,
  type ProductVariant,
  type VariantOption,
} from '@letbuyy/commerce-core';

export {
  type CartItem,
  type OrderModel,
  type OrderCustomer,
  type ShippingAddress,
  type OrderItem,
  type OrderPricing,
  type OrderPayment,
  type OrderStatus,
  type OrderTracking,
} from '@letbuyy/checkout-core';

export {
  type CustomerCredential,
} from '@letbuyy/auth-core';

export {
  type PortfolioProject,
  type ServiceItem,
  type SkillItem,
  type ExperienceItem,
} from '@letbuyy/cms-core';

export {
  type BuiltInSectionType,
  type SectionType,
  type LegacySectionType,
  type ThemeSettings,
  DEFAULT_THEME_SETTINGS,
  type SectionModel,
  type BlockModel,
  type StorefrontTemplateConfig,
  type StorefrontSectionGroupConfig,
  type StoreTemplateConfig,
  type HeroBannerSettings,
  type ProductGridSettings,
  type HeaderSettings,
  type FooterSettings,
  type TestimonialsSettings,
  type AboutSectionSettings,
  type PortfolioGridSettings,
  type ServicesGridSettings,
  type SkillsSectionSettings,
  type ExperienceTimelineSettings,
  type ContactFormSettings,
  type CtaSectionSettings,
} from '@letbuyy/theme-engine';
