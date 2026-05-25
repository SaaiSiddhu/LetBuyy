import { replayPayloadChecksum } from './event-envelope-runtime';

export interface FailureDomain {
  domainId: string;
  isolationKind: 'runtime' | 'rollback' | 'queue' | 'replay' | 'projection' | 'deployment' | 'reconciliation';
  ownerRuntime: string;
  containmentZone: string;
  blastRadiusBoundary: string;
  recoveryBoundary: string;
}

export interface FailureDomainManifest {
  domains: FailureDomain[];
  containmentChecksum: string;
}

export function compileFailureDomainManifest(domains: FailureDomain[]): FailureDomainManifest {
  const ordered = [...domains].sort((left, right) => left.domainId.localeCompare(right.domainId));
  return {
    domains: ordered,
    containmentChecksum: replayPayloadChecksum(ordered),
  };
}

export function assertFailureDomainsContained(manifest: FailureDomainManifest): void {
  const ids = new Set<string>();
  const containmentByOwner = new Map<string, string>();
  for (const domain of manifest.domains) {
    if (ids.has(domain.domainId)) throw new Error(`Failure domain duplicate id: ${domain.domainId}`);
    ids.add(domain.domainId);
    if (!domain.blastRadiusBoundary || !domain.recoveryBoundary) {
      throw new Error(`Failure blast radius undefined: ${domain.domainId}`);
    }
    const key = `${domain.ownerRuntime}:${domain.isolationKind}`;
    const existing = containmentByOwner.get(key);
    if (existing && existing !== domain.containmentZone) {
      throw new Error(`Failure containment zones overlap: ${key}`);
    }
    containmentByOwner.set(key, domain.containmentZone);
  }
}
