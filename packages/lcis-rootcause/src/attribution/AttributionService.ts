/**
 * AttributionService — LRAS Phase 12, attribution sub-service.
 *
 * Maps a set of affected domain keys → the declared owner strings for those domains.
 * Composes lcis-governance (createGovernanceEngine) and reads domain + CODEOWNERS
 * ownership data from the governance artifact store via gov.core.store.
 *
 * READ-ONLY, DETERMINISTIC, INJECTABLE CLOCK.
 * No fetch / spawn / exec / eval / writeFile / network / DB-write.
 * Honesty: any input domain with no evidence → empty owners, never fabricated.
 * Never throws: every code path is wrapped in try/catch → [] on any failure.
 */
import { type LcisEngine } from '@letbuyy/lcis-core';
import { createGovernanceEngine, type GovernanceEngine } from '@letbuyy/lcis-governance';
import { defaultNow } from '../shared/envelope';

interface RawDomain {
  readonly key?: unknown;
  readonly owners?: unknown;
}

interface RawOwnership {
  readonly path?: unknown;
  readonly owners?: unknown;
}

/** Coerce an unknown value to a string[] — returns [] if not an array or contains non-strings. */
function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export class AttributionService {
  private readonly gov: GovernanceEngine;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.gov = createGovernanceEngine({ core, now });
  }

  /**
   * ownersFor — return the declared owner strings for all domains whose key
   * (or an ownership-entry path) contains any of the given domain keys
   * (case-insensitive substring match).
   *
   * Sources consulted (in order):
   *   1. domain-intel.json  → GovDomain.owners[] matched by GovDomain.key
   *   2. infra-intel.json   → GovOwnership.owners[] matched by GovOwnership.path
   *
   * Deduped, sorted ascending, empty when nothing matches or artifacts absent.
   * Never throws — every failure path returns [].
   */
  ownersFor(domains: readonly string[]): readonly string[] {
    try {
      if (domains.length === 0) return [];

      const lowerKeys = domains.map((d) => d.toLowerCase());
      const ownerSet = new Set<string>();

      // ── 1. Domain-intel: GovDomain.owners[] matched by key ──────────────────
      const domainIntel = this.gov.core.store.tryRead<Record<string, unknown>>('domain-intel');
      const rawDomains = Array.isArray(domainIntel?.['domains'])
        ? (domainIntel!['domains'] as RawDomain[])
        : [];

      for (const d of rawDomains) {
        const key = typeof d.key === 'string' ? d.key.toLowerCase() : '';
        if (!key) continue;
        const matches = lowerKeys.some((lk) => key.includes(lk) || lk.includes(key));
        if (matches) {
          for (const o of toStringArray(d.owners)) {
            if (o) ownerSet.add(o);
          }
        }
      }

      // ── 2. Infra-intel: GovOwnership.owners[] matched by path ───────────────
      const infraIntel = this.gov.core.store.tryRead<Record<string, unknown>>('infra-intel');
      const rawOwnership = Array.isArray(infraIntel?.['ownership'])
        ? (infraIntel!['ownership'] as RawOwnership[])
        : [];

      for (const entry of rawOwnership) {
        const path = typeof entry.path === 'string' ? entry.path.toLowerCase() : '';
        if (!path) continue;
        const matches = lowerKeys.some((lk) => path.includes(lk));
        if (matches) {
          for (const o of toStringArray(entry.owners)) {
            if (o) ownerSet.add(o);
          }
        }
      }

      return [...ownerSet].sort();
    } catch {
      return [];
    }
  }
}
