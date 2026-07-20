import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ShareClient from "./share-client";

interface Props {
  params: Promise<{ storeId: string }>;
}

export default async function PublicEmptyItemsPage({ params }: Props) {
  const { storeId } = await params;

  // Cek apakah user sudah login dan memiliki storeId yang sama
  const session = await auth();
  if (session?.user?.storeId === storeId) {
    redirect("/empty-items");
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, timezone: true },
  });

  if (!store) {
    return notFound();
  }

  return (
    <ShareClient
      storeId={storeId}
      storeName={store.name}
      timezone={store.timezone || "Asia/Jakarta"}
    />
  );
}
