// ============================================================================
// HonkaRogue Character Select Module (js/ui-charselect.js)
// Starter selection, honker assembly, and run initialization
// ============================================================================

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
    const pool = PARTS_DATA.parts.filter(p => p.slot === slot && isPartUnlocked(p.id) && !isPartUnique(p));
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
          <span class="part-move-meta">${m.type} \u00B7 P${pwr}</span>
        </div>`;
      }).join('');
      item.innerHTML = `
        <div class="part-img">
          <img src="${part.file}" alt="${part.name || part.id}">
        </div>
        <div class="part-info">
          <div class="part-family-row">
            <div class="part-family">${part.name || part.id}</div>
            <span class="part-tag" style="color:${getRarityColor(part.rarity)};border-color:${getRarityColor(part.rarity)}">${part.rarity.toUpperCase()}</span>
          </div>
          <div style="font-size:.52rem;color:${archColors[part.archetype]||'#aaa'};margin:.08rem 0;">${part.family.name} \u00B7 ${part.archetype} \u00B7 ${part.slot}</div>
          <div class="part-stats">
            <span class="part-stat">\u2764\uFE0F${part.stats.hp}</span>
            <span class="part-stat">\u2694\uFE0F${part.stats.atk}</span>
            <span class="part-stat">\uD83D\uDEE1\uFE0F${part.stats.def}</span>
            <span class="part-stat">\u26A1${part.stats.spd}</span>
            <span class="part-stat">\uD83C\uDF40${part.stats.luck}</span>
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
      derivedEl.innerHTML = `<span style="color:${typeColor};font-weight:700">${typeLabel} Type</span> &nbsp;\u00B7&nbsp; <span style="color:var(--gold)">${derived.name}</span>${derived.passive ? ' &nbsp;\u00B7&nbsp; <span style="color:var(--gold);font-size:.55rem">' + derived.passive.emoji + ' ' + derived.passive.name + '</span>' : ''}`;
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
