/**
 * comment.ts — PR comment renderers for @letbuyy/lcis-pr-check.
 *
 * Three render modes:
 *   renderComment(report)  → full GitHub PR comment (markdown)
 *   renderJson(report)     → compact JSON string
 *   renderSummary(report)  → GitHub Actions step-summary markdown (compact)
 */
import type { PrReport, RiskLevel } from './types';
import type { ReviewVerdict } from '@letbuyy/lcis-execution';
import type { GovernanceVerdict } from '@letbuyy/lcis-governance';
import type { OperationalVerdict } from '@letbuyy/lcis-operations';
import type { EngineeringVerdict } from '@letbuyy/lcis-engineering';
import type { ExecutionVerdict } from '@letbuyy/lcis-orchestration';

// ── Helpers ──────────────────────────────────────────────────────────────────

const RISK_EMOJI: Record<RiskLevel, string> = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  CRITICAL: '🔴',
};

const VERDICT_EMOJI: Record<ReviewVerdict['verdict'], string> = {
  PASS: '✅',
  WARN: '⚠️',
  FAIL: '❌',
  UNKNOWN: '❓',
};

const GOV_VERDICT_EMOJI: Record<GovernanceVerdict['verdict'], string> = {
  PASS: '✅',
  WARN: '⚠️',
  FAIL: '❌',
  UNKNOWN: '❓',
};

const OPS_VERDICT_EMOJI: Record<OperationalVerdict['verdict'], string> = {
  PASS: '✅',
  WARN: '⚠️',
  FAIL: '❌',
  UNKNOWN: '❓',
};

const ENG_VERDICT_EMOJI: Record<EngineeringVerdict['verdict'], string> = {
  PASS: '✅',
  WARN: '⚠️',
  FAIL: '❌',
  UNKNOWN: '❓',
};

const EXEC_VERDICT_EMOJI: Record<ExecutionVerdict['verdict'], string> = {
  PASS: '✅',
  WARN: '⚠️',
  FAIL: '❌',
  UNKNOWN: '❓',
};

function flagLine(flag: boolean, name: string): string {
  return flag ? `- ✅ \`${name}\`` : `- ⬜ \`${name}\``;
}

function recommendation(report: PrReport): string {
  const { risk, sensitivity, affectedDomains } = report;
  const level = risk.level;

  if (level === 'CRITICAL') {
    return 'Block merge — requires ARB approval + security review + canonical-ledger-only-validator confirmation';
  }
  if (level === 'HIGH' && sensitivity.crossDomain && affectedDomains.length > 2) {
    return 'Require domain review from all affected domain owners before merge';
  }
  if (level === 'HIGH') {
    return 'Require domain review — at least one affected domain owner must approve';
  }
  if (level === 'MEDIUM' && sensitivity.crossDomain) {
    return 'Require cross-domain review — tag all affected domain owners';
  }
  if (level === 'MEDIUM') {
    return 'Standard review — tag affected domain owners';
  }
  return 'Standard review — no elevated risk signals detected';
}

// ── renderVerdicts ────────────────────────────────────────────────────────────

/**
 * Render the LCIS VERDICTS section.
 * Called by renderComment when report.verdicts is non-empty.
 */
function renderVerdicts(verdicts: ReviewVerdict[]): string {
  if (verdicts.length === 0) return '';
  const lines: string[] = [];
  lines.push('## LCIS VERDICTS');
  lines.push('');
  for (const v of verdicts) {
    const emoji = VERDICT_EMOJI[v.verdict];
    lines.push(`### ${v.dimension.toUpperCase()}: ${emoji} ${v.verdict} — ${v.summary}`);
    if (v.findings.length > 0) {
      for (const f of v.findings) {
        lines.push(`- ${f}`);
      }
    }
    if (v.evidence.length > 0) {
      const refs = v.evidence
        .map((e) => `\`${e.ref}\``)
        .slice(0, 3)
        .join(', ');
      lines.push(`_Evidence: ${refs}_`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── renderGovernanceVerdicts ──────────────────────────────────────────────────

/**
 * Render the LCIS GOVERNANCE section.
 * Called by renderComment when report.governanceVerdicts is non-empty.
 */
function renderGovernanceVerdicts(verdicts: GovernanceVerdict[]): string {
  if (verdicts.length === 0) return '';
  const lines: string[] = [];
  lines.push('## LCIS GOVERNANCE');
  lines.push('');
  for (const v of verdicts) {
    const emoji = GOV_VERDICT_EMOJI[v.verdict];
    lines.push(`### ${v.dimension.toUpperCase()}: ${emoji} ${v.verdict} — ${v.summary}`);
    if (v.findings.length > 0) {
      for (const f of v.findings) {
        lines.push(`- ${f}`);
      }
    }
    if (v.evidence.length > 0) {
      const refs = v.evidence
        .map((e) => `\`${e.ref}\``)
        .slice(0, 3)
        .join(', ');
      lines.push(`_Evidence: ${refs}_`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── renderOperationalVerdict ──────────────────────────────────────────────────

/**
 * Render the LCOS OPERATIONS section.
 * Called by renderComment when report.operationalVerdict is non-null.
 */
function renderOperationalVerdict(v: OperationalVerdict): string {
  const lines: string[] = [];
  lines.push('## LCOS OPERATIONS');
  lines.push('');
  const emoji = OPS_VERDICT_EMOJI[v.verdict];
  lines.push(`### OPERATIONAL-IMPACT: ${emoji} ${v.verdict} — ${v.summary}`);
  if (v.findings.length > 0) {
    for (const f of v.findings) {
      lines.push(`- ${f}`);
    }
  }
  if (v.evidence.length > 0) {
    const refs = v.evidence
      .map((e) => `\`${e.ref}\``)
      .slice(0, 3)
      .join(', ');
    lines.push(`_Evidence: ${refs}_`);
  }
  lines.push('');
  return lines.join('\n');
}

// ── renderEngineeringVerdicts ─────────────────────────────────────────────────

/**
 * Render the LCIS ENGINEERING section.
 * Called by renderComment when report.engineeringVerdicts is non-empty.
 */
function renderEngineeringVerdicts(verdicts: EngineeringVerdict[]): string {
  if (verdicts.length === 0) return '';
  const lines: string[] = [];
  lines.push('## LCIS ENGINEERING');
  lines.push('');
  for (const v of verdicts) {
    const emoji = ENG_VERDICT_EMOJI[v.verdict];
    lines.push(`### ${v.dimension.toUpperCase()}: ${emoji} ${v.verdict} — ${v.summary}`);
    if (v.findings.length > 0) {
      for (const f of v.findings) {
        lines.push(`- ${f}`);
      }
    }
    if (v.evidence.length > 0) {
      const refs = v.evidence
        .map((e) => `\`${e.ref}\``)
        .slice(0, 3)
        .join(', ');
      lines.push(`_Evidence: ${refs}_`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── renderExecutionVerdicts ───────────────────────────────────────────────────

/**
 * Render the LCIS EXECUTION section (V6 — EAOS).
 * Called by renderComment when report.executionVerdicts is non-empty.
 */
function renderExecutionVerdicts(verdicts: ExecutionVerdict[]): string {
  if (verdicts.length === 0) return '';
  const lines: string[] = [];
  lines.push('## LCIS EXECUTION');
  lines.push('');
  for (const v of verdicts) {
    const emoji = EXEC_VERDICT_EMOJI[v.verdict];
    lines.push(`### ${v.dimension.toUpperCase()}: ${emoji} ${v.verdict} — ${v.summary}`);
    if (v.findings.length > 0) {
      for (const f of v.findings) {
        lines.push(`- ${f}`);
      }
    }
    if (v.evidence.length > 0) {
      const refs = v.evidence
        .map((e) => `\`${e.ref}\``)
        .slice(0, 3)
        .join(', ');
      lines.push(`_Evidence: ${refs}_`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── renderComment ────────────────────────────────────────────────────────────

/**
 * Render the full GitHub PR comment.
 *
 * Shape:
 *   ## LCIS ANALYSIS
 *   **Risk:** HIGH
 *   ### Affected Domains
 *   - payments (Money, Tenant)
 *   ...
 *   **Affected Files:** N
 *   ### Sensitivity Flags
 *   - ✅ `paymentRelated`
 *   ...
 *   ## LCIS VERDICTS           ← V2 section (only when verdicts present)
 *   ### ARCHITECTURE: ✅ PASS — ...
 *   ...
 *   **Recommendation:** ...
 */
export function renderComment(report: PrReport): string {
  const { risk, affectedDomains, affectedServices, blastRadius, sensitivity, validationWarnings, architectureWarnings, recommendedReviewers } = report;
  const emoji = RISK_EMOJI[risk.level];
  const lines: string[] = [];

  lines.push('## LCIS ANALYSIS');
  lines.push('');
  lines.push(`**Risk:** ${emoji} ${risk.level}`);
  lines.push('');

  // Risk derivation
  if (risk.reasons.length > 0) {
    lines.push('**Risk derivation:**');
    for (const r of risk.reasons) {
      lines.push(`- ${r}`);
    }
    lines.push('');
  }

  // Affected domains
  lines.push('### Affected Domains');
  if (affectedDomains.length === 0) {
    lines.push('- _(no domains mapped — docs-only or unclassified change)_');
  } else {
    for (const d of affectedDomains) {
      const tags: string[] = [];
      if (d.money) tags.push('Money');
      if (d.tenant) tags.push('Tenant');
      if (d.fromBlast) tags.push('via blast');
      const tagStr = tags.length > 0 ? ` _(${tags.join(', ')})_` : '';
      lines.push(`- **${d.label}** (\`${d.key}\`)${tagStr}`);
    }
  }
  lines.push('');

  // Affected files count
  lines.push(`**Affected Files:** ${blastRadius.affectedFiles}`);
  lines.push(`**Affected Nodes (blast):** ${blastRadius.affectedNodes}`);
  lines.push('');

  // Affected services
  if (affectedServices.length > 0) {
    lines.push(`**Affected Services:** ${affectedServices.join(', ')}`);
    lines.push('');
  }

  // Sensitivity flags
  lines.push('### Sensitivity Flags');
  lines.push(flagLine(sensitivity.crossDomain, 'crossDomain'));
  lines.push(flagLine(sensitivity.paymentRelated, 'paymentRelated'));
  lines.push(flagLine(sensitivity.authRelated, 'authRelated'));
  lines.push(flagLine(sensitivity.securitySensitive, 'securitySensitive'));
  lines.push(flagLine(sensitivity.rlsRelated, 'rlsRelated'));
  lines.push(flagLine(sensitivity.migrationRelated, 'migrationRelated'));
  lines.push(flagLine(sensitivity.tenantIsolation, 'tenantIsolation'));
  lines.push(flagLine(sensitivity.validatorImpact, 'validatorImpact'));
  lines.push('');

  // Validation warnings
  if (validationWarnings.length > 0) {
    lines.push('### Validation Warnings');
    for (const w of validationWarnings) {
      lines.push(`> ⚠️ ${w}`);
    }
    lines.push('');
  }

  // Architecture warnings
  if (architectureWarnings.length > 0) {
    lines.push('### Architecture Warnings');
    for (const w of architectureWarnings) {
      lines.push(`> 🏗️ ${w}`);
    }
    lines.push('');
  }

  // Recommended reviewers
  if (recommendedReviewers.length > 0) {
    lines.push(`**Recommended Reviewers:** ${recommendedReviewers.join(', ')}`);
    lines.push('');
  }

  // LCIS Verdicts (V2 section — only when populated)
  if (report.verdicts && report.verdicts.length > 0) {
    lines.push(renderVerdicts(report.verdicts));
  }

  // LCIS Governance (V3 section — only when populated)
  if (report.governanceVerdicts && report.governanceVerdicts.length > 0) {
    lines.push(renderGovernanceVerdicts(report.governanceVerdicts));
  }

  // LCOS Operations (V4 section — only when operationalVerdict is non-null)
  if (report.operationalVerdict != null) {
    lines.push(renderOperationalVerdict(report.operationalVerdict));
  }

  // LCIS Engineering (V5 section — only when engineeringVerdicts is non-empty)
  if (report.engineeringVerdicts && report.engineeringVerdicts.length > 0) {
    lines.push(renderEngineeringVerdicts(report.engineeringVerdicts));
  }

  // LCIS Execution (V6 section — only when executionVerdicts is non-empty)
  if (report.executionVerdicts && report.executionVerdicts.length > 0) {
    lines.push(renderExecutionVerdicts(report.executionVerdicts));
  }

  // Recommendation (always last)
  lines.push(`**Recommendation:** ${recommendation(report)}`);
  lines.push('');
  lines.push(`_Generated by LCIS PR Intelligence at ${report.generatedAt}_`);

  return lines.join('\n');
}

// ── renderJson ───────────────────────────────────────────────────────────────

export function renderJson(report: PrReport): string {
  return JSON.stringify(report, null, 2);
}

// ── renderSummary ─────────────────────────────────────────────────────────────

/**
 * Compact GitHub Actions step-summary markdown.
 * Designed to fit in the Actions summary panel without scrolling.
 */
export function renderSummary(report: PrReport): string {
  const { risk, affectedDomains, blastRadius, sensitivity } = report;
  const emoji = RISK_EMOJI[risk.level];
  const lines: string[] = [];

  lines.push(`## LCIS PR Summary — ${emoji} ${risk.level}`);
  lines.push('');

  const domainNames = affectedDomains.map((d) => `\`${d.key}\``).join(', ') || '_none_';
  lines.push(`**Domains:** ${domainNames}`);
  lines.push(`**Blast:** ${blastRadius.affectedNodes} nodes / ${blastRadius.affectedFiles} files`);
  lines.push('');

  const activeFlags = (Object.entries(sensitivity) as [string, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => `\`${k}\``);
  if (activeFlags.length > 0) {
    lines.push(`**Flags:** ${activeFlags.join(' ')}`);
  }

  // Verdict summary line (compact — just the emoji + dimension)
  if (report.verdicts && report.verdicts.length > 0) {
    lines.push('');
    const verdictLine = report.verdicts
      .map((v) => `${VERDICT_EMOJI[v.verdict]} ${v.dimension}`)
      .join(' · ');
    lines.push(`**Verdicts:** ${verdictLine}`);
  }

  // Governance verdict summary line (compact)
  if (report.governanceVerdicts && report.governanceVerdicts.length > 0) {
    lines.push('');
    const govLine = report.governanceVerdicts
      .map((v) => `${GOV_VERDICT_EMOJI[v.verdict]} ${v.dimension}`)
      .join(' · ');
    lines.push(`**Governance:** ${govLine}`);
  }

  // Operational verdict summary line (compact — V4)
  if (report.operationalVerdict != null) {
    lines.push('');
    const ov = report.operationalVerdict;
    lines.push(`**Operations:** ${OPS_VERDICT_EMOJI[ov.verdict]} ${ov.dimension} — ${ov.summary.slice(0, 100)}`);
  }

  // Engineering verdict summary line (compact — V5)
  if (report.engineeringVerdicts && report.engineeringVerdicts.length > 0) {
    lines.push('');
    const engLine = report.engineeringVerdicts
      .map((v) => `${ENG_VERDICT_EMOJI[v.verdict]} ${v.dimension}`)
      .join(' · ');
    lines.push(`**Engineering:** ${engLine}`);
  }

  // Execution verdict summary line (compact — V6)
  if (report.executionVerdicts && report.executionVerdicts.length > 0) {
    lines.push('');
    const execLine = report.executionVerdicts
      .map((v) => `${EXEC_VERDICT_EMOJI[v.verdict]} ${v.dimension}`)
      .join(' · ');
    lines.push(`**Execution:** ${execLine}`);
  }

  lines.push('');
  lines.push(`**Recommendation:** ${recommendation(report)}`);

  return lines.join('\n');
}
