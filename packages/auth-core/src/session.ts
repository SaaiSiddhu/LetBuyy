import type { ActorIdentity, SessionContract, SessionKind } from './index';

export interface SessionCreateInput {
  actor: ActorIdentity;
  kind: SessionKind;
  deviceId?: string;
  absoluteTtlSeconds?: number;
  idleTtlSeconds?: number;
}

export interface SessionRefreshInput {
  sessionId: string;
  refreshToken: string;
  deviceId?: string;
}

export interface SessionService {
  create(input: SessionCreateInput): Promise<SessionContract>;
  validate(sessionToken: string): Promise<SessionContract | null>;
  refresh(input: SessionRefreshInput): Promise<SessionContract>;
  revoke(sessionId: string, reason: string): Promise<void>;
  list(actorId: string): Promise<SessionContract[]>;
}
