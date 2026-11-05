import { readdir, readFile } from "fs/promises";
import path from "path";
import process from "process";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const REQUIRED = [
  "0001_schema.sql",
  "0002_functions.sql",
  "0003_rpc.sql",
  "0004_rls.sql",
  "0005_views.sql",
];

async function main() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  for (const required of REQUIRED) {
    if (!files.includes(required)) {
      throw new Error(`Missing required migration: ${required}`);
    }
  }

  for (const file of files) {
    const content = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    if (!content.trim()) {
      throw new Error(`Migration ${file} is empty.`);
    }
    if (content.includes("DROP SCHEMA public CASCADE")) {
      throw new Error(`Migration ${file} contains destructive public schema drop.`);
    }
  }

  console.log(`Validated ${files.length} migrations: ${files.join(", ")}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
