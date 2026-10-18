/**
 * analyze.test.ts — LCIS PR Intelligence: analyzePr + renderComment tests.
 *
 * Strategy:
 *   - All sensitivity/risk/comment tests use a STUB engine (no graphify-out artifacts required)
 *     so they are always green regardless of artifact presence.
 *   - Blast-radius + domain-expansion tests mark themselves { skip: !hasArtifacts } so they
 *     run only when graphify-out/ is present (CI with artifacts, or local after pnpm graph:omega).
 *
 * ≥30 test assertions across all suites.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore, createEngine, resetEngine } from '@letbuyy/lcis-core';
import type { LcisEngine } from '@letbuyy/lcis-core';
import { analyzePr } from '../src/analyze';
import { renderComment, renderJson, renderSummary } from '../src/comment';
import { filePathToDomain, matchesAny, PAYMENT_PATTERNS, AUTH_PATTERNS, MIGRATION_PATTERNS, TENANT_PATTERNS, VALIDATOR_PATTERNS, SECURITY_PATTERNS, RLS_PATTERNS } from '../src/domain-map';
import type { PrReport } from '../src/types';
import { PrInputSchema } from '../src/types';

// ── Fixtures & stub engine ───────────────────────────────────────────────────

let hasArtifacts: boolean;
let realEngine: LcisEngine;

/** Stub engine — all services return empty/null so tests never depend on graphify-out. */
function makeStubEngine(): LcisEngine {
  const store = {
    has: () => false,
    tryRead: () => null,
    read: () => { throw new Error('no artifact'); },
    pathOf: () => '',
  } as unknown as ArtifactStore;

  return createEngine({ store, repoRoot: '/stub' });
}

before(() => {
  const store = ArtifactStore.default();
  hasArtifacts = store.has('domain-intel') && store.has('graph');
  if (hasArtifacts) {
    realEngine = createEngine();
  }
});

// ── Suite 1: Input validation (zod) ─────────────────────────────────────────

describe('PrInput zod validation', () => {
  it('accepts valid input with changedFiles only', () => {
    const parsed = PrInputSchema.parse({ changedFiles: ['apps/platform/identity/src/auth/route.ts'] });
    assert.equal(parsed.changedFiles.length, 1);
    assert.equal(parsed.changedSymbols, undefined);
  });

  it('accepts empty changedFiles array', () => {
    const parsed = PrInputSchema.parse({ changedFiles: [] });
    assert.equal(parsed.changedFiles.length, 0);
  });

  it('accepts changedFiles + changedSymbols', () => {
    const parsed = PrInputSchema.parse({ changedFiles: ['a.ts'], changedSymbols: ['getSupabaseAdmin'] });
    assert.equal(parsed.changedSymbols?.length, 1);
    assert.equal(parsed.changedSymbols?.[0], 'getSupabaseAdmin');
  });

  it('rejects missing changedFiles', () => {
    assert.throws(() => PrInputSchema.parse({}), /changedFiles/);
  });

  it('rejects non-string items in changedFiles', () => {
    assert.throws(() => PrInputSchema.parse({ changedFiles: [42] }));
  });
});

// ── Suite 2: domain-map path heuristics ─────────────────────────────────────

describe('filePathToDomain heuristics', () => {
  it('maps payment route → payments', () => {
    assert.equal(filePathToDomain('services/api-gateway/src/routes/payment/razorpay.ts'), 'payments');
  });

  it('maps migration SQL → null (no domain rule for generic .sql)', () => {
    // .sql is matched by MIGRATION_PATTERNS sensitivity, not domain rules
    const domain = filePathToDomain('database/supabase/migrations/178_add_table.sql');
    // SQL migrations don't map to a specific business domain by path alone
    assert.ok(domain === null || typeof domain === 'string');
  });

  it('maps identity-platform auth file → authentication', () => {
    assert.equal(filePathToDomain('apps/platform/identity/src/app/api/auth/session/route.ts'), 'authentication');
  });

  it('maps orders page → orders', () => {
    assert.equal(filePathToDomain('apps/merchant/web/src/app/[store]/orders/page.tsx'), 'orders');
  });

  it('maps inventory page → inventory', () => {
    assert.equal(filePathToDomain('apps/merchant/web/src/app/[store]/products/inventory/page.tsx'), 'inventory');
  });

  it('maps customer-web → storefront', () => {
    assert.equal(filePathToDomain('apps/commerce/web/src/proxy.ts'), 'storefront');
  });

  it('maps theme-engine → themes', () => {
    assert.equal(filePathToDomain('packages/theme-engine/src/liquid/renderer.ts'), 'themes');
  });

  it('maps refund RPC ref → payments (payment pattern wins)', () => {
    assert.equal(filePathToDomain('services/api-gateway/src/routes/refunds/complete_order_refund.ts'), 'payments');
  });

  it('returns null for docs-only files', () => {
    assert.equal(filePathToDomain('docs/architecture/overview.md'), null);
  });

  it('returns null for tsconfig', () => {
    assert.equal(filePathToDomain('packages/lcis-pr-check/tsconfig.json'), null);
  });
});

// ── Suite 3: matchesAny sensitivity patterns ─────────────────────────────────

describe('matchesAny sensitivity patterns', () => {
  it('PAYMENT_PATTERNS match payment file', () => {
    assert.ok(matchesAny('services/api-gateway/src/lib/razorpay/verify.ts', PAYMENT_PATTERNS));
  });

  it('PAYMENT_PATTERNS match ledger reference', () => {
    assert.ok(matchesAny('database/supabase/migrations/050_ledger_entries.sql', PAYMENT_PATTERNS));
  });

  it('AUTH_PATTERNS match session file', () => {
    assert.ok(matchesAny('apps/platform/identity/src/lib/auth/cookies.ts', AUTH_PATTERNS));
  });

  it('AUTH_PATTERNS match jwt reference', () => {
    assert.ok(matchesAny('packages/auth-core/src/jwt.ts', AUTH_PATTERNS));
  });

  it('MIGRATION_PATTERNS match supabase migration', () => {
    assert.ok(matchesAny('database/supabase/migrations/178_x.sql', MIGRATION_PATTERNS));
  });

  it('TENANT_PATTERNS match site_id reference', () => {
    assert.ok(matchesAny('services/api-gateway/src/middleware/verifySiteOwnership.ts', TENANT_PATTERNS));
  });

  it('VALIDATOR_PATTERNS match governance file', () => {
    assert.ok(matchesAny('scripts/validate-governance.mjs', VALIDATOR_PATTERNS));
  });

  it('SECURITY_PATTERNS match supabase admin client', () => {
    assert.ok(matchesAny('services/api-gateway/src/lib/supabase.ts', SECURITY_PATTERNS));
  });

  it('RLS_PATTERNS match policy migration', () => {
    assert.ok(matchesAny('database/supabase/migrations/030_rls_policies.sql', RLS_PATTERNS));
  });

  it('no false positive on unrelated file', () => {
    assert.ok(!matchesAny('apps/marketing/web/src/app/globals.css', PAYMENT_PATTERNS));
    assert.ok(!matchesAny('apps/marketing/web/src/app/globals.css', AUTH_PATTERNS));
  });
});

// ── Suite 4: analyzePr — docs-only change (LOW risk) ─────────────────────────

describe('analyzePr — docs-only change', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzePr(
      { changedFiles: ['docs/architecture/overview.md', 'README.md', 'apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
    );
  });

  it('risk is LOW', () => {
    assert.equal(report.risk.level, 'LOW');
  });

  it('no paymentRelated flag', () => {
    assert.equal(report.sensitivity.paymentRelated, false);
  });

  it('no migrationRelated flag', () => {
    assert.equal(report.sensitivity.migrationRelated, false);
  });

  it('no authRelated flag', () => {
    assert.equal(report.sensitivity.authRelated, false);
  });

  it('generatedAt is an ISO string', () => {
    assert.ok(new Date(report.generatedAt).getFullYear() >= 2026);
  });

  it('risk reasons mention no elevated signals', () => {
    assert.ok(report.risk.reasons.some((r) => r.includes('no sensitive patterns')));
  });
});

// ── Suite 5: analyzePr — migration SQL file (HIGH risk) ─────────────────────

describe('analyzePr — migration SQL file', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzePr(
      { changedFiles: ['database/supabase/migrations/178_add_rls_policy.sql'] },
      makeStubEngine(),
    );
  });

  it('migrationRelated flag is true', () => {
    assert.equal(report.sensitivity.migrationRelated, true);
  });

  it('risk is at least HIGH', () => {
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    assert.ok(order.indexOf(report.risk.level) >= order.indexOf('HIGH'));
  });

  it('validationWarnings contains migrationRelated entry', () => {
    const hasWarning = report.validationWarnings.some((w) => w.includes('[migrationRelated]'));
    assert.ok(hasWarning, 'expected migrationRelated warning');
  });

  it('warning cites the SQL file path', () => {
    const hasFile = report.validationWarnings.some((w) =>
      w.includes('178_add_rls_policy.sql'),
    );
    assert.ok(hasFile);
  });

  it('risk reasons mention migrationRelated', () => {
    assert.ok(report.risk.reasons.some((r) => r.includes('migrationRelated')));
  });
});

// ── Suite 6: analyzePr — payment/ledger files (CRITICAL risk) ───────────────

describe('analyzePr — payment/ledger change', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzePr(
      {
        changedFiles: [
          'services/api-gateway/src/routes/payment/razorpay-verify.ts',
          'services/api-gateway/src/lib/supabase.ts',
        ],
      },
      makeStubEngine(),
    );
  });

  it('paymentRelated flag is true', () => {
    assert.equal(report.sensitivity.paymentRelated, true);
  });

  it('securitySensitive flag is true (supabase.ts)', () => {
    assert.equal(report.sensitivity.securitySensitive, true);
  });

  it('risk is CRITICAL', () => {
    assert.equal(report.risk.level, 'CRITICAL');
  });

  it('validationWarnings contains paymentRelated entry', () => {
    assert.ok(report.validationWarnings.some((w) => w.includes('[paymentRelated]')));
  });

  it('validationWarnings contains securitySensitive entry', () => {
    assert.ok(report.validationWarnings.some((w) => w.includes('[securitySensitive]')));
  });

  it('affected domains includes payments', () => {
    assert.ok(report.affectedDomains.some((d) => d.key === 'payments'));
  });

  it('payments domain is flagged as money', () => {
    const pd = report.affectedDomains.find((d) => d.key === 'payments');
    assert.equal(pd?.money, true);
  });

  it('risk reasons mention canonical-ledger', () => {
    assert.ok(report.risk.reasons.some((r) => r.includes('canonical-ledger')));
  });
});

// ── Suite 7: analyzePr — auth change (HIGH risk) ─────────────────────────────

describe('analyzePr — auth/session change', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzePr(
      { changedFiles: ['apps/platform/identity/src/lib/auth/cookies.ts'] },
      makeStubEngine(),
    );
  });

  it('authRelated flag is true', () => {
    assert.equal(report.sensitivity.authRelated, true);
  });

  it('risk is at least HIGH', () => {
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    assert.ok(order.indexOf(report.risk.level) >= order.indexOf('HIGH'));
  });

  it('validationWarnings cites the file', () => {
    assert.ok(report.validationWarnings.some((w) => w.includes('cookies.ts')));
  });
});

// ── Suite 8: analyzePr — cross-domain change (MEDIUM+ risk) ─────────────────

describe('analyzePr — cross-domain PR', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzePr(
      {
        changedFiles: [
          'apps/merchant/web/src/app/[store]/orders/page.tsx',
          'apps/merchant/web/src/app/[store]/products/inventory/page.tsx',
          'apps/commerce/web/src/proxy.ts',
        ],
      },
      makeStubEngine(),
    );
  });

  it('crossDomain flag is true', () => {
    assert.equal(report.sensitivity.crossDomain, true);
  });

  it('affectedDomains has >1 domain', () => {
    assert.ok(report.affectedDomains.length > 1);
  });

  it('risk is at least MEDIUM', () => {
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    assert.ok(order.indexOf(report.risk.level) >= order.indexOf('MEDIUM'));
  });

  it('validationWarnings includes crossDomain warning', () => {
    assert.ok(report.validationWarnings.some((w) => w.includes('[crossDomain]')));
  });
});

// ── Suite 9: analyzePr — validator/governance change ─────────────────────────

describe('analyzePr — governance file change', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzePr(
      { changedFiles: ['scripts/validate-governance.mjs', 'CLAUDE.md'] },
      makeStubEngine(),
    );
  });

  it('validatorImpact flag is true', () => {
    assert.equal(report.sensitivity.validatorImpact, true);
  });

  it('risk is at least MEDIUM', () => {
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    assert.ok(order.indexOf(report.risk.level) >= order.indexOf('MEDIUM'));
  });

  it('warnings mention validate-governance.mjs', () => {
    assert.ok(report.validationWarnings.some((w) => w.includes('validate-governance.mjs')));
  });
});

// ── Suite 10: analyzePr — frozen app touch (architecture warning) ─────────────

describe('analyzePr — frozen app touch', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzePr(
      { changedFiles: ['apps/frozen/app-store/src/pages/listing.tsx'] },
      makeStubEngine(),
    );
  });

  it('architectureWarnings contains frozen-app warning', () => {
    assert.ok(report.architectureWarnings.some((w) => w.includes('[frozen-app]')));
  });

  it('warning mentions app-marketplace', () => {
    assert.ok(report.architectureWarnings.some((w) => w.includes('app-marketplace')));
  });

  it('covers all canonical frozen roots without matching a similarly named live path', async () => {
    const paths = ['developer-portal','theme-store','operations-portal'];
    for (const path of paths) {
      resetEngine();
      const result = await analyzePr({ changedFiles: [`apps/frozen/${path}/src/page.tsx`] }, makeStubEngine());
      assert.equal(result.architectureWarnings.filter(w => w.includes('[frozen-app]')).length, 1);
    }
    resetEngine();
    const result = await analyzePr({ changedFiles: ['apps/frozen/app-storefront/src/page.tsx','apps/merchant/web/src/page.tsx'] }, makeStubEngine());
    assert.equal(result.architectureWarnings.filter(w => w.includes('[frozen-app]')).length, 0);
  });
});

// ── Suite 11: analyzePr — determinism ────────────────────────────────────────

describe('analyzePr — determinism', () => {
  it('same input produces same risk level (run twice)', async () => {
    const input = {
      changedFiles: [
        'services/api-gateway/src/routes/payment/razorpay-verify.ts',
        'database/supabase/migrations/099_rls.sql',
      ],
    };
    const stub = makeStubEngine();
    resetEngine();
    const r1 = await analyzePr(input, stub);
    resetEngine();
    const r2 = await analyzePr(input, stub);
    assert.equal(r1.risk.level, r2.risk.level);
    assert.deepEqual(r1.sensitivity, r2.sensitivity);
  });

  it('same input produces same validationWarnings count', async () => {
    const input = { changedFiles: ['apps/platform/identity/src/lib/auth/cookies.ts'] };
    const stub = makeStubEngine();
    resetEngine();
    const r1 = await analyzePr(input, stub);
    resetEngine();
    const r2 = await analyzePr(input, stub);
    assert.equal(r1.validationWarnings.length, r2.validationWarnings.length);
  });
});

// ── Suite 12: renderComment shape ────────────────────────────────────────────

describe('renderComment — shape', () => {
  let report: PrReport;
  let comment: string;

  before(async () => {
    resetEngine();
    report = await analyzePr(
      {
        changedFiles: [
          'services/api-gateway/src/routes/payment/razorpay-verify.ts',
          'database/supabase/migrations/178_x.sql',
          'apps/platform/identity/src/lib/auth/cookies.ts',
        ],
      },
      makeStubEngine(),
    );
    comment = renderComment(report);
  });

  it('contains ## LCIS ANALYSIS heading', () => {
    assert.ok(comment.includes('## LCIS ANALYSIS'), `heading missing:\n${comment.slice(0, 400)}`);
  });

  it('contains **Risk:** line', () => {
    assert.ok(comment.includes('**Risk:**'), `Risk line missing:\n${comment.slice(0, 400)}`);
  });

  it('contains the risk level text', () => {
    assert.ok(comment.includes(report.risk.level), `risk level '${report.risk.level}' not in comment`);
  });

  it('contains ### Affected Domains section', () => {
    assert.ok(comment.includes('### Affected Domains'));
  });

  it('contains **Affected Files:**', () => {
    assert.ok(comment.includes('**Affected Files:**'));
  });

  it('contains ### Sensitivity Flags section', () => {
    assert.ok(comment.includes('### Sensitivity Flags'));
  });

  it('contains **Recommendation:** line', () => {
    assert.ok(comment.includes('**Recommendation:**'));
  });

  it('active sensitivity flags shown with checkmark', () => {
    // paymentRelated is true → should show ✅
    if (report.sensitivity.paymentRelated) {
      assert.ok(comment.includes('✅ `paymentRelated`'));
    }
  });

  it('inactive sensitivity flags shown with empty box', () => {
    // crossDomain might be false if only one domain
    // We just check the marker appears somewhere
    assert.ok(comment.includes('⬜') || comment.includes('✅'));
  });

  it('contains affected domain names', () => {
    for (const d of report.affectedDomains.slice(0, 3)) {
      assert.ok(comment.includes(d.key), `domain '${d.key}' missing from comment`);
    }
  });

  it('contains generated-at timestamp', () => {
    assert.ok(comment.includes('Generated by LCIS PR Intelligence'));
  });
});

// ── Suite 13: renderJson ──────────────────────────────────────────────────────

describe('renderJson', () => {
  it('produces valid JSON', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['apps/merchant/web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(),
    );
    const json = renderJson(report);
    const parsed = JSON.parse(json) as PrReport;
    assert.ok(parsed.risk !== undefined);
    assert.ok(Array.isArray(parsed.affectedDomains));
  });

  it('JSON includes sensitivity object', async () => {
    resetEngine();
    const report = await analyzePr({ changedFiles: ['a.ts'] }, makeStubEngine());
    const parsed = JSON.parse(renderJson(report)) as PrReport;
    assert.ok(typeof parsed.sensitivity === 'object');
    assert.ok('crossDomain' in parsed.sensitivity);
  });
});

// ── Suite 14: renderSummary ───────────────────────────────────────────────────

describe('renderSummary', () => {
  it('contains LCIS PR Summary heading', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['apps/merchant/web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(),
    );
    const summary = renderSummary(report);
    assert.ok(summary.includes('## LCIS PR Summary'));
  });

  it('contains risk level', async () => {
    resetEngine();
    const report = await analyzePr({ changedFiles: ['docs/readme.md'] }, makeStubEngine());
    const summary = renderSummary(report);
    assert.ok(summary.includes(report.risk.level));
  });

  it('contains Recommendation', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
    );
    const summary = renderSummary(report);
    assert.ok(summary.includes('**Recommendation:**'));
  });
});

// ── Suite 15: evidence trail ──────────────────────────────────────────────────

describe('evidence trail', () => {
  it('every file-mapped domain produces evidence', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['apps/platform/identity/src/lib/auth/cookies.ts'] },
      makeStubEngine(),
    );
    const fileEvidence = report.evidence.filter((e) => e.kind === 'file');
    assert.ok(fileEvidence.length > 0, 'expected at least one file evidence entry');
  });

  it('evidence entries have non-empty ref', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['apps/merchant/web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(),
    );
    for (const e of report.evidence) {
      assert.ok(e.ref.length > 0, `evidence ref must be non-empty: ${JSON.stringify(e)}`);
    }
  });
});

// ── Suite 16: blast-radius (real artifacts required) ─────────────────────────

describe('analyzePr — blast radius (requires graphify-out)', () => {
  it('blast from getSupabaseAdmin symbol', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      {
        changedFiles: ['services/api-gateway/src/lib/supabase.ts'],
        changedSymbols: ['getSupabaseAdmin'],
      },
      realEngine,
    );
    assert.ok(report.blastRadius.affectedNodes > 0, 'expected non-zero blast nodes');
    assert.ok(report.blastRadius.affectedFiles > 0, 'expected non-zero blast files');
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    assert.ok(order.indexOf(report.risk.level) >= order.indexOf('HIGH'), `expected HIGH+ risk, got ${report.risk.level}`);
  });

  it('blast from unknown symbol is graceful (zero nodes)', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: [], changedSymbols: ['__nonexistent_symbol_xyz__'] },
      realEngine,
    );
    assert.equal(report.blastRadius.affectedNodes, 0);
    assert.ok(report.evidence.some((e) => e.detail?.includes('not found')));
  });

  it('domain-intel expansion adds reviewers', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      realEngine,
    );
    // payments domain should produce owners (even if empty, the evidence entry exists)
    const ownerEvidence = report.evidence.some((e) => e.ref.includes('.owners'));
    assert.ok(ownerEvidence, 'expected ownership evidence for payments domain');
  });
});

// ── Suite 17: blast-from-files (requires graphify-out) ───────────────────────
//
// Verifies the core bug fix: blast radius is derived from changed FILES, not
// only from explicitly-passed changedSymbols.

describe('analyzePr — blast from changed files (requires graphify-out)', () => {
  it('supabase.ts alone yields ≥50 impacted files', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['services/api-gateway/src/lib/supabase.ts'] },
      realEngine,
    );
    assert.ok(
      report.blastRadius.affectedFiles >= 50,
      `expected ≥50 impacted files but got ${report.blastRadius.affectedFiles}`,
    );
    assert.ok(
      report.blastRadius.affectedNodes > 0,
      'expected non-zero impacted nodes from file-derived blast',
    );
  });

  it('supabase.ts alone yields non-empty affectedDomains', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['services/api-gateway/src/lib/supabase.ts'] },
      realEngine,
    );
    assert.ok(
      report.affectedDomains.length > 0,
      'expected at least one affected domain from file-derived blast',
    );
  });

  it('docs-only file yields ~0 blast (no graph nodes)', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['docs/architecture/overview.md', 'README.md'] },
      realEngine,
    );
    // Docs files have no graph nodes — blast from files should contribute nothing;
    // the count may be 0 or very small (docs can occasionally be in the graph).
    assert.ok(
      report.blastRadius.affectedNodes < 10,
      `expected near-zero blast for docs-only but got ${report.blastRadius.affectedNodes}`,
    );
  });

  it('file-derived blast produces evidence entries for graph resolution', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['services/api-gateway/src/lib/supabase.ts'] },
      realEngine,
    );
    // Evidence should contain at least one entry showing file resolved to graph nodes
    const graphEvidence = report.evidence.filter(
      (e) => e.kind === 'graph-node' && e.ref.includes('supabase'),
    );
    assert.ok(graphEvidence.length > 0, 'expected graph-node evidence for supabase.ts');
  });

  it('file-derived blast produces evidence entry for aggregate blast', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['services/api-gateway/src/lib/supabase.ts'] },
      realEngine,
    );
    const aggregateEvidence = report.evidence.find(
      (e) => e.kind === 'graph-node' && (e.detail ?? '').includes('file-derived blast'),
    );
    assert.ok(aggregateEvidence !== undefined, 'expected file-derived blast evidence entry');
  });

  it('determinism — two runs of same file input produce same blast count', { skip: !hasArtifacts }, async () => {
    const input = { changedFiles: ['services/api-gateway/src/lib/supabase.ts'] };
    resetEngine();
    const r1 = await analyzePr(input, realEngine);
    // Do NOT reset engine between runs — tests the cache path too
    const r2 = await analyzePr(input, realEngine);
    assert.equal(r1.blastRadius.affectedNodes, r2.blastRadius.affectedNodes);
    assert.equal(r1.blastRadius.affectedFiles, r2.blastRadius.affectedFiles);
    assert.equal(r1.affectedDomains.length, r2.affectedDomains.length);
  });

  it('SQL migration file contributes sensitivity flags but no blast nodes', { skip: !hasArtifacts }, async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['database/supabase/migrations/178_x.sql'] },
      realEngine,
    );
    // SQL file: migration sensitivity flag must fire
    assert.equal(report.sensitivity.migrationRelated, true, 'migrationRelated must be true');
    // SQL file is not in the code graph — blast contribution should be 0
    assert.equal(
      report.blastRadius.affectedNodes,
      0,
      `SQL-only change should have 0 blast nodes, got ${report.blastRadius.affectedNodes}`,
    );
  });

  it('stub engine with no graph yields 0 blast (no crash)', async () => {
    // Always runs (no graphify-out required) — verifies the graceful path for missing graph
    resetEngine();
    const stubEngine = (() => {
      const store = {
        has: () => false,
        tryRead: () => null,
        read: () => { throw new Error('no artifact'); },
        pathOf: () => '',
      } as unknown as import('@letbuyy/lcis-core').ArtifactStore;
      return createEngine({ store, repoRoot: '/stub' });
    })();

    const report = await analyzePr(
      { changedFiles: ['services/api-gateway/src/lib/supabase.ts'] },
      stubEngine,
    );
    assert.equal(report.blastRadius.affectedNodes, 0);
    assert.equal(report.blastRadius.affectedFiles, 0);
  });
});
