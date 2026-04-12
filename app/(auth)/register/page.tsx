"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerStore } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, ShieldCheck, FileCheck2 } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerStore, undefined);

  useEffect(() => {
    if (state === "SUCCESS") {
      toast.success("Toko berhasil didaftarkan! Silakan login.");
      router.push("/login");
    } else if (state) {
      toast.error(state);
    }
  }, [state, router]);

  return (
    <div className="flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
      <div className="flex flex-col space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Store className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Daftarkan Toko Anda</h1>
        <p className="text-sm text-muted-foreground">
          Sistem KasirPro dan pelacakan shift cerdas
        </p>
      </div>

      <div className="grid gap-6 bg-card p-6 rounded-xl border shadow-sm">
        <form action={formAction}>
          <div className="grid gap-4">
            
            {/* Store Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detail Toko</span>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="storeName">Nama Toko / Minimarket</Label>
                <Input
                  id="storeName"
                  name="storeName"
                  placeholder="Minimart Sejahtera"
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="storeAddress">Alamat Lengkap</Label>
                <Input
                  id="storeAddress"
                  name="storeAddress"
                  placeholder="Jl. Merdeka No. 12"
                  required
                />
              </div>
            </div>

            {/* Admin Information */}
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-2 border-b pb-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Super Admin</span>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adminName">Nama Pemilik Baru</Label>
                <Input
                  id="adminName"
                  name="adminName"
                  placeholder="Budi Santoso"
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="email">Alamat Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="budi@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="pin">PIN Keamanan (Min. 4 Angka)</Label>
                <Input
                  id="pin"
                  name="pin"
                  type="password"
                  placeholder="123456"
                  required
                />
              </div>
            </div>

            <Button disabled={isPending} className="mt-2 h-11">
              {isPending && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              )}
              {!isPending && <FileCheck2 className="mr-2 h-4 w-4" />}
              Daftarkan Sekarang
            </Button>
          </div>
        </form>
      </div>

      <p className="px-8 text-center text-sm text-muted-foreground">
        Sudah memiliki akun?{" "}
        <Link href="/login" className="hover:text-brand underline underline-offset-4 font-medium text-primary">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
