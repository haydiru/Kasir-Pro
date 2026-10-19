import { headers } from "next/headers";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Jejak audit umum (tabel ActivityLog, append-only).
 *
 * Panggil `logActivity(tx, ...)` dengan client transaksi yang SAMA dengan perubahan
 * datanya, supaya perubahan dan log-nya tersimpan bersama atau gagal bersama.
 * PIN, hash, token, dan API key otomatis dibuang dari snapshot before/after.
 */

type Db = Prisma.TransactionClient | PrismaClient;

export type ActivityAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "VERIFY"
  | "UNVERIFY"
  | "PIN_RESET"
  | "PIN_CHANGE"
  | "ROLE_CHANGE"
  | "SETTING_CHANGE"
  | "IMPORT";

export interface ActivityActor {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  storeId?: string | null;
}

export interface LogActivityInput {
  actor?: ActivityActor | null;
  /** Default: actor.storeId */
  storeId?: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

// Kunci yang tidak boleh pernah masuk ke log (dicocokkan case-insensitive).
const SENSITIVE_KEY = /^(pin|oldpin|newpin|confirmpin|hashedpin|password|flipapikey|apikey|csrftoken)$|token|secret|hash/i;

const MAX_DEPTH = 6;
const MAX_ARRAY = 200;
const MAX_STRING = 2000;

/** Ubah nilai apa pun menjadi JSON yang aman disimpan, tanpa field sensitif. */
export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return null;
  if (depth >= MAX_DEPTH) return "[…]";

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((v) => sanitizeForLog(v, depth + 1));
    if (value.length > MAX_ARRAY) items.push(`[+${value.length - MAX_ARRAY} item lainnya]`);
    return items;
  }

  // Prisma Decimal & objek non-plain lain yang punya toJSON()
  const proto = Object.getPrototypeOf(value);
  const withToJson = value as { toJSON?: () => unknown };
  if (proto !== Object.prototype && proto !== null && typeof withToJson.toJSON === "function") {
    return sanitizeForLog(withToJson.toJSON(), depth + 1);
  }

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof v === "function") continue;
    out[key] = sanitizeForLog(v, depth + 1);
  }
  return out;
}

/**
 * Ambil hanya field yang berubah, untuk aksi UPDATE.
 * `fields` membatasi field yang dibandingkan (default: semua kunci dari `after`).
 */
export function pickChanges(
  before: object | null | undefined,
  after: object | null | undefined,
  fields?: string[]
): { before: Record<string, unknown>; after: Record<string, unknown>; changed: string[] } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const changed: string[] = [];
  const keys = fields ?? Object.keys(after ?? {});
  const b0 = (before ?? {}) as Record<string, unknown>;
  const a0 = (after ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    const bv = sanitizeForLog(b0[key]);
    const av = sanitizeForLog(a0[key]);
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[key] = bv;
      a[key] = av;
      changed.push(key);
    }
  }
  return { before: b, after: a, changed };
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = (forwarded ? forwarded.split(",")[0] : h.get("x-real-ip"))?.trim() || null;
    const userAgent = h.get("user-agent")?.slice(0, 300) || null;
    return { ip, userAgent };
  } catch {
    // Di luar konteks request (script, cron internal)
    return { ip: null, userAgent: null };
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return sanitizeForLog(value) as Prisma.InputJsonValue;
}

/**
 * Tulis satu baris log. Melempar error bila gagal, sehingga transaksi pemanggil
 * ikut dibatalkan (perubahan tanpa jejak tidak boleh tersimpan).
 */
export async function logActivity(db: Db, input: LogActivityInput): Promise<void> {
  const meta = await requestMeta();
  await db.activityLog.create({
    data: {
      storeId: input.storeId ?? input.actor?.storeId ?? null,
      actorId: input.actor?.id ?? null,
      actorName: input.actor?.name ?? null,
      actorRole: input.actor?.role ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary?.slice(0, 500) ?? null,
      before: toJson(input.before),
      after: toJson(input.after),
      reason: input.reason?.slice(0, 1000) ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
}

/**
 * Versi yang tidak pernah melempar error, untuk kejadian yang bukan perubahan data
 * (login, logout) di mana kegagalan menulis log tidak boleh memblokir user.
 */
export async function logActivitySafe(db: Db, input: LogActivityInput): Promise<void> {
  try {
    await logActivity(db, input);
  } catch (error) {
    console.error("logActivity failed:", error);
  }
}
