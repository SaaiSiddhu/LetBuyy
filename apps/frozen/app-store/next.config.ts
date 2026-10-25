import type { NextConfig } from "next";
import { createSecurityHeaders } from "../../../config/security/next-security-headers";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
    async headers() {
        const frameSources = (process.env.APP_EMBED_ALLOWED_ORIGINS || '').split(/[,\s]+/).filter(Boolean);
        return [{ source: '/:path*', headers: createSecurityHeaders({ frameSources }) }];
    },
};

export default nextConfig;
