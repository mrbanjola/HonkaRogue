// ============================================================================
// HonkaRogue Mastery Manager (js/data/mastery-manager.js)
// Mastery data loading, tier computation, move/passive unlock resolution
// ============================================================================

let MASTERY_DATA = null; // loaded from data/mastery.json

// --- Data access ---

function getMasteryTiers() {
  return (MASTERY_DATA && MASTERY_DATA.tiers) || [];
}

function getPassiveUnlockTier() {
  return (MASTERY_DATA && MASTERY_DATA.passiveUnlockTier) || 3;
}

function getHonkerMasteryConfig(honkerId) {
  // Check explicit config in mastery.json first
  if (MASTERY_DATA && MASTERY_DATA.honkerMastery && MASTERY_DATA.honkerMastery[honkerId]) {
    return MASTERY_DATA.honkerMastery[honkerId];
  }
  // For any named honker (ROSTER or HONKER_DEX), return a default config
  if (isNamedHonker(honkerId)) {
    return { moveUnlocks: {} };
  }
  return null;
}

function isNamedHonker(honkerId) {
  if (!honkerId) return false;
  // Check ROSTER starters
  if (typeof ROSTER !== 'undefined' && Array.isArray(ROSTER)) {
    if (ROSTER.some(r => r.id === honkerId)) return true;
  }
  // Check HONKER_DEX entries
  if (typeof HONKER_DEX !== 'undefined' && Array.isArray(HONKER_DEX)) {
    if (HONKER_DEX.some(d => d.id === honkerId)) return true;
  }
  return false;
}

// --- Eligibility ---

function canGainMastery(honker) {
  if (!honker || !honker.id) return false;
  // Assembled honkers cannot gain mastery
  if (String(honker.id).startsWith('assembled_')) return false;
  // Caught procedural honkers cannot gain mastery
  if (String(honker.id).startsWith('caught_')) return false;
  // Any named honker (ROSTER or HONKER_DEX) can gain mastery
  return isNamedHonker(honker.id);
}

// --- Tier computation (from totalXp) ---

function getMasteryTierFromXp(totalXp) {
  const tiers = getMasteryTiers();
  let level = 0;
  for (const tier of tiers) {
    if (totalXp >= tier.xpRequired) {
      level = tier.level;
    } else {
      break;
    }
  }
  return level;
}

function getMasteryTierInfo(totalXp) {
  const tiers = getMasteryTiers();
  const level = getMasteryTierFromXp(totalXp);
  const currentTier = tiers.find(t => t.level === level) || null;
  const nextTier = tiers.find(t => t.level === level + 1) || null;
  const statBonus = currentTier ? currentTier.statBonus : 0;
  const xpToNext = nextTier ? nextTier.xpRequired - totalXp : 0;
  const maxed = !nextTier;
  return { level, totalXp, statBonus, currentTier, nextTier, xpToNext, maxed };
}

// --- Persistent mastery state ---

function getMasteryTotalXp(honkerId) {
  if (!honkerId) return 0;
  const map = CAMPAIGN.honkerMastery || {};
  const val = map[honkerId];
  // Support both old numeric format and new format
  if (typeof val === 'number') return Math.max(0, Math.round(val));
  if (val && typeof val === 'object' && typeof val.totalXp === 'number') return Math.max(0, Math.round(val.totalXp));
  return 0;
}

function setMasteryTotalXp(honkerId, totalXp) {
  if (!honkerId) return;
  if (!CAMPAIGN.honkerMastery) CAMPAIGN.honkerMastery = {};
  CAMPAIGN.honkerMastery[honkerId] = Math.max(0, Math.round(totalXp));
}

function addMasteryXp(honkerId, amount) {
  if (!honkerId || amount <= 0) return;
  const current = getMasteryTotalXp(honkerId);
  const prev = getMasteryTierFromXp(current);
  const next = current + Math.round(amount);
  setMasteryTotalXp(honkerId, next);
  const newLevel = getMasteryTierFromXp(next);
  return { honkerId, prevLevel: prev, newLevel, totalXp: next, leveled: newLevel > prev };
}

// --- Move unlocks ---

function getUnlockedMasteryMoveIds(honkerId) {
  const config = getHonkerMasteryConfig(honkerId);
  if (!config || !config.moveUnlocks) return [];
  const totalXp = getMasteryTotalXp(honkerId);
  const level = getMasteryTierFromXp(totalXp);
  const unlocked = [];
  for (let tier = 1; tier <= level; tier++) {
    const ids = config.moveUnlocks[String(tier)];
    if (Array.isArray(ids)) unlocked.push(...ids);
  }
  return unlocked;
}

// --- Passive unlocks for assembly ---

function isMasteryPassiveUnlocked(honkerId) {
  const totalXp = getMasteryTotalXp(honkerId);
  const level = getMasteryTierFromXp(totalXp);
  return level >= getPassiveUnlockTier();
}

function getUnlockedAssemblyPassiveIds() {
  const unlocked = [];
  // Collect all named honker ids that could have mastery
  const allIds = new Set();
  if (typeof ROSTER !== 'undefined' && Array.isArray(ROSTER)) {
    ROSTER.forEach(r => { if (r.id) allIds.add(r.id); });
  }
  if (typeof HONKER_DEX !== 'undefined' && Array.isArray(HONKER_DEX)) {
    HONKER_DEX.forEach(d => { if (d.id) allIds.add(d.id); });
  }
  for (const honkerId of allIds) {
    if (!isMasteryPassiveUnlocked(honkerId)) continue;
    // Find passive from ROSTER or HONKER_DEX
    let passiveId = null;
    const rosterEntry = (typeof ROSTER !== 'undefined' ? ROSTER : []).find(r => r.id === honkerId);
    if (rosterEntry) {
      passiveId = rosterEntry.passiveId || null;
    } else {
      const dexEntry = (typeof HONKER_DEX !== 'undefined' ? HONKER_DEX : []).find(d => d.id === honkerId);
      passiveId = dexEntry?.passive?.id || null;
    }
    if (passiveId && !unlocked.includes(passiveId)) {
      unlocked.push(passiveId);
    }
  }
  return unlocked;
}

// --- Hydrate mastery fields onto a honker instance ---

function hydrateMasteryFields(honker) {
  if (!honker || !honker.id) return;
  const totalXp = getMasteryTotalXp(honker.id);
  const info = getMasteryTierInfo(totalXp);
  honker.masteryTotalXp = totalXp;
  honker.masteryLevel = info.level;
  honker.masteryXP = info.nextTier ? totalXp - (info.currentTier ? info.currentTier.xpRequired : 0) : 0;
  honker.masteryXPNeeded = info.nextTier ? info.nextTier.xpRequired - (info.currentTier ? info.currentTier.xpRequired : 0) : 1;
}

// --- Award mastery to battle contributors ---

function awardBattleMastery(xpAmount) {
  if (!BS || !BS.masteryContributors) return [];
  const results = [];
  const party = CAMPAIGN.party || [];
  for (const honkerId of BS.masteryContributors) {
    // Find honker in party; must be alive (not fainted)
    const honker = party.find(h => h.id === honkerId);
    if (!honker) continue;
    const hp = honker.currentHP ?? getHonkerMaxHP(honker);
    if (hp <= 0) continue;
    if (!canGainMastery(honker)) continue;
    const result = addMasteryXp(honkerId, xpAmount);
    if (result) {
      results.push(result);
      // Update runtime fields on the honker instance
      hydrateMasteryFields(honker);
    }
  }
  return results;
}

// --- Contributor tracking ---

function registerMasteryContributor(honker) {
  if (!BS || !honker || !honker.id) return;
  if (!BS.masteryContributors) BS.masteryContributors = new Set();
  if (canGainMastery(honker)) {
    BS.masteryContributors.add(honker.id);
  }
}

// --- Migration: normalize old honkerMastery entries ---

function migrateMasteryData() {
  if (!CAMPAIGN.honkerMastery) return;
  const map = CAMPAIGN.honkerMastery;

  // One-time reset: old mastery system used a completely different XP scale
  // (masteryXpNeededForLevel = 12 * levelXp), so stored values are meaningless
  // under the new tier-threshold system. Reset once, flag it done.
  if (!CAMPAIGN._masteryV2Reset) {
    for (const id of Object.keys(map)) {
      map[id] = 0;
    }
    CAMPAIGN._masteryV2Reset = true;
    console.log('[MASTERY-MANAGER] One-time mastery reset (old XP scale -> new tier thresholds)');
    if (typeof saveGlobalProgress === 'function') saveGlobalProgress();
    return;
  }

  for (const [id, val] of Object.entries(map)) {
    if (typeof val === 'object' && val !== null && typeof val.totalXp === 'number') {
      // Old enriched format -> flatten to just totalXp
      map[id] = Math.max(0, Math.round(val.totalXp));
    } else if (typeof val === 'number') {
      // Already in correct format
      map[id] = Math.max(0, Math.round(val));
    } else {
      map[id] = 0;
    }
  }
}

// --- Loading ---

async function loadMasteryData() {
  try {
    const res = await fetch('/data/mastery.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load mastery.json');
    MASTERY_DATA = await res.json();
    // NOTE: migrateMasteryData() is called from loadGlobalDex() AFTER the
    // actual save data is loaded.  Calling it here would run before the save
    // is read, causing saveGlobalProgress() to overwrite real data with
    // empty defaults.
    console.log('[MASTERY-MANAGER] Mastery data loaded:', getMasteryTiers().length, 'tiers');
    return true;
  } catch (e) {
    console.warn('[MASTERY-MANAGER] Failed to load mastery data:', e.message);
    MASTERY_DATA = { tiers: [], passiveUnlockTier: 3, honkerMastery: {} };
    return false;
  }
}

console.log('[MASTERY-MANAGER] Module loaded');
