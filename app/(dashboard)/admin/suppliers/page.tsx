import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SuppliersClient from "./suppliers-client";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAuthorized = ["admin", "super_admin"].includes(session.user.role);
  if (!isAuthorized) redirect("/attendance");

  const suppliers = await prisma.supplier.findMany({
    where: { storeId: session.user.storeId },
    orderBy: { nama: "asc" },
  });

  // Serialize dates for security
  const serializedSuppliers = suppliers.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <SuppliersClient
      initialSuppliers={serializedSuppliers}
      storeId={session.user.storeId}
    />
  );
}
