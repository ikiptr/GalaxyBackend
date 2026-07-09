/**
 * Seed script — creates a default superadmin account.
 * Run once after db:migrate:
 *   node --experimental-strip-types src/seed.ts
 */
import { db, schema } from "./db/index.js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

const USERNAME = "superadmin";
const PASSWORD = process.env.SEED_PASSWORD ?? "galaxy2026!";

async function main() {
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, USERNAME));

  if (existing) {
    console.log("⚠️  Superadmin already exists — skipping seed.");
    process.exit(0);
  }

  const hashed = await bcrypt.hash(PASSWORD, 12);
  await db.insert(schema.users).values({
    id: randomUUID(),
    username: USERNAME,
    password: hashed,
    name: "Super Admin",
    role: "superadmin",
    active: true,
    gaji_per_hari: 0,
  });

  console.log(`✅ Superadmin created — username: ${USERNAME}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log("   ⚠️  Change this password immediately via PUT /api/akun/:id");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
