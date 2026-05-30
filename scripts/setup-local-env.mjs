#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ownershipPath = path.join(root, "config/env/ownership/runtime-env-ownership.json");
const localTemplatePath = path.join(root, "config/env/templates/local.env.example");

const appPorts = {
  "apps/marketing-site": 3000,
  "apps/identity-platform": 3001,
  "apps/merchant-control-plane": 3002,
  "apps/storefront-runtime": 3003,
  "apps/app-marketplace": 3004,
  "apps/theme-marketplace": 3005,
  "apps/platform-console": 3010,
  "apps/platform-operations-portal": 3011,
};

const localValues = {
  NEXT_PUBLIC_API_URL: "http://localhost:8787/v1",
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:8787/v1",
  LETBUYY_API_URL: "http://localhost:8787/v1",
  LETBUYY_API_BASE_URL: "http://localhost:8787/v1",
  API_URL: "http://localhost:8787/v1",
  API_BASE_URL: "http://localhost:8787/v1",
  NEXT_PUBLIC_ACCOUNTS_URL: "http://localhost:3001",
  NEXT_PUBLIC_ADMIN_URL: "http://localhost:3002",
  NEXT_PUBLIC_STOREFRONT_URL: "http://localhost:3003",
  NEXT_PUBLIC_STOREFRONT_LOCAL_URL: "http://localhost:3003",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  SUPABASE_URL: "http://localhost:54321",
  UPSTASH_REDIS_REST_URL: "http://localhost:63790",
  RESEND_FROM_EMAIL: "noreply@localhost",
  PAYPAL_MODE: "sandbox",
  ENVIRONMENT: "local",
  APP_ENV: "local",
  NODE_ENV: "development",
  DEPLOYMENT_ENV: "local",
  TELEMETRY_ENV: "local",
  RUNTIME_NAME: "LetBuyy Local Worker",
  PRIMARY_REGION: "ap-south-1",
  FAILOVER_REGION: "ap-southeast-1",
  EVENT_QUEUE_NAME: "letbuyy-events-dev",
  ANALYTICS_QUEUE_NAME: "letbuyy-analytics-dev",
  SEARCH_QUEUE_NAME: "letbuyy-search-indexing-dev",
  NOTIFICATION_QUEUE_NAME: "letbuyy-notifications-dev",
  R2_BUCKET: "letbuyy-local",
};

const providerOrSecretPattern = /(SECRET|TOKEN|KEY|PASSWORD|CLIENT_ID|WEBHOOK|ENCRYPTION|AUTH)/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function placeholderFor(key) {
  return `dev-only-placeholder-${key}`;
}

function valueNeedsWarning(key, value) {
  return providerOrSecretPattern.test(key) || value.includes("replace-with");
}

function valueFor(key, value) {
  if (Object.prototype.hasOwnProperty.call(localValues, key)) {
    return localValues[key];
  }

  if (key.startsWith("NEXT_PUBLIC_") && providerOrSecretPattern.test(key)) {
    return placeholderFor(key);
  }

  if (providerOrSecretPattern.test(key) || value.includes("replace-with")) {
    return placeholderFor(key);
  }

  if (value.includes("api.example.com/v1")) return "http://localhost:8787/v1";
  if (value.includes("accounts.example.com")) return "http://localhost:3001";
  if (value.includes("admin.example.com")) return "http://localhost:3002";
  if (value.includes("storefront.example.com")) return "http://localhost:3003";
  if (value.includes("example.supabase.co")) return "http://localhost:54321";
  if (value.includes("example.upstash.io")) return "http://localhost:63790";
  if (value.includes("noreply@example.com")) return "noreply@localhost";

  return value;
}

function renderTemplate(templatePath, owner) {
  const warnings = [];
  const lines = fs.readFileSync(templatePath, "utf8").split(/\r?\n/);
  const rendered = lines.map((line) => {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) return line;

    const index = line.indexOf("=");
    const key = line.slice(0, index);
    const value = line.slice(index + 1);
    const nextValue = valueFor(key, value);

    if (valueNeedsWarning(key, value)) {
      warnings.push(`${owner}: ${key}`);
    }

    return `${key}=${nextValue}`;
  });

  if (owner && appPorts[owner]) {
    rendered.push(`NEXT_PUBLIC_APP_URL=http://localhost:${appPorts[owner]}`);
  }

  return {
    content: `${rendered.join("\n").replace(/\n*$/, "")}\n`,
    warnings,
  };
}

function createIfMissing(target, content, created, skipped) {
  if (fs.existsSync(target)) {
    skipped.push(path.relative(root, target));
    return;
  }

  fs.writeFileSync(target, content);
  created.push(path.relative(root, target));
}

function main() {
  const ownership = readJson(ownershipPath);
  const created = [];
  const skipped = [];
  const warnings = [];

  if (fs.existsSync(localTemplatePath)) {
    const rendered = renderTemplate(localTemplatePath, ".");
    createIfMissing(path.join(root, ".env.local"), rendered.content, created, skipped);
    warnings.push(...rendered.warnings);
  }

  const groups = [
    ["nextApp", ".env.local"],
    ["worker", ".dev.vars"],
    ["mobile", ".dart-defines.local"],
  ];

  for (const [groupName, targetName] of groups) {
    const group = ownership[groupName];
    if (!group) continue;

    for (const owner of group.owners || []) {
      const target = path.join(root, owner, targetName);
      const rendered = renderTemplate(path.join(root, group.template), owner);
      createIfMissing(target, rendered.content, created, skipped);
      warnings.push(...rendered.warnings);
    }
  }

  console.log("[setup-env] created:");
  if (created.length === 0) console.log("- none");
  for (const file of created) console.log(`- ${file}`);

  console.log("[setup-env] skipped existing:");
  if (skipped.length === 0) console.log("- none");
  for (const file of skipped) console.log(`- ${file}`);

  const uniqueWarnings = [...new Set(warnings)].sort();
  if (uniqueWarnings.length > 0) {
    console.log("[setup-env] fields requiring real values for full functionality:");
    for (const warning of uniqueWarnings) console.log(`- ${warning}`);
  }
}

main();
