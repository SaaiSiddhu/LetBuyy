/**
 * ArchitectureSnapshotService.mjs — LCIS Architecture Intelligence
 * Captures full architecture snapshots by combining all four discovery modules
 * and persists them to graphify-out/architecture-snapshots/.
 */

import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const SNAPSHOTS_DIR = join(REPO_ROOT, 'graphify-out', 'architecture-snapshots');

async function readJsonSafe(fp) {
  try { return JSON.parse(await readFile(fp, 'utf8')); } catch { return null; }
}
async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function ensureDir(dir) {
  try { await mkdir(dir, { recursive: true }); } catch { /* already exists */ }
}

async function getGitHead() {
  try {
    const { stdout } = await execFileP('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

async function getGitBranch() {
  try {
    const { stdout } = await execFileP('git', ['-C', REPO_ROOT, 'rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

// Lazy imports to avoid circular dependency issues
async function getServiceDiscovery() {
  const m = await import('./ServiceDiscovery.mjs');
  return m.default;
}
async function getDependencyDiscovery() {
  const m = await import('./DependencyDiscovery.mjs');
  return m.default;
}
async function getLayerDiscovery() {
  const m = await import('./LayerDiscovery.mjs');
  return m.default;
}
async function getDomainDiscovery() {
  const m = await import('./DomainDiscovery.mjs');
  return m.default;
}

class ArchitectureSnapshotService {
  async capture() {
    const [gitHead, gitBranch] = await Promise.all([getGitHead(), getGitBranch()]);

    const [sd, dd, ld, dom] = await Promise.all([
      getServiceDiscovery(),
      getDependencyDiscovery(),
      getLayerDiscovery(),
      getDomainDiscovery(),
    ]);

    const [services, dependencies, layers, domains, layerValidation, coupling, moneyDomains] = await Promise.all([
      sd.discover(),
      dd.discover(),
      ld.discover(),
      dom.discover(),
      ld.validateLayering(),
      dom.getCoupling(),
      dom.getMoneyDomains(),
    ]);

    const crossDomainEdges = await dom.getCrossDomainEdges();
    const highBlastRadius = await dd.getHighBlastRadius();
    const layerDeps = await ld.getLayerDependencies();

    // Compute stats
    const serviceList = Object.values(services);
    const canonicalCount = serviceList.filter(s => s.status === 'canonical').length;
    const workerCount = serviceList.filter(s => s.type === 'worker').length;
    const appCount = serviceList.filter(s => s.type === 'vercel-app').length;
    const packageCount = serviceList.filter(s => s.type === 'package').length;
    const domainList = Object.values(domains);

    const snapshot = {
      capturedAt: new Date().toISOString(),
      gitHead,
      gitBranch,
      services,
      dependencies,
      layers,
      layerDependencies: layerDeps,
      layerValidation,
      domains,
      crossDomainEdges,
      moneyDomains,
      coupling,
      highBlastRadius: highBlastRadius.slice(0, 15),  // top 15
      stats: {
        totalServices: serviceList.length,
        canonicalRuntimes: canonicalCount,
        workerCount,
        vercelAppCount: appCount,
        packageCount,
        domainCount: domainList.length,
        crossDomainEdgeCount: crossDomainEdges.length,
        moneyDomainCount: moneyDomains.length,
        layerViolationCount: layerValidation.violationCount,
        highBlastRadiusCount: highBlastRadius.filter(p => p.blastRadius === 'high').length,
        dependencyCount: Object.keys(dependencies).length,
      },
    };

    return snapshot;
  }

  async save(snapshot) {
    await ensureDir(SNAPSHOTS_DIR);
    const ts = new Date(snapshot.capturedAt).toISOString().replace(/[:.]/g, '-');
    const timestampedPath = join(SNAPSHOTS_DIR, `${ts}.json`);
    const latestPath = join(SNAPSHOTS_DIR, 'latest.json');
    const content = JSON.stringify(snapshot, null, 2);
    await Promise.all([
      writeFile(timestampedPath, content, 'utf8'),
      writeFile(latestPath, content, 'utf8'),
    ]);
    return { timestampedPath, latestPath, timestamp: ts };
  }

  async getLatest() {
    const latestPath = join(SNAPSHOTS_DIR, 'latest.json');
    if (!await exists(latestPath)) return null;
    return readJsonSafe(latestPath);
  }

  async list() {
    await ensureDir(SNAPSHOTS_DIR);
    let files = [];
    try { files = await readdir(SNAPSHOTS_DIR); } catch { return []; }
    return files
      .filter(f => f !== 'latest.json' && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => ({
        filename: f,
        timestamp: f.replace('.json', '').replace(/-/g, (m, i) => i < 10 ? '-' : ':'),
        path: join(SNAPSHOTS_DIR, f),
      }));
  }

  async get(timestamp) {
    // Accept either the raw timestamp string or the filename
    const filename = timestamp.endsWith('.json') ? timestamp : `${timestamp}.json`;
    const snapshotPath = join(SNAPSHOTS_DIR, filename);
    if (!await exists(snapshotPath)) return null;
    return readJsonSafe(snapshotPath);
  }
}

export default new ArchitectureSnapshotService();
