import type { ActorIdentity, SessionContract, SignInInput, SignUpInput } from '@letbuyy/auth-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

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
