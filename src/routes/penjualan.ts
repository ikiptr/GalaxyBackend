import { Hono } from "hono";
import { eq, desc, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth } from "../middleware/auth.js";
import { broadcast } from "./events.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

const itemSchema = z.object({
  name:     z.string().min(1),
  sku:      z.string().optional(),  // stored at sale time so detail/receipt shows correct SKU
  qty:      z.number().min(0.01),
  price:    z.number().min(0),
  barangId: z.string().optional(),   // when set, stock is decremented by id (unique) instead of name
});

const createSchema = z.object({
  items: z.array(itemSchema).min(1),
  total: z.string(),
  date:  z.string(),
});

// GET /api/penjualan
app.get("/", async (c) => {
  const rows = await db.select().from(schema.penjualan).orderBy(desc(schema.penjualan.date));
  const items = await db.select().from(schema.penjualanItems);
    return c.json(rows.map((r) => ({
    ...r,
    products: items.filter((i) => i.penjualanId === r.id).map((i) => ({
      name: i.barangName, sku: i.barangSku ?? null, qty: i.qty, price: i.price,
    })),
    qty: items.filter((i) => i.penjualanId === r.id).reduce((s, i) => s + i.qty, 0),
  })));
});

// POST /api/penjualan
app.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = "INV-" + randomUUID().slice(0, 6).toUpperCase();
  await db.insert(schema.penjualan).values({
    id, userId: user.id, total: parsed.data.total,
    status: "Selesai", date: parsed.data.date,
  });
  for (const item of parsed.data.items) {
    await db.insert(schema.penjualanItems).values({
      id: randomUUID(), penjualanId: id,
      barangName: item.name,
      barangSku:  item.sku ?? null,
      barangId:   item.barangId ?? null,
      qty: item.qty, price: item.price,
    });
    // Deduct stock — match by id when available so duplicate names/SKUs across suppliers
    // don't both get decremented. Fall back to name for legacy/manual items.
    if (item.barangId) {
      await db.update(schema.barang)
        .set({ stock: sql`GREATEST(0, ${schema.barang.stock} - ${Math.ceil(item.qty)})` })
        .where(eq(schema.barang.id, item.barangId));
    } else {
      await db.update(schema.barang)
        .set({ stock: sql`GREATEST(0, ${schema.barang.stock} - ${Math.ceil(item.qty)})` })
        .where(eq(schema.barang.name, item.name));
    }
  }
  broadcast("penjualan");
  broadcast("barang"); // notify stock-opname / inventaris listeners
  return c.json({ id }, 201);
});

// DELETE /api/penjualan/:id  (all authenticated users)
app.delete("/:id", async (c) => {
  const [row] = await db.delete(schema.penjualan).where(eq(schema.penjualan.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  broadcast("penjualan");
  return c.json({ ok: true });
});

export default app;
