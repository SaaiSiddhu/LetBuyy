/**
 * LCIS Autonomous Operations — DriftDetector
 *
 * Detects three categories of drift:
 *   1. Architecture drift — via ArchitectureDriftDetector.detectDriftFromLatest()
 *   2. Dependency drift — new high-blast-radius packages since last snapshot
 *   3. Config drift — wrangler.toml / .env declarations vs stored snapshot
 *
 * All structural detections are CONNECTED (topology from code graph).
 * Live runtime values (active worker counts, live env vars) are NOT CONNECTED.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// ── Lazy import helpers ───────────────────────────────────────────────────────

async function getArchitectureDriftDetector() {
  try {
    const m = await import('../architecture-intelligence/ArchitectureDriftDetector.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

// ── Config snapshot helpers ───────────────────────────────────────────────────

const CONFIG_SNAPSHOT_PATH = path.join(REPO_ROOT, 'graphify-out', 'autonomous-operations', 'config-snapshot.json');

/**
 * Discover all wrangler.toml files in the repository.
 * @returns {string[]}
 */
function findWranglerConfigs() {
  const results = [];
  const searchRoots = ['apps', 'services', 'workers'];
  for (const root of searchRoots) {
    const rootPath = path.join(REPO_ROOT, root);
    if (!fs.existsSync(rootPath)) continue;
    try {
      const entries = fs.readdirSync(rootPath);
      for (const entry of entries) {
        const entryPath = path.join(rootPath, entry);
        const wranglerPath = path.join(entryPath, 'wrangler.toml');
        if (fs.existsSync(wranglerPath)) results.push(wranglerPath);
        const wranglerJsoncPath = path.join(entryPath, 'wrangler.jsonc');
        if (fs.existsSync(wranglerJsoncPath)) results.push(wranglerJsoncPath);
      }
    } catch {
      // Non-fatal
    }
  }
  return results;
}

/**
 * Extract binding/var names from a wrangler.toml string (lightweight, no TOML dep).
 * @param {string} content
 * @returns {{ bindings: string[], vars: string[], kv: string[], d1: string[], queues: string[] }}
 */
function parseWranglerBindings(content) {
  const bindings = [];
  const vars = [];
  const kv = [];
  const d1 = [];
  const queues = [];

  for (const line of content.split('\n')) {
    const t = line.trim();
    // binding = "NAME" or binding = 'NAME'
    const bindingMatch = t.match(/^binding\s*=\s*["']([^"']+)["']/);
    if (bindingMatch) bindings.push(bindingMatch[1]);
    // vars
    const varMatch = t.match(/^([A-Z_][A-Z0-9_]+)\s*=\s*/);
    if (varMatch && !t.startsWith('#')) vars.push(varMatch[1]);
    // kv_namespaces
    if (t.startsWith('[[kv_namespaces]]')) kv.push('kv_namespace');
    // d1_databases
    if (t.startsWith('[[d1_databases]]')) d1.push('d1_database');
    // queues
    if (t.startsWith('[[queues')) queues.push('queue');
  }

  return { bindings, vars, kv, d1, queues };
}

/**
 * Build a config summary from all discovered wrangler configs.
 * @returns {Record<string, object>}
 */
function captureConfigSummary() {
  const wranglerFiles = findWranglerConfigs();
  const summary = {};

  for (const filePath of wranglerFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relPath = filePath.replace(REPO_ROOT + '/', '');
      summary[relPath] = {
        capturedAt: new Date().toISOString(),
        ...parseWranglerBindings(content),
        sizeBytes: content.length,
      };
    } catch {
      // Skip unreadable files
    }
  }

  return summary;
}

// ── Main class ────────────────────────────────────────────────────────────────

class DriftDetector {
  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run all drift detectors and return the combined report.
   * @returns {Promise<import('./types.mjs').DriftReport>}
   */
  async detect() {
    const [architecture, dependency, config] = await Promise.allSettled([
      this.#detectArchitecture(),
      this.detectDependencyDrift(),
      this.detectConfigDrift(),
    ]);

    return {
      detectedAt: new Date().toISOString(),
      architecture: architecture.status === 'fulfilled' ? architecture.value : { error: architecture.reason?.message },
      dependency: dependency.status === 'fulfilled' ? dependency.value : { error: dependency.reason?.message },
      config: config.status === 'fulfilled' ? config.value : { error: config.reason?.message },
      overallDrift: this.#computeOverallDrift(
        architecture.status === 'fulfilled' ? architecture.value : null,
        dependency.status === 'fulfilled' ? dependency.value : null,
        config.status === 'fulfilled' ? config.value : null,
      ),
    };
  }

  /**
   * Architecture drift — delegates to ArchitectureDriftDetector.detectDriftFromLatest().
   * CONNECTED: topology is built from the code graph.
   * @returns {Promise<object>}
   */
  async #detectArchitecture() {
    const detector = await getArchitectureDriftDetector();
    if (!detector) {
      return {
        connected: false,
        error: 'ArchitectureDriftDetector unavailable',
        notConnectedReason: 'Module import failed',
      };
    }

    try {
      const result = await detector.detectDriftFromLatest();
      const report = detector.generateDriftReport(result.drift);
      return {
        connected: true,
        hasDrift: result.drift?.hasDrift ?? false,
        riskLevel: report.riskLevel,
        summary: report.summary,
        services: result.drift?.services ?? {},
        layers: result.drift?.layers ?? {},
        domains: result.drift?.domains ?? {},
        dependencies: result.drift?.dependencies ?? {},
        fromSnapshot: result.drift?.fromSnapshot,
        toSnapshot: result.drift?.toSnapshot,
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message,
        notConnectedReason: 'Architecture snapshot may not exist — run pnpm graph:infra to capture baseline',
      };
    }
  }

  /**
   * Dependency drift — new packages with high blast radius since last snapshot.
   * CONNECTED: uses architecture snapshot package data.
   * @returns {Promise<object>}
   */
  async detectDependencyDrift() {
    const detector = await getArchitectureDriftDetector();
    if (!detector) {
      return {
        connected: false,
        error: 'ArchitectureDriftDetector unavailable',
        newHighBlastDeps: [],
      };
    }

    try {
      const report = await detector.getArchitectureRiskReport();
      const blastRisks = (report.risks ?? []).filter(r => r.category === 'blast-radius');

      const newHighBlastDeps = blastRisks.map(r => ({
        package: r.subject,
        severity: r.severity,
        detail: r.detail,
        dependents: r.dependents ?? [],
        connected: true,
      }));

      // Check drift result for packages that grew in dependents
      let growingDeps = [];
      try {
        const driftResult = await detector.detectDriftFromLatest();
        growingDeps = (driftResult.drift?.dependencies?.newDependencies ?? []).map(d => ({
          package: d.package,
          dependentsBefore: d.before,
          dependentsAfter: d.after,
          delta: d.delta,
          severity: d.delta >= 5 ? 'high' : 'medium',
          connected: true,
        }));
      } catch {
        // No prior snapshot — first run
      }

      return {
        connected: true,
        newHighBlastDeps,
        growingDeps,
        totalHighBlastPackages: blastRisks.length,
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message,
        notConnectedReason: 'Architecture snapshot not available',
        newHighBlastDeps: [],
      };
    }
  }

  /**
   * Config drift — compare current wrangler.toml binding declarations against
   * a stored snapshot. On first run, saves the snapshot.
   * CONNECTED: reads filesystem; live deployed config is NOT CONNECTED.
   * @returns {Promise<object>}
   */
  async detectConfigDrift() {
    const current = captureConfigSummary();
    const fileCount = Object.keys(current).length;

    let previous = null;
    let isFirstRun = false;

    if (fs.existsSync(CONFIG_SNAPSHOT_PATH)) {
      try {
        previous = JSON.parse(fs.readFileSync(CONFIG_SNAPSHOT_PATH, 'utf8'));
      } catch {
        previous = null;
      }
    } else {
      isFirstRun = true;
    }

    // Persist current as new snapshot
    try {
      const dir = path.dirname(CONFIG_SNAPSHOT_PATH);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_SNAPSHOT_PATH, JSON.stringify(current, null, 2));
    } catch {
      // Non-fatal
    }

    if (isFirstRun || !previous) {
      return {
        connected: true,
        isFirstRun: true,
        fileCount,
        message: 'Config snapshot captured — drift detection active from next run',
        liveDeployedConfig: 'NOT CONNECTED — actual deployed bindings require wrangler API or Cloudflare API key',
      };
    }

    // Diff files
    const prevKeys = new Set(Object.keys(previous));
    const currKeys = new Set(Object.keys(current));

    const added = [...currKeys].filter(k => !prevKeys.has(k));
    const removed = [...prevKeys].filter(k => !currKeys.has(k));
    const changed = [];

    for (const key of [...currKeys].filter(k => prevKeys.has(k))) {
      const prev = previous[key];
      const curr = current[key];
      const diffs = [];

      for (const field of ['bindings', 'vars', 'kv', 'd1', 'queues']) {
        const pSet = new Set(prev[field] ?? []);
        const cSet = new Set(curr[field] ?? []);
        const addedItems = [...cSet].filter(x => !pSet.has(x));
        const removedItems = [...pSet].filter(x => !cSet.has(x));
        if (addedItems.length || removedItems.length) {
          diffs.push({ field, added: addedItems, removed: removedItems });
        }
      }

      if (curr.sizeBytes !== prev.sizeBytes) {
        diffs.push({ field: 'sizeBytes', before: prev.sizeBytes, after: curr.sizeBytes });
      }

      if (diffs.length > 0) changed.push({ file: key, diffs });
    }

    const hasDrift = added.length > 0 || removed.length > 0 || changed.length > 0;

    return {
      connected: true,
      hasDrift,
      fileCount,
      added,
      removed,
      changed,
      liveDeployedConfig: 'NOT CONNECTED — live Cloudflare Worker bindings require CLOUDFLARE_API_TOKEN',
    };
  }

  /**
   * Return a full drift report (alias for detect()).
   */
  async getDriftReport() {
    return this.detect();
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  #computeOverallDrift(arch, dep, config) {
    const hasDrift =
      arch?.hasDrift === true ||
      (dep?.newHighBlastDeps?.length ?? 0) > 0 ||
      (dep?.growingDeps?.length ?? 0) > 0 ||
      config?.hasDrift === true;

    const archRisk = arch?.riskLevel ?? 'unknown';
    if (archRisk === 'critical') return 'CRITICAL';
    if (archRisk === 'high') return 'HIGH';
    if (hasDrift) return 'MEDIUM';
    return 'STABLE';
  }
}

export default new DriftDetector();
