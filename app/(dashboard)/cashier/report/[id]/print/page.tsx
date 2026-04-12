"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import {
  shiftReports,
  formatCurrency,
  formatDateTime,
  calcExpectedCash,
  calcExpenditureSummary,
  getExpenditureTotal,
} from "@/lib/mock-data";

export default function PrintReportPage() {
  const params = useParams();
  const reportId = params.id as string;

  const report = shiftReports.find((r) => r.id === reportId);

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Laporan tidak ditemukan</p>
      </div>
    );
  }

  const expectedCash = calcExpectedCash(report);
  const variance = report.manualCashCount - expectedCash;
  const digitalCashIn = report.digitalTransactions
    .filter((d) => !d.isNonCash)
    .reduce((sum, d) => sum + d.grossAmount, 0);
  const expSummary = calcExpenditureSummary(report.expenditures);
  const sisaUangTagihan = report.billMoneyReceived - expSummary.fromBill;

  return (
    <>
      {/* Print Button - hidden when printing */}
      <div className="print-hidden mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Preview Cetak Laporan</h1>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Cetak Laporan
        </Button>
      </div>

      {/* Printable Content */}
      <div className="print-area max-w-2xl mx-auto bg-white text-black p-4 sm:p-6 rounded-lg shadow-sm border print:shadow-none print:border-0 print:p-0 print:rounded-none text-xs">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-2 mb-3">
          <h1 className="text-lg font-bold uppercase tracking-wider">
            {report.storeName}
          </h1>
          <p className="text-[11px] text-gray-600 mt-0.5">
            Laporan Shift Harian Kasir
          </p>
        </div>

        {/* Report Info */}
        <div className="grid grid-cols-2 gap-4 text-[11px] mb-4">
          <div className="space-y-0.5">
            <div className="flex gap-2">
              <span className="text-gray-500 w-20">Kasir</span>
              <span className="font-medium">: {report.userName}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-20">Tanggal</span>
              <span className="font-medium">: {report.date}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-20">Shift</span>
              <span className="font-medium">: {report.shiftType}</span>
            </div>
          </div>
          <div className="space-y-0.5 text-right">
            <div className="flex gap-2 justify-end">
              <span className="text-gray-500">Status</span>
              <span className="font-medium">: {report.status}</span>
            </div>
            {report.submittedAt && (
              <div className="flex gap-2 justify-end">
                <span className="text-gray-500">Submitted</span>
                <span className="font-medium">: {formatDateTime(report.submittedAt)}</span>
              </div>
            )}
            {report.verifiedAt && (
              <div className="flex gap-2 justify-end">
                <span className="text-gray-500">Verified</span>
                <span className="font-medium">: {formatDateTime(report.verifiedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* POS Section */}
        <div className="mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider border-b border-gray-300 pb-0.5 mb-1.5">
            Data POS
          </h2>
          <table className="w-full text-[11px]">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-600">Modal Awal Laci</td>
                <td className="py-0.5 text-right font-mono">{formatCurrency(report.startingCash)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-600">Penghasilan Tunai POS</td>
                <td className="py-0.5 text-right font-mono">{formatCurrency(report.posCash)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-600">Penghasilan Debit POS</td>
                <td className="py-0.5 text-right font-mono">{formatCurrency(report.posDebit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Digital Transactions */}
        {report.digitalTransactions.length > 0 && (
          <div className="mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider border-b border-gray-300 pb-0.5 mb-1.5">
              Layanan Digital ({report.digitalTransactions.length})
            </h2>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-0.5 text-left text-gray-500 font-medium">No</th>
                  <th className="py-0.5 text-left text-gray-500 font-medium">Jenis</th>
                  <th className="py-0.5 text-left text-gray-500 font-medium">Detail</th>
                  <th className="py-0.5 text-right text-gray-500 font-medium">Total Harga</th>
                  <th className="py-0.5 text-left text-gray-500 font-medium pl-4">Bayar</th>
                </tr>
              </thead>
              <tbody>
                {report.digitalTransactions.map((dt, idx) => (
                  <tr key={dt.id} className="border-b border-gray-100">
                    <td className="py-0.5">{idx + 1}</td>
                    <td className="py-0.5">{dt.serviceType}</td>
                    <td className="py-0.5 text-gray-600">{dt.detailContact}</td>
                    <td className="py-0.5 text-right font-mono">{formatCurrency(dt.grossAmount)}</td>
                    <td className="py-0.5 text-[10px] pl-4">
                      {dt.isNonCash ? dt.paymentMethod : "Tunai"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Expenditures */}
        {report.expenditures.length > 0 && (
          <div className="mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider border-b border-gray-300 pb-0.5 mb-1.5">
              Pengeluaran ({report.expenditures.length})
            </h2>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-0.5 text-left text-gray-500 font-medium">No</th>
                  <th className="py-0.5 text-left text-gray-500 font-medium">Supplier</th>
                  <th className="py-0.5 text-right text-gray-500 font-medium">U. Tagihan</th>
                  <th className="py-0.5 text-right text-gray-500 font-medium">U. Kasir</th>
                  <th className="py-0.5 text-right text-gray-500 font-medium">Transfer</th>
                  <th className="py-0.5 text-right text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.expenditures.map((ex, idx) => (
                  <tr key={ex.id} className="border-b border-gray-100">
                    <td className="py-0.5">{idx + 1}</td>
                    <td className="py-0.5 truncate max-w-[120px]">{ex.supplierName}</td>
                    <td className="py-0.5 text-right font-mono">{ex.amountFromBill ? formatCurrency(ex.amountFromBill) : "—"}</td>
                    <td className="py-0.5 text-right font-mono">{ex.amountFromCashier ? formatCurrency(ex.amountFromCashier) : "—"}</td>
                    <td className="py-0.5 text-right font-mono">{ex.amountFromTransfer ? formatCurrency(ex.amountFromTransfer) : "—"}</td>
                    <td className="py-0.5 text-right font-mono font-semibold">{formatCurrency(getExpenditureTotal(ex))}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-300">
                  <td colSpan={2} className="py-0.5 font-bold">Total</td>
                  <td className="py-0.5 text-right font-mono font-semibold">{formatCurrency(expSummary.fromBill)}</td>
                  <td className="py-0.5 text-right font-mono font-semibold">{formatCurrency(expSummary.fromCashier)}</td>
                  <td className="py-0.5 text-right font-mono font-semibold">{formatCurrency(expSummary.fromTransfer)}</td>
                  <td className="py-0.5 text-right font-mono font-bold">{formatCurrency(expSummary.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Summary / Rekap */}
        <div className="mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider border-b border-gray-300 pb-0.5 mb-1.5">
            Rekap & Selisih
          </h2>
          <table className="w-full text-[11px]">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-600">Modal Awal</td>
                <td className="py-0.5 text-right font-mono">{formatCurrency(report.startingCash)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-600">+ POS Tunai</td>
                <td className="py-0.5 text-right font-mono">{formatCurrency(report.posCash)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-600">+ Layanan Digital (Tunai)</td>
                <td className="py-0.5 text-right font-mono">{formatCurrency(digitalCashIn)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-600">− Pengeluaran (Uang Kasir)</td>
                <td className="py-0.5 text-right font-mono">{formatCurrency(expSummary.fromCashier)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1 font-bold">Total Cash Seharusnya</td>
                <td className="py-1 text-right font-mono font-bold text-xs">{formatCurrency(expectedCash)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-600">Cash Hitung Manual</td>
                <td className="py-0.5 text-right font-mono font-semibold">{formatCurrency(report.manualCashCount)}</td>
              </tr>
              <tr className="border-b border-gray-300 bg-gray-50">
                <td className="py-1 font-bold pl-1">Selisih Kasir</td>
                <td className={`py-1 text-right font-mono font-bold text-xs pr-1 ${variance < 0 ? "text-red-600" : variance > 0 ? "text-green-600" : ""}`}>
                  {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sisa Uang Tagihan */}
        {(report.billMoneyReceived > 0 || expSummary.fromBill > 0) && (
          <div className="mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider border-b border-gray-300 pb-0.5 mb-1.5">
              Rekap Uang Tagihan
            </h2>
            <table className="w-full text-[11px]">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-0.5 text-gray-600">Uang Tagihan Masuk</td>
                  <td className="py-0.5 text-right font-mono">{formatCurrency(report.billMoneyReceived)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-0.5 text-gray-600">− Dipakai Pengeluaran</td>
                  <td className="py-0.5 text-right font-mono">{formatCurrency(expSummary.fromBill)}</td>
                </tr>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <td className="py-1 font-bold pl-1">Sisa Uang Tagihan</td>
                  <td className="py-1 text-right font-mono font-bold text-xs pr-1">{formatCurrency(sisaUangTagihan)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Transfer expenditures note */}
        {expSummary.fromTransfer > 0 && (
          <div className="mb-3 text-[10px] text-gray-500 italic">
            * Pengeluaran via Transfer: {formatCurrency(expSummary.fromTransfer)} (tidak memotong cash fisik)
          </div>
        )}

        {/* Admin Verification (if verified) */}
        {report.status === "Verified" && (
          <div className="mb-3 border border-gray-300 p-2 rounded bg-gray-50">
            <h2 className="text-[11px] font-bold uppercase tracking-wider mb-1">
              Hasil Verifikasi Admin
            </h2>
            <div className="text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-600">Selisih Aktual (Admin)</span>
                <span className="font-mono font-bold">
                  {report.finalAdminVariance !== null
                    ? `${report.finalAdminVariance >= 0 ? "+" : ""}${formatCurrency(report.finalAdminVariance)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Catatan</span>
                <span>{report.adminNotes || "—"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-6 text-center text-[11px]">
          <div>
            <p className="text-gray-500 mb-10">Kasir</p>
            <div className="border-b border-gray-400 mx-8" />
            <p className="mt-1 font-medium">{report.userName}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-10">Admin / Verifikator</p>
            <div className="border-b border-gray-400 mx-8" />
            <p className="mt-1 font-medium">_________________</p>
          </div>
        </div>

        {/* Print footer */}
        <div className="mt-4 pt-2 border-t border-gray-200 text-center text-[9px] text-gray-400 font-mono">
          Dicetak: {new Date().toLocaleString("id-ID")} • KasirPro Shift Report
        </div>
      </div>
    </>
  );
}
