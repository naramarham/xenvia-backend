const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}
migrate();

// ---------------------------------------------------------------------------
// Upserts — called by the sync pipeline. Everything here is idempotent:
// running the same sync twice in a row updates rows in place rather than
// duplicating them (same principle as the frontend's buildCatalog dedupe).
// ---------------------------------------------------------------------------
const upsertDeviceStmt = db.prepare(`
  INSERT INTO devices (
    id, brand, name, model_number, category, release_year,
    display_size, display_type, display_refresh, display_res,
    chipset, gpu, battery, charging,
    camera_main, camera_ultrawide, camera_telephoto, camera_front,
    os, network, weight, dimensions, colors_json,
    rating, review_count, gaming_score, gaming_label, updated_at, source
  ) VALUES (
    @id, @brand, @name, @modelNumber, @category, @releaseYear,
    @displaySize, @displayType, @displayRefresh, @displayRes,
    @chipset, @gpu, @battery, @charging,
    @cameraMain, @cameraUltrawide, @cameraTelephoto, @cameraFront,
    @os, @network, @weight, @dimensions, @colorsJson,
    @rating, @reviewCount, @gamingScore, @gamingLabel, @updatedAt, @source
  )
  ON CONFLICT(id) DO UPDATE SET
    brand=excluded.brand, name=excluded.name, model_number=excluded.model_number,
    category=excluded.category, release_year=excluded.release_year,
    display_size=excluded.display_size, display_type=excluded.display_type,
    display_refresh=excluded.display_refresh, display_res=excluded.display_res,
    chipset=excluded.chipset, gpu=excluded.gpu, battery=excluded.battery, charging=excluded.charging,
    camera_main=excluded.camera_main, camera_ultrawide=excluded.camera_ultrawide,
    camera_telephoto=excluded.camera_telephoto, camera_front=excluded.camera_front,
    os=excluded.os, network=excluded.network, weight=excluded.weight, dimensions=excluded.dimensions,
    colors_json=excluded.colors_json, rating=excluded.rating, review_count=excluded.review_count,
    gaming_score=excluded.gaming_score, gaming_label=excluded.gaming_label,
    updated_at=excluded.updated_at, source=excluded.source
`);

const upsertVariantStmt = db.prepare(`
  INSERT INTO variants (id, device_id, ram, rom) VALUES (@id, @deviceId, @ram, @rom)
  ON CONFLICT(device_id, ram, rom) DO NOTHING
`);

const upsertPriceStmt = db.prepare(`
  INSERT INTO price_sources (variant_id, source, price, url, fetched_at)
  VALUES (@variantId, @source, @price, @url, @fetchedAt)
  ON CONFLICT(variant_id, source) DO UPDATE SET price=excluded.price, url=excluded.url, fetched_at=excluded.fetched_at
`);

const upsertImageStmt = db.prepare(`
  INSERT INTO image_sources (device_id, source, url, fetched_at)
  VALUES (@deviceId, @source, @url, @fetchedAt)
  ON CONFLICT(device_id, source) DO UPDATE SET url=excluded.url, fetched_at=excluded.fetched_at
`);

function upsertDevice(device) { upsertDeviceStmt.run(device); }
function upsertVariant(variant) { upsertVariantStmt.run(variant); }
function upsertPriceSource(row) { upsertPriceStmt.run(row); }
function upsertImageSource(row) { upsertImageStmt.run(row); }

// ---------------------------------------------------------------------------
// Reads — used by the API layer
// ---------------------------------------------------------------------------
function listDevices({ brand, category, search, yearMin, sort, page = 1, pageSize = 24 } = {}) {
  const where = [];
  const params = {};
  if (brand && brand !== 'All') { where.push('brand = @brand'); params.brand = brand; }
  if (category && category !== 'all') { where.push('category = @category'); params.category = category; }
  if (yearMin) { where.push('release_year >= @yearMin'); params.yearMin = yearMin; }
  if (search) { where.push('(brand LIKE @search OR name LIKE @search OR model_number LIKE @search)'); params.search = `%${search}%`; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = { newest: 'release_year DESC', oldest: 'release_year ASC', rating: 'rating DESC' }[sort] || 'release_year DESC';
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM devices ${whereSql} ORDER BY ${orderSql} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset });
  const total = db.prepare(`SELECT COUNT(*) AS c FROM devices ${whereSql}`).get(params).c;
  return { rows: rows.map(hydrateDevice), total };
}

function getDeviceById(id) {
  const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  return row ? hydrateDevice(row) : null;
}

function hydrateDevice(row) {
  const variants = db.prepare('SELECT * FROM variants WHERE device_id = ?').all(row.id).map((v) => ({
    id: v.id, ram: v.ram, rom: v.rom,
    prices: db.prepare('SELECT source, price, url FROM price_sources WHERE variant_id = ?').all(v.id),
  }));
  const images = db.prepare('SELECT source, url FROM image_sources WHERE device_id = ?').all(row.id);
  return {
    id: row.id, brand: row.brand, name: row.name, modelNumber: row.model_number,
    category: row.category, releaseYear: row.release_year,
    display: { size: row.display_size, type: row.display_type, refresh: row.display_refresh, resolution: row.display_res },
    chipset: row.chipset, gpu: row.gpu, battery: row.battery, charging: row.charging,
    camera: { main: row.camera_main, ultrawide: row.camera_ultrawide, telephoto: row.camera_telephoto, front: row.camera_front },
    os: row.os, network: row.network, weight: row.weight, dimensions: row.dimensions,
    colors: row.colors_json ? JSON.parse(row.colors_json) : [],
    rating: row.rating, reviewCount: row.review_count,
    gaming: { score: row.gaming_score, label: row.gaming_label },
    variants, imageSources: images, updatedAt: row.updated_at, source: row.source,
  };
}

function listBrands() {
  return db.prepare('SELECT brand, COUNT(*) AS count FROM devices GROUP BY brand ORDER BY count DESC').all();
}

function startSyncRun() {
  const startedAt = new Date().toISOString();
  const info = db.prepare('INSERT INTO sync_runs (started_at, status) VALUES (?, ?)').run(startedAt, 'running');
  return info.lastInsertRowid;
}
function finishSyncRun(runId, { status, added, updated, failed, notes }) {
  db.prepare('UPDATE sync_runs SET finished_at=?, status=?, added=?, updated=?, failed=?, notes=? WHERE id=?')
    .run(new Date().toISOString(), status, added, updated, failed, notes || null, runId);
}
function lastSyncRun() {
  return db.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1').get();
}

module.exports = {
  db, upsertDevice, upsertVariant, upsertPriceSource, upsertImageSource,
  listDevices, getDeviceById, listBrands, startSyncRun, finishSyncRun, lastSyncRun,
};
