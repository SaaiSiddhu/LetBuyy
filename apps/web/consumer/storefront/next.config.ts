import type { NextConfig } from "next";

const frameAncestors = [
  "'self'",
  "http://localhost:*",
  "http://127.0.0.1:*",
  "https://admin.letbuyy.store",
  "https://console.letbuyy.store",
  process.env.NEXT_PUBLIC_ADMIN_URL,
  process.env.ADMIN_ORIGIN,
].filter((origin): origin is string => Boolean(origin)).join(" ");

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
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
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
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: `frame-ancestors ${frameAncestors}` },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
