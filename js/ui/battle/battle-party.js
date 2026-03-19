// ============================================================================
// HonkaRogue Battle Party (js/ui/battle/battle-party.js)
// Party swap, release, and replace mechanics
// ============================================================================

// BS._pendingCaught is used for deferred catch when party is full

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
  // Register switched-in honker as mastery contributor
  if (typeof registerMasteryContributor === 'function') {
    registerMasteryContributor(pb);
  }
  BS.bDead = false; BS.bPhase = 'p1';
  setupFighterUI(newFighter, 'left');
  resetSpriteClass('left');
  if (typeof runPassiveHook === 'function') {
    runPassiveHook(newFighter, 'onBattleStart', { self: newFighter, opponent: BS.bFighters[1], battleState: BS });
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
