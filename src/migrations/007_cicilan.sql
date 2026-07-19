-- cicilan: recurring payment entries (car installment, bank loan, etc.)
CREATE TABLE IF NOT EXISTS cicilan (
  id              TEXT PRIMARY KEY,
  nama            TEXT NOT NULL,              -- e.g. "Cicilan Mobil Avanza"
  keterangan      TEXT DEFAULT '' NOT NULL,   -- optional notes
  jumlah          INTEGER NOT NULL,           -- amount per installment
  tanggal_mulai   TEXT NOT NULL,             -- "YYYY-MM-DD" start date
  jangka_bulan    INTEGER NOT NULL,           -- total months e.g. 48
  tanggal_bayar   INTEGER NOT NULL,           -- day of month to pay (1-31)
  status          TEXT DEFAULT 'Aktif' NOT NULL, -- Aktif | Lunas | Berhenti
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- cicilan_payments: per-month payment records
CREATE TABLE IF NOT EXISTS cicilan_payments (
  id              TEXT PRIMARY KEY,
  cicilan_id      TEXT NOT NULL REFERENCES cicilan(id) ON DELETE CASCADE,
  bulan           TEXT NOT NULL,             -- "YYYY-MM" the month this covers
  tanggal_bayar   TEXT,                      -- "YYYY-MM-DD" actual payment date, NULL = belum bayar
  jumlah          INTEGER NOT NULL,
  catatan         TEXT DEFAULT '' NOT NULL
);
