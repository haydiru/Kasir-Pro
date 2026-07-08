import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import BillsClient from "./bills-client";

export default async function BillsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId },
    include: { googleAuth: true },
  });

  const timezone = store?.timezone || "Asia/Jakarta";

  // Ambil semua tagihan untuk toko ini, urutkan berdasarkan jatuh tempo terdekat
  const bills = await prisma.bill.findMany({
    where: { storeId: session.user.storeId },
    include: {
      createdBy: { select: { name: true } },
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  // Ambil semua barang retur yang belum diselesaikan (PENDING / RETURNED)
  const pendingReturns = await prisma.returnedItem.findMany({
    where: {
      storeId: session.user.storeId,
      status: { in: ["PENDING", "RETURNED"] },
    },
  });

  // Serialize dates to prevent Next.js hydration/payload errors
  const serializedBills = bills.map((bill) => ({
    ...bill,
    dueDate: bill.dueDate.toISOString(),
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  }));

  const serializedReturns = pendingReturns.map((ret) => ({
    ...ret,
    createdAt: ret.createdAt.toISOString(),
    updatedAt: ret.updatedAt.toISOString(),
  }));

  return (
    <BillsClient
      initialBills={serializedBills}
      initialPendingReturns={serializedReturns}
      timezone={timezone}
      isGoogleConnected={!!store?.googleAuth}
    />
  );
}
