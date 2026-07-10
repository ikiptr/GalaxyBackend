import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

const createSchema = z.object({
  supplierId:     z.string().optional(),
  supplierName:   z.string().min(1),
  nomorTagihan:   z.string().min(1),
  keterangan:     z.string().default(""),
  total:          z.number().int().min(0),
  sudahDibayar:   z.number().int().min(0).default(0),
  jatuhTempo:     z.string().min(1),
  tanggalTagihan: z.string().min(1),
});

const updateSchema = createSchema.partial();

const paySchema = z.object({
  tambahBayar: z.number().int().min(0),
  buktiBayar:  z.array(z.string()).optional(),
});

function computeStatus(total: number, paid: number): string {
  if (paid <= 0) return "Belum Bayar";
  if (paid >= total) return "Lunas";
  return "Bayar Sebagian";
}

// GET /api/tagihan
app.get("/", async (c) => {
  const rows = await db.select().from(schema.tagihan).orderBy(desc(schema.tagihan.createdAt));
  return c.json(rows.map((r) => ({
    ...r,
    buktiBayar: JSON.parse(r.buktiBayar || "[]"),
  })));
});

// POST /api/tagihan
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const d = parsed.data;
  const status = computeStatus(d.total, d.sudahDibayar);
  const id = "TGH-" + randomUUID().slice(0, 6).toUpperCase();
  const [row] = await db.insert(schema.tagihan).values({
    id,
    supplierId:     d.supplierId ?? null,
    supplierName:   d.supplierName,
    nomorTagihan:   d.nomorTagihan,
    keterangan:     d.keterangan,
    total:          d.total,
    sudahDibayar:   d.sudahDibayar,
    jatuhTempo:     d.jatuhTempo,
    tanggalTagihan: d.tanggalTagihan,
    status,
    buktiBayar:     "[]",
  }).returning();
  return c.json({ ...row, buktiBayar: [] }, 201);
});

// PATCH /api/tagihan/:id — update fields
app.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const [existing] = await db.select().from(schema.tagihan).where(eq(schema.tagihan.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Not found" }, 404);

  const total = parsed.data.total ?? existing.total;
  const paid  = parsed.data.sudahDibayar ?? existing.sudahDibayar;
  const status = computeStatus(total, paid);

  const [row] = await db.update(schema.tagihan)
    .set({ ...parsed.data, status })
    .where(eq(schema.tagihan.id, c.req.param("id")))
    .returning();
  return c.json({ ...row, buktiBayar: JSON.parse(row.buktiBayar || "[]") });
});

// POST /api/tagihan/:id/pay — add payment
app.post("/:id/pay", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const [existing] = await db.select().from(schema.tagihan).where(eq(schema.tagihan.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Not found" }, 404);

  const newPaid = parsed.data.tambahBayar > 0
    ? Math.min(existing.total, existing.sudahDibayar + parsed.data.tambahBayar)
    : existing.sudahDibayar;
  const status = computeStatus(existing.total, newPaid);

  // Merge existing bukti with new ones (append)
  const existingBukti: string[] = JSON.parse(existing.buktiBayar || "[]");
  const newBukti = [...existingBukti, ...(parsed.data.buktiBayar ?? [])];

  const [row] = await db.update(schema.tagihan)
    .set({ sudahDibayar: newPaid, status, buktiBayar: JSON.stringify(newBukti) })
    .where(eq(schema.tagihan.id, c.req.param("id")))
    .returning();
  return c.json({ ...row, buktiBayar: JSON.parse(row.buktiBayar || "[]") });
});

// DELETE /api/tagihan/:id (boss+)
app.delete("/:id", requireRole("boss", "superadmin"), async (c) => {
  const [row] = await db.delete(schema.tagihan).where(eq(schema.tagihan.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
