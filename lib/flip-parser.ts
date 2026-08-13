/**
 * Flip Email Parser (Enhanced for ST..., FT..., DPT..., TRX... & Quoted-Printable HTML)
 * Extracts transaction data from Flip email HTML notifications.
 */

export interface FlipParsedData {
  flipId: string;          // e.g. "ST26080908134992805F2X" or "FT811717539" or "DPT92116802"
  serviceType: string;     // e.g. "Transfer", "PDAM", "Listrik", "Indihome", "Top Up E-Walet", "Pulsa/Paket Data"
  nominal: number;         // e.g. 65000, 600000
  customerName: string | null;
  customerNumber: string | null;
  bankOrProvider: string | null;
  transactionTime: Date;
  emailSubject: string;
}

/**
 * Unescape Quoted-Printable encoding (=3D, soft line breaks = \r\n)
 */
function cleanQuotedPrintable(str: string): string {
  if (!str) return "";
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=")
    .replace(/=20/g, " ");
}

/**
 * Helper to extract value from Flip HTML structure:
 * <div class="text--gray">Key</div><div class="text--bold">Value</div>
 * Or <td>Key</td><td class="detail__value">Value</td>
 */
function extractKeyValueFromHtml(cleanBody: string, keyName: string): string | null {
  if (!cleanBody || !keyName) return null;

  // 1. Try Div structure (existing format)
  const divRegex = new RegExp(`text--gray"[^>]*>\\s*${keyName}\\s*<\\/div>\\s*<div[^>]*>\\s*([^<]+)<\\/div>`, "i");
  const mDiv = cleanBody.match(divRegex);
  if (mDiv && mDiv[1] && mDiv[1].trim() !== "—") {
    return mDiv[1].trim();
  }

  // 2. Try Table cell structure (new "Pembelian" / Pulsa / PLN email format)
  const tdRegex = new RegExp(`<td[^>]*>\\s*${keyName}\\s*<\\/td>\\s*<td[^>]*>\\s*([^<]+?)\\s*<\\/td>`, "i");
  const mTd = cleanBody.match(tdRegex);
  if (mTd && mTd[1] && mTd[1].trim() !== "—") {
    return mTd[1].trim();
  }

  return null;
}

/**
 * Detect transaction type from email subject & body.
 */
function detectServiceType(subject: string, body: string, bankOrProvider?: string | null): string {
  const s = subject.toLowerCase();
  const b = body.toLowerCase();
  const provider = (bankOrProvider || "").toLowerCase();

  // E-Wallet providers check
  const eWallets = ["gopay", "dana", "ovo", "shopeepay", "linkaja", "sakuku", "isaku"];
  if (eWallets.some(w => provider.includes(w) || s.includes(w) || b.includes(w))) {
    return "Top Up E-Walet";
  }

  if (s.includes("transfer") || b.includes("transfer ke tujuan") || b.includes("transfer bank")) return "Transfer";
  if (s.includes("pdam") || b.includes("pdam")) return "PDAM";
  if (s.includes("listrik") || s.includes("pln") || b.includes("token listrik")) return "Listrik";
  if (s.includes("internet") || s.includes("indihome") || b.includes("telkom")) return "Indihome";
  if (s.includes("pulsa") || s.includes("paket data") || b.includes("paket data")) return "Pulsa/Paket Data";

  const m = subject.match(/Pembelian\s+(.+?)\s+#/i);
  if (m) return m[1].trim();
  return "Transfer";
}

/**
 * Extract Flip transaction ID from subject or body.
 * Returns the ID without the leading '#'.
 */
function extractFlipId(subject: string, rawBody: string): string | null {
  const body = cleanQuotedPrintable(rawBody);

  // 1. Try HTML Key-Value structure: "ID Transaksi"
  const htmlVal = extractKeyValueFromHtml(body, "ID Transaksi");
  if (htmlVal) {
    const cleanId = htmlVal.replace(/^#/, "").trim();
    if (cleanId && cleanId.toUpperCase() !== "FFFFFF") {
      return cleanId;
    }
  }

  // 2. ST format: #ST260809... (Flip Transfer / E-Wallet new format)
  const stMatch = body.match(/#?(ST[A-Za-z0-9]{6,})/i) || subject.match(/#?(ST[A-Za-z0-9]{6,})/i);
  if (stMatch) return stMatch[1].toUpperCase();

  // 3. FT format: #FTxxxxxxxxx
  const ftMatch = body.match(/#?(FT[A-Za-z0-9]{4,})/i) || subject.match(/#?(FT[A-Za-z0-9]{4,})/i);
  if (ftMatch) return ftMatch[1].toUpperCase();

  // 4. Bill payment format: DPTxxxxxxxx
  const dptMatch = subject.match(/#?(DPT[A-Za-z0-9]{4,})/i) || body.match(/(?:ID Transaksi|id transaksi|ID Pengiriman)[^<]*?(DPT[A-Za-z0-9]{4,})/i);
  if (dptMatch) return dptMatch[1];

  // 5. TRX / TX prefix format: TRXxxxxxxxx or TXxxxxxxxx
  const trxMatch = subject.match(/#?((?:TRX|TX)[A-Za-z0-9]{4,})/i) || body.match(/#?((?:TRX|TX)[A-Za-z0-9]{4,})/i);
  if (trxMatch) return trxMatch[1].toUpperCase();

  // 6. Explicit label format: "ID Transaksi : #ABC12345"
  const labelMatch = body.match(/(?:ID Transaksi|ID Pengiriman|Kode Transaksi)[^#]*?#([A-Za-z0-9]{5,})/i);
  if (labelMatch) return labelMatch[1].toUpperCase();

  // 7. General hashtag ID fallback in subject or body: #ABC12345
  const genMatch = subject.match(/#([A-Za-z0-9]{5,})/i) || body.match(/#([A-Za-z0-9]{5,})/i);
  if (genMatch) return genMatch[1].toUpperCase();

  return null;
}

/**
 * Parse Indonesian Rupiah string to number.
 */
function parseRupiah(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[Rp.\s]/gi, "").replace(",", ".");
  return Math.round(Number(cleaned) || 0);
}

/**
 * Extract nominal amount from the email body.
 */
function extractNominal(rawBody: string): number {
  const body = cleanQuotedPrintable(rawBody);

  // 1. Try HTML Key-Value structure: "Nominal", "Total Pembayaran", "Total Pengiriman"
  const htmlNominal = extractKeyValueFromHtml(body, "Nominal") ||
                      extractKeyValueFromHtml(body, "Total Pembayaran") ||
                      extractKeyValueFromHtml(body, "Total Pengiriman");
  if (htmlNominal) {
    const val = parseRupiah(htmlNominal);
    if (val > 0) return val;
  }

  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const patterns = [
    /(?:Jumlah Tagihan|Total Tagihan|Total Pengiriman|Nominal Transfer|Total Pembayaran|Nominal)[^R]*?(Rp[\d.,]+)/i,
    /Total[^R]*?(Rp[\d.,]+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = parseRupiah(m[1]);
      if (val > 0) return val;
    }
  }

  const allRp = [...text.matchAll(/Rp\s*([\d.,]+)/g)].map((m) => parseRupiah("Rp" + m[1]));
  if (allRp.length > 0) return Math.max(...allRp);

  return 0;
}

/**
 * Parse Indonesian date string to Date object.
 * e.g. "09 Aug 2026 08:13 WIB" or "14 April 2026, 14:00 WIB"
 */
function parseIndonesianDate(dateStr: string): Date {
  if (!dateStr) return new Date();

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
  return new Date(Date.UTC(year, month, day, hour - 7, minute));
}

/**
 * Extract transaction time from email body.
 */
function extractTransactionTime(rawBody: string): Date {
  const body = cleanQuotedPrintable(rawBody);

  // 1. Try HTML Key-Value structure: "Waktu Terkirim" or "Waktu Proses"
  const htmlTime = extractKeyValueFromHtml(body, "Waktu Terkirim") || extractKeyValueFromHtml(body, "Waktu Proses");
  if (htmlTime) {
    return parseIndonesianDate(htmlTime);
  }

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
function extractCustomerName(rawBody: string, serviceType: string, subject: string): string | null {
  const body = cleanQuotedPrintable(rawBody);

  // 1. Try HTML Key-Value structure: "Nama Tujuan" or "Nama Pelanggan"
  const htmlName = extractKeyValueFromHtml(body, "Nama Tujuan") || extractKeyValueFromHtml(body, "Nama Pelanggan");
  if (htmlName && htmlName.length > 1) {
    return htmlName;
  }

  // 2. Try subject pattern: "Transfer ke Chelsy Phasya Putri berhasil"
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

  return null;
}

/**
 * Extract customer number / account.
 */
function extractCustomerNumber(rawBody: string, serviceType: string): string | null {
  const body = cleanQuotedPrintable(rawBody);

  // 1. Try HTML Key-Value structure: "Nomor Rekening Tujuan", "Nomor Pelanggan", "Nomor HP"
  const htmlNumber = extractKeyValueFromHtml(body, "Nomor Rekening Tujuan") ||
                     extractKeyValueFromHtml(body, "Nomor Pelanggan") ||
                     extractKeyValueFromHtml(body, "Nomor HP");
  if (htmlNumber) {
    return htmlNumber;
  }

  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const m = text.match(/(?:Nomor Rekening Tujuan|Nomor Pelanggan|Nomor Meter\/ID|Nomor HP)\s*([+\d\s\-]+)/i);
  if (m) return m[1].trim();

  return null;
}

/**
 * Extract bank or provider name.
 */
function extractBankOrProvider(rawBody: string, serviceType: string, subject: string): string | null {
  const body = cleanQuotedPrintable(rawBody);

  // 1. Try HTML Key-Value structure: "Bank Tujuan" or "Produk"
  const htmlBank = extractKeyValueFromHtml(body, "Bank Tujuan") || extractKeyValueFromHtml(body, "Produk");
  if (htmlBank) {
    return htmlBank;
  }

  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  if (serviceType === "Transfer" || serviceType === "Top Up E-Walet") {
    const m = text.match(/Bank Tujuan\s*([\w\s]+?)(?=\s{2,}|Nomor|<)/i);
    if (m) return m[1].trim();
  } else if (serviceType === "PDAM") {
    const m = text.match(/Wilayah\s*([\w\s]+?)(?=\s{2,}|Nomor|<)/i);
    if (m) return m[1].trim();
  } else if (serviceType === "Indihome") {
    return "Telkom";
  } else if (serviceType === "Listrik") {
    return "PLN";
  }
  return null;
}

/**
 * Main parser: takes email subject + HTML body, returns parsed data.
 */
export function parseFlipEmail(subject: string, rawBody: string): FlipParsedData | null {
  const sLower = subject.toLowerCase();
  const body = cleanQuotedPrintable(rawBody);

  // Guard 1: Must be a successful transaction email or transfer/purchase
  if (!sLower.includes("berhasil") && !sLower.includes("sukses") && !sLower.includes("selesai")) return null;

  // Guard 2: Exclude store balance Top Up Saldo & Flip Freedom fees & QRIS
  if (
    sLower.includes("top up saldo") ||
    sLower.includes("pengisian ulang saldo") ||
    sLower.includes("flip freedom") ||
    sLower.includes("qris")
  ) {
    return null;
  }

  const flipId = extractFlipId(subject, body);
  if (!flipId || flipId === "FFFFFF") return null;

  const bankOrProvider = extractBankOrProvider(body, "Transfer", subject);
  const serviceType = detectServiceType(subject, body, bankOrProvider);
  const nominal = extractNominal(body);
  const transactionTime = extractTransactionTime(body);
  let customerName = extractCustomerName(body, serviceType, subject);
  const customerNumber = extractCustomerNumber(body, serviceType);

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
