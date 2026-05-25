import { replayPayloadChecksum } from './event-envelope-runtime';

export interface ManifestProvenanceEntry {
  path: string;
  owner: string;
  checksum: string;
  checksumAlgorithm: 'sha256';
  parentChecksum: string | null;
  signaturePolicy: 'detached-signature-required-before-execute-mode' | 'repository-governance-checksum-only';
}

export interface ManifestProvenanceSnapshot {
  entries: ManifestProvenanceEntry[];
  ancestryChecksum: string;
  tamperDetectable: true;
}

const sha256Pattern = /^[a-f0-9]{64}$/;

export function compileManifestProvenance(entries: ManifestProvenanceEntry[]): ManifestProvenanceSnapshot {
  const ordered = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  for (const entry of ordered) {
    if (!sha256Pattern.test(entry.checksum)) {
      throw new Error(`Manifest provenance entry must use sha256 checksum: ${entry.path}`);
    }
    if (entry.parentChecksum !== null && !sha256Pattern.test(entry.parentChecksum)) {
      throw new Error(`Manifest provenance parent checksum is invalid: ${entry.path}`);
    }
  }

  return {
    entries: ordered,
    ancestryChecksum: replayPayloadChecksum(ordered),
    tamperDetectable: true,
  };
}

export function assertManifestProvenance(snapshot: ManifestProvenanceSnapshot): void {
  if (!snapshot.tamperDetectable) {
    throw new Error('Manifest provenance must be tamper-detectable');
  }
  if (!snapshot.ancestryChecksum) {
    throw new Error('Manifest provenance requires ancestry checksum');
  }
  for (const entry of snapshot.entries) {
    if (entry.signaturePolicy !== 'detached-signature-required-before-execute-mode') {
      throw new Error(`Manifest provenance must require detached signature before execute mode: ${entry.path}`);
    }
  }
}
