-- catat_pesanan: header record for a supplier order list
CREATE TABLE IF NOT EXISTS catat_pesanan (
  id           TEXT PRIMARY KEY,
  supplier     TEXT NOT NULL,
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  date         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- catat_pesanan_items: individual items within an order list
CREATE TABLE IF NOT EXISTS catat_pesanan_items (
  id           TEXT PRIMARY KEY,
  pesanan_id   TEXT NOT NULL REFERENCES catat_pesanan(id) ON DELETE CASCADE,
  barang_id    TEXT,          -- nullable: NULL for manual items
  barang_name  TEXT NOT NULL,
  barang_sku   TEXT,
  qty          INTEGER NOT NULL
);
