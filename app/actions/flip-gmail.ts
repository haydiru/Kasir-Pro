"use server";

import { auth } from "@/auth";
import { syncFlipEmailsForStore, type FlipSyncResult } from "@/lib/flip-gmail-sync";

/**
 * Server Action: Tarik email Flip berdasarkan sesi pengguna aktif
 */
export async function syncFlipEmailsFromGmail(force = false): Promise<FlipSyncResult> {
  const session = await auth();
  if (!session?.user?.storeId) {
    return { error: "Unauthorized / Toko tidak ditemukan" };
  }

  // Only admins may bypass the 3-minute cooldown
  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  return await syncFlipEmailsForStore(session.user.storeId, force && isAdmin);
}
