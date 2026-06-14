#!/usr/bin/env node
// LetBuyy Database Intelligence — extracts the data layer Graphify's tree-sitter misses.
// Parses database/supabase/migrations/*.sql (tables, functions/RPCs, policies, triggers,
// indexes, RLS) + the gateway's db.rpc(...) call sites, and derives the chains:
//   route -> RPC -> table  ·  table -> {policies,triggers,indexes,RLS,tenant}  ·  money/tenant flow.
// Output: graphify-out/db-intel.json  (run: pnpm graph:db)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIG = join(ROOT, 'database/supabase/migrations');
const OUT = join(ROOT, 'graphify-out');

const MONEY_TABLES = new Set(['payment_transactions','payments','payout_statements','payouts','refund_transactions','refunds','cod_reconciliation_entries','settlements','wallet_ledger_entries','partner_payout_ledger_entries','gift_card_accounts','gift_card_ledger_entries','gift_card_redemptions','ledger_transactions','ledger_entries','orders','order_items','ai_credits']);

function migFiles() {
  return readdirSync(MIG).filter((f) => /\.sql$/.test(f)).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
}
function migNum(f) { const m = f.match(/^(\d+)/); return m ? +m[1] : 0; }

export function buildDbIntel() {
  const files = migFiles();
  const tables = new Map();      // name -> {name, createdIn, columns:Set, hasSiteId, hasStoreId, rls:false, force:false, policies:[], triggers:[], indexes:0}
  const functions = new Map();   // name -> {name, definedIn, securityDefiner, args, touches:Set, hasIdempotency, latest migration}
  const policies = [];           // {name, table, public, usesSiteId, serviceRole}
  const triggers = [];           // {name, table}
  let indexCount = 0;

  const tableOf = (raw) => (raw || '').replace(/^public\./, '').replace(/["']/g, '');

  for (const f of files) {
    const sql = readFileSync(join(MIG, f), 'utf8');
    const n = migNum(f);

    // tables (+ columns for tenant detection)
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g)) {
      const name = tableOf(m[1]); if (tables.has(name)) continue;
      const cols = [...m[2].matchAll(/^\s{2,4}(\w+)\s+/gm)].map((c) => c[1]);
      tables.set(name, { name, createdIn: f, columns: cols.length, hasSiteId: /\bsite_id\b/.test(m[2]), hasStoreId: /\bstore_id\b/.test(m[2]), rls: false, force: false, policies: [], triggers: [], indexes: 0 });
    }
    // RLS enable/force
    for (const m of sql.matchAll(/ALTER TABLE (?:ONLY )?(?:public\.)?(\w+)\s+(ENABLE|FORCE) ROW LEVEL SECURITY/g)) {
      const t = tables.get(tableOf(m[1])); if (t) { if (m[2] === 'ENABLE') t.rls = true; else t.force = true; }
    }
    // policies
    for (const m of sql.matchAll(/CREATE POLICY (\w+)\s+ON (?:public\.)?(\w+)([\s\S]*?);/g)) {
      const table = tableOf(m[2]); const body = m[3];
      const pol = { name: m[1], table, public: /USING\s*\(\s*true\s*\)/i.test(body) && !/service_role/.test(body), usesSiteId: /site_id/.test(body), serviceRole: /service_role/.test(body) };
      policies.push(pol); const t = tables.get(table); if (t) t.policies.push(pol.name);
    }
    // triggers
    for (const m of sql.matchAll(/CREATE TRIGGER (\w+)[\s\S]*?ON (?:public\.)?(\w+)/g)) {
      const table = tableOf(m[2]); triggers.push({ name: m[1], table }); const t = tables.get(table); if (t) t.triggers.push(m[1]);
    }
    // indexes
    for (const m of sql.matchAll(/CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?\w+\s+ON (?:public\.)?(\w+)/g)) {
      indexCount++; const t = tables.get(tableOf(m[1])); if (t) t.indexes++;
    }
    // functions (latest definition wins)
    for (const m of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s+RETURNS([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/g)) {
      const name = m[1], header = m[3], body = m[4];
      const touches = new Set();
      for (const t of body.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM|JOIN)\s+(?:public\.)?(\w+)/g)) { const tn = tableOf(t[1]); if (tables.has(tn)) touches.add(tn); }
      functions.set(name, { name, definedIn: f, securityDefiner: /SECURITY DEFINER/.test(header), args: (m[2].match(/p_\w+/g) || []).length, touches, hasIdempotency: /idempotency_key/.test(body), forUpdate: /FOR UPDATE/.test(body), money: [...touches].some((t) => MONEY_TABLES.has(t)) });
    }
  }

  // route -> rpc call sites (gateway)
  const routeRpc = {}; // routeFile -> Set(rpc)
  const rpcCallers = {}; // rpc -> Set(routeFile)
  function scanDir(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) scanDir(p);
      else if (/\.ts$/.test(e.name)) {
        const src = readFileSync(p, 'utf8'); const rel = p.replace(ROOT + '/', '');
        for (const m of src.matchAll(/\.rpc\(\s*['"](\w+)['"]/g)) {
          const rpc = m[1]; (routeRpc[rel] || (routeRpc[rel] = new Set())).add(rpc); (rpcCallers[rpc] || (rpcCallers[rpc] = new Set())).add(rel);
        }
      }
    }
  }
  for (const d of ['services/api-gateway/src/routes', 'services/api-gateway/src/execution', 'services/queue-workers/src']) {
    const full = join(ROOT, d); if (existsSync(full)) scanDir(full);
  }

  // derived: route -> tables (transitive via rpc)
  const routeTables = {};
  for (const [route, rpcs] of Object.entries(routeRpc)) {
    const ts = new Set();
    for (const rpc of rpcs) { const fn = functions.get(rpc); if (fn) for (const t of fn.touches) ts.add(t); }
    routeTables[route] = [...ts];
  }

  const tableArr = [...tables.values()].map((t) => ({ ...t, columns: t.columns, money: MONEY_TABLES.has(t.name), tenant: t.hasSiteId || t.hasStoreId }));
  const fnArr = [...functions.values()].map((f) => ({ ...f, touches: [...f.touches], callers: [...(rpcCallers[f.name] || [])] }));

  const summary = {
    tables: tableArr.length,
    functions: fnArr.length,
    rpcsCalledByGateway: Object.keys(rpcCallers).length,
    rpcsUncalled: fnArr.filter((f) => !rpcCallers[f.name]).length,
    securityDefiner: fnArr.filter((f) => f.securityDefiner).length,
    moneyFunctions: fnArr.filter((f) => f.money).length,
    policies: policies.length,
    publicPolicies: policies.filter((p) => p.public).length,
    triggers: triggers.length,
    indexes: indexCount,
    rlsTables: tableArr.filter((t) => t.rls).length,
    forceRlsTables: tableArr.filter((t) => t.force).length,
    tenantTables: tableArr.filter((t) => t.tenant).length,
    tenantTablesWithoutRls: tableArr.filter((t) => t.tenant && !t.rls).map((t) => t.name),
    moneyTablesPresent: tableArr.filter((t) => t.money).map((t) => t.name),
    migrationFiles: files.length,
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
  return { summary, tables: tableArr, functions: fnArr, policies, triggers, routeRpc: Object.fromEntries(Object.entries(routeRpc).map(([k, v]) => [k, [...v]])), rpcCallers: Object.fromEntries(Object.entries(rpcCallers).map(([k, v]) => [k, [...v]])), routeTables };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildDbIntel();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'db-intel.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLetBuyy Database Intelligence');
  console.log(`  tables ${s.tables} · functions ${s.functions} (SECURITY DEFINER ${s.securityDefiner}, money ${s.moneyFunctions})`);
  console.log(`  RPCs called by gateway ${s.rpcsCalledByGateway} · uncalled-by-gateway ${s.rpcsUncalled}`);
  console.log(`  policies ${s.policies} (public USING(true): ${s.publicPolicies}) · triggers ${s.triggers} · indexes ${s.indexes}`);
  console.log(`  RLS tables ${s.rlsTables} (FORCE ${s.forceRlsTables}) · tenant tables ${s.tenantTables}`);
  console.log(`  tenant tables WITHOUT rls: ${s.tenantTablesWithoutRls.length}${s.tenantTablesWithoutRls.length ? ' → ' + s.tenantTablesWithoutRls.slice(0, 8).join(', ') : ''}`);
  console.log(`  → graphify-out/db-intel.json\n`);
}
