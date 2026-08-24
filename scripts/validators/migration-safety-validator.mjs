import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Migration safety validator");

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

// Liquid theme-bundle migrations (171, 172, 199, 200, ...) embed an entire portable theme bundle — real
// Liquid source, HTML, and merchant-facing copy — as a single jsonb literal via Postgres dollar-quoting,
// e.g. `$liquidbundle$ { ... } $liquidbundle$::jsonb`. That payload is DATA, not executable SQL, but can
// legitimately contain the English/Liquid words this file's keyword patterns look for (e.g. Liquid's
// `truncate:` filter, or settings copy like "Truncated to 160 characters"). Strip only this one, fixed,
// already-established tag (not dollar-quoting in general, which also wraps real PL/pgSQL function bodies
// this validator must keep scanning) before running the destructive-keyword patterns below.
function stripLiquidBundleJsonPayloads(sql) {
  return sql.replace(/\$liquidbundle\$[\s\S]*?\$liquidbundle\$/g, () => "$liquidbundle$$liquidbundle$");
}

const forbiddenPatterns = [
  { pattern: /\bDROP\s+TABLE\b/i, message: "DROP TABLE is forbidden in replayable migrations; use additive compatibility or explicit repair runbooks" },
  { pattern: /\bDROP\s+SCHEMA\b/i, message: "DROP SCHEMA is forbidden in replayable migrations" },
  { pattern: /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+COLUMN\b/i, message: "DROP COLUMN is forbidden in replayable migrations; use expand/contract with compatibility views" },
  { pattern: /\bTRUNCATE\b/i, message: "TRUNCATE is forbidden in replayable migrations" },
  { pattern: /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\s+COLUMN\b/i, message: "RENAME COLUMN is forbidden in replayable migrations; add compatible columns and backfill first" },
  { pattern: /\bALTER\s+TABLE\s+(?!.*\bIF\s+EXISTS\b)[A-Za-z_][A-Za-z0-9_]*\s+RENAME\s+TO\b/i, message: "Physical table renames are forbidden in replayable migrations; use compatibility views and phased cutovers" },
  { pattern: /\bALTER\s+TABLE\s+sites\s+RENAME\s+TO\s+stores\b/i, message: "sites must not be renamed to stores; stores is UI/API language only" },
  { pattern: /\bALTER\s+TABLE\s+stores\s+RENAME\s+TO\s+sites\b/i, message: "physical sites/stores rename cycles are forbidden" },
  { pattern: /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+stores\b/i, message: "stores table is forbidden; use sites table plus stores view/API terminology" },
];

for (const file of getTrackedFiles().filter((candidate) => candidate.startsWith("database/supabase/migrations/") && candidate.endsWith(".sql"))) {
  // Strip the dollar-quoted JSON payload BEFORE stripping SQL comments: the embedded bundle contains
  // real `--lb-*` CSS custom-property declarations, and stripSqlComments' `--.*$` line-comment strip
  // would otherwise eat everything from the first one to end-of-line — on a JSON.stringify'd single-line
  // payload, that is the rest of the statement, including the closing dollar-quote tag.
  const sql = stripSqlComments(stripLiquidBundleJsonPayloads(readFile(file)));
  for (const { pattern, message } of forbiddenPatterns) {
    reporter.assert(!pattern.test(sql), `${file}: ${message}`);
  }
}

const legacyReplayabilityDebt = [
  "076_app_extension_registry.sql",
  "093_app_pricing_plans.sql",
  "095_app_usage_metering.sql",
  "096_app_spend_controls.sql",
  "097_app_uninstall_feedback.sql",
  "098_app_versions.sql",
];

const merchantMobileV2Migrations = [
  "114_mobile_onboarding_attempt_progress.sql",
  "115_product_review_merchant_replies.sql",
  "116_mobile_draft_orders.sql",
  "117_mobile_customer_notes_tags.sql",
  "118_mobile_shipping_labels.sql",
  "119_mobile_money_ledgers.sql",
  "120_mobile_kyc_documents.sql",
  "121_mobile_merchant_2fa_factors.sql",
  "122_mobile_business_profile.sql",
  "123_mobile_tax_rate_parity.sql",
  "129_mobile_customer_segments.sql",
  "130_orders_site_id_not_null.sql",
  "131_hot_table_partition_shadow_mirror.sql",
  "132_mobile_whatsapp_commerce.sql",
  "136_mobile_marketing_email_campaigns.sql",
  "137_mobile_storefront_localization.sql",
  "138_mobile_store_metafields.sql",
  "140_mobile_cod_reconciliation.sql",
  "158_order_items_tenant_scope.sql",
];

const migrationReplayabilityDoc = "docs/governance/migration-replayability.md";
reporter.assert(exists(migrationReplayabilityDoc), `Missing migration replayability governance doc: ${migrationReplayabilityDoc}`);
const replayabilityDoc = readFile(migrationReplayabilityDoc);
for (const fileName of legacyReplayabilityDebt) {
  reporter.assert(
    replayabilityDoc.includes(`database/supabase/migrations/${fileName}`),
    `Legacy replayability debt must be documented: ${fileName}`,
  );
}

function assertReplayableMerchantMobileMigration(fileName) {
  const file = `database/supabase/migrations/${fileName}`;
  reporter.assert(exists(file), `Missing merchant-mobile V2 migration: ${file}`);
  const sql = stripSqlComments(readFile(file));

  const replayabilityPatterns = [
    { pattern: /\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/i, message: "CREATE TABLE must use IF NOT EXISTS" },
    { pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/i, message: "CREATE INDEX must use IF NOT EXISTS" },
    { pattern: /\bALTER\s+TABLE\b[\s\S]*?\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/i, message: "ADD COLUMN must use IF NOT EXISTS" },
  ];
  for (const { pattern, message } of replayabilityPatterns) {
    reporter.assert(!pattern.test(sql), `${file}: ${message}`);
  }

  if (/\bCREATE\s+POLICY\b/i.test(sql)) {
    reporter.assert(/\bDROP\s+POLICY\s+IF\s+EXISTS\b/i.test(sql), `${file}: policies must be dropped with IF EXISTS before recreation`);
  }

  if (/\bCREATE\s+TRIGGER\b/i.test(sql)) {
    reporter.assert(/\bDROP\s+TRIGGER\s+IF\s+EXISTS\b/i.test(sql), `${file}: triggers must be dropped with IF EXISTS before recreation`);
  }
}

for (const fileName of merchantMobileV2Migrations) {
  assertReplayableMerchantMobileMigration(fileName);
}

reporter.assert(exists("database/supabase/config.toml"), "Canonical Supabase config must live under database/supabase/config.toml");
reporter.assert(exists("database/supabase/migrations/000_baseline.sql"), "Canonical Supabase migration root must include database/supabase/migrations/000_baseline.sql");
reporter.assert(!exists("supabase/config.toml"), "Root supabase/config.toml is retired; archive duplicate configs under docs/archive instead");
reporter.assert(!exists("supabase/migrations"), "Root supabase/migrations is forbidden; migrations live under database/supabase/migrations");

const partitionMigration = readFile("database/supabase/migrations/079_partition_worker_request_logs.sql");
const partitionDriver = readFile("scripts/migration/run-hot-table-partition-maintenance.mjs");
const partitionWorkflow = readFile(".github/workflows/hot-table-partition-maintenance.yml");

for (const fragment of [
  "public.ensure_next_hot_table_partitions",
  "public.detach_expired_hot_table_partitions",
  "configure the external scheduler",
]) {
  reporter.assert(partitionMigration.includes(fragment), `Partition lifecycle migration missing fragment: ${fragment}`);
}

for (const fragment of [
  "ensure_next_hot_table_partitions(${monthsAhead})",
  "detach_expired_hot_table_partitions()",
  "spawnSync(",
  "\"psql\"",
  "PGPASSWORD",
  "SUPABASE_DB_URL",
  "PRODUCTION_DB_CONNECTION_STRING",
]) {
  reporter.assert(partitionDriver.includes(fragment), `Partition maintenance driver missing fragment: ${fragment}`);
}

for (const fragment of [
  "cron: \"15 2 1 * *\"",
  "production-migrations",
  "STAGING_DB_CONNECTION_STRING",
  "PRODUCTION_DB_CONNECTION_STRING",
  "run-hot-table-partition-maintenance.mjs",
  "--months-ahead=3",
]) {
  reporter.assert(partitionWorkflow.includes(fragment), `Partition maintenance workflow missing fragment: ${fragment}`);
}

const orchestration = readFile("infrastructure/deployment/migration-orchestration.yaml");
for (const fragment of [
  "run SQL dry run against staging branch",
  "backup: require-pitr-checkpoint-before-apply",
  "rollbackManifest",
  "transactional outbox compatibility recorded",
  "production readiness gate run recorded",
  "strategy: forward-fix-preferred",
]) {
  reporter.assert(orchestration.includes(fragment), `Migration orchestration must define safety fragment: ${fragment}`);
}

const customDomainMigration = readFile("database/supabase/migrations/090_custom_domains_and_store_access.sql");
const baseline = readFile("database/supabase/migrations/000_baseline.sql");
for (const fragment of [
  "custom_domain_status text DEFAULT 'none'",
  "access_mode text NOT NULL DEFAULT 'public'",
  "access_password_hash text",
  "published boolean NOT NULL DEFAULT false",
  "CREATE TABLE IF NOT EXISTS public.site_preview_links",
  "site_preview_links_jti_key UNIQUE",
  "CREATE TABLE IF NOT EXISTS public.site_gate_attempts",
  "CREATE TABLE IF NOT EXISTS public.site_domain_reviews",
  "CREATE TABLE IF NOT EXISTS public.domain_orders",
  "'review'::text",
  "EXECUTE FUNCTION public.update_updated_at()",
  "ALTER TABLE public.site_preview_links ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.site_gate_attempts ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.site_domain_reviews ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.domain_orders ENABLE ROW LEVEL SECURITY",
]) {
  reporter.assert(customDomainMigration.includes(fragment), `Custom domain/store access migration missing fragment: ${fragment}`);
}

for (const fragment of [
  "custom_domain_status text DEFAULT 'none'::text",
  "access_mode text DEFAULT 'public'::text NOT NULL",
  "access_password_hash text",
  "published boolean DEFAULT false NOT NULL",
  "CREATE TABLE public.site_preview_links",
  "CREATE TABLE public.site_gate_attempts",
  "CREATE TABLE public.site_domain_reviews",
  "CREATE TABLE public.domain_orders",
  "'review'::text",
  "sites_custom_domain_unique",
  "ALTER TABLE public.site_preview_links ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.site_gate_attempts ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.site_domain_reviews ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.domain_orders ENABLE ROW LEVEL SECURITY",
]) {
  reporter.assert(baseline.includes(fragment), `Baseline schema missing custom domain/store access fragment: ${fragment}`);
}

reporter.finish("Supabase migration history checked for destructive replay hazards");
