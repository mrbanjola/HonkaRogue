// ============================================================================
// HonkaRogue Game Module (js/game.js)
// Core game mechanics: battle system, stage generation, parts/dex system
// ============================================================================

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  HONKER CLASS
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

function getHonkerMaxHP(h) {
  if (!h) return 0;
  const lv = Math.max(1, h.level || 1);
  const partHpBase = (h.assembledParts && typeof h.assembledParts === 'object')
    ? ['head', 'torso', 'wings', 'legs']
        .map(slot => Number(h.assembledParts?.[slot]?.stats?.hp || 0))
        .reduce((a, b) => a + b, 0)
    : 0;
  const hpStatBase = Number(h.hp || 0);
  const hpBase = Math.max(1, hpStatBase > 0 ? hpStatBase : partHpBase);
  const hpWithBonus = hpBase + Number(h.maxHPBonus || 0);
  const masteryMult = masteryStatMultiplier(h.masteryLevel || 0);
  return Math.max(1, Math.floor((((2 * hpWithBonus * lv) / 100) + lv + 10) * masteryMult));
}

class Honker {
  constructor(data, side, campBoosts={}) {
    Object.assign(this, JSON.parse(JSON.stringify(data)));
    this.side = side;
    this.maxHPBonus = campBoosts.maxHPBonus||0;
    this.atkFlat    = campBoosts.atkFlat||0;
    this.atkMult    = campBoosts.atkMult||1;
    this.luckBonus  = campBoosts.luckBonus||0;
    this.stabBonus  = campBoosts.stabBonus||1.25;
    this.chaosMod   = campBoosts.chaosMod||1;
    this.ppBonus    = campBoosts.ppBonus||0;
    this.level      = campBoosts.level ?? this.level ?? 1;
    this.movePP     = campBoosts.movePP||null;
    this.persistentEffects = campBoosts.persistentEffects || null;
    this.masteryLevel = Math.max(0, Number(this.masteryLevel) || 0);
    this.statusEffects = {};
    this.moves.forEach(m=>{
      m.maxPP += this.ppBonus;
      const saved = this.movePP ? (this.movePP[m.id] ?? this.movePP[m.name]) : null;
      m.pp = saved == null ? m.maxPP : Math.max(0, Math.min(m.maxPP, saved));
    });
    const masteryMult = masteryStatMultiplier(this.masteryLevel);
    this.maxHP = getHonkerMaxHP(this);
    this.currentHP = Math.max(0, Math.min(this.maxHP, campBoosts.currentHP ?? this.maxHP));
    if (this.persistentEffects) {
      STACKABLE_EFFECTS.forEach(k => {
        const v = this.persistentEffects[k] || 0;
        if (v > 0) this.statusEffects[k] = Math.max(1, Math.min(4, v));
      });
    }
    this.atk = Math.max(1, Math.round((this.atk || 80) * levelStatScale(this.level, 'atk') * masteryMult));
    this.def = Math.max(1, Math.round((this.def || 80) * levelStatScale(this.level, 'def') * masteryMult));
    this.spd = Math.max(1, Math.round((this.spd || 80) * levelStatScale(this.level, 'spd') * masteryMult));
  }
  get hpPct() { return Math.max(0, this.currentHP/this.maxHP); }
  isDead() { return this.currentHP<=0; }
  get effectiveLuck() {
    const baseLuck = (this.luck||50)+(this.luckBonus||0);
    return Math.min(95, Math.round(baseLuck * masteryStatMultiplier(this.masteryLevel)));
  }
  get atkModifier() {
    let m = 1;
    if (this.statusEffects.cursed)  m *= Math.max(0.25, 1 - (0.15 * this.statusEffects.cursed));
    if (this.statusEffects.pumped)  m *= (1 + (0.25 * this.statusEffects.pumped));
    if (this.passive?.id === 'underdog' && this.hpPct < 0.5) m *= 1.3;
    return m;
  }
  get defModifier() {
    let m = 1;
    if (this.statusEffects.shielded) m *= (1 / (1 + (0.25 * this.statusEffects.shielded)));
    if (this.passive?.id === 'thick_skin') m *= 0.8;
    return m;
  }
  get accModifier() {
    let m = 1;
    if (this.statusEffects.paralyzed) m *= Math.max(0.3, 1 - (0.12 * this.statusEffects.paralyzed));
    return m;
  }
  aiPickMove(enemy) {
    const avail = this.moves.filter(m=>m.pp>0 && !(m.lowHPOnly && this.hpPct >= 0.5));
    if (!avail.length) return this.moves[0];
    const self = this;
    const scoreMove = (m) => {
      if (m.effect) {
        const alreadyAffected = m.effectTarget === 'self'
          ? self.statusEffects[m.effect]
          : enemy.statusEffects[m.effect];
        let s = alreadyAffected ? 5 : (m.effect==='shield'||m.effect==='pump') ? 45 : 50;
        if (m.effectTarget==='self' && self.hpPct < 0.4) s *= 1.5;
        return s;
      }
      return m.power * (m.acc/100) * getEff(m.type, enemy.type, enemy.type2) * (0.7 + (BS.rng?.() ?? Math.random())*.6) * self.atkModifier;
    };
    let best = avail[0];
    let bestScore = scoreMove(best);
    for (let i = 1; i < avail.length; i++) {
      const s = scoreMove(avail[i]);
      if (s > bestScore) { best = avail[i]; bestScore = s; }
    }
    return best;
  }
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  STAGE GENERATION
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

function getBiomeForStage(n) {
  const blockIdx = Math.floor((n - 1) / 5);
  const runSeed = Number.isFinite(Number(CAMPAIGN?.runSeed)) ? (Number(CAMPAIGN.runSeed) >>> 0) : 0;
  const biomeCount = BIOMES.length;
  if (!biomeCount) return null;
  let prevPick = -1;
  let pick = 0;
  for (let i = 0; i <= blockIdx; i++) {
    const blockSeed = (((i + 1) * 104729) ^ runSeed ^ 0x9e3779b9) >>> 0;
    const rng = seededRng(blockSeed);
    pick = Math.floor(rng() * biomeCount);
    if (biomeCount > 1 && pick === prevPick) {
      const jump = 1 + Math.floor(rng() * (biomeCount - 1));
      pick = (pick + jump) % biomeCount;
    }
    prevPick = pick;
  }
  return BIOMES[pick];
}

function buildDexPartBlueprint(dex) {
  if (!dex) return null;

  // Use centralized dex-part presets from data.js when available.
  if (typeof getDexAssembledParts === 'function') {
    const assembledParts = getDexAssembledParts(dex);
    if (!assembledParts) return null;
    const derived = deriveHonkerFromParts(assembledParts);
    return { assembledParts, derived };
  }

  // Legacy fallback for explicit embedded dex parts.
  if (dex.assembledParts && dex.assembledParts.head) {
    const parts = dex.assembledParts;
    const derived = deriveHonkerFromParts(parts);
    return { assembledParts: parts, derived };
  }

  return null;
}

function masteryStatMultiplier(level) {
  const lv = Math.max(0, Number(level) || 0);
  // +5% additive per mastery level to all stats.
  return 1 + (lv * 0.05);
}
function masteryAttackMultiplier(level) {
  // Backward-compatible alias for older callers.
  return masteryStatMultiplier(level);
}
function pickWeightedIndex2(weights, rng) {
  const total = (weights || []).reduce((a, b) => a + Math.max(0, b || 0), 0);
  if (!total) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i] || 0);
    if (r <= 0) return i;
  }
  return Math.max(0, weights.length - 1);
}

function pickBiomeType(biome, rng, isBoss) {
  const base = biome?.types?.length ? biome.types : ['Normal'];
  const pool = isBoss ? base : [...base, 'Normal'];
  return pool[Math.floor(rng() * pool.length)] || 'Normal';
}
function inferEnemyTypesFromParts(parts, fallbackType = 'Normal') {
  if (!parts) return { type: fallbackType, type2: null };
  const torsoType = typeof partTypeFromData === 'function' ? partTypeFromData(parts.torso) : null;
  const headType = typeof partTypeFromData === 'function' ? partTypeFromData(parts.head) : null;
  const type = torsoType || headType || fallbackType || 'Normal';
  const type2 = headType && headType !== type ? headType : null;
  return { type, type2 };
}
function collectPartMoves(parts) {
  if (!parts) return [];
  const ids = [];
  for (const slot of ['head', 'torso', 'wings', 'legs']) {
    const part = parts[slot];
    if (!part?.moveIds?.length) continue;
    ids.push(...part.moveIds);
  }
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const mv = materializeMoveFromId(id);
    if (mv) out.push(mv);
  }
  return out;
}

function chooseDexForStage(n, isBoss, rng, biome) {
  const all = (HONKER_DEX || []).filter(d => !!d.isBoss === !!isBoss);
  if (!all.length) return null;
  const maxDex = Math.min(HONKER_DEX.length, Math.max(isBoss ? 5 : 6, Math.floor(6 + n * 1.15)));
  const minDex = Math.max(1, maxDex - (isBoss ? 14 : 12));
  let pool = all.filter(d => d.dexNum >= minDex && d.dexNum <= maxDex);
  if (!pool.length) pool = all.slice();
  const weights = pool.map(d => {
    let w = 1;
    if ((biome?.types || []).includes(d.type)) w *= 2.6;
    const dist = Math.abs(d.dexNum - maxDex);
    w *= Math.max(0.55, 1.2 - dist * 0.05);
    return w;
  });
  return pool[pickWeightedIndex2(weights, rng)] || pool[0];
}
function xpRewardForEnemyLevel(level, isBoss) {
  const lv = Math.max(1, Number(level) || 1);
  const base = 45;
  const growth = 1.18;
  let xp = Math.round(base * Math.pow(growth, lv - 1));
  if (isBoss) xp = Math.round(xp * 1.6);
  return Math.max(25, xp);
}

function generateStage(n) {
  const runSeed = Number.isFinite(Number(CAMPAIGN?.runSeed)) ? (Number(CAMPAIGN.runSeed) >>> 0) : 0;
  const stageSeed = ((n * 7919 + 31337) ^ runSeed) >>> 0;
  const rng    = seededRng(stageSeed);
  const biome = getBiomeForStage(n);
  const isBoss = (n % 5 === 0);
  rng(); rng();
  const rngRoll = rng();
  let dexThreshold;
  if (n <= 20) {
    dexThreshold = isBoss ? 0.05 : 0.02;
  } else if (n <= 50) {
    dexThreshold = isBoss ? 0.12 : 0.08;
  } else {
    dexThreshold = isBoss ? 0.20 : 0.15;
  }
  const useDex = rngRoll < dexThreshold;
  console.log(`Stage ${n} | RNG: ${rngRoll.toFixed(3)} | Threshold: ${(dexThreshold*100).toFixed(0)}% | UseDex: ${useDex} | ${useDex ? '✦ RARE' : 'PROCEDURAL'}`);
  const dex    = useDex ? chooseDexForStage(n, isBoss, rng, biome) : null;
  if (dex) console.log(`  → Named Honker: ${dex.name}`);
  const dexBlueprint = dex ? buildDexPartBlueprint(dex) : null;
  const biomeFallbackType = pickBiomeType(biome, rng, isBoss) || 'Normal';
  const earlyRamp = Math.min(1, n / 16);
  const earlyHpScale = n <= 15 ? (0.84 + earlyRamp * 0.16) : 1;
  const earlyPowScale = n <= 15 ? (0.72 + earlyRamp * 0.28) : 1;
  const earlyStatScale = n <= 15 ? (0.88 + earlyRamp * 0.12) : 1;

  let enemyName;
  if (dex) {
    enemyName = dex.name;
  } else if (isBoss) {
    const p = E_PREFIXES[Math.floor(rng() * E_PREFIXES.length)];
    const b = E_BODIES[Math.floor(rng() * E_BODIES.length)];
    const s = E_BOSS_SUFFIXES[Math.floor(rng() * E_BOSS_SUFFIXES.length)];
    enemyName = `${p} ${b} ${s}`;
  } else {
    const p = E_PREFIXES[Math.floor(rng() * E_PREFIXES.length)];
    const b = E_BODIES[Math.floor(rng() * E_BODIES.length)];
    enemyName = `${p} ${b}`;
  }

  const arena = biome?.arenas?.[Math.floor(rng() * biome.arenas.length)] || STAGE_LOCATIONS[(n - 1) % STAGE_LOCATIONS.length];
  const location = `${biome?.name || 'Honklands'} • ${arena}`;
  const loreRaw  = dex ? dex.lore : (biome?.lore?.[Math.floor(rng() * biome.lore.length)] || STAGE_LORE[Math.floor(rng() * STAGE_LORE.length)]);
  const lore     = dex ? `"${loreRaw}"` : `"${loreRaw.replace('{n}', n)}"`;

  const hpBase  = Math.round(100 + n * 19 + Math.pow(n, 1.35) * 1.8);
  const hpRaw   = isBoss ? Math.round(hpBase * 1.75) : hpBase;
  const hp      = Math.round(hpRaw * earlyHpScale);
  const luck    = Math.min(88, Math.round(25 + n * 2.2));
  const basePow = 26 + n * 3.2 + (isBoss ? 18 : 0);

  let assembledParts = dexBlueprint?.assembledParts || null;
  if (!dex && PARTS_DATA && PARTS_DATA.parts) {
    const pickByRarityWeights = (pool) => {
      if (!pool.length) return null;
      const common = pool.filter(p => (p.rarity || 'common') === 'common');
      const rare = pool.filter(p => p.rarity === 'rare');
      const legendary = pool.filter(p => p.rarity === 'legendary');
      const r = rng();
      let bucket = null;
      if (r < 0.75) bucket = common.length ? common : (rare.length ? rare : legendary);
      else if (r < 0.95) bucket = rare.length ? rare : (common.length ? common : legendary);
      else bucket = legendary.length ? legendary : (rare.length ? rare : common);
      if (!bucket || !bucket.length) bucket = pool;
      return bucket[Math.floor(rng() * bucket.length)] || pool[0] || null;
    };
    const pickPart = slot => {
      const famSet = new Set(biome?.families || []);
      let pool = PARTS_DATA.parts.filter(p => p.slot === slot && famSet.has(p.family?.name));
      if (!pool.length) pool = PARTS_DATA.parts.filter(p => p.slot === slot);
      return pickByRarityWeights(pool);
    };
    assembledParts = {
      head:  pickPart('head'),
      torso: pickPart('torso'),
      wings: pickPart('wings'),
      legs:  pickPart('legs'),
    };
  }

  let type = 'Normal';
  let type2 = null;
  if (dex) {
    type = dexBlueprint?.derived?.type || dex.type || 'Normal';
    type2 = dexBlueprint?.derived?.type2 || dex.type2 || null;
  } else {
    const inferred = inferEnemyTypesFromParts(assembledParts, biomeFallbackType);
    type = inferred.type;
    type2 = inferred.type2;
  }

  let moves;
  if (dexBlueprint?.derived?.moves?.length) {
    moves = dexBlueprint.derived.moves.map(m => ({ ...cloneJson(m), pp: m.maxPP || m.pp, maxPP: m.maxPP || m.pp }));
  } else {
    const poolFromParts = collectPartMoves(assembledParts);
    const nrmPool = MOVES_BY_TYPE.Normal || [];
    const fallbackPool = [...(MOVES_BY_TYPE[type] || nrmPool), ...(type2 ? (MOVES_BY_TYPE[type2] || []) : []), ...nrmPool]
      .filter(Boolean);
    const sourcePool = poolFromParts.length ? poolFromParts : fallbackPool;
    const picked = [];
    const seen = new Set();
    while (picked.length < 4 && seen.size < sourcePool.length) {
      const idx = Math.floor(rng() * sourcePool.length);
      if (seen.has(idx)) continue;
      seen.add(idx);
      picked.push(sourcePool[idx]);
    }
    while (picked.length < 4 && fallbackPool.length) {
      const idx = Math.floor(rng() * fallbackPool.length);
      picked.push(fallbackPool[idx]);
    }
    moves = picked.slice(0, 4).map(m => ({
      id: m.id,
      name: m.name, type: m.type, emoji: m.emoji, desc: m.desc,
      power: Math.max(20, Math.round((m.basePower || 55) * (basePow / 55) * earlyPowScale)),
      acc: m.acc, pp: m.pp, maxPP: m.pp,
      ...(m.effect ? { effect: m.effect, effectTarget: m.effectTarget,
        effectChance: m.effectChance, effectDur: m.effectDur } : {}),
      ...(m.drain ? { drain: m.drain } : {}),
      ...(m.recoil ? { recoil: m.recoil } : {}),
      ...(m.priority ? { priority: true } : {}),
      ...(m.lowHPOnly ? { lowHPOnly: true } : {}),
    }));
  }

  const rawAtk = dex ? (dex.atk||80) : Math.min(130, Math.round(60 + n * 1.8 + (isBoss ? 18 : 0) + (rng()-0.5)*20));
  const rawDef = dex ? (dex.def||80) : Math.min(130, Math.round(60 + n * 1.4 + (isBoss ? 15 : 0) + (rng()-0.5)*20));
  const rawSpd = dex ? (dex.spd||80) : Math.min(130, Math.round(60 + n * 1.2 + (rng()-0.5)*25));
  const genAtk = Math.max(30, Math.round(rawAtk * earlyStatScale));
  const genDef = Math.max(30, Math.round(rawDef * earlyStatScale));
  const genSpd = Math.max(30, Math.round(rawSpd * earlyStatScale));
  const emojiPool  = dex ? null : (isBoss ? BOSS_EMOJIS : (ENEMY_EMOJIS[type] || ENEMY_EMOJIS.Normal));
  const emoji      = dex ? dex.emoji : emojiPool[Math.floor(rng() * emojiPool.length)];
  const passive    = dex ? (dex.passive || dexBlueprint?.derived?.passive || null) : null;
  const enemyLevel = Math.max(1, Math.round(n * 0.18) + (isBoss ? 1 : 0) - (n <= 15 ? 1 : 0));
  const difficulty = isBoss ? 5 : Math.min(4, Math.ceil(n / 4));
  const xpReward   = xpRewardForEnemyLevel(enemyLevel, isBoss);
  
  const enemyData = { name: enemyName, emoji, type, type2, hp, luck, atk:genAtk, def:genDef, spd:genSpd,
                      moves, passive, dexId: dex?.id || null, assembledParts, level: enemyLevel };
  const hasNewParts = enemyHasUncaughtParts(enemyData);

  return { num: n, name: location, desc: lore, isBoss, difficulty, xpReward, hasNewParts,
    biomeId: biome?.id || 'unknown',
    biomeVisual: biome?.visual || null,
    enemy: enemyData };
}

function stageThreat(n) { return Math.round(100 + n * 19 + Math.pow(n, 1.35) * 1.8); }
function playerPower(pb) {
  const hp = getHonkerMaxHP(pb);
  const atkBase = Math.round((pb.atk || 80) * levelStatScale(pb.level || 1, 'atk'));
  const atk = (pb.atkMult||1) * (atkBase + (pb.atkFlat||0));
  return Math.round(hp * 0.6 + atk * 2);
}

console.log('[GAME] Module loaded');
