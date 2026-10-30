import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "node:fs";
import path from "node:path";

/**
 * Harness: PGlite (Postgres en WASM) + esquema `auth` mínimo que imita Supabase
 * (auth.users, auth.uid() leyendo request.jwt.claim.sub, roles anon/authenticated/service_role)
 * y luego aplica TODAS las migraciones de supabase/migrations en orden.
 */
const AUTH_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Vault de Supabase (stub): el worker valida p_secret contra 'cron_secret'.
create schema vault;
create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
insert into vault.decrypted_secrets values ('cron_secret', repeat('s', 64)), ('app_base_url', 'https://pulso.test');
`;

export async function createDb() {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(AUTH_STUB);
  const dir = path.resolve(import.meta.dirname, "../../supabase/migrations");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.includes("_msg_cron")).sort() /* pg_cron/pg_net no existen en PGlite */) {
    try {
      await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch (e) {
      throw new Error(`Migración ${f} falló: ${(e as Error).message}`);
    }
  }
  return db;
}
export type Db = Awaited<ReturnType<typeof createDb>>;

export async function newUser(db: Db, email: string): Promise<string> {
  const r = await db.query<{ id: string }>("insert into auth.users(email) values ($1) returning id", [email]);
  return r.rows[0].id;
}

/** Ejecuta fn como `authenticated` con ese uid (como PostgREST), o como `anon` si uid=null. */
export async function asUser<T>(db: Db, uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function asService<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role service_role;`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
}

export const rows = async <T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

/** Escenario típico: negocio con dueño, admin, recepcionista, 2 barberos con cuenta, servicios y cliente. */
export async function seedScenario(db: Db) {
  const owner = await newUser(db, "owner@x.co");
  const barberA = await newUser(db, "a@x.co");
  const barberB = await newUser(db, "b@x.co");
  const recep = await newUser(db, "r@x.co");
  const admin = await newUser(db, "admin@x.co");
  const stranger = await newUser(db, "s@x.co");

  const bid = await asUser(db, owner, async () => (await rows<{ create_business: string }>(db, "select create_business('Barbería Test','barberia-test','Andrés')"))[0].create_business);
  // El dueño agrega al equipo (como lo haría la UI): insert directo en memberships (policy owner)
  const add = (uid: string | null, name: string, role: string, bookable: boolean, email: string | null = null) =>
    asUser(db, owner, async () => (await rows<{ id: string }>(db, "insert into memberships(business_id,user_id,display_name,role,is_bookable,invited_email) values ($1,$2,$3,$4::member_role,$5,$6) returning id", [bid, uid, name, role, bookable, email]))[0].id);
  const mA = await add(barberA, "Juan Pérez", "barber", true);
  const mB = await add(barberB, "Pedro López", "barber", true);
  const mR = await add(recep, "Rosa", "receptionist", false);
  const mAdmin = await add(admin, "Ana", "admin", false);
  const mOwner = (await rows<{ id: string }>(db, "select id from memberships where business_id=$1 and role='owner'", [bid]))[0].id;

  const svc = async (name: string, dur: number, price: number) =>
    asUser(db, owner, async () => (await rows<{ id: string }>(db, "insert into services(business_id,name,duration_min,price) values ($1,$2,$3,$4) returning id", [bid, name, dur, price]))[0].id);
  const corte = await svc("Corte clásico", 30, 25000);
  const barba = await svc("Barba", 30, 15000);
  const client = await asUser(db, owner, async () => (await rows<{ id: string }>(db, "insert into clients(business_id,full_name,phone,whatsapp_opt_in) values ($1,'Carlos','3001112222',true) returning id", [bid]))[0].id);
  return { bid, owner, barberA, barberB, recep, admin, stranger, mA, mB, mR, mAdmin, mOwner, corte, barba, client };
}
export type Scenario = Awaited<ReturnType<typeof seedScenario>>;
