/**
 * ArchitectureDriftDetector.mjs — LCIS Architecture Intelligence
 * Detects drift between architecture snapshots and generates risk reports.
 */

import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

async function getSnapshotService() {
  const m = await import('./ArchitectureSnapshotService.mjs');
  return m.default;
}

function diffSets(setA, setB) {
  const a = new Set(setA);
  const b = new Set(setB);
  return {
    added: [...b].filter(x => !a.has(x)),
    removed: [...a].filter(x => !b.has(x)),
    common: [...a].filter(x => b.has(x)),
  };
}

function diffObjects(objA, objB) {
  const keysA = new Set(Object.keys(objA ?? {}));
  const keysB = new Set(Object.keys(objB ?? {}));
  const added = [...keysB].filter(k => !keysA.has(k));
  const removed = [...keysA].filter(k => !keysB.has(k));
  const changed = [];
  for (const k of [...keysA].filter(k => keysB.has(k))) {
    const va = JSON.stringify(objA[k]);
    const vb = JSON.stringify(objB[k]);
    if (va !== vb) changed.push(k);
  }
  return { added, removed, changed };
}

class ArchitectureDriftDetector {
  detectDrift(snapshotA, snapshotB) {
    if (!snapshotA || !snapshotB) {
      return { error: 'One or both snapshots are missing', hasDrift: false };
    }

    // Services drift
    const serviceDiff = diffObjects(snapshotA.services ?? {}, snapshotB.services ?? {});
    const serviceChanges = [];
    for (const svc of serviceDiff.changed) {
      const a = snapshotA.services[svc];
      const b = snapshotB.services[svc];
      const changes = [];
      if (a.type !== b.type) changes.push({ field: 'type', before: a.type, after: b.type });
      if (a.status !== b.status) changes.push({ field: 'status', before: a.status, after: b.status });
      if (JSON.stringify(a.dependencies?.internal ?? []) !== JSON.stringify(b.dependencies?.internal ?? [])) {
        const idiff = diffSets(a.dependencies?.internal ?? [], b.dependencies?.internal ?? []);
        changes.push({ field: 'internalDependencies', added: idiff.added, removed: idiff.removed });
      }
      if (changes.length > 0) serviceChanges.push({ service: svc, changes });
    }

    // Dependency drift (high-blast-radius packages)
    const depA = new Map((snapshotA.highBlastRadius ?? []).map(p => [p.package, p.dependentCount]));
    const depB = new Map((snapshotB.highBlastRadius ?? []).map(p => [p.package, p.dependentCount]));
    const newDependencies = [];
    for (const [pkg, count] of depB.entries()) {
      const before = depA.get(pkg) ?? 0;
      if (count > before) newDependencies.push({ package: pkg, before, after: count, delta: count - before });
    }

    // Layer violations drift
    const layerViolationsBefore = snapshotA.layerValidation?.violations ?? [];
    const layerViolationsAfter = snapshotB.layerValidation?.violations ?? [];
    const violationKeysFn = v => `${v.violator}→${v.dependency}`;
    const layerViolationDiff = diffSets(
      layerViolationsBefore.map(violationKeysFn),
      layerViolationsAfter.map(violationKeysFn),
    );
    const newLayerViolations = layerViolationsAfter.filter(v => layerViolationDiff.added.includes(violationKeysFn(v)));
    const resolvedLayerViolations = layerViolationsBefore.filter(v => layerViolationDiff.removed.includes(violationKeysFn(v)));

    // Domain drift
    const domainDiff = diffObjects(snapshotA.domains ?? {}, snapshotB.domains ?? {});
    const domainChanges = [];
    for (const key of domainDiff.changed) {
      const a = snapshotA.domains[key];
      const b = snapshotB.domains[key];
      const diffs = [];
      for (const field of ['tables', 'rpcs', 'routes', 'queues']) {
        const lenA = a[field]?.length ?? 0;
        const lenB = b[field]?.length ?? 0;
        if (lenA !== lenB) diffs.push({ field, before: lenA, after: lenB });
      }
      if (a.money !== b.money) diffs.push({ field: 'money', before: a.money, after: b.money });
      if (diffs.length > 0) domainChanges.push({ domain: key, diffs });
    }

    // Cross-domain edge drift
    const edgeKeyFn = e => `${e.from}→${e.to}`;
    const edgeDiff = diffSets(
      (snapshotA.crossDomainEdges ?? []).map(edgeKeyFn),
      (snapshotB.crossDomainEdges ?? []).map(edgeKeyFn),
    );

    const hasDrift = serviceDiff.added.length > 0 || serviceDiff.removed.length > 0 ||
      serviceChanges.length > 0 || newDependencies.some(d => d.delta > 0) ||
      newLayerViolations.length > 0 || domainDiff.added.length > 0 ||
      domainDiff.removed.length > 0 || domainChanges.length > 0 || edgeDiff.added.length > 0;

    return {
      hasDrift,
      fromSnapshot: snapshotA.capturedAt,
      toSnapshot: snapshotB.capturedAt,
      fromGitHead: snapshotA.gitHead,
      toGitHead: snapshotB.gitHead,
      services: {
        added: serviceDiff.added,
        removed: serviceDiff.removed,
        changed: serviceChanges,
      },
      dependencies: {
        newDependencies: newDependencies.filter(d => d.delta > 0),
        decreasedDependencies: newDependencies.filter(d => d.delta < 0),
      },
      layers: {
        newViolations: newLayerViolations,
        resolvedViolations: resolvedLayerViolations,
        violationCountBefore: layerViolationsBefore.length,
        violationCountAfter: layerViolationsAfter.length,
      },
      domains: {
        added: domainDiff.added,
        removed: domainDiff.removed,
        changed: domainChanges,
        newCrossDomainEdges: edgeDiff.added,
        removedCrossDomainEdges: edgeDiff.removed,
      },
    };
  }

  async detectDriftFromLatest() {
    const snapshotSvc = await getSnapshotService();
    const latest = await snapshotSvc.getLatest();
    const current = await snapshotSvc.capture();
    return {
      drift: this.detectDrift(latest, current),
      current,
    };
  }

  generateDriftReport(drift) {
    if (!drift || drift.error) {
      return { summary: drift?.error ?? 'No drift data', riskLevel: 'unknown', sections: [] };
    }

    const lines = [];
    lines.push(`# Architecture Drift Report`);
    lines.push(`**From:** ${drift.fromSnapshot ?? 'N/A'} (${drift.fromGitHead?.slice(0, 8) ?? '?'})`);
    lines.push(`**To:** ${drift.toSnapshot ?? 'now'} (${drift.toGitHead?.slice(0, 8) ?? '?'})`);
    lines.push(`**Has Drift:** ${drift.hasDrift}`);
    lines.push('');

    // Services
    lines.push('## Services');
    if (drift.services.added.length > 0) lines.push(`- **Added:** ${drift.services.added.join(', ')}`);
    if (drift.services.removed.length > 0) lines.push(`- **Removed:** ${drift.services.removed.join(', ')}`);
    if (drift.services.changed.length > 0) {
      lines.push('- **Changed:**');
      for (const sc of drift.services.changed) {
        lines.push(`  - \`${sc.service}\`: ${sc.changes.map(c => c.field).join(', ')}`);
      }
    }
    if (!drift.services.added.length && !drift.services.removed.length && !drift.services.changed.length) {
      lines.push('_No service changes_');
    }
    lines.push('');

    // Dependencies
    lines.push('## Dependency Changes');
    const newDeps = drift.dependencies?.newDependencies ?? [];
    if (newDeps.length > 0) {
      for (const d of newDeps) lines.push(`- \`${d.package}\` +${d.delta} new dependents (${d.before} → ${d.after})`);
    } else {
      lines.push('_No high-blast-radius dependency changes_');
    }
    lines.push('');

    // Layer violations
    lines.push('## Layer Violations');
    const newViols = drift.layers?.newViolations ?? [];
    const resolvedViols = drift.layers?.resolvedViolations ?? [];
    if (newViols.length > 0) {
      lines.push('**New violations (regressions):**');
      for (const v of newViols) lines.push(`- \`${v.violator}\` (${v.violatorLayer}) → \`${v.dependency}\` (${v.dependencyLayer})`);
    }
    if (resolvedViols.length > 0) {
      lines.push('**Resolved violations:**');
      for (const v of resolvedViols) lines.push(`- \`${v.violator}\` (${v.violatorLayer}) → \`${v.dependency}\` (resolved)`);
    }
    if (!newViols.length && !resolvedViols.length) lines.push('_No layer violation changes_');
    lines.push('');

    // Domains
    lines.push('## Domain Changes');
    if (drift.domains.added.length > 0) lines.push(`- **Added domains:** ${drift.domains.added.join(', ')}`);
    if (drift.domains.removed.length > 0) lines.push(`- **Removed domains:** ${drift.domains.removed.join(', ')}`);
    if (drift.domains.changed.length > 0) {
      lines.push('- **Changed domains:**');
      for (const dc of drift.domains.changed) {
        lines.push(`  - \`${dc.domain}\`: ${dc.diffs.map(d => `${d.field} ${d.before}→${d.after}`).join(', ')}`);
      }
    }
    if (drift.domains.newCrossDomainEdges?.length > 0) {
      lines.push(`- **New cross-domain edges:** ${drift.domains.newCrossDomainEdges.join(', ')}`);
    }
    if (!drift.domains.added.length && !drift.domains.removed.length && !drift.domains.changed.length) {
      lines.push('_No domain changes_');
    }
    lines.push('');

    // Risk level
    const riskLevel = this.#computeDriftRisk(drift);
    lines.push(`## Risk Level: **${riskLevel.toUpperCase()}**`);

    return {
      summary: `Drift detected: ${drift.hasDrift}. Risk: ${riskLevel}.`,
      riskLevel,
      addedServices: drift.services.added,
      removedServices: drift.services.removed,
      newDependencies: newDeps,
      layerViolations: newViols,
      domainChanges: drift.domains.changed,
      markdown: lines.join('\n'),
    };
  }

  #computeDriftRisk(drift) {
    if (!drift.hasDrift) return 'low';
    const factors = [];
    if (drift.services.removed.length > 0) factors.push('critical');
    if ((drift.layers?.newViolations?.length ?? 0) > 0) factors.push('high');
    if (drift.services.added.length > 0) factors.push('medium');
    if ((drift.domains?.newCrossDomainEdges?.length ?? 0) > 0) factors.push('medium');
    if ((drift.dependencies?.newDependencies ?? []).some(d => d.delta >= 3)) factors.push('high');
    if (factors.includes('critical')) return 'critical';
    if (factors.includes('high')) return 'high';
    if (factors.includes('medium')) return 'medium';
    return 'low';
  }

  async getArchitectureRiskReport() {
    const snapshotSvc = await getSnapshotService();
    const snapshot = await snapshotSvc.capture();

    const risks = [];

    // High blast radius packages
    for (const pkg of (snapshot.highBlastRadius ?? [])) {
      if (pkg.blastRadius === 'high') {
        risks.push({
          category: 'blast-radius',
          severity: pkg.dependentCount >= 8 ? 'critical' : 'high',
          subject: pkg.package,
          detail: `${pkg.dependentCount} dependents — any change propagates widely`,
          dependents: pkg.dependents,
        });
      }
    }

    // Layer violations
    for (const v of (snapshot.layerValidation?.violations ?? [])) {
      risks.push({
        category: 'layer-violation',
        severity: 'high',
        subject: v.violator,
        detail: v.rule,
        dependency: v.dependency,
      });
    }

    // Money domains coupling
    for (const md of (snapshot.moneyDomains ?? [])) {
      if (md.riskLevel === 'critical') {
        risks.push({
          category: 'money-domain',
          severity: 'critical',
          subject: md.key,
          detail: `Money domain with ${md.moneyTables.length} money tables and ${md.rpcs.length} RPCs`,
          tables: md.moneyTables,
        });
      }
    }

    // Cross-domain coupling hotspots
    const coupling = snapshot.coupling ?? {};
    for (const d of (coupling.highCouplingDomains ?? [])) {
      risks.push({
        category: 'high-coupling',
        severity: d.totalEdges >= 6 ? 'high' : 'medium',
        subject: d.domain,
        detail: `${d.totalEdges} cross-domain edges (${d.inDegree} in, ${d.outDegree} out)`,
      });
    }

    // New cross-domain coupling from drift
    try {
      const latest = await snapshotSvc.getLatest();
      if (latest) {
        const drift = this.detectDrift(latest, snapshot);
        if ((drift.domains?.newCrossDomainEdges?.length ?? 0) > 0) {
          risks.push({
            category: 'new-coupling',
            severity: 'medium',
            subject: 'cross-domain',
            detail: `${drift.domains.newCrossDomainEdges.length} new cross-domain dependencies since last snapshot`,
            edges: drift.domains.newCrossDomainEdges,
          });
        }
      }
    } catch { /* no prior snapshot */ }

    risks.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

    const overallRisk = risks.some(r => r.severity === 'critical') ? 'critical'
      : risks.some(r => r.severity === 'high') ? 'high'
      : risks.some(r => r.severity === 'medium') ? 'medium'
      : 'low';

    return {
      generatedAt: new Date().toISOString(),
      overallRisk,
      riskCount: risks.length,
      criticalCount: risks.filter(r => r.severity === 'critical').length,
      highCount: risks.filter(r => r.severity === 'high').length,
      risks,
      snapshot: {
        capturedAt: snapshot.capturedAt,
        gitHead: snapshot.gitHead,
        stats: snapshot.stats,
      },
    };
  }
}

export default new ArchitectureDriftDetector();
