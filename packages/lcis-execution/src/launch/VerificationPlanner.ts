/**
 * VerificationPlanner — Deliverable 7 of the EIS.
 *
 * Builds a structured verification plan from a ChangeRequest/ChangeAnalysis:
 * - pre-merge gates (must pass before merging)
 * - post-deploy checks (must pass after deploying)
 * - verification checks (what to verify and how)
 *
 * Deterministic: given the same input + now(), always produces the same output.
 * Read-only. No fetch, no spawn, no eval, no writeFile.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { ChangeAnalyzer, toAnalysis, plan } from '../shared/index';
import type {
  ChangeRequest,
  ChangeAnalysis,
  VerificationCheck,
  VerificationPlan,
} from '../shared/types';

export class VerificationPlanner {
  private readonly analyzer: ChangeAnalyzer;

  constructor(
    private readonly engine: LcisEngine,
    private readonly now = (): string => new Date().toISOString(),
  ) {
    this.analyzer = new ChangeAnalyzer(engine, now);
  }

  buildVerificationPlan(input: ChangeRequest | ChangeAnalysis): VerificationPlan {
    const analysis = toAnalysis(this.analyzer, input);
    const { affected, risk } = analysis;

    const checks: VerificationCheck[] = [];
    const preMergeGates: string[] = [];
    const postDeployChecks: string[] = [];

    // ── Pre-merge gates (always) ────────────────────────────────────────────

    preMergeGates.push('pnpm typecheck (tsc --noEmit) — zero errors required');
    preMergeGates.push('node scripts/validate-governance.mjs — 107-validator gate GREEN');
    preMergeGates.push(`blast re-check on changed symbols: graph:intel blast "<changed-symbol>"`);

    // Affected tests
    if (affected.tests.length > 0) {
      preMergeGates.push(`run ${affected.tests.length} affected test file(s): ${affected.tests.slice(0, 3).join(', ')}${affected.tests.length > 3 ? '…' : ''}`);
    } else {
      preMergeGates.push('no test files in blast radius — add coverage for changed paths');
    }

    // Money-specific pre-merge gates
    if (risk.money) {
      preMergeGates.push('canonical-ledger-only-validator: zero violations (no .from(money_table).insert/update)');
      preMergeGates.push('blast re-check on money RPCs: create_checkout_order, confirm_order_payment_with_ledger, complete_order_refund, issue_gift_card');
      preMergeGates.push('Razorpay HMAC-SHA256 signature verification path confirmed present (timingSafeEqualHex)');
      preMergeGates.push('idempotency_key required on all money RPC calls');
    }

    // Tenant-specific pre-merge gates
    if (risk.tenant) {
      preMergeGates.push('RLS check: all tenant tables have USING (site_id = auth.uid()::uuid) or equivalent policy');
      preMergeGates.push('verifySiteOwnership enforced on all routes touching tenant tables');
    }

    // ── Post-deploy checks ──────────────────────────────────────────────────

    postDeployChecks.push('production-readiness verify: engine.verification.verifyProductionReadiness() → status VERIFIED or PARTIAL');
    postDeployChecks.push('smoke test: affected service routes return 200 (not 500)');
    postDeployChecks.push('queue workers healthy: wrangler tail on queue-workers — no error spikes');
    postDeployChecks.push('architecture verify: engine.verification.verifyArchitecture() → no REFUTED');

    if (risk.money) {
      postDeployChecks.push('ledger reconciliation: create_checkout_order → confirm_order_payment_with_ledger → complete_order_refund round-trip (test environment only; never production payment)');
      postDeployChecks.push('gift-card balance is ledger projection — verify restore_gift_card_on_refund executes correctly on refund path');
    }

    if (risk.tenant) {
      postDeployChecks.push('RLS isolation smoke: attempt cross-tenant row access — must return 0 rows');
      postDeployChecks.push('domains verify: engine.verification.verifyDomains() — all domains pass ownership + route checks');
    }

    if (affected.workers.length > 0) {
      postDeployChecks.push(`worker deploy ordering: ${affected.workers.join(', ')} — deploy in dependency order; verify queue consumer bindings`);
    }

    // ── Verification checks ─────────────────────────────────────────────────

    // 1. TypeScript typecheck
    checks.push({
      id: 'VC-01-typecheck',
      description: 'TypeScript typecheck — zero compile errors',
      method: 'pnpm --filter <affected-app> typecheck',
      evidence: [evidence('file', 'tsconfig.json', 'tsc --noEmit', 'graphify-out/graph.json')],
    });

    // 2. Governance gate
    checks.push({
      id: 'VC-02-governance-gate',
      description: '107-validator governance gate — GREEN (hardViolations = 0)',
      method: 'node scripts/validate-governance.mjs',
      evidence: [evidence('validator', '107-validators', 'authoritative gate', 'graphify-out/audit-engine-v2.json')],
    });

    // 3. Affected tests
    checks.push({
      id: 'VC-03-affected-tests',
      description: `Run ${affected.tests.length} affected test file(s) from blast radius`,
      method: affected.tests.length > 0
        ? `pnpm exec tsx --test ${affected.tests.slice(0, 5).join(' ')}`
        : 'No tests in blast radius — add coverage before merge',
      evidence: [
        evidence(
          'file',
          `${affected.tests.length} test file(s)`,
          `tests covering: ${affected.domains.slice(0, 3).join(', ')} domains`,
          'graphify-out/graph.json',
        ),
        ...analysis.evidence.filter((e) => e.kind === 'file').slice(0, 3),
      ],
    });

    // 4. Blast radius re-check
    checks.push({
      id: 'VC-04-blast-recheck',
      description: 'Re-run blast radius after change to confirm no new domains affected',
      method: `pnpm graph:intel blast "${analysis.request.text.slice(0, 60)}"`,
      evidence: [
        evidence(
          'artifact-field',
          'blast-radius',
          `${affected.domains.length} domain(s), ${affected.tables.length} table(s), ${affected.rpcs.length} rpc(s) in current blast radius`,
          'graphify-out/domain-intel.json',
        ),
      ],
    });

    // 5. Production readiness verify (async; this check description is sync/descriptive)
    checks.push({
      id: 'VC-05-production-readiness',
      description: 'Production readiness verification — structural readiness ≥ 80%',
      method: 'engine.verification.verifyProductionReadiness() → confidence, status, gaps',
      evidence: [
        evidence(
          'artifact-field',
          'production-readiness-v2',
          'structural readiness artifact',
          'graphify-out/production-readiness-v2.json',
        ),
      ],
    });

    // 6. Money RPC check (conditional)
    if (risk.money) {
      checks.push({
        id: 'VC-06-money-rpc',
        description: 'canonical-ledger-only-validator: no .from(money_table).insert/update in TypeScript; all money mutations via SECURITY DEFINER RPCs',
        method: 'node scripts/validate-governance.mjs → canonical-ledger-only-validator section; grep for .from(payment_transactions|orders|refunds).insert',
        evidence: [
          evidence('rpc', 'create_checkout_order', 'canonical money RPC', 'graphify-out/db-intel.json'),
          evidence('rpc', 'confirm_order_payment_with_ledger', 'canonical money RPC', 'graphify-out/db-intel.json'),
          evidence('rpc', 'complete_order_refund', 'canonical money RPC', 'graphify-out/db-intel.json'),
          ...affected.tables.slice(0, 4).map((t) =>
            evidence('table', t, 'in blast radius', 'graphify-out/db-intel.json'),
          ),
        ],
      });
    }

    // 7. RLS check (conditional on tenant)
    if (risk.tenant) {
      checks.push({
        id: 'VC-07-rls-tenant',
        description: 'RLS isolation: all affected tenant tables have site_id-scoped policies; verifySiteOwnership enforced on all routes',
        method: 'engine.verification.verifyArchitecture() → inspect rls-gate items; audit RLS candidates in graphify-out/audit-engine-v2.json',
        evidence: [
          evidence(
            'artifact-field',
            'risk.tenant',
            `tenant=true; affected tables: ${affected.tables.join(', ')}`,
            'graphify-out/domain-intel.json',
          ),
          evidence('policy', 'rls-force-coverage-validator', 'authoritative gate (GREEN)', 'graphify-out/audit-engine-v2.json'),
        ],
      });
    }

    // 8. Service verify (if workers/services affected)
    if (affected.services.length > 0 || affected.workers.length > 0) {
      checks.push({
        id: 'VC-08-services',
        description: `Services/workers verify: ${[...affected.services, ...affected.workers].slice(0, 4).join(', ')}`,
        method: 'engine.verification.verifyServices() → no REFUTED; check worker bindings + DLQ declared',
        evidence: [
          ...affected.workers.map((w) =>
            evidence('worker', w, 'in blast radius', 'graphify-out/infra-intel.json'),
          ).slice(0, 4),
        ],
      });
    }

    // 9. API/route smoke (if APIs affected)
    if (affected.apis.length > 0) {
      checks.push({
        id: 'VC-09-api-routes',
        description: `API route smoke check: ${affected.apis.length} route(s) in blast radius`,
        method: `curl/httpie against affected routes: ${affected.apis.slice(0, 3).join(', ')}`,
        evidence: [
          evidence(
            'route',
            `${affected.apis.length} route(s)`,
            `routes: ${affected.apis.slice(0, 3).join(', ')}`,
            'graphify-out/domain-intel.json',
          ),
        ],
      });
    }

    const ev = [
      ...analysis.evidence,
      ...checks.flatMap((c) => c.evidence),
    ];

    const body = {
      request: analysis.request,
      checks,
      preMergeGates,
      postDeployChecks,
    };
    return plan(body, { evidence: ev, now: this.now });
  }
}
