/**
 * SecurityDriftService — GDIS Phase 6 security drift detection.
 *
 * All checks are STATIC and DETERMINISTIC: they reason from the boolean fields
 * in the graphify-out artifacts (db-intel / domain-intel). No live probes, no
 * fetch, no child_process, no eval, no write. No mocks, stubs, or TODOs —
 * every finding is grounded in a real artifact field.
 *
 * HONEST LIMITATIONS (documented in findings, not papered over):
 *   - Policy USING-clause SQL text is NOT present in artifacts; we reason from
 *     the boolean fields public / usesSiteId / serviceRole.
 *   - Route-level auth is heuristic (middleware inference) — findings are PARTIAL.
 *   - All live signals are NOT CONNECTED; structural-only analysis.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { Finding, SecurityDriftReport } from '../shared/types';
import {
  GovernanceArtifactStore,
  FindingBuilder,
  SeverityScorer,
  GovernanceEvidenceBuilder,
  governance,
  defaultNow,
} from '../shared/index';

const DB_SOURCE = 'graphify-out/db-intel.json';
const DOMAIN_SOURCE = 'graphify-out/domain-intel.json';

export class SecurityDriftService {
  private readonly gov: GovernanceArtifactStore;
  private readonly fb: FindingBuilder;
  private readonly scorer: SeverityScorer;
  private readonly eb: GovernanceEvidenceBuilder;

  constructor(
    private readonly core: LcisEngine,
    private readonly now = defaultNow,
  ) {
    this.gov = new GovernanceArtifactStore(core);
    this.fb = new FindingBuilder();
    this.scorer = new SeverityScorer();
    this.eb = new GovernanceEvidenceBuilder();
  }

  // ── 1. findMissingRLS ──────────────────────────────────────────────────────
  /**
   * Tenant tables with rls === false violate R002 (critical). Every tenant table
   * must have row-level security enabled so cross-tenant data leakage is blocked
   * at the DB layer, not just the application layer.
   */
  findMissingRLS(): Finding[] {
    const tables = this.gov.tables();
    const findings: Finding[] = [];

    for (const t of tables) {
      // Only flag tenant tables — non-tenant tables without RLS are a different concern
      if (!t.tenant || t.rls) continue;

      const sev = this.scorer.forEntity({ money: t.money, tenant: true });
      const ev = [
        this.eb.table(t.name, `rls=false, tenant=true, money=${t.money}, hasSiteId=${t.hasSiteId}`),
      ];

      findings.push(
        this.fb.build({
          id: this.fb.stableId('missing-rls', t.name),
          category: 'security',
          kind: 'missing-rls',
          severity: sev,
          subject: t.name,
          title: `Tenant table "${t.name}" has RLS disabled`,
          detail:
            `Table "${t.name}" is tenant-scoped (tenant=true) but row-level security is ` +
            `disabled (rls=false). Without RLS the database does not enforce per-tenant ` +
            `isolation. money=${t.money}, hasSiteId=${t.hasSiteId}. ` +
            `[Source: artifact field db-intel.tables.rls — no SQL text inspected]`,
          rule: 'R002',
          evidence: ev,
        }),
      );
    }

    return findings;
  }

  // ── 2. findDangerousPolicies ───────────────────────────────────────────────
  /**
   * Policies with public === true allow any role — including unauthenticated
   * callers — to satisfy the policy. These are the 34 public policies in the
   * artifact. Severity escalates when the policy sits on a money or tenant table.
   *
   * HONEST LIMITATION: we cannot inspect the USING / WITH CHECK SQL text; we
   * reason from the boolean field public. A public policy on a plans table for
   * anonymous product-catalogue reads is legitimate, but still surfaces here so
   * a human can verify intent.
   */
  findDangerousPolicies(): Finding[] {
    const policies = this.gov.policies();
    const tables = this.gov.tables();
    const tableByName = new Map(tables.map((t) => [t.name, t]));
    const findings: Finding[] = [];

    for (const p of policies) {
      if (!p.public) continue;

      const tbl = tableByName.get(p.table);
      const isMoney = tbl?.money ?? false;
      const isTenant = tbl?.tenant ?? false;

      const sev = this.scorer.forEntity({ money: isMoney, tenant: isTenant, public: true });

      const ev = [
        this.eb.policy(p.name, `public=true, table=${p.table}, usesSiteId=${p.usesSiteId}, serviceRole=${p.serviceRole}`),
      ];
      if (tbl) {
        ev.push(this.eb.table(p.table, `money=${isMoney}, tenant=${isTenant}`));
      }

      findings.push(
        this.fb.build({
          id: this.fb.stableId('dangerous-policy', `${p.table}--${p.name}`),
          category: 'security',
          kind: 'dangerous-policy',
          severity: sev,
          subject: p.name,
          title: `Public RLS policy "${p.name}" on table "${p.table}"`,
          detail:
            `Policy "${p.name}" on table "${p.table}" has public=true, allowing any ` +
            `role to satisfy it. money=${isMoney}, tenant=${isTenant}, ` +
            `usesSiteId=${p.usesSiteId}, serviceRole=${p.serviceRole}. ` +
            `[LIMITATION: USING-clause SQL text is NOT inspected — only the public boolean ` +
            `field from db-intel is available. Verify whether public read access is intentional.]`,
          evidence: ev,
        }),
      );
    }

    return findings;
  }

  // ── 3. findPublicMutations ─────────────────────────────────────────────────
  /**
   * Money functions with securityDefiner === false are NOT protected by the
   * SECURITY DEFINER ownership model — they run with the caller's privileges.
   * The canonical-ledger-only model requires all money RPCs to be SECURITY DEFINER.
   *
   * The real artifact shows 4 such functions (out of 34 money functions); the
   * remaining 30 are correctly marked SECURITY DEFINER.
   */
  findPublicMutations(): Finding[] {
    const fns = this.gov.functions();
    const findings: Finding[] = [];

    for (const fn of fns) {
      if (!fn.money || fn.securityDefiner) continue;

      const ev = [
        this.eb.rpc(
          fn.name,
          `money=true, securityDefiner=false, hasIdempotency=${fn.hasIdempotency}, forUpdate=${fn.forUpdate}`,
        ),
      ];

      findings.push(
        this.fb.build({
          id: this.fb.stableId('public-mutation', fn.name),
          category: 'security',
          kind: 'public-mutation',
          severity: 'critical',
          subject: fn.name,
          title: `Money function "${fn.name}" is NOT SECURITY DEFINER`,
          detail:
            `Function "${fn.name}" touches money tables (money=true) but is not ` +
            `SECURITY DEFINER (securityDefiner=false). The canonical-ledger-only model ` +
            `requires all money RPCs to run as the function's owner, not the caller. ` +
            `definedIn=${fn.definedIn}, callers=${fn.callers.length}. ` +
            `[Source: artifact field db-intel.functions.securityDefiner]`,
          rule: 'R001',
          evidence: ev,
        }),
      );
    }

    return findings;
  }

  // ── 4. findCrossTenantRisks ────────────────────────────────────────────────
  /**
   * Two structural risk signals for cross-tenant data leakage:
   *   (a) Tenant tables without hasSiteId — the primary tenant discriminator
   *       column is absent, so RLS policies cannot filter by tenant.
   *   (b) Policies on tenant tables where usesSiteId === false — the policy
   *       exists but does not reference the tenant discriminator.
   *
   * LIMITATION: we cannot read the USING clause SQL; we reason from the booleans.
   */
  findCrossTenantRisks(): Finding[] {
    const tables = this.gov.tables();
    const policies = this.gov.policies();
    const findings: Finding[] = [];

    // (a) Tenant tables missing site_id column
    for (const t of tables) {
      if (!t.tenant || t.hasSiteId) continue;

      const sev = this.scorer.forEntity({ money: t.money, tenant: true });
      const ev = [
        this.eb.table(
          t.name,
          `tenant=true, hasSiteId=false, hasStoreId=${t.hasStoreId}, rls=${t.rls}, money=${t.money}`,
        ),
      ];

      findings.push(
        this.fb.build({
          id: this.fb.stableId('cross-tenant-no-siteid', t.name),
          category: 'security',
          kind: 'cross-tenant-risk',
          severity: sev,
          subject: t.name,
          title: `Tenant table "${t.name}" has no site_id column`,
          detail:
            `Table "${t.name}" is tenant-scoped (tenant=true) but the primary tenant ` +
            `discriminator column site_id is absent (hasSiteId=false). Without site_id ` +
            `RLS policies cannot filter rows by tenant, creating a potential cross-tenant ` +
            `data leakage risk. hasStoreId=${t.hasStoreId}, rls=${t.rls}, money=${t.money}. ` +
            `[LIMITATION: USING-clause SQL text is NOT inspected — reasoning from artifact booleans only]`,
          evidence: ev,
        }),
      );
    }

    // (b) Policies on tenant tables that do not use site_id
    const tenantTableNames = new Set(tables.filter((t) => t.tenant).map((t) => t.name));
    const tableByName = new Map(tables.map((t) => [t.name, t]));

    for (const p of policies) {
      if (!tenantTableNames.has(p.table) || p.usesSiteId) continue;

      const tbl = tableByName.get(p.table);
      const sev = this.scorer.forEntity({
        money: tbl?.money,
        tenant: true,
        // public policies on tenant tables without siteId are worst
        public: p.public,
      });

      const ev = [
        this.eb.policy(
          p.name,
          `usesSiteId=false, table=${p.table}, public=${p.public}, serviceRole=${p.serviceRole}`,
        ),
      ];
      if (tbl) {
        ev.push(this.eb.table(p.table, `tenant=true, money=${tbl.money}, hasSiteId=${tbl.hasSiteId}`));
      }

      findings.push(
        this.fb.build({
          id: this.fb.stableId('cross-tenant-policy-no-siteid', `${p.table}--${p.name}`),
          category: 'security',
          kind: 'cross-tenant-risk',
          severity: sev,
          subject: p.name,
          title: `Policy "${p.name}" on tenant table "${p.table}" does not use site_id`,
          detail:
            `Policy "${p.name}" on tenant table "${p.table}" has usesSiteId=false. ` +
            `Without site_id in the USING clause the policy may not isolate rows by tenant. ` +
            `public=${p.public}, serviceRole=${p.serviceRole}. ` +
            `[LIMITATION: USING-clause SQL text is NOT inspected; usesSiteId boolean from db-intel only]`,
          evidence: ev,
        }),
      );
    }

    return findings;
  }

  // ── 5. findMissingValidation ───────────────────────────────────────────────
  /**
   * Money functions should have:
   *   - hasIdempotency === true  (idempotency key prevents double-execution)
   *   - forUpdate === true       (row lock prevents TOCTOU races)
   *
   * Functions that lack either signal violate the canonical-ledger safety model.
   */
  findMissingValidation(): Finding[] {
    const fns = this.gov.functions();
    const findings: Finding[] = [];

    for (const fn of fns) {
      if (!fn.money) continue;

      const missingIdempotency = !fn.hasIdempotency;
      const missingForUpdate = !fn.forUpdate;
      if (!missingIdempotency && !missingForUpdate) continue;

      const missing: string[] = [];
      if (missingIdempotency) missing.push('idempotency');
      if (missingForUpdate) missing.push('FOR UPDATE lock');

      const ev = [
        this.eb.rpc(
          fn.name,
          `money=true, hasIdempotency=${fn.hasIdempotency}, forUpdate=${fn.forUpdate}, securityDefiner=${fn.securityDefiner}`,
        ),
      ];

      const kind = missingIdempotency && missingForUpdate ? 'missing-idempotency-and-lock' : missingIdempotency ? 'missing-idempotency' : 'missing-for-update';

      findings.push(
        this.fb.build({
          id: this.fb.stableId('missing-validation', fn.name),
          category: 'security',
          kind: 'missing-validation',
          severity: 'high',
          subject: fn.name,
          title: `Money function "${fn.name}" missing: ${missing.join(', ')}`,
          detail:
            `Function "${fn.name}" is a money RPC (money=true) but is missing ` +
            `${missing.join(' and ')}. ` +
            (missingIdempotency
              ? `Idempotency is required to prevent double-execution on retries. `
              : '') +
            (missingForUpdate
              ? `FOR UPDATE row locking is required to prevent TOCTOU races. `
              : '') +
            `securityDefiner=${fn.securityDefiner}, definedIn=${fn.definedIn}. ` +
            `[Source: artifact fields db-intel.functions.hasIdempotency / forUpdate]`,
          rule: 'R001',
          evidence: ev,
        }),
      );
    }

    return findings;
  }

  // ── 6. findMissingAuth ────────────────────────────────────────────────────
  /**
   * PARTIAL / heuristic: route-level authentication cannot be fully determined
   * from static artifacts alone (middleware wiring is runtime-resolved). We emit
   * info findings to document the limitation honestly rather than fabricating
   * pass/fail verdicts.
   *
   * What CAN be observed structurally: domains with public policies on tenant/money
   * tables are a proxy signal for potentially under-authenticated access paths.
   */
  findMissingAuth(): Finding[] {
    const policies = this.gov.policies();
    const tables = this.gov.tables();
    const findings: Finding[] = [];

    const tenantTableNames = new Set(tables.filter((t) => t.tenant).map((t) => t.name));
    const moneyTableNames = new Set(tables.filter((t) => t.money).map((t) => t.name));

    // Emit one honest heuristic finding per domain-level signal, not per policy,
    // since the limitation is systemic not per-route.
    const publicOnSensitive = policies.filter(
      (p) => p.public && (tenantTableNames.has(p.table) || moneyTableNames.has(p.table)),
    );

    if (publicOnSensitive.length > 0) {
      const ev = publicOnSensitive.slice(0, 5).map((p) =>
        this.eb.policy(
          p.name,
          `public=true on ${tenantTableNames.has(p.table) ? 'tenant' : ''}${moneyTableNames.has(p.table) ? '+money' : ''} table ${p.table}`,
        ),
      );

      findings.push(
        this.fb.build({
          id: this.fb.stableId('missing-auth', 'public-policy-on-sensitive-table'),
          category: 'security',
          kind: 'missing-auth',
          severity: 'info',
          subject: 'route-level-auth',
          title: `${publicOnSensitive.length} public RLS policies on sensitive tables — route auth is PARTIAL`,
          detail:
            `PARTIAL / HEURISTIC: ${publicOnSensitive.length} policies with public=true ` +
            `exist on tenant or money tables. Route-level authentication (Next.js middleware, ` +
            `Hono guards, session tokens) CANNOT be verified from static artifacts alone — ` +
            `middleware wiring is resolved at runtime, not in graphify-out. ` +
            `This finding surfaces the DB-level signal only; a route-level auth audit requires ` +
            `runtime inspection or middleware tracing. ` +
            `Sample tables: ${[...new Set(publicOnSensitive.map((p) => p.table))].slice(0, 5).join(', ')}.`,
          confidence: 0.4, // explicitly low — heuristic, not structural
          evidence: ev,
        }),
      );
    }

    // Always emit the systemic limitation note
    findings.push(
      this.fb.build({
        id: this.fb.stableId('missing-auth', 'middleware-limitation'),
        category: 'security',
        kind: 'missing-auth',
        severity: 'info',
        subject: 'middleware-auth',
        title: 'Route-level auth audit is PARTIAL — middleware inference only',
        detail:
          `LIMITATION: graphify-out artifacts do not include a resolved middleware ` +
          `graph. Route-level authentication (who calls verifySession, verifySiteOwnership, ` +
          `verifyCustomerSession) is a heuristic inference from route file names and ` +
          `imports, not a proven runtime trace. The security gate (107 deterministic ` +
          `validators) is authoritative; this LCIS finding is advisory only.`,
        confidence: 0.3,
        evidence: [
          this.eb.field('middleware-auth', 'route-level auth not in artifacts', DB_SOURCE),
        ],
      }),
    );

    return findings;
  }

  // ── 7. findMissingSecurityTests ───────────────────────────────────────────
  /**
   * For each money or tenant domain, search the code graph for security / auth
   * test files whose id or sourceFile mentions the domain key. Absence is a gap
   * finding. The graph.search is a substring match over node ids/labels.
   */
  findMissingSecurityTests(): Finding[] {
    const domains = this.gov.domains();
    const findings: Finding[] = [];

    for (const d of domains) {
      if (!d.money && !d.tenant) continue;

      const keyU = d.key.replace(/-/g, '_');

      // Search for nodes whose id contains both the domain key AND a security/auth/rls marker
      // graph.search does substring match over id AND label (lowercased)
      const secNodes = this.core.graph.search(`${keyU}_security_test`, 10);
      const authNodes = this.core.graph.search(`${keyU}_auth_test`, 10);
      const rlsNodes = this.core.graph.search(`${keyU}_rls_test`, 10);

      // Also search for generic security test files mentioning the domain key
      const allSecTest = this.core.graph.search('security_test', 20);
      const domainSecNodes = allSecTest.filter((n) => {
        const combined = `${n.id} ${n.sourceFile ?? ''}`.toLowerCase();
        return combined.includes(keyU) || combined.includes(d.key);
      });

      const hasSecurityTest =
        secNodes.length > 0 ||
        authNodes.length > 0 ||
        rlsNodes.length > 0 ||
        domainSecNodes.length > 0;

      if (hasSecurityTest) continue; // covered

      const ev = [
        this.eb.domain(
          d.key,
          `money=${d.money}, tenant=${d.tenant}, tables=${d.tables.length}, rpcs=${d.rpcs.length}`,
        ),
      ];

      const sev = this.scorer.forEntity({ money: d.money, tenant: d.tenant });

      findings.push(
        this.fb.build({
          id: this.fb.stableId('missing-security-test', d.key),
          category: 'security',
          kind: 'missing-security-test',
          severity: sev,
          subject: d.key,
          title: `Domain "${d.key}" has no security/auth/RLS test files in code graph`,
          detail:
            `No security, auth, or RLS test file was found in the code graph for domain ` +
            `"${d.key}" (money=${d.money}, tenant=${d.tenant}). ` +
            `Searched graph for: "${keyU}_security_test", "${keyU}_auth_test", ` +
            `"${keyU}_rls_test", and security_test nodes mentioning "${d.key}". ` +
            `[Source: graphify-out/graph.json node substring search — absence means no ` +
            `matching node was found in the 52k-node graph, not that tests don't exist at all]`,
          evidence: ev,
        }),
      );
    }

    return findings;
  }

  // ── 8. findSensitiveDomainViolations ─────────────────────────────────────
  /**
   * For each money domain, collect any of the above violations that touch its
   * tables or RPCs. A domain with any critical/high finding from missing-rls,
   * dangerous-policy, public-mutation, cross-tenant-risk, or missing-validation
   * on its owned tables/RPCs becomes a domain-level violation.
   */
  findSensitiveDomainViolations(): Finding[] {
    const domains = this.gov.domains();
    const findings: Finding[] = [];

    const missingRls = this.findMissingRLS();
    const dangerous = this.findDangerousPolicies();
    const publicMut = this.findPublicMutations();
    const crossTenant = this.findCrossTenantRisks();
    const missingVal = this.findMissingValidation();

    for (const d of domains) {
      if (!d.money) continue;

      const tableSet = new Set(d.tables.map((t) => t.toLowerCase()));
      const rpcSet = new Set(d.rpcs.map((r) => r.toLowerCase()));

      const relatedFindings: Finding[] = [
        ...missingRls.filter((f) => tableSet.has(f.subject.toLowerCase())),
        ...dangerous.filter((f) => {
          // subject of dangerous-policy is the policy name; check detail for table name
          return d.tables.some((t) => f.detail.toLowerCase().includes(`"${t.toLowerCase()}"`));
        }),
        ...publicMut.filter((f) => rpcSet.has(f.subject.toLowerCase())),
        ...crossTenant.filter((f) => {
          const subjLower = f.subject.toLowerCase();
          return tableSet.has(subjLower) || rpcSet.has(subjLower) || d.tables.some((t) => f.detail.toLowerCase().includes(`"${t.toLowerCase()}"`));
        }),
        ...missingVal.filter((f) => rpcSet.has(f.subject.toLowerCase())),
      ];

      if (relatedFindings.length === 0) continue;

      const critCount = relatedFindings.filter((f) => f.severity === 'critical').length;
      const highCount = relatedFindings.filter((f) => f.severity === 'high').length;
      const domainSev = critCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'medium';

      const ev = [
        this.eb.domain(
          d.key,
          `money=true, related violations: ${relatedFindings.length} (critical=${critCount}, high=${highCount})`,
        ),
        ...relatedFindings.slice(0, 3).flatMap((f) => f.evidence.slice(0, 1)),
      ];

      findings.push(
        this.fb.build({
          id: this.fb.stableId('sensitive-domain-violation', d.key),
          category: 'security',
          kind: 'sensitive-domain-violation',
          severity: domainSev,
          subject: d.key,
          title: `Money domain "${d.key}" has ${relatedFindings.length} security violation(s)`,
          detail:
            `Domain "${d.key}" (money=true, tables=${d.tables.length}, rpcs=${d.rpcs.length}) ` +
            `has ${relatedFindings.length} security finding(s) on its tables or RPCs: ` +
            `critical=${critCount}, high=${highCount}. ` +
            `Finding ids: ${relatedFindings
              .slice(0, 5)
              .map((f) => f.id)
              .join(', ')}${relatedFindings.length > 5 ? '...' : ''}.`,
          evidence: ev,
        }),
      );
    }

    return findings;
  }

  // ── 9. generateSecurityDriftReport ───────────────────────────────────────
  /**
   * Aggregates all security findings into a SecurityDriftReport with the
   * governance envelope (evidence / confidence / sources / timestamp).
   */
  generateSecurityDriftReport(): SecurityDriftReport {
    const missingRls = this.findMissingRLS();
    const dangerousPolicies = this.findDangerousPolicies();
    const publicMutations = this.findPublicMutations();
    const crossTenantRisks = this.findCrossTenantRisks();
    const missingValidation = this.findMissingValidation();
    const missingAuth = this.findMissingAuth();
    const missingSecTests = this.findMissingSecurityTests();
    const domainViolations = this.findSensitiveDomainViolations();

    const allFindings: Finding[] = [
      ...missingRls,
      ...dangerousPolicies,
      ...publicMutations,
      ...crossTenantRisks,
      ...missingValidation,
      ...missingAuth,
      ...missingSecTests,
      ...domainViolations,
    ];

    const byKind: Record<string, number> = {};
    for (const f of allFindings) {
      byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    }

    const critCount = allFindings.filter((f) => f.severity === 'critical').length;
    const highCount = allFindings.filter((f) => f.severity === 'high').length;

    const summary =
      `Security drift: ${allFindings.length} finding(s) — ` +
      `${critCount} critical, ${highCount} high. ` +
      `missing-rls=${missingRls.length}, ` +
      `dangerous-policy=${dangerousPolicies.length}, ` +
      `public-mutation=${publicMutations.length}, ` +
      `cross-tenant-risk=${crossTenantRisks.length}, ` +
      `missing-validation=${missingValidation.length}, ` +
      `missing-auth=${missingAuth.length}, ` +
      `missing-security-test=${missingSecTests.length}, ` +
      `sensitive-domain-violation=${domainViolations.length}. ` +
      `[Structural-only; live probes NOT CONNECTED]`;

    // Collect representative evidence from across the findings
    const evidence = allFindings
      .flatMap((f) => f.evidence)
      .slice(0, 20);

    const sources = this.gov.sourcesPresent();

    return governance(
      {
        findings: allFindings,
        byKind,
        summary,
      },
      {
        evidence,
        sources: sources.length > 0 ? sources : [DB_SOURCE, DOMAIN_SOURCE],
        now: this.now,
      },
    );
  }
}
