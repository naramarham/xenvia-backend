// Ported verbatim from the frontend so a device scraped here scores exactly
// the same way it would client-side. Number-aware (not a fixed name list)
// so new chips (Snapdragon 8 Elite Gen 2, Tensor G5, Dimensity 8350, ...)
// still land in the right tier instead of silently falling back to generic.
function scoreChipset(chipRaw) {
  const c = (chipRaw || '').toLowerCase();
  const num = (re) => { const m = c.match(re); return m ? parseFloat(m[1]) : null; };
  if (c.includes('red magic') || c.includes('redmagic')) return 95;
  if (c.includes('apple') || /\ba\d{2}\b/.test(c) || c.includes('bionic')) {
    const n = num(/a(\d{2})/);
    if (n == null) return 75;
    if (n >= 17) return 96; if (n === 16) return 85; if (n === 15) return 80; if (n === 14) return 76; return 70;
  }
  if (c.includes('snapdragon')) {
    if (c.includes('8 elite')) return 97;
    const gen = num(/gen\s*(\d)/) || 0;
    const series = num(/snapdragon\s*(\d)/);
    if (series === 8) { if (c.includes('8s')) return 90; if (gen >= 3) return 92; if (gen === 2) return 88; if (gen === 1) return 84; return 80; }
    if (c.includes('888')) return 84;
    if (series === 7) return gen >= 3 ? 78 : gen ? 74 : 68;
    if (series === 6) return 58;
    if (c.includes('480')) return 40;
    if (series === 4) return 36;
    return 50;
  }
  if (c.includes('dimensity')) {
    const n = num(/dimensity\s*(\d{3,4})/);
    if (n == null) return 55;
    if (n >= 9300) return 93; if (n >= 9000) return 88; if (n >= 8000) return 74; if (n >= 7000) return 60; if (n >= 6000) return 45; return 38;
  }
  if (c.includes('helio')) {
    const n = num(/g(\d{2,3})/);
    if (n == null) return 32; if (n >= 90) return 44; if (n >= 80) return 38; return 30;
  }
  if (c.includes('tensor')) {
    const n = num(/tensor g(\d)/);
    if (n == null) return 76; if (n >= 5) return 88; if (n === 4) return 86; if (n === 3) return 84; if (n === 2) return 80; return 76;
  }
  if (c.includes('exynos')) {
    const n = num(/exynos\s*(\d{3,4})/);
    if (n == null) return 55; if (n >= 2200) return 85; if (n >= 1300) return 58; return 45;
  }
  if (c.includes('kirin')) {
    const n = num(/kirin\s*(\d{3,4})/);
    if (n == null) return 45; if (n >= 9000) return 87; if (n >= 700) return 40; return 34;
  }
  if (c.includes('unisoc')) { const n = num(/t(\d{3})/); return n && n >= 600 ? 34 : 22; }
  return 50;
}

function computeGamingScore({ chip, ramOpts, refresh, batt, cat }) {
  const chipScore = scoreChipset(chip);
  const topRam = Math.max(...(ramOpts && ramOpts.length ? ramOpts : [0]));
  const ramScore = Math.min(topRam, 16) / 16 * 100;
  let bonus = 0;
  if (refresh >= 120) bonus += 6; else if (refresh >= 90) bonus += 3;
  if (batt >= 5000) bonus += 4; else if (batt >= 4500) bonus += 2;
  if (cat === 'gaming') bonus += 6;
  const raw = chipScore * 0.6 + ramScore * 0.18 + bonus;
  const score = Math.max(5, Math.min(100, Math.round(raw)));
  let label;
  if (score >= 85) label = 'Excellent';
  else if (score >= 70) label = 'Great';
  else if (score >= 50) label = 'Good';
  else if (score >= 32) label = 'Moderate';
  else label = 'Challenging';
  return { score, label };
}

module.exports = { scoreChipset, computeGamingScore };
