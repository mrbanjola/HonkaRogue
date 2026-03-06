// ============================================================================
// HonkaRogue Parts Manager (js/data/parts-manager.js)
// PARTS_DATA, family registry, part normalization, part tracking/unlocking
// ============================================================================

let PARTS_DATA = { version:'0.0.0', generatedAt:null, source:'runtime', statsGuide:{}, summary:{ totalParts:0, perSlot:{ head:0, torso:0, wings:0, legs:0 }, rarityBreakdown:{}, archetypeBreakdown:{} }, families:[], parts:[] };
const MAX_PART_MOVES = 4;
function _sanitizeMoveIds(rawIds, max = MAX_PART_MOVES) {
  return [...new Set((rawIds || []).map(x => String(x || '').trim()).filter(Boolean))].slice(0, max);
}
function _ensureFamilyMoveIdsByRarity(fam) {
  const byR = fam?.moveIdsByRarity && typeof fam.moveIdsByRarity === 'object' ? fam.moveIdsByRarity : {};
  const out = {
    common: _sanitizeMoveIds(byR.common || []),
    rare: _sanitizeMoveIds(byR.rare || []),
    legendary: _sanitizeMoveIds(byR.legendary || []),
  };
  if (!out.common.length && Array.isArray(fam?.baseMoveIds) && fam.baseMoveIds.length) {
    out.common = _sanitizeMoveIds(fam.baseMoveIds);
  }
  return out;
}
const FAMILY_NAME_TYPE_HINT = {
  Marshborn:'Normal', Embercrest:'Fire', Frostplume:'Ice', Stormcall:'Lightning',
  Ironbarb:'Normal', Duskveil:'Shadow', Sunflare:'Fire', Bloomcrest:'Normal', Voidgild:'Shadow',
};
const FAMILY_THEME_TYPE_HINT = {
  fire:'Fire', solar:'Fire', ice:'Ice', lightning:'Lightning',
  shadow:'Shadow', arcane:'Shadow', bog:'Normal', stone:'Normal', wild:'Normal', normal:'Normal',
};
function inferFamilyType(typeRaw, nameRaw, themeRaw) {
  const explicit = String(typeRaw || '').trim();
  if (explicit) return explicit;
  const byName = FAMILY_NAME_TYPE_HINT[String(nameRaw || '').trim()];
  if (byName) return byName;
  const byTheme = FAMILY_THEME_TYPE_HINT[String(themeRaw || '').trim().toLowerCase()];
  if (byTheme) return byTheme;
  return 'Normal';
}
function ensureFamiliesRegistry(data) {
  if (!data) return;
  if (!Array.isArray(data.families)) data.families = [];
  if (!Array.isArray(data.parts)) data.parts = [];
  const byId = new Map();
  const byName = new Map();
  for (const fam of data.families) {
    if (!fam || !fam.name) continue;
    const id = Number(fam.id) || 0;
    const rec = {
      id,
      name: String(fam.name),
      theme: String(fam.theme || ''),
      type: inferFamilyType(fam.type, fam.name, fam.theme),
      description: String(fam.description || ''),
      baseMoveIds: _sanitizeMoveIds(fam.baseMoveIds || []),
      moveIdsByRarity: _ensureFamilyMoveIdsByRarity(fam),
    };
    if (id) byId.set(id, rec);
    byName.set(rec.name.toLowerCase(), rec);
  }
  for (const part of data.parts) {
    const pFam = part?.family || {};
    const pName = String(pFam.name || '').trim();
    const pTheme = String(pFam.theme || '').trim();
    const pType = String(pFam.type || '').trim();
    const pId = Number(part?.familyId || pFam.id) || 0;
    let fam = null;
    if (pId && byId.has(pId)) fam = byId.get(pId);
    if (!fam && pName && byName.has(pName.toLowerCase())) fam = byName.get(pName.toLowerCase());
    if (!fam) {
      const nextId = pId || Math.max(0, ...byId.keys()) + 1;
      const nextName = pName || `Family${nextId}`;
      const nextTheme = pTheme || 'normal';
      fam = { id: nextId, name: nextName, theme: nextTheme, type: inferFamilyType(pType, nextName, nextTheme), description: '', baseMoveIds: [] };
      byId.set(fam.id, fam);
      byName.set(fam.name.toLowerCase(), fam);
    } else {
      if (!fam.theme && pTheme) fam.theme = pTheme;
      if (!fam.id && pId) fam.id = pId;
      if (!fam.type || fam.type === 'Normal') fam.type = inferFamilyType(pType, fam.name, fam.theme);
    }
    fam.moveIdsByRarity = _ensureFamilyMoveIdsByRarity(fam);
    fam.baseMoveIds = _sanitizeMoveIds(fam.baseMoveIds || fam.moveIdsByRarity.common || []);
    part.familyId = fam.id;
    part.family = { id: fam.id, name: fam.name, theme: fam.theme, type: fam.type };
  }
  data.families = [...byId.values()].sort((a, b) => (a.id || 0) - (b.id || 0) || a.name.localeCompare(b.name));
}
function getPartFamily(part, data = PARTS_DATA) {
  if (!part) return null;
  const fams = data?.families || [];
  const byId = Number(part.familyId || part.family?.id) || 0;
  if (byId) {
    const f = fams.find(x => Number(x.id) === byId);
    if (f) return f;
  }
  const byName = String(part.family?.name || '').toLowerCase();
  if (byName) {
    const f = fams.find(x => String(x.name || '').toLowerCase() === byName);
    if (f) return f;
  }
  return part.family || null;
}
function isPartUnique(part) {
  const v = part?.isUnique;
  return v === true || v === 'true' || v === 1;
}
async function loadPartsData() {
  const urls = ['/api/parts-data', 'data/parts_data.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.parts)) {
        PARTS_DATA = data;
        ensureFamiliesRegistry(PARTS_DATA);
        PARTS_DATA.parts.forEach(p => {
          if (!p) return;
          if (!p.name) p.name = String(p.id || 'Unnamed Part');
          p.isUnique = isPartUnique(p);
          if (Array.isArray(p.moveIds)) p.moveIds = _sanitizeMoveIds(p.moveIds);
        });
        if (PARTS_DATA.autoNormalizeRarity === true) normalizePartRarityByFamily(PARTS_DATA);
        if (PARTS_DATA.autoApplyProgressionCurve === true) applyPartProgressionCurve(PARTS_DATA);
        return PARTS_DATA;
      }
    } catch (_) {}
  }
  return PARTS_DATA;
}
function normalizePartRarityByFamily(data) {
  if (!data || !Array.isArray(data.parts)) return;
  const groups = new Map();
  for (const part of data.parts) {
    const fam = getPartFamily(part, data);
    const key = `${part.slot}::${fam?.name || 'Unknown'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(part);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => (a.variant || 0) - (b.variant || 0));
    const n = arr.length;
    if (n === 1) {
      arr[0].rarity = 'common';
      continue;
    }
    const legendaryIndex = n - 1;
    const rareCount = Math.max(1, Math.floor((n - 1) * 0.25));
    const rareStart = Math.max(0, legendaryIndex - rareCount);
    for (let i = 0; i < n; i++) {
      if (i === legendaryIndex) arr[i].rarity = 'legendary';
      else if (i >= rareStart) arr[i].rarity = 'rare';
      else arr[i].rarity = 'common';
    }
  }
}
function applyPartProgressionCurve(data) {
  if (!data || !Array.isArray(data.parts)) return;
  const rarityRank = { common: 0, rare: 2, legendary: 4 };
  const archetypeBonus = { balanced: 1.0, bulwark: 1.04, raider: 1.08, trickster: 1.03 };
  const statCaps = {
    head:  { hp: 28,  atk: 110, def: 30, spd: 46, luck: 40 },
    torso: { hp: 140, atk: 40,  def: 86, spd: 22, luck: 20 },
    wings: { hp: 38,  atk: 45,  def: 36, spd: 62, luck: 28 },
    legs:  { hp: 42,  atk: 42,  def: 38, spd: 50, luck: 26 },
  };
  for (const part of data.parts) {
    if (!part || !part.stats) continue;
    const slot = part.slot || 'head';
    const caps = statCaps[slot] || statCaps.head;
    const fam = getPartFamily(part, data);
    const familyId = Math.max(1, Math.min(9, Number(fam?.id) || 1));
    const familyRank = ((familyId - 1) / 8) * 3;
    const baseRank = (rarityRank[part.rarity] ?? 0) + familyRank;
    const rankMult = 0.82 + baseRank * 0.16;
    const archMult = archetypeBonus[part.archetype] || 1.0;
    const mult = rankMult * archMult;
    const next = {};
    for (const key of ['hp', 'atk', 'def', 'spd', 'luck']) {
      const raw = Number(part.stats[key]) || 0;
      next[key] = Math.max(1, Math.min(caps[key], Math.round(raw * mult)));
    }
    part.stats = next;
    part.powerScore = next.hp + next.atk + next.def + next.spd + next.luck;
  }
}

if (PARTS_DATA.autoNormalizeRarity === true) normalizePartRarityByFamily(PARTS_DATA);
if (PARTS_DATA.autoApplyProgressionCurve === true) applyPartProgressionCurve(PARTS_DATA);

// PART MOVE SCORING & SELECTION
const SLOT_MOVE_PREF = {
  head:  { status: 1.25, priority: 0.8, utility: 0.55, heavy: 0.55 },
  torso: { status: 1.4,  priority: 0.35, utility: 1.0,  heavy: 0.7  },
  wings: { status: 0.65, priority: 1.35, utility: 0.55, heavy: 0.85 },
  legs:  { status: 0.45, priority: 0.7,  utility: 0.35, heavy: 1.35 },
};
const PART_FAMILY_TYPE = {
  Marshborn:'Normal', Embercrest:'Fire', Frostplume:'Ice', Stormcall:'Lightning',
  Ironbarb:'Normal', Duskveil:'Shadow', Sunflare:'Fire', Bloomcrest:'Normal', Voidgild:'Shadow',
};
const PART_THEME_TYPE = {
  fire:'Fire', solar:'Fire', ice:'Ice', lightning:'Lightning',
  shadow:'Shadow', arcane:'Shadow', bog:'Normal', stone:'Normal', wild:'Normal',
};
function rarityTargetTier(rarity) {
  if (rarity === 'legendary') return 'legendary';
  if (rarity === 'rare') return 'rare';
  return 'common';
}
function partTypeFromData(part) {
  if (!part) return 'Normal';
  const fam = getPartFamily(part, PARTS_DATA) || part.family || {};
  const explicitType = String(fam?.type || '').trim();
  if (explicitType) return explicitType;
  const famType = PART_FAMILY_TYPE[fam?.name];
  const themeType = PART_THEME_TYPE[fam?.theme];
  return famType || themeType || 'Normal';
}
function inheritedFamilyMoveIds(part, data = PARTS_DATA) {
  const fam = getPartFamily(part, data);
  if (!fam) return null;
  const rarity = (part?.rarity === 'legendary' || part?.rarity === 'rare') ? part.rarity : 'common';
  const byR = _ensureFamilyMoveIdsByRarity(fam);
  const candidate = byR[rarity]?.length ? byR[rarity] : (fam?.baseMoveIds || []);
  const ids = _sanitizeMoveIds(candidate).filter(id => !!MOVE_DB[id]);
  if (!ids.length) return null;
  return ids;
}
function scoreMoveForPart(move, part, idx) {
  const slot = part.slot || 'head';
  const pref = SLOT_MOVE_PREF[slot] || SLOT_MOVE_PREF.head;
  const pType = partTypeFromData(part);
  const targetTier = rarityTargetTier(part.rarity);
  const moveBasePower = Number(move.basePower || 0);
  const isStatus = !!move.inflictStatus || !!move.applyBuff || moveBasePower <= 0;
  const isUtility = !!move.inflictStatus || !!move.applyBuff || !!move.secondaryEffect || !!move.priority;
  const isHeavy = moveBasePower >= 69 || (move.secondaryEffect?.type === 'recoil');
  let s = 0;
  s += (move.type === pType ? 2.1 : (move.type === 'Normal' ? 0.65 : -0.35));
  s += 2.2 - (tierDistance(move.tier, targetTier) * 1.0);
  if (isStatus) s += pref.status;
  if (!!move.priority) s += pref.priority;
  if (isUtility) s += pref.utility;
  if (isHeavy) s += pref.heavy;
  s += ((moveBasePower / 120) * 0.55);
  s += ((move.acc || 100) / 100) * 0.35;
  s += seeded01(`${part.id}|${idx}|${move.id}`) * 0.1;
  return s;
}
function pickPartMoves(part) {
  const pType = partTypeFromData(part);
  const typePool = MOVES_BY_TYPE[pType] || MOVES_BY_TYPE.Normal || [];
  const normalPool = MOVES_BY_TYPE.Normal || [];
  const allPool = [...typePool, ...normalPool];
  const ranked = allPool
    .map((m, i) => ({ m, s: scoreMoveForPart(m, part, i) }))
    .sort((a, b) => b.s - a.s);
  const first = ranked[0]?.m || typePool[0] || normalPool[0];
  let second = ranked.find(x => x.m.id !== first.id)?.m || ranked[1]?.m || first;
  if (part.rarity === 'legendary' && first.tier !== 'legendary' && second.tier !== 'legendary') {
    const leg = ranked.find(x => x.m.tier === 'legendary' && x.m.id !== first.id)?.m;
    if (leg) second = leg;
  }
  return [first.id, second.id];
}
function attachPartMoveLinks(data) {
  if (!data || !Array.isArray(data.parts)) return;
  for (const part of data.parts) {
    const explicit = Array.isArray(part.moveIds) && part.moveIds.length
      ? _sanitizeMoveIds(part.moveIds).filter(id => !!MOVE_DB[id])
      : null;
    const inherited = inheritedFamilyMoveIds(part, data);
    const ids = explicit || inherited || pickPartMoves(part);
    part.moveIds = _sanitizeMoveIds(ids);
  }
}
attachPartMoveLinks(PARTS_DATA);

// PART TRACKING
function getStarterUnlockedPartIds() {
  const parts = PARTS_DATA?.parts || [];
  const byFamSlot = new Map();
  for (const p of parts) {
    const fam = p.family?.name || 'Unknown';
    const key = `${fam}::${p.slot}`;
    if (!byFamSlot.has(key)) byFamSlot.set(key, []);
    byFamSlot.get(key).push(p);
  }
  const out = new Set();
  for (const arr of byFamSlot.values()) {
    arr.sort((a, b) => {
      const ra = { common: 0, rare: 1, legendary: 2 }[a.rarity] ?? 3;
      const rb = { common: 0, rare: 1, legendary: 2 }[b.rarity] ?? 3;
      if (ra !== rb) return ra - rb;
      if ((a.variant || 0) !== (b.variant || 0)) return (a.variant || 0) - (b.variant || 0);
      return (a.powerScore || 0) - (b.powerScore || 0);
    });
    if (arr[0]?.id) out.add(arr[0].id);
  }
  return [...out];
}
function ensurePartTrackingState() {
  if (!Array.isArray(CAMPAIGN.caughtParts)) CAMPAIGN.caughtParts = [];
  if (!Array.isArray(CAMPAIGN.partsSeen)) CAMPAIGN.partsSeen = [];
  if (CAMPAIGN.caughtParts.length) {
    const seenSet = new Set(CAMPAIGN.partsSeen);
    let changed = false;
    for (const id of CAMPAIGN.caughtParts) {
      if (!seenSet.has(id)) { seenSet.add(id); changed = true; }
    }
    if (changed) CAMPAIGN.partsSeen = [...seenSet];
  }
}
function getAllPartIds() { return (PARTS_DATA?.parts || []).map(p => p.id); }
function isPartCaught(partOrId) {
  const id = typeof partOrId === 'string' ? partOrId : partOrId?.id;
  if (!id) return false;
  ensurePartTrackingState();
  return CAMPAIGN.caughtParts.includes(id);
}
function isPartSeen(partOrId) {
  const id = typeof partOrId === 'string' ? partOrId : partOrId?.id;
  if (!id) return false;
  ensurePartTrackingState();
  return CAMPAIGN.partsSeen.includes(id);
}
function isPartUnlocked(partOrId) { return isPartCaught(partOrId); }
function catchPartIds(ids) {
  ensurePartTrackingState();
  const caughtBefore = CAMPAIGN.caughtParts.length;
  const caughtSet = new Set(CAMPAIGN.caughtParts);
  const seenSet = new Set(CAMPAIGN.partsSeen);
  (ids || []).forEach(id => { if (id) { caughtSet.add(id); seenSet.add(id); } });
  CAMPAIGN.caughtParts = [...caughtSet];
  CAMPAIGN.partsSeen = [...seenSet];
  return CAMPAIGN.caughtParts.length - caughtBefore;
}
function seePartIds(ids) {
  ensurePartTrackingState();
  const before = CAMPAIGN.partsSeen.length;
  const set = new Set(CAMPAIGN.partsSeen);
  (ids || []).forEach(id => { if (id) set.add(id); });
  CAMPAIGN.partsSeen = [...set];
  return CAMPAIGN.partsSeen.length - before;
}
function resetStarterCaughtParts() {
  ensurePartTrackingState();
  CAMPAIGN.caughtParts = [];
  CAMPAIGN.partsSeen = [];
}
function unlockedPartsByFamilyType(type) {
  const fams = TYPE_TO_PART_FAMILIES[type] || [];
  if (!fams.length) return [];
  const set = new Set(fams);
  return (PARTS_DATA?.parts || []).filter(p => set.has(p.family?.name));
}
function resetStarterUnlockedParts() { resetStarterCaughtParts(); }
function unlockAllParts() {
  ensurePartTrackingState();
  CAMPAIGN.caughtParts = getAllPartIds();
  CAMPAIGN.partsSeen = getAllPartIds();
}
function grantCatchPartUnlocks(caught, enemyRef) {
  const catchIds = [];
  const seeIds = [];
  const sourceParts = enemyRef?.assembledParts || null;
  if (sourceParts) {
    ['head', 'torso', 'wings', 'legs'].forEach(slot => {
      const id = sourceParts[slot]?.id;
      if (id) catchIds.push(id);
    });
  } else {
    const pool = unlockedPartsByFamilyType(caught?.type).filter(p => !isPartUnique(p) && !isPartCaught(p.id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const bySlot = new Map();
    for (const p of pool) {
      if (bySlot.has(p.slot)) continue;
      bySlot.set(p.slot, p.id);
      if (bySlot.size >= 2) break;
    }
    catchIds.push(...bySlot.values());
  }
  seeIds.push(...(sourceParts ? catchIds : unlockedPartsByFamilyType(caught?.type).filter(p => !isPartUnique(p)).slice(0, 3).map(p => p.id)));
  const newCaught = catchPartIds(catchIds);
  seePartIds(seeIds);
  return newCaught;
}
function enemyHasUncaughtParts(enemyData) {
  if (!enemyData) return false;
  const sourceParts = enemyData.assembledParts;
  if (sourceParts) {
    return ['head', 'torso', 'wings', 'legs'].some(slot => {
      const id = sourceParts[slot]?.id;
      return id && !isPartCaught(id);
    });
  } else {
    const pool = unlockedPartsByFamilyType(enemyData.type).filter(p => !isPartUnique(p));
    return pool.some(p => !isPartCaught(p.id));
  }
}

console.log('[PARTS-MANAGER] Module loaded');
