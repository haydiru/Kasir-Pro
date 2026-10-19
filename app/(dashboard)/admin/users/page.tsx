import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { UsersClient } from "./users-client";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // Get Store details
  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId }
  });

  if (!store) {
    redirect("/login");
  }

  // Fetch only users that belong to this exact store
  const users = await prisma.user.findMany({
    where: { storeId: session.user.storeId },
    // Never send the PIN hash to the browser
    select: {
      id: true,
      storeId: true,
      name: true,
      email: true,
      role: true,
      payrollCycleStart: true,
      payrollCycleEnd: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  return <UsersClient initialUsers={users} storeName={store.name} currentUserRole={session.user.role} />;
}
