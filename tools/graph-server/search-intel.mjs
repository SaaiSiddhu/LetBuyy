#!/usr/bin/env node
// LetBuyy OS (V7 master) — Intelligence Search V2 (Phase 2). Semantic, intent-aware search that
// answers natural-language questions ("How does Orders work?", "Show refund architecture",
// "What breaks if payments fail?") from LCIS — not a raw node lookup. Composes the Explain model +
// ecosystem intel + cross-domain blast. Repository scan is never required for these.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExplainIntel } from './explain-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

// natural-language entity → domain key
const ALIAS = { checkout: 'orders', cart: 'orders', order: 'orders', payment: 'payments', pay: 'payments',
  refund: 'refunds', return: 'refunds', payout: 'payouts', settlement: 'payouts', 'gift card': 'gift-cards', giftcard: 'gift-cards', wallet: 'gift-cards',
  tax: 'gst', invoice: 'gst', coupon: 'discounts', promotion: 'discounts', promo: 'discounts', marketing: 'discounts',
  stock: 'inventory', product: 'products', catalog: 'products', collection: 'collections', category: 'collections',
  ship: 'shipping', shipment: 'shipping', fulfillment: 'shipping', store: 'merchant', merchant: 'merchant', onboarding: 'merchant',
  storefront: 'storefront', browse: 'storefront', landing: 'storefront', theme: 'themes', app: 'apps', marketplace: 'apps', developer: 'developer', oauth: 'developer',
  auth: 'authentication', login: 'authentication', session: 'authentication', identity: 'identity', kyc: 'identity', customer: 'identity',
  rbac: 'authorization', permission: 'authorization', notification: 'notifications', email: 'notifications', analytics: 'analytics', incident: 'operations', ops: 'operations' };

function resolveDomain(t, nodes) {
  for (const k of Object.keys(nodes)) if (t.includes(k.replace('-', ' ')) || t.includes(nodes[k].label.toLowerCase())) return k;
  for (const [alias, key] of Object.entries(ALIAS)) if (t.includes(alias)) return key;
  return null;
}

export function searchV2(query, ex) {
  ex = ex || buildExplainIntel();
  if (ex.error) return { error: ex.error };
  const t = (query || '').toLowerCase().trim();
  const eco = g('ecosystem-intel.json');
  const d = resolveDomain(t, ex.nodes);
  const node = d ? ex.nodes[d] : null;

  // intent
  let intent = 'explain';
  if (/what breaks|impact|if .*(fail|change|break)|blast/.test(t)) intent = 'impact';
  else if (/who owns|owner/.test(t)) intent = 'ownership';
  else if (/depend/.test(t)) intent = 'dependencies';
  else if (/flow|journey|lifecycle|how does .* work|how .* works/.test(t)) intent = 'flow';
  else if (/architecture|show .*(architecture)/.test(t)) intent = 'architecture';
  else if (/why/.test(t)) intent = 'why';

  if (!node) return { query, intent, domain: null,
    suggestion: 'Ask about a domain: orders, checkout, payments, refunds, payouts, gift cards, inventory, shipping, GST, themes, apps, developer, identity, security.',
    domains: Object.keys(ex.nodes) };

  const answer = {
    domain: d, label: node.label, criticality: node.criticality,
    summary: node.purpose, businessImportance: node.importance,
    flow: node.flow || null,
    dependsOn: node.dependsOn, consumers: node.consumers, owner: node.owner,
    failureImpact: node.failureImpact,
    technical: { routes: node.technical.routes.length, rpcs: node.technical.rpcs.length, tables: node.technical.tables.length, workers: node.technical.workers, queues: node.technical.queues },
  };
  if (eco && eco.layers[d]) answer.ecosystem = { frozen: eco.layers[d].frozen, capabilities: eco.layers[d].capabilities.map((c) => c.capability) };

  return {
    query, intent, domain: d, answer,
    sourceEngines: ['/api/explain?node=' + d, intent === 'impact' ? '/api/change-impact?key=' + d : null, '/api/atlas-v2?node=' + d].filter(Boolean),
    aiContext: node.aiContext,
    related: [...node.dependsOn, ...node.consumers].slice(0, 6),
    repoScan: 'not required',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ex = buildExplainIntel();
  const qs = process.argv[2] ? [process.argv.slice(2).join(' ')] : ['How does Orders work', 'Show refund architecture', 'What breaks if payments fail', 'Show gift card flow', 'Who owns inventory', 'Show theme architecture'];
  for (const q of qs) {
    const r = searchV2(q, ex);
    console.log(`\nQ: ${q}`);
    console.log(`  → intent=${r.intent} domain=${r.domain || '—'}`);
    if (r.answer) console.log(`  ${r.answer.summary}`);
    if (r.answer?.flow) console.log(`  flow: ${r.answer.flow.slice(0, 4).join(' → ')} …`);
  }
}
