import { Hono } from "hono";
import { db } from "../db/index.js";
import { activityLog } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { jwtAuth, requireRole, type AuthPayload } from "../middleware/auth.js";
import { randomUUID } from "crypto";

const app = new Hono();
app.use("*", jwtAuth(), requireRole("superadmin"));

// GET /api/log?userId=xxx&limit=200
app.get("/", async (c) => {
  const userId = c.req.query("userId");
  const limit = Math.min(500, parseInt(c.req.query("limit") ?? "200") || 200);

  const rows = userId
    ? await db.select().from(activityLog).where(eq(activityLog.userId, userId)).orderBy(desc(activityLog.createdAt)).limit(limit)
    : await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);

  return c.json(rows);
});

export default app;

// ── writeLog — fire-and-forget helper used by the global middleware ─
export async function writeLog(payload: {
  user: AuthPayload;
  method: string;
  path: string;
  action: string;
  detail?: string;
  status: number;
}) {
  try {
    await db.insert(activityLog).values({
      id:       randomUUID(),
      userId:   payload.user.id,
      userName: payload.user.name,
      userRole: payload.user.role,
      method:   payload.method,
      path:     payload.path,
      action:   payload.action,
      detail:   payload.detail ?? "",
      status:   payload.status,
    });
  } catch (e) {
    // Never crash the main request because of a log failure
    console.error("[writeLog] failed:", e);
  }
}
