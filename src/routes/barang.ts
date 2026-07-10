import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

const barangSchema = z.object({
  sku:      z.string().min(1),
  name:     z.string().min(1),
  category: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  price:    z.number().min(0),
  cost:     z.number().min(0),
  stock:    z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
});

// GET /api/barang
app.get("/", async (c) => {
  const rows = await db.select().from(schema.barang);
  return c.json(rows);
});

// GET /api/barang/:id
app.get("/:id", async (c) => {
  const [row] = await db.select().from(schema.barang).where(eq(schema.barang.id, c.req.param("id")));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// POST /api/barang  (karyawan+)
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = barangSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  // Ensure SKU is unique
  const [existing] = await db.select().from(schema.barang).where(eq(schema.barang.sku, parsed.data.sku));
  if (existing) return c.json({ error: "SKU sudah digunakan" }, 409);

  const id = randomUUID();
  const [row] = await db.insert(schema.barang).values({ id, ...parsed.data }).returning();
  return c.json(row, 201);
});

// PUT /api/barang/:id  (karyawan+)
app.put("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = barangSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const [row] = await db.update(schema.barang).set(parsed.data).where(eq(schema.barang.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// DELETE /api/barang/:id  (superadmin only)
app.delete("/:id", requireRole("superadmin"), async (c) => {
  const [row] = await db.delete(schema.barang).where(eq(schema.barang.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
