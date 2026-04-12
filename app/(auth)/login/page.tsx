"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, ShieldCheck, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { authenticate } from "@/app/actions/auth";
export default function LoginPage() {
  const { theme, setTheme } = useTheme();
  const [showPin, setShowPin] = useState(false);
  const [state, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <div className="w-full max-w-md px-4">
      {/* Theme toggle */}
      <div className="absolute top-6 right-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Store className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">KasirPro</h1>
          <p className="text-sm text-muted-foreground">Laporan Shift Minimarket</p>
        </div>
      </div>

      {/* Login Card */}
      <Card className="border-0 shadow-xl shadow-black/5 dark:shadow-black/30 backdrop-blur-sm bg-card/80">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Masuk ke Akun</CardTitle>
          <CardDescription>Pilih akun demo untuk melanjutkan</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email-input">Email</Label>
              <Input
                id="email-input"
                name="email"
                type="email"
                placeholder="casir@minimart.id"
                required
                className="h-11"
              />
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <Label htmlFor="pin-input">PIN / Password</Label>
              <div className="relative">
                <Input
                  id="pin-input"
                  name="pin"
                  type={showPin ? "text" : "password"}
                  placeholder="Masukkan PIN 6 digit..."
                  required
                  className="h-11 pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {state && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20 text-center font-medium">
                {state}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 font-semibold"
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Masuk Sistem
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="px-8 mt-6 text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link href="/register" className="hover:text-brand underline underline-offset-4 font-medium text-primary">
          Daftarkan Toko Baru
        </Link>
      </p>
    </div>
  );
}
