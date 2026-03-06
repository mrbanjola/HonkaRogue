// ============================================================================
// HonkaRogue Move Manager (js/data/move-manager.js)
// MOVE_POOL, MOVE_DB, indexes, move materialization, and loading
// ============================================================================

let MOVE_POOL = [];

function moveTier(m) {
  const desc = String(m?.desc || '').toLowerCase();
  const bp = Number(m?.basePower || 0);
  if (desc.includes('legendary') || bp >= 96 || (m.acc || 100) <= 60 || (m.pp || 99) <= 4) return 'legendary';
  if (bp >= 69 || (m.acc || 100) <= 80 || (m.pp || 99) <= 8 || m.inflictStatus || m.applyBuff || m.secondaryEffect || m.priority) return 'rare';
  return 'common';
}

function normalizeMoveDef(m) {
  const types = Array.isArray(m.types) && m.types.length ? [...new Set(m.types)] : [m.type || 'Normal'];
  const primaryType = types[0] || 'Normal';
  const id = m.id || `${primaryType.toLowerCase()}_${slugMoveName(m.name)}`;
  const category = m.category || ((m.effect || (m.basePower || 0) <= 0) ? 'status' : 'attack');
  return { ...m, id, types, type: primaryType, category };
}

let MOVE_DB = {};
let MOVES_BY_TYPE = {};
let MOVES_BY_CATEGORY = {};
function _buildMoveIndexes() {
  MOVE_DB = {};
  MOVES_BY_TYPE = {};
  MOVES_BY_CATEGORY = {};
  for (const raw of MOVE_POOL) {
    const rec = { ...normalizeMoveDef(raw) };
    rec.tier = moveTier(rec);
    MOVE_DB[rec.id] = rec;
    for (const t of rec.types) {
      if (!MOVES_BY_TYPE[t]) MOVES_BY_TYPE[t] = [];
      MOVES_BY_TYPE[t].push(rec);
    }
    if (!MOVES_BY_CATEGORY[rec.category]) MOVES_BY_CATEGORY[rec.category] = [];
    MOVES_BY_CATEGORY[rec.category].push(rec);
  }
}

function materializeMoveFromId(moveId) {
  const rec = MOVE_DB[moveId];
  if (!rec) return null;
  return {
    id: rec.id,
    name: rec.name,
    type: rec.type,
    ...(rec.animationType ? { animationType: rec.animationType } : {}),
    emoji: rec.emoji,
    desc: rec.desc,
    power: rec.statusOnly ? 0 : (rec.basePower || 0),
    acc: rec.acc,
    pp: rec.pp,
    maxPP: rec.pp,
    ...(rec.secondaryEffect ? { secondaryEffect: { ...rec.secondaryEffect } } : {}),
    ...(rec.inflictStatus   ? { inflictStatus:   { ...rec.inflictStatus   } } : {}),
    ...(rec.applyBuff       ? { applyBuff:       { ...rec.applyBuff       } } : {}),
    ...(rec.statusOnly      ? { statusOnly: true } : {}),
    ...(rec.priority ? { priority: true } : {}),
    ...(rec.lowHPOnly ? { lowHPOnly: true } : {}),
  };
}
function materializeMovesFromIds(moveIds) {
  return (moveIds || []).map(materializeMoveFromId).filter(Boolean);
}
function resolveMoveId(move) {
  if (!move) return null;
  if (move.id && MOVE_DB[move.id]) return move.id;
  const byName = Object.values(MOVE_DB).find(rec => rec.name === move.name);
  return byName ? byName.id : null;
}
function ensureHonkerMoveIds(honker) {
  if (!honker) return;
  if (!Array.isArray(honker.moveIds)) honker.moveIds = [];
  if (!Array.isArray(honker.moves)) honker.moves = [];
  const ids = honker.moves.map(resolveMoveId).filter(Boolean);
  if (ids.length) honker.moveIds = [...new Set(ids)];
}
function moveSetHasId(moves, moveId) {
  return !!(moves || []).find(m => m.id === moveId || (MOVE_DB[moveId] && m.name === MOVE_DB[moveId].name));
}
function addMoveById(honker, moveId) {
  if (!honker) return false;
  if (!Array.isArray(honker.moves)) honker.moves = [];
  if (!Array.isArray(honker.moveIds)) honker.moveIds = [];
  if (moveSetHasId(honker.moves, moveId)) return false;
  const mv = materializeMoveFromId(moveId);
  if (!mv) return false;
  honker.moves.push(mv);
  if (!honker.moveIds.includes(moveId)) honker.moveIds.push(moveId);
  return true;
}
function normalizeRosterMoveSets() {
  (ROSTER || []).forEach(h => {
    if (!Array.isArray(h.moveIds) || !h.moveIds.length) ensureHonkerMoveIds(h);
    h.moves = materializeMovesFromIds(h.moveIds);
  });
}
normalizeRosterMoveSets();

async function loadMovesData() {
  const urls = ['/api/move-pool', 'data/moves_data.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const pool = Array.isArray(data) ? data : (data.items || []);
      if (!pool.length) continue;
      MOVE_POOL = pool;
      _buildMoveIndexes();
      MOVE_LEARN_LOOT_POOL = MOVE_POOL.map(buildMoveLootItem).filter(Boolean);
      LOOT_POOL = [...CORE_LOOT_POOL, ...MOVE_LEARN_LOOT_POOL];
      console.log('[MOVE-MANAGER] Moves loaded:', MOVE_POOL.length);
      return true;
    } catch (_) {}
  }
  console.warn('[MOVE-MANAGER] loadMovesData: failed to load from all sources');
  return false;
}

console.log('[MOVE-MANAGER] Module loaded');
