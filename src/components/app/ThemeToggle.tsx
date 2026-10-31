"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "pulso:theme";
/** Aplica el tema guardado a <html>. Solo dentro de /app: al salir se quita. */
export function applySavedTheme() {
  let dark = false;
  try { dark = localStorage.getItem(KEY) === "dark"; } catch { /* sin almacenamiento */ }
  document.documentElement.classList.toggle("app-dark", dark);
  return dark;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("app-dark")); }, []);
  function set(next: boolean) {
    setDark(next);
    document.documentElement.classList.toggle("app-dark", next);
    try { localStorage.setItem(KEY, next ? "dark" : "light"); } catch { /* sin almacenamiento */ }
  }
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1" role="radiogroup" aria-label="Apariencia">
      {([[false, "Claro", Sun], [true, "Oscuro", Moon]] as const).map(([v, label, Icon]) => (
        <button key={label} role="radio" aria-checked={dark === v} onClick={() => set(v)} className={`flex min-h-[44px] items-center justify-center gap-2 rounded-full text-sm font-bold ${dark === v ? "bg-ink text-white" : "text-ink/60"}`}>
          <Icon className="h-4 w-4" />{label}
        </button>))}
    </div>
  );
}
