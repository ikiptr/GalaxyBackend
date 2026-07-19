import { pgTable, text, integer, real, boolean, timestamp, date, pgEnum } from "drizzle-orm/pg-core";

// Enums
export const roleEnum = pgEnum("role", ["karyawan", "boss", "superadmin"]);

// ── Users / Accounts ──────────────────────────────────────────
export const users = pgTable("users", {
  id:        text("id").primaryKey(),
  username:  text("username").unique().notNull(),
  password:  text("password").notNull(),           // bcrypt hash
  name:      text("name").notNull(),
  role:      roleEnum("role").default("karyawan").notNull(),
  active:    boolean("active").default(true).notNull(),
  gaji_per_hari: integer("gaji_per_hari").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Categories (Kategori) ──────────────────────────────────────
export const categories = pgTable("categories", {
  id:   text("id").primaryKey(),
  name: text("name").unique().notNull(),
});

// ── Suppliers ──────────────────────────────────────────────────
export const suppliers = pgTable("suppliers", {
  id:      text("id").primaryKey(),
  name:    text("name").unique().notNull(),
  phone:   text("phone"),
  address: text("address"),
});

// ── Barang (Products) ──────────────────────────────────────────
export const barang = pgTable("barang", {
  id:       text("id").primaryKey(),
  sku:      text("sku").notNull(),
  name:     text("name").notNull(),
  category: text("category").references(() => categories.name, { onDelete: "set null" }),
  supplier: text("supplier").references(() => suppliers.name, { onDelete: "set null" }),
  price:    real("price").notNull(),        // harga jual
  cost:     real("cost").notNull(),         // harga modal
  stock:    integer("stock").default(0).notNull(),
  minStock: integer("min_stock").default(0).notNull(),
});

// ── Penjualan (Sales / completed transactions) ─────────────────
export const penjualan = pgTable("penjualan", {
  id:     text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  total:  text("total").notNull(),   // formatted string "Rp xxx"
  status: text("status").default("Selesai").notNull(),
  date:   text("date").notNull(),    // "12 Jun 2026, 10:30"
});

export const penjualanItems = pgTable("penjualan_items", {
  id:           text("id").primaryKey(),
  penjualanId:  text("penjualan_id").references(() => penjualan.id, { onDelete: "cascade" }),
  barangName:   text("barang_name").notNull(),
  barangSku:    text("barang_sku"),      // stored at sale time — avoids wrong SKU when names collide
  barangId:     text("barang_id"),       // reference to barang.id (nullable for manual items)
  qty:          real("qty").notNull(),   // real to support decimals e.g. 7.5m cable
  price:        real("price").notNull(),
});

// ── Pemesanan (Customer orders) ────────────────────────────────
export const pemesanan = pgTable("pemesanan", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").references(() => users.id, { onDelete: "set null" }),
  customer:  text("customer").notNull(),
  phone:     text("phone"),
  note:      text("note"),
  qty:       integer("qty").default(0).notNull(),
  total:     text("total").notNull(),
  dpPaid:    text("dp_paid").default("Rp 0").notNull(),
  remaining: text("remaining").notNull(),
  status:    text("status").default("Menunggu").notNull(), // Lunas | DP | Menunggu
  date:      text("date").notNull(),
});

export const pemesananItems = pgTable("pemesanan_items", {
  id:          text("id").primaryKey(),
  pemesananId: text("pemesanan_id").references(() => pemesanan.id, { onDelete: "cascade" }),
  barangName:  text("barang_name").notNull(),
  qty:         real("qty").notNull(),   // real to support decimals e.g. 7.5m cable
  price:       real("price").notNull(),
});

// ── Absensi ────────────────────────────────────────────────────
export const absensi = pgTable("absensi", {
  id:     text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tanggal: date("tanggal").notNull(),
  hadir:  boolean("hadir").default(true).notNull(),
});

// ── Antaran (Deliveries) ───────────────────────────────────────
export const antaran = pgTable("antaran", {
  id:         text("id").primaryKey(),
  invoice:    text("invoice").notNull(),
  customer:   text("customer").notNull(),
  phone:      text("phone").default("-").notNull(),
  address:    text("address").notNull(),
  items:      text("items").notNull(),   // JSON array [{name,sku,qty}]
  date:       text("date").notNull(),
  status:     text("status").default("Belum Diantar").notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Catat Pesanan (Supplier order lists) ──────────────────────
export const catatPesanan = pgTable("catat_pesanan", {
  id:          text("id").primaryKey(),
  supplier:    text("supplier").notNull(),
  createdBy:   text("created_by").references(() => users.id, { onDelete: "set null" }),
  date:        text("date").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const catatPesananItems = pgTable("catat_pesanan_items", {
  id:          text("id").primaryKey(),
  pesananId:   text("pesanan_id").references(() => catatPesanan.id, { onDelete: "cascade" }).notNull(),
  barangId:    text("barang_id"),
  barangName:  text("barang_name").notNull(),
  barangSku:   text("barang_sku"),
  qty:         integer("qty").notNull(),
});

// ── Tagihan (Supplier invoices) ────────────────────────────────
export const tagihan = pgTable("tagihan", {
  id:             text("id").primaryKey(),
  supplierId:     text("supplier_id"),
  supplierName:   text("supplier_name").notNull(),
  nomorTagihan:   text("nomor_tagihan").notNull(),
  keterangan:     text("keterangan").default("").notNull(),
  total:          integer("total").notNull(),
  sudahDibayar:   integer("sudah_dibayar").default(0).notNull(),
  jatuhTempo:     text("jatuh_tempo").notNull(),   // "YYYY-MM-DD"
  tanggalTagihan: text("tanggal_tagihan").notNull(), // "YYYY-MM-DD"
  status:         text("status").default("Belum Bayar").notNull(), // Belum Bayar | Bayar Sebagian | Lunas
  buktiBayar:     text("bukti_bayar").default("[]").notNull(),     // JSON array of data URLs
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
