// ============================================================================
// HonkaRogue Naming System (js/game/naming.js)
// Deterministic honker names from head + type + stats
// ============================================================================

// --- Type-based name modifiers ---
// Each type maps to an array of suffix templates.
// Pick is deterministic based on hash of the head name.
const NAME_TYPE_SUFFIXES = {
  Normal:    [],
  Fire:      ['the Scorched', 'the Burning', 'of Embers', 'Ablaze'],
  Ice:       ['but Penguin', 'the Frozen', 'of Frost', 'on Ice'],
  Lightning: ['the Charged', 'of Thunder', 'Unchained', 'the Sparking'],
  Shadow:    ['of The Night', 'the Unseen', 'from Beyond', 'in Darkness'],
};

// --- Stat-based prefixes ---
// Applied when the highest stat is dominant (>=20% above runner-up).
// Keys match the stat names from deriveHonkerFromParts / enemy gen.
const NAME_STAT_PREFIXES = {
  spd:  ['Quick-footed', 'Swift', 'Fleet'],
  atk:  ['Brutal', 'Fierce', 'Savage'],
  def:  ['Ironclad', 'Stout', 'Armored'],
  luck: ['Lucky', 'Fortunate', 'Blessed'],
  hp:   ['Mighty', 'Hulking', 'Beefy'],
};

// How much the top stat must exceed the runner-up (as a ratio).
// 1.2 means the top stat must be at least 20% higher.
const STAT_DOMINANCE_RATIO = 1.2;

// --- Boss title suffixes (appended after type suffix for bosses) ---
const NAME_BOSS_TITLES = [
  'Supreme', 'the Conqueror', 'Eternal', 'the Undying',
  'Ascendant', 'Prime', 'Sovereign', 'Absolute',
];

// ============================================================================
// Core naming function
// ============================================================================

/**
 * Build a honker name from its parts, type, and stats.
 *
 * @param {object} opts
 * @param {string} opts.headName   - The head part's .name (e.g. "Kevin")
 * @param {string} opts.type       - Primary type (e.g. "Fire", "Shadow")
 * @param {object} opts.stats      - { hp, atk, def, spd, luck } (raw sums)
 * @param {boolean} [opts.isBoss]  - Boss enemies get an extra title
 * @returns {string}
 */
function generateHonkerName({ headName, type, stats, isBoss }) {
  const base = headName || 'Honker';
  const seed = hash32(base);

  // --- Type suffix ---
  const suffixes = NAME_TYPE_SUFFIXES[type] || [];
  const typeSuffix = suffixes.length
    ? suffixes[((seed >>> 0) % suffixes.length)]
    : '';

  // --- Stat prefix ---
  let statPrefix = '';
  if (stats) {
    const entries = Object.entries(stats).filter(([k]) => NAME_STAT_PREFIXES[k]);
    entries.sort((a, b) => b[1] - a[1]);
    if (entries.length >= 2) {
      const [topKey, topVal] = entries[0];
      const runnerUp = entries[1][1];
      if (runnerUp > 0 && topVal >= runnerUp * STAT_DOMINANCE_RATIO) {
        const pool = NAME_STAT_PREFIXES[topKey];
        statPrefix = pool[((seed >>> 4) % pool.length)];
      }
    }
  }

  // --- Boss title ---
  let bossTitle = '';
  if (isBoss) {
    bossTitle = NAME_BOSS_TITLES[((seed >>> 8) % NAME_BOSS_TITLES.length)];
  }

  // --- Assemble ---
  // Pattern: [StatPrefix] BaseName [TypeSuffix] [BossTitle]
  let name = base;
  if (statPrefix) name = statPrefix + ' ' + name;
  if (typeSuffix) name = name + ' ' + typeSuffix;
  if (bossTitle)  name = name + ' ' + bossTitle;

  return name;
}

console.log('[NAMING] Module loaded');
