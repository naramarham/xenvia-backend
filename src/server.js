const config = require('./config');
const { createApp } = require('./api/app');
const { startScheduler } = require('./scheduler');
const { runDailySync } = require('./pipeline/runSync');

const app = createApp();

app.listen(config.port, () => {
  console.log(`[server] Xenvia backend listening on :${config.port}`);
  startScheduler();
  if (config.syncOnBoot) {
    console.log('[server] SYNC_ON_BOOT=true — running an initial sync now...');
    runDailySync().catch((e) => console.error('[server] Boot sync failed:', e));
  }
});
