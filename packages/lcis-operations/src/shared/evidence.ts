/**
 * OperationalEvidenceBuilder — typed Evidence constructors pinning each operational fact to
 * its real artifact source. Wraps lcis-core's evidence()/notConnected() (no new evidence model).
 */
import { type Evidence, evidence, notConnected } from '@letbuyy/lcis-core';

export class OperationalEvidenceBuilder {
  artifact(name: string, ref: string, detail: string): Evidence {
    return evidence('artifact-field', ref, detail, name.includes('/') ? name : `graphify-out/${name}.json`);
  }
  worker(name: string, detail: string): Evidence {
    return evidence('worker', name, detail, 'graphify-out/runtime-intel.json');
  }
  table(name: string, detail: string): Evidence {
    return evidence('table', name, detail, 'graphify-out/db-intel.json');
  }
  rpc(name: string, detail: string): Evidence {
    return evidence('rpc', name, detail, 'graphify-out/db-intel.json');
  }
  doc(ref: string, detail: string, source: string): Evidence {
    return evidence('doc', ref, detail, source);
  }
  /** Honest absence — a live value that needs credentials. Never fabricates the value. */
  notConnected(ref: string, requiresEnvVar: string): Evidence {
    return notConnected(ref, requiresEnvVar);
  }
}
