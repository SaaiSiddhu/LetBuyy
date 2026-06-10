import {
  assertNoOffenders,
  phaseBEntries,
  pushRegexOffenders,
} from "./phase-b-common.mjs";
import { createReporter, readFile } from "./governance-common.mjs";

const reporter = createReporter("No blanket service-role validator");

const supabaseSource = readFile("services/api-gateway/src/lib/supabase.ts");
const tenantTransactionSource = readFile("services/api-gateway/src/lib/tenant-transaction.ts");
reporter.assert(
  supabaseSource.includes("createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))"),
  "api-gateway service-role clients must be wrapped by the tenant guard",
);
reporter.assert(
  tenantTransactionSource.includes("SET LOCAL ROLE app_tenant")
    && tenantTransactionSource.includes("tenantGucSetLocalStatement")
    && tenantTransactionSource.includes("refusing to fake SET LOCAL app.site_id over Supabase REST"),
  "api-gateway must provide a real app_tenant SET LOCAL transaction helper and refuse fake REST transactions",
);

const allowedInfrastructureAdapters = new Set([
  "packages/infrastructure/supabase-adapter/index.ts",
]);

const offenders = [];
for (const entry of phaseBEntries(["apps", "services", "packages"])) {
  if (allowedInfrastructureAdapters.has(entry.path) && !entry.extra) continue;
  if (entry.path.startsWith("services/api-gateway/src/lib/supabase.ts") && !entry.extra) continue;
  if (entry.path.endsWith(".sql") && !entry.extra) continue;

  if (entry.path.startsWith("apps/") || entry.extra) {
    pushRegexOffenders(
      offenders,
      entry,
      /\bSUPABASE_SERVICE_ROLE_KEY\b|service_role\b|createSupabaseServiceClient\s*\(/g,
      () => "app/runtime code must not use blanket service-role credentials",
    );
  }
}

assertNoOffenders(reporter, offenders, "Blanket service-role access is forbidden outside audited adapters");
reporter.finish("service-role boundary checked");
