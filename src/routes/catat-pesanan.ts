import { Hono } from "hono";
import { db } from "../db/index.js";
import { catatPesanan, catatPesananItems } from "../db/schema.js";
import { eq, desc, inArray } from "drizzle-orm";
import { jwtAuth } from "../middleware/auth.js";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

// ── Helper: build full response for a pesanan row ──────────────
async function buildPesanan(row: typeof catatPesanan.$inferSelect) {
  const items = await db
    .select()
    .from(catatPesananItems)
    .where(eq(catatPesananItems.pesananId, row.id));

  return {
    id:        row.id,
    supplier:  row.supplier,
    createdBy: row.createdBy,
    date:      row.date,
    createdAt: row.createdAt,
    items:     items.map((i) => ({
      id:       i.id,
      barangId: i.barangId,
      name:     i.barangName,
      sku:      i.barangSku,
      qty:      i.qty,
    })),
  };
}

// ── GET /api/catat-pesanan/draft/:supplier — get saved draft ───
// Must be BEFORE /:id to avoid param clash
app.get("/draft/:supplier", async (c) => {
  const supplier = decodeURIComponent(c.req.param("supplier"));
  const rows = await db
    .select()
    .from(catatPesanan)
    .where(eq(catatPesanan.supplier, supplier))
    .orderBy(desc(catatPesanan.createdAt))
    .limit(1);

  if (rows.length === 0) return c.json(null);
  return c.json(await buildPesanan(rows[0]));
});

// ── PUT /api/catat-pesanan/draft/:supplier — upsert draft ──────
// Replaces existing draft for supplier (delete old + insert new)
app.put("/draft/:supplier", async (c) => {
  const user = c.get("user") as { id: string };
  const supplier = decodeURIComponent(c.req.param("supplier"));
  const body = await c.req.json<{
    items: { barangId?: string; name: string; sku?: string; qty: number }[];
  }>();

  if (!supplier) return c.json({ error: "supplier wajib diisi" }, 400);

  // Delete all existing drafts for this supplier
  const existing = await db
    .select({ id: catatPesanan.id })
    .from(catatPesanan)
    .where(eq(catatPesanan.supplier, supplier));

  if (existing.length > 0) {
    await db.delete(catatPesanan).where(eq(catatPesanan.supplier, supplier));
  }

  // If items is empty, just clear the draft (no insert needed)
  if (!body.items || body.items.length === 0) {
    return c.json({ ok: true, id: null });
  }

  const id = randomUUID();
  await db.insert(catatPesanan).values({
    id,
    supplier,
    createdBy: user.id,
    date:      new Date().toISOString(),
  });

  const itemRows = body.items.map((item) => ({
    id:         randomUUID(),
    pesananId:  id,
    barangId:   item.barangId ?? null,
    barangName: item.name,
    barangSku:  item.sku ?? null,
    qty:        item.qty,
  }));

  await db.insert(catatPesananItems).values(itemRows);

  return c.json(await buildPesanan(
    (await db.select().from(catatPesanan).where(eq(catatPesanan.id, id)))[0]
  ));
});

// ── GET /api/catat-pesanan  — list all, newest first ──────────
app.get("/", async (c) => {
  const rows = await db
    .select()
    .from(catatPesanan)
    .orderBy(desc(catatPesanan.createdAt));

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return c.json([]);

  const items = await db
    .select()
    .from(catatPesananItems)
    .where(
      ids.length === 1
        ? eq(catatPesananItems.pesananId, ids[0])
        : inArray(catatPesananItems.pesananId, ids)
    );

  const result = rows.map((row) => ({
    id:        row.id,
    supplier:  row.supplier,
    createdBy: row.createdBy,
    date:      row.date,
    createdAt: row.createdAt,
    items:     items
      .filter((i) => i.pesananId === row.id)
      .map((i) => ({
        id:        i.id,
        barangId:  i.barangId,
        name:      i.barangName,
        sku:       i.barangSku,
        qty:       i.qty,
      })),
  }));

  return c.json(result);
});

// ── POST /api/catat-pesanan  — create ─────────────────────────
app.post("/", async (c) => {
  const user = c.get("user") as { id: string };
  const body = await c.req.json<{
    supplier: string;
    date: string;
    items: { barangId?: string; name: string; sku?: string; qty: number }[];
  }>();

  if (!body.supplier || !body.items?.length) {
    return c.json({ error: "supplier dan items wajib diisi" }, 400);
  }

  const id = randomUUID();

  await db.insert(catatPesanan).values({
    id,
    supplier:  body.supplier,
    createdBy: user.id,
    date:      body.date,
  });

  const itemRows = body.items.map((item) => ({
    id:         randomUUID(),
    pesananId:  id,
    barangId:   item.barangId ?? null,
    barangName: item.name,
    barangSku:  item.sku ?? null,
    qty:        item.qty,
  }));

  if (itemRows.length > 0) {
    await db.insert(catatPesananItems).values(itemRows);
  }

  return c.json({ id }, 201);
});

// ── DELETE /api/catat-pesanan/:id ─────────────────────────────
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(catatPesanan).where(eq(catatPesanan.id, id));
  return c.json({ ok: true });
});

export default app;
