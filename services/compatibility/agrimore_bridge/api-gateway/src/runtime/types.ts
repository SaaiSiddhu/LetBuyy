export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export type AuthMode = 'none' | 'user' | 'admin' | 'service' | 'webhook';

export type CacheMode = 'none' | 'public' | 'private';

export type RateLimitIdentity = 'ip' | 'user' | 'device' | 'composite';

export type RouteOwner =
  | 'platform'
  | 'catalog'
  | 'identity'
  | 'cart'
  | 'checkout'
  | 'payment'
  | 'order'
  | 'delivery'
  | 'rider'
  | 'store_ops'
  | 'seller'
  | 'admin'
  | 'notification'
  | 'webhook';

export type RateLimitPolicy = {
  readonly identity: RateLimitIdentity;
  readonly windowSeconds: number;
  readonly maxRequests: number;
};

export type CachePolicy = {
  readonly mode: CacheMode;
  readonly edgeTtlSeconds?: number;
  readonly staleWhileRevalidateSeconds?: number;
  readonly tags?: readonly string[];
};

export type RoutePolicy = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly upstreamPath: string;
  readonly owner: RouteOwner;
  readonly auth: AuthMode;
  readonly cache: CachePolicy;
  readonly rateLimit: RateLimitPolicy;
  readonly bodyLimitBytes: number;
  readonly requiresIdempotency: boolean;
  readonly allowCors: boolean;
  readonly highRisk?: boolean;
};

export type RouteMatch = {
  readonly policy: RoutePolicy;
  readonly params: Readonly<Record<string, string>>;
};

export type RequestIds = {
  readonly requestId: string;
  readonly traceId: string;
  readonly correlationId: string;
};

export type AuthContext = {
  readonly userId: string;
  readonly roles: readonly string[];
  readonly token: string;
  readonly email?: string;
};

export type RequestContext = {
  readonly startedAt: number;
  readonly ids: RequestIds;
  readonly route: RouteMatch;
  readonly auth: AuthContext | null;
  readonly deviceId: string | null;
  readonly clientIp: string;
  readonly appVersion: string | null;
  readonly platform: string | null;
};

export type Env = {
  readonly APP_ENV: string;
  readonly ALLOWED_ORIGINS?: string;
  readonly UPSTREAM_BASE_URL: string;
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly UPSTASH_REDIS_REST_URL?: string;
  readonly UPSTASH_REDIS_REST_TOKEN?: string;
  readonly SERVICE_AUTH_TOKEN?: string;
  readonly CACHE_VERSION?: string;
  readonly CART_KV?: KVNamespace;
  readonly RECENT_VIEWS_KV?: KVNamespace;
  readonly OUTBOX_QUEUE?: Queue;
  readonly HYPERDRIVE?: Hyperdrive;
  readonly PROOF_UPLOADS?: R2Bucket;
  readonly MEDIA_GATEWAY_URL?: string;
  readonly MEDIA_SIGNING_SECRET?: string;
  readonly RAZORPAY_KEY_ID?: string;
  readonly RAZORPAY_KEY_SECRET?: string;
  readonly RAZORPAY_WEBHOOK_SECRET?: string;
  readonly TYPESENSE_HOST?: string;
  readonly TYPESENSE_API_KEY?: string;
};

export type JsonRecord = Record<string, unknown>;
