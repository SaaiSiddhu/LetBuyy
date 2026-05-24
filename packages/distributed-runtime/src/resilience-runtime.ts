export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerSnapshot {
  name: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  openedAt?: string | null;
  halfOpenAt?: string | null;
  lastFailureReason?: string | null;
}

export interface CircuitBreakerPolicy {
  failureThreshold: number;
  successThreshold: number;
  openForMs: number;
  halfOpenMaxExecutions: number;
}

export interface RetryOrchestrationPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  retryableErrors: string[];
}

export interface FallbackExecutionContract {
  fallbackName: string;
  allowedInProduction: boolean;
  degradedMode: 'read-only' | 'cached-response' | 'queue-for-later' | 'maintenance-error';
  auditRequired: true;
}

export interface ProviderHealthSnapshot {
  provider: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs?: number;
  checkedAt: string;
  reason?: string;
}

export function nextResilienceRetryDelayMs(attempt: number, policy: RetryOrchestrationPolicy): number {
  const base = Math.min(policy.initialDelayMs * 2 ** Math.max(0, attempt - 1), policy.maxDelayMs);
  const jitter = base * Math.max(0, Math.min(policy.jitterRatio, 1));
  return Math.round(base + jitter / 2);
}

export function transitionCircuitBreaker(
  snapshot: CircuitBreakerSnapshot,
  policy: CircuitBreakerPolicy,
  outcome: 'success' | 'failure' | 'time-elapsed',
  reason?: string,
  now = new Date(),
): CircuitBreakerSnapshot {
  if (snapshot.state === 'open' && outcome === 'time-elapsed') {
    const openedAt = snapshot.openedAt ? new Date(snapshot.openedAt).getTime() : now.getTime();
    if (now.getTime() - openedAt >= policy.openForMs) {
      return { ...snapshot, state: 'half-open', halfOpenAt: now.toISOString() };
    }
  }

  if (outcome === 'success') {
    const successCount = snapshot.successCount + 1;
    if (snapshot.state === 'half-open' && successCount >= policy.successThreshold) {
      return { ...snapshot, state: 'closed', successCount, failureCount: 0, openedAt: null, halfOpenAt: null };
    }
    return { ...snapshot, successCount };
  }

  if (outcome === 'failure') {
    const failureCount = snapshot.failureCount + 1;
    if (failureCount >= policy.failureThreshold) {
      return {
        ...snapshot,
        state: 'open',
        failureCount,
        successCount: 0,
        openedAt: now.toISOString(),
        lastFailureReason: reason || 'failure threshold reached',
      };
    }
    return { ...snapshot, failureCount, lastFailureReason: reason || snapshot.lastFailureReason || null };
  }

  return snapshot;
}

export function assertCircuitAllowsExecution(snapshot: CircuitBreakerSnapshot): void {
  if (snapshot.state === 'open') {
    throw new Error(`Circuit breaker ${snapshot.name} is open`);
  }
}
