import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requireFromConfig = createRequire(import.meta.url);
const { createSecurityHeaders } = requireFromConfig(
  "../../config/security/next-security-headers.ts",
) as typeof import("../../config/security/next-security-headers");

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, "../..");
const workspaceModules = resolve(workspaceRoot, "node_modules/.pnpm/node_modules");

const workspacePackages = [
  "@letbuyy/api-client",
  "@letbuyy/api-types",
  "@letbuyy/shared-types",
  "@letbuyy/ui",
];

const workspacePackageAliases = {
  "@letbuyy/api-client": resolve(appRoot, "../../packages/typescript/api-client/src/index.ts"),
  "@letbuyy/api-types": resolve(appRoot, "../../packages/typescript/api-types/src/index.ts"),
  "@letbuyy/shared-types": resolve(appRoot, "../../packages/shared-types/src/index.ts"),
  "@letbuyy/ui": resolve(appRoot, "../../packages/typescript/ui/src/index.ts"),
  "@letbuyy/ui/formatting": resolve(appRoot, "../../packages/typescript/ui/src/formatting.ts"),
  "tailwind-merge": resolve(appRoot, "../../node_modules/.pnpm/node_modules/tailwind-merge"),
};

type WebpackResolveConfig = {
  resolve?: {
    modules?: string[];
  };
};

const nextConfig: NextConfig = {
  transpilePackages: workspacePackages,
  turbopack: {
    root: workspaceRoot,
    resolveAlias: workspacePackageAliases,
  },
  webpack(config: WebpackResolveConfig) {
    const modules = config.resolve?.modules ?? [];
    config.resolve = {
      ...config.resolve,
      modules: [...modules, workspaceModules],
    };
    return config;
  },
  async headers() {
    return [{ source: '/:path*', headers: createSecurityHeaders() }];
  },
  async redirects() {
    /* The flat policy URLs are the ones people type and the ones other sites
       link to, but every policy now lives under the /legal library. Permanent
       so the signal consolidates on the new location. */
    return [
      { source: '/terms', destination: '/legal/terms', permanent: true },
      { source: '/privacy', destination: '/legal/privacy', permanent: true },
      { source: '/privacy-policy', destination: '/legal/privacy', permanent: true },
      { source: '/cookies', destination: '/legal/cookies', permanent: true },
      { source: '/refund-policy', destination: '/legal/refunds', permanent: true },
      { source: '/shipping-policy', destination: '/legal/shipping', permanent: true },
      { source: '/security', destination: '/legal/security', permanent: true },
    ];
  },
};

export default nextConfig;
