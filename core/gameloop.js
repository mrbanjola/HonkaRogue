// ============================================================================
// HonkaRogue Game Loop Module (core/gameloop.js)
// Stage progression and battle loop orchestration
// ============================================================================

function startNextStageFromLoop() {
  console.log('startNextStageFromLoop called, party length:', CAMPAIGN.party?.length);
  if (!CAMPAIGN.party || CAMPAIGN.party.length === 0) {
    console.warn('No party, showing game over');
    showGameOver();
    return;
  }
  const cur = CAMPAIGN.party[CAMPAIGN.activeIdx];
  const curHP = cur ? (cur.currentHP ?? getHonkerMaxHP(cur)) : 0;
  if (!cur || curHP <= 0) {
    const aliveIdx = CAMPAIGN.party.findIndex(h => (h.currentHP ?? getHonkerMaxHP(h)) > 0);
    if (aliveIdx < 0) {
      showGameOver();
      return;
    }
    CAMPAIGN.activeIdx = aliveIdx;
    CAMPAIGN.playerBase = CAMPAIGN.party[aliveIdx];
  }
  startStageBattle(CAMPAIGN.stageIdx);
}

function startStageBattle(stageIdx, isRetry=false) {
  console.log('startStageBattle called with stageIdx:', stageIdx);
  const stageN = stageIdx + 1;          // convert to 1-indexed
  console.log('Generating stage', stageN);
  const stage  = generateStage(stageN); // procedural generation
  console.log('Stage generated:', stage?.enemy?.name);
  const pb     = CAMPAIGN.playerBase;
  if (!pb) {
    console.error('CAMPAIGN.playerBase is not set!');
    return;
  }

  // Build player Honker
  const pBoosts = {
    maxHPBonus: pb.maxHPBonus||0, atkFlat: pb.atkFlat||0, atkMult: pb.atkMult||1,
    luckBonus:  pb.luckBonus||0,  stabBonus: pb.stabBonus||1.25,
    chaosMod:   pb.chaosMod||1,   ppBonus: pb.ppBonus||0, level: pb.level||1,
    currentHP:  pb.currentHP ?? getHonkerMaxHP(pb),
    movePP:     pb.movePP || null,
    persistentEffects: pb.persistentEffects || null,
  };
  if (isRetry && CAMPAIGN._savedPlayerHP) pBoosts.currentHP = CAMPAIGN._savedPlayerHP;

  bFighters = [
    new Honker(JSON.parse(JSON.stringify(pb)), 'left', pBoosts),
    new Honker(JSON.parse(JSON.stringify(stage.enemy)), 'right', {}),
  ];
  bFighters[1]._dexId = stage.enemy.dexId || null;
  bFighters[1]._isBoss = stage.isBoss || false;
  bFighters[1]._hasNewParts = stage.hasNewParts || false;
  if (isRetry && CAMPAIGN._savedPlayerHP) bFighters[0].currentHP = CAMPAIGN._savedPlayerHP;

  CAMPAIGN._currentStageIdx = stageIdx;
  CAMPAIGN._currentStage    = stage; // cache for reference after battle
  CAMPAIGN._savedPlayerHP   = bFighters[0].maxHP;

  bRound=0; bPhase='p1'; bAutoOn=false; bAutoTurn=0; bDead=false; bAutoTmr=null;
  bSwapMode=false;
  typeOverride=false; eventState={}; lastEventRound=-5;
  bFaintedPartyIdx = new Set();
  stopAuto();
  // Track dex seen
  let globalDirty = false;
  if (stage.enemy.dexId && !CAMPAIGN.dexSeen.includes(stage.enemy.dexId)) {
    CAMPAIGN.dexSeen.push(stage.enemy.dexId);
    globalDirty = true;
  }
  // Track parts seen (encountering an enemy reveals its parts in the partsdex)
  if (stage.enemy.assembledParts) {
    ensurePartTrackingState();
    ['head', 'torso', 'wings', 'legs'].forEach(slot => {
      const part = stage.enemy.assembledParts[slot];
      if (part?.id && !CAMPAIGN.partsSeen.includes(part.id)) {
        CAMPAIGN.partsSeen.push(part.id);
        globalDirty = true;
      }
    });
  }
  if (globalDirty) saveGlobalProgress();

  // UI
  const bossLabel = stage.isBoss ? ' ⚔ BOSS' : '';
  document.getElementById('btb-stage').textContent = `STAGE ${stageN}${bossLabel}: ${stage.name}`;
  buildRetryIcons();
  buildTypeLegend();
  setupFighterUI(bFighters[0], 'left');
  setupFighterUI(bFighters[1], 'right');
  refreshStatusBadges(bFighters[0]);
  refreshStatusBadges(bFighters[1]);
  document.getElementById('round-badge').textContent = 'ROUND 1';
  document.getElementById('arena-bg').className = stage.isBoss ? 'arena-bg event-active' : 'arena-bg';
  document.getElementById('log').innerHTML = '';

  ['left','right'].forEach(s => {
    document.getElementById(`sb-${s}`).innerHTML = '';
    const el = document.getElementById(`spr-${s}`);
    resetSpriteClass(s); el.style = '';
  });
  // Fresh fighter objects already carry intended status state.

  // Apply player passive effects at battle start
  if (pb.passive?.id === 'cursed_aura') {
    bFighters[1].statusEffects.cursed = 2;
    refreshStatusBadges(bFighters[1]);
  }

  // Show passive strip
  const ps = document.getElementById('passive-left');
  if (pb.passive) {
    ps.textContent = `${pb.passive.emoji} ${pb.passive.name}`;
    ps.style.display = '';
  } else {
    ps.style.display = 'none';
  }

  // Apply shield_wall passive
  if (pb.passive && pb.passive.id === 'shield_wall') {
    bFighters[0].statusEffects.shielded = Math.max(1, Math.min(4, (bFighters[0].statusEffects.shielded || 0) + 1));
    refreshStatusBadges(bFighters[0]);
  }
  if (stage.isBoss) {
    log('ev', `BOSS STAGE ${stageN}! <b>${stage.enemy.name}</b> awaits...`);
  }
  // Show caught badge if already caught this dex entry
  const caughtBadge = document.getElementById('enemy-caught-badge');
  if (caughtBadge) {
    const alreadyCaught = stage.enemy.dexId && CAMPAIGN.dexCaught.includes(stage.enemy.dexId);
    caughtBadge.style.display = alreadyCaught ? '' : 'none';
  }
  // Init XP bar
  updateBattleLevelBar();
  log('n', `⚔️ Stage ${stageN}: <b>${stage.name}</b>`);
  log('n', `<b style="color:${TC[pb.type]}">${pb.name}</b> (LV ${pb.level||1}) faces <b style="color:${TC[stage.enemy.type]}">${stage.enemy.name}</b>!`);
  if (isRetry) log('ev', `🔄 RETRY • You have <b>${CAMPAIGN.retries}</b> retr${CAMPAIGN.retries===1?'y':'ies'} remaining. Returning with 40% HP.`);
  renderMovePanel();
  console.log('About to show battle screen');
  showScreen('screen-battle');
  console.log('Battle screen shown, bPhase:', bPhase);
}

function afterLoot() {
  startNextStageFromLoop();
}

function toggleAuto() {
  if(bDead) return;
  bAutoOn=!bAutoOn;
  const btn=document.getElementById('btn-auto');
  if(bAutoOn){
    btn.textContent='⏸ PAUSE'; btn.className='btn btn-green active';
    btn.style.animation='autoPls 1s ease-in-out infinite';
    renderMovePanel();
    bAutoTmr=setInterval(()=>{ if(bDead){stopAuto();return;} autoStep(); },720);
  } else {
    stopAuto(); bPhase='p1'; renderMovePanel();
  }
}

function stopAuto(){
  if(bAutoTmr){clearInterval(bAutoTmr);bAutoTmr=null;}
  bAutoOn=false;
  const b=document.getElementById('btn-auto');
  if(b){b.textContent='▶ AUTO BATTLE';b.className='btn btn-green';b.style.animation='';}
}
