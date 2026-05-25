// Types from Doc 15 §4

export type AppType = 'public' | 'unlisted' | 'custom' | 'draft';

export type AppStatus =
    | 'draft'
    | 'submitted'
    | 'in_review'
    | 'changes_needed'
    | 'approved'
    | 'published'
    | 'suspended'
    | 'removed';

export type AppPricingModel =
    | 'free'
    | 'freemium'
    | 'recurring'
    | 'one_time'
    | 'usage_based';

export interface LBApp {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    description: string;
    type: AppType;
    status: AppStatus;

    // Developer
    developer_id: string;
    developer_name: string;
    developer_email: string;

    // OAuth
    client_id: string;
    redirect_uris: string[];
    scopes: string[];

    // URLs
    app_url: string;
    proxy_url?: string;
    proxy_path?: string;
    privacy_url: string;
    terms_url?: string;

    // Media
    icon_url: string;
    screenshots: string[];
    video_url?: string;

    // Pricing
    pricing_model: AppPricingModel;
    price_monthly?: number;
    price_yearly?: number;
    trial_days: number;

    // Categorization
    category_id: string;
    tags: string[];
    collection_ids: string[];

    // Stats (cached)
    install_count: number;
    review_count: number;
    avg_rating: number;

    // Extensions
    extensions: AppExtension[];

    // Metadata
    current_version: string;
    min_plan: string;
    supported_locales: string[];
    is_featured?: boolean;
    created_at: string;
    updated_at: string;
    published_at?: string;
}

export interface AppExtension {
    id: string;
    app_id: string;
    type: ExtensionType;
    name: string;
    entry_point: string;
    config: Record<string, unknown>;
    status: 'active' | 'inactive';
}

export type ExtensionType =
    | 'storefront_block'
    | 'storefront_embed'
    | 'checkout_ui'
    | 'post_purchase'
    | 'admin_link'
    | 'admin_block';

export interface AppReview {
    id: string;
    app_id: string;
    user_id: string;
    user_name: string;
    store_name: string;
    rating: number;
    title: string;
    body: string;
    helpful_count: number;
    created_at: string;
}

export interface AppCategory {
    slug: string;
    name: string;
    icon: string;
    group: string;
    count?: number;
}
