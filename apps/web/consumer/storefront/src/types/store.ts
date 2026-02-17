// Aligned with Flutter builder app's data models

// ============= SECTION TYPES =============

export type SiteType = 'store' | 'portfolio' | 'resume' | 'landing';

export type PaymentGateway = 'razorpay' | 'stripe' | 'paypal';

export type SectionType =
    | 'header'
    | 'heroBanner'
    | 'productGrid'
    | 'footer'
    | 'featuredProducts'
    | 'testimonials'
    | 'aboutSection'
    | 'collectionFilter'
    | 'newsletter'
    | 'instagramFeed'
    | 'faqAccordion'
    | 'videoHero'
    | 'trustBadges'
    | 'categoryGrid'
    | 'brandMarquee'
    // Portfolio sections
    | 'portfolioGrid'
    | 'servicesGrid'
    // Resume sections
    | 'skillsSection'
    | 'experienceTimeline'
    // Shared (portfolio/resume/landing)
    | 'contactForm'
    | 'ctaSection';

// Legacy type mapping (for compatibility)
export type LegacySectionType = 'hero' | 'product_grid' | 'featured_collection' | 'newsletter' | 'header' | 'footer';

// ============= THEME SETTINGS =============

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
    isDark?: boolean;       // Whether this is a dark theme
    surfaceColor?: string;  // Card/surface background color
}

// Default theme settings (matching builder defaults)
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

// Complete theme presets for all 10 themes
export const THEME_PRESETS: Record<string, Partial<ThemeSettings>> = {
    'minimal_modern': {
        isDark: false,
        backgroundColor: '#FFFFFF',
        textColor: '#000000',
        surfaceColor: '#F9FAFB',
    },
    'vibrant_bold': {
        isDark: false,
        backgroundColor: '#FFFFFF',
        textColor: '#1A1A2E',
        surfaceColor: '#FFF5F5',
    },
    'natural_organic': {
        isDark: false,
        backgroundColor: '#F5F1EB',
        textColor: '#2D5016',
        surfaceColor: '#FDFCFA',
    },
    'tech_elite': {
        isDark: true,
        backgroundColor: '#0A0A0F',
        textColor: '#FFFFFF',
        surfaceColor: '#1A1A2E',
    },
    'luxury_premium': {
        isDark: true,
        backgroundColor: '#1C1C1C',
        textColor: '#F8F5F0',
        surfaceColor: '#2A2A2A',
    },
    'sunset_gradient': {
        isDark: false,
        backgroundColor: '#FFFAF5',
        textColor: '#1A1A2E',
        surfaceColor: '#FFF8F0',
    },
    'ocean_breeze': {
        isDark: false,
        backgroundColor: '#F0FDFF',
        textColor: '#0A4D68',
        surfaceColor: '#E8FAFB',
    },
    'midnight_purple': {
        isDark: true,
        backgroundColor: '#1a1625',
        textColor: '#FFFFFF',
        surfaceColor: '#2D2640',
    },
    'fresh_mint': {
        isDark: false,
        backgroundColor: '#F0FDF4',
        textColor: '#064E3B',
        surfaceColor: '#ECFDF5',
    },
    'royal_rose': {
        isDark: false,
        backgroundColor: '#FDF2F8',
        textColor: '#831843',
        surfaceColor: '#FDF4F9',
    },
};

// ============= SECTION MODEL =============

export interface SectionModel {
    id: string;
    type: SectionType;
    order: number;
    settings: Record<string, any>;
    blocks?: BlockModel[];
    isVisible: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface BlockModel {
    id: string;
    type: string;
    order: number;
    settings: Record<string, any>;
    isVisible: boolean;
}

// ============= STORE TEMPLATE =============

export interface StoreTemplateConfig {
    storeId?: string;
    themeId: string;
    themeSettings: ThemeSettings;
    sections: SectionModel[];
    createdAt?: string;
    updatedAt?: string;
}

// ============= STORE MODEL =============

export interface StoreModel {
    id: string;
    sellerId: string;
    name: string;
    tagline?: string;
    subdomain: string;
    storeUrl?: string;
    logoUrl?: string;
    bannerUrl?: string;
    themeId?: string;
    themeCustomization?: Record<string, any>; // Legacy field
    siteType: SiteType;
    selectedProductIds: string[];
    templateConfig: StoreTemplateConfig;
    status: 'draft' | 'published' | 'suspended';
    plan?: 'free' | 'premium';
    seoTitle?: string;
    seoDescription?: string;
    codEnabled?: boolean;
    onlinePaymentEnabled?: boolean;
    paymentGateways?: PaymentGateway[];
    createdAt: string;
    updatedAt?: string;
    publishedAt?: string;
}

// ============= PRODUCT MODEL =============

export interface ProductModel {
    id: string;
    sellerId?: string;
    storeId?: string;
    name: string;
    description: string;
    price: number;
    compareAtPrice?: number; // Original price for discounts
    currency: string;
    images: string[];
    category?: string;
    stock: number;
    isActive?: boolean;
    rating?: number;
    reviewCount?: number;
    variants?: ProductVariant[];
    variantOptions?: VariantOption[]; // { name: "Size", values: ["S", "M", "L"] }
    tags?: string[];
    specifications?: Record<string, string>; // Key-value specs from Builder
    isFeatured?: boolean;
    isTrending?: boolean;
    isNew?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface VariantOption {
    name: string;
    values: string[];
}

export interface ProductVariant {
    id: string;
    name: string;
    options: Record<string, string>;
    price?: number;
    stock?: number;
    image?: string;
}

// ============= CART =============

export interface CartItem extends ProductModel {
    quantity: number;
    selectedVariant?: Record<string, string>;
}

// ============= ORDERS =============

export interface OrderModel {
    id: string;
    storeId: string;
    sellerId: string;
    subdomain: string;
    orderNumber: string; // e.g., "ORD-001"
    customer: OrderCustomer;
    items: OrderItem[];
    pricing: OrderPricing;
    payment: OrderPayment;
    status: OrderStatus;
    tracking?: OrderTracking;
    notes?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface OrderCustomer {
    name: string;
    email: string;
    phone: string;
    address: ShippingAddress;
}

export interface ShippingAddress {
    address: string;
    city: string;
    state: string;
    pincode: string;
}

export interface OrderItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    variant?: Record<string, string>;
}

export interface OrderPricing {
    subtotal: number;
    deliveryCharge: number;
    discount: number;
    total: number;
}

export interface OrderPayment {
    method: 'razorpay' | 'stripe' | 'paypal' | 'cod';
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    stripeSessionId?: string;
    paypalOrderId?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderTracking {
    number?: string;
    carrier?: string;
    url?: string;
    updatedAt?: string;
}

export interface CustomerCredential {
    email?: string;
    phone?: string;
    passwordHash: string;
    createdAt: string;
}

// ============= SECTION SETTINGS (Typed helpers) =============

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
    // Behavior
    behavior: 'sticky' | 'scroll' | 'hide-on-scroll';

    // Logo & Branding
    logoPlacement: 'left' | 'center';
    logoUrl?: string;
    displayMode: 'logo' | 'name' | 'both';
    logoHeight?: number;

    // Navigation
    navPlacement: 'left' | 'right';
    navPages: NavPage[];

    // Icons
    showSearch: boolean;
    showCart: boolean;
    showAccount: boolean;

    // Legacy fields (for compatibility)
    sticky?: boolean;
    transparent?: boolean;
    height?: 'small' | 'medium' | 'large';
    backgroundColor?: string;
    textColor?: string;
}

export interface NavPage {
    id: string;
    label: string;
    href: string;
    isDefault: boolean;
    isVisible: boolean;
}

export const DEFAULT_NAV_PAGES: NavPage[] = [
    { id: 'home', label: 'Home', href: '/', isDefault: true, isVisible: true },
    { id: 'shop', label: 'Shop', href: '/shop', isDefault: true, isVisible: true },
    { id: 'privacy', label: 'Privacy', href: '/privacy', isDefault: true, isVisible: true },
    { id: 'terms', label: 'Terms', href: '/terms', isDefault: true, isVisible: true },
    { id: 'shipping', label: 'Shipping', href: '/shipping', isDefault: true, isVisible: true },
    { id: 'returns', label: 'Returns', href: '/returns', isDefault: true, isVisible: true },
];

export interface FooterSettings {
    columns: number;
    showLogo: boolean;
    showNewsletter: boolean;
    showSocial: boolean;
    showPaymentIcons: boolean;
    copyrightText?: string; // Auto-generates: © {year} {store_name}
    backgroundColor?: string;
    textColor?: string;

    // Social Links - URLs (empty = hidden)
    instagramUrl?: string;
    twitterUrl?: string;
    facebookUrl?: string;
    whatsappUrl?: string;
    telegramUrl?: string;
    youtubeUrl?: string;

    // Contact
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

// ============= PORTFOLIO / RESUME / LANDING SECTION SETTINGS =============

export interface PortfolioGridSettings {
    title: string;
    subtitle?: string;
    columns: number;
    layout: 'grid' | 'masonry';
}

export interface PortfolioProject {
    id: string;
    title: string;
    description?: string;
    image?: string;
    tags?: string[];
    link?: string;
    linkLabel?: string;
}

export interface ServicesGridSettings {
    title: string;
    subtitle?: string;
    columns: number;
}

export interface ServiceItem {
    id: string;
    icon?: string;
    title: string;
    description: string;
    link?: string;
}

export interface SkillsSectionSettings {
    title: string;
    subtitle?: string;
    layout: 'bars' | 'tags';
}

export interface SkillItem {
    id: string;
    name: string;
    level: number; // 0-100
    category?: string;
}

export interface ExperienceTimelineSettings {
    title: string;
    subtitle?: string;
}

export interface ExperienceItem {
    id: string;
    title: string;
    company: string;
    startDate: string;
    endDate?: string;
    description?: string;
    isCurrent?: boolean;
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
