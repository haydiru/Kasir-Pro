import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ShareClient from "./share-client";

interface Props {
  params: Promise<{ storeId: string }>;
}

export default async function PublicEmptyItemsPage({ params }: Props) {
  const { storeId } = await params;

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
