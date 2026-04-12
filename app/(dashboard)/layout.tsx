import { auth } from "@/auth";
import { DashboardClientLayout } from "./client-layout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <DashboardClientLayout user={session?.user}>
      {children}
    </DashboardClientLayout>
  );
}
