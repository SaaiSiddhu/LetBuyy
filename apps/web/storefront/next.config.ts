import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
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
        // Cache pages for 5 minutes, serve stale for 1 hour
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=3600' },
        ],
      },
    ];
  },
};

export default nextConfig;
