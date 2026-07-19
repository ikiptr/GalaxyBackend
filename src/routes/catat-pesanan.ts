import { Hono } from "hono";
import { db } from "../db/index.js";
import { catatPesanan, catatPesananItems } from "../db/schema.js";
import { eq, desc, inArray } from "drizzle-orm";
import { jwtAuth } from "../middleware/auth.js";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

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
