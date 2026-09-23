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
 * Next.js apps (dirname under apps/ -> http port). `next dev -p <port>`.
 * Keys are folder names exactly: the generator writes apps/<key>/.env.local and apply-dev-scripts patches
 * apps/<key>/package.json, so a key that names no folder configures nothing
 * (tests/governance/local-dev-env-generator.test.mjs).
 */
export const APP_PORTS = {
  customer_web: 9000,
  merchant_web: 9001,
  "identity-platform": 9002,
  "app-marketplace": 9003,
  "developer-portal": 9004,
  "theme-marketplace": 9005,
  "marketing-site": 9006,
  admin_web: 9007,
  "platform-operations-portal": 9008,
};

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
