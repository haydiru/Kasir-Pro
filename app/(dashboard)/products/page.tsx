import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProductsClient from "./products-client";
import { serialize } from "@/lib/serialize";

export const metadata = {
  title: "Master Data Barang - KasirPro",
  description: "Katalog master data barang, harga modal, harga jual, dan audit riwayat harga.",
};

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const storeId = session.user.storeId;
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { enableAiReceiptScan: true },
  });

  const [products, totalCount, unconfirmedHikes] = await Promise.all([
    prisma.product.findMany({
      where: { storeId, isActive: true },
      include: {
        priceHistory: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.product.count({
      where: { storeId, isActive: true },
    }),
    prisma.productPriceHistory.count({
      where: {
        product: { storeId, isActive: true },
        difference: { gt: 0 },
        isConfirmed: false,
      },
    }),
  ]);

  return (
    <ProductsClient
      initialProducts={serialize(products)}
      totalCount={totalCount}
      unconfirmedHikesCount={unconfirmedHikes}
      isAiScanEnabled={store?.enableAiReceiptScan ?? false}
    />
  );
}
