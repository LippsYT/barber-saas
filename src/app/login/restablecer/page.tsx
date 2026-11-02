"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sb, errEs } from "@/lib/supabase";

/** Destino del enlace del correo «Restablecer contraseña»: el cliente de Supabase canjea el código de la URL y abre una sesión de recuperación. */
export default function Restablecer() {
  const router = useRouter();
  const [state, setState] = useState<"wait" | "ready" | "expired">("wait");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = sb().auth.onAuthStateChange((ev, session) => { if (ev === "PASSWORD_RECOVERY" || (ev === "SIGNED_IN" && session)) setState("ready"); });
    const t = setTimeout(async () => { const { data } = await sb().auth.getSession(); setState(data.session ? "ready" : "expired"); }, 2500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (pw.length < 8) return setMsg("La contraseña debe tener al menos 8 caracteres.");
    if (pw !== pw2) return setMsg("Las dos contraseñas no coinciden.");
    setBusy(true);
    const { error } = await sb().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(errEs(error));
    router.push("/app");
  }

  return (
    <main>
      <h1 className="h1">Contraseña nueva</h1>
      {state === "wait" && <p className="text-sm text-muted-foreground">Verificando tu enlace…</p>}
      {state === "expired" && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">Este enlace venció o ya se usó. Pide uno nuevo. Ábrelo en el mismo navegador donde lo pediste.</p>
          <Link href="/login?modo=olvide" className="btn-gold block w-full text-center">Pedir un enlace nuevo</Link>
        </div>
      )}
      {state === "ready" && (
        <form onSubmit={submit} className="space-y-3">
          <div><label className="lbl">Contraseña nueva</label><input className="inp" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div><label className="lbl">Repite la contraseña</label><input className="inp" type="password" required minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          <button className="btn-gold w-full" disabled={busy}>{busy ? "Un momento…" : "Guardar y entrar"}</button>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </form>
      )}
    </main>
  );
}
