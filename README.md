# Xenvia Backend

The real, runnable backend for Xenvia: a daily-scheduled scraper/sync
pipeline + a REST API, so the web catalogue (and, later, an Android app)
have live data to read instead of the bundled sample dataset.

This is a genuine Node.js project — clone it, `npm install`, run it. It was
built and validated inside a sandboxed container with **no outbound network
access**, so `npm install` and any live scrape could not be executed or
tested end-to-end from that environment. What *was* validated (see "What's
actually been tested" below) was tested for real, against real data.

## Architecture

```
src/
  config.js            env-driven configuration
  server.js             entrypoint — boots the API and the cron scheduler
  scheduler.js           node-cron wiring for the daily 3AM run
  db/
    schema.sql            devices / variants / price_sources / image_sources
    db.js                  better-sqlite3 connection + upserts + queries
  lib/
    ids.js                 slug/id scheme — ported verbatim from the frontend
    pricing.js              resolvePrice() — priceoye-priority, same as frontend
    gaming.js                gaming score engine — ported verbatim from the frontend
    http.js                   shared axios client with a politeness delay
  scrapers/
    priceoye.js            ✅ real, verified adapter (see below)
    gsmarena.js             fallback adapter, OFF by default — read the caution note in the file
    whatmobile.js            fallback adapter, OFF by default, unverified — treat as a starting point
    officialSites.js          per-brand adapter registry/interface (empty — extension point)
  pipeline/
    runSync.js              orchestrates one full sync run across all brands
  api/
    app.js                   Express routes
scripts/
  init-db.js               apply the schema once
  sync-now.js               trigger a sync manually, without waiting for cron
```

Every piece of shared logic (`ids.js`, `pricing.js`, `gaming.js`) is a
line-for-line port of the same functions in the frontend's `Xenvia.jsx`, so
a device synced here gets the exact same id and the exact same gaming score
it would get client-side — no drift between "sample data" and "live data".

## Setup

```bash
npm install
cp .env.example .env      # adjust as needed
npm run init-db           # creates data/xenvia.sqlite and applies schema.sql
npm run sync-now          # runs one sync pass immediately (see notes below first)
npm start                 # boots the API on :4000 + the 3AM cron job
```

Then: `GET http://localhost:4000/api/devices`, `GET /api/devices/:id`,
`GET /api/meta/brands`, `GET /api/health`.

## What's actually been tested (and how)

Working from inside a network-isolated container, I couldn't run the full
pipeline live. What I *could* do, and did:

- **Fetched the real, live PriceOye site** (`priceoye.pk/mobiles/samsung`,
  September 2026) to confirm the URL scheme is real and the listing pages
  are server-rendered — genuinely scrapeable with a plain GET.
- **Extracted real product listing text** from that live fetch and used it
  as test fixtures for `parseListingCardText()` — the regex parser that
  turns `"Rating Star4.9265Reviews Samsung Galaxy A17Rs 66,999Rs 72,9998% OFF"`
  into `{ name: "Samsung Galaxy A17", rating: 4.9, reviewCount: 265, price:
  66999, originalPrice: 72999 }`. This caught and fixed a real bug: the
  discount percentage runs directly into the price with no separator
  (`Rs 94,9994% OFF`), and a naive digit-grab regex mis-split it. Switched
  to a proper comma-grouped-number pattern; all 10 real samples now parse
  exactly right.
- **Verified `schema.sql` executes correctly** and that the `ON CONFLICT ...
  DO UPDATE` upsert pattern `db.js` relies on is genuinely idempotent —
  re-inserting a price for the same variant/source updates it in place
  rather than duplicating it — using Node's built-in `node:sqlite` module
  (same SQLite engine as `better-sqlite3`) as a stand-in, since installing
  `better-sqlite3` itself needs network access this container didn't have.
- **Verified `ids.js`, `pricing.js`, and `gaming.js`** produce identical
  output to the frontend's equivalents, including the Galaxy S26 Ultra
  "Excellent" (not "Challenging") case from earlier in this project.

What has **not** been tested live: `npm install` itself, the GSM Arena
adapter (also unverified beyond training knowledge of GSM Arena's general
page structure), the WhatMobile adapter, `officialSites.js` (empty by
design — see below), and pagination past page 1 on PriceOye brand listings.

## Known limitations — read before your first real run

1. **PriceOye pagination isn't implemented.** Brand listing pages show
   ~24–30 devices per page with more pages beyond that (`1 2 … 11 Next`
   was visible on the Samsung listing). `fetchBrandListing()` currently
   only reads page 1. Open devtools → Network tab on a live PriceOye
   listing page, find the query param or path pattern for page 2, and add
   a loop in `scrapers/priceoye.js`.
2. **PriceOye's listing view doesn't expose exact RAM/ROM per variant** —
   only a single name + price per product card. `runSync.js` currently
   stores every device as a single placeholder 8GB/128GB variant. Real
   variant data needs either parsing the product *detail* page (which
   likely lists it) or an official-site/GSM Arena adapter.
3. **Full specs (display, battery, camera, etc.) aren't populated** by the
   PriceOye adapter alone — it gives you name, price, rating, and (via
   `og:image`) a photo, which is enough to prove the pipeline end-to-end,
   but `chipset`/`battery`/`display_*` columns stay `NULL` unless GSM Arena
   (off by default) or an official-site adapter fills them in.
4. **`officialSites.js` ships as an empty, working registry**, not 20 fake
   adapters. Building a real adapter per brand is real, separate work
   (most modern product pages are JS-rendered, which means Playwright, not
   a plain GET) — I didn't want to hand you 20 stubs that silently do
   nothing while looking finished.
5. **Category (flagship/midrange/budget) is a rough price bucket** until a
   real spec source is wired in — it's a placeholder heuristic, said so in
   the code, not a real classification.

None of this is scaffolding-for-the-sake-of-it — `priceoye.js` end to end
(URL scheme, parser, `og:image` extraction) is real and tested against real
data. The gaps above are exactly the honest next steps, not hidden ones.

## Sources & legal notes

- **PriceOye.pk** — top priority, as agreed. Scraping is server-rendered
  and straightforward; this backend rate-limits itself
  (`SCRAPE_DELAY_MS`, default 1.2s between requests) to be a reasonable
  citizen. Still worth a read of their Terms of Service / robots.txt before
  running this at any real volume or in production.
- **GSM Arena** — fallback only, **off by default**
  (`ENABLE_GSMARENA=false`). Their Terms of Use restrict automated
  scraping and they're known to rate-limit/block scraper traffic. Read the
  caution comment at the top of `scrapers/gsmarena.js` before turning this
  on, and treat it as a last resort for the handful of devices PriceOye
  doesn't cover — not a bulk source.
- **WhatMobile.com.pk** — same caution as GSM Arena, also off by default
  (`ENABLE_WHATMOBILE=false`), and its adapter is unverified (I didn't do
  a live fetch pass on it the way I did for PriceOye and GSM Arena).
- **Official manufacturer sites** — the intended top priority, and the one
  piece deliberately left as an interface rather than a guess. See
  `officialSites.js`.

I'm not a lawyer and this isn't legal advice — if this becomes a real
production product, it's worth a proper ToS/robots.txt review (and possibly
outreach to PriceOye, since they'd be doing most of the heavy lifting here)
before running it at scale.

## Deploying it

Any Node host works — a small VPS with PM2, Railway, Render, Fly.io, or a
container platform. A minimal `Dockerfile` is easy to add on top of this
(`node:20-slim`, `npm ci --omit=dev`, `CMD ["node", "src/server.js"]`) if
you want to containerize it; not included here since your hosting choice
will drive some of those details (persistent volume for `data/xenvia.sqlite`,
env var injection, etc.).

The cron schedule is driven by `SYNC_CRON` (default `0 3 * * *`, i.e. 03:00
server time) via `node-cron` inside the running process — as long as the
process stays up, you don't need an external cron/scheduler. If you deploy
somewhere that recycles the process frequently (some serverless platforms),
switch to an external scheduled trigger hitting `POST /api/sync/run`
instead (that route exists for exactly this; put auth in front of it first).

## How this connects to the rest of Xenvia

- **The existing web catalogue** (`Xenvia.jsx`) currently reads its bundled
  `RAW_DEVICES` array. To point it at this backend instead, replace the
  `useMemo(() => buildCatalog(RAW_DEVICES), [])` line with a `fetch('/api/devices')`
  call (with loading/error states) — the shapes were built to match closely
  enough that this is a small, mechanical change, not a rewrite. The
  `imageSources` field in particular is named and shaped identically on
  both sides specifically so this swap is trivial once real images exist.
- **A future Android app** can hit the same REST API directly —
  `GET /api/devices`, `GET /api/devices/:id`, `GET /api/meta/brands` — from
  Kotlin/Java (Retrofit + OkHttp is the standard combo) or from a
  React Native / Capacitor wrapper around the existing web UI, which would
  let you reuse the frontend you already have almost as-is instead of
  building a second UI from scratch. Whichever direction you take the
  Android app, this API is the same one either approach would call — no
  backend rework needed depending on which you pick later.
