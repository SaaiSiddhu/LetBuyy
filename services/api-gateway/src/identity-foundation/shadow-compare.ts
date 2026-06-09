export type ShadowDecisionKind = 'auth' | 'session' | 'permission';
export type ShadowDecisionOutcome = 'allow' | 'deny';

export interface ShadowDecision {
  kind: ShadowDecisionKind;
  outcome: ShadowDecisionOutcome;
  reason: string;
  verifier?: string;
  realm?: string;
  sessionId?: string;
}

export interface ShadowComparison {
  kind: ShadowDecisionKind;
  legacy: ShadowDecision;
  candidate: ShadowDecision;
  diverged: boolean;
  returned: ShadowDecision;
}

export function compareShadowDecision(legacy: ShadowDecision, candidate: ShadowDecision): ShadowComparison {
  return {
    kind: legacy.kind,
    legacy,
    candidate,
    diverged: legacy.outcome !== candidate.outcome || legacy.realm !== candidate.realm,
    returned: legacy,
  };
}

export interface LegacyPathCounter {
  verifier: 'internal-session-hmac' | 'internal-identity-hmac' | 'supabase-bearer' | 'customer-session';
  count: number;
}

export function incrementLegacyPathCounter(counter: LegacyPathCounter): LegacyPathCounter {
  return { ...counter, count: counter.count + 1 };
}
