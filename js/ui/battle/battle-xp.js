// ============================================================================
// HonkaRogue XP & Leveling (js/ui/battle/battle-xp.js)
// XP/leveling system and mastery progression
// ============================================================================

function xpNeededForLevel(level) {
  const lv = Math.max(1, Number(level) || 1);
  return Math.max(100, Math.round(100 * Math.pow(1.34, lv - 1)));
}
function applyXpToHonker(h, xpAmount) {
  if (!h) return;
  ensureLevelState(h);
  ensureMasteryState(h);
  const prevLevel = h.level;
  const prevMasteryLevel = h.masteryLevel;

  h.totalXp = Math.max(0, Number(h.totalXp) || 0) + xpAmount;
  h.masteryTotalXp = Math.max(0, Number(h.masteryTotalXp) || 0) + xpAmount;
  applyLevelProgressFromTotal(h);
  applyMasteryProgressFromTotal(h);

  if (h.level > prevLevel) {
    for (let lv = prevLevel + 1; lv <= h.level; lv++) {
      onLevelUp({ ...h, level: lv });
    }
  }
  if (h.masteryLevel > prevMasteryLevel) {
    for (let mlv = prevMasteryLevel + 1; mlv <= h.masteryLevel; mlv++) {
      onMasteryLevelUp({ ...h, masteryLevel: mlv });
    }
  }
}

function getPartyXpSharePercent() {
  const baseShare = 15;
  const inventory = Array.isArray(CAMPAIGN.inventory) ? CAMPAIGN.inventory : [];
  const shareStacks = inventory.filter(it => it && it.id === 'mentor_whistle').length;
  return Math.min(95, baseShare + shareStacks * 5);
}

function addXP(amount, callback, honker) {
  // If honker is provided, grant XP only to that specific unit.
  // Otherwise grant full XP to active honker and share XP to bench.
  const xpAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (honker) {
    applyXpToHonker(honker, xpAmount);
    if (callback) callback();
    return;
  }
  const party = Array.isArray(CAMPAIGN.party) ? CAMPAIGN.party : [];
  if (party.length) {
    const active = party[CAMPAIGN.activeIdx] || CAMPAIGN.playerBase || party[0];
    const sharePct = getPartyXpSharePercent();
    const sharedXp = Math.max(1, Math.round(xpAmount * (sharePct / 100)));
    party.forEach(h => applyXpToHonker(h, h === active ? xpAmount : sharedXp));
  } else if (CAMPAIGN.playerBase) {
    applyXpToHonker(CAMPAIGN.playerBase, xpAmount);
  } else {
    if (callback) callback();
    return;
  }
  const active = party[CAMPAIGN.activeIdx];
  if (active) CAMPAIGN.playerBase = active;
  if (callback) callback();
}
function totalXpRequiredForLevel(level) {
  const lv = Math.max(1, Number(level) || 1);
  let total = 0;
  for (let i = 1; i < lv; i++) total += xpNeededForLevel(i);
  return total;
}
function levelProgressFromTotalXp(totalXp) {
  let total = Math.max(0, Math.round(Number(totalXp) || 0));
  let level = 1;
  let need = xpNeededForLevel(level);
  while (total >= need) {
    total -= need;
    level += 1;
    need = xpNeededForLevel(level);
  }
  return { level, xp: total, xpNeeded: need };
}
function ensureLevelState(h) {
  if (!h) return;
  h.level = Math.max(1, Number(h.level) || 1);
  h.xp = Math.max(0, Number(h.xp) || 0);
  h.xpNeeded = Math.max(1, Number(h.xpNeeded) || xpNeededForLevel(h.level));
  if (!Number.isFinite(Number(h.totalXp))) {
    h.totalXp = totalXpRequiredForLevel(h.level) + Math.min(h.xp, h.xpNeeded - 1);
  } else {
    h.totalXp = Math.max(0, Math.round(Number(h.totalXp)));
  }
  applyLevelProgressFromTotal(h);
}
function applyLevelProgressFromTotal(h) {
  if (!h) return;
  const prog = levelProgressFromTotalXp(h.totalXp);
  h.level = prog.level;
  h.xp = prog.xp;
  h.xpNeeded = prog.xpNeeded;
}

function masteryXpNeededForLevel(level) {
  const lv = Math.max(0, Number(level) || 0);
  return Math.max(120, Math.round(12 * xpNeededForLevel(lv + 1)));
}
function totalMasteryXpRequiredForLevel(level) {
  const lv = Math.max(0, Number(level) || 0);
  let total = 0;
  for (let i = 0; i < lv; i++) total += masteryXpNeededForLevel(i);
  return total;
}
function masteryProgressFromTotalXp(totalXp) {
  let total = Math.max(0, Math.round(Number(totalXp) || 0));
  let level = 0;
  let need = masteryXpNeededForLevel(level);
  while (total >= need) {
    total -= need;
    level += 1;
    need = masteryXpNeededForLevel(level);
  }
  return { masteryLevel: level, masteryXP: total, masteryXPNeeded: need };
}
function getPersistentMasteryTotalXp(honkerId) {
  if (!honkerId) return 0;
  const map = CAMPAIGN.honkerMastery || {};
  return Math.max(0, Math.round(Number(map[honkerId]) || 0));
}
function setPersistentMasteryTotalXp(honkerId, totalXp) {
  if (!honkerId) return;
  if (!CAMPAIGN.honkerMastery) CAMPAIGN.honkerMastery = {};
  const cur = getPersistentMasteryTotalXp(honkerId);
  const next = Math.max(cur, Math.max(0, Math.round(Number(totalXp) || 0)));
  CAMPAIGN.honkerMastery[honkerId] = next;
}
function ensureMasteryState(h) {
  if (!h) return;
  const persisted = getPersistentMasteryTotalXp(h.id);
  h.masteryLevel = Math.max(0, Number(h.masteryLevel) || 0);
  h.masteryXP = Math.max(0, Number(h.masteryXP) || 0);
  h.masteryXPNeeded = Math.max(1, Number(h.masteryXPNeeded) || masteryXpNeededForLevel(h.masteryLevel));
  if (!Number.isFinite(Number(h.masteryTotalXp))) {
    h.masteryTotalXp = totalMasteryXpRequiredForLevel(h.masteryLevel) + Math.min(h.masteryXP, h.masteryXPNeeded - 1);
  } else {
    h.masteryTotalXp = Math.max(0, Math.round(Number(h.masteryTotalXp)));
  }
  if (persisted > h.masteryTotalXp) h.masteryTotalXp = persisted;
  applyMasteryProgressFromTotal(h);
  setPersistentMasteryTotalXp(h.id, h.masteryTotalXp);
}
function applyMasteryProgressFromTotal(h) {
  if (!h) return;
  const prog = masteryProgressFromTotalXp(h.masteryTotalXp);
  h.masteryLevel = prog.masteryLevel;
  h.masteryXP = prog.masteryXP;
  h.masteryXPNeeded = prog.masteryXPNeeded;
}
function onMasteryLevelUp(h) {
  const mlv = h ? Math.max(0, h.masteryLevel || 0) : 0;
  const bonusPct = Math.round((masteryStatMultiplier(mlv) - 1) * 100);
  log('g', `\u2728 <b>${h.name}</b> reached <b>Mastery ${mlv}</b>! All stats bonus is now <b>+${bonusPct}%</b>.`);
}

function onLevelUp(h) {
  const name = h ? h.name : '???';
  const lv   = h ? h.level : '?';
  log('g', `\uD83C\uDF89 <b>${name}</b> reached <b>LV ${lv}</b>! Stats scaled up (HP/ATK/DEF/SPD).`);
  updateBattleLevelBar();
}

function updateBattleLevelBar() {
  const pb = CAMPAIGN.playerBase;
  if (!pb) return;
  const el = document.getElementById('battle-xp-bar');
  if (!el) return;
  const lv  = pb.level || 1;
  const xp  = pb.xp    || 0;
  const need= pb.xpNeeded || 100;
  el.innerHTML = `<span style="color:var(--gold);font-family:'Press Start 2P',monospace;font-size:.32rem">LV ${lv}</span>
    <div style="flex:1;background:var(--border);border-radius:4px;height:6px;overflow:hidden;margin:0 .4rem">
      <div style="height:100%;width:${Math.round(xp/need*100)}%;background:var(--gold);border-radius:4px;transition:width .4s"></div>
    </div>
    <span style="font-size:.62rem;color:var(--dim)">${xp}/${need}</span>`;
}
