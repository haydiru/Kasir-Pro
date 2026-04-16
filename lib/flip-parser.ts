/**
 * Flip Email Parser
 * Extracts transaction data from Flip email HTML notifications.
 *
 * Supports two formats:
 *   Format A – Bill Payment (PDAM, Listrik, Indihome, etc.)
 *     Subject pattern: "Pembelian [Jenis] #DPT... berhasil"
 *     ID format: DPTxxxxxxxx
 *
 *   Format B – Transfer (Bank / E-Wallet)
 *     Subject pattern: "Transfer ke [NAMA] berhasil"
 *     ID format: #FTxxxxxxxxx
 */

export interface FlipParsedData {
  flipId: string;          // e.g. "FT811717539" or "DPT92116802" (without #)
  serviceType: string;     // e.g. "Transfer", "PDAM", "Listrik", "Indihome"
  nominal: number;         // e.g. 175000
  customerName: string | null;
  customerNumber: string | null;
  bankOrProvider: string | null;
  transactionTime: Date;
  emailSubject: string;
}

/**
 * Detect transaction type from email subject.
 */
function detectServiceType(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("transfer")) return "Transfer";
  if (s.includes("pdam")) return "PDAM";
  if (s.includes("listrik")) return "Listrik";
  if (s.includes("internet") || s.includes("indihome")) return "Indihome";
  if (s.includes("pulsa") || s.includes("paket data")) return "Pulsa/Paket Data";
  if (s.includes("top up") || s.includes("e-wallet") || s.includes("e-walet")) return "Top Up E-Walet";
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
  // Transfer format: #FTxxxxxxxxx
  const ftMatch = body.match(/#?(FT\d{6,})/i) || subject.match(/#?(FT\d{6,})/i);
  if (ftMatch) return ftMatch[1];

  // Bill payment format: DPTxxxxxxxx (from subject)
  const dptMatch = subject.match(/#?(DPT\d{6,})/i) || body.match(/(?:ID Transaksi|id transaksi)[^<]*?(DPT\d{6,})/i);
  if (dptMatch) return dptMatch[1];

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
 * Looks for "Jumlah Tagihan" or "Nominal" labels followed by Rp value.
 */
function extractNominal(body: string): number {
  // Strip HTML to get plain pairs of label → value
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // Pattern: "Jumlah Tagihan ... Rpxx.xxx" or "Nominal ... Rpxx.xxx"
  const patterns = [
    /(?:Jumlah Tagihan|Total Tagihan)[^R]*?(Rp[\d.,]+)/i,
    /Nominal[^R]*?(Rp[\d.,]+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseRupiah(m[1]);
  }

  // Fallback: find any Rp value in detail__value cells
  const cellMatches = body.match(/class="detail__value"[^>]*>[^<]*(Rp[\d.,]+)/i);
  if (cellMatches) return parseRupiah(cellMatches[1]);

  // Last resort: find largest Rp value in body
  const allRp = [...text.matchAll(/Rp([\d.,]+)/g)].map((m) => parseRupiah("Rp" + m[1]));
  if (allRp.length > 0) return Math.max(...allRp);

  return 0;
}

/**
 * Parse Indonesian date string to Date object.
 * e.g. "14 April 2026, 14:00 WIB" → Date
 */
function parseIndonesianDate(dateStr: string): Date {
  const months: Record<string, number> = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  };

  // Match: "14 April 2026, 14:00 WIB" or "14 April 2026 14:00 WIB"
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
  // Look for "Waktu Proses" or "Waktu Terkirim" label
  const m = text.match(/(?:Waktu Proses|Waktu Terkirim)[^0-9]*(\d{1,2}\s+\w+\s+\d{4}[,\s]+\d{1,2}[:.]\d{2}\s*WIB)/i);
  if (m) return parseIndonesianDate(m[1]);

  // Fallback: find any date pattern
  const fallback = text.match(/(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}[,\s]+\d{1,2}[:.]\d{2}\s*WIB)/i);
  if (fallback) return parseIndonesianDate(fallback[1]);

  return new Date();
}

/**
 * Extract customer name from email body.
 */
function extractCustomerName(body: string, serviceType: string): string | null {
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  if (serviceType === "Transfer") {
    const m = text.match(/Nama Tujuan[^A-Z]*([\w\s.]+?)(?=\s{2,}|Bank|Nomor)/i);
    if (m) return m[1].trim();
  } else {
    // Bill payments
    const m = text.match(/Nama Pelanggan[^A-Z]*([\w\s.]+?)(?=\s{2,}|Alamat|Periode|Jumlah)/i);
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
    const m = text.match(/(?:Nomor Pelanggan|Nomor Meter\/ID)\s*([\d\s]+)/i);
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
  }
  return null;
}

/**
 * Main parser: takes email subject + HTML body, returns parsed data.
 */
export function parseFlipEmail(subject: string, body: string): FlipParsedData | null {
  const flipId = extractFlipId(subject, body);
  if (!flipId) return null;

  const serviceType = detectServiceType(subject);
  const nominal = extractNominal(body);
  const transactionTime = extractTransactionTime(body);
  const customerName = extractCustomerName(body, serviceType);
  const customerNumber = extractCustomerNumber(body, serviceType);
  const bankOrProvider = extractBankOrProvider(body, serviceType, subject);

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
