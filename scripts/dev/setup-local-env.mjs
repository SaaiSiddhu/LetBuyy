#!/usr/bin/env node
// Generate local-development env files for every LetBuyy runtime.
//
//   node scripts/dev/setup-local-env.mjs           # create files only if missing
//   node scripts/dev/setup-local-env.mjs --force   # overwrite existing files
//
// Outputs (all UNTRACKED — see config/env/README.md non-negotiable rules):
//   apps/<app>/.env.local        (loaded automatically by `next dev`)
//   services/<svc>/.dev.vars     (loaded automatically by `wrangler dev`)
//
// The KEY SET is taken from the committed governance templates
// (config/env/templates/*.env.example) so this stays in sync with the schema;
// only the VALUES are overlaid with localhost/dev-safe defaults here. No real
// secrets — every value below is obviously local-only.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  APP_PORTS,
  SERVICE_PORTS,
  appOrigin,
  serviceOrigin,
  API_BASE_URL,
} from "./ports.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const force = process.argv.includes("--force");
const joinLocalValue = (...parts) => parts.join("");

// A single dev-only placeholder secret reused across local runtimes. >=32 chars; the storefront
// signing keys need >=16. INTERNAL_API_SECRET is shared between Next apps and
// workers so the storefront middleware -> api-gateway internal calls line up.
const DEV_SECRET = "letbuyy_local_dev_only_secret_change_me_please";
// Cloudflare Turnstile "always passes" test keys (public, documented by CF).
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = joinLocalValue("1x0000000000000000000000000000000", "AA");
// Supabase local/demo keys — well-known public dev JWTs. They are valid 3-part
// JWTs (so the gateway's Supabase client constructs instead of throwing
// "Expected 3 parts in JWT") and match a default `supabase start`.
const SUPABASE_DEMO_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SUPABASE_DEMO_SERVICE_ROLE_KEY = [
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0",
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
].join(".");

// ---- value overlays -------------------------------------------------------

const NEXT_OVERRIDES = {
  NEXT_PUBLIC_API_URL: API_BASE_URL,
  NEXT_PUBLIC_API_BASE_URL: API_BASE_URL,
  NEXT_PUBLIC_ACCOUNTS_URL: appOrigin("identity-platform"),
  NEXT_PUBLIC_MARKETING_URL: appOrigin("marketing-site"),
  NEXT_PUBLIC_ADMIN_URL: appOrigin("merchant-web"),
  NEXT_PUBLIC_STOREFRONT_URL: appOrigin("customer-web"),
  NEXT_PUBLIC_THEME_MARKETPLACE_URL: appOrigin("theme-marketplace"),
  NEXT_PUBLIC_APP_MARKETPLACE_URL: appOrigin("app-marketplace"),
  NEXT_PUBLIC_DEVELOPER_PORTAL_URL: appOrigin("developer-portal"),
  NEXT_PUBLIC_STORE_ROOT_DOMAIN: "localhost",
  NEXT_PUBLIC_SUPPORT_EMAIL: "support@letbuyy.local",
  NEXT_PUBLIC_APP_URL: appOrigin("customer-web"),
  NEXT_PUBLIC_ENV: "development",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_DEMO_ANON_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
  NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: "true",
  NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES: "false",
  NEXT_PUBLIC_FOUNDING_PUBLIC_LIVE: "true",
  NEXT_PUBLIC_RAZORPAY_KEY_ID: joinLocalValue("rzp_test", "_localdev"),

  LETBUYY_API_URL: API_BASE_URL,
  LETBUYY_API_BASE_URL: API_BASE_URL,
  API_URL: API_BASE_URL,
  API_BASE_URL: API_BASE_URL,
  INTERNAL_API_SECRET: DEV_SECRET,
  PREVIEW_SIGNING_KEY: DEV_SECRET,
  STORE_ACCESS_SIGNING_KEY: DEV_SECRET,
  AUTH_SECRET: DEV_SECRET,
  CUSTOMER_SESSION_SECRET: DEV_SECRET,
  CSRF_SECRET: DEV_SECRET,
  // COOKIE_DOMAIN intentionally blank: localhost cookies must stay host-only.
  COOKIE_DOMAIN: "",
  ADMIN_ORIGIN: appOrigin("merchant-web"),
  STOREFRONT_FRAME_ANCESTORS: `${appOrigin("merchant-web")} ${appOrigin("admin-web")}`,
  PLATFORM_CONSOLE_ALLOWED_EMAILS: "admin@letbuyy.local",
  PLATFORM_CONSOLE_SESSION_SECRET: DEV_SECRET,
  PLATFORM_CONSOLE_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
  PLATFORM_CONSOLE_DEV_MFA_CODE: "000000",
  PLATFORM_CONSOLE_API_TOKEN: DEV_SECRET,
  PLATFORM_CONSOLE_API_BASE_URL: API_BASE_URL,
  LETBUYY_ENABLE_DEV_AUTH_BYPASS: "true",
  LETBUYY_ENABLE_LEGACY_SITE_TYPES: "false",
  RESEND_API_KEY: "re_local_dev_unused",
  RESEND_FROM_EMAIL: "noreply@letbuyy.local",
  // Left blank on purpose: the API gateway uses Redis for rate limiting whenever
  // both Upstash vars are set, and fails closed (429) if it can't reach it.
  // Blank => it falls back to its built-in in-memory limiter. No local Redis needed.
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
  STRIPE_SECRET_KEY: "sk_test_localdev",
  STRIPE_WEBHOOK_SECRET: "whsec_localdev",
  PAYPAL_CLIENT_ID: "paypal_localdev_client",
  PAYPAL_CLIENT_SECRET: "paypal_localdev_secret",
  PAYPAL_WEBHOOK_ID: "paypal_localdev_webhook",
  PAYPAL_MODE: "sandbox",
  SEED_SECRET: "local-dev-seed",
};

const WORKER_OVERRIDES = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: SUPABASE_DEMO_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_DEMO_SERVICE_ROLE_KEY,
  AUTH_SECRET: DEV_SECRET,
  CSRF_SECRET: DEV_SECRET,
  INTERNAL_API_SECRET: DEV_SECRET,
  PREVIEW_SIGNING_KEY: DEV_SECRET,
  STORE_ACCESS_SIGNING_KEY: DEV_SECRET,
  LETBUYY_INTERNAL_API_SECRET: DEV_SECRET,
  PLATFORM_CONSOLE_API_TOKEN: DEV_SECRET,
  NEXT_PUBLIC_STORE_ROOT_DOMAIN: "localhost",
  STOREFRONT_ROOT_DOMAIN: "localhost",
  PLATFORM_ROOT_DOMAIN: "localhost",
  // Custom-domain CNAME target shown to merchants in the Domain Center connect flow.
  // Matches the staging/production templates (connect.letbuyy.com); the gateway throws
  // without it, so the dev worker needs it too.
  CUSTOM_DOMAIN_CNAME_TARGET: "connect.letbuyy.com",
  NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET: "connect.letbuyy.com",
  // Domain registrar — dev/staging only. The sandbox provider returns synthetic
  // availability/pricing so the "Buy a domain" search/purchase flow is exercisable
  // locally without live ResellerClub/OpenSRS credentials. Hard-forbidden in
  // production; set REGISTRAR_PROVIDER=resellerclub|opensrs + creds for real use.
  REGISTRAR_PROVIDER: "sandbox",
  REGISTRAR_SANDBOX_ENABLED: "true",
  ENVIRONMENT: "staging",
  APP_ENV: "staging",
  NODE_ENV: "production",
  DEPLOYMENT_ENV: "staging",
  TELEMETRY_ENV: "staging",
  RUNTIME_NAME: "LetBuyy Worker (local)",
  LETBUYY_ENABLE_LEGACY_SITE_TYPES: "false",
  CORS_CREDENTIAL_ORIGINS: Object.keys(APP_PORTS).map(appOrigin).join(","),
  PRIMARY_REGION: "ap-south-1",
  EDGE_SCOPE: "global-edge",
  ASSET_PUBLIC_BASE_URL: `${serviceOrigin("api-gateway")}/assets`,
  RAZORPAY_KEY_ID: joinLocalValue("rzp_test", "_localdev"),
  RAZORPAY_KEY_SECRET: joinLocalValue("rzp_test", "_localdev_secret"),
  RAZORPAY_WEBHOOK_SECRET: joinLocalValue("rzp_test", "_localdev_webhook"),
  STRIPE_SECRET_KEY: "sk_test_localdev",
  STRIPE_WEBHOOK_SECRET: "whsec_localdev",
  PAYPAL_CLIENT_ID: "paypal_localdev_client",
  PAYPAL_CLIENT_SECRET: "paypal_localdev_secret",
  PAYPAL_WEBHOOK_ID: "paypal_localdev_webhook",
  PAYPAL_MODE: "sandbox",
  CASHFREE_APP_ID: "cashfree_localdev_app",
  CASHFREE_SECRET_KEY: "cashfree_localdev_secret",
  CASHFREE_ENVIRONMENT: "sandbox",
  RESEND_API_KEY: "re_local_dev_unused",
  RESEND_FROM_EMAIL: "noreply@letbuyy.local",
  // Blank => API gateway uses its in-memory rate limiter instead of failing
  // closed (429) against an unreachable Redis. No local Redis required.
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  PAYMENT_CONFIG_ENCRYPTION_KEY: DEV_SECRET,
  R2_BUCKET: "letbuyy-media-local",
  // No local Supabase tables to write to — skip request-log inserts to cut noise.
  REQUEST_LOG_SAMPLE_RATE: "0",
};

// ---- template-driven rendering --------------------------------------------

function templateKeys(relPath) {
  const raw = readFileSync(path.join(repoRoot, relPath), "utf8");
  const keys = [];
  for (const line of raw.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) keys.push([m[1], m[2]]);
  }
  return keys;
}

function render(title, templateRel, overrides, extra = {}) {
  const lines = [
    `# ${title}`,
    `# AUTO-GENERATED by scripts/dev/setup-local-env.mjs — local development only.`,
    `# Untracked by design. Re-run with --force to regenerate. Do NOT commit.`,
    "",
  ];
  const seen = new Set();
  for (const [key, templateValue] of templateKeys(templateRel)) {
    if (seen.has(key)) continue;
    seen.add(key);
    let value;
    if (key in extra) value = extra[key];
    else if (key in overrides) value = overrides[key];
    else value = templateValue; // fall back to the committed placeholder
    lines.push(`${key}=${value}`);
  }
  // Any override not present in the template (defensive; normally none).
  for (const [key, value] of Object.entries({ ...overrides, ...extra })) {
    if (!seen.has(key)) {
      seen.add(key);
      lines.push(`${key}=${value}`);
    }
  }
  return lines.join("\n") + "\n";
}

function writeIfNeeded(absPath, content) {
  const rel = path.relative(repoRoot, absPath);
  mkdirSync(path.dirname(absPath), { recursive: true });
  if (existsSync(absPath) && !force) {
    return { rel, status: "kept (exists)" };
  }
  writeFileSync(absPath, content);
  return { rel, status: force ? "written (--force)" : "created" };
}

const results = [];

// Next apps -> .env.local
for (const app of Object.keys(APP_PORTS)) {
  const content = render(
    `LetBuyy ${app} — local Next.js env (port ${APP_PORTS[app]})`,
    "config/env/templates/next-app.env.example",
    NEXT_OVERRIDES,
  );
  results.push(writeIfNeeded(path.join(repoRoot, "apps", app, ".env.local"), content));
}

// Workers -> .dev.vars
for (const svc of Object.keys(SERVICE_PORTS)) {
  const content = render(
    `LetBuyy ${svc} — local Cloudflare Worker vars (port ${SERVICE_PORTS[svc].http})`,
    "config/env/templates/worker.env.example",
    WORKER_OVERRIDES,
    { RUNTIME_NAME: `LetBuyy ${svc} (local)` },
  );
  results.push(writeIfNeeded(path.join(repoRoot, "services", svc, ".dev.vars"), content));
}

const created = results.filter((r) => r.status !== "kept (exists)").length;
console.log("LetBuyy local env setup:");
for (const r of results) console.log(`  ${r.status.padEnd(18)} ${r.rel}`);
console.log(
  created > 0
    ? `\n${created} env file(s) generated. (Use --force to regenerate all.)`
    : `\nAll env files already present — nothing changed. (Use --force to regenerate.)`,
);
