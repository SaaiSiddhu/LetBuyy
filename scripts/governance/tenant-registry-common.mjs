import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
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
  const name = value.trim();
  if (name.startsWith('"') && name.endsWith('"')) return name.slice(1, -1).replace(/""/g, '"');
  return name.replace(/^public\./i, '').toLowerCase();
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

// A bounded lexical pass keeps SQL data opaque while retaining identifier case.
// It is not a general SQL parser: only ordinary public/unqualified CREATE/ALTER
// TABLE declarations and the existing explicit partition helpers are derived.
function sqlTokens(source, doDepth = 0) {
  if (doDepth > 32) throw new Error('SQL DO nesting exceeds bounded parser depth');
  const tokens = [];
  const doBody = () => word(tokens.at(-1), 'do') || (word(tokens.at(-3), 'do') && word(tokens.at(-2), 'language') && identifier(tokens.at(-1)));
  let i = 0;
  while (i < source.length) {
    const start = i, char = source[i];
    if (/\s/.test(char)) { i++; continue; }
    if (source.startsWith('--', i)) {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (source.startsWith('/*', i)) {
      let depth = 1; i += 2;
      while (i < source.length && depth) {
        if (source.startsWith('/*', i)) { depth++; i += 2; }
        else if (source.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error('Unterminated SQL block comment');
      continue;
    }
    if (char === "'" || char === '"') {
      const identifier = char === '"';
      const previous = tokens.at(-1);
      const escaped = !identifier && previous?.kind === 'word' && previous.value === 'e' && previous.end === i;
      let value = '', closed = false; i++;
      while (i < source.length) {
        if (source[i] === char) {
          if (source[i + 1] === char) { value += char; i += 2; }
          else { i++; closed = true; break; }
        } else if (escaped && source[i] === '\\') {
          if (i + 1 >= source.length) break;
          value += source.slice(i, i + 2); i += 2;
        } else value += source[i++];
      }
      if (!closed) throw new Error(`Unterminated SQL ${identifier ? 'identifier' : 'literal'}`);
      if (!identifier && doBody()) {
        for (const token of sqlTokens(value, doDepth + 1)) tokens.push(token);
      } else tokens.push({ kind: identifier ? 'identifier' : 'literal', value, raw: source.slice(start, i), end: i });
      continue;
    }
    if (char === '$') {
      const delimiter = source.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        const end = source.indexOf(delimiter, i + delimiter.length);
        if (end < 0) throw new Error('Unterminated SQL dollar literal');
        i = end + delimiter.length;
        if (doBody()) {
          // Anonymous DO blocks execute during the migration. Inspect their
          // static SQL, while EXECUTE strings inside them remain opaque data.
          const bodyStart = start + delimiter.length;
          for (const token of sqlTokens(source.slice(bodyStart, end), doDepth + 1)) tokens.push(token);
        } else tokens.push({ kind: 'literal', value: '', raw: source.slice(start, i), end: i });
        continue;
      }
    }
    if (/[a-zA-Z_]/.test(char)) {
      while (i < source.length && /[a-zA-Z0-9_$]/.test(source[i])) i++;
      const raw = source.slice(start, i);
      tokens.push({ kind: 'word', value: raw.toLowerCase(), raw, end: i });
    } else {
      tokens.push({ kind: 'symbol', value: char, raw: char, end: ++i });
    }
  }
  return tokens;
}

const word = (token, value) => token?.kind === 'word' && token.value === value;
const identifier = token => token?.kind === 'word' || token?.kind === 'identifier';
const TABLE_CONSTRAINTS = new Set(['constraint', 'primary', 'unique', 'foreign', 'check', 'exclude', 'like']);

function tableIdentifier(tokens, start) {
  if (!identifier(tokens[start])) return null;
  if (tokens[start + 1]?.value === '.') {
    if (tokens[start].value !== 'public' || !identifier(tokens[start + 2])) return null;
    return { raw: tokens[start + 2].raw, next: start + 3 };
  }
  return { raw: tokens[start].raw, next: start + 1 };
}

function parseCreateTables(tokens, sourceFile, tables, partitions) {
  for (let i = 0; i < tokens.length; i++) {
    if (!word(tokens[i], 'create') || !word(tokens[i + 1], 'table')) continue;
    let next = i + 2;
    if (word(tokens[next], 'if') && word(tokens[next + 1], 'not') && word(tokens[next + 2], 'exists')) next += 3;
    const name = tableIdentifier(tokens, next);
    if (!name) continue;
    next = name.next;
    if (word(tokens[next], 'partition') && word(tokens[next + 1], 'of')) {
      const parent = tableIdentifier(tokens, next + 2);
      if (parent) partitions.set(normalizeTableName(name.raw), { parent: normalizeTableName(parent.raw), file: sourceFile });
      continue;
    }
    if (tokens[next]?.value !== '(') continue;
    const table = ensureTable(tables, name.raw, sourceFile);
    let round = 0, square = 0, entry = [], closed = false;
    const column = () => {
      const first = entry[0];
      if (identifier(first) && identifier(entry[1]) && !(first.kind === 'word' && TABLE_CONSTRAINTS.has(first.value))) addColumn(table, first.value);
      entry = [];
    };
    for (let j = next + 1; j < tokens.length; j++) {
      const token = tokens[j];
      // Literal punctuation is data, including commas/parentheses/dollar bodies.
      if (token.kind !== 'symbol') { entry.push(token); continue; }
      if (token.value === ')' && round === 0 && square === 0) { column(); i = j; closed = true; break; }
      if (token.value === ',' && round === 0 && square === 0) { column(); continue; }
      if (token.value === ';' && round === 0 && square === 0) break;
      if (token.value === '(') round++;
      else if (token.value === ')') round--;
      else if (token.value === '[') square++;
      else if (token.value === ']') square--;
      if (round < 0 || square < 0) throw new Error(`${sourceFile}: unbalanced CREATE TABLE columns`);
      entry.push(token);
    }
    if (!closed) throw new Error(`${sourceFile}: unclosed CREATE TABLE columns`);
  }
}

function parseAlterAddColumns(tokens, sourceFile, tables) {
  for (let i = 0; i < tokens.length; i++) {
    if (!word(tokens[i], 'alter') || !word(tokens[i + 1], 'table')) continue;
    let next = i + 2;
    if (word(tokens[next], 'if') && word(tokens[next + 1], 'exists')) next += 2;
    if (word(tokens[next], 'only')) next++;
    const name = tableIdentifier(tokens, next);
    if (!name) continue;
    const table = ensureTable(tables, name.raw, sourceFile);
    let depth = 0;
    for (let j = name.next; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.kind === 'symbol') {
        if (token.value === ';' && depth === 0) break;
        if (token.value === '(' || token.value === '[') depth++;
        if (token.value === ')' || token.value === ']') depth--;
      }
      if (depth !== 0 || !word(token, 'add')) continue;
      let at = j + 1;
      if (word(tokens[at], 'column')) at++;
      if (word(tokens[at], 'if') && word(tokens[at + 1], 'not') && word(tokens[at + 2], 'exists')) at += 3;
      if (identifier(tokens[at]) && identifier(tokens[at + 1]) && !(tokens[at].kind === 'word' && TABLE_CONSTRAINTS.has(tokens[at].value))) addColumn(table, tokens[at].value);
    }
  }
}

export function deriveTenantTablesFromMigrations(migrations = readMigrationFiles()) {
  const tables = new Map();
  const partitions = new Map();
  const shadows = new Map();
  for (const { file, source } of migrations) {
    const tokens = sqlTokens(source);
    parseCreateTables(tokens, file, tables, partitions);
    parseAlterAddColumns(tokens, file, tables);
    // Only actual literal helper calls seed known partitions. SQL contained
    // in a default, dynamic EXECUTE string or comment cannot declare a table.
    for (let i = 0; i < tokens.length; i++) {
      if (!word(tokens[i], 'select') || !word(tokens[i + 1], 'public') || tokens[i + 2]?.value !== '.'
          || !word(tokens[i + 3], 'upsert_retention_policy') || tokens[i + 4]?.value !== '(') continue;
      const target = tokens[i + 5], shadow = tokens[i + 7];
      if (target?.kind === 'literal' && shadow?.kind === 'literal' && tokens[i + 6]?.value === ','
          && /^[a-z0-9_]+$/.test(target.value) && /^[a-z0-9_]+$/.test(shadow.value)) shadows.set(target.value, shadow.value);
    }
    for (let i = 0; i < tokens.length; i++) {
      if (!word(tokens[i], 'select') || !word(tokens[i + 1], 'public') || tokens[i + 2]?.value !== '.'
          || !word(tokens[i + 3], 'ensure_monthly_hot_table_partition') || tokens[i + 4]?.value !== '(') continue;
      const target = tokens[i + 5], date = tokens[i + 8];
      if (target?.kind !== 'literal' || !/^[a-z0-9_]+$/.test(target.value) || tokens[i + 6]?.value !== ','
          || !word(tokens[i + 7], 'date') || date?.kind !== 'literal' || !/^\d{4}-\d{2}-\d{2}$/.test(date.value)
          || tokens[i + 9]?.value !== ')') continue;
      const parent = shadows.get(target.value);
      if (!parent) throw new Error(`${file}: seeded partition has no declared retention shadow for ${target.value}`);
      partitions.set(`${parent}_${date.value.slice(0, 7).replace('-', '_')}`, { parent, file });
    }
  }
  for (const [name, { parent, file }] of partitions) {
    const inherited = tables.get(parent);
    if (!inherited) throw new Error(`${file}: partition ${name} has no declared parent ${parent}`);
    const table = ensureTable(tables, name, file);
    for (const column of inherited.tenantColumns) table.tenantColumns.add(column);
    for (const column of inherited.ownerColumns) table.ownerColumns.add(column);
    for (const source of inherited.sourceFiles) table.sourceFiles.add(source);
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
