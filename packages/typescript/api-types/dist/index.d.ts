export * from './theme-registry';
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
    current_theme_release_id?: string;
    storefront_release_version?: number;
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
export interface DomainOutboxEvent {
    id: string;
    store_id?: string | null;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    idempotency_key: string;
    status: 'queued' | 'processing' | 'processed' | 'failed' | 'dead';
    attempts: number;
    available_at: string;
    request_id?: string | null;
    actor_id?: string | null;
    created_at: string;
    updated_at: string;
}
export interface AuditActivityEvent {
    id: string;
    store_id?: string | null;
    actor_id?: string | null;
    actor_type: 'user' | 'customer' | 'employee' | 'system' | 'webhook';
    action: string;
    resource_type: string;
    resource_id?: string | null;
    request_id?: string | null;
    before_state?: Record<string, unknown> | null;
    after_state?: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
    created_at: string;
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
export type ProductStatus = 'draft' | 'active' | 'archived';
export interface Product {
    id: string;
    store_id: string;
    name: string;
    slug: string;
    description?: string;
    price: number;
    compare_price?: number | null;
    compare_at_price?: number | null;
    cost_price?: number;
    cost_per_item?: number | null;
    sku?: string;
    barcode?: string;
    stock?: number;
    stock_quantity?: number;
    track_inventory: boolean;
    is_active?: boolean;
    is_featured?: boolean;
    status?: ProductStatus;
    images: string[];
    variants: ProductVariant[];
    product_options?: ProductOption[];
    tags: string[];
    category?: string | null;
    categories?: string[];
    product_type?: string | null;
    vendor?: string | null;
    url_handle?: string | null;
    seo_title?: string;
    seo_description?: string;
    created_at: string;
    updated_at: string;
}
export interface ProductVariant {
    id: string;
    product_id?: string;
    name?: string;
    title?: string;
    price: number;
    compare_price?: number | null;
    sku?: string | null;
    stock?: number;
    stock_quantity?: number;
    inventory_qty?: number;
    options: Record<string, string>;
}
export interface ProductOption {
    id?: string;
    product_id?: string;
    name: string;
    position: number;
    values: string[];
}
export interface CreateProductRequest {
    store_id?: string;
    name: string;
    price: number;
    description?: string;
    compare_price?: number | null;
    cost_per_item?: number | null;
    images?: string[];
    stock?: number;
    track_inventory?: boolean;
    sku?: string | null;
    barcode?: string | null;
    category?: string | null;
    product_type?: string | null;
    vendor?: string | null;
    product_options?: ProductOption[];
    variants?: Omit<ProductVariant, 'id' | 'product_id'>[];
    tags?: string[];
    is_active?: boolean;
    seo_title?: string | null;
    seo_description?: string | null;
}
export interface InventoryLevel {
    id: string;
    product_id: string;
    variant_id?: string | null;
    location_id: string;
    product_name: string;
    variant_title?: string | null;
    sku?: string | null;
    images: string[];
    location_name: string;
    available: number;
    reserved: number;
    incoming: number;
    on_hand: number;
    sellable: number;
    track_inventory: boolean;
    updated_at?: string | null;
}
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
//# sourceMappingURL=index.d.ts.map