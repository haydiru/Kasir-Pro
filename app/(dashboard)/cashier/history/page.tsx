import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { HistoryClient } from "./history-client";

export default async function CashierHistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const storeId = session.user.storeId;
  const role = session.user.role;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { timezone: true }
  });
  const timezone = store?.timezone || "Asia/Jakarta";

  // Set the filter condition based on role
  // Admins see all for their store, cashier/pramuniaga see only their own
  const whereCondition = (role === "admin" || role === "super_admin") 
    ? { storeId } 
    : { storeId, userId: session.user.id };

  const reports = await prisma.shiftReport.findMany({
    where: whereCondition,
    include: {
      user: true,
      store: true,
      digitalTransactions: true,
      expenditures: true,
    },
    orderBy: { date: 'desc' }
  });

  return <HistoryClient initialReports={reports} userRole={role} timezone={timezone} />;
}
