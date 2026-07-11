import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

const bodySchema = z.object({ name: z.string().min(1) });

app.get("/", async (c) => {
  return c.json(await db.select().from(schema.categories));
});

app.post("/", async (c) => {
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const [existing] = await db.select().from(schema.categories).where(eq(schema.categories.name, parsed.data.name));
  if (existing) return c.json({ error: "Kategori sudah ada" }, 409);
  const [row] = await db.insert(schema.categories).values({ id: randomUUID(), name: parsed.data.name }).returning();
  return c.json(row, 201);
});

app.put("/:id", async (c) => {
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const [row] = await db.update(schema.categories).set(parsed.data).where(eq(schema.categories.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

app.delete("/:id", requireRole("superadmin"), async (c) => {
  const [row] = await db.delete(schema.categories).where(eq(schema.categories.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
