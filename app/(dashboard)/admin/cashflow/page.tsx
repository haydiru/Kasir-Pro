import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureFinancialAccounts, getCashflowData } from "@/app/actions/cashflow";
import { CashflowClient } from "./cashflow-client";

export default async function AdminCashflowPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Pastikan setidaknya dompet default (Bank) dan Kas Admin ini tersedia
  await ensureFinancialAccounts();

  // Load data
  const dataRes = await getCashflowData();
  const accounts = dataRes.success && dataRes.accounts ? dataRes.accounts : [];
  const transactions = dataRes.success && dataRes.transactions ? dataRes.transactions : [];

  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Catatan Keuangan & Arus Kas</h2>
        <p className="text-muted-foreground mt-1">
          Pantau sirkulasi uang fisik brankas antar admin dan uang di rekening bank.
        </p>
      </div>

      <CashflowClient
        initialAccounts={accounts}
        initialTransactions={transactions}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
        timezone={"Asia/Jakarta"}
      />
    </div>
  );
}
