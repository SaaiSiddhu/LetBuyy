/**
 * LCIS V3 Phase 20 — ExecutiveIntelligenceEngine (Facade)
 *
 * The single entry-point for the executive intelligence layer.
 * Ties together all five engines:
 *
 *   ExecutiveReasoningEngine      — reason, whatShouldHappenNext, highestPriorityRisk, whatLeadershipShouldKnow
 *   ExecutiveDecisionEngine       — decide, evaluateOptions, recommendDecision, getDecisionLog
 *   ExecutivePlanningEngine       — plan, buildExecutionPlan, sequenceActions, estimateEffort
 *   ExecutiveVerificationEngine   — verify, verifyDecision, verifyPlan, attachEvidence
 *   ExecutiveKnowledgeSynthesizer — synthesize, synthesizePlatformState, synthesizeForRole, synthesizeIncident
 *
 * All sub-engine imports are lazy and optional. Promise.allSettled is used
 * throughout — a failure in any single engine does NOT block the others.
 *
 * Honesty contract:
 *   - Structural topology: CONNECTED (code graph)
 *   - All live values: NOT CONNECTED + exact source labeled
 *   - No fabrications
 *
 * @module ExecutiveIntelligenceEngine
 */

// ── Lazy sub-engine loaders ───────────────────────────────────────────────────

async function getReasoning() {
  try {
    const m = await import('./ExecutiveReasoningEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getDecision() {
  try {
    const m = await import('./ExecutiveDecisionEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getPlanning() {
  try {
    const m = await import('./ExecutivePlanningEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getVerification() {
  try {
    const m = await import('./ExecutiveVerificationEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getSynthesizer() {
  try {
    const m = await import('./ExecutiveKnowledgeSynthesizer.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── V2 primitive reachability probes ─────────────────────────────────────────

async function probeV2Primitive(relPath, displayName) {
  try {
    const m = await import(relPath);
    const hasDefault = m.default != null;
    return { name: displayName, reachable: hasDefault, reason: hasDefault ? null : 'default export is null' };
  } catch (e) {
    return { name: displayName, reachable: false, reason: e.message };
  }
}

// ── V1 LCIS reachability probe ────────────────────────────────────────────────

async function probeV1() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch('http://localhost:3333/api/domains', { signal: ctrl.signal });
    clearTimeout(timer);
    return { name: 'V1LCIS:3333', reachable: res.ok, reason: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    clearTimeout(timer);
    return { name: 'V1LCIS:3333', reachable: false, reason: e.message };
  }
}

// ── Main class ────────────────────────────────────────────────────────────────

class ExecutiveIntelligenceEngine {
  /**
   * Full executive briefing: whatShouldHappenNext + highestPriorityRisk + whatLeadershipShouldKnow
   * + platform synthesis, all in one call.
   * @returns {Promise<{
   *   nextActions: object,
   *   highestRisk: object,
   *   leadershipSummary: object,
   *   platformState: object,
   *   timestamp: string
   * }>}
   */
  async getExecutiveBriefing() {
    const [reasoning, synthesizer] = await Promise.allSettled([
      getReasoning(),
      getSynthesizer(),
    ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

    const [nextActions, highestRisk, leadershipSummary, platformState] = await Promise.allSettled([
      reasoning?.whatShouldHappenNext?.() ?? Promise.resolve({ conclusion: 'ExecutiveReasoningEngine not loaded', evidence: [], priority: 'P3', confidence: 'LOW', recommendedOwner: 'engineering', timestamp: new Date().toISOString() }),
      reasoning?.highestPriorityRisk?.() ?? Promise.resolve({ conclusion: 'ExecutiveReasoningEngine not loaded', evidence: [], priority: 'P3', confidence: 'LOW', recommendedOwner: 'engineering', timestamp: new Date().toISOString() }),
      reasoning?.whatLeadershipShouldKnow?.() ?? Promise.resolve({ conclusion: 'ExecutiveReasoningEngine not loaded', evidence: [], priority: 'P2', confidence: 'LOW', recommendedOwner: 'leadership', timestamp: new Date().toISOString() }),
      synthesizer?.synthesizePlatformState?.() ?? Promise.resolve({ topic: 'platform_state', synthesis: 'ExecutiveKnowledgeSynthesizer not loaded', keyFindings: [], sources: [], confidence: 'LOW', notConnected: ['ExecutiveKnowledgeSynthesizer'] }),
    ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message ?? 'failed' })));

    return {
      nextActions,
      highestRisk,
      leadershipSummary,
      platformState,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * What should happen next across all domains?
   * @returns {Promise<object>}
   */
  async whatShouldHappenNext() {
    const engine = await getReasoning();
    if (!engine?.whatShouldHappenNext) {
      return {
        question: 'What should happen next?',
        conclusion: 'ExecutiveReasoningEngine not loaded',
        priority: 'P3',
        evidence: [],
        confidence: 'LOW',
        recommendedOwner: 'engineering',
        timestamp: new Date().toISOString(),
      };
    }
    return engine.whatShouldHappenNext();
  }

  /**
   * Score and recommend a decision for a situation.
   * @param {string} situation
   * @returns {Promise<object>}
   */
  async decide(situation) {
    const engine = await getDecision();
    if (!engine?.decide) {
      return {
        situation,
        options: [],
        recommended: { action: 'ExecutiveDecisionEngine not loaded', score: 0 },
        rationale: 'Decision engine primitive unavailable',
        reversible: true,
        timestamp: new Date().toISOString(),
      };
    }
    return engine.decide(situation);
  }

  /**
   * Decompose a goal into an ordered execution plan.
   * @param {string} goal
   * @returns {Promise<object>}
   */
  async plan(goal) {
    const engine = await getPlanning();
    if (!engine?.plan) {
      return {
        id: 'unloaded',
        goal,
        steps: [],
        orderedSteps: [],
        estimatedTotalHours: 0,
        timestamp: new Date().toISOString(),
        error: 'ExecutivePlanningEngine not loaded',
      };
    }
    return engine.plan(goal);
  }

  /**
   * Verify a conclusion, decision, or plan.
   * @param {object} conclusion
   * @returns {Promise<object>}
   */
  async verify(conclusion) {
    const engine = await getVerification();
    if (!engine?.verify) {
      return {
        verified: false,
        confidence: 'LOW',
        evidence: [],
        sources: [],
        gaps: ['ExecutiveVerificationEngine not loaded'],
        status: 'UNVERIFIED',
      };
    }
    return engine.verify(conclusion);
  }

  /**
   * Synthesise knowledge about a topic for executive consumption.
   * @param {string} topic
   * @returns {Promise<object>}
   */
  async synthesize(topic) {
    const engine = await getSynthesizer();
    if (!engine?.synthesize) {
      return {
        topic,
        synthesis: 'ExecutiveKnowledgeSynthesizer not loaded',
        keyFindings: [],
        sources: [],
        confidence: 'LOW',
        notConnected: ['ExecutiveKnowledgeSynthesizer'],
      };
    }
    return engine.synthesize(topic);
  }

  /**
   * Health check: which sub-engines and V2 primitives are reachable.
   * @returns {Promise<{
   *   subEngines: Array<{name:string, reachable:boolean, reason:string|null}>,
   *   v2Primitives: Array<{name:string, reachable:boolean, reason:string|null}>,
   *   v1Lcis: {name:string, reachable:boolean, reason:string|null},
   *   timestamp: string
   * }>}
   */
  async getHealth() {
    const [
      subEngineResults,
      v2PrimitiveResults,
      v1Result,
    ] = await Promise.allSettled([
      Promise.allSettled([
        import('./ExecutiveReasoningEngine.mjs').then(m => ({ name: 'ExecutiveReasoningEngine', reachable: m.default != null, reason: null })).catch(e => ({ name: 'ExecutiveReasoningEngine', reachable: false, reason: e.message })),
        import('./ExecutiveDecisionEngine.mjs').then(m => ({ name: 'ExecutiveDecisionEngine', reachable: m.default != null, reason: null })).catch(e => ({ name: 'ExecutiveDecisionEngine', reachable: false, reason: e.message })),
        import('./ExecutivePlanningEngine.mjs').then(m => ({ name: 'ExecutivePlanningEngine', reachable: m.default != null, reason: null })).catch(e => ({ name: 'ExecutivePlanningEngine', reachable: false, reason: e.message })),
        import('./ExecutiveVerificationEngine.mjs').then(m => ({ name: 'ExecutiveVerificationEngine', reachable: m.default != null, reason: null })).catch(e => ({ name: 'ExecutiveVerificationEngine', reachable: false, reason: e.message })),
        import('./ExecutiveKnowledgeSynthesizer.mjs').then(m => ({ name: 'ExecutiveKnowledgeSynthesizer', reachable: m.default != null, reason: null })).catch(e => ({ name: 'ExecutiveKnowledgeSynthesizer', reachable: false, reason: e.message })),
      ]).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : { name: 'unknown', reachable: false, reason: r.reason?.message })),

      Promise.allSettled([
        probeV2Primitive('../reasoning/ReasoningEngine.mjs', 'ReasoningEngine'),
        probeV2Primitive('../correlation/IntelligenceCorrelationEngine.mjs', 'IntelligenceCorrelationEngine'),
        probeV2Primitive('../correlation/RiskScorer.mjs', 'RiskScorer'),
        probeV2Primitive('../autonomous-operations/OperationsReasoningEngine.mjs', 'OperationsReasoningEngine'),
        probeV2Primitive('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs', 'ArchitectureIntelligenceEngine'),
        probeV2Primitive('../context-intelligence/ContextAssembler.mjs', 'ContextAssembler'),
        probeV2Primitive('../memory-engine/MemoryRetriever.mjs', 'MemoryRetriever'),
        probeV2Primitive('../memory-engine/MemoryIngestionPipeline.mjs', 'MemoryIngestionPipeline'),
        probeV2Primitive('../self-model/PlatformExplainer.mjs', 'PlatformExplainer'),
      ]).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : { name: 'unknown', reachable: false, reason: r.reason?.message })),

      probeV1(),
    ]).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : null));

    return {
      subEngines: subEngineResults ?? [],
      v2Primitives: v2PrimitiveResults ?? [],
      v1Lcis: v1Result ?? { name: 'V1LCIS:3333', reachable: false, reason: 'probe failed' },
      timestamp: new Date().toISOString(),
    };
  }
}

export default new ExecutiveIntelligenceEngine();
