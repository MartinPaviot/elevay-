/**
 * Per-adapter rate limiter (spec 01, AC5). A token-bucket each adapter
 * constructs and OWNS — the core orchestrator never paces provider calls. Honors
 * a provider 429 Retry-After by pausing acquisitions. Deterministic given an
 * injected clock + sleep (so tests don't wait on real time).
 */
import type { RateLimiter } from "./port";

export interface TokenBucketOptions {
  /** Sustained rate: tokens added per interval. */
  tokensPerInterval: number;
  /** Interval length in ms. */
  intervalMs: number;
  /** Bucket capacity (burst). Defaults to tokensPerInterval. */
  burst?: number;
  /** Injectable for tests. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class TokenBucketLimiter implements RateLimiter {
  private readonly rate: number; // tokens per ms
  private readonly capacity: number;
  private tokens: number;
  private last: number;
  private pausedUntil = 0;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: TokenBucketOptions) {
    this.rate = opts.tokensPerInterval / opts.intervalMs;
    this.capacity = opts.burst ?? opts.tokensPerInterval;
    this.tokens = this.capacity;
    this.now = opts.now ?? (() => Date.now());
    this.last = this.now();
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private refill(): void {
    const t = this.now();
    const elapsed = t - this.last;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);
      this.last = t;
    }
  }

  /** Wait until a token is available (and any 429 pause has elapsed). */
  async acquire(): Promise<void> {
    // Honor a 429 pause first.
    const pauseLeft = this.pausedUntil - this.now();
    if (pauseLeft > 0) await this.sleep(pauseLeft);

    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Not enough tokens — wait for the next token to accrue.
    const needMs = Math.ceil((1 - this.tokens) / this.rate);
    await this.sleep(needMs);
    this.refill();
    this.tokens = Math.max(0, this.tokens - 1);
  }

  /** Provider returned 429 — pause new acquisitions for retryAfterMs. */
  onRateLimit(retryAfterMs: number): void {
    const until = this.now() + Math.max(0, retryAfterMs);
    if (until > this.pausedUntil) this.pausedUntil = until;
  }
}

/** A no-op limiter for flat-subscription providers that don't need pacing. */
export const NO_LIMIT: RateLimiter = {
  async acquire() {},
  onRateLimit() {},
};
