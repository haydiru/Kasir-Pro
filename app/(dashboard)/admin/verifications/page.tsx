import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { VerificationsClient } from "./verifications-client";

export default async function AdminVerificationsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  const storeId = session.user.storeId;
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      timezone: true,
      shiftSettings: {
        select: { name: true, startTime: true, endTime: true }
      }
    }
  });
  const timezone = store?.timezone || "Asia/Jakarta";
  const shiftSettings = store?.shiftSettings || [];

  // Retrieve reports matching specific statuses
  const reports = await prisma.shiftReport.findMany({
    where: { 
      storeId,
      status: { in: ["Submitted", "Verified"] }
    },
    include: {
      user: true,
      verifiedBy: true,
      store: true,
      digitalTransactions: true,
      expenditures: true
    },
    orderBy: { submittedAt: 'desc' },
  });

  // Separate the reports locally
  const submittedReports = reports.filter(r => r.status === "Submitted");
  const verifiedReports = reports.filter(r => r.status === "Verified").slice(0, 50); // limit

  // Fetch Flip webhooks to pass to VerificationsClient for smart multi-strategy matching
  const flipWebhooks = await prisma.flipWebhook.findMany({
    where: { storeId },
    select: {
      id: true,
      flipId: true,
      serviceType: true,
      nominal: true,
      customerName: true,
      customerNumber: true,
      bankOrProvider: true,
      transactionTime: true,
    },
    orderBy: { transactionTime: 'desc' },
    take: 500,
  });

  const serializedFlips = flipWebhooks.map(fw => ({
    ...fw,
    transactionTime: fw.transactionTime.toISOString()
  }));

  const unmatched = await prisma.flipWebhook.findMany({
    where: {
      storeId,
      excluded: false,
    },
    orderBy: { transactionTime: 'desc' },
    take: 500,
  });

  const unmatchedFlips = unmatched.map(fw => ({
    ...fw,
    transactionTime: fw.transactionTime.toISOString(),
    createdAt: fw.createdAt.toISOString()
  }));

  // Fetch all recorded flipIds in this store to map to their respective reportIds
  const allUsedDigitalTxs = await prisma.digitalTransaction.findMany({
    where: {
      report: { storeId },
      flipId: { not: null },
    },
    select: { flipId: true, reportId: true },
  });

  const usedFlipMap: Record<string, string> = {};
  for (const dt of allUsedDigitalTxs) {
    const cleanId = (dt.flipId?.replace(/^#/, "") || "").trim().toUpperCase();
    if (cleanId) {
      usedFlipMap[cleanId] = dt.reportId;
    }
  }

  return (
    <VerificationsClient 
      submittedReports={submittedReports}
      verifiedReports={verifiedReports}
      unmatchedFlips={unmatchedFlips}
      flipWebhooks={serializedFlips}
      usedFlipMap={usedFlipMap}
      shiftSettings={shiftSettings}
      timezone={timezone}
    />
  );
}
