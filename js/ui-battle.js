// ============================================================================
// HonkaRogue Battle UI Module (js/ui-battle.js)
// Sprite rendering, fighter setup, battle events, catch system,
// XP/leveling, animations, and battle log
// ============================================================================

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  BATTLE-LIFECYCLE STATE HELPERS
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function extractMovePPMap(h) {
  const out = {};
  (h.moves || []).forEach(m => { out[m.id || m.name] = m.pp; });
  return out;
}
function extractPersistentEffects(h) {
  const out = {};
  STACKABLE_EFFECTS.forEach(k => {
    const v = h?.statusEffects?.[k] || 0;
    if (v > 0) out[k] = Math.max(1, Math.min(4, v));
  });
  return out;
}
function clearPersistentEffects(h) {
  if (!h) return;
  h.persistentEffects = {};
}
function clearPartyPersistentEffects() {
  (CAMPAIGN.party || []).forEach(h => clearPersistentEffects(h));
}
function syncBattleStateToBase(base, fighter) {
  if (!base || !fighter) return;
  base.currentHP = Math.max(0, Math.min(getHonkerMaxHP(base), fighter.currentHP || 0));
  base.movePP = extractMovePPMap(fighter);
  base.persistentEffects = extractPersistentEffects(fighter);
}
function fullRestoreHonker(h) {
  if (!h) return;
  h.currentHP = getHonkerMaxHP(h);
  h.movePP = {};
  (h.moves || []).forEach(m => { h.movePP[m.id || m.name] = m.maxPP; });
}
function fullRestorePartyAfterBoss() {
  CAMPAIGN.party.forEach(h => fullRestoreHonker(h));
}
function syncActiveFighterToCampaign() {
  const base = CAMPAIGN.party[CAMPAIGN.activeIdx];
  const fighter = BS.bFighters[0];
  if (base && fighter) syncBattleStateToBase(base, fighter);
}
function currentHpForSelection(h) {
  const maxHpVal = getHonkerMaxHP(h);
  const raw = Number(h?.currentHP);
  const cur = Number.isFinite(raw) ? raw : maxHpVal;
  return Math.max(0, Math.min(maxHpVal, cur));
}
function initHonkerRunState(h) {
  if (!h) return;
  ensureMasteryState(h);
  h.currentHP = getHonkerMaxHP(h);
  h.movePP = {};
  h.persistentEffects = {};
  (h.moves || []).forEach(m => { h.movePP[m.id || m.name] = m.maxPP; });
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  XP & LEVELING
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
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

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  BATTLE SPRITES & FIGHTER UI
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function buildCompositeSprite(parts, el, layerPrefix) {
  // layerPrefix: 'cp' for battle fspr, 'pc' for portrait
  el.innerHTML = '';
  const layers = [
    { slot:'legs',  cls:`${layerPrefix}-legs`  },
    { slot:'wings', cls:`${layerPrefix}-wings` },
    { slot:'torso', cls:`${layerPrefix}-torso` },
    { slot:'head',  cls:`${layerPrefix}-head`  },
  ];
  layers.forEach(({ slot, cls }) => {
    const part = parts[slot];
    if (!part) return;
    const div = document.createElement('div');
    div.className = `${layerPrefix}-layer ${cls}`;
    const img = document.createElement('img');
    img.src = part.file;
    img.alt = slot;
    div.appendChild(img);
    el.appendChild(div);
  });
}
function renderCompositePreview(parts, el, extraClass) {
  if (!el || !parts) return;
  el.innerHTML = '';
  el.classList.add('comp-preview');
  if (extraClass) el.classList.add(extraClass);
  const layers = ['legs', 'wings', 'torso', 'head'];
  layers.forEach(slot => {
    const part = parts[slot];
    if (!part) return;
    const layer = document.createElement('div');
    layer.className = `cv-layer cv-${slot}`;
    const img = document.createElement('img');
    img.src = part.file;
    img.alt = slot;
    layer.appendChild(img);
    el.appendChild(layer);
  });
}

function getSpriteBaseClass(side) {
  const el = document.getElementById(`spr-${side}`);
  return el && el.classList.contains('composite') ? 'fspr composite' : 'fspr';
}

function resetSpriteClass(side) {
  const el = document.getElementById(`spr-${side}`);
  if (!el) return;
  el.className = getSpriteBaseClass(side);
}

function setSpriteAnimClass(side, animClass) {
  const el = document.getElementById(`spr-${side}`);
  if (!el) return;
  const base = getSpriteBaseClass(side);
  el.className = animClass ? `${base} ${animClass}` : base;
}

function setupFighterUI(f, side) {
  const sprEl = document.getElementById(`spr-${side}`);
  const hasComposite = f.assembledParts &&
    (f.assembledParts.head || f.assembledParts.torso || f.assembledParts.wings || f.assembledParts.legs);

  if (hasComposite) {
    sprEl.classList.add('composite');
    buildCompositeSprite(f.assembledParts, sprEl, 'cp');
  } else {
    sprEl.classList.remove('composite');
    sprEl.textContent = f.emoji;
  }

  document.getElementById(`nm-${side}`).textContent = f.name;
  // Add encounter badge for named honkers
  const nameEl = document.getElementById(`nm-${side}`);
  const existingBadge = nameEl.nextElementSibling?.classList?.contains('encounter-badge') ? nameEl.nextElementSibling : null;
  if (f.dexId && !existingBadge) {
    const badge = document.createElement('div');
    badge.className = 'encounter-badge';
    const isBoss = f._isBoss;
    badge.textContent = isBoss ? '\u2694 LEGENDARY ENCOUNTER \u2694' : '\u2726 EPIC ENCOUNTER \u2726';
    badge.style.textAlign = 'center';
    badge.style.color = isBoss ? '#ff6a00' : '#ffd700';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = 'bold';
    badge.style.marginTop = '4px';
    badge.style.textShadow = isBoss ? '1px 1px 0 #8b0000' : '1px 1px 0 #000';
    nameEl.after(badge);
  } else if (!f.dexId && existingBadge) {
    existingBadge.remove();
  } else if (f.dexId && existingBadge) {
    // Update badge if boss status changed
    const isBoss = f._isBoss;
    existingBadge.textContent = isBoss ? '\u2694 LEGENDARY ENCOUNTER \u2694' : '\u2726 EPIC ENCOUNTER \u2726';
    existingBadge.style.color = isBoss ? '#ff6a00' : '#ffd700';
    existingBadge.style.textShadow = isBoss ? '1px 1px 0 #8b0000' : '1px 1px 0 #000';
  }

  // Add NEW PARTS badge if enemy has uncaught parts
  const partsParent = nameEl.parentElement;
  const existingPartsBadge = partsParent.querySelector('.new-parts-badge');
  if (f._hasNewParts && !existingPartsBadge) {
    const partsBadge = document.createElement('div');
    partsBadge.className = 'new-parts-badge';
    partsBadge.textContent = '\u2728 NEW PARTS \u2728';
    partsBadge.style.textAlign = 'center';
    partsBadge.style.color = '#00ff88';
    partsBadge.style.fontSize = '11px';
    partsBadge.style.fontWeight = 'bold';
    partsBadge.style.marginTop = '2px';
    partsBadge.style.textShadow = '1px 1px 0 #004400';
    partsBadge.style.animation = 'pulse 1.5s infinite';
    partsParent.appendChild(partsBadge);
  } else if (!f._hasNewParts && existingPartsBadge) {
    existingPartsBadge.remove();
  }
  const tb = document.getElementById(`tb-${side}`);
  tb.textContent = f.type2 ? `${f.type}/${f.type2}` : f.type; tb.className = `type-badge ${TCC[f.type]}`;
  tb.style.color = TC[f.type]; tb.style.borderColor = TC[f.type];
  updateHP(f, side);
  updatePPDots(f, side);
  let statStrip = nameEl.parentElement.querySelector('.f-stats');
  if (!statStrip) {
    statStrip = document.createElement('div');
    statStrip.className = 'f-stats';
    nameEl.after(statStrip);
  }
  statStrip.innerHTML = `<span title="Attack">\u2694${f.atk||80}</span> <span title="Defense">\uD83D\uDEE1${f.def||80}</span> <span title="Speed">\u26A1${f.spd||80}</span> <span title="Luck">\uD83C\uDF40${Math.min(95,(f.luck||50)+(f.luckBonus||0))}%</span>`;

  // Enemy inspection: click enemy sprite/name to see part ownership.
  if (side === 'right') {
    const open = () => showEnemyPartsOverlay(f);
    sprEl.style.cursor = 'pointer';
    sprEl.title = 'View enemy parts';
    sprEl.onclick = open;
    nameEl.style.cursor = 'pointer';
    nameEl.title = 'View enemy parts';
    nameEl.onclick = open;
  } else {
    sprEl.style.cursor = '';
    sprEl.title = '';
    sprEl.onclick = null;
    nameEl.style.cursor = '';
    nameEl.title = '';
    nameEl.onclick = null;
  }
}

function closeEnemyPartsOverlay() {
  const overlay = document.getElementById('enemy-parts-overlay');
  if (overlay) overlay.classList.remove('show');
}

function showEnemyPartsOverlay(enemy) {
  const overlay = document.getElementById('enemy-parts-overlay');
  const grid = document.getElementById('enemy-parts-grid');
  if (!overlay || !grid) return;
  grid.innerHTML = '';
  const parts = enemy?.assembledParts || null;
  if (!parts) {
    const empty = document.createElement('div');
    empty.className = 'ep-card';
    empty.innerHTML = `<div class="ep-meta"><div class="ep-name">No part data available for this enemy.</div></div>`;
    grid.appendChild(empty);
    overlay.classList.add('show');
    return;
  }
  const slots = ['head', 'torso', 'wings', 'legs'];
  slots.forEach(slot => {
    const part = parts[slot];
    if (!part) return;
    const caught = isPartCaught(part.id);
    const card = document.createElement('div');
    card.className = 'ep-card';
    const rarity = String(part.rarity || '').toUpperCase() || 'COMMON';
    const family = part.family?.name || 'Unknown';
    const partName = part.name || part.id || 'Unknown Part';
    card.innerHTML = `
      <div class="ep-art">${part.file ? `<img src="${part.file}" alt="${partName}">` : ''}</div>
      <div class="ep-meta">
        <div class="ep-slot">${slot}</div>
        <div class="ep-name">${partName}</div>
      <div class="ep-family">${family} \u2022 ${rarity}</div>
        <div class="ep-row">
          <span class="ep-badge ${caught ? 'caught' : 'new'}">${caught ? 'CAUGHT' : 'NEW'}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  overlay.classList.add('show');
}

function updateHP(f, side) {
  const pct=f.hpPct*100;
  const b=document.getElementById(`hpb-${side}`);
  b.style.width=pct+'%';
  b.className='hp-fill '+(pct>50?'hg':pct>20?'hm':'hl');
  document.getElementById(`hpv-${side}`).textContent=Math.max(0,f.currentHP);
}

function updatePPDots(f, side) {
  const c=document.getElementById(`ppd-${side}`);
  c.innerHTML='';
  const tMax=f.moves.reduce((a,m)=>a+m.maxPP,0);
  const tCur=f.moves.reduce((a,m)=>a+m.pp,0);
  const dots=Math.min(tMax,16);
  const lit=Math.round((tCur/tMax)*dots);
  for(let i=0;i<dots;i++){
    const d=document.createElement('div');
    d.className='pd '+(i<lit?'lit':'emp');
    c.appendChild(d);
  }
}

function addStatusBadge(side, text, color='#aaa') {
  const sb=document.getElementById(`sb-${side}`);
  const b=document.createElement('div');
  b.className='sbadge'; b.textContent=text; b.style.color=color; b.style.borderColor=color;
  sb.appendChild(b);
}

function clearStatusBadges(side) {
  document.getElementById(`sb-${side}`).innerHTML='';
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  MOVE PANEL
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function renderMovePanel() {
  const body=document.getElementById('mp-body');
  const hdrName=document.getElementById('mp-hdr-name');
  if(BS.bDead){ body.innerHTML=''; return; }
  const f=BS.bFighters[0], e=BS.bFighters[1];
  const locked = BS.bAutoOn || BS.bPhase!=='p1';
  if (BS.bAutoOn) hdrName.textContent='AUTO';
  else if (BS.bPhase==='p2') hdrName.textContent='CPU thinking...';
  else if (BS.bPhase==='p1') hdrName.textContent=f.name;
  else hdrName.textContent='...';

  const grid=document.createElement('div'); grid.className='move-grid';
  f.moves.forEach((m,i)=>{
    const eff=getEff(m.type,e.type,e.type2);
    let effHtml='';
    if(eff>=2) effHtml=`<span class="mb-eff eff-s">\u26A1 SUPER</span>`;
    else if(eff<=.5) effHtml=`<span class="mb-eff eff-w">\u26D4 WEAK</span>`;
    const btn=document.createElement('button');
    btn.className=`move-btn${m.pp<=0?' used-up':''}`;
    btn.style.setProperty('--mc',TC[m.type]);
    btn.disabled=locked || m.pp<=0;
    btn.innerHTML=`<span class="mb-name">${m.emoji} ${m.name}</span>
      <div class="mb-meta">
        <span class="mb-type ${TCC[m.type]}">${m.type}</span>
        ${m.effect && m.power===0
          ? `<span class="mb-stat" style="color:${STATUS_META[m.effect]?.color||'#aaa'}">\u2726 ${(STATUS_META[m.effect]?.label||'STATUS').toUpperCase()} ${m.effectTarget==='self'?'SELF':'FOE'}</span>`
          : `<span class="mb-stat">PWR <b>${m.power+(m.power>0?f.atkFlat||0:0)}</b></span><span class="mb-stat">ACC <b>${m.acc}%</b></span>`
        }
        <span class="mb-pp" style="margin-left:auto">PP <b>${m.pp}/${m.maxPP}</b></span>${effHtml}
      </div>
      <div class="mb-desc">${m.desc}</div>`;
    btn.onclick=()=>{ if (!locked) p1UsesMove(i); };
    grid.appendChild(btn);
  });
  body.innerHTML=''; body.appendChild(grid);
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  WILD EVENTS
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function maybeFireEvent() {
  if(BS.bRound<=2) return;
  if(BS.bRound-BS.lastEventRound<3) return;
  if(BS.rng()>0.28) return;
  const ev=WILD_EVENTS[Math.floor(BS.rng()*WILD_EVENTS.length)];
  BS.lastEventRound=BS.bRound;
  fireEvent(ev);
}

function fireEvent(ev) {
  // Show banner
  document.getElementById('eb-emoji').textContent=ev.emoji;
  document.getElementById('eb-title').textContent=ev.name;
  document.getElementById('eb-desc').textContent=ev.desc;
  const banner=document.getElementById('event-banner');
  banner.classList.add('show');
  document.getElementById('arena-bg').classList.add('event-active');
  setTimeout(()=>{ banner.classList.remove('show');
    setTimeout(()=>document.getElementById('arena-bg').classList.remove('event-active'),500);
  }, 3200);
  // Apply
  ev.apply(BS.eventState, BS.bFighters);
  log('ev', ev.log);
  // Handle immediate HP changes
  if(ev.id==='rain'||ev.id==='crowd'||ev.id==='swap') {
    BS.bFighters.forEach(f=>{ updateHP(f,f.side); });
  }
  if(ev.id==='goose') {
    const target=BS.bFighters[Math.floor(BS.rng()*2)];
    const dmg=25+Math.floor(BS.rng()*25);
    target.currentHP=Math.max(1,target.currentHP-dmg);
    updateHP(target,target.side);
    log('ev',`\uD83E\uDEBF The wild goose honks ${target.name} for ${dmg} damage!`);
    spawnPtcl(target.side,'#ff9800','\uD83E\uDEBF');
  }
  if(ev.id==='doubles'&&BS.eventState.doubledMove) {
    log('ev',`\uD83C\uDFB4 ${BS.eventState.doubledMove.fighter}'s "${BS.eventState.doubledMove.name}" power DOUBLED!`);
  }
  if(ev.id==='rage'&&BS.eventState.rageTarget) {
    addStatusBadge(BS.eventState.rageTarget,'\uD83D\uDE24 RAGE','#ff4444');
    log('ev',`\uD83D\uDE24 ${BS.bFighters.find(f=>f.side===BS.eventState.rageTarget)?.name} enters RAGE MODE (+50% ATK)!`);
  }
  if(ev.id==='wisdom') {
    BS.bFighters.forEach(f=>updatePPDots(f,f.side));
    log('ev','\uD83D\uDCDC All PP restored!');
  }
  if(ev.id==='gravity') addStatusBadge('left','\uD83C\uDF0C CERTAIN','#00c8ff'), addStatusBadge('right','\uD83C\uDF0C CERTAIN','#00c8ff');
  if(ev.id==='mirror') addStatusBadge('left','\uD83E\uDE9E MIRROR','#e040fb'), addStatusBadge('right','\uD83E\uDE9E MIRROR','#e040fb');
  if(ev.id==='amnesia') addStatusBadge('left','\u2754 NO TYPE','#aaa'), addStatusBadge('right','\u2754 NO TYPE','#aaa');
}

function tickEventState() {
  if(BS.eventState.duration>0){ BS.eventState.duration--; if(BS.eventState.duration<=0) delete BS.eventState.accuracyMod; }
  if(BS.eventState.typeIgnoredRounds>0){ BS.eventState.typeIgnoredRounds--; if(BS.eventState.typeIgnoredRounds<=0){ BS.typeOverride=false; BS.eventState.typeIgnored=false; BS.bFighters.forEach(f=>refreshStatusBadges(f)); log('n','\u2754 Type advantages return to normal.'); }}
  if(BS.eventState.guaranteeDur>0){ BS.eventState.guaranteeDur--; if(BS.eventState.guaranteeDur<=0){ delete BS.eventState.guaranteedHit; BS.bFighters.forEach(f=>refreshStatusBadges(f)); }}
  if(BS.eventState.rageDur>0){ BS.eventState.rageDur--; if(BS.eventState.rageDur<=0){ delete BS.eventState.rageTarget; delete BS.eventState.rageMod; BS.bFighters.forEach(f=>refreshStatusBadges(f)); log('n','\uD83D\uDE24 Rage fades.'); }}
  // Tick each fighter's status effects
  BS.bFighters.forEach(f => {
    const died = tickStatusEffects(f);
    if (died && !BS.bDead) endBattle(BS.bFighters.find(x=>x.side!==f.side), f);
  });
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  CATCH SYSTEM
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function updateCatchButton() {
  const btn = document.getElementById('btn-catch');
  if (!btn) return;
  const enemy = BS.bFighters[1];
  const stage = CAMPAIGN._currentStage;
  const hpThresh = stage?.isBoss ? 0.20 : 0.35;
  const canCatch = !BS.bDead
    && (BS.bPhase === 'p1')
    && !BS.bAutoOn
    && enemy && enemy.hpPct < hpThresh;
  btn.disabled = !canCatch;
  btn.style.color = stage?.isBoss ? '#ffd700' : '';
  btn.style.borderColor = stage?.isBoss ? '#ffd700' : '';
  btn.textContent = stage?.isBoss ? 'Y CATCH BOSS' : 'Y CATCH';
  btn.title = stage?.isBoss && enemy && enemy.hpPct >= 0.20 ? 'Weaken boss below 20% HP first (very hard to catch)'
    : !stage?.isBoss && enemy && enemy.hpPct >= 0.35 ? 'Weaken enemy below 35% HP first'
    : CAMPAIGN.party.length >= 6 ? 'Catch (will ask you to release one)'
    : '';
}

function tryCatch() {
  if (BS.bDead || BS.bPhase !== 'p1') return;
  const enemy = BS.bFighters[1];
  if (!enemy || enemy.isDead()) return;
  BS.bPhase = 'busy';
  renderMovePanel();

  const stage = CAMPAIGN._currentStage;
  const isBoss = stage?.isBoss;
  // Regular: 30% - 80% catch chance (from 35% HP down to 0)
  // Boss: 5% - 25% catch chance (from 20% HP down to 0)  -  extremely rare
  const catchChance = isBoss
    ? Math.min(25, Math.round(5 + (0.20 - enemy.hpPct) * 100))
    : Math.min(80, Math.round(30 + (0.35 - enemy.hpPct) * 200));
  log('ev', `Y Tossing a Honk-Ball at <b>${enemy.name}</b>!${isBoss ? ' <span style="color:var(--gold)">BOSS CATCH</span>' : ''} (${catchChance}% chance?)`);

  // Visual flash
  const flash = document.getElementById('catch-flash');
  if (flash) { flash.classList.add('show'); setTimeout(() => flash.classList.remove('show'), 500); }

  setTimeout(() => {
    if (BS.rng() * 100 <= catchChance) {
      onCatchSuccess(enemy);
    } else {
      log('w', `O ${enemy.name} broke free!`);
      // Pump the enemy on their FIRST escape, just once
      if (!enemy._catchFurious) {
        enemy._catchFurious = true;
        if (!enemy.statusEffects.pumped) {
          enemy.statusEffects.pumped = 2;
          refreshStatusBadges(enemy);
          log('ev', `Y~ ${enemy.name} is ENRAGED and attacks immediately!`);
        }
      }
      // Trigger the enemy's attack  -  failed catch counts as player's turn
      BS.bPhase = 'p2';
      renderMovePanel();
      setTimeout(() => {
        if (BS.bDead) return;
        const aiMove = BS.bFighters[1].aiPickMove(BS.bFighters[0]);
        BS.bPhase = 'busy';
        doMove(BS.bFighters[1], BS.bFighters[0], aiMove, () => {
          if (BS.bDead) return;
          tickEventState();
          BS.bPhase = 'p1';
          renderMovePanel();
          updateCatchButton();
        });
      }, 600);
    }
  }, 900);
}

function onCatchSuccess(enemy) {
  BS.bDead = true;
  stopAuto();
  syncActiveFighterToCampaign();
  // Animate enemy being caught
  setSpriteAnimClass('right', 'a-d');
  log('g', `Y <b>${enemy.name}</b> has been caught! Welcome to the party!`);

  // Build a clean copy of the caught honker
  const enemyBase = CAMPAIGN._currentStage?.enemy || enemy;
  const caught = {
    id: 'caught_' + Date.now(),
    name: enemy.name,
    emoji: enemy.emoji,
    type: enemy.type,
    type2: enemy.type2 || null,
    hp: Math.max(60, Math.round((enemyBase.hp || enemy.maxHP || 120) * 0.9)),
    // Slight random stat variance (?12%)  -  every catch is a little different
    atk: Math.round((enemyBase.atk||80) * (0.88 + BS.rng()*0.24)),
    def: Math.round((enemyBase.def||80) * (0.88 + BS.rng()*0.24)),
    spd: Math.round((enemyBase.spd||80) * (0.88 + BS.rng()*0.24)),
    assembledParts: enemy.assembledParts || null,
    luck: enemy.luck || 50,
    lore: 'A wild honker captured in the heat of battle.',
    moves: JSON.parse(JSON.stringify(enemy.moves)).map(m => ({ ...m, pp: m.maxPP })),
    maxHPBonus: 0, atkFlat: 0, atkMult: 1,
    luckBonus: 0, stabBonus: 1.25, chaosMod: 1, ppBonus: 0,
    passive: (CAMPAIGN._currentStage?.isBoss && CAMPAIGN._currentStage?.enemy?.passive) ? CAMPAIGN._currentStage.enemy.passive : null,
    level: Math.max(1, enemyBase.level || 1), xp: 0, xpNeeded: xpNeededForLevel(enemyBase.level || 1),
    totalXp: totalXpRequiredForLevel(Math.max(1, enemyBase.level || 1)),
    masteryLevel: 0, masteryXP: 0, masteryXPNeeded: masteryXpNeededForLevel(0), masteryTotalXp: 0,
    isCaught: true,
  };
  // Extract moveIds for save/load consistency
  caught.moveIds = caught.moves.map(m => m.id).filter(Boolean);
  // moveCandidates: known moves serve as re-learnable options in the teach overlay
  caught.moveCandidates = caught.moves.map(m => ({ ...m }));
  // Initialize run state: currentHP, movePP, persistentEffects
  initHonkerRunState(caught);
  // Don't push yet if full  -  handled after replace choice
  if (CAMPAIGN.party.length < 6) CAMPAIGN.party.push(caught);
  // Mark in dex as caught
  const caughtDexId = BS.bFighters[1]._dexId;
  if (caughtDexId) {
    if (!CAMPAIGN.dexSeen.includes(caughtDexId)) CAMPAIGN.dexSeen.push(caughtDexId);
    if (!CAMPAIGN.dexCaught.includes(caughtDexId)) CAMPAIGN.dexCaught.push(caughtDexId);
  }

  // Award XP (70% for catching)
  const stageN = CAMPAIGN._currentStageIdx + 1;
  CAMPAIGN.completedStages.push(CAMPAIGN._currentStageIdx);
  CAMPAIGN.stageIdx = CAMPAIGN._currentStageIdx + 1;
  CAMPAIGN.retries  = CAMPAIGN.maxRetries;
  if (stageN > (CAMPAIGN.deepest || 0)) {
    CAMPAIGN.deepest = stageN;
  }
  const xpGain = Math.round((CAMPAIGN._currentStage?.xpReward || 100) * 0.7);
  const coinGain = Math.round((CAMPAIGN._currentStage?.isBoss ? 60 : 24) + stageN * 2);
  CAMPAIGN.coins = (CAMPAIGN.coins || 0) + coinGain;
  const unlockedNow = grantCatchPartUnlocks(caught, enemy);
  if (CAMPAIGN._currentStage?.isBoss) {
    clearPartyPersistentEffects();
    fullRestorePartyAfterBoss();
  }
  CAMPAIGN.totalXP += xpGain;

  setTimeout(() => {
    addXP(xpGain, () => {
      saveCampaign();
      log('g', `\uD83E\uDE99 +${coinGain} coins earned.`);
      if (unlockedNow > 0) log('g', `\uD83E\uDDE9 Unlocked ${unlockedNow} new part${unlockedNow === 1 ? '' : 's'}!`);
      if (CAMPAIGN.party.includes(caught)) {
        showCaughtScreen(caught, xpGain);
      } else {
        // Party was full  -  ask player to replace
        showReplaceScreen(caught, xpGain);
      }
    });
  }, 1200);
}

function showCaughtScreen(caught, xpGain) {
  document.getElementById('loot-screen-title').textContent = '\uD83E\uDEA4 HONKER CAUGHT!';
  document.getElementById('loot-sub').textContent          = `${caught.name} joins your party!`;
  document.getElementById('loot-xp-msg').textContent       = `+${xpGain} XP \u2022 Party: ${CAMPAIGN.party.length}/6`;
  const grid = document.getElementById('loot-grid');
  grid.innerHTML = '';

  // Show the caught honker as a card
  const card = document.createElement('div');
  card.className = 'loot-card';
  card.style.setProperty('--rc', TC[caught.type]);
  card.innerHTML = `
    <span class="loot-card-emoji">${caught.emoji}</span>
    <div class="loot-rarity" style="color:${TC[caught.type]}">${caught.type.toUpperCase()} TYPE</div>
    <div class="loot-name">${caught.name}</div>
    <div class="loot-effect">
      \u2764\uFE0F HP <b>${caught.hp}</b> &nbsp; \uD83C\uDF40 Luck <b>${caught.luck}%</b><br>
      <span style="color:var(--dim);font-size:.72rem">${caught.moves.map(m=>`${m.emoji} ${m.name}`).join(' \u00B7 ')}</span>
    </div>`;
  card.onclick = () => {
    CAMPAIGN.activeIdx = CAMPAIGN.party.length - 1;
    CAMPAIGN.playerBase = caught;
    document.getElementById('loot-skip').click();
  };
  card.title = 'Click to make this your active fighter';
  grid.appendChild(card);

  // Also offer to pick a stat loot item
  const statChoices = pickLootChoices(2);
  statChoices.forEach(item => {
    const sc = document.createElement('div');
    sc.className = 'loot-card';
    sc.style.setProperty('--rc', item.color);
    sc.innerHTML = `
      <span class="loot-card-emoji">${item.emoji}</span>
      <div class="loot-rarity rarity-${item.rarity}">${item.rarity.toUpperCase()}</div>
      <div class="loot-name">${item.name}</div>
      <div class="loot-effect">${item.desc}</div>`;
    sc.onclick = () => chooseLoot(item);
    grid.appendChild(sc);
  });

  document.getElementById('loot-skip').textContent = '\u2192 Continue to map';
  renderLootShop();
  showScreen('screen-loot');
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  BATTLE END
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function endBattle(winner, loser) {
  BS.bDead=true;
  stopAuto();
  setTimeout(()=>{
    setSpriteAnimClass(loser.side, 'a-d');
    log('x',`\uD83D\uDC80 <b>${loser.name}</b> has been honked into oblivion!`);
    log('g',`\uD83C\uDFC6 <b style="color:${TC[winner.type]}">${winner.name}</b> WINS THE BATTLE!`);
    const playerWon = winner.side==='left';
    setTimeout(()=>{
      if(playerWon) onPlayerWin(winner);
      else onPlayerLose(loser);
    }, 1500);
  }, 450);
}

function onPlayerWin(player) {
  const stage    = CAMPAIGN._currentStage;
  const stageN   = CAMPAIGN._currentStageIdx + 1;
  syncActiveFighterToCampaign();

  CAMPAIGN.completedStages.push(CAMPAIGN._currentStageIdx);
  CAMPAIGN.stageIdx = CAMPAIGN._currentStageIdx + 1;
  CAMPAIGN.retries  = CAMPAIGN.maxRetries; // reset retries for next stage

  // Track deepest stage reached for run progression/high score
  if (stageN > (CAMPAIGN.deepest||0)) {
    CAMPAIGN.deepest = stageN;
  }

  const xpGain = stage.xpReward;
  const coinGain = Math.round((stage?.isBoss ? 75 : 30) + stageN * 2);
  CAMPAIGN.coins = (CAMPAIGN.coins || 0) + coinGain;
  CAMPAIGN.totalXP += xpGain;
  if (stage.isBoss) {
    clearPartyPersistentEffects();
    fullRestorePartyAfterBoss();
  }

  addXP(xpGain, () => {
    saveCampaign();
      log('g', `\uD83E\uDE99 +${coinGain} coins earned.`);
    if (stage.isBoss) {
      showBossClear(stage, stageN, xpGain);
    } else {
      showLootScreen(xpGain);
    }
  });
}

function onPlayerLose(player) {
  BS.bSwapMode = false;
  closeLootPartyOverlay();
  // Keep fainted honkers in party so they still count toward the 6-slot cap.
  const faintedIdx = CAMPAIGN.activeIdx;
  const fainted = CAMPAIGN.party[faintedIdx];
  syncActiveFighterToCampaign();
  if (fainted) clearPersistentEffects(fainted);
  if (fainted) fainted.currentHP = 0;
  CAMPAIGN.playerBase = CAMPAIGN.party[CAMPAIGN.activeIdx] || CAMPAIGN.playerBase;
  saveCampaign();
  log('x', `\uD83D\uDC80 <b>${fainted ? fainted.name : 'Your honker'}</b> has fainted...`);

  const alive = CAMPAIGN.party
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => currentHpForSelection(h) > 0);
  if (alive.length > 0) {
    // Switch to next available member
    showSwitchOverlay(alive, 'faint');
  } else {
    // No more honkers
    CAMPAIGN.retries--;
    buildRetryIcons();
    if (CAMPAIGN.retries > 0) { showGameOverRetry(); }
    else { showGameOver(); }
  }
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  RELEASE & REPLACE
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
// _pendingCaught is now BS._pendingCaught

function releaseHonker(idx, confirm=true, trackAsFallen=false) {
  if (CAMPAIGN.party.length <= 0) return;
  const h = CAMPAIGN.party[idx];
  if (!h) return;
  if (confirm && !window.confirm(`Release ${h.name}? This cannot be undone.`)) return;
  if (trackAsFallen) {
    const fallenCopy = JSON.parse(JSON.stringify(h));
    fallenCopy.currentHP = 0;
    CAMPAIGN.fallen = CAMPAIGN.fallen || [];
    CAMPAIGN.fallen.push(fallenCopy);
  }
  CAMPAIGN.party.splice(idx, 1);
  // Adjust active index
  if (CAMPAIGN.activeIdx >= CAMPAIGN.party.length) {
    CAMPAIGN.activeIdx = Math.max(0, CAMPAIGN.party.length - 1);
  } else if (CAMPAIGN.activeIdx > idx) {
    CAMPAIGN.activeIdx--;
  }
  CAMPAIGN.playerBase = CAMPAIGN.party[CAMPAIGN.activeIdx] || null;
  saveCampaign();
  if (document.getElementById('screen-campaign').classList.contains('active')) {
    refreshCampaignSidebar();
  }
}

function showReplaceScreen(caughtHonker, xpGain) {
  BS._pendingCaught = { honker: caughtHonker, xpGain };
  const newCard = document.getElementById('rep-new-card');
  newCard.innerHTML = `
    <span class="rep-new-emoji">${caughtHonker.emoji}</span>
    <div style="font-family:'Press Start 2P',monospace;font-size:.36rem;color:var(--gold)">${caughtHonker.name}</div>
    <div style="font-size:.7rem;font-weight:700;color:${TC[caughtHonker.type]}">${caughtHonker.type}</div>
    <div style="font-size:.65rem;color:var(--dim);margin-top:.2rem">\u2764\uFE0F ${caughtHonker.hp} &nbsp; \uD83C\uDF40 ${caughtHonker.luck}%</div>
  `;
  const grid = document.getElementById('rep-grid');
  grid.innerHTML = '';
  CAMPAIGN.party.forEach((h, i) => {
    const card = document.createElement('div');
    card.className = 'rep-card';
    const passiveTxt = h.passive ? `<div class="rep-hint">${h.passive.emoji} ${h.passive.name}</div>` : '';
    const activeTag = i === CAMPAIGN.activeIdx ? '<div class="rep-hint" style="color:var(--gold)">- ACTIVE</div>' : '';
    card.innerHTML = `
      <span class="rep-emoji">${h.emoji}</span>
      <div class="rep-name">${h.name}</div>
      <div class="rep-type" style="color:${TC[h.type]}">${h.type}</div>
      ${activeTag}
      ${passiveTxt}
    `;
    card.onclick = () => confirmReplace(i);
    grid.appendChild(card);
  });
  document.getElementById('replace-overlay').classList.add('show');
}

function confirmReplace(replaceIdx) {
  document.getElementById('replace-overlay').classList.remove('show');
  if (!BS._pendingCaught) return;
  const { honker, xpGain } = BS._pendingCaught;
  BS._pendingCaught = null;
  // Remove the chosen one
  CAMPAIGN.party.splice(replaceIdx, 1);
  if (CAMPAIGN.activeIdx >= CAMPAIGN.party.length) {
    CAMPAIGN.activeIdx = Math.max(0, CAMPAIGN.party.length - 1);
  } else if (CAMPAIGN.activeIdx > replaceIdx) {
    CAMPAIGN.activeIdx--;
  }
  // Add the new one
  CAMPAIGN.party.push(honker);
  CAMPAIGN.playerBase = CAMPAIGN.party[CAMPAIGN.activeIdx];
  saveCampaign();
  showCaughtScreen(honker, xpGain);
}

function skipReplace() {
  document.getElementById('replace-overlay').classList.remove('show');
  if (!BS._pendingCaught) return;
  const { xpGain } = BS._pendingCaught;
  BS._pendingCaught = null;
  // New honker is released  -  just go to loot/map
  showLootScreen(xpGain);
}

function showSwitchOverlay(aliveMembers, reason='faint') {
  const overlay = document.getElementById('switch-overlay');
  const ttl = document.querySelector('#switch-overlay .sw-title');
  const sub = document.getElementById('sw-sub');
  const grid = document.getElementById('sw-grid');
  if (!overlay || !sub || !grid) {
    console.error('[SWITCH] Overlay elements missing; auto-selecting first alive honker');
    const fallback = aliveMembers?.[0];
    if (fallback && Number.isInteger(fallback.i)) switchInPartyMember(fallback.i);
    return;
  }
  if (ttl) ttl.textContent = reason === 'swap' ? '\uD83D\uDD01 SWITCH HONKER' : '\u26A0 HONKER FAINTED!';
  sub.textContent = reason === 'swap'
    ? 'Choose a party member to switch in. Switching consumes your turn.'
    : aliveMembers.length + ' honker' + (aliveMembers.length > 1 ? 's' : '') + ' remaining  -  choose your next fighter!';
  grid.innerHTML = '';
  aliveMembers.forEach(function({ h, i }) {
    const card = document.createElement('div');
    card.className = 'sw-card';
    const passiveTxt = h.passive ? '<div class="sw-passive">' + h.passive.emoji + ' ' + h.passive.name + '</div>' : '';
    const maxHpVal = getHonkerMaxHP(h);
    const curHpVal = Math.max(0, Math.min(maxHpVal, h.currentHP ?? maxHpVal));
    card.innerHTML = '<span class="sw-emoji">' + h.emoji + '</span><div class="sw-name">' + h.name + '</div><div class="sw-type" style="color:' + TC[h.type] + '">' + h.type + '</div><div class="sw-hp">HP ' + curHpVal + '/' + maxHpVal + '</div>' + passiveTxt;
    card.onclick = (function(idx){ return function(){ switchInPartyMember(idx); }; })(i);
    grid.appendChild(card);
  });
  overlay.classList.add('show');
}

function switchInPartyMember(partyIdx) {
  const oldIdx = CAMPAIGN.activeIdx;
  if (BS.bSwapMode) {
    syncActiveFighterToCampaign();
    clearPersistentEffects(CAMPAIGN.party[oldIdx]);
  }
  document.getElementById('switch-overlay').classList.remove('show');
  CAMPAIGN.activeIdx = partyIdx;
  CAMPAIGN.playerBase = CAMPAIGN.party[partyIdx];
  const pb = CAMPAIGN.playerBase;
  const pBoosts = {
    maxHPBonus: pb.maxHPBonus||0, atkFlat: pb.atkFlat||0, atkMult: pb.atkMult||1,
    luckBonus: pb.luckBonus||0, stabBonus: pb.stabBonus||1.25,
    chaosMod: pb.chaosMod||1, ppBonus: pb.ppBonus||0, level: pb.level||1,
    currentHP: pb.currentHP ?? getHonkerMaxHP(pb),
    movePP: pb.movePP || null,
    persistentEffects: pb.persistentEffects || null,
  };
  const newFighter = new Honker(JSON.parse(JSON.stringify(pb)), 'left', pBoosts);
  BS.bFighters[0] = newFighter;
  BS.bDead = false; BS.bPhase = 'p1';
  setupFighterUI(newFighter, 'left');
  resetSpriteClass('left');
  if (pb.passive && pb.passive.id === 'cursed_aura' && !BS.bFighters[1].statusEffects.cursed) {
    BS.bFighters[1].statusEffects.cursed = 2; refreshStatusBadges(BS.bFighters[1]);
  }
  if (pb.passive && pb.passive.id === 'shield_wall') {
    newFighter.statusEffects.shielded = Math.max(1, Math.min(4, (newFighter.statusEffects.shielded || 0) + 1)); refreshStatusBadges(newFighter);
  }
  const ps = document.getElementById('passive-left');
  if (pb.passive) { ps.textContent = pb.passive.emoji + ' ' + pb.passive.name; ps.style.display = ''; }
  else { ps.style.display = 'none'; }
  log('ev', '<b style="color:' + TC[pb.type] + '">' + pb.name + '</b> enters the arena!');
  renderMovePanel(); updateCatchButton();
  if (BS.bSwapMode) {
    BS.bSwapMode = false;
    BS.bPhase = 'p2';
    renderMovePanel();
    setTimeout(() => {
      if (BS.bDead) return;
      const aiMove = BS.bFighters[1].aiPickMove(BS.bFighters[0]);
      BS.bPhase = 'busy';
      doMove(BS.bFighters[1], BS.bFighters[0], aiMove, () => {
        if (BS.bDead) return;
        tickEventState();
        BS.bPhase = 'p1';
        renderMovePanel();
        updateCatchButton();
      });
    }, 420);
  }
}

function openBattleSwap() {
  if (BS.bDead || BS.bPhase !== 'p1' || BS.bAutoOn) return;
  const currentIdx = CAMPAIGN.activeIdx;
  const options = CAMPAIGN.party
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => i !== currentIdx && currentHpForSelection(h) > 0);
  if (!options.length) {
    log('w', 'No other healthy party member is available to swap.');
    return;
  }
  BS.bSwapMode = true;
  showSwitchOverlay(options, 'swap');
}

function showGameOverRetry() {
  const stage = CAMPAIGN._currentStage || { name:'Unknown' };
  const go=document.getElementById('screen-gameover');
  go.querySelector('.over-title').textContent='DEFEATED...';
  go.querySelector('.over-title').style.color='#ff5252';
  go.querySelector('.over-sub').textContent=`${CAMPAIGN.retries} RETR${CAMPAIGN.retries===1?'Y':'IES'} REMAINING`;
  const stats=document.getElementById('go-stats');
  stats.innerHTML=`
    <div class="os-row"><span>Stage</span><b>${stage.name}</b></div>
    <div class="os-row"><span>Rounds fought</span><b>${BS.bRound}</b></div>
    <div class="os-row"><span>Your HP left</span><b>${BS.bFighters[0]?.currentHP||0}/${BS.bFighters[0]?.maxHP||0}</b></div>
    <div class="os-row"><span>Retries left</span><b style="color:#ff5252">${CAMPAIGN.retries} \u2764\uFE0F</b></div>
    <div style="font-size:.72rem;color:var(--dim);margin-top:.5rem">You'll return with 40% HP. Items and XP are safe.</div>
  `;
  go.querySelector('.btn-gold').style.display='';
  showScreen('screen-gameover');
}

function showGameOver() {
  const stage = CAMPAIGN._currentStage || { name:'Unknown' };
  const go=document.getElementById('screen-gameover');
  go.querySelector('.over-title').textContent='HONKED TO OBLIVION';
  go.querySelector('.over-title').style.color='#ff2222';
  go.querySelector('.over-sub').textContent='ALL RETRIES EXHAUSTED';
  const stats=document.getElementById('go-stats');
  stats.innerHTML=`
    <div class="os-row"><span>Fell at Stage</span><b>${CAMPAIGN._currentStageIdx+1}  -  ${stage.name}</b></div>
    <div class="os-row"><span>Level Reached</span><b>LV ${CAMPAIGN.level}</b></div>
    <div class="os-row"><span>Total XP</span><b>${CAMPAIGN.totalXP}</b></div>
    <div class="os-row"><span>Items Collected</span><b>${CAMPAIGN.inventory.length}</b></div>
    <div class="os-row"><span>Deepest Stage</span><b style="color:var(--gold)">${CAMPAIGN.deepest||1}</b></div>
  `;
  go.querySelector('.btn-gold').style.display='none';
  CAMPAIGN.started = false;
  const contBtn = document.getElementById('cont-btn');
  if (contBtn) contBtn.style.display = 'none';
  clearCampaignSave();
  showScreen('screen-gameover');
}

function restartFromStage() {
  if (!CAMPAIGN.party.length && CAMPAIGN._retryCandidate) {
    const h = JSON.parse(JSON.stringify(CAMPAIGN._retryCandidate));
    h.currentHP = Math.max(1, Math.round(getHonkerMaxHP(h) * 0.4));
    h.persistentEffects = {};
    CAMPAIGN.party = [h];
    CAMPAIGN.activeIdx = 0;
    CAMPAIGN.playerBase = h;
  }
  if (CAMPAIGN.playerBase) {
    CAMPAIGN._savedPlayerHP = Math.max(1, Math.round(getHonkerMaxHP(CAMPAIGN.playerBase) * 0.4));
  }
  startStageBattle(CAMPAIGN._currentStageIdx, true);
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  ANIMATIONS
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function animAtk(aSide,dSide){
  const a=document.getElementById(`spr-${aSide}`);
  const d=document.getElementById(`spr-${dSide}`);
  resetSpriteClass(aSide); void a.offsetWidth;
  setSpriteAnimClass(aSide, `a-${aSide==='left'?'l':'r'}`);
  setTimeout(()=>{ resetSpriteClass(dSide); void d.offsetWidth; setSpriteAnimClass(dSide, 'a-h');
    setTimeout(()=>{ resetSpriteClass(dSide); }, 520);
  },265);
  setTimeout(()=>{ resetSpriteClass(aSide); },570);
}

function shakeSpr(side){
  const el=document.getElementById(`spr-${side}`);
  const base=side==='right'?'scaleX(-1) ':'';
  el.style.transition='transform .13s'; el.style.transform=base+'translateX(6px)';
  setTimeout(()=>el.style.transform=base+'translateX(-4px)',130);
  setTimeout(()=>{ el.style.transform=''; el.style.transition=''; },260);
}

function showClash(emoji){
  const el=document.getElementById('clash-fx');
  el.textContent=emoji; el.className='clash-fx'; void el.offsetWidth; el.className='clash-fx show';
  setTimeout(()=>el.className='clash-fx',700);
}

function showToast(type,text){
  const t=document.getElementById('eff-toast');
  t.textContent=text; t.className=type==='super'?'es':'en';
  t.className+=' show'; void t.offsetWidth;
  setTimeout(()=>t.className=type==='super'?'es':'en',2100);
}

function spawnPtcl(side,color,emoji){
  const layer=document.getElementById('ptcl');
  const zone=document.getElementById(`zone-${side}`);
  const arEl=document.getElementById('arena');
  if(!layer||!zone||!arEl) return;
  const ar=arEl.getBoundingClientRect();
  const zr=zone.getBoundingClientRect();
  const cx=zr.left-ar.left+zr.width/2, cy=zr.top-ar.top+zr.height*.3;
  for(let i=0;i<14;i++){
    const p=document.createElement('div'); p.className='particle';
    const a=Math.random()*Math.PI*2, d=28+Math.random()*65, sz=3+Math.random()*6, dur=.32+Math.random()*.42;
    p.style.cssText=`left:${cx-sz/2}px;top:${cy-sz/2}px;width:${sz}px;height:${sz}px;background:${color};box-shadow:0 0 ${sz}px ${color};--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-22}px;--dur:${dur}s;`;
    layer.appendChild(p); setTimeout(()=>p.remove(),dur*1000+80);
  }
  const em=document.createElement('div');
  em.style.cssText=`position:absolute;left:${cx}px;top:${cy}px;font-size:1.8rem;pointer-events:none;animation:clashPop .5s ease-out forwards;transform-origin:center;`;
  em.textContent=emoji; layer.appendChild(em); setTimeout(()=>em.remove(),580);
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  LOG
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function log(t,html){
  const el=document.createElement('div');
  el.className=`le t-${t}`; el.innerHTML=html;
  const c=document.getElementById('log');
  if (!c) { console.warn('log element not found'); return; }
  if (!c.appendChild) { console.warn('log element has no appendChild'); return; }
  c.appendChild(el);
  setTimeout(()=>{ if(c && c.scrollTop !== undefined) c.scrollTop=c.scrollHeight; },50);
}
