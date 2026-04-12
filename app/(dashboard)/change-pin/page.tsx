"use client";

import { useActionState, useEffect } from "react";
import { changePin } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function ChangePinPage() {
  const [state, formAction, isPending] = useActionState(changePin, undefined);

  useEffect(() => {
    if (state === "SUCCESS") {
      toast.success("PIN berhasil diperbarui!");
      // Reset form manually or handled by user navigation
    } else if (state) {
      toast.error(state);
    }
  }, [state]);

  return (
    <div className="max-w-md mx-auto pt-10">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Ganti PIN Keamanan</CardTitle>
          </div>
          <CardDescription>
            Perbarui PIN Anda secara berkala untuk menjaga keamanan akun. PIN harus berupa kombinasi angka minimal 4 digit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPin">PIN Lama</Label>
              <Input
                id="oldPin"
                name="oldPin"
                type="password"
                placeholder="Masukkan PIN saat ini"
                required
                className="font-mono"
              />
            </div>
            
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="newPin">PIN Baru</Label>
              <Input
                id="newPin"
                name="newPin"
                type="password"
                placeholder="Masukkan PIN baru"
                required
                className="font-mono"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPin">Konfirmasi PIN Baru</Label>
              <Input
                id="confirmPin"
                name="confirmPin"
                type="password"
                placeholder="Ulangi PIN baru"
                required
                className="font-mono"
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-4"
              disabled={isPending}
            >
              {isPending ? "Menyimpan..." : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Simpan PIN Baru
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
