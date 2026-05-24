import type { ActorIdentity, SessionContract, SignInInput, SignUpInput } from '@letbuyy/auth-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';

export interface AuthApplicationPorts {
  resolveActorSession(command: CorrelatedCommand<{ token: string }>): Promise<SessionContract | null>;
  evaluatePermissions(command: CorrelatedCommand<{ actor: ActorIdentity; tenant?: RuntimeTenantContext; permissions: string[] }>): Promise<{ allowed: boolean; denied: string[] }>;
  startSignup(command: CorrelatedCommand<SignUpInput>): Promise<{ actor: ActorIdentity; session?: SessionContract }>;
  startSignin(command: CorrelatedCommand<SignInInput>): Promise<{ actor: ActorIdentity; session: SessionContract }>;
}

export interface AuthApplicationPolicy {
  sessionRotationRequired: boolean;
  requiresOtpForUnknownDevice: boolean;
  privilegedActorsRequireMfa: boolean;
}

export const AUTH_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  resolveActorSession: {
    name: 'auth.resolve-actor-session',
    owner: 'auth-application',
    version: '1.0.0',
    requiresTenantScope: false,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['auth', 'tenant'],
  },
  evaluatePermissions: {
    name: 'auth.evaluate-permissions',
    owner: 'auth-application',
    version: '1.0.0',
    requiresTenantScope: false,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['auth', 'tenant'],
  },
  executeIdempotentCommand: {
    name: 'auth.execute-idempotent-command',
    owner: 'auth-application',
    version: '1.0.0',
    requiresTenantScope: false,
    requiresIdempotency: true,
    emitsEvents: false,
    coordinatesDomains: ['auth', 'event'],
  },
});

export const AUTH_EXECUTION_PIPELINES = defineExecutionPipelines({
  resolveActorSession: {
    workflow: AUTH_APPLICATION_WORKFLOWS.resolveActorSession,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'none',
    asyncBoundary: 'inline',
    observabilityBoundary: 'correlation-required',
    steps: [
      { name: 'resolve-session-token', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'bind-runtime-actor', stage: 'complete', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
    ],
  },
  evaluatePermissions: {
    workflow: AUTH_APPLICATION_WORKFLOWS.evaluatePermissions,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'none',
    asyncBoundary: 'inline',
    observabilityBoundary: 'correlation-required',
    steps: [
      { name: 'resolve-actor-capabilities', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'evaluate-permission-set', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
    ],
  },
  executeIdempotentCommand: {
    workflow: AUTH_APPLICATION_WORKFLOWS.executeIdempotentCommand,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'inline',
    observabilityBoundary: 'trace-required',
    steps: [
      { name: 'normalize-idempotency-key', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
      { name: 'claim-idempotency-record', stage: 'mutate', ownsTransaction: true, emitsEvent: false, requiresIdempotency: true },
      { name: 'persist-idempotent-result', stage: 'complete', ownsTransaction: true, emitsEvent: false, requiresIdempotency: true },
    ],
  },
});

export function canonicalizeExecutionPayload(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalizeExecutionPayload(item)).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeExecutionPayload(record[key])}`)
    .join(',')}}`;
}
