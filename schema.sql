PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'Produk',
  image_blob BLOB,
  image_mime TEXT DEFAULT '',
  shopee_url TEXT DEFAULT '',
  tokopedia_url TEXT DEFAULT '',
  contact_url TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_active_featured
  ON products(active, featured, sort_order);

INSERT OR IGNORE INTO products
(name, slug, description, price, category, image_blob, image_mime, shopee_url, tokopedia_url, contact_url, active, featured, sort_order)
VALUES
('Sensor Suhu & Kelembapan', 'sensor-suhu-kelembapan',
 'Pantau kondisi ruangan secara real-time.', 120000, 'IoT Monitoring', NULL, '', '', '', '', 1, 1, 1),
('Lampu Pintar DIY', 'lampu-pintar-diy',
 'Kontrol cahaya sesuai kebutuhan.', 85000, 'Smart Home', NULL, '', '', '', '', 1, 1, 2),
('Smart Plug', 'smart-plug',
 'Kendalikan perangkat dari mana saja.', 95000, 'Smart Home', NULL, '', '', '', '', 1, 1, 3),
('Aksesoris Rumah DIY', 'aksesoris-rumah-diy',
 'Kreasikan ruang sesuai gaya Anda.', 50000, 'Aksesoris', NULL, '', '', '', '', 1, 1, 4);
