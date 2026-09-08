// ---------------------------------------------------------------------------
// Official manufacturer sites — highest priority per your spec, and also
// the most labor-intensive: there isn't one "official sites" endpoint,
// there are 20 (apple.com, samsung.com, mi.com, ...), each with its own
// markup, and most modern flagship product pages are JS-rendered rather
// than plain server HTML, which means a real adapter for those needs a
// headless browser (Playwright, which is already available in this
// container's toolchain) rather than a plain GET + cheerio.
//
// Rather than ship 20 unverified, probably-broken stubs pretending this is
// done, this file defines the one thing that actually matters architecturally
// — a stable per-brand adapter interface — with the registry wired up and
// ready. Each adapter just needs to return the shape below; the pipeline
// doesn't care how a given brand gets there.
//
// Practically: PriceOye already resells virtually every brand in this
// catalogue and is fully scrapeable (see scrapers/priceoye.js), so it does
// most of the real work today. Add official-site adapters incrementally,
// brand by brand, as they're worth the (real) engineering time — the
// pipeline will prefer 'official' the moment an adapter for a brand exists
// and returns data, with zero other code changes.
//
// Expected return shape from an adapter, or null if it found nothing:
//   { price: number | null, imageUrl: string | null, specs: object, source: 'official' }
// ---------------------------------------------------------------------------

const ADAPTERS = {
  // apple: require('./official/apple'),
  // samsung: require('./official/samsung'),
  // ...add one file per brand under src/scrapers/official/ as you build them
};

async function fetchFromOfficial(brand, model) {
  const key = brand.toLowerCase();
  const adapter = ADAPTERS[key];
  if (!adapter) return null;
  try {
    return await adapter.fetch(model);
  } catch (e) {
    return null; // an official-site failure should never break a sync run
  }
}

function hasOfficialAdapter(brand) { return !!ADAPTERS[brand.toLowerCase()]; }

module.exports = { fetchFromOfficial, hasOfficialAdapter, ADAPTERS };
