#!/usr/bin/env node
// LetBuyy Security Intelligence (LCIS v3, Phase 7) — builds the security/attack graph
// from db-intel (policies, tenant tables, RLS), infra-intel (secrets, workers) and the
// domain graph. Identity / JWT / OAuth / Webhook / Tenant-isolation / RLS / Attack-surface.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function buildSecurityGraph(db, infra, di) {
  if (!db) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const dom = (k) => di?.domains.find((d) => d.key === k);
  const sec = infra?.secrets || [];

  const tenantTables = db.tables.filter((t) => t.tenant);
  const publicPolicies = db.policies.filter((p) => p.public);
  const serviceRolePolicies = db.policies.filter((p) => p.serviceRole);

  const graphs = {
    identity: { domains: ['identity', 'merchant'].map(dom).filter(Boolean).map((d) => ({ key: d.key, routes: d.routes, tables: d.tables, rpcs: d.rpcs })),
      issuers: { customer: 'HS256 — CUSTOMER_SESSION_SECRET (issueCustomerSession)', merchant: 'ES256 — identity-platform / LETBUYY_IDENTITY_PUBLIC_JWKS' } },
    jwt: { secrets: sec.filter((s) => /SESSION_SECRET|JWKS|AUTH_SECRET|STEP_UP/.test(s)),
      domains: ['authentication', 'authorization'].map(dom).filter(Boolean).map((d) => ({ key: d.key, routes: d.routes, secrets: d.secrets })) },
    oauth: { domains: ['developer', 'marketplace'].map(dom).filter(Boolean).map((d) => ({ key: d.key, routes: d.routes, tables: d.tables.filter((t) => /oauth|token|api_key|api_client/.test(t)) })),
      note: 'developer-portal OAuth/PKCE is frozen — ARB required to activate' },
    webhook: { worker: 'letbuyy-webhook', tables: db.tables.filter((t) => /webhook/.test(t.name)).map((t) => t.name),
      secrets: sec.filter((s) => /QUEUE_TENANT_ENVELOPE|INTERNAL_API/.test(s)),
      note: 'webhook + queue envelopes are HMAC-signed (signQueueTenantEnvelope); Razorpay verified server-side' },
    tenantIsolation: { tenantTables: tenantTables.length, withRls: tenantTables.filter((t) => t.rls).length,
      withForce: tenantTables.filter((t) => t.force).length,
      candidatesWithoutDetectedRls: db.summary.tenantTablesWithoutRls.length,
      anchor: 'verifySiteOwnership + site_id; rls-force-coverage-validator authoritative' },
    rls: { policies: db.policies.length, publicUsingTrue: publicPolicies.length, serviceRole: serviceRolePolicies.length,
      forceTables: db.summary.forceRlsTables,
      note: 'no-public-using-true-validator passes; USING(true) matches are service-role-scoped' },
    attackSurface: {
      publicStorefrontRoutes: dom('storefront')?.routes.length || 0,
      moneyRpcs: db.summary.moneyFunctions,
      securityDefinerFns: db.summary.securityDefiner,
      productionSecrets: sec.length,
      exposedIfAuthFails: {
        // if customer/merchant auth is bypassed, the tenant boundary (RLS + verifySiteOwnership)
        // is the next line of defense — these are the assets it must hold.
        routes: [...new Set([...(dom('storefront')?.routes || []), ...(dom('orders')?.routes || []), ...(dom('payments')?.routes || [])])],
        tenantTablesAtRisk: tenantTables.length,
        workers: ['letbuyy-api', 'letbuyy-webhook'],
        backstop: 'forced RLS + verifySiteOwnership + step-up HMAC on refunds/payouts',
      },
    },
  };
  const deterministicValidators = ['canonical-ledger-only', 'rls-force-coverage', 'no-public-using-true', 'no-blanket-service-role', 'identity-sole-issuer'];
  return { graphs, deterministicValidators, generatedAt: db.summary.generatedAt };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  console.log(JSON.stringify(buildSecurityGraph(g('db-intel.json'), g('infra-intel.json'), g('domain-intel.json')), null, 2));
}
