#!/usr/bin/env node
// LetBuyy Payment Intelligence (LCIS v3, Phase 6) — traces every money sub-flow
// (COD, Razorpay, Refunds, Payouts, Gift Cards, GST, Settlement, Commission) over
// db-intel.json + domain-intel.json. Repository truth: all RPCs/tables are extracted,
// none invented. "What breaks if payment changes" = cross-domain blast on Payments.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blastDomain } from './cross-domain-engine.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Each sub-flow is defined by the RPC-name / table-name signal it leaves in the schema.
const FLOWS = {
  cod:        { rpc: /cod|cash_on_delivery|reconcile_cod/, table: /cod_/ },
  razorpay:   { rpc: /razorpay|confirm_order_payment|attach_order_payment|record_order_payment/, table: /payment_(transactions|attempts|webhook|tokens|credentials)/ },
  refunds:    { rpc: /refund|return/, table: /refund|return/ },
  payouts:    { rpc: /payout|claim_payout|partner_payout/, table: /payout/ },
  giftCards:  { rpc: /gift_card/, table: /gift_card/ },
  gst:        { rpc: /tax|gst|invoice/, table: /tax|gst|invoice/ },
  settlement: { rpc: /settle|settlement/, table: /settlement/ },
  commission: { rpc: /commission/, table: /commission/ },
  ledger:     { rpc: /ledger|post_ledger|ensure_ledger|enforce_ledger/, table: /ledger/ },
};

export function buildPaymentIntel(db, di) {
  if (!db) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const fn = db.functions;
  const flows = {};
  for (const [name, sig] of Object.entries(FLOWS)) {
    const rpcs = fn.filter((f) => sig.rpc.test(f.name));
    const tables = db.tables.filter((t) => sig.table.test(t.name));
    flows[name] = {
      rpcs: rpcs.map((f) => ({ name: f.name, securityDefiner: f.securityDefiner, idempotency: f.hasIdempotency, forUpdate: f.forUpdate, money: f.money, tables: f.touches })),
      tables: tables.map((t) => t.name),
      integrity: rpcs.length ? {
        allSecurityDefiner: rpcs.every((f) => f.securityDefiner),
        idempotentCore: rpcs.filter((f) => f.money).every((f) => f.hasIdempotency),
        rowLockedCore: rpcs.filter((f) => f.money).every((f) => f.forUpdate),
      } : null,
    };
  }
  const moneyRpcs = fn.filter((f) => f.money);
  const impact = di ? blastDomain(di, 'payments') : null;
  return {
    summary: {
      moneyRpcs: moneyRpcs.length,
      moneyTables: db.summary.moneyTablesPresent.length,
      allMoneyRpcsSecurityDefiner: moneyRpcs.every((f) => f.securityDefiner),
      invariant: 'every money mutation is a SECURITY DEFINER RPC called via db.rpc (canonical-ledger-only-validator)',
    },
    flows,
    whatBreaksIfPaymentChanges: impact && {
      domainsAffected: impact.blastRadius.domains, affected: impact.blastRadius.affected,
      tablesAffected: impact.tables.length, rpcsAffected: impact.rpcs.length,
      queuesAffected: [...new Set((di.domains.find((d) => d.key === 'payments')?.queues) || [])],
      owners: impact.owners,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  console.log(JSON.stringify(buildPaymentIntel(g('db-intel.json'), g('domain-intel.json')), null, 2));
}
