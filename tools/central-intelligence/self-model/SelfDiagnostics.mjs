/**
 * LCIS V2 — SelfDiagnostics
 *
 * Phase 19: Self-diagnostics for the LCIS central-intelligence layer.
 *
 * Methods:
 *   getHealth()             — is self-model fresh? which subsystems present?
 *   introspect()            — count subsystems/files/classes/endpoints in CI
 *   validateCompleteness()  — check all 13 declared subsystems have real files
 *   getModelStats()         — return stats from generated self-model artifacts
 *
 * No external dependencies.
 *
 * @module self-model/SelfDiagnostics
 */

import {
  readdirSync,
  readFileSync,
  existsSync,
  statSync,
} from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CI_ROOT = resolve(__dirname, '..');           // tools/central-intelligence
const REPO_ROOT = resolve(__dirname, '../../..');   // repo root
const SELF_MODEL_DIR = join(REPO_ROOT, 'graphify-out/self-model');

// ---------------------------------------------------------------------------
// Canonical subsystem registry (13 layers)
// ---------------------------------------------------------------------------

const CANONICAL_SUBSYSTEMS = [
  { dir: 'memory-engine',            layer: 'Memory',         expectedClasses: ['MemoryService', 'MemoryRetriever', 'MemoryIngestionPipeline'] },
  { dir: 'knowledge-engine',         layer: 'Knowledge',      expectedClasses: ['KnowledgeAcquisitionService', 'KnowledgeSourceRegistry'] },
  { dir: 'graph-engine',             layer: 'Graph',          expectedClasses: ['GraphBuilder', 'GraphQueryEngine'] },
  { dir: 'browser-intelligence',     layer: 'Browser',        expectedClasses: ['BrowserIntelligenceEngine'] },
  { dir: 'observability',            layer: 'Observability',  expectedClasses: ['AnomalyDetectionService', 'IncidentDetectionService'] },
  { dir: 'agents',                   layer: 'Agents',         expectedClasses: ['AgentFramework'] },
  { dir: 'context-intelligence',     layer: 'Context',        expectedClasses: ['ArchitectureGraphBuilder', 'DependencyGraphBuilder'] },
  { dir: 'architecture-intelligence', layer: 'Architecture',  expectedClasses: ['ArchitectureIntelligenceEngine'] },
  { dir: 'reasoning',                layer: 'Reasoning',      expectedClasses: ['IncidentReasoner'] },
  { dir: 'correlation',              layer: 'Correlation',    expectedClasses: [] },
  { dir: 'operator-platform',        layer: 'AutonomousOps',  expectedClasses: [] },
  { dir: 'self-model',               layer: 'SelfModel',      expectedClasses: ['SelfModelBuilder', 'PlatformExplainer', 'SelfDiagnostics'] },
  { dir: 'intelligence-api',         layer: 'IntelligenceAPI',expectedClasses: ['QueryRouter', 'ResponseSynthesizer'] },
];

// Fix the Architecture entry (incorrectly used positional arg for layer)
CANONICAL_SUBSYSTEMS[7].layer = 'Architecture';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeReadJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function listMjsFiles(dir, maxDepth = 4, depth = 0) {
  if (depth > maxDepth || !existsSync(dir)) return [];
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listMjsFiles(full, maxDepth, depth + 1));
      } else if (entry.isFile() && extname(entry.name) === '.mjs') {
        results.push(full);
      }
    }
  } catch {
    // unreadable dir — skip
  }
  return results;
}

function extractClasses(filePath) {
  try {
    const src = readFileSync(filePath, 'utf8');
    return [...src.matchAll(/^class\s+([A-Z][A-Za-z0-9_]*)/gm)].map(m => m[1]);
  } catch {
    return [];
  }
}

function artifactAge(path) {
  try {
    const stat = statSync(path);
    const ageMs = Date.now() - stat.mtimeMs;
    return {
      mtime: stat.mtime.toISOString(),
      ageMs,
      ageHours: Math.round(ageMs / 3_600_000 * 10) / 10,
      fresh: ageMs < 24 * 3_600_000,  // fresh if < 24 hours
    };
  } catch {
    return { exists: false };
  }
}

// ---------------------------------------------------------------------------
// SelfDiagnostics class
// ---------------------------------------------------------------------------

class SelfDiagnostics {

  // -------------------------------------------------------------------------
  // getHealth — is self-model fresh? which subsystems present?
  // -------------------------------------------------------------------------

  getHealth() {
    const artifacts = {
      selfModel:         join(SELF_MODEL_DIR, 'LCIS_SELF_MODEL.json'),
      systemGraph:       join(SELF_MODEL_DIR, 'LCIS_SYSTEM_GRAPH.json'),
      dependencyModel:   join(SELF_MODEL_DIR, 'LCIS_DEPENDENCY_MODEL.json'),
      operationalModel:  join(SELF_MODEL_DIR, 'LCIS_OPERATIONAL_MODEL.json'),
      intelligenceModel: join(SELF_MODEL_DIR, 'LCIS_INTELLIGENCE_MODEL.json'),
    };

    const artifactHealth = {};
    let allPresent = true;
    let allFresh   = true;

    for (const [key, path] of Object.entries(artifacts)) {
      const age = artifactAge(path);
      artifactHealth[key] = { path, ...age };
      if (!existsSync(path))   { allPresent = false; artifactHealth[key].exists = false; }
      if (!age.fresh)           { allFresh   = false; }
    }

    // Subsystem presence
    const subsystemHealth = CANONICAL_SUBSYSTEMS.map(sub => ({
      name:   sub.dir,
      layer:  sub.layer,
      exists: existsSync(join(CI_ROOT, sub.dir)),
      fileCount: listMjsFiles(join(CI_ROOT, sub.dir)).length,
    }));

    const presentCount = subsystemHealth.filter(s => s.exists).length;
    const totalCount   = subsystemHealth.length;

    const overallStatus =
      !allPresent                    ? 'STALE (artifacts missing — run SelfModelBuilder.build())'
      : !allFresh                    ? 'STALE (artifacts older than 24h — re-run build())'
      : presentCount < totalCount    ? `DEGRADED (${totalCount - presentCount} subsystems missing)`
      : 'HEALTHY';

    return {
      status: overallStatus,
      generatedAt: new Date().toISOString(),
      allArtifactsPresent: allPresent,
      allArtifactsFresh:   allFresh,
      artifacts: artifactHealth,
      subsystems: subsystemHealth,
      subsystemPresentCount: presentCount,
      subsystemTotalCount:   totalCount,
    };
  }

  // -------------------------------------------------------------------------
  // introspect — count subsystems/files/classes/endpoints in CI
  // -------------------------------------------------------------------------

  introspect() {
    const subsystems = [];
    let totalFiles   = 0;
    let totalClasses = 0;

    for (const sub of CANONICAL_SUBSYSTEMS) {
      const subsysPath = join(CI_ROOT, sub.dir);
      const files      = listMjsFiles(subsysPath);
      const classes    = files.flatMap(f => extractClasses(f));

      totalFiles   += files.length;
      totalClasses += classes.length;

      subsystems.push({
        name:      sub.dir,
        layer:     sub.layer,
        path:      subsysPath,
        exists:    existsSync(subsysPath),
        fileCount: files.length,
        files:     files.map(f => f.replace(CI_ROOT + '/', '')).sort(),
        classes:   [...new Set(classes)],
      });
    }

    // Also count root-level .mjs files in CI root
    const rootFiles = (readdirSync(CI_ROOT, { withFileTypes: true })
      .filter(e => e.isFile() && extname(e.name) === '.mjs')
      .map(e => e.name));

    // Endpoint count from intelligence-api/server.mjs
    let endpointCount = 0;
    const serverPath = join(CI_ROOT, 'intelligence-api/server.mjs');
    if (existsSync(serverPath)) {
      try {
        const src = readFileSync(serverPath, 'utf8');
        const patterns = [
          /path\s*===\s*['"](\/?(?:intelligence|api)\/[^'"]+)['"]/g,
          /path\.startsWith\s*\(\s*['"](\/?(?:intelligence|api)\/[^'"]+)['"]\s*\)/g,
          /pathname\s*===?\s*['"](\/?(?:intelligence|api)\/[^'"]+)['"]/g,
          /case\s+['"](\/?(?:intelligence|api)\/[^'"]+)['"]/g,
        ];
        const seen = new Set();
        for (const p of patterns) {
          for (const m of src.matchAll(p)) seen.add(m[1]);
        }
        endpointCount = seen.size;
      } catch {
        // ignore
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      ciRoot: CI_ROOT,
      subsystemCount: subsystems.length,
      presentSubsystemCount: subsystems.filter(s => s.exists).length,
      totalMjsFiles: totalFiles,
      totalClasses,
      rootLevelFiles: rootFiles,
      estimatedEndpointCount: endpointCount,
      subsystems,
    };
  }

  // -------------------------------------------------------------------------
  // validateCompleteness — check all 13 declared subsystems have real files
  // -------------------------------------------------------------------------

  validateCompleteness() {
    const results = [];
    let passCount = 0;
    let failCount = 0;

    for (const sub of CANONICAL_SUBSYSTEMS) {
      const subsysPath = join(CI_ROOT, sub.dir);
      const exists     = existsSync(subsysPath);
      const files      = exists ? listMjsFiles(subsysPath) : [];
      const fileCount  = files.length;

      // Extract actual classes
      const actualClasses = new Set(files.flatMap(f => extractClasses(f)));

      // Check expected classes present
      const missingClasses = (sub.expectedClasses || []).filter(c => !actualClasses.has(c));

      const status =
        !exists          ? 'MISSING_DIR'
        : fileCount === 0 ? 'EMPTY'
        : missingClasses.length > 0 ? 'INCOMPLETE'
        : 'COMPLETE';

      const passed = status === 'COMPLETE';
      if (passed) passCount++; else failCount++;

      results.push({
        subsystem:      sub.dir,
        layer:          sub.layer,
        status,
        exists,
        fileCount,
        expectedClasses: sub.expectedClasses || [],
        actualClasses:  [...actualClasses].sort(),
        missingClasses,
        files: files.map(f => f.replace(CI_ROOT + '/', '')).sort(),
      });
    }

    const overallValid = failCount === 0;

    return {
      generatedAt: new Date().toISOString(),
      valid: overallValid,
      summary: overallValid
        ? `All ${CANONICAL_SUBSYSTEMS.length} subsystems are complete`
        : `${failCount} of ${CANONICAL_SUBSYSTEMS.length} subsystems have issues (MISSING_DIR, EMPTY, or INCOMPLETE)`,
      passCount,
      failCount,
      totalSubsystems: CANONICAL_SUBSYSTEMS.length,
      results,
    };
  }

  // -------------------------------------------------------------------------
  // getModelStats — stats from generated self-model artifacts
  // -------------------------------------------------------------------------

  getModelStats() {
    const selfModel         = safeReadJson(join(SELF_MODEL_DIR, 'LCIS_SELF_MODEL.json'));
    const systemGraph       = safeReadJson(join(SELF_MODEL_DIR, 'LCIS_SYSTEM_GRAPH.json'));
    const dependencyModel   = safeReadJson(join(SELF_MODEL_DIR, 'LCIS_DEPENDENCY_MODEL.json'));
    const operationalModel  = safeReadJson(join(SELF_MODEL_DIR, 'LCIS_OPERATIONAL_MODEL.json'));
    const intelligenceModel = safeReadJson(join(SELF_MODEL_DIR, 'LCIS_INTELLIGENCE_MODEL.json'));

    // Artifact sizes
    const artifactSizes = {};
    for (const [name, file] of Object.entries({
      'LCIS_SELF_MODEL.json':         join(SELF_MODEL_DIR, 'LCIS_SELF_MODEL.json'),
      'LCIS_SYSTEM_GRAPH.json':       join(SELF_MODEL_DIR, 'LCIS_SYSTEM_GRAPH.json'),
      'LCIS_DEPENDENCY_MODEL.json':   join(SELF_MODEL_DIR, 'LCIS_DEPENDENCY_MODEL.json'),
      'LCIS_OPERATIONAL_MODEL.json':  join(SELF_MODEL_DIR, 'LCIS_OPERATIONAL_MODEL.json'),
      'LCIS_INTELLIGENCE_MODEL.json': join(SELF_MODEL_DIR, 'LCIS_INTELLIGENCE_MODEL.json'),
    })) {
      try {
        if (existsSync(file)) {
          const stat = statSync(file);
          artifactSizes[name] = { bytes: stat.size, mtime: stat.mtime.toISOString() };
        } else {
          artifactSizes[name] = { bytes: 0, present: false };
        }
      } catch {
        artifactSizes[name] = { bytes: 0, error: true };
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      artifactSizes,
      selfModel: selfModel ? {
        version:              selfModel.version,
        subsystemCount:       selfModel.stats?.subsystemCount,
        presentSubsystemCount: selfModel.stats?.presentSubsystemCount,
        totalMjsFiles:        selfModel.stats?.totalMjsFiles,
        totalClasses:         selfModel.stats?.totalClasses,
        endpointCount:        selfModel.stats?.endpointCount,
        domainCount:          selfModel.stats?.domainCount,
        tableCount:           selfModel.stats?.tableCount,
        generatedAt:          selfModel.generatedAt,
      } : null,
      systemGraph: systemGraph ? {
        nodeCount: systemGraph.nodeCount,
        edgeCount: systemGraph.edgeCount,
        generatedAt: systemGraph.generatedAt,
      } : null,
      dependencyModel: dependencyModel ? {
        serviceCount:              dependencyModel.stats?.serviceCount,
        serviceDependencyCount:    dependencyModel.stats?.serviceDependencyCount,
        crossDomainDependencyCount: dependencyModel.stats?.crossDomainDependencyCount,
        generatedAt:               dependencyModel.generatedAt,
      } : null,
      operationalModel: operationalModel ? {
        incidentStepCount:      operationalModel.incidentEmergence?.steps?.length,
        deployStepCount:        operationalModel.deploymentPropagation?.steps?.length,
        failurePathCount:       operationalModel.failurePropagation?.paths?.length,
        opsRuleCount:           operationalModel.operationsHowItWorks?.length,
        generatedAt:            operationalModel.generatedAt,
      } : null,
      intelligenceModel: intelligenceModel ? {
        questionCount:      intelligenceModel.summary?.totalQuestions,
        connectedCount:     intelligenceModel.summary?.connectedCount,
        notConnectedCount:  intelligenceModel.summary?.notConnectedCount,
        artifactCount:      intelligenceModel.summary?.artifactCount,
        queryRouteCount:    intelligenceModel.queryRoutingMap?.length,
        generatedAt:        intelligenceModel.generatedAt,
      } : null,
    };
  }
}

const diagnostics = new SelfDiagnostics();
export default diagnostics;

// CLI entrypoint
if (process.argv[1]) {
  const _self = fileURLToPath(import.meta.url);
  if (resolve(process.argv[1]) === _self) {
    const cmd = process.argv[2] || 'health';
    const methodMap = {
      health:    () => diagnostics.getHealth(),
      introspect:() => diagnostics.introspect(),
      validate:  () => diagnostics.validateCompleteness(),
      stats:     () => diagnostics.getModelStats(),
    };
    const fn = methodMap[cmd] ?? methodMap.health;
    Promise.resolve(fn())
      .then(r => console.log(JSON.stringify(r, null, 2)))
      .catch(e => { console.error(e.message); process.exit(1); });
  }
}
