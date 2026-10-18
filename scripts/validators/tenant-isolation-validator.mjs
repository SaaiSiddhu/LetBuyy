import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {directTenantQueries} from '../governance/tenant-query-scope.mjs';
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
  // 255 REVOKEs buyer_order_links from app_tenant, authenticated and anon, and grants only
  // service_role: order ownership is a stable cross-store buyer id, the same privacy class as the store
  // link. Verified by execution (tests/executable/buyer-verified-ownership-postgres.test.mjs): as
  // app_tenant with the tenant GUC set, as authenticated and as anon, SELECT is permission denied.
  'buyer_order_links',
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

// The runtime client is guarded. Check the real expression chain and contextual
// write type, including tenant columns and delegated typed payloads. A fixed text
// window could borrow another query's owner predicate and missed legitimate stores.
const configPath=path.join(root,'services/api-gateway/tsconfig.json');
const config=ts.readConfigFile(configPath,ts.sys.readFile);
if(config.error)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath));
const program=ts.createProgram({rootNames:parsed.fileNames,options:{...parsed.options,noEmit:true}});
const checker=program.getTypeChecker();
for (const file of sourceFiles()) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) continue;
  const sourceFile=program.getSourceFile(abs);
  if(!sourceFile)throw new Error(`${file}: source is absent from the Gateway TypeScript programme`);
  for(const query of directTenantQueries(sourceFile,checker,tenantTableByName)) {
    const table=query.table;
    if (platformOwnedRevokedFromTenants.has(table)) continue;
    if(query.scoped)continue;
    const line=sourceFile.getLineAndCharacterOfPosition(query.start).line+1;
    violations.push(`${file}:${line} ${table} has an unproven scope on its direct guarded-client expression`);
  }
}

for (const violation of violations.slice(0, 80)) {
  reporter.assert(false, violation);
}
if (violations.length > 80) {
  reporter.assert(false, `...and ${violations.length - 80} more tenant access violations`);
}

reporter.finish(`${committed.length} tenant tables registered; ${violations.length} direct service-role bypasses found`);
