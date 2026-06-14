#!/usr/bin/env node
// LCIS Genesis — Database Control Center (Phase 2). EXTENDS db-intel + relationship-intel + domain-intel
// with full bidirectional LINEAGE TRACING for any entity (table / rpc / route / migration):
//   table → policies/triggers/indexes/RPCs/routes/migration/FK-out/FK-in/workers/queues
//   rpc → tables/routes/definedIn   ·   route → rpcs/tables   ·   migration → tables
// Pure composition — reuses the existing engines; no new schema parse. Output: database-control-intel.json
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function buildDatabaseControl() {
  const db = g('db-intel.json'), rel = g('relationship-intel.json'), di = g('domain-intel.json');
  if (!db) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const summary = {
    tables: db.summary.tables, functions: db.summary.functions, policies: db.summary.policies,
    triggers: db.summary.triggers, indexes: db.summary.indexes, foreignKeys: rel?.summary.foreignKeys ?? null,
    migrations: db.summary.migrationFiles, tenantRoot: rel?.summary.tenantRoot ?? null,
    lineageEdges: ['table→rpc', 'rpc→table', 'route→rpc', 'rpc→route', 'worker→table', 'queue→table', 'migration→table', 'policy→table', 'trigger→table', 'index→table', 'fk(table↔table)'],
    explorers: ['schema', 'data (live)', 'tenant', 'rls', 'dependency', 'impact'],
    generatedAt: db.summary.generatedAt,
  };
  return { summary, note: 'Full lineage via lineage(entity). Data Explorer values are live Supabase rows (query-bound, NOT CONNECTED until wired).' };
}

// The single lineage entry point — auto-detects entity type.
export function lineage(entity) {
  const db = g('db-intel.json'), rel = g('relationship-intel.json'), di = g('domain-intel.json');
  if (!db) return { error: 'db-intel.json missing' };
  const e = (entity || '').trim();
  const table = db.tables.find((t) => t.name === e);
  const fn = db.functions.find((f) => f.name === e);
  const routeFile = Object.keys(db.routeRpc).find((r) => r === e || r.endsWith('/' + e + '.ts') || r.endsWith(e + '.ts'));
  const mig = /^\d/.test(e) ? e : null;

  if (table) {
    const r = rel?.tables.find((x) => x.name === e);
    const domain = di?.domains.find((d) => d.tables.includes(e));
    return {
      entity: e, type: 'table',
      schema: { columns: table.columns, rls: table.rls, force: table.force, tenant: table.tenant, money: table.money },
      policies: table.policies, triggers: table.triggers, indexes: table.indexes,
      touchedByRpcs: db.functions.filter((f) => f.touches.includes(e)).map((f) => f.name),
      reachedByRoutes: Object.entries(db.routeTables).filter(([, ts]) => ts.includes(e)).map(([rt]) => rt.replace('services/api-gateway/src/routes/', '')),
      createdInMigration: table.createdIn,
      fk: { references: r?.references || [], referencedBy: r?.referencedBy || [] },
      domain: domain?.key || null, workers: domain?.workers || [], queues: domain?.queues || [],
      dataExplorer: { source: 'Supabase REST/SQL (live)', value: 'NOT CONNECTED — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY' },
    };
  }
  if (fn) return { entity: e, type: 'rpc', tables: fn.touches, calledByRoutes: fn.callers.map((c) => c.replace('services/api-gateway/src/routes/', '')), definedIn: fn.definedIn, securityDefiner: fn.securityDefiner, money: fn.money, idempotency: fn.hasIdempotency, forUpdate: fn.forUpdate };
  if (routeFile) return { entity: e, type: 'route', file: routeFile, rpcs: db.routeRpc[routeFile], tables: db.routeTables[routeFile] || [] };
  if (mig) { const created = db.tables.filter((t) => t.createdIn && t.createdIn.startsWith(mig)).map((t) => t.name); return { entity: e, type: 'migration', tablesCreated: created }; }
  // fuzzy: maybe a partial table/rpc name
  const tFuzzy = db.tables.find((t) => t.name.includes(e)); if (tFuzzy) return lineage(tFuzzy.name);
  const fFuzzy = db.functions.find((f) => f.name.includes(e)); if (fFuzzy) return lineage(fFuzzy.name);
  return { entity: e, error: 'not found as table / rpc / route / migration', hint: 'try a table name (orders), an rpc (create_checkout_order), a route (checkout), or a migration number' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg && arg !== 'build') { console.log(JSON.stringify(lineage(arg), null, 2)); }
  else {
    const intel = buildDatabaseControl();
    if (intel.error) { console.error(intel.error); process.exit(1); }
    if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'database-control-intel.json'), JSON.stringify(intel));
    const s = intel.summary;
    console.log('\nLCIS Genesis — Database Control Center');
    console.log(`  ${s.tables} tables · ${s.functions} RPCs · ${s.policies} policies · ${s.triggers} triggers · ${s.foreignKeys} FKs`);
    console.log(`  lineage edges: ${s.lineageEdges.join(', ')}`);
    console.log('  → graphify-out/database-control-intel.json  (lineage: node database-control-intel.mjs orders)');
  }
}
