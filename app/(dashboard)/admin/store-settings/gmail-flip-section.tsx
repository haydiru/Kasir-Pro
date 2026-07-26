"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, Link2Off, RefreshCw, DownloadCloud, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import { syncFlipEmailsFromGmail } from "@/app/actions/flip-gmail";

interface Props {
  gmailAuth: {
    id: string;
    expiryDate: Date | string;
  } | null;
  storeId: string;
}

export default function GmailFlipSection({ gmailAuth, storeId }: Props) {
  const [isConnected, setIsConnected] = useState(!!gmailAuth);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Membaca status respon callback Google OAuth
  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "gmail_connected") {
      toast.success("Akun Gmail Flip berhasil terhubung!");
      setIsConnected(true);
      router.replace("/admin/store-settings");
    }
  }, [searchParams, router]);

  async function handleDisconnect() {
    if (!confirm("Putuskan koneksi akun Gmail Flip Anda? Penarikan email otomatis akan dihentikan.")) return;

    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GMAIL" }),
      });
      const data = await res.json();
      if (data.success) {
        setIsConnected(false);
        toast.success("Koneksi Gmail Flip berhasil diputuskan!");
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

  async function handleSyncNow() {
    setIsSyncing(true);
    toast.info("Sedang menghubungi Gmail API dan menarik notifikasi Flip...");
    try {
      const res = await syncFlipEmailsFromGmail();
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || "Email Flip berhasil ditarik!", { duration: 5000 });
        router.refresh();
      }
    } catch {
      toast.error("Gagal menarik data email dari Gmail.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          Integrasi Gmail Flip (Tarik Langsung API)
        </CardTitle>
        <CardDescription>
          Sinkronkan transaksi digital dari email notifikasi Flip secara langsung dengan otorisasi pengguna.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between bg-muted/40 p-3.5 rounded-xl border border-border/50">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status Integrasi Gmail</span>
          {isConnected ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold gap-1 px-2.5 py-0.5">
              <CheckCircle2 className="h-3 w-3" />
              Tersambung Direct API
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border font-bold gap-1 px-2.5 py-0.5">
              <Link2Off className="h-3 w-3" />
              Terputus
            </Badge>
          )}
        </div>

        {/* Informasi Cara Kerja & Solusi Subjek Kembar */}
        <div className="text-xs text-muted-foreground leading-relaxed bg-emerald-500/5 rounded-xl p-3.5 border border-emerald-500/10 space-y-1.5">
          <p className="font-bold text-foreground flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
            Fitur Penarikan Email Cerdas & Terpisah:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>Akun Terpisah</strong>: Anda dapat menggunakan akun Gmail yang berbeda dari akun Google Calendar.</li>
            <li><strong>Bebas Masalah Subjek Kembar</strong>: Aplikasi menggunakan <em>ID Unik Transaksi Flip (#FT... / #DPT...)</em> dan Message ID unik Gmail. Transaksi berulang dengan subjek persis sama pada hari yang sama tetap akan terekstrak 100% tanpa ada yang terlewat.</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-2.5">
          {isConnected ? (
            <>
              <Button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="w-full gap-2 h-12 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
              >
                <DownloadCloud className={`h-4.5 w-4.5 ${isSyncing ? "animate-bounce" : ""}`} />
                {isSyncing ? "Memproses Email Flip..." : "Tarik Email Flip Sekarang"}
              </Button>

              <div className="flex gap-2">
                <a href="/api/auth/google/initiate?type=GMAIL" className="w-1/2">
                  <Button variant="outline" className="w-full gap-2 h-10 rounded-xl text-xs font-bold" size="sm">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Hubungkan Ulang
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-1/2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 h-10 rounded-xl"
                  size="sm"
                >
                  {isDisconnecting ? "Memutuskan..." : "Putuskan Koneksi"}
                </Button>
              </div>
            </>
          ) : (
            <a href="/api/auth/google/initiate?type=GMAIL" className="w-full block">
              <Button className="w-full gap-2 h-12 rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/15 bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
                <Mail className="h-4.5 w-4.5" />
                Hubungkan Akun Gmail Flip
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
