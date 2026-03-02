// ============================================================================
// HonkaRogue Utilities Module (js/utils.js)
// Math, RNG, and general helper functions
// ============================================================================

// Deterministic seeded RNG - same seed yields same sequence
function seededRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => { 
    s = Math.imul(s ^ (s >>> 15), s | 1); 
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61); 
    return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff; 
  };
}

// FNV-1a 32-bit hash function
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Convert hash to [0, 1) value
function seeded01(key) { 
  return (hash32(String(key)) % 1000000) / 1000000; 
}

// Convert string to slug (for move IDs, etc)
function slugMoveName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Deep JSON clone
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// Weighted index selection from probability array
function pickWeightedIndex(weights, rng) {
  const total = (weights || []).reduce((a, b) => a + Math.max(0, b || 0), 0);
  if (!total) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i] || 0);
    if (r <= 0) return i;
  }
  return Math.max(0, weights.length - 1);
}

// Stat scaling by level
function levelStatScale(level, key) {
  const lv = Math.max(1, Number(level) || 1);
  const g = LEVEL_GROWTH[key] || 0;
  return 1 + g * (lv - 1);
}

// Get type effectiveness
function getEff(a, d1, d2 = null) {
  if (typeOverride) return 1;
  const e1 = (TYPE_EFF[a]?.[d1]) ?? 1;
  const e2 = d2 ? ((TYPE_EFF[a]?.[d2]) ?? 1) : 1;
  return e1 * e2;
}

// Rarity weighting for selection
function rarityWeight(rarity) {
  if (rarity === 'legendary') return 2;
  if (rarity === 'rare') return 1;
  return 0;
}

// Distance between rarity tiers
function tierDistance(a, b) {
  const r = { common: 0, rare: 1, legendary: 2 };
  return Math.abs((r[a] ?? 0) - (r[b] ?? 0));
}

// Safe DOM logging
function log(msg, el = null) {
  console.log(msg);
  if (el && typeof el === 'string') {
    const elem = document.getElementById(el);
    if (elem) elem.innerHTML += `<div>${msg}</div>`;
  } else if (el?.appendChild) {
    const div = document.createElement('div');
    div.textContent = msg;
    el.appendChild(div);
  }
}

console.log('[UTILS] Module loaded: seededRng, hash32, cloneJson, pickWeightedIndex');
