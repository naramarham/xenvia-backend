-- Xenvia backend schema.
-- Mirrors the frontend's normalized device model 1:1 so the API can hand
-- data straight to the existing web catalogue (or a future Android client)
-- without another translation layer.

CREATE TABLE IF NOT EXISTS devices (
  id              TEXT PRIMARY KEY,       -- stable slug id, same scheme as the frontend's slugify()
  brand           TEXT NOT NULL,
  name            TEXT NOT NULL,
  model_number    TEXT,
  category        TEXT NOT NULL,          -- flagship | midrange | budget | gaming | foldable
  release_year    INTEGER NOT NULL,
  display_size    REAL,
  display_type    TEXT,
  display_refresh INTEGER,
  display_res     TEXT,
  chipset         TEXT,
  gpu             TEXT,
  battery         INTEGER,
  charging        INTEGER,
  camera_main     REAL,
  camera_ultrawide REAL,
  camera_telephoto REAL,
  camera_front    REAL,
  os              TEXT,
  network         TEXT,                   -- '4G' | '5G'
  weight          REAL,
  dimensions      TEXT,
  colors_json     TEXT,                   -- JSON array of color names
  rating          REAL,
  review_count    INTEGER,
  gaming_score    INTEGER,
  gaming_label    TEXT,
  updated_at      TEXT NOT NULL,          -- ISO timestamp of last successful sync write
  source          TEXT NOT NULL           -- which adapter last wrote this record (official/priceoye/gsmarena/whatmobile/manual)
);

CREATE TABLE IF NOT EXISTS variants (
  id          TEXT PRIMARY KEY,           -- `${device_id}-${ram}gb-${rom}gb`
  device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ram         INTEGER NOT NULL,
  rom         INTEGER NOT NULL,
  UNIQUE(device_id, ram, rom)
);

CREATE TABLE IF NOT EXISTS price_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id  TEXT NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,              -- official | priceoye | gsmarena | whatmobile
  price       INTEGER NOT NULL,           -- PKR
  url         TEXT,
  fetched_at  TEXT NOT NULL,
  UNIQUE(variant_id, source)
);

CREATE TABLE IF NOT EXISTS image_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,              -- official | priceoye | gsmarena
  url         TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  UNIQUE(device_id, source)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT,                       -- running | ok | failed
  added       INTEGER DEFAULT 0,
  updated     INTEGER DEFAULT 0,
  failed      INTEGER DEFAULT 0,
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_devices_brand ON devices(brand);
CREATE INDEX IF NOT EXISTS idx_devices_category ON devices(category);
CREATE INDEX IF NOT EXISTS idx_devices_year ON devices(release_year);
CREATE INDEX IF NOT EXISTS idx_variants_device ON variants(device_id);
