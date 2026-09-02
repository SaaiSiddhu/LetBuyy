/**
 * ServiceDiscovery.mjs — LCIS Architecture Intelligence
 * Discovers all services in the LetBuyy monorepo: Cloudflare Workers, Vercel apps, packages.
 * Sources: graphify-out/infra-intel.json + filesystem scan of apps/ services/ packages/.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

const CANONICAL_RUNTIMES = [
  'customer-web',
  'merchant-web',
  'identity-platform',
  'marketing-site',
  'admin-web',
  'api-gateway',
  'queue-workers',
  'webhook-service',
];

const RESERVED_RUNTIMES = [
  'mobile-bff',
  'checkout-runtime',
  'search-service',
  'media-service',
  'notification-service',
  'event-bus',
  'analytics-pipeline',
];

const FROZEN_APPS = [
  'app-marketplace',
  'developer-portal',
  'theme-marketplace',
  'platform-operations-portal',
];

async function readJsonSafe(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function scanPackageJson(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!await exists(pkgPath)) return null;
  return readJsonSafe(pkgPath);
}

async function scanWranglerToml(dir) {
  const wranglerPath = join(dir, 'wrangler.toml');
  if (!await exists(wranglerPath)) return null;
  try {
    const raw = await readFile(wranglerPath, 'utf8');
    const nameMatch = raw.match(/^name\s*=\s*["']?([^"'\s\r\n]+)["']?/m);
    return nameMatch ? nameMatch[1] : null;
  } catch {
    return null;
  }
}

class ServiceDiscovery {
  #services = null;
  #infraIntel = null;

  async #loadInfraIntel() {
    if (this.#infraIntel !== null) return this.#infraIntel;
    const p = join(REPO_ROOT, 'graphify-out', 'infra-intel.json');
    this.#infraIntel = await readJsonSafe(p) ?? { summary: null, workers: [], secrets: [], ownership: {} };
    return this.#infraIntel;
  }

  async discover() {
    if (this.#services) return this.#services;

    const infra = await this.#loadInfraIntel();
    const workersByFile = new Map();
    for (const w of (infra.workers ?? [])) {
      workersByFile.set(w.file.replace(/^.*\/(wrangler\.toml)$/, (_, f) => w.file), w);
      // key by dir segment e.g. "services/api-gateway"
      const dirKey = w.file.split('/').slice(0, 2).join('/');
      workersByFile.set(dirKey, w);
    }

    const services = {};

    // --- Scan apps/ ---
    const appsDir = join(REPO_ROOT, 'apps');
    let appDirs = [];
    try { appDirs = await readdir(appsDir); } catch { /* absent */ }
    for (const entry of appDirs) {
      const dir = join(appsDir, entry);
      if (!(await exists(join(dir, 'package.json')))) continue;
      const pkg = await scanPackageJson(dir);
      if (!pkg) continue;
      const wrangler = await scanWranglerToml(dir);
      const status = CANONICAL_RUNTIMES.includes(entry) ? 'canonical'
        : FROZEN_APPS.includes(entry) ? 'frozen'
        : 'other';
      const infraKey = `apps/${entry}`;
      const workerMeta = workersByFile.get(infraKey) ?? null;
      services[entry] = {
        name: entry,
        packageName: pkg.name ?? entry,
        type: wrangler ? 'worker' : 'vercel-app',
        path: `apps/${entry}`,
        status,
        wranglerName: wrangler,
        dependencies: {
          internal: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
            .filter(d => d.startsWith('@letbuyy/')),
          external: Object.keys({ ...pkg.dependencies })
            .filter(d => !d.startsWith('@letbuyy/')),
        },
        scripts: Object.keys(pkg.scripts ?? {}),
        workerMeta,
      };
    }

    // --- Scan services/ ---
    const servicesDir = join(REPO_ROOT, 'services');
    let svcDirs = [];
    try { svcDirs = await readdir(servicesDir); } catch { /* absent */ }
    for (const entry of svcDirs) {
      const dir = join(servicesDir, entry);
      if (!(await exists(join(dir, 'package.json')))) continue;
      const pkg = await scanPackageJson(dir);
      if (!pkg) continue;
      const wrangler = await scanWranglerToml(dir);
      const infraKey = `services/${entry}`;
      const workerMeta = workersByFile.get(infraKey) ?? null;
      const status = CANONICAL_RUNTIMES.includes(entry) ? 'canonical'
        : RESERVED_RUNTIMES.includes(entry) ? 'reserved'
        : 'other';
      services[entry] = {
        name: entry,
        packageName: pkg.name ?? entry,
        type: wrangler ? 'worker' : 'service',
        path: `services/${entry}`,
        status,
        wranglerName: wrangler,
        dependencies: {
          internal: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
            .filter(d => d.startsWith('@letbuyy/')),
          external: Object.keys({ ...pkg.dependencies })
            .filter(d => !d.startsWith('@letbuyy/')),
        },
        scripts: Object.keys(pkg.scripts ?? {}),
        workerMeta,
      };
    }

    // --- Scan packages/ ---
    const packagesDir = join(REPO_ROOT, 'packages');
    let pkgDirs = [];
    try { pkgDirs = await readdir(packagesDir); } catch { /* absent */ }
    for (const entry of pkgDirs) {
      const dir = join(packagesDir, entry);
      if (!(await exists(join(dir, 'package.json')))) continue;
      const pkg = await scanPackageJson(dir);
      if (!pkg) continue;
      services[`pkg:${entry}`] = {
        name: entry,
        packageName: pkg.name ?? `@letbuyy/${entry}`,
        type: 'package',
        path: `packages/${entry}`,
        status: 'library',
        wranglerName: null,
        dependencies: {
          internal: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
            .filter(d => d.startsWith('@letbuyy/')),
          external: Object.keys({ ...pkg.dependencies })
            .filter(d => !d.startsWith('@letbuyy/')),
        },
        scripts: Object.keys(pkg.scripts ?? {}),
        workerMeta: null,
      };
    }

    // --- Infra-only workers not in filesystem (ghost entries) ---
    for (const w of (infra.workers ?? [])) {
      const dirKey = w.file.split('/').slice(0, 2).join('/');
      const entryName = dirKey.split('/')[1];
      if (entryName && !services[entryName]) {
        services[entryName] = {
          name: entryName,
          packageName: entryName,
          type: 'worker',
          path: dirKey,
          status: 'infra-only',
          wranglerName: w.name,
          dependencies: { internal: [], external: [] },
          scripts: [],
          workerMeta: w,
        };
      }
    }

    this.#services = services;
    return services;
  }

  async getService(name) {
    const services = await this.discover();
    return services[name] ?? services[`pkg:${name}`] ?? null;
  }

  async getServiceManifest(name) {
    const svc = await this.getService(name);
    if (!svc) return null;
    return {
      name: svc.name,
      type: svc.type,
      path: svc.path,
      dependencies: svc.dependencies,
      deploys: svc.workerMeta
        ? { wranglerName: svc.wranglerName, queues: svc.workerMeta.queueProducers ?? [], crons: svc.workerMeta.crons ?? [] }
        : { platform: 'vercel', framework: 'nextjs' },
      routes: svc.workerMeta ? [] : [`/${svc.name}`],
    };
  }

  getCanonicalRuntimes() {
    return CANONICAL_RUNTIMES;
  }

  getReservedRuntimes() {
    return RESERVED_RUNTIMES;
  }
}

export default new ServiceDiscovery();
