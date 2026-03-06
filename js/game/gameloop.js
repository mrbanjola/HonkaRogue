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

function applyBiomeArenaTheme(stage) {
  const arena = document.getElementById('arena');
  const arenaBg = document.getElementById('arena-bg');
  if (!arena || !arenaBg) return;

  const vars = [
    ['--arena-sky-top', 'skyTop'],
    ['--arena-sky-bottom', 'skyBottom'],
    ['--arena-haze', 'haze'],
    ['--arena-horizon', 'horizon'],
    ['--arena-ground-a', 'groundA'],
    ['--arena-ground-b', 'groundB'],
    ['--arena-accent', 'accent'],
    ['--arena-stripe', 'stripe'],
  ];
  const visual = stage?.biomeVisual || {};
  vars.forEach(([cssVar, key]) => {
    if (typeof visual[key] === 'string' && visual[key]) {
      arena.style.setProperty(cssVar, visual[key]);
    }
  });

  const biomeClasses = [...arena.classList].filter(c => c.startsWith('biome-'));
  biomeClasses.forEach(c => arena.classList.remove(c));
  if (stage?.biomeId) arena.classList.add(`biome-${stage.biomeId}`);

  arenaBg.classList.toggle('event-active', !!stage?.isBoss);
  if (window.BattleThreeBg && typeof window.BattleThreeBg.applyStage === 'function') {
    window.BattleThreeBg.applyStage(stage).catch(err => {
      console.warn('[3D BG] applyStage failed:', err?.message || err);
    });
  }
}

function startStageBattle(stageIdx, isRetry=false) {
  if (typeof closeLootPartyOverlay === 'function') closeLootPartyOverlay();
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

  BS = new BattleState();
  const runSeed = Number.isFinite(Number(CAMPAIGN?.runSeed)) ? (Number(CAMPAIGN.runSeed) >>> 0) : 0;
  BS.rng = seededRng(((stageN * 6271 + 99991) ^ runSeed) >>> 0);
  const seedEl = document.getElementById('seed-badge');
  if (seedEl) seedEl.textContent = `SEED ${runSeed.toString(16).toUpperCase().padStart(8, '0')}`;
  BS.bFighters = [
    new Honker(JSON.parse(JSON.stringify(pb)), 'left', pBoosts),
    new Honker(JSON.parse(JSON.stringify(stage.enemy)), 'right', {}),
  ];
  BS.bFighters[1]._dexId = stage.enemy.dexId || null;
  BS.bFighters[1]._isBoss = stage.isBoss || false;
  BS.bFighters[1]._hasNewParts = stage.hasNewParts || false;
  if (isRetry && CAMPAIGN._savedPlayerHP) BS.bFighters[0].currentHP = CAMPAIGN._savedPlayerHP;

  CAMPAIGN._currentStageIdx = stageIdx;
  CAMPAIGN._currentStage    = stage; // cache for reference after battle
  CAMPAIGN._savedPlayerHP   = BS.bFighters[0].maxHP;

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
  setupFighterUI(BS.bFighters[0], 'left');
  setupFighterUI(BS.bFighters[1], 'right');
  refreshStatusBadges(BS.bFighters[0]);
  refreshStatusBadges(BS.bFighters[1]);
  document.getElementById('round-badge').textContent = 'ROUND 1';
  applyBiomeArenaTheme(stage);
  document.getElementById('log').innerHTML = '';

  ['left','right'].forEach(s => {
    document.getElementById(`sb-${s}`).innerHTML = '';
    const el = document.getElementById(`spr-${s}`);
    resetSpriteClass(s); el.style = '';
  });
  // Fresh fighter objects already carry intended status state.

  // Apply player passive effects at battle start
  if (pb.passive?.id === 'cursed_aura') {
    BS.bFighters[1].statusEffects.cursed = 2;
    refreshStatusBadges(BS.bFighters[1]);
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
    BS.bFighters[0].statusEffects.shielded = Math.max(1, Math.min(4, (BS.bFighters[0].statusEffects.shielded || 0) + 1));
    refreshStatusBadges(BS.bFighters[0]);
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
  console.log('Battle screen shown, bPhase:', BS.bPhase);
}

function afterLoot() {
  startNextStageFromLoop();
}

function toggleAuto() {
  if(BS.bDead) return;
  BS.bAutoOn=!BS.bAutoOn;
  const btn=document.getElementById('btn-auto');
  if(BS.bAutoOn){
    btn.textContent='⏸ PAUSE'; btn.className='btn btn-green active';
    btn.style.animation='autoPls 1s ease-in-out infinite';
    renderMovePanel();
    BS.bAutoTmr=setInterval(()=>{ if(BS.bDead){stopAuto();return;} autoStep(); },720);
  } else {
    stopAuto(); BS.bPhase='p1'; renderMovePanel();
  }
}

function stopAuto(){
  if(BS.bAutoTmr){clearInterval(BS.bAutoTmr);BS.bAutoTmr=null;}
  BS.bAutoOn=false;
  const b=document.getElementById('btn-auto');
  if(b){b.textContent='▶ AUTO BATTLE';b.className='btn btn-green';b.style.animation='';}
}
