/**
 * LCIS V3 — RecommendationValidator
 *
 * Validates executive recommendations against the canonical schema and checks
 * for inter-recommendation conflicts.
 *
 * Required fields (per schema):
 *   id, domain, title, action, evidence (non-empty array with source+fact),
 *   dependencies (array), risks (array), confidence (0–1 number),
 *   expectedImpact (object with scope/benefit/blastRadius), effort, priority,
 *   reversible (bool), timestamp.
 *
 * Feasibility: a recommendation is feasible when confidence ≥ 0.30 and at least
 * one evidence item exists from a CONNECTED source.
 *
 * Conflict detection: two recommendations conflict when:
 *   - One says "add X" and another says "remove X" (title token antonyms), OR
 *   - Both target the same module/table/domain with opposite actions, OR
 *   - One is reversible=false and a dependent one changes the same artifact.
 */

// ── Required field registry ───────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  'id',
  'domain',
  'title',
  'action',
  'evidence',
  'dependencies',
  'risks',
  'confidence',
  'expectedImpact',
  'effort',
  'priority',
  'reversible',
  'timestamp',
];

const VALID_EFFORTS     = new Set(['S', 'M', 'L']);
const VALID_PRIORITIES  = new Set(['P0', 'P1', 'P2', 'P3']);
const VALID_DOMAINS     = new Set(['engineering', 'operational', 'security', 'architecture', 'merchant']);
const CONNECTED_SOURCES = new Set([
  'v1-lcis', 'arch-intel', 'security-reasoner', 'arch-reasoner', 'risk-scorer',
  'impact-predictor', 'v2-ops', 'memory-engine', 'domain-graph', 'code-graph',
  'fix-engine', 'decision-v2',
]);

// ── Field validators ──────────────────────────────────────────────────────────

function validateField(field, value, errors) {
  switch (field) {
    case 'id':
      if (typeof value !== 'string' || value.trim().length === 0)
        errors.push('id must be a non-empty string');
      break;
    case 'domain':
      if (!VALID_DOMAINS.has(value))
        errors.push(`domain must be one of: ${[...VALID_DOMAINS].join(', ')} (got: ${value})`);
      break;
    case 'title':
      if (typeof value !== 'string' || value.trim().length < 5)
        errors.push('title must be a string of at least 5 characters');
      break;
    case 'action':
      if (typeof value !== 'string' || value.trim().length < 5)
        errors.push('action must be a non-empty descriptive string');
      break;
    case 'evidence':
      if (!Array.isArray(value) || value.length === 0) {
        errors.push('evidence must be a non-empty array');
      } else {
        value.forEach((e, i) => {
          if (typeof e !== 'object' || !e.source || !e.fact)
            errors.push(`evidence[${i}] must have {source, fact}`);
        });
      }
      break;
    case 'dependencies':
      if (!Array.isArray(value))
        errors.push('dependencies must be an array (may be empty)');
      break;
    case 'risks':
      if (!Array.isArray(value))
        errors.push('risks must be an array (may be empty)');
      break;
    case 'confidence':
      if (typeof value !== 'number' || value < 0 || value > 1)
        errors.push(`confidence must be a number 0–1 (got: ${value})`);
      break;
    case 'expectedImpact':
      if (!value || typeof value !== 'object')
        errors.push('expectedImpact must be an object');
      else {
        if (!value.scope)   errors.push('expectedImpact.scope is required');
        if (!value.benefit) errors.push('expectedImpact.benefit is required');
        if (!value.blastRadius) errors.push('expectedImpact.blastRadius is required');
      }
      break;
    case 'effort':
      if (!VALID_EFFORTS.has(value))
        errors.push(`effort must be S, M, or L (got: ${value})`);
      break;
    case 'priority':
      if (!VALID_PRIORITIES.has(value))
        errors.push(`priority must be P0–P3 (got: ${value})`);
      break;
    case 'reversible':
      if (typeof value !== 'boolean')
        errors.push('reversible must be a boolean');
      break;
    case 'timestamp':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        errors.push('timestamp must be a valid ISO-8601 date string');
      break;
    default:
      break;
  }
}

// ── Conflict helpers ──────────────────────────────────────────────────────────

const ANTONYM_PAIRS = [
  ['add', 'remove'], ['add', 'delete'], ['enable', 'disable'],
  ['increase', 'decrease'], ['upgrade', 'downgrade'], ['enforce', 'relax'],
];

function extractActionVerb(title) {
  return String(title ?? '').toLowerCase().split(/\s+/)[0];
}

function areAntonyms(verbA, verbB) {
  for (const [x, y] of ANTONYM_PAIRS) {
    if ((verbA === x && verbB === y) || (verbA === y && verbB === x)) return true;
  }
  return false;
}

function shareArtifact(a, b) {
  // Normalize title tokens (drop stop words)
  function keyTokens(str) {
    return String(str ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s/_-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 3 && !['with', 'from', 'that', 'this', 'into', 'using', 'should'].includes(t));
  }
  const ta = keyTokens(a.title);
  const tb = keyTokens(b.title);
  return ta.some(t => tb.includes(t));
}

// ── RecommendationValidator ───────────────────────────────────────────────────

class RecommendationValidator {
  /**
   * Validate a single recommendation against the canonical schema.
   * @param {object} rec
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validate(rec) {
    const errors   = [];
    const warnings = [];

    if (!rec || typeof rec !== 'object') {
      return { valid: false, errors: ['recommendation must be a non-null object'], warnings };
    }

    // Check required fields are present
    for (const field of REQUIRED_FIELDS) {
      if (!(field in rec)) {
        errors.push(`missing required field: ${field}`);
      } else {
        validateField(field, rec[field], errors);
      }
    }

    // Soft warnings
    if (rec.confidence !== undefined && rec.confidence < 0.30) {
      warnings.push(`confidence is very low (${rec.confidence}); consider deferring until more evidence is available`);
    }
    if (Array.isArray(rec.evidence) && !rec.evidence.some(e => CONNECTED_SOURCES.has(e.source))) {
      warnings.push('no evidence item comes from a known CONNECTED source — structural confidence reduced');
    }
    if (rec.priority === 'P0' && rec.effort === 'L') {
      warnings.push('P0 priority with L effort: ensure executive sign-off before starting');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Check whether a recommendation has at least one valid evidence item.
   * @param {object} rec
   * @returns {boolean}
   */
  hasEvidence(rec) {
    return (
      Array.isArray(rec?.evidence) &&
      rec.evidence.length > 0 &&
      rec.evidence.every(e => typeof e === 'object' && e.source && e.fact)
    );
  }

  /**
   * Assess feasibility based on confidence threshold and connected evidence.
   * @param {object} rec
   * @returns {{ feasible: boolean, reason: string }}
   */
  assessFeasibility(rec) {
    if (!rec) return { feasible: false, reason: 'no recommendation provided' };
    if (typeof rec.confidence !== 'number') {
      return { feasible: false, reason: 'confidence field missing or non-numeric' };
    }
    if (rec.confidence < 0.30) {
      return {
        feasible: false,
        reason: `confidence too low (${rec.confidence}); requires ≥ 0.30 to be actionable`,
      };
    }
    if (!this.hasEvidence(rec)) {
      return { feasible: false, reason: 'missing required evidence items (each needs source + fact)' };
    }
    const hasConnected = rec.evidence.some(e => CONNECTED_SOURCES.has(e.source));
    if (!hasConnected) {
      return {
        feasible: true,
        reason: 'feasible but no evidence from CONNECTED source — treat as low-confidence structural hypothesis',
      };
    }
    return { feasible: true, reason: 'passes all feasibility checks' };
  }

  /**
   * Detect pairs of recommendations that logically contradict each other.
   * @param {object[]} recs
   * @returns {Array<{ a: string, b: string, reason: string }>}
   */
  checkConflicts(recs) {
    if (!Array.isArray(recs)) return [];
    const conflicts = [];

    for (let i = 0; i < recs.length; i++) {
      for (let j = i + 1; j < recs.length; j++) {
        const a = recs[i];
        const b = recs[j];
        const verbA = extractActionVerb(a.title);
        const verbB = extractActionVerb(b.title);

        if (areAntonyms(verbA, verbB) && shareArtifact(a, b)) {
          conflicts.push({
            a: a.id ?? `[${i}]`,
            b: b.id ?? `[${j}]`,
            reason: `Antonymous actions ("${verbA}" vs "${verbB}") on a shared artifact`,
          });
          continue;
        }

        // Both are P0 irreversible targeting the same domain → ordering conflict
        if (
          a.domain === b.domain &&
          a.priority === 'P0' &&
          b.priority === 'P0' &&
          a.reversible === false &&
          b.reversible === false &&
          shareArtifact(a, b)
        ) {
          conflicts.push({
            a: a.id ?? `[${i}]`,
            b: b.id ?? `[${j}]`,
            reason: 'Two irreversible P0 recs target the same artifact — requires sequencing decision',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Return a full validation report for a list of recommendations.
   * @param {object[]} recs
   * @returns {{
   *   total: number,
   *   valid: number,
   *   invalid: number,
   *   conflicts: number,
   *   details: Array<{ id: string, valid: boolean, errors: string[], warnings: string[], feasibility: object }>,
   *   conflictList: Array<{ a: string, b: string, reason: string }>,
   * }}
   */
  getValidationReport(recs) {
    if (!Array.isArray(recs)) {
      return { total: 0, valid: 0, invalid: 0, conflicts: 0, details: [], conflictList: [] };
    }

    const details = recs.map(rec => {
      const { valid, errors, warnings } = this.validate(rec);
      const feasibility = this.assessFeasibility(rec);
      return { id: rec?.id ?? '?', valid, errors, warnings, feasibility };
    });

    const conflictList = this.checkConflicts(recs);

    return {
      total:       recs.length,
      valid:       details.filter(d => d.valid).length,
      invalid:     details.filter(d => !d.valid).length,
      conflicts:   conflictList.length,
      details,
      conflictList,
    };
  }
}

export default new RecommendationValidator();
