/**
 * ExecutionEvidenceBuilder — typed Evidence constructors that pin each execution fact to its
 * source: the EINS package (tasks/agents/graph), the reused prior engines (the `reuse()` citation
 * — EAOS's compose-not-duplicate proof), governance gates, or an honest NOT_CONNECTED live source.
 * Wraps lcis-core's evidence()/notConnected() (no new evidence model).
 */
import { type Evidence, evidence, notConnected } from '@letbuyy/lcis-core';

export class ExecutionEvidenceBuilder {
  task(id: string, detail: string): Evidence {
    return evidence('graph-node', `task:${id}`, detail, 'lcis-engineering:EngineeringPackage.tasks');
  }
  agent(id: string, detail: string): Evidence {
    return evidence('graph-node', `agent:${id}`, detail, 'lcis-engineering:AgentPlan');
  }
  gate(name: string, detail: string): Evidence {
    return evidence('validator', name, detail, 'lcis-governance');
  }
  /** The composition citation: EAOS reuses a prior system's symbol rather than reimplementing it. */
  reuse(system: string, symbol: string, detail: string): Evidence {
    return evidence('artifact-field', `${system}:${symbol}`, detail, `packages/${system}`);
  }
  /** Honest absence — a live execution value with no tracking source wired. */
  notConnected(ref: string, source: string): Evidence {
    return notConnected(ref, source);
  }
}
