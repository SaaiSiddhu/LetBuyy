// ═══════════════════════════════════════════════════
// THEME MARKETPLACE — Core Types
// ═══════════════════════════════════════════════════

export type ThemeCategory = 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
export type ThemePricingType = 'free' | 'one_time' | 'subscription';

/** Theme as stored in the `themes` table */
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

    // LetBuyy Integration Pricing
    letbuyy_pricing_type: ThemePricingType;
    letbuyy_price_usd: number;
    letbuyy_price_inr: number;

    // Standalone download pricing
    wordpress_price_usd: number;
    shopify_price_usd: number;
    html_price_usd: number;
    react_price_usd: number;

    // Media
    thumbnail_url: string;
    preview_url: string;
    screenshots: string[];
    demo_url: string;

    // Customization
    customizable_sections: Record<string, unknown>;
    color_presets: Array<{ name: string; colors: Record<string, string> }>;
    font_options: string[];

    // Author
    author_id: string | null;
    author_name: string;

    // Metadata
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

/** Purchase record */
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

/** Theme installation on a store */
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

/** Theme review */
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
    // Joined fields
    user_name?: string;
    user_avatar?: string;
}

/** Theme filter options for gallery */
export interface ThemeFilters {
    category?: ThemeCategory;
    pricing?: ThemePricingType | 'paid';
    sort?: 'popular' | 'newest' | 'rating' | 'price_low' | 'price_high';
    search?: string;
    tags?: string[];
    page?: number;
    limit?: number;
}

/** Paginated result */
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
}
