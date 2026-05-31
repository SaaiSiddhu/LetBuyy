#!/usr/bin/env node
/**
 * Sets required GitHub Actions secrets for staging and production.
 *
 * Required env vars depend on which providers are being configured. Missing
 * values are skipped without printing secret contents.
 *
 * Usage: node scripts/github/set-secrets.mjs
 */
import { spawnSync } from "node:child_process";

function setSecret(name, value) {
  if (!value) {
    console.warn(`SKIP: ${name} — value not set`);
    return 0;
  }
  const result = spawnSync("gh", ["secret", "set", name, "--body-file", "-"], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) throw new Error(`Failed to set secret: ${name}`);
  console.log(`Set secret: ${name}`);
  return 1;
}

const e = process.env;
let configured = 0;

configured += setSecret("CLOUDFLARE_API_TOKEN", e.CLOUDFLARE_API_TOKEN);
configured += setSecret("CLOUDFLARE_ACCOUNT_ID", e.CLOUDFLARE_ACCOUNT_ID);

configured += setSecret("VERCEL_TOKEN", e.VERCEL_TOKEN);
configured += setSecret("VERCEL_ORG_ID", e.VERCEL_ORG_ID);

for (const name of [
  "STAGING_IDENTITY_PROJECT_ID",
  "STAGING_MERCHANT_PROJECT_ID",
  "STAGING_STOREFRONT_PROJECT_ID",
  "STAGING_MARKETING_PROJECT_ID",
  "STAGING_CONSOLE_PROJECT_ID",
  "PRODUCTION_IDENTITY_PROJECT_ID",
  "PRODUCTION_MERCHANT_PROJECT_ID",
  "PRODUCTION_STOREFRONT_PROJECT_ID",
  "PRODUCTION_MARKETING_PROJECT_ID",
  "PRODUCTION_CONSOLE_PROJECT_ID",
]) {
  configured += setSecret(name, e[name]);
}

if (e.STAGING_SUPABASE_PROJECT_REF) {
  configured += setSecret("STAGING_SUPABASE_URL", `https://${e.STAGING_SUPABASE_PROJECT_REF}.supabase.co`);
}
configured += setSecret("STAGING_SUPABASE_ANON_KEY", e.STAGING_SUPABASE_ANON_KEY);
configured += setSecret("STAGING_SUPABASE_SERVICE_ROLE_KEY", e.STAGING_SUPABASE_SERVICE_ROLE_KEY);
if (e.STAGING_DB_PASSWORD && e.STAGING_SUPABASE_PROJECT_REF) {
  configured += setSecret(
    "STAGING_DB_CONNECTION_STRING",
    `postgresql://postgres:${e.STAGING_DB_PASSWORD}@db.${e.STAGING_SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  );
}

if (e.PRODUCTION_SUPABASE_PROJECT_REF) {
  configured += setSecret("PRODUCTION_SUPABASE_URL", `https://${e.PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`);
}
configured += setSecret("PRODUCTION_SUPABASE_ANON_KEY", e.PRODUCTION_SUPABASE_ANON_KEY);
configured += setSecret("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY", e.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY);
if (e.PRODUCTION_DB_PASSWORD && e.PRODUCTION_SUPABASE_PROJECT_REF) {
  configured += setSecret(
    "PRODUCTION_DB_CONNECTION_STRING",
    `postgresql://postgres:${e.PRODUCTION_DB_PASSWORD}@db.${e.PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  );
}

for (const name of [
  "STAGING_AUTH_SECRET",
  "STAGING_INTERNAL_API_SECRET",
  "PRODUCTION_AUTH_SECRET",
  "PRODUCTION_INTERNAL_API_SECRET",
]) {
  configured += setSecret(name, e[name]);
}

console.log(`GitHub secret setup complete. Configured ${configured} secrets.`);
