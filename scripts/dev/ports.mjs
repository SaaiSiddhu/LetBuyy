// LetBuyy local-development port map — single source of truth.
//
// Used by:
//   - scripts/dev/setup-local-env.mjs   (cross-app URLs in generated .env.local / .dev.vars)
//   - scripts/dev/apply-dev-scripts.mjs (per-package `dev` scripts)
//   - docs/LOCAL_DEV.md                 (human reference)
//
// These ports ONLY affect local execution. Staging/production remain the only
// supported deployment targets (see config/env/README.md). Nothing here is
// tracked into runtime behaviour beyond untracked .env.local / .dev.vars files.

/**
 * Next.js apps (application root under apps/ -> http port). `next dev -p <port>`.
 * Keys are paths under apps/ exactly (D-APP-LAYOUT, Constitution Amendment 3, 2026-09-24): the generator
 * writes apps/<key>/.env.local and apply-dev-scripts patches apps/<key>/package.json, so a key that names
 * no application root configures nothing (tests/governance/local-dev-env-generator.test.mjs).
 * Ports are unchanged by the move; only the keys follow the new paths.
 */
export const APP_PORTS = {
  "commerce/web": 9000,
  "merchant/web": 9001,
  "platform/identity": 9002,
  "frozen/app-store": 9003,
  "frozen/developer-portal": 9004,
  "frozen/theme-store": 9005,
  "marketing/web": 9006,
  "internal/console": 9007,
  "frozen/operations-portal": 9008,
};

/**
 * The maintained web applications `pnpm dev` starts by default. The frozen applications keep their ports
 * and env files for deliberate use (`pnpm dev:frozen`), but never start by default (D-APP-LAYOUT).
 */
export const DEFAULT_DEV_APPS = [
  "commerce/web",
  "merchant/web",
  "platform/identity",
  "internal/console",
  "marketing/web",
];

/** Storybook for the shared UI library (packages/typescript/ui). */
export const STORYBOOK_PORT = 9009;

/**
 * Cloudflare Workers (dirname under services/ -> { http, inspector }).
 * Each worker runs as its own `wrangler dev` so every service is reachable on
 * its own HTTP port; distinct inspector ports avoid the well-known 9229 clash.
 */
export const SERVICE_PORTS = {
  "api-gateway": { http: 9010, inspector: 9110 },
  "mobile-bff": { http: 9011, inspector: 9111 },
  "webhook-service": { http: 9012, inspector: 9112 },
  "queue-workers": { http: 9013, inspector: 9113 },
};

/** Canonical local origin for a Next app by dirname. */
export const appOrigin = (name) => `http://localhost:${APP_PORTS[name]}`;

/** Canonical local origin for a worker by dirname. */
export const serviceOrigin = (name) => `http://localhost:${SERVICE_PORTS[name].http}`;

/** The API gateway is the backend every app/worker points at locally. */
export const API_ORIGIN = serviceOrigin("api-gateway");
export const API_BASE_URL = `${API_ORIGIN}/v1`;
