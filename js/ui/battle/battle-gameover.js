// ============================================================================
// HonkaRogue Game Over (js/ui/battle/battle-gameover.js)
// Game over screens, retry logic, and restart from stage
// ============================================================================

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
