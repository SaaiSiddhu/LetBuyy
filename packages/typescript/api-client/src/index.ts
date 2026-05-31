import type {
  ApiResponse,
  Cart,
  Collection,
  Coupon,
  Customer,
  CustomerAddress,
  LineItem,
  Order,
  Page,
  PaginatedResponse,
  Payment,
  Product,
  ProductStatus,
  Store,
  StoreStatus,
  Theme,
  ThemeBundle,
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

export interface ProductListQuery extends StoreScopedQuery {
  category?: string;
  status?: ProductStatus | 'inactive' | 'all';
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
}

export interface ThemeListQuery extends ListQuery {
  category?: string;
  site_type?: string;
  pricing?: string;
  industry?: string;
  store_id?: string;
}

export interface StorefrontProductQuery extends ListQuery {
  category?: string;
  collection?: string;
  tag?: string;
}

type NewRecord<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'>>;

export type CreateStoreInput = Pick<Store, 'name' | 'site_type'> & Partial<Pick<Store, 'subdomain' | 'tagline' | 'description' | 'currency' | 'locale' | 'timezone'>>;
export type UpdateStoreInput = Partial<NewRecord<Store>> & { status?: StoreStatus };
export type CreateProductInput = Pick<Product, 'store_id' | 'name' | 'price'> & NewRecord<Product>;
export type UpdateProductInput = NewRecord<Product>;
export type CreateCollectionInput = Pick<Collection, 'store_id' | 'title'> & NewRecord<Collection>;
export type CreateOrderInput = Pick<Order, 'store_id' | 'line_items' | 'currency'> & NewRecord<Order>;
export type UpdateOrderInput = Partial<Pick<Order, 'status' | 'payment_status' | 'fulfillment_status' | 'tracking_number' | 'tracking_url' | 'notes'>>;
export type CreateCustomerAddressInput = Pick<CustomerAddress, 'store_id' | 'full_name' | 'address_line1' | 'city' | 'state' | 'postal_code'> & NewRecord<CustomerAddress>;
export type UpdateCustomerAddressInput = NewRecord<CustomerAddress>;
export type CreatePageInput = Pick<Page, 'store_id' | 'title' | 'slug'> & NewRecord<Page>;
export type UpdatePageInput = NewRecord<Page>;
export type CreateCouponInput = Pick<Coupon, 'store_id' | 'code' | 'type' | 'value'> & NewRecord<Coupon>;
export type UpdateCouponInput = NewRecord<Coupon>;
export type CreatePaymentInput = Pick<Payment, 'store_id' | 'provider' | 'method' | 'currency' | 'amount' | 'amount_minor' | 'idempotency_key'> & NewRecord<Payment>;

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
      this.requestPaginated<Store>('/stores', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}`, options),
    getBySubdomain: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/public/${encodePathSegment(subdomain)}`, options),
    getByHandle: (handle: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/handle/${encodePathSegment(handle)}`, options),
    create: (input: CreateStoreInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>('/stores', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateStoreInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    publish: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}/publish`, { ...options, method: 'POST' }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ id: string }>(`/stores/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
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
    list: (query?: StoreScopedQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Page>('/pages', { ...options, query }),
    create: (input: CreatePageInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Page>('/pages', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdatePageInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Page>(`/pages/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ id: string }>(`/pages/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly coupons = {
    list: (query?: StoreScopedQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Coupon>('/coupons', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>(`/coupons/${encodePathSegment(id)}`, options),
    create: (input: CreateCouponInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>('/coupons', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateCouponInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>(`/coupons/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ id: string }>(`/coupons/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    validate: (input: { store_id: string; code: string; cart_total?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>('/coupons/validate', { ...options, method: 'POST', body: input }),
  };

  readonly themes = {
    list: (query?: ThemeListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Theme>('/themes', { ...options, query }),
    get: (slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Theme>(`/themes/${encodePathSegment(slug)}`, options),
    schema: (slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeBundle>(`/themes/${encodePathSegment(slug)}/schema`, options),
    categories: (options?: LetbuyyRequestOptions) =>
      this.requestData<string[]>('/themes/categories', options),
    industries: (options?: LetbuyyRequestOptions) =>
      this.requestData<string[]>('/themes/industries', options),
    install: (slug: string, input: { store_id: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<Theme>(`/themes/${encodePathSegment(slug)}/install`, { ...options, method: 'POST', body: input }),
  };

  readonly payments = {
    create: (input: CreatePaymentInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Payment>('/payments', {
        ...options,
        method: 'POST',
        body: input,
        idempotencyKey: options?.idempotencyKey ?? input.idempotency_key,
      }),
  };

  readonly storefront = {
    lookup: (query: { host?: string; subdomain?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>('/storefront/lookup', { ...options, query }),
    getStore: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/storefront/${encodePathSegment(subdomain)}`, options),
    status: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ status: StoreStatus }>(`/storefront/${encodePathSegment(subdomain)}/status`, options),
    listProducts: (subdomain: string, query?: StorefrontProductQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>(`/storefront/${encodePathSegment(subdomain)}/products`, { ...options, query }),
    getProduct: (subdomain: string, slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>(`/storefront/${encodePathSegment(subdomain)}/products/${encodePathSegment(slug)}`, options),
    productsByIds: (subdomain: string, productIds: string[], options?: LetbuyyRequestOptions) =>
      this.requestData<Product[]>(`/storefront/${encodePathSegment(subdomain)}/products/by-ids`, {
        ...options,
        query: { ids: productIds },
      }),
    createOrder: (subdomain: string, input: CreateOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/storefront/${encodePathSegment(subdomain)}/orders`, { ...options, method: 'POST', body: input }),
    pages: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Page[]>(`/storefront/${encodePathSegment(subdomain)}/pages`, options),
    page: (subdomain: string, slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Page>(`/storefront/${encodePathSegment(subdomain)}/pages/${encodePathSegment(slug)}`, options),
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
      init.body = JSON.stringify(options.body);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
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
  Cart,
  Collection,
  Coupon,
  Customer,
  CustomerAddress,
  LineItem,
  Order,
  Page,
  PaginatedResponse,
  Payment,
  Product,
  Store,
  Theme,
};
