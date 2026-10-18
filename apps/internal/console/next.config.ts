import type { NextConfig } from "next";
import { createSecurityHeaders } from "../../../config/security/next-security-headers";

const nextConfig: NextConfig = {
  ...(process.env.LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR?.match(/^\.next-session-runtime-\d+-console-next$/)
    ? { distDir: process.env.LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR } : {}),
  async headers() {
    return [{ source: '/:path*', headers: createSecurityHeaders({ frameAncestors: ["'none'"] }) }];
  },
};

export default nextConfig;
