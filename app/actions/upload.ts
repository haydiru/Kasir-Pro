"use server";

import { createClient } from "@supabase/supabase-js";

export async function uploadReceipt(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "Tidak ada file yang dipilih" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        // Attempt 1: Upload directly to receipts bucket
        let { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, buffer, {
            contentType: file.type || 'image/jpeg',
            upsert: false
          });

        // Attempt 2: If bucket missing, try to create public bucket 'receipts' and retry once
        if (uploadError && (uploadError.message?.toLowerCase().includes("not found") || uploadError.message?.toLowerCase().includes("bucket"))) {
          console.warn("Bucket 'receipts' not found or error, attempting auto-create...", uploadError.message);
          try {
            await supabase.storage.createBucket('receipts', { public: true });
            const retryRes = await supabase.storage
              .from('receipts')
              .upload(filePath, buffer, {
                contentType: file.type || 'image/jpeg',
                upsert: false
              });
            uploadData = retryRes.data;
            uploadError = retryRes.error;
          } catch (createErr) {
            console.warn("Auto-create bucket failed:", createErr);
          }
        }

        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);

          if (publicUrl) {
            return { success: true, url: publicUrl };
          }
        } else {
          console.warn("Supabase storage upload error, falling back to Base64:", uploadError?.message);
        }
      } catch (err: any) {
        console.warn("Supabase storage exception, falling back to Base64:", err?.message || err);
      }
    }

    // Reliable Fallback: Convert image buffer to Base64 Data URL
    // (Used when Supabase bucket is missing, unconfigured, or returns errors)
    const mimeType = file.type || "image/jpeg";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return { success: true, url: dataUrl };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: error.message || "Gagal mengunggah foto" };
  }
}
