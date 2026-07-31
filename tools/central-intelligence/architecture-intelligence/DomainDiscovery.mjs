/**
 * DomainDiscovery.mjs — LCIS Architecture Intelligence
 * Loads the 22 LetBuyy business domains from domain-intel.json and exposes
 * cross-domain coupling analysis, money-domain identification, and evolution tracking.
 */

import { readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

// Canonical money tables per CLAUDE.md (18 money tables)
const MONEY_TABLES = new Set([
  'orders', 'order_items', 'payment_transactions', 'refunds', 'payouts',
  'gift_card_accounts', 'gift_card_ledger_entries', 'gift_card_redemptions',
  'shipping_rates', 'checkout_sessions', 'checkout_line_items',
  'billing_subscriptions', 'billing_invoices', 'payout_accounts',
  'store_credits', 'discount_allocations', 'tax_lines', 'ledger_entries',
]);

async function readJsonSafe(fp) {
  try { return JSON.parse(await readFile(fp, 'utf8')); } catch { return null; }
}
async function exists(p) { try { await stat(p); return true; } catch { return false; } }

class DomainDiscovery {
  #data = null;
  #domains = null;       // Map<key, domain>
  #edges = null;         // cross-domain edges array
  #priorSnapshot = null;

  async #load() {
    if (this.#data) return;
    const p = join(REPO_ROOT, 'graphify-out', 'domain-intel.json');
    this.#data = await readJsonSafe(p);
    if (!this.#data) {
      this.#data = { summary: null, domains: [], edges: [], rules: [] };
    }

    this.#domains = new Map();
    const rawDomains = this.#data.domains ?? [];
    for (const d of rawDomains) {
      this.#domains.set(d.key, d);
    }

    // edges may be in data.edges or derived from dependsOn/consumedBy fields
    if (Array.isArray(this.#data.edges) && this.#data.edges.length > 0) {
      this.#edges = this.#data.edges;
    } else {
      // Build synthetic edges from dependsOn fields
      this.#edges = [];
      for (const d of rawDomains) {
        for (const dep of (d.dependsOn ?? [])) {
          this.#edges.push({ from: d.key, to: dep.domain, strength: dep.strength ?? 1, type: 'depends-on' });
        }
        for (const con of (d.consumedBy ?? [])) {
          this.#edges.push({ from: con.domain, to: d.key, strength: con.strength ?? 1, type: 'consumed-by' });
        }
      }
      // deduplicate
      const seen = new Set();
      this.#edges = this.#edges.filter(e => {
        const key = `${e.from}→${e.to}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Try to load prior snapshot for evolution tracking
    const latestPath = join(REPO_ROOT, 'graphify-out', 'architecture-snapshots', 'latest.json');
    if (await exists(latestPath)) {
      const latest = await readJsonSafe(latestPath);
      this.#priorSnapshot = latest?.domains ?? null;
    }
  }

  async discover() {
    await this.#load();
    const result = {};
    for (const [key, domain] of this.#domains.entries()) {
      result[key] = domain;
    }
    return result;
  }

  async getDomain(key) {
    await this.#load();
    return this.#domains.get(key) ?? null;
  }

  async getCrossDomainEdges() {
    await this.#load();
    return this.#edges;
  }

  async getCoupling() {
    await this.#load();
    const domainCount = this.#domains.size;
    if (domainCount <= 1) return { rate: 0, edgeCount: 0, domainCount, density: 0 };
    const maxPossibleEdges = domainCount * (domainCount - 1);
    const edgeCount = this.#edges.length;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    // Coupling per domain: (in-degree + out-degree) / (2 * (N-1))
    const inDegree = new Map();
    const outDegree = new Map();
    for (const e of this.#edges) {
      outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
      inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    }

    const perDomain = [];
    for (const [key] of this.#domains.entries()) {
      const out = outDegree.get(key) ?? 0;
      const inn = inDegree.get(key) ?? 0;
      perDomain.push({ domain: key, outDegree: out, inDegree: inn, totalEdges: out + inn });
    }
    perDomain.sort((a, b) => b.totalEdges - a.totalEdges);

    const avgCoupling = domainCount > 0
      ? perDomain.reduce((s, d) => s + d.totalEdges, 0) / domainCount
      : 0;

    return {
      rate: density,
      edgeCount,
      domainCount,
      density: Math.round(density * 10000) / 100,  // as %
      averageCouplingPerDomain: Math.round(avgCoupling * 100) / 100,
      highCouplingDomains: perDomain.filter(d => d.totalEdges >= 4),
      perDomain,
    };
  }

  async getMoneyDomains() {
    await this.#load();
    const moneyDomains = [];
    for (const [key, domain] of this.#domains.entries()) {
      const tables = domain.tables ?? [];
      const moneyTableHits = tables.filter(t => MONEY_TABLES.has(t));
      const isMoney = domain.money === true || moneyTableHits.length > 0;
      if (isMoney) {
        moneyDomains.push({
          key,
          label: domain.label,
          money: domain.money,
          moneyTables: moneyTableHits,
          rpcs: domain.rpcs ?? [],
          riskLevel: moneyTableHits.length >= 3 ? 'critical' : moneyTableHits.length >= 1 ? 'high' : 'medium',
        });
      }
    }
    return moneyDomains.sort((a, b) => b.moneyTables.length - a.moneyTables.length);
  }

  async getDomainEvolution() {
    await this.#load();
    if (!this.#priorSnapshot) {
      return {
        available: false,
        message: 'No prior architecture snapshot found. Run capture() to start tracking evolution.',
        current: this.#domains.size,
      };
    }

    const currentKeys = new Set(this.#domains.keys());
    const priorKeys = new Set(Object.keys(this.#priorSnapshot));

    const added = [...currentKeys].filter(k => !priorKeys.has(k));
    const removed = [...priorKeys].filter(k => !currentKeys.has(k));
    const changed = [];

    for (const key of currentKeys) {
      if (!priorKeys.has(key)) continue;
      const current = this.#domains.get(key);
      const prior = this.#priorSnapshot[key];
      const diffs = [];
      if ((current.tables?.length ?? 0) !== (prior.tables?.length ?? 0)) {
        diffs.push({ field: 'tables', before: prior.tables?.length ?? 0, after: current.tables?.length ?? 0 });
      }
      if ((current.rpcs?.length ?? 0) !== (prior.rpcs?.length ?? 0)) {
        diffs.push({ field: 'rpcs', before: prior.rpcs?.length ?? 0, after: current.rpcs?.length ?? 0 });
      }
      if ((current.routes?.length ?? 0) !== (prior.routes?.length ?? 0)) {
        diffs.push({ field: 'routes', before: prior.routes?.length ?? 0, after: current.routes?.length ?? 0 });
      }
      if (diffs.length > 0) changed.push({ domain: key, diffs });
    }

    return {
      available: true,
      priorDomainCount: priorKeys.size,
      currentDomainCount: currentKeys.size,
      added,
      removed,
      changed,
      stable: added.length === 0 && removed.length === 0 && changed.length === 0,
    };
  }
}

export default new DomainDiscovery();
