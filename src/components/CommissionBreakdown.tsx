"use client";
import { explainCommission, type RuleSnapshot } from "@/lib/commission";
import { formatMoney } from "@/lib/money";

/** "Ver cálculo" de comisiones: cada línea desde el snapshot guardado. */
export function CommissionBreakdown({ entries, currency }: { entries: { id: string; description: string; amount: number; rule_snapshot: RuleSnapshot }[]; currency: string }) {
  const total = entries.reduce((s, e) => s + Number(e.amount), 0);
  return (
    <div className="space-y-3 font-mono text-sm">
      {entries.map((e) => (
        <div key={e.id} className="rounded border p-2">
          <div className="mb-1 font-sans font-medium">{e.description}</div>
          {explainCommission(e.rule_snapshot, Number(e.amount)).map((l, i) => (
            <div key={i} className="flex justify-between"><span>{l.op ?? " "} {l.label}</span><span>{l.text ?? (l.amount !== undefined ? formatMoney(l.amount, currency) : "")}</span></div>
          ))}
        </div>
      ))}
      <div className="flex justify-between border-t pt-1 font-bold"><span>= Total comisión</span><span>{formatMoney(total, currency)}</span></div>
    </div>
  );
}
