// A mock implementation of the date parser to test its behavior
function parseIndonesianDate(dateStr: string): Date {
  const months: Record<string, number> = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  };

  const m = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})[,\s]+(\d{1,2})[:.:](\d{2})/i);
  if (!m) {
    console.log("No regex match for:", dateStr);
    return new Date();
  }

  const day = parseInt(m[1]);
  const monthStr = m[2].toLowerCase();
  const month = months[monthStr] ?? 0;
  const year = parseInt(m[3]);
  const hour = parseInt(m[4]);
  const minute = parseInt(m[5]);

  console.log(`Parsed parts: Day=${day}, MonthStr=${monthStr}, Month=${month}, Year=${year}, Hour=${hour}, Minute=${minute}`);

  const d = new Date(Date.UTC(year, month, day, hour - 7, minute));
  return d;
}

console.log("Test: '05 July 2026, 06:25 WIB'");
const d1 = parseIndonesianDate("05 July 2026, 06:25 WIB");
console.log("Result ISO:", d1.toISOString());

console.log("\nTest: '05 Jul 2026, 06:25 WIB'");
const d2 = parseIndonesianDate("05 Jul 2026, 06:25 WIB");
console.log("Result ISO:", d2.toISOString());
