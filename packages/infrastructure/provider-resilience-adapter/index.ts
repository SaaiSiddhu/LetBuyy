export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unavailable';

export interface ProviderIdentifier {
  provider: 'stripe' | 'razorpay' | 'paypal' | 'resend' | 'supabase' | 'upstash' | 'cloudflare' | 'custom';
  operation: string;
  region?: string | null;
}

export interface ProviderTimeoutGovernance {
  connectTimeoutMs: number;
  readTimeoutMs: number;
  totalTimeoutMs: number;
}

export interface ProviderRetryGovernance {
  maxAttempts: number;
  retryableStatuses: number[];
  retryableErrorCodes: string[];
  backoffMs: number;
  maxBackoffMs: number;
}

export interface ProviderFallbackPolicy {
  fallbackMode: 'none' | 'cached-response' | 'queue-for-later' | 'alternate-provider' | 'maintenance-error';
  alternateProvider?: ProviderIdentifier['provider'];
  auditRequired: true;
}

export interface ProviderResiliencePolicy {
  identifier: ProviderIdentifier;
  timeout: ProviderTimeoutGovernance;
  retry: ProviderRetryGovernance;
  fallback: ProviderFallbackPolicy;
  rateLimit: {
    retryAfterHeader: string;
    defaultRetryAfterSeconds: number;
    shedOnLimit: boolean;
  };
}

export interface ProviderHealthCheckResult {
  identifier: ProviderIdentifier;
  status: ProviderHealthStatus;
  latencyMs: number;
  checkedAt: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderExecutionTelemetry {
  provider: string;
  operation: string;
  status: 'success' | 'retry' | 'fallback' | 'failed';
  attempt: number;
  latencyMs: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderExecutionResult<TValue> {
  value?: TValue;
  status: 'success' | 'fallback' | 'failed';
  attempts: number;
  telemetry: ProviderExecutionTelemetry[];
  retryAfterSeconds?: number;
  error?: string;
}

export interface ProviderRecoveryPlan {
  provider: ProviderIdentifier['provider'];
  operation: string;
  action: 'hold' | 'retry' | 'failover' | 'degrade' | 'restore';
  retryAfterSeconds?: number;
  alternateProvider?: ProviderIdentifier['provider'];
  reason: string;
}

export interface ProviderResilienceOperationsPort {
  latestHealth(identifier: ProviderIdentifier): Promise<ProviderHealthCheckResult | null>;
  recordHealth(result: ProviderHealthCheckResult): Promise<void>;
  recordRecoveryPlan(plan: ProviderRecoveryPlan): Promise<void>;
}

export function providerBackoffMs(attempt: number, policy: ProviderRetryGovernance): number {
  return Math.min(policy.backoffMs * 2 ** Math.max(0, attempt - 1), policy.maxBackoffMs);
}

export function classifyProviderHealth(input: {
  successRate: number;
  p95LatencyMs: number;
  timeoutMs: number;
  checkedAt?: string;
  identifier: ProviderIdentifier;
}): ProviderHealthCheckResult {
  const status: ProviderHealthStatus =
    input.successRate < 0.8
      ? 'unavailable'
      : input.successRate < 0.98 || input.p95LatencyMs > input.timeoutMs
        ? 'degraded'
        : 'healthy';

  return {
    identifier: input.identifier,
    status,
    latencyMs: input.p95LatencyMs,
    checkedAt: input.checkedAt || new Date().toISOString(),
    reason: status === 'healthy' ? undefined : 'provider health threshold exceeded',
  };
}

export function decideProviderFallback(
  health: ProviderHealthCheckResult,
  policy: ProviderFallbackPolicy,
): { action: ProviderFallbackPolicy['fallbackMode']; reason: string } {
  if (health.status === 'healthy') return { action: 'none', reason: 'provider is healthy' };
  if (policy.fallbackMode === 'none') return { action: 'maintenance-error', reason: 'provider is degraded and no fallback is configured' };
  return { action: policy.fallbackMode, reason: `provider is ${health.status}` };
}

export function planProviderRecovery(
  health: ProviderHealthCheckResult,
  policy: ProviderResiliencePolicy,
): ProviderRecoveryPlan {
  if (health.status === 'healthy') {
    return {
      provider: policy.identifier.provider,
      operation: policy.identifier.operation,
      action: 'restore',
      reason: 'provider health is restored',
    };
  }

  if (policy.fallback.fallbackMode === 'alternate-provider' && policy.fallback.alternateProvider) {
    return {
      provider: policy.identifier.provider,
      operation: policy.identifier.operation,
      action: 'failover',
      alternateProvider: policy.fallback.alternateProvider,
      reason: `provider is ${health.status}; alternate provider is configured`,
    };
  }

  if (policy.fallback.fallbackMode !== 'none') {
    return {
      provider: policy.identifier.provider,
      operation: policy.identifier.operation,
      action: 'degrade',
      retryAfterSeconds: policy.rateLimit.defaultRetryAfterSeconds,
      reason: `provider is ${health.status}; degraded mode ${policy.fallback.fallbackMode} is configured`,
    };
  }

  return {
    provider: policy.identifier.provider,
    operation: policy.identifier.operation,
    action: health.status === 'degraded' ? 'retry' : 'hold',
    retryAfterSeconds: policy.rateLimit.defaultRetryAfterSeconds,
    reason: `provider is ${health.status}; no fallback is configured`,
  };
}

export class ProviderResilienceOperationsRuntime {
  constructor(private readonly operations: ProviderResilienceOperationsPort) {}

  async evaluate(policy: ProviderResiliencePolicy, syntheticHealth?: ProviderHealthCheckResult): Promise<ProviderRecoveryPlan> {
    const health = syntheticHealth || await this.operations.latestHealth(policy.identifier);
    if (!health) {
      return {
        provider: policy.identifier.provider,
        operation: policy.identifier.operation,
        action: 'retry',
        retryAfterSeconds: policy.rateLimit.defaultRetryAfterSeconds,
        reason: 'provider health is unknown',
      };
    }

    const plan = planProviderRecovery(health, policy);
    await this.operations.recordRecoveryPlan(plan);
    return plan;
  }

  async recordHealth(result: ProviderHealthCheckResult): Promise<ProviderRecoveryPlan> {
    await this.operations.recordHealth(result);
    return {
      provider: result.identifier.provider,
      operation: result.identifier.operation,
      action: result.status === 'healthy' ? 'restore' : result.status === 'degraded' ? 'retry' : 'hold',
      reason: result.reason || `provider status is ${result.status}`,
    };
  }
}

export async function executeProviderCall<TValue>(input: {
  policy: ProviderResiliencePolicy;
  call: () => Promise<TValue>;
  classifyError?: (error: unknown) => { code: string; retryable: boolean; retryAfterSeconds?: number };
  recordTelemetry?: (telemetry: ProviderExecutionTelemetry) => Promise<void>;
}): Promise<ProviderExecutionResult<TValue>> {
  const telemetry: ProviderExecutionTelemetry[] = [];
  let lastError: string | undefined;
  let retryAfterSeconds: number | undefined;

  for (let attempt = 1; attempt <= input.policy.retry.maxAttempts; attempt += 1) {
    const started = Date.now();
    try {
      const value = await withProviderTimeout(input.call(), input.policy.timeout.totalTimeoutMs);
      const event: ProviderExecutionTelemetry = {
        provider: input.policy.identifier.provider,
        operation: input.policy.identifier.operation,
        status: 'success',
        attempt,
        latencyMs: Date.now() - started,
      };
      telemetry.push(event);
      await input.recordTelemetry?.(event);
      return { value, status: 'success', attempts: attempt, telemetry };
    } catch (error) {
      const classified = input.classifyError?.(error) || {
        code: error instanceof Error ? error.name : 'PROVIDER_ERROR',
        retryable: true,
      };
      lastError = classified.code;
      retryAfterSeconds = classified.retryAfterSeconds;
      const event: ProviderExecutionTelemetry = {
        provider: input.policy.identifier.provider,
        operation: input.policy.identifier.operation,
        status: attempt >= input.policy.retry.maxAttempts || !classified.retryable ? 'failed' : 'retry',
        attempt,
        latencyMs: Date.now() - started,
        errorCode: classified.code,
      };
      telemetry.push(event);
      await input.recordTelemetry?.(event);
      if (!classified.retryable) break;
    }
  }

  if (input.policy.fallback.fallbackMode !== 'none') {
    return {
      status: 'fallback',
      attempts: telemetry.length,
      telemetry,
      retryAfterSeconds: retryAfterSeconds || input.policy.rateLimit.defaultRetryAfterSeconds,
      error: lastError,
    };
  }

  return {
    status: 'failed',
    attempts: telemetry.length,
    telemetry,
    retryAfterSeconds,
    error: lastError || 'PROVIDER_CALL_FAILED',
  };
}

export async function withProviderTimeout<TValue>(promise: Promise<TValue>, timeoutMs: number): Promise<TValue> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<TValue>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('PROVIDER_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
