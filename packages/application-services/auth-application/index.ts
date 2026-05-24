import type { ActorIdentity, SessionContract, SignInInput, SignUpInput } from '@letbuyy/auth-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';

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
