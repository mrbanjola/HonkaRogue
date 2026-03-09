// ============================================================================
// HonkaRogue Character Select (js/ui/charselect.js)
// Starter selection and run initialization
// ============================================================================

let csSelected = null;
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function createRunSeed() {
  if (typeof crypto !== 'undefined' && crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return ((Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
function starterMovesForType(type, atkStat) {
  const pool = MOVES_BY_TYPE[type] || MOVES_BY_TYPE.Normal || [];
  const normal = MOVES_BY_TYPE.Normal || [];
  const picks = [pool[0], pool[1], pool[2], type === 'Normal' ? normal[3] : normal[0]].filter(Boolean);
  const seen = new Set();
  const uniq = [];
  for (const m of picks) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    uniq.push(m);
  }
  return uniq.slice(0, 4).map(m => materializeMoveFromId(m.id)).filter(Boolean);
}
function starterFromDex(dex) {
  const dexBlueprint = buildDexPartBlueprint(dex);
  const derived = dexBlueprint?.derived || null;
  const dexType = derived?.type || dex.type || 'Normal';
  const atk = dex.atk || 80;
  const def = dex.def || 80;
  const spd = dex.spd || 80;
  const starterMoves = (derived?.moves && derived.moves.length)
    ? derived.moves.map(m => ({ ...cloneJson(m), pp: m.maxPP || m.pp, maxPP: m.maxPP || m.pp }))
    : starterMovesForType(dexType, atk);
  const starterMoveIds = starterMoves.map(m => m.id).filter(Boolean);
  return {
    id: dex.id,
    name: dex.name,
    emoji: dex.emoji || '\u{1F986}',
    type: dexType,
    type2: derived?.type2 || null,
    lore: dex.lore || 'A veteran from a previous journey.',
    hp: clamp(Math.round(120 + def * 0.9), 145, 220),
    luck: 50,
    atk, def, spd,
    passiveId: dex.passiveId || dex.passive?.id || derived?.passiveId || null,
    passive: dex.passive ? JSON.parse(JSON.stringify(dex.passive)) : (derived?.passive ? cloneJson(derived.passive) : null),
    moveIds: starterMoveIds,
    moves: starterMoves,
    moveCandidates: derived?.moveCandidates ? cloneJson(derived.moveCandidates) : [],
    assembledParts: dexBlueprint?.assembledParts ? cloneJson(dexBlueprint.assembledParts) : null,
  };
}
function getStarterRoster() {
  const base = (ROSTER || []).map(h => {
    const out = JSON.parse(JSON.stringify(h));
    if (!Array.isArray(out.moveIds) || !out.moveIds.length) {
      if (typeof ensureHonkerMoveIds === 'function') ensureHonkerMoveIds(out);
    }
    if (typeof normalizePassiveRef === 'function') normalizePassiveRef(out);
    out.moves = materializeMovesFromIds(out.moveIds);
    return out;
  });
  const ids = new Set(base.map(h => h.id));
  const caughtDex = (CAMPAIGN.dexCaught || [])
    .map(id => HONKER_DEX.find(d => d.id === id))
    .filter(Boolean)
    .filter(d => !ids.has(d.id))
    .map(starterFromDex)
    .map(h => (typeof normalizePassiveRef === 'function' ? (normalizePassiveRef(h), h) : h));
  return [...base, ...caughtDex];
}
function buildCharSelect() {
  const g=document.getElementById('cs-grid');
  g.innerHTML='';
  const roster = getStarterRoster();
  roster.forEach(c=>{
    const card=document.createElement('div');
    card.className='char-card';
    card.style.setProperty('--gc',TC[c.type]);
    card.innerHTML=`
      <span class="cc-emoji">${c.emoji}</span>
      <div class="cc-name">${c.name}</div>
      <div class="cc-type" style="color:${TC[c.type]}">${c.type} Type</div>
      <div class="cc-stats">\u2764\uFE0F <b>${c.hp}</b> &nbsp; \u2694\uFE0F <b>${c.atk||80}</b> &nbsp; \uD83D\uDEE1\uFE0F <b>${c.def||80}</b> &nbsp; \u26A1 <b>${c.spd||80}</b> &nbsp; \uD83C\uDF40 <b>${c.luck}%</b></div>
      <div style="display:flex;gap:.2rem;margin:.25rem 0;">${['atk','def','spd'].map(s=>
        '<div style="flex:1"><div style="font-size:.38rem;color:var(--dim)">' + {atk:'\u2694 ATK',def:'\uD83D\uDEE1 DEF',spd:'\u26A1 SPD'}[s] + '</div><div style="background:var(--border);border-radius:3px;height:5px;overflow:hidden"><div style="height:100%;width:' + Math.round((c[s]||80)/130*100) + '%;background:' + {atk:'#ff4e00',def:'#00c8ff',spd:'#ffe600'}[s] + ';border-radius:3px"></div></div></div>'
      ).join('')}</div>
      <div style="margin-top:.55rem">${c.moves.map(m=>`<div class="cc-move-row"><span class="type-pip ${TCC[m.type]}">${m.type}</span><span style="color:#ccc">${m.emoji} ${m.name}</span><span style="color:var(--dim);font-size:.62rem">P${m.power}</span></div>`).join('')}</div>
      <div class="cc-lore">"${c.lore}"</div>`;
    if (c.assembledParts) {
      const em = card.querySelector('.cc-emoji');
      if (em) renderCompositePreview(c.assembledParts, em, 'cc-composite');
    }
    card.onclick=()=>{
      g.querySelectorAll('.char-card').forEach(el=>el.classList.remove('selected'));
      card.classList.add('selected'); csSelected=c;
      document.getElementById('cs-btn').disabled=false;
    };
    g.appendChild(card);
  });
}

function confirmCharSelect() {
  if(!csSelected) { console.warn('No character selected'); return; }
  console.log('Starting game with:', csSelected.name);
  csSelected = JSON.parse(JSON.stringify(csSelected));
  CAMPAIGN.playerBase = csSelected;
  CAMPAIGN.player = null;
  CAMPAIGN.party = [csSelected];
  CAMPAIGN.activeIdx = 0;
  CAMPAIGN.stageIdx = 0;
  CAMPAIGN.runSeed = createRunSeed();
  CAMPAIGN.retries = 3;
  CAMPAIGN.maxRetries = 3;
  CAMPAIGN.completedStages = [];
  CAMPAIGN.totalXP = 0;
  CAMPAIGN.level = 1;
  CAMPAIGN.xp = 0;
  CAMPAIGN.xpNeeded = 100;
  CAMPAIGN.inventory = [];
  CAMPAIGN.coins = 0;
  CAMPAIGN.fallen = [];
  ensurePartTrackingState();
  CAMPAIGN.party.forEach(h => { h.inventory = []; });
  CAMPAIGN.started = true;
  csSelected.maxHPBonus=0; csSelected.atkFlat=0; csSelected.atkMult=1;
  csSelected.luckBonus=0; csSelected.stabBonus=1.25; csSelected.chaosMod=1; csSelected.ppBonus=0;
  csSelected.level=1; csSelected.xp=0; csSelected.xpNeeded=100; csSelected.totalXp=0;
  csSelected.masteryLevel=0; csSelected.masteryXP=0; csSelected.masteryXPNeeded=masteryXpNeededForLevel(0); csSelected.masteryTotalXp=0;
  initHonkerRunState(csSelected);
  console.log('Initialized honker run state, starting stage battle');
  console.log('CAMPAIGN.party:', CAMPAIGN.party.length, 'active idx:', CAMPAIGN.activeIdx);
  startNextStageFromLoop();
}

console.log('[CHARSELECT] Module loaded');
