import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requireFromConfig = createRequire(import.meta.url);
const { createSecurityHeaders } = requireFromConfig(
  "../../../config/security/next-security-headers.ts",
) as typeof import("../../../config/security/next-security-headers");

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, "../../..");
const workspaceModules = resolve(workspaceRoot, "node_modules/.pnpm/node_modules");

const workspacePackages = [
  "@letbuyy/api-client",
  "@letbuyy/api-types",
  "@letbuyy/auth-core",
  "@letbuyy/cms-core",
  "@letbuyy/shared-types",
  "@letbuyy/theme-engine",
  "@letbuyy/ui",
];

const workspacePackageAliases = {
  "@letbuyy/api-client": resolve(appRoot, "../../../packages/typescript/api-client/src/index.ts"),
  "@letbuyy/api-types": resolve(appRoot, "../../../packages/typescript/api-types/src/index.ts"),
  "@letbuyy/auth-core": resolve(appRoot, "../../../packages/auth-core/src/index.ts"),
  "@letbuyy/cms-core": resolve(appRoot, "../../../packages/cms-core/src/index.ts"),
  "@letbuyy/shared-types": resolve(appRoot, "../../../packages/shared-types/src/index.ts"),
  "@letbuyy/theme-engine": resolve(appRoot, "../../../packages/theme-engine/src/index.ts"),
  "@letbuyy/ui": resolve(appRoot, "../../../packages/typescript/ui/src/index.ts"),
  "@letbuyy/ui/formatting": resolve(appRoot, "../../../packages/typescript/ui/src/formatting.ts"),
  "lucide-react": resolve(appRoot, "../../node_modules/.pnpm/node_modules/lucide-react"),
  "tailwind-merge": resolve(appRoot, "../../node_modules/.pnpm/node_modules/tailwind-merge"),
  zod: resolve(appRoot, "../../node_modules/.pnpm/node_modules/zod"),
};

type WebpackResolveConfig = {
  resolve?: {
    modules?: string[];
    fallback?: Record<string, string | false>;
  };
  plugins?: unknown[];
};

type WebpackHookContext = {
  isServer: boolean;
  webpack: {
    NormalModuleReplacementPlugin: new (
      resourceRegExp: RegExp,
      newResource: string,
    ) => unknown;
  };
};

const sessionRuntimeDistDir = process.env.LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR;
if (sessionRuntimeDistDir && !/^\.next-session-runtime-\d+-merchant-next(?:-production)?$/.test(sessionRuntimeDistDir)) {
  throw new Error('Merchant owned runtime requires a unique fixed .next-session-runtime-* directory');
}
const nextConfig: NextConfig = {
  ...(sessionRuntimeDistDir ? { distDir: sessionRuntimeDistDir } : {}),
  // Hide the floating Next.js dev-tools badge. It overlaps the bottom of the
  // merchant sidebar (it sits on top of Settings), which makes the nav look
  // broken while developing. Dev-only UI, so this changes nothing in production.
  devIndicators: false,
  transpilePackages: workspacePackages,
  turbopack: {
    root: workspaceRoot,
    resolveAlias: workspacePackageAliases,
  },
  // theme-engine's Liquid sanitizer dynamically imports jsdom for server-side
  // DOMPurify. The barrel re-exports the renderer, so the editor's client panels
  // transitively pull jsdom into the client graph. Keep it server-external and
  // drop it from the client bundle (it never executes client-side).
  serverExternalPackages: ['jsdom'],
  webpack(config: WebpackResolveConfig, { isServer, webpack }: WebpackHookContext) {
    const modules = config.resolve?.modules ?? [];
    config.resolve = {
      ...config.resolve,
      modules: [...modules, workspaceModules],
    };

    if (!isServer) {
      config.resolve.fallback = { ...(config.resolve.fallback || {}), jsdom: false };

      // Same barrel problem one layer deeper, and identical to the fix in
      // apps/commerce/web/next.config.ts: theme-engine's index re-exports
      // theme-packager, which imports `node:crypto` for build-time bundle
      // checksums. The theme editor page value-imports from that barrel, so
      // webpack must build every `export *` target and hits the node: request.
      //
      // resolve.fallback / resolve.alias CANNOT fix this: NormalModuleFactory
      // detects the `node:` URI scheme and takes the resolveForScheme branch,
      // never calling resolveResource(), so enhanced-resolve options are a no-op.
      // Rewriting the request in beforeResolve (NormalModuleReplacementPlugin) is
      // the only mechanism that intercepts it. Pointing at a local stub rather
      // than stripping the prefix also avoids Next's unconditional client rule
      // that maps bare `crypto` to crypto-browserify.
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:crypto$/,
          resolve(appRoot, 'src/lib/webpack/node-crypto-client-stub.ts'),
        ),
      );
    }

    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: createSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
