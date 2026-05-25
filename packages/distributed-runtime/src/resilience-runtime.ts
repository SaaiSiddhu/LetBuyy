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

export interface CircuitBreakerStorePort {
  load(name: string): Promise<CircuitBreakerSnapshot | null>;
  persist(snapshot: CircuitBreakerSnapshot): Promise<void>;
}

export interface ResilienceExecutionTelemetry {
  runtimeName: string;
  operationName: string;
  attempt: number;
  status: 'success' | 'retry' | 'fallback' | 'failed' | 'blocked';
  latencyMs: number;
  reason?: string;
}

export interface ResilienceTelemetryPort {
  record(event: ResilienceExecutionTelemetry): Promise<void>;
}

export interface ResilienceExecutionPolicy {
  operationName: string;
  runtimeName: string;
  circuitBreaker: CircuitBreakerPolicy;
  retry: RetryOrchestrationPolicy;
  fallback?: FallbackExecutionContract;
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

export async function waitForResilienceRetry(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function defaultCircuitSnapshot(name: string): CircuitBreakerSnapshot {
  return {
    name,
    state: 'closed',
    failureCount: 0,
    successCount: 0,
    openedAt: null,
    halfOpenAt: null,
    lastFailureReason: null,
  };
}

export class ResilienceRuntime {
  constructor(
    private readonly circuits: CircuitBreakerStorePort,
    private readonly telemetry?: ResilienceTelemetryPort,
  ) {}

  async execute<TValue>(input: {
    policy: ResilienceExecutionPolicy;
    execute: () => Promise<TValue>;
    fallback?: () => Promise<TValue>;
    classifyError?: (error: unknown) => { code: string; retryable: boolean };
  }): Promise<TValue> {
    let circuit = await this.circuits.load(input.policy.operationName) || defaultCircuitSnapshot(input.policy.operationName);
    circuit = transitionCircuitBreaker(circuit, input.policy.circuitBreaker, 'time-elapsed');
    await this.circuits.persist(circuit);

    try {
      assertCircuitAllowsExecution(circuit);
    } catch (error) {
      await this.telemetry?.record({
        runtimeName: input.policy.runtimeName,
        operationName: input.policy.operationName,
        attempt: 0,
        status: 'blocked',
        latencyMs: 0,
        reason: error instanceof Error ? error.message : 'circuit blocked execution',
      });
      if (input.fallback && input.policy.fallback?.allowedInProduction) return input.fallback();
      throw error;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= input.policy.retry.maxAttempts; attempt += 1) {
      const started = Date.now();
      try {
        const value = await input.execute();
        await this.circuits.persist(transitionCircuitBreaker(circuit, input.policy.circuitBreaker, 'success'));
        await this.telemetry?.record({
          runtimeName: input.policy.runtimeName,
          operationName: input.policy.operationName,
          attempt,
          status: 'success',
          latencyMs: Date.now() - started,
        });
        return value;
      } catch (error) {
        lastError = error;
        const classified = input.classifyError?.(error) || {
          code: error instanceof Error ? error.name : 'RUNTIME_ERROR',
          retryable: true,
        };
        const terminal = !classified.retryable || attempt >= input.policy.retry.maxAttempts;
        circuit = transitionCircuitBreaker(circuit, input.policy.circuitBreaker, 'failure', classified.code);
        await this.circuits.persist(circuit);
        await this.telemetry?.record({
          runtimeName: input.policy.runtimeName,
          operationName: input.policy.operationName,
          attempt,
          status: terminal ? 'failed' : 'retry',
          latencyMs: Date.now() - started,
          reason: classified.code,
        });
        if (terminal) break;
        await waitForResilienceRetry(nextResilienceRetryDelayMs(attempt, input.policy.retry));
      }
    }

    if (input.fallback && input.policy.fallback?.allowedInProduction) {
      await this.telemetry?.record({
        runtimeName: input.policy.runtimeName,
        operationName: input.policy.operationName,
        attempt: input.policy.retry.maxAttempts,
        status: 'fallback',
        latencyMs: 0,
        reason: input.policy.fallback.degradedMode,
      });
      return input.fallback();
    }

    throw lastError instanceof Error ? lastError : new Error('Resilience runtime execution failed');
  }
}
