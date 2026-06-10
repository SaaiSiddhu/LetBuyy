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
  "@letbuyy/auth-core",
  "@letbuyy/cms-core",
  "@letbuyy/shared-types",
  "@letbuyy/tenant-core",
  "@letbuyy/theme-engine",
  "@letbuyy/ui",
];

const workspacePackageAliases = {
  "@letbuyy/api-client": resolve(appRoot, "../../packages/typescript/api-client/src/index.ts"),
  "@letbuyy/api-types": resolve(appRoot, "../../packages/typescript/api-types/src/index.ts"),
  "@letbuyy/auth-core": resolve(appRoot, "../../packages/auth-core/src/index.ts"),
  "@letbuyy/cms-core": resolve(appRoot, "../../packages/cms-core/src/index.ts"),
  "@letbuyy/shared-types": resolve(appRoot, "../../packages/shared-types/src/index.ts"),
  "@letbuyy/tenant-core": resolve(appRoot, "../../packages/tenant-core/src/index.ts"),
  "@letbuyy/theme-engine": resolve(appRoot, "../../packages/theme-engine/src/index.ts"),
  "@letbuyy/ui": resolve(appRoot, "../../packages/typescript/ui/src/index.ts"),
  "@letbuyy/ui/formatting": resolve(appRoot, "../../packages/typescript/ui/src/formatting.ts"),
  "lucide-react": resolve(appRoot, "../../node_modules/.pnpm/node_modules/lucide-react"),
  "tailwind-merge": resolve(appRoot, "../../node_modules/.pnpm/node_modules/tailwind-merge"),
  zod: resolve(appRoot, "../../node_modules/.pnpm/node_modules/zod"),
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
    return [{ source: '/:path*', headers: createSecurityHeaders({ frameAncestors: ["'none'"] }) }];
  },
};

export default nextConfig;

// trigger deploy 1771151541
