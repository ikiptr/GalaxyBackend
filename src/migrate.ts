/**
 * One-time migration script — drops and recreates all tables cleanly.
 * Run with: node --experimental-strip-types src/migrate.ts
 */
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually (no dotenv dependency needed)
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

  // Drop all tables and types in correct order (reverse FK dependency)
  const dropSQL = `
    DROP TABLE IF EXISTS absensi CASCADE;
    DROP TABLE IF EXISTS pemesanan_items CASCADE;
    DROP TABLE IF EXISTS pemesanan CASCADE;
    DROP TABLE IF EXISTS penjualan_items CASCADE;
    DROP TABLE IF EXISTS penjualan CASCADE;
    DROP TABLE IF EXISTS barang CASCADE;
    DROP TABLE IF EXISTS suppliers CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TYPE IF EXISTS role CASCADE;
  `;

  await client.query(dropSQL);
  console.log("✅ Dropped all existing tables");

  await client.end();
  console.log("Done — now run: npm run db:push");
}

main().catch((e) => { console.error(e); process.exit(1); });
