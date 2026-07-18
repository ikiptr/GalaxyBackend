-- Add barang_sku and barang_id to penjualan_items so SKU is stored at sale time
-- This prevents wrong SKU display when two products share the same name but have different SKUs
ALTER TABLE penjualan_items ADD COLUMN IF NOT EXISTS barang_sku text;
ALTER TABLE penjualan_items ADD COLUMN IF NOT EXISTS barang_id  text;
