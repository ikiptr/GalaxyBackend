import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  id: string;
  username: string;
  name: string;
  role: "karyawan" | "boss" | "superadmin";
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthPayload;
  }
}

export function jwtAuth() {
  return createMiddleware(async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized — no token" }, 401);
    }
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as AuthPayload;
      c.set("user", payload);
      await next();
    } catch {
      return c.json({ error: "Unauthorized — invalid token" }, 401);
    }
  });
}

export function requireRole(...roles: string[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      return c.json({ error: "Forbidden — insufficient role" }, 403);
    }
    await next();
  });
}
