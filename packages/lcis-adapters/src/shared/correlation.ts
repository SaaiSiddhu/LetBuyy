/**
 * CorrelationEngine — intersects LIVE facts (from adapters) with STRUCTURAL intelligence
 * (from lcis-core). All reasoning is DELEGATED to lcis-core (blast radius, cross-domain,
 * explain); the engine only overlays which live facts touch the structurally-affected
 * domains/tables/services. No new intelligence is computed here.
 */
import { type Evidence, type LcisEngine, evidence } from '@letbuyy/lcis-core';
import type { LiveFact } from './contracts';

export interface StructuralContext {
  readonly subject: string;
  readonly affectedDomains: readonly string[];
  readonly affectedTables: readonly string[];
  readonly affectedServices: readonly string[];
  readonly impactedFiles: number;
  readonly criticality: string;
  readonly evidence: readonly Evidence[];
}

export interface CorrelationResult {
  readonly subject: string;
  readonly summary: string;
  readonly structural: StructuralContext | null;
  readonly correlatedFacts: readonly LiveFact[];
  readonly otherFacts: readonly LiveFact[];
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
}

export class CorrelationEngine {
  constructor(private readonly engine: LcisEngine) {}

  /** Structural context for a subject, derived entirely from lcis-core. */
  async structuralContext(subject: string): Promise<StructuralContext | null> {
    const ev: Evidence[] = [];
    const domains = new Set<string>();
    const tables = new Set<string>();
    const services = new Set<string>();
    let impactedFiles = 0;
    let criticality = 'unknown';

    const cross = this.engine.blast.crossDomain(subject);
    if (!('error' in cross)) {
      domains.add(cross.domain);
      cross.blastRadius.affected.forEach((d) => domains.add(d));
      cross.tables.forEach((t) => tables.add(t));
      cross.services.apps.forEach((s) => services.add(s));
      cross.services.workers.forEach((s) => services.add(s));
      ev.push(
        evidence('artifact-field', `crossDomain:${subject}`, `${cross.blastRadius.domains} domains affected`, 'graphify-out/domain-intel.json'),
      );
    }

    const blast = this.engine.blast.blast(subject);
    if (blast) {
      impactedFiles = blast.impactedFiles;
      criticality = blast.node.degree >= 100 ? 'critical' : blast.node.degree >= 30 ? 'high' : 'medium';
      ev.push(evidence('graph-node', blast.node.id, `${blast.impactedFiles} files impacted`, 'graphify-out/graph.json'));
    }

    try {
      const explain = await this.engine.architecture.explainDomain(subject);
      for (const e of explain.evidence) ev.push(e);
    } catch {
      // subject is not a domain key — fine, structural context falls back to blast/cross only
    }

    if (domains.size === 0 && tables.size === 0 && impactedFiles === 0) return null;
    return {
      subject,
      affectedDomains: [...domains],
      affectedTables: [...tables],
      affectedServices: [...services],
      impactedFiles,
      criticality,
      evidence: ev,
    };
  }

  /** Correlate live facts against the structural context of a subject. */
  async correlate(subject: string, facts: readonly LiveFact[]): Promise<CorrelationResult> {
    const ctx = await this.structuralContext(subject);
    const subjects = new Set<string>([subject.toLowerCase()]);
    if (ctx) {
      for (const d of ctx.affectedDomains) subjects.add(d.toLowerCase());
      for (const t of ctx.affectedTables) subjects.add(t.toLowerCase());
      for (const s of ctx.affectedServices) subjects.add(s.toLowerCase());
    }
    const keys = [...subjects];
    const correlated: LiveFact[] = [];
    const other: LiveFact[] = [];
    for (const f of facts) {
      const s = f.subject.toLowerCase();
      const hit = subjects.has(s) || keys.some((x) => x.length >= 4 && (s.includes(x) || x.includes(s)));
      (hit ? correlated : other).push(f);
    }
    correlated.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
    const ev: Evidence[] = [...(ctx?.evidence ?? []), ...correlated.flatMap((f) => [...f.evidence])];
    const confidence = ctx ? (correlated.length > 0 ? 0.9 : 0.6) : correlated.length > 0 ? 0.5 : 0.2;
    return {
      subject,
      summary: buildSummary(subject, ctx, correlated),
      structural: ctx,
      correlatedFacts: correlated,
      otherFacts: other,
      evidence: ev,
      confidence,
    };
  }
}

function buildSummary(subject: string, ctx: StructuralContext | null, correlated: readonly LiveFact[]): string {
  const parts: string[] = [];
  if (ctx) {
    parts.push(
      `Structurally, "${subject}" touches ${ctx.affectedDomains.length} domain(s) and ${ctx.affectedTables.length} table(s) (criticality: ${ctx.criticality}).`,
    );
  } else {
    parts.push(`No structural blast radius found for "${subject}" in the code graph.`);
  }
  if (correlated.length > 0) {
    const kinds = [...new Set(correlated.map((f) => f.kind))].join(', ');
    parts.push(`${correlated.length} live fact(s) correlate (${kinds}). Most recent: ${correlated[0]?.detail ?? ''}`);
  } else {
    parts.push('No live facts correlate with the affected surface (or no adapters are connected).');
  }
  return parts.join(' ');
}
