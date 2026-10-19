"use server";

import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth-guard";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Detects the real image type from the file's magic bytes. The client-supplied
 * file name and MIME type are never trusted, so only genuine images are stored
 * (no .html/.svg/.js uploads into the public bucket).
 */
function detectImageType(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return { ext: "heic", mime: "image/heic" };
    }
  }
  return null;
}

export async function uploadReceipt(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { success: false, error: "Tidak ada file yang dipilih" };
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return { success: false, error: "Ukuran file maksimal 10 MB" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const imageType = detectImageType(buffer);
    if (!imageType) {
      return { success: false, error: "Format file tidak didukung. Gunakan foto JPG, PNG, WEBP, atau HEIC." };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${imageType.ext}`;
        const filePath = `receipts/${fileName}`;

        // Attempt 1: Upload directly to receipts bucket
        let { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, buffer, {
            contentType: imageType.mime,
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
                contentType: imageType.mime,
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
    const mimeType = imageType.mime;
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return { success: true, url: dataUrl };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: "Gagal mengunggah foto" };
  }
}
