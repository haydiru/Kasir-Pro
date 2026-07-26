import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFlipTransactions } from "@/app/actions/flip";
import { FlipTransactionsClient } from "./flip-client";

export default async function FlipTransactionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const res = await getFlipTransactions(month, year);
  const transactions = res.success && res.data ? res.data : [];

  return (
    <FlipTransactionsClient
      initialTransactions={transactions}
      initialMonth={month}
      initialYear={year}
    />
  );
}
