// ============================================================================
// HonkaRogue Game Module (js/game.js)
// Core game mechanics: battle system, stage generation, parts/dex system
// ============================================================================

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  HONKER CLASS
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
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
    const partHpBase = (this.assembledParts && typeof this.assembledParts === 'object')
      ? ['head', 'torso', 'wings', 'legs']
          .map(slot => Number(this.assembledParts?.[slot]?.stats?.hp || 0))
          .reduce((a, b) => a + b, 0)
      : 0;
    const hpBase = Math.max(1, partHpBase || Number(this.hp || 0));
    const hpWithBonus = hpBase + Number(this.maxHPBonus || 0);
    // Gen I/II style HP formula adapted with hpBase from parts, then mastery multiplier.
    this.maxHP = Math.max(1, Math.floor((((2 * hpWithBonus * this.level) / 100) + this.level + 10) * masteryMult));
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
    return avail.reduce((best,m)=>{
      const eff = getEff(m.type, enemy.type, enemy.type2);
      let score;
      if (m.effect) {
        const alreadyAffected = m.effectTarget === 'self'
          ? this.statusEffects[m.effect]
          : enemy.statusEffects[m.effect];
        score = alreadyAffected ? 5 : (m.effect==='shield'||m.effect==='pump') ? 45 : 50;
        if (m.effectTarget==='self' && this.hpPct < 0.4) score *= 1.5;
      } else {
        score = m.power * (m.acc/100) * eff * (0.7 + Math.random()*.6) * this.atkModifier;
      }
      const bestScore = best.effect
        ? 30
        : best.power * (best.acc/100) * getEff(best.type, enemy.type, enemy.type2) * this.atkModifier;
      return score > bestScore ? m : best;
    }, avail[0]);
  }
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  STAGE GENERATION
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

function getBiomeForStage(n) {
  const idx = Math.floor((n - 1) / 5) % BIOMES.length;
  return BIOMES[idx];
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
  const rng    = seededRng(n * 7919 + 31337);
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
  console.log(`Stage ${n} | RNG: ${rngRoll.toFixed(3)} | Threshold: ${(dexThreshold*100).toFixed(0)}% | UseDex: ${useDex} | ${useDex ? 'âœ¦ RARE' : 'PROCEDURAL'}`);
  const dex    = useDex ? chooseDexForStage(n, isBoss, rng, biome) : null;
  if (dex) console.log(`  â†’ Named Honker: ${dex.name}`);
  const dexBlueprint = dex ? buildDexPartBlueprint(dex) : null;
  const types  = ['Fire','Ice','Lightning','Shadow','Normal'];
  let type   = dex ? (dexBlueprint?.derived?.type || dex.type) : (pickBiomeType(biome, rng, isBoss) || types[Math.floor(rng() * (isBoss ? 4 : 5))]);
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
  const location = `${biome?.name || 'Honklands'} â€¢ ${arena}`;
  const loreRaw  = dex ? dex.lore : (biome?.lore?.[Math.floor(rng() * biome.lore.length)] || STAGE_LORE[Math.floor(rng() * STAGE_LORE.length)]);
  const lore     = dex ? `"${loreRaw}"` : `"${loreRaw.replace('{n}', n)}"`;

  const hpBase  = Math.round(100 + n * 19 + Math.pow(n, 1.35) * 1.8);
  const hpRaw   = isBoss ? Math.round(hpBase * 1.75) : hpBase;
  const hp      = Math.round(hpRaw * earlyHpScale);
  const luck    = Math.min(88, Math.round(25 + n * 2.2));
  const basePow = 26 + n * 3.2 + (isBoss ? 18 : 0);

  let moves;
  if (dexBlueprint?.derived?.moves?.length) {
    moves = dexBlueprint.derived.moves.map(m => ({ ...cloneJson(m), pp: m.maxPP || m.pp, maxPP: m.maxPP || m.pp }));
  } else {
    const pool    = MOVES_BY_TYPE[type] || MOVES_BY_TYPE.Normal;
    const nrmPool = MOVES_BY_TYPE.Normal;
    const usedIdx = new Set();
    const picked  = [];
    const pickFrom = (p, t) => {
      for (let tries = 0; tries < 20; tries++) {
        const idx = Math.floor(rng() * p.length);
        if (!usedIdx.has(`${t}-${idx}`)) { usedIdx.add(`${t}-${idx}`); return { ...p[idx], type: t }; }
      }
      return { ...p[0], type: t };
    };
    picked.push(pickFrom(pool, type));
    picked.push(pickFrom(pool, type));
    picked.push(pickFrom(pool, type));
    picked.push(isBoss ? pickFrom(pool, type) : pickFrom(nrmPool, 'Normal'));
    moves = picked.map(m => ({
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
  
  const enemyData = { name: enemyName, emoji, type, hp, luck, atk:genAtk, def:genDef, spd:genSpd,
                      moves, passive, dexId: dex?.id || null, assembledParts, level: enemyLevel };
  const hasNewParts = enemyHasUncaughtParts(enemyData);

  return { num: n, name: location, desc: lore, isBoss, difficulty, xpReward, hasNewParts,
    enemy: enemyData };
}

function stageThreat(n) { return Math.round(100 + n * 19 + Math.pow(n, 1.35) * 1.8); }
function playerPower(pb) {
  const hp = getHonkerMaxHP(pb);
  const atkBase = Math.round((pb.atk || 80) * levelStatScale(pb.level || 1, 'atk'));
  const atk = (pb.atkMult||1) * (atkBase + (pb.atkFlat||0));
  return Math.round(hp * 0.6 + atk * 2);
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  PARTS & DEX TRACKING
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

function ensurePartTrackingState() {
  if (!CAMPAIGN.partsSeen) CAMPAIGN.partsSeen = [];
  if (!CAMPAIGN.caughtParts) CAMPAIGN.caughtParts = [];
  // Backfill legacy saves: any caught part should always count as seen.
  if (CAMPAIGN.caughtParts.length) {
    const seenSet = new Set(CAMPAIGN.partsSeen);
    let changed = false;
    for (const id of CAMPAIGN.caughtParts) {
      if (!seenSet.has(id)) {
        seenSet.add(id);
        changed = true;
      }
    }
    if (changed) CAMPAIGN.partsSeen = [...seenSet];
  }
}

function getAllPartIds() {
  return (PARTS_DATA?.parts || []).map(p => p.id);
}

function isPartUnlocked(partId) {
  if (!partId) return false;
  ensurePartTrackingState();
  return CAMPAIGN.caughtParts.includes(partId);
}

function isPartSeen(partId) {
  if (!partId) return false;
  ensurePartTrackingState();
  return CAMPAIGN.partsSeen.includes(partId);
}

function isPartCaught(partId) {
  if (!partId) return false;
  ensurePartTrackingState();
  return CAMPAIGN.caughtParts.includes(partId);
}

function catchPartIds(honker, partsToAdd) {
  if (!honker) return 0;
  if (!Array.isArray(partsToAdd)) partsToAdd = [partsToAdd];
  ensurePartTrackingState();
  let unlocked = 0;
  partsToAdd.forEach(partId => {
    if (!partId) return;
    if (!CAMPAIGN.partsSeen.includes(partId)) {
      CAMPAIGN.partsSeen.push(partId);
    }
    if (!CAMPAIGN.caughtParts.includes(partId)) {
      CAMPAIGN.caughtParts.push(partId);
      unlocked++;
    }
  });
  return unlocked;
}

function enemyHasUncaughtParts(enemyData) {
  if (!enemyData?.assembledParts) return false;
  ensurePartTrackingState();
  const slots = ['head', 'torso', 'wings', 'legs'];
  return slots.some(slot => {
    const part = enemyData.assembledParts[slot];
    return part && !CAMPAIGN.caughtParts.includes(part.id);
  });
}

function grantCatchPartUnlocks(caught, rawEnemy) {
  if (!caught || !caught.assembledParts) return 0;
  const slots = ['head', 'torso', 'wings', 'legs'];
  const parts = slots.map(s => caught.assembledParts[s]).filter(Boolean);
  return catchPartIds(caught, parts.map(p => p.id));
}

function resetStarterCaughtParts() {
  ensurePartTrackingState();
  CAMPAIGN.caughtParts = (PARTS_DATA?.parts || [])
    .filter(p => p.family?.name && (STARTER_FAMILIES || []).includes(p.family.name))
    .map(p => p.id);
}

function resetStarterUnlockedParts() {
  resetStarterCaughtParts();
}

function unlockAllParts() {
  const allPartIds = getAllPartIds();
  ensurePartTrackingState();
  CAMPAIGN.caughtParts = [...allPartIds];
  CAMPAIGN.partsSeen = [...allPartIds];
}

console.log('[GAME] Module loaded');

