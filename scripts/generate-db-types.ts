import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTestDb } from "../tests/helpers/db";

interface ColumnRow {
  table_name: string;
  table_kind: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  has_default: boolean;
}

function toTsType(dataType: string): string {
  if (dataType.endsWith("[]")) {
    const item = toTsType(dataType.slice(0, -2));
    return `${item}[]`;
  }
  switch (dataType) {
    case "uuid":
    case "text":
    case "character varying":
    case "character":
    case "date":
    case "timestamp with time zone":
    case "timestamp without time zone":
    case "time without time zone":
    case "time with time zone":
    case "inet":
      return "string";
    case "boolean":
      return "boolean";
    case "smallint":
    case "integer":
    case "bigint":
    case "numeric":
    case "double precision":
    case "real":
      return "number";
    case "json":
    case "jsonb":
      return "Json";
    case "bytea":
      return "string";
    default:
      return "unknown";
  }
}

function pascal(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function renderRow(columns: ColumnRow[]): string {
  const lines = columns.map((column) => {
    const type = toTsType(column.data_type);
    return `        ${column.column_name}: ${type}${column.is_nullable ? " | null" : ""};`;
  });
  return `      Row: {\n${lines.join("\n")}\n      };`;
}

function renderMutation(name: "Insert" | "Update", columns: ColumnRow[]): string {
  const lines = columns.map((column) => {
    const optional = name === "Update" || column.is_nullable || column.has_default;
    const type = toTsType(column.data_type);
    return `        ${column.column_name}${optional ? "?" : ""}: ${type}${column.is_nullable ? " | null" : ""};`;
  });
  return `      ${name}: {\n${lines.join("\n")}\n      };`;
}

async function main() {
  const db = await createTestDb();
  try {
    const result = await db.query<ColumnRow>(`
      select
        c.relname as table_name,
        c.relkind::text as table_kind,
        a.attname as column_name,
        format_type(a.atttypid, a.atttypmod) as data_type,
        not a.attnotnull as is_nullable,
        (ad.adbin is not null) as has_default
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
      left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
      where n.nspname = 'public'
        and c.relkind in ('r', 'v')
        and a.attnum > 0
        and not a.attisdropped
      order by c.relname, a.attnum
    `);

    const grouped = new Map<string, ColumnRow[]>();
    const kinds = new Map<string, string>();
    for (const row of result.rows) {
      const existing = grouped.get(row.table_name) ?? [];
      existing.push(row);
      grouped.set(row.table_name, existing);
      kinds.set(row.table_name, row.table_kind);
    }

    const tables: string[] = [];
    const views: string[] = [];
    for (const [tableName, columns] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (kinds.get(tableName) === "v") {
        views.push(
          `    ${tableName}: {\n${renderRow(columns)}\n      Relationships: [];\n    };`,
        );
      } else {
        tables.push(
          `    ${tableName}: {\n${renderRow(columns)}\n${renderMutation(
            "Insert",
            columns,
          )}\n${renderMutation("Update", columns)}\n      Relationships: [];\n    };`,
        );
      }
    }

    const source = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
${tables.join("\n")}
    };
    Views: {
${views.join("\n")}
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
`;

    const outputPath = path.join(process.cwd(), "src", "lib", "supabase", "types.ts");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, source, "utf8");
    console.log(`Generated ${outputPath} with ${grouped.size} relations.`);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
