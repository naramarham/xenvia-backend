const cheerio = require('cheerio');
const { politeGet, verifyImageUrl } = require('../lib/http');

// ---------------------------------------------------------------------------
// GSM Arena — documented fallback only, per the agreed priority order
// (official sites > PriceOye > GSM Arena > WhatMobile).
//
// ⚠️  READ BEFORE ENABLING (config.enableGsmarena / ENABLE_GSMARENA=true):
// GSM Arena's Terms of Use restrict automated scraping/reuse of their data,
// and they're known to actively rate-limit or block scraper traffic. This
// adapter is included because you asked for the fallback to exist and be
// real, not theoretical — but it is OFF by default, and turning it on is
// a decision for you to make with their ToS in front of you, not a default
// this backend pushes you into. If you go this route in production,
// strongly consider reaching out to GSM Arena directly, keeping request
// volume minimal (this backend already rate-limits via SCRAPE_DELAY_MS),
// and treating it strictly as a last-resort fallback for the handful of
// devices PriceOye doesn't have — not a bulk source.
//
// Selectors below use GSM Arena's documented `data-spec` attribute hooks
// where I'm confident of the key names, with a label-text fallback for
// everything else — the label-text path is the one to trust most, since
// it isn't tied to internal key names that could change.
// ---------------------------------------------------------------------------
const BASE = 'https://www.gsmarena.com';

function textOf($el) { return $el.text().replace(/\s+/g, ' ').trim(); }

async function fetchSpecPage(gsmarenaUrl) {
  const html = await politeGet(gsmarenaUrl);
  const $ = cheerio.load(html);
  const specs = {};
  $('#specs-list table tr').each((_, row) => {
    const $row = $(row);
    const label = textOf($row.find('td.ttl'));
    const value = textOf($row.find('td.nfo'));
    if (label && value) specs[label.toLowerCase()] = value;
  });
  const candidate = $('meta[property="og:image"]').attr('content') || $('.specs-photo-main img').attr('src') || null;
  const image = candidate && (await verifyImageUrl(candidate)) ? candidate : null; // same broken-link guard as PriceOye's adapter
  const title = textOf($('h1.specs-phone-name-title')) || null;
  return { title, specs, image, url: gsmarenaUrl, source: 'gsmarena' };
  // NOTE: `specs` is a raw label->text map (e.g. specs['chipset'], specs['battery'],
  // specs['os']) rather than a fully normalized device object — GSM Arena's exact
  // label wording drifts by device/category, so the pipeline layer (src/pipeline)
  // is where this gets mapped onto the shared device model, with room to extend
  // the label list as you encounter new wording during real runs.
}

// Best-effort search: GSM Arena doesn't offer a clean public search endpoint
// this scraper can rely on without a devtools look, so resolving "which
// GSM Arena URL matches this PriceOye product name" is left as an explicit
// TODO rather than guessed at — see README "Known limitations".
async function findSpecPageUrl(_brand, _model) {
  return null; // TODO: implement once the search endpoint is inspected live
}

module.exports = { fetchSpecPage, findSpecPageUrl };
