/**
 * RateLimitManager — per-key token bucket protecting provider APIs from being hammered.
 * Deterministic with an injectable clock.
 */
export class RateLimitManager {
  private readonly buckets = new Map<string, { tokens: number; last: number }>();

  constructor(
    private readonly capacity = 30,
    private readonly refillPerSec = 5,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  tryAcquire(key: string, cost = 1): boolean {
    const now = this.clock();
    const b = this.buckets.get(key) ?? { tokens: this.capacity, last: now };
    const elapsedSec = (now - b.last) / 1000;
    b.tokens = Math.min(this.capacity, b.tokens + elapsedSec * this.refillPerSec);
    b.last = now;
    if (b.tokens < cost) {
      this.buckets.set(key, b);
      return false;
    }
    b.tokens -= cost;
    this.buckets.set(key, b);
    return true;
  }

  tokens(key: string): number {
    return this.buckets.get(key)?.tokens ?? this.capacity;
  }
}
