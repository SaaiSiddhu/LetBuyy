import type {
  AICreditBalance,
  AIUsageRecord,
  AdminAppBridgeSession,
  AnalyticsDashboard,
  AnalyticsOrdersBreakdown,
  ApiResponse,
  AuthSessionResponse,
  BlogComment,
  BlogCommentStatus,
  BlogPost,
  BlogPostStatus,
  BillingHistoryItem,
  Cart,
  Collection,
  Coupon,
  Customer,
  CustomerAddress,
  Employee,
  FileUploadResult,
  FormSubmission,
  FormSubmissionStatus,
  GiftCard,
  InstalledApp,
  InventoryAdjustmentReason,
  InventoryLevel,
  JsonRecord,
  LineItem,
  MediaAsset,
  MediaType,
  MarketplaceApp,
  MarketplaceAppCategory,
  MarketplaceAppDeveloper,
  MarketplaceAppReview,
  NavigationItem,
  NavigationResponse,
  Order,
  Page,
  PaginatedResponse,
  Payment,
  Policy,
  Product,
  ProductCategory,
  ProductReview,
  ProductStatus,
  PageStatus,
  PolicyType,
  ResumeContentItem,
  ResumeContentSection,
  ReviewModerationStatus,
  ReplaceNavigationResult,
  ShippingRate,
  ShippingZone,
  Store,
  StorePaymentConfig,
  StoreStatus,
  StoreSummary,
  StoreSubscriptionState,
  SubscriptionBillingPeriod,
  SubscriptionCancelResult,
  SubscriptionOrderResult,
  SubscriptionPlan,
  SubscriptionVerificationResult,
  TaxRate,
  Theme,
  ThemeDraftSaveResult,
  ThemeEditableSchemaResponse,
  ThemeEditorPayload,
  ThemePreviewSessionResult,
  ThemePublishResult,
  ThemeRelease,
  ThemeRollbackResult,
} from '@letbuyy/shared-types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryPrimitive = string | number | boolean | null | undefined;
export type QueryValue = QueryPrimitive | readonly QueryPrimitive[];
export type QueryParams = Record<string, QueryValue>;

export interface LetbuyyApiClientOptions {
  baseUrl: string;
  apiVersionPath?: string;
  token?: string | null;
  storeId?: string | null;
  headers?: HeadersInit;
  fetch?: typeof fetch;
}

export interface LetbuyyRequestOptions {
  method?: HttpMethod;
  query?: QueryParams;
  body?: unknown;
  headers?: HeadersInit;
  token?: string | null;
  storeId?: string | null;
  idempotencyKey?: string | null;
  signal?: AbortSignal;
  versioned?: boolean;
}

export interface GatewayPaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface GatewaySuccess<T> {
  success?: true;
  data: T;
  meta?: GatewayPaginationMeta & Record<string, unknown>;
}

export interface GatewayFailure {
  success?: false;
  error: {
    code: string;
    message: string;
    status?: number;
  };
}

export type GatewayResponse<T> = GatewaySuccess<T> | GatewayFailure | ApiResponse<T> | T;

export interface HealthResponse {
  status: string;
  timestamp: string;
  environment: string;
  version: string;
}

export interface ListQuery extends QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface StoreScopedQuery extends ListQuery {
  store_id?: string;
}

export interface AppInstallationListQuery extends Pick<StoreScopedQuery, 'store_id'> {}
export interface AppStoreListQuery extends ListQuery {
  category?: string;
  pricing?: string;
  site_type?: string;
}
export interface AppReviewListQuery extends ListQuery {}
export interface SubmitAppReviewInput extends JsonRecord {
  rating: number;
  title?: string | null;
  body?: string | null;
  store_id?: string;
}
export interface AppInstallInput extends JsonRecord {
  store_id?: string;
  scopes?: string[];
  config?: JsonRecord;
  webhook_url?: string;
  webhook_event?: string;
  webhook_secret?: string;
}
export interface AppDeveloperRegistrationInput extends JsonRecord {
  company_name: string;
  website_url?: string | null;
  support_email: string;
  description?: string | null;
  country?: string;
}
export interface AppSubmissionInput extends JsonRecord {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category_id: string | null;
  app_url: string;
  privacy_policy_url: string;
  pricing_model: string;
  price_monthly?: number | string | null;
  save_as_draft?: boolean;
}
export interface AppDeveloperProfileResult extends JsonRecord {
  developer: MarketplaceAppDeveloper | null;
}
export interface AppDeveloperAppsResult extends JsonRecord {
  developer: MarketplaceAppDeveloper;
  apps: MarketplaceApp[];
}

export interface AnalyticsQuery extends StoreScopedQuery {
  period?: '7d' | '30d' | '90d' | '12m' | string;
}

export interface AIUsageListQuery extends StoreScopedQuery {
  feature?: string;
}

export interface PlanListQuery extends QueryParams {
  site_type: string;
  slug?: string;
}

export interface PageListQuery extends StoreScopedQuery {
  status?: PageStatus | 'all';
}

export interface PolicyListQuery extends StoreScopedQuery {
  status?: PageStatus | 'all';
}

export interface CouponListQuery extends StoreScopedQuery {
  status?: 'active' | 'expired' | 'all';
}

export interface BlogPostListQuery extends StoreScopedQuery {
  status?: BlogPostStatus;
  category_id?: string;
}

export interface BlogCommentListQuery extends StoreScopedQuery {
  status?: BlogCommentStatus | 'all';
}

export interface FormSubmissionListQuery extends StoreScopedQuery {
  type?: 'all' | 'contact' | 'lead';
  status?: FormSubmissionStatus | 'all';
}

export interface ProductReviewListQuery extends StoreScopedQuery {
  status?: ReviewModerationStatus | 'all';
  product_id?: string;
}

export type ResumeContentListQuery = Pick<StoreScopedQuery, 'store_id'>;

export interface ProductListQuery extends StoreScopedQuery {
  category?: string;
  status?: ProductStatus | 'inactive' | 'all';
}

export interface CategoryListQuery extends StoreScopedQuery {
  flat?: boolean;
}

export interface InventoryLevelQuery extends StoreScopedQuery {
  product_id?: string;
  low_stock?: boolean;
}

export interface OrderListQuery extends StoreScopedQuery {
  status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  customer_id?: string;
}

export interface CustomerListQuery extends StoreScopedQuery {
  status?: string;
  email?: string;
  phone?: string;
  has_orders?: boolean;
}

export interface ThemeListQuery extends ListQuery {
  category?: string;
  site_type?: string;
  pricing?: string;
  industry?: string;
  store_id?: string;
}

export type ThemeCatalogItem = Theme & {
  installed?: boolean;
  active?: boolean;
};

export interface ThemeCatalogResponse extends PaginatedResponse<ThemeCatalogItem> {
  current_theme: string | null;
  store_status: string | null;
}

export interface StorefrontProductQuery extends ListQuery {
  category?: string;
  collection?: string;
  tag?: string;
}

export type StorefrontStorePayload = Store & JsonRecord & {
  current_theme_release?: ThemeRelease | null;
};

export type StorefrontStoreStatusPayload = Partial<StorefrontStorePayload> & {
  id: string;
  name?: string | null;
  store_name?: string | null;
  subdomain?: string | null;
  site_type?: string | null;
  status: StoreStatus | string;
};

export type StorefrontContentPayload = JsonRecord & {
  id: string;
  title?: string | null;
  slug?: string | null;
  page_type?: string | null;
  policy_type?: string | null;
  content?: JsonRecord | string | null;
  seo?: JsonRecord | null;
  assigned_template_key?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

export type StorefrontBlogPostPayload = BlogPost & JsonRecord;

export type StorefrontLookupResult = JsonRecord & {
  status: 'invalid' | 'found' | 'not_found' | string;
  message?: string | null;
  store?: JsonRecord & {
    name?: string | null;
    subdomain?: string | null;
    status?: StoreStatus | string | null;
    siteType?: string | null;
  };
};

export type StorefrontDirectoryPayload = {
  stores: JsonRecord[];
  stats: {
    totalStores: number;
    totalThemes: number;
    totalProducts: number;
    totalOrders: number;
  };
};

export interface StorefrontCouponValidationQuery extends QueryParams {
  code: string;
  subtotal?: string | number;
}

export type StorefrontCouponValidationResult = JsonRecord & {
  valid: boolean;
  error?: string | null;
  coupon?: JsonRecord & {
    code?: string;
    type?: string;
    value?: number;
    discount?: number;
    freeShipping?: boolean;
  };
};

export type StorefrontOrderContactSummary = {
  orders: JsonRecord[];
  hasOrders: boolean;
  hasPassword: boolean;
  store_id?: string | null;
};

export type StorefrontOrderCredentialInput = {
  store_id?: string | null;
  subdomain?: string | null;
  email_or_phone: string;
  password: string;
};

export type StorefrontOrderCredentialSaveResult = {
  saved: boolean;
  store_id?: string | null;
};

export type StorefrontOrderCredentialLoginResult = {
  valid: boolean;
  store_id?: string | null;
};

export type StorefrontCustomerRecord = JsonRecord;

export interface StorefrontCustomerLookupQuery extends QueryParams {
  store_id: string;
  email: string;
}

export type StorefrontCustomerFindOrCreateInput = StorefrontCustomerLookupQuery & {
  full_name?: string | null;
  phone?: string | null;
};

export type StorefrontCustomerPasswordInput = StorefrontCustomerLookupQuery & {
  password: string;
};

export type StorefrontCustomerStatsInput = StorefrontCustomerLookupQuery & {
  order_total: number;
  order_id: string;
};

export type StorefrontCustomerStatusResult = {
  exists: boolean;
  hasPassword: boolean;
  status: string;
};

export type StorefrontCustomerResult = {
  customer: StorefrontCustomerRecord | null;
  created?: boolean;
};

export type StorefrontCustomerPasswordResult = {
  customer_id?: string | null;
};

export type StorefrontCustomerStatsResult = {
  updated: boolean;
};

export interface StorefrontWishlistQuery extends QueryParams {
  customer_id: string;
  store_id: string;
}

export type StorefrontWishlistInput = StorefrontWishlistQuery & {
  product_id: string;
  variant_id?: string | null;
};

export type StorefrontWishlistSyncInput = StorefrontWishlistQuery & {
  product_ids: string[];
};

export type StorefrontWishlistResult = {
  product_ids: string[];
};

export type StorefrontCustomerOrdersResult = {
  orders: JsonRecord[];
};

export interface StorefrontCustomerSessionQuery extends QueryParams {
  customer_id: string;
  store_id: string;
  customer_email: string;
}

export type StorefrontCustomerProfileInput = {
  customer_id: string;
  store_id: string;
  full_name?: string | null;
  phone?: string | null;
  accepts_marketing?: boolean;
};

export type StorefrontCustomerProfileResult = {
  customer: StorefrontCustomerRecord | null;
};

export type StorefrontCustomerAddressRecord = CustomerAddress & {
  customer_email?: string | null;
  customer_phone?: string | null;
};

export type StorefrontCustomerAddressListResult = {
  addresses: StorefrontCustomerAddressRecord[];
};

export type StorefrontCustomerAddressInput = StorefrontCustomerSessionQuery & {
  customer_phone?: string | null;
  label?: string | null;
  full_name?: string;
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string | null;
  landmark?: string | null;
  is_default?: boolean;
};

export type StorefrontCustomerAddressResult = {
  address: StorefrontCustomerAddressRecord;
};

export interface StorefrontProductReviewsQuery extends QueryParams {
  product_id: string;
  store_id: string;
}

export type StorefrontProductReviewInput = {
  product_id: string;
  store_id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  is_verified?: boolean;
};

export type StorefrontProductReviewSummary = {
  totalReviews: number;
  averageRating: number;
  distribution: Array<{ star: number; count: number }>;
};

export type StorefrontProductReviewsResult = {
  reviews: ProductReview[];
  summary: StorefrontProductReviewSummary;
};

export type StorefrontProductReviewResult = {
  review: ProductReview;
  message: string;
};

type NewRecord<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'>>;

export type CreateStoreInput = Pick<Store, 'name' | 'site_type'> & Partial<Pick<Store, 'subdomain' | 'tagline' | 'description' | 'currency' | 'locale' | 'timezone'>>;
export type UpdateStoreInput = Partial<NewRecord<Store>> & { status?: StoreStatus };
export type SaveStorePaymentConfigInput = {
  key_id: string;
  key_secret: string;
  test_mode?: boolean;
};
export type EmployeeListQuery = Pick<StoreScopedQuery, 'store_id'>;
export type CreateEmployeeInput = Pick<Employee, 'store_id' | 'email'> & Partial<Employee>;
export type UpdateEmployeeInput = Partial<Pick<Employee, 'role' | 'permissions' | 'status' | 'is_active'>>;
export interface MediaListQuery extends StoreScopedQuery {
  folder?: string;
  type?: MediaType | 'all';
}
export type CreateMediaInput = Pick<MediaAsset, 'store_id' | 'filename' | 'url' | 'mime_type'> & Partial<MediaAsset>;
export type UpdateMediaInput = Partial<Pick<MediaAsset, 'alt_text' | 'caption' | 'folder' | 'tags' | 'filename'>>;
export type CreateProductInput = Pick<Product, 'store_id' | 'name' | 'price'> & NewRecord<Product>;
export type UpdateProductInput = NewRecord<Product>;
export type CreateCollectionInput = Pick<Collection, 'store_id' | 'title'> & NewRecord<Collection>;
export type CreateProductCategoryInput = Pick<ProductCategory, 'store_id' | 'name'> & NewRecord<ProductCategory>;
export type UpdateProductCategoryInput = NewRecord<ProductCategory>;
export type CreateGiftCardInput = Pick<GiftCard, 'store_id' | 'initial_value'> & NewRecord<GiftCard>;
export type InventoryAdjustInput = {
  product_id: string;
  variant_id?: string | null;
  location_id?: string | null;
  adjustment: number;
  reason: InventoryAdjustmentReason;
  notes?: string | null;
};
export type ProductImportInput = {
  store_id: string;
  csv: string;
};
export type ProductImportResult = {
  imported: number;
  products: Array<{ id: string; name: string }>;
};
export type ThemeInstallInput = {
  store_id: string;
  config_overrides?: JsonRecord;
};
export type ThemeInstallResult = {
  installation: JsonRecord;
  theme: Pick<Theme, 'id' | 'slug' | 'name'>;
  release: JsonRecord;
};
export type ThemePackageUploadInput = {
  bundle: JsonRecord;
};
export type ThemePackageUploadResult = {
  theme: Pick<Theme, 'id' | 'slug' | 'name'>;
  package: {
    id: string;
    slug: string;
    name: string;
    status: string;
  };
  version: {
    id: string;
    version: string;
    version_number: number;
    release_status: string;
  };
  schema_manifest_version: string;
  renderer_version: string;
  installable: boolean;
};
export type SaveThemeDraftInput = {
  store_id: string;
  template_config: JsonRecord;
  base_version?: number;
  client?: 'admin-web' | 'flutter-builder' | 'api';
};
export type PublishThemeInput = {
  store_id: string;
  base_version?: number;
  make_store_live?: boolean;
  publish_message?: string;
};
export type ThemePreviewSessionInput = {
  store_id: string;
  ttl_seconds?: number;
};
export type RollbackThemeReleaseInput = {
  store_id: string;
  make_store_live?: boolean;
  rollback_message?: string;
};
export type CreateOrderInput = Pick<Order, 'store_id' | 'line_items' | 'currency'> & NewRecord<Order>;
export type StorefrontCreateOrderInput = {
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: {
      address: string;
      city: string;
      state: string;
      pincode: string;
    };
  };
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
  }>;
  paymentMethod?: 'razorpay' | 'stripe' | 'paypal' | 'cod';
  deliveryOption?: 'standard' | 'express';
  notes?: string;
  couponCode?: string;
  giftCardCode?: string;
  idempotencyKey: string;
};
export type StorefrontOrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
};
export type StorefrontCreateOrderResult = {
  order: StorefrontOrderSummary;
};
export type UpdateOrderInput = Partial<Pick<Order, 'status' | 'payment_status' | 'fulfillment_status' | 'tracking_number' | 'tracking_url' | 'notes'>> & {
  idempotency_key?: string;
  carrier?: string;
  cancellation_reason?: string;
  version?: number;
};
export type CreateCustomerAddressInput = Pick<CustomerAddress, 'store_id' | 'full_name' | 'address_line1' | 'city' | 'state' | 'postal_code'> & NewRecord<CustomerAddress>;
export type UpdateCustomerAddressInput = NewRecord<CustomerAddress>;
export type CreatePageInput = Pick<Page, 'store_id' | 'title' | 'slug'> & NewRecord<Page>;
export type UpdatePageInput = NewRecord<Page>;
export type CreatePolicyInput = Pick<Policy, 'store_id' | 'policy_type' | 'title'> & NewRecord<Policy>;
export type UpdatePolicyInput = Partial<Pick<Policy, 'policy_type' | 'slug' | 'title' | 'body' | 'status' | 'seo_title' | 'seo_description'>>;
export type NavigationItemInput = Pick<NavigationItem, 'label'> & Partial<Pick<NavigationItem, 'id' | 'url' | 'target_type' | 'target_resource_id' | 'parent_item_id' | 'sort_order' | 'is_visible' | 'open_in_new_tab'>>;
export type ReplaceNavigationInput = {
  store_id: string;
  location: string;
  name?: string;
  items?: NavigationItemInput[];
};
export type CreateBlogPostInput = Pick<BlogPost, 'store_id' | 'title' | 'content'> & NewRecord<BlogPost> & {
  tag_ids?: string[];
};
export type UpdateBlogPostInput = NewRecord<BlogPost> & {
  tag_ids?: string[];
  version?: number;
};
export type UpdateBlogCommentInput = Pick<BlogComment, 'status'>;
export type UpdateFormSubmissionInput = Pick<FormSubmission, 'status'>;
export type UpdateProductReviewInput = Pick<ProductReview, 'status'>;
export type CreateResumeContentItemInput = Pick<ResumeContentItem, 'store_id'> & Partial<ResumeContentItem>;
export type UpdateResumeContentItemInput = Partial<ResumeContentItem>;
export type ShippingTaxListQuery = StoreScopedQuery;
export type CreateShippingZoneInput = Pick<ShippingZone, 'store_id' | 'name' | 'countries'> & Partial<ShippingZone>;
export type UpdateShippingZoneInput = Partial<ShippingZone>;
export type CreateShippingRateInput = Pick<ShippingRate, 'zone_id' | 'name' | 'type'> & Partial<ShippingRate>;
export type UpdateShippingRateInput = Partial<ShippingRate>;
export type CreateTaxRateInput = Pick<TaxRate, 'store_id' | 'name' | 'rate'> & Partial<TaxRate>;
export type UpdateTaxRateInput = Partial<TaxRate>;
export type CreateCouponInput = Pick<Coupon, 'store_id' | 'code' | 'type' | 'value'> & NewRecord<Coupon>;
export type UpdateCouponInput = NewRecord<Coupon>;
export type CreatePaymentInput = Pick<Payment, 'store_id' | 'provider' | 'method' | 'currency' | 'amount' | 'amount_minor' | 'idempotency_key'> & NewRecord<Payment>;
export type CreateSubscriptionOrderInput = {
  store_id: string;
  plan_slug: string;
  billing_period?: SubscriptionBillingPeriod;
  site_type: string;
  approved_usage_charges?: Array<{
    meter_name: string;
    description?: string;
    amount_minor: number;
    quantity?: number;
    idempotency_key: string;
  }>;
};
export type VerifySubscriptionInput = {
  store_id: string;
  plan_slug: string;
  billing_period?: SubscriptionBillingPeriod;
  site_type: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
export type CancelSubscriptionInput = {
  store_id: string;
  reason?: string;
};

export class LetbuyyApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly body: unknown;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    requestId?: string | null;
    body?: unknown;
  }) {
    super(input.message);
    this.name = 'LetbuyyApiError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId ?? null;
    this.body = input.body;
  }
}

export class LetbuyyApiClient {
  private readonly baseUrl: string;
  private readonly apiVersionPath: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultToken: string | null;
  private readonly defaultStoreId: string | null;
  private readonly defaultHeaders: HeadersInit | undefined;

  constructor(options: LetbuyyApiClientOptions) {
    if (!options.baseUrl.trim()) {
      throw new Error('LetBuyy API client requires a baseUrl');
    }

    const apiVersionPath = normalizePath(options.apiVersionPath ?? '/v1');
    const trimmedBaseUrl = trimTrailingSlash(options.baseUrl.trim());

    this.apiVersionPath = apiVersionPath;
    this.baseUrl = trimmedBaseUrl.endsWith(apiVersionPath)
      ? trimTrailingSlash(trimmedBaseUrl.slice(0, -apiVersionPath.length))
      : trimmedBaseUrl;
    this.fetchImpl = options.fetch ?? fetch;
    this.defaultToken = options.token ?? null;
    this.defaultStoreId = options.storeId ?? null;
    this.defaultHeaders = options.headers;
  }

  readonly stores = {
    list: (query?: ListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<StoreSummary>('/stores', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}`, options),
    getBySubdomain: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/public/${encodePathSegment(subdomain)}`, options),
    getByHandle: (handle: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StoreSummary>(`/stores/handle/${encodePathSegment(handle)}`, options),
    create: (input: CreateStoreInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>('/stores', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateStoreInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    publish: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}/publish`, { ...options, method: 'POST' }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ id: string }>(`/stores/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    paymentConfig: {
      get: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<StorePaymentConfig>(`/stores/${encodePathSegment(id)}/payment-config`, options),
      save: (id: string, input: SaveStorePaymentConfigInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StorePaymentConfig>(`/stores/${encodePathSegment(id)}/payment-config`, { ...options, method: 'POST', body: input }),
    },
  };

  readonly auth = {
    session: (options?: LetbuyyRequestOptions) =>
      this.request<AuthSessionResponse>('/auth/custom/session', options),
  };

  readonly appStore = {
    apps: (query?: AppStoreListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<MarketplaceApp>('/app-store/apps', { ...options, query }),
    app: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceApp>(`/app-store/apps/${encodePathSegment(id)}`, options),
    reviews: (appId: string, query?: AppReviewListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<MarketplaceAppReview>(`/app-store/apps/${encodePathSegment(appId)}/reviews`, { ...options, query }),
    submitReview: (appId: string, input: SubmitAppReviewInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppReview>(`/app-store/apps/${encodePathSegment(appId)}/reviews`, { ...options, method: 'POST', body: input }),
    categories: (options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppCategory[]>('/app-store/categories', options),
    installations: (query?: AppInstallationListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<InstalledApp[]>('/app-store/installations', { ...options, query }),
    embedSession: (installationId: string, query?: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AdminAppBridgeSession>(
        `/app-store/installations/${encodePathSegment(installationId)}/embed-session`,
        { ...options, method: 'POST', query },
      ),
    install: (appId: string, input: AppInstallInput, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/app-store/apps/${encodePathSegment(appId)}/install`, { ...options, method: 'POST', body: input }),
    uninstall: (appId: string, query?: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<{ uninstalled: boolean }>(`/app-store/apps/${encodePathSegment(appId)}/install`, { ...options, method: 'DELETE', query }),
    developer: (options?: LetbuyyRequestOptions) =>
      this.requestData<AppDeveloperProfileResult>('/app-store/developers/me', options),
    registerDeveloper: (input: AppDeveloperRegistrationInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppDeveloperProfileResult>('/app-store/developers/register', { ...options, method: 'POST', body: input }),
    developerApps: (options?: LetbuyyRequestOptions) =>
      this.requestData<AppDeveloperAppsResult>('/app-store/developers/apps', options),
    submitDeveloperApp: (input: AppSubmissionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ app: JsonRecord }>('/app-store/developers/apps', { ...options, method: 'POST', body: input }),
  };

  readonly employees = {
    list: (query: EmployeeListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<Employee[]>('/employees', { ...options, query }),
    create: (input: CreateEmployeeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Employee>('/employees', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateEmployeeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Employee>(`/employees/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/employees/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly media = {
    list: (query: MediaListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<MediaAsset>('/media', { ...options, query }),
    create: (input: CreateMediaInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MediaAsset>('/media', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateMediaInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MediaAsset>(`/media/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/media/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly upload = {
    file: (formData: FormData, options?: LetbuyyRequestOptions) =>
      this.requestData<FileUploadResult>('/upload', { ...options, method: 'POST', body: formData }),
    remove: (key: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean; storage?: string }>(`/upload/${encodePathSegment(key)}`, { ...options, method: 'DELETE' }),
  };

  readonly analytics = {
    dashboard: (query: AnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<AnalyticsDashboard>('/analytics/dashboard', { ...options, query }),
    orders: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AnalyticsOrdersBreakdown>('/analytics/orders', { ...options, query }),
  };

  readonly ai = {
    credits: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AICreditBalance>('/ai/credits', { ...options, query }),
    usage: (query: AIUsageListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<AIUsageRecord>('/ai/usage', { ...options, query }),
  };

  readonly products = {
    list: (query?: ProductListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>('/products', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>(`/products/${encodePathSegment(id)}`, options),
    create: (input: CreateProductInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>('/products', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateProductInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>(`/products/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ id: string }>(`/products/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    bulk: (input: { store_id: string; action: string; product_ids: string[] }, options?: LetbuyyRequestOptions) =>
      this.requestData<{ updated: number }>('/products/bulk', { ...options, method: 'POST', body: input }),
    collections: {
      list: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<Collection[]>('/products/collections', { ...options, query }),
      create: (input: CreateCollectionInput, options?: LetbuyyRequestOptions) =>
        this.requestData<Collection>('/products/collections', { ...options, method: 'POST', body: input }),
    },
    giftCards: {
      list: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<GiftCard[]>('/products/gift-cards', { ...options, query }),
      create: (input: CreateGiftCardInput, options?: LetbuyyRequestOptions) =>
        this.requestData<GiftCard>('/products/gift-cards', { ...options, method: 'POST', body: input }),
    },
    importCsv: (input: ProductImportInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductImportResult>('/export/import-products', { ...options, method: 'POST', body: input }),
  };

  readonly categories = {
    list: (query?: CategoryListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductCategory[]>('/categories', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductCategory>(`/categories/${encodePathSegment(id)}`, options),
    create: (input: CreateProductCategoryInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductCategory>('/categories', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateProductCategoryInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductCategory>(`/categories/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/categories/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly inventory = {
    levels: (query?: InventoryLevelQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InventoryLevel>('/inventory/levels', { ...options, query }),
    adjust: (input: InventoryAdjustInput, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/inventory/adjust', { ...options, method: 'POST', body: input }),
  };

  readonly orders = {
    list: (query?: OrderListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Order>('/orders', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}`, options),
    create: (input: CreateOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>('/orders', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    fulfill: (id: string, input: UpdateOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}/fulfill`, { ...options, method: 'POST', body: input }),
    refund: (id: string, input: { amount?: number; reason?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}/refund`, { ...options, method: 'POST', body: input }),
  };

  readonly customers = {
    list: (query?: CustomerListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Customer>('/customers', { ...options, query }),
    getByEmail: (email: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Customer>(`/customers/${encodePathSegment(email)}`, options),
    addresses: {
      list: (email: string, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerAddress[]>(`/customers/${encodePathSegment(email)}/addresses`, options),
      create: (email: string, input: CreateCustomerAddressInput, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerAddress>(`/customers/${encodePathSegment(email)}/addresses`, { ...options, method: 'POST', body: input }),
      update: (email: string, id: string, input: UpdateCustomerAddressInput, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerAddress>(`/customers/${encodePathSegment(email)}/addresses/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (email: string, id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ id: string }>(`/customers/${encodePathSegment(email)}/addresses/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly pages = {
    list: (query?: PageListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Page>('/pages', { ...options, query }),
    create: (input: CreatePageInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Page>('/pages', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdatePageInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Page>(`/pages/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/pages/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    policies: {
      list: (query?: PolicyListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<Policy[]>('/pages/policies', { ...options, query }),
      create: (input: CreatePolicyInput, options?: LetbuyyRequestOptions) =>
        this.requestData<Policy>('/pages/policies', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdatePolicyInput, options?: LetbuyyRequestOptions) =>
        this.requestData<Policy>(`/pages/policies/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/pages/policies/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
    navigation: {
      get: (query: { store_id: string; location?: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<NavigationResponse>('/pages/navigation', { ...options, query }),
      replace: (location: string, input: ReplaceNavigationInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ReplaceNavigationResult>(`/pages/navigation/${encodePathSegment(location)}`, { ...options, method: 'PUT', body: input }),
    },
  };

  readonly coupons = {
    list: (query?: CouponListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Coupon>('/coupons', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>(`/coupons/${encodePathSegment(id)}`, options),
    create: (input: CreateCouponInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>('/coupons', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateCouponInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>(`/coupons/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/coupons/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    validate: (input: { store_id: string; code: string; cart_total?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>('/coupons/validate', { ...options, method: 'POST', body: input }),
  };

  readonly blog = {
    posts: {
      list: (query?: BlogPostListQuery, options?: LetbuyyRequestOptions) =>
        this.requestPaginated<BlogPost>('/blog/posts', { ...options, query }),
      get: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<BlogPost>(`/blog/posts/${encodePathSegment(id)}`, options),
      create: (input: CreateBlogPostInput, options?: LetbuyyRequestOptions) =>
        this.requestData<BlogPost>('/blog/posts', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdateBlogPostInput, options?: LetbuyyRequestOptions) =>
        this.requestData<BlogPost>(`/blog/posts/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/blog/posts/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
    comments: {
      list: (query: BlogCommentListQuery, options?: LetbuyyRequestOptions) =>
        this.requestPaginated<BlogComment>('/blog/comments', { ...options, query }),
      update: (id: string, input: UpdateBlogCommentInput, options?: LetbuyyRequestOptions) =>
        this.requestData<BlogComment>(`/blog/comments/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/blog/comments/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly formSubmissions = {
    list: (query: FormSubmissionListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<FormSubmission>('/form-submissions', { ...options, query }),
    update: (id: string, input: UpdateFormSubmissionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<FormSubmission>(`/form-submissions/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/form-submissions/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly reviews = {
    list: (query: ProductReviewListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<ProductReview>('/reviews', { ...options, query }),
    update: (id: string, input: UpdateProductReviewInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductReview>(`/reviews/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/reviews/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly resume = {
    content: {
      list: (section: ResumeContentSection, query: ResumeContentListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<ResumeContentItem[]>(`/resume/section/${encodePathSegment(section)}`, { ...options, query }),
      create: (section: ResumeContentSection, input: CreateResumeContentItemInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ResumeContentItem>(`/resume/section/${encodePathSegment(section)}`, { ...options, method: 'POST', body: input }),
      update: (section: ResumeContentSection, id: string, input: UpdateResumeContentItemInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ResumeContentItem>(`/resume/section/${encodePathSegment(section)}/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (section: ResumeContentSection, id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/resume/section/${encodePathSegment(section)}/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly shipping = {
    zones: {
      list: (query: ShippingTaxListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingZone[]>('/shipping-tax/shipping/zones', { ...options, query }),
      create: (input: CreateShippingZoneInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingZone>('/shipping-tax/shipping/zones', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdateShippingZoneInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingZone>(`/shipping-tax/shipping/zones/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/shipping-tax/shipping/zones/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
    rates: {
      list: (query: ShippingTaxListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingRate[]>('/shipping-tax/shipping', { ...options, query }),
      create: (input: CreateShippingRateInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingRate>('/shipping-tax/shipping', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdateShippingRateInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingRate>(`/shipping-tax/shipping/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/shipping-tax/shipping/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly taxes = {
    list: (query: ShippingTaxListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<TaxRate[]>('/shipping-tax/taxes', { ...options, query }),
    create: (input: CreateTaxRateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<TaxRate>('/shipping-tax/taxes', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateTaxRateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<TaxRate>(`/shipping-tax/taxes/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/shipping-tax/taxes/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly themes = {
    list: (query?: ThemeListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Theme>('/themes', { ...options, query }),
    listCatalog: async (query?: ThemeListQuery, options?: LetbuyyRequestOptions): Promise<ThemeCatalogResponse> => {
      const body = await this.request<GatewayResponse<ThemeCatalogItem[]> & { current_theme?: unknown; store_status?: unknown }>(
        '/themes',
        { ...options, query },
      );
      const data = unwrapData<ThemeCatalogItem[]>(body, 200, null);
      const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {};

      return {
        data,
        total: numberValue(meta.total, data.length),
        page: numberValue(meta.page, 1),
        limit: numberValue(meta.per_page, data.length),
        has_more: Boolean(meta.has_next),
        current_theme: typeof body.current_theme === 'string' ? body.current_theme : null,
        store_status: typeof body.store_status === 'string' ? body.store_status : null,
      };
    },
    get: (slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Theme>(`/themes/${encodePathSegment(slug)}`, options),
    schema: (slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeEditableSchemaResponse>(`/themes/${encodePathSegment(slug)}/schema`, options),
    categories: (options?: LetbuyyRequestOptions) =>
      this.requestData<string[]>('/themes/categories', options),
    industries: (options?: LetbuyyRequestOptions) =>
      this.requestData<string[]>('/themes/industries', options),
    purchases: (options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord[]>('/themes/purchases/list', options),
    installations: (options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord[]>('/themes/installations/list', options),
    install: (slug: string, input: ThemeInstallInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeInstallResult>(`/themes/${encodePathSegment(slug)}/install`, { ...options, method: 'POST', body: input }),
    uploadPackage: (input: ThemePackageUploadInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePackageUploadResult>('/themes/packages/upload', { ...options, method: 'POST', body: input }),
    editor: (slug: string, storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeEditorPayload>(`/themes/${encodePathSegment(slug)}/editor`, { ...options, query: { store_id: storeId } }),
    saveDraft: (slug: string, input: SaveThemeDraftInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeDraftSaveResult>(`/themes/${encodePathSegment(slug)}/editor/draft`, { ...options, method: 'PUT', body: input }),
    deleteDraft: (slug: string, storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/themes/${encodePathSegment(slug)}/editor/draft`, { ...options, method: 'DELETE', query: { store_id: storeId } }),
    publish: (slug: string, input: PublishThemeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePublishResult>(`/themes/${encodePathSegment(slug)}/publish`, { ...options, method: 'POST', body: input }),
    previewSession: (slug: string, input: ThemePreviewSessionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePreviewSessionResult>(`/themes/${encodePathSegment(slug)}/preview-session`, { ...options, method: 'POST', body: input }),
    releases: (slug: string, storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeRelease[]>(`/themes/${encodePathSegment(slug)}/releases`, { ...options, query: { store_id: storeId } }),
    rollbackRelease: (slug: string, releaseId: string, input: RollbackThemeReleaseInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeRollbackResult>(`/themes/${encodePathSegment(slug)}/releases/${encodePathSegment(releaseId)}/rollback`, { ...options, method: 'POST', body: input }),
  };

  readonly payments = {
    create: (input: CreatePaymentInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Payment>('/payments', {
        ...options,
        method: 'POST',
        body: input,
        idempotencyKey: options?.idempotencyKey ?? input.idempotency_key,
      }),
    plans: (query: PlanListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<SubscriptionPlan[]>('/payments/plans', { ...options, query }),
    subscription: {
      get: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreSubscriptionState>('/payments/subscription', { ...options, query }),
      history: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<BillingHistoryItem[]>('/payments/subscription/history', { ...options, query }),
      cancel: (input: CancelSubscriptionInput, options?: LetbuyyRequestOptions) =>
        this.requestData<SubscriptionCancelResult>('/payments/subscription/cancel', { ...options, method: 'POST', body: input }),
      createOrder: (input: CreateSubscriptionOrderInput, options?: LetbuyyRequestOptions) =>
        this.requestData<SubscriptionOrderResult>('/payments/subscription/order', { ...options, method: 'POST', body: input }),
      verify: (input: VerifySubscriptionInput, options?: LetbuyyRequestOptions) =>
        this.requestData<SubscriptionVerificationResult>('/payments/subscription/verify', { ...options, method: 'POST', body: input }),
    },
  };

  readonly storefront = {
    lookup: (query: { q?: string; host?: string; subdomain?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontLookupResult>('/storefront/lookup', { ...options, query }),
    directory: (options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontDirectoryPayload>('/storefront/directory', options),
    getStoreById: (storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontStorePayload>(`/storefront/store/${encodePathSegment(storeId)}`, options),
    getStore: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontStorePayload>(`/storefront/${encodePathSegment(subdomain)}`, options),
    status: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontStoreStatusPayload>(`/storefront/${encodePathSegment(subdomain)}/status`, options),
    themePreview: (subdomain: string, token: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontStorePayload>(`/storefront/${encodePathSegment(subdomain)}/theme-preview`, { ...options, query: { token } }),
    navigation: (subdomain: string, location: string, options?: LetbuyyRequestOptions) =>
      this.requestData<NavigationResponse>(`/storefront/${encodePathSegment(subdomain)}/navigation`, { ...options, query: { location } }),
    listProducts: (subdomain: string, query?: StorefrontProductQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>(`/storefront/${encodePathSegment(subdomain)}/products`, { ...options, query }),
    listProductsByStoreId: (storeId: string, query?: StorefrontProductQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>(`/storefront/store/${encodePathSegment(storeId)}/products`, { ...options, query }),
    getProduct: (subdomain: string, slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>(`/storefront/${encodePathSegment(subdomain)}/products/${encodePathSegment(slug)}`, options),
    productsByIds: (subdomain: string, productIds: string[], options?: LetbuyyRequestOptions) =>
      this.requestData<Product[]>(`/storefront/${encodePathSegment(subdomain)}/products/by-ids`, {
        ...options,
        query: { ids: productIds },
      }),
    createOrder: (subdomain: string, input: StorefrontCreateOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCreateOrderResult>(`/storefront/${encodePathSegment(subdomain)}/orders`, { ...options, method: 'POST', body: input }),
    pages: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload[]>(`/storefront/${encodePathSegment(subdomain)}/pages`, options),
    page: (subdomain: string, slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload>(`/storefront/${encodePathSegment(subdomain)}/pages/${encodePathSegment(slug)}`, options),
    policies: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload[]>(`/storefront/${encodePathSegment(subdomain)}/policies`, options),
    policy: (subdomain: string, policyType: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload>(`/storefront/${encodePathSegment(subdomain)}/policies/${encodePathSegment(policyType)}`, options),
    blogPosts: (subdomain: string, query?: ListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<StorefrontBlogPostPayload>(`/storefront/${encodePathSegment(subdomain)}/blog`, { ...options, query }),
    blogPost: (subdomain: string, slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload>(`/storefront/${encodePathSegment(subdomain)}/blog/${encodePathSegment(slug)}`, options),
    validateCoupon: (subdomain: string, query: StorefrontCouponValidationQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCouponValidationResult>(`/storefront/${encodePathSegment(subdomain)}/coupons/validate`, { ...options, query }),
    validateCouponByStoreId: (storeId: string, query: StorefrontCouponValidationQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCouponValidationResult>(`/storefront/store/${encodePathSegment(storeId)}/coupons/validate`, { ...options, query }),
    orderContactSummary: (subdomain: string, contact: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontOrderContactSummary>(`/storefront/${encodePathSegment(subdomain)}/orders/contact`, { ...options, query: { contact } }),
    setOrderCredential: (input: StorefrontOrderCredentialInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontOrderCredentialSaveResult>('/storefront/customer/order-credential', { ...options, method: 'POST', body: input }),
    verifyOrderCredential: (input: StorefrontOrderCredentialInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontOrderCredentialLoginResult>('/storefront/customer/order-credential/login', { ...options, method: 'POST', body: input }),
    findOrCreateCustomer: (input: StorefrontCustomerFindOrCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerResult>('/storefront/customer/find-or-create', { ...options, method: 'POST', body: input }),
    customerByEmail: (query: StorefrontCustomerLookupQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerResult>('/storefront/customer/by-email', { ...options, query }),
    customerStatus: (query: StorefrontCustomerLookupQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerStatusResult>('/storefront/customer/status', { ...options, query }),
    setCustomerPassword: (input: StorefrontCustomerPasswordInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerPasswordResult>('/storefront/customer/password', { ...options, method: 'POST', body: input }),
    verifyCustomerPassword: (input: StorefrontCustomerPasswordInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerResult>('/storefront/customer/login', { ...options, method: 'POST', body: input }),
    updateCustomerStats: (input: StorefrontCustomerStatsInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerStatsResult>('/storefront/customer/order-stats', { ...options, method: 'POST', body: input }),
    customerWishlist: (query: StorefrontWishlistQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontWishlistResult>('/storefront/customer/wishlist', { ...options, query }),
    addCustomerWishlistItem: (input: StorefrontWishlistInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ saved: boolean }>('/storefront/customer/wishlist', { ...options, method: 'POST', body: input }),
    removeCustomerWishlistItem: (input: StorefrontWishlistInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ removed: boolean }>('/storefront/customer/wishlist', { ...options, method: 'DELETE', body: input }),
    syncCustomerWishlist: (input: StorefrontWishlistSyncInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ synced: number }>('/storefront/customer/wishlist/sync', { ...options, method: 'POST', body: input }),
    customerOrders: (query: StorefrontCustomerLookupQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerOrdersResult>('/storefront/customer/orders', { ...options, query }),
    updateCustomerProfile: (input: StorefrontCustomerProfileInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerProfileResult>('/storefront/customer/profile', { ...options, method: 'PATCH', body: input }),
    customerAddresses: (query: StorefrontCustomerSessionQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerAddressListResult>('/storefront/customer/addresses', { ...options, query }),
    createCustomerAddress: (input: StorefrontCustomerAddressInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerAddressResult>('/storefront/customer/addresses', { ...options, method: 'POST', body: input }),
    updateCustomerAddress: (id: string, input: StorefrontCustomerAddressInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerAddressResult>(`/storefront/customer/addresses/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    removeCustomerAddress: (id: string, input: StorefrontCustomerSessionQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/storefront/customer/addresses/${encodePathSegment(id)}`, { ...options, method: 'DELETE', body: input }),
    productReviews: (query: StorefrontProductReviewsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontProductReviewsResult>('/storefront/reviews', { ...options, query }),
    submitProductReview: (input: StorefrontProductReviewInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontProductReviewResult>('/storefront/reviews', { ...options, method: 'POST', body: input }),
  };

  withOptions(options: Partial<LetbuyyApiClientOptions>): LetbuyyApiClient {
    return new LetbuyyApiClient({
      baseUrl: options.baseUrl ?? this.baseUrl,
      apiVersionPath: options.apiVersionPath ?? this.apiVersionPath,
      token: options.token ?? this.defaultToken,
      storeId: options.storeId ?? this.defaultStoreId,
      headers: options.headers ?? this.defaultHeaders,
      fetch: options.fetch ?? this.fetchImpl,
    });
  }

  health(options?: LetbuyyRequestOptions): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health', { ...options, versioned: false });
  }

  async requestData<T>(path: string, options?: LetbuyyRequestOptions): Promise<T> {
    const body = await this.request<GatewayResponse<T>>(path, options);
    return unwrapData<T>(body, 200, null);
  }

  async requestPaginated<T>(path: string, options?: LetbuyyRequestOptions): Promise<PaginatedResponse<T>> {
    const body = await this.request<GatewayResponse<T[]>>(path, options);
    const data = unwrapData<T[]>(body, 200, null);
    const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {};

    return {
      data,
      total: numberValue(meta.total, data.length),
      page: numberValue(meta.page, 1),
      limit: numberValue(meta.per_page, data.length),
      has_more: Boolean(meta.has_next),
    };
  }

  async request<T>(path: string, options: LetbuyyRequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options);
    const headers = this.buildHeaders(options);
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      signal: options.signal,
    };

    if (options.body !== undefined) {
      if (isRawRequestBody(options.body)) {
        init.body = options.body;
      } else {
        init.body = JSON.stringify(options.body);
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      }
    }

    const response = await this.fetchImpl(url, init);
    const requestId = response.headers.get('X-Request-ID');
    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw errorFromBody(body, response.status, requestId);
    }

    if (isFailurePayload(body)) {
      throw errorFromBody(body, response.status, requestId);
    }

    return body as T;
  }

  private buildHeaders(options: LetbuyyRequestOptions): Headers {
    const headers = new Headers(this.defaultHeaders);
    copyHeaders(headers, options.headers);

    const token = options.token ?? this.defaultToken;
    const storeId = options.storeId ?? this.defaultStoreId;

    headers.set('Accept', headers.get('Accept') ?? 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (storeId) headers.set('X-Store-ID', storeId);
    if (options.idempotencyKey) headers.set('X-Idempotency-Key', options.idempotencyKey);

    return headers;
  }

  private buildUrl(path: string, options: LetbuyyRequestOptions): string {
    const isAbsolute = path.startsWith('http://') || path.startsWith('https://');
    const route = isAbsolute
      ? path
      : `${this.baseUrl}${options.versioned === false ? '' : this.apiVersionPath}${normalizePath(path)}`;
    const query = serializeQuery(options.query);

    if (!query) return route;
    return `${route}${route.includes('?') ? '&' : '?'}${query}`;
  }
}

export function createLetbuyyApiClient(options: LetbuyyApiClientOptions): LetbuyyApiClient {
  return new LetbuyyApiClient(options);
}

function unwrapData<T>(body: GatewayResponse<T>, status: number, requestId: string | null): T {
  if (isFailurePayload(body)) {
    throw errorFromBody(body, status, requestId);
  }

  if (isRecord(body) && 'data' in body) {
    return body.data as T;
  }

  return body as T;
}

function isRawRequestBody(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  );
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<unknown>;
  }

  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorFromBody(body: unknown, status: number, requestId: string | null): LetbuyyApiError {
  if (isFailurePayload(body)) {
    return new LetbuyyApiError({
      status: body.error.status ?? status,
      code: body.error.code,
      message: body.error.message,
      requestId,
      body,
    });
  }

  return new LetbuyyApiError({
    status,
    code: status === 401 ? 'UNAUTHORIZED' : 'API_ERROR',
    message: typeof body === 'string' && body ? body : `LetBuyy API request failed with status ${status}`,
    requestId,
    body,
  });
}

function isFailurePayload(value: unknown): value is GatewayFailure {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function serializeQuery(query?: QueryParams): string {
  if (!query) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(params, key, value);
  }

  return params.toString();
}

function appendQueryValue(params: URLSearchParams, key: string, value: QueryValue): void {
  if (Array.isArray(value)) {
    for (const item of value) appendQueryValue(params, key, item);
    return;
  }

  if (value === undefined || value === null) return;
  params.append(key, String(value));
}

function copyHeaders(target: Headers, source?: HeadersInit): void {
  if (!source) return;
  new Headers(source).forEach((value, key) => {
    target.set(key, value);
  });
}

function normalizePath(value: string): string {
  const path = value.trim();
  if (!path) return '';
  return path.startsWith('/') ? trimTrailingSlash(path) : `/${trimTrailingSlash(path)}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export type {
  AICreditBalance,
  AIUsageRecord,
  AnalyticsDashboard,
  AnalyticsOrdersBreakdown,
  AuthSessionResponse,
  BlogComment,
  BlogPost,
  BillingHistoryItem,
  Cart,
  Collection,
  Coupon,
  Customer,
  CustomerAddress,
  Employee,
  FileUploadResult,
  FormSubmission,
  GiftCard,
  InventoryLevel,
  LineItem,
  MediaAsset,
  MediaType,
  MarketplaceApp,
  MarketplaceAppCategory,
  MarketplaceAppDeveloper,
  MarketplaceAppReview,
  NavigationItem,
  NavigationResponse,
  Order,
  Page,
  PaginatedResponse,
  Payment,
  Policy,
  PolicyType,
  Product,
  ProductCategory,
  ProductReview,
  ResumeContentItem,
  ResumeContentSection,
  ReplaceNavigationResult,
  ShippingRate,
  ShippingZone,
  Store,
  StorePaymentConfig,
  StoreSummary,
  StoreSubscriptionState,
  SubscriptionBillingPeriod,
  SubscriptionCancelResult,
  SubscriptionOrderResult,
  SubscriptionPlan,
  SubscriptionVerificationResult,
  TaxRate,
  Theme,
  ThemeDraftSaveResult,
  ThemeEditableSchemaResponse,
  ThemeEditorPayload,
  ThemePreviewSessionResult,
  ThemePublishResult,
  ThemeRelease,
  ThemeRollbackResult,
};
