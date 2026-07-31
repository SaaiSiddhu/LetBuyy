/**
 * LCIS V2 Reasoning Engine — DependencyReasoner
 *
 * Reasons about dependency risk: blast radius, transitive impact, change risk,
 * critical paths, and highest-risk dependency identification.
 *
 * Uses RepositoryGraphBuilder (code graph) + ArchitectureIntelligenceEngine
 * + V1 /api/blast for cross-domain impact. All sources optional.
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

// Lazy-load heavy modules to avoid startup cost
let _graphBuilder = null;
let _archEngine = null;

async function graphBuilder() {
  if (!_graphBuilder) {
    const m = await import('../context-intelligence/RepositoryGraphBuilder.mjs');
    _graphBuilder = m.default;
  }
  return _graphBuilder;
}

async function archEngine() {
  if (!_archEngine) {
    const m = await import('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
    _archEngine = m.default;
  }
  return _archEngine;
}

/** Known high-blast-radius hotspots from CLAUDE.md + prior audits */
const KNOWN_HOTSPOTS = [
  { name: 'getSupabaseAdmin', fileCount: 115, type: 'function', risk: 'CRITICAL' },
  { name: '@letbuyy/shared-types', fileCount: 80, type: 'package', risk: 'CRITICAL' },
  { name: '@letbuyy/api-client', fileCount: 60, type: 'package', risk: 'HIGH' },
  { name: 'create_checkout_order', fileCount: 40, type: 'rpc', risk: 'CRITICAL' },
];

/** Weight a dependency by money/tenant proximity */
function weightDependency(name, dependentCount) {
  let w = Math.min(0.95, 0.3 + dependentCount * 0.01);
  if (/payment|checkout|order|ledger|rpc/i.test(name)) w = Math.min(0.99, w + 0.2);
  if (/supabase|admin|tenant|site_id/i.test(name)) w = Math.min(0.99, w + 0.15);
  return w;
}

class DependencyReasoner {
  /**
   * Reason about a component's dependency posture.
   * @param {string} component
   * @returns {Promise<ReasoningResult>}
   */
  async reason(component) {
    const question = `What are the dependency risks for "${component}"?`;
    const evidence = [];
    const reasoningChain = [];

    const [gb, ae, blastData, crossData] = await Promise.allSettled([
      graphBuilder(),
      archEngine(),
      fetchV1(`/api/blast?q=${encodeURIComponent(component)}`),
      fetchV1(`/api/cross-domain?key=${encodeURIComponent(component)}`),
    ]);

    const gb_ = gb.status === 'fulfilled' ? gb.value : null;
    const ae_ = ae.status === 'fulfilled' ? ae.value : null;
    const blast = blastData.status === 'fulfilled' ? blastData.value : null;
    const cross = crossData.status === 'fulfilled' ? crossData.value : null;

    // Step 1: code-graph dependents
    reasoningChain.push(`1. Load code graph and find all dependents of "${component}".`);
    let dependents = [];
    if (gb_) {
      try {
        gb_.load();
        dependents = gb_.getFileDependents(component) ?? [];
        evidence.push({ source: 'code-graph', fact: `"${component}" has ${dependents.length} direct file-level dependents.`, weight: 0.85 });
      } catch {
        evidence.push({ source: 'code-graph', fact: `Code graph not loaded — run "pnpm graph:update" to populate graphify-out/graph.json.`, weight: 0.1 });
      }
    } else {
      evidence.push({ source: 'code-graph', fact: `RepositoryGraphBuilder unavailable — graph data inaccessible.`, weight: 0.05 });
    }

    // Step 2: blast radius from V1
    reasoningChain.push(`2. Query V1 blast-radius API for cross-domain impact of "${component}".`);
    if (blast?.affected?.length) {
      evidence.push({ source: 'v1-blast-api', fact: `Blast radius: ${blast.affected.length} components affected: ${blast.affected.slice(0, 5).join(', ')}.`, weight: 0.82 });
    } else {
      evidence.push({ source: 'v1-blast-api', fact: `V1 /api/blast returned no data. Is LCIS running at ${V1_BASE}?`, weight: 0.05 });
    }

    // Step 3: architecture risks
    reasoningChain.push(`3. Assess architecture risks via ArchitectureIntelligenceEngine.`);
    if (ae_) {
      try {
        const risks = await ae_.getRisks();
        const relevant = risks?.violations?.filter(v => v.violator?.includes(component) || v.dependency?.includes(component)) ?? [];
        if (relevant.length) {
          evidence.push({ source: 'architecture-engine', fact: `Layer violations involving "${component}": ${relevant.slice(0, 3).map(v => `${v.violator} → ${v.dependency}`).join('; ')}`, weight: 0.75 });
        } else {
          evidence.push({ source: 'architecture-engine', fact: `No architecture layer violations found for "${component}" in current snapshot.`, weight: 0.45 });
        }
      } catch {
        evidence.push({ source: 'architecture-engine', fact: `Architecture risk query failed — snapshot may be stale.`, weight: 0.1 });
      }
    }

    // Step 4: cross-domain consumers
    reasoningChain.push(`4. Identify which domains consume "${component}" (propagation risk).`);
    if (cross?.consumedBy?.length) {
      evidence.push({ source: 'cross-domain-graph', fact: `"${component}" is consumed by domains: ${cross.consumedBy.slice(0, 5).join(', ')}.`, weight: 0.78 });
    } else {
      evidence.push({ source: 'cross-domain-graph', fact: `Cross-domain consumption data unavailable — cannot confirm propagation paths.`, weight: 0.1 });
    }

    const highCount = evidence.filter(e => e.weight >= 0.7).length;
    const confidence = highCount >= 3 ? 'HIGH' : highCount >= 2 ? 'MEDIUM' : 'LOW';

    const blastCount = blast?.affected?.length ?? dependents.length;
    const hypothesis = blastCount > 10
      ? `"${component}" is a high-blast-radius node — changes will ripple through ${blastCount}+ components. Treat as CRITICAL change-control.`
      : `"${component}" has moderate dependency exposure. Verify cross-domain consumers before merging.`;

    return {
      question,
      hypothesis,
      evidence,
      confidence,
      mostLikelyAffected: (blast?.affected ?? []).slice(0, 8),
      recommendedInvestigation: [
        `Run \`pnpm graph:intel blast "${component}"\` for full blast radius.`,
        `Check consumers: \`curl ${V1_BASE}/api/blast?q=${encodeURIComponent(component)}\`.`,
        `Review cross-domain edges: \`curl ${V1_BASE}/api/cross-domain?key=${encodeURIComponent(component)}\`.`,
        `Run architecture risk scan: \`pnpm graph:omega\`.`,
      ],
      reasoningChain,
    };
  }

  /**
   * Return highest-risk dependencies ranked by blast radius × money/tenant weight.
   * Always returns data — falls back to KNOWN_HOTSPOTS if graph is unavailable.
   * @returns {Promise<Array<{ name: string, risk: string, weight: number, reason: string }>>}
   */
  async getHighestRiskDependencies() {
    const [gbRes, aeRes, blastData] = await Promise.allSettled([
      graphBuilder(),
      archEngine(),
      fetchV1('/api/critical'),
    ]);

    const gb_ = gbRes.status === 'fulfilled' ? gbRes.value : null;
    const ae_ = aeRes.status === 'fulfilled' ? aeRes.value : null;
    const critical = blastData.status === 'fulfilled' ? blastData.value : null;

    const results = [];

    // From KNOWN_HOTSPOTS baseline (always reliable)
    for (const h of KNOWN_HOTSPOTS) {
      results.push({
        name: h.name,
        risk: h.risk,
        weight: weightDependency(h.name, h.fileCount),
        reason: `Known high-blast-radius node: ${h.fileCount} files depend on it (CLAUDE.md change-control hotspot).`,
      });
    }

    // Augment from live architecture engine
    if (ae_) {
      try {
        const depMap = await ae_.getDependencyMap();
        for (const [name, info] of Object.entries(depMap?.adjacency ?? {})) {
          const count = (info?.dependents?.length ?? 0) + (info?.dependencies?.length ?? 0);
          if (count >= 10 && !results.find(r => r.name === name)) {
            results.push({
              name,
              risk: count >= 30 ? 'CRITICAL' : count >= 15 ? 'HIGH' : 'MEDIUM',
              weight: weightDependency(name, count),
              reason: `${count} dependency edges in architecture graph.`,
            });
          }
        }
      } catch { /* architecture engine optional */ }
    }

    // Augment from code graph
    if (gb_) {
      try {
        gb_.load();
        const stats = gb_.getStats();
        if (stats?.topFiles?.length) {
          for (const f of stats.topFiles.slice(0, 5)) {
            const name = f.file ?? f.path ?? f.name ?? '';
            if (name && !results.find(r => r.name === name)) {
              results.push({
                name,
                risk: 'HIGH',
                weight: weightDependency(name, f.dependentCount ?? 10),
                reason: `Top file by structural importance in code graph (${f.dependentCount ?? '?'} dependents).`,
              });
            }
          }
        }
      } catch { /* graph optional */ }
    }

    // Augment from V1 critical endpoint
    if (critical?.critical?.length) {
      for (const c of critical.critical.slice(0, 5)) {
        const name = c.name ?? c.component ?? c.domain ?? '';
        if (name && !results.find(r => r.name === name)) {
          results.push({
            name,
            risk: 'CRITICAL',
            weight: 0.92,
            reason: `Flagged as critical by LCIS /api/critical.`,
          });
        }
      }
    }

    return results.sort((a, b) => b.weight - a.weight).slice(0, 10);
  }

  /**
   * Transitive impact analysis — what breaks if this component changes?
   * @param {string} component
   * @returns {Promise<ReasoningResult>}
   */
  async whatBreaksIf(component) {
    const question = `What breaks if "${component}" changes?`;
    const evidence = [];
    const reasoningChain = [];

    const [blastData, crossData, archData] = await Promise.allSettled([
      fetchV1(`/api/blast?q=${encodeURIComponent(component)}`),
      fetchV1(`/api/cross-domain?key=${encodeURIComponent(component)}`),
      fetchV1(`/api/change-impact?key=${encodeURIComponent(component)}`),
    ]);

    const blast = blastData.status === 'fulfilled' ? blastData.value : null;
    const cross = crossData.status === 'fulfilled' ? crossData.value : null;
    const changeImpact = archData.status === 'fulfilled' ? archData.value : null;

    reasoningChain.push(`1. Query blast radius for "${component}" to find direct dependents.`);
    reasoningChain.push(`2. Traverse cross-domain graph for cascading failures.`);
    reasoningChain.push(`3. Assess change-impact scores (APIs/tables/workers/queues/domains).`);

    if (blast?.affected?.length) {
      evidence.push({ source: 'blast-api', fact: `${blast.affected.length} components directly affected: ${blast.affected.slice(0, 5).join(', ')}`, weight: 0.88 });
    } else {
      evidence.push({ source: 'blast-api', fact: `No blast radius data — cannot enumerate direct breakage.`, weight: 0.05 });
    }

    if (cross?.consumedBy?.length) {
      evidence.push({ source: 'cross-domain-graph', fact: `Downstream domains that will break: ${cross.consumedBy.slice(0, 5).join(', ')}`, weight: 0.82 });
    }

    if (changeImpact) {
      const keys = Object.keys(changeImpact).filter(k => k !== 'component').slice(0, 4);
      evidence.push({ source: 'change-impact-api', fact: `Change-impact dimensions: ${keys.map(k => `${k}=${JSON.stringify(changeImpact[k]).slice(0, 40)}`).join('; ')}`, weight: 0.78 });
    } else {
      evidence.push({ source: 'change-impact-api', fact: `Change-impact API NOT CONNECTED at ${V1_BASE}/api/change-impact.`, weight: 0.05 });
    }

    // Known hotspot check
    const hotspot = KNOWN_HOTSPOTS.find(h => component.includes(h.name) || h.name.includes(component));
    if (hotspot) {
      evidence.push({ source: 'known-hotspots', fact: `"${component}" is a documented CLAUDE.md change-control hotspot (${hotspot.fileCount} files). ARB approval required before merge.`, weight: 0.95 });
    }

    const highCount = evidence.filter(e => e.weight >= 0.7).length;
    const confidence = highCount >= 3 ? 'HIGH' : highCount >= 1 ? 'MEDIUM' : 'LOW';

    const affected = [...new Set([...(blast?.affected ?? []), ...(cross?.consumedBy ?? [])])].slice(0, 8);

    return {
      question,
      hypothesis: affected.length > 5
        ? `Changing "${component}" creates a HIGH-impact cascade affecting ${affected.length}+ components across multiple domains.`
        : `Changing "${component}" has contained impact — verify affected list before merge.`,
      evidence,
      confidence,
      mostLikelyAffected: affected,
      recommendedInvestigation: [
        `1. Run full blast: \`pnpm graph:intel blast "${component}"\`.`,
        `2. Gate with: \`node scripts/validate-governance.mjs\`.`,
        `3. If hotspot: request ARB review before merging.`,
        `4. Run \`pnpm --filter <affected-app> build\` for each affected app.`,
      ],
      reasoningChain,
    };
  }

  /**
   * Find the critical (longest/highest-risk) path between two components.
   * @param {string} from
   * @param {string} to
   * @returns {Promise<{ path: string[], risk: string, reason: string }>}
   */
  async getCriticalPath(from, to) {
    const [pathData] = await Promise.allSettled([
      fetchV1(`/api/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    ]);

    if (pathData.status === 'fulfilled' && pathData.value?.path?.length) {
      const p = pathData.value;
      return {
        path: p.path,
        risk: p.risk ?? (p.path.length > 5 ? 'HIGH' : 'MEDIUM'),
        reason: `Critical path from "${from}" to "${to}" traverses ${p.path.length} nodes.`,
      };
    }

    return {
      path: [from, '...', to],
      risk: 'UNKNOWN',
      reason: `Path data NOT CONNECTED — V1 /api/path not available or graph not built. Run pnpm graph:omega.`,
    };
  }

  /**
   * Assess risk of changing a component before a deploy.
   * @param {string} component
   * @returns {Promise<{ risk: string, score: number, blockers: string[], recommendation: string }>}
   */
  async assessChangeRisk(component) {
    const [impactData, blastData] = await Promise.allSettled([
      fetchV1(`/api/change-impact?key=${encodeURIComponent(component)}`),
      fetchV1(`/api/blast?q=${encodeURIComponent(component)}`),
    ]);

    const impact = impactData.status === 'fulfilled' ? impactData.value : null;
    const blast = blastData.status === 'fulfilled' ? blastData.value : null;

    const hotspot = KNOWN_HOTSPOTS.find(h => component.includes(h.name) || h.name.includes(component));
    const blastCount = blast?.affected?.length ?? 0;
    const isMoneyPath = /payment|checkout|order|ledger|rpc/i.test(component);
    const isTenantPath = /supabase|admin|tenant|site_id/i.test(component);

    let score = 0.3;
    const blockers = [];

    if (hotspot) { score += 0.4; blockers.push(`Known CLAUDE.md hotspot — ARB required`); }
    if (blastCount > 20) { score += 0.25; blockers.push(`Blast radius > 20 components (${blastCount})`); }
    if (isMoneyPath) { score += 0.2; blockers.push(`Money/payment critical path — requires security review`); }
    if (isTenantPath) { score += 0.15; blockers.push(`Tenant/RLS boundary — cross-tenant risk`); }
    if (impact?.domains?.length > 3) { score += 0.1; blockers.push(`Crosses ${impact.domains.length} domains`); }

    score = Math.min(1.0, score);
    const risk = score >= 0.8 ? 'CRITICAL' : score >= 0.6 ? 'HIGH' : score >= 0.4 ? 'MEDIUM' : 'LOW';

    return {
      risk,
      score: Math.round(score * 100) / 100,
      blockers,
      recommendation: risk === 'CRITICAL'
        ? `BLOCK: Do not merge without ARB sign-off, security review, and full integration test pass.`
        : risk === 'HIGH'
        ? `CAUTION: Run validate-governance.mjs, pnpm build affected apps, and get peer review.`
        : `PROCEED: Standard PR review sufficient. Run validate-governance.mjs.`,
    };
  }
}

export default new DependencyReasoner();
