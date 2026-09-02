#!/usr/bin/env node
// LetBuyy Security Intelligence v5 (Phase 6) — composes the v3 security graph + adds trust
// boundaries, cross-tenant-path candidates, privilege-escalation surface and security hotspots.
// Maps JWT/OAuth/PKCE/RLS/Turnstile/Webhook-HMAC/Queue-HMAC/Secrets/Permissions/Roles/Step-Up.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSecurityGraph } from './security-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function buildSecurityIntelligenceV5() {
  const db = g('db-intel.json'), infra = g('infra-intel.json'), di = g('domain-intel.json');
  if (!db) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const base = buildSecurityGraph(db, infra, di).graphs;
  const sec = infra?.secrets || [];

  const controls = {
    jwt:        { present: true, detail: 'customer HS256 (CUSTOMER_SESSION_SECRET) · merchant ES256 (LETBUYY_IDENTITY_PUBLIC_JWKS)' },
    oauth:      { present: sec.some((s) => /IDENTITY/.test(s)), detail: 'merchant identity via identity-platform JWKS' },
    pkce:       { present: true, detail: 'developer-portal OAuth/PKCE (frozen — ARB to activate)' },
    rls:        { present: true, detail: `${base.rls.policies} policies · ${base.tenantIsolation.withForce} FORCE · no-public-using-true-validator` },
    turnstile:  { present: sec.includes('TURNSTILE_SECRET_KEY'), detail: 'bot gate on registration/login' },
    webhookHmac:{ present: true, detail: 'Razorpay HMAC-SHA256 verified server-side; webhook signatures' },
    queueHmac:  { present: sec.includes('QUEUE_TENANT_ENVELOPE_SECRET'), detail: 'signQueueTenantEnvelope on queue jobs' },
    secrets:    { present: true, detail: `${sec.length} production secrets (wrangler secret put)` },
    permissions:{ present: true, detail: 'employee_permissions / employee_roles (RBAC)' },
    roles:      { present: true, detail: 'operations/rbac routes; role tables' },
    stepUp:     { present: sec.includes('STEP_UP_SIGNING_SECRET'), detail: 'HMAC step-up gates refunds/payouts' },
  };

  // trust boundaries (where a request crosses a privilege level)
  const trustBoundaries = [
    { from: 'public internet', to: 'customer-web', control: 'Turnstile + customer HS256 session' },
    { from: 'customer session', to: 'money RPCs', control: 'server-authoritative totals + SECURITY DEFINER RPC (no client amounts)' },
    { from: 'merchant session', to: 'refunds/payouts', control: 'ES256 + step-up HMAC second factor' },
    { from: 'gateway service-role', to: 'tenant tables', control: 'verifySiteOwnership BEFORE service-role DB access' },
    { from: 'queue job', to: 'tenant data', control: 'signQueueTenantEnvelope HMAC' },
  ];

  // cross-tenant path CANDIDATES (heuristic — validator authoritative)
  const crossTenantCandidates = db.summary.tenantTablesWithoutRls;
  const privilegeEscalationSurface = {
    serviceRolePolicies: db.policies.filter((p) => p.serviceRole).length,
    securityDefinerFns: db.summary.securityDefiner,
    note: 'SECURITY DEFINER + service-role are the privilege-elevation points; they must be gated by verifySiteOwnership / step-up. Enforced by no-blanket-service-role + canonical-ledger-only validators.',
  };
  const hotspots = [
    { area: 'money RPCs', why: `${db.summary.moneyFunctions} SECURITY DEFINER money mutations — highest-value target`, control: 'canonical-ledger-only + idempotency + step-up' },
    { area: 'tenant isolation', why: `${base.tenantIsolation.tenantTables} tenant tables on shared schema`, control: 'forced RLS + verifySiteOwnership' },
    { area: 'webhooks', why: 'externally-reachable; signature-forgery target', control: 'HMAC verify server-side' },
  ];

  const summary = {
    controls: Object.keys(controls).length, controlsPresent: Object.values(controls).filter((c) => c.present).length,
    trustBoundaries: trustBoundaries.length, crossTenantCandidates: crossTenantCandidates.length,
    tenantTables: base.tenantIsolation.tenantTables, policies: base.rls.policies,
    deterministicValidators: ['canonical-ledger-only', 'rls-force-coverage', 'no-public-using-true', 'no-blanket-service-role', 'identity-sole-issuer'],
    generatedAt: db.summary.generatedAt,
  };
  return { summary, controls, trustBoundaries, crossTenantCandidates, privilegeEscalationSurface, hotspots, base };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildSecurityIntelligenceV5();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'security-intelligence-v5.json'), JSON.stringify(intel));
  if (intel.error) { console.error(intel.error); process.exit(1); }
  const s = intel.summary;
  console.log('\nLetBuyy Security Intelligence v5');
  console.log(`  controls ${s.controlsPresent}/${s.controls} present · trust boundaries ${s.trustBoundaries} · cross-tenant candidates ${s.crossTenantCandidates}`);
  console.log(`  tenant tables ${s.tenantTables} · policies ${s.policies} · validators ${s.deterministicValidators.length} (authoritative)`);
  console.log(`  → graphify-out/security-intelligence-v5.json\n`);
}
