/**
 * LayerDiscovery.mjs — LCIS Architecture Intelligence
 * Classifies every service/module into architectural layers and detects layer violations.
 *
 * Layer model (outermost → innermost):
 *   edge        — customer-facing / merchant-facing web apps
 *   gateway     — request routing + API aggregation
 *   async       — queue workers, webhook delivery
 *   data        — Supabase, migrations, DB RPCs
 *   intelligence — LCIS graph-server, central-intelligence tools
 *   package     — shared library packages (cross-cutting)
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

// Canonical layer assignments for known entries
const LAYER_MAP = {
  // edge layer
  'storefront-runtime':       'edge',
  'merchant-control-plane':   'edge',
  'identity-platform':        'edge',
  'marketing-site':           'edge',
  'platform-console':         'edge',
  // frozen/other apps still classify
  'app-marketplace':          'edge',
  'developer-portal':         'edge',
  'theme-marketplace':        'edge',
  'platform-operations-portal': 'edge',
  // gateway layer
  'api-gateway':              'gateway',
  'mobile-bff':               'gateway',
  // async layer
  'queue-workers':            'async',
  'webhook-service':          'async',
  // reserved services (classified by intent)
  'checkout-runtime':         'gateway',
  'search-service':           'gateway',
  'media-service':            'async',
  'notification-service':     'async',
  'event-bus':                'async',
  'analytics-pipeline':       'async',
  // data layer
  'supabase':                 'data',
  'migrations':               'data',
  // intelligence layer
  'graph-engine':             'intelligence',
  'central-intelligence':     'intelligence',
  'architecture-intelligence': 'intelligence',
  'graph-server':             'intelligence',
};

// Package-to-layer assignments based on function
const PACKAGE_LAYER_MAP = {
  'shared-types':        'package',
  'auth-core':           'package',
  'ui':                  'package',
  'api-client':          'package',
  'tenant-core':         'package',
  'theme-engine':        'package',
  'cms-core':            'package',
  'event-core':          'package',
  'session-core':        'package',
  'identity-core':       'package',
  'permission-core':     'package',
  'billing-core':        'package',
  'checkout-core':       'package',
  'commerce-core':       'package',
  'payments':            'package',
  'notification-core':   'package',
  'organization-core':   'package',
  'audit-core':          'package',
  'infrastructure':      'package',
  'token-core':          'package',
};

// Layer dependency rules: key layer MUST NOT import from value layers
// (violations = lower layer depending on higher edge layer)
const FORBIDDEN_LAYER_DEPS = {
  data:         new Set(['gateway', 'async', 'edge']),
  gateway:      new Set(['edge']),
  async:        new Set(['edge']),
  intelligence: new Set([]),    // intelligence reads everything (read-only)
  package:      new Set(['edge', 'gateway', 'async']),
};

async function readJsonSafe(fp) {
  try { return JSON.parse(await readFile(fp, 'utf8')); } catch { return null; }
}
async function exists(p) { try { await stat(p); return true; } catch { return false; } }

class LayerDiscovery {
  #layers = null;      // Map<name, layer>
  #allEntries = null;  // [{name, layer, path, internalDeps}]

  async #buildLayers() {
    if (this.#layers) return;
    this.#layers = new Map();
    this.#allEntries = [];

    const roots = [
      { dir: 'apps', prefix: '' },
      { dir: 'services', prefix: '' },
      { dir: 'packages', prefix: 'pkg:' },
    ];

    for (const { dir, prefix } of roots) {
      const fullDir = join(REPO_ROOT, dir);
      let entries = [];
      try { entries = await readdir(fullDir); } catch { continue; }

      for (const entry of entries) {
        const pkgPath = join(fullDir, entry, 'package.json');
        if (!await exists(pkgPath)) continue;
        const pkg = await readJsonSafe(pkgPath);
        if (!pkg) continue;

        const key = `${prefix}${entry}`;
        let layer;
        if (prefix === 'pkg:') {
          layer = PACKAGE_LAYER_MAP[entry] ?? 'package';
        } else {
          layer = LAYER_MAP[entry] ?? this.#inferLayer(entry, dir);
        }
        this.#layers.set(key, layer);
        this.#layers.set(entry, layer);  // also by short name

        const internalDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
          .filter(d => d.startsWith('@letbuyy/'));

        this.#allEntries.push({ name: entry, key, layer, path: `${dir}/${entry}`, internalDeps });
      }
    }

    // Add tools/central-intelligence dirs
    const toolsDir = join(REPO_ROOT, 'tools', 'central-intelligence');
    let toolEntries = [];
    try { toolEntries = await readdir(toolsDir); } catch { /* absent */ }
    for (const te of toolEntries) {
      const layer = LAYER_MAP[te] ?? 'intelligence';
      this.#layers.set(te, layer);
      this.#layers.set(`tools:${te}`, layer);
      this.#allEntries.push({ name: te, key: `tools:${te}`, layer, path: `tools/central-intelligence/${te}`, internalDeps: [] });
    }
  }

  #inferLayer(entry, dir) {
    if (dir === 'packages') return 'package';
    if (dir === 'services') {
      if (entry.includes('worker') || entry.includes('webhook') || entry.includes('queue')) return 'async';
      if (entry.includes('bff') || entry.includes('gateway')) return 'gateway';
      return 'async';
    }
    if (dir === 'apps') {
      if (entry.includes('console') || entry.includes('platform')) return 'edge';
      return 'edge';
    }
    return 'unknown';
  }

  async discover() {
    await this.#buildLayers();
    const result = {};
    for (const entry of this.#allEntries) {
      result[entry.key] = { name: entry.name, layer: entry.layer, path: entry.path, internalDeps: entry.internalDeps };
    }
    return result;
  }

  async getLayer(name) {
    await this.#buildLayers();
    return this.#layers.get(name) ?? this.#layers.get(`pkg:${name}`) ?? 'unknown';
  }

  async getLayerDependencies() {
    await this.#buildLayers();
    // Group entries by layer, show what each layer depends on
    const byLayer = {};
    for (const entry of this.#allEntries) {
      if (!byLayer[entry.layer]) byLayer[entry.layer] = { members: [], dependsOn: new Set() };
      byLayer[entry.layer].members.push(entry.name);
      for (const dep of entry.internalDeps) {
        const depShort = dep.replace('@letbuyy/', '');
        const depLayer = this.#layers.get(depShort) ?? 'package';
        byLayer[entry.layer].dependsOn.add(depLayer);
      }
    }
    // Convert Sets to arrays
    const result = {};
    for (const [layer, data] of Object.entries(byLayer)) {
      result[layer] = { members: data.members, dependsOn: [...data.dependsOn] };
    }
    return result;
  }

  async validateLayering() {
    await this.#buildLayers();
    const violations = [];

    for (const entry of this.#allEntries) {
      const entryLayer = entry.layer;
      const forbidden = FORBIDDEN_LAYER_DEPS[entryLayer];
      if (!forbidden) continue;

      for (const dep of entry.internalDeps) {
        const depShort = dep.replace('@letbuyy/', '');
        const depLayer = this.#layers.get(depShort) ?? 'package';
        if (forbidden.has(depLayer)) {
          violations.push({
            violator: entry.name,
            violatorLayer: entryLayer,
            dependency: dep,
            dependencyLayer: depLayer,
            severity: 'high',
            rule: `${entryLayer} layer must not import from ${depLayer} layer`,
          });
        }
      }
    }

    return {
      valid: violations.length === 0,
      violationCount: violations.length,
      violations,
      summary: violations.length === 0
        ? 'No layer violations detected'
        : `${violations.length} layer violation(s) detected`,
    };
  }
}

export default new LayerDiscovery();
