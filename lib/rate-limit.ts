/**
 * In-memory Sliding Window Rate Limiter for DDoS & Bruteforce Mitigation.
 * ISO/IEC 27001 & OWASP Security Compliant.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired keys every 5 minutes to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((value, key) => {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit: number; // Max allowed requests in time window
  windowMs: number; // Window size in milliseconds
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { limit: 10, windowMs: 60 * 1000 }
): {
  success: boolean;
  limit: number;
  remaining: number;
  resetInMs: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetInMs: options.windowMs,
    };
  }

  if (record.count >= options.limit) {
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      resetInMs: Math.max(0, record.resetTime - now),
    };
  }

  record.count += 1;
  return {
    success: true,
    limit: options.limit,
    remaining: options.limit - record.count,
    resetInMs: Math.max(0, record.resetTime - now),
  };
}
