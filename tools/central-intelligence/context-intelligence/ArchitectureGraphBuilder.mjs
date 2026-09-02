/**
 * LCIS Context Intelligence — ArchitectureGraphBuilder
 *
 * Builds the architecture-level graph from:
 *   • graphify-out/infra-intel.json   — runtimes / workers / queues / services
 *   • graphify-out/domain-intel.json  — 22 business domains + cross-domain edges
 *
 * Output nodes = services | domains | queues | workers
 * Output edges = belongs-to | processes | depends-on | cross-domain
 *
 * Layers (logical tiers):
 *   edge      — customer-facing runtimes (storefront, identity, merchant UI)
 *   gateway   — API gateway + mobile BFF
 *   async     — queue workers, webhook service
 *   data      — domains / database (the logical data plane)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const INFRA_PATH = resolve(REPO_ROOT, 'graphify-out/infra-intel.json');
const DOMAIN_PATH = resolve(REPO_ROOT, 'graphify-out/domain-intel.json');
const OUT_DIR = resolve(REPO_ROOT, 'graphify-out/context-intelligence');
const CACHE_PATH = resolve(OUT_DIR, 'architecture-graph.json');

/** Canonical layer assignment for known service names */
const LAYER_MAP = {
  'letbuyy-api': 'gateway',
  'letbuyy-queue-workers': 'async',
  'letbuyy-webhook': 'async',
  'letbuyy-mobile-bff': 'gateway',
  'marketing-site': 'edge',
  'identity-platform': 'edge',
  'merchant-web': 'edge',
  'customer-web': 'edge',
  'admin-web': 'edge',
};

/**
 * Derive a human-readable service node id from a wrangler.toml file path
 * or Vercel app name.
 */
function serviceId(name) {
  return name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}

class ArchitectureGraphBuilder {
  constructor() {
    /** @type {object[]} */
    this._nodes = null;
    /** @type {object[]} */
    this._edges = null;
    /** @type {object[]} */
    this._domains = null;
    /** @type {object[]} */
    this._services = null;
    this._built = false;
  }

  build() {
    if (this._built) return this;

    const nodes = [];
    const edges = [];
    const nodeIds = new Set();

    const addNode = (id, type, label, layer, meta = {}) => {
      if (nodeIds.has(id)) return;
      nodeIds.add(id);
      nodes.push({ id, type, label, layer, ...meta });
    };

    const addEdge = (from, to, relation, meta = {}) => {
      if (!nodeIds.has(from) || !nodeIds.has(to)) return;
      edges.push({ from, to, relation, ...meta });
    };

    // ── infra-intel ────────────────────────────────────────────────────────
    let infra = { summary: {}, workers: [] };
    if (existsSync(INFRA_PATH)) {
      try { infra = JSON.parse(readFileSync(INFRA_PATH, 'utf8')); } catch { /* keep default */ }
    }

    // Cloudflare Workers
    for (const worker of (infra.workers || [])) {
      const id = serviceId(worker.name || worker.file);
      const layer = LAYER_MAP[worker.name] || 'async';
      addNode(id, 'worker', worker.name || id, layer, {
        file: worker.file,
        queuesConsumed: worker.queueConsumers || [],
        queuesProduced: worker.queueProducers || [],
        crons: worker.crons || [],
        r2: worker.r2 || [],
        hyperdrive: worker.hyperdrive || false,
      });

      // Queue producer edges
      for (const q of (worker.queueProducers || [])) {
        const qid = serviceId(q);
        addNode(qid, 'queue', q, 'async', { role: 'producer' });
        addEdge(id, qid, 'produces');
      }
      // Queue consumer edges
      for (const q of (worker.queueConsumers || [])) {
        const qid = serviceId(q);
        addNode(qid, 'queue', q, 'async', { role: 'consumer' });
        addEdge(id, qid, 'processes');
      }
    }

    // Vercel apps
    for (const appName of (infra.summary?.vercelApps || [])) {
      const id = serviceId(appName);
      const layer = LAYER_MAP[appName] || 'edge';
      addNode(id, 'service', appName, layer, { platform: 'vercel' });
    }

    // Gateway → worker depends-on edges (gateway calls workers via service bindings)
    const gatewayId = 'letbuyy-api';
    if (nodeIds.has(gatewayId)) {
      for (const w of (infra.workers || [])) {
        const wid = serviceId(w.name || w.file);
        if (wid !== gatewayId) addEdge(gatewayId, wid, 'depends-on');
      }
    }

    // Edge apps depend on gateway
    for (const appName of (infra.summary?.vercelApps || [])) {
      const appId = serviceId(appName);
      if (appId !== gatewayId && nodeIds.has(appId) && nodeIds.has(gatewayId)) {
        addEdge(appId, gatewayId, 'depends-on');
      }
    }

    // ── domain-intel ───────────────────────────────────────────────────────
    let domainData = { domains: [], edges: [] };
    if (existsSync(DOMAIN_PATH)) {
      try { domainData = JSON.parse(readFileSync(DOMAIN_PATH, 'utf8')); } catch { /* keep default */ }
    }

    this._domains = domainData.domains || [];

    for (const domain of this._domains) {
      const id = `domain:${domain.key}`;
      addNode(id, 'domain', domain.label || domain.key, 'data', {
        key: domain.key,
        tables: domain.tables || [],
        rpcs: domain.rpcs || [],
        routes: domain.routes || [],
        money: domain.money || false,
        tenant: domain.tenant || false,
      });
    }

    // Cross-domain edges from domain-intel
    for (const edge of (domainData.edges || [])) {
      const fromId = `domain:${edge.from}`;
      const toId = `domain:${edge.to}`;
      if (nodeIds.has(fromId) && nodeIds.has(toId)) {
        addEdge(fromId, toId, 'cross-domain', {
          via: edge.via || [],
          strength: edge.strength || 1,
        });
      }
    }

    // Service → domain belongs-to via route ownership
    // (best-effort: match domain.routes prefixes to known service names)
    const routeToService = {
      // heuristic map: route prefix → service id
      themes: 'letbuyy-api',
      products: 'letbuyy-api',
      orders: 'letbuyy-api',
      payments: 'letbuyy-api',
    };
    for (const domain of this._domains) {
      for (const route of (domain.routes || [])) {
        const svcId = routeToService[route] || 'letbuyy-api';
        if (nodeIds.has(svcId)) {
          const domId = `domain:${domain.key}`;
          if (nodeIds.has(domId)) addEdge(svcId, domId, 'belongs-to');
        }
      }
    }

    this._nodes = nodes;
    this._edges = edges;
    this._services = nodes.filter(n => n.type === 'worker' || n.type === 'service');
    this._built = true;
    return this;
  }

  /** @returns {object[]} service/worker nodes */
  getServices() {
    this._requireBuilt();
    return this._services;
  }

  /** @returns {object[]} domain nodes */
  getDomains() {
    this._requireBuilt();
    return this._nodes.filter(n => n.type === 'domain');
  }

  /**
   * Direct dependencies of a service (what it produces/depends-on/processes).
   * @param {string} serviceIdOrName
   * @returns {{node:object, relation:string}[]}
   */
  getServiceDependencies(serviceIdOrName) {
    this._requireBuilt();
    const id = serviceId(serviceIdOrName);
    const nodeMap = new Map(this._nodes.map(n => [n.id, n]));
    return this._edges
      .filter(e => e.from === id || e.from === serviceIdOrName)
      .map(e => ({ node: nodeMap.get(e.to), relation: e.relation }))
      .filter(x => x.node);
  }

  /**
   * Returns cross-domain coupling matrix.
   * @returns {Array<{from:string, to:string, via:string[], strength:number}>}
   */
  getDomainCoupling() {
    this._requireBuilt();
    return this._edges
      .filter(e => e.relation === 'cross-domain')
      .map(e => ({
        from: e.from.replace('domain:', ''),
        to: e.to.replace('domain:', ''),
        via: e.via || [],
        strength: e.strength || 1,
      }));
  }

  /**
   * Group nodes by architectural layer.
   * @returns {{edge:object[], gateway:object[], async:object[], data:object[]}}
   */
  getLayers() {
    this._requireBuilt();
    const layers = { edge: [], gateway: [], async: [], data: [] };
    for (const node of this._nodes) {
      const l = node.layer || 'data';
      (layers[l] = layers[l] || []).push(node);
    }
    return layers;
  }

  getStats() {
    if (!this._built) {
      return {
        status: 'NOT_BUILT',
        artifacts: ['graphify-out/infra-intel.json', 'graphify-out/domain-intel.json'],
        command: 'pnpm graph:infra && pnpm graph:domain  (or: pnpm graph:v3)',
      };
    }
    const typeCounts = {};
    for (const n of this._nodes) typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    const relCounts = {};
    for (const e of this._edges) relCounts[e.relation] = (relCounts[e.relation] || 0) + 1;
    return {
      nodeCount: this._nodes.length,
      edgeCount: this._edges.length,
      byType: typeCounts,
      byRelation: relCounts,
      layerCounts: Object.fromEntries(
        Object.entries(this.getLayers()).map(([l, ns]) => [l, ns.length])
      ),
    };
  }

  cache() {
    this._requireBuilt();
    mkdirSync(OUT_DIR, { recursive: true });
    const payload = {
      generatedAt: new Date().toISOString(),
      stats: this.getStats(),
      nodes: this._nodes,
      edges: this._edges,
      layers: this.getLayers(),
      domainCoupling: this.getDomainCoupling(),
    };
    writeFileSync(CACHE_PATH, JSON.stringify(payload), 'utf8');
    return { written: CACHE_PATH, stats: payload.stats };
  }

  _requireBuilt() {
    if (!this._built) {
      throw {
        status: 'NOT_BUILT',
        command: 'Call ArchitectureGraphBuilder.build() first.',
      };
    }
  }
}

export default new ArchitectureGraphBuilder();
