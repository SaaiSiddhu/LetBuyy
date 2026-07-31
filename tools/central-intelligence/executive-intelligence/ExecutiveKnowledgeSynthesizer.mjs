/**
 * LCIS V3 Phase 20 — ExecutiveKnowledgeSynthesizer
 *
 * Unifies memory + context + self-model + reasoning into executive briefings.
 * Knows how to synthesise for specific roles (CTO, SRE, Security, Operations,
 * Leadership) and for specific incidents.
 *
 * Returns:
 *   {
 *     topic, synthesis, keyFindings, sources, confidence,
 *     notConnected: [...exact sources still dark]
 *   }
 *
 * Honesty contract: live values NOT CONNECTED + exact source. No fabrications.
 *
 * @module ExecutiveKnowledgeSynthesizer
 */

/**
 * @typedef {{
 *   topic: string,
 *   synthesis: string,
 *   keyFindings: string[],
 *   sources: string[],
 *   confidence: 'HIGH'|'MEDIUM'|'LOW',
 *   notConnected: string[]
 * }} KnowledgeSynthesis
 */

// ── Lazy primitive loaders ────────────────────────────────────────────────────

async function getMemoryRetriever() {
  try {
    const m = await import('../memory-engine/MemoryRetriever.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getContextAssembler() {
  try {
    const m = await import('../context-intelligence/ContextAssembler.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getPlatformExplainer() {
  try {
    const m = await import('../self-model/PlatformExplainer.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getReasoningEngine() {
  try {
    const m = await import('../reasoning/ReasoningEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getArchEngine() {
  try {
    const m = await import('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── V1 LCIS fetch helper ─────────────────────────────────────────────────────

async function fetchV1(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`http://localhost:3333${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Role → V1 endpoint map ────────────────────────────────────────────────────

const ROLE_ENDPOINTS = {
  cto: ['/api/production-readiness-v2', '/api/architecture', '/api/decision-engine'],
  sre: ['/api/runtime-intelligence', '/api/operations', '/api/runbook'],
  security: ['/api/security-intelligence', '/api/audit', '/api/security'],
  operations: ['/api/observability', '/api/ai-ops', '/api/execution'],
  leadership: ['/api/executive-center', '/api/launch-command-center', '/api/founder'],
};

// ── Synthesis cache ───────────────────────────────────────────────────────────

const _cache = new Map();
const CACHE_TTL = 90_000; // 1.5 min

function getCached(key) {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.value;
  return null;
}

function setCached(key, value) {
  _cache.set(key, { value, ts: Date.now() });
}

// ── Extract key findings from a V1 API response ───────────────────────────────

function extractFindings(data, source) {
  if (!data) return [];
  const fields = ['findings', 'keyFindings', 'blockers', 'recommendations', 'risks', 'anomalies', 'results'];
  for (const f of fields) {
    if (Array.isArray(data[f]) && data[f].length > 0) {
      return data[f].slice(0, 4).map(item => ({
        source,
        fact: String(item.description ?? item.finding ?? item.action ?? item.recommendation ?? item).slice(0, 200),
      }));
    }
  }
  // fallback: try top-level string fields
  const textFields = ['summary', 'conclusion', 'synthesis', 'status', 'verdict'];
  for (const f of textFields) {
    if (typeof data[f] === 'string' && data[f].length > 5) {
      return [{ source, fact: data[f].slice(0, 200) }];
    }
  }
  return [];
}

// ── Main class ────────────────────────────────────────────────────────────────

class ExecutiveKnowledgeSynthesizer {
  /**
   * Pull from memory + context + self-model + reasoning → unified executive briefing.
   * @param {string} topic
   * @returns {Promise<KnowledgeSynthesis>}
   */
  async synthesize(topic) {
    const cached = getCached(`topic:${topic}`);
    if (cached) return cached;

    const notConnected = [];
    const sources = [];
    const keyFindings = [];

    const [memRetriever, contextAssembler, platformExplainer, reasoningEng] = await Promise.allSettled([
      getMemoryRetriever(),
      getContextAssembler(),
      getPlatformExplainer(),
      getReasoningEngine(),
    ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

    const paragraphs = [];

    // Memory recall
    if (memRetriever?.retrieve) {
      try {
        const hits = await memRetriever.retrieve(topic, { limit: 5 });
        const arr = Array.isArray(hits) ? hits : (hits?.results ?? []);
        if (arr.length > 0) {
          sources.push('MemoryRetriever');
          arr.slice(0, 3).forEach(h => {
            const fact = String(h.content ?? h.text ?? h.fact ?? '').trim();
            if (fact) keyFindings.push(fact.slice(0, 150));
          });
          paragraphs.push(`Memory recall: ${arr.length} relevant record(s) found for "${topic}".`);
        } else {
          notConnected.push('MemoryRetriever: no records for this topic (Qdrant may not be running — start: cd tools/central-intelligence && bash setup.sh)');
        }
      } catch {
        notConnected.push('MemoryRetriever: exception during retrieval (check Qdrant at QDRANT_URL)');
      }
    } else {
      notConnected.push('MemoryRetriever: primitive not loaded');
    }

    // Context assembler
    if (contextAssembler?.assemble) {
      try {
        const ctx = await contextAssembler.assemble(topic, { budget: 2000 });
        if (ctx?.summary || ctx?.context) {
          sources.push('ContextAssembler');
          const summary = ctx.summary ?? ctx.context ?? '';
          if (summary) {
            keyFindings.push(summary.slice(0, 200));
            paragraphs.push(`Context: ${summary.slice(0, 300)}`);
          }
        }
      } catch {
        notConnected.push('ContextAssembler: exception during assembly');
      }
    } else {
      notConnected.push('ContextAssembler: primitive not loaded');
    }

    // Self-model / platform explainer
    if (platformExplainer) {
      const explainMethod = platformExplainer.explain ?? platformExplainer.explainPlatform ?? platformExplainer.getSelfModel;
      if (typeof explainMethod === 'function') {
        try {
          const selfModel = await explainMethod.call(platformExplainer, topic);
          if (selfModel) {
            sources.push('PlatformExplainer');
            const text = String(selfModel.summary ?? selfModel.description ?? selfModel).slice(0, 300);
            if (text && text !== '[object Object]') {
              keyFindings.push(`Platform model: ${text.slice(0, 150)}`);
              paragraphs.push(`Self-model: ${text}`);
            }
          }
        } catch {
          notConnected.push('PlatformExplainer: exception during self-model retrieval');
        }
      }
    } else {
      notConnected.push('PlatformExplainer: primitive not loaded');
    }

    // Reasoning engine
    if (reasoningEng?.reason) {
      try {
        const rr = await reasoningEng.reason(topic);
        if (rr?.hypothesis) {
          sources.push('ReasoningEngine');
          keyFindings.push(`Reasoning hypothesis: ${rr.hypothesis.slice(0, 150)}`);
          paragraphs.push(`Reasoning: ${rr.hypothesis}`);
          (rr.evidence ?? []).slice(0, 2).forEach(e =>
            keyFindings.push(String(e.fact ?? e).slice(0, 100))
          );
        }
      } catch {
        notConnected.push('ReasoningEngine: exception during reasoning');
      }
    } else {
      notConnected.push('ReasoningEngine: primitive not loaded');
    }

    // V1 LCIS semantic search
    const v1Search = await fetchV1(`/api/search?q=${encodeURIComponent(topic.slice(0, 100))}`);
    if (v1Search) {
      sources.push('V1LCIS:/api/search');
      const results = v1Search.results ?? v1Search.matches ?? [];
      results.slice(0, 3).forEach(r => {
        const fact = String(r.description ?? r.summary ?? r.content ?? r).slice(0, 150);
        if (fact) keyFindings.push(fact);
      });
    } else {
      notConnected.push('V1LCIS:/api/search (start: cd tools/graph-server && node server.mjs)');
    }

    const synthesis = paragraphs.length > 0
      ? paragraphs.join(' ')
      : `No connected sources could synthesise information about "${topic}". Start V1 LCIS (:3333) and V2 (:3334) for full synthesis.`;

    const result = {
      topic,
      synthesis,
      keyFindings: [...new Set(keyFindings)].slice(0, 10),
      sources: [...new Set(sources)],
      confidence: sources.length >= 3 ? 'HIGH' : sources.length >= 1 ? 'MEDIUM' : 'LOW',
      notConnected,
    };

    setCached(`topic:${topic}`, result);
    return result;
  }

  /**
   * Whole-platform synthesis — health, readiness, risks, actions.
   * @returns {Promise<KnowledgeSynthesis>}
   */
  async synthesizePlatformState() {
    const cached = getCached('platform_state');
    if (cached) return cached;

    const [v1Health, v1Readiness, v1Executive, v1AiOps] = await Promise.allSettled([
      fetchV1('/api/production-health'),
      fetchV1('/api/production-readiness-v2'),
      fetchV1('/api/executive-center'),
      fetchV1('/api/ai-ops'),
    ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

    const keyFindings = [];
    const sources = [];
    const notConnected = [];
    const paragraphs = [];

    if (v1Health) {
      sources.push('V1LCIS:/api/production-health');
      const status = v1Health.status ?? v1Health.overall ?? 'UNKNOWN';
      const color = v1Health.color ?? '';
      paragraphs.push(`Production health: ${status} ${color}`.trim());
      extractFindings(v1Health, 'V1LCIS:/api/production-health').forEach(f => keyFindings.push(f.fact));
    } else {
      notConnected.push('V1LCIS:/api/production-health (source: pnpm graph:omega)');
    }

    if (v1Readiness) {
      sources.push('V1LCIS:/api/production-readiness-v2');
      const pct = v1Readiness.structuralPercent ?? v1Readiness.overallPercent ?? 0;
      const verdict = v1Readiness.verdict ?? v1Readiness.launchVerdict ?? '';
      paragraphs.push(`Structural readiness: ${pct}%. Launch verdict: ${verdict}`);
      extractFindings(v1Readiness, 'V1LCIS:/api/production-readiness-v2').forEach(f => keyFindings.push(f.fact));
    } else {
      notConnected.push('V1LCIS:/api/production-readiness-v2 (source: pnpm graph:v5)');
    }

    if (v1Executive) {
      sources.push('V1LCIS:/api/executive-center');
      extractFindings(v1Executive, 'V1LCIS:/api/executive-center').forEach(f => keyFindings.push(f.fact));
    } else {
      notConnected.push('V1LCIS:/api/executive-center (source: pnpm graph:omega)');
    }

    if (v1AiOps) {
      sources.push('V1LCIS:/api/ai-ops');
      const topActions = (v1AiOps.rankedActions ?? v1AiOps.recommendations ?? []).slice(0, 3);
      topActions.forEach(a => keyFindings.push(`AI-Ops: ${String(a.action ?? a.recommendation ?? a).slice(0, 120)}`));
    } else {
      notConnected.push('V1LCIS:/api/ai-ops (source: pnpm graph:omega)');
    }

    // Arch engine for structural risks
    const archEng = await getArchEngine();
    if (archEng?.getRisks) {
      try {
        const risks = await archEng.getRisks();
        const arr = Array.isArray(risks) ? risks : (risks?.risks ?? []);
        arr.slice(0, 3).forEach(r => {
          keyFindings.push(`Arch risk: ${String(r.description ?? r.risk ?? r).slice(0, 120)}`);
        });
        if (arr.length) sources.push('ArchitectureIntelligenceEngine');
      } catch { /* degrade */ }
    }

    const synthesis = paragraphs.length > 0
      ? paragraphs.join('. ')
      : 'Platform state synthesis requires V1 LCIS at :3333. Start with: cd tools/graph-server && node server.mjs';

    const result = {
      topic: 'platform_state',
      synthesis,
      keyFindings: [...new Set(keyFindings)].slice(0, 12),
      sources: [...new Set(sources)],
      confidence: sources.length >= 3 ? 'HIGH' : sources.length >= 1 ? 'MEDIUM' : 'LOW',
      notConnected,
    };

    setCached('platform_state', result);
    return result;
  }

  /**
   * Role-specific synthesis. Role = 'cto'|'sre'|'security'|'operations'|'leadership'.
   * @param {'cto'|'sre'|'security'|'operations'|'leadership'} role
   * @returns {Promise<KnowledgeSynthesis>}
   */
  async synthesizeForRole(role) {
    const cached = getCached(`role:${role}`);
    if (cached) return cached;

    const endpoints = ROLE_ENDPOINTS[role] ?? ROLE_ENDPOINTS.leadership;
    const notConnected = [];
    const keyFindings = [];
    const sources = [];
    const paragraphs = [];

    const results = await Promise.allSettled(
      endpoints.map(ep => fetchV1(ep))
    ).then(rs => rs.map((r, i) => ({ ep: endpoints[i], data: r.status === 'fulfilled' ? r.value : null })));

    for (const { ep, data } of results) {
      if (data) {
        sources.push(`V1LCIS:${ep}`);
        const findings = extractFindings(data, `V1LCIS:${ep}`);
        findings.forEach(f => keyFindings.push(f.fact));
        if (findings[0]) paragraphs.push(findings[0].fact);
      } else {
        notConnected.push(`V1LCIS:${ep} — NOT CONNECTED (source: pnpm graph:omega, start: node tools/graph-server/server.mjs)`);
      }
    }

    // Role-specific memory recall
    const memRetriever = await getMemoryRetriever();
    if (memRetriever?.retrieve) {
      const roleQueries = {
        cto: 'architecture risks readiness',
        sre: 'operations incidents runbooks',
        security: 'security vulnerabilities auth rls',
        operations: 'observability queue workers',
        leadership: 'launch readiness revenue merchants',
      };
      try {
        const hits = await memRetriever.retrieve(roleQueries[role] ?? role, { limit: 3 });
        const arr = Array.isArray(hits) ? hits : (hits?.results ?? []);
        arr.forEach(h => {
          const fact = String(h.content ?? h.text ?? h.fact ?? '').slice(0, 150);
          if (fact) keyFindings.push(`[Memory] ${fact}`);
        });
        if (arr.length) sources.push('MemoryRetriever');
      } catch { /* degrade */ }
    }

    const synthesis = paragraphs.length > 0
      ? `${role.toUpperCase()} briefing: ${paragraphs.join('. ')}`
      : `No connected sources for ${role} briefing. ${notConnected[0] ?? ''}`;

    const result = {
      topic: `role:${role}`,
      synthesis,
      keyFindings: [...new Set(keyFindings)].slice(0, 10),
      sources: [...new Set(sources)],
      confidence: sources.length >= 2 ? 'HIGH' : sources.length >= 1 ? 'MEDIUM' : 'LOW',
      notConnected,
    };

    setCached(`role:${role}`, result);
    return result;
  }

  /**
   * Synthesise context for a specific incident.
   * @param {{ domain?: string, description?: string, error?: string }} incident
   * @returns {Promise<KnowledgeSynthesis>}
   */
  async synthesizeIncident(incident) {
    const domain = incident?.domain ?? 'unknown';
    const description = incident?.description ?? incident?.error ?? `incident in ${domain}`;

    const [v1Investigate, v1RootCause, v1Runbook, reasoningEng] = await Promise.allSettled([
      fetchV1(`/api/investigate?q=${encodeURIComponent(description.slice(0, 100))}`),
      fetchV1(`/api/root-cause?domain=${encodeURIComponent(domain)}`),
      fetchV1(`/api/runbook?domain=${encodeURIComponent(domain)}`),
      getReasoningEngine(),
    ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

    const notConnected = [];
    const keyFindings = [];
    const sources = [];
    const paragraphs = [];

    if (v1Investigate) {
      sources.push('V1LCIS:/api/investigate');
      extractFindings(v1Investigate, 'V1LCIS:/api/investigate').forEach(f => {
        keyFindings.push(f.fact);
        paragraphs.push(f.fact);
      });
    } else {
      notConnected.push('V1LCIS:/api/investigate — NOT CONNECTED (source: pnpm graph:omega)');
    }

    if (v1RootCause) {
      sources.push('V1LCIS:/api/root-cause');
      const candidates = v1RootCause.candidates ?? v1RootCause.rootCauses ?? [];
      candidates.slice(0, 3).forEach(c =>
        keyFindings.push(`Root cause candidate: ${String(c.candidate ?? c.description ?? c).slice(0, 120)}`)
      );
    } else {
      notConnected.push(`V1LCIS:/api/root-cause?domain=${domain} — NOT CONNECTED (source: pnpm graph:omega)`);
    }

    if (v1Runbook) {
      sources.push('V1LCIS:/api/runbook');
      const steps = v1Runbook.steps ?? v1Runbook.recovery ?? [];
      steps.slice(0, 3).forEach(s =>
        keyFindings.push(`Runbook: ${String(s.action ?? s.step ?? s).slice(0, 120)}`)
      );
    } else {
      notConnected.push(`V1LCIS:/api/runbook?domain=${domain} — NOT CONNECTED (source: pnpm graph:omega)`);
    }

    // Reasoning about the incident
    if (reasoningEng?.whyDidThisHappen) {
      try {
        const rr = await reasoningEng.whyDidThisHappen(description);
        if (rr) {
          sources.push('ReasoningEngine');
          const hyp = rr.hypothesis ?? rr.conclusion ?? '';
          if (hyp) keyFindings.push(`Reasoning: ${hyp.slice(0, 150)}`);
        }
      } catch { /* degrade */ }
    }

    const synthesis = paragraphs.length > 0
      ? `Incident in ${domain}: ${paragraphs.slice(0, 2).join(' | ')}`
      : `Incident synthesis for domain "${domain}": V1 LCIS at :3333 not reachable. Start with: pnpm graph:omega`;

    return {
      topic: `incident:${domain}`,
      synthesis,
      keyFindings: [...new Set(keyFindings)].slice(0, 10),
      sources: [...new Set(sources)],
      confidence: sources.length >= 2 ? 'HIGH' : sources.length >= 1 ? 'MEDIUM' : 'LOW',
      notConnected,
    };
  }

  /**
   * Retrieve cached synthesis for a topic (null if not cached).
   * @param {string} topic
   * @returns {KnowledgeSynthesis|null}
   */
  getSynthesis(topic) {
    return getCached(`topic:${topic}`) ?? getCached(`role:${topic}`) ?? getCached(topic) ?? null;
  }
}

export default new ExecutiveKnowledgeSynthesizer();
