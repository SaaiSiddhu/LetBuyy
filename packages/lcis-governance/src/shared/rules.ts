/**
 * GovernanceRuleRegistry — the declarative compliance rules R001..R008. The rules are
 * data (metadata + severity + category); the ComplianceService implements each check
 * against the real artifacts. No rule executes anything.
 */
import type { ComplianceRule } from './types';

export const RULES: readonly ComplianceRule[] = [
  {
    id: 'R001',
    title: 'Money mutations must use canonical RPC',
    description:
      'Functions touching money tables must be SECURITY DEFINER with idempotency and row locks (FOR UPDATE) — the canonical-ledger-only model.',
    severity: 'critical',
    category: 'architecture',
  },
  {
    id: 'R002',
    title: 'Tenant tables must have RLS',
    description: 'Every tenant-scoped table must have row-level security enabled.',
    severity: 'critical',
    category: 'security',
  },
  {
    id: 'R003',
    title: 'Critical domains must have runbooks',
    description: 'Money- or tenant-critical domains must have an operational runbook.',
    severity: 'high',
    category: 'operational',
  },
  {
    id: 'R004',
    title: 'Public APIs must have tests',
    description: 'Every public route/domain must be covered by at least one test.',
    severity: 'high',
    category: 'testing',
  },
  {
    id: 'R005',
    title: 'Critical services must have owners',
    description: 'Money- or tenant-critical domains/services must declare an owner.',
    severity: 'high',
    category: 'ownership',
  },
  {
    id: 'R006',
    title: 'Migrations must have rollback',
    description: 'Schema migrations should declare a reversible / rollback path.',
    severity: 'medium',
    category: 'operational',
  },
  {
    id: 'R007',
    title: 'Domains must have documentation',
    description: 'Every domain must have governance/architecture documentation.',
    severity: 'medium',
    category: 'governance',
  },
  {
    id: 'R008',
    title: 'Production services must have healthchecks',
    description: 'Production workers/services must expose a healthcheck / observability signal.',
    severity: 'high',
    category: 'operational',
  },
];

export class GovernanceRuleRegistry {
  list(): readonly ComplianceRule[] {
    return RULES;
  }
  get(id: string): ComplianceRule | undefined {
    return RULES.find((r) => r.id === id);
  }
  byCategory(category: ComplianceRule['category']): readonly ComplianceRule[] {
    return RULES.filter((r) => r.category === category);
  }
}
