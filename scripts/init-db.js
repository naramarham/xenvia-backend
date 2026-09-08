// Just importing db.js is enough — it runs the schema migration on load.
// This script exists so "npm run init-db" has an obvious, explicit entrypoint.
require('../src/db/db');
console.log('Database initialized (schema applied).');
