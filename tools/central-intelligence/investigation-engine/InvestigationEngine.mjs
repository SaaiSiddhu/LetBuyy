/**
 * InvestigationEngine — LCIS V3 Investigation Engine (Phase 24)
 * Autonomous incident investigations with no human in the loop.
 *
 * Facade that orchestrates:
 *   - IncidentEvidenceCollector  (collect → snapshot evidence)
 *   - TimelineBuilder            (buildAll → 4 timelines)
 *   - RootCauseInvestigator      (investigate → ranked candidates)
 *   - IntelligenceReportGenerator (generateIncidentIntelligenceReport)
 *   - MemoryIngestionPipeline    (store investigation for future recall)
 *
 * Investigations persist to graphify-out/investigations/{id}.json + {id}.md
 *
 * InvestigationReport shape:
 * {
 *   id, incident,
 *   timelines: { incident, dependency, deployment, impact },
 *   rootCauseCandidates: [...ranked],
 *   affected: { services, domains, merchants },
 *   confidence,
 *   recommendations: [...],
 *   evidence: [...],
 *   notConnected: [...],
 *   startedAt, completedAt
 * }
 */

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const INVESTIGATIONS_DIR = path.join(REPO_ROOT, 'graphify-out', 'investigations');
const V1_BASE = 'http://localhost:3333';

// ─── lazy module loader ──────────────────────────────────────────────────────

const _moduleCache = new Map();

async function loadModule(specifier) {
  if (_moduleCache.has(specifier)) return _moduleCache.get(specifier);
  try {
    const mod = (await import(specifier)).default;
    _moduleCache.set(specifier, mod);
    return mod;
  } catch {
    _moduleCache.set(specifier, null);
    return null;
  }
}

// ─── V1 fetch helper ─────────────────────────────────────────────────────────

async function fetchV1(endpoint, timeout = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${V1_BASE}${endpoint}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ─── persistence helpers ─────────────────────────────────────────────────────

async function ensureInvestigationsDir() {
  await fs.mkdir(INVESTIGATIONS_DIR, { recursive: true });
}

async function persistInvestigation(report) {
  await ensureInvestigationsDir();
  const jsonPath = path.join(INVESTIGATIONS_DIR, `${report.id}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  return jsonPath;
}

async function loadInvestigation(id) {
  try {
    const jsonPath = path.join(INVESTIGATIONS_DIR, `${id}.json`);
    const raw = await fs.readFile(jsonPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function listInvestigationFiles() {
  await ensureInvestigationsDir();
  try {
    const files = await fs.readdir(INVESTIGATIONS_DIR);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}

// ─── extract helpers ─────────────────────────────────────────────────────────

function extractDomain(incident) {
  if (!incident) return 'unknown';
  return (
    incident.domain ||
    incident.component ||
    incident.service ||
    incident.subject ||
    (typeof incident === 'string' ? incident : 'unknown')
  );
}

function generateId(incident) {
  const domain = extractDomain(incident);
  const ts = Date.now();
  const hash = crypto.createHash('sha256').update(`${domain}-${ts}`).digest('hex').slice(0, 8);
  return `inv-${domain.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${hash}`;
}

function collectNotConnected(timelines, evidence) {
  const items = [];

  // From timelines
  for (const tl of Object.values(timelines)) {
    if (Array.isArray(tl?.notConnected)) items.push(...tl.notConnected);
  }

  // From evidence
  for (const ev of evidence) {
    if (ev.notConnected) {
      items.push({
        field: ev.type,
        source: ev.source,
        note: ev.fact?.startsWith('NOT CONNECTED') ? ev.fact : `NOT CONNECTED — ${ev.source}`,
      });
    }
  }

  // Deduplicate by source
  const seen = new Set();
  return items.filter((item) => {
    const key = item.source;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractAffected(rootCauseResult, blastData, domainData) {
  const services = [];
  const domains = [];
  const merchants = [];

  // From blast data
  if (blastData) {
    const affected = blastData.affected || blastData.consumers || blastData.dependents || [];
    for (const a of Array.isArray(affected) ? affected : []) {
      const name = typeof a === 'string' ? a : a.name || a.component || String(a);
      if (!services.includes(name)) services.push(name);
    }
  }

  // From domain data
  if (domainData) {
    const consumedBy = domainData.consumedBy || [];
    for (const d of Array.isArray(consumedBy) ? consumedBy : []) {
      const name = typeof d === 'string' ? d : d.key || d.name || String(d);
      if (!domains.includes(name)) domains.push(name);
    }
  }

  // From root cause most likely affected
  if (rootCauseResult?.candidates) {
    for (const c of rootCauseResult.candidates) {
      if (c.mostLikelyAffected) {
        for (const a of c.mostLikelyAffected) {
          const name = typeof a === 'string' ? a : a.name || String(a);
          if (!services.includes(name)) services.push(name);
        }
      }
    }
  }

  // Merchants: multi-tenant — all stores share schema, so all are potentially affected
  // Cannot know which merchants without live data
  merchants.push({
    note: 'All stores share the schema (multi-tenant)',
    liveAffectedCount: 'NOT CONNECTED — query site_id from Supabase sites table',
  });

  return { services, domains, merchants };
}

function buildRecommendations(rootCauseResult, domainData, runbookData) {
  const recs = [];

  // From root cause suggestions
  if (rootCauseResult?.suggestions?.length) {
    recs.push(...rootCauseResult.suggestions.map((s) => ({ type: 'investigation', action: s, priority: 'high' })));
  }

  // Top candidate
  if (rootCauseResult?.candidates?.[0]) {
    const top = rootCauseResult.candidates[0];
    recs.push({
      type: 'root-cause',
      action: `Investigate: ${top.cause} (confidence: ${(top.confidence * 100).toFixed(0)}%)`,
      priority: top.confidence > 0.7 ? 'critical' : 'high',
    });
  }

  // Deployment correlation
  if (rootCauseResult?.deploymentCorrelation?.correlated) {
    recs.push({
      type: 'deployment-rollback',
      action: `Consider rollback — incident correlated to recent deployment: ${rootCauseResult.deploymentCorrelation.deployment?.subject || 'recent commit'}`,
      priority: 'high',
    });
  }

  // Runbook steps
  if (runbookData?.steps?.length) {
    recs.push({
      type: 'runbook',
      action: `Follow runbook: ${runbookData.title || 'domain runbook'} (${runbookData.steps.length} steps)`,
      priority: 'high',
      steps: runbookData.steps,
    });
  }

  // Generic if no candidates
  if (recs.length === 0) {
    recs.push({
      type: 'manual-review',
      action: 'No automated root cause identified — manual investigation required',
      priority: 'medium',
    });
  }

  return recs;
}

// ─── Markdown report generator ────────────────────────────────────────────────

function buildMarkdownReport(report) {
  const lines = [
    `# Investigation Report: ${report.id}`,
    ``,
    `**Domain:** ${extractDomain(report.incident)}  `,
    `**Started:** ${report.startedAt}  `,
    `**Completed:** ${report.completedAt}  `,
    `**Confidence:** ${(report.confidence * 100).toFixed(0)}%`,
    ``,
    `## Root Cause Candidates`,
    ``,
  ];

  if (report.rootCauseCandidates?.length) {
    report.rootCauseCandidates.forEach((c, i) => {
      lines.push(`### ${i + 1}. ${c.cause}`);
      lines.push(`- **Confidence:** ${(c.confidence * 100).toFixed(0)}%`);
      lines.push(`- **Source:** ${c.source}`);
      if (c.reasoning?.length) {
        lines.push(`- **Reasoning:**`);
        c.reasoning.forEach((r) => lines.push(`  - ${r}`));
      }
      if (c.relatedDeployment) {
        lines.push(`- **Related Deployment:** ${JSON.stringify(c.relatedDeployment).slice(0, 120)}`);
      }
      lines.push('');
    });
  } else {
    lines.push('_No root cause candidates identified._', '');
  }

  lines.push('## Timelines', '');
  for (const [name, tl] of Object.entries(report.timelines || {})) {
    lines.push(`### ${name.charAt(0).toUpperCase() + name.slice(1)} Timeline`);
    if (tl?.events?.length) {
      tl.events.forEach((e) => {
        const conn = e.connected ? '✓' : '⚠ NOT CONNECTED';
        lines.push(`- **${e.t}** [${conn}] ${e.event} _(${e.source})_`);
      });
    } else {
      lines.push('_No events._');
    }
    lines.push('');
  }

  lines.push('## Affected Systems', '');
  lines.push(`**Services:** ${(report.affected?.services || []).join(', ') || 'unknown'}`);
  lines.push(`**Domains:** ${(report.affected?.domains || []).join(', ') || 'unknown'}`);
  lines.push('');

  lines.push('## Recommendations', '');
  (report.recommendations || []).forEach((r, i) => {
    lines.push(`${i + 1}. **[${r.priority?.toUpperCase() || 'MEDIUM'}]** ${r.action}`);
  });
  lines.push('');

  if (report.notConnected?.length) {
    lines.push('## NOT CONNECTED (live data sources not wired)', '');
    report.notConnected.forEach((nc) => {
      lines.push(`- **${nc.field || nc.source}:** ${nc.note || 'NOT CONNECTED'} _(source: ${nc.source})_`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ─── InvestigationEngine ─────────────────────────────────────────────────────

class InvestigationEngine {
  /**
   * Full autonomous investigation for an incident.
   * Returns InvestigationReport.
   */
  async investigate(incident) {
    const startedAt = new Date().toISOString();
    const id = generateId(incident);
    const domain = extractDomain(incident);

    // 1. Load primitives (all lazy, graceful)
    const [evidenceCollector, timelineBuilder, rootCauseInvestigator] = await Promise.all([
      loadModule('./IncidentEvidenceCollector.mjs'),
      loadModule('./TimelineBuilder.mjs'),
      loadModule('./RootCauseInvestigator.mjs'),
    ]);

    // 2. Collect evidence + V1 data in parallel
    const [evidenceResult, timelinesResult, v1BlastResult, v1DomainResult, v1RunbookResult] =
      await Promise.allSettled([
        evidenceCollector ? evidenceCollector.collect(incident) : Promise.resolve([]),
        timelineBuilder ? timelineBuilder.buildAll(incident) : Promise.resolve({ incident: { events: [] }, dependency: { events: [] }, deployment: { events: [] }, impact: { events: [] } }),
        fetchV1(`/api/blast?q=${encodeURIComponent(domain)}`),
        fetchV1(`/api/domain?key=${encodeURIComponent(domain)}`),
        fetchV1(`/api/runbook?domain=${encodeURIComponent(domain)}`),
      ]);

    const evidence = evidenceResult.status === 'fulfilled' ? evidenceResult.value : [];
    const timelines = timelinesResult.status === 'fulfilled'
      ? timelinesResult.value
      : { incident: { events: [] }, dependency: { events: [] }, deployment: { events: [] }, impact: { events: [] } };
    const blastData = v1BlastResult.status === 'fulfilled' ? v1BlastResult.value : null;
    const domainData = v1DomainResult.status === 'fulfilled' ? v1DomainResult.value : null;
    const runbookData = v1RunbookResult.status === 'fulfilled' ? v1RunbookResult.value : null;

    // 3. Root cause investigation
    let rootCauseResult = null;
    if (rootCauseInvestigator) {
      try {
        rootCauseResult = await rootCauseInvestigator.investigate(incident);
      } catch {
        rootCauseResult = null;
      }
    }

    // 4. Aggregate
    const notConnected = collectNotConnected(timelines, evidence);
    const affected = extractAffected(rootCauseResult, blastData, domainData);
    const recommendations = buildRecommendations(rootCauseResult, domainData, runbookData);
    const confidence = rootCauseResult?.confidence ?? 0;

    const completedAt = new Date().toISOString();

    const report = {
      id,
      incident: typeof incident === 'string' ? { domain: incident } : incident,
      timelines,
      rootCauseCandidates: rootCauseResult?.candidates ?? [],
      affected,
      confidence,
      recommendations,
      evidence,
      notConnected,
      startedAt,
      completedAt,
    };

    // 5. Persist to disk + report generator
    await Promise.allSettled([
      persistInvestigation(report),
      this.generateReport(report),
      this._storeInMemory(report),
    ]);

    return report;
  }

  /**
   * Investigate the current state of a domain (not a specific incident).
   * Synthesizes a synthetic incident from domain health data.
   */
  async investigateDomain(domain) {
    // Build a synthetic incident from available domain health data
    const [healthData, domainData] = await Promise.allSettled([
      fetchV1(`/api/live-health?domain=${encodeURIComponent(domain)}`),
      fetchV1(`/api/domain?key=${encodeURIComponent(domain)}`),
    ]);

    const health = healthData.status === 'fulfilled' ? healthData.value : null;
    const intel = domainData.status === 'fulfilled' ? domainData.value : null;

    const syntheticIncident = {
      domain,
      id: `domain-investigation-${domain}-${Date.now()}`,
      description: `Domain health investigation: ${domain}`,
      source: 'investigateDomain',
      healthStatus: health?.status || 'NOT CONNECTED',
      domainInfo: intel ? { name: intel.name, description: intel.description } : null,
    };

    return this.investigate(syntheticIncident);
  }

  /**
   * Retrieve a previously stored investigation by ID.
   */
  async getInvestigation(id) {
    return loadInvestigation(id);
  }

  /**
   * List all stored investigation IDs.
   */
  async listInvestigations() {
    const ids = await listInvestigationFiles();
    const summaries = await Promise.allSettled(
      ids.map(async (id) => {
        const inv = await loadInvestigation(id);
        if (!inv) return null;
        return {
          id: inv.id,
          domain: extractDomain(inv.incident),
          confidence: inv.confidence,
          startedAt: inv.startedAt,
          completedAt: inv.completedAt,
          candidateCount: inv.rootCauseCandidates?.length ?? 0,
        };
      })
    );
    return summaries
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value)
      .sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
  }

  /**
   * Generate a Markdown report for an investigation and persist it.
   * Pattern mirrors IntelligenceReportGenerator.generateIncidentIntelligenceReport.
   */
  async generateReport(investigation) {
    const irg = await loadModule('../autonomous-operations/IntelligenceReportGenerator.mjs');

    // Try V2 report generator first
    if (irg) {
      try {
        const v2Report = await irg.generateIncidentIntelligenceReport(investigation);
        if (v2Report) {
          // Persist alongside our own markdown
          await ensureInvestigationsDir();
          const mdPath = path.join(INVESTIGATIONS_DIR, `${investigation.id}.md`);
          const content =
            typeof v2Report === 'string' ? v2Report : JSON.stringify(v2Report, null, 2);
          await fs.writeFile(mdPath, content, 'utf8');
          return mdPath;
        }
      } catch {
        // Fall through to local generator
      }
    }

    // Local markdown generation
    await ensureInvestigationsDir();
    const mdPath = path.join(INVESTIGATIONS_DIR, `${investigation.id}.md`);
    const markdown = buildMarkdownReport(investigation);
    await fs.writeFile(mdPath, markdown, 'utf8');
    return mdPath;
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  async _storeInMemory(report) {
    const mip = await loadModule('../memory-engine/MemoryIngestionPipeline.mjs');
    if (!mip) return;

    const domain = extractDomain(report.incident);
    const text = [
      `Investigation: ${domain}`,
      `Confidence: ${(report.confidence * 100).toFixed(0)}%`,
      `Root causes: ${(report.rootCauseCandidates || []).map((c) => c.cause).join('; ')}`,
      `Affected: ${JSON.stringify(report.affected).slice(0, 200)}`,
      `Recommendations: ${(report.recommendations || []).map((r) => r.action).join('; ')}`,
    ].join('\n');

    try {
      await mip.runFromText(text, 'incidents', {
        investigationId: report.id,
        domain,
        confidence: report.confidence,
        startedAt: report.startedAt,
      });
    } catch {
      // Qdrant not wired — graceful
    }
  }
}

export default new InvestigationEngine();
