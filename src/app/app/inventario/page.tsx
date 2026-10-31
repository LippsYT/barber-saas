"use client";
import { useEffect, useState } from "react";
import { Minus, PackageSearch, Plus, Trash2 } from "lucide-react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney, toCents } from "@/lib/money";

type Product = { id: string; name: string; category: string | null; price: number; cost: number; stock: number; min_stock: number; supplier_id: string | null; active: boolean };
type Supplier = { id: string; name: string; phone: string | null; email: string | null; notes: string | null };

export default function Inventario() {
  const { biz, isManager } = useApp();
  const [tab, setTab] = useState<"productos" | "proveedores">("productos");
  const [products, setProducts] = useState<Product[]>([]); const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [q, setQ] = useState(""); const [err, setErr] = useState("");
  const [p, setP] = useState({ name: "", category: "", price: "", cost: "", stock: "0", min_stock: "0", supplier_id: "" });
  const [s, setS] = useState({ name: "", phone: "", email: "", notes: "" });

  const load = async () => {
    const [{ data: a }, { data: b }] = await Promise.all([
      sb().from("products").select("id,name,category,price,cost,stock,min_stock,supplier_id,active").eq("business_id", biz.id).eq("active", true).order("name"),
      isManager ? sb().from("suppliers").select("id,name,phone,email,notes").eq("business_id", biz.id).order("name") : Promise.resolve({ data: [] as Supplier[] }),
    ]);
    setProducts((a ?? []) as Product[]); setSuppliers((b ?? []) as Supplier[]);
  };
  useEffect(() => { load(); }, []);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await sb().from("products").insert({ business_id: biz.id, name: p.name.trim(), category: p.category.trim() || null, price: toCents(p.price), cost: toCents(p.cost),
      stock: Math.max(0, Math.floor(Number(p.stock) || 0)), min_stock: Math.max(0, Math.floor(Number(p.min_stock) || 0)), supplier_id: p.supplier_id || null });
    if (error) return setErr(errEs(error));
    setP({ ...p, name: "", price: "", cost: "", stock: "0" }); load();
  }
  async function adjust(x: Product, d: number) {
    const stock = Math.max(0, x.stock + d); if (stock === x.stock) return;
    setProducts(products.map((y) => (y.id === x.id ? { ...y, stock } : y)));
    const { error } = await sb().from("products").update({ stock }).eq("id", x.id);
    if (error) { setErr(errEs(error)); load(); }
  }
  async function archive(x: Product) { if (confirm(`¿Quitar "${x.name}" del inventario?`)) { await sb().from("products").update({ active: false }).eq("id", x.id); load(); } }
  async function addSupplier(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await sb().from("suppliers").insert({ business_id: biz.id, name: s.name.trim(), phone: s.phone.trim() || null, email: s.email.trim() || null, notes: s.notes.trim() || null });
    if (error) return setErr(errEs(error));
    setS({ name: "", phone: "", email: "", notes: "" }); load();
  }
  async function removeSupplier(x: Supplier) { if (confirm(`¿Quitar a "${x.name}"?`)) { await sb().from("suppliers").delete().eq("id", x.id); load(); } }

  const shown = products.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()) || (x.category ?? "").toLowerCase().includes(q.toLowerCase()));
  const low = products.filter((x) => x.min_stock > 0 && x.stock <= x.min_stock).length;
  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Lo que vendes</div><h1 className="h1 !mb-0">Inventario</h1></div>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1">{(["productos", "proveedores"] as const).map((t) => (
        <button key={t} className={`min-h-[44px] rounded-full text-sm font-bold capitalize ${tab === t ? "bg-ink text-white" : "text-ink/60"}`} onClick={() => setTab(t)}>{t}</button>))}</div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}

      {tab === "productos" && <>
        {low > 0 && <p role="status" className="rounded-2xl bg-[#FFE9C7] p-3 text-sm font-semibold text-[#7A4A00]">{low} producto{low > 1 ? "s" : ""} con poco stock.</p>}
        <input className="inp" placeholder="Buscar producto o categoría" value={q} onChange={(e) => setQ(e.target.value)} />
        {isManager && <form onSubmit={addProduct} className="card space-y-2">
          <div className="font-display text-xl font-extrabold uppercase leading-none">Nuevo producto</div>
          <input className="inp" required placeholder="Nombre *" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          <input className="inp" placeholder="Categoría (ej. Ceras, Cuidado de barba)" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0"><span className="lbl">Precio al público *</span><input className="inp" required inputMode="decimal" placeholder="0.00" value={p.price} onChange={(e) => setP({ ...p, price: e.target.value })} /></label>
            <label className="min-w-0"><span className="lbl">Costo</span><input className="inp" inputMode="decimal" placeholder="0.00" value={p.cost} onChange={(e) => setP({ ...p, cost: e.target.value })} /></label>
            <label className="min-w-0"><span className="lbl">Cantidad</span><input className="inp" inputMode="numeric" value={p.stock} onChange={(e) => setP({ ...p, stock: e.target.value })} /></label>
            <label className="min-w-0"><span className="lbl">Avisar si queda</span><input className="inp" inputMode="numeric" value={p.min_stock} onChange={(e) => setP({ ...p, min_stock: e.target.value })} /></label>
          </div>
          {suppliers.length > 0 && <select className="inp" value={p.supplier_id} onChange={(e) => setP({ ...p, supplier_id: e.target.value })}><option value="">Sin proveedor</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
          <button className="btn w-full">Agregar producto</button>
        </form>}
        {!shown.length && <div className="card grid place-items-center gap-1 py-8 text-center"><PackageSearch className="h-8 w-8 text-ink/30" /><p className="font-bold">No hay productos</p><p className="text-sm text-ink/55">Tu inventario espera por nuevos productos.</p></div>}
        <ul className="space-y-2">{shown.map((x) => { const isLow = x.min_stock > 0 && x.stock <= x.min_stock; return (
          <li key={x.id} className="card min-w-0 p-3">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="break-words font-bold">{x.name}</div><div className="text-xs text-ink/55">{x.category || "Sin categoría"}{isManager && x.cost > 0 ? ` · costo ${formatMoney(x.cost)}` : ""}</div></div>
              <div className="shrink-0 font-display text-xl font-extrabold">{formatMoney(x.price)}</div></div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`pill ${isLow ? "bg-[#FFD9D9] text-[#8A1C1C]" : "bg-ink/[0.06]"}`}>{x.stock} en stock{isLow ? " · bajo" : ""}</span>
              {isManager && <div className="flex items-center gap-1.5">
                <button aria-label="Restar uno" className="grid h-10 w-10 place-items-center rounded-full bg-ink/[0.06]" onClick={() => adjust(x, -1)}><Minus className="h-4 w-4" /></button>
                <button aria-label="Sumar uno" className="grid h-10 w-10 place-items-center rounded-full bg-ink/[0.06]" onClick={() => adjust(x, 1)}><Plus className="h-4 w-4" /></button>
                <button aria-label={`Quitar ${x.name}`} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm" onClick={() => archive(x)}><Trash2 className="h-4 w-4 text-red-600" /></button></div>}
            </div>
          </li>); })}</ul>
        <p className="text-xs text-ink/50">Los productos se descuentan a mano por ahora; todavía no se venden desde Cobrar.</p>
      </>}

      {tab === "proveedores" && <>
        {isManager ? <form onSubmit={addSupplier} className="card space-y-2">
          <div className="font-display text-xl font-extrabold uppercase leading-none">Nuevo proveedor</div>
          <input className="inp" required placeholder="Nombre *" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          <input className="inp" type="tel" placeholder="Teléfono" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} />
          <input className="inp" type="email" placeholder="Email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} />
          <input className="inp" maxLength={500} placeholder="Notas" value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
          <button className="btn w-full">Agregar proveedor</button>
        </form> : <p className="card text-sm text-ink/60">Solo el dueño o un admin ve a los proveedores.</p>}
        <ul className="space-y-2">{suppliers.map((x) => (
          <li key={x.id} className="card flex min-w-0 items-center justify-between gap-3 p-3">
            <div className="min-w-0"><div className="break-words font-bold">{x.name}</div><div className="break-words text-xs text-ink/55">{[x.phone, x.email].filter(Boolean).join(" · ") || "Sin contacto"}</div>{x.notes && <div className="mt-1 break-words text-xs text-ink/60">{x.notes}</div>}</div>
            <button aria-label={`Quitar ${x.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm" onClick={() => removeSupplier(x)}><Trash2 className="h-4 w-4 text-red-600" /></button>
          </li>))}</ul>
        {isManager && !suppliers.length && <p className="text-center text-sm text-ink/55">Todavía no tienes proveedores.</p>}
      </>}
    </main>
  );
}
