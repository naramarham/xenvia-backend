const cron = require('node-cron');
const config = require('./config');
const { runDailySync } = require('./pipeline/runSync');

function startScheduler() {
  if (!cron.validate(config.syncCron)) {
    console.error(`[scheduler] Invalid SYNC_CRON "${config.syncCron}" — scheduler not started.`);
    return null;
  }
  console.log(`[scheduler] Daily sync scheduled: "${config.syncCron}"`);
  const task = cron.schedule(config.syncCron, () => {
    runDailySync().catch((e) => console.error('[scheduler] Scheduled sync failed:', e));
  });
  return task;
}

module.exports = { startScheduler };
