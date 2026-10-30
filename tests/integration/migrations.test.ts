import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, seedTwoCompanies } from "../helpers/db";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

describe("database migrations", () => {
  it("applies all migrations and seeds two independent companies", async () => {
    const ids = await seedTwoCompanies(db);

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
