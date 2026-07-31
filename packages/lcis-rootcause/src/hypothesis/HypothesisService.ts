/**
 * HypothesisService — RC01..RC08 deterministic rule engine.
 *
 * ANTI-HALLUCINATION LAW: a CauseHypothesis without evidence is NEVER emitted.
 * Confidence = rule.baseConfidence + 0.05 * min(3, extraEvidenceCount), capped 0.85.
 * No fetch, no exec, no fs, no DB, no AI — pure functional over HypothesisInput.
 */
import { evidence, notConnected } from '@letbuyy/lcis-core';
import type { Evidence } from '@letbuyy/lcis-core';
import type { CauseHypothesis, HypothesisInput, SymptomKind } from '../shared/types';
import { ROOT_CAUSE_RULES } from '../shared/rules';

/** Money-path migration name terms (lowercased). */
const MONEY_TERMS = ['payment', 'refund', 'payout', 'gift', 'ledger'] as const;

/** Symptom kinds that trigger RC01 (money-path migration). */
const RC01_KINDS: ReadonlySet<SymptomKind> = new Set(['orders-failing', 'checkout-broken']);

/** Symptom kinds that trigger RC05 (consumerless queue). */
const RC05_KINDS: ReadonlySet<SymptomKind> = new Set(['queue-backlog', 'worker-crashed']);

/** Symptom kinds that trigger RC07 (external provider). */
const RC07_KINDS: ReadonlySet<SymptomKind> = new Set(['checkout-broken', 'orders-failing', 'deployment-failed']);

/**
 * Compute confidence per the canonical formula:
 *   base + 0.05 * min(3, extraEvidenceCount), capped at 0.85.
 * extraEvidenceCount = total evidence items beyond the mandatory first.
 */
function computeConfidence(baseConfidence: number, evidenceItems: readonly Evidence[]): number {
  const extra = Math.max(0, evidenceItems.length - 1);
  return Math.min(0.85, baseConfidence + 0.05 * Math.min(3, extra));
}

/**
 * Extract the "name part" of a system id for substring matching.
 * E.g. 'domain:payments' → 'payments', 'queue:order-events' → 'order-events',
 * 'rpc:create_checkout_order' → 'create_checkout_order'.
 * If there is no colon, the whole string is the name part.
 */
function namePartOf(id: string): string {
  const colonIdx = id.indexOf(':');
  return colonIdx >= 0 ? id.slice(colonIdx + 1) : id;
}

/**
 * True if `a` and `b` match: === OR a is substring of b OR b is substring of a.
 */
function subjectMatchesSystemOrDomain(subject: string, systemOrDomain: string): boolean {
  if (subject === systemOrDomain) return true;
  if (subject.includes(systemOrDomain)) return true;
  if (systemOrDomain.includes(subject)) return true;
  return false;
}

function ruleById(id: string) {
  return ROOT_CAUSE_RULES.find((r) => r.id === id)!;
}

export class HypothesisService {
  /**
   * Apply RC01..RC08 deterministically to the assembled input.
   * Returns a ranked array of CauseHypothesis items (confidence desc, then rule asc, then id asc).
   * Empty array on empty/unknown input — never throws.
   */
  evaluate(input: HypothesisInput): readonly CauseHypothesis[] {
    const results: CauseHypothesis[] = [];

    // ── RC01: Recent money-path migration ─────────────────────────────────────
    if (RC01_KINDS.has(input.symptom.kind)) {
      const rule = ruleById('RC01');
      const qualifying = input.recentChanges.migrations.filter((m) =>
        MONEY_TERMS.some((term) => m.toLowerCase().includes(term)),
      );
      qualifying.forEach((m, i) => {
        const ev: Evidence[] = [
          evidence(
            'artifact-field',
            `migration:${m}`,
            `Money-path migration "${m}" in recent changes`,
            'graphify-out/memory-intel.json',
          ),
        ];
        const conf = computeConfidence(rule.baseConfidence, ev);
        results.push({
          id: `RC01-${i + 1}`,
          rule: rule.id,
          category: rule.category,
          cause: rule.title,
          detail: `Migration "${m}" touches the money path and the symptom is "${input.symptom.kind}".`,
          confidence: conf,
          connection: 'CONNECTED',
          evidence: ev,
        });
      });
    }

    // ── RC02: Recent change to an affected system ─────────────────────────────
    {
      const rule = ruleById('RC02');
      const systemNameParts = input.affected.systems.map(namePartOf);
      const affectedDomains = input.affected.domains;

      const matchingChanges = input.recentChanges.changes.filter((c) => {
        // subject matches any affected system name part
        const matchesSystem = systemNameParts.some((n) =>
          subjectMatchesSystemOrDomain(c.subject, n),
        );
        // subject matches any affected domain
        const matchesDomain = affectedDomains.some((d) =>
          subjectMatchesSystemOrDomain(c.subject, d),
        );
        return matchesSystem || matchesDomain;
      });

      matchingChanges.forEach((c, i) => {
        const ev: Evidence[] = [
          evidence(
            'artifact-field',
            c.id,
            `Change "${c.id}" (${c.kind}) subject "${c.subject}" is in the affected radius`,
          ),
        ];
        const conf = computeConfidence(rule.baseConfidence, ev);
        results.push({
          id: `RC02-${i + 1}`,
          rule: rule.id,
          category: rule.category,
          cause: rule.title,
          detail: `Change "${c.id}" (${c.kind}): "${c.subject}" — ${c.detail}`,
          confidence: conf,
          connection: 'CONNECTED',
          evidence: ev,
        });
      });
    }

    // ── RC03: Dependency-path propagation (fires ONCE) ─────────────────────────
    if (
      input.affected.systems.length > 1 &&
      input.symptom.anchors.length > 0
    ) {
      const rule = ruleById('RC03');
      const cited = input.affected.systems.slice(0, 3);
      const ev: Evidence[] = cited.map((sysId) =>
        evidence(
          'graph-node',
          sysId,
          `Affected system "${sysId}" is on the dependency path from the symptom anchor`,
        ),
      );
      const conf = computeConfidence(rule.baseConfidence, ev);
      results.push({
        id: 'RC03-1',
        rule: rule.id,
        category: rule.category,
        cause: rule.title,
        detail: `${input.affected.systems.length} affected systems with anchors [${input.symptom.anchors.join(', ')}] indicate propagation through: ${cited.join(', ')}.`,
        confidence: conf,
        connection: 'CONNECTED',
        evidence: ev,
      });
    }

    // ── RC04: Single point of failure implicated ──────────────────────────────
    {
      const rule = ruleById('RC04');
      input.structure.spofs.forEach((spofId, i) => {
        const ev: Evidence[] = [
          evidence(
            'graph-node',
            spofId,
            `SPOF node "${spofId}" is implicated in the affected system set`,
          ),
        ];
        const conf = computeConfidence(rule.baseConfidence, ev);
        results.push({
          id: `RC04-${i + 1}`,
          rule: rule.id,
          category: rule.category,
          cause: rule.title,
          detail: `Structural SPOF "${spofId}" — its failure can explain a broad symptom across multiple consumers.`,
          confidence: conf,
          connection: 'CONNECTED',
          evidence: ev,
        });
      });
    }

    // ── RC05: Queue consumer gap ──────────────────────────────────────────────
    if (RC05_KINDS.has(input.symptom.kind)) {
      const rule = ruleById('RC05');
      input.structure.consumerlessQueues.forEach((queueId, i) => {
        const ev: Evidence[] = [
          evidence(
            'graph-node',
            queueId,
            `Queue "${queueId}" has no wired consumer (structural) — backlog is expected`,
          ),
        ];
        const conf = computeConfidence(rule.baseConfidence, ev);
        results.push({
          id: `RC05-${i + 1}`,
          rule: rule.id,
          category: rule.category,
          cause: rule.title,
          detail: `Queue "${queueId}" has zero structural consumers; symptom "${input.symptom.kind}" is consistent with an unprocessed backlog.`,
          confidence: conf,
          connection: 'CONNECTED',
          evidence: ev,
        });
      });
    }

    // ── RC06: Missing operational credentials (cap 3) ─────────────────────────
    {
      const rule = ruleById('RC06');
      const capped = input.notConnectedSignals.slice(0, 3);
      capped.forEach((sig, i) => {
        const ev: Evidence[] = [notConnected(sig.signal, sig.source)];
        const conf = computeConfidence(rule.baseConfidence, ev);
        results.push({
          id: `RC06-${i + 1}`,
          rule: rule.id,
          category: rule.category,
          cause: rule.title,
          detail: `Live signal "${sig.signal}" is NOT_CONNECTED (requires ${sig.source}) — misconfiguration or missing env is plausible.`,
          confidence: conf,
          connection: 'NOT_CONNECTED',
          evidence: ev,
        });
      });
    }

    // ── RC07: External provider dependency ────────────────────────────────────
    if (RC07_KINDS.has(input.symptom.kind)) {
      const rule = ruleById('RC07');
      input.externalProviders.forEach((provider, i) => {
        const ev: Evidence[] = [
          evidence(
            'graph-node',
            provider,
            `External provider "${provider}" is on the affected path; live status unverified`,
          ),
        ];
        const conf = computeConfidence(rule.baseConfidence, ev);
        results.push({
          id: `RC07-${i + 1}`,
          rule: rule.id,
          category: rule.category,
          cause: rule.title,
          detail: `External provider "${provider}" is depended on by the affected path; live availability is NOT_CONNECTED and cannot be confirmed.`,
          confidence: conf,
          connection: 'CONNECTED',
          evidence: ev,
        });
      });
    }

    // ── RC08: Cycle in the dependency topology ────────────────────────────────
    {
      const rule = ruleById('RC08');
      input.structure.cycles.forEach((cycle, i) => {
        const members = cycle.join(', ');
        const ev: Evidence[] = [
          evidence(
            'graph-edge',
            members,
            `Dependency cycle detected among: ${members}`,
          ),
        ];
        const conf = computeConfidence(rule.baseConfidence, ev);
        results.push({
          id: `RC08-${i + 1}`,
          rule: rule.id,
          category: rule.category,
          cause: rule.title,
          detail: `Cycle [${members}] — failures can self-reinforce and prevent recovery.`,
          confidence: conf,
          connection: 'CONNECTED',
          evidence: ev,
        });
      });
    }

    // ── Rank: confidence desc, then rule asc, then id asc ─────────────────────
    return results.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
  }
}
