/**
 * LCIS Autonomous Operations — IntelligenceReportGenerator
 *
 * Generates structured intelligence reports and writes them to
 * graphify-out/autonomous-operations/. Reports clearly distinguish:
 *   - CONNECTED structural intelligence (code graph, topology, architecture)
 *   - NOT CONNECTED live signals (telemetry, metrics, runtime errors)
 *
 * Reports are consumed by humans and AI agents alike.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const REPORT_DIR = path.join(REPO_ROOT, 'graphify-out', 'autonomous-operations');

// ── Lazy import helpers ───────────────────────────────────────────────────────

async function getOperationsReasoningEngine() {
  try {
    const m = await import('./OperationsReasoningEngine.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatTs(date = new Date()) {
  return date.toISOString();
}

function severityBadge(severity) {
  const map = {
    critical: '🔴 CRITICAL',
    high: '🟠 HIGH',
    medium: '🟡 MEDIUM',
    low: '🟢 LOW',
    info: 'ℹ️  INFO',
  };
  return map[severity] ?? severity?.toUpperCase() ?? 'UNKNOWN';
}

function connectedBadge(connected) {
  return connected ? '✅ CONNECTED' : '⚠️  NOT CONNECTED';
}

function postureBadge(posture) {
  const map = {
    STABLE: '🟢 STABLE',
    'AT RISK': '🟡 AT RISK',
    DEGRADED: '🔴 DEGRADED',
  };
  return map[posture] ?? posture;
}

// ── Markdown section builders ─────────────────────────────────────────────────

function buildFindingsSection(findings) {
  if (!findings?.length) return '_No findings detected._\n';
  const lines = [];
  for (const f of findings) {
    lines.push(`### ${severityBadge(f.severity)} — ${f.subject ?? f.type}`);
    lines.push(`- **Type:** ${f.type}`);
    lines.push(`- **Signal:** ${f.signal ?? f.description ?? 'N/A'}`);
    lines.push(`- **Connection:** ${connectedBadge(f.connected)}`);
    if (!f.connected && (f.liveSource || f.notConnectedReason)) {
      lines.push(`- **Source:** ${f.liveSource ?? f.notConnectedReason}`);
    }
    if (f.evidence && Object.keys(f.evidence).length > 0) {
      lines.push(`- **Evidence:** \`${JSON.stringify(f.evidence)}\``);
    }
    if (f.recommendation) {
      lines.push(`- **Recommendation:** ${f.recommendation}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function buildRecommendationsSection(recommendations) {
  if (!recommendations?.length) return '_No recommendations._\n';
  const lines = [];
  let rank = 1;
  for (const rec of recommendations) {
    lines.push(`### #${rank++} — ${rec.action}`);
    lines.push(`- **Priority:** ${rec.priority}`);
    lines.push(`- **Effort:** ${rec.effort ?? 'Unknown'}`);
    lines.push(`- **Rationale:** ${rec.rationale}`);
    if (rec.affectedComponents?.length) {
      lines.push(`- **Affected:** ${rec.affectedComponents.join(', ')}`);
    }
    lines.push(`- **Connection:** ${connectedBadge(rec.connected)}`);
    if (!rec.connected && rec.liveSource) {
      lines.push(`- **Live Source:** ${rec.liveSource}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function buildConnectionStatusSection(findings) {
  const connected = (findings ?? []).filter(f => f.connected && f.severity !== 'info');
  const notConnected = (findings ?? []).filter(f => !f.connected && f.severity !== 'info');
  const info = (findings ?? []).filter(f => f.severity === 'info');

  const lines = [
    `| Signal Type | Count | Status |`,
    `|-------------|-------|--------|`,
    `| Connected structural findings | ${connected.length} | ✅ CONNECTED |`,
    `| Not-connected live signals | ${notConnected.length} | ⚠️ NOT CONNECTED |`,
    `| Informational | ${info.length} | ℹ️ INFO |`,
    '',
  ];

  if (notConnected.length > 0) {
    lines.push('**Not-connected signals — exact sources:**');
    lines.push('');
    for (const f of notConnected.slice(0, 10)) {
      lines.push(`- \`${f.subject}\`: ${f.liveSource ?? f.notConnectedReason ?? 'NOT CONNECTED'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main class ────────────────────────────────────────────────────────────────

class IntelligenceReportGenerator {
  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Generate and write the daily intelligence report.
   * @returns {Promise<{path: string, sizeBytes: number, date: string}>}
   */
  async generateDailyReport() {
    ensureReportDir();

    const engine = await getOperationsReasoningEngine();
    let assessment = null;
    let assessError = null;

    if (engine) {
      try {
        assessment = await engine.assess();
      } catch (err) {
        assessError = err.message;
      }
    }

    const date = formatDate();
    const ts = formatTs();
    const posture = assessment?.overallPosture ?? 'UNKNOWN';
    const findings = assessment?.findings ?? [];
    const recommendations = assessment?.recommendations ?? [];

    // Partition findings
    const connected = findings.filter(f => f.connected);
    const notConnected = findings.filter(f => !f.connected);
    const criticals = findings.filter(f => f.severity === 'critical');
    const highs = findings.filter(f => f.severity === 'high');

    const lines = [];
    lines.push(`# LCIS Daily Intelligence Report — ${date}`);
    lines.push('');
    lines.push(`**Generated:** ${ts}  `);
    lines.push(`**Overall Posture:** ${postureBadge(posture)}  `);
    lines.push(`**Total Findings:** ${findings.length} (${criticals.length} critical, ${highs.length} high)  `);
    lines.push(`**Recommendations:** ${recommendations.length}  `);
    lines.push('');
    lines.push('---');
    lines.push('');

    if (assessError) {
      lines.push(`> ⚠️ Assessment engine error: ${assessError}`);
      lines.push('');
    }

    // Executive summary
    lines.push('## Executive Summary');
    lines.push('');
    if (posture === 'STABLE') {
      lines.push('System posture is **STABLE**. No critical structural findings detected.');
    } else if (posture === 'AT RISK') {
      lines.push('System posture is **AT RISK**. High-severity structural findings require attention.');
    } else if (posture === 'DEGRADED') {
      lines.push('System posture is **DEGRADED**. Critical findings detected — immediate action required.');
    } else {
      lines.push('System posture could not be determined — see findings below.');
    }
    lines.push('');

    // Connection status
    lines.push('## Signal Connection Status');
    lines.push('');
    lines.push(buildConnectionStatusSection(findings));

    // Top findings
    lines.push('## Findings');
    lines.push('');
    if (findings.length === 0) {
      lines.push('_No findings detected._');
      lines.push('');
    } else {
      lines.push(`### Critical & High Severity (${criticals.length + highs.length})`);
      lines.push('');
      lines.push(buildFindingsSection([...criticals, ...highs]));
      if (findings.length > criticals.length + highs.length) {
        lines.push(`### All Findings (${findings.length} total)`);
        lines.push('');
        lines.push(buildFindingsSection(findings));
      }
    }

    // Drift section
    lines.push('## Architecture Drift');
    lines.push('');
    const driftFindings = findings.filter(f => f.type?.includes('drift') || f.category === 'architecture-drift');
    if (driftFindings.length > 0) {
      lines.push(buildFindingsSection(driftFindings));
    } else {
      lines.push('_No architecture drift findings in this assessment._');
      lines.push('');
    }

    // Dependency risk section
    lines.push('## Dependency Risk');
    lines.push('');
    const depFindings = findings.filter(f => f.type === 'single-point-of-failure' || f.type === 'cycle');
    if (depFindings.length > 0) {
      lines.push(buildFindingsSection(depFindings));
    } else {
      lines.push('_No dependency risk findings in this assessment._');
      lines.push('');
    }

    // Recommendations
    lines.push('## Recommendations (Ranked)');
    lines.push('');
    lines.push(buildRecommendationsSection(recommendations.slice(0, 10)));

    // Honesty footer
    lines.push('---');
    lines.push('');
    lines.push('## Honesty Contract');
    lines.push('');
    lines.push('| Category | Status |');
    lines.push('|----------|--------|');
    lines.push('| Structural topology (code graph, architecture) | ✅ CONNECTED |');
    lines.push('| Architecture drift (snapshot comparison) | ✅ CONNECTED |');
    lines.push('| Dependency risk (blast-radius, cycles) | ✅ CONNECTED |');
    lines.push('| HTTP error rates / latency | ⚠️ NOT CONNECTED — env: OTEL_EXPORTER_OTLP_ENDPOINT |');
    lines.push('| DB slow queries | ⚠️ NOT CONNECTED — env: DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY |');
    lines.push('| Queue backlog depth | ⚠️ NOT CONNECTED — env: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN |');
    lines.push('| Payment failure rate | ⚠️ NOT CONNECTED — env: RAZORPAY_WEBHOOK_SECRET |');
    lines.push('| Worker health | ⚠️ NOT CONNECTED — env: CLOUDFLARE_API_TOKEN |');
    lines.push('');
    lines.push('_No metric values are fabricated. Live signals are clearly labeled NOT CONNECTED with the exact environment variable required._');
    lines.push('');
    lines.push(`_Report generated by LCIS Autonomous Operations v2 (Phase 17) at ${ts}_`);

    const content = lines.join('\n');
    const reportPath = path.join(REPORT_DIR, `daily-intelligence-${date}.md`);
    fs.writeFileSync(reportPath, content, 'utf8');

    return {
      path: reportPath,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      date,
    };
  }

  /**
   * Generate a structured operational insights JSON document.
   * @returns {Promise<object>}
   */
  async generateOperationalInsights() {
    const engine = await getOperationsReasoningEngine();
    if (!engine) {
      return {
        generatedAt: formatTs(),
        error: 'OperationsReasoningEngine unavailable',
        findings: [],
        recommendations: [],
      };
    }

    const assessment = await engine.assess();

    const insights = {
      generatedAt: formatTs(),
      overallPosture: assessment.overallPosture,
      findingCount: assessment.findings.length,
      criticalCount: assessment.findings.filter(f => f.severity === 'critical').length,
      highCount: assessment.findings.filter(f => f.severity === 'high').length,
      connectedFindings: assessment.findings.filter(f => f.connected && f.severity !== 'info').length,
      notConnectedSignals: assessment.findings.filter(f => !f.connected).length,
      topRecommendations: (assessment.recommendations ?? []).slice(0, 5).map(r => ({
        action: r.action,
        priority: r.priority,
        effort: r.effort,
        connected: r.connected,
      })),
      findings: assessment.findings,
    };

    const insightsPath = path.join(REPORT_DIR, 'operational-insights.json');
    ensureReportDir();
    fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2));

    return insights;
  }

  /**
   * Generate a ranked engineering recommendations document.
   * @returns {Promise<{path: string, sizeBytes: number, recommendations: object[]}>}
   */
  async generateEngineeringRecommendations() {
    ensureReportDir();

    const engine = await getOperationsReasoningEngine();
    let recommendations = [];
    let error = null;

    if (engine) {
      try {
        recommendations = await engine.getEngineeringRecommendations();
      } catch (err) {
        error = err.message;
      }
    }

    const ts = formatTs();
    const lines = [];
    lines.push('# LCIS Engineering Recommendations');
    lines.push('');
    lines.push(`**Generated:** ${ts}`);
    lines.push(`**Total recommendations:** ${recommendations.length}`);
    lines.push('');

    if (error) {
      lines.push(`> Error generating recommendations: ${error}`);
      lines.push('');
    }

    if (recommendations.length === 0) {
      lines.push('_No recommendations at this time. System appears stable._');
    } else {
      lines.push(buildRecommendationsSection(recommendations));
    }

    const content = lines.join('\n');
    const reportPath = path.join(REPORT_DIR, 'engineering-recommendations.md');
    fs.writeFileSync(reportPath, content, 'utf8');

    return {
      path: reportPath,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      recommendations,
    };
  }

  /**
   * Generate a per-incident intelligence report.
   * @param {{ domain: string, description: string, detectedAt?: string, severity?: string }} incident
   * @returns {Promise<{path: string, sizeBytes: number}>}
   */
  async generateIncidentIntelligenceReport(incident) {
    ensureReportDir();

    const { domain, description, detectedAt, severity } = incident ?? {};
    const ts = formatTs();
    const safeDate = formatDate();

    // Try to fetch root-cause context from LCIS intelligence API
    let rootCause = null;
    let impactData = null;

    try {
      const lcisUrl = process.env.LCIS_V1_URL ?? 'http://localhost:3333';
      const [rcRes, impactRes] = await Promise.allSettled([
        fetch(`${lcisUrl}/api/incident-intelligence?domain=${encodeURIComponent(domain ?? '')}`, {
          signal: AbortSignal.timeout(5000),
        }).then(r => r.ok ? r.json() : null),
        fetch(`${lcisUrl}/api/cross-domain?key=${encodeURIComponent(domain ?? '')}`, {
          signal: AbortSignal.timeout(5000),
        }).then(r => r.ok ? r.json() : null),
      ]);
      rootCause = rcRes.status === 'fulfilled' ? rcRes.value : null;
      impactData = impactRes.status === 'fulfilled' ? impactRes.value : null;
    } catch {
      // LCIS API may not be running — non-fatal
    }

    const lines = [];
    lines.push(`# Incident Intelligence Report`);
    lines.push('');
    lines.push(`**Domain:** ${domain ?? 'unknown'}  `);
    lines.push(`**Description:** ${description ?? 'N/A'}  `);
    lines.push(`**Detected At:** ${detectedAt ?? ts}  `);
    lines.push(`**Severity:** ${severityBadge(severity ?? 'unknown')}  `);
    lines.push(`**Report Generated:** ${ts}  `);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Root Cause Candidates');
    lines.push('');
    if (rootCause?.rootCauses?.length) {
      for (const rc of rootCause.rootCauses) {
        lines.push(`- **${rc.cause ?? rc}** (confidence: ${rc.confidence ?? 'unknown'})`);
      }
    } else if (rootCause) {
      lines.push(`\`\`\`json\n${JSON.stringify(rootCause, null, 2)}\n\`\`\``);
    } else {
      lines.push('_LCIS intelligence API not available (http://localhost:3333) — run `pnpm graph:ui` to start._');
      lines.push('');
      lines.push('**Manual root-cause checklist:**');
      if (domain) {
        lines.push(`- Check \`/api/incident-intelligence?domain=${domain}\` once LCIS is running`);
        lines.push(`- Check \`/api/cross-domain?key=${domain}\` for cascade paths`);
        lines.push(`- Run \`pnpm graph:intel blast "${domain}"\` for blast radius`);
      }
    }
    lines.push('');

    lines.push('## Impact Assessment');
    lines.push('');
    if (impactData) {
      lines.push(`\`\`\`json\n${JSON.stringify(impactData, null, 2)}\n\`\`\``);
    } else {
      lines.push('_Impact data NOT CONNECTED — requires LCIS intelligence API at http://localhost:3333_');
      if (domain) {
        lines.push('');
        lines.push('**Known blast-radius context from CLAUDE.md:**');
        if (domain === 'payments' || domain === 'checkout') {
          lines.push('- `create_checkout_order` RPC is the canonical money entry point — all order creation flows through it');
          lines.push('- `getSupabaseAdmin` (115 dependents) — any Supabase connection failure cascades widely');
          lines.push('- `confirm_order_payment_with_ledger` — payment confirmation; idempotency key required');
        }
      }
    }
    lines.push('');

    lines.push('## Recovery Playbook');
    lines.push('');
    lines.push('1. **Identify scope:** `pnpm graph:intel blast "' + (domain ?? '<symbol>') + '"`');
    lines.push('2. **Check live health:** `curl http://localhost:3333/api/live-health?domain=' + (domain ?? '') + '`');
    lines.push('3. **Review runbook:** `curl http://localhost:3333/api/runbook?domain=' + (domain ?? '') + '`');
    lines.push('4. **Escalation:** check `/api/runbook` escalation chain for domain owner');
    lines.push('5. **Post-incident:** run `pnpm graph:omega` to refresh all intelligence layers');
    lines.push('');

    lines.push('## Connection Status');
    lines.push('');
    lines.push('| Data | Status |');
    lines.push('|------|--------|');
    lines.push(`| LCIS root-cause API | ${rootCause ? '✅ CONNECTED' : '⚠️ NOT CONNECTED — http://localhost:3333'} |`);
    lines.push(`| Cross-domain impact | ${impactData ? '✅ CONNECTED' : '⚠️ NOT CONNECTED'} |`);
    lines.push('| Live metric telemetry | ⚠️ NOT CONNECTED — requires OTEL exporter + Cloudflare Analytics Engine |');
    lines.push('');
    lines.push(`_Report generated by LCIS Autonomous Operations v2 at ${ts}_`);

    const content = lines.join('\n');
    const safeDomain = (domain ?? 'unknown').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const reportPath = path.join(REPORT_DIR, `incident-intelligence-${safeDomain}-${safeDate}.md`);
    fs.writeFileSync(reportPath, content, 'utf8');

    return {
      path: reportPath,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
    };
  }

  /**
   * Return the most recently generated daily report content.
   * @returns {{ path: string | null, content: string | null, date: string }}
   */
  getLatestReport() {
    ensureReportDir();
    try {
      const files = fs.readdirSync(REPORT_DIR)
        .filter(f => f.startsWith('daily-intelligence-') && f.endsWith('.md'))
        .sort()
        .reverse();

      if (files.length === 0) {
        return { path: null, content: null, date: null };
      }

      const latest = files[0];
      const reportPath = path.join(REPORT_DIR, latest);
      const content = fs.readFileSync(reportPath, 'utf8');
      const date = latest.replace('daily-intelligence-', '').replace('.md', '');

      return { path: reportPath, content, date };
    } catch {
      return { path: null, content: null, date: null };
    }
  }
}

export default new IntelligenceReportGenerator();
