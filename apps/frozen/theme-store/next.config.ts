import type { NextConfig } from "next";
import { createSecurityHeaders } from "../../../config/security/next-security-headers";

const nextConfig: NextConfig = {
    output: 'standalone',
    compress: true,

    env: {
        NEXT_PUBLIC_ACCOUNTS_URL: process.env.NEXT_PUBLIC_ACCOUNTS_URL,
    },

    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 86400,
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/**',
            },
        ],
    },

    async headers() {
        const isDev = process.env.NODE_ENV === 'development';
        return [
            {
                source: '/:path*',
                headers: createSecurityHeaders(),
            },
            {
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: isDev
                            ? 'no-cache, no-store, must-revalidate'
                            : 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                source: '/_next/image/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: isDev
                            ? 'no-cache, no-store, must-revalidate'
                            : 'public, max-age=86400, stale-while-revalidate=604800',
                    },
                ],
            },
            // Force fresh content in dev
            ...(isDev
                ? [
                    {
                        source: '/(.*)',
                        headers: [
                            { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                            { key: 'Pragma', value: 'no-cache' },
                            { key: 'Expires', value: '0' },
                        ],
                    },
                ]
                : []),
        ];
    },
};

export default nextConfig;
