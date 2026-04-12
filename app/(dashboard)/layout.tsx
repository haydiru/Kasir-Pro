import { auth } from "@/auth";
import { DashboardClientLayout } from "./client-layout";
import { getActiveAttendance } from "@/app/actions/attendance";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const attendanceRes = await getActiveAttendance();
  const actingAsCashier = attendanceRes.success && attendanceRes.data?.actingAsCashier;

  return (
    <DashboardClientLayout 
      user={session?.user} 
      actingAsCashier={!!actingAsCashier}
    >
      {children}
    </DashboardClientLayout>
  );
}
