// ============================================================================
// HonkaRogue Dex Module (js/ui/dex.js)
// HonkerDex and PartsDex screens with filtering, detail view, mastery display
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
//  HONKDEX
// ─────────────────────────────────────────────────────────────────────────────
let _dexFromScreen = 'screen-title';
let _dexCtrlInit = false;

function showDex(fromScreen) {
  _dexFromScreen = fromScreen || document.querySelector('.screen.active')?.id || 'screen-title';
  if (!_dexCtrlInit) {
    _dexCtrlInit = true;
    ['dex-search', 'dex-type-filter', 'dex-status-filter'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'dex-search' ? 'input' : 'change', buildDexGrid);
    });
  }
  buildDexGrid();
  closeDexDetail();
  document.getElementById('dex-back-btn').onclick = () => showScreen(_dexFromScreen);
  showScreen('screen-dex');
}

function buildDexGrid() {
  const grid = document.getElementById('dex-grid');
  const prog = document.getElementById('dex-progress');
  grid.innerHTML = '';

  const q = (document.getElementById('dex-search')?.value || '').trim().toLowerCase();
  const typeFilter = document.getElementById('dex-type-filter')?.value || 'all';
  const statusFilter = document.getElementById('dex-status-filter')?.value || 'all';

  const seenCount   = CAMPAIGN.dexSeen.length;
  const caughtCount = CAMPAIGN.dexCaught.length;
  prog.textContent  = `SEEN ${seenCount}/${HONKER_DEX.length}  \u2022  CAUGHT ${caughtCount}/${HONKER_DEX.length}`;

  // Include ROSTER starters in the dex view
  const rosterEntries = (ROSTER || []).map(r => ({
    _isRoster: true,
    dexNum: 0,
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    type: r.type,
    atk: r.atk,
    def: r.def,
    spd: r.spd,
    hp: r.hp,
    luck: r.luck,
    lore: r.lore,
    passiveId: r.passiveId,
    passive: r.passive || (typeof getPassiveMetaById === 'function' ? getPassiveMetaById(r.passiveId) : null),
    moveIds: r.moveIds || [],
  }));

  const allEntries = [...rosterEntries, ...HONKER_DEX];

  allEntries.forEach(dex => {
    const isRoster = !!dex._isRoster;
    const isCaught = isRoster || CAMPAIGN.dexCaught.includes(dex.id);
    const isSeen   = isRoster || CAMPAIGN.dexSeen.includes(dex.id);
    const bp = !isRoster ? buildDexPartBlueprint(dex) : null;
    const shownType = bp?.derived?.type || dex.type;

    // Filters
    if (typeFilter !== 'all' && shownType !== typeFilter) return;
    if (statusFilter === 'caught' && !isCaught) return;
    if (statusFilter === 'seen' && !isSeen) return;
    if (statusFilter === 'unseen' && isSeen) return;
    if (q && isSeen && !dex.name.toLowerCase().includes(q) && !shownType.toLowerCase().includes(q)) return;
    if (q && !isSeen) return;

    const card = document.createElement('div');
    card.className = 'dex-card ' + (isCaught ? 'dc-caught' : isSeen ? 'dc-seen' : 'dc-unseen');

    const typeColor = TC[shownType] || '#aaa';

    // Mastery info for all named honkers (roster + dex entries)
    let masteryHtml = '';
    if (typeof getMasteryTierInfo === 'function' && typeof isNamedHonker === 'function' && isNamedHonker(dex.id)) {
      const totalXp = typeof getMasteryTotalXp === 'function' ? getMasteryTotalXp(dex.id) : 0;
      const info = getMasteryTierInfo(totalXp);
      const stars = renderMasteryStars(info.level, 3);
      masteryHtml = `<div class="dex-mastery-row">${stars}</div>`;
    }

    // Stat bars (compact)
    let statsHtml = '';
    if (isSeen) {
      const atkVal = dex.atk || bp?.derived?.stats?.atk || 80;
      const defVal = dex.def || bp?.derived?.stats?.def || 80;
      const spdVal = dex.spd || bp?.derived?.stats?.spd || 80;
      statsHtml = `<div class="dex-stat-bars">
        <div class="dex-sbar"><span class="dex-slbl">ATK</span><div class="dex-strack"><div class="dex-sfill" style="width:${Math.round(atkVal/130*100)}%;background:#ff4e00"></div></div><span class="dex-sval">${atkVal}</span></div>
        <div class="dex-sbar"><span class="dex-slbl">DEF</span><div class="dex-strack"><div class="dex-sfill" style="width:${Math.round(defVal/130*100)}%;background:#00c8ff"></div></div><span class="dex-sval">${defVal}</span></div>
        <div class="dex-sbar"><span class="dex-slbl">SPD</span><div class="dex-strack"><div class="dex-sfill" style="width:${Math.round(spdVal/130*100)}%;background:#ffe600"></div></div><span class="dex-sval">${spdVal}</span></div>
      </div>`;
    }

    const passiveTxt = (dex.passive || dex.passiveId) && isSeen
      ? `<div class="dex-passive-hint">${dex.passive?.emoji || ''} ${dex.passive?.name || dex.passiveId}</div>` : '';

    const numLabel = isRoster ? 'STARTER' : `#${String(dex.dexNum).padStart(3,'0')}`;
    const bossTag = dex.isBoss ? '<span class="dex-boss-tag">BOSS</span>' : '';
    const caughtBadge = isCaught ? '<div class="dex-caught-badge">CAUGHT</div>' : '';

    card.innerHTML = `
      ${caughtBadge}
      <div class="dex-num">${numLabel} ${bossTag}</div>
      <div class="dex-emoji">${isSeen ? dex.emoji : '?'}</div>
      <div class="dex-name">${isSeen ? dex.name : '???'}</div>
      <div class="dex-type-tag" style="color:${isSeen ? typeColor : '#555'};border-color:${isSeen ? typeColor : '#555'}">${isSeen ? shownType : '?????'}</div>
      ${masteryHtml}
      ${passiveTxt}
      ${statsHtml}
    `;

    if (isSeen) {
      if (bp?.assembledParts) {
        const em = card.querySelector('.dex-emoji');
        if (em) renderCompositePreview(bp.assembledParts, em, 'dex-composite');
      }
      card.style.cursor = 'pointer';
      card.onclick = () => openDexDetail(dex, isRoster, bp);
    }
    grid.appendChild(card);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  MASTERY STAR HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function renderMasteryStars(level, maxTiers) {
  let html = '';
  for (let i = 1; i <= maxTiers; i++) {
    html += `<span class="dex-star ${i <= level ? 'filled' : ''}">\u2605</span>`;
  }
  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function openDexDetail(dex, isRoster, bp) {
  const panel = document.getElementById('dex-detail-panel');
  const overlay = document.getElementById('dex-detail-overlay');
  if (!panel || !overlay) return;

  const isCaught = isRoster || CAMPAIGN.dexCaught.includes(dex.id);
  const shownType = bp?.derived?.type || dex.type;
  const type2 = bp?.derived?.type2 || null;
  const typeColor = TC[shownType] || '#aaa';
  const typeLabel = type2 ? `${shownType} / ${type2}` : shownType;

  // Stats
  const atkVal = dex.atk || bp?.derived?.stats?.atk || 80;
  const defVal = dex.def || bp?.derived?.stats?.def || 80;
  const spdVal = dex.spd || bp?.derived?.stats?.spd || 80;
  const hpVal  = dex.hp  || bp?.derived?.stats?.hp  || 150;
  const luckVal = dex.luck || bp?.derived?.stats?.luck || 50;

  // Sprite
  let spriteHtml = `<div class="dxd-sprite">${dex.emoji}</div>`;
  if (bp?.assembledParts) {
    spriteHtml = '<div class="dxd-sprite dex-composite" id="dxd-sprite-container"></div>';
  }

  // Passive
  const passive = dex.passive || (dex.passiveId && typeof getPassiveMetaById === 'function' ? getPassiveMetaById(dex.passiveId) : null);
  const passiveHtml = passive
    ? `<div class="dxd-passive"><span class="dxd-passive-icon">${passive.emoji || ''}</span> <b>${passive.name}</b><div class="dxd-passive-desc">${passive.desc || ''}</div></div>`
    : '<div class="dxd-passive" style="color:var(--dim)">No passive</div>';

  // Moves
  const moveIds = dex.moveIds || bp?.derived?.moves?.map(m => m.id) || [];
  const allMoveIds = [...new Set([...moveIds, ...(bp?.derived?.moveCandidates?.map(m => m.id) || [])])];
  let movesHtml = '';
  if (isCaught && allMoveIds.length > 0) {
    movesHtml = '<div class="dxd-section-title">MOVESET</div><div class="dxd-moves">';
    const starterSet = new Set(moveIds);
    allMoveIds.forEach(mid => {
      const m = typeof MOVE_DB !== 'undefined' ? MOVE_DB[mid] : null;
      if (!m) return;
      const isStarter = starterSet.has(mid);
      const pwr = m.statusOnly ? '-' : (m.basePower || 0);
      movesHtml += `<div class="dxd-move ${isStarter ? '' : 'dxd-move-extra'}">
        <span class="dxd-move-type" style="color:${TC[m.type] || '#aaa'}">${m.type}</span>
        <span class="dxd-move-name">${m.emoji || ''} ${m.name}</span>
        <span class="dxd-move-stat">P${pwr}</span>
        <span class="dxd-move-stat">A${m.acc}%</span>
      </div>`;
    });
    movesHtml += '</div>';
  } else if (!isCaught) {
    movesHtml = '<div class="dxd-section-title">MOVESET</div><div class="dxd-moves-locked">Catch to reveal moves</div>';
  }

  // Parts (only if caught and has assembled parts)
  let partsHtml = '';
  if (isCaught && bp?.assembledParts) {
    partsHtml = '<div class="dxd-section-title">PARTS</div><div class="dxd-parts">';
    ['head', 'torso', 'wings', 'legs'].forEach(slot => {
      const part = bp.assembledParts[slot];
      if (!part) return;
      const rColor = { common: '#aaaacc', rare: '#00c8ff', legendary: '#ffd700' }[part.rarity] || '#aaa';
      partsHtml += `<div class="dxd-part">
        <img src="${part.file}" alt="${slot}" class="dxd-part-img">
        <div class="dxd-part-info">
          <div class="dxd-part-name" style="color:${rColor}">${part.name || part.id}</div>
          <div class="dxd-part-meta">${slot.toUpperCase()} \u00B7 ${(part.rarity || '').toUpperCase()} \u00B7 ${part.family?.name || '?'}</div>
        </div>
      </div>`;
    });
    partsHtml += '</div>';
  }

  // Mastery section (all named honkers)
  let masteryHtml = '';
  const isNamed = typeof isNamedHonker === 'function' && isNamedHonker(dex.id);
  if (isNamed && typeof getMasteryTierInfo === 'function') {
    const totalXp = typeof getMasteryTotalXp === 'function' ? getMasteryTotalXp(dex.id) : 0;
    const info = getMasteryTierInfo(totalXp);
    const tiers = typeof getMasteryTiers === 'function' ? getMasteryTiers() : [];
    const maxTiers = tiers.length || 3;
    const stars = renderMasteryStars(info.level, maxTiers);

    // XP progress bar
    let xpBarHtml = '';
    if (!info.maxed && info.nextTier) {
      const prevThreshold = info.currentTier ? info.currentTier.xpRequired : 0;
      const xpInTier = totalXp - prevThreshold;
      const xpNeeded = info.nextTier.xpRequired - prevThreshold;
      const pct = Math.min(100, Math.round(xpInTier / xpNeeded * 100));
      xpBarHtml = `<div class="dxd-mastery-xp">
        <div class="dxd-mastery-bar"><div class="dxd-mastery-fill" style="width:${pct}%"></div></div>
        <span class="dxd-mastery-label">${totalXp} / ${info.nextTier.xpRequired} XP</span>
      </div>`;
    } else if (info.maxed) {
      xpBarHtml = `<div class="dxd-mastery-xp"><span class="dxd-mastery-label" style="color:var(--gold)">MAX MASTERY (${totalXp} XP)</span></div>`;
    }

    // Tier rewards breakdown
    let rewardsHtml = '<div class="dxd-mastery-rewards">';
    tiers.forEach(tier => {
      const unlocked = info.level >= tier.level;
      const bonusPct = Math.round(tier.statBonus * 100);
      const config = typeof getHonkerMasteryConfig === 'function' ? getHonkerMasteryConfig(dex.id) : null;
      const tierMoves = config?.moveUnlocks?.[String(tier.level)] || [];
      const moveNames = tierMoves.map(mid => {
        const m = typeof MOVE_DB !== 'undefined' ? MOVE_DB[mid] : null;
        return m ? m.name : mid;
      });
      const isPassiveTier = typeof getPassiveUnlockTier === 'function' && tier.level >= getPassiveUnlockTier();

      let rewardText = `+${bonusPct}% stats`;
      if (moveNames.length) rewardText += ` \u00B7 ${moveNames.join(', ')}`;
      if (isPassiveTier && passive) rewardText += ` \u00B7 Unlocks ${passive.name} for Assembly`;

      rewardsHtml += `<div class="dxd-reward ${unlocked ? 'unlocked' : ''}">
        <span class="dex-star ${unlocked ? 'filled' : ''}">\u2605</span>
        <span class="dxd-reward-tier">${tier.label}</span>
        <span class="dxd-reward-text">${rewardText}</span>
      </div>`;
    });
    rewardsHtml += '</div>';

    masteryHtml = `<div class="dxd-section-title">MASTERY</div>
      <div class="dxd-mastery">
        <div class="dxd-mastery-stars">${stars}</div>
        ${xpBarHtml}
        ${rewardsHtml}
      </div>`;
  }

  // Caught count from party/fallen
  let caughtCountHtml = '';
  if (isCaught && !isRoster) {
    const inParty = (CAMPAIGN.party || []).filter(h => h.isCaught && h.name === dex.name).length;
    const inFallen = (CAMPAIGN.fallen || []).filter(h => h.isCaught && h.name === dex.name).length;
    if (inParty > 0 || inFallen > 0) {
      caughtCountHtml = `<div class="dxd-caught-count">${inParty} in party${inFallen > 0 ? ` \u00B7 ${inFallen} fallen` : ''}</div>`;
    }
  }

  const numLabel = isRoster ? 'STARTER' : `#${String(dex.dexNum).padStart(3, '0')}`;
  const bossTag = dex.isBoss ? '<span class="dex-boss-tag">BOSS</span>' : '';

  panel.innerHTML = `
    <button class="dxd-close" onclick="closeDexDetail()">\u2715</button>
    <div class="dxd-top">
      ${spriteHtml}
      <div class="dxd-identity">
        <div class="dxd-num">${numLabel} ${bossTag}</div>
        <div class="dxd-name">${dex.name}</div>
        <div class="dxd-type" style="color:${typeColor};border-color:${typeColor}">${typeLabel}</div>
        ${caughtCountHtml}
      </div>
    </div>
    <div class="dxd-lore">"${dex.lore}"</div>
    ${passiveHtml}
    <div class="dxd-section-title">STATS</div>
    <div class="dxd-stats">
      ${buildDetailStatBar('HP', hpVal, 220, '#ff4466')}
      ${buildDetailStatBar('ATK', atkVal, 130, '#ff4e00')}
      ${buildDetailStatBar('DEF', defVal, 130, '#00c8ff')}
      ${buildDetailStatBar('SPD', spdVal, 130, '#ffe600')}
      ${buildDetailStatBar('LUCK', luckVal, 100, '#44ff88')}
    </div>
    ${masteryHtml}
    ${movesHtml}
    ${partsHtml}
  `;

  // Render composite sprite inside detail
  if (bp?.assembledParts) {
    const container = document.getElementById('dxd-sprite-container');
    if (container) renderCompositePreview(bp.assembledParts, container, 'dex-composite');
  }

  overlay.classList.add('show');
}

function buildDetailStatBar(label, value, maxVal, color) {
  const pct = Math.min(100, Math.round(value / maxVal * 100));
  return `<div class="dxd-stat-row">
    <span class="dxd-stat-lbl">${label}</span>
    <div class="dxd-stat-track"><div class="dxd-stat-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="dxd-stat-val">${value}</span>
  </div>`;
}

function closeDexDetail() {
  const overlay = document.getElementById('dex-detail-overlay');
  if (overlay) overlay.classList.remove('show');
}

// ─────────────────────────────────────────────────────────────────────────────
//  PARTSDEX (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
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
