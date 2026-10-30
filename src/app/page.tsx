import Link from "next/link";
export default function Home() {
  return (
    <main className="space-y-4 pt-10">
      <h1 className="text-3xl font-bold">Tu barbería, en orden</h1>
      <p className="text-gray-600">Agenda, link de reservas, cobros y una caja donde cada número se explica solo.</p>
      <div className="flex gap-3">
        <Link className="btn" href="/login?modo=registro">Crear mi barbería</Link>
        <Link className="btn2" href="/login">Entrar</Link>
      </div>
    </main>
  );
}
