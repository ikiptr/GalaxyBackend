/**
 * Safe incremental migration runner.
 * Reads all .sql files from src/migrations/ in filename order,
 * tracks applied migrations in a `_migrations` table, and skips already-applied ones.
 *
 * Run with: npm run db:migrate-up
 */
import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

// Load .env manually
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of envFile.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch { /* .env not found, use existing env */ }

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL");

  // Create migrations tracking table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Find all .sql files in src/migrations/
  const migrationsDir = resolve(process.cwd(), "src", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // alphabetical = numeric order for 001_, 002_, etc.

  const { rows: applied } = await client.query<{ name: string }>(
    "SELECT name FROM _migrations"
  );
  const appliedSet = new Set(applied.map((r) => r.name));

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭  ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`  ▶  Applying ${file}…`);
    await client.query(sql);
    await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
    console.log(`  ✅ ${file} applied`);
    count++;
  }

  console.log(`\nDone — ${count} migration(s) applied.`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
