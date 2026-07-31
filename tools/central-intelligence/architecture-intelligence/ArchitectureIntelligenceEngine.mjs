/**
 * ArchitectureIntelligenceEngine.mjs — LCIS Architecture Intelligence Facade
 * Single entry point for all architecture intelligence queries.
 * Generates on-demand: Snapshot, Drift Report, Dependency Map, Risk Report, Change Report.
 */

import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lazy imports — loaded on first use to avoid slow startup
let _sd, _dd, _ld, _dom, _snap, _drift;

async function sd() { if (!_sd) { const m = await import('./ServiceDiscovery.mjs'); _sd = m.default; } return _sd; }
async function dd() { if (!_dd) { const m = await import('./DependencyDiscovery.mjs'); _dd = m.default; } return _dd; }
async function ld() { if (!_ld) { const m = await import('./LayerDiscovery.mjs'); _ld = m.default; } return _ld; }
async function dom() { if (!_dom) { const m = await import('./DomainDiscovery.mjs'); _dom = m.default; } return _dom; }
async function snap() { if (!_snap) { const m = await import('./ArchitectureSnapshotService.mjs'); _snap = m.default; } return _snap; }
async function drift() { if (!_drift) { const m = await import('./ArchitectureDriftDetector.mjs'); _drift = m.default; } return _drift; }

class ArchitectureIntelligenceEngine {
  /**
   * getArchitecture() — full current architecture model.
   * Combines all four discovery modules into one unified view.
   */
  async getArchitecture() {
    const [sdInst, ddInst, ldInst, domInst] = await Promise.all([sd(), dd(), ld(), dom()]);

    const [services, dependencies, layers, domains, layerDeps, layerValidation, coupling, moneyDomains, crossDomainEdges, highBlast] = await Promise.all([
      sdInst.discover(),
      ddInst.discover(),
      ldInst.discover(),
      domInst.discover(),
      ldInst.getLayerDependencies(),
      ldInst.validateLayering(),
      domInst.getCoupling(),
      domInst.getMoneyDomains(),
      domInst.getCrossDomainEdges(),
      ddInst.getHighBlastRadius(),
    ]);

    const stats = {
      serviceCount: Object.keys(services).length,
      canonicalRuntimeCount: Object.values(services).filter(s => s.status === 'canonical').length,
      domainCount: Object.keys(domains).length,
      crossDomainEdgeCount: crossDomainEdges.length,
      moneyDomainCount: moneyDomains.length,
      layerViolationCount: layerValidation.violationCount,
      highBlastRadiusPackages: highBlast.filter(p => p.blastRadius === 'high').length,
      dependencyCount: Object.keys(dependencies).length,
    };

    return {
      generatedAt: new Date().toISOString(),
      services,
      dependencies,
      layers,
      layerDependencies: layerDeps,
      layerValidation,
      domains,
      crossDomainEdges,
      moneyDomains,
      coupling,
      highBlastRadius: highBlast.slice(0, 20),
      stats,
    };
  }

  /**
   * whatChanged(sinceSnapshot) — architecture drift since a given snapshot.
   * sinceSnapshot: either a snapshot object or a timestamp string to load from disk.
   */
  async whatChanged(sinceSnapshot) {
    const [snapInst, driftInst] = await Promise.all([snap(), drift()]);

    let baseSnapshot = sinceSnapshot;
    if (typeof sinceSnapshot === 'string') {
      baseSnapshot = await snapInst.get(sinceSnapshot);
    }
    if (!baseSnapshot) {
      baseSnapshot = await snapInst.getLatest();
    }

    const current = await snapInst.capture();
    const driftResult = driftInst.detectDrift(baseSnapshot, current);
    const report = driftInst.generateDriftReport(driftResult);

    return {
      drift: driftResult,
      report,
      current,
    };
  }

  /**
   * whatDependsOn(component) — who depends on this package/service.
   */
  async whatDependsOn(component) {
    const ddInst = await dd();
    const [risk, allDeps] = await Promise.all([
      ddInst.getChangeRisk(component),
      ddInst.discover(),
    ]);

    // Also find transitive dependents (1 hop)
    const directDependents = new Set(risk.dependents);
    const transitiveDependents = new Set();
    for (const dep of directDependents) {
      const shortDep = dep.replace('@letbuyy/', '');
      const transitiveRisk = await ddInst.getChangeRisk(shortDep);
      for (const td of transitiveRisk.dependents) {
        if (!directDependents.has(td)) transitiveDependents.add(td);
      }
    }

    return {
      component,
      ...risk,
      transitiveDependents: [...transitiveDependents],
      totalAffected: directDependents.size + transitiveDependents.size,
      changeImpact: risk.riskLevel === 'critical' ? 'A change here will cascade across the entire monorepo'
        : risk.riskLevel === 'high' ? 'A change here affects many services — coordinate carefully'
        : risk.riskLevel === 'medium' ? 'A change here affects several consumers'
        : 'Limited blast radius — change is relatively safe',
    };
  }

  /**
   * getRisks() — full architecture risk report.
   */
  async getRisks() {
    const driftInst = await drift();
    return driftInst.getArchitectureRiskReport();
  }

  /**
   * getDependencyMap() — full internal dependency graph.
   */
  async getDependencyMap() {
    const ddInst = await dd();
    const [allDeps, highBlast] = await Promise.all([
      ddInst.discover(),
      ddInst.getHighBlastRadius(),
    ]);

    // Build adjacency list
    const adjacency = {};
    for (const [name, info] of Object.entries(allDeps)) {
      adjacency[name] = {
        dependsOn: info.internal,
        dependentCount: info.dependentCount,
        dependents: info.dependents,
        blastRadius: info.dependentCount >= 5 ? 'high' : info.dependentCount >= 2 ? 'medium' : 'low',
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      packageCount: Object.keys(allDeps).length,
      highBlastRadiusPackages: highBlast.slice(0, 10),
      adjacency,
    };
  }

  /**
   * getEvolution() — architecture evolution across all saved snapshots.
   */
  async getEvolution() {
    const [snapInst, driftInst, domInst] = await Promise.all([snap(), drift(), dom()]);
    const [snapshots, domainEvolution] = await Promise.all([
      snapInst.list(),
      domInst.getDomainEvolution(),
    ]);

    if (snapshots.length < 2) {
      return {
        available: snapshots.length > 0,
        snapshotCount: snapshots.length,
        domainEvolution,
        message: snapshots.length === 0
          ? 'No snapshots found. Run capture() to start tracking.'
          : 'Only one snapshot. Need at least two to compute evolution.',
        snapshots,
      };
    }

    // Compare first vs latest
    const [earliest, latestMeta] = [snapshots[snapshots.length - 1], snapshots[0]];
    const [earliestSnap, latestSnap] = await Promise.all([
      snapInst.get(earliest.filename),
      snapInst.get(latestMeta.filename),
    ]);

    const longRangeDrift = driftInst.detectDrift(earliestSnap, latestSnap);
    const longRangeReport = driftInst.generateDriftReport(longRangeDrift);

    return {
      available: true,
      snapshotCount: snapshots.length,
      earliest: earliest.filename,
      latest: latestMeta.filename,
      snapshots,
      longRangeDrift,
      longRangeReport,
      domainEvolution,
    };
  }

  /**
   * getHealth() — overall architecture health summary.
   */
  async getHealth() {
    const [sdInst, ldInst, ddInst, domInst] = await Promise.all([sd(), ld(), dd(), dom()]);
    const [services, layerValidation, highBlast, coupling] = await Promise.all([
      sdInst.discover(),
      ldInst.validateLayering(),
      ddInst.getHighBlastRadius(),
      domInst.getCoupling(),
    ]);

    const canonicals = sdInst.getCanonicalRuntimes();
    const presentCanonicals = canonicals.filter(r => services[r]);
    const missingCanonicals = canonicals.filter(r => !services[r]);

    const criticalBlast = highBlast.filter(p => p.dependentCount >= 8);
    const violations = layerValidation.violations ?? [];

    const score = Math.max(0, 100
      - (missingCanonicals.length * 15)
      - (violations.length * 10)
      - (criticalBlast.length * 5)
      - (coupling.highCouplingDomains?.length ?? 0) * 3);

    const status = score >= 85 ? 'HEALTHY' : score >= 65 ? 'DEGRADED' : 'AT_RISK';

    return {
      generatedAt: new Date().toISOString(),
      status,
      score,
      canonicalRuntimes: {
        expected: canonicals.length,
        present: presentCanonicals.length,
        missing: missingCanonicals,
      },
      layerViolations: violations.length,
      criticalBlastRadiusPackages: criticalBlast.length,
      domainCoupling: {
        density: coupling.density,
        highCouplingDomains: (coupling.highCouplingDomains ?? []).map(d => d.domain),
      },
      findings: [
        ...missingCanonicals.map(r => ({ severity: 'critical', finding: `Canonical runtime '${r}' has no package.json` })),
        ...violations.map(v => ({ severity: 'high', finding: `Layer violation: ${v.violator} (${v.violatorLayer}) imports ${v.dependency} (${v.dependencyLayer})` })),
        ...criticalBlast.map(p => ({ severity: 'high', finding: `Critical blast radius: ${p.package} has ${p.dependentCount} dependents` })),
      ],
    };
  }
}

export default new ArchitectureIntelligenceEngine();
