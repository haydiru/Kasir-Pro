"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Login gagal. Email atau PIN salah.";
        default:
          return "Terjadi kesalahan sistem.";
      }
    }
    throw error;
  }
}

export async function logOut() {
  await signOut({ redirectTo: "/login" });
}

export async function changePin(prevState: string | undefined, formData: FormData) {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.email) return "Unauthorized.";

  const oldPin = formData.get("oldPin") as string;
  const newPin = formData.get("newPin") as string;
  const confirmPin = formData.get("confirmPin") as string;

  if (newPin !== confirmPin) return "PIN Baru dan Konfirmasi PIN tidak cocok.";
  if (newPin.length < 4) return "PIN baru minimal 4 angka.";

  const { prisma } = await import("@/lib/prisma");
  const bcrypt = await import("bcryptjs");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return "User tidak ditemukan.";

  const isValid = await bcrypt.compare(oldPin, user.pin);
  if (!isValid) return "PIN Lama salah.";

  const hashedNewPin = await bcrypt.hash(newPin, 10);
  await prisma.user.update({
    where: { email: session.user.email },
    data: { pin: hashedNewPin },
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

  const { prisma } = await import("@/lib/prisma");

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return "Email sudah terdaftar di sistem.";

  const bcrypt = await import("bcryptjs");
  const hashedPin = await bcrypt.hash(pin, 10);

  try {
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
      await tx.user.create({
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
    });

    return "SUCCESS";
  } catch (error) {
    console.error(error);
    return "Terjadi kesalahan sistem saat mendaftarkan toko.";
  }
}
