/**
 * Flip Email Parser (Enhanced for All Flip Transaction Formats)
 * Extracts transaction data from Flip email HTML notifications.
 *
 * Supports formats:
 *   Format A – Bill Payment (PDAM, Listrik, Indihome, E-Wallet, Pulsa)
 *     Subject patterns: "Pembelian [Jenis] #... berhasil", "Transaksi [Jenis] berhasil"
 *     ID formats: DPTxxxxxxxx, TXxxxxxxxx, TRXxxxxxxxx, etc.
 *
 *   Format B – Transfer (Bank / E-Wallet)
 *     Subject patterns: "Transfer ke [NAMA] berhasil", "Pengiriman uang ke... berhasil"
 *     ID formats: #FTxxxxxxxxx
 */

export interface FlipParsedData {
  flipId: string;          // e.g. "FT811717539" or "DPT92116802" (without #)
  serviceType: string;     // e.g. "Transfer", "PDAM", "Listrik", "Indihome", "Top Up E-Walet", "Pulsa/Paket Data"
  nominal: number;         // e.g. 175000
  customerName: string | null;
  customerNumber: string | null;
  bankOrProvider: string | null;
  transactionTime: Date;
  emailSubject: string;
}

/**
 * Detect transaction type from email subject & body.
 */
function detectServiceType(subject: string, body: string): string {
  const s = subject.toLowerCase();
  const b = body.toLowerCase();

  if (s.includes("transfer") || b.includes("transfer bank")) return "Transfer";
  if (s.includes("pdam") || b.includes("pdam")) return "PDAM";
  if (s.includes("listrik") || s.includes("pln") || b.includes("token listrik")) return "Listrik";
  if (s.includes("internet") || s.includes("indihome") || b.includes("telkom")) return "Indihome";
  if (s.includes("pulsa") || s.includes("paket data") || b.includes("paket data")) return "Pulsa/Paket Data";
  if (s.includes("top up") || s.includes("e-wallet") || s.includes("e-walet") || b.includes("e-wallet") || b.includes("gopay") || b.includes("ovo") || b.includes("dana") || b.includes("shopeepay")) {
    return "Top Up E-Walet";
  }

  // Fallback: extract the type from "Pembelian [TYPE] #..."
  const m = subject.match(/Pembelian\s+(.+?)\s+#/i);
  if (m) return m[1].trim();
  return "Lainnya";
}

/**
 * Extract Flip transaction ID from subject or body.
 * Returns the ID without the leading '#'.
 */
function extractFlipId(subject: string, body: string): string | null {
  // 1. Transfer format: #FTxxxxxxxxx
  const ftMatch = body.match(/#?(FT[A-Za-z0-9]{4,})/i) || subject.match(/#?(FT[A-Za-z0-9]{4,})/i);
  if (ftMatch) return ftMatch[1].toUpperCase();

  // 2. Bill payment format: DPTxxxxxxxx
  const dptMatch = subject.match(/#?(DPT[A-Za-z0-9]{4,})/i) || body.match(/(?:ID Transaksi|id transaksi|ID Pengiriman)[^<]*?(DPT[A-Za-z0-9]{4,})/i);
  if (dptMatch) return dptMatch[1].toUpperCase();

  // 3. TRX / TX prefix format: TRXxxxxxxxx or TXxxxxxxxx
  const trxMatch = subject.match(/#?((?:TRX|TX)[A-Za-z0-9]{4,})/i) || body.match(/#?((?:TRX|TX)[A-Za-z0-9]{4,})/i);
  if (trxMatch) return trxMatch[1].toUpperCase();

  // 4. Explicit label format: "ID Transaksi : #ABC12345" or "ID Transaksi: 12345678"
  const labelMatch = body.match(/(?:ID Transaksi|ID Pengiriman|Kode Transaksi)\s*[:\s]*#?([A-Za-z0-9]{5,})/i);
  if (labelMatch) return labelMatch[1].toUpperCase();

  // 5. General hashtag ID fallback in subject or body: #ABC12345
  const genMatch = subject.match(/#([A-Za-z0-9]{5,})/i) || body.match(/#([A-Za-z0-9]{5,})/i);
  if (genMatch) return genMatch[1].toUpperCase();

  return null;
}

/**
 * Parse Indonesian Rupiah string to number.
 * e.g. "Rp1.300.000" → 1300000, "Rp84.532" → 84532
 */
function parseRupiah(str: string): number {
  const cleaned = str.replace(/[Rp.\s]/g, "").replace(",", ".");
  return Math.round(Number(cleaned) || 0);
}

/**
 * Extract nominal amount from the email body.
 */
function extractNominal(body: string): number {
  // Strip HTML to get plain text
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // Pattern: "Jumlah Tagihan ... Rpxx.xxx" or "Nominal ... Rpxx.xxx" or "Total ... Rpxx.xxx"
  const patterns = [
    /(?:Jumlah Tagihan|Total Tagihan|Total Pengiriman|Nominal Transfer)[^R]*?(Rp[\d.,]+)/i,
    /Nominal[^R]*?(Rp[\d.,]+)/i,
    /Total[^R]*?(Rp[\d.,]+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseRupiah(m[1]);
  }

  // Fallback: find any Rp value in detail__value cells
  const cellMatches = body.match(/class="detail__value"[^>]*>[^<]*(Rp[\d.,]+)/i);
  if (cellMatches) return parseRupiah(cellMatches[1]);

  // Last resort: find largest Rp value in body
  const allRp = [...text.matchAll(/Rp\s*([\d.,]+)/g)].map((m) => parseRupiah("Rp" + m[1]));
  if (allRp.length > 0) return Math.max(...allRp);

  return 0;
}

/**
 * Parse Indonesian date string to Date object.
 */
function parseIndonesianDate(dateStr: string): Date {
  const months: Record<string, number> = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
    january: 0, february: 1, march: 2, may: 4, june: 5,
    july: 6, august: 7, october: 9, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, agt: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11
  };

  const m = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})[,\s]+(\d{1,2})[:.:](\d{2})/i);
  if (!m) return new Date();

  const day = parseInt(m[1]);
  const month = months[m[2].toLowerCase()] ?? 0;
  const year = parseInt(m[3]);
  const hour = parseInt(m[4]);
  const minute = parseInt(m[5]);

  // WIB = UTC+7
  const d = new Date(Date.UTC(year, month, day, hour - 7, minute));
  return d;
}

/**
 * Extract transaction time from email body.
 */
function extractTransactionTime(body: string): Date {
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const m = text.match(/(?:Waktu Proses|Waktu Terkirim|Waktu Transaksi|Tanggal)[^0-9]*(\d{1,2}\s+\w+\s+\d{4}[,\s]+\d{1,2}[:.]\d{2}\s*WIB)/i);
  if (m) return parseIndonesianDate(m[1]);

  const fallback = text.match(/(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Jan|Feb|Mar|Apr|Jun|Jul|Agt|Aug|Sep|Okt|Oct|Nov|Des|Dec)\s+\d{4}[,\s]+\d{1,2}[:.]\d{2}\s*WIB)/i);
  if (fallback) return parseIndonesianDate(fallback[1]);

  return new Date();
}

/**
 * Extract customer name from subject or email body.
 */
function extractCustomerName(body: string, serviceType: string, subject: string): string | null {
  const subMatch = subject.match(/(?:Transfer|Pengiriman|Kirim)\s+(?:Rp\s*[\d.,]+\s+)?ke\s+(.+?)\s+berhasil/i);
  if (subMatch) {
    const candidate = subMatch[1].trim();
    if (candidate && !candidate.toLowerCase().startsWith("http")) {
      return candidate;
    }
  }

  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const transferPatterns = [
    /(?:Nama\s+Tujuan|Nama\s+Penerima|Penerima|Atas\s+Nama|Nama\s+Pemilik)\s*[:\s]*([A-Za-z0-9\s'.\-\/]+?)(?=\s*(?:Bank|Nomor|ID|Jumlah|Waktu|Total|Rp|Catatan|Status|$))/i,
    /Tujuan\s*[:\s]*([A-Za-z0-9\s'.\-\/]+?)(?=\s*(?:Bank|Nomor|ID|Jumlah|Waktu|Total|Rp|$))/i,
  ];

  for (const p of transferPatterns) {
    const m = text.match(p);
    if (m && m[1].trim()) {
      const found = m[1].trim();
      if (found.length > 1 && !found.toLowerCase().includes("transaksi")) {
        return found;
      }
    }
  }

  const billPatterns = [
    /(?:Nama\s+Pelanggan|Nama\s+Konsumen|Nama\s+Pemilik)\s*[:\s]*([A-Za-z0-9\s'.\-\/]+?)(?=\s*(?:Alamat|Periode|Jumlah|Nomor|ID|Total|Waktu|$))/i,
    /Pelanggan\s*[:\s]*([A-Za-z0-9\s'.\-\/]+?)(?=\s*(?:Alamat|Periode|Jumlah|Nomor|ID|Total|Waktu|$))/i,
  ];

  for (const p of billPatterns) {
    const m = text.match(p);
    if (m && m[1].trim()) {
      const found = m[1].trim();
      if (found.length > 1) {
        return found;
      }
    }
  }

  if (serviceType === "Pulsa/Paket Data") {
    const m = text.match(/Produk\s*[:\s]*([A-Za-z0-9\s'.\-\/]+?)(?=\s*(?:Nomor|ID|Waktu|Jumlah|Total|$))/i);
    if (m) return m[1].trim();
  }

  return null;
}

/**
 * Extract customer number / account.
 */
function extractCustomerNumber(body: string, serviceType: string): string | null {
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  if (serviceType === "Transfer") {
    const m = text.match(/Nomor Rekening Tujuan\s*([\d\s]+)/i);
    if (m) return m[1].trim();
  } else {
    const m = text.match(/(?:Nomor Pelanggan|Nomor Meter\/ID|Nomor HP)\s*([+\d\s\-]+)/i);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Extract bank or provider name.
 */
function extractBankOrProvider(body: string, serviceType: string, subject: string): string | null {
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  if (serviceType === "Transfer") {
    const m = text.match(/Bank Tujuan\s*([\w\s]+?)(?=\s{2,}|Nomor|<)/i);
    if (m) return m[1].trim();
  } else if (serviceType === "PDAM") {
    const m = text.match(/Wilayah\s*([\w\s]+?)(?=\s{2,}|Nomor|<)/i);
    if (m) return m[1].trim();
  } else if (serviceType === "Indihome") {
    return "Telkom";
  } else if (serviceType === "Listrik") {
    return "PLN";
  } else if (serviceType === "Pulsa/Paket Data") {
    const textLower = text.toLowerCase();
    if (textLower.includes("telkomsel") || textLower.includes("by.u")) return "Telkomsel";
    if (textLower.includes("indosat") || textLower.includes("im3") || textLower.includes("mentari")) return "Indosat";
    if (textLower.includes("xl") || textLower.includes("prioritas")) return "XL";
    if (textLower.includes("axis") || textLower.includes("bronet") || textLower.includes("owsem")) return "Axis";
    if (textLower.includes("three") || textLower.includes("tri") || textLower.includes(" 3 ")) return "Tri";
    if (textLower.includes("smartfren")) return "Smartfren";
  }
  return null;
}

/**
 * Main parser: takes email subject + HTML body, returns parsed data.
 */
export function parseFlipEmail(subject: string, body: string): FlipParsedData | null {
  const sLower = subject.toLowerCase();

  // Guard 1: Must be a successful transaction email or transfer/purchase
  if (!sLower.includes("berhasil") && !sLower.includes("sukses") && !sLower.includes("selesai")) return null;

  // Guard 2: Exclude store balance Top Up Saldo & Flip Freedom fees
  if (sLower.includes("top up saldo") || sLower.includes("flip freedom")) return null;

  const flipId = extractFlipId(subject, body);
  if (!flipId || flipId === "FFFFFF") return null;

  const serviceType = detectServiceType(subject, body);
  const nominal = extractNominal(body);
  const transactionTime = extractTransactionTime(body);
  let customerName = extractCustomerName(body, serviceType, subject);
  const customerNumber = extractCustomerNumber(body, serviceType);
  const bankOrProvider = extractBankOrProvider(body, serviceType, subject);

  // Guard 3: Sanitize customer name against legal disclaimer text
  if (customerName) {
    const cLower = customerName.toLowerCase();
    if (
      customerName.length > 60 ||
      cLower.includes("email ini") ||
      cLower.includes("rahasia") ||
      cLower.includes("sistem anda") ||
      cLower.includes("peraturan")
    ) {
      customerName = null;
    }
  }

  return {
    flipId,
    serviceType,
    nominal,
    customerName,
    customerNumber,
    bankOrProvider,
    transactionTime,
    emailSubject: subject,
  };
}
