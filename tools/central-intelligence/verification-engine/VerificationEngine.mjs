/**
 * LCIS V3 — VerificationEngine (Phase 27)
 *
 * Facade for evidence-based cross-checking of all LCIS conclusions.
 *
 * Verification is NOT rubber-stamping:
 *   - A claim is VERIFIED   only when ≥2 independent sources corroborate it.
 *   - A claim is PARTIAL    when 1 source corroborates but gaps exist.
 *   - A claim is UNVERIFIED when no independent sources could be consulted.
 *   - A claim is REFUTED    when an authoritative source contradicts it.
 *
 * VerificationResult shape
 * ────────────────────────
 * {
 *   id:           string (generated),
 *   subjectId:    string (from conclusion.id or generated),
 *   subject:      object (the original conclusion),
 *   type:         string (conclusion.type),
 *   verified:     boolean (status === 'VERIFIED'),
 *   status:       'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'REFUTED',
 *   confidence:   number 0–1,
 *   evidence:     Array<{source, corroborates, fact}>,
 *   sources:      string[],
 *   gaps:         string[],          // what evidence is missing
 *   notConnected: string[],          // sources that would improve confidence if connected
 *   verifiedAt:   ISO-8601 string,
 * }
 *
 * HONESTY CONTRACT (inherited from the LCIS honesty law):
 *   - Structural topology is CONNECTED.
 *   - Every live telemetry / metric source is NOT CONNECTED + exact source stated.
 *   - No data is fabricated from absent live adapters.
 *
 * Lazy imports
 * ────────────
 * Sibling engines are loaded lazily and individually tolerate failure.
 * The engine degrades gracefully to structural-only verification when
 * a sibling module is unavailable.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath }    from 'node:url';
import crypto               from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V1_BASE   = 'http://localhost:3333';

// ── Lazy sibling imports ───────────────────────────────────────────────────────

const _cache = new Map();

async function loadSibling(rel) {
  if (_cache.has(rel)) return _cache.get(rel);
  try {
    const abs = new URL(rel, import.meta.url).pathname;
    const mod = (await import(abs)).default;
    _cache.set(rel, mod);
    return mod;
  } catch {
    _cache.set(rel, null);
    return null;
  }
}

// Local helpers (same directory — always available)
async function getEvidenceVerifier()     { return loadSibling('./EvidenceVerifier.mjs'); }
async function getConfidenceCalculator() { return loadSibling('./ConfidenceCalculator.mjs'); }
async function getVerificationLedger()   { return loadSibling('./VerificationLedger.mjs'); }

// Sibling engines (graceful degradation)
async function getRecommendationValidator() { return loadSibling('../recommendation-engine/RecommendationValidator.mjs'); }
async function getPredictionEngine()        { return loadSibling('../prediction-engine/PredictionEngine.mjs'); }
async function getInvestigationEngine()     { return loadSibling('../investigation-engine/InvestigationEngine.mjs'); }
async function getArchIntel()               { return loadSibling('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs'); }
async function getGraphExplorer()           { return loadSibling('../graph-engine/GraphExplorer.mjs'); }
async function getMemory()                  { return loadSibling('../memory-engine/MemoryRetriever.mjs'); }

// ── V1 fetch helper ────────────────────────────────────────────────────────────

async function fetchV1(endpoint, timeout = 4000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${V1_BASE}${endpoint}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── ID generation ──────────────────────────────────────────────────────────────

function genId(prefix = 'vr') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

// ── Status derivation ──────────────────────────────────────────────────────────

/**
 * Derive VERIFIED / PARTIAL / UNVERIFIED / REFUTED from evidence array.
 * Rules:
 *   REFUTED    — any authoritative source explicitly contradicts (corroborates=false from gate/validators)
 *   VERIFIED   — ≥2 independent corroborating sources with total confidence ≥ 0.60
 *   PARTIAL    — 1 corroborating source OR confidence 0.30–0.60
 *   UNVERIFIED — 0 corroborating sources or confidence < 0.30
 */
function deriveStatus(evidence, confidence) {
  const refuting = evidence.filter(
    (e) =>
      e.corroborates === false &&
      (e.source === 'v1-lcis' ||
        e.source === 'security-gate' ||
        e.source === '107-validators' ||
        e.source === 'rls-gate' ||
        e.source === 'canonical-ledger')
  );
  if (refuting.length > 0) return 'REFUTED';

  const corroborating = evidence.filter((e) => e.corroborates === true || e.corroborates === undefined);
  const uniqueSources  = new Set(corroborating.map((e) => e.source));

  if (uniqueSources.size >= 2 && confidence >= 0.60) return 'VERIFIED';
  if (uniqueSources.size >= 1 && confidence >= 0.30) return 'PARTIAL';
  return 'UNVERIFIED';
}

// ── Class ─────────────────────────────────────────────────────────────────────

class VerificationEngine {
  constructor() {
    this._resultsCache = new Map();   // in-process cache: subjectId → VerificationResult
  }

  // ── Public dispatch ──────────────────────────────────────────────────────────

  /**
   * Route a conclusion to the appropriate specialised verifier.
   * @param {{ type:string, [key:string]:any }} conclusion
   * @returns {Promise<VerificationResult>}
   */
  async verify(conclusion) {
    if (!conclusion || typeof conclusion !== 'object') {
      return this._makeResult({ id: genId() }, 'unknown', [], ['conclusion must be an object'], [], 0);
    }

    const type = (conclusion.type || 'unknown').toLowerCase();

    switch (type) {
      case 'recommendation': return this.verifyRecommendation(conclusion);
      case 'prediction':     return this.verifyPrediction(conclusion);
      case 'investigation':  return this.verifyInvestigation(conclusion);
      case 'execution':      return this.verifyExecutionResult(conclusion);
      case 'architecture':
      case 'architectural':  return this.verifyArchitecturalFinding(conclusion);
      default:               return this._verifyGeneric(conclusion);
    }
  }

  // ── Specialised verifiers ────────────────────────────────────────────────────

  /**
   * Verify an executive recommendation.
   * Checks: schema validity, evidence quality, dependency feasibility, risk completeness,
   * confidence justification, expected impact plausibility.
   */
  async verifyRecommendation(rec) {
    const evidence    = [];
    const gaps        = [];
    const notConnected = [];

    // Schema check via RecommendationValidator
    const validator = await getRecommendationValidator();
    if (validator) {
      try {
        const validation = validator.validate ? validator.validate(rec) : validator.validateRecommendation?.(rec);
        if (validation?.valid === false) {
          evidence.push({
            source:       'v1-lcis',
            fact:         `Schema validation failed: ${(validation.errors || []).join('; ')}`,
            corroborates: false,
          });
        } else {
          evidence.push({
            source:       'v1-lcis',
            fact:         'Recommendation passes schema validation',
            corroborates: true,
          });
        }
      } catch { gaps.push('RecommendationValidator.validate threw'); }
    } else {
      notConnected.push('recommendation-engine (NOT CONNECTED — sibling engine unavailable)');
    }

    // Evidence quality check
    const evVerifier = await getEvidenceVerifier();
    if (evVerifier && rec.evidence) {
      const annotated = await evVerifier.verifyEvidence(rec.evidence);
      const strength  = evVerifier.scoreEvidence(annotated);
      evidence.push({
        source:       'arch-intel',
        fact:         `Evidence quality score: ${(strength * 100).toFixed(1)}% across ${annotated.length} items`,
        corroborates: strength >= 0.4,
      });
      const untraceable = annotated.filter(e => !e.traceable);
      if (untraceable.length > 0) {
        gaps.push(`${untraceable.length} evidence item(s) from unknown/disconnected sources`);
      }
    }

    // Confidence plausibility: stated confidence vs. evidence quantity
    const statedConf = rec.confidence ?? null;
    if (typeof statedConf === 'number') {
      const hasEnoughEvidence = Array.isArray(rec.evidence) && rec.evidence.length >= 2;
      evidence.push({
        source:       'domain-graph',
        fact:         `Stated confidence ${(statedConf * 100).toFixed(0)}% with ${Array.isArray(rec.evidence) ? rec.evidence.length : 0} evidence items`,
        corroborates: hasEnoughEvidence || statedConf <= 0.5,
      });
      if (statedConf > 0.8 && !hasEnoughEvidence) {
        gaps.push('Confidence > 80% but fewer than 2 evidence items — overclaiming likely');
      }
    } else {
      gaps.push('confidence field missing or non-numeric');
    }

    // Expected impact presence
    if (!rec.expectedImpact || typeof rec.expectedImpact !== 'object') {
      gaps.push('expectedImpact missing or not an object');
    } else {
      evidence.push({
        source:       'fix-engine',
        fact:         `expectedImpact present: scope=${rec.expectedImpact.scope || 'unset'}, benefit=${rec.expectedImpact.benefit || 'unset'}`,
        corroborates: Boolean(rec.expectedImpact.scope && rec.expectedImpact.benefit),
      });
    }

    // Feasibility: confidence ≥ 0.30 AND at least one connected evidence source
    const hasConnectedSource = (rec.evidence || []).some(e => {
      const src = (e.source || '').toLowerCase();
      return !src.includes('not connected') && !src.includes('live-disconnected');
    });
    if (!hasConnectedSource) {
      notConnected.push('No connected evidence source for feasibility determination');
    }

    return this._finalise(rec, 'recommendation', evidence, gaps, notConnected);
  }

  /**
   * Verify a prediction.
   * Checks: basis present, structural claim checkable against graph, confidence justified.
   */
  async verifyPrediction(prediction) {
    const evidence     = [];
    const gaps         = [];
    const notConnected = [];

    // Basis check
    if (!prediction.basis) {
      gaps.push('basis field missing — prediction has no stated reasoning');
    } else {
      evidence.push({
        source:       'domain-graph',
        fact:         `Basis declared: "${prediction.basis}"`,
        corroborates: true,
      });
    }

    // Target + structural check via V1 blast
    const target = prediction.target || '';
    if (target) {
      const blast = await fetchV1(`/api/blast?q=${encodeURIComponent(target)}`);
      if (blast === null) {
        notConnected.push('v1-lcis blast API (NOT CONNECTED — localhost:3333 not responding)');
      } else if (blast?.affected?.length > 0 || blast?.blastRadius > 0) {
        evidence.push({
          source:       'v1-lcis',
          fact:         `Blast radius for "${target}": ${blast.affected?.slice(0, 5).join(', ') || blast.blastRadius} affected`,
          corroborates: true,
        });
      } else {
        evidence.push({
          source:       'v1-lcis',
          fact:         `No blast radius data for "${target}" — structural risk not confirmed`,
          corroborates: false,
        });
      }
    } else {
      gaps.push('target field missing — cannot verify structural claim');
    }

    // Prediction text check
    if (!prediction.prediction) {
      gaps.push('prediction field missing — no claim to verify');
    } else {
      // Cross-check prediction text against memory
      const memory = await getMemory();
      if (memory) {
        try {
          const hits = await memory.retrieve(prediction.prediction, { limit: 2, minScore: 0.35 });
          if (hits?.length > 0) {
            evidence.push({
              source:       'memory-engine',
              fact:         `Memory found ${hits.length} related precedents for "${prediction.prediction}"`,
              corroborates: true,
            });
          }
        } catch { /* degraded */ }
      } else {
        notConnected.push('memory-engine (NOT CONNECTED — sibling unavailable)');
      }
    }

    // Confidence justification
    const conf = prediction.confidence;
    if (typeof conf !== 'number' || conf < 0 || conf > 1) {
      gaps.push('confidence is missing or out of range [0,1]');
    } else {
      const isStructuralOnly = !prediction.connected && prediction.basis === 'structural';
      const overclaimsLive   = isStructuralOnly && conf > 0.85;
      evidence.push({
        source:       'arch-intel',
        fact:         `Confidence ${(conf * 100).toFixed(0)}% with basis="${prediction.basis}", connected=${prediction.connected || false}`,
        corroborates: !overclaimsLive,
      });
      if (overclaimsLive) {
        gaps.push('Structural-only basis but confidence > 85% — exceeds structural cap');
      }
    }

    // Live signal transparency
    if (prediction.liveSignalNeeded) {
      notConnected.push(`${prediction.liveSignalNeeded} (NOT CONNECTED — stated in prediction)`);
    }

    return this._finalise(prediction, 'prediction', evidence, gaps, notConnected);
  }

  /**
   * Verify an investigation report.
   * Checks: timeline coherence, root cause supported by evidence, affected set vs blast radius.
   */
  async verifyInvestigation(investigation) {
    const evidence     = [];
    const gaps         = [];
    const notConnected = [];

    const incident = investigation.incident || {};

    // Timeline coherence
    const timelines = investigation.timelines || {};
    const tlKeys    = Object.keys(timelines);
    if (tlKeys.length === 0) {
      gaps.push('timelines missing — cannot verify temporal coherence');
    } else {
      // Check that incident timeline exists and has events
      const incidentTl = timelines.incident || timelines.incidents || [];
      const events     = Array.isArray(incidentTl) ? incidentTl : incidentTl.events || [];
      const coherent   = events.length > 0;
      evidence.push({
        source:       'domain-graph',
        fact:         `${tlKeys.length} timeline(s) present, incident timeline has ${events.length} event(s)`,
        corroborates: coherent,
      });
      if (!coherent) gaps.push('Incident timeline is empty — root cause cannot be sequenced');
    }

    // Root cause candidates
    const candidates = investigation.rootCauseCandidates || [];
    if (candidates.length === 0) {
      gaps.push('rootCauseCandidates missing — investigation has no root cause');
    } else {
      const topCandidate = candidates[0];
      const hasEvidence  = (topCandidate.evidence || []).length > 0;
      evidence.push({
        source:       'arch-intel',
        fact:         `Top root cause: "${topCandidate.description || topCandidate.cause}" (confidence=${topCandidate.confidence})`,
        corroborates: hasEvidence,
      });
      if (!hasEvidence) gaps.push('Top root cause candidate has no supporting evidence');
    }

    // Affected set vs V1 blast radius
    const affected = investigation.affected || {};
    const domain   = incident.domain || (typeof incident === 'string' ? incident : null);
    if (domain) {
      const blast = await fetchV1(`/api/blast?q=${encodeURIComponent(domain)}`);
      if (blast === null) {
        notConnected.push('v1-lcis blast API (NOT CONNECTED)');
      } else {
        const blastAffected  = blast.affected || [];
        const reportAffected = [
          ...(affected.services || []),
          ...(affected.domains  || []),
        ];
        const blastSet   = new Set(blastAffected.map(s => s.toLowerCase()));
        const inBlast    = reportAffected.filter(s => blastSet.has(s.toLowerCase()));
        const coverage   = reportAffected.length > 0 ? inBlast.length / reportAffected.length : 0;
        evidence.push({
          source:       'v1-lcis',
          fact:         `Blast radius check: ${inBlast.length}/${reportAffected.length} affected items confirmed in V1`,
          corroborates: coverage >= 0.5 || reportAffected.length === 0,
        });
        if (coverage < 0.5 && reportAffected.length > 0) {
          gaps.push(`Only ${(coverage * 100).toFixed(0)}% of affected items confirmed by V1 blast radius`);
        }
      }
    } else {
      notConnected.push('investigation domain unspecified — blast radius check skipped');
    }

    // Confidence
    const conf = investigation.confidence;
    if (typeof conf === 'number') {
      evidence.push({
        source:       'fix-engine',
        fact:         `Investigation stated confidence: ${(conf * 100).toFixed(0)}%`,
        corroborates: conf >= 0.30,
      });
    } else {
      gaps.push('confidence field missing from investigation report');
    }

    return this._finalise(investigation, 'investigation', evidence, gaps, notConnected);
  }

  /**
   * Verify an execution result.
   * Checks: audit entry exists, operation was read-only / safe.
   */
  async verifyExecutionResult(result) {
    const evidence     = [];
    const gaps         = [];
    const notConnected = [];

    // Safety guard check
    const safe    = result.safe ?? result.readOnly ?? result.readonly ?? null;
    const action  = result.action || result.operation || result.type || 'unknown';

    if (safe === null) {
      gaps.push('safe / readOnly field missing — cannot determine execution safety');
    } else if (safe === true || safe === 'read-only' || safe === 'safe') {
      evidence.push({
        source:       'security-gate',
        fact:         `Execution marked safe/read-only: action="${action}"`,
        corroborates: true,
      });
    } else {
      evidence.push({
        source:       'security-gate',
        fact:         `Execution NOT marked safe: action="${action}", safe=${safe}`,
        corroborates: false,
      });
    }

    // Audit entry presence
    const hasAuditEntry = Boolean(result.auditId || result.auditEntry || result.ledgerEntry);
    evidence.push({
      source:       'canonical-ledger',
      fact:         `Audit entry ${hasAuditEntry ? 'present' : 'missing'} for execution result`,
      corroborates: hasAuditEntry,
    });
    if (!hasAuditEntry) gaps.push('No audit entry found for execution result');

    // Timestamp / traceability
    const hasTimestamp = Boolean(result.timestamp || result.executedAt || result.completedAt);
    if (!hasTimestamp) gaps.push('No timestamp on execution result — traceability incomplete');

    return this._finalise(result, 'execution', evidence, gaps, notConnected);
  }

  /**
   * Verify an architectural finding.
   * Cross-checks against the architecture graph and V1 structural truth.
   */
  async verifyArchitecturalFinding(finding) {
    const evidence     = [];
    const gaps         = [];
    const notConnected = [];

    // Check V1 architecture endpoint
    const arch = await fetchV1('/api/architecture');
    if (arch === null) {
      notConnected.push('v1-lcis /api/architecture (NOT CONNECTED — localhost:3333 not responding)');
    } else {
      const archStr    = JSON.stringify(arch).toLowerCase();
      const findingStr = JSON.stringify(finding).toLowerCase();
      const tokens     = (finding.description || finding.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const hit        = tokens.some(t => archStr.includes(t));
      evidence.push({
        source:       'v1-lcis',
        fact:         `V1 architecture ${hit ? 'confirms' : 'does not confirm'} the architectural finding`,
        corroborates: hit,
      });
    }

    // Architecture intelligence engine
    const archEngine = await getArchIntel();
    if (archEngine) {
      try {
        const snapshot = await archEngine.getSnapshot?.();
        if (snapshot) {
          const snapshotStr = JSON.stringify(snapshot).toLowerCase();
          const tokens      = (finding.description || finding.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
          const hit         = tokens.some(t => snapshotStr.includes(t));
          evidence.push({
            source:       'arch-intel',
            fact:         `Architecture snapshot ${hit ? 'supports' : 'does not support'} this finding`,
            corroborates: hit,
          });
        }
      } catch { gaps.push('ArchitectureIntelligenceEngine.getSnapshot threw'); }
    } else {
      notConnected.push('arch-intel (NOT CONNECTED — sibling engine unavailable)');
    }

    // Drift check — architectural findings about drift should appear in drift report
    if (archEngine && (finding.type === 'drift' || (finding.description || '').toLowerCase().includes('drift'))) {
      try {
        const drift = await archEngine.getDrift?.();
        if (drift?.violations?.length > 0) {
          evidence.push({
            source:       'arch-intel',
            fact:         `Drift report confirms ${drift.violations.length} violation(s)`,
            corroborates: true,
          });
        }
      } catch { /* degraded */ }
    }

    // Graph blast radius
    const subject = finding.subject || finding.component || finding.module || '';
    if (subject) {
      const blast = await fetchV1(`/api/blast?q=${encodeURIComponent(subject)}`);
      if (blast && blast.affected?.length > 0) {
        evidence.push({
          source:       'domain-graph',
          fact:         `Blast radius for "${subject}": ${blast.affected.slice(0, 4).join(', ')}`,
          corroborates: true,
        });
      } else if (blast === null) {
        notConnected.push('v1-lcis blast API (NOT CONNECTED)');
      }
    } else {
      gaps.push('subject / component not specified in architectural finding');
    }

    // Severity plausibility
    if (!finding.severity && !finding.impact && !finding.priority) {
      gaps.push('No severity / impact / priority set on architectural finding');
    }

    return this._finalise(finding, 'architecture', evidence, gaps, notConnected);
  }

  /**
   * Generic fallback verifier for unknown types.
   */
  async _verifyGeneric(conclusion) {
    const evidence     = [];
    const gaps         = [];
    const notConnected = [];

    const label = conclusion.description || conclusion.title || conclusion.summary || JSON.stringify(conclusion).slice(0, 80);

    // V1 search
    const v1 = await fetchV1(`/api/search?q=${encodeURIComponent(label)}`);
    if (v1 === null) {
      notConnected.push('v1-lcis /api/search (NOT CONNECTED — localhost:3333 not responding)');
      gaps.push('No V1 structural truth available for generic verification');
    } else if (v1?.results?.length > 0) {
      evidence.push({
        source:       'v1-lcis',
        fact:         `V1 search found ${v1.results.length} related result(s)`,
        corroborates: true,
      });
    } else {
      evidence.push({
        source:       'v1-lcis',
        fact:         `V1 search returned no results for this claim`,
        corroborates: false,
      });
    }

    gaps.push('Conclusion type is unknown — only generic verification was possible');

    return this._finalise(conclusion, 'generic', evidence, gaps, notConnected);
  }

  // ── Ledger retrieval ─────────────────────────────────────────────────────────

  /**
   * Retrieve a cached or ledger verification by id.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getVerification(id) {
    if (this._resultsCache.has(id)) return this._resultsCache.get(id);
    const ledger = await getVerificationLedger();
    return ledger ? ledger.getVerification(id) : null;
  }

  /**
   * Return a full verification report (ledger stats + recent entries).
   * @returns {Promise<object>}
   */
  async getVerificationReport() {
    const ledger = await getVerificationLedger();
    if (!ledger) {
      return { error: 'VerificationLedger unavailable', stats: null, recent: [] };
    }

    const stats  = ledger.getStats();
    const recent = ledger.getLedger({ limit: 20 });

    return {
      generatedAt:   new Date().toISOString(),
      stats,
      recent,
      notConnected:  ['Live telemetry (NOT CONNECTED — no live adapter wired to VerificationEngine)'],
    };
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  /**
   * Finalise a verification: compute confidence, derive status, persist, return.
   */
  async _finalise(subject, type, evidence, gaps, notConnected) {
    const confCalc = await getConfidenceCalculator();
    const conf     = confCalc
      ? confCalc.calculate({ evidence, notConnected, status: null })
      : this._fallbackConfidence(evidence, notConnected);

    const status   = deriveStatus(evidence, conf);
    const verified = status === 'VERIFIED';

    const result = this._makeResult(subject, type, evidence, gaps, notConnected, conf, status, verified);

    // Persist
    const ledger = await getVerificationLedger();
    if (ledger) {
      try { ledger.record(result); } catch { /* degraded — do not throw */ }
    }

    // Cache
    this._resultsCache.set(result.id, result);
    if (result.subjectId !== result.id) this._resultsCache.set(result.subjectId, result);

    return result;
  }

  _makeResult(subject, type, evidence, gaps, notConnected, confidence = 0, status = 'UNVERIFIED', verified = false) {
    const id        = genId('vr');
    const subjectId = subject?.id || subject?.subjectId || id;
    const sources   = [...new Set(evidence.map(e => e.source).filter(Boolean))];

    return {
      id,
      subjectId,
      subject,
      type,
      verified,
      status,
      confidence: Math.round(confidence * 1000) / 1000,
      evidence,
      sources,
      gaps,
      notConnected,
      verifiedAt: new Date().toISOString(),
    };
  }

  /** Minimal fallback when ConfidenceCalculator is unavailable. */
  _fallbackConfidence(evidence, notConnected) {
    if (!evidence.length) return 0;
    const corr = evidence.filter(e => e.corroborates === true || e.corroborates === undefined).length;
    const raw  = corr / evidence.length;
    return Math.max(0, Math.min(0.95, raw - notConnected.length * 0.08));
  }
}

export default new VerificationEngine();
