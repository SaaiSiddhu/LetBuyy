import type { NextConfig } from "next";
import { createSecurityHeaders } from "../../../config/security/next-security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: createSecurityHeaders() }];
  },
};

export default nextConfig;
