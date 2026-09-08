require('dotenv').config();

function bool(v, fallback) {
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dbPath: process.env.DB_PATH || './data/xenvia.sqlite',
  syncCron: process.env.SYNC_CRON || '0 3 * * *',
  syncOnBoot: bool(process.env.SYNC_ON_BOOT, false),
  catalogWindowYears: Number(process.env.CATALOG_WINDOW_YEARS || 5),
  scrapeDelayMs: Number(process.env.SCRAPE_DELAY_MS || 1200),
  enableGsmarena: bool(process.env.ENABLE_GSMARENA, false),
  enableWhatmobile: bool(process.env.ENABLE_WHATMOBILE, false),

  // Source priority — identical ordering to the frontend's DataSyncService /
  // imageService, so behavior is consistent whichever layer resolves a value.
  priceSourcePriority: ['official', 'priceoye', 'gsmarena', 'whatmobile'],
  imageSourcePriority: ['official', 'priceoye', 'gsmarena'],
};
