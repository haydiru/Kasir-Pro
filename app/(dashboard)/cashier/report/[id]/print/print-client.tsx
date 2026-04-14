"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import {
  formatCurrency,
  formatDateTime,
  calcExpectedCash,
  calcExpenditureSummary,
  getExpenditureTotal,
  formatLocalDate
} from "@/lib/utils";

export function PrintClient({ report, timezone }: { report: any, timezone: string }) {
  const expectedCash = calcExpectedCash(report);
  const variance = report.manualCashCount - expectedCash;
  const digitalCashIn = report.digitalTransactions
    .filter((d: any) => !d.isNonCash)
    .reduce((sum: number, d: any) => sum + d.grossAmount, 0);
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
            {report.store.name}
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
              <span className="font-medium">: {report.user.name}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-20">Tanggal</span>
              <span className="font-medium">: {formatLocalDate(report.date, timezone)}</span>
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
                <span className="font-medium">: {formatDateTime(report.submittedAt.toISOString(), timezone)}</span>
              </div>
            )}
            {report.verifiedAt && (
              <div className="flex gap-2 justify-end">
                <span className="text-gray-500">Verified</span>
                <span className="font-medium">: {formatDateTime(report.verifiedAt.toISOString(), timezone)}</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 1: Rekap Utama & Selisih */}
        <div className="mb-4 bg-gray-50 border border-gray-300 rounded overflow-hidden">
          <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
               Rekap & Selisih Cash
            </h2>
          </div>
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Modal Awal Laci</span>
              <span className="font-mono">{formatCurrency(report.startingCash)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">+ POS Tunai</span>
              <span className="font-mono">{formatCurrency(report.posCash)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">+ Layanan Digital (Tunai)</span>
              <span className="font-mono">{formatCurrency(digitalCashIn)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">− Pengeluaran (Uang Kasir)</span>
              <span className="font-mono text-red-600">−{formatCurrency(expSummary.fromCashier)}</span>
            </div>
            <div className="h-px bg-gray-300 my-1" />
            <div className="flex justify-between items-center font-bold text-[12px]">
              <span>TOTAL CASH SEHARUSNYA</span>
              <span className="font-mono">{formatCurrency(expectedCash)}</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Rekap Uang Tagihan */}
        {(report.billMoneyReceived > 0 || expSummary.fromBill > 0) && (
          <div className="mb-4 border border-amber-200 bg-amber-50/30 rounded overflow-hidden">
            <div className="px-3 py-1 border-b border-amber-200 text-amber-800 text-[9px] font-bold uppercase tracking-wider">
              Rekap Uang Tagihan
            </div>
            <div className="p-3 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-amber-900/70">Uang Tagihan Masuk</span>
                <span className="font-mono">{formatCurrency(report.billMoneyReceived)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-amber-900/70">− Dipakai untuk Pengeluaran</span>
                <span className="font-mono text-red-600">−{formatCurrency(expSummary.fromBill)}</span>
              </div>
              <div className="h-px bg-amber-200/50 my-1" />
              <div className="flex justify-between items-center font-bold text-amber-900">
                <span>Sisa Uang Tagihan</span>
                <span className="font-mono">{formatCurrency(sisaUangTagihan)}</span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: Hitungan Manual & Variance */}
        <div className="mb-6 space-y-3">
          <div className="flex justify-between items-center border-b-2 border-black pb-1.5">
            <span className="font-bold text-[13px]">Hitungan Manual Kasir</span>
            <span className="font-mono font-bold text-[14px]">{formatCurrency(report.manualCashCount)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 px-1">
            <span className="font-medium text-gray-700">Selisih (Manual - Seharusnya)</span>
            <span className={`font-mono font-bold text-[13px] ${variance < 0 ? "text-red-600" : variance > 0 ? "text-green-600" : ""}`}>
              {variance > 0 ? "+" : ""}{formatCurrency(variance)}
            </span>
          </div>
          
          {report.status === "Verified" && report.finalAdminVariance !== null && (
            <div className="flex justify-between items-center pt-0.5 px-1 text-orange-600 italic">
              <span className="text-[10px]">Selisih Final Admin:</span>
              <span className="font-mono font-bold text-[11px]">
                {report.finalAdminVariance >= 0 ? "+" : ""}
                {formatCurrency(report.finalAdminVariance)}
              </span>
            </div>
          )}
        </div>

        {/* SECTION 4: Detail Transaksi Digital (List) */}
        {report.digitalTransactions.length > 0 && (
          <div className="mb-3">
            <h3 className="text-[9px] font-bold uppercase border-b border-gray-200 pb-0.5 mb-1">Detail Transaksi Digital</h3>
            <div className="space-y-0.5">
              {report.digitalTransactions.map((tx: any) => (
                <div key={tx.id} className="flex justify-between text-[8px] text-gray-600">
                  <span className="truncate pr-2">
                    {tx.serviceType} {tx.detailContact ? `(${tx.detailContact})` : ""} {tx.isNonCash ? `[${tx.paymentMethod}]` : ""}
                  </span>
                  <span className="font-mono">{formatCurrency(tx.grossAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 5: Detail Pengeluaran (List) */}
        {report.expenditures.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[9px] font-bold uppercase border-b border-gray-200 pb-0.5 mb-1">Detail Pengeluaran</h3>
            
            {/* Source Breakdown Summary */}
            <div className="flex gap-4 mb-2 text-[8px] text-gray-500 font-medium bg-gray-50 p-1.5 rounded border border-gray-100 italic">
               <span>Total Kasir: {formatCurrency(expSummary.fromCashier)}</span>
               <span>Total Tagihan: {formatCurrency(expSummary.fromBill)}</span>
               <span>Total Transfer: {formatCurrency(expSummary.fromTransfer)}</span>
            </div>

            <div className="space-y-1.5">
              {report.expenditures.map((ex: any) => {
                const total = (ex.amountFromBill || 0) + (ex.amountFromCashier || 0) + (ex.amountFromTransfer || 0);
                return (
                  <div key={ex.id} className="text-[8px] border-b border-gray-100 pb-1 last:border-0 text-gray-700">
                    <div className="flex justify-between font-medium">
                       <span>- {ex.supplierName}</span>
                       <span className="font-mono">{formatCurrency(total)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-[7px] text-gray-500 pl-3">
                       {ex.amountFromCashier > 0 && <span>Kasir: {formatCurrency(ex.amountFromCashier)}</span>}
                       {ex.amountFromBill > 0 && <span>Tagihan: {formatCurrency(ex.amountFromBill)}</span>}
                       {ex.amountFromTransfer > 0 && <span>Transfer: {formatCurrency(ex.amountFromTransfer)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer info simplified */}
        <div className="grid grid-cols-2 gap-4 text-[8px] text-gray-400 mb-6 border-t pt-2 mt-4 italic">
           <div>
              Total POS Debit: {formatCurrency(report.posDebit)}
           </div>
           <div className="text-right">
              Total Digital Cash: {formatCurrency(digitalCashIn)}
           </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-dashed border-gray-400 grid grid-cols-2 gap-8 text-center text-gray-600">
          <div>
            <p className="mb-8">Kasir Bertugas</p>
            <p className="font-medium text-black border-t border-gray-400 inline-block px-4 pt-1">
              {report.user.name}
            </p>
          </div>
          {report.status === "Verified" && (
            <div>
              <p className="mb-8">Verifikator</p>
              <p className="font-medium text-black border-t border-gray-400 inline-block px-4 pt-1">
                Admin
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
