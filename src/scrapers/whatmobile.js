const { politeGet } = require('../lib/http');
const cheerio = require('cheerio');

// ---------------------------------------------------------------------------
// WhatMobile.com.pk — lowest-priority fallback (pricing reference only, per
// the agreed order). Same caution as GSM Arena applies: check their ToS/
// robots.txt before enabling in production, keep volume minimal, and treat
// this as a last resort for whatever PriceOye + GSM Arena couldn't cover.
// Off by default via config.enableWhatmobile / ENABLE_WHATMOBILE.
//
// This one ships as a thinner stub than the PriceOye/GSM Arena adapters —
// I verified PriceOye and GSM Arena's structure directly during this build;
// I did not do the same live pass on WhatMobile, so treat the selector
// below as an untested starting point, not a verified one.
// ---------------------------------------------------------------------------
const BASE = 'https://www.whatmobile.com.pk';

async function fetchPriceReference(slugOrPath) {
  try {
    const url = slugOrPath.startsWith('http') ? slugOrPath : `${BASE}/${slugOrPath.replace(/^\//, '')}`;
    const html = await politeGet(url);
    const $ = cheerio.load(html);
    const priceText = $('[class*="price"]').first().text();
    const match = priceText && priceText.match(/[\d,]{4,}/);
    const price = match ? parseInt(match[0].replace(/,/g, ''), 10) : null;
    return price ? { price, url, source: 'whatmobile' } : null;
  } catch (e) {
    return null;
  }
}

module.exports = { fetchPriceReference };
