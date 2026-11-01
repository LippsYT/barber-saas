import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, scoped, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario; let other: { bid: string; owner: string; mOwner: string }; let day: string; let dow: number;
const RAW = "s".repeat(64);
const anon = <T,>(fn: () => Promise<T>) => asUser(db, null, fn);

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  // Un segundo negocio, de otra persona, para probar el aislamiento entre negocios.
  const ownerB = (await rows<{ id: string }>(db, "insert into auth.users(email) values ('b-owner@x.co') returning id"))[0].id;
  const bidB = await asUser(db, ownerB, async () => (await rows<{ create_business: string }>(db, "select create_business('Otra Barbería','otra-barberia','Beto')"))[0].create_business);
  const mB = (await rows<{ id: string }>(db, "select id from memberships where business_id=$1 and role='owner'", [bidB]))[0].id;
  other = { bid: bidB, owner: ownerB, mOwner: mB };
  const tz = (await rows<{ timezone: string }>(db, "select timezone from businesses where id=$1", [s.bid]))[0].timezone;
  const d = (await rows<{ d: string; w: number }>(db, "select ((now() at time zone $1)::date + 3)::text d, extract(dow from (now() at time zone $1)::date + 3)::int w", [tz]))[0];
  day = d.d; dow = d.w;
  await rows(db, "insert into working_hours(business_id, member_id, weekday, start_time, end_time) values ($1,$2,$3,'08:00','20:00')", [s.bid, s.mA, dow]);
});

describe("C1 · WhatsApp ya no se puede suplantar", () => {
  it("el dueño no escribe whatsapp_links directo; el nombre de instancia sale del slug", async () => {
    await expect(asUser(db, other.owner, () => rows(db, "insert into whatsapp_links(business_id, instance_name, status, provider, demo) values ($1,'pulso-barberia-test','connected','evolution',false)", [other.bid]))).rejects.toThrow(/permission denied/);
    await asUser(db, other.owner, () => rows(db, "select wa_link_start('593999111222', 'ABCD1234', 'evolution', false)"));
    const [l] = await rows<{ instance_name: string; status: string }>(db, "select instance_name, status from whatsapp_links where business_id=$1", [other.bid]);
    expect(l).toEqual({ instance_name: "pulso-otra-barberia", status: "pairing" });
    await expect(anon(() => rows(db, "select wa_link_status($1, $2, 'connected')", ["x".repeat(64), other.bid]))).rejects.toThrow(/forbidden/);
    await anon(() => rows(db, "select wa_link_status($1, $2, 'connected')", [scoped("wa"), other.bid])); // solo con el token del servidor
    expect((await rows<{ status: string }>(db, "select status from whatsapp_links where business_id=$1", [other.bid]))[0].status).toBe("connected");
    await expect(asUser(db, s.barberA, () => rows(db, "select wa_link_start('593999111222','X','evolution',false)"))).rejects.toThrow(/forbidden/);
  });
});

describe("H1 · un negocio no toca la agenda de otro", () => {
  it("ausencias, horarios y citas con un barbero ajeno se rechazan", async () => {
    await expect(asUser(db, other.owner, () => rows(db, "insert into time_off(business_id, member_id, starts_at, ends_at) values ($1,$2, now(), now() + interval '30 days')", [other.bid, s.mA]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, other.owner, () => rows(db, "insert into working_hours(business_id, member_id, weekday, start_time, end_time) values ($1,$2,1,'00:00','23:00')", [other.bid, s.mA]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, other.owner, () => rows(db, "insert into appointments(business_id, member_id, starts_at, ends_at) values ($1,$2, now() + interval '3 days', now() + interval '3 days 30 minutes')", [other.bid, s.mA]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, other.owner, () => rows(db, "insert into appointments(business_id, member_id, client_id, starts_at, ends_at) values ($1,$2,$3, now() + interval '5 days', now() + interval '5 days 30 minutes')", [other.bid, other.mOwner, s.client]))).rejects.toThrow(/forbidden/);
  });
  it("lo propio sigue funcionando", async () => {
    await asUser(db, s.owner, () => rows(db, "insert into time_off(business_id, member_id, starts_at, ends_at) values ($1,$2, now() + interval '20 days', now() + interval '20 days 1 hour')", [s.bid, s.mA]));
  });
});

describe("H2 · la reserva pública limpia el nombre", () => {
  it("no deja pasar links dentro del nombre que se manda por WhatsApp", async () => {
    const at = (await rows<{ t: string }>(db, "select (($1::date + time '10:00') at time zone (select timezone from businesses where id=$2))::text t", [day, s.bid]))[0].t;
    const r = await anon(() => rows<{ r: { appointment_id: string } }>(db, "select public_create_booking('barberia-test', $1, $2::uuid[], $3::timestamptz, 'http://evil.example/x', '+573001230000', true) r", [s.mA, `{${s.corte}}`, at]));
    expect(r[0].r.appointment_id).toBeTruthy();
    const [c] = await rows<{ full_name: string }>(db, "select full_name from clients where business_id=$1 and phone like '%3001230000'", [s.bid]);
    expect(c.full_name).not.toMatch(/[/:.]/);
    await expect(anon(() => rows(db, "select public_create_booking('barberia-test', $1, $2::uuid[], $3::timestamptz, '1234 /', '+573001230001', true)", [s.mA, `{${s.corte}}`, at]))).rejects.toThrow(/invalid_name/);
  });
});

describe("H3 · el secreto crudo ya no abre las RPC del worker", () => {
  it("solo sirve el token derivado de su dominio", async () => {
    for (const q of ["select billing_link_customer($1, $2, 'cus_z')", "select push_vapid($1)", "select report_targets($1)", "select msg_claim($1)"]) {
      const args = q.includes("$2") ? [RAW, s.bid] : [RAW];
      await expect(anon(() => rows(db, q, args))).rejects.toThrow(/forbidden/);
    }
    await expect(anon(() => rows(db, "select push_vapid($1)", [scoped("billing")]))).rejects.toThrow(/forbidden/); // el de otro dominio tampoco
    await expect(anon(() => rows(db, "select push_vapid($1)", [scoped("push")]))).resolves.toBeTruthy();
  });
});

describe("M1 · sin pago no se opera, ni por la API", () => {
  it("con la prueba vencida y sin suscripción, las funciones de caja responden payment_required", async () => {
    await rows(db, "update businesses set trial_ends_at = now() - interval '1 day' where id=$1", [other.bid]);
    await expect(asUser(db, other.owner, () => rows(db, "select open_cash_session($1, 0)", [other.bid]))).rejects.toThrow(/payment_required/);
    await rows(db, "update businesses set billing_exempt = true where id=$1", [other.bid]);
    await asUser(db, other.owner, () => rows(db, "select open_cash_session($1, 0)", [other.bid]));
  });
  it("mandar un mensaje manual pide el complemento de WhatsApp", async () => {
    await rows(db, "update businesses set trial_ends_at = now() - interval '1 day' where id=$1", [s.bid]);
    await anon(() => rows(db, "select billing_link_customer($1, $2, 'cus_s')", [scoped("billing"), s.bid]));
    await anon(() => rows(db, "select billing_sync($1, 'cus_s', 'sub_s', 'active', now() + interval '30 days', null, false, '{}')", [scoped("billing")]));
    await expect(asUser(db, s.owner, () => rows(db, "select schedule_message($1, $2, 'hola', now())", [s.bid, s.client]))).rejects.toThrow(/addon_required/);
  });
  it("un pago fallido hace más de 10 días ya no cuenta como activo", async () => {
    await anon(() => rows(db, "select billing_sync($1, 'cus_s', 'sub_s', 'past_due', now() - interval '20 days', null, false, null)", [scoped("billing")]));
    expect((await rows<{ a: boolean }>(db, "select _biz_active($1) a", [s.bid]))[0].a).toBe(false);
    await anon(() => rows(db, "select billing_sync($1, 'cus_s', 'sub_s', 'past_due', now() - interval '2 days', null, false, null)", [scoped("billing")]));
    expect((await rows<{ a: boolean }>(db, "select _biz_active($1) a", [s.bid]))[0].a).toBe(true);
  });
});

describe("M2 / M3 / M7", () => {
  it("un usuario no crea negocios sin límite", async () => {
    const u = (await rows<{ id: string }>(db, "insert into auth.users(email) values ('serial@x.co') returning id"))[0].id;
    for (const n of [1, 2, 3]) await asUser(db, u, () => rows(db, "select create_business($1, $2, 'Serial')", [`Local ${n}`, `serial-${n}`]));
    await expect(asUser(db, u, () => rows(db, "select create_business('Local 4','serial-4','Serial')"))).rejects.toThrow(/too_many_businesses/);
  });
  it("sin correo confirmado no se crea un negocio ni se reclaman invitaciones", async () => {
    const u = (await rows<{ id: string }>(db, "insert into auth.users(email, email_confirmed_at) values ('nuevo@x.co', null) returning id"))[0].id;
    await expect(asUser(db, u, () => rows(db, "select create_business('X','x-x','Y')"))).rejects.toThrow(/email_not_confirmed/);
    await rows(db, "insert into memberships(business_id, display_name, role, invited_email) values ($1,'Invitado','barber','nuevo@x.co')", [s.bid]);
    const n = (await asUser(db, u, () => rows<{ n: number }>(db, "select claim_my_invitations() n")))[0].n;
    expect(n).toBe(0);
  });
  it("las notificaciones solo van a servicios de push conocidos", async () => {
    await expect(asUser(db, s.owner, () => rows(db, "select push_save('https://intranet.example.test/hook/aaaaaaaaaaaaaaaa', 'k', 'a')"))).rejects.toThrow(/invalid_subscription/);
    await asUser(db, s.owner, () => rows(db, "select push_save('https://web.push.apple.com/Qabcdefghijklmnopqrstuv', 'k', 'a')"));
  });
});

describe("M5 · fraude interno", () => {
  it("un barbero no edita clientes ni inventa precios, y su descuento tiene tope", async () => {
    await rows(db, "update businesses set billing_exempt = true where id=$1", [s.bid]);
    expect(await asUser(db, s.barberA, () => rows(db, "update clients set phone = '999999999' where id=$1 returning id", [s.client]))).toEqual([]); // la política no le deja ninguna fila
    const [a] = await rows<{ id: string }>(db, "insert into appointments(business_id, client_id, member_id, starts_at, ends_at, status) values ($1,$2,$3, now() + interval '10 days', now() + interval '10 days 30 minutes','confirmed') returning id", [s.bid, s.client, s.mA]);
    await expect(asUser(db, s.barberA, () => rows(db, "insert into appointment_items(business_id, appointment_id, service_id, name, price, duration_min) values ($1,$2,$3,'Corte',100,30)", [s.bid, a.id, s.corte]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, s.barberA, () => rows(db, "update appointments set status='completed' where id=$1", [a.id]))).rejects.toThrow(/forbidden/);
    await rows(db, "insert into appointment_items(business_id, appointment_id, service_id, name, price, duration_min) values ($1,$2,$3,'Corte clásico',25000,30)", [s.bid, a.id, s.corte]);
    await expect(asUser(db, s.barberA, () => rows(db, "select attend_appointment($1, 'cash', -20000, 0)", [a.id]))).rejects.toThrow(/discount_too_large/);
    await asUser(db, s.barberA, () => rows(db, "select attend_appointment($1, 'cash', -2000, 0)", [a.id])); // un 8 % sí
  });
});

describe("último dueño y enlaces", () => {
  it("no se puede quedar un negocio sin dueño", async () => {
    await expect(asUser(db, other.owner, () => rows(db, "update memberships set active = false where id=$1", [other.mOwner]))).rejects.toThrow(/last_owner/);
  });
  it("los enlaces no admiten //dominio (redirección abierta)", async () => {
    await expect(asUser(db, s.owner, () => rows(db, "insert into link_blocks(business_id, kind, label, url) values ($1,'link','x','//evil.example')", [s.bid]))).rejects.toThrow();
    await asUser(db, s.owner, () => rows(db, "insert into link_blocks(business_id, kind, label, url) values ($1,'link','ok','/reservar')", [s.bid]));
  });
});
