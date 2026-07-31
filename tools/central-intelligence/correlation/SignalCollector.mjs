/**
 * LCIS Phase 16 — SignalCollector
 *
 * Gathers signals from every LCIS subsystem within a time window.
 * All subsystem imports are lazy and optional — Promise.allSettled everywhere.
 * Each signal carries a `connected` flag: false when the subsystem is
 * unavailable or the live data source is NOT CONNECTED.
 *
 * Signal shape:
 *   { subsystem, type, timestamp, payload, connected: bool }
 */

import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GRAPHIFY_OUT = resolve(REPO_ROOT, 'graphify-out');

const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Read a JSON file from graphify-out; returns null on any error. */
function readOut(name) {
  try {
    const p = resolve(GRAPHIFY_OUT, name);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Fetch from LCIS V1 with a short timeout; returns null on failure. */
async function fetchLCIS(path, params = {}) {
  try {
    const url = new URL(LCIS_BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Lazy-import a module; returns null on failure. */
async function tryImport(rel) {
  try {
    const m = await import(new URL(rel, import.meta.url).href);
    return m.default ?? null;
  } catch {
    return null;
  }
}

/** Unix ms → ISO string. */
function iso(ts) {
  return new Date(typeof ts === 'number' ? ts : Date.now()).toISOString();
}

// ── Signal factory helpers ─────────────────────────────────────────────────

function signal(subsystem, type, payload, connected = true, timestamp = Date.now()) {
  return { subsystem, type, timestamp: iso(timestamp), payload, connected };
}

function disconnected(subsystem, type, reason) {
  return signal(subsystem, type, { reason, note: 'NOT CONNECTED — live source unavailable' }, false);
}

// ─────────────────────────────────────────────────────────────────────────────

class SignalCollector {

  /**
   * Gather ALL signals across every subsystem within a time window.
   * @param {{ windowMs?: number }} [options]
   * @returns {Promise<Array<{subsystem:string,type:string,timestamp:string,payload:unknown,connected:boolean}>>}
   */
  async collectAll({ windowMs = 30 * 60 * 1000 } = {}) {
    const results = await Promise.allSettled([
      this.collectIncidents({ windowMs }),
      this.collectAnomalies(),
      this.collectDeployments(),
      this.collectArchitectureDrift(),
      this.collectDependencySignals(),
      this.collectMetrics(),
      this._collectMemorySignals(),
      this._collectKnowledgeSignals(),
      this._collectGraphSignals(),
    ]);

    const signals = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        signals.push(...r.value);
      }
    }
    return signals;
  }

  // ── Incidents ─────────────────────────────────────────────────────────────

  /**
   * Read incidents from graphify-out/incidents.jsonl (written by IncidentDetectionService).
   * Falls back to the IncidentDetectionService in-memory log if the file is missing.
   * @param {{ windowMs?: number }} options
   */
  async collectIncidents({ windowMs = 30 * 60 * 1000 } = {}) {
    const since = Date.now() - windowMs;
    const signals = [];

    // Primary: incidents.jsonl written by IncidentDetectionService
    const incidentsFile = resolve(GRAPHIFY_OUT, 'incidents.jsonl');
    if (existsSync(incidentsFile)) {
      await new Promise((res) => {
        const rl = createInterface({ input: createReadStream(incidentsFile, 'utf8') });
        rl.on('line', (line) => {
          if (!line.trim()) return;
          try {
            const inc = JSON.parse(line);
            const ts = new Date(inc.detectedAt ?? inc.timestamp ?? 0).getTime();
            if (ts >= since) {
              signals.push(signal('IncidentDetectionService', 'incident', inc, true, ts));
            }
          } catch { /* malformed line — skip */ }
        });
        rl.on('close', res);
        rl.on('error', res);
      });
      if (signals.length > 0) return signals;
    }

    // Secondary: in-memory via the service module
    const svc = await tryImport('../observability/IncidentDetectionService.mjs');
    if (svc && typeof svc.getActiveIncidents === 'function') {
      const active = await svc.getActiveIncidents().catch(() => []);
      for (const inc of (active ?? [])) {
        const ts = new Date(inc.detectedAt ?? Date.now()).getTime();
        if (ts >= since) {
          signals.push(signal('IncidentDetectionService', 'incident', inc, true, ts));
        }
      }
      return signals;
    }

    // Tertiary: graphify-out/incident-intelligence-v5.json (static snapshot)
    const snap = readOut('incident-intelligence-v5.json');
    if (snap) {
      signals.push(signal('IncidentDetectionService', 'incident_snapshot', snap, false));
    } else {
      signals.push(disconnected('IncidentDetectionService', 'incidents', 'incidents.jsonl not found and service not reachable'));
    }
    return signals;
  }

  // ── Anomalies ─────────────────────────────────────────────────────────────

  /**
   * Collect anomaly signals from AnomalyDetectionService.
   */
  async collectAnomalies() {
    const svc = await tryImport('../observability/AnomalyDetectionService.mjs');
    if (svc && typeof svc.getAnomalyLog === 'function') {
      const log = svc.getAnomalyLog();
      if (log && log.length > 0) {
        return log.map((a) =>
          signal('AnomalyDetectionService', 'anomaly', a, true, new Date(a.detectedAt ?? Date.now()).getTime())
        );
      }
    }

    // Fallback: telemetry-intelligence.json
    const snap = readOut('telemetry-intelligence.json');
    if (snap?.anomalies?.length) {
      return snap.anomalies.map((a) =>
        signal('AnomalyDetectionService', 'anomaly_snapshot', a, false)
      );
    }

    return [disconnected('AnomalyDetectionService', 'anomalies', 'AnomalyDetectionService not reachable — live metrics NOT CONNECTED (source: OpenTelemetry collector / Analytics Engine)')];
  }

  // ── Deployments ───────────────────────────────────────────────────────────

  /**
   * Collect deployment signals from V1 LCIS /api/deployment-state + git log.
   */
  async collectDeployments() {
    const signals = [];

    // V1 LCIS deployment-state
    const lcisState = await fetchLCIS('/api/deployment-state');
    if (lcisState) {
      signals.push(signal('LCIS_V1', 'deployment_state', lcisState, true));
    }

    // Local graphify-out snapshot
    const snap = readOut('deployment-state.json');
    if (snap) {
      signals.push(signal('LCIS_V1', 'deployment_state_snapshot', snap, lcisState == null));
    }

    // git log — recent commits as deployment signals
    try {
      const { execSync } = await import('node:child_process');
      const raw = execSync(
        'git -C "$REPO_ROOT" log --format=\'{"hash":"%H","subject":"%s","author":"%an","date":"%aI"}\' -20',
        {
          env: { ...process.env, REPO_ROOT },
          shell: true,
          encoding: 'utf8',
          timeout: 5000,
          cwd: REPO_ROOT,
        }
      );
      const commits = raw
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);
      if (commits.length) {
        signals.push(signal('GitHistory', 'recent_commits', { commits }, true));
      }
    } catch {
      signals.push(disconnected('GitHistory', 'recent_commits', 'git log failed'));
    }

    if (signals.length === 0) {
      signals.push(disconnected('DeploymentService', 'deployment', 'LCIS V1 not reachable and no snapshot — source: /api/deployment-state'));
    }
    return signals;
  }

  // ── Architecture Drift ────────────────────────────────────────────────────

  /**
   * Collect architecture drift signals from ArchitectureDriftDetector.
   */
  async collectArchitectureDrift() {
    const detector = await tryImport('../architecture-intelligence/ArchitectureDriftDetector.mjs');
    if (detector && typeof detector.detectDrift === 'function') {
      // Fetch two most recent snapshots via the snapshot service
      const snapSvc = await tryImport('../architecture-intelligence/ArchitectureSnapshotService.mjs');
      if (snapSvc && typeof snapSvc.listSnapshots === 'function') {
        const snapshots = await snapSvc.listSnapshots().catch(() => []);
        if (snapshots.length >= 2) {
          const [latest, prev] = snapshots;
          const drift = detector.detectDrift(prev, latest);
          return [signal('ArchitectureDriftDetector', 'drift', drift, true)];
        }
      }
    }

    // Fallback: pre-computed snapshots directory
    const snapDir = resolve(GRAPHIFY_OUT, 'architecture-snapshots');
    if (existsSync(snapDir)) {
      try {
        const { readdirSync } = await import('node:fs');
        const files = readdirSync(snapDir)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .reverse()
          .slice(0, 2);
        if (files.length >= 2) {
          const [a, b] = files.map((f) => {
            try { return JSON.parse(readFileSync(resolve(snapDir, f), 'utf8')); } catch { return null; }
          });
          if (a && b) {
            const detector2 = await tryImport('../architecture-intelligence/ArchitectureDriftDetector.mjs');
            if (detector2 && typeof detector2.detectDrift === 'function') {
              const drift = detector2.detectDrift(b, a);
              return [signal('ArchitectureDriftDetector', 'drift', drift, true)];
            }
          }
        }
      } catch { /* fall through */ }
    }

    return [disconnected('ArchitectureDriftDetector', 'drift', 'No snapshots available — run pnpm graph:arch to generate')];
  }

  // ── Dependency Signals ────────────────────────────────────────────────────

  /**
   * Collect dependency signals for a specific component (or the whole graph).
   * @param {string} [component]
   */
  async collectDependencySignals(component) {
    const signals = [];

    const builder = await tryImport('../context-intelligence/DependencyGraphBuilder.mjs');
    if (builder && typeof builder.buildGraph === 'function') {
      const graph = await builder.buildGraph().catch(() => null);
      if (graph) {
        const payload = component
          ? { component, nodes: graph.nodes?.filter((n) => n.id === component || n.name === component), edges: graph.edges?.filter((e) => e.source === component || e.target === component) }
          : { nodeCount: graph.nodes?.length ?? 0, edgeCount: graph.edges?.length ?? 0, summary: 'full dependency graph' };
        signals.push(signal('DependencyGraphBuilder', 'dependency_graph', payload, true));
        return signals;
      }
    }

    // Fallback: graphify-out/graph.json
    const g = readOut('graph.json');
    if (g) {
      const payload = component
        ? { component, note: 'filtered from snapshot' }
        : { nodeCount: Object.keys(g.nodes ?? g.entities ?? {}).length, note: 'from graphify-out/graph.json snapshot' };
      signals.push(signal('DependencyGraphBuilder', 'dependency_graph_snapshot', payload, false));
      return signals;
    }

    signals.push(disconnected('DependencyGraphBuilder', 'dependencies', 'Dependency graph not built — source: graphify-out/context-intelligence/dependency-graph.json'));
    return signals;
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  /**
   * Collect observability metrics.
   * Live values are NOT CONNECTED — marks exact source.
   */
  async collectMetrics() {
    const signals = [];

    // Try HealthService
    const healthSvc = await tryImport('../observability/HealthService.mjs');
    if (healthSvc && typeof healthSvc.getHealthSummary === 'function') {
      const health = await healthSvc.getHealthSummary().catch(() => null);
      if (health) {
        signals.push(signal('HealthService', 'health_summary', health, true));
      }
    }

    // Try MetricsService
    const metricsSvc = await tryImport('../observability/MetricsService.mjs');
    if (metricsSvc && typeof metricsSvc.getMetrics === 'function') {
      const metrics = await metricsSvc.getMetrics().catch(() => null);
      if (metrics) {
        signals.push(signal('MetricsService', 'metrics', metrics, true));
        return signals;
      }
    }

    // LCIS V1 /api/live-metrics
    const live = await fetchLCIS('/api/live-metrics');
    if (live) {
      signals.push(signal('LCIS_V1', 'live_metrics', live, false)); // connected=false: values may be NOT CONNECTED in LCIS itself
      return signals;
    }

    // Static snapshot
    const snap = readOut('runtime-observability.json') ?? readOut('runtime-intel.json');
    if (snap) {
      signals.push(signal('MetricsService', 'metrics_snapshot', snap, false));
      return signals;
    }

    signals.push(disconnected('MetricsService', 'metrics',
      'NOT CONNECTED — live values require Cloudflare Analytics Engine (env: CF_ANALYTICS_API_KEY) or OpenTelemetry collector'));
    return signals;
  }

  // ── Memory Signals (private) ───────────────────────────────────────────────

  async _collectMemorySignals() {
    const retriever = await tryImport('../memory-engine/MemoryRetriever.mjs');
    if (retriever && typeof retriever.retrieve === 'function') {
      // Retrieve recent memory about incidents and system state
      const results = await retriever.retrieve('incident deployment anomaly failure', {
        limit: 10,
        minScore: 0.35,
      }).catch(() => []);
      if (results?.length) {
        return [signal('MemoryRetriever', 'memory_context', { memories: results }, true)];
      }
    }

    const snap = readOut('memory-v2.json') ?? readOut('memory-intel.json');
    if (snap) {
      return [signal('MemoryRetriever', 'memory_snapshot', snap, false)];
    }

    return [disconnected('MemoryRetriever', 'memory', 'Memory engine not reachable — source: Qdrant vector store')];
  }

  // ── Knowledge Signals (private) ───────────────────────────────────────────

  async _collectKnowledgeSignals() {
    const kas = await tryImport('../knowledge-engine/KnowledgeAcquisitionService.mjs');
    if (kas && typeof kas.getRecentChanges === 'function') {
      const changes = await kas.getRecentChanges({ limit: 20 }).catch(() => null);
      if (changes) {
        return [signal('KnowledgeAcquisitionService', 'knowledge_changes', changes, true)];
      }
    }

    const snap = readOut('knowledge-graphs.json');
    if (snap) {
      return [signal('KnowledgeAcquisitionService', 'knowledge_snapshot', { summary: 'from graphify-out/knowledge-graphs.json' }, false)];
    }

    return [disconnected('KnowledgeAcquisitionService', 'knowledge', 'KnowledgeAcquisitionService not reachable')];
  }

  // ── Graph Signals (private) ────────────────────────────────────────────────

  async _collectGraphSignals() {
    const explorer = await tryImport('../graph-engine/GraphExplorer.mjs');
    if (explorer && typeof explorer.queryLocal === 'function') {
      const context = await explorer.queryLocal('what are the highest risk payment and checkout paths', { maxResults: 5 }).catch(() => null);
      if (context) {
        return [signal('GraphExplorer', 'graph_context', context, true)];
      }
    }

    // Domain intel snapshot
    const domain = readOut('domain-intel.json');
    if (domain) {
      return [signal('GraphExplorer', 'domain_snapshot', { domainCount: Array.isArray(domain) ? domain.length : Object.keys(domain).length }, false)];
    }

    return [disconnected('GraphExplorer', 'graph', 'GraphExplorer not reachable — source: graphify-out/graph.json')];
  }
}

export default new SignalCollector();
