/**
 * The LRAS cause-hypothesis rules RC01..RC08 — declarative metadata with per-rule base
 * confidence. Services evaluate them; the base confidences are calibration constants of the
 * deterministic rule engine, adjusted only by evidence strength (never invented per-case).
 */
import type { CauseCategory } from './types';

export interface RootCauseRule {
  readonly id: string;
  readonly title: string;
  readonly category: CauseCategory;
  /** Base confidence when the rule fires with minimal evidence (0..1). */
  readonly baseConfidence: number;
  readonly description: string;
}

export const ROOT_CAUSE_RULES: readonly RootCauseRule[] = [
  { id: 'RC01', title: 'Recent money-path migration', category: 'change', baseConfidence: 0.6, description: 'A recent migration touches the money path of the affected domains.' },
  { id: 'RC02', title: 'Recent change to an affected system', category: 'change', baseConfidence: 0.5, description: 'A tracked change record targets a system inside the impact radius.' },
  { id: 'RC03', title: 'Dependency-path propagation', category: 'dependency', baseConfidence: 0.4, description: 'The symptom anchor depends on a system that is itself implicated (twin path evidence).' },
  { id: 'RC04', title: 'Single point of failure implicated', category: 'infrastructure', baseConfidence: 0.5, description: 'An affected node is a structural SPOF — its failure explains a broad symptom.' },
  { id: 'RC05', title: 'Queue consumer gap', category: 'infrastructure', baseConfidence: 0.55, description: 'An affected queue has no consumer wired (structural) — backlog is expected.' },
  { id: 'RC06', title: 'Missing operational credentials', category: 'configuration', baseConfidence: 0.45, description: 'Live signals for the affected area are NOT_CONNECTED — misconfiguration or missing env is plausible.' },
  { id: 'RC07', title: 'External provider dependency', category: 'external', baseConfidence: 0.35, description: 'The affected path depends on an external provider (Razorpay/Stripe/Resend/Cloudflare) whose live status is unverified.' },
  { id: 'RC08', title: 'Cycle in the dependency topology', category: 'dependency', baseConfidence: 0.3, description: 'The affected systems participate in a dependency cycle — failure can self-reinforce.' },
];

export class RootCauseRuleRegistry {
  list(): readonly RootCauseRule[] {
    return ROOT_CAUSE_RULES;
  }
  get(id: string): RootCauseRule | undefined {
    return ROOT_CAUSE_RULES.find((r) => r.id === id);
  }
}
