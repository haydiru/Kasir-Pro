import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Server-side authorization helpers.
 *
 * Every server action / API route that reads or mutates store data should go
 * through these helpers instead of trusting `session.user` directly. The user
 * record (role & storeId) is re-read from the database on every call so that
 * demoted or removed users lose access immediately, regardless of what is
 * stored in their JWT.
 */

export const VALID_ROLES = ["super_admin", "admin", "cashier", "pramuniaga"] as const;
export type Role = (typeof VALID_ROLES)[number];

export const ADMIN_ROLES: readonly Role[] = ["admin", "super_admin"];

/** Fields of User that are safe to send to the client (never `pin`). */
export const SAFE_USER_SELECT = { id: true, name: true, role: true } as const;

/** Fields of Store that are safe to send to the client (never `flipApiKey`). */
export const SAFE_STORE_SELECT = { id: true, name: true, address: true, timezone: true } as const;

/**
 * Error whose message is safe to show to the end user.
 * Any other error is replaced with a generic fallback by `safeErrorMessage`.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export class AccessDeniedError extends UserFacingError {
  constructor(message = "Anda tidak memiliki akses untuk melakukan tindakan ini.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string;
};

export function isValidRole(role: unknown): role is Role {
  return typeof role === "string" && (VALID_ROLES as readonly string[]).includes(role);
}

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

/** Returns the logged-in user as stored in the database, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, storeId: true },
  });
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AccessDeniedError("Unauthorized");
  return user;
}

export async function requireRole(roles: readonly string[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AccessDeniedError();
  return user;
}

export function requireAdmin(): Promise<CurrentUser> {
  return requireRole(ADMIN_ROLES);
}

/** Throws unless the record exists and belongs to the user's store. */
export function assertSameStore<T extends { storeId: string }>(
  record: T | null | undefined,
  user: Pick<CurrentUser, "storeId">,
  notFoundMessage = "Data tidak ditemukan atau Anda tidak memiliki akses."
): asserts record is T {
  if (!record || record.storeId !== user.storeId) {
    throw new AccessDeniedError(notFoundMessage);
  }
}

/** Message safe to return to the client: only `UserFacingError`s pass through. */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UserFacingError) return error.message;
  return fallback;
}

/** Parses a finite, non-negative number (rejects NaN/Infinity/negatives). */
export function toNonNegativeNumber(value: unknown, field = "Nominal"): number {
  const num = typeof value === "string" ? parseFloat(value) : Number(value ?? 0);
  if (!Number.isFinite(num) || num < 0) {
    throw new UserFacingError(`${field} tidak valid.`);
  }
  return num;
}
