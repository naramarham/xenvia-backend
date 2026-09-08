// Ported verbatim from the frontend (Xenvia.jsx) so a device scraped here
// gets the exact same id it would get client-side — important if bundled
// sample data and live data ever need to merge without collisions.

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function deviceId(brand, model, modelNumberOrFallback) {
  return slugify(`${brand}-${model}-${modelNumberOrFallback}`);
}

function variantId(devId, ram, rom) {
  return `${devId}-${ram}gb-${rom}gb`;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

module.exports = { slugify, deviceId, variantId, hashString };
