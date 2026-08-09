import { parseFlipEmail } from '../lib/flip-parser';

const subject = "Pembelian Pulsa #DPT94835050 berhasil";
const body = `
<html>
<body>
  <table>
    <tr>
      <td>Waktu Terkirim</td>
      <td>05 July 2026, 06:25 WIB</td>
    </tr>
    <tr>
      <td>Nominal</td>
      <td>Rp19.100</td>
    </tr>
    <tr>
      <td>ID Transaksi</td>
      <td>DPT94835050</td>
    </tr>
  </table>
</body>
</html>
`;

console.log("Parsing mock email...");
const result = parseFlipEmail(subject, body);
if (result) {
  console.log("Success!");
  console.log("Parsed Data:", {
    flipId: result.flipId,
    serviceType: result.serviceType,
    nominal: result.nominal,
    transactionTime: result.transactionTime.toISOString(),
    customerName: result.customerName,
    customerNumber: result.customerNumber,
    bankOrProvider: result.bankOrProvider
  });
} else {
  console.log("Failed to parse email!");
}
