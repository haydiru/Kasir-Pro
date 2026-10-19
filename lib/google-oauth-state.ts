import { randomBytes, timingSafeEqual } from "crypto";

/** Cookie holding the per-login random OAuth `state` nonce (CSRF protection). */
export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
export const GOOGLE_OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes

export const GOOGLE_AUTH_TYPES = ["CALENDAR", "GMAIL"] as const;
export type GoogleAuthType = (typeof GOOGLE_AUTH_TYPES)[number];

export function parseGoogleAuthType(value: unknown): GoogleAuthType | null {
  return typeof value === "string" && (GOOGLE_AUTH_TYPES as readonly string[]).includes(value)
    ? (value as GoogleAuthType)
    : null;
}

export function createOAuthNonce(): string {
  return randomBytes(32).toString("hex");
}

export function nonceMatches(expected: string | undefined, received: string | undefined): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
