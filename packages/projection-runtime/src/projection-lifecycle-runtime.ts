import type { ProjectionIdentity } from './projection-store';

export type ProjectionLifecycleStatus = 'active' | 'stale' | 'rebuilding' | 'invalidated' | 'deleted';

export interface ProjectionLifecycleTransition {
  identity: ProjectionIdentity;
  from: ProjectionLifecycleStatus;
  to: ProjectionLifecycleStatus;
  reason: string;
  requestedBy?: string | null;
  requestedAt: string;
}

const allowedTransitions: Record<ProjectionLifecycleStatus, ProjectionLifecycleStatus[]> = {
  active: ['stale', 'invalidated', 'deleted', 'rebuilding'],
  stale: ['rebuilding', 'deleted'],
  rebuilding: ['active', 'stale', 'deleted'],
  invalidated: ['rebuilding', 'deleted'],
  deleted: [],
};

export function assertProjectionLifecycleTransition(transition: ProjectionLifecycleTransition): void {
  const allowed = allowedTransitions[transition.from] || [];
  if (!allowed.includes(transition.to)) {
    throw new Error(`Projection lifecycle cannot transition from ${transition.from} to ${transition.to}`);
  }
}

export function createProjectionLifecycleTransition(input: Omit<ProjectionLifecycleTransition, 'requestedAt'>): ProjectionLifecycleTransition {
  const transition: ProjectionLifecycleTransition = {
    ...input,
    requestedAt: new Date().toISOString(),
  };
  assertProjectionLifecycleTransition(transition);
  return transition;
}
