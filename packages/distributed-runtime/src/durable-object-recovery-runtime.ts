import { replayPayloadChecksum } from './event-envelope-runtime';

export interface DurableObjectRecoveryBinding {
  environment: 'dev' | 'staging' | 'production';
  workerName: string;
  bindingName: string;
  className: string;
  namespaceId: string;
  migrationTag: string;
  snapshotChecksum: string;
  replayCursorChecksum: string;
}

export interface DurableObjectRecoveryPlan {
  bindingName: string;
  environments: string[];
  resurrectionChecksum: string;
  migrationLineageChecksum: string;
  recoveryChecksum: string;
}

export function compileDurableObjectRecoveryPlan(bindings: DurableObjectRecoveryBinding[]): DurableObjectRecoveryPlan[] {
  const byBinding = new Map<string, DurableObjectRecoveryBinding[]>();
  for (const binding of bindings) {
    const list = byBinding.get(binding.bindingName) || [];
    list.push(binding);
    byBinding.set(binding.bindingName, list);
  }
  return [...byBinding.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bindingName, bindingGroup]) => {
      const ordered = [...bindingGroup].sort((left, right) => left.environment.localeCompare(right.environment));
      const environments = ordered.map((binding) => binding.environment);
      const migrationLineageChecksum = replayPayloadChecksum(ordered.map((binding) => ({
        environment: binding.environment,
        namespaceId: binding.namespaceId,
        migrationTag: binding.migrationTag,
      })));
      const resurrectionChecksum = replayPayloadChecksum(ordered.map((binding) => ({
        environment: binding.environment,
        snapshotChecksum: binding.snapshotChecksum,
        replayCursorChecksum: binding.replayCursorChecksum,
      })));
      return {
        bindingName,
        environments,
        resurrectionChecksum,
        migrationLineageChecksum,
        recoveryChecksum: replayPayloadChecksum({
          bindingName,
          environments,
          migrationLineageChecksum,
          resurrectionChecksum,
        }),
      };
    });
}

export function assertDurableObjectRecovery(plans: DurableObjectRecoveryPlan[]): void {
  for (const plan of plans) {
    for (const environment of ['dev', 'staging', 'production']) {
      if (!plan.environments.includes(environment)) {
        throw new Error(`Durable Object ownership ambiguous for ${plan.bindingName}`);
      }
    }
    if (!plan.migrationLineageChecksum || !plan.resurrectionChecksum || !plan.recoveryChecksum) {
      throw new Error(`object replay corruption possible for ${plan.bindingName}`);
    }
    if (new Set(plan.environments).size !== plan.environments.length) {
      throw new Error(`env crossover exists for ${plan.bindingName}`);
    }
  }
}
