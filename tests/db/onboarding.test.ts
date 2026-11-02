import { describe, it, expect, beforeAll } from "vitest";
import { createDb, newUser, asUser, rows, type Db } from "./harness";

/** Las mismas escrituras que hace el asistente de bienvenida, con los permisos reales de un dueño nuevo. */
let db: Db; let owner: string; let bid: string;
beforeAll(async () => {
  db = await createDb();
  owner = await newUser(db, "carlos@x.co");
  bid = await asUser(db, owner, async () => (await rows<{ b: string }>(db, "select create_business('Barbería Don Carlos', '', 'Carlos', 'America/Guayaquil', 'USD', true) b"))[0].b);
});

describe("Asistente de bienvenida: escrituras del dueño nuevo", () => {
  it("el enlace sale del nombre y el dueño queda atendiendo", async () => {
    const [b] = await rows<{ slug: string }>(db, "select slug from businesses where id=$1", [bid]);
    expect(b.slug).toBe("barberia-don-carlos");
    const [m] = await rows<{ is_bookable: boolean }>(db, "select is_bookable from memberships where business_id=$1 and role='owner'", [bid]);
    expect(m.is_bookable).toBe(true);
  });

  it("añade barberos con y sin correo, y cada uno recibe horario y enlace de reserva", async () => {
    await asUser(db, owner, async () => {
      await rows(db, "insert into memberships(business_id, display_name, role, is_bookable, invited_email) values ($1,'Luis','barber',true,'luis@x.co'), ($1,'Barbero 3','barber',true,null)", [bid]);
    });
    const team = await rows<{ display_name: string; invited_email: string | null; booking_slug: string | null; hours: string }>(db,
      "select m.display_name, m.invited_email, m.booking_slug, (select count(*)::text from working_hours w where w.member_id = m.id) hours from memberships m where m.business_id=$1 and m.is_bookable order by m.display_name", [bid]);
    expect(team.map((t) => t.display_name)).toEqual(["Barbero 3", "Carlos", "Luis"]);
    expect(team.every((t) => t.booking_slug && t.hours === "6")).toBe(true);
  });

  it("guarda el horario del negocio y lo copia al de cada barbero", async () => {
    await asUser(db, owner, async () => {
      for (let w = 0; w < 7; w++) await rows(db, "insert into business_hours(business_id, weekday, is_open, start_time, end_time) values ($1,$2,$3,'10:00','20:00') on conflict (business_id, weekday) do update set is_open=excluded.is_open, start_time=excluded.start_time, end_time=excluded.end_time", [bid, w, w >= 1 && w <= 5]);
      await rows(db, "delete from working_hours where member_id in (select id from memberships where business_id=$1 and is_bookable)", [bid]);
      await rows(db, "insert into working_hours(business_id, member_id, weekday, start_time, end_time) select $1, m.id, d, '10:00', '20:00' from memberships m, generate_series(1,5) d where m.business_id=$1 and m.is_bookable", [bid]);
    });
    const [bh] = await rows<{ open: string }>(db, "select count(*) filter (where is_open)::text open from business_hours where business_id=$1", [bid]);
    expect(bh.open).toBe("5");
    const [wh] = await rows<{ n: string }>(db, "select count(*)::text n from working_hours where business_id=$1", [bid]);
    expect(wh.n).toBe("15");
  });

  it("guarda contacto, enlace y logo, y rechaza un enlace repetido", async () => {
    await asUser(db, owner, () => rows(db, "update businesses set phone='+593991234567', address='Av. Principal 123', slug='don-carlos', logo_url='https://x.supabase.co/storage/v1/object/public/covers/l.png' where id=$1", [bid]));
    const [b] = await rows<{ slug: string; logo_url: string }>(db, "select slug, logo_url from businesses where id=$1", [bid]);
    expect(b).toEqual({ slug: "don-carlos", logo_url: "https://x.supabase.co/storage/v1/object/public/covers/l.png" });
    const other = await newUser(db, "ana@x.co");
    const bid2 = await asUser(db, other, async () => (await rows<{ b: string }>(db, "select create_business('Otra', 'otra', 'Ana') b"))[0].b);
    await expect(asUser(db, other, () => rows(db, "update businesses set slug='don-carlos' where id=$1", [bid2]))).rejects.toThrow();
  });

  it("el barbero invitado entra con su correo y queda vinculado a su puesto", async () => {
    const luis = await newUser(db, "luis@x.co");
    const n = await asUser(db, luis, async () => (await rows<{ n: number }>(db, "select claim_my_invitations() n"))[0].n);
    expect(n).toBe(1);
    const [m] = await rows<{ role: string; display_name: string }>(db, "select role, display_name from memberships where business_id=$1 and user_id=$2", [bid, luis]);
    expect(m).toEqual({ role: "barber", display_name: "Luis" });
  });
});
