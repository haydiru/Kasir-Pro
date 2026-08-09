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

const body = `
Detail Transaksi ID Transaksi DPT94835050 Produk Paket Bronet Mini 2GB (7 Hari) Nomor HP +6283817975051
`;
console.log("Detected Provider:", extractBankOrProvider(body, "Pulsa/Paket Data", "Pembelian Paket Data #DPT94835050 berhasil"));
