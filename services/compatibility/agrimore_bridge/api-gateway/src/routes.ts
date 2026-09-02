import type { HttpMethod, RouteMatch, RouteOwner, RoutePolicy } from './runtime/types';

const publicRateLimit = { identity: 'ip', windowSeconds: 60, maxRequests: 180 } as const;
const userReadRateLimit = { identity: 'user', windowSeconds: 60, maxRequests: 240 } as const;
const commandRateLimit = { identity: 'composite', windowSeconds: 60, maxRequests: 45 } as const;
const highRiskCommandRateLimit = { identity: 'composite', windowSeconds: 60, maxRequests: 15 } as const;
const webhookRateLimit = { identity: 'ip', windowSeconds: 60, maxRequests: 600 } as const;

export const routePolicies = [
  {
    method: 'GET',
    path: '/health',
    upstreamPath: '/health',
    owner: 'platform',
    auth: 'none',
    cache: { mode: 'none' },
    rateLimit: { identity: 'ip', windowSeconds: 60, maxRequests: 600 },
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  },
  {
    method: 'GET',
    path: '/v1/catalog/categories',
    upstreamPath: '/catalog-categories',
    owner: 'catalog',
    auth: 'none',
    cache: { mode: 'public', edgeTtlSeconds: 900, staleWhileRevalidateSeconds: 120, tags: ['catalog'] },
    rateLimit: publicRateLimit,
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  },
  {
    method: 'GET',
    path: '/v1/catalog/home-feed',
    upstreamPath: '/catalog-home-feed',
    owner: 'catalog',
    auth: 'none',
    cache: { mode: 'public', edgeTtlSeconds: 120, staleWhileRevalidateSeconds: 60, tags: ['catalog', 'home-feed'] },
    rateLimit: publicRateLimit,
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  },
  {
    method: 'GET',
    path: '/v1/catalog/products/:id',
    upstreamPath: '/catalog-product',
    owner: 'catalog',
    auth: 'none',
    cache: { mode: 'public', edgeTtlSeconds: 300, staleWhileRevalidateSeconds: 120, tags: ['catalog', 'product'] },
    rateLimit: publicRateLimit,
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  },
  {
    method: 'GET',
    path: '/v1/catalog/search',
    upstreamPath: '/catalog-search',
    owner: 'catalog',
    auth: 'none',
    cache: { mode: 'public', edgeTtlSeconds: 60, staleWhileRevalidateSeconds: 30, tags: ['catalog', 'search'] },
    rateLimit: publicRateLimit,
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  },
  {
    method: 'GET',
    path: '/v1/serviceability/public-zones',
    upstreamPath: '/serviceability-check',
    owner: 'catalog',
    auth: 'none',
    cache: { mode: 'public', edgeTtlSeconds: 600, staleWhileRevalidateSeconds: 120, tags: ['serviceability'] },
    rateLimit: publicRateLimit,
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  },
  ...([
    ['/v1/me', '/auth-context', 'identity'],
    ['/v1/cart', '/cart-read', 'cart'],
    ['/v1/catalog/recent-views', '/catalog-recent-views', 'catalog'],
    ['/v1/orders', '/orders-read', 'order'],
    ['/v1/orders/:id', '/order-read', 'order'],
    ['/v1/addresses', '/addresses-read', 'identity'],
    ['/v1/wallet', '/wallet-read', 'payment'],
    ['/v1/notifications', '/notifications-read', 'notification'],
    ['/v1/rider/profile', '/rider-profile', 'rider'],
    ['/v1/rider/deliveries', '/rider-deliveries', 'delivery'],
    ['/v1/rider/earnings', '/rider-earnings', 'rider'],
    ['/v1/store/queue', '/store-queue', 'store_ops'],
    ['/v1/store/orders/:id/picklist', '/store-order-picklist', 'store_ops'],
    ['/v1/store/inventory', '/store-inventory', 'store_ops'],
    ['/v1/seller/profile', '/seller-profile', 'seller'],
    ['/v1/seller/catalog/products', '/seller-catalog-products', 'seller'],
    ['/v1/seller/orders', '/seller-orders', 'seller'],
    ['/v1/seller/payouts', '/seller-payouts', 'seller'],
    ['/v1/seller/analytics', '/seller-analytics', 'seller'],
  ] as const satisfies readonly (readonly [string, string, RouteOwner])[]).map(([path, upstreamPath, owner]) => ({
    method: 'GET' as const,
    path,
    upstreamPath,
    owner,
    auth: 'user' as const,
    cache: { mode: 'private' as const },
    rateLimit: userReadRateLimit,
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  })),
  {
    method: 'GET',
    path: '/v1/ops/summary',
    upstreamPath: '/ops-summary',
    owner: 'admin',
    auth: 'admin',
    cache: { mode: 'private' },
    rateLimit: userReadRateLimit,
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  },
  ...([
    ['/v1/auth/otp', '/auth-otp-request'],
    ['/v1/auth/otp/verify', '/auth-otp-verify'],
    ['/v1/auth/refresh', '/auth-refresh'],
  ] as const satisfies readonly (readonly [string, string])[]).map(([path, upstreamPath]) => ({
    method: 'POST' as const,
    path,
    upstreamPath,
    owner: 'identity' as const,
    auth: 'none' as const,
    cache: { mode: 'none' as const },
    rateLimit: highRiskCommandRateLimit,
    bodyLimitBytes: 64 * 1024,
    requiresIdempotency: true,
    allowCors: true,
    highRisk: true,
  })),
  ...([
    ['/v1/cart/items', '/cart-items-command', 'cart', false],
    ['/v1/catalog/recent-views/:productId', '/catalog-recent-view-command', 'catalog', false],
    ['/v1/checkout/quote', '/checkout-quote', 'checkout', true],
    ['/v1/orders', '/orders-command', 'order', true],
    ['/v1/payments/intents', '/payment-intent', 'payment', true],
    ['/v1/payments/create-order', '/payment-create-order', 'payment', true],
    ['/v1/orders/:id/cancel', '/order-cancel', 'order', true],
    ['/v1/addresses', '/addresses-command', 'identity', false],
    ['/v1/addresses/serviceability', '/addresses-serviceability', 'identity', false],
    ['/v1/rider/availability', '/rider-availability', 'rider', true],
    ['/v1/rider/heartbeat', '/rider-heartbeat', 'rider', false],
    ['/v1/rider/deliveries/:id/accept', '/rider-delivery-accept', 'delivery', true],
    ['/v1/rider/deliveries/:id/status', '/rider-delivery-status', 'delivery', true],
    ['/v1/rider/deliveries/:id/proof', '/rider-delivery-proof', 'delivery', true],
    ['/v1/delivery/:id/transition', '/delivery-transition', 'delivery', true],
    ['/v1/store/orders/:id/pick', '/store-order-pick', 'store_ops', true],
    ['/v1/store/orders/:id/pack', '/store-order-pack', 'store_ops', true],
    ['/v1/store/orders/:id/items/:itemId/confirm', '/store-order-item-confirm', 'store_ops', true],
    ['/v1/store/orders/:id/ready', '/store-order-ready', 'store_ops', true],
    ['/v1/store/inventory/adjust', '/store-inventory-adjust', 'store_ops', true],
    ['/v1/seller/onboarding', '/seller-onboarding', 'seller', true],
    ['/v1/seller/catalog/products', '/seller-catalog-product-command', 'seller', true],
    ['/v1/notifications/register-token', '/notifications-register-token', 'notification', false],
    ['/v1/admin/override', '/admin-override', 'admin', true],
    ['/v1/ops/dispatch/control', '/ops-dispatch-control', 'admin', true],
    ['/v1/admin/sellers/:sellerId/approve', '/admin-seller-approve', 'admin', true],
  ] as const satisfies readonly (readonly [string, string, RouteOwner, boolean])[]).map(
    ([path, upstreamPath, owner, highRisk]) => ({
    method: 'POST' as const,
    path,
    upstreamPath,
    owner,
    auth: owner === 'admin' ? ('admin' as const) : ('user' as const),
    cache: { mode: 'none' as const },
    rateLimit: highRisk ? highRiskCommandRateLimit : commandRateLimit,
    bodyLimitBytes: 128 * 1024,
    requiresIdempotency: true,
    allowCors: true,
    highRisk: Boolean(highRisk),
  })),
  ...([
    ['PATCH', '/v1/rider/status', '/rider-status', 'rider', true],
    ['PATCH', '/v1/seller/catalog/products/:id', '/seller-catalog-product-update', 'seller', true],
    ['PUT', '/v1/addresses/:id', '/address-update', 'identity', true],
    ['DELETE', '/v1/cart/items/:productId', '/cart-item-delete', 'cart', false],
    ['DELETE', '/v1/cart', '/cart-clear', 'cart', false],
    ['DELETE', '/v1/addresses/:id', '/address-delete', 'identity', true],
  ] as const satisfies readonly (readonly [HttpMethod, string, string, RouteOwner, boolean])[]).map(
    ([method, path, upstreamPath, owner, highRisk]) => ({
    method,
    path,
    upstreamPath,
    owner,
    auth: 'user' as const,
    cache: { mode: 'none' as const },
    rateLimit: highRisk ? highRiskCommandRateLimit : commandRateLimit,
    bodyLimitBytes: method === 'DELETE' ? 0 : 128 * 1024,
    requiresIdempotency: true,
    allowCors: true,
    highRisk: Boolean(highRisk),
  })),
  ...[
    ['/v1/payments/webhook', '/webhooks-razorpay'],
    ['/v1/webhooks/razorpay', '/webhooks-razorpay'],
    ['/v1/webhooks/notification-provider', '/webhooks-notification-provider'],
  ].map(([path, upstreamPath]) => ({
    method: 'POST' as const,
    path,
    upstreamPath,
    owner: 'webhook' as const,
    auth: 'webhook' as const,
    cache: { mode: 'none' as const },
    rateLimit: webhookRateLimit,
    bodyLimitBytes: 256 * 1024,
    requiresIdempotency: true,
    allowCors: false,
    highRisk: true,
  })),
] satisfies readonly RoutePolicy[];

const dynamicSegment = /^:([A-Za-z][A-Za-z0-9_]*)$/;

export function findRoutePolicy(method: string, pathname: string): RouteMatch | null {
  const normalizedMethod = method.toUpperCase() as HttpMethod;
  const requestParts = splitPath(pathname);

  for (const policy of routePolicies) {
    if (policy.method !== normalizedMethod) {
      continue;
    }

    const policyParts = splitPath(policy.path);
    if (policyParts.length !== requestParts.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matched = true;
    for (let index = 0; index < policyParts.length; index += 1) {
      const policyPart = policyParts[index];
      const requestPart = requestParts[index];
      const dynamic = dynamicSegment.exec(policyPart);
      if (dynamic) {
        params[dynamic[1]] = decodeURIComponent(requestPart);
      } else if (policyPart !== requestPart) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { policy, params };
    }
  }

  return null;
}

export function isKnownPath(pathname: string): boolean {
  const requestParts = splitPath(pathname);
  return routePolicies.some((policy) => {
    const policyParts = splitPath(policy.path);
    return (
      policyParts.length === requestParts.length &&
      policyParts.every((part, index) => dynamicSegment.test(part) || part === requestParts[index])
    );
  });
}

function splitPath(pathname: string): readonly string[] {
  return pathname.replace(/\/+$/, '').split('/').filter(Boolean);
}
