import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import authRoutes     from "./routes/auth.js";
import barangRoutes   from "./routes/barang.js";
import kategoriRoutes from "./routes/kategori.js";
import supplierRoutes from "./routes/supplier.js";
import penjualanRoutes  from "./routes/penjualan.js";
import pemesananRoutes  from "./routes/pemesanan.js";
import absensiRoutes    from "./routes/absensi.js";
import akunRoutes       from "./routes/akun.js";
import tagihanRoutes    from "./routes/tagihan.js";
import antaranRoutes    from "./routes/antaran.js";
import eventsRoutes        from "./routes/events.js";
import catatPesananRoutes  from "./routes/catat-pesanan.js";
import cicilanRoutes       from "./routes/cicilan.js";
import logRoutes, { writeLog } from "./routes/log.js";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "./middleware/auth.js";

// ── Human-readable action labels ──────────────────────────────
function inferAction(method: string, path: string): string {
  const m = method.toUpperCase();
  const seg = path.replace(/^\/api\//, "").split("/");
  const resource = seg[0] ?? "";
  const sub = seg[2] ?? "";           // e.g. "bayar", "payment", "deliver"
  const hasId = seg[1] && seg[1].length > 10; // UUID-like

  const labels: Record<string, { add: string; edit: string; del: string }> = {
    barang:         { add: "Tambah Barang",       edit: "Edit Barang",         del: "Hapus Barang" },
    kategori:       { add: "Tambah Kategori",     edit: "Edit Kategori",       del: "Hapus Kategori" },
    supplier:       { add: "Tambah Supplier",     edit: "Edit Supplier",       del: "Hapus Supplier" },
    penjualan:      { add: "Catat Penjualan",     edit: "Edit Penjualan",      del: "Hapus Penjualan" },
    pemesanan:      { add: "Tambah Pemesanan",    edit: "Update Pemesanan",    del: "Hapus Pemesanan" },
    antaran:        { add: "Buat Antaran",        edit: "Update Antaran",      del: "Hapus Antaran" },
    tagihan:        { add: "Tambah Tagihan",      edit: "Update Tagihan",      del: "Hapus Tagihan" },
    cicilan:        { add: "Tambah Cicilan",      edit: "Update Cicilan",      del: "Hapus Cicilan" },
    absensi:        { add: "Toggle Absensi",      edit: "Reset Absensi",       del: "Hapus Absensi" },
    akun:           { add: "Buat Akun",           edit: "Edit Akun",           del: "Hapus Akun" },
    "catat-pesanan":{ add: "Catat Pesanan",       edit: "Edit Catat Pesanan",  del: "Hapus Catat Pesanan" },
    auth:           { add: "Login",               edit: "Ganti Password",      del: "Logout" },
  };
  const lbl = labels[resource] ?? { add: `POST ${resource}`, edit: `PUT/PATCH ${resource}`, del: `DELETE ${resource}` };

  if (m === "DELETE") {
    if (sub === "bayar") return `Batal Bayar Cicilan`;
    return lbl.del;
  }
  if (m === "POST") {
    if (sub === "bayar")    return "Tandai Bayar Cicilan";
    if (sub === "pay")      return "Bayar Tagihan";
    if (sub === "deliver")  return "Kirim Antaran";
    if (sub === "payment")  return "Update Pembayaran Pemesanan";
    if (sub === "toggle")   return "Toggle Absensi";
    if (sub === "reset-paid") return "Reset Gaji Dibayar";
    return lbl.add;
  }
  if (m === "PUT" || m === "PATCH") {
    if (sub === "deliver") return "Kirim Antaran";
    if (sub === "payment") return "Update Pembayaran Pemesanan";
    return hasId ? lbl.edit : lbl.edit;
  }
  return `${m} ${resource}`;
}

const app = new Hono();

// ── Global middleware ──────────────────────────────────────────
app.use("*", logger());
app.use("*", cors({
  origin: process.env.CORS_ORIGIN ?? "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));

// ── Activity logging — runs after every mutating API request ──
app.use("/api/*", async (c, next) => {
  await next();
  const method = c.req.method.toUpperCase();
  if (!["POST","PUT","PATCH","DELETE"].includes(method)) return;

  // Skip the log route itself and auth/login
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/log") || path === "/api/auth/login") return;

  // Try to extract the user from the JWT (best-effort; skip if missing/invalid)
  try {
    const header = c.req.header("Authorization") ?? "";
    if (!header.startsWith("Bearer ")) return;
    const user = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as AuthPayload;
    const status = c.res.status;
    const action = inferAction(method, path);
    // fire-and-forget — don't await so the response is never delayed
    writeLog({ user, method, path, action, status }).catch(() => {});
  } catch { /* invalid token or expired — skip logging */ }
});

// ── Health check ───────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// ── Routes ─────────────────────────────────────────────────────
app.route("/api/auth",      authRoutes);
app.route("/api/barang",    barangRoutes);
app.route("/api/kategori",  kategoriRoutes);
app.route("/api/supplier",  supplierRoutes);
app.route("/api/penjualan", penjualanRoutes);
app.route("/api/pemesanan", pemesananRoutes);
app.route("/api/absensi",   absensiRoutes);
app.route("/api/akun",      akunRoutes);
app.route("/api/tagihan",   tagihanRoutes);
app.route("/api/antaran",   antaranRoutes);
app.route("/api/events",         eventsRoutes);
app.route("/api/catat-pesanan",  catatPesananRoutes);
app.route("/api/cicilan",        cicilanRoutes);
app.route("/api/log",            logRoutes);

// ── 404 ────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Not found" }, 404));

// ── Start ──────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`🚀 Galaxy POS backend running on port ${port}`);
});

export default app;
