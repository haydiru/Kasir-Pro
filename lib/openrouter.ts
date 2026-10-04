/**
 * OpenRouter AI Client for Receipt Vision Extraction
 * Uses GPT Luna family models (openai/gpt-6-luna / ~openai/gpt-luna-latest)
 */

interface ReceiptItemExtracted {
  rawName: string;
  barcodeOrCode?: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

interface ReceiptExtractionResult {
  supplierName?: string;
  invoiceDate?: string;
  totalAmount?: number;
  items: ReceiptItemExtracted[];
}

export async function extractReceiptWithOpenRouter(
  imageUrl: string,
  preferredModel?: string
): Promise<{ success: boolean; data?: ReceiptExtractionResult; error?: string }> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return { success: false, error: "OPENROUTER_API_KEY belum dikonfigurasi di server." };
    }

    // Default ke model GPT Luna pilihan user
    const model = preferredModel || process.env.OPENROUTER_MODEL || "openai/gpt-6-luna";

    const systemPrompt = `Anda adalah asisten AI kasir minimarket Indonesia yang sangat teliti dalam mengekstrak struk belanja atau faktur/nota pembelian barang toko.
Tugas Anda:
1. Ekstrak data nota pembelian barang dari gambar ini.
2. Identifikasi:
   - supplierName: Nama toko/supplier/distributor penerbit nota
   - invoiceDate: Tanggal nota jika terbaca (format YYYY-MM-DD)
   - totalAmount: Total akhir pembayaran yang tertera pada nota (angka)
   - items: Daftar baris produk/barang yang dibeli.
     Untuk setiap item ekstrak:
     * rawName: Nama barang persis seperti yang tertulis di nota
     * barcodeOrCode: Nomor barcode (biasanya 12-13 digit angka) atau ID/kode barang jika tercetak di nota (opsional, biarkan kosong jika tidak ada)
     * qty: Jumlah barang yang dibeli (angka, default 1)
     * unitPrice: Harga beli/modal satuan per pcs/unit (angka)
     * totalPrice: Total harga untuk item tersebut (angka)
3. HANYA kembalikan JSON murni tanpa markdown, format:
{
  "supplierName": "...",
  "invoiceDate": "YYYY-MM-DD",
  "totalAmount": 150000,
  "items": [
    {
      "rawName": "...",
      "barcodeOrCode": "...",
      "qty": 10,
      "unitPrice": 12000,
      "totalPrice": 120000
    }
  ]
}`;

    const payload = {
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Tolong ekstrak seluruh daftar barang, kuantitas, harga modal satuan, dan total pada foto nota ini dalam bentuk JSON terstruktur.",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    };

    let res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://kasir-pro-three.vercel.app",
        "X-Title": "KasirPro Receipt AI Scanner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Fallback model jika model spesifik sedang overload / unroutable
    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`OpenRouter primary model (${model}) error:`, errBody);

      // Coba fallback ke ~openai/gpt-luna-latest atau openai/gpt-4o-mini
      const fallbackModel = model.includes("gpt-6-luna") ? "~openai/gpt-luna-latest" : "openai/gpt-4o-mini";
      console.log(`Mencoba fallback model: ${fallbackModel}...`);

      payload.model = fallbackModel;
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://kasir-pro-three.vercel.app",
          "X-Title": "KasirPro Receipt AI Scanner",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const fallbackErr = await res.text();
        console.error("OpenRouter fallback model error:", fallbackErr);
        return { success: false, error: "Gagal memproses gambar nota dengan AI OpenRouter." };
      }
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      return { success: false, error: "Respon AI kosong dari OpenRouter." };
    }

    // Parse JSON
    try {
      // Bersihkan jika ada codeblock ```json ... ```
      const cleaned = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed: ReceiptExtractionResult = JSON.parse(cleaned);

      // Normalisasi items
      const validItems = (parsed.items || []).map((it) => ({
        rawName: String(it.rawName || "").trim(),
        barcodeOrCode: it.barcodeOrCode ? String(it.barcodeOrCode).trim() : undefined,
        qty: Number(it.qty) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        totalPrice: Number(it.totalPrice) || 0,
      })).filter((it) => it.rawName.length > 0);

      return {
        success: true,
        data: {
          supplierName: parsed.supplierName || undefined,
          invoiceDate: parsed.invoiceDate || undefined,
          totalAmount: Number(parsed.totalAmount) || 0,
          items: validItems,
        },
      };
    } catch (parseErr) {
      console.error("Gagal parse JSON hasil ekstraksi:", rawContent, parseErr);
      return { success: false, error: "Format respon AI tidak dapat diurai ke data transaksi." };
    }
  } catch (error: any) {
    console.error("extractReceiptWithOpenRouter exception:", error);
    return { success: false, error: error.message || "Terjadi kesalahan koneksi ke OpenRouter AI." };
  }
}
