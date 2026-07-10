import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

const itemSchema = z.object({
  name: z.string().min(1),
  sku:  z.string().default("-"),
  qty:  z.number().int().min(1),
});

const createSchema = z.object({
  invoice:  z.string().min(1),
  customer: z.string().min(1),
  phone:    z.string().default("-"),
  address:  z.string().min(1),
  items:    z.array(itemSchema).min(1),
  date:     z.string().min(1),
});

// GET /api/antaran
app.get("/", async (c) => {
  const rows = await db.select().from(schema.antaran).orderBy(desc(schema.antaran.createdAt));
  return c.json(rows.map((r) => ({
    ...r,
    items: JSON.parse(r.items),
  })));
});

// POST /api/antaran
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = "DLV-" + randomUUID().slice(0, 6).toUpperCase();
  const [row] = await db.insert(schema.antaran).values({
    id,
    invoice:  parsed.data.invoice,
    customer: parsed.data.customer,
    phone:    parsed.data.phone,
    address:  parsed.data.address,
    items:    JSON.stringify(parsed.data.items),
    date:     parsed.data.date,
    status:   "Belum Diantar",
  }).returning();

  return c.json({ ...row, items: JSON.parse(row.items) }, 201);
});

// PATCH /api/antaran/:id/deliver — mark as delivered
app.patch("/:id/deliver", async (c) => {
  const [row] = await db.update(schema.antaran)
    .set({ status: "Diantar" })
    .where(eq(schema.antaran.id, c.req.param("id")))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ...row, items: JSON.parse(row.items) });
});

// DELETE /api/antaran/:id
app.delete("/:id", async (c) => {
  const [row] = await db.delete(schema.antaran).where(eq(schema.antaran.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
