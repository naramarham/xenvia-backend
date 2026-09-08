const { runDailySync } = require('../src/pipeline/runSync');

runDailySync()
  .then((stats) => { console.log('Sync finished:', stats); process.exit(0); })
  .catch((e) => { console.error('Sync failed:', e); process.exit(1); });
