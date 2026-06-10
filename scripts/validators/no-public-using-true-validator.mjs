import {
  assertNoOffenders,
  lineNumberForIndex,
  phaseBEntries,
} from "./phase-b-common.mjs";
import {
  createReporter,
  listWorkspaceFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("No public USING true validator");
const legacySqlFiles = new Set([
  "apps/identity-platform/src/lib/db/schema.sql",
  "database/supabase/migrations/000_baseline.sql",
]);

const offenders = [];
for (const entry of phaseBEntries(["apps", "database", "services"], { filePattern: /\.sql$/ })) {
  if (legacySqlFiles.has(entry.path) && !entry.extra) continue;

  for (const match of entry.text.matchAll(/CREATE\s+POLICY[\s\S]*?;/gi)) {
    const block = match[0];
    const hasTruePolicy = /\bUSING\s*\(\s*true\s*\)|WITH\s+CHECK\s*\(\s*true\s*\)/i.test(block);
    const publicRole = /\bTO\s+(PUBLIC|anon|authenticated)\b/i.test(block);
    const serviceRoleOnly = /\bTO\s+service_role\b/i.test(block) && !publicRole;
    if (hasTruePolicy && publicRole && !serviceRoleOnly) {
      offenders.push(`${entry.path}:${lineNumberForIndex(entry.text, match.index || 0)} PUBLIC/anon/authenticated policy must not use true predicates`);
    }
  }
}

assertNoOffenders(reporter, offenders, "PUBLIC/anon/authenticated RLS policies must fail closed");

const sensitiveTables = new Set([
  "products",
  "product_variants",
  "product_options",
  "orders",
  "sites",
  "store_customers",
  "customer_activity_log",
  "customer_wishlists",
  "wishlists",
  "subscriptions",
  "billing_history",
  "super_admin_allowlist",
]);

function normalizePolicyName(rawName) {
  const trimmed = rawName.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).replace(/""/g, '"')
    : trimmed;
}

function policyRoles(block) {
  const roleMatch = block.match(/\bTO\s+([\s\S]*?)\s+(?:USING|WITH\s+CHECK)\b/i);
  if (!roleMatch) return [];
  return roleMatch[1]
    .split(",")
    .map((role) => role.trim().replace(/^"|"$/g, "").toLowerCase())
    .filter(Boolean);
}

function appliesBeyondServiceRole(block) {
  const roles = policyRoles(block);
  if (!roles.length) return true;
  return roles.some((role) => role === "public" || role === "anon" || role === "authenticated");
}

function hasTruePredicate(block) {
  return /\bUSING\s*\(\s*true\s*\)|\bWITH\s+CHECK\s*\(\s*true\s*\)/i.test(block);
}

function hasPublicWildcardTenantPredicate(block) {
  return /\bWHERE\s+true\b/i.test(block) && appliesBeyondServiceRole(block);
}

const finalPolicies = new Map();
const migrationSqlFiles = listWorkspaceFiles(["database/supabase/migrations"])
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of migrationSqlFiles) {
  const text = readFile(file);

  for (const match of text.matchAll(/DROP\s+POLICY\s+IF\s+EXISTS\s+("[^"]+"|[A-Za-z_][\w$]*)\s+ON\s+public\.([A-Za-z_][\w$]*)\s*;/gi)) {
    const [, rawName, table] = match;
    if (sensitiveTables.has(table)) finalPolicies.delete(`${table}:${normalizePolicyName(rawName)}`);
  }

  for (const match of text.matchAll(/CREATE\s+POLICY\s+("[^"]+"|[A-Za-z_][\w$]*)\s+ON\s+public\.([A-Za-z_][\w$]*)[\s\S]*?;/gi)) {
    const [block, rawName, table] = match;
    if (!sensitiveTables.has(table)) continue;
    finalPolicies.set(`${table}:${normalizePolicyName(rawName)}`, {
      block,
      file,
      line: lineNumberForIndex(text, match.index || 0),
      table,
      name: normalizePolicyName(rawName),
    });
  }
}

const finalStateOffenders = [];
for (const policy of finalPolicies.values()) {
  if (appliesBeyondServiceRole(policy.block) && hasTruePredicate(policy.block)) {
    finalStateOffenders.push(
      `${policy.file}:${policy.line} ${policy.table}.${policy.name} remains PUBLIC/anon/authenticated with USING/WITH CHECK true`,
    );
  }

  if (policy.table === "wishlists" && hasPublicWildcardTenantPredicate(policy.block)) {
    finalStateOffenders.push(
      `${policy.file}:${policy.line} ${policy.table}.${policy.name} uses WHERE true instead of an authenticated tenant predicate`,
    );
  }

  if (policy.table === "super_admin_allowlist" && appliesBeyondServiceRole(policy.block) && /\bFOR\s+(?:ALL|INSERT)\b/i.test(policy.block) && !/public\.is_super_admin\(\)/i.test(policy.block)) {
    finalStateOffenders.push(
      `${policy.file}:${policy.line} ${policy.table}.${policy.name} permits allowlist mutation without super-admin proof`,
    );
  }
}

for (const [table, policyName] of [
  ["orders", "orders_tenant_site_guc"],
  ["products", "products_tenant_site_guc"],
  ["product_variants", "product_variants_tenant_site_guc"],
  ["product_options", "product_options_tenant_site_guc"],
  ["sites", "sites_tenant_site_guc"],
  ["store_customers", "store_customers_tenant_store_guc"],
  ["customer_activity_log", "customer_activity_log_tenant_store_guc"],
  ["wishlists", "wishlists_tenant_store_guc"],
  ["customer_wishlists", "customer_wishlists_tenant_store_guc"],
  ["subscriptions", "subscriptions_tenant_site_guc"],
  ["billing_history", "billing_history_tenant_site_guc"],
]) {
  reporter.assert(
    finalPolicies.has(`${table}:${policyName}`),
    `${table} must have D2 tenant-GUC policy ${policyName}`,
  );
}

assertNoOffenders(reporter, finalStateOffenders, "Sensitive tables must not end with PUBLIC true policies");
reporter.finish("public USING true policies checked");
