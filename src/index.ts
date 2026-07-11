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
import eventsRoutes     from "./routes/events.js";

const app = new Hono();

// ── Global middleware ──────────────────────────────────────────
app.use("*", logger());
app.use("*", cors({
  origin: process.env.CORS_ORIGIN ?? "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));

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
app.route("/api/events",    eventsRoutes);

// ── 404 ────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Not found" }, 404));

// ── Start ──────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`🚀 Galaxy POS backend running on port ${port}`);
});

export default app;
