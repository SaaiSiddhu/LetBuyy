/**
 * domain-map — deterministic file-path → LCIS domain heuristics.
 *
 * These rules are derived from the CLAUDE.md canonical runtime map,
 * the LCIS ArchitectureService NARRATIVE map (22 domains), and the
 * monorepo directory conventions (apps/*, services/*, database/*).
 *
 * NO external calls — pure path matching. The blast-radius expansion in
 * analyze.ts adds engine-derived domain hits on top.
 */

export interface PathDomainRule {
  /** Glob-style substring patterns matched against the file path (lowercased) */
  patterns: string[];
  domain: string;
}

/**
 * Ordered rules. First match wins for domain assignment.
 * A file can only map to ONE primary domain via path (blast may add more).
 */
export const PATH_DOMAIN_RULES: PathDomainRule[] = [
  // ── Payments / money ────────────────────────────────────────────────
  { patterns: ['payment', 'razorpay', 'cod', 'ledger', 'payout', 'refund'], domain: 'payments' },

  // ── Orders ──────────────────────────────────────────────────────────
  { patterns: ['/orders/', 'order_item', 'checkout_order', 'create-order', 'create_order'], domain: 'orders' },

  // ── Refunds ─────────────────────────────────────────────────────────
  { patterns: ['/refunds/', 'complete_order_refund', 'restore_gift_card'], domain: 'refunds' },

  // ── Payouts ─────────────────────────────────────────────────────────
  { patterns: ['/payouts/', 'payout_account', 'merchant-payout'], domain: 'payouts' },

  // ── Gift cards ───────────────────────────────────────────────────────
  { patterns: ['gift_card', 'gift-card', 'giftcard', 'gift_card_ledger'], domain: 'gift-cards' },

  // ── Inventory ────────────────────────────────────────────────────────
  { patterns: ['/inventory/', 'purchase-order', 'purchase_order', '/transfers/', '/locations/'], domain: 'inventory' },

  // ── Products ─────────────────────────────────────────────────────────
  { patterns: ['/products/', '/variants/', '/collections/', '/metafields/'], domain: 'products' },

  // ── Collections ─────────────────────────────────────────────────────
  { patterns: ['/collections/', 'collection_product'], domain: 'collections' },

  // ── Discounts / coupons ───────────────────────────────────────────────
  { patterns: ['/coupons/', '/discounts/', 'discount_allocation', 'coupon_code'], domain: 'discounts' },

  // ── Shipping ─────────────────────────────────────────────────────────
  { patterns: ['/shipping/', 'shipping_rate', 'fulfillment'], domain: 'shipping' },

  // ── GST / tax ────────────────────────────────────────────────────────
  { patterns: ['/gst/', 'gstin', 'tax_line', 'tax_invoice', '/tax/'], domain: 'gst' },

  // ── Authentication ────────────────────────────────────────────────────
  { patterns: ['/auth/', 'session', 'otp', 'credential', 'cookie', 'jwt', 'turnstile'], domain: 'authentication' },

  // ── Authorization ─────────────────────────────────────────────────────
  { patterns: ['/rbac/', 'step-up', 'step_up', 'permission', 'entitlement'], domain: 'authorization' },

  // ── Identity ─────────────────────────────────────────────────────────
  { patterns: ['/customers/', 'store_customer', 'customer_credential'], domain: 'identity' },

  // ── Merchant / tenancy ───────────────────────────────────────────────
  { patterns: ['create-store', 'onboarding', '/merchant/', 'site_id', 'verifysiteownership', 'verify-site'], domain: 'merchant' },

  // ── Notifications ────────────────────────────────────────────────────
  { patterns: ['/notifications/', 'resend', 'email-template', 'whatsapp', 'transactional'], domain: 'notifications' },

  // ── Analytics ────────────────────────────────────────────────────────
  { patterns: ['/analytics/', 'event_outbox', 'dashboard', 'metric', 'rollup'], domain: 'analytics' },

  // ── Themes ───────────────────────────────────────────────────────────
  { patterns: ['/themes/', 'theme-engine', 'liquid', 'preset', 'themeregistry', 'theme_registry'], domain: 'themes' },

  // ── Storefront ───────────────────────────────────────────────────────
  { patterns: ['customer-web', 'storefront', '/blogs/', '/pages/', 'proxy.ts', 'custom-domain'], domain: 'storefront' },

  // ── Marketplace ──────────────────────────────────────────────────────
  { patterns: ['app-marketplace', 'marketplace', 'extension-install', 'app_listing'], domain: 'marketplace' },

  // ── Developer ────────────────────────────────────────────────────────
  { patterns: ['developer-portal', 'oauth_client', 'api_key', 'developer'], domain: 'developer' },

  // ── Operations ───────────────────────────────────────────────────────
  { patterns: ['feature_flag', 'incident', 'audit_log', 'admin-web', 'operations'], domain: 'operations' },
];

/** Canonical service names used to populate affectedServices from domain keys */
export const DOMAIN_TO_SERVICES: Record<string, string[]> = {
  payments: ['api-gateway', 'queue-workers', 'webhook-service'],
  orders: ['api-gateway', 'customer-web', 'queue-workers'],
  refunds: ['api-gateway', 'queue-workers'],
  payouts: ['api-gateway', 'queue-workers'],
  'gift-cards': ['api-gateway'],
  inventory: ['api-gateway', 'queue-workers'],
  products: ['api-gateway', 'merchant-web'],
  collections: ['api-gateway', 'merchant-web'],
  discounts: ['api-gateway', 'customer-web'],
  shipping: ['api-gateway', 'customer-web'],
  gst: ['api-gateway'],
  authentication: ['identity-platform', 'api-gateway'],
  authorization: ['api-gateway', 'identity-platform'],
  identity: ['identity-platform', 'api-gateway'],
  merchant: ['identity-platform', 'merchant-web', 'api-gateway'],
  notifications: ['queue-workers', 'webhook-service'],
  analytics: ['queue-workers', 'api-gateway'],
  themes: ['customer-web', 'merchant-web'],
  storefront: ['customer-web'],
  marketplace: ['app-marketplace'],
  developer: ['developer-portal', 'api-gateway'],
  operations: ['admin-web', 'api-gateway'],
};

/** Map a single file path to its primary domain key (or null if no rule matches). */
export function filePathToDomain(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  for (const rule of PATH_DOMAIN_RULES) {
    if (rule.patterns.some((p) => lower.includes(p))) {
      return rule.domain;
    }
  }
  return null;
}

/** ── Sensitivity pattern sets (deterministic, path-based) ─────────────────── */

export const AUTH_PATTERNS = [
  '/auth/', 'identity-platform', 'session', 'credential', 'oauth', 'jwt', 'cookie',
  'turnstile', 'otp', 'hmac', 'issueCustomerSession', 'issuesession', 'step-up', 'step_up',
  'jwks', 'signing',
];

export const PAYMENT_PATTERNS = [
  'payment', 'razorpay', 'ledger', 'payout', 'refund', 'cod', 'gift_card', 'gift-card',
  'create_checkout_order', 'confirm_order_payment', 'complete_order_refund', 'issue_gift_card',
  'money', 'gst', 'tax', 'shipping_rate',
];

export const RLS_PATTERNS = [
  'database/supabase/', 'supabase/migrations/', 'policies', '.rls.', '_rls_',
  'using (', 'with check (', 'create policy', 'alter policy',
  'row level security', 'row-level-security',
];

export const MIGRATION_PATTERNS = [
  'database/supabase/migrations/', 'supabase/migrations/', 'database/migrations/',
  '_migration', '.sql', 'migrate', '/__migrations__/',
];

export const TENANT_PATTERNS = [
  'site_id', 'tenant', 'verifysiteownership', 'verify-site-ownership',
  'multi-tenant', 'multitenant', 'rls', 'getsupabaseadmin',
];

export const VALIDATOR_PATTERNS = [
  'scripts/validate', 'scripts/validators', 'validate-governance', 'CLAUDE.md',
  'AGENTS.md', 'LETBUYY_CONSTITUTION', '.github/workflows/', 'canonical-ledger-only-validator',
];

export const SECURITY_PATTERNS = [
  'hmac', 'jwt', 'jwks', 'signing', 'turnstile', 'webhook', 'cors',
  'ratelimit', 'rate-limit', 'auth', 'services/api-gateway/src/lib/supabase',
  'getsupabaseadmin', 'secret', 'encryption', 'hash',
];

/** Test a file path against a set of case-insensitive substring patterns */
export function matchesAny(filePath: string, patterns: string[]): boolean {
  const lower = filePath.toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}
