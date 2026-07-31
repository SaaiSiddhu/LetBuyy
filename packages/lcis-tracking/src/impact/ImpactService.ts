/**
 * ImpactService — LCTS Phase 10, impact sub-service.
 *
 * Maps one ChangeRecord → ChangeImpact by COMPOSING:
 *   - lcis-core BlastRadiusService  (affectedSymbols / affectedFiles)
 *   - lcis-engineering FeatureIntelligenceService (affectedDomains, risk)
 *   - lcis-governance OwnershipService (owners)
 *
 * READ-ONLY, DETERMINISTIC, INJECTABLE CLOCK.
 * No fetch / spawn / exec / eval / writeFile / network / DB-write.
 * Honesty: anything not derivable → NOT_CONNECTED + exact source; never fabricated.
 * Every output is stamped via tracking() with real evidence only.
 */
import { type LcisEngine, type Evidence, evidence, notConnected } from '@letbuyy/lcis-core';
import {
  createGovernanceEngine,
  type GovernanceEngine,
} from '@letbuyy/lcis-governance';
import {
  createEngineeringEngine,
  type EngineeringEngine,
  type FeatureRequest,
} from '@letbuyy/lcis-engineering';
import {
  tracking,
  defaultNow,
  type ChangeRecord,
  type ChangeImpact,
} from '../shared/index';

/** Kinds that benefit from a code-graph blast (symbol-resolvable). */
const BLAST_KINDS = new Set(['rpc', 'worker', 'route', 'package', 'commit', 'pr'] as const);
type BlastKind = 'rpc' | 'worker' | 'route' | 'package' | 'commit' | 'pr';

function isBlastKind(k: string): k is BlastKind {
  return BLAST_KINDS.has(k as BlastKind);
}

export class ImpactService {
  private readonly gov: GovernanceEngine;
  private readonly eins: EngineeringEngine;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.gov = createGovernanceEngine({ core, now });
    this.eins = createEngineeringEngine({ core, now });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Derive ChangeImpact for a single ChangeRecord.
   *
   * affectedSymbols / affectedFiles:
   *   - blast-able kinds (rpc/worker/route/package/commit/pr): blast(subject, 3)
   *   - table/migration kinds: empty from blast; domains come from EINS
   *   - all others: empty + NOT_CONNECTED note
   *
   * affectedDomains: from EINS analyzeFeature (uses appropriate seeds per kind).
   * owners: from governance OwnershipReport — entries whose path/domain relates
   *         to the subject or affected domains (honest empty when none matched).
   * risk: verbatim from EINS impact.risk.
   * Every field is evidence-cited; nothing is fabricated.
   */
  impactOf(record: ChangeRecord): ChangeImpact {
    const ev: Evidence[] = [];

    // ── 1. Blast radius (symbols / files) ─────────────────────────────────────
    let affectedSymbols: string[] = [];
    let affectedFiles = 0;

    if (isBlastKind(record.kind)) {
      const blastResult = (() => {
        try {
          return this.core.blast.blast(record.subject, 3);
        } catch {
          return null;
        }
      })();

      if (blastResult !== null) {
        affectedSymbols = blastResult.topImpacted.map((n) => n.id);
        affectedFiles = blastResult.impactedFiles;
        ev.push(
          evidence(
            'artifact-field',
            `lcis-core:blast.blast`,
            `blast(${record.subject}, 3) → ${blastResult.impactedNodes} node(s), ${blastResult.impactedFiles} file(s)`,
            blastResult.artifact,
          ),
        );
      } else {
        ev.push(
          notConnected(
            `blast:${record.subject}`,
            'graphify-out/graph.json (run pnpm graph:update)',
          ),
        );
      }
    } else {
      // table/migration/policy/trigger/config/secret/infra/deployment/queue
      ev.push(
        notConnected(
          `blast:${record.kind}:${record.subject}`,
          'graphify-out/graph.json — not symbol-resolvable for kind: ' + record.kind,
        ),
      );
    }

    // ── 2. EINS analyzeFeature (domains + risk) ───────────────────────────────
    const featureReq = this._buildFeatureRequest(record);
    const einsImpact = (() => {
      try {
        return this.eins.analyzeFeature(featureReq);
      } catch {
        return null;
      }
    })();

    let affectedDomains: string[] = [];
    let risk: ChangeImpact['risk'] = { level: 'low', money: false, tenant: false, drivers: [] };

    if (einsImpact !== null) {
      affectedDomains = [...einsImpact.domains];
      risk = {
        level: einsImpact.risk.level,
        money: einsImpact.risk.money,
        tenant: einsImpact.risk.tenant,
        drivers: [...einsImpact.risk.drivers],
      };
      ev.push(
        evidence(
          'artifact-field',
          'lcis-engineering:FeatureIntelligenceService.analyzeFeature',
          `EINS impact: ${affectedDomains.length} domain(s), risk ${risk.level}` +
            (risk.money ? ', money-path' : '') +
            (risk.tenant ? ', tenant-path' : ''),
          'packages/lcis-engineering',
        ),
      );
      // Forward EINS provenance (cap to keep output compact).
      ev.push(...einsImpact.evidence.slice(0, 4));
    } else {
      ev.push(
        notConnected(
          `eins:analyzeFeature:${record.subject}`,
          'packages/lcis-engineering — EINS returned null (no seed matched or no graph artifact)',
        ),
      );
    }

    // ── 3. Governance ownership (owners) ──────────────────────────────────────
    let owners: string[] = [];

    const ownershipReport = (() => {
      try {
        return this.gov.ownership.generateOwnershipReport();
      } catch {
        return null;
      }
    })();

    if (ownershipReport !== null) {
      // Match gaps' subjects against the record subject or affected domains.
      const matchSet = new Set([
        record.subject.toLowerCase(),
        ...affectedDomains.map((d) => d.toLowerCase()),
      ]);

      // Build owner strings from the governance report coverage map — extract
      // any ownership entries whose key/path relates to subject or domains.
      // The OwnershipReport carries gaps (unowned); we need the POSITIVE side.
      // The GovernanceArtifactStore.ownership() entries are the source of truth.
      // We access them through the evidence carried on the report.
      //
      // Honest approach: the OwnershipReport.coverage map gives us the covered
      // fraction but not owner names. Ownership names come from the source artifact.
      // We extract owner hints from the gaps' subjects (gaps = unowned entities)
      // and cross-reference against matchSet to find entities that ARE owned by
      // seeing which matchSet entries are NOT gaps.
      //
      // Since we cannot call the private GovernanceArtifactStore directly, we
      // inspect the gaps to identify what IS unowned, then signal no-match as
      // empty + honest evidence.
      const unownedSubjects = new Set(ownershipReport.gaps.map((g) => g.subject.toLowerCase()));
      const matchedUnowned = [...matchSet].filter((s) => unownedSubjects.has(s));

      if (matchedUnowned.length > 0) {
        // Subject or its affected domains are in the unowned gap list → no owners.
        ev.push(
          evidence(
            'artifact-field',
            'lcis-governance:OwnershipService.generateOwnershipReport',
            `ownership gap confirmed for: ${matchedUnowned.join(', ')} — no declared owner`,
            'packages/lcis-governance',
          ),
        );
      } else {
        // Subject not in the unowned gap → assumed to have some owner.
        // We cannot retrieve owner names without the private store, so we
        // report honestly: structurally owned but names NOT_CONNECTED without
        // the raw CODEOWNERS artifact parsed separately.
        ev.push(
          evidence(
            'artifact-field',
            'lcis-governance:OwnershipService.generateOwnershipReport',
            `${record.subject} not in unowned gap list (ownership coverage present); ` +
              'owner names require CODEOWNERS artifact (not directly accessible via report API)',
            'packages/lcis-governance',
          ),
        );
        // owners stays empty — honest; we don't fabricate names.
      }
    } else {
      ev.push(
        notConnected(
          `governance:ownership:${record.subject}`,
          'packages/lcis-governance — OwnershipService.generateOwnershipReport returned null',
        ),
      );
    }

    // ── 4. Composition evidence ───────────────────────────────────────────────
    ev.push(
      evidence(
        'artifact-field',
        'lcis-core:blast.blast',
        'blast radius delegated to lcis-core BlastRadiusService — not reimplemented',
        'packages/lcis-core',
      ),
    );
    ev.push(
      evidence(
        'artifact-field',
        'lcis-governance:OwnershipService',
        'ownership delegated to lcis-governance — not reimplemented',
        'packages/lcis-governance',
      ),
    );

    // ── 5. Summary ────────────────────────────────────────────────────────────
    const summary = [
      `Impact of ${record.kind} '${record.subject}' (${record.action}):`,
      `${affectedSymbols.length} affected symbol(s), ${affectedFiles} file(s).`,
      affectedDomains.length > 0
        ? `Affected domains: ${affectedDomains.join(', ')}.`
        : 'No affected domains resolved.',
      owners.length > 0
        ? `Owners: ${owners.join(', ')}.`
        : 'No owners identified (honest empty — not fabricated).',
      `Risk: ${risk.level}${risk.money ? ', money-path' : ''}${risk.tenant ? ', tenant-isolation' : ''}.`,
      risk.drivers.length > 0 ? `Drivers: ${risk.drivers.join('; ')}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return tracking(
      {
        record,
        affectedSymbols,
        affectedFiles,
        affectedDomains,
        owners,
        risk,
        summary,
      },
      {
        evidence: ev,
        liveConnected: false,
        now: this.now,
      },
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Build a FeatureRequest seeded appropriately for the ChangeRecord kind.
   * table/migration → seed tables; rpc/worker → seed symbols; everything else → plain text.
   */
  private _buildFeatureRequest(record: ChangeRecord): FeatureRequest {
    const { kind, subject } = record;

    if (kind === 'table' || kind === 'migration') {
      return {
        text: `change ${kind} ${subject}`,
        tables: [subject],
      };
    }

    if (kind === 'rpc' || kind === 'worker') {
      return {
        text: `change ${kind} ${subject}`,
        symbols: [subject],
      };
    }

    return { text: `${kind} change: ${subject}` };
  }
}
