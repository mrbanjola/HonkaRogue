// ============================================================================
// HonkaRogue Battle Catch (js/ui/battle/battle-catch.js)
// Catch mechanics, catch success handling, and caught screen display
// ============================================================================

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
