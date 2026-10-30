"use client";
import { withRunningSum, type LedgerEntry } from "@/lib/ledger";
import { formatMoney, formatSigned } from "@/lib/money";

/** "Ver cálculo": cada línea con signo y acumulado; el último acumulado es el total mostrado. */
export function LedgerCalc({ entries, currency, start = 0, startLabel }: { entries: LedgerEntry[]; currency: string; start?: number; startLabel?: string }) {
  let run = start;
  const lines = withRunningSum(entries);
  return (
    <div className="overflow-x-auto font-mono text-xs">
      {startLabel && <div className="flex justify-between gap-2 py-1"><span>+ {formatMoney(start, currency)} {startLabel}</span><span>acum. {formatMoney(start, currency)}</span></div>}
      {lines.map((l) => { run = start + l.running; return (
        <div key={l.entry.id} className={`flex justify-between gap-2 border-b py-1 ${l.entry.reversal_of ? "italic" : ""}`}>
          <span className={l.signed < 0 ? "text-red-700" : "text-green-700"}>{formatSigned(l.signed, currency)}</span>
          <span className="flex-1 truncate">{l.entry.description}</span>
          <span className="whitespace-nowrap">acum. {formatMoney(run, currency)}</span>
        </div>); })}
      <div className="flex justify-between pt-1 font-bold"><span>= Total</span><span>{formatMoney(start + (lines.at(-1)?.running ?? 0), currency)}</span></div>
    </div>
  );
}
