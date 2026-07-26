import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getShoppingFundsData } from "@/app/actions/shopping-funds";
import FundsClient from "./funds-client";

export const metadata = {
  title: "Laporan Belanja Pegawai (Petty Cash) - KasirPro",
  description: "Kelola pemberian uang operasional owner ke pegawai dan pelaporan belanja dengan bukti nota.",
};

export default async function ShoppingFundsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const res = await getShoppingFundsData();
  const initialData = res.success ? res.data : {
    users: [],
    funds: [],
    expenses: [],
    statistics: [],
    currentUser: { id: session.user.id, role: session.user.role, isAdmin: session.user.role === "admin" || session.user.role === "super_admin" }
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6">
      <FundsClient initialData={initialData} />
    </div>
  );
}
