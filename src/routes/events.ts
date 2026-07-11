import { Hono } from "hono";
import jwt from "jsonwebtoken";

const app = new Hono();

// SSE can't set headers, so token comes via query param
app.use("*", async (c, next) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: "karyawan" | "boss" | "superadmin"; username: string; name: string };
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// ── SSE client registry ────────────────────────────────────────
type SSEClient = { id: string; controller: ReadableStreamDefaultController };
const clients: Set<SSEClient> = new Set();

/** Broadcast an event to all connected SSE clients */
export function broadcast(event: string, data?: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const client of clients) {
    try {
      client.controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      clients.delete(client);
    }
  }
}

// GET /api/events — SSE stream
app.get("/", (c) => {
  const clientId = Math.random().toString(36).slice(2);
  let client: SSEClient;

  const stream = new ReadableStream({
    start(controller) {
      client = { id: clientId, controller };
      clients.add(client);

      // Send initial ping so connection is confirmed
      controller.enqueue(
        new TextEncoder().encode(`event: ping\ndata: {"connected":true}\n\n`)
      );
    },
    cancel() {
      clients.delete(client);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
});

export default app;
