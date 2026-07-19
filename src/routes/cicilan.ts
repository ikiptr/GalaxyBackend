import { Hono } from "hono";
import { db } from "../db/index.js";
import { cicilan, cicilanPayments } from "../db/schema.js";
import { eq, desc, inArray } from "drizzle-orm";
import { jwtAuth } from "../middleware/auth.js";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

// ── GET /api/cicilan ─────────────────────────────────────────
app.get("/", async (c) => {
  const rows = await db.select().from(cicilan).orderBy(desc(cicilan.createdAt));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return c.json([]);

  const payments = await db.select().from(cicilanPayments)
    .where(ids.length === 1
      ? eq(cicilanPayments.cicilanId, ids[0])
      : inArray(cicilanPayments.cicilanId, ids)
    );

  const result = rows.map((row) => ({
    ...row,
    payments: payments.filter((p) => p.cicilanId === row.id),
  }));
  return c.json(result);
});

// ── POST /api/cicilan ────────────────────────────────────────
app.post("/", async (c) => {
  const body = await c.req.json<{
    nama: string; keterangan?: string; jumlah: number;
    tanggalMulai: string; jangkaBulan: number; tanggalBayar: number;
  }>();
  if (!body.nama || !body.jumlah || !body.tanggalMulai || !body.jangkaBulan || !body.tanggalBayar) {
    return c.json({ error: "Field wajib kurang" }, 400);
  }
  const id = randomUUID();
  await db.insert(cicilan).values({
    id,
    nama:         body.nama,
    keterangan:   body.keterangan ?? "",
    jumlah:       body.jumlah,
    tanggalMulai: body.tanggalMulai,
    jangkaBulan:  body.jangkaBulan,
    tanggalBayar: body.tanggalBayar,
  });
  const row = await db.select().from(cicilan).where(eq(cicilan.id, id));
  return c.json({ ...row[0], payments: [] }, 201);
});

// ── PATCH /api/cicilan/:id ───────────────────────────────────
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<{ nama: string; keterangan: string; jumlah: number; tanggalMulai: string; jangkaBulan: number; tanggalBayar: number; status: string }>>();
  await db.update(cicilan).set(body).where(eq(cicilan.id, id));
  const row = await db.select().from(cicilan).where(eq(cicilan.id, id));
  return c.json(row[0]);
});

// ── DELETE /api/cicilan/:id ──────────────────────────────────
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(cicilan).where(eq(cicilan.id, id));
  return c.json({ ok: true });
});

// ── POST /api/cicilan/:id/bayar — mark a month as paid ───────
app.post("/:id/bayar", async (c) => {
  const cicilanId = c.req.param("id");
  const body = await c.req.json<{ bulan: string; tanggalBayar?: string; catatan?: string }>();
  if (!body.bulan) return c.json({ error: "bulan wajib diisi (YYYY-MM)" }, 400);

  // Upsert: update existing payment for this month or insert
  const existing = await db.select().from(cicilanPayments)
    .where(eq(cicilanPayments.cicilanId, cicilanId));
  const forMonth = existing.find((p) => p.bulan === body.bulan);

  const row = await db.select().from(cicilan).where(eq(cicilan.id, cicilanId));
  if (!row[0]) return c.json({ error: "Cicilan tidak ditemukan" }, 404);

  if (forMonth) {
    await db.update(cicilanPayments).set({
      tanggalBayar: body.tanggalBayar ?? new Date().toISOString().slice(0, 10),
      catatan: body.catatan ?? forMonth.catatan,
    }).where(eq(cicilanPayments.id, forMonth.id));
    const updated = await db.select().from(cicilanPayments).where(eq(cicilanPayments.id, forMonth.id));
    return c.json(updated[0]);
  } else {
    const id = randomUUID();
    await db.insert(cicilanPayments).values({
      id, cicilanId,
      bulan: body.bulan,
      tanggalBayar: body.tanggalBayar ?? new Date().toISOString().slice(0, 10),
      jumlah: row[0].jumlah,
      catatan: body.catatan ?? "",
    });
    const inserted = await db.select().from(cicilanPayments).where(eq(cicilanPayments.id, id));
    return c.json(inserted[0], 201);
  }
});

// ── DELETE /api/cicilan/:id/bayar/:bulan — unmark payment ────
app.delete("/:id/bayar/:bulan", async (c) => {
  const cicilanId = c.req.param("id");
  const bulan = c.req.param("bulan");
  const payments = await db.select().from(cicilanPayments)
    .where(eq(cicilanPayments.cicilanId, cicilanId));
  const target = payments.find((p) => p.bulan === bulan);
  if (target) {
    await db.delete(cicilanPayments).where(eq(cicilanPayments.id, target.id));
  }
  return c.json({ ok: true });
});

export default app;
