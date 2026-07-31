/**
 * GovernanceEvidenceBuilder — typed Evidence constructors that pin each governance fact
 * to its real artifact source. Wraps lcis-core's evidence() (no new evidence model).
 */
import { type Evidence, evidence } from '@letbuyy/lcis-core';

const DB = 'graphify-out/db-intel.json';
const DOMAIN = 'graphify-out/domain-intel.json';
const INFRA = 'graphify-out/infra-intel.json';
const MEMORY = 'graphify-out/memory-intel.json';

export class GovernanceEvidenceBuilder {
  table(name: string, detail: string): Evidence {
    return evidence('table', name, detail, DB);
  }
  rpc(name: string, detail: string): Evidence {
    return evidence('rpc', name, detail, DB);
  }
  policy(name: string, detail: string): Evidence {
    return evidence('policy', name, detail, DB);
  }
  domain(key: string, detail: string): Evidence {
    return evidence('artifact-field', `domain:${key}`, detail, DOMAIN);
  }
  worker(name: string, detail: string): Evidence {
    return evidence('worker', name, detail, INFRA);
  }
  ownership(path: string, detail: string): Evidence {
    return evidence('artifact-field', `ownership:${path}`, detail, INFRA);
  }
  migration(ref: string, detail: string): Evidence {
    return evidence('migration', ref, detail, MEMORY);
  }
  field(ref: string, detail: string, source: string): Evidence {
    return evidence('artifact-field', ref, detail, source);
  }
}
