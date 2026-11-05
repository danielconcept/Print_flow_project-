import process from "process";
import { createTestDb, seedTwoCompanies } from "../tests/helpers/db";

async function main() {
  console.log("Creating local PGlite database with all migrations...");
  const db = await createTestDb();
  try {
    const ids = await seedTwoCompanies(db);
    console.log("Seeded two companies:");
    console.log(`  Company A: ${ids.companyA} (owner ${ids.ownerA})`);
    console.log(`  Company B: ${ids.companyB} (owner ${ids.ownerB})`);
    console.log(`  Staff A: ${ids.staffA}`);
    console.log("Done. Use this in tests or extend for local exploration.");
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
