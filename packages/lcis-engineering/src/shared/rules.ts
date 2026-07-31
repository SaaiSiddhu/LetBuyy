/**
 * EngineeringRuleRegistry — the construction gates E001..E008 a feature must satisfy at LetBuyy.
 * Each maps to the governance rule (R001..R008) it operationalizes; EINS evaluates them by
 * COMPOSING lcis-governance's ComplianceService — the registry is the engineering framing.
 */
import type { EngineeringLayer, Severity } from './types';

export interface EngineeringRule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly layer: EngineeringLayer;
  /** The governance rule this gate operationalizes. */
  readonly mapsTo?: string;
}

export const ENGINEERING_RULES: readonly EngineeringRule[] = [
  { id: 'E001', title: 'Money mutations route through a canonical SECURITY DEFINER RPC', description: 'Any money/state mutation in the feature must call a canonical-ledger RPC (idempotency + FOR UPDATE) — never a direct TS table write.', severity: 'critical', layer: 'rpc', mapsTo: 'R001' },
  { id: 'E002', title: 'Tenant tables enable RLS + site_id scoping', description: 'New tenant-scoped tables must force RLS and carry site_id; gateway access behind verifySiteOwnership.', severity: 'critical', layer: 'migration', mapsTo: 'R002' },
  { id: 'E003', title: 'New app API route is a gateway proxy (route-ownership lockstep)', description: 'A new app /api/* route must proxy the api-gateway /v1 route; it must never write the DB locally.', severity: 'high', layer: 'gateway' },
  { id: 'E004', title: 'New domain/service declares an owner', description: 'A new domain or critical service must have a CODEOWNERS / domain owner.', severity: 'high', layer: 'docs', mapsTo: 'R005' },
  { id: 'E005', title: 'New public routes are covered by tests', description: 'Every new public route/RPC must have at least one test.', severity: 'high', layer: 'test', mapsTo: 'R004' },
  { id: 'E006', title: 'Migrations declare a rollback path', description: 'Schema migrations should be reversible or declare a documented rollback.', severity: 'medium', layer: 'migration', mapsTo: 'R006' },
  { id: 'E007', title: 'Feature updates documentation', description: 'A new domain/feature must add governance/architecture documentation.', severity: 'medium', layer: 'docs', mapsTo: 'R007' },
  { id: 'E008', title: 'Async workers/queues have a runbook', description: 'A new worker/queue must have an operational runbook.', severity: 'high', layer: 'worker', mapsTo: 'R003' },
];

export class EngineeringRuleRegistry {
  list(): readonly EngineeringRule[] {
    return ENGINEERING_RULES;
  }
  get(id: string): EngineeringRule | undefined {
    return ENGINEERING_RULES.find((r) => r.id === id);
  }
  byLayer(layer: EngineeringLayer): readonly EngineeringRule[] {
    return ENGINEERING_RULES.filter((r) => r.layer === layer);
  }
}
