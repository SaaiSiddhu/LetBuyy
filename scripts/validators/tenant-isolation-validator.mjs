import fs from 'node:fs';
import path from 'node:path';
import {
  createReporter,
  getTrackedFiles,
  readFile,
} from './governance-common.mjs';
import {
  deriveTenantTablesFromMigrations,
  parseCommittedRegistry,
  registryPath,
  root,
} from '../governance/tenant-registry-common.mjs';

const reporter = createReporter('Tenant isolation validator');

function stableEntry(entry) {
  return {
    table: entry.table,
    scopeColumns: [...entry.scopeColumns].sort(),
    tenantColumn: entry.tenantColumn,
    ownerColumns: [...entry.ownerColumns].sort(),
    sourceFiles: [...entry.sourceFiles].sort(),
  };
}

const expected = deriveTenantTablesFromMigrations().map(stableEntry);
const committed = parseCommittedRegistry(readFile(registryPath)).map(stableEntry);
reporter.assert(
  JSON.stringify(committed) === JSON.stringify(expected),
  `${registryPath} must match schema-derived tenant table registry; run scripts/generators/generate-tenant-table-registry.mjs`,
);

const tenantTableByName = new Map(committed.map((entry) => [entry.table, entry]));
reporter.assert(
  tenantTableByName.size === committed.length,
  `${registryPath} must not contain duplicate table entries`,
);

function sourceFiles() {
  return getTrackedFiles()
    .filter((file) => file.startsWith('services/api-gateway/src/'))
    .filter((file) => file.endsWith('.ts'))
    .filter((file) => !file.includes('/__tests__/'))
    .filter((file) => file !== registryPath);
}

const supabaseSource = readFile('services/api-gateway/src/lib/supabase.ts');
reporter.assert(
  supabaseSource.includes('createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))'),
  'getSupabaseAdminFromEnv must wrap service-role clients with createTenantGuardedSupabaseClient',
);

const authSource = readFile('services/api-gateway/src/middleware/auth.ts');
const rbacSource = readFile('services/api-gateway/src/middleware/rbac.ts');
const verifierRegistrySource = readFile('services/api-gateway/src/identity-foundation/auth-verifier-registry.ts');
reporter.assert(
  !authSource.includes('admin-web@letbuyy.local') && !authSource.includes("name: 'admin-web-token'"),
  'auth middleware must not synthesize a static admin-web super-admin principal',
);
reporter.assert(
  !rbacSource.includes('isPlatformConsoleTokenRequest') && !verifierRegistrySource.includes('admin-web-token'),
  'RBAC/verifier registry must not preserve admin-web token god-mode bypasses',
);
reporter.assert(
  rbacSource.includes('Roles are resolved from server-side persistence') && !rbacSource.includes('const userRole = auth.user.role'),
  'requireRole must resolve roles from server-side persistence instead of JWT metadata',
);

const directBypassPattern = /getSupabaseAdmin\([^)]*\)\s*\.from\(\s*['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]\s*\)/g;
// PLATFORM-OWNED tables that appear in the tenant registry because they carry a site_id, but which
// tenant roles are explicitly REVOKED from (migration 223, D-8). The rule below assumes a
// tenant-scoped client is the correct accessor and that the admin client bypasses it. For these
// tables that premise does not hold: there is no tenant-scoped access to bypass, because app_tenant,
// authenticated and anon have no privileges on them at all. The admin client is the ONLY correct
// accessor, so flagging it would push the next author toward a tenant-scoped client that cannot
// work, or toward restructuring the call to dodge the regex -- which is worse than either.
//
// Add to this list ONLY when a migration REVOKEs the table from app_tenant. A table a tenant can read
// belongs under the rule, not here.
const violations = [];

const platformOwnedRevokedFromTenants = new Set([
  'buyer_store_customers',
  // 229 REVOKEs seller_follows from app_tenant, authenticated and anon, and grants only service_role.
  // Verified by execution against a real database: as app_tenant with the tenant GUC set, and as
  // anon, both SELECT and write return 'permission denied for table seller_follows'.
  'seller_follows',
]);

// The list above is a claim about the schema, so it is CHECKED rather than trusted: an entry whose
// migration does not actually REVOKE it from app_tenant would be a standing exemption for a table a
// tenant CAN read, which is the exact thing this validator exists to prevent. A future author who
// adds a name here without the REVOKE gets a failure naming their own entry.
const migrationsSource = fs
  .readdirSync(path.join(root, 'database/supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .map((name) => fs.readFileSync(path.join(root, 'database/supabase/migrations', name), 'utf8'))
  .join('\n');

for (const table of platformOwnedRevokedFromTenants) {
  const revoked = new RegExp(
    `REVOKE\\s+ALL\\s+ON\\s+public\\.${table}\\s+FROM[^;]*\\bapp_tenant\\b`,
    'i',
  ).test(migrationsSource);
  if (!revoked) {
    violations.push(
      `scripts/validators/tenant-isolation-validator.mjs ${table} is exempted as platform-owned but no migration REVOKEs it from app_tenant`,
    );
  }
}

for (const file of sourceFiles()) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) continue;
  const source = fs.readFileSync(abs, 'utf8');
  let match;
  while ((match = directBypassPattern.exec(source))) {
    const table = match[1];
    const entry = tenantTableByName.get(table);
    if (!entry) continue;
    if (platformOwnedRevokedFromTenants.has(table)) continue;
    // An access that carries a registered OWNER predicate is SCOPED, and the runtime tenant guard
    // accepts it for exactly that reason. tenantScoped() cannot serve these: it takes a siteId and
    // returns rows for one tenant, whereas a platform-level owner read (a buyer's own support
    // tickets, which span sites and may have no site_id at all) is scoped by the owner instead.
    // Flagging it would push the next author toward a tenant-scoped client that cannot express the
    // query, or toward restructuring the call to dodge this regex -- which this file already says is
    // worse than either.
    //
    // The window ends at the NEXT .from( so a neighbouring query's predicate can never satisfy this
    // one: a fixed-size window is the same defect in the opposite direction.
    const after = source.slice(match.index + match[0].length);
    const nextFrom = after.indexOf('.from(');
    const statement = nextFrom === -1 ? after : after.slice(0, nextFrom);
    const ownerScoped = (entry.ownerColumns || []).some((column) =>
      new RegExp(`\\.eq\\(\\s*['"\`]${column}['"\`]`).test(statement),
    );
    if (ownerScoped) continue;

    // An INSERT or UPSERT that NAMES its owner in the payload has no scope to bypass: it writes the
    // row it names rather than selecting rows it was not entitled to. The runtime guard agrees —
    // probing it shows an insert passes while an unscoped SELECT on the same table is refused — so
    // flagging this would report a write as if it were an unscoped read. Both halves are required:
    // a write, AND the owner column present as a payload key.
    const writesOwnedRow = /\.(insert|upsert)\s*\(/.test(statement)
      && (entry.ownerColumns || []).some((column) => new RegExp(`\\b${column}\\s*:`).test(statement));
    if (writesOwnedRow) continue;

    const line = source.slice(0, match.index).split('\n').length;
    violations.push(`${file}:${line} ${table} bypasses guarded tenantScoped/service client`);
  }
}

for (const violation of violations.slice(0, 80)) {
  reporter.assert(false, violation);
}
if (violations.length > 80) {
  reporter.assert(false, `...and ${violations.length - 80} more tenant access violations`);
}

reporter.finish(`${committed.length} tenant tables registered; ${violations.length} direct service-role bypasses found`);
