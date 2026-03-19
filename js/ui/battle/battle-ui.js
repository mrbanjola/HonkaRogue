// ============================================================================
// HonkaRogue Battle UI (js/ui/battle/battle-ui.js)
// Fighter UI setup, HP/PP display updates, status badges, and move panel
// ============================================================================

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
    badge.textContent = isBoss ? '\u2694 LEGENDARY ENCOUNTER \u2694' : '\u2726 EPIC ENCOUNTER \u2726';
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
    existingBadge.textContent = isBoss ? '\u2694 LEGENDARY ENCOUNTER \u2694' : '\u2726 EPIC ENCOUNTER \u2726';
    existingBadge.style.color = isBoss ? '#ff6a00' : '#ffd700';
    existingBadge.style.textShadow = isBoss ? '1px 1px 0 #8b0000' : '1px 1px 0 #000';
  }

  // Add NEW PARTS badge next to encounter badge (not appended to parent)
  const partsParent = nameEl.parentElement;
  const existingPartsBadge = partsParent.querySelector('.new-parts-badge');
  if (f._hasNewParts && !existingPartsBadge) {
    const partsBadge = document.createElement('div');
    partsBadge.className = 'new-parts-badge';
    partsBadge.textContent = '\u2728 NEW PARTS \u2728';
    // Insert right after the type badge to keep it in flow
    const typeBadge = document.getElementById(`tb-${side}`);
    if (typeBadge) typeBadge.after(partsBadge);
    else partsParent.appendChild(partsBadge);
  } else if (!f._hasNewParts && existingPartsBadge) {
    existingPartsBadge.remove();
  }
  const tb = document.getElementById(`tb-${side}`);
  tb.textContent = f.type2 ? `${f.type}/${f.type2}` : f.type; tb.className = `type-badge ${TCC[f.type]}`;
  tb.style.color = TC[f.type]; tb.style.borderColor = TC[f.type];
  updateHP(f, side);
  setupShieldBar(f, side);
  updatePPDots(f, side);
  let statStrip = nameEl.parentElement.querySelector('.f-stats');
  if (!statStrip) {
    statStrip = document.createElement('div');
    statStrip.className = 'f-stats';
    nameEl.after(statStrip);
  }
  statStrip.innerHTML = `<span title="Attack">\u2694${f.atk||80}</span> <span title="Defense">\uD83D\uDEE1${f.def||80}</span> <span title="Speed">\u26A1${f.spd||80}</span> <span title="Luck">\uD83C\uDF40${Math.min(95,(f.luck||50)+(f.luckBonus||0))}%</span>`;

  // Enemy inspection: click enemy sprite/name to see part ownership.
  if (side === 'right') {
    const open = () => showEnemyPartsOverlay(f);
    sprEl.style.cursor = 'pointer';
    sprEl.title = 'View enemy parts';
    sprEl.onclick = open;
    nameEl.style.cursor = 'pointer';
    nameEl.title = 'View enemy parts';
    nameEl.onclick = open;
  } else {
    sprEl.style.cursor = '';
    sprEl.title = '';
    sprEl.onclick = null;
    nameEl.style.cursor = '';
    nameEl.title = '';
    nameEl.onclick = null;
  }
}

function closeEnemyPartsOverlay() {
  const overlay = document.getElementById('enemy-parts-overlay');
  if (overlay) overlay.classList.remove('show');
}

function showEnemyPartsOverlay(enemy) {
  const overlay = document.getElementById('enemy-parts-overlay');
  const grid = document.getElementById('enemy-parts-grid');
  if (!overlay || !grid) return;
  grid.innerHTML = '';
  const parts = enemy?.assembledParts || null;
  if (!parts) {
    const empty = document.createElement('div');
    empty.className = 'ep-card';
    empty.innerHTML = `<div class="ep-meta"><div class="ep-name">No part data available for this enemy.</div></div>`;
    grid.appendChild(empty);
    overlay.classList.add('show');
    return;
  }
  const slots = ['head', 'torso', 'wings', 'legs'];
  slots.forEach(slot => {
    const part = parts[slot];
    if (!part) return;
    const caught = isPartCaught(part.id);
    const card = document.createElement('div');
    card.className = 'ep-card';
    const rarity = String(part.rarity || '').toUpperCase() || 'COMMON';
    const family = part.family?.name || 'Unknown';
    const partName = part.name || part.id || 'Unknown Part';
    card.innerHTML = `
      <div class="ep-art">${part.file ? `<img src="${part.file}" alt="${partName}">` : ''}</div>
      <div class="ep-meta">
        <div class="ep-slot">${slot}</div>
        <div class="ep-name">${partName}</div>
      <div class="ep-family">${family} \u2022 ${rarity}</div>
        <div class="ep-row">
          <span class="ep-badge ${caught ? 'caught' : 'new'}">${caught ? 'CAUGHT' : 'NEW'}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  overlay.classList.add('show');
}

function updateHP(f, side) {
  const pct=f.hpPct*100;
  const b=document.getElementById(`hpb-${side}`);
  b.style.width=pct+'%';
  b.className='hp-fill '+(pct>50?'hg':pct>20?'hm':'hl');
  document.getElementById(`hpv-${side}`).textContent=Math.max(0,f.currentHP);
}

// Boss shield bar
function setupShieldBar(f, side) {
  const wrap = document.getElementById(`shield-wrap-${side}`);
  if (!wrap) return;
  if (f.shieldMax > 0) {
    wrap.style.display = '';
    wrap.classList.remove('breaking');
    document.getElementById(`shv-${side}`).textContent = f.shieldHP;
    document.getElementById(`shb-${side}`).style.width = '100%';
  } else {
    wrap.style.display = 'none';
  }
}
function updateShieldBar(f, side) {
  const wrap = document.getElementById(`shield-wrap-${side}`);
  if (!wrap || f.shieldMax <= 0) return;
  const pct = Math.max(0, (f.shieldHP / f.shieldMax) * 100);
  document.getElementById(`shb-${side}`).style.width = pct + '%';
  document.getElementById(`shv-${side}`).textContent = Math.max(0, f.shieldHP);
}
function onShieldBreak(f, side) {
  const wrap = document.getElementById(`shield-wrap-${side}`);
  if (wrap) wrap.classList.add('breaking');
  // Trigger animated shield break (dissolves over ~0.7s, then auto-disposes)
  if (typeof breakBossShield === 'function') breakBossShield();
}

function updatePPDots() {
  // PP dots removed — info is already shown in the move panel
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

// Track whether moves are expanded
let _movesExpanded = false;

function renderMovePanel() {
  const body = document.getElementById('mp-body');
  const hdrName = document.getElementById('mp-hdr-name');
  if (BS.bDead) { body.innerHTML = ''; return; }
  const f = BS.bFighters[0], e = BS.bFighters[1];
  const locked = BS.bAutoOn || BS.bPhase !== 'p1';

  if (BS.bAutoOn) hdrName.textContent = 'AUTO';
  else if (BS.bPhase === 'p2') hdrName.textContent = 'CPU thinking...';
  else if (BS.bPhase === 'p1') hdrName.textContent = f.name;
  else hdrName.textContent = '...';

  // If moves expanded, show moves + back button
  if (_movesExpanded && !locked) {
    renderMovesView(body, f, e, locked);
    return;
  }

  // Default: show action menu
  _movesExpanded = false;
  renderActionMenu(body, f, locked);
}

function renderActionMenu(body, f, locked) {
  const stage = CAMPAIGN._currentStage;
  const enemy = BS.bFighters[1];
  const hpThresh = stage?.isBoss ? 0.20 : 0.35;
  const canCatch = !BS.bDead && (BS.bPhase === 'p1') && !BS.bAutoOn
    && enemy && enemy.hpPct < hpThresh;

  const wrap = document.createElement('div');
  wrap.className = 'action-menu';

  // Attack button
  const atkBtn = document.createElement('button');
  atkBtn.className = 'action-btn action-attack';
  atkBtn.disabled = locked;
  atkBtn.innerHTML = '\u2694 ATTACK';
  atkBtn.onclick = () => { if (!locked) { _movesExpanded = true; renderMovePanel(); } };
  wrap.appendChild(atkBtn);

  // Roster button
  const rosterBtn = document.createElement('button');
  rosterBtn.className = 'action-btn action-roster';
  rosterBtn.disabled = locked;
  rosterBtn.innerHTML = '\uD83D\uDC65 ROSTER';
  rosterBtn.onclick = () => { if (!locked) openBattleSwap(); };
  wrap.appendChild(rosterBtn);

  // Catch button
  const catchBtn = document.createElement('button');
  catchBtn.className = 'action-btn action-catch';
  catchBtn.id = 'btn-catch';
  catchBtn.disabled = !canCatch;
  catchBtn.innerHTML = stage?.isBoss ? '\uD83E\uDDA4 CATCH BOSS' : '\uD83E\uDDA4 CATCH';
  if (stage?.isBoss) { catchBtn.style.color = '#ffd700'; catchBtn.style.borderColor = '#ffd700'; }
  catchBtn.onclick = () => tryCatch();
  wrap.appendChild(catchBtn);

  // Auto button
  const autoBtn = document.createElement('button');
  autoBtn.className = 'action-btn action-auto';
  autoBtn.id = 'btn-auto';
  if (BS.bAutoOn) {
    autoBtn.textContent = '\u23F8 PAUSE';
    autoBtn.classList.add('active');
    autoBtn.style.animation = 'pulse 1s ease-in-out infinite';
  } else {
    autoBtn.textContent = '\u25B6\u25B6 AUTO';
    autoBtn.style.animation = '';
  }
  autoBtn.onclick = () => toggleAuto();
  wrap.appendChild(autoBtn);

  // Retreat button
  const retreatBtn = document.createElement('button');
  retreatBtn.className = 'action-btn action-retreat';
  retreatBtn.innerHTML = '\u21A9 RETREAT';
  retreatBtn.onclick = () => goToCampaign();
  wrap.appendChild(retreatBtn);

  body.innerHTML = '';
  body.appendChild(wrap);
}

function renderMovesView(body, f, e, locked) {
  const wrap = document.createElement('div');

  // Back button row
  const backRow = document.createElement('div');
  backRow.className = 'moves-back-row';
  const backBtn = document.createElement('button');
  backBtn.className = 'action-btn action-back';
  backBtn.innerHTML = '\u25C0 BACK';
  backBtn.onclick = () => { _movesExpanded = false; renderMovePanel(); };
  backRow.appendChild(backBtn);
  wrap.appendChild(backRow);

  // Move grid
  const grid = document.createElement('div');
  grid.className = 'move-grid';
  f.moves.forEach((m, i) => {
    const eff = getEff(m.type, e.type, e.type2);
    let effHtml = '';
    if (eff >= 2) effHtml = `<span class="mb-eff eff-s">\u26A1 SUPER</span>`;
    else if (eff <= .5) effHtml = `<span class="mb-eff eff-w">\u26D4 WEAK</span>`;
    const btn = document.createElement('button');
    btn.className = `move-btn${m.pp <= 0 ? ' used-up' : ''}`;
    btn.style.setProperty('--mc', TC[m.type]);
    btn.disabled = locked || m.pp <= 0;
    btn.innerHTML = `<span class="mb-name">${m.emoji} ${m.name}</span>
      <div class="mb-meta">
        <span class="mb-type ${TCC[m.type]}">${m.type}</span>
        ${m.effect && m.power === 0
          ? `<span class="mb-stat" style="color:${STATUS_META[m.effect]?.color || '#aaa'}">\u2726 ${(STATUS_META[m.effect]?.label || 'STATUS').toUpperCase()} ${m.effectTarget === 'self' ? 'SELF' : 'FOE'}</span>`
          : `<span class="mb-stat">PWR <b>${m.power + (m.power > 0 ? f.atkFlat || 0 : 0)}</b></span><span class="mb-stat">ACC <b>${m.acc}%</b></span>`
        }
        <span class="mb-pp" style="margin-left:auto">PP <b>${m.pp}/${m.maxPP}</b></span>${effHtml}
      </div>
      <div class="mb-desc">${m.desc}</div>`;
    btn.onclick = () => { if (!locked) { _movesExpanded = false; p1UsesMove(i); } };
    grid.appendChild(btn);
  });
  wrap.appendChild(grid);

  body.innerHTML = '';
  body.appendChild(wrap);
}
