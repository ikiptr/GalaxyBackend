CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  user_role   TEXT NOT NULL,
  method      TEXT NOT NULL,   -- POST | PUT | PATCH | DELETE
  path        TEXT NOT NULL,   -- e.g. /api/barang/uuid
  action      TEXT NOT NULL,   -- human-readable e.g. "Tambah Barang"
  detail      TEXT DEFAULT '' NOT NULL,  -- JSON or short description
  status      INTEGER NOT NULL,          -- HTTP status code
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS activity_log_user_idx ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log(created_at DESC);
