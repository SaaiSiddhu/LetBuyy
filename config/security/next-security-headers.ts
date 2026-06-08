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
  ].filter((origin): origin is string => Boolean(origin));
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
  const connectSrc = unique(["'self'", ...origins, 'https://*.supabase.co', 'wss://*.supabase.co']);
  const imgSrc = unique(["'self'", 'data:', 'blob:', 'https:', ...origins]);
  const scriptSrc = unique([
    "'self'",
    "'unsafe-inline'",
    ...(isDevelopmentRuntime() ? ["'unsafe-eval'"] : []),
    'https://challenges.cloudflare.com',
  ]);
  const styleSrc = unique(["'self'", "'unsafe-inline'"]);
  const frameSrc = unique(["'self'", 'https://challenges.cloudflare.com', ...origins]);

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
    `img-src ${imgSrc.join(' ')}`,
    "font-src 'self' data:",
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
