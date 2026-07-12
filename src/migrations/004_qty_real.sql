-- Migration 004: Change qty columns to real to support decimal values (e.g. 7.5m cable)
ALTER TABLE penjualan_items ALTER COLUMN qty TYPE real;
ALTER TABLE pemesanan_items ALTER COLUMN qty TYPE real;
