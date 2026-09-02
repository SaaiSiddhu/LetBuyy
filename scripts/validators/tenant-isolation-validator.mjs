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
const violations = [];

for (const file of sourceFiles()) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) continue;
  const source = fs.readFileSync(abs, 'utf8');
  let match;
  while ((match = directBypassPattern.exec(source))) {
    const table = match[1];
    const entry = tenantTableByName.get(table);
    if (!entry) continue;
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
