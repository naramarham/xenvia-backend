# Deploying the Xenvia backend

Pick whichever of these fits — they're independent options, not steps in a
sequence. All of them end with the same result: a public URL serving
`/api/devices`, `/api/devices/:id`, `/api/meta/brands`, `/api/health`.

## 0. Test locally first (recommended before any real deploy)

```bash
docker compose up --build
curl http://localhost:4000/api/health
```

If that returns `{"ok":true,...}`, the container itself is healthy before
you hand it to a hosting platform. Ctrl+C to stop, `docker compose down` to
clean up.

## Option A — Railway (fastest path, minimal setup)

1. Push this project to a GitHub repo (private is fine).
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
   → pick the repo. Railway detects the `Dockerfile` automatically.
3. Add a **volume**: Settings → Volumes → mount path `/app/data` (this is
   what makes your SQLite data survive redeploys/restarts — without it,
   every deploy starts from an empty database).
4. Set environment variables under Variables: at minimum copy the values
   from `.env.example`. Set `CORS_ORIGIN` to your actual frontend's origin
   once you have one (keep `*` while you're just testing).
5. Railway assigns a public URL automatically (Settings → Networking →
   Generate Domain). That URL is your `API_BASE_URL` for the frontend.
6. First run: open the Railway shell (or SSH) and run `npm run init-db`
   once, or just let the app boot — `db.js` applies the schema
   automatically on startup either way.

## Option B — Render

1. Push to GitHub, same as above.
2. [render.com](https://render.com) → New → Web Service → connect the repo
   → Render detects the `Dockerfile`.
3. Add a **persistent disk**: mount path `/app/data`, at least 1GB.
4. Add the same environment variables as Option A.
5. Render gives you a `https://your-service.onrender.com` URL — that's your
   `API_BASE_URL`.
6. Note: Render's free tier spins the service down when idle, which means
   your 3AM cron job won't fire if the service is asleep at 3AM. If you're
   on the free tier, either upgrade to a plan that stays warm, or switch to
   the "external trigger" approach in the main README (a scheduled outside
   caller hitting `POST /api/sync/run`, e.g. a GitHub Actions cron workflow).

## Option C — Plain VPS (DigitalOcean/Linode/a spare server) with PM2

```bash
# on the server
git clone <your-repo-url> xenvia-backend
cd xenvia-backend
npm install
cp .env.example .env        # edit as needed
npm run init-db
npm install -g pm2
pm2 start src/server.js --name xenvia-backend
pm2 save
pm2 startup                 # follow the printed instructions so it survives reboots
```

Put nginx (or Caddy) in front of it for HTTPS + a real domain — that part
is standard reverse-proxy setup, not specific to this project.

## After it's live

```bash
curl https://<your-domain>/api/health
curl -X POST https://<your-domain>/api/sync/run   # trigger one sync manually to populate real data
curl https://<your-domain>/api/devices?pageSize=5
```

Then point the frontend at it — see `xenvia-app/src/lib/api.js` in the
Android-wrapper project: set `API_BASE_URL` there to this URL and flip
`DEVICE_SOURCE` to `'api'`.

**Protect `/api/sync/run` before this is public** — right now anyone who
finds the URL can trigger a scrape. Cheapest fix: put it behind a shared
secret header the cron caller sends, checked in `src/api/app.js`:

```js
app.post('/api/sync/run', async (req, res) => {
  if (req.headers['x-sync-token'] !== process.env.SYNC_TOKEN) return res.sendStatus(401);
  // ...existing code
});
```
