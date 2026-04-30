import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export type RateLimitConfig = {
  /** Stable namespace for the limiter (also used as Redis prefix). */
  key: string;
  /** Max requests allowed within the window. */
  limit: number;
  /** Window in seconds. */
  windowSeconds: number;
};

export type RateLimitResult =
  | { success: true; remaining: number; reset: number }
  | { success: false; remaining: 0; reset: number };

const limiterCache = new Map<string, Ratelimit>();
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redisClient;
}

function getLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${config.key}:${config.limit}:${config.windowSeconds}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
    analytics: false,
    prefix: `prepavaga:rl:${config.key}`,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

/**
 * Check whether `identifier` is allowed under `config`. Fail-open: if
 * Upstash credentials are missing or the request errors, the call is
 * allowed (we'd rather under-protect than block real users).
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const limiter = getLimiter(config);
  if (!limiter) {
    return { success: true, remaining: config.limit, reset: 0 };
  }
  try {
    const res = await limiter.limit(identifier);
    if (res.success) {
      return { success: true, remaining: res.remaining, reset: res.reset };
    }
    return { success: false, remaining: 0, reset: res.reset };
  } catch (err) {
    console.warn("[ratelimit] Upstash error, failing open:", err);
    return { success: true, remaining: config.limit, reset: 0 };
  }
}

/**
 * Per-user limits for expensive AI operations. Keep generous enough for
 * legitimate usage, tight enough that a malicious actor can't burn the
 * Gemini quota quickly.
 *
 * createPrep is the heaviest (1 prep = 6 Gemini calls: company intel + 5
 * sections). 3/h covers legitimate power-user prep cycles (each prep takes
 * 10+ min to study) and caps adversarial Pro-account abuse at ~2.2k
 * preps/month instead of 3.6k. Free users hit the lifetime cap before this.
 */
export const LIMITS = {
  createPrep: { key: "createPrep", limit: 3, windowSeconds: 3600 },
  ats: { key: "ats", limit: 10, windowSeconds: 3600 },
  cvRewrite: { key: "cvRewrite", limit: 10, windowSeconds: 3600 },
  companyIntel: { key: "companyIntel", limit: 10, windowSeconds: 3600 },
  fetchJd: { key: "fetchJd", limit: 30, windowSeconds: 3600 },
  // Auth limits — generous enough for legitimate "I mistyped" but kills
  // credential stuffing / password spraying. Bucket per ip+email so an
  // attacker rotating IPs still hits per-account limits, and an attacker
  // hammering one IP across many accounts hits per-IP-prefix limits.
  authLogin: { key: "authLogin", limit: 10, windowSeconds: 600 },
  authSignup: { key: "authSignup", limit: 5, windowSeconds: 3600 },
  passwordReset: { key: "passwordReset", limit: 3, windowSeconds: 600 },
} as const satisfies Record<string, RateLimitConfig>;

/** Format a Unix-ms reset timestamp into a human-readable PT-BR phrase. */
export function formatResetPhrase(resetMs: number): string {
  const remainingMs = Math.max(0, resetMs - Date.now());
  const minutes = Math.ceil(remainingMs / 60_000);
  if (minutes <= 1) return "alguns segundos";
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "1 hora" : `${hours} horas`;
}
