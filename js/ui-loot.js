// ============================================================================
// HonkaRogue Loot Module (js/ui-loot.js)
// Loot screen, shop, item teaching, boss clear, and post-battle flow
// ============================================================================

function showLootScreen(xpGain) {
  closeLootPartyOverlay();
  document.getElementById('loot-screen-title').textContent = '\u2694 VICTORY SPOILS \u2694';
  document.getElementById('loot-sub').textContent          = 'Choose one item to keep';
  document.getElementById('loot-skip').textContent         = 'Skip (take nothing)';
  const _pb = CAMPAIGN.playerBase;
  document.getElementById('loot-xp-msg').textContent = `+${xpGain} XP EARNED \u2022 ${_pb ? _pb.name : ''} NOW LV ${_pb ? (_pb.level||1) : 1}`;
  const grid=document.getElementById('loot-grid');
  grid.innerHTML='';
  // Pick 3 random items (weighted toward common, with rare and legendary as surprises)
  const choices=pickLootChoices(3);
  choices.forEach(item=>{
    const card=document.createElement('div');
    card.className='loot-card';
    card.style.setProperty('--rc',item.color);
    card.innerHTML=`
      <span class="loot-card-emoji">${item.emoji}</span>
      <div class="loot-rarity rarity-${item.rarity}">${item.rarity.toUpperCase()}</div>
      <div class="loot-name">${item.name}</div>
      <div class="loot-effect">${item.desc}</div>`;
    card.onclick=()=>chooseLoot(item);
    grid.appendChild(card);
    // Pop in with stagger
    card.style.opacity='0';
    card.style.transform='scale(.8)';
    setTimeout(()=>{ card.style.transition='all .35s ease-out'; card.style.opacity='1'; card.style.transform='scale(1)'; }, 200);
  });
  renderLootShop();
  showScreen('screen-loot');
}

const SHOP_COSTS = { heal: 16, pp: 14, revive: 45 };
function canAffordCoins(cost) { return (CAMPAIGN.coins || 0) >= cost; }
function spendCoins(cost) {
  if (!canAffordCoins(cost)) return false;
  CAMPAIGN.coins -= cost;
  return true;
}
function renderLootShop() {
  const shop = document.getElementById('loot-shop');
  if (!shop) return;
  const pb = CAMPAIGN.playerBase;
  const maxHP = getHonkerMaxHP(pb);
  const curHP = pb?.currentHP ?? maxHP;
  const hpHeal = Math.max(22, Math.round(maxHP * 0.35));
  const faintedCount = (CAMPAIGN.party || []).filter(h => (h.currentHP ?? getHonkerMaxHP(h)) <= 0).length;
  const canRevive = faintedCount > 0;
  shop.innerHTML = `
    <div class="loot-shop-title">SHOP \u2022 \uD83E\uDE99 ${(CAMPAIGN.coins || 0)} COINS</div>
    <div class="loot-shop-row">
      <div>\u2764\uFE0F Field Ration (+${hpHeal} HP) <span style="color:var(--dim)">[${curHP}/${maxHP}]</span></div>
      <button class="btn btn-blue loot-shop-buy" onclick="buyLootHeal()" ${canAffordCoins(SHOP_COSTS.heal) ? '' : 'disabled'}>BUY ${SHOP_COSTS.heal}</button>
    </div>
    <div class="loot-shop-row">
      <div>\uD83C\uDF31 PP Seed (restore +4 PP to each move)</div>
      <button class="btn btn-blue loot-shop-buy" onclick="buyLootPP()" ${canAffordCoins(SHOP_COSTS.pp) ? '' : 'disabled'}>BUY ${SHOP_COSTS.pp}</button>
    </div>
    <div class="loot-shop-row">
      <div>\uD83E\uDEBD Revive Honker <span style="color:var(--dim)">[fainted ${faintedCount}]</span></div>
      <button class="btn btn-gold loot-shop-buy" onclick="buyLootRevive()" ${(canRevive && canAffordCoins(SHOP_COSTS.revive)) ? '' : 'disabled'}>BUY ${SHOP_COSTS.revive}</button>
    </div>
  `;
}
function buyLootHeal() {
  const pb = CAMPAIGN.playerBase;
  if (!pb || !spendCoins(SHOP_COSTS.heal)) return;
  const maxHP = getHonkerMaxHP(pb);
  const heal = Math.max(22, Math.round(maxHP * 0.35));
  pb.currentHP = Math.min(maxHP, (pb.currentHP ?? maxHP) + heal);
  log('g', `\u2764\uFE0F ${pb.name} recovered ${heal} HP.`);
  saveCampaign();
  refreshCampaignSidebar();
  renderLootShop();
}
function buyLootPP() {
  const pb = CAMPAIGN.playerBase;
  if (!pb || !spendCoins(SHOP_COSTS.pp)) return;
  const map = pb.movePP || {};
  (pb.moves || []).forEach(m => {
    const cur = map[m.id] ?? map[m.name] ?? m.maxPP;
    map[m.id || m.name] = Math.min(m.maxPP, cur + 4);
  });
  pb.movePP = map;
  log('g', `\uD83C\uDF31 ${pb.name}'s PP was restored.`);
  saveCampaign();
  refreshCampaignSidebar();
  renderLootShop();
}
function buyLootRevive() {
  const faintedCount = (CAMPAIGN.party || []).filter(h => (h.currentHP ?? getHonkerMaxHP(h)) <= 0).length;
  if (faintedCount <= 0) return;
  if (!canAffordCoins(SHOP_COSTS.revive)) return;
  showLootPartyOverlay('revive');
}

function pickLootChoices(n) {
  // Collect all moveIds available on party members' assembled parts
  const partyMoveIds = new Set();
  (CAMPAIGN.party || []).forEach(h => {
    if (!h.assembledParts) return;
    for (const slot of ['head', 'torso', 'wings', 'legs']) {
      const part = h.assembledParts[slot];
      if (part?.moveIds) part.moveIds.forEach(id => partyMoveIds.add(id));
    }
  });
  // Filter move loot to only moves that exist on at least one party member's parts
  const pool = LOOT_POOL.filter(item => !item.moveId || partyMoveIds.has(item.moveId));
  // Weighted: legendary = 8%, rare = 28%, common = 64%
  const weights = pool.map(i=>i.rarity==='legendary'?8:i.rarity==='rare'?28:64);
  const _lootRunSeed = Number.isFinite(Number(CAMPAIGN?.runSeed)) ? (Number(CAMPAIGN.runSeed) >>> 0) : 0;
  const _lootRng = seededRng((((CAMPAIGN.stageIdx + 1) * 4057 + 77777) ^ _lootRunSeed) >>> 0);
  const chosen=[];
  const used=new Set();
  while(chosen.length<n && chosen.length<pool.length){
    const total=weights.reduce((a,w,i)=>used.has(i)?a:a+w,0);
    let r=_lootRng()*total, idx=0;
    for(let i=0;i<pool.length;i++){
      if(used.has(i)) continue;
      r-=weights[i]; if(r<=0){ idx=i; break; }
    }
    used.add(idx); chosen.push(pool[idx]);
  }
  return chosen;
}

// Global for pending move teach
let _pendingMoveItem = null;
let _lootPartyMode = 'manage';

function chooseLoot(item) {
  // Non-global items need a target when party > 1.
  if (CAMPAIGN.party.length > 1 && !item?.global) {
    _pendingMoveItem = item;
    showTeachOverlay(item);
    return;
  }
  applyLootItem(item);
}

function showLootPartyOverlay(mode = 'manage') {
  _lootPartyMode = mode;
  buildLootPartyOverlay();
  const overlay = document.getElementById('loot-party-overlay');
  if (overlay) overlay.classList.add('show');
}

function closeLootPartyOverlay() {
  const overlay = document.getElementById('loot-party-overlay');
  if (overlay) overlay.classList.remove('show');
}

function buildLootPartyOverlay() {
  const grid = document.getElementById('loot-party-grid');
  if (!grid) return;
  const titleEl = document.querySelector('#loot-party-overlay .lp-title');
  const subEl = document.querySelector('#loot-party-overlay .lp-sub');
  if (titleEl) titleEl.textContent = _lootPartyMode === 'revive' ? '\uD83E\uDEBD CHOOSE REVIVE TARGET' : '\uD83D\uDC65 CURRENT PARTY';
  if (subEl) subEl.textContent = _lootPartyMode === 'revive'
    ? `Pick one fainted honker to revive for ${SHOP_COSTS.revive} coins.`
    : 'Fainted honkers still occupy party slots. Release to free a slot.';
  grid.innerHTML = '';
  const canReleaseAny = (CAMPAIGN.party?.length || 0) > 1;
  CAMPAIGN.party.forEach((h, idx) => {
    const maxHp = getHonkerMaxHP(h);
    const curHp = Math.max(0, Math.min(maxHp, h.currentHP ?? maxHp));
    const isActive = idx === CAMPAIGN.activeIdx;
    const isFainted = curHp <= 0;
    const card = document.createElement('div');
    card.className = 'lp-card';
    card.style.setProperty('--lc', TC[h.type] || '#aaaacc');
    card.innerHTML = `
      <div class="lp-top">
        <span class="lp-emoji">${h.emoji || '\uD83E\uDEBF'}</span>
        <div>
          <div class="lp-name">${h.name || 'Unknown'}</div>
          <div class="lp-type" style="color:${TC[h.type] || '#aaaacc'}">${h.type || 'Normal'} \u2022 LV ${h.level || 1}</div>
        </div>
      </div>
      <div class="lp-stats">\u2764\uFE0F ${curHp}/${maxHp} &nbsp; \u2694\uFE0F ${h.atk || 80} &nbsp; \uD83D\uDEE1\uFE0F ${h.def || 80} &nbsp; \u26A1 ${h.spd || 80} &nbsp; \uD83C\uDF40 ${h.luck || 50}%</div>
      <div class="lp-row">
        ${isActive ? '<span class="lp-badge">ACTIVE</span>' : ''}
        ${isFainted ? '<span class="lp-badge lp-ko">FAINTED</span>' : ''}
        ${_lootPartyMode === 'revive'
          ? `<button class="btn btn-gold lp-release" ${isFainted ? '' : 'disabled'}>REVIVE</button>`
          : `<button class="btn btn-red lp-release" ${canReleaseAny ? '' : 'disabled'}>RELEASE</button>`
        }
      </div>
    `;
    const btn = card.querySelector('.lp-release');
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (_lootPartyMode === 'revive') {
          if (!isFainted) return;
          if (!spendCoins(SHOP_COSTS.revive)) return;
          h.currentHP = Math.max(1, Math.round(getHonkerMaxHP(h) * 0.6));
          if (!h.movePP) {
            h.movePP = {};
            (h.moves || []).forEach(m => { h.movePP[m.id || m.name] = Math.max(1, Math.ceil(m.maxPP * 0.5)); });
          }
          log('g', `\uD83E\uDEBD ${h.name} was revived.`);
          closeLootPartyOverlay();
          saveCampaign();
          refreshCampaignSidebar();
          renderLootShop();
          return;
        }
        if (!canReleaseAny) return;
        if (!window.confirm(`Release ${h.name}? This cannot be undone.`)) return;
        releaseHonker(idx, false, false);
        buildLootPartyOverlay();
      };
    }
    grid.appendChild(card);
  });
}

function applyLootItem(item, targetHonker) {
  const target = targetHonker || CAMPAIGN.playerBase;
  const isMove = !!item?.moveId;
  if (isMove && target && Array.isArray(target.moves) && target.moves.length >= 4) {
    const partyIdx = Math.max(0, CAMPAIGN.party.indexOf(target));
    showReplaceMove(target, partyIdx, item);
    return;
  }
  item.apply(target);
  const record = { ...item, taughtTo: target?.name };
  if (item.global) {
    // Global items go to the shared run inventory
    CAMPAIGN.inventory.push(record);
  } else {
    // Per-honker items stored on the honker itself
    if (!target.inventory) target.inventory = [];
    target.inventory.push(record);
  }
  const who = item.global ? '' : (target ? target.emoji + ' <b>' + target.name + '</b> ' : '');
  log('g', `\uD83C\uDF81 ${who}received: ${item.emoji} <b>${item.name}</b>!`);
  closeLootPartyOverlay();
  afterLoot();
}

function showTeachOverlay(item) {
  const preview = document.getElementById('teach-move-preview');
  // Build a move object from the item to show stats
  // For move items, show move stats. For stat items, show the description.
  const isMoveLoot = !!item?.moveId;
  if (isMoveLoot) {
    const tmpHonker = { moves: [], maxHPBonus:0, atkFlat:0 };
    item.apply(tmpHonker);
    const learnedMove = tmpHonker.moves[0];
    preview.innerHTML = `
      <div style="font-size:1.6rem">${item.emoji}</div>
      <div style="font-family:'Press Start 2P',monospace;font-size:.45rem;color:var(--gold);margin:.3rem 0">${item.name}</div>
      ${learnedMove ? `<div style="font-size:.75rem;color:var(--dim)">${learnedMove.desc || ''}</div>
        <div style="font-size:.7rem;margin-top:.3rem;color:var(--text)">
          ${learnedMove.power > 0 ? 'PWR <b>' + learnedMove.power + '</b> &nbsp;' : ''}ACC <b>${learnedMove.acc}%</b> &nbsp; PP <b>${learnedMove.pp}</b>
        </div>` : ''}
    `;
  } else {
    preview.innerHTML = `
      <div style="font-size:1.6rem">${item.emoji}</div>
      <div style="font-family:'Press Start 2P',monospace;font-size:.45rem;color:${item.color||'var(--gold)'};margin:.3rem 0">${item.name}</div>
      <div style="font-size:.8rem;color:var(--dim);line-height:1.5">${item.desc}</div>
    `;
  }

  const grid = document.getElementById('teach-grid');
  grid.innerHTML = '';
  CAMPAIGN.party.forEach((h, i) => {
    // Grey out honkers that can't learn this move (signature exclusivity or parts mismatch)
    const exclusive = item.exclusiveTo;
    const isMoveLoot = !!item?.moveId;
    const hasOnParts = !isMoveLoot || (h.assembledParts && ['head','torso','wings','legs'].some(
      slot => h.assembledParts[slot]?.moveIds?.includes(item.moveId)
    ));
    const ineligible = (exclusive && !exclusive.includes(h.id)) || (isMoveLoot && !hasOnParts);
    const card = document.createElement('div');
    const isFull = !ineligible && h.moves.length >= 4;
    card.className = 'teach-card' + (isFull ? ' tc-full' : '') + (ineligible ? ' tc-ineligible' : '');
    const moveRows = h.moves.map(m =>
      `<div class="teach-move-row"><span>${m.emoji} ${m.name}</span></div>`
    ).join('');
    card.innerHTML = `
      <span class="teach-emoji">${h.emoji}</span>
      <div class="teach-name">${h.name}</div>
      <div class="teach-type" style="color:${window.TC ? window.TC[h.type] : '#aaa'}">${h.type} \u00B7 LV ${h.level||1}</div>
      <div class="teach-moves">${moveRows}</div>
      ${isFull ? '<div style="font-size:.55rem;color:#ff9800;margin-top:.3rem">\u26A0 Will replace a move</div>' : ''}
    `;
    card.onclick = ineligible ? null : () => teachMoveTo(i);
    if (ineligible) card.title = 'Only specific honkers can learn this move';
    grid.appendChild(card);
  });

  // Update overlay title based on item type
  const isMove = !!item?.moveId;
  document.querySelector('#teach-overlay .teach-title').textContent = isMove ? '\uD83D\uDCDA WHO LEARNS THIS MOVE?' : '\uD83C\uDF81 WHO GETS THIS ITEM?';
  document.getElementById('teach-overlay').classList.add('show');
}

function teachMoveTo(partyIdx) {
  document.getElementById('teach-overlay').classList.remove('show');
  if (!_pendingMoveItem) return;
  const item = _pendingMoveItem;
  _pendingMoveItem = null;
  const target = CAMPAIGN.party[partyIdx];
  if (!target) return;

  const isMove = !!item?.moveId;
  if (isMove && target.moves.length >= 4) {
    showReplaceMove(target, partyIdx, item);
    return;
  }
  applyLootItem(item, target);
}

function showReplaceMove(honker, partyIdx, item) {
  // Reuse teach overlay to pick which move to drop
  document.getElementById('teach-overlay').classList.add('show');
  const preview = document.getElementById('teach-move-preview');
  preview.innerHTML = `<div style="font-family:'Press Start 2P',monospace;font-size:.38rem;color:#ff5252">MOVE FULL (4/4)</div>
    <div style="font-size:.75rem;color:var(--dim);margin-top:.3rem">Which move should ${honker.emoji} ${honker.name} forget?</div>`;
  const grid = document.getElementById('teach-grid');
  grid.innerHTML = '';
  honker.moves.forEach((m, mi) => {
    const card = document.createElement('div');
    card.className = 'teach-card tc-full';
    card.innerHTML = `
      <span style="font-size:1.5rem">${m.emoji}</span>
      <div class="teach-name">${m.name}</div>
      <div class="teach-type">${m.type}</div>
      <div class="teach-moves" style="margin-top:.3rem">
        ${m.power > 0 ? `PWR ${m.power} &nbsp;` : ''}ACC ${m.acc}% &nbsp; PP ${m.pp}/${m.maxPP}
      </div>
    `;
    card.onclick = () => {
      document.getElementById('teach-overlay').classList.remove('show');
      honker.moves.splice(mi, 1);
      if (Array.isArray(honker.moveIds)) honker.moveIds.splice(mi, 1);
      applyLootItem(item, honker);
    };
    grid.appendChild(card);
  });
}

function cancelTeachMove() {
  document.getElementById('teach-overlay').classList.remove('show');
  _pendingMoveItem = null;
  afterLoot();
}

function skipLoot() { closeLootPartyOverlay(); afterLoot(); }

// "?"? BOSS CLEAR MILESTONE "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function showBossClear(stage, stageN, xpGain) {
  window._pendingLootXP = xpGain;
  document.getElementById('vic-emoji').textContent = '*';
  document.getElementById('vic-title').textContent = 'BOSS SLAIN!';
  document.getElementById('vic-sub').innerHTML =
    `<span style="color:var(--gold)">STAGE ${stageN} CLEARED  -  MILESTONE!</span>`;
  document.getElementById('vic-stats').innerHTML = `
    <div class="os-row"><span>Boss Defeated</span><b style="color:var(--gold)">${stage.enemy.name}</b></div>
    <div class="os-row"><span>Your Level</span><b>LV ${CAMPAIGN.level}</b></div>
    <div class="os-row"><span>XP Earned</span><b style="color:#00ff88">+${xpGain}</b></div>
    <div class="os-row"><span>Stages Cleared</span><b>${stageN}</b></div>
  `;
  document.getElementById('vic-btns').innerHTML = `
    <button class="btn btn-gold" onclick="closeBossAndLoot()">YZ' CLAIM LOOT</button>
    <button class="btn btn-red"  onclick="closeBossAndMap()">? SKIP LOOT</button>
  `;
  showScreen('screen-victory');
}

function closeBossAndLoot() { showLootScreen(window._pendingLootXP || 0); }
function closeBossAndMap()  { startNextStageFromLoop(); }

function goToCampaign(){
  syncActiveFighterToCampaign();
  stopAuto();BS.bDead=false;
  showCampaignMap();
}
