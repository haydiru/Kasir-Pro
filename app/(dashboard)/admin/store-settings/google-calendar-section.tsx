"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, CheckCircle2, AlertCircle, Link2, Link2Off, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";

interface Props {
  googleAuth: {
    id: string;
    expiryDate: Date | string;
  } | null;
  storeId: string;
}

export default function GoogleCalendarSection({ googleAuth, storeId }: Props) {
  const [isConnected, setIsConnected] = useState(!!googleAuth);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Membaca status sukses/gagal dari redirect API callback
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "google_connected") {
      toast.success("Google Calendar berhasil terhubung!");
      // Bersihkan search params agar tidak men-trigger toast saat reload
      router.replace("/admin/store-settings");
    } else if (error) {
      let msg = "Gagal menghubungkan Google Calendar.";
      if (error === "google_denied") msg = "Akses ditolak oleh pengguna.";
      else if (error === "token_exchange_failed") msg = "Gagal menukar token otorisasi Google.";
      else if (error === "server_configuration_error") msg = "Client ID / Secret global belum diset di server.";
      
      toast.error(msg);
      router.replace("/admin/store-settings");
    }
  }, [searchParams, router]);

  async function handleDisconnect() {
    if (!confirm("Putuskan koneksi Google Calendar toko Anda? Sinkronisasi tagihan otomatis akan dinonaktifkan.")) return;
    
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setIsConnected(false);
        toast.success("Koneksi Google Calendar berhasil diputuskan!");
        router.refresh();
      } else {
        toast.error(data.error || "Gagal memutuskan koneksi.");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi internet.");
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          Google Calendar
        </CardTitle>
        <CardDescription>
          Sinkronisasi tagihan supplier secara otomatis ke Kalender Google toko Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status Badge */}
        <div className="flex items-center justify-between bg-muted/40 p-3.5 rounded-xl border border-border/50">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status Integrasi</span>
          {isConnected ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold gap-1 px-2.5 py-0.5">
              <CheckCircle2 className="h-3 w-3" />
              Tersambung
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border font-bold gap-1 px-2.5 py-0.5">
              <Link2Off className="h-3 w-3" />
              Terputus
            </Badge>
          )}
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed bg-primary/5 rounded-xl p-3.5 border border-primary/10 space-y-1">
          <p className="font-bold text-foreground">💡 Cara Kerja Integrasi:</p>
          <p>
            Setelah terhubung, setiap kali Anda memasukkan tagihan supplier baru, sistem secara otomatis akan mendaftarkan tanggal jatuh temponya sebagai agenda (event) di kalender Google Anda. Anda dan tim akan menerima notifikasi dari Google Calendar agar tidak lupa menyiapkan dana.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {isConnected ? (
            <div className="space-y-2">
              <a href="/api/auth/google/initiate" className="w-full block">
                <Button variant="outline" className="w-full gap-2 h-11 rounded-xl font-bold" size="sm">
                  <RefreshCw className="h-4 w-4" />
                  Hubungkan Ulang
                </Button>
              </a>
              <Button
                variant="ghost"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="w-full text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 h-10 rounded-xl"
                size="sm"
              >
                {isDisconnecting ? "Memutuskan..." : "Putuskan Koneksi"}
              </Button>
            </div>
          ) : (
            <a href="/api/auth/google/initiate" className="w-full block">
              <Button className="w-full gap-2 h-12 rounded-xl font-bold text-sm shadow-lg shadow-primary/15" size="lg">
                <Link2 className="h-4.5 w-4.5" />
                Hubungkan ke Google Calendar
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
