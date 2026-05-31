#!/usr/bin/env node
/**
 * Replace generated Cloudflare resource placeholders after provider resources exist.
 *
 * Usage:
 *   node scripts/cloudflare/update-wrangler-ids.mjs \
 *     --env staging \
 *     --kv-sessions <id> \
 *     --kv-cache <id> \
 *     --kv-rate-limit <id> \
 *     --hyperdrive <id> \
 *     --account-id <id>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "kv-sessions": { type: "string" },
    "kv-cache": { type: "string" },
    "kv-rate-limit": { type: "string" },
    hyperdrive: { type: "string" },
    "account-id": { type: "string" },
  },
});

if (!values.env || !["staging", "production"].includes(values.env)) {
  throw new Error("--env is required and must be staging or production");
}

const envPrefix = values.env.toUpperCase();
const replacements = {
  [`${envPrefix}_SESSION_KV_ID_PLACEHOLDER`]: values["kv-sessions"],
  [`${envPrefix}_CACHE_KV_ID_PLACEHOLDER`]: values["kv-cache"],
  [`${envPrefix}_RATE_LIMIT_KV_ID_PLACEHOLDER`]: values["kv-rate-limit"],
  [`${envPrefix}_HYPERDRIVE_ID_PLACEHOLDER`]: values.hyperdrive,
  CLOUDFLARE_ACCOUNT_ID_PLACEHOLDER: values["account-id"],
};

const workerDirs = [
  "services/api-gateway",
  "services/webhook-service",
  "services/queue-workers",
  "services/checkout-runtime",
  "services/notification-service",
  "services/search-service",
  "services/media-service",
  "services/analytics-pipeline",
  "services/event-bus",
];

let updated = 0;
for (const workerDir of workerDirs) {
  const tomlPath = join(root, workerDir, "wrangler.toml");
  let content;
  try {
    content = readFileSync(tomlPath, "utf8");
  } catch {
    continue;
  }

  let nextContent = content;
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (value) nextContent = nextContent.replaceAll(placeholder, value);
  }

  if (nextContent !== content) {
    writeFileSync(tomlPath, nextContent);
    console.log(`Updated: ${workerDir}/wrangler.toml`);
    updated += 1;
  }
}

if (values["account-id"]) {
  const namesPath = join(root, "config/cloudflare/resource-names.json");
  const resourceNames = JSON.parse(readFileSync(namesPath, "utf8"));
  resourceNames.account.id = values["account-id"];
  writeFileSync(namesPath, `${JSON.stringify(resourceNames, null, 2)}\n`);
  console.log("Updated: config/cloudflare/resource-names.json");
}

console.log(`Done. Updated ${updated} wrangler.toml files for ${values.env}.`);
