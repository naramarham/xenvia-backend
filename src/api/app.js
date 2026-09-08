const express = require('express');
const cors = require('cors');
const config = require('../config');
const db = require('../db/db');
const { resolvePrice } = require('../lib/pricing');
const { runDailySync } = require('../pipeline/runSync');

function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // Simple request log — replace with a real logger (pino/morgan) in production.
  app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next(); });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString(), lastSync: db.lastSyncRun() || null });
  });

  // GET /api/devices?brand=Samsung&category=flagship&search=galaxy&yearMin=2021&sort=newest&page=1&pageSize=24
  app.get('/api/devices', (req, res) => {
    const { brand, category, search, sort, page, pageSize } = req.query;
    const yearMin = req.query.yearMin ? Number(req.query.yearMin) : undefined;
    const { rows, total } = db.listDevices({
      brand, category, search, yearMin, sort,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Math.min(Number(pageSize), 100) : 24,
    });
    res.json({
      total,
      devices: rows.map((d) => ({ ...d, resolvedPrice: d.variants[0] ? resolvePrice(d.variants[0].prices) : null })),
    });
  });

  app.get('/api/devices/:id', (req, res) => {
    const device = db.getDeviceById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json({
      ...device,
      variants: device.variants.map((v) => ({ ...v, resolvedPrice: resolvePrice(v.prices) })),
    });
  });

  app.get('/api/meta/brands', (req, res) => { res.json(db.listBrands()); });

  // Manual trigger — protect this behind auth before exposing publicly;
  // it's here mainly for local testing and ops convenience (curl it from
  // a deploy hook, etc.) rather than as a public endpoint.
  app.post('/api/sync/run', async (req, res) => {
    try {
      const stats = await runDailySync();
      res.json({ ok: true, stats });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal error' }); });

  return app;
}

module.exports = { createApp };
