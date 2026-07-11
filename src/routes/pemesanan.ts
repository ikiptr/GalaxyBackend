import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth, requireRole } from "../middleware/auth.js";
import { broadcast } from "./events.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

const itemSchema = z.object({
  name:  z.string().min(1),
  qty:   z.number().int().min(1),
  price: z.number().min(0),
});

const createSchema = z.object({
  customer:  z.string().min(1),
  phone:     z.string().optional(),
  note:      z.string().optional(),
  items:     z.array(itemSchema).min(1),
  total:     z.string(),
  dpPaid:    z.string(),
  remaining: z.string(),
  status:    z.enum(["Lunas", "DP", "Menunggu"]),
  date:      z.string(),
});

const paySchema = z.object({
  dpPaid:    z.string(),
  remaining: z.string(),
  status:    z.enum(["Lunas", "DP", "Menunggu"]),
});

// GET /api/pemesanan
app.get("/", async (c) => {
  const rows = await db.select().from(schema.pemesanan).orderBy(desc(schema.pemesanan.date));
  const items = await db.select().from(schema.pemesananItems);
  return c.json(rows.map((r) => ({
    ...r,
    products: items.filter((i) => i.pemesananId === r.id).map((i) => ({
      name: i.barangName, qty: i.qty, price: i.price,
    })),
  })));
});

// POST /api/pemesanan
app.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = "ORD-" + randomUUID().slice(0, 6).toUpperCase();
  const qty = parsed.data.items.reduce((s, i) => s + i.qty, 0);
  await db.insert(schema.pemesanan).values({
    id, userId: user.id,
    customer: parsed.data.customer, phone: parsed.data.phone ?? null,
    note: parsed.data.note ?? null, qty,
    total: parsed.data.total, dpPaid: parsed.data.dpPaid,
    remaining: parsed.data.remaining, status: parsed.data.status,
    date: parsed.data.date,
  });
  for (const item of parsed.data.items) {
    await db.insert(schema.pemesananItems).values({
      id: randomUUID(), pemesananId: id,
      barangName: item.name, qty: item.qty, price: item.price,
    });
  }
  broadcast("pemesanan");
  return c.json({ id }, 201);
});

// PATCH /api/pemesanan/:id/payment
app.patch("/:id/payment", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const [row] = await db.update(schema.pemesanan)
    .set({ dpPaid: parsed.data.dpPaid, remaining: parsed.data.remaining, status: parsed.data.status })
    .where(eq(schema.pemesanan.id, c.req.param("id")))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// DELETE /api/pemesanan/:id  (boss+)
app.delete("/:id", requireRole("boss", "superadmin"), async (c) => {
  const [row] = await db.delete(schema.pemesanan).where(eq(schema.pemesanan.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
