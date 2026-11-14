import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requireFromConfig = createRequire(import.meta.url);
const { LETBUYY_CANONICAL_API_BASE_URL } = requireFromConfig(
  '@letbuyy/api-client/origin',
) as typeof import('@letbuyy/api-client/origin');
const { createSecurityHeaders } = requireFromConfig(
  "../../../config/security/next-security-headers.ts",
) as typeof import("../../../config/security/next-security-headers");

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, "../../..");
const workspaceModules = resolve(workspaceRoot, "node_modules/.pnpm/node_modules");

const workspacePackages = [
  "@letbuyy/api-client",
  "@letbuyy/api-types",
  "@letbuyy/shared-types",
  "@letbuyy/ui",
];

const workspacePackageAliases = {
  "@letbuyy/api-client": resolve(appRoot, "../../../packages/typescript/api-client/src/index.ts"),
  "@letbuyy/api-types": resolve(appRoot, "../../../packages/typescript/api-types/src/index.ts"),
  "@letbuyy/shared-types": resolve(appRoot, "../../../packages/shared-types/src/index.ts"),
  "@letbuyy/shared-types/brand": resolve(appRoot, "../../../packages/shared-types/src/brand.ts"),
  "@letbuyy/ui": resolve(appRoot, "../../../packages/typescript/ui/src/index.ts"),
  "@letbuyy/ui/formatting": resolve(appRoot, "../../../packages/typescript/ui/src/formatting.ts"),
  "tailwind-merge": resolve(appRoot, "../../node_modules/.pnpm/node_modules/tailwind-merge"),
};

type CssExtractionModule = {
  resource?: string;
  nameForCondition?: () => string | null;
  identifier?: () => string;
};

type WebpackResolveConfig = {
  optimization?: {
    splitChunks?: false | {
      cacheGroups?: Record<string, unknown>;
    };
  };
  resolve?: {
    modules?: string[];
  };
};

const nextConfig: NextConfig = {
  // The development badge overlaps the mobile article Contents control.
  devIndicators: false,
  // Keep the shell's tiny font/locale/module styles in one cacheable request.
  // Explicit groups below retain separate home and resource delivery.
  experimental: { cssChunking: false, optimizePackageImports: ['@letbuyy/ui', '@letbuyy/api-client'] },
  transpilePackages: workspacePackages,
  images: {
    formats: ['image/avif', 'image/webp'],
    // A ~335px mobile guide at 2x needs 670px, not the next 750px default.
    deviceSizes: [640, 672, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
  turbopack: {
    root: workspaceRoot,
    resolveAlias: workspacePackageAliases,
  },
  webpack(config: WebpackResolveConfig, { dev, isServer }) {
    const modules = config.resolve?.modules ?? [];
    config.resolve = {
      ...config.resolve,
      modules: [...modules, workspaceModules],
    };
    if (!dev && !isServer && config.optimization?.splitChunks) {
      const split = config.optimization.splitChunks;
      const resource = (module: CssExtractionModule) =>
        module.nameForCondition?.() ?? module.resource ?? module.identifier?.() ?? '';
      split.cacheGroups = {
        ...split.cacheGroups,
        // Consolidate modules already shared by many page templates, retaining
        // route-specific and asynchronous modules in their existing chunks.
        marketingCommonClient: {
          type: /^javascript/,
          layer: 'app-pages-browser',
          name: 'marketing-common-client',
          chunks: 'initial',
          minChunks: 8,
          enforce: true,
          priority: 35,
          reuseExistingChunk: true,
        },
        marketingSharedStyles: {
          type: 'css/mini-extract',
          name: 'marketing-shared',
          chunks: 'all',
          enforce: true,
          priority: 40,
          test: (module: CssExtractionModule) =>
            /src\/app\/(globals|locale-typography)\.css|src\/components\/(?:header-featured-art|final-cta)\.module\.css|next\/font\/local\/target\.css/.test(resource(module)),
        },
        marketingResourceStyles: {
          type: 'css/mini-extract',
          name: 'marketing-resources',
          chunks: 'all',
          enforce: true,
          priority: 30,
          test: (module: CssExtractionModule) =>
            /src\/app\/resources\.css|src\/components\/resources\/.*\.module\.css/.test(resource(module)),
        },
      };
    }
    return config;
  },
  async headers() {
    // Browser forms and the pricing retry use this same canonical API fallback
    // when no public API environment variable is set. Keep CSP consistent.
    return [{ source: '/:path*', headers: createSecurityHeaders({
      connectOrigins: [LETBUYY_CANONICAL_API_BASE_URL],
    }) }];
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
