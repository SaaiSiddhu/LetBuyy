/**
 * EngineeringEvidenceBuilder — typed Evidence constructors. The signature helper is `reuse()`,
 * which cites the EXACT prior-system method EINS composed — making the "compose, never
 * reimplement" guarantee visible in every output's provenance. Wraps lcis-core's evidence().
 */
import { type Evidence, evidence } from '@letbuyy/lcis-core';

type PriorSystem =
  | 'lcis-core' | 'lcis-live' | 'lcis-execution' | 'lcis-governance' | 'lcis-operations';

export class EngineeringEvidenceBuilder {
  /** Cite a reused prior-system capability (the composition provenance). */
  reuse(system: PriorSystem, method: string, detail: string): Evidence {
    return evidence('artifact-field', `${system}:${method}`, detail, `packages/${system}`);
  }
  domain(key: string, detail: string): Evidence {
    return evidence('artifact-field', `domain:${key}`, detail, 'graphify-out/domain-intel.json');
  }
  table(name: string, detail: string): Evidence {
    return evidence('table', name, detail, 'graphify-out/db-intel.json');
  }
  rpc(name: string, detail: string): Evidence {
    return evidence('rpc', name, detail, 'graphify-out/db-intel.json');
  }
  task(id: string, detail: string): Evidence {
    return evidence('artifact-field', `task:${id}`, detail, 'EINS:engineering-task');
  }
  field(ref: string, detail: string, source: string): Evidence {
    return evidence('artifact-field', ref, detail, source);
  }
}
