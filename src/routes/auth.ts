import { Hono } from "hono";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { z } from "zod";

const app = new Hono();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/login
app.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid request body" }, 400);

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  if (!user || !user.active) return c.json({ error: "Invalid credentials" }, 401);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "30d" }
  );

  return c.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

// POST /api/auth/logout  (client-side — just acknowledge)
app.post("/logout", (c) => c.json({ ok: true }));

export default app;
