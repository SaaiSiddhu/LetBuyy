export type RuntimeResourceKind = 'worker' | 'queue' | 'kv' | 'r2' | 'projection' | 'replay-stream' | 'deployment-stage';

export interface DesiredRuntimeResource {
  environment: 'local' | 'dev' | 'staging' | 'production';
  kind: RuntimeResourceKind;
  name: string;
  ownerRuntime: string;
  manifestPath: string;
  checksum: string;
}

export interface ObservedRuntimeResource {
  environment: 'local' | 'dev' | 'staging' | 'production';
  kind: RuntimeResourceKind;
  name: string;
  ownerRuntime?: string | null;
  checksum?: string | null;
}

export interface RuntimeReconciliationAction {
  action: 'noop' | 'create-missing' | 'update-drift' | 'quarantine-orphan';
  environment: string;
  kind: RuntimeResourceKind;
  name: string;
  ownerRuntime: string;
  reason: string;
}

function resourceKey(resource: Pick<DesiredRuntimeResource, 'environment' | 'kind' | 'name'>): string {
  return [resource.environment, resource.kind, resource.name].join(':');
}

export function reconcileRuntimeResources(
  desired: DesiredRuntimeResource[],
  observed: ObservedRuntimeResource[],
): RuntimeReconciliationAction[] {
  const desiredByKey = new Map(desired.map((resource) => [resourceKey(resource), resource]));
  const observedByKey = new Map(observed.map((resource) => [resourceKey(resource), resource]));
  const actions: RuntimeReconciliationAction[] = [];

  for (const resource of [...desired].sort((left, right) => resourceKey(left).localeCompare(resourceKey(right)))) {
    const observedResource = observedByKey.get(resourceKey(resource));
    if (!observedResource) {
      actions.push({
        action: 'create-missing',
        environment: resource.environment,
        kind: resource.kind,
        name: resource.name,
        ownerRuntime: resource.ownerRuntime,
        reason: `desired ${resource.kind} is missing from observed runtime state`,
      });
      continue;
    }

    if (observedResource.ownerRuntime !== resource.ownerRuntime || observedResource.checksum !== resource.checksum) {
      actions.push({
        action: 'update-drift',
        environment: resource.environment,
        kind: resource.kind,
        name: resource.name,
        ownerRuntime: resource.ownerRuntime,
        reason: `observed ${resource.kind} ownership or checksum differs from manifest`,
      });
      continue;
    }

    actions.push({
      action: 'noop',
      environment: resource.environment,
      kind: resource.kind,
      name: resource.name,
      ownerRuntime: resource.ownerRuntime,
      reason: 'runtime resource matches manifest',
    });
  }

  for (const resource of [...observed].sort((left, right) => resourceKey(left).localeCompare(resourceKey(right)))) {
    if (!desiredByKey.has(resourceKey(resource))) {
      actions.push({
        action: 'quarantine-orphan',
        environment: resource.environment,
        kind: resource.kind,
        name: resource.name,
        ownerRuntime: resource.ownerRuntime || 'unknown',
        reason: `observed ${resource.kind} has no manifest owner`,
      });
    }
  }

  return actions;
}

export function assertRuntimeReconciliationClean(actions: RuntimeReconciliationAction[]): void {
  const drift = actions.filter((action) => action.action !== 'noop');
  if (drift.length > 0) {
    throw new Error(`Runtime reconciliation drift detected: ${drift.map((action) => `${action.kind}:${action.name}`).join(', ')}`);
  }
}
