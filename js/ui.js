// ============================================================================
// HonkaRogue UI Module (js/ui.js)
// Screen rendering, campaign, battle, loot, dex, save/load
// ============================================================================


function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  TITLE
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
async function initTitle() {
  try {
    console.log('[INIT] initTitle starting');
    if (typeof loadPartsData === 'function') {
      await loadPartsData();
      console.log('[INIT] Parts data loaded:', PARTS_DATA?.parts?.length || 0);
    }
    if (typeof loadMovesData === 'function') {
      const movesLoaded = await loadMovesData();
      if (!movesLoaded) {
        console.error('[INIT] Move data failed to load from all sources');
        throw new Error('Move data failed to load');
      }
      console.log('[INIT] Moves data loaded:', MOVE_POOL?.length || 0);
    }
    await loadGlobalDex();
    console.log('[INIT] Global dex loaded');
    buildCharSelect();
    console.log('[INIT] Character select built, found', document.getElementById('cs-grid')?.children?.length, 'characters');
    // Check for saved campaign
    const hasSave = await loadCampaign();
    if (hasSave) {
      document.getElementById('cont-btn').style.display = '';
    }
    if (CAMPAIGN.deepest) {
      document.getElementById('highscore-strip').innerHTML =
        `Y? DEEPEST STAGE REACHED: <span style="color:var(--gold)">${CAMPAIGN.deepest}</span>`;
    }
    const dexBtn = document.getElementById('dex-btn-title');
    if (dexBtn) dexBtn.style.display = '';
    console.log('[INIT] About to show title screen');
    showScreen('screen-title');
    console.log('[INIT] Title screen shown successfully');
  } catch(e) {
    console.error('[INIT] FATAL ERROR in initTitle:', e);
    console.error('[INIT] Stack trace:', e.stack);
  }
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  CHARACTER SELECT
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
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
    out.moves = materializeMovesFromIds(out.moveIds);
    return out;
  });
  const ids = new Set(base.map(h => h.id));
  const caughtDex = (CAMPAIGN.dexCaught || [])
    .map(id => HONKER_DEX.find(d => d.id === id))
    .filter(Boolean)
    .filter(d => !ids.has(d.id))
    .map(starterFromDex);
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
      <div class="cc-stats">❤️ <b>${c.hp}</b> &nbsp; ⚔️ <b>${c.atk||80}</b> &nbsp; 🛡️ <b>${c.def||80}</b> &nbsp; ⚡ <b>${c.spd||80}</b> &nbsp; 🍀 <b>${c.luck}%</b></div>
      <div style="display:flex;gap:.2rem;margin:.25rem 0;">${['atk','def','spd'].map(s=>
        '<div style="flex:1"><div style="font-size:.38rem;color:var(--dim)">' + {atk:'s" ATK',def:'Y> DEF',spd:'s SPD'}[s] + '</div><div style="background:var(--border);border-radius:3px;height:5px;overflow:hidden"><div style="height:100%;width:' + Math.round((c[s]||80)/130*100) + '%;background:' + {atk:'#ff4e00',def:'#00c8ff',spd:'#ffe600'}[s] + ';border-radius:3px"></div></div></div>'
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
  // Reset per-honker inventories
  CAMPAIGN.party.forEach(h => { h.inventory = []; });
  CAMPAIGN.started = true;
  // Reset player boosts
  csSelected.maxHPBonus=0; csSelected.atkFlat=0; csSelected.atkMult=1;
  csSelected.luckBonus=0; csSelected.stabBonus=1.25; csSelected.chaosMod=1; csSelected.ppBonus=0;
  csSelected.level=1; csSelected.xp=0; csSelected.xpNeeded=100; csSelected.totalXp=0;
  csSelected.masteryLevel=0; csSelected.masteryXP=0; csSelected.masteryXPNeeded=masteryXpNeededForLevel(0); csSelected.masteryTotalXp=0;
  initHonkerRunState(csSelected);
  console.log('Initialized honker run state, starting stage battle');
  console.log('CAMPAIGN.party:', CAMPAIGN.party.length, 'active idx:', CAMPAIGN.activeIdx);
  startNextStageFromLoop();
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  HONKER ASSEMBLY
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
let assembledParts = { head: null, torso: null, wings: null, legs: null };
let selectedStarterMoveIds = [];
let starterSelectionInitialized = false;

function showAssemblyScreen() {
  ensurePartTrackingState();
  assembledParts = { head: null, torso: null, wings: null, legs: null };
  selectedStarterMoveIds = [];
  starterSelectionInitialized = false;
  buildPartSelectors();
  updateAssemblyPreview();
  showScreen('screen-assembly');
}

function randomAssembly() {
  if (!PARTS_DATA || !PARTS_DATA.parts) return;
  const pickRandom = slot => {
    const pool = PARTS_DATA.parts.filter(p => p.slot === slot && isPartUnlocked(p.id));
    return pool[Math.floor(Math.random() * pool.length)] || null;
  };
  ['head','torso','wings','legs'].forEach(slot => {
    assembledParts[slot] = pickRandom(slot);
  });
  selectedStarterMoveIds = [];
  starterSelectionInitialized = false;
  // Update visual selection highlights
  const slotMap = {head:'heads-list',torso:'torsos-list',wings:'wings-list',legs:'legs-list'};
  Object.entries(slotMap).forEach(([slot, listId]) => {
    const items = document.getElementById(listId)?.querySelectorAll('.part-item') || [];
    items.forEach((item, idx) => {
      const partId = item.getAttribute('data-part-id');
      item.classList.toggle('selected', partId === assembledParts[slot]?.id);
    });
  });
  updateAssemblyPreview();
}

function buildPartSelectors() {
  if (!PARTS_DATA || !PARTS_DATA.parts) {
    console.error('PARTS_DATA not loaded properly:', PARTS_DATA);
    return;
  }
  
  const slots = { head: 'heads-list', torso: 'torsos-list', wings: 'wings-list', legs: 'legs-list' };
  
  Object.entries(slots).forEach(([slot, elementId]) => {
    const container = document.getElementById(elementId);
    if (!container) {
      console.error('Container not found:', elementId);
      return;
    }
    container.innerHTML = '';
    
    const slotParts = PARTS_DATA.parts.filter(p => p.slot === slot && isPartUnlocked(p.id));
    console.log(`Found ${slotParts.length} parts for slot ${slot}`);
    
    slotParts.forEach(part => {
      const item = document.createElement('div');
      item.className = 'part-item';
      item.setAttribute('data-part-id', part.id);
      const archColors = {bulwark:'#00c8ff',raider:'#ff4e00',trickster:'#a020f0',balanced:'#aaa'};
      const linkedMoves = (part.moveIds || []).map(id => MOVE_DB[id]).filter(Boolean);
      const moveRows = linkedMoves.map(m => {
        const pwr = Math.max(15, Math.round(m.basePower || 55));
        return `<div class="part-move-chip">
          <span class="part-move-name">${m.name}</span>
          <span class="part-move-meta">${m.type} · P${pwr}</span>
        </div>`;
      }).join('');
      item.innerHTML = `
        <div class="part-img">
          <img src="${part.file}" alt="${part.id}">
        </div>
        <div class="part-info">
          <div class="part-family-row">
            <div class="part-family">${part.family.name}</div>
            <span class="part-tag" style="color:${getRarityColor(part.rarity)};border-color:${getRarityColor(part.rarity)}">${part.rarity.toUpperCase()}</span>
          </div>
          <div style="font-size:.52rem;color:${archColors[part.archetype]||'#aaa'};margin:.08rem 0;">${part.archetype} · ${part.slot}</div>
          <div class="part-stats">
            <span class="part-stat">❤️${part.stats.hp}</span>
            <span class="part-stat">⚔️${part.stats.atk}</span>
            <span class="part-stat">🛡️${part.stats.def}</span>
            <span class="part-stat">⚡${part.stats.spd}</span>
            <span class="part-stat">🍀${part.stats.luck}</span>
          </div>
          <div class="part-moves">${moveRows}</div>
        </div>
      `;
      
      if (isPartUnlocked(part.id)) {
        item.onclick = () => selectPart(slot, part);
      } else {
        item.style.opacity = '.45';
        item.style.filter = 'grayscale(.8)';
        item.style.cursor = 'not-allowed';
        item.title = 'Locked: catch honkers to unlock more parts';
        const fam = item.querySelector('.part-family-row');
        if (fam) {
          const lock = document.createElement('span');
          lock.className = 'part-tag';
          lock.style.color = '#ff6a00';
          lock.style.borderColor = '#ff6a00';
          lock.textContent = 'LOCKED';
          fam.appendChild(lock);
        }
      }
      
      container.appendChild(item);
    });
  });
}

function getRarityColor(rarity) {
  const colors = {
    'common': '#aaaacc',
    'rare': '#00c8ff',
    'legendary': '#ffd700'
  };
  return colors[rarity] || '#aaaacc';
}

function selectPart(slot, part) {
  if (!isPartUnlocked(part?.id)) return;
  assembledParts[slot] = part;
  selectedStarterMoveIds = [];
  starterSelectionInitialized = false;
  
  // Update visual selection
  const listId = {
    'head': 'heads-list',
    'torso': 'torsos-list',
    'wings': 'wings-list',
    'legs': 'legs-list'
  }[slot];
  
  const items = document.getElementById(listId).querySelectorAll('.part-item');
  items.forEach((item, idx) => {
    const partId = item.getAttribute('data-part-id');
    item.classList.toggle('selected', partId === part.id);
  });
  
  updateAssemblyPreview();
}


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
  const fighter = bFighters[0];
  if (base && fighter) syncBattleStateToBase(base, fighter);
}
function initHonkerRunState(h) {
  if (!h) return;
  ensureMasteryState(h);
  h.currentHP = getHonkerMaxHP(h);
  h.movePP = {};
  h.persistentEffects = {};
  (h.moves || []).forEach(m => { h.movePP[m.id || m.name] = m.maxPP; });
}

function renderStarterMoveSelection(derived, allSelected) {
  const grid = document.getElementById('starter-move-grid');
  const countEl = document.getElementById('starter-count');
  if (!grid || !countEl) return;
  if (!allSelected || !derived) {
    grid.innerHTML = '';
    countEl.textContent = 'Pick 4 of 8';
    starterSelectionInitialized = false;
    return;
  }

  const unique = [];
  const seen = new Set();
  for (const m of (derived.moveCandidates || [])) {
    const key = m.id || `${m.type}:${m.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(m);
  }

  const validIds = new Set(unique.map(m => m.id));
  selectedStarterMoveIds = selectedStarterMoveIds.filter(id => validIds.has(id));
  if (!starterSelectionInitialized && !selectedStarterMoveIds.length) {
    selectedStarterMoveIds = (derived.moves || []).map(m => m.id).filter(id => validIds.has(id)).slice(0, 4);
    if (selectedStarterMoveIds.length < 4) {
      for (const m of unique) {
        if (selectedStarterMoveIds.length >= 4) break;
        if (!selectedStarterMoveIds.includes(m.id)) selectedStarterMoveIds.push(m.id);
      }
    }
    starterSelectionInitialized = true;
  }
  if (selectedStarterMoveIds.length > 4) selectedStarterMoveIds = selectedStarterMoveIds.slice(0, 4);

  countEl.textContent = `Selected ${selectedStarterMoveIds.length}/4`;
  countEl.style.color = selectedStarterMoveIds.length === 4 ? 'var(--gold)' : 'var(--dim)';

  grid.innerHTML = unique.map(m => {
    const selected = selectedStarterMoveIds.includes(m.id);
    const pwr = m.power || Math.max(15, Math.round(m.basePower || 55));
    const note = m.effect ? `Effect: ${m.effect}` : (m.priority ? 'Priority move' : (m.drain ? `Drain ${Math.round(m.drain*100)}%` : (m.recoil ? `Recoil ${Math.round(m.recoil*100)}%` : '')));
    return `<div class="starter-card ${selected ? 'selected' : ''}" data-mid="${m.id}">
      <div class="starter-top">
        <div class="starter-name">${m.emoji || ''} ${m.name}</div>
        <div class="starter-type" style="color:${TC[m.type] || '#aaa'}">${m.type}</div>
      </div>
      <div class="starter-meta">
        <span>PWR ${pwr}</span><span>ACC ${m.acc}%</span><span>PP ${m.maxPP||m.pp}</span>
      </div>
      ${note ? `<div class="starter-note">${note}</div>` : ''}
    </div>`;
  }).join('');

  grid.querySelectorAll('.starter-card').forEach(card => {
    card.onclick = () => {
      const id = card.getAttribute('data-mid');
      const idx = selectedStarterMoveIds.indexOf(id);
      if (idx >= 0) selectedStarterMoveIds.splice(idx, 1);
      else if (selectedStarterMoveIds.length < 4) selectedStarterMoveIds.push(id);
      renderStarterMoveSelection(derived, allSelected);
      document.getElementById('assembly-confirm-btn').disabled = !(allSelected && selectedStarterMoveIds.length === 4);
    };
  });
}

function updateAssemblyPreview() {
  // Update preview images
  const previewMap = { head: 'preview-head', torso: 'preview-torso', wings: 'preview-wings', legs: 'preview-legs' };
  
  Object.entries(previewMap).forEach(([slot, elementId]) => {
    const element = document.getElementById(elementId);
    if (assembledParts[slot]) {
      element.innerHTML = `<img src="${assembledParts[slot].file}" alt="${slot}" style="width:100%;height:100%;object-fit:contain;">`;
      element.classList.add('filled');
    } else {
      element.innerHTML = {
        'head': '\u{1F5E3}\uFE0F',
        'torso': '\u{1F4AA}',
        'wings': '\u{1FABD}',
        'legs': '\u{1F9B5}'
      }[slot];
      element.classList.remove('filled');
    }
  });
  
  // Update full honker canvas visualization (layered parts)
  const canvas = document.getElementById('honker-canvas');
  canvas.innerHTML = '';
  
  // Layer order: legs (back), wings, torso, head (front)
  if (assembledParts.legs) {
    const legsDiv = document.createElement('div');
    legsDiv.className = 'honker-part';
    legsDiv.setAttribute('data-part', 'legs');
    legsDiv.innerHTML = `<img src="${assembledParts.legs.file}" alt="legs">`;
    canvas.appendChild(legsDiv);
  }
  
  if (assembledParts.wings) {
    const wingsDiv = document.createElement('div');
    wingsDiv.className = 'honker-part';
    wingsDiv.setAttribute('data-part', 'wings');
    wingsDiv.innerHTML = `<img src="${assembledParts.wings.file}" alt="wings">`;
    canvas.appendChild(wingsDiv);
  }
  
  if (assembledParts.torso) {
    const torsoDiv = document.createElement('div');
    torsoDiv.className = 'honker-part';
    torsoDiv.setAttribute('data-part', 'torso');
    torsoDiv.innerHTML = `<img src="${assembledParts.torso.file}" alt="torso">`;
    canvas.appendChild(torsoDiv);
  }
  
  if (assembledParts.head) {
    const headDiv = document.createElement('div');
    headDiv.className = 'honker-part';
    headDiv.setAttribute('data-part', 'head');
    headDiv.innerHTML = `<img src="${assembledParts.head.file}" alt="head">`;
    canvas.appendChild(headDiv);
  }
  
  // Calculate and display combined stats
  updateCombinedStats();
  
  // Enable confirm button only if all parts are selected
  const allSelected = Object.values(assembledParts).every(p => p !== null);

  // Show derived type + name preview
  const derivedEl = document.getElementById('assembly-derived');
  let derived = null;
  if (derivedEl) {
    if (allSelected) {
      derived = deriveHonkerFromParts(assembledParts);
      const typeColor = TC[derived.type] || '#aaa';
      const typeLabel = derived.type2 ? `${derived.type}/${derived.type2}` : derived.type;
      derivedEl.innerHTML = `<span style="color:${typeColor};font-weight:700">${typeLabel} Type</span> &nbsp;·&nbsp; <span style="color:var(--gold)">${derived.name}</span>${derived.passive ? ' &nbsp;·&nbsp; <span style="color:var(--gold);font-size:.55rem">' + derived.passive.emoji + ' ' + derived.passive.name + '</span>' : ''}`;
    } else {
      const count = Object.values(assembledParts).filter(Boolean).length;
      derivedEl.textContent = count === 0 ? 'Select parts to begin' : `${count}/4 parts selected`;
    }
  }
  renderStarterMoveSelection(derived, allSelected);
  document.getElementById('assembly-confirm-btn').disabled = !(allSelected && selectedStarterMoveIds.length === 4);
}

function updateCombinedStats() {
  const stats = { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 };
  
  Object.values(assembledParts).forEach(part => {
    if (part) {
      stats.hp += part.stats.hp;
      stats.atk += part.stats.atk;
      stats.def += part.stats.def;
      stats.spd += part.stats.spd;
      stats.luck += part.stats.luck;
    }
  });
  
  document.getElementById('stat-hp').textContent = stats.hp;
  document.getElementById('stat-atk').textContent = stats.atk;
  document.getElementById('stat-def').textContent = stats.def;
  document.getElementById('stat-spd').textContent = stats.spd;
  document.getElementById('stat-luck').textContent = stats.luck;
}

// Theme  -  game type mapping
const THEME_TYPE = {
  fire:'Fire', ice:'Ice', lightning:'Lightning', shadow:'Shadow', arcane:'Shadow',
  solar:'Fire', bog:'Normal', stone:'Normal', wild:'Normal',
};
const FAMILY_TYPE = {
  Marshborn:'Normal',
  Embercrest:'Fire',
  Frostplume:'Ice',
  Stormcall:'Lightning',
  Ironbarb:'Normal',
  Duskveil:'Shadow',
  Sunflare:'Fire',
  Bloomcrest:'Normal',
  Voidgild:'Shadow',
};

// Archetype  -  passive ability
const ARCHETYPE_PASSIVE = {
  bulwark:   {id:'thick_skin',   emoji:'*', name:'Thick Skin',   desc:'Takes 20% less damage from all sources.'},
  raider:    {id:'underdog',     emoji:'*', name:'Underdog',     desc:'+30% ATK when below 50% HP.'},
  trickster: {id:'cursed_aura',  emoji:'*', name:'Cursed Aura',  desc:'Enemies begin battle Cursed for 2 rounds.'},
  balanced:  null,
};

function deriveHonkerFromParts(parts) {
  const stats = { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 };
  const themeCounts = {};
  const archetypeCounts = {};
  const familyNames = new Set();

  Object.values(parts).forEach(part => {
    if (!part) return;
    stats.hp   += part.stats.hp;
    stats.atk  += part.stats.atk;
    stats.def  += part.stats.def;
    stats.spd  += part.stats.spd;
    stats.luck += part.stats.luck;
    const theme = part.family.theme;
    themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    archetypeCounts[part.archetype] = (archetypeCounts[part.archetype] || 0) + 1;
    familyNames.add(part.family.name);
  });

  // Primary/secondary typing from torso/head family (or fallback to theme)
  const dominant = Object.entries(themeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'bog';
  const torsoType = parts.torso?.family?.type || FAMILY_TYPE[parts.torso?.family?.name] || THEME_TYPE[parts.torso?.family?.theme || ''] || null;
  const headType  = parts.head?.family?.type  || FAMILY_TYPE[parts.head?.family?.name]  || THEME_TYPE[parts.head?.family?.theme || ''] || null;
  const type = torsoType || headType || THEME_TYPE[dominant] || 'Normal';
  const type2 = headType && headType !== type ? headType : null;

  // Dominant archetype  -  passive
  const domArch = Object.entries(archetypeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'balanced';
  const passive = ARCHETYPE_PASSIVE[domArch] || null;

  // Name: use the two most-represented family names
  const topFamilies = [...familyNames].slice(0,2);
  const ARCHETYPE_TITLE = {
    bulwark:'Guardian', raider:'Marauder', trickster:'Trickster', balanced:'Striker'
  };
  const title = ARCHETYPE_TITLE[domArch] || 'Honker';
  const name = topFamilies.join('-') + ' ' + title;

  const toMove = (m) => ({
    id: m.id,
    name: m.name, type: m.type, emoji: m.emoji||'*', desc: m.desc||'',
    power: Math.max(15, Math.round(m.basePower || 55)),
    acc: m.acc, pp: m.pp, maxPP: m.pp,
    ...(m.drain  ? { drain:  m.drain  } : {}),
    ...(m.recoil ? { recoil: m.recoil } : {}),
    ...(m.priority ? { priority: m.priority } : {}),
    ...(m.effect ? { effect: m.effect, effectTarget: m.effectTarget,
      effectChance: m.effectChance, effectDur: m.effectDur } : {}),
  });
  const pickStarterMoves = (cands) => {
    const unique = [];
    const seen = new Set();
    for (const m of cands) {
      const k = m.id || `${m.type}:${m.name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(m);
    }
    const offensive = unique.filter(m => (m.power || 0) > 0);
    const utility = unique.filter(m => !!m.effect || (m.power || 0) <= 0);
    const stabScore = (m) => ((m.type === type || m.type === type2) ? 1.2 : 1.0);
    const atkScore = (m) => (m.power || 0) * ((m.acc || 100) / 100) * stabScore(m) + ((m.priority ? 10 : 0));
    offensive.sort((a,b)=>atkScore(b)-atkScore(a));
    utility.sort((a,b)=>(!!b.effect)-(!!a.effect) || ((b.pp||0)-(a.pp||0)));

    const out = [];
    if (offensive[0]) out.push(offensive[0]);
    if (offensive[1] && offensive[1] !== offensive[0]) out.push(offensive[1]);
    if (utility[0] && !out.includes(utility[0])) out.push(utility[0]);
    for (const m of unique.sort((a,b)=>atkScore(b)-atkScore(a))) {
      if (out.length >= 4) break;
      if (!out.includes(m)) out.push(m);
    }
    return out.slice(0, 4);
  };

  const partsList = Object.values(parts).filter(Boolean);
  const candidateIds = partsList.flatMap(p => (Array.isArray(p.moveIds) && p.moveIds.length ? p.moveIds : pickPartMoves(p)));
  const moveCandidates = candidateIds
    .map(id => MOVE_DB[id])
    .filter(Boolean)
    .map(toMove);
  const starterMoves = pickStarterMoves(moveCandidates);

  // Emoji based on type
  const typeEmoji = TYPE_ICON[type] || '\u{1F986}';

  // BST should always come directly from raw part stats.
  const combatStats = {
    hp: Math.max(1, Math.round(stats.hp)),
    atk: Math.max(1, Math.round(stats.atk)),
    def: Math.max(1, Math.round(stats.def)),
    spd: Math.max(1, Math.round(stats.spd)),
    luck: Math.max(1, Math.round(stats.luck)),
  };

  return { name, type, type2, passive, stats: combatStats, moves: starterMoves, moveCandidates, emoji: typeEmoji };
}

function confirmAssembly() {
  const allSelected = Object.values(assembledParts).every(p => p !== null);
  if (!allSelected) return;

  const derived = deriveHonkerFromParts(assembledParts);
  const byId = new Map((derived.moveCandidates || []).map(m => [m.id, m]));
  const selectedMoves = selectedStarterMoveIds.map(id => byId.get(id)).filter(Boolean).slice(0, 4);
  if (selectedMoves.length !== 4) return;
  const stats = derived.stats;

  const newHonker = {
    id: 'assembled_' + Date.now(),
    name: derived.name,
    emoji: derived.emoji,
    type: derived.type,
    type2: derived.type2 || null,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    luck: stats.luck,
    moveIds: selectedMoves.map(m => m.id).filter(Boolean),
    moves: selectedMoves,
    moveCandidates: derived.moveCandidates || [],
    lore: `Built from ${[...new Set(Object.values(assembledParts).map(p=>p.family.name))].join(', ')} parts. Custom-forged in the workshop.`,
    passive: derived.passive,
    assembledParts: { head: assembledParts.head, torso: assembledParts.torso, wings: assembledParts.wings, legs: assembledParts.legs },
  };
  
  // Use the assembled honker
  CAMPAIGN.playerBase = newHonker;
  CAMPAIGN.player = null;
  CAMPAIGN.party = [newHonker];
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
  
  // Reset boosts
  newHonker.maxHPBonus = 0;
  newHonker.atkFlat = 0;
  newHonker.atkMult = 1;
  newHonker.luckBonus = 0;
  newHonker.stabBonus = 1.25;
  newHonker.chaosMod = 1;
  newHonker.ppBonus = 0;
  newHonker.level = 1;
  newHonker.xp = 0;
  newHonker.xpNeeded = 100;
  newHonker.totalXp = 0;
  newHonker.masteryLevel = 0;
  newHonker.masteryXP = 0;
  newHonker.masteryXPNeeded = masteryXpNeededForLevel(0);
  newHonker.masteryTotalXp = 0;
  initHonkerRunState(newHonker);
  
  startNextStageFromLoop();
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  CAMPAIGN MAP
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function showCampaignMap() {
  refreshCampaignSidebar();
  buildStageMap();
  const deepest = CAMPAIGN.deepest || CAMPAIGN.stageIdx;
  document.getElementById('camp-map-sub').textContent =
    `Stage ${CAMPAIGN.stageIdx + 1} of Infinite • Deepest: ${deepest}`;
  showScreen('screen-campaign');
}

function refreshCampaignSidebar() {
  const pb=CAMPAIGN.playerBase;
  if(!pb) return;
  const portraitEl = document.getElementById('camp-emoji');
  if (pb.assembledParts && (pb.assembledParts.head || pb.assembledParts.torso)) {
    // Render a mini composite portrait
    portraitEl.classList.remove('portrait-emoji');
    portraitEl.classList.add('portrait-composite');
    portraitEl.style.fontSize = '0';
    portraitEl.style.position = 'relative';
    portraitEl.style.width = '72px';
    portraitEl.style.height = '72px';
    portraitEl.style.margin = '0 auto';
    buildCompositeSprite(pb.assembledParts, portraitEl, 'pc');
  } else {
    portraitEl.classList.remove('portrait-composite');
    portraitEl.classList.add('portrait-emoji');
    portraitEl.innerHTML = '';
    portraitEl.style.fontSize = '';
    portraitEl.style.position = '';
    portraitEl.style.width = '';
    portraitEl.style.height = '';
    portraitEl.textContent = pb.emoji;
  }
  portraitEl.style.setProperty('--gc', TC[pb.type]);
  document.getElementById('camp-name').textContent=pb.name;
  const tb=document.getElementById('camp-type-badge');
  tb.textContent=(pb.type2 ? `${pb.type}/${pb.type2}` : pb.type) + ' Type'; tb.style.color=TC[pb.type];
  const lv  = pb.level    || 1;
  const xp  = pb.xp       || 0;
  const need= pb.xpNeeded || 100;
  document.getElementById('camp-level').textContent=`LV ${lv}`;
  document.getElementById('xp-nums').textContent=`${xp}/${need}`;
  document.getElementById('xp-fill').style.width=(xp/need*100)+'%';

  const maxHP=getHonkerMaxHP(pb);
  const invLabel = document.getElementById('inv-title-label');
  if (invLabel) invLabel.textContent = (pb.inventory?.length || CAMPAIGN.inventory.length) ? pb.name + "'S ITEMS" : 'INVENTORY';
  document.getElementById('cs-maxhp').textContent=maxHP;
  document.getElementById('cs-atk').textContent=((pb.atkMult||1)*100-100>0?'+':'')+Math.round(((pb.atkMult||1)-1)*100)+'% + '+(pb.atkFlat||0);
  document.getElementById('cs-luck').textContent=Math.min(95,(pb.luck||50)+(pb.luckBonus||0))+'%';
  document.getElementById('cs-coins').textContent=CAMPAIGN.coins||0;

  // Retries
  const rc=document.getElementById('camp-retries');
  rc.innerHTML='';
  for(let i=0;i<CAMPAIGN.maxRetries;i++){
    const h=document.createElement('span');
    h.className='retry-heart'+(i>=CAMPAIGN.retries?' lost':'');
    h.textContent='❤️'; rc.appendChild(h);
  }

  // Party
  const pg = document.getElementById('camp-party');
  const pc = document.getElementById('camp-party-count');
  if (pg) {
    pg.innerHTML = '';
    if (pc) pc.textContent = `(${CAMPAIGN.party.length}/6)`;
    CAMPAIGN.party.forEach((h, i) => {
      const card = document.createElement('div');
      card.className = 'party-mini' + (i === CAMPAIGN.activeIdx ? ' active-p' : '');
      const passiveTxt = h.passive ? `${h.passive.emoji} ${h.passive.name}` : '';
      const isActive = i === CAMPAIGN.activeIdx;
      card.innerHTML = `
        <div class="pm-emoji">${h.emoji}</div>
        <div class="pm-info">
          <div class="pm-name">${h.name}</div>
          <div class="pm-type" style="color:${TC[h.type]}">${h.type} &nbsp; <span style='color:var(--gold)'>LV ${h.level||1}</span></div>
          ${passiveTxt ? `<div class="pm-passive">${passiveTxt}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:.25rem;align-items:center;flex-shrink:0;">
          ${!isActive ? `<button class="btn btn-blue" style="font-size:.28rem;padding:.22rem .45rem" onclick="switchActiveHonker(${i})">USE</button>` : '<span style="font-size:.5rem;color:var(--gold)">-</span>'}
          ${CAMPAIGN.party.length > 1 && !isActive ? `<button class="btn-release" onclick="releaseHonker(${i},true)">FREE</button>` : ''}
        </div>
      `;
      pg.appendChild(card);
    });
  }

  // Items  -  show active honker's items + shared/global items
  const il=document.getElementById('camp-items');
  il.innerHTML='';
  const honkerItems = (pb.inventory || []);
  const sharedItems = (CAMPAIGN.inventory || []);
  if (!honkerItems.length && !sharedItems.length) {
    il.innerHTML='<div class="no-items">No items yet</div>';
    return;
  }
  if (sharedItems.length) {
    const hdr = document.createElement('div');
    hdr.style.cssText='font-size:.5rem;color:var(--gold);font-family:"Press Start 2P",monospace;margin-bottom:.25rem;opacity:.7';
    hdr.textContent='SHARED';
    il.appendChild(hdr);
    sharedItems.forEach(item=>{
      const chip=document.createElement('div');
      chip.className='item-chip';
      chip.innerHTML=`<div class="item-rarity" style="background:${item.color}"></div>
        <span class="item-name">${item.emoji} ${item.name}</span>`;
      il.appendChild(chip);
    });
  }
  if (honkerItems.length) {
    if (sharedItems.length) {
      const hdr2 = document.createElement('div');
      hdr2.style.cssText='font-size:.5rem;color:var(--dim);font-family:"Press Start 2P",monospace;margin:.4rem 0 .25rem';
      hdr2.textContent=`${pb.emoji} ${pb.name}`;
      il.appendChild(hdr2);
    }
    honkerItems.forEach(item=>{
      const chip=document.createElement('div');
      chip.className='item-chip';
      chip.innerHTML=`<div class="item-rarity" style="background:${item.color}"></div>
        <span class="item-name">${item.emoji} ${item.name}</span>`;
      il.appendChild(chip);
    });
  }
}

function switchActiveHonker(idx) {
  if (idx < 0 || idx >= CAMPAIGN.party.length) return;
  CAMPAIGN.activeIdx = idx;
  CAMPAIGN.playerBase = CAMPAIGN.party[idx];
  refreshCampaignSidebar();
}

function buildStageMap() {
  const path = document.getElementById('stage-path');
  path.innerHTML = '';

  // Show: 2 completed before current, current, and 2 upcoming previews
  const cur = CAMPAIGN.stageIdx; // 0-indexed (stageIdx 0 = stage 1)
  const from = Math.max(0, cur - 2);
  const to   = cur + 2;

  for (let i = from; i <= to; i++) {
    const stageN = i + 1; // 1-indexed
    const stage  = generateStage(stageN);
    const done   = i < cur;
    const current= i === cur;
    const locked = i > cur;

    if (i > from) {
      const conn = document.createElement('div');
      conn.className = 'stage-connector' + (done ? ' done' : '');
      path.appendChild(conn);
    }

    const node = document.createElement('div');
    node.className = `stage-node${done ? ' done' : current ? ' current' : ' locked'}`;

    // Difficulty stars
      const stars = Array.from({length:5},(_,j)=>
      `<span class="diff-star" style="color:${j<stage.difficulty?'var(--gold)':'var(--border)'}">★</span>`
    ).join('');

    // Power balance hint for current stage
    let balanceHint = '';
    if (current && CAMPAIGN.playerBase) {
      const pp = playerPower(CAMPAIGN.playerBase);
      const ep = stageThreat(stageN);
      const ratio = pp / ep;
      if (ratio >= 1.1)       balanceHint = `<span style="color:#76ff03;font-size:.65rem">▲ Favoured</span>`;
      else if (ratio >= 0.85) balanceHint = `<span style="color:var(--gold);font-size:.65rem">⚖ Balanced</span>`;
      else                     balanceHint = `<span style="color:#ff5252;font-size:.65rem">▼ Dangerous</span>`;
    }

    node.innerHTML = `
      <div class="sn-header">
        <div>
          <div class="sn-num">STAGE ${stageN}${stage.isBoss ? '  -  BOSS' : ''}</div>
          <div class="sn-name">${stage.name}</div>
        </div>
        <div class="difficulty-stars" style="display:flex;gap:2px">${stars}</div>
      </div>
      <div class="sn-enemy">
        <div class="sn-enemy-emoji">${locked ? '?' : stage.enemy.emoji}</div>
        <div class="sn-enemy-info">
          <div class="sn-enemy-name">${locked ? '???' : stage.enemy.name}</div>
          <div class="sn-enemy-type" style="color:${locked ? 'var(--dim)' : TC[stage.enemy.type]}">
            ${locked ? 'Unknown Type' : (stage.enemy.type2 ? `${stage.enemy.type}/${stage.enemy.type2}` : stage.enemy.type) + ' Type • HP ' + stage.enemy.hp}
          </div>
        </div>
      </div>
      ${!locked ? `<div class="sn-desc">${stage.desc}</div>` : ''}
      <div class="sn-rewards" style="margin-top:.4rem">
        <span class="reward-tag" style="color:#00ff88;border-color:#00ff88">+${stage.xpReward} XP</span>
        <span class="reward-tag" style="color:var(--gold);border-color:var(--gold)">LOOT CHOICE</span>
        ${stage.isBoss ? '<span class="reward-tag" style="color:#ff6a00;border-color:#ff6a00">⚔ BOSS</span>' : ''}
        ${balanceHint}
      </div>
      ${current ? `<button class="btn btn-gold btn-fight" style="margin-top:.7rem;width:100%" onclick="startStageBattle(${i})">⚔ FIGHT • STAGE ${stageN}</button>` : ''}
    `;
    path.appendChild(node);
  }

  // Bottom "continues forever" indicator
  const inf = document.createElement('div');
  inf.style.cssText = 'text-align:center;padding:1rem;font-family:"Press Start 2P",monospace;font-size:.35rem;color:var(--dim);letter-spacing:.15em;';
  inf.innerHTML = '∞ THE HONK REALM HAS NO END ∞';
  path.appendChild(inf);
}

function buildRetryIcons() {
  const r=document.getElementById('bt-retries');
  r.innerHTML='';
  for(let i=0;i<CAMPAIGN.maxRetries;i++){
    const ic=document.createElement('span');
    ic.className='retry-icon'+(i>=CAMPAIGN.retries?' lost':'');
    ic.textContent='❤️'; r.appendChild(ic);
  }
}

function buildTypeLegend() {
  const g=document.getElementById('type-legend');
  g.innerHTML='<span class="legend-title">TYPE CHART:</span>';
  [['Fire','Ice'],['Ice','Lightning'],['Lightning','Shadow'],['Shadow','Fire']].forEach(([a,b])=>{
    const r=document.createElement('span');r.className='leg-row';
    r.innerHTML=`${a}<span class="leg-sep"> > </span>${b}`;
    g.appendChild(r);
  });
}

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
    badge.textContent = isBoss ? '⚔ LEGENDARY ENCOUNTER ⚔' : '✦ EPIC ENCOUNTER ✦';
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
    existingBadge.textContent = isBoss ? '⚔ LEGENDARY ENCOUNTER ⚔' : '✦ EPIC ENCOUNTER ✦';
    existingBadge.style.color = isBoss ? '#ff6a00' : '#ffd700';
    existingBadge.style.textShadow = isBoss ? '1px 1px 0 #8b0000' : '1px 1px 0 #000';
  }
  
  // Add NEW PARTS badge if enemy has uncaught parts
  const partsParent = nameEl.parentElement;
  const existingPartsBadge = partsParent.querySelector('.new-parts-badge');
  if (f._hasNewParts && !existingPartsBadge) {
    const partsBadge = document.createElement('div');
    partsBadge.className = 'new-parts-badge';
    partsBadge.textContent = '✨ NEW PARTS ✨';
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
  statStrip.innerHTML = `<span title="Attack">⚔${f.atk||80}</span> <span title="Defense">🛡${f.def||80}</span> <span title="Speed">⚡${f.spd||80}</span> <span title="Luck">🍀${Math.min(95,(f.luck||50)+(f.luckBonus||0))}%</span>`;
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
  if(bDead){ body.innerHTML=''; return; }
  if(bAutoOn){ hdrName.textContent='AUTO'; body.innerHTML=`<div class="ai-msg"><span>⚡ AUTO BATTLE IN PROGRESS...</span></div>`; return; }
  if(bPhase==='p1'){
    const f=bFighters[0], e=bFighters[1];
    hdrName.textContent=f.name;
    const grid=document.createElement('div'); grid.className='move-grid';
    f.moves.forEach((m,i)=>{
      const eff=getEff(m.type,e.type,e.type2);
      let effHtml='';
      if(eff>=2) effHtml=`<span class="mb-eff eff-s">⚡ SUPER</span>`;
      else if(eff<=.5) effHtml=`<span class="mb-eff eff-w">⛔ WEAK</span>`;
      const btn=document.createElement('button');
      btn.className=`move-btn${m.pp<=0?' used-up':''}`;
      btn.style.setProperty('--mc',TC[m.type]);
      btn.disabled=m.pp<=0;
      btn.innerHTML=`<span class="mb-name">${m.emoji} ${m.name}</span>
        <div class="mb-meta">
          <span class="mb-type ${TCC[m.type]}">${m.type}</span>
          ${m.effect && m.power===0
            ? `<span class="mb-stat" style="color:${STATUS_META[m.effect]?.color||'#aaa'}">✦ ${(STATUS_META[m.effect]?.label||'STATUS').toUpperCase()} ${m.effectTarget==='self'?'SELF':'FOE'}</span>`
            : `<span class="mb-stat">PWR <b>${m.power+(m.power>0?f.atkFlat||0:0)}</b></span><span class="mb-stat">ACC <b>${m.acc}%</b></span>`
          }
          <span class="mb-pp" style="margin-left:auto">PP <b>${m.pp}/${m.maxPP}</b></span>${effHtml}
        </div>
        <div class="mb-desc">${m.desc}</div>`;
      btn.onclick=()=>p1UsesMove(i);
      grid.appendChild(btn);
    });
    body.innerHTML=''; body.appendChild(grid);
  } else if(bPhase==='p2'){
    hdrName.textContent='CPU thinking...';
    body.innerHTML=`<div class="ai-msg"><span>🤔 ${bFighters[1].name} is choosing a move...</span></div>`;
  } else {
    hdrName.textContent=' - ';
    body.innerHTML=`<div class="ai-msg" style="color:var(--dim)">...</div>`;
  }
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  WILD EVENTS
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function maybeFireEvent() {
  if(bRound<=2) return;
  if(bRound-lastEventRound<3) return;
  if(Math.random()>0.28) return;
  const ev=WILD_EVENTS[Math.floor(Math.random()*WILD_EVENTS.length)];
  lastEventRound=bRound;
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
  ev.apply(eventState, bFighters);
  log('ev', ev.log);
  // Handle immediate HP changes
  if(ev.id==='rain'||ev.id==='crowd'||ev.id==='swap') {
    bFighters.forEach(f=>{ updateHP(f,f.side); });
  }
  if(ev.id==='goose') {
    const target=bFighters[Math.floor(Math.random()*2)];
    const dmg=25+Math.floor(Math.random()*25);
    target.currentHP=Math.max(1,target.currentHP-dmg);
    updateHP(target,target.side);
    log('ev',`🪿 The wild goose honks ${target.name} for ${dmg} damage!`);
    spawnPtcl(target.side,'#ff9800','🪿');
  }
  if(ev.id==='doubles'&&eventState.doubledMove) {
    log('ev',`🎴 ${eventState.doubledMove.fighter}'s "${eventState.doubledMove.name}" power DOUBLED!`);
  }
  if(ev.id==='rage'&&eventState.rageTarget) {
    addStatusBadge(eventState.rageTarget,'😤 RAGE','#ff4444');
    log('ev',`😤 ${bFighters.find(f=>f.side===eventState.rageTarget)?.name} enters RAGE MODE (+50% ATK)!`);
  }
  if(ev.id==='wisdom') {
    bFighters.forEach(f=>updatePPDots(f,f.side));
    log('ev','📜 All PP restored!');
  }
  if(ev.id==='gravity') addStatusBadge('left','🌌 CERTAIN','#00c8ff'), addStatusBadge('right','🌌 CERTAIN','#00c8ff');
  if(ev.id==='mirror') addStatusBadge('left','🪞 MIRROR','#e040fb'), addStatusBadge('right','🪞 MIRROR','#e040fb');
  if(ev.id==='amnesia') addStatusBadge('left','❔ NO TYPE','#aaa'), addStatusBadge('right','❔ NO TYPE','#aaa');
}

function tickEventState() {
  if(eventState.duration>0){ eventState.duration--; if(eventState.duration<=0) delete eventState.accuracyMod; }
  if(eventState.typeIgnoredRounds>0){ eventState.typeIgnoredRounds--; if(eventState.typeIgnoredRounds<=0){ typeOverride=false; eventState.typeIgnored=false; bFighters.forEach(f=>refreshStatusBadges(f)); log('n','❔ Type advantages return to normal.'); }}
  if(eventState.guaranteeDur>0){ eventState.guaranteeDur--; if(eventState.guaranteeDur<=0){ delete eventState.guaranteedHit; bFighters.forEach(f=>refreshStatusBadges(f)); }}
  if(eventState.rageDur>0){ eventState.rageDur--; if(eventState.rageDur<=0){ delete eventState.rageTarget; delete eventState.rageMod; bFighters.forEach(f=>refreshStatusBadges(f)); log('n','😤 Rage fades.'); }}
  // Tick each fighter's status effects
  bFighters.forEach(f => {
    const died = tickStatusEffects(f);
    if (died && !bDead) endBattle(bFighters.find(x=>x.side!==f.side), f);
  });
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  COMBAT
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  CATCH SYSTEM
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function updateCatchButton() {
  const btn = document.getElementById('btn-catch');
  if (!btn) return;
  const enemy = bFighters[1];
  const stage = CAMPAIGN._currentStage;
  const hpThresh = stage?.isBoss ? 0.20 : 0.35;
  const canCatch = !bDead
    && (bPhase === 'p1')
    && !bAutoOn
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
  if (bDead || bPhase !== 'p1') return;
  const enemy = bFighters[1];
  if (!enemy || enemy.isDead()) return;
  bPhase = 'busy';
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
    if (Math.random() * 100 <= catchChance) {
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
      bPhase = 'p2';
      renderMovePanel();
      setTimeout(() => {
        if (bDead) return;
        const aiMove = bFighters[1].aiPickMove(bFighters[0]);
        bPhase = 'busy';
        doMove(bFighters[1], bFighters[0], aiMove, () => {
          if (bDead) return;
          tickEventState();
          bPhase = 'p1';
          renderMovePanel();
          updateCatchButton();
        });
      }, 600);
    }
  }, 900);
}

function onCatchSuccess(enemy) {
  bDead = true;
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
    // Slight random stat variance (±12%)  -  every catch is a little different
    atk: Math.round((enemyBase.atk||80) * (0.88 + Math.random()*0.24)),
    def: Math.round((enemyBase.def||80) * (0.88 + Math.random()*0.24)),
    spd: Math.round((enemyBase.spd||80) * (0.88 + Math.random()*0.24)),
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
  const caughtDexId = bFighters[1]._dexId;
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
      log('g', `🪙 +${coinGain} coins earned.`);
      if (unlockedNow > 0) log('g', `🧩 Unlocked ${unlockedNow} new part${unlockedNow === 1 ? '' : 's'}!`);
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
  document.getElementById('loot-screen-title').textContent = '🪤 HONKER CAUGHT!';
  document.getElementById('loot-sub').textContent          = `${caught.name} joins your party!`;
  document.getElementById('loot-xp-msg').textContent       = `+${xpGain} XP • Party: ${CAMPAIGN.party.length}/6`;
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
      ❤️ HP <b>${caught.hp}</b> &nbsp; 🍀 Luck <b>${caught.luck}%</b><br>
      <span style="color:var(--dim);font-size:.72rem">${caught.moves.map(m=>`${m.emoji} ${m.name}`).join(' · ')}</span>
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

  document.getElementById('loot-skip').textContent = '→ Continue to map';
  renderLootShop();
  showScreen('screen-loot');
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  BATTLE END
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function endBattle(winner, loser) {
  bDead=true;
  stopAuto();
  setTimeout(()=>{
    setSpriteAnimClass(loser.side, 'a-d');
    log('x',`💀 <b>${loser.name}</b> has been honked into oblivion!`);
    log('g',`🏆 <b style="color:${TC[winner.type]}">${winner.name}</b> WINS THE BATTLE!`);
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
    log('g', `🪙 +${coinGain} coins earned.`);
    if (stage.isBoss) {
      showBossClear(stage, stageN, xpGain);
    } else {
      showLootScreen(xpGain);
    }
  });
}

function onPlayerLose(player) {
  bSwapMode = false;
  // Keep fainted honkers in party so they still count toward the 6-slot cap.
  const faintedIdx = CAMPAIGN.activeIdx;
  const fainted = CAMPAIGN.party[faintedIdx];
  syncActiveFighterToCampaign();
  if (fainted) clearPersistentEffects(fainted);
  if (fainted) fainted.currentHP = 0;
  CAMPAIGN.playerBase = CAMPAIGN.party[CAMPAIGN.activeIdx] || CAMPAIGN.playerBase;
  saveCampaign();
  log('x', `💀 <b>${fainted ? fainted.name : 'Your honker'}</b> has fainted...`);

  const alive = CAMPAIGN.party
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => (h.currentHP ?? getHonkerMaxHP(h)) > 0);
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
let _pendingCaught = null; // honker waiting to be placed if party full

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
  _pendingCaught = { honker: caughtHonker, xpGain };
  const newCard = document.getElementById('rep-new-card');
  newCard.innerHTML = `
    <span class="rep-new-emoji">${caughtHonker.emoji}</span>
    <div style="font-family:'Press Start 2P',monospace;font-size:.36rem;color:var(--gold)">${caughtHonker.name}</div>
    <div style="font-size:.7rem;font-weight:700;color:${TC[caughtHonker.type]}">${caughtHonker.type}</div>
    <div style="font-size:.65rem;color:var(--dim);margin-top:.2rem">❤️ ${caughtHonker.hp} &nbsp; Y? ${caughtHonker.luck}%</div>
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
  if (!_pendingCaught) return;
  const { honker, xpGain } = _pendingCaught;
  _pendingCaught = null;
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
  if (!_pendingCaught) return;
  const { xpGain } = _pendingCaught;
  _pendingCaught = null;
  // New honker is released  -  just go to loot/map
  showLootScreen(xpGain);
}

function showSwitchOverlay(aliveMembers, reason='faint') {
  const ttl = document.querySelector('#switch-overlay .sw-title');
  const sub = document.getElementById('sw-sub');
  const grid = document.getElementById('sw-grid');
  if (ttl) ttl.textContent = reason === 'swap' ? '🔁 SWITCH HONKER' : '⚠ HONKER FAINTED!';
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
  document.getElementById('switch-overlay').classList.add('show');
}

function switchInPartyMember(partyIdx) {
  const oldIdx = CAMPAIGN.activeIdx;
  if (bSwapMode) {
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
  bFighters[0] = newFighter;
  bDead = false; bPhase = 'p1';
  setupFighterUI(newFighter, 'left');
  resetSpriteClass('left');
  if (pb.passive && pb.passive.id === 'cursed_aura' && !bFighters[1].statusEffects.cursed) {
    bFighters[1].statusEffects.cursed = 2; refreshStatusBadges(bFighters[1]);
  }
  if (pb.passive && pb.passive.id === 'shield_wall') {
    newFighter.statusEffects.shielded = Math.max(1, Math.min(4, (newFighter.statusEffects.shielded || 0) + 1)); refreshStatusBadges(newFighter);
  }
  const ps = document.getElementById('passive-left');
  if (pb.passive) { ps.textContent = pb.passive.emoji + ' ' + pb.passive.name; ps.style.display = ''; }
  else { ps.style.display = 'none'; }
  log('ev', '<b style="color:' + TC[pb.type] + '">' + pb.name + '</b> enters the arena!');
  renderMovePanel(); updateCatchButton();
  if (bSwapMode) {
    bSwapMode = false;
    bPhase = 'p2';
    renderMovePanel();
    setTimeout(() => {
      if (bDead) return;
      const aiMove = bFighters[1].aiPickMove(bFighters[0]);
      bPhase = 'busy';
      doMove(bFighters[1], bFighters[0], aiMove, () => {
        if (bDead) return;
        tickEventState();
        bPhase = 'p1';
        renderMovePanel();
        updateCatchButton();
      });
    }, 420);
  }
}

function openBattleSwap() {
  if (bDead || bPhase !== 'p1' || bAutoOn) return;
  const currentIdx = CAMPAIGN.activeIdx;
  const options = CAMPAIGN.party
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => i !== currentIdx && ((h.currentHP ?? getHonkerMaxHP(h)) > 0));
  if (!options.length) {
    log('w', 'No other healthy party member is available to swap.');
    return;
  }
  bSwapMode = true;
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
    <div class="os-row"><span>Rounds fought</span><b>${bRound}</b></div>
    <div class="os-row"><span>Your HP left</span><b>${bFighters[0]?.currentHP||0}/${bFighters[0]?.maxHP||0}</b></div>
    <div class="os-row"><span>Retries left</span><b style="color:#ff5252">${CAMPAIGN.retries} ❤️</b></div>
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
//  XP & LEVELING
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
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
  log('g', `✨ <b>${h.name}</b> reached <b>Mastery ${mlv}</b>! All stats bonus is now <b>+${bonusPct}%</b>.`);
}

function onLevelUp(h) {
  const name = h ? h.name : '???';
  const lv   = h ? h.level : '?';
  log('g', `🎉 <b>${name}</b> reached <b>LV ${lv}</b>! Stats scaled up (HP/ATK/DEF/SPD).`);
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
//  LOOT SCREEN
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function showLootScreen(xpGain) {
  closeLootPartyOverlay();
  document.getElementById('loot-screen-title').textContent = '⚔ VICTORY SPOILS ⚔';
  document.getElementById('loot-sub').textContent          = 'Choose one item to keep';
  document.getElementById('loot-skip').textContent         = 'Skip (take nothing)';
  const _pb = CAMPAIGN.playerBase;
  document.getElementById('loot-xp-msg').textContent = `+${xpGain} XP EARNED • ${_pb ? _pb.name : ''} NOW LV ${_pb ? (_pb.level||1) : 1}`;
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
    <div class="loot-shop-title">SHOP • 🪙 ${(CAMPAIGN.coins || 0)} COINS</div>
    <div class="loot-shop-row">
      <div>❤️ Field Ration (+${hpHeal} HP) <span style="color:var(--dim)">[${curHP}/${maxHP}]</span></div>
      <button class="btn btn-blue loot-shop-buy" onclick="buyLootHeal()" ${canAffordCoins(SHOP_COSTS.heal) ? '' : 'disabled'}>BUY ${SHOP_COSTS.heal}</button>
    </div>
    <div class="loot-shop-row">
      <div>🌱 PP Seed (restore +4 PP to each move)</div>
      <button class="btn btn-blue loot-shop-buy" onclick="buyLootPP()" ${canAffordCoins(SHOP_COSTS.pp) ? '' : 'disabled'}>BUY ${SHOP_COSTS.pp}</button>
    </div>
    <div class="loot-shop-row">
      <div>🪽 Revive Honker <span style="color:var(--dim)">[fainted ${faintedCount}]</span></div>
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
  log('g', `❤️ ${pb.name} recovered ${heal} HP.`);
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
  log('g', `🌱 ${pb.name}'s PP was restored.`);
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
  const pool = [...LOOT_POOL];
  // Weighted: legendary = 8%, rare = 28%, common = 64%
  const weights = pool.map(i=>i.rarity==='legendary'?8:i.rarity==='rare'?28:64);
  const chosen=[];
  const used=new Set();
  while(chosen.length<n && chosen.length<pool.length){
    const total=weights.reduce((a,w,i)=>used.has(i)?a:a+w,0);
    let r=Math.random()*total, idx=0;
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
  if (titleEl) titleEl.textContent = _lootPartyMode === 'revive' ? '🪽 CHOOSE REVIVE TARGET' : '👥 CURRENT PARTY';
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
        <span class="lp-emoji">${h.emoji || '🪿'}</span>
        <div>
          <div class="lp-name">${h.name || 'Unknown'}</div>
          <div class="lp-type" style="color:${TC[h.type] || '#aaaacc'}">${h.type || 'Normal'} • LV ${h.level || 1}</div>
        </div>
      </div>
      <div class="lp-stats">❤️ ${curHp}/${maxHp} &nbsp; ⚔️ ${h.atk || 80} &nbsp; 🛡️ ${h.def || 80} &nbsp; ⚡ ${h.spd || 80} &nbsp; 🍀 ${h.luck || 50}%</div>
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
          log('g', `🪽 ${h.name} was revived.`);
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
  log('g', `🎁 ${who}received: ${item.emoji} <b>${item.name}</b>!`);
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
    // Signature moves: grey out and disable for ineligible honkers
    const exclusive = item.exclusiveTo;
    const ineligible = exclusive && !exclusive.includes(h.id);
    const card = document.createElement('div');
    const isFull = !ineligible && h.moves.length >= 4;
    card.className = 'teach-card' + (isFull ? ' tc-full' : '') + (ineligible ? ' tc-ineligible' : '');
    const moveRows = h.moves.map(m =>
      `<div class="teach-move-row"><span>${m.emoji} ${m.name}</span></div>`
    ).join('');
    card.innerHTML = `
      <span class="teach-emoji">${h.emoji}</span>
      <div class="teach-name">${h.name}</div>
      <div class="teach-type" style="color:${window.TC ? window.TC[h.type] : '#aaa'}">${h.type} · LV ${h.level||1}</div>
      <div class="teach-moves">${moveRows}</div>
      ${isFull ? '<div style="font-size:.55rem;color:#ff9800;margin-top:.3rem">⚠ Will replace a move</div>' : ''}
    `;
    card.onclick = ineligible ? null : () => teachMoveTo(i);
    if (ineligible) card.title = 'Only specific honkers can learn this move';
    grid.appendChild(card);
  });

  // Update overlay title based on item type
  const isMove = !!item?.moveId;
  document.querySelector('#teach-overlay .teach-title').textContent = isMove ? '📚 WHO LEARNS THIS MOVE?' : '🎁 WHO GETS THIS ITEM?';
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
  stopAuto();bDead=false;
  showCampaignMap();
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

async function clearCampaignSave() {
  try {
    try {
      await fetch('/api/save/run', { method: 'DELETE' });
      await fetch('/api/save/campaign', { method: 'DELETE' });
      await fetch('/api/save/global', { method: 'DELETE' });
      await fetch('/api/save/dex', { method: 'DELETE' });
    } catch (_) {}
  } catch(e) {}
}
async function continueCampaign(){
  const ok = await loadCampaign();
  if (!ok || !CAMPAIGN.party || CAMPAIGN.party.length === 0) {
    await clearCampaignSave();
    const contBtn = document.getElementById('cont-btn');
    if (contBtn) contBtn.style.display = 'none';
    showScreen('screen-title');
    return;
  }
  startNextStageFromLoop();
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  PERSISTENT SAVE / LOAD
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function serializeHonkerForSave(h) {
  if (typeof ensureHonkerMoveIds === 'function') ensureHonkerMoveIds(h);
  return {
    id: h.id, name: h.name, emoji: h.emoji, type: h.type, type2: h.type2 || null,
    hp: h.hp, luck: h.luck, lore: h.lore, isCaught: h.isCaught || false,
    passive: h.passive || null,
    level: h.level||1, xp: h.xp||0, xpNeeded: h.xpNeeded||100, totalXp: h.totalXp||0,
    masteryLevel: h.masteryLevel||0, masteryXP: h.masteryXP||0,
    masteryXPNeeded: h.masteryXPNeeded||masteryXpNeededForLevel(h.masteryLevel||0),
    masteryTotalXp: h.masteryTotalXp||0,
    inventory: h.inventory||[],
    atk: h.atk||80, def: h.def||80, spd: h.spd||80,
    assembledParts: h.assembledParts || null,
    moveIds: (h.moveIds || []).slice(),
    moves: (h.moves || []).map(m => ({ ...m })),
    moveCandidates: (h.moveCandidates || []).map(m => ({ ...m })),
    maxHPBonus: h.maxHPBonus||0, atkFlat: h.atkFlat||0, atkMult: h.atkMult||1,
    luckBonus: h.luckBonus||0, stabBonus: h.stabBonus||1.25,
    chaosMod: h.chaosMod||1, ppBonus: h.ppBonus||0,
    currentHP: h.currentHP ?? getHonkerMaxHP(h),
    movePP: h.movePP || null,
    persistentEffects: h.persistentEffects || {},
  };
}
function hydrateSavedHonker(saved) {
  const base = ROSTER.find(r => r.id === saved.id) || saved;
  const h = JSON.parse(JSON.stringify(base));
  h.maxHPBonus = saved.maxHPBonus || 0;
  h.atkFlat    = saved.atkFlat    || 0;
  h.atkMult    = saved.atkMult    || 1;
  h.luckBonus  = saved.luckBonus  || 0;
  h.stabBonus  = saved.stabBonus  || 1.25;
  h.chaosMod   = saved.chaosMod   || 1;
  h.ppBonus    = saved.ppBonus    || 0;
  h.moveIds    = (saved.moveIds || []).slice();
  if (!h.moveIds.length && typeof ensureHonkerMoveIds === 'function') {
    h.moves = saved.moves || [];
    ensureHonkerMoveIds(h);
  }
  if (h.moveIds.length) {
    h.moves = materializeMovesFromIds(h.moveIds);
    const savedMoves = Array.isArray(saved.moves) ? saved.moves : [];
    const savedById = new Map(savedMoves.map(m => [m.id, m]));
    const savedByName = new Map(savedMoves.map(m => [m.name, m]));
    h.moves.forEach(m => {
      const src = savedById.get(m.id) || savedByName.get(m.name);
      if (!src) return;
      // Only restore current pp — power/maxPP/type come from MOVE_DB
      m.pp = Number.isFinite(src.pp) ? Math.max(0, Math.min(m.maxPP, src.pp)) : m.pp;
    });
  } else {
    h.moves = saved.moves || [];
  }
  h.moveCandidates = saved.moveCandidates || [];
  h.isCaught   = saved.isCaught || false;
  h.level      = saved.level    || 1;
  h.xp         = saved.xp       || 0;
  h.xpNeeded   = saved.xpNeeded || 100;
  h.totalXp    = Number.isFinite(saved.totalXp) ? saved.totalXp : undefined;
  ensureLevelState(h);
  h.masteryLevel = saved.masteryLevel || 0;
  h.masteryXP = saved.masteryXP || 0;
  h.masteryXPNeeded = saved.masteryXPNeeded || masteryXpNeededForLevel(h.masteryLevel);
  h.masteryTotalXp = Number.isFinite(saved.masteryTotalXp) ? saved.masteryTotalXp : undefined;
  ensureMasteryState(h);
  h.inventory  = saved.inventory || [];
  h.atk        = saved.atk        || 80;
  h.def        = saved.def        || 80;
  h.spd        = saved.spd        || 80;
  h.type2      = saved.type2      || null;
  h.assembledParts = saved.assembledParts || null;
  h.currentHP  = saved.currentHP ?? getHonkerMaxHP(h);
  h.movePP     = saved.movePP || null;
  if (h.movePP && Array.isArray(h.moves)) {
    const normalizedPP = {};
    h.moves.forEach(m => {
      const v = h.movePP[m.id] ?? h.movePP[m.name];
      if (Number.isFinite(v)) normalizedPP[m.id || m.name] = Math.max(0, Math.min(m.maxPP || m.pp || 0, v));
    });
    h.movePP = normalizedPP;
  }
  h.persistentEffects = saved.persistentEffects || {};
  if (saved.passive) h.passive = saved.passive;
  return h;
}
const RUN_SAVE_KEY = 'run';
const GLOBAL_SAVE_KEY = 'global';

const SAVE_VERSION = 1;

function runToSave() {
  return {
    saveVersion:    SAVE_VERSION,
    playerBaseId:   CAMPAIGN.playerBase?.id,
    runSeed:        CAMPAIGN.runSeed ?? null,
    activeIdx:      CAMPAIGN.activeIdx,
    stageIdx:       CAMPAIGN.stageIdx,
    retries:        CAMPAIGN.retries,
    maxRetries:     CAMPAIGN.maxRetries,
    completedStages:CAMPAIGN.completedStages,
    totalXP:        CAMPAIGN.totalXP,
    level:          CAMPAIGN.level,
    xp:             CAMPAIGN.xp,
    xpNeeded:       CAMPAIGN.xpNeeded,
    deepest:        CAMPAIGN.deepest || 0,
    coins:          CAMPAIGN.coins || 0,
    inventory:      CAMPAIGN.inventory,
    fallen:         (CAMPAIGN.fallen || []).map(serializeHonkerForSave),
    party:          CAMPAIGN.party.map(serializeHonkerForSave),
  };
}
function globalProgressToSave() {
  return {
    dexSeen: CAMPAIGN.dexSeen || [],
    dexCaught: CAMPAIGN.dexCaught || [],
    partsSeen: CAMPAIGN.partsSeen || [],
    caughtParts: CAMPAIGN.caughtParts || [],
    honkerMastery: CAMPAIGN.honkerMastery || {},
  };
}
async function saveGlobalProgress() {
  try {
    await persistSaveBlob(GLOBAL_SAVE_KEY, JSON.stringify(globalProgressToSave()));
  } catch (e) { console.warn('[SAVE] Global progress save failed', e); }
}
async function readSaveBlob(serverKey, legacyServerKey) {
  let raw = null;
  try {
    const r = await fetch(`/api/save/${serverKey}`, { cache: 'no-store' });
    if (r.ok && r.status !== 204) raw = await r.text();
  } catch (_) {}
  if (!raw && legacyServerKey) {
    try {
      const r = await fetch(`/api/save/${legacyServerKey}`, { cache: 'no-store' });
      if (r.ok && r.status !== 204) raw = await r.text();
    } catch (_) {}
  }
  return raw;
}
async function persistSaveBlob(serverKey, payload) {
  let serverSaved = false;
  try {
    const r = await fetch(`/api/save/${serverKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    serverSaved = r.ok;
  } catch (_) {}
  return serverSaved;
}

async function saveCampaign() {
  try {
    const runData = JSON.stringify(runToSave());
    const globalData = JSON.stringify(globalProgressToSave());
    const serverSavedRun = await persistSaveBlob(RUN_SAVE_KEY, runData);
    const serverSavedGlobal = await persistSaveBlob(GLOBAL_SAVE_KEY, globalData);
    if (!serverSavedRun || !serverSavedGlobal) {
      console.warn('[SAVE] Server save unavailable');
    }
    const contBtn = document.getElementById('cont-btn');
    if (contBtn && CAMPAIGN.party && CAMPAIGN.party.length > 0) contBtn.style.display = '';
    flashSaveIndicator();
  } catch(e) { console.warn('Save failed', e); }
}

async function loadCampaign() {
  try {
    const raw = await readSaveBlob(RUN_SAVE_KEY, 'campaign');
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.saveVersion !== SAVE_VERSION) {
      console.warn('[LOAD] Save version mismatch (got', d.saveVersion, ', expected', SAVE_VERSION, '). Discarding.');
      await clearCampaignSave();
      return false;
    }
    const hydrated = (d.party || []).map(hydrateSavedHonker);
    const party = hydrated.filter(h => h.moves && h.moves.length > 0 && (h.hp || 0) > 0);
    if (party.length < hydrated.length) {
      console.warn('[LOAD] Filtered', hydrated.length - party.length, 'invalid honker(s) from save.');
    }
    if (party.length === 0) {
      console.warn('[LOAD] Party empty after validation. Discarding save.');
      await clearCampaignSave();
      return false;
    }
    const fallen = (d.fallen || []).map(hydrateSavedHonker);
    CAMPAIGN.party        = party;
    CAMPAIGN.activeIdx    = Math.min(d.activeIdx || 0, party.length - 1);
    CAMPAIGN.playerBase   = party[CAMPAIGN.activeIdx];
    CAMPAIGN.runSeed      = Number.isFinite(Number(d.runSeed)) ? (Number(d.runSeed) >>> 0) : createRunSeed();
    CAMPAIGN.stageIdx     = d.stageIdx     || 0;
    CAMPAIGN.retries      = d.retries      || 3;
    CAMPAIGN.maxRetries   = d.maxRetries   || 3;
    CAMPAIGN.completedStages = d.completedStages || [];
    CAMPAIGN.totalXP      = d.totalXP      || 0;
    CAMPAIGN.level        = d.level        || 1;
    CAMPAIGN.xp           = d.xp           || 0;
    CAMPAIGN.xpNeeded     = d.xpNeeded     || 100;
    CAMPAIGN.deepest      = d.deepest      || 0;
    CAMPAIGN.coins        = d.coins        || 0;
    CAMPAIGN.inventory    = d.inventory    || [];
    CAMPAIGN.fallen       = fallen;
    // Legacy migration: old campaign saves bundled global progression.
    if ((!CAMPAIGN.caughtParts || !CAMPAIGN.caughtParts.length) && (Array.isArray(d.caughtParts) || Array.isArray(d.unlockedParts))) {
      CAMPAIGN.caughtParts = (d.caughtParts || d.unlockedParts || []).slice();
    }
    if ((!CAMPAIGN.partsSeen || !CAMPAIGN.partsSeen.length) && (Array.isArray(d.partsSeen) || Array.isArray(d.caughtParts) || Array.isArray(d.unlockedParts))) {
      CAMPAIGN.partsSeen = (d.partsSeen || d.caughtParts || d.unlockedParts || []).slice();
    }
    if ((!CAMPAIGN.dexSeen || !CAMPAIGN.dexSeen.length) && Array.isArray(d.dexSeen)) CAMPAIGN.dexSeen = d.dexSeen.slice();
    if ((!CAMPAIGN.dexCaught || !CAMPAIGN.dexCaught.length) && Array.isArray(d.dexCaught)) CAMPAIGN.dexCaught = d.dexCaught.slice();
    if ((!CAMPAIGN.honkerMastery || Object.keys(CAMPAIGN.honkerMastery).length === 0) && d.honkerMastery && typeof d.honkerMastery === 'object') {
      CAMPAIGN.honkerMastery = { ...d.honkerMastery };
    }
    ensurePartTrackingState();
    CAMPAIGN.unlockedParts= CAMPAIGN.caughtParts || [];
    if (!CAMPAIGN.party || CAMPAIGN.party.length === 0) return false;
    CAMPAIGN.started      = true;
    return true;
  } catch(e) { console.warn('Load failed', e); return false; }
}

async function loadGlobalDex() {
  try {
    const raw = await readSaveBlob(GLOBAL_SAVE_KEY, 'dex');
    if (!raw) return;
    const d = JSON.parse(raw);
    CAMPAIGN.dexSeen = d.dexSeen || d.seen || [];
    CAMPAIGN.dexCaught = d.dexCaught || d.caught || [];
    CAMPAIGN.partsSeen = d.partsSeen || [];
    CAMPAIGN.caughtParts = d.caughtParts || d.unlockedParts || [];
    CAMPAIGN.unlockedParts = CAMPAIGN.caughtParts.slice();
    CAMPAIGN.honkerMastery = d.honkerMastery || d.mastery || {};
    ensurePartTrackingState();
  } catch(e) {}
}

function flashSaveIndicator() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  POK?DEX SCREEN
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
let _dexFromScreen = 'screen-title';
function showDex(fromScreen) {
  _dexFromScreen = fromScreen || document.querySelector('.screen.active')?.id || 'screen-title';
  buildDexGrid();
  document.getElementById('dex-back-btn').onclick = () => showScreen(_dexFromScreen);
  showScreen('screen-dex');
}

function buildDexGrid() {
  const grid = document.getElementById('dex-grid');
  const prog = document.getElementById('dex-progress');
  grid.innerHTML = '';
  const seenCount   = CAMPAIGN.dexSeen.length;
  const caughtCount = CAMPAIGN.dexCaught.length;
  prog.textContent  = `SEEN ${seenCount}/${HONKER_DEX.length}  ?  CAUGHT ${caughtCount}/${HONKER_DEX.length}`;

  HONKER_DEX.forEach(dex => {
    const isCaught = CAMPAIGN.dexCaught.includes(dex.id);
    const isSeen   = CAMPAIGN.dexSeen.includes(dex.id);
    const bp = buildDexPartBlueprint(dex);
    const shownType = bp?.derived?.type || dex.type;
    const card = document.createElement('div');
    card.className = 'dex-card ' + (isCaught ? 'dc-caught' : isSeen ? 'dc-seen' : 'dc-unseen');

    const typeColor = TC[shownType] || '#aaa';
    const passiveTxt = dex.passive && isSeen
      ? `<div class="dex-passive-hint">${dex.passive.emoji} ${dex.passive.name}</div>` : '';
    const loreTxt = isSeen ? `<div class="dex-lore">${dex.lore}</div>` : '';
    const caughtBadge = isCaught ? '<div class="dex-caught-badge">o.</div>' : '';
    const bossTag = dex.isBoss ? '<div style="font-size:.55rem;color:var(--gold);margin-top:.1rem">\u{1F451} BOSS</div>' : '';
    card.innerHTML = `
      ${caughtBadge}
      <div class="dex-num">#${String(dex.dexNum).padStart(3,'0')}</div>
      <div class="dex-emoji">${isSeen ? dex.emoji : '"'}</div>
      <div class="dex-name">${isSeen ? dex.name : '???'}</div>
      <div class="dex-type-tag" style="color:${isSeen ? typeColor : '#555'}">${isSeen ? shownType : '?????'}</div>
      ${bossTag}
      ${passiveTxt}
      ${loreTxt}
    `;
    if (isSeen) {
      if (bp?.assembledParts) {
        const em = card.querySelector('.dex-emoji');
        if (em) renderCompositePreview(bp.assembledParts, em, 'dex-composite');
      }
      card.title = dex.lore;
      card.style.cursor = 'pointer';
      card.onclick = () => card.classList.toggle('show-lore');
    }
    grid.appendChild(card);
  });
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  PARTSDEX SCREEN
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
let _partsDexFromScreen = 'screen-title';
function showPartsDex(fromScreen) {
  ensurePartTrackingState();
  _partsDexFromScreen = fromScreen || document.querySelector('.screen.active')?.id || 'screen-title';
  initPartsDexControls();
  buildPartsDexGrid();
  document.getElementById('partsdex-back-btn').onclick = () => showScreen(_partsDexFromScreen);
  showScreen('screen-partsdex');
}

let _partsDexCtlInit = false;
function initPartsDexControls() {
  if (_partsDexCtlInit) return;
  _partsDexCtlInit = true;

  const familySel = document.getElementById('pdx-family');
  const families = [...new Set((PARTS_DATA?.parts || []).map(p => p.family?.name).filter(Boolean))].sort();
  families.forEach(name => {
    const op = document.createElement('option');
    op.value = name;
    op.textContent = name;
    familySel.appendChild(op);
  });

  ['pdx-search','pdx-slot','pdx-rarity','pdx-family','pdx-sort'].forEach(id => {
    const el = document.getElementById(id);
    const ev = id === 'pdx-search' ? 'input' : 'change';
    el.addEventListener(ev, buildPartsDexGrid);
  });
}

function buildPartsDexGrid() {
  const grid = document.getElementById('partsdex-grid');
  const prog = document.getElementById('partsdex-progress');
  if (!grid || !prog) return;
  ensurePartTrackingState();

  const q = (document.getElementById('pdx-search')?.value || '').trim().toLowerCase();
  const slot = document.getElementById('pdx-slot')?.value || 'all';
  const rarity = document.getElementById('pdx-rarity')?.value || 'all';
  const family = document.getElementById('pdx-family')?.value || 'all';
  const sort = document.getElementById('pdx-sort')?.value || 'power_desc';
  const rarityRank = { common: 0, rare: 1, legendary: 2 };
  const slotEmoji = { head:'\u{1F5E3}\uFE0F', torso:'\u{1F4AA}', wings:'\u{1FABD}', legs:'\u{1F9B5}' };
  const rarityColor = { common:'#aaaacc', rare:'#00c8ff', legendary:'#ffd700' };
  const totalParts = (PARTS_DATA?.parts || []).length;
  const seenCount = (CAMPAIGN.partsSeen || []).length;
  const caughtCount = (CAMPAIGN.caughtParts || []).length;

  let parts = [...(PARTS_DATA?.parts || [])];
  parts = parts.filter(p => {
    if (slot !== 'all' && p.slot !== slot) return false;
    if (rarity !== 'all' && p.rarity !== rarity) return false;
    if (family !== 'all' && p.family?.name !== family) return false;
    if (q) {
      const hay = [
        p.id, p.slot, p.rarity, p.archetype, p.family?.name, p.family?.theme,
        ...(p.tags || []), p.description || ''
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const cmpByPower = (a,b) => (b.powerScore||0) - (a.powerScore||0);
  const cmpByName = (a,b) => a.id.localeCompare(b.id);
  if (sort === 'power_desc') parts.sort(cmpByPower);
  if (sort === 'power_asc') parts.sort((a,b) => -cmpByPower(a,b));
  if (sort === 'rarity_desc') parts.sort((a,b) => (rarityRank[b.rarity]-rarityRank[a.rarity]) || cmpByPower(a,b));
  if (sort === 'rarity_asc') parts.sort((a,b) => (rarityRank[a.rarity]-rarityRank[b.rarity]) || cmpByPower(a,b));
  if (sort === 'name_asc') parts.sort(cmpByName);
  if (sort === 'name_desc') parts.sort((a,b) => -cmpByName(a,b));

  grid.innerHTML = '';
  prog.textContent = `SEEN ${seenCount}/${totalParts}  •  CAUGHT ${caughtCount}/${totalParts}`;

  parts.forEach(p => {
    const caught = isPartCaught(p.id);
    const seen = isPartSeen(p.id);
    const visible = seen || caught;
    const c = document.createElement('div');
    c.className = `pdx-card ${caught ? 'pc-caught' : seen ? 'pc-seen' : 'pc-unseen'}`;
    const caughtBadge = caught ? '<div class="pdx-caught-badge" style="color:#ffd700;font-size:.7rem;font-weight:bold;position:absolute;top:.1rem;right:.1rem">o.</div>' : '';
    const artHtml = visible
      ? `<img src="${p.file}" alt="${p.id}">`
      : `<span class="pdx-unk">?</span>`;
    const slotText = visible ? `${slotEmoji[p.slot] || '?'} ${String(p.slot || '').toUpperCase()}` : '?????';
    const rarityText = visible ? String(p.rarity || '').toUpperCase() : '?????';
    const familyText = visible ? (p.family?.name || 'Unknown') : '?????';
    c.innerHTML = `
      ${caughtBadge}
      <div class="pdx-art">${artHtml}</div>
      <div class="pdx-meta">
        <div class="pdx-name">${visible ? p.id : '???'}</div>
        <div class="pdx-sub">
          <span class="pdx-pill">${slotText}</span>
          <span class="pdx-pill" style="color:${visible ? rarityColor[p.rarity] : '#555'}">${rarityText}</span>
          <span class="pdx-pill" style="color:${visible ? '#aaa' : '#555'}">${familyText}</span>
          ${caught ? '<span class="pdx-pill" style="color:#ffd700;border-color:#ffd700">CAUGHT</span>' : ''}
        </div>
        <div class="pdx-power">${visible ? `PWR ${Math.round(p.powerScore || 0)}` : 'PWR ???'}</div>
        <div class="pdx-stats">${visible ? `❤️${p.stats.hp} ⚔️${p.stats.atk} 🛡️${p.stats.def} ⚡${p.stats.spd} 🍀${p.stats.luck}` : '?????'}</div>
      </div>
    `;
    c.title = visible ? (p.description || '').replace(/<[^>]*>/g, '') : 'Unknown part';
    grid.appendChild(c);
  });
}
function xpNeededForLevel(level) {
  const lv = Math.max(1, Number(level) || 1);
  return Math.max(100, Math.round(100 * Math.pow(1.34, lv - 1)));
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  INIT
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

