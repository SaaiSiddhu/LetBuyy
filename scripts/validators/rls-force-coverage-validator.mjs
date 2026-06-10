import {
  assertNoOffenders,
  lineNumberForIndex,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter, readFile } from "./governance-common.mjs";

const reporter = createReporter("RLS FORCE coverage validator");

const registry = readFile("services/api-gateway/src/tenant/tenant-tables.registry.ts");
const d4Migration = readFile("database/supabase/migrations/164_d4_tenant_role_guc.sql");
reporter.assert(registry.includes("TENANT_TABLES"), "tenant table registry must exist before RLS FORCE coverage can be enforced");
reporter.assert(
  /FORCE\s+ROW\s+LEVEL\s+SECURITY/i.test(readFile("database/supabase/migrations/155_storefront_session_analytics.sql")),
  "RLS FORCE coverage must have at least one additive FORCE migration proof",
);
reporter.assert(
  /CREATE ROLE app_tenant NOLOGIN NOBYPASSRLS/i.test(d4Migration)
    && /FORCE ROW LEVEL SECURITY/i.test(d4Migration)
    && /TO app_tenant USING/i.test(d4Migration)
    && /public\.current_site_id\(\)/i.test(d4Migration),
  "D4 must install app_tenant FORCE RLS policies that read the tenant GUC",
);

const offenders = [];
for (const entry of phaseBEntries(["database"], { filePattern: /\.sql$/ })) {
  if (!entry.extra) continue;
  for (const match of entry.text.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-zA-Z_][a-zA-Z0-9_]*)[\s\S]*?;/gi)) {
    const block = match[0];
    const table = match[1];
    if (!/\b(site_id|store_id|custom_user_id|owner_id|developer_id|partner_id)\b/i.test(block)) continue;

    const forcePattern = new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?public\\.${table}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i");
    if (!forcePattern.test(entry.text)) {
      offenders.push(`${entry.path}:${lineNumberForIndex(entry.text, match.index || 0)} tenant table ${table} lacks FORCE ROW LEVEL SECURITY in the same migration`);
    }
  }
}

assertNoOffenders(reporter, offenders, "New tenant tables must add FORCE ROW LEVEL SECURITY with their DDL");
reporter.finish("RLS FORCE coverage ratchet checked");
