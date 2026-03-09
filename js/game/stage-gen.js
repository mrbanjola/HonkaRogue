// ============================================================================
// HonkaRogue Stage Generation (js/game/stage-gen.js)
// Stage generation, biome selection, enemy generation, threat/power
// ============================================================================

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
  if (typeof getDexAssembledParts === 'function') {
    const assembledParts = getDexAssembledParts(dex);
    if (!assembledParts) return null;
    const derived = deriveHonkerFromParts(assembledParts);
    return { assembledParts, derived };
  }
  if (dex.assembledParts && dex.assembledParts.head) {
    const parts = dex.assembledParts;
    const derived = deriveHonkerFromParts(parts);
    return { assembledParts: parts, derived };
  }
  return null;
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
  return pool[pickWeightedIndex(weights, rng)] || pool[0];
}
function xpRewardForEnemyLevel(level, isBoss) {
  const lv = Math.max(1, Number(level) || 1);
  const base = 45;
  const growth = 1.18;
  let xp = Math.round(base * Math.pow(growth, lv - 1));
  if (isBoss) xp = Math.round(xp * 1.6);
  return Math.max(25, xp);
}

// Sum base stats from assembled parts (same logic as player assembly)
function sumPartStats(parts) {
  const s = { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 };
  if (!parts) return s;
  ['head', 'torso', 'wings', 'legs'].forEach(slot => {
    const p = parts[slot];
    if (p?.stats) {
      s.hp   += p.stats.hp   || 0;
      s.atk  += p.stats.atk  || 0;
      s.def  += p.stats.def  || 0;
      s.spd  += p.stats.spd  || 0;
      s.luck += p.stats.luck || 0;
    }
  });
  return s;
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
  console.log(`Stage ${n} | RNG: ${rngRoll.toFixed(3)} | Threshold: ${(dexThreshold*100).toFixed(0)}% | UseDex: ${useDex} | ${useDex ? '\u2726 RARE' : 'PROCEDURAL'}`);
  const dex    = useDex ? chooseDexForStage(n, isBoss, rng, biome) : null;
  if (dex) console.log(`  \u2192 Named Honker: ${dex.name}`);
  const dexBlueprint = dex ? buildDexPartBlueprint(dex) : null;
  const biomeFallbackType = pickBiomeType(biome, rng, isBoss) || 'Normal';

  // Enemy name is resolved later via generateHonkerName (after parts/type are known)
  // Consume rng calls to preserve seed sequence for arena/lore below
  rng(); rng(); rng(); rng();

  const arena = biome?.arenas?.[Math.floor(rng() * biome.arenas.length)] || STAGE_LOCATIONS[(n - 1) % STAGE_LOCATIONS.length];
  const location = `${biome?.name || 'Honklands'} \u2022 ${arena}`;
  const loreRaw  = dex ? dex.lore : (biome?.lore?.[Math.floor(rng() * biome.lore.length)] || STAGE_LORE[Math.floor(rng() * STAGE_LORE.length)]);
  const lore     = dex ? `"${loreRaw}"` : `"${loreRaw.replace('{n}', n)}"`;

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
      let pool = PARTS_DATA.parts.filter(p => p.slot === slot && famSet.has(p.family?.name) && !isPartUnique(p));
      if (!pool.length) pool = PARTS_DATA.parts.filter(p => p.slot === slot && !isPartUnique(p));
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
      ...(m.animationType ? { animationType: m.animationType } : {}),
      power: Math.max(15, Math.round(m.basePower || 55)),
      acc: m.acc, pp: m.pp, maxPP: m.pp,
      ...(m.secondaryEffect ? { secondaryEffect: { ...m.secondaryEffect } } : {}),
      ...(m.inflictStatus   ? { inflictStatus:   { ...m.inflictStatus   } } : {}),
      ...(m.applyBuff       ? { applyBuff:       { ...m.applyBuff       } } : {}),
      ...(m.statusOnly      ? { statusOnly: true } : {}),
      ...(m.priority ? { priority: true } : {}),
      ...(m.lowHPOnly ? { lowHPOnly: true } : {}),
    }));
  }

  // --- Stats from parts (same system as player) ---
  const partStats = dex ? null : sumPartStats(assembledParts);
  const hp   = dex ? (dex.hp  || 80) : Math.max(1, partStats.hp);
  const luck = dex ? (dex.luck|| 20) : Math.max(1, partStats.luck);
  const genAtk = dex ? (dex.atk || 80) : Math.max(1, partStats.atk);
  const genDef = dex ? (dex.def || 80) : Math.max(1, partStats.def);
  const genSpd = dex ? (dex.spd || 80) : Math.max(1, partStats.spd);

  const emojiPool  = dex ? null : (isBoss ? BOSS_EMOJIS : (ENEMY_EMOJIS[type] || ENEMY_EMOJIS.Normal));
  const emoji      = dex ? dex.emoji : emojiPool[Math.floor(rng() * emojiPool.length)];
  const passive    = dex ? (dex.passive || dexBlueprint?.derived?.passive || null) : null;
  // Enemy level scales with stage — leveling system handles all stat growth
  const enemyLevel = Math.max(1, Math.round(n * 0.5) + (isBoss ? 2 : 0));
  const difficulty = isBoss ? 5 : Math.min(4, Math.ceil(n / 4));
  const xpReward   = xpRewardForEnemyLevel(enemyLevel, isBoss);

  // --- Determine enemy name ---
  let enemyName;
  if (dex) {
    enemyName = dex.name;
  } else {
    const headName = assembledParts?.head?.name || E_BODIES[Math.floor(((hash32(String(n)) >>> 0) % E_BODIES.length))];
    enemyName = generateHonkerName({ headName, type, stats: { hp, atk: genAtk, def: genDef, spd: genSpd, luck }, isBoss });
  }

  // Boss shield: 25% of max HP as a separate shield bar
  const shieldPct = isBoss ? 0.25 : 0;

  const enemyData = { name: enemyName, emoji, type, type2, hp, luck, atk:genAtk, def:genDef, spd:genSpd,
                      moves, passive, dexId: dex?.id || null, assembledParts, level: enemyLevel,
                      shieldPct };
  const hasNewParts = enemyHasUncaughtParts(enemyData);

  return { num: n, name: location, desc: lore, isBoss, difficulty, xpReward, hasNewParts,
    biomeId: biome?.id || 'unknown',
    biomeVisual: biome?.visual || null,
    enemy: enemyData };
}

function stageThreat(n) {
  const isBoss = (n % 5 === 0);
  const lv = Math.max(1, Math.round(n * 0.5) + (isBoss ? 2 : 0));
  const avgBase = 115; // typical 4-part stat sum
  return Math.round(avgBase * levelStatScale(lv) * (isBoss ? 1.3 : 1));
}
function playerPower(pb) {
  const hp = getHonkerMaxHP(pb);
  const atkBase = Math.round((pb.atk || 80) * levelStatScale(pb.level || 1));
  const atk = (pb.atkMult||1) * (atkBase + (pb.atkFlat||0));
  return Math.round(hp * 0.6 + atk * 2);
}

console.log('[STAGE-GEN] Module loaded');
