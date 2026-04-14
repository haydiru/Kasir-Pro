import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PrintClient } from "./print-client";

export default async function PrintReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: reportId } = await params;
  const storeId = session.user.storeId;
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { timezone: true }
  });
  const timezone = store?.timezone || "Asia/Jakarta";

  // Retrieve the report (only allowing access if it matches the user's store)
  const report = await prisma.shiftReport.findUnique({
    where: { id: reportId },
    include: {
      user: true,
      store: true,
      digitalTransactions: true,
      expenditures: true,
    }
  });

  if (!report || report.storeId !== storeId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Laporan tidak ditemukan atau Anda tidak memiliki akses.</p>
      </div>
    );
  }

  return <PrintClient report={report} timezone={timezone} />;
}
