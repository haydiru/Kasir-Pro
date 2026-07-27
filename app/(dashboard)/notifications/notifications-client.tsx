"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  CheckCheck, 
  Inbox, 
  ExternalLink, 
  CheckCircle2, 
  Clock,
  Filter
} from "lucide-react";
import { markAsRead, markAllAsRead } from "@/app/actions/notifications";
import { toast } from "sonner";
import { formatDateTime, cn } from "@/lib/utils";

interface NotificationsClientProps {
  initialNotifications: any[];
  initialUnreadCount: number;
}

export function NotificationsClient({
  initialNotifications,
  initialUnreadCount,
}: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<any[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const handleMarkAsRead = async (id: string, link?: string) => {
    const res = await markAsRead(id);
    if (res.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (link) {
        router.push(link);
      }
    }
  };

  const handleMarkAllRead = async () => {
    setIsProcessing(true);
    const res = await markAllAsRead();
    if (res.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("Semua notifikasi ditandai sudah dibaca");
    } else {
      toast.error(res.error || "Gagal memperbarui notifikasi");
    }
    setIsProcessing(false);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Pusat Notifikasi</h1>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="font-bold">
                  {unreadCount} Belum Dibaca
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Kelola dan tinjau semua pemberitahuan sistem Anda
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isProcessing}
            className="gap-2 border-primary/20 hover:bg-primary/5 text-primary"
          >
            <CheckCheck className="h-4 w-4" />
            Tandai Semua Dibaca
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={filter === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilter("all")}
          className="rounded-full text-xs font-semibold"
        >
          Semua ({notifications.length})
        </Button>
        <Button
          variant={filter === "unread" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilter("unread")}
          className="rounded-full text-xs font-semibold gap-1.5"
        >
          Belum Dibaca
          {unreadCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground">
              <Inbox className="h-6 w-6 opacity-40" />
            </div>
            <h3 className="font-semibold text-base">Tidak ada notifikasi</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {filter === "unread"
                ? "Semua notifikasi Anda sudah dibaca 🎉"
                : "Belum ada notifikasi yang diterima saat ini."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "transition-all duration-200 border-0 shadow-sm overflow-hidden hover:shadow-md",
                !n.isRead ? "bg-primary/[0.03] border-l-4 border-l-primary" : "bg-card"
              )}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-base font-bold", !n.isRead ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <Badge className="bg-primary/20 text-primary border-0 text-[10px] font-bold">
                          Baru
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground/70 pt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {new Date(n.createdAt).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                    {n.link && (
                      <Button
                        size="sm"
                        variant={!n.isRead ? "default" : "outline"}
                        className="gap-1.5 text-xs"
                        onClick={() => handleMarkAsRead(n.id, n.link)}
                      >
                        Lihat Detail
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!n.isRead && !n.link && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => handleMarkAsRead(n.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Tandai Dibaca
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
