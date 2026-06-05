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
configured += setSecret("SUPABASE_ACCESS_TOKEN", e.SUPABASE_ACCESS_TOKEN);

configured += setSecret("VERCEL_TOKEN", e.VERCEL_TOKEN);
configured += setSecret("VERCEL_ORG_ID", e.VERCEL_ORG_ID);

const environments = ["STAGING", "PRODUCTION"];
const vercelProjectSuffixes = [
  "MARKETING",
  "IDENTITY",
  "MERCHANT",
  "STOREFRONT",
  "APP_MARKETPLACE",
  "DEVELOPER_PORTAL",
  "THEME_MARKETPLACE",
  "PLATFORM_CONSOLE",
  "PLATFORM_OPERATIONS_PORTAL",
];
const legacyProjectAliases = {
  STAGING_PLATFORM_CONSOLE_PROJECT_ID: "STAGING_CONSOLE_PROJECT_ID",
  PRODUCTION_PLATFORM_CONSOLE_PROJECT_ID: "PRODUCTION_CONSOLE_PROJECT_ID",
};
const generatedSecretSuffixes = [
  "AUTH_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "INTERNAL_API_SECRET",
  "CSRF_SECRET",
  "PLATFORM_CONSOLE_SESSION_SECRET",
  "PLATFORM_CONSOLE_TOTP_SECRET",
  "PLATFORM_CONSOLE_API_TOKEN",
  "PAYMENT_CONFIG_ENCRYPTION_KEY",
];
const providerSecretSuffixes = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_MODE",
];
const operatorConfigSuffixes = [
  "PLATFORM_CONSOLE_ALLOWED_EMAILS",
  "PLATFORM_CONSOLE_DEV_MFA_CODE",
];

function envValue(name) {
  return e[name] || e[legacyProjectAliases[name]];
}

for (const environment of environments) {
  for (const suffix of vercelProjectSuffixes) {
    const name = `${environment}_${suffix}_PROJECT_ID`;
    configured += setSecret(name, envValue(name));
  }

  const projectRef = e[`${environment}_SUPABASE_PROJECT_REF`];
  const explicitSupabaseUrl = e[`${environment}_SUPABASE_URL`];
  configured += setSecret(`${environment}_SUPABASE_PROJECT_REF`, projectRef);
  configured += setSecret(
    `${environment}_SUPABASE_URL`,
    explicitSupabaseUrl || (projectRef ? `https://${projectRef}.supabase.co` : undefined),
  );
  configured += setSecret(`${environment}_SUPABASE_ANON_KEY`, e[`${environment}_SUPABASE_ANON_KEY`]);
  configured += setSecret(`${environment}_SUPABASE_SERVICE_ROLE_KEY`, e[`${environment}_SUPABASE_SERVICE_ROLE_KEY`]);

  configured += setSecret(
    `${environment}_DB_CONNECTION_STRING`,
    e[`${environment}_DB_CONNECTION_STRING`] ||
      (e[`${environment}_DB_PASSWORD`] && projectRef
        ? `postgresql://postgres:${e[`${environment}_DB_PASSWORD`]}@db.${projectRef}.supabase.co:5432/postgres`
        : undefined),
  );

  for (const suffix of generatedSecretSuffixes) {
    const name = `${environment}_${suffix}`;
    configured += setSecret(name, e[name]);
  }

  for (const suffix of operatorConfigSuffixes) {
    const name = `${environment}_${suffix}`;
    configured += setSecret(name, e[name]);
  }

  for (const suffix of providerSecretSuffixes) {
    const name = `${environment}_${suffix}`;
    configured += setSecret(name, e[name]);
  }
}

console.log(`GitHub secret setup complete. Configured ${configured} secrets.`);
