import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asService, asUser, createTestDb, seedTwoCompanies, type SeedIds } from "../helpers/db";

let db: PGlite;
let ids: SeedIds;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

describe("database migrations", () => {
  it("applies all migrations and seeds two independent companies", async () => {
    ids = await seedTwoCompanies(db);

    const companies = await db.query<{ count: string }>(
      "select count(*)::text as count from public.companies",
    );
    expect(Number(companies.rows[0]?.count)).toBe(2);

    await asUser(db, ids.ownerA);
    const visible = await db.query<{ id: string }>("select id from public.companies order by id");
    expect(visible.rows.map((row) => row.id)).toEqual([ids.companyA]);

    await asAnon(db);
    await expect(
      db.query("select * from public.companies"),
    ).rejects.toThrow();
  });
});


describe("nullable tenant-scoped relationships", () => {
  it("nulls an optional service reference without nulling the company ID", async () => {
    await asService(db);
    await db.query(
      `insert into public.quotations (id, company_id, customer_id, quotation_number)
       values ($1, $2, $3, $4)`,
      [
        "a3333333-3333-4333-8333-333333333333",
        ids.companyA,
        ids.customerA,
        "QUO-FK-TEST",
      ],
    );
    await db.query(
      `insert into public.quotation_items
         (company_id, quotation_id, service_id, description, quantity)
       values ($1, $2, $3, $4, $5)`,
      [
        ids.companyA,
        "a3333333-3333-4333-8333-333333333333",
        ids.serviceA,
        "Printed cards",
        100,
      ],
    );

    await asService(db);
    await db.query("delete from public.services where id = $1", [ids.serviceA]);

    const result = await db.query<{ service_id: string | null; company_id: string }>(
      `select service_id, company_id
       from public.quotation_items
       where quotation_id = $1`,
      ["a3333333-3333-4333-8333-333333333333"],
    );

    expect(result.rows[0]?.service_id).toBeNull();
    expect(result.rows[0]?.company_id).toBe(ids.companyA);
  });
});
