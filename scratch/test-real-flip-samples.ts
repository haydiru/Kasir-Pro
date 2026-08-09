import { parseFlipEmail } from "../lib/flip-parser";

const sample1Subject = "Transfer ke Dnid Yohxxxx Patx Lanxx berhasil";
const sample1Body = `
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">ID Transaksi</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">#ST26080908134992805F2X</div>
</div>
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">Waktu Terkirim</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">09 Aug 2026 08:13 WIB</div>
</div>
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">Nama Tujuan</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">Dnid Yohxxxx Patx Lanxx</div>
</div>
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">Bank Tujuan</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">DANA</div>
</div>
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 185px;">Nomor Rekening Tujuan</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 190px);text-align: right;">085184324901</div>
</div>
<div class="section__content__detail">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">Nominal</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">Rp65.000</div>
</div>
`;

const sample2Subject = "Transfer ke Chelsy Phasya Putri berhasil";
const sample2Body = `
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">ID Transaksi</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">#ST260809080234820G3VIB</div>
</div>
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">Waktu Terkirim</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">09 Aug 2026 08:10 WIB</div>
</div>
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">Nama Tujuan</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">Chelsy Phasya Putri</div>
</div>
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">Bank Tujuan</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">GoPay</div>
</div>
<div class="section__content__detail" style="margin-bottom: 10px;">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 185px;">Nomor Rekening Tujuan</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 190px);text-align: right;">085810579653</div>
</div>
<div class="section__content__detail">
<div class="text--gray" style="color: #333333;display: inline-block;vertical-align: top;width: 175px;">Nominal</div>
<div class="text--bold" style="font-weight: bold;display: inline-block;vertical-align: top;width: calc(100% - 180px);text-align: right;">Rp600.000</div>
</div>
`;

console.log("--- Sample 1 Parsing Result ---");
console.log(parseFlipEmail(sample1Subject, sample1Body));

console.log("\n--- Sample 2 Parsing Result ---");
console.log(parseFlipEmail(sample2Subject, sample2Body));
