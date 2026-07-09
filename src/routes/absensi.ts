import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

const toggleSchema = z.object({
  userId:  z.string(),
  tanggal: z.string(), // YYYY-MM-DD
  hadir:   z.boolean().optional(),
});

// GET /api/absensi  — returns all records (filter by userId query param optional)
app.get("/", async (c) => {
  const userId = c.req.query("userId");
  const rows = userId
    ? await db.select().from(schema.absensi).where(eq(schema.absensi.userId, userId))
    : await db.select().from(schema.absensi);
  return c.json(rows);
});

// POST /api/absensi/toggle  — create/update/delete attendance record
app.post("/toggle", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { userId, tanggal, hadir } = parsed.data;

  const [existing] = await db.select().from(schema.absensi)
    .where(and(eq(schema.absensi.userId, userId), eq(schema.absensi.tanggal, tanggal)));

  if (!existing) {
    // No record → create as hadir
    const [row] = await db.insert(schema.absensi)
      .values({ id: randomUUID(), userId, tanggal, hadir: true }).returning();
    return c.json(row, 201);
  } else if (existing.hadir) {
    // hadir → set absen
    const [row] = await db.update(schema.absensi).set({ hadir: false })
      .where(eq(schema.absensi.id, existing.id)).returning();
    return c.json(row);
  } else {
    // absen → delete (back to empty)
    await db.delete(schema.absensi).where(eq(schema.absensi.id, existing.id));
    return c.json({ deleted: true });
  }
});

// POST /api/absensi/reset-paid  — reset all hadir records after salary payment
app.post("/reset-paid", async (c) => {
  const { userId } = z.object({ userId: z.string() }).parse(await c.req.json());
  await db.delete(schema.absensi)
    .where(and(eq(schema.absensi.userId, userId), eq(schema.absensi.hadir, true)));
  return c.json({ ok: true });
});

export default app;
