/**
 * ArtifactIntelligenceService — Phase 8 of EAOS. Computes planned artifacts, coverage,
 * validations, drift, missing artifacts, lineage, and the full ArtifactReport over an
 * EngineeringPackage. Pure, synchronous, read-only. No IO, no fs, no network, no AI.
 *
 * Honesty contract (inherited from EAOS types):
 *   - The PLAN (what a task intends to produce) is CONNECTED — derived from the task graph.
 *   - Whether the artifact ACTUALLY EXISTS on disk / was validated / accepted is NOT_CONNECTED —
 *     connection:'NOT_CONNECTED' + liveSource describing the real source; confidence 0.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import { evidence } from '@letbuyy/lcis-core';
import type { EngineeringLayer, EngineeringPackage } from '@letbuyy/lcis-engineering';
import {
  ExecutionEvidenceBuilder,
  ExecutionSeverityScorer,
  OrchestrationArtifactStore,
  execution,
  type ArtifactReport,
  type ExecutionArtifact,
  type ExecutionFinding,
  type ExecutionValidation,
  type ProgressMetric,
} from '../shared/index';

// ── Layer → artifact kind + planned path pattern ──────────────────────────────

const LAYER_KIND: Record<EngineeringLayer, string> = {
  migration:    'sql-migration',
  rpc:          'sql-rpc',
  gateway:      'route-ts',
  proxy:        'route-ts',
  ui:           'component-tsx',
  worker:       'worker-ts',
  queue:        'worker-binding',
  event:        'event-binding',
  test:         'test-ts',
  docs:         'markdown-doc',
  verification: 'validator-gate',
  launch:       'launch-artifact',
};

const LAYER_PATH_PATTERN: Record<EngineeringLayer, string> = {
  migration:    'supabase/migrations/${taskId}.sql',
  rpc:          'graphify-out/db-intel.json → .functions[name=${taskId}]',
  gateway:      'apps/*/src/app/api/**/${taskId}/route.ts',
  proxy:        'apps/*/src/app/api/**/${taskId}/route.ts',
  ui:           'apps/*/src/components/${taskId}.tsx',
  worker:       'services/*/src/${taskId}.ts',
  queue:        'services/queue-workers/src/${taskId}.ts',
  event:        'services/event-bus/${taskId}.ts',
  test:         'tests/launch/${taskId}.test.mjs',
  docs:         'docs/${taskId}.md',
  verification: 'scripts/validators/${taskId}-validator.mjs',
  launch:       'graphify-out/production-readiness-v2.json',
};

const LAYER_LIVE_SOURCE: Record<EngineeringLayer, string> = {
  migration:    'fs.existsSync(supabase/migrations/*.sql) or git status at EAOS execution time',
  rpc:          'graphify-out/db-intel.json probe at EAOS execution time (pnpm graph:db)',
  gateway:      'find apps/*/src/app/api -name "route.ts" at EAOS execution time',
  proxy:        'find apps/*/src/app/api -name "route.ts" at EAOS execution time',
  ui:           'find apps/*/src -name "*.tsx" at EAOS execution time',
  worker:       'find services/*/src -name "*.ts" at EAOS execution time (wrangler deployments list)',
  queue:        'find services/queue-workers/src -name "*.ts" at EAOS execution time',
  event:        'services/event-bus/ is reserved/NOT_IMPLEMENTED; probe deferred until scoped',
  test:         'pnpm validate / gh run view at EAOS execution time',
  docs:         'find docs -name "*.md" at EAOS execution time',
  verification: 'find scripts/validators -name "*.mjs" at EAOS execution time',
  launch:       'graphify-out/production-readiness-v2.json at EAOS execution time (pnpm graph:omega)',
};

const LAYER_GATE: Record<EngineeringLayer, string> = {
  migration:    'rollback-integrity-validator',
  rpc:          'canonical-ledger-only-validator',
  gateway:      'route-ownership lockstep',
  proxy:        'route-ownership lockstep',
  ui:           'design-system ratchet',
  worker:       'worker-runbook-gate',
  queue:        'worker-runbook-gate',
  event:        'worker-runbook-gate',
  test:         '107+ validator gate',
  docs:         'governance-memory-validator',
  verification: '107+ validator gate',
  launch:       'production-readiness-v2',
};

// ── Layers that ALWAYS expect a producing task ─────────────────────────────────

const ALL_LAYERS: readonly EngineeringLayer[] = [
  'migration', 'rpc', 'gateway', 'proxy', 'ui',
  'worker', 'queue', 'event', 'test', 'docs', 'verification', 'launch',
];

// ── helpers ───────────────────────────────────────────────────────────────────

function slugify(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function plannedPath(layer: EngineeringLayer, taskId: string): string {
  return LAYER_PATH_PATTERN[layer].replace(/\$\{taskId\}/g, slugify(taskId));
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ArtifactIntelligenceService {
  private readonly store: OrchestrationArtifactStore;
  private readonly eb = new ExecutionEvidenceBuilder();
  private readonly scorer = new ExecutionSeverityScorer();

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.store = new OrchestrationArtifactStore(core);
  }

  // ── 1. plannedArtifacts ───────────────────────────────────────────────────

  plannedArtifacts(pkg: EngineeringPackage): ExecutionArtifact[] {
    return pkg.tasks.map((task): ExecutionArtifact => ({
      taskId:      task.id,
      layer:       task.layer,
      kind:        LAYER_KIND[task.layer],
      plannedPath: plannedPath(task.layer, task.id),
      status:      'PLANNED',
      // The PLAN is CONNECTED (structural); on-disk existence is NOT_CONNECTED.
      connection:  'NOT_CONNECTED',
      liveSource:  LAYER_LIVE_SOURCE[task.layer],
      evidence: [
        this.eb.task(task.id, `Layer ${task.layer} → kind ${LAYER_KIND[task.layer]}`),
        this.eb.notConnected(
          `artifact:${task.id}.exists`,
          LAYER_LIVE_SOURCE[task.layer],
        ),
      ],
    }));
  }

  // ── 2. artifactCoverage ───────────────────────────────────────────────────

  artifactCoverage(pkg: EngineeringPackage): ProgressMetric {
    return {
      label:     'Planned artifacts',
      planned:   pkg.tasks.length,          // CONNECTED — structural
      completed: null,                       // NOT_CONNECTED — no live tracker wired
      connection: 'NOT_CONNECTED',
      liveSource: 'fs/git scan at EAOS execution time (git status / CI artifact manifest)',
    };
  }

  // ── 3. artifactValidation ─────────────────────────────────────────────────

  artifactValidation(pkg: EngineeringPackage): ExecutionValidation[] {
    return pkg.tasks.map((task): ExecutionValidation => ({
      id:         `val:${task.id}`,
      subject:    task.id,
      gate:       task.gate || LAYER_GATE[task.layer],
      status:     'PENDING',
      // Static gate membership is CONNECTED; whether CI actually passed is NOT_CONNECTED.
      connection:  'NOT_CONNECTED',
      severity:    'medium',
      liveSource:  'GitHub Actions run log / pnpm validate at EAOS execution time',
      evidence: [
        this.eb.gate(
          task.gate || LAYER_GATE[task.layer],
          `Task ${task.id} (${task.layer}) must pass gate`,
        ),
        this.eb.notConnected(
          `validation:${task.id}.ci-result`,
          'GitHub Actions run log / pnpm validate at EAOS execution time',
        ),
      ],
    }));
  }

  // ── 4. artifactAcceptance ─────────────────────────────────────────────────

  artifactAcceptance(_pkg: EngineeringPackage): {
    connection: 'NOT_CONNECTED';
    liveSource: string;
    confidence: 0;
    detail: string;
  } {
    return {
      connection: 'NOT_CONNECTED',
      liveSource: 'PR review status / Figma handoff sign-off / execution-tracking store',
      confidence: 0,
      detail:     'Artifact acceptance requires a live review/acceptance tracker — none wired in EAOS Phase 8.',
    };
  }

  // ── 5. artifactDrift ─────────────────────────────────────────────────────

  artifactDrift(pkg: EngineeringPackage): ExecutionFinding[] {
    const findings: ExecutionFinding[] = [];
    const existingFunctions = new Set(this.store.functions().map((f) => f.name.toLowerCase()));
    const existingRoutes    = new Set(this.store.routes().map((r) => r.toLowerCase()));

    for (const task of pkg.tasks) {
      const slug = slugify(task.id);
      let isExisting = false;
      let catalogRef = '';

      if (task.layer === 'rpc') {
        isExisting = existingFunctions.has(slug) || existingFunctions.has(task.id.toLowerCase());
        catalogRef = 'graphify-out/db-intel.json → .functions';
      } else if (task.layer === 'gateway' || task.layer === 'proxy') {
        isExisting = existingRoutes.has(slug) || existingRoutes.has(task.id.toLowerCase());
        catalogRef = 'graphify-out/domain-intel.json → .routes';
      } else {
        continue;
      }

      if (isExisting) {
        // Touches an existing structural artifact — elevated drift risk.
        findings.push({
          id:         `EO05:drift:existing:${task.id}`,
          category:   'drift',
          kind:       'modifies-existing-artifact',
          severity:   this.scorer.forFinding({ base: 'medium' }),
          subject:    task.id,
          title:      `Task ${task.id} (${task.layer}) targets an existing ${task.layer === 'rpc' ? 'RPC' : 'route'} — change-control required`,
          detail:     `Planned artifact slug "${slug}" matches an entry in ${catalogRef}. This is a modification, not a net-new artifact — run blast-radius check before merging.`,
          rule:       'EO05',
          connection: 'CONNECTED',
          confidence: 0.8,
          evidence: [
            this.eb.reuse('lcis-core', 'ArtifactStore', `Catalog source: ${catalogRef}`),
            this.eb.task(task.id, `Layer ${task.layer} touches existing structural entry`),
          ],
        });
      } else {
        // Net-new artifact — expected for a new feature, low drift concern.
        findings.push({
          id:         `EO05:drift:new:${task.id}`,
          category:   'drift',
          kind:       'net-new-artifact',
          severity:   'info',
          subject:    task.id,
          title:      `Task ${task.id} (${task.layer}) produces a net-new artifact (not in catalog)`,
          detail:     `Planned artifact slug "${slug}" is not in ${catalogRef || 'structural catalog'} — expected for a new feature. Actual on-disk existence is NOT_CONNECTED until EAOS execution time.`,
          rule:       'EO05',
          connection: 'CONNECTED',
          confidence: 0.9,
          evidence: [
            this.eb.reuse('lcis-core', 'ArtifactStore', `Compared against ${catalogRef || 'structural catalog'}`),
            this.eb.task(task.id, 'Net-new — not found in current structural catalog'),
          ],
        });
      }
    }

    return findings;
  }

  // ── 6. missingArtifacts ───────────────────────────────────────────────────

  missingArtifacts(pkg: EngineeringPackage): ExecutionFinding[] {
    const coveredLayers = new Set(pkg.tasks.map((t) => t.layer));
    const findings: ExecutionFinding[] = [];

    for (const layer of ALL_LAYERS) {
      if (!coveredLayers.has(layer)) {
        findings.push({
          id:         `EO04:missing-layer:${layer}`,
          category:   'artifact',
          kind:       'missing-artifact-layer',
          severity:   this.scorer.forFinding({ missingArtifact: true }),
          subject:    layer,
          title:      `No task produces a ${layer} layer artifact`,
          detail:     `The feature has no task covering the "${layer}" layer. Whether this gap exists on disk is NOT_CONNECTED (source: ${LAYER_LIVE_SOURCE[layer]}).`,
          rule:       'EO04',
          // The structural gap in the task graph is CONNECTED; whether a file was produced
          // elsewhere is NOT_CONNECTED.
          connection: 'CONNECTED',
          confidence: 0.85,
          evidence: [
            evidence(
              'graph-node',
              `layer:${layer}`,
              `No EngineeringTask with layer="${layer}" found in pkg.tasks`,
              'lcis-engineering:EngineeringPackage.tasks',
            ),
          ],
        });
      }
    }

    return findings;
  }

  // ── 7. artifactLineage ────────────────────────────────────────────────────

  artifactLineage(pkg: EngineeringPackage): readonly {
    taskId: string;
    layer: EngineeringLayer;
    plannedPath: string;
    gate: string;
    dependsOn: readonly string[];
  }[] {
    return pkg.tasks.map((task) => ({
      taskId:      task.id,
      layer:       task.layer,
      plannedPath: plannedPath(task.layer, task.id),
      gate:        task.gate || LAYER_GATE[task.layer],
      dependsOn:   task.dependsOn,
    }));
  }

  // ── 8. generateArtifactReport ─────────────────────────────────────────────

  generateArtifactReport(pkg: EngineeringPackage): ArtifactReport {
    const artifacts   = this.plannedArtifacts(pkg);
    const findings    = [
      ...this.artifactDrift(pkg),
      ...this.missingArtifacts(pkg),
    ];
    const coverage    = this.artifactCoverage(pkg);

    // byLayer: count of planned artifacts per layer
    const byLayer: Record<string, number> = {};
    for (const a of artifacts) {
      byLayer[a.layer] = (byLayer[a.layer] ?? 0) + 1;
    }

    const highFindings   = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
    const missingLayers  = findings.filter((f) => f.kind === 'missing-artifact-layer').length;
    const driftExisting  = findings.filter((f) => f.kind === 'modifies-existing-artifact').length;

    const summaryParts: string[] = [
      `${artifacts.length} planned artifact${artifacts.length !== 1 ? 's' : ''} across ${Object.keys(byLayer).length} layer${Object.keys(byLayer).length !== 1 ? 's' : ''}.`,
    ];
    if (missingLayers > 0) summaryParts.push(`${missingLayers} layer${missingLayers !== 1 ? 's' : ''} without a producing task (EO04).`);
    if (driftExisting > 0) summaryParts.push(`${driftExisting} artifact${driftExisting !== 1 ? 's' : ''} touch existing catalog entries — change-control required (EO05).`);
    if (highFindings > 0)  summaryParts.push(`${highFindings} critical/high finding${highFindings !== 1 ? 's' : ''}.`);
    summaryParts.push('On-disk existence is NOT_CONNECTED — probe at EAOS execution time.');

    const reportEvidence = [
      this.eb.reuse('lcis-engineering', 'EngineeringPackage.tasks', `${artifacts.length} tasks mapped to artifacts`),
      this.eb.reuse('lcis-core', 'OrchestrationArtifactStore', 'structural catalog compared for drift'),
      this.eb.notConnected(
        'artifact.produced-count',
        'fs/git scan at EAOS execution time',
      ),
    ];

    return execution(
      {
        request:   pkg.request,
        artifacts,
        byLayer:   byLayer as Readonly<Record<string, number>>,
        findings,
        coverage,
        summary:   summaryParts.join(' '),
      },
      {
        evidence:      reportEvidence,
        liveConnected: false,
        now:           this.now,
      },
    );
  }
}
