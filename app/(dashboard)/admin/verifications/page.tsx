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
    select: { timezone: true }
  });
  const timezone = store?.timezone || "Asia/Jakarta";

  // Retrieve reports matching specific statuses
  const reports = await prisma.shiftReport.findMany({
    where: { 
      storeId,
      status: { in: ["Submitted", "Verified"] }
    },
    include: {
      user: true,
      store: true,
      digitalTransactions: true,
      expenditures: true
    },
    orderBy: { submittedAt: 'desc' },
  });

  // Separate the reports locally
  const submittedReports = reports.filter(r => r.status === "Submitted");
  const verifiedReports = reports.filter(r => r.status === "Verified").slice(0, 50); // limit

  // Fetch actual unmatched Flip webhooks to show warnings on specific reports
  const unmatched = await prisma.flipWebhook.findMany({
    where: {
      storeId,
      excluded: false,
      matched: false
    }
  });
  
  const unmatchedFlips = unmatched.map(fw => ({
    ...fw,
    transactionTime: fw.transactionTime.toISOString(),
    createdAt: fw.createdAt.toISOString()
  }));

  return (
    <VerificationsClient 
      submittedReports={submittedReports}
      verifiedReports={verifiedReports}
      unmatchedFlips={unmatchedFlips}
      timezone={timezone}
    />
  );
}
