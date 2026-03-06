// ============================================================================
// HonkaRogue Dex Module (js/ui-dex.js)
// HonkerDex and PartsDex screens with filtering and progress tracking
// ============================================================================

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
        p.name, p.id, p.slot, p.rarity, p.archetype, p.family?.name, p.family?.theme,
        ...(p.tags || []), p.description || ''
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const cmpByPower = (a,b) => (b.powerScore||0) - (a.powerScore||0);
  const cmpByName = (a,b) => String(a.name || a.id || '').localeCompare(String(b.name || b.id || ''));
  if (sort === 'power_desc') parts.sort(cmpByPower);
  if (sort === 'power_asc') parts.sort((a,b) => -cmpByPower(a,b));
  if (sort === 'rarity_desc') parts.sort((a,b) => (rarityRank[b.rarity]-rarityRank[a.rarity]) || cmpByPower(a,b));
  if (sort === 'rarity_asc') parts.sort((a,b) => (rarityRank[a.rarity]-rarityRank[b.rarity]) || cmpByPower(a,b));
  if (sort === 'name_asc') parts.sort(cmpByName);
  if (sort === 'name_desc') parts.sort((a,b) => -cmpByName(a,b));

  grid.innerHTML = '';
  prog.textContent = `SEEN ${seenCount}/${totalParts}  \u2022  CAUGHT ${caughtCount}/${totalParts}`;

  parts.forEach(p => {
    const caught = isPartCaught(p.id);
    const seen = isPartSeen(p.id);
    const visible = seen || caught;
    const partName = p.name || p.id || 'Unknown Part';
    const rarityTone = visible ? (rarityColor[p.rarity] || '#aaa') : '#555';
    const c = document.createElement('div');
    c.className = `pdx-card ${caught ? 'pc-caught' : seen ? 'pc-seen' : 'pc-unseen'}`;
    const caughtBadge = caught ? '<div class="pdx-caught-badge" style="color:#ffd700;font-size:.7rem;font-weight:bold;position:absolute;top:.1rem;right:.1rem">o.</div>' : '';
    const artHtml = visible
      ? `<img src="${p.file}" alt="${partName}">`
      : `<span class="pdx-unk">?</span>`;
    const slotText = visible ? `${slotEmoji[p.slot] || '?'} ${String(p.slot || '').toUpperCase()}` : '?????';
    const rarityText = visible ? String(p.rarity || '').toUpperCase() : '?????';
    const familyText = visible ? (p.family?.name || 'Unknown') : '?????';
    c.innerHTML = `
      ${caughtBadge}
      <div class="pdx-art">${artHtml}</div>
      <div class="pdx-meta">
        <div class="pdx-name" style="color:${rarityTone}">${visible ? partName : '???'}</div>
        <div class="pdx-sub">
          <span class="pdx-pill">${slotText}</span>
          <span class="pdx-pill" style="color:${rarityTone}">${rarityText}</span>
          <span class="pdx-pill" style="color:${visible ? '#aaa' : '#555'}">${familyText}</span>
          ${caught ? '<span class="pdx-pill" style="color:#ffd700;border-color:#ffd700">CAUGHT</span>' : ''}
        </div>
        <div class="pdx-power">${visible ? `PWR ${Math.round(p.powerScore || 0)}` : 'PWR ???'}</div>
        <div class="pdx-stats">${visible ? `\u2764\uFE0F${p.stats.hp} \u2694\uFE0F${p.stats.atk} \uD83D\uDEE1\uFE0F${p.stats.def} \u26A1${p.stats.spd} \uD83C\uDF40${p.stats.luck}` : '?????'}</div>
      </div>
    `;
    c.title = visible ? (p.description || '').replace(/<[^>]*>/g, '') : 'Unknown part';
    grid.appendChild(c);
  });
}
