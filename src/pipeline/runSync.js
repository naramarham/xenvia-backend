const config = require('../config');
const db = require('../db/db');
const ids = require('../lib/ids');
const { resolvePrice } = require('../lib/pricing');
const { computeGamingScore } = require('../lib/gaming');
const priceoye = require('../scrapers/priceoye');
const gsmarena = require('../scrapers/gsmarena');
const officialSites = require('../scrapers/officialSites');

// Best-guess PriceOye brand slugs — confirmed live for samsung, infinix,
// nothing, xiaomi, oppo, vivo, honor, tecno (they appeared in the site's own
// nav during this build); the rest are reasonable single-word guesses and
// worth a quick live check before your first real run.
const BRAND_SLUGS = [
  'apple', 'samsung', 'xiaomi', 'oneplus', 'oppo', 'vivo', 'realme', 'honor',
  'huawei', 'motorola', 'nokia', 'sony', 'asus', 'nothing', 'zte', 'infinix',
  'tecno', 'itel', 'lenovo', 'google',
];

function displayBrandName(slug) {
  const map = { zte: 'ZTE', itel: 'itel', oneplus: 'OnePlus', google: 'Google' };
  return map[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Priceoye doesn't hand us a release year directly; falling back to the
// current year is a deliberate, documented choice — PriceOye's active
// listings are, by definition, currently-sold inventory, which is a
// reasonable proxy for "within the catalogue window" until an official/
// GSM Arena adapter fills in the real release date.
function guessReleaseYear() { return new Date().getFullYear(); }

// Without confirmed chipset data (that needs GSM Arena or an official
// adapter, neither guaranteed per item), category is a rough price-based
// heuristic — clearly a placeholder, not a claim of real classification.
function guessCategory(price) {
  if (price >= 200000) return 'flagship';
  if (price >= 80000) return 'midrange';
  return 'budget';
}

async function syncBrand(brandSlug, stats) {
  const brand = displayBrandName(brandSlug);
  let items = [];
  try {
    items = await priceoye.fetchBrandListing(brandSlug);
  } catch (e) {
    stats.failed++;
    console.error(`[sync] PriceOye listing failed for ${brand}:`, e.message);
    return;
  }

  for (const item of items) {
    try {
      const devId = ids.deviceId(brand, item.name, item.productSlug);
      const releaseYear = guessReleaseYear();
      if (releaseYear < new Date().getFullYear() - config.catalogWindowYears) continue; // outside the rolling window

      // Official site takes priority when an adapter exists for this brand.
      const official = await officialSites.fetchFromOfficial(brand, item.name);

      // GSM Arena fallback — only attempted when official had nothing, and
      // only when explicitly enabled (see scrapers/gsmarena.js caution note).
      let gsmarenaData = null;
      if (!official && config.enableGsmarena) {
        const specUrl = await gsmarena.findSpecPageUrl(brand, item.name);
        if (specUrl) gsmarenaData = await gsmarena.fetchSpecPage(specUrl).catch(() => null);
      }

      let imageUrl = official && official.imageUrl;
      if (!imageUrl) imageUrl = await priceoye.fetchProductImage(item.url);
      if (!imageUrl && gsmarenaData) imageUrl = gsmarenaData.image;

      const priceRows = [{ source: 'priceoye', price: item.price, url: item.url, fetchedAt: new Date().toISOString() }];
      if (official && official.price) priceRows.unshift({ source: 'official', price: official.price, url: null, fetchedAt: new Date().toISOString() });

      const category = guessCategory(resolvePrice(priceRows));
      const chipset = (official && official.specs && official.specs.chipset)
        || (gsmarenaData && gsmarenaData.specs && gsmarenaData.specs.chipset)
        || null;
      const gaming = chipset
        ? computeGamingScore({ chip: chipset, ramOpts: [8], refresh: 90, batt: 5000, cat: category })
        : { score: null, label: null };

      const now = new Date().toISOString();
      db.upsertDevice({
        id: devId, brand, name: item.name, modelNumber: item.productSlug, category, releaseYear,
        displaySize: null, displayType: null, displayRefresh: null, displayRes: null,
        chipset: chipset, gpu: null,
        battery: null, charging: null,
        cameraMain: null, cameraUltrawide: null, cameraTelephoto: null, cameraFront: null,
        os: null, network: null, weight: null, dimensions: null, colorsJson: '[]',
        rating: item.rating, reviewCount: item.reviewCount,
        gamingScore: gaming.score, gamingLabel: gaming.label,
        updatedAt: now, source: official ? 'official' : gsmarenaData ? 'gsmarena' : 'priceoye',
      });

      const vId = ids.variantId(devId, 8, 128); // PriceOye's listing view doesn't expose variant RAM/ROM directly — see README
      db.upsertVariant({ id: vId, deviceId: devId, ram: 8, rom: 128 });
      for (const row of priceRows) db.upsertPriceSource({ variantId: vId, ...row });
      if (imageUrl) db.upsertImageSource({ deviceId: devId, source: official && official.imageUrl ? 'official' : (gsmarenaData && gsmarenaData.image === imageUrl ? 'gsmarena' : 'priceoye'), url: imageUrl, fetchedAt: now });

      stats.updated++;
    } catch (e) {
      stats.failed++;
      console.error(`[sync] Failed on ${brand} item:`, item.name, e.message);
    }
  }
}

async function runDailySync() {
  const runId = db.startSyncRun();
  const stats = { updated: 0, failed: 0 };
  console.log(`[sync] Starting run #${runId} at ${new Date().toISOString()}`);
  try {
    for (const slug of BRAND_SLUGS) {
      console.log(`[sync] ${slug}...`);
      await syncBrand(slug, stats);
    }
    db.finishSyncRun(runId, { status: 'ok', added: 0, updated: stats.updated, failed: stats.failed });
    console.log(`[sync] Done. updated=${stats.updated} failed=${stats.failed}`);
  } catch (e) {
    db.finishSyncRun(runId, { status: 'failed', added: 0, updated: stats.updated, failed: stats.failed, notes: e.message });
    console.error('[sync] Run failed:', e);
    throw e;
  }
  return stats;
}

module.exports = { runDailySync, BRAND_SLUGS };
