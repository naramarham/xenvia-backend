const cheerio = require('cheerio');
const { politeGet, verifyImageUrl } = require('../lib/http');

// ---------------------------------------------------------------------------
// PriceOye.pk — top-priority source for pricing, and a strong secondary
// source for images. VERIFIED LIVE (Sept 2026): brand listing pages at
// https://priceoye.pk/mobiles/{brand-slug} are server-rendered HTML —
// genuinely scrapeable with a plain GET, no headless browser needed.
//
// IMPORTANT — how this parser works and its one real limitation:
// I built this without live browser devtools access to PriceOye's raw HTML
// (I could only inspect the rendered text/markdown, not exact CSS class
// names). So instead of brittle class selectors like `.product-card__price`
// that WILL break the moment their frontend redeploys, this parses the
// *visible text* of each product anchor with a regex, which is far more
// resistant to styling/markup changes. What it can't do without that live
// inspection: pagination past page 1 (~24-30 items per brand) — the exact
// query-string/URL pattern for page 2+ needs a quick look at devtools
// Network tab and a one-line addition to fetchBrandListing() below.
// ---------------------------------------------------------------------------
const BASE = 'https://priceoye.pk';

function parseListingCardText(rawText) {
  let t = rawText.replace(/\s+/g, ' ').trim();
  t = t.replace(/^Badge\s*/, '');
  let rating = null;
  let reviewCount = null;
  const ratingMatch = t.match(/^Rating Star(\d(?:\.\d)?)(\d+)Reviews\s*/);
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1]);
    reviewCount = parseInt(ratingMatch[2], 10);
    t = t.slice(ratingMatch[0].length);
  }
  const priceMatches = [...t.matchAll(/Rs\s?(\d{1,3}(?:,\d{3})*)/g)];
  if (!priceMatches.length) return null;
  const name = t.slice(0, priceMatches[0].index).trim();
  if (!name) return null;
  const price = parseInt(priceMatches[0][1].replace(/,/g, ''), 10);
  const originalPrice = priceMatches[1] ? parseInt(priceMatches[1][1].replace(/,/g, ''), 10) : null;
  return { name, rating, reviewCount, price, originalPrice };
}

async function fetchBrandListing(brandSlug) {
  const url = `${BASE}/mobiles/${brandSlug}`;
  const html = await politeGet(url);
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];
  $('a[href*="/mobiles/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/^\/mobiles\/([^/?]+)\/([^/?]+)\/?/);
    if (!m) return; // not a product-detail link (e.g. the brand nav rail itself)
    const productUrl = href.startsWith('http') ? href : `${BASE}${href}`;
    if (seen.has(productUrl)) return;
    seen.add(productUrl);
    const parsed = parseListingCardText($(el).text());
    if (!parsed) return;
    items.push({ ...parsed, brandSlug: m[1], productSlug: m[2], url: productUrl, source: 'priceoye' });
  });
  return items;
  // TODO (needs live devtools check): follow pagination for brands with
  // more than ~24-30 devices — see note above.
}

// og:image is the most reliable image-extraction method across virtually
// any modern e-commerce site (it's set for social-share previews and rarely
// removed even when the rest of the markup changes), so it's used here
// instead of guessing a product-gallery class name. The result is verified
// (see verifyImageUrl in lib/http.js) before being returned — a page that
// still has an og:image tag pointing at a now-dead URL returns null here,
// same as if no image were found at all, so the pipeline keeps whatever
// was already stored rather than overwriting a good image with a broken one.
async function fetchProductImage(productUrl) {
  try {
    const html = await politeGet(productUrl);
    const $ = cheerio.load(html);
    const candidate = $('meta[property="og:image"]').attr('content') || null;
    if (!candidate) return null;
    const isReal = await verifyImageUrl(candidate);
    return isReal ? candidate : null;
  } catch (e) {
    return null;
  }
}

module.exports = { fetchBrandListing, fetchProductImage, parseListingCardText };
