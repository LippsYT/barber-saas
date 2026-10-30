"use client";
import { Booking } from "@/components/Booking";
import { CitaPublic } from "@/components/CitaPublic";
import { HomeDash } from "@/components/app/HomeDash";
import { WeekGrid } from "@/components/app/WeekGrid";
import { ServiceEditor, type ServiceDraft } from "@/components/app/ServiceEditor";
import { WhatsAppConnect } from "@/components/app/WhatsAppConnect";
import { TabBar } from "@/components/app/TabBar";
import { Chispa } from "@/components/brand/Mascot";
import { Logo } from "@/components/brand/Logo";
import { houseDavidsonPreview } from "@/lib/housePreview";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { AttendPanel } from "@/components/app/AttendPanel";
import { CajaCierreView, CajaHoyView, CajaReportesView, SettleCard } from "@/components/app/caja/views";
import { closeDrawer, periodReport, serviceBreakdown, settleAccounts } from "@/lib/caja";

const preview = houseDavidsonPreview();
const kevin = preview.barbers.find((b) => b.name.startsWith("Kevin"))!;
const oro = preview.services.find((s) => s.name === "servicio oro")!;

function Frame({ children, tab = "/app" }: { children: React.ReactNode; tab?: string }) {
  return (
    <div className="app-canvas min-h-screen">
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">{children}</div>
      <TabBar path={tab} canCash open={false} onToggle={() => {}} />
    </div>
  );
}

function Dots({ step }: { step: number }) {
  return (
    <div className="paper-dark min-h-screen px-4 py-5 text-white">
      <div className="mb-6 flex items-center justify-between text-sm font-extrabold">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">‹</span>
        Configura tu cuenta
        <span className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-2 rounded-full ${i === step ? "w-6 bg-[#2F5BFF]" : "w-2 bg-white/25"}`} />)}</span>
      </div>
      <Slot step={step} />
    </div>
  );
}

function Slot({ step }: { step: number }) {
  if (step === 0) return (
    <div>
      <h1 className="display text-4xl">Colaboradores</h1>
      <p className="mt-2 text-sm text-white/70">Primero el equipo. Tú quedas como dueño.</p>
      <div className="mt-4 rounded-3xl bg-white p-3 text-ink">
        <div className="font-bold">angeles</div>
        <div className="text-xs text-ink/50">Barbero</div>
      </div>
      <button className="btn mt-4 w-full">Siguiente</button>
    </div>
  );
  if (step === 1) return (
    <div>
      <h1 className="display text-4xl">Crea tus servicios</h1>
      <p className="mt-2 text-sm text-white/70">Nombre, precio en dólares y duración. Luego, la comisión.</p>
      <button className="btn2 mt-4 w-full text-ink">Crear servicio</button>
      <button className="btn mt-3 w-full">Siguiente</button>
    </div>
  );
  if (step === 2) return (
    <div>
      <h1 className="display text-4xl">Datos del negocio</h1>
      <div className="mt-4 grid place-items-center rounded-3xl border border-dashed border-white/20 p-8 text-sm">Agregar imagen de portada</div>
      <div className="mt-3 rounded-2xl bg-white p-3 text-ink">Casa Pulso</div>
      <div className="mt-2 rounded-2xl bg-white p-3 text-ink">593999000111</div>
      <button className="btn mt-4 w-full">Siguiente</button>
    </div>
  );
  if (step === 3) return <WhatsAppConnect preview={{ stage: "code", code: "K7MQ4R2P", demo: true }} />;
  return (
    <div className="text-center">
      <Chispa pose="wave" className="mx-auto w-36" />
      <h1 className="display text-5xl">¡Felicitaciones!</h1>
      <p className="mt-2 text-sm text-white/70">Tu link de reservas, listo para compartir.</p>
      <div className="mt-4 rounded-2xl bg-white/10 p-3 text-left text-sm">https://pulso.example/casa-pulso</div>
      <div className="mt-3 grid grid-cols-2 gap-2"><span className="btn2">Copiar enlace</span><span className="btn bg-[#25D366]">WhatsApp</span></div>
      <button className="btn-gold mt-3 w-full">Ir al inicio</button>
    </div>
  );
}

const serviceDraft: ServiceDraft = {
  name: "corte simple", price: "10.00", duration: "45", description: "",
  drafts: [
    { memberId: "a", selected: true, kind: "percent", value: 30 },
    { memberId: "b", selected: true, kind: "percent", value: 30 },
  ],
};

const inTwoDays = new Date(Date.now() + 2 * 86400000);
const citaFixture = {
  status: "reserved" as const,
  starts_at: new Date(Date.UTC(inTwoDays.getUTCFullYear(), inTwoDays.getUTCMonth(), inTwoDays.getUTCDate(), 15, 10, 0)).toISOString(),
  member_name: "Kevin Álvarez",
  business_name: "House Davidson",
  timezone: "America/Guayaquil",
  currency: "USD",
  address: "avenida reales tamarindo y Joaquín Ramírez, Portoviejo",
  items: [{ name: "servicio oro", price: 1400 }],
};

function CajaShots({ vista }: { vista: string }) {
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [adj, setAdj] = useState("-2");
  const [tip, setTip] = useState("1");
  const [pay, setPay] = useState<"cash" | "transfer">("transfer");
  const broken = serviceBreakdown([{ name: "Corte", unitPrice: 1200, qty: 10 }, { name: "Corte niño", unitPrice: 800, qty: 5 }]);
  const drawer = closeDrawer([
    { bucket: "sales", method: "cash", amount: 12000 },
    { bucket: "tips", method: "cash", amount: 500 },
    { bucket: "expenses", method: "cash", amount: -1400 },
    { bucket: "advances", method: "cash", amount: -1000 },
    { bucket: "sales", method: "transfer", amount: 4000 },
  ], 10000);
  const report = periodReport(
    [
      { id: "1", barberId: "k", barberName: "Kevin Álvarez", income: 12000, tip: 500, items: [{ name: "Corte", unitPrice: 1200, qty: 10, lineTotal: 12000 }], payments: [{ method: "cash", amount: 12500 }] },
      { id: "2", barberId: "a", barberName: "Andrés Alava", income: 4000, tip: 0, items: [{ name: "Corte niño", unitPrice: 800, qty: 5, lineTotal: 4000 }], payments: [{ method: "transfer", amount: 4000 }] },
    ],
    [{ amount: 1400, method: "cash", concept: "Insumos" }],
  );
  const kevin = settleAccounts({ commissions: [{ id: "1", description: "3 × Corte", amount: 3600 }], advances: [{ id: "a", note: "Adelanto de hoy", amount: 1000 }], carriedIn: 0 });
  const andres = settleAccounts({ commissions: [{ id: "2", description: "Corte", amount: 600 }], advances: [{ id: "b", note: "Adelanto de hoy", amount: 1000 }], carriedIn: 0 });
  const by = report.byMethod;
  if (vista === "cita-atendida") return (
    <Frame tab="/app/agenda">
      <div className="eyebrow">Viernes</div>
      <h1 className="display mb-3 text-4xl">Agenda</h1>
      <article className="card">
        <div className="flex items-start gap-3">
          <div className="w-14 shrink-0 font-display text-xl font-extrabold">10:30</div>
          <div className="min-w-0">
            <div className="font-semibold">Camila Soto</div>
            <div className="text-sm">Corte <span className="text-ink/50">· US$ 12.00</span></div>
            <div className="mt-1 text-xs text-ink/50">Kevin Álvarez</div>
          </div>
        </div>
        <AttendPanel items={[{ name: "Corte", price: 1200 }]} method={method} adjustment={adj} tip={tip} onMethod={setMethod} onAdjustment={setAdj} onTip={setTip} onConfirm={() => {}} onNoShow={() => {}} />
      </article>
    </Frame>
  );
  if (vista === "caja-cierre") return (
    <Frame tab="/app/caja">
      <CajaCierreView dayLabel="Viernes 30 de octubre" lines={drawer.lines} expected={drawer.expected} counted="100.00" onCounted={() => {}} notes="Faltó el vuelto de un billete" onNotes={() => {}} difference={drawer.difference} locked={false} saved={null} onClose={() => {}} />
    </Frame>
  );
  if (vista === "caja-reportes") return (
    <Frame tab="/app/caja">
      <CajaReportesView kind="day" onKind={() => {}} anchor="2026-10-30" onAnchor={() => {}} income={report.income} expenses={report.expenses} net={report.net} tips={report.tips} advances={1000} byMethod={by} services={report.byService} barbers={report.byBarber.map((b) => ({ ...b, commission: b.id === "k" ? 6000 : 2000 }))} />
    </Frame>
  );
  if (vista === "caja-adelantos") return (
    <Frame tab="/app/caja">
      <div className="space-y-4">
        <div>
          <div className="eyebrow">Equipo</div>
          <h1 className="display text-4xl">Adelantos.</h1>
          <p className="mt-2 text-sm text-ink/60">Un adelanto es plata que ya le diste. En la liquidación se resta de lo que ganó.</p>
        </div>
        <SettleCard name="Kevin Álvarez" lines={kevin.lines} toPay={kevin.toPay} carryOut={kevin.carryOut} method={pay} onMethod={setPay} onPay={() => {}} canPay hint="Incluye lo que todavía no se liquidó, aunque sea de antes." />
        <SettleCard name="Andrés Alava" lines={andres.lines} toPay={andres.toPay} carryOut={andres.carryOut} method={pay} onMethod={setPay} onPay={() => {}} canPay />
      </div>
    </Frame>
  );
  return (
    <Frame tab="/app/caja">
      <CajaHoyView
        dayLabel="Viernes 30 de octubre" sentence={broken.sentence} income={17500} tips={1500} expenses={1400} net={16100}
        services={broken.lines}
        byMethod={{ cash: { in: 12500, out: 1400, net: 11100 }, transfer: { in: 5000, out: 0, net: 5000 }, card: { in: 0, out: 0, net: 0 }, other: { in: 0, out: 0, net: 0 } }}
        expensesList={[{ id: "1", description: "Insumos", amount: 1400, method: "cash" }]}
        locked={false}
        expense={{ concept: "", amount: "", method: "cash", date: "2026-10-30" }}
        onExpense={() => {}} onSaveExpense={() => {}} onPrev={() => {}} onNext={() => {}}
      />
    </Frame>
  );
}

export function Screens({ vista }: { vista: string }) {
  if (vista === "cita-reservada" || vista === "cita-cancelada") {
    return <CitaPublic slug="house-davidson" token="preview" fixture={{ ...citaFixture, status: vista === "cita-cancelada" ? "cancelled" : "reserved" }} />;
  }
  if (vista.startsWith("reserva-")) {
    const map = { "reserva-fecha": 0, "reserva-barbero": 1, "reserva-servicio": 2, "reserva-horario": 3, "reserva-datos": 4 } as const;
    const step = map[vista as keyof typeof map] ?? 0;
    return <Booking slug="house-davidson" previewCatalog={preview} initialStep={step} preset={step >= 2 ? { memberId: kevin.id, serviceIds: [oro.id], pickFirstSlot: step >= 4 } : undefined} />;
  }
  if (vista === "inicio") return (
    <Frame>
      <HomeDash greeting="Buenas tardes" business="House Davidson" monthLabel="octubre" salesCents={128400} daysLeft={12} delta={18} figures={[
        { label: "Citas del mes", value: "86" }, { label: "Ticket promedio", value: "US$ 14.93" }, { label: "Ventas cobradas", value: "86" }, { label: "Clientes nuevos", value: "14" },
      ]} visits={[
        { id: "1", time: "09:00", title: "servicio oro", who: "Juan · Kevin Álvarez" },
        { id: "2", time: "10:30", title: "servicio vip", who: "Ana · Andrés Alava" },
      ]} />
    </Frame>
  );
  if (vista === "agenda") return (
    <Frame tab="/app/agenda">
      <div className="eyebrow">Semana</div>
      <h1 className="display mb-3 text-4xl">Agenda</h1>
      <WeekGrid
        active="2026-10-28"
        onDay={() => {}}
        days={["27", "28", "29", "30", "31", "01", "02"].map((n, i) => ({ date: `2026-10-${n}`, dow: ["mar", "mié", "jue", "vie", "sáb", "dom", "lun"][i], num: n }))}
        blocks={[
          { id: "1", date: "2026-10-28", memberId: "kevin", memberName: "Kevin Álvarez", title: "servicio oro", startMin: 9 * 60, endMin: 9 * 60 + 45 },
          { id: "2", date: "2026-10-28", memberId: "andres", memberName: "Andrés Alava", title: "servicio vip", startMin: 11 * 60, endMin: 12 * 60 + 10 },
          { id: "3", date: "2026-10-29", memberId: "yuleizi", memberName: "yuleizi Pacheco", title: "uñas vip", startMin: 15 * 60, endMin: 16 * 60 },
          { id: "4", date: "2026-10-30", memberId: "ricardo", memberName: "Ricardo Salazar", title: "servicio básico", startMin: 10 * 60, endMin: 10 * 60 + 30 },
        ]}
      />
    </Frame>
  );
  if (vista === "caja" || vista === "caja-hoy" || vista === "caja-cierre" || vista === "caja-reportes" || vista === "caja-adelantos" || vista === "cita-atendida") return <CajaShots vista={vista} />;
  if (vista === "clientes") return (
    <Frame tab="/app/clientes">
      <div className="mb-3 flex items-end justify-between"><h1 className="display text-4xl">Clientes</h1><span className="pill bg-[#D6FF4A] text-ink">128</span></div>
      <div className="inp mb-3">Buscar por nombre o teléfono</div>
      {[["C", "Camila Soto", "593991112233"], ["M", "Mateo Ruiz", "593992223344"], ["E", "Elena Paz", "593993334455"]].map(([i, n, p]) => (
        <div key={n} className="card mb-2 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#2F5BFF] font-display text-lg font-extrabold text-white">{i}</span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">{n}</span><span className="text-sm text-ink/50">{p}</span></span>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#25D366] text-white"><MessageCircle className="h-5 w-5" /></span>
        </div>
      ))}
    </Frame>
  );
  if (vista === "servicio" || vista === "servicio-comision") return (
    <Frame tab="/app/servicios">
      <div className="eyebrow">Nuevo</div>
      <h1 className="display mb-4 text-4xl">Servicio</h1>
      <ServiceEditor startTab={vista === "servicio-comision" ? "team" : "info"} members={[{ id: "a", name: "angeles" }, { id: "b", name: "kevin" }]} initial={serviceDraft} onSubmit={() => {}} onCancel={() => {}} />
    </Frame>
  );
  if (vista.startsWith("onboarding-")) return <Dots step={Number(vista.slice("onboarding-".length)) - 1} />;
  if (vista === "whatsapp-codigo") return <div className="paper min-h-screen p-4"><Logo /><div className="mt-6"><WhatsAppConnect preview={{ stage: "code", code: "K7MQ4R2P", demo: true }} /></div></div>;
  if (vista === "whatsapp-listo") return <div className="paper-dark min-h-screen p-4"><WhatsAppConnect preview={{ stage: "done", demo: false }} /></div>;
  return <main className="p-6">Vista no encontrada.</main>;
}
