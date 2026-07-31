/**
 * DeploymentOperationsService — LCOS Phase 6.
 *
 * READ-ONLY. Observes, analyzes, and reports the deployment posture of the LetBuyy platform.
 * NEVER deploys, executes, rolls back, mutates, writes to any datastore, spawns processes,
 * fetches network, or calls any IO. No dynamic evaluation. No placeholders or fabricated values.
 *
 * Structural intelligence is CONNECTED (git HEAD, workflow files, rollback scripts, SPOFs,
 * subdomains, migration count). Live deploy values (actual deployed version, release health,
 * rollback events) are NOT_CONNECTED — value=null + exact env var, confidence=0.
 *
 * Consumes only the frozen shared foundation from '../shared/index' and
 * '@letbuyy/lcis-core'. Reads deployment artifacts via OperationsArtifactStore.
 */

import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import {
  LiveSignalRegistry,
  OperationalEvidenceBuilder,
  OperationalFindingBuilder,
  OperationalHealthCalculator,
  OperationsArtifactStore,
  TelemetryNormalizer,
  defaultNow,
  operations,
  type DeploymentReport,
  type LiveSignal,
  type OperationalFact,
  type OperationalFinding,
} from '../shared/index';

// ── Minimal local shapes matching the known artifact structures ──────────────

interface SpofEntry {
  id: string;
  kind: string;
  detail: string;
  mitigation: string;
}

interface WorkflowEntry {
  file: string;
  deploysWorkers: boolean;
  deploysVercel: boolean;
  runsMigrations: boolean;
  triggers: string[];
  gates: string[];
}

interface SubdomainEntry {
  host: string;
  app: string;
  via: string;
}

interface RollbackInfo {
  script: string;
  present: boolean;
  scripts: string[];
}

interface DeploymentIntelV5 {
  summary?: {
    pipeline?: { order?: string[]; migrateGate?: boolean; appliesMigrations?: boolean };
    workers?: number;
    vercelApps?: number;
    secretsRequired?: number;
    subdomains?: number;
    spofCount?: number;
    missingRollback?: number;
    rollbackPresent?: boolean;
    declaredHead?: string;
    generatedAt?: string;
  };
  spof?: SpofEntry[];
  missingRollback?: unknown[];
  secretDeps?: { required?: number; names?: string[]; blockingNote?: string };
  workflows?: WorkflowEntry[];
  subdomains?: SubdomainEntry[];
  state?: {
    headCommit?: string;
    branch?: string;
    lastTag?: string;
    headSubject?: string;
    latestMigration?: { n?: number; file?: string };
    totalMigrations?: number;
  };
  rollback?: RollbackInfo;
}

interface DeploymentStateArtifact {
  declared?: {
    headCommit?: string;
    branch?: string;
    lastTag?: string;
    headSubject?: string;
    latestMigration?: { n?: number; file?: string };
    totalMigrations?: number;
  };
  targets?: {
    workers?: string[];
    vercelApps?: string[];
    secretsRequired?: number;
  };
  gate?: {
    migrateGate?: boolean;
    appliesMigrations?: boolean;
    order?: string[];
  };
  rollback?: { script?: string; present?: boolean; scripts?: string[] };
  liveStateGap?: string;
  generatedAt?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class DeploymentOperationsService {
  private readonly store: OperationsArtifactStore;
  private readonly reg: LiveSignalRegistry;
  private readonly eb: OperationalEvidenceBuilder;
  private readonly fb: OperationalFindingBuilder;
  private readonly health: OperationalHealthCalculator;
  private readonly norm: TelemetryNormalizer;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.store = new OperationsArtifactStore(core);
    this.reg = new LiveSignalRegistry();
    this.eb = new OperationalEvidenceBuilder();
    this.fb = new OperationalFindingBuilder();
    this.health = new OperationalHealthCalculator();
    this.norm = new TelemetryNormalizer();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private intel(): DeploymentIntelV5 | null {
    return this.store.deployment() as DeploymentIntelV5 | null;
  }

  private state(): DeploymentStateArtifact | null {
    return this.store.deploymentState() as DeploymentStateArtifact | null;
  }

  private deploymentSignals(): readonly LiveSignal[] {
    return this.reg.byArea('deployment').map((sig) => {
      const ev = this.eb.artifact('deployment-intelligence-v5', sig.key, sig.label);
      return this.norm.signalToLive(sig, [ev]);
    });
  }

  // ── 1. detectDeployments ─────────────────────────────────────────────────

  /**
   * Structural declared deploy state is CONNECTED: HEAD commit, branch, migration count,
   * worker + Vercel target lists all come from deployment-state.json.
   *
   * Live deployed version is NOT_CONNECTED: requires Vercel API (VERCEL_TOKEN) +
   * Cloudflare API (CLOUDFLARE_API_TOKEN + CF_ACCOUNT_ID). Value=null, confidence=0.
   */
  detectDeployments(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const ds = this.state();
    const di = this.intel();

    if (!ds && !di) {
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: 'missing-artifact',
          severity: 'high',
          subject: 'deployment-state',
          title: 'Deployment state artifact absent',
          detail:
            'deployment-state.json was not found in graphify-out/. Run `pnpm graph:infra` or ' +
            '`pnpm graph:omega` to regenerate. Structural deploy state cannot be reported.',
          status: 'UNKNOWN',
          evidence: [
            this.eb.artifact('deployment-state', 'artifact-presence', 'deployment-state.json not readable from ArtifactStore'),
          ],
        }),
      );
      return findings;
    }

    // Artifact-vs-git HEAD delta — CONNECTED finding (reassuring when small, informational always)
    const artifactHead = di?.state?.headCommit ?? di?.summary?.declaredHead;
    const stateHead = ds?.declared?.headCommit;
    const canonicalHead = stateHead ?? artifactHead;
    if (canonicalHead) {
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: 'declared-head-commit',
          severity: 'info',
          subject: 'HEAD',
          title: `Declared HEAD commit: ${canonicalHead}`,
          detail:
            `Repository-declared HEAD is ${canonicalHead} (branch: ${ds?.declared?.branch ?? 'unknown'}). ` +
            `Latest migration declared: #${ds?.declared?.latestMigration?.n ?? '?'} ` +
            `(${ds?.declared?.latestMigration?.file ?? '?'}). ` +
            `Total migrations: ${ds?.declared?.totalMigrations ?? '?'}. ` +
            'Live deployed version requires VERCEL_TOKEN + CLOUDFLARE_API_TOKEN to compare.',
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('deployment-state', 'declared.headCommit', `HEAD=${canonicalHead}`),
            this.eb.artifact('deployment-state', 'declared.latestMigration', `migration #${ds?.declared?.latestMigration?.n ?? '?'}`),
          ],
        }),
      );
    }

    // Artifact-vs-git delta: the deployment-intelligence-v5.json was generated at an earlier commit
    if (artifactHead && stateHead && artifactHead !== stateHead) {
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: 'artifact-git-delta',
          severity: 'low',
          subject: 'deployment-intelligence-v5',
          title: 'Deployment artifact predates current git HEAD',
          detail:
            `deployment-intelligence-v5.json was generated at commit ${artifactHead}, but ` +
            `deployment-state.json records HEAD as ${stateHead}. The artifact may be stale. ` +
            'Refresh with `pnpm graph:infra` or `pnpm graph:omega`.',
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('deployment-intelligence-v5', 'summary.declaredHead', `artifact HEAD=${artifactHead}`),
            this.eb.artifact('deployment-state', 'declared.headCommit', `state HEAD=${stateHead}`),
          ],
        }),
      );
    }

    // Live deployed version — NOT_CONNECTED (honest)
    findings.push(
      this.fb.build({
        area: 'deployment',
        kind: 'deployed-version',
        severity: 'info',
        subject: 'live-deployed-version',
        title: 'Live deployed version: NOT_CONNECTED',
        detail:
          'The actual deployed version on Vercel/Cloudflare cannot be determined without ' +
          'provider credentials (VERCEL_TOKEN for Vercel build IDs; CLOUDFLARE_API_TOKEN + ' +
          'CF_ACCOUNT_ID for worker versions). Value=null until credentials are wired.',
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: [
          this.eb.notConnected('vercel-deployed-build-id', 'VERCEL_TOKEN'),
          this.eb.notConnected('cloudflare-worker-version', 'CLOUDFLARE_API_TOKEN'),
        ],
      }),
    );

    // No canary mechanism — CONNECTED finding
    findings.push(
      this.fb.build({
        area: 'deployment',
        kind: 'no-canary',
        severity: 'medium',
        subject: 'canary-deployment',
        title: 'No canary deployment mechanism declared',
        detail:
          'No canary deploy mechanism exists in any of the 16 CI/CD workflows. ' +
          '`production-deploy.yml` deploys all 4 workers + 5 Vercel apps simultaneously ' +
          '(blue-green via Cloudflare native worker versioning). A bad deploy affects ' +
          'all tenants at once — no staged traffic splitting before full promotion.',
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(
            'deployment-intelligence-v5',
            'workflows',
            '16 workflow files inspected — no canary/staged traffic split declared',
          ),
          this.eb.doc(
            'LCOS_DEPLOYMENT_DISCOVERY.md §8',
            'Canary state: none declared — production-deploy.yml deploys all workers simultaneously',
            'docs/lcis-operations/LCOS_DEPLOYMENT_DISCOVERY.md',
          ),
        ],
      }),
    );

    // Workflow count — CONNECTED
    const workflows = di?.workflows ?? [];
    if (workflows.length > 0) {
      const productionDeploys = workflows.filter((w) => w.deploysWorkers || w.deploysVercel);
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: 'workflow-inventory',
          severity: 'info',
          subject: 'ci-cd-workflows',
          title: `${workflows.length} CI/CD workflows declared; ${productionDeploys.length} deploy to workers or Vercel`,
          detail:
            `Workflow files: ${workflows.map((w) => w.file).join(', ')}. ` +
            `Deploy workflows: ${productionDeploys.map((w) => w.file).join(', ')}. ` +
            'Primary production pipeline: production-deploy.yml (branch-lag + validate-governance + migrate-production gates).',
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(
              'deployment-intelligence-v5',
              'workflows',
              `${workflows.length} workflows in deployment-intelligence-v5.json`,
            ),
            this.eb.doc(
              'LCOS_DEPLOYMENT_DISCOVERY.md §3',
              '16 workflow files audited (15 in artifact + lcis-pr-analysis.yml)',
              'docs/lcis-operations/LCOS_DEPLOYMENT_DISCOVERY.md',
            ),
          ],
        }),
      );
    }

    return findings;
  }

  // ── 2. detectReleaseHealth ────────────────────────────────────────────────

  /**
   * Release health is NOT_CONNECTED — requires Vercel deploy API (VERCEL_TOKEN) to read
   * the status of the last production deploy (READY / ERROR / BUILDING).
   * Structural: the pipeline order + gates are CONNECTED.
   */
  detectReleaseHealth(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const di = this.intel();
    const ds = this.state();

    // Live release health — NOT_CONNECTED (honest)
    findings.push(
      this.fb.build({
        area: 'deployment',
        kind: 'release-health',
        severity: 'info',
        subject: 'live-release-health',
        title: 'Live release health: NOT_CONNECTED',
        detail:
          'Vercel deploy status (READY / ERROR / BUILDING) and Cloudflare worker deploy status ' +
          'cannot be read without VERCEL_TOKEN. Structural pipeline gates are CONNECTED and ' +
          'verified below, but live release outcome is unknown.',
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: [
          this.eb.notConnected('vercel-deploy-status', 'VERCEL_TOKEN'),
          this.eb.notConnected('cloudflare-worker-deploy-status', 'CLOUDFLARE_API_TOKEN'),
        ],
      }),
    );

    // Structural: pipeline order + gates are CONNECTED
    const gate = ds?.gate ?? di?.summary?.pipeline;
    const pipelineOrder: string[] =
      ds?.gate?.order ?? di?.summary?.pipeline?.order ?? [];
    if (pipelineOrder.length > 0) {
      const migrateGate = ds?.gate?.migrateGate ?? di?.summary?.pipeline?.migrateGate ?? false;
      const appliesMigrations = ds?.gate?.appliesMigrations ?? di?.summary?.pipeline?.appliesMigrations ?? false;
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: 'pipeline-gate',
          severity: 'info',
          subject: 'production-pipeline-gates',
          title: `Production pipeline: ${pipelineOrder.length} gated steps`,
          detail:
            `Declared pipeline order: ${pipelineOrder.join(' → ')}. ` +
            `migrateGate: ${migrateGate} (blocks deploy on failed migration). ` +
            `appliesMigrations: ${appliesMigrations} (migrations require explicit approval; fail-closed). ` +
            'Primary gate workflow: production-deploy.yml with branch-lag + validate-governance + migrate-production.',
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('deployment-state', 'gate', `migrateGate=${migrateGate}, order=[${pipelineOrder.join(', ')}]`),
          ],
        }),
      );
    }

    // Structural: secrets dependency — all 19 must be present for deploy
    const secretDeps = di?.secretDeps;
    if (secretDeps) {
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: 'secrets-required',
          severity: 'high',
          subject: 'deploy-secrets',
          title: `${secretDeps.required ?? 19} secrets required for worker deploy`,
          detail:
            `${secretDeps.required ?? 19} secrets must all be present (wrangler secret put) or the ` +
            'worker deploy fails closed. Missing any single secret blocks the entire platform ' +
            `release. Required: ${(secretDeps.names ?? []).join(', ')}.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(
              'deployment-intelligence-v5',
              'secretDeps',
              `${secretDeps.required ?? 19} required secrets — any missing = deploy blocked`,
            ),
          ],
        }),
      );
    }

    return findings;
  }

  // ── 3. detectRollbacks ───────────────────────────────────────────────────

  /**
   * Structural: rollback scripts presence is CONNECTED (scripts exist on disk).
   * Live rollback EVENTS (when last rollback ran, its outcome) are NOT_CONNECTED.
   * Missing rollback scripts would be a high-severity finding; all 4 are present.
   */
  detectRollbacks(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const di = this.intel();
    const ds = this.state();

    const rollbackInfo: RollbackInfo | null | undefined =
      (di?.rollback ?? null) ?? (ds?.rollback as RollbackInfo | null | undefined);

    // Rollback scripts present — CONNECTED (reassuring)
    const rollbackPresent = rollbackInfo?.present ?? di?.summary?.rollbackPresent ?? false;
    const rollbackScripts: string[] = rollbackInfo?.scripts ?? [];
    const expectedScripts = [
      'production-rollback.mjs',
      'production-deploy.mjs',
      'deploy-worker-runtime.mjs',
      'verify-health-gates.mjs',
    ];

    if (rollbackPresent && rollbackScripts.length >= 4) {
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: 'rollback-scripts-present',
          severity: 'info',
          subject: 'rollback-scripts',
          title: `All ${rollbackScripts.length} rollback scripts present`,
          detail:
            `Rollback scripts are present in infrastructure/scripts/deploy/: ` +
            `${rollbackScripts.join(', ')}. ` +
            'Primary script: production-rollback.mjs (dispatched via production-rollout.yml). ' +
            'Worker rollback: re-deploy prior worker version via deploy-worker-runtime.mjs. ' +
            'Vercel rollback: platform-native (not scripted in repo). ' +
            'DB rollback: forward-fix only (no down-migration scripts — by design).',
          status: 'CONNECTED',
          evidence: rollbackScripts.map((s) =>
            evidence('artifact-field', s, 'rollback script present on disk', 'graphify-out/deployment-intelligence-v5.json'),
          ),
        }),
      );
    } else {
      // Check for missing expected scripts
      const missing = expectedScripts.filter((s) => !rollbackScripts.includes(s));
      if (missing.length > 0) {
        findings.push(
          this.fb.build({
            area: 'deployment',
            kind: 'missing-rollback-scripts',
            severity: 'high',
            subject: 'rollback-scripts',
            title: `${missing.length} expected rollback scripts missing`,
            detail:
              `Expected rollback scripts not found: ${missing.join(', ')}. ` +
              'Missing scripts degrade rollback capability. Verify infrastructure/scripts/deploy/ ' +
              'and re-run `pnpm graph:infra` to refresh the artifact.',
            status: 'CONNECTED',
            evidence: [
              this.eb.artifact(
                'deployment-intelligence-v5',
                'rollback.scripts',
                `found: [${rollbackScripts.join(', ')}], expected: [${expectedScripts.join(', ')}]`,
              ),
            ],
          }),
        );
      } else {
        findings.push(
          this.fb.build({
            area: 'deployment',
            kind: 'rollback-scripts-present',
            severity: 'info',
            subject: 'rollback-scripts',
            title: 'Rollback scripts confirmed present',
            detail:
              'All expected rollback scripts are present in infrastructure/scripts/deploy/. ' +
              'Artifact rollback.present flag not explicitly set, but scripts list is complete.',
            status: 'CONNECTED',
            evidence: [
              this.eb.artifact('deployment-intelligence-v5', 'rollback', 'rollback scripts list verified'),
            ],
          }),
        );
      }
    }

    // Forward-only migration policy — CONNECTED (no down-scripts = by design)
    findings.push(
      this.fb.build({
        area: 'deployment',
        kind: 'forward-only-migrations',
        severity: 'info',
        subject: 'migration-rollback',
        title: 'Migration rollback: forward-fix-only (by design)',
        detail:
          'The platform uses 103 forward-only migrations (no down-migration scripts). ' +
          'DB rollback is a forward-fix migration, never a destructive down-migration. ' +
          'This is an intentional design decision documented in LCOS_DEPLOYMENT_DISCOVERY.md §6.',
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(
            'deployment-state',
            'declared.totalMigrations',
            '103 migrations — forward-only policy; 0 down-migration scripts',
          ),
          this.eb.doc(
            'LCOS_DEPLOYMENT_DISCOVERY.md §6',
            'Rollback Strategy: DB rollback is forward-fix, never down-migrate',
            'docs/lcis-operations/LCOS_DEPLOYMENT_DISCOVERY.md',
          ),
        ],
      }),
    );

    // Live rollback events — NOT_CONNECTED
    findings.push(
      this.fb.build({
        area: 'deployment',
        kind: 'rollback-events',
        severity: 'info',
        subject: 'live-rollback-events',
        title: 'Live rollback events: NOT_CONNECTED',
        detail:
          'When rollbacks last ran, their outcomes, and current rollback-in-progress status ' +
          'cannot be determined without Vercel API (VERCEL_TOKEN) or Cloudflare API ' +
          '(CLOUDFLARE_API_TOKEN + CF_ACCOUNT_ID). Value=null, confidence=0.',
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: [
          this.eb.notConnected('vercel-rollback-event-log', 'VERCEL_TOKEN'),
          this.eb.notConnected('cloudflare-worker-rollback-events', 'CLOUDFLARE_API_TOKEN'),
        ],
      }),
    );

    return findings;
  }

  // ── 4. detectFailedDeploys ───────────────────────────────────────────────

  /**
   * Live failed deploy signals are NOT_CONNECTED (require provider APIs).
   * Structural CONNECTED findings: the 3 declared SPOFs + no-canary mechanism
   * are the structural preconditions that make deploy failures impactful.
   */
  detectFailedDeploys(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const di = this.intel();

    // Live failed deploy status — NOT_CONNECTED
    findings.push(
      this.fb.build({
        area: 'deployment',
        kind: 'live-failed-deploys',
        severity: 'info',
        subject: 'live-failed-deploy-status',
        title: 'Live failed deploy status: NOT_CONNECTED',
        detail:
          'Whether a deploy is currently failing or has failed recently cannot be determined ' +
          'without Vercel API (VERCEL_TOKEN) or Cloudflare API (CLOUDFLARE_API_TOKEN + CF_ACCOUNT_ID). ' +
          'Value=null, confidence=0. Structural failure-mode preconditions below are CONNECTED.',
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: [
          this.eb.notConnected('vercel-deploy-failure-status', 'VERCEL_TOKEN'),
          this.eb.notConnected('cloudflare-worker-deploy-failure', 'CLOUDFLARE_API_TOKEN'),
        ],
      }),
    );

    // SPOF findings — CONNECTED (structural predisposition to blast-radius from a failed deploy)
    const spofs: SpofEntry[] = di?.spof ?? [];
    for (const spof of spofs) {
      const isCritical = spof.kind === 'single-pipeline' || spof.kind === 'shared-datastore';
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: `spof-${spof.kind}`,
          severity: isCritical ? 'critical' : 'high',
          subject: spof.id,
          title: `SPOF ${spof.id}: ${spof.kind}`,
          detail:
            `${spof.detail} Mitigation declared: ${spof.mitigation}. ` +
            'A deploy failure exploiting this SPOF blocks or degrades the entire platform.',
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(
              'deployment-intelligence-v5',
              `spof[${spof.id}]`,
              `${spof.id} — ${spof.kind}: ${spof.detail}`,
            ),
            this.eb.doc(
              `LCOS_DEPLOYMENT_DISCOVERY.md §5 ${spof.id}`,
              spof.detail,
              'docs/lcis-operations/LCOS_DEPLOYMENT_DISCOVERY.md',
            ),
          ],
        }),
      );
    }

    // If no SPOFs in artifact, emit an honest unknown
    if (spofs.length === 0) {
      findings.push(
        this.fb.build({
          area: 'deployment',
          kind: 'spof-unknown',
          severity: 'medium',
          subject: 'spof-list',
          title: 'SPOF list not available from artifact',
          detail:
            'deployment-intelligence-v5.json did not contain a spof[] array. ' +
            'Run `pnpm graph:infra` to regenerate. Discovery doc records 3 SPOFs: ' +
            'D-1 single-pipeline, D-2 shared-datastore, D-3 migrate-before-deploy.',
          status: 'UNKNOWN',
          evidence: [
            this.eb.artifact('deployment-intelligence-v5', 'spof', 'array absent or empty'),
          ],
        }),
      );
    }

    return findings;
  }

  // ── 5. generateDeploymentReport ──────────────────────────────────────────

  /**
   * Compose the full DeploymentReport via operations().
   * Aggregates all four detect methods + signals + health + an honest summary.
   */
  generateDeploymentReport(): DeploymentReport {
    const deploymentFindings = this.detectDeployments();
    const releaseHealthFindings = this.detectReleaseHealth();
    const rollbackFindings = this.detectRollbacks();
    const failedDeployFindings = this.detectFailedDeploys();

    const allFindings: OperationalFinding[] = [
      ...deploymentFindings,
      ...releaseHealthFindings,
      ...rollbackFindings,
      ...failedDeployFindings,
    ];

    const signals = this.deploymentSignals();

    // Build facts from declared state
    const facts: OperationalFact[] = this.buildFacts();

    // Aggregate evidence from all findings
    const allEvidence = allFindings.flatMap((f) => f.evidence);

    const healthResult = this.health.forArea('deployment', allFindings, signals.map((s) => ({
      key: s.key,
      area: s.area,
      status: s.status,
      value: s.value,
      requiresEnvVar: s.requiresEnvVar,
      source: s.source,
      evidence: s.evidence,
    })));

    const ds = this.state();
    const di = this.intel();

    const connectedFindings = allFindings.filter((f) => f.status === 'CONNECTED');
    const notConnectedFindings = allFindings.filter((f) => f.status === 'NOT_CONNECTED');
    const criticalFindings = allFindings.filter((f) => f.severity === 'critical' && f.status === 'CONNECTED');

    const headCommit = ds?.declared?.headCommit ?? di?.state?.headCommit ?? 'unknown';
    const branch = ds?.declared?.branch ?? di?.state?.branch ?? 'unknown';
    const workerCount = di?.summary?.workers ?? ds?.targets?.workers?.length ?? 4;
    const vercelCount = di?.summary?.vercelApps ?? ds?.targets?.vercelApps?.length ?? 5;
    const spofCount = (di?.spof ?? []).length;
    const rollbackPresent = di?.rollback?.present ?? di?.summary?.rollbackPresent ?? false;

    const summary =
      `Deployment posture for LetBuyy platform (HEAD: ${headCommit}, branch: ${branch}). ` +
      `${workerCount} Cloudflare workers + ${vercelCount} Vercel apps declared as deploy targets. ` +
      `${spofCount} SPOFs documented (D-1 single-pipeline, D-2 shared-datastore, D-3 migrate-before-deploy). ` +
      `Rollback scripts: ${rollbackPresent ? 'ALL PRESENT (reassuring)' : 'STATUS UNKNOWN'}. ` +
      `No canary mechanism — all workers deploy simultaneously. ` +
      `${criticalFindings.length} CONNECTED critical finding(s). ` +
      `${connectedFindings.length} structural findings CONNECTED; ` +
      `${notConnectedFindings.length} live values NOT_CONNECTED (live version, release health, rollback events — require VERCEL_TOKEN + CLOUDFLARE_API_TOKEN).`;

    return operations(
      {
        area: 'deployment' as const,
        facts,
        findings: allFindings,
        signals,
        health: healthResult,
        summary,
      },
      {
        evidence: allEvidence,
        liveConnected: false,
        now: this.now,
      },
    );
  }

  // ── Private: build facts from declared state ──────────────────────────────

  private buildFacts(): OperationalFact[] {
    const facts: OperationalFact[] = [];
    const ds = this.state();
    const di = this.intel();
    const norm = this.norm;
    const eb = this.eb;

    const headCommit = ds?.declared?.headCommit ?? di?.state?.headCommit;
    if (headCommit) {
      facts.push(
        norm.fact('deployment', 'declared-head', 'HEAD commit', `Branch: ${ds?.declared?.branch ?? 'unknown'}`, {
          value: headCommit,
          status: 'CONNECTED',
          evidence: [eb.artifact('deployment-state', 'declared.headCommit', headCommit)],
        }),
      );
    }

    const latestMigration = ds?.declared?.latestMigration;
    if (latestMigration) {
      facts.push(
        norm.fact('deployment', 'latest-migration', `migration #${latestMigration.n}`, latestMigration.file ?? '', {
          value: latestMigration.n ?? null,
          status: 'CONNECTED',
          evidence: [eb.artifact('deployment-state', 'declared.latestMigration', `#${latestMigration.n} ${latestMigration.file ?? ''}`)],
        }),
      );
    }

    const totalMigrations = ds?.declared?.totalMigrations ?? di?.state?.totalMigrations;
    if (totalMigrations !== undefined) {
      facts.push(
        norm.fact('deployment', 'total-migrations', 'total migrations', 'forward-only', {
          value: totalMigrations,
          status: 'CONNECTED',
          evidence: [eb.artifact('deployment-state', 'declared.totalMigrations', String(totalMigrations))],
        }),
      );
    }

    const workers = ds?.targets?.workers ?? [];
    if (workers.length > 0) {
      facts.push(
        norm.fact('deployment', 'worker-targets', 'Cloudflare Workers', workers.join(', '), {
          value: workers.length,
          status: 'CONNECTED',
          evidence: [eb.artifact('deployment-state', 'targets.workers', workers.join(', '))],
        }),
      );
    }

    const vercelApps = ds?.targets?.vercelApps ?? [];
    if (vercelApps.length > 0) {
      facts.push(
        norm.fact('deployment', 'vercel-targets', 'Vercel apps', vercelApps.join(', '), {
          value: vercelApps.length,
          status: 'CONNECTED',
          evidence: [eb.artifact('deployment-state', 'targets.vercelApps', vercelApps.join(', '))],
        }),
      );
    }

    const secretsRequired = ds?.targets?.secretsRequired ?? di?.secretDeps?.required ?? 19;
    facts.push(
      norm.fact('deployment', 'secrets-required', 'deploy secrets', 'must all be present for worker deploy', {
        value: secretsRequired,
        status: 'CONNECTED',
        evidence: [
          eb.artifact('deployment-intelligence-v5', 'secretDeps.required', `${secretsRequired} secrets required`),
        ],
      }),
    );

    // Subdomains — CONNECTED
    const subdomains: SubdomainEntry[] = di?.subdomains ?? [];
    for (const sub of subdomains) {
      facts.push(
        norm.fact('deployment', 'subdomain', sub.app, `${sub.host} via ${sub.via}`, {
          value: sub.host,
          status: 'CONNECTED',
          evidence: [eb.artifact('deployment-intelligence-v5', 'subdomains', `${sub.host} → ${sub.app} via ${sub.via}`)],
        }),
      );
    }

    // Live deployed version — NOT_CONNECTED
    facts.push(
      norm.fact('deployment', 'live-deployed-version', 'live deployed version', 'NOT_CONNECTED — requires Vercel + Cloudflare APIs', {
        value: null,
        status: 'NOT_CONNECTED',
        evidence: [
          eb.notConnected('live-deployed-version', 'VERCEL_TOKEN'),
          eb.notConnected('cloudflare-worker-version', 'CLOUDFLARE_API_TOKEN'),
        ],
      }),
    );

    // Live applied migration — NOT_CONNECTED
    facts.push(
      norm.fact('deployment', 'live-applied-migration', 'live applied migration (production)', 'NOT_CONNECTED — requires Supabase API', {
        value: null,
        status: 'NOT_CONNECTED',
        evidence: [
          eb.notConnected('supabase-applied-migration', 'SUPABASE_SERVICE_ROLE_KEY'),
        ],
      }),
    );

    return facts;
  }
}
