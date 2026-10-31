"use client";
import { useEffect, useState } from "react";
import { Check, Delete } from "lucide-react";

/** Campo de monto: al tocarlo abre un teclado numérico grande (hoja inferior). Valor como texto "12.50". */
export function AmountField({ value, onChange, placeholder = "0.00", prefix = "US$", label = "Monto", required = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string; label?: string; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const press = (k: string) => {
    if (k === "del") return onChange(value.slice(0, -1));
    if (k === ".") return value.includes(".") ? undefined : onChange(value ? value + "." : "0.");
    if (/^\d+\.\d{2}$/.test(value)) return;
    if (value === "0") return onChange(k);
    if (value.replace(".", "").length >= 9) return;
    onChange(value + k);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "." || e.key === ",") press("."); else if (e.key === "Backspace") press("del"); else if (e.key === "Enter" || e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
  return (
    <>
      <input className="inp" readOnly required={required} inputMode="none" aria-label={label} placeholder={placeholder} value={value ? `${prefix} ${value}` : ""} onClick={() => setOpen(true)} onFocus={() => setOpen(true)} />
      {open && (
        <div className="fixed inset-0 z-[60] bg-ink/40" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label={label} className="absolute inset-x-0 bottom-0 rounded-t-[1.7rem] bg-[#F4F1E8] p-4 pb-[calc(1rem+var(--sab))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
            <div className="text-xs font-extrabold uppercase tracking-widest text-ink/50">{label}</div>
            <div className="mb-3 break-all font-display text-5xl font-extrabold leading-none">{prefix} {value || "0"}</div>
            <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
              {keys.map((k) => (
                <button key={k} type="button" aria-label={k === "del" ? "Borrar" : k} onClick={() => press(k)} className="grid h-14 place-items-center rounded-2xl bg-white text-2xl font-bold shadow-sm active:scale-95 active:bg-ink/5">
                  {k === "del" ? <Delete className="h-6 w-6" /> : k}
                </button>
              ))}
            </div>
            <button type="button" className="btn mt-3 w-full" onClick={() => setOpen(false)}><Check className="h-5 w-5" />Listo</button>
          </div>
        </div>
      )}
    </>
  );
}
