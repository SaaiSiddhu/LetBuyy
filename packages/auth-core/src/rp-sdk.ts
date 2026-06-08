import type { ActorType, SessionContract } from './index';

export interface AccessTokenRequest {
  actorType: ActorType;
  audience: string;
  scopes: string[];
  forceRefresh?: boolean;
}

export interface AccessTokenResult {
  token: string;
  expiresAt: string;
  scopes: string[];
}

export interface RelyingPartyAuthContext {
  session: SessionContract | null;
  accessToken: AccessTokenResult | null;
}

export interface RelyingPartySdk {
  getAccessToken(request: AccessTokenRequest): Promise<AccessTokenResult | null>;
  getAuthContext(): Promise<RelyingPartyAuthContext>;
  requireRealm(realm: ActorType): Promise<SessionContract>;
}
