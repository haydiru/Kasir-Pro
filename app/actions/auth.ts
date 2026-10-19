"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity, logActivitySafe } from "@/lib/activity-log";

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  const email = (formData.get("email") as string || "").trim().toLowerCase();

  // Proteksi Bruteforce & DDoS (ISO 27001 & OWASP): Maksimal 5 percobaan per menit per email
  if (email) {
    const rateCheck = checkRateLimit(`login_${email}`, { limit: 5, windowMs: 60 * 1000 });
    if (!rateCheck.success) {
      const waitSec = Math.ceil(rateCheck.resetInMs / 1000);
      return `Batas percobaan login terlampaui. Silakan tunggu ${waitSec} detik demi keamanan sistem.`;
    }
  }

  let isSuccess = false;
  let errorMessage = "";

  try {
    const data = Object.fromEntries(formData);
    // Use redirect: false to handle it manually and avoid NEXT_REDIRECT inside catch
    const result = await signIn("credentials", { ...data, redirect: false });
    
    if (result?.error) {
      errorMessage = "Login gagal. Email atau PIN salah.";
    } else {
      isSuccess = true;
    }
  } catch (error: any) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          errorMessage = "Login gagal. Email atau PIN salah.";
          break;
        case "CallbackRouteError":
          errorMessage = "Terjadi kesalahan sistem pada rute autentikasi.";
          break;
        default:
          errorMessage = `Terjadi kesalahan sistem: ${error.type}`;
      }
    } else {
      console.error("Unexpected Auth Error:", error);
      errorMessage = "Terjadi kesalahan koneksi sistem.";
    }
  }

  if (isSuccess) {
    // Clear router cache to ensure session is recognized everywhere
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return errorMessage;
}

export async function logOut() {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (session?.user?.id) {
    const { prisma } = await import("@/lib/prisma");
    await logActivitySafe(prisma, {
      actor: session.user,
      action: "LOGOUT",
      entityType: "User",
      entityId: session.user.id,
      summary: `${session.user.name} logout`,
    });
  }
  revalidatePath("/", "layout");
  await signOut({ redirectTo: "/login" });
}

export async function changePin(prevState: string | undefined, formData: FormData) {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.email) return "Unauthorized.";

  const rateCheck = checkRateLimit(`changepin_${session.user.id}`, { limit: 5, windowMs: 60 * 1000 });
  if (!rateCheck.success) {
    const waitSec = Math.ceil(rateCheck.resetInMs / 1000);
    return `Batas percobaaan ganti PIN terlampaui. Silakan tunggu ${waitSec} detik.`;
  }

  const oldPin = formData.get("oldPin") as string;
  const newPin = formData.get("newPin") as string;
  const confirmPin = formData.get("confirmPin") as string;

  if (newPin !== confirmPin) return "PIN Baru dan Konfirmasi PIN tidak cocok.";
  if (newPin.length < 4) return "PIN baru minimal 4 angka.";

  const { prisma } = await import("@/lib/prisma");
  const bcrypt = await import("bcryptjs");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return "User tidak ditemukan.";

  const actor = { id: user.id, name: user.name, role: user.role, storeId: user.storeId };

  const isValid = await bcrypt.compare(oldPin, user.pin);
  if (!isValid) {
    await logActivitySafe(prisma, {
      actor,
      action: "PIN_CHANGE",
      entityType: "User",
      entityId: user.id,
      summary: `Percobaan ganti PIN gagal: PIN lama salah`,
    });
    return "PIN Lama salah.";
  }

  const hashedNewPin = await bcrypt.hash(newPin, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { email: session.user.email! },
      data: { pin: hashedNewPin },
    });
    await logActivity(tx, {
      actor,
      action: "PIN_CHANGE",
      entityType: "User",
      entityId: user.id,
      summary: `${user.name} mengganti PIN sendiri`,
    });
  });

  return "SUCCESS";
}

export async function registerStore(prevState: string | undefined, formData: FormData) {
  const storeName = formData.get("storeName") as string;
  const storeAddress = formData.get("storeAddress") as string;
  const adminName = formData.get("adminName") as string;
  const email = formData.get("email") as string;
  const pin = formData.get("pin") as string;

  if (!storeName || !adminName || !email || !pin) return "Mohon isi semua data yang diwajibkan.";
  if (pin.length < 4) return "PIN minimal 4 angka.";

  try {
    const { prisma } = await import("@/lib/prisma");

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return "Email sudah terdaftar di sistem.";

    const bcrypt = await import("bcryptjs");
    const hashedPin = await bcrypt.hash(pin, 10);

    // Transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Create Store
      const store = await tx.store.create({
        data: {
          name: storeName,
          address: storeAddress,
        },
      });

      // Insert default shifts
      await tx.shiftSetting.createMany({
        data: [
          { storeId: store.id, name: "Shift Pagi", startTime: "06:00", endTime: "14:00" },
          { storeId: store.id, name: "Shift Sore", startTime: "14:00", endTime: "22:00" },
        ],
      });

      // Create Admin User
      const admin = await tx.user.create({
        data: {
          storeId: store.id,
          name: adminName,
          email: email,
          role: "super_admin",
          pin: hashedPin,
          payrollCycleStart: 25,
          payrollCycleEnd: 24,
        },
      });

      await logActivity(tx, {
        actor: { id: admin.id, name: admin.name, role: admin.role, storeId: store.id },
        action: "CREATE",
        entityType: "Store",
        entityId: store.id,
        summary: `Pendaftaran toko baru "${store.name}" dengan super admin ${admin.email}`,
        after: { store: { name: store.name, address: store.address }, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } },
      });
    });

    return "SUCCESS";
  } catch (error: any) {
    console.error("Register Error:", error);
    return "Gagal mendaftar: Kesalahan koneksi database.";
  }
}
