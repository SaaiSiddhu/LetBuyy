/**
 * RetryPolicy — deterministic exponential backoff for READ operations. Delays are a pure
 * function of the attempt number (no jitter by default — determinism first; optional jitter
 * is seeded, never Math.random). The sleep function is injectable so tests never wait.
 * Retrying never changes what is read — reads are idempotent by the GET-only contract.
 */
export interface RetryPolicy {
  /** Maximum attempts INCLUDING the first (>= 1). */
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** Multiplier per attempt (2 = exponential doubling). */
  readonly factor: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  factor: 2,
};

/** The delay before retry attempt N (1-based attempt that FAILED). Pure and deterministic. */
export function retryDelayMs(policy: RetryPolicy, failedAttempt: number): number {
  const raw = policy.baseDelayMs * Math.pow(policy.factor, Math.max(0, failedAttempt - 1));
  return Math.min(policy.maxDelayMs, Math.round(raw));
}

/** Full deterministic delay schedule for a policy (length = maxAttempts - 1). */
export function retrySchedule(policy: RetryPolicy): readonly number[] {
  const out: number[] = [];
  for (let attempt = 1; attempt < policy.maxAttempts; attempt++) {
    out.push(retryDelayMs(policy, attempt));
  }
  return out;
}

export interface RetryOutcome<T> {
  readonly ok: boolean;
  readonly value: T | null;
  readonly attempts: number;
  /** Message of the final error when !ok. */
  readonly lastError: string | null;
  /** The exact delays that were applied (deterministic, auditable). */
  readonly delaysMs: readonly number[];
}

export type SleepFn = (ms: number) => Promise<void>;

const realSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a read operation with the policy. Never throws — the outcome is explicit.
 * Inject `sleep` in tests for zero-wait determinism.
 */
export async function runWithRetry<T>(
  op: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  sleep: SleepFn = realSleep,
): Promise<RetryOutcome<T>> {
  const delays: number[] = [];
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const value = await op();
      return { ok: true, value, attempts: attempt, lastError: null, delaysMs: delays };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt < policy.maxAttempts) {
        const d = retryDelayMs(policy, attempt);
        delays.push(d);
        await sleep(d);
      }
    }
  }
  return { ok: false, value: null, attempts: policy.maxAttempts, lastError, delaysMs: delays };
}
