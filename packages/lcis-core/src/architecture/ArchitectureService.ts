/**
 * ArchitectureService — consolidated :3333∪:3334 architecture intelligence.
 *
 * Consolidates:
 *   - tools/graph-server/explain-intel.mjs   (narrative, criticality, aiContext, NARRATIVE map)
 *   - tools/graph-server/domain-intel.mjs    (domain classification, cross-domain edges)
 *   - tools/central-intelligence/architecture-intelligence/ArchitectureIntelligenceEngine.mjs
 *   - tools/central-intelligence/architecture-intelligence/ArchitectureDriftDetector.mjs
 *   - tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs
 *   - tools/central-intelligence/architecture-intelligence/DependencyDiscovery.mjs
 *   - tools/central-intelligence/architecture-intelligence/ServiceDiscovery.mjs
 *   - tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs
 *
 * Zero Qdrant/OpenAI dependencies. All inputs: deterministic artifacts + filesystem.
 * Every output carries Evidence[] citing the exact artifact field or file that supplied it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Explanation, Evidence } from '../contracts/index';
import { evidence } from '../contracts/index';
import type { ArtifactStore } from '../runtime/ArtifactStore';
import type {
  LayerName,
  LayerValidation,
  LayerViolation,
  RawDbIntel,
  RawDomain,
  RawDomainIntel,
  RawInfraIntel,
  RiskFactor,
  RiskSeverity,
  ServiceEntry,
} from './types';

// ── Constants ported from source files ──────────────────────────────────────

/**
 * NARRATIVE map — ported from tools/graph-server/explain-intel.mjs lines 18–41.
 * Keys are domain keys; values are purpose/importance/failureImpact strings.
 */
const NARRATIVE: Record<string, { purpose: string; importance: string; failureImpact: string }> = {
  payments:
  { purpose: 'Authorizes and captures money via Razorpay and COD, posts to the canonical ledger, and enforces step-up for sensitive mutations.',
    importance: 'Every rupee the platform processes flows through this domain. A failure here means revenue stops and no orders can be confirmed.',
    failureImpact: 'Payments fail or mis-post — orders stuck in pending, revenue unreconciled, merchants cannot be paid out.' },
  orders:
  { purpose: 'Creates and manages the lifecycle of customer orders, from cart to fulfillment.',
    importance: 'Orders are the central commerce entity; every other domain converges here.',
    failureImpact: 'Orders cannot be placed or tracked — the entire commerce flow halts.' },
  refunds:
  { purpose: 'Processes full and partial refunds and restores inventory and gift card balances.',
    importance: 'Customer trust depends on reliable, auditable refunds.',
    failureImpact: 'Customers cannot receive money back; merchant disputes and chargebacks escalate.' },
  payouts:
  { purpose: 'Reconciles and pays out merchant earnings via Razorpay Route.',
    importance: 'Merchant cash flow depends entirely on this domain.',
    failureImpact: 'Merchants are not paid; churn risk increases immediately.' },
  inventory:
  { purpose: 'Tracks stock levels across locations, reserves inventory at checkout, and handles purchase orders.',
    importance: 'Prevents overselling; feeds product availability to storefront.',
    failureImpact: 'Overselling, phantom inventory, failed checkouts.' },
  products:
  { purpose: 'Manages products, variants, and metafields across all merchant stores.',
    importance: 'Products are the catalog layer; every order references a product.',
    failureImpact: 'Product data unavailable; storefronts render nothing.' },
  identity:
  { purpose: 'Manages customer accounts, profiles, and store-customer associations.',
    importance: 'Authentication and personalization depend on customer records.',
    failureImpact: 'Customers cannot log in; order history inaccessible.' },
  merchant:
  { purpose: 'Manages store setup, merchant onboarding, employees, and billing.',
    importance: 'Every tenant originates here; site_id is the root multi-tenant key.',
    failureImpact: 'New stores cannot onboard; existing stores may lose access.' },
  authentication:
  { purpose: 'Issues and validates sessions, OTPs, and credentials for customers and merchants.',
    importance: 'No authenticated action is possible without this domain.',
    failureImpact: 'Login breaks for all users; entire platform inaccessible.' },
  authorization:
  { purpose: 'Enforces RBAC, permissions, step-up challenges, and entitlements.',
    importance: 'Prevents unauthorized actions; gates refunds/payouts behind step-up.',
    failureImpact: 'Permission boundaries collapse; security model fails.' },
  shipping:
  { purpose: 'Manages shipping rates, zones, and fulfillment state per order.',
    importance: 'Checkout cannot complete without a valid shipping rate.',
    failureImpact: 'Checkouts fail; delivery tracking breaks.' },
  'gift-cards':
  { purpose: 'Issues, tracks, and redeems gift cards via an immutable ledger.',
    importance: 'Gift card balances are never mutated directly — ledger projections only.',
    failureImpact: 'Gift card redemptions fail at checkout; balances may appear incorrect.' },
  gst:
  { purpose: 'Computes GST, generates immutable tax invoices, and maintains GSTIN records.',
    importance: 'India-mandated; every B2B order requires a valid tax invoice.',
    failureImpact: 'Tax invoices cannot be generated; regulatory compliance breaks.' },
  discounts:
  { purpose: 'Manages coupons, promotions, and discount allocation at checkout.',
    importance: 'Promotional campaigns drive conversion; discount bugs cause revenue leakage.',
    failureImpact: 'Coupons not applied or over-applied; checkout pricing incorrect.' },
  collections:
  { purpose: 'Groups products into merchant-defined collections for storefront display.',
    importance: 'Collections power navigation and merchandising.',
    failureImpact: 'Collections unavailable; navigation and category pages break.' },
  storefront:
  { purpose: 'Serves the public-facing store pages, blogs, custom domains, and contact forms.',
    importance: 'The primary customer touchpoint for every merchant.',
    failureImpact: 'Storefronts go dark; merchant sales stop immediately.' },
  notifications:
  { purpose: 'Sends transactional emails and WhatsApp messages via Resend and providers.',
    importance: 'Order confirmations, OTP delivery, and support communications depend here.',
    failureImpact: 'Customers receive no emails or OTPs; order comms silent.' },
  analytics:
  { purpose: 'Collects events via the outbox, rolls up metrics, and feeds the merchant dashboard.',
    importance: 'Merchant insight and platform health depend on event data.',
    failureImpact: 'Analytics silently drop; merchant dashboards show stale data.' },
  themes:
  { purpose: 'Manages Liquid/React theme rendering, presets, and the theme editor.',
    importance: 'Controls the visual output of every storefront page.',
    failureImpact: 'Storefronts render with broken or default styling.' },
  marketplace:
  { purpose: 'Hosts third-party app listings and extension installation flow.',
    importance: 'Extends merchant capabilities beyond the core platform.',
    failureImpact: 'App installations fail; existing integrations may degrade.' },
  developer:
  { purpose: 'Manages OAuth clients, API keys, and developer portal access.',
    importance: 'All third-party integrations authenticate via this domain.',
    failureImpact: 'API integrations break; webhooks stop authenticating.' },
  operations:
  { purpose: 'Manages incidents, feature flags, runtime controls, audit logs, and SRE tooling.',
    importance: 'Operational visibility and incident response depend on this domain.',
    failureImpact: 'Blind operations; incidents cannot be detected or controlled.' },
};

/** MONEY_TABLES — from tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs lines 15–21 */
const MONEY_TABLES = new Set([
  'orders', 'order_items', 'payment_transactions', 'refunds', 'payouts',
  'gift_card_accounts', 'gift_card_ledger_entries', 'gift_card_redemptions',
  'shipping_rates', 'checkout_sessions', 'checkout_line_items',
  'billing_subscriptions', 'billing_invoices', 'payout_accounts',
  'store_credits', 'discount_allocations', 'tax_lines', 'ledger_entries',
]);

/** KNOWN_CRITICAL packages — from tools/central-intelligence/architecture-intelligence/DependencyDiscovery.mjs line 22 */
const KNOWN_CRITICAL = new Set([
  'shared-types', 'api-client', 'auth-core', 'ui', 'theme-engine', 'tenant-core',
]);

/** CANONICAL_RUNTIMES — from tools/central-intelligence/architecture-intelligence/ServiceDiscovery.mjs lines 15–24 */
const CANONICAL_RUNTIMES = new Set([
  'storefront-runtime', 'merchant-control-plane', 'identity-platform',
  'marketing-site', 'platform-console', 'api-gateway', 'queue-workers',
  'webhook-service', 'mobile-bff',
]);

/** FROZEN_APPS — from ServiceDiscovery.mjs lines 36–41 */
const FROZEN_APPS = new Set([
  'app-marketplace', 'developer-portal', 'theme-marketplace', 'platform-operations-portal',
]);

/** LAYER_MAP — from LayerDiscovery.mjs lines 22–54 */
const LAYER_MAP: Record<string, LayerName> = {
  'storefront-runtime': 'edge',
  'merchant-control-plane': 'edge',
  'identity-platform': 'edge',
  'marketing-site': 'edge',
  'platform-console': 'edge',
  'api-gateway': 'gateway',
  'mobile-bff': 'gateway',
  'queue-workers': 'async',
  'webhook-service': 'async',
};

/** PACKAGE_LAYER_MAP — from LayerDiscovery.mjs lines 57–79 */
const PACKAGE_LAYER_MAP: Record<string, LayerName> = {
  'shared-types': 'package',
  'api-client': 'package',
  'auth-core': 'package',
  'ui': 'package',
  'theme-engine': 'package',
  'tenant-core': 'package',
  'audit-core': 'package',
  'billing-core': 'package',
  'checkout-core': 'package',
  'cms-core': 'package',
  'commerce-core': 'package',
  'event-core': 'package',
  'identity-core': 'package',
  'infrastructure': 'package',
  'lcis-core': 'intelligence',
};

/**
 * Forbidden layer dependencies — from LayerDiscovery.mjs lines 83–89.
 * A key layer must NOT depend on any layer in its Set.
 */
const FORBIDDEN_LAYER_DEPS: Record<LayerName, Set<LayerName>> = {
  data: new Set(['gateway', 'async', 'edge']),
  gateway: new Set(['edge']),
  async: new Set(['edge']),
  package: new Set(['edge', 'gateway', 'async']),
  intelligence: new Set(),
  edge: new Set(),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function criticality(d: RawDomain): string {
  // From explain-intel.mjs lines 75–80
  if (d.money || (d.consumedBy ?? []).length >= 3) return 'Tier 1 — critical (money path)';
  if (d.tenant) return 'Tier 2 — high (tenant-scoped)';
  return 'Tier 3 — standard';
}

function inferLayer(name: string): LayerName {
  if (LAYER_MAP[name]) return LAYER_MAP[name];
  if (PACKAGE_LAYER_MAP[name]) return PACKAGE_LAYER_MAP[name];
  // From LayerDiscovery.mjs #inferLayer (lines 151–163)
  if (name.includes('graph') || name.includes('intelligence') || name.includes('lcis')) return 'intelligence';
  if (name.startsWith('packages/') || name.startsWith('@letbuyy/')) return 'package';
  return 'edge'; // default for unrecognized app entries
}

function serviceStatus(name: string): ServiceEntry['status'] {
  if (CANONICAL_RUNTIMES.has(name)) return 'canonical';
  if (FROZEN_APPS.has(name)) return 'frozen';
  return 'library';
}

// ── ArchitectureService ───────────────────────────────────────────────────────

export class ArchitectureService {
  /** Root directory of the monorepo (for package.json scanning). */
  private readonly repoRoot: string;

  constructor(
    private readonly store: ArtifactStore,
    repoRoot?: string,
  ) {
    this.repoRoot = repoRoot ?? join(new URL('.', import.meta.url).pathname, '../../../../..');
  }

  // ── 1. explainDomain ─────────────────────────────────────────────────────

  async explainDomain(key: string): Promise<Explanation> {
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    if (!di) {
      return this.#missing('domain', key, 'domain-intel');
    }
    const d = di.domains.find((x) => x.key === key);
    if (!d) {
      return {
        subject: key,
        kind: 'domain',
        summary: `Domain '${key}' not found in domain-intel.json (22 classified domains).`,
        evidence: [
          evidence('artifact-field', 'domain-intel.json', `key '${key}' not in domains[]`, 'graphify-out/domain-intel.json'),
        ],
      };
    }

    const narrative = NARRATIVE[key] ?? {
      purpose: `Manages ${d.label ?? key} entities.`,
      importance: 'Core platform domain.',
      failureImpact: `${d.label ?? key} functionality degraded.`,
    };

    const counts = d.counts ?? {};
    const consumedByList = (d.consumedBy ?? []).map((c) => c.domain);
    const dependsOnList = (d.dependsOn ?? []).map((c) => c.domain);

    const detailParts: string[] = [
      criticality(d),
      `Purpose: ${narrative.purpose}`,
      `Failure impact: ${narrative.failureImpact}`,
      `Tables: ${counts.tables ?? (d.tables ?? []).length} | RPCs: ${counts.rpcs ?? (d.rpcs ?? []).length} | Routes: ${counts.routes ?? (d.routes ?? []).length}`,
      `Policies: ${counts.policies ?? 0} | Triggers: ${counts.triggers ?? 0} | Indexes: ${counts.indexes ?? 0}`,
      `Money domain: ${d.money ? 'yes — canonical-ledger-only-validator applies' : 'no'}`,
      `Tenant-scoped: ${d.tenant ? 'yes — RLS + verifySiteOwnership required' : 'no'}`,
      `Consumed by: ${consumedByList.length > 0 ? consumedByList.join(', ') : 'no upstream consumers'}`,
      `Depends on: ${dependsOnList.length > 0 ? dependsOnList.join(', ') : 'no declared dependencies'}`,
      `Workers: ${(d.workers ?? []).join(', ') || 'none'}`,
      `Queues: ${(d.queues ?? []).join(', ') || 'none'}`,
      `Secrets: ${(d.secrets ?? []).join(', ') || 'none'}`,
      `Owners: ${(d.owners ?? []).join(', ') || 'unowned'}`,
      `Workflows: ${(d.workflows ?? []).join(', ') || 'none'}`,
    ];

    const ev: Evidence[] = [
      evidence('artifact-field', `domains[key=${key}].money`, String(d.money ?? false), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].tenant`, String(d.tenant ?? false), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].tables`, (d.tables ?? []).join(', '), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].rpcs`, (d.rpcs ?? []).join(', '), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].secrets`, (d.secrets ?? []).join(', '), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].owners`, (d.owners ?? []).join(', '), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].consumedBy`, consumedByList.join(', '), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].dependsOn`, dependsOnList.join(', '), 'graphify-out/domain-intel.json'),
      evidence('file', 'NARRATIVE.' + key, JSON.stringify(narrative), 'tools/graph-server/explain-intel.mjs'),
      evidence('artifact-field', `summary.domains`, String(di.summary.domains), 'graphify-out/domain-intel.json'),
    ];

    return {
      subject: key,
      kind: 'domain',
      summary: `${d.label ?? key}: ${narrative.purpose}`,
      detail: detailParts.join('\n'),
      evidence: ev,
    };
  }

  // ── 2. explainService ────────────────────────────────────────────────────

  async explainService(name: string): Promise<Explanation> {
    const infra = this.store.tryRead<RawInfraIntel>('infra-intel');
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');

    const worker = infra?.workers.find((w) => w.name === name || w.file?.includes(name));
    const layer = inferLayer(name);
    const status = serviceStatus(name);

    // Discover which domains reference this service
    const relatedDomains = di
      ? di.domains
          .filter((d) => (d.apps ?? []).includes(name) || (d.workers ?? []).includes(name))
          .map((d) => d.key)
      : [];

    // Read package.json if it exists
    let pkgJson: Record<string, unknown> | null = null;
    for (const prefix of ['apps', 'services', 'packages']) {
      const p = join(this.repoRoot, prefix, name, 'package.json');
      if (existsSync(p)) {
        try { pkgJson = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>; } catch { /* ignore */ }
        break;
      }
    }

    const detailParts: string[] = [
      `Layer: ${layer}`,
      `Status: ${status}`,
      `Related domains: ${relatedDomains.join(', ') || 'none detected'}`,
      worker ? `Cloudflare Worker: ${worker.name}` : 'Not a Cloudflare Worker',
      worker?.queueProducers?.length ? `Queue producers: ${worker.queueProducers.join(', ')}` : '',
      worker?.queueConsumers?.length ? `Queue consumers: ${worker.queueConsumers.join(', ')}` : '',
      worker?.crons?.length ? `Crons: ${worker.crons.join(', ')}` : '',
      worker?.bindings?.length ? `Bindings: ${worker.bindings.join(', ')}` : '',
      pkgJson ? `Package: ${String(pkgJson['name'] ?? name)}` : '',
    ].filter(Boolean);

    const ev: Evidence[] = [
      evidence('artifact-field', 'LAYER_MAP.' + name, layer, 'tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs'),
      evidence('artifact-field', 'CANONICAL_RUNTIMES.' + name, status, 'tools/central-intelligence/architecture-intelligence/ServiceDiscovery.mjs'),
    ];
    if (infra) {
      ev.push(evidence('artifact-field', 'infra-intel.workers[]', name, 'graphify-out/infra-intel.json'));
    }
    if (relatedDomains.length > 0) {
      ev.push(evidence('artifact-field', 'domain-intel.domains[].apps/workers', relatedDomains.join(', '), 'graphify-out/domain-intel.json'));
    }

    return {
      subject: name,
      kind: 'service',
      summary: `Service '${name}': layer=${layer}, status=${status}, domains=[${relatedDomains.join(', ')}]`,
      detail: detailParts.join('\n'),
      evidence: ev,
    };
  }

  // ── 3. explainDependency ─────────────────────────────────────────────────

  async explainDependency(a: string, b: string): Promise<Explanation> {
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    if (!di) {
      return this.#missing('dependency', `${a}→${b}`, 'domain-intel');
    }

    const edge = di.edges.find((e) => e.from === a && e.to === b);
    if (!edge) {
      // Check reverse direction
      const reverse = di.edges.find((e) => e.from === b && e.to === a);
      return {
        subject: `${a}→${b}`,
        kind: 'dependency',
        summary: reverse
          ? `No direct dependency from '${a}' to '${b}'. Reverse dependency exists: '${b}'→'${a}' (strength ${reverse.strength}).`
          : `No cross-domain dependency found between '${a}' and '${b}' in domain-intel.json edges.`,
        evidence: [
          evidence('artifact-field', 'domain-intel.json edges[]', `${di.edges.length} total edges; no edge from=${a} to=${b}`, 'graphify-out/domain-intel.json'),
        ],
      };
    }

    const detailParts = [
      `Coupling strength: ${edge.strength} cross-domain calls`,
      `Via (each is an RPC→table or route→RPC cross-domain call):`,
      ...edge.via.map((v) => `  • ${v}`),
    ];

    const ev: Evidence[] = [
      evidence('artifact-field', `edges[from=${a},to=${b}].strength`, String(edge.strength), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `edges[from=${a},to=${b}].via`, edge.via.join(' | '), 'graphify-out/domain-intel.json'),
    ];

    return {
      subject: `${a}→${b}`,
      kind: 'dependency',
      summary: `Domain '${a}' depends on '${b}' with strength ${edge.strength}: ${edge.via.slice(0, 2).join(', ')}${edge.via.length > 2 ? ` (+${edge.via.length - 2} more)` : ''}.`,
      detail: detailParts.join('\n'),
      evidence: ev,
    };
  }

  // ── 4. explainArchitecture ───────────────────────────────────────────────

  async explainArchitecture(): Promise<Explanation> {
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    const db = this.store.tryRead<RawDbIntel>('db-intel');
    const infra = this.store.tryRead<RawInfraIntel>('infra-intel');

    const ds = di?.summary;
    const dbs = db?.summary;
    const ins = infra?.summary;

    const detailParts: string[] = [];
    const ev: Evidence[] = [];

    if (ds) {
      detailParts.push(
        `Domains: ${ds.domains} (${ds.classifiedRoutes ?? '?'}/${ds.totalRoutes ?? '?'} routes classified, ${ds.classifiedTables ?? '?'}/${ds.totalTables ?? '?'} tables classified, ${ds.classifiedRpcs ?? '?'}/${ds.totalRpcs ?? '?'} RPCs classified)`,
        `Cross-domain edges: ${ds.crossDomainEdges ?? '?'} (explicit coupling paths between domain pairs)`,
        `Generated: ${ds.generatedAt ?? 'unknown'}`,
      );
      ev.push(
        evidence('artifact-field', 'summary.domains', String(ds.domains), 'graphify-out/domain-intel.json'),
        evidence('artifact-field', 'summary.crossDomainEdges', String(ds.crossDomainEdges ?? '?'), 'graphify-out/domain-intel.json'),
        evidence('artifact-field', 'summary.classifiedTables', String(ds.classifiedTables ?? '?'), 'graphify-out/domain-intel.json'),
        evidence('artifact-field', 'summary.totalTables', String(ds.totalTables ?? '?'), 'graphify-out/domain-intel.json'),
        evidence('artifact-field', 'summary.classifiedRpcs', String(ds.classifiedRpcs ?? '?'), 'graphify-out/domain-intel.json'),
        evidence('artifact-field', 'summary.totalRpcs', String(ds.totalRpcs ?? '?'), 'graphify-out/domain-intel.json'),
      );
    }

    if (dbs) {
      detailParts.push(
        `Database: ${dbs.tables ?? '?'} tables, ${dbs.functions ?? '?'} functions (${dbs.securityDefiner ?? '?'} SECURITY DEFINER, ${dbs.moneyFunctions ?? '?'} money), ${dbs.policies ?? '?'} policies, ${dbs.triggers ?? '?'} triggers, ${dbs.indexes ?? '?'} indexes, ${dbs.rlsTables ?? '?'} RLS-enabled tables`,
        `Migration files: ${dbs.migrationFiles ?? '?'}`,
      );
      ev.push(
        evidence('artifact-field', 'summary.tables', String(dbs.tables ?? '?'), 'graphify-out/db-intel.json'),
        evidence('artifact-field', 'summary.functions', String(dbs.functions ?? '?'), 'graphify-out/db-intel.json'),
        evidence('artifact-field', 'summary.securityDefiner', String(dbs.securityDefiner ?? '?'), 'graphify-out/db-intel.json'),
        evidence('artifact-field', 'summary.moneyFunctions', String(dbs.moneyFunctions ?? '?'), 'graphify-out/db-intel.json'),
        evidence('artifact-field', 'summary.policies', String(dbs.policies ?? '?'), 'graphify-out/db-intel.json'),
        evidence('artifact-field', 'summary.triggers', String(dbs.triggers ?? '?'), 'graphify-out/db-intel.json'),
        evidence('artifact-field', 'summary.indexes', String(dbs.indexes ?? '?'), 'graphify-out/db-intel.json'),
        evidence('artifact-field', 'summary.rlsTables', String(dbs.rlsTables ?? '?'), 'graphify-out/db-intel.json'),
      );
    }

    if (ins) {
      const vercelApps = ins.vercelApps ?? [];
      const queueProducers = ins.queueProducers ?? [];
      detailParts.push(
        `Infrastructure: ${ins.workers ?? '?'} Cloudflare Workers, ${vercelApps.length} Vercel apps [${vercelApps.join(', ')}], ${ins.secretsRequired ?? '?'} required secrets`,
        `Queue producers: ${queueProducers.join(', ')}`,
        `Hyperdrive: ${ins.hyperdrive ? 'yes' : 'no'} | R2: ${(ins.r2 ?? []).join(', ') || 'none'} | Migrate gate: ${ins.hasMigrateGate ? 'yes' : 'no'}`,
        `Providers: ${(ins.providers ?? []).join(', ')}`,
      );
      ev.push(
        evidence('artifact-field', 'summary.workers', String(ins.workers ?? '?'), 'graphify-out/infra-intel.json'),
        evidence('artifact-field', 'summary.vercelApps', vercelApps.join(', '), 'graphify-out/infra-intel.json'),
        evidence('artifact-field', 'summary.secretsRequired', String(ins.secretsRequired ?? '?'), 'graphify-out/infra-intel.json'),
        evidence('artifact-field', 'summary.queueProducers', queueProducers.join(', '), 'graphify-out/infra-intel.json'),
        evidence('artifact-field', 'summary.hyperdrive', String(ins.hyperdrive ?? false), 'graphify-out/infra-intel.json'),
        evidence('artifact-field', 'summary.r2', (ins.r2 ?? []).join(', '), 'graphify-out/infra-intel.json'),
        evidence('artifact-field', 'summary.hasMigrateGate', String(ins.hasMigrateGate ?? false), 'graphify-out/infra-intel.json'),
        evidence('artifact-field', 'summary.providers', (ins.providers ?? []).join(', '), 'graphify-out/infra-intel.json'),
      );
    }

    const domainCount = ds?.domains ?? 0;
    return {
      subject: 'architecture',
      kind: 'architecture',
      summary: `LetBuyy platform: ${domainCount} domains, ${dbs?.tables ?? '?'} DB tables, ${ins?.workers ?? '?'} Cloudflare Workers, ${(ins?.vercelApps ?? []).length} Vercel apps, ${ds?.crossDomainEdges ?? '?'} cross-domain edges.`,
      detail: detailParts.join('\n'),
      evidence: ev,
    };
  }

  // ── 5. explainRuntime ────────────────────────────────────────────────────

  async explainRuntime(): Promise<Explanation> {
    const infra = this.store.tryRead<RawInfraIntel>('infra-intel');
    if (!infra) {
      return this.#missing('runtime', 'runtime', 'infra-intel');
    }

    const workers = infra.workers;
    const layerValidation = this.#validateLayering(infra);

    const workerLines = workers.map(
      (w) => `  • ${w.name} (${w.file ?? 'unknown file'})`
        + (w.crons?.length ? ` crons=[${w.crons.join(', ')}]` : '')
        + (w.queueProducers?.length ? ` producers=[${w.queueProducers.join(', ')}]` : '')
        + (w.queueConsumers?.length ? ` consumers=[${w.queueConsumers.join(', ')}]` : ''),
    );

    const vercelApps = infra.summary.vercelApps ?? [];
    const detailParts: string[] = [
      `Cloudflare Workers (${workers.length}):`,
      ...workerLines,
      `Vercel Apps (${vercelApps.length}): ${vercelApps.join(', ')}`,
      `Queue producers: ${(infra.summary.queueProducers ?? []).join(', ')}`,
      `Queue consumers: ${(infra.summary.queueConsumers ?? []).join(', ')}`,
      `Providers: ${(infra.summary.providers ?? []).join(', ')}`,
      `Hyperdrive: ${infra.summary.hyperdrive ? 'yes' : 'no'} | R2: ${(infra.summary.r2 ?? []).join(', ')} | Migrate gate: ${infra.summary.hasMigrateGate ? 'yes' : 'no'}`,
      `Crons: ${(infra.summary.crons ?? []).join(', ')}`,
      `Layer validation: ${layerValidation.valid ? 'PASS' : `FAIL — ${layerValidation.violationCount} violation(s)`}`,
      ...(layerValidation.violations.length > 0
        ? layerValidation.violations.map((v) => `  VIOLATION: ${v.violator} (${v.violatorLayer}) → ${v.dependency} (${v.dependencyLayer})`)
        : ['  No layer violations detected']),
    ];

    const ev: Evidence[] = [
      evidence('artifact-field', 'workers[0].name', workers[0]?.name ?? 'n/a', 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'workers[0].queueProducers', (workers[0]?.queueProducers ?? []).join(', '), 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'workers[1].name', workers[1]?.name ?? 'n/a', 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'workers[1].crons', (workers[1]?.crons ?? []).join(', '), 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'workers[2].name', workers[2]?.name ?? 'n/a', 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'workers[3].name', workers[3]?.name ?? 'n/a', 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'summary.hyperdrive', String(infra.summary.hyperdrive ?? false), 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'summary.r2', (infra.summary.r2 ?? []).join(', '), 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'summary.hasMigrateGate', String(infra.summary.hasMigrateGate ?? false), 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'summary.providers', (infra.summary.providers ?? []).join(', '), 'graphify-out/infra-intel.json'),
      evidence('artifact-field', 'LAYER_MAP.api-gateway', 'gateway', 'tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs'),
      evidence('artifact-field', 'LAYER_MAP.queue-workers', 'async', 'tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs'),
      evidence('file', 'FORBIDDEN_LAYER_DEPS', 'data must not import gateway/async/edge; gateway must not import edge; async must not import edge; package must not import edge/gateway/async', 'tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs'),
    ];

    return {
      subject: 'runtime',
      kind: 'runtime',
      summary: `${workers.length} Cloudflare Workers, ${vercelApps.length} Vercel apps. Layer validation: ${layerValidation.valid ? 'PASS' : `FAIL (${layerValidation.violationCount} violations)`}.`,
      detail: detailParts.join('\n'),
      evidence: ev,
    };
  }

  // ── 6. explainOwnership ──────────────────────────────────────────────────

  async explainOwnership(key: string): Promise<Explanation> {
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    const infra = this.store.tryRead<RawInfraIntel>('infra-intel');

    const d = di?.domains.find((x) => x.key === key);
    const owners = d?.owners ?? [];
    const workflows = d?.workflows ?? [];
    const ownershipRules = infra?.ownership ?? [];

    // Find CODEOWNERS rules that match any route in this domain
    const domainRoutes = d?.routes ?? [];
    const matchedRules = ownershipRules.filter((rule) =>
      domainRoutes.some((r) => r.includes(rule.path.replace(/^\//, '').replace(/\/\*\*?$/, '')))
      || rule.path === '*' // global fallback always matches
    );

    const detailParts: string[] = [
      `Domain owners (from CODEOWNERS via routes): ${owners.length > 0 ? owners.join(', ') : 'unowned'}`,
      `Workflows: ${workflows.length > 0 ? workflows.join(', ') : 'none'}`,
      `CODEOWNERS rules matched (${matchedRules.length}):`,
      ...matchedRules.map((r) => `  • ${r.path} → ${r.owners.join(', ')}`),
      `Domain routes: ${domainRoutes.join(', ') || 'none'}`,
    ];

    const ev: Evidence[] = [
      evidence('artifact-field', `domains[key=${key}].owners`, owners.join(', '), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].workflows`, workflows.join(', '), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', 'ownership[].path + ownership[].owners', matchedRules.map((r) => `${r.path}:${r.owners.join(',')}`).join(' | '), 'graphify-out/infra-intel.json'),
    ];

    if (!d) {
      return {
        subject: key,
        kind: 'ownership',
        summary: `Domain '${key}' not found in domain-intel.json.`,
        evidence: [
          evidence('artifact-field', 'domain-intel.json', `key '${key}' not found`, 'graphify-out/domain-intel.json'),
        ],
      };
    }

    return {
      subject: key,
      kind: 'ownership',
      summary: `Domain ${key} is owned by: ${owners.length > 0 ? owners.join(', ') : 'unowned (no CODEOWNERS match)'}`,
      detail: detailParts.join('\n'),
      evidence: ev,
    };
  }

  // ── 7. explainRisk ───────────────────────────────────────────────────────

  async explainRisk(key: string): Promise<Explanation> {
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    const db = this.store.tryRead<RawDbIntel>('db-intel');

    if (!di) return this.#missing('risk', key, 'domain-intel');

    const d = di.domains.find((x) => x.key === key);
    if (!d) {
      return {
        subject: key,
        kind: 'risk',
        summary: `Domain '${key}' not found in domain-intel.json.`,
        evidence: [evidence('artifact-field', 'domain-intel.json', `key '${key}' not found`, 'graphify-out/domain-intel.json')],
      };
    }

    const domainTables = d.tables ?? [];

    // Money domain risk — DomainDiscovery.mjs lines 138–157
    const moneyTableHits = domainTables.filter((t) => MONEY_TABLES.has(t));
    let moneyRiskLevel: 'critical' | 'high' | 'none' = 'none';
    if (moneyTableHits.length >= 3) moneyRiskLevel = 'critical';
    else if (moneyTableHits.length >= 1) moneyRiskLevel = 'high';

    const risks: RiskFactor[] = [];

    // Money risk
    if (moneyRiskLevel !== 'none') {
      risks.push({
        category: 'money-domain',
        severity: moneyRiskLevel as RiskSeverity,
        detail: `${moneyTableHits.length} money tables (MONEY_TABLES intersection): ${moneyTableHits.join(', ')}. Canonical-ledger-only-validator + step-up apply.`,
      });
    }

    // Critical flag
    if (d.money) {
      risks.push({
        category: 'canonical-ledger',
        severity: 'critical',
        detail: `money=true on domain — all mutations must use SECURITY DEFINER RPCs via db.rpc(); never .from(money_table).insert/update in TS.`,
      });
    }

    // High blast-radius from consumedBy
    const consumedByCount = (d.consumedBy ?? []).length;
    if (consumedByCount >= 3) {
      risks.push({
        category: 'blast-radius',
        severity: 'critical',
        detail: `${consumedByCount} domains consume this domain (threshold: ≥3 = critical). Affected: ${(d.consumedBy ?? []).map((c) => c.domain).join(', ')}.`,
      });
    } else if (consumedByCount >= 1) {
      risks.push({
        category: 'blast-radius',
        severity: 'high',
        detail: `${consumedByCount} domain(s) consume this domain: ${(d.consumedBy ?? []).map((c) => c.domain).join(', ')}.`,
      });
    }

    // Money RPCs with SECURITY DEFINER
    if (db && (d.money || moneyRiskLevel !== 'none')) {
      const domainRpcNames = new Set(d.rpcs ?? []);
      const moneyRpcs = db.functions.filter(
        (f) => domainRpcNames.has(f.name) && f.money && f.securityDefiner,
      );
      if (moneyRpcs.length > 0) {
        risks.push({
          category: 'security-definer-money-rpcs',
          severity: 'high',
          detail: `${moneyRpcs.length} money SECURITY DEFINER RPCs (must not be called from client): ${moneyRpcs.map((f) => f.name).join(', ')}.`,
        });
      }
    }

    // Secrets risk
    const domainSecrets = d.secrets ?? [];
    if (domainSecrets.length > 0) {
      const sensitiveSecrets = domainSecrets.filter((s) =>
        s.includes('SECRET') || s.includes('KEY') || s.includes('SIGNING'),
      );
      if (sensitiveSecrets.length > 0) {
        risks.push({
          category: 'secrets',
          severity: 'high',
          detail: `${sensitiveSecrets.length} sensitive secrets: ${sensitiveSecrets.join(', ')}.`,
        });
      }
    }

    // Overall risk level
    const hasCritical = risks.some((r) => r.severity === 'critical');
    const hasHigh = risks.some((r) => r.severity === 'high');
    const riskLevel: string = hasCritical ? 'critical' : hasHigh ? 'high' : risks.length > 0 ? 'medium' : 'low';

    const detailParts = [
      `Risk level: ${riskLevel}`,
      `Money tables in domain: ${moneyTableHits.join(', ') || 'none'}`,
      `Domain money flag: ${d.money ? 'true' : 'false'}`,
      `Consumed by: ${consumedByCount} domain(s)`,
      `Secrets (${domainSecrets.length}): ${domainSecrets.join(', ') || 'none'}`,
      ``,
      `Risk factors (${risks.length}):`,
      ...risks.map((r) => `  [${r.severity.toUpperCase()}] ${r.category}: ${r.detail}`),
      ``,
      `MONEY_TABLES set (18 entries): ${[...MONEY_TABLES].join(', ')}`,
      `KNOWN_CRITICAL packages: ${[...KNOWN_CRITICAL].join(', ')}`,
      `Blast radius threshold: critical ≥ 8 dependents (code graph), high ≥ 5, medium ≥ 2 (from DependencyDiscovery.mjs)`,
    ];

    const ev: Evidence[] = [
      evidence('artifact-field', `domains[key=${key}].money`, String(d.money ?? false), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].tables`, domainTables.join(', '), 'graphify-out/domain-intel.json'),
      evidence('artifact-field', `domains[key=${key}].consumedBy`, (d.consumedBy ?? []).map((c) => c.domain).join(', '), 'graphify-out/domain-intel.json'),
      evidence('file', 'MONEY_TABLES', [...MONEY_TABLES].join(', '), 'tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs'),
      evidence('file', 'KNOWN_CRITICAL', [...KNOWN_CRITICAL].join(', '), 'tools/central-intelligence/architecture-intelligence/DependencyDiscovery.mjs'),
      evidence('file', 'blastRadius threshold', 'critical >= 8 dependents, high >= 5, medium >= 2', 'tools/central-intelligence/architecture-intelligence/DependencyDiscovery.mjs'),
    ];

    // Add db evidence for money RPCs
    if (db) {
      const canonicalMoneyRpc = db.functions.find((f) => f.name === 'confirm_order_payment_with_ledger');
      if (canonicalMoneyRpc) {
        ev.push(evidence('rpc', 'confirm_order_payment_with_ledger', `securityDefiner=${String(canonicalMoneyRpc.securityDefiner ?? false)}, money=true`, 'graphify-out/db-intel.json'));
      }
    }

    // Secrets evidence
    if (domainSecrets.includes('STEP_UP_SIGNING_SECRET')) {
      ev.push(evidence('artifact-field', `domains[key=${key}].secrets[STEP_UP_SIGNING_SECRET]`, 'gates refunds/payouts; also scoped to authorization/refunds/payouts domains', 'graphify-out/domain-intel.json'));
    }
    if (domainSecrets.includes('PAYMENT_CONFIG_ENCRYPTION_KEY')) {
      ev.push(evidence('artifact-field', `domains[key=${key}].secrets[PAYMENT_CONFIG_ENCRYPTION_KEY]`, 'encrypts stored payment config', 'graphify-out/domain-intel.json'));
    }

    return {
      subject: key,
      kind: 'risk',
      summary: `Risk level: ${riskLevel}. ${risks.length} risk factor(s) identified for domain '${key}'.`,
      detail: detailParts.join('\n'),
      evidence: ev,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Layer violation detection — ported from LayerDiscovery.mjs validateLayering() lines 200–233.
   * Reads package.json files to find internal dependency layer crossings.
   */
  #validateLayering(infra: RawInfraIntel): LayerValidation {
    const violations: LayerViolation[] = [];

    // Check each known service against its package.json internal deps
    const servicesToCheck: { name: string; prefix: string }[] = [
      ...infra.workers.map((w) => ({ name: w.name.replace('letbuyy-', ''), prefix: 'services' })),
      ...(infra.summary.vercelApps ?? []).map((a) => ({ name: a, prefix: 'apps' })),
    ];

    for (const svc of servicesToCheck) {
      const layer = inferLayer(svc.name);
      const forbidden = FORBIDDEN_LAYER_DEPS[layer];
      if (!forbidden || forbidden.size === 0) continue;

      // Read package.json to find internal @letbuyy/* deps
      for (const prefix of ['apps', 'services']) {
        const p = join(this.repoRoot, prefix, svc.name, 'package.json');
        if (!existsSync(p)) continue;
        let pkg: Record<string, unknown>;
        try { pkg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>; } catch { continue; }
        const deps = {
          ...((pkg['dependencies'] as Record<string, unknown>) ?? {}),
          ...((pkg['devDependencies'] as Record<string, unknown>) ?? {}),
        };
        for (const dep of Object.keys(deps)) {
          const depName = dep.replace('@letbuyy/', '');
          const depLayer = inferLayer(depName);
          if (forbidden.has(depLayer)) {
            violations.push({ violator: svc.name, violatorLayer: layer, dependency: dep, dependencyLayer: depLayer });
          }
        }
      }
    }

    return { valid: violations.length === 0, violationCount: violations.length, violations };
  }

  /** Honest absence — returned when a required artifact is missing. */
  #missing(kind: Explanation['kind'], subject: string, artifact: string): Explanation {
    return {
      subject,
      kind,
      summary: `Cannot explain: artifact '${artifact}.json' is not available. Run 'pnpm graph:omega' to generate it.`,
      evidence: [
        evidence('not-connected', `graphify-out/${artifact}.json`, `NOT CONNECTED — generate with pnpm graph:omega`, 'graphify-out/'),
      ],
    };
  }
}
