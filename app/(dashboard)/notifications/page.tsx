import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNotifications } from "@/app/actions/notifications";
import { NotificationsClient } from "./notifications-client";

export const metadata = {
  title: "Notifikasi - KasirPro",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const res = await getNotifications(50);
  const initialNotifications = res.success && res.data ? res.data.notifications : [];
  const initialUnreadCount = res.success && res.data ? res.data.unreadCount : 0;

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      <NotificationsClient
        initialNotifications={initialNotifications}
        initialUnreadCount={initialUnreadCount}
      />
    </div>
  );
}
