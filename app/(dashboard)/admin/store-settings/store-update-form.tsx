"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Store } from "@prisma/client";
import { updateStoreDetails } from "@/app/actions/store";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

export default function StoreUpdateForm({ store }: { store: Store }) {
  const [state, formAction, isPending] = useActionState(updateStoreDetails, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-semibold">Nama Toko</Label>
        <Input 
          id="name" 
          name="name" 
          defaultValue={store.name} 
          required 
          className="bg-background/50 border-primary/10 focus-visible:ring-primary h-10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address" className="text-sm font-semibold">Alamat</Label>
        <Input 
          id="address" 
          name="address" 
          defaultValue={store.address} 
          required
          className="bg-background/50 border-primary/10 focus-visible:ring-primary h-10"
        />
      </div>
      <Button 
        type="submit" 
        disabled={isPending} 
        className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Simpan Identitas
      </Button>
    </form>
  );
}
