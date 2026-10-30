import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const AUTH_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  grant usage on schema auth to authenticated;

  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null,
    name text not null,
    owner uuid,
    metadata jsonb,
    created_at timestamptz not null default now()
  );
  create or replace function storage.foldername(p_name text)
  returns text[]
  language sql
  immutable
  as $$ select string_to_array(p_name, '/') $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to authenticated;
`;

const ROLES_STUB = `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin bypassrls;
    end if;
  end;
  $$;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(ROLES_STUB);
  await db.exec(AUTH_STUB);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }

  return db;
}

export async function asUser(db: PGlite, userId: string) {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: userId, role: "authenticated" })],
  );
  await db.exec("set role authenticated;");
}

export async function asAnon(db: PGlite) {
  await db.exec("reset role;");
  await db.exec("select set_config('request.jwt.claim.sub', '', false);");
  await db.exec("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', false);");
  await db.exec("set role anon;");
}

export async function asService(db: PGlite) {
  await db.exec("reset role;");
  await db.exec("select set_config('request.jwt.claim.sub', '', false);");
  await db.exec("select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false);");
}

export interface SeedIds {
  companyA: string;
  companyB: string;
  ownerA: string;
  ownerB: string;
  staffA: string;
  customerA: string;
  customerB: string;
  serviceA: string;
  materialA: string;
  supplierA: string;
  invoiceA: string;
}

export async function seedTwoCompanies(db: PGlite): Promise<SeedIds> {
  const ids: SeedIds = {
    companyA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    companyB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ownerA: "11111111-1111-4111-8111-111111111111",
    ownerB: "22222222-2222-4222-8222-222222222222",
    staffA: "33333333-3333-4333-8333-333333333333",
    customerA: "c1111111-1111-4111-8111-111111111111",
    customerB: "c2222222-2222-4222-8222-222222222222",
    serviceA: "d1111111-1111-4111-8111-111111111111",
    materialA: "e1111111-1111-4111-8111-111111111111",
    supplierA: "f1111111-1111-4111-8111-111111111111",
    invoiceA: "a1111111-1111-4111-8111-111111111111",
  };

  await db.exec(`
    insert into auth.users (id, email) values
      ('${ids.ownerA}', 'owner-a@example.test'),
      ('${ids.ownerB}', 'owner-b@example.test'),
      ('${ids.staffA}', 'staff-a@example.test');

    insert into public.profiles (id, full_name) values
      ('${ids.ownerA}', 'Owner A'),
      ('${ids.ownerB}', 'Owner B'),
      ('${ids.staffA}', 'Staff A');

    insert into public.companies (id, name, slug) values
      ('${ids.companyA}', 'Alpha Print', 'alpha-print'),
      ('${ids.companyB}', 'Beta Print', 'beta-print');

    insert into public.company_memberships (company_id, user_id, role) values
      ('${ids.companyA}', '${ids.ownerA}', 'owner'),
      ('${ids.companyB}', '${ids.ownerB}', 'owner'),
      ('${ids.companyA}', '${ids.staffA}', 'staff');

    insert into public.customers (id, company_id, customer_code, name, phone) values
      ('${ids.customerA}', '${ids.companyA}', 'CUS-TEST-A', 'Acme Ltd', '08030000001'),
      ('${ids.customerB}', '${ids.companyB}', 'CUS-TEST-B', 'Beta Client', '08030000002');

    insert into public.services (id, company_id, name, category, default_unit, default_unit_price_minor) values
      ('${ids.serviceA}', '${ids.companyA}', 'Business Cards', 'cards', 'piece', 25000);

    insert into public.materials (id, company_id, material_code, name, category, unit, quantity_on_hand, reorder_level, average_unit_cost_minor) values
      ('${ids.materialA}', '${ids.companyA}', 'MAT-TEST-A', 'A4 Card Stock', 'paper', 'sheet', 100, 20, 5000);

    insert into public.suppliers (id, company_id, supplier_code, name) values
      ('${ids.supplierA}', '${ids.companyA}', 'SUP-TEST-A', 'Paper Supplier');
  `);

  return ids;
}

export async function countRows(db: PGlite, table: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    `select count(*)::text as count from public.${table}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}
