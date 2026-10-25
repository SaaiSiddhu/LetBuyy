export type SecurityHeaderOptions = {
  frameAncestors?: string[];
  reportOnly?: boolean;
};

function splitOrigins(value: string | undefined): string[] {
  return (value || '')
    .split(/[,\s]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// CSP source-lists must be ORIGINS, not full URLs: a source with a path and no
// trailing slash matches only that exact path. e.g. NEXT_PUBLIC_API_URL is
// "http://localhost:9010/v1", which would block "/v1/custom/domains". Reduce each
// configured value to its scheme://host:port so any gateway path is allowed.
function toOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value; // wildcards / non-URL entries (e.g. https://*.letbuyy.com) pass through
  }
}

function configuredOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_ACCOUNTS_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_STOREFRONT_URL,
    process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL,
    process.env.NEXT_PUBLIC_APP_MARKETPLACE_URL,
    process.env.NEXT_PUBLIC_DEVELOPER_PORTAL_URL,
    ...splitOrigins(process.env.CORS_CREDENTIAL_ORIGINS),
  ]
    .filter((origin): origin is string => Boolean(origin))
    .map(toOrigin);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function createContentSecurityPolicy(options: SecurityHeaderOptions = {}): string {
  const origins = unique(configuredOrigins());
  const frameAncestors = unique(options.frameAncestors?.length ? options.frameAncestors : ["'self'"]);
  // T11/W0 — checkout.razorpay.com was never allowlisted anywhere in this policy: the storefront
  // renders "Pay Online (Razorpay)" and calls `new window.Razorpay(...)` (checkout-client.tsx),
  // but the CSP silently blocked https://checkout.razorpay.com/v1/checkout.js from ever loading
  // (confirmed live: a real CSP violation on every checkout-origin page load, every environment,
  // since this function has no dev-only carve-out). window.Razorpay was therefore always
  // undefined and the "Pay ₹X" button never enabled — no customer could ever complete an online
  // payment, on any store, in any environment. api.razorpay.com is Razorpay's own checkout iframe
  // origin (confirmed needed — checkout.razorpay.com's checkout-frame.js loads a nested frame
  // there for the payment form itself). cdn.razorpay.com is a second, lazily-loaded script
  // (razorpay-risk-detection/bundle.js, fraud-signal collection checkout.js pulls in at runtime)
  // — confirmed as a second, separate CSP violation only after the first fix let the main script
  // load far enough to attempt it.
  const razorpayOrigins = ['https://checkout.razorpay.com', 'https://api.razorpay.com', 'https://cdn.razorpay.com'];
  // lumberjack.razorpay.com is Razorpay's own telemetry/fraud-signal beacon (checkout.js posts to
  // /v2/logz throughout the checkout flow) — connect-src only, never a script or frame origin.
  const razorpayConnectOnly = ['https://lumberjack.razorpay.com'];
  const connectSrc = unique(["'self'", ...origins, 'https://*.supabase.co', 'wss://*.supabase.co', ...razorpayOrigins, ...razorpayConnectOnly]);
  const imgSrc = unique(["'self'", 'data:', 'blob:', 'https:', ...origins]);
  const scriptSrc = unique([
    "'self'",
    "'unsafe-inline'",
    ...(isDevelopmentRuntime() ? ["'unsafe-eval'"] : []),
    'https://challenges.cloudflare.com',
    ...razorpayOrigins,
  ]);
  // D7: Google Fonts stylesheet (fonts.googleapis.com) must be in style-src, and the actual
  // font file downloads (fonts.gstatic.com) must be in font-src. Without these, the browser
  // silently blocks both the stylesheet load and the font file download in production — fonts
  // appear to work in dev only because some deployments relax CSP. The preconnect links in
  // layout.tsx are emitted correctly but have no effect when the CSP blocks the stylesheet.
  const styleSrc = unique(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']);
  const fontSrc = unique(["'self'", 'data:', 'https://fonts.gstatic.com']);
  const frameSrc = unique(["'self'", 'https://challenges.cloudflare.com', ...razorpayOrigins, ...origins]);

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
    `img-src ${imgSrc.join(' ')}`,
    `font-src ${fontSrc.join(' ')}`,
    `frame-src ${frameSrc.join(' ')}`,
    `frame-ancestors ${frameAncestors.join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function createSecurityHeaders(options: SecurityHeaderOptions = {}) {
  const cspKey = options.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  return [
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: options.frameAncestors?.includes("'none'") ? 'DENY' : 'SAMEORIGIN' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
    { key: cspKey, value: createContentSecurityPolicy(options) },
  ];
}
