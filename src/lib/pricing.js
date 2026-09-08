// Same priority rule as the frontend's pricingService: priceoye.pk wins
// outright when present; otherwise average whatever sources were found.
// Never returns null while at least one source has a price.
function resolvePrice(prices) {
  if (!prices || !prices.length) return null;
  const priceoye = prices.find((p) => p.source === 'priceoye');
  if (priceoye) return priceoye.price;
  const vals = prices.map((p) => p.price).filter((n) => Number.isFinite(n));
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

module.exports = { resolvePrice };
