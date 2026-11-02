"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sb, errEs } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [invited, setInvited] = useState(false);
  const [sent, setSent] = useState(false); const [cool, setCool] = useState(0);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setSignup(q.get("modo") === "registro");
    // Enlace de invitación del equipo: trae el correo con el que la barbería registró a la persona.
    const c = q.get("correo");
    if (c && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) { setEmail(c); setInvited(true); }
  }, []);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  async function resend() {
    setMsg("");
    const { error } = await sb().auth.resend({ type: "signup", email });
    if (error) return setMsg(errEs(error));
    setCool(60); setMsg("Te lo enviamos de nuevo. Revisa también spam o promociones.");
  }

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
        if (!data.session) { setSent(true); setCool(60); setMsg("Te enviamos un correo para confirmar tu cuenta. Ábrelo, confírmalo y luego entra aquí con tu correo y contraseña."); return; }
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
        <button className="btn-gold w-full" disabled={busy}>{busy ? "Un momento…" : signup ? "Crear cuenta" : "Entrar"}</button>
        {signup && invited && <p className="rounded-2xl bg-[#E3F8EA] p-3 text-sm text-[#0B5B2B]">Tu barbería te invitó. Crea tu cuenta con <b>este mismo correo</b> y, al confirmarlo, entrarás directo a ella.</p>}
        {msg && <p className={`text-sm ${sent ? "text-[#0B5B2B]" : "text-red-600"}`}>{msg}</p>}
        {sent && <button type="button" className="btn2 w-full" disabled={cool > 0} onClick={resend}>{cool > 0 ? `Reenviar correo (${cool} s)` : "Reenviar correo"}</button>}
        {sent && <p className="text-xs text-muted-foreground">Si no lo ves en unos minutos, revisa spam o promociones. ¿Sigue sin llegar? Escríbenos a soporte.</p>}
        <button type="button" className="text-sm underline" onClick={() => setSignup(!signup)}>
          {signup ? "Ya tengo cuenta" : "Soy nuevo / me invitaron: crear cuenta"}
        </button>
        {signup && <p className="text-xs text-muted-foreground">Al crear tu cuenta aceptas los <Link href="/terminos" className="underline">Términos</Link> y la <Link href="/privacidad" className="underline">Política de privacidad</Link>.</p>}
        <p className="text-xs text-muted-foreground">¿Te invitó tu barbería? Crea tu cuenta con el mismo correo que te registraron y entrarás directo.</p>
      </form>
    </main>
  );
}
