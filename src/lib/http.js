const axios = require('axios');
const config = require('../config');

const client = axios.create({
  timeout: 15000,
  headers: {
    // A normal browser UA. Identify yourself honestly in a real deployment —
    // e.g. append "(+https://your-domain/bot)" so sites can see who's
    // knocking and how to reach you if there's a problem.
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 XenviaSyncBot/0.1',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// Every scraper call should go through this — it enforces the politeness
// delay from config so a sync run doesn't hammer any one source.
async function politeGet(url) {
  await sleep(config.scrapeDelayMs);
  const res = await client.get(url);
  return res.data;
}

// ---------------------------------------------------------------------------
// Verifies an extracted image URL actually resolves to a real image before
// the sync pipeline is allowed to write it over whatever's already stored.
// This is what makes "keep the last good image if today's fetch is broken"
// actually true, rather than just true for outright extraction failures —
// a page can still have an <meta property="og:image"> tag pointing at a
// dead/expired URL, which this catches that a simple "did we find a tag"
// check wouldn't.
// ---------------------------------------------------------------------------
async function verifyImageUrl(url) {
  if (!url) return false;
  try {
    const head = await client.head(url, { timeout: 8000, validateStatus: () => true });
    if (head.status >= 400) return false; // confirmed broken (404/403/etc.) — no need to check further
    const ct = head.headers['content-type'] || '';
    if (head.status >= 200 && head.status < 300 && ct.startsWith('image/')) return true;
    // else: ambiguous (some CDNs omit/misreport content-type on HEAD, or
    // don't support HEAD at all) — fall through to a real GET check below.
  } catch (e) { /* HEAD unsupported or network hiccup — try GET below */ }
  try {
    const res = await client.get(url, { timeout: 8000, responseType: 'stream', validateStatus: () => true });
    const ok = res.status >= 200 && res.status < 300 && (res.headers['content-type'] || '').startsWith('image/');
    if (res.data && typeof res.data.destroy === 'function') res.data.destroy(); // don't actually download the body
    return ok;
  } catch (e) {
    return false;
  }
}

module.exports = { politeGet, sleep, client, verifyImageUrl };
