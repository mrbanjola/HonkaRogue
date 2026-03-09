// ============================================================================
// HonkaRogue Save/Load Module (js/ui-save.js)
// Campaign persistence, serialization, and global progress tracking
// ============================================================================

async function clearRunSave() {
  try {
    try {
      await fetch('/api/save/run', { method: 'DELETE' });
      await fetch('/api/save/campaign', { method: 'DELETE' });
    } catch (_) {}
  } catch(e) {}
}
async function clearCampaignSave() {
  await clearRunSave();
}
async function continueCampaign(){
  const ok = await loadCampaign();
  if (!ok || !CAMPAIGN.party || CAMPAIGN.party.length === 0) {
    await clearRunSave();
    const contBtn = document.getElementById('cont-btn');
    if (contBtn) contBtn.style.display = 'none';
    showScreen('screen-title');
    return;
  }
  startNextStageFromLoop();
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  PERSISTENT SAVE / LOAD
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function serializeHonkerForSave(h) {
  if (typeof ensureHonkerMoveIds === 'function') ensureHonkerMoveIds(h);
  return {
    id: h.id, name: h.name, emoji: h.emoji, type: h.type, type2: h.type2 || null,
    hp: h.hp, luck: h.luck, lore: h.lore, isCaught: h.isCaught || false,
    passiveId: h.passiveId || h.passive?.id || null,
    level: h.level||1, xp: h.xp||0, xpNeeded: h.xpNeeded||100, totalXp: h.totalXp||0,
    masteryLevel: h.masteryLevel||0, masteryXP: h.masteryXP||0,
    masteryXPNeeded: h.masteryXPNeeded||masteryXpNeededForLevel(h.masteryLevel||0),
    masteryTotalXp: h.masteryTotalXp||0,
    inventory: h.inventory||[],
    atk: h.atk||80, def: h.def||80, spd: h.spd||80,
    assembledParts: h.assembledParts || null,
    moveIds: (h.moveIds || []).slice(),
    moves: (h.moves || []).map(m => ({ ...m })),
    moveCandidates: (h.moveCandidates || []).map(m => ({ ...m })),
    maxHPBonus: h.maxHPBonus||0, atkFlat: h.atkFlat||0, atkMult: h.atkMult||1,
    luckBonus: h.luckBonus||0, stabBonus: h.stabBonus||1.25,
    chaosMod: h.chaosMod||1, ppBonus: h.ppBonus||0,
    currentHP: h.currentHP ?? getHonkerMaxHP(h),
    movePP: h.movePP || null,
    persistentEffects: h.persistentEffects || {},
  };
}
function hydrateSavedHonker(saved) {
  const base = ROSTER.find(r => r.id === saved.id) || saved;
  const h = JSON.parse(JSON.stringify(base));
  h.maxHPBonus = saved.maxHPBonus || 0;
  h.atkFlat    = saved.atkFlat    || 0;
  h.atkMult    = saved.atkMult    || 1;
  h.luckBonus  = saved.luckBonus  || 0;
  h.stabBonus  = saved.stabBonus  || 1.25;
  h.chaosMod   = saved.chaosMod   || 1;
  h.ppBonus    = saved.ppBonus    || 0;
  h.moveIds    = (saved.moveIds || []).slice();
  if (!h.moveIds.length && typeof ensureHonkerMoveIds === 'function') {
    h.moves = saved.moves || [];
    ensureHonkerMoveIds(h);
  }
  if (h.moveIds.length) {
    h.moves = materializeMovesFromIds(h.moveIds);
    const savedMoves = Array.isArray(saved.moves) ? saved.moves : [];
    const savedById = new Map(savedMoves.map(m => [m.id, m]));
    const savedByName = new Map(savedMoves.map(m => [m.name, m]));
    h.moves.forEach(m => {
      const src = savedById.get(m.id) || savedByName.get(m.name);
      if (!src) return;
      // Only restore current pp - power/maxPP/type come from MOVE_DB
      m.pp = Number.isFinite(src.pp) ? Math.max(0, Math.min(m.maxPP, src.pp)) : m.pp;
    });
  } else {
    h.moves = saved.moves || [];
  }
  h.moveCandidates = saved.moveCandidates || [];
  h.isCaught   = saved.isCaught || false;
  h.level      = saved.level    || 1;
  h.xp         = saved.xp       || 0;
  h.xpNeeded   = saved.xpNeeded || 100;
  h.totalXp    = Number.isFinite(saved.totalXp) ? saved.totalXp : undefined;
  ensureLevelState(h);
  h.masteryLevel = saved.masteryLevel || 0;
  h.masteryXP = saved.masteryXP || 0;
  h.masteryXPNeeded = saved.masteryXPNeeded || masteryXpNeededForLevel(h.masteryLevel);
  h.masteryTotalXp = Number.isFinite(saved.masteryTotalXp) ? saved.masteryTotalXp : undefined;
  ensureMasteryState(h);
  h.inventory  = saved.inventory || [];
  h.atk        = saved.atk        || 80;
  h.def        = saved.def        || 80;
  h.spd        = saved.spd        || 80;
  h.type2      = saved.type2      || null;
  h.assembledParts = saved.assembledParts || null;
  h.currentHP  = saved.currentHP ?? getHonkerMaxHP(h);
  h.passiveId  = saved.passiveId || saved.passive?.id || h.passiveId || h.passive?.id || null;
  h.movePP     = saved.movePP || null;
  if (h.movePP && Array.isArray(h.moves)) {
    const normalizedPP = {};
    h.moves.forEach(m => {
      const v = h.movePP[m.id] ?? h.movePP[m.name];
      if (Number.isFinite(v)) normalizedPP[m.id || m.name] = Math.max(0, Math.min(m.maxPP || m.pp || 0, v));
    });
    h.movePP = normalizedPP;
  }
  h.persistentEffects = saved.persistentEffects || {};
  if (typeof normalizePassiveRef === 'function') normalizePassiveRef(h);
  return h;
}
const RUN_SAVE_KEY = 'run';
const GLOBAL_SAVE_KEY = 'global';

const SAVE_VERSION = 2;

// Migrate old move properties (v1 → v2)
function migrateMoveProps(m) {
  if (!m) return;
  if (m.drain && !m.secondaryEffect) {
    m.secondaryEffect = { type: 'drain', value: m.drain };
    delete m.drain;
  }
  if (m.recoil && !m.secondaryEffect) {
    m.secondaryEffect = { type: 'recoil', value: m.recoil };
    delete m.recoil;
  }
  if (m.effect && !m.inflictStatus && !m.applyBuff) {
    if (['burn', 'frozen', 'paralyzed'].includes(m.effect) && m.effectTarget !== 'self') {
      m.inflictStatus = { type: m.effect, chance: m.effectChance || 100 };
    } else if (['shielded', 'pumped', 'cursed', 'exposed'].includes(m.effect)) {
      m.applyBuff = { target: m.effectTarget || 'self', type: m.effect, stacks: 1 };
    }
    if (m.power <= 0 || (m.basePower || 0) <= 35) m.statusOnly = true;
    delete m.effect; delete m.effectTarget; delete m.effectChance; delete m.effectDur;
  }
}

function runToSave() {
  return {
    saveVersion:    SAVE_VERSION,
    playerBaseId:   CAMPAIGN.playerBase?.id,
    runSeed:        CAMPAIGN.runSeed ?? null,
    activeIdx:      CAMPAIGN.activeIdx,
    stageIdx:       CAMPAIGN.stageIdx,
    retries:        CAMPAIGN.retries,
    maxRetries:     CAMPAIGN.maxRetries,
    completedStages:CAMPAIGN.completedStages,
    totalXP:        CAMPAIGN.totalXP,
    level:          CAMPAIGN.level,
    xp:             CAMPAIGN.xp,
    xpNeeded:       CAMPAIGN.xpNeeded,
    deepest:        CAMPAIGN.deepest || 0,
    coins:          CAMPAIGN.coins || 0,
    inventory:      CAMPAIGN.inventory,
    fallen:         (CAMPAIGN.fallen || []).map(serializeHonkerForSave),
    party:          CAMPAIGN.party.map(serializeHonkerForSave),
  };
}
function globalProgressToSave() {
  return {
    dexSeen: CAMPAIGN.dexSeen || [],
    dexCaught: CAMPAIGN.dexCaught || [],
    partsSeen: CAMPAIGN.partsSeen || [],
    caughtParts: CAMPAIGN.caughtParts || [],
    honkerMastery: CAMPAIGN.honkerMastery || {},
  };
}
async function saveGlobalProgress() {
  try {
    await persistSaveBlob(GLOBAL_SAVE_KEY, JSON.stringify(globalProgressToSave()));
  } catch (e) { console.warn('[SAVE] Global progress save failed', e); }
}
async function readSaveBlob(serverKey, legacyServerKey) {
  let raw = null;
  try {
    const r = await fetch(`/api/save/${serverKey}`, { cache: 'no-store' });
    if (r.ok && r.status !== 204) raw = await r.text();
  } catch (_) {}
  if (!raw && legacyServerKey) {
    try {
      const r = await fetch(`/api/save/${legacyServerKey}`, { cache: 'no-store' });
      if (r.ok && r.status !== 204) raw = await r.text();
    } catch (_) {}
  }
  return raw;
}
async function persistSaveBlob(serverKey, payload) {
  let serverSaved = false;
  try {
    const r = await fetch(`/api/save/${serverKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    serverSaved = r.ok;
  } catch (_) {}
  return serverSaved;
}

async function saveCampaign() {
  try {
    const runData = JSON.stringify(runToSave());
    const globalData = JSON.stringify(globalProgressToSave());
    const serverSavedRun = await persistSaveBlob(RUN_SAVE_KEY, runData);
    const serverSavedGlobal = await persistSaveBlob(GLOBAL_SAVE_KEY, globalData);
    if (!serverSavedRun || !serverSavedGlobal) {
      console.warn('[SAVE] Server save unavailable');
    }
    const contBtn = document.getElementById('cont-btn');
    if (contBtn && CAMPAIGN.party && CAMPAIGN.party.length > 0) contBtn.style.display = '';
    flashSaveIndicator();
  } catch(e) { console.warn('Save failed', e); }
}

async function loadCampaign() {
  try {
    const raw = await readSaveBlob(RUN_SAVE_KEY, 'campaign');
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.saveVersion !== SAVE_VERSION && d.saveVersion !== 1) {
      console.warn('[LOAD] Save version mismatch (got', d.saveVersion, ', expected', SAVE_VERSION, '). Discarding.');
      await clearRunSave();
      return false;
    }
    // Migrate v1 saves: convert old move properties to new schema
    if (d.saveVersion === 1) {
      for (const h of [...(d.party || []), ...(d.fallen || [])]) {
        if (h?.moves) h.moves.forEach(migrateMoveProps);
      }
      console.log('[LOAD] Migrated v1 save to v2 (move properties).');
    }
    const hydrated = (d.party || []).map(hydrateSavedHonker);
    const party = hydrated.filter(h => h.moves && h.moves.length > 0 && (h.hp || 0) > 0);
    if (party.length < hydrated.length) {
      console.warn('[LOAD] Filtered', hydrated.length - party.length, 'invalid honker(s) from save.');
    }
    if (party.length === 0) {
      console.warn('[LOAD] Party empty after validation. Discarding save.');
      await clearRunSave();
      return false;
    }
    const fallen = (d.fallen || []).map(hydrateSavedHonker);
    CAMPAIGN.party        = party;
    CAMPAIGN.activeIdx    = Math.min(d.activeIdx || 0, party.length - 1);
    CAMPAIGN.playerBase   = party[CAMPAIGN.activeIdx];
    CAMPAIGN.runSeed      = Number.isFinite(Number(d.runSeed)) ? (Number(d.runSeed) >>> 0) : createRunSeed();
    CAMPAIGN.stageIdx     = d.stageIdx     || 0;
    CAMPAIGN.retries      = d.retries      || 3;
    CAMPAIGN.maxRetries   = d.maxRetries   || 3;
    CAMPAIGN.completedStages = d.completedStages || [];
    CAMPAIGN.totalXP      = d.totalXP      || 0;
    CAMPAIGN.level        = d.level        || 1;
    CAMPAIGN.xp           = d.xp           || 0;
    CAMPAIGN.xpNeeded     = d.xpNeeded     || 100;
    CAMPAIGN.deepest      = d.deepest      || 0;
    CAMPAIGN.coins        = d.coins        || 0;
    CAMPAIGN.inventory    = d.inventory    || [];
    CAMPAIGN.fallen       = fallen;
    // Legacy migration: old campaign saves bundled global progression.
    if ((!CAMPAIGN.caughtParts || !CAMPAIGN.caughtParts.length) && (Array.isArray(d.caughtParts) || Array.isArray(d.unlockedParts))) {
      CAMPAIGN.caughtParts = (d.caughtParts || d.unlockedParts || []).slice();
    }
    if ((!CAMPAIGN.partsSeen || !CAMPAIGN.partsSeen.length) && (Array.isArray(d.partsSeen) || Array.isArray(d.caughtParts) || Array.isArray(d.unlockedParts))) {
      CAMPAIGN.partsSeen = (d.partsSeen || d.caughtParts || d.unlockedParts || []).slice();
    }
    if ((!CAMPAIGN.dexSeen || !CAMPAIGN.dexSeen.length) && Array.isArray(d.dexSeen)) CAMPAIGN.dexSeen = d.dexSeen.slice();
    if ((!CAMPAIGN.dexCaught || !CAMPAIGN.dexCaught.length) && Array.isArray(d.dexCaught)) CAMPAIGN.dexCaught = d.dexCaught.slice();
    if ((!CAMPAIGN.honkerMastery || Object.keys(CAMPAIGN.honkerMastery).length === 0) && d.honkerMastery && typeof d.honkerMastery === 'object') {
      CAMPAIGN.honkerMastery = { ...d.honkerMastery };
    }
    ensurePartTrackingState();
    CAMPAIGN.unlockedParts= CAMPAIGN.caughtParts || [];
    if (!CAMPAIGN.party || CAMPAIGN.party.length === 0) return false;
    CAMPAIGN.started      = true;
    return true;
  } catch(e) { console.warn('Load failed', e); return false; }
}

async function loadGlobalDex() {
  try {
    const raw = await readSaveBlob(GLOBAL_SAVE_KEY, 'dex');
    if (!raw) return;
    const d = JSON.parse(raw);
    CAMPAIGN.dexSeen = d.dexSeen || d.seen || [];
    CAMPAIGN.dexCaught = d.dexCaught || d.caught || [];
    CAMPAIGN.partsSeen = d.partsSeen || [];
    CAMPAIGN.caughtParts = d.caughtParts || d.unlockedParts || [];
    CAMPAIGN.unlockedParts = CAMPAIGN.caughtParts.slice();
    CAMPAIGN.honkerMastery = d.honkerMastery || d.mastery || {};
    ensurePartTrackingState();
  } catch(e) {}
}

function flashSaveIndicator() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}
