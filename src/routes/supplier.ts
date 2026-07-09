import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth());

const bodySchema = z.object({
  name:    z.string().min(1),
  phone:   z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

app.get("/", async (c) => {
  return c.json(await db.select().from(schema.suppliers));
});

app.post("/", requireRole("boss", "superadmin"), async (c) => {
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const [row] = await db.insert(schema.suppliers).values({ id: randomUUID(), ...parsed.data }).returning();
  return c.json(row, 201);
});

app.put("/:id", requireRole("boss", "superadmin"), async (c) => {
  const parsed = bodySchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const [row] = await db.update(schema.suppliers).set(parsed.data).where(eq(schema.suppliers.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

app.delete("/:id", requireRole("superadmin"), async (c) => {
  const [row] = await db.delete(schema.suppliers).where(eq(schema.suppliers.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
