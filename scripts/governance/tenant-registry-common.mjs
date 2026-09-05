import fs from 'node:fs';
import path from 'node:path';

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
export const registryPath = 'services/api-gateway/src/tenant/tenant-tables.registry.ts';
export const migrationDir = 'database/supabase/migrations';

const OWNER_COLUMNS = [
  'custom_user_id',
  'user_id',
  'owner_id',
  'developer_id',
  'partner_id',
  // The platform buyer realm (D-8, migration 223) postdates this list. A row keyed by
  // buyer_account_id is OWNED by that buyer, so a query predicated on it is properly scoped — the
  // buyer's own rows, and no one else's. Without this, seller_follows and buyer_store_customers were
  // registered with site_id as their only scope column, and every legitimately cross-site buyer read
  // ("who do I follow", "my return requests") was rejected by the tenant query guard at runtime.
  // Both were proven rejected by executing the real query shapes through the real guard.
  'buyer_account_id',
  // support_tickets.requester_user_id: the requester OWNS their ticket, and a buyer's support
  // history spans sites (a platform-level ticket has no site_id at all), so scoping by site is not
  // available and not correct. Narrow by measurement: requester_user_id is declared in exactly one
  // migration and on exactly one table, so this widens support_tickets and nothing else.
  'requester_user_id',
];

function normalizeTableName(value) {
  return value.replace(/^public\./, '').replace(/"/g, '').trim();
}

function readMigrationFiles() {
  return fs.readdirSync(path.join(root, migrationDir))
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      file,
      source: fs.readFileSync(path.join(root, migrationDir, file), 'utf8'),
    }));
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
}

function ensureTable(map, name, sourceFile) {
  const tableName = normalizeTableName(name);
  if (!map.has(tableName)) {
    map.set(tableName, {
      table: tableName,
      tenantColumns: new Set(),
      ownerColumns: new Set(),
      sourceFiles: new Set(),
    });
  }
  map.get(tableName).sourceFiles.add(sourceFile);
  return map.get(tableName);
}

function addColumn(table, column) {
  if (column === 'site_id' || column === 'store_id') {
    table.tenantColumns.add(column);
    return;
  }
  if (OWNER_COLUMNS.includes(column)) {
    table.ownerColumns.add(column);
  }
}

function parseCreateTables(source, sourceFile, tables) {
  const createPattern = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?("?[a-zA-Z_][a-zA-Z0-9_]*"?)[\s\n]*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = createPattern.exec(source))) {
    const table = ensureTable(tables, match[1], sourceFile);
    const body = match[2];
    for (const line of body.split('\n')) {
      const columnMatch = line.trim().match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+/);
      if (!columnMatch) continue;
      const column = columnMatch[1].toLowerCase();
      if (['constraint', 'primary', 'unique', 'foreign', 'check', 'exclude'].includes(column)) continue;
      addColumn(table, column);
    }
  }
}

function parseAlterAddColumns(source, sourceFile, tables) {
  const alterPattern = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?("?[a-zA-Z_][a-zA-Z0-9_]*"?)([\s\S]*?);/gi;
  let match;
  while ((match = alterPattern.exec(source))) {
    const table = ensureTable(tables, match[1], sourceFile);
    const statement = match[2];
    const addPattern = /ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
    let addMatch;
    while ((addMatch = addPattern.exec(statement))) {
      addColumn(table, addMatch[1].toLowerCase());
    }
  }
}

export function deriveTenantTablesFromMigrations() {
  const tables = new Map();
  for (const { file, source } of readMigrationFiles()) {
    const stripped = stripSqlComments(source);
    parseCreateTables(stripped, file, tables);
    parseAlterAddColumns(stripped, file, tables);
  }

  return [...tables.values()]
    // A table is registered when it carries a TENANT column, or when it is BUYER-OWNED.
    //
    // The buyer clause is deliberately narrow. Relaxing this to any owner column was measured and
    // rejected: it would add 32 tables, among them sessions, verification_tokens, devices and
    // merchant_session_jti_consumptions, which are looked up by a globally-unique TOKEN with no
    // owner predicate. Guarding those would refuse legitimate lookups — the documented shape
    // getSupabaseAdminUnguarded exists for — so widening there would create pressure to bypass the
    // guard, which is worse than not guarding them.
    //
    // buyer_account_id is different: every buyer-owned table is read by its owner and by nobody
    // else, so the predicate the guard demands is one those queries already carry. Registering them
    // means a route that forgets it fails loudly instead of returning every buyer's rows.
    .filter((table) => table.table === 'sites'
      || table.tenantColumns.size > 0
      || table.ownerColumns.has('buyer_account_id'))
    .map((table) => {
      const tenantColumns = [...table.tenantColumns].sort();
      const ownerColumns = [...table.ownerColumns].sort();
      return {
        table: table.table,
        scopeColumns: [...tenantColumns, ...ownerColumns],
        tenantColumn: tenantColumns.includes('site_id') ? 'site_id' : tenantColumns[0] || null,
        ownerColumns,
        sourceFiles: [...table.sourceFiles].sort(),
      };
    })
    .sort((a, b) => a.table.localeCompare(b.table));
}

export function registrySource(entries) {
  const generatedAt = new Date().toISOString();
  return [
    `// GENERATED by scripts/generators/generate-tenant-table-registry.mjs at ${generatedAt}.`,
    '// Do not hand-edit. Run the generator after schema tenant ownership changes.',
    '',
    'export type TenantTableScopeColumn = \'site_id\' | \'store_id\' | \'custom_user_id\' | \'user_id\' | \'owner_id\' | \'developer_id\' | \'partner_id\' | \'buyer_account_id\' | \'requester_user_id\';',
    '',
    'export interface TenantTableRegistryEntry {',
    '  readonly table: string;',
    '  readonly scopeColumns: readonly TenantTableScopeColumn[];',
    '  readonly tenantColumn: TenantTableScopeColumn | null;',
    '  readonly ownerColumns: readonly TenantTableScopeColumn[];',
    '  readonly sourceFiles: readonly string[];',
    '}',
    '',
    `export const TENANT_TABLES = ${JSON.stringify(entries, null, 2)} as const satisfies readonly TenantTableRegistryEntry[];`,
    '',
    'export const TENANT_TABLE_NAMES = TENANT_TABLES.map((entry) => entry.table);',
    'export const TENANT_TABLE_BY_NAME: ReadonlyMap<string, TenantTableRegistryEntry> = new Map(TENANT_TABLES.map((entry) => [entry.table, entry]));',
    '',
    'export function tenantTableRegistryEntry(table: string): TenantTableRegistryEntry | null {',
    '  return TENANT_TABLE_BY_NAME.get(table) || null;',
    '}',
    '',
  ].join('\n');
}

export function parseCommittedRegistry(source) {
  const match = source.match(/export const TENANT_TABLES = ([\s\S]*?) as const satisfies/);
  if (!match) throw new Error('TENANT_TABLES literal not found');
  return JSON.parse(match[1]);
}
