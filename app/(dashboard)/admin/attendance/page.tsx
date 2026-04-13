import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminAttendanceHistory } from "@/app/actions/attendance";
import { getStoreEmployeesShort } from "@/app/actions/admin";
import { AttendanceHistoryClient } from "./attendance-history-client";

export default async function AdminAttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId }
  });
  const timezone = store?.timezone || "Asia/Jakarta";

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentYear = now.getFullYear();

  const historyRes = await getAdminAttendanceHistory({ 
    month: currentMonth, 
    year: currentYear 
  });
  const employeesRes = await getStoreEmployeesShort();

  const initialData = (historyRes.success && historyRes.data) ? (historyRes.data as { logs: any[], shiftSettings: any[] }) : { logs: [], shiftSettings: [] };
  const employees = (employeesRes.success && employeesRes.data) ? (employeesRes.data as any[]) : [];

  return (
    <AttendanceHistoryClient 
      initialLogs={initialData.logs} 
      initialShiftSettings={initialData.shiftSettings}
      employees={employees}
      timezone={timezone}
      initialMonth={currentMonth}
      initialYear={currentYear}
    />
  );
}
