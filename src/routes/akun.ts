import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jwtAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const app = new Hono();
app.use("*", jwtAuth());

const createSchema = z.object({
  username:      z.string().min(3).max(32),
  password:      z.string().min(6),
  name:          z.string().min(1),
  role:          z.enum(["karyawan", "boss", "superadmin"]),
  gaji_per_hari: z.number().int().min(0).default(0),
});

const updateSchema = z.object({
  name:          z.string().min(1).optional(),
  role:          z.enum(["karyawan", "boss", "superadmin"]).optional(),
  active:        z.boolean().optional(),
  gaji_per_hari: z.number().int().min(0).optional(),
  password:      z.string().min(6).optional(),
});

// GET /api/akun  (boss+)
app.get("/", requireRole("boss", "superadmin"), async (c) => {
  const rows = await db.select({
    id: schema.users.id,
    username: schema.users.username,
    name: schema.users.name,
    role: schema.users.role,
    active: schema.users.active,
    gaji_per_hari: schema.users.gaji_per_hari,
    createdAt: schema.users.createdAt,
  }).from(schema.users);
  return c.json(rows);
});

// POST /api/akun  (superadmin only)
app.post("/", requireRole("superadmin"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.username, parsed.data.username));
  if (existing) return c.json({ error: "Username sudah digunakan" }, 409);

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const [row] = await db.insert(schema.users).values({
    id: randomUUID(),
    username: parsed.data.username,
    password: hashed,
    name: parsed.data.name,
    role: parsed.data.role,
    gaji_per_hari: parsed.data.gaji_per_hari,
    active: true,
  }).returning({
    id: schema.users.id, username: schema.users.username,
    name: schema.users.name, role: schema.users.role, active: schema.users.active,
  });
  return c.json(row, 201);
});

// PUT /api/akun/:id  (superadmin only)
app.put("/:id", requireRole("superadmin"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { password, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (password) updates.password = await bcrypt.hash(password, 12);

  const [row] = await db.update(schema.users).set(updates).where(eq(schema.users.id, c.req.param("id"))).returning({
    id: schema.users.id, username: schema.users.username,
    name: schema.users.name, role: schema.users.role, active: schema.users.active,
  });
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// DELETE /api/akun/:id  (superadmin only)
app.delete("/:id", requireRole("superadmin"), async (c) => {
  const me = c.get("user");
  if (me.id === c.req.param("id")) return c.json({ error: "Tidak bisa hapus akun sendiri" }, 400);
  const [row] = await db.delete(schema.users).where(eq(schema.users.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
