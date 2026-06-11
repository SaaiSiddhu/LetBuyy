import type { NextConfig } from "next";
import { resolvePlatformDomain } from "@letbuyy/shared-types";
import { createSecurityHeaders } from "../../config/security/next-security-headers";

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
  compress: true, // Enable gzip compression for cost savings

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
      {
        // Cache Next.js assets
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Cache images for 24 hours
        source: '/_next/image/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        // All pages — security headers + short cache
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=3600' },
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
