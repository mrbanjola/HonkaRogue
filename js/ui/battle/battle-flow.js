// ============================================================================
// HonkaRogue Battle Flow (js/ui/battle/battle-flow.js)
// Battle lifecycle helpers and state synchronization
// ============================================================================

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
