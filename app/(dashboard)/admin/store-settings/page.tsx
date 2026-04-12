import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store as StoreIcon, Settings, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import ShiftClientActions from "./shift-client-actions";
import StoreUpdateForm from "./store-update-form";

export default async function StoreSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/attendance");
  }

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId },
    include: {
      shiftSettings: {
        orderBy: [
          { dayOfWeek: "asc" },
          { startTime: "asc" }
        ]
      }
    }
  });

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="p-4 bg-destructive/10 rounded-full">
          <Info className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Toko Tidak Ditemukan</h2>
        <p className="text-muted-foreground">Maaf, kami tidak dapat menemukan data toko Anda.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Pengaturan Toko
          </h1>
          <p className="text-muted-foreground">
            Konfigurasi identitas toko dan jadwal operasional shift karyawan.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 bg-primary/10 text-primary rounded-full w-fit">
          <Settings className="h-3 w-3 animate-spin-slow" />
          Panel Administrator
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Identitas Toko Section */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <StoreIcon className="h-5 w-5 text-primary" />
                </div>
                Identitas Toko
              </CardTitle>
              <CardDescription>
                Informasi dasar toko Anda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StoreUpdateForm store={store} />
            </CardContent>
          </Card>
          
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/20 border border-primary/10">
             <h4 className="font-semibold flex items-center gap-2 mb-2">
               <Info className="h-4 w-4" /> 
               Tips Penjadwalan
             </h4>
             <p className="text-sm text-muted-foreground leading-relaxed">
               Gunakan fitur <b>Jadwal Khusus</b> untuk mengatur jam operasional yang berbeda pada hari tertentu seperti libur akhir pekan.
             </p>
          </div>
        </div>

        {/* Master Shift Form Section */}
        <div className="lg:col-span-8">
          <ShiftClientActions 
            shifts={store.shiftSettings} 
            storeId={store.id} 
          />
        </div>
      </div>
    </div>
  );
}
