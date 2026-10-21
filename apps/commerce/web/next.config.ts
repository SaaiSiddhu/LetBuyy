import type { NextConfig } from "next";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePlatformDomain } from "@letbuyy/shared-types";
import { createSecurityHeaders } from "../../../config/security/next-security-headers";

const appRoot = dirname(fileURLToPath(import.meta.url));
const sessionRuntimeDistDir = process.env.LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR;

if (sessionRuntimeDistDir && !/^\.next-session-runtime-[a-zA-Z0-9-]+$/.test(sessionRuntimeDistDir)) {
  throw new Error('LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR must be a unique .next-session-runtime-* directory');
}

function parseFrameAncestors(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const frameAncestors = [
  "'self'",
  process.env.NEXT_PUBLIC_ADMIN_URL,
  process.env.ADMIN_ORIGIN,
  ...parseFrameAncestors(process.env.STOREFRONT_FRAME_ANCESTORS),
].filter((origin): origin is string => Boolean(origin));

function storefrontGatewayBaseUrl(): string {
  const configured =
    process.env.LETBUYY_API_BASE_URL ||
    process.env.LETBUYY_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    `https://api.${resolvePlatformDomain()}/v1`;

  return configured.replace(/\/+$/, '');
}

const nextConfig: NextConfig = {
  ...(sessionRuntimeDistDir ? { distDir: sessionRuntimeDistDir } : {}),
  // Resolve the shared UI's named exports at build time. The root storefront
  // uses only its theme provider; its barrel also exports admin tables and other
  // client boundaries that otherwise join the storefront's initial chunk group.
  experimental: { optimizePackageImports: ['@letbuyy/ui'] },
  compress: true, // Enable gzip compression for cost savings

  // theme-engine's Liquid sanitizer dynamically imports jsdom for server-side
  // DOMPurify (sanitizeRenderedHtml runs only during SSR). The barrel re-exports
  // the renderer, so client section components transitively pull jsdom into the
  // client graph. Keep jsdom server-external, and drop it from the client bundle
  // (it is never executed client-side) so its node:* deps don't break the build.
  serverExternalPackages: ['jsdom'],
  webpack: (config, { isServer, nextRuntime, webpack }) => {
    // T6/W4 — the same node:crypto problem below also hits the Edge runtime compiler pass
    // (src/instrumentation.ts's register() does `await import('@letbuyy/theme-engine')`, gated
    // at runtime to Node.js only, but webpack still statically bundles that dynamic import target
    // for the Edge pass too). Next reports isServer:true for both the Node and Edge server
    // compilations, so `!isServer` alone misses Edge. The stub is safe there for the same reason
    // it's safe on the client: theme-packager's checksum code never actually runs at the edge.
    if (!isServer || nextRuntime === 'edge') {
      config.resolve = config.resolve || {};
      config.resolve.fallback = { ...(config.resolve.fallback || {}), jsdom: false };

      // The same barrel problem, one layer deeper: theme-engine's index re-exports
      // theme-packager (and theme-publish, which imports it), and theme-packager
      // imports `node:crypto` for build-time bundle checksums. Client section
      // components value-import DEFAULT_THEME_SETTINGS from that barrel, so webpack
      // must build every `export *` target and hits the node: request.
      //
      // resolve.fallback / resolve.alias CANNOT fix this: NormalModuleFactory
      // detects the `node:` URI scheme and takes the resolveForScheme branch,
      // never calling resolveResource(), so enhanced-resolve options are a no-op.
      // Rewriting the request in beforeResolve (NormalModuleReplacementPlugin) is
      // the only mechanism that intercepts it. Pointing at a local stub rather
      // than stripping the prefix also avoids Next's unconditional client rule
      // that maps bare `crypto` to crypto-browserify.
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:crypto$/,
          resolvePath(appRoot, 'src/lib/webpack/node-crypto-client-stub.ts'),
        ),
      );
    }
    return config;
  },

  // === COST OPTIMIZATION: Image Formats ===
  images: {
    formats: ['image/avif', 'image/webp'], // Modern formats = 50% smaller
    minimumCacheTTL: 86400, // Cache images for 24 hours
    deviceSizes: [640, 750, 828, 1080, 1200], // Optimized breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256], // Icon sizes
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },

  // === COST OPTIMIZATION: Headers for aggressive caching ===
  async headers() {
    return [
      {
        // Cache static assets for 1 year
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Cache Next.js assets. Production only: a production build names each chunk by its content,
      // so a year is safe; development serves every version of a chunk under one name, and a year
      // (or even five minutes) of caching shows a developer code they have already changed.
      ...(process.env.NODE_ENV === 'production'
        ? [{
            source: '/_next/static/:path*',
            headers: [
              { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
            ],
          }]
        : []),
      {
        // Cache images for 24 hours
        source: '/_next/image/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        // API responses: security headers, and NO caching directive, so each route decides its own.
        // (APPID-P4c) The page rule below used to reach /api/* too, and a Cache-Control here wins over
        // the route's own, so every storefront API answer, sessions and profiles included, was sent
        // `public, max-age=300` whatever the route said.
        source: '/api/:path*',
        headers: [
          ...createSecurityHeaders({ frameAncestors }),
        ],
      },
      {
        // Mutable store HTML and customer pages cannot share a generic browser/CDN TTL.
        // The Gateway owns public data caching; hashed static assets keep their
        // independent immutable policy above. Never retain preview/customer HTML.
        source: '/((?!api/|_next/).*)',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          ...createSecurityHeaders({ frameAncestors }),
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/storefront/:subdomain/:path*',
        destination: `${storefrontGatewayBaseUrl()}/storefront/:subdomain/:path*`,
      },
    ];
  },
};

export default nextConfig;
