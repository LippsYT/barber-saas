"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb, errEs } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSignup(new URLSearchParams(location.search).get("modo") === "registro"); }, []);

  async function afterLogin() {
    await sb().rpc("claim_my_invitations");
    const { data } = await sb().from("memberships").select("id").eq("active", true).limit(1);
    router.push(data && data.length ? "/app" : "/onboarding");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      if (signup) {
        const { data, error } = await sb().auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) { setMsg("Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego entra."); return; }
      } else {
        const { error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await afterLogin();
    } catch (err) { setMsg(errEs(err)); } finally { setBusy(false); }
  }
  return (
    <main>
      <h1 className="h1">{signup ? "Crear cuenta" : "Entrar"}</h1>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="lbl">Correo</label><input className="inp" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="lbl">Contraseña</label><input className="inp" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn w-full" disabled={busy}>{busy ? "..." : signup ? "Crear cuenta" : "Entrar"}</button>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button type="button" className="text-sm underline" onClick={() => setSignup(!signup)}>
          {signup ? "Ya tengo cuenta" : "Soy nuevo / me invitaron: crear cuenta"}
        </button>
        <p className="text-xs text-muted-foreground">¿Te invitó tu barbería? Crea tu cuenta con el mismo correo que te registraron y entrarás directo.</p>
      </form>
    </main>
  );
}
