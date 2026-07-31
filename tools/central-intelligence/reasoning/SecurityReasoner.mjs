/**
 * LCIS V2 Reasoning Engine — SecurityReasoner
 *
 * Reasons about security posture: attack surface, vulnerability assessment,
 * highest-risk controls, and hardening recommendations.
 *
 * Uses V1 /api/security-intelligence + memory 'security' collection +
 * ArchitectureIntelligenceEngine (for DependencyDiscovery). All sources optional.
 * Live scan results are NOT CONNECTED unless scanners are wired.
 */

/** @typedef {'HIGH'|'MEDIUM'|'LOW'} Confidence */
/** @typedef {{ source: string, fact: string, weight: number }} Evidence */
/** @typedef {{ question: string, hypothesis: string, evidence: Evidence[], confidence: Confidence, mostLikelyAffected: string[], recommendedInvestigation: string[], reasoningChain: string[] }} ReasoningResult */

const V1_BASE = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

async function fetchV1(path) {
  try {
    const res = await fetch(`${V1_BASE}${path}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

let _depDiscovery = null;
async function depDiscovery() {
  if (!_depDiscovery) {
    const m = await import('../architecture-intelligence/DependencyDiscovery.mjs');
    _depDiscovery = m.default;
  }
  return _depDiscovery;
}

let _memRetriever = null;
async function memRetriever() {
  if (!_memRetriever) {
    const m = await import('../memory-engine/MemoryRetriever.mjs');
    _memRetriever = m.default;
  }
  return _memRetriever;
}

/** Structural security controls defined in CLAUDE.md + governance */
const STRUCTURAL_CONTROLS = [
  { id: 'RLS-001', name: 'Row Level Security', description: 'All tenant tables have RLS; no public USING (true)', critical: true },
  { id: 'AUTH-001', name: 'Dual JWT issuers', description: 'Customer HS256 vs Merchant ES256 — never crossed', critical: true },
  { id: 'PAY-001', name: 'Canonical ledger RPCs', description: 'Money mutations only via SECURITY DEFINER RPCs — no direct .insert/update', critical: true },
  { id: 'PAY-002', name: 'Server-authoritative amounts', description: 'Totals/tax computed server-side; client amounts never trusted', critical: true },
  { id: 'PAY-003', name: 'Razorpay HMAC verification', description: 'Payment signature verified with timingSafeEqualHex', critical: true },
  { id: 'IDEMPOTENCY-001', name: 'Money RPC idempotency', description: 'Every money RPC requires idempotency_key + ON CONFLICT + FOR UPDATE', critical: true },
  { id: 'WEBHOOK-001', name: 'Webhook HMAC signing', description: 'Queue jobs signed with signQueueTenantEnvelope', critical: false },
  { id: 'TENANT-001', name: 'Site ownership gate', description: 'Service-role gateway access only behind verifySiteOwnership', critical: true },
  { id: 'TURNSTILE-001', name: 'Turnstile + rate-limit', description: 'Registration/login gated with Turnstile + rate-limit', critical: false },
  { id: 'LIQUID-001', name: 'Liquid sanitizer lock', description: 'Sanitizer FORBID lists locked; outputEscape forced; Liquid OFF by default', critical: false },
  { id: 'STEPUP-001', name: 'Step-up HMAC auth', description: 'Refunds/payouts require step-up HMAC gate', critical: true },
];

class SecurityReasoner {
  /**
   * Answer a free-form security question.
   * @param {string} question
   * @returns {Promise<ReasoningResult>}
   */
  async reason(question) {
    const evidence = [];
    const reasoningChain = [];

    const [secData, auditData, memRes] = await Promise.allSettled([
      fetchV1('/api/security-intelligence'),
      fetchV1('/api/audit'),
      memRetriever(),
    ]);

    const sec = secData.status === 'fulfilled' ? secData.value : null;
    const audit = auditData.status === 'fulfilled' ? auditData.value : null;
    const mem = memRes.status === 'fulfilled' ? memRes.value : null;

    reasoningChain.push(`1. Query LCIS /api/security-intelligence for structural security posture.`);
    reasoningChain.push(`2. Query /api/audit for autonomous security findings.`);
    reasoningChain.push(`3. Retrieve security context from memory store.`);
    reasoningChain.push(`4. Classify question against known controls + attack surface.`);

    if (sec) {
      evidence.push({ source: 'security-intelligence-api', fact: `Security posture: ${JSON.stringify(sec).slice(0, 250)}`, weight: 0.88 });
    } else {
      evidence.push({ source: 'security-intelligence-api', fact: `V1 /api/security-intelligence NOT CONNECTED — LCIS offline or graph not built.`, weight: 0.05 });
    }

    if (audit?.findings?.length) {
      const critical = audit.findings.filter(f => f.severity === 'critical' || f.severity === 'high');
      evidence.push({ source: 'autonomous-audit', fact: `${audit.findings.length} total findings, ${critical.length} critical/high: ${critical.slice(0, 2).map(f => f.finding ?? f.description ?? JSON.stringify(f).slice(0, 60)).join('; ')}`, weight: 0.82 });
    } else if (audit) {
      evidence.push({ source: 'autonomous-audit', fact: `No critical/high audit findings (0 hard violations — gate is authoritative).`, weight: 0.70 });
    }

    if (mem) {
      try {
        const secContext = await mem.retrieveSecurityContext(question);
        if (secContext?.hits?.length) {
          evidence.push({ source: 'security-memory', fact: `Memory: ${secContext.hits[0]?.content?.slice(0, 120) ?? 'security context retrieved'}`, weight: 0.65 });
        }
      } catch { /* optional */ }
    }

    evidence.push({
      source: 'structural-controls',
      fact: `${STRUCTURAL_CONTROLS.filter(c => c.critical).length} critical structural controls defined (RLS, dual-JWT, canonical-ledger-RPCs, HMAC, step-up). Live verification NOT CONNECTED.`,
      weight: 0.75,
    });

    const highCount = evidence.filter(e => e.weight >= 0.7).length;
    const confidence = highCount >= 3 ? 'HIGH' : highCount >= 2 ? 'MEDIUM' : 'LOW';

    return {
      question,
      hypothesis: `Security question "${question.slice(0, 80)}": Structural controls are documented and validator-gated. Live scan results (SAST/dependency CVEs) are NOT CONNECTED — wire security workflows for real-time posture.`,
      evidence,
      confidence,
      mostLikelyAffected: ['payment_transactions (ledger)', 'identity-platform (JWT)', 'RLS policies', 'webhook-service (HMAC)'],
      recommendedInvestigation: [
        `1. Run LCIS security: curl ${V1_BASE}/api/security-intelligence`,
        `2. Run audit: curl ${V1_BASE}/api/audit`,
        `3. Validate governance (107 validators): node scripts/validate-governance.mjs`,
        `4. Check security workflow: .github/workflows/security-review.yml`,
        `5. Full security audit: .github/workflows/full-security-audit.yml (weekly)`,
      ],
      reasoningChain,
    };
  }

  /**
   * Assess the full attack surface.
   * @returns {Promise<{ controls: typeof STRUCTURAL_CONTROLS, gaps: string[], trustBoundaries: string[], risk: string }>}
   */
  async assessAttackSurface() {
    const [secData, auditData, ddRes] = await Promise.allSettled([
      fetchV1('/api/security-intelligence'),
      fetchV1('/api/audit'),
      depDiscovery(),
    ]);

    const sec = secData.status === 'fulfilled' ? secData.value : null;
    const audit = auditData.status === 'fulfilled' ? auditData.value : null;
    const dd = ddRes.status === 'fulfilled' ? ddRes.value : null;

    const gaps = [];

    // Check for known gaps from audit
    if (audit?.findings?.length) {
      gaps.push(...audit.findings.filter(f => f.severity === 'critical').slice(0, 5).map(f => f.finding ?? f.description ?? JSON.stringify(f).slice(0, 80)));
    }

    // Check high-blast-radius packages for dependency CVE exposure
    if (dd) {
      try {
        const highBlast = await dd.getHighBlastRadius();
        for (const pkg of highBlast.slice(0, 3)) {
          gaps.push(`High-blast dependency "${pkg.name}" (${pkg.dependentCount} dependents) — CVE impact would be broad`);
        }
      } catch { /* optional */ }
    }

    if (!gaps.length) gaps.push('No critical gaps detected by autonomous audit (gate is authoritative)');

    const trustBoundaries = [
      'Customer ↔ Merchant: dual JWT issuers (HS256 vs ES256) — never crossed',
      'Merchant ↔ Admin: step-up HMAC gate for refunds/payouts',
      'App ↔ DB: service-role only behind verifySiteOwnership + RLS',
      'External ↔ Webhook: HMAC-signed envelopes (signQueueTenantEnvelope)',
      'Provider ↔ Platform: Razorpay signature verified server-side (timingSafeEqualHex)',
    ];

    const criticalControlsCount = STRUCTURAL_CONTROLS.filter(c => c.critical).length;
    const risk = gaps.filter(g => !g.includes('No critical')).length > 3 ? 'HIGH' : 'MEDIUM';

    return { controls: STRUCTURAL_CONTROLS, gaps, trustBoundaries, risk };
  }

  /**
   * Reason about whether a CVE advisory affects this codebase.
   * @param {{ id: string, package?: string, description?: string, severity?: string }} advisory
   * @returns {Promise<{ affected: boolean|'UNKNOWN', reason: string, evidence: Evidence[], recommendation: string }>}
   */
  async reasonAboutVulnerability(advisory) {
    const pkg = advisory?.package ?? '';
    const id = advisory?.id ?? 'UNKNOWN';

    const [ddRes, memRes, depData] = await Promise.allSettled([
      depDiscovery(),
      memRetriever(),
      fetchV1(`/api/blast?q=${encodeURIComponent(pkg)}`),
    ]);

    const dd = ddRes.status === 'fulfilled' ? ddRes.value : null;
    const mem = memRes.status === 'fulfilled' ? memRes.value : null;
    const blast = depData.status === 'fulfilled' ? depData.value : null;

    const evidence = [];

    // Check if package is in dependency graph
    let inDeps = false;
    if (dd && pkg) {
      try {
        const ext = await dd.getExternalDependencies('');
        inDeps = Object.keys(ext ?? {}).some(k => k === pkg || k.includes(pkg));
        if (inDeps) {
          evidence.push({ source: 'dependency-graph', fact: `Package "${pkg}" IS in the dependency graph.`, weight: 0.92 });
        } else {
          evidence.push({ source: 'dependency-graph', fact: `Package "${pkg}" NOT found in dependency graph — may not be affected.`, weight: 0.70 });
        }
      } catch {
        evidence.push({ source: 'dependency-graph', fact: `Dependency graph unavailable — cannot confirm "${pkg}" presence.`, weight: 0.1 });
      }
    } else {
      evidence.push({ source: 'dependency-graph', fact: `DependencyDiscovery unavailable or no package specified.`, weight: 0.05 });
    }

    // Blast radius of the package
    if (blast?.affected?.length) {
      evidence.push({ source: 'blast-radius', fact: `"${pkg}" has blast radius of ${blast.affected.length} components.`, weight: inDeps ? 0.88 : 0.40 });
    }

    // Memory check for prior CVE handling
    if (mem && id !== 'UNKNOWN') {
      try {
        const hits = await mem.retrieve(`${id} ${pkg} vulnerability CVE`, { collections: ['security'], topK: 3 });
        if (hits.length) {
          evidence.push({ source: 'security-memory', fact: `Memory: prior handling of "${id}": ${hits[0].content?.slice(0, 100) ?? 'record found'}`, weight: 0.75 });
        }
      } catch { /* optional */ }
    }

    const affected = inDeps ? true : dd ? false : 'UNKNOWN';
    const highWeight = evidence.filter(e => e.weight >= 0.7).length >= 2;

    return {
      affected,
      reason: affected === true
        ? `"${pkg}" is in the dependency graph — ${id} likely affects this codebase. Blast radius: ${blast?.affected?.length ?? '?'} components.`
        : affected === false
        ? `"${pkg}" not found in dependency graph — ${id} likely does not directly affect this codebase (verify transitive deps).`
        : `Cannot determine — dependency graph unavailable. Run pnpm graph:omega and re-check.`,
      evidence,
      recommendation: affected === true
        ? `URGENT: Update "${pkg}" to patched version. Check blast radius first: pnpm graph:intel blast "${pkg}".`
        : affected === false
        ? `Low risk. Monitor upstream for transitive exposure. Re-run pnpm graph:update after next install.`
        : `Run pnpm graph:omega to build dependency graph, then re-assess ${id}.`,
    };
  }

  /**
   * Return the highest-risk security controls ranked by criticality + coverage.
   * @returns {Promise<Array<{ control: typeof STRUCTURAL_CONTROLS[0], risk: string, coverageStatus: string }>>}
   */
  async getHighestRiskControls() {
    const [auditData, secData] = await Promise.allSettled([
      fetchV1('/api/audit'),
      fetchV1('/api/security-intelligence'),
    ]);

    const audit = auditData.status === 'fulfilled' ? auditData.value : null;
    const sec = secData.status === 'fulfilled' ? secData.value : null;

    return STRUCTURAL_CONTROLS.map(control => {
      // Check if audit flagged this control
      const auditFlag = audit?.findings?.find(f =>
        JSON.stringify(f).toLowerCase().includes(control.name.toLowerCase()) ||
        JSON.stringify(f).toLowerCase().includes(control.id.toLowerCase())
      );

      const secFlag = sec ? JSON.stringify(sec).toLowerCase().includes(control.name.toLowerCase().split(' ')[0]) : false;

      const risk = control.critical && auditFlag ? 'CRITICAL' : control.critical ? 'HIGH' : 'MEDIUM';
      const coverageStatus = auditFlag
        ? `AUDIT FLAG: ${JSON.stringify(auditFlag).slice(0, 80)}`
        : secFlag
        ? 'Referenced in security-intelligence (verify manually)'
        : 'Structurally documented — live verification NOT CONNECTED';

      return { control, risk, coverageStatus };
    }).sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
      return (order[a.risk] ?? 3) - (order[b.risk] ?? 3);
    });
  }

  /**
   * Recommend concrete hardening actions.
   * @returns {Promise<Array<{ priority: string, action: string, rationale: string, file?: string }>>}
   */
  async recommendHardening() {
    const [auditData, surfaceData] = await Promise.allSettled([
      fetchV1('/api/audit'),
      this.assessAttackSurface(),
    ]);

    const audit = auditData.status === 'fulfilled' ? auditData.value : null;
    const surface = surfaceData.status === 'fulfilled' ? surfaceData.value : null;

    const recommendations = [
      { priority: 'P0', action: 'Keep governance gate GREEN (107 validators)', rationale: 'Constitution requires gate pass before every topology change', file: 'scripts/validate-governance.mjs' },
      { priority: 'P0', action: 'Never bypass canonical-ledger-only-validator', rationale: 'All money mutations must use SECURITY DEFINER RPCs — validator detects TS direct writes' },
      { priority: 'P1', action: 'Run weekly full-security-audit.yml workflow', rationale: 'Catches dependency CVEs, SAST findings, and RLS drift', file: '.github/workflows/full-security-audit.yml' },
      { priority: 'P1', action: 'Verify Razorpay HMAC with timingSafeEqualHex on every payment confirmation', rationale: 'Prevents payment forging — must be server-side always' },
      { priority: 'P1', action: 'Audit RLS policies after every migration — no public USING (true)', rationale: 'Cross-tenant data leak via missing RLS is a critical defect' },
      { priority: 'P2', action: 'Enable Turnstile on all public-facing registration/login endpoints', rationale: 'Prevents bot-driven credential stuffing at identity-platform' },
      { priority: 'P2', action: 'Enforce step-up HMAC gate for all refund/payout routes', rationale: 'Prevents unauthorized financial mutations via replayed merchant tokens' },
      { priority: 'P2', action: 'Review Liquid sanitizer FORBID list quarterly', rationale: 'Theme-engine XSS vector if new HTML elements bypass sanitizer lock' },
    ];

    // Add audit-specific recommendations
    if (audit?.findings?.length) {
      for (const f of audit.findings.filter(f => f.severity === 'critical' || f.severity === 'high').slice(0, 3)) {
        recommendations.push({ priority: 'P1', action: `Fix audit finding: ${f.finding ?? f.description ?? JSON.stringify(f).slice(0, 80)}`, rationale: 'Autonomous audit flagged — verify with validators before closing' });
      }
    }

    // Add gap-specific recommendations
    for (const gap of (surface?.gaps ?? []).filter(g => !g.includes('No critical')).slice(0, 3)) {
      recommendations.push({ priority: 'P2', action: `Address attack surface gap: ${gap.slice(0, 100)}`, rationale: 'Identified in LCIS autonomous attack surface assessment' });
    }

    return recommendations.sort((a, b) => a.priority.localeCompare(b.priority));
  }
}

export default new SecurityReasoner();
