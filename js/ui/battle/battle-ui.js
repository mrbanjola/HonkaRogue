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

  // Add NEW PARTS badge if enemy has uncaught parts
  const partsParent = nameEl.parentElement;
  const existingPartsBadge = partsParent.querySelector('.new-parts-badge');
  if (f._hasNewParts && !existingPartsBadge) {
    const partsBadge = document.createElement('div');
    partsBadge.className = 'new-parts-badge';
    partsBadge.textContent = '\u2728 NEW PARTS \u2728';
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

function renderMovePanel() {
  const body=document.getElementById('mp-body');
  const hdrName=document.getElementById('mp-hdr-name');
  if(BS.bDead){ body.innerHTML=''; return; }
  const f=BS.bFighters[0], e=BS.bFighters[1];
  const locked = BS.bAutoOn || BS.bPhase!=='p1';
  if (BS.bAutoOn) hdrName.textContent='AUTO';
  else if (BS.bPhase==='p2') hdrName.textContent='CPU thinking...';
  else if (BS.bPhase==='p1') hdrName.textContent=f.name;
  else hdrName.textContent='...';

  const grid=document.createElement('div'); grid.className='move-grid';
  f.moves.forEach((m,i)=>{
    const eff=getEff(m.type,e.type,e.type2);
    let effHtml='';
    if(eff>=2) effHtml=`<span class="mb-eff eff-s">\u26A1 SUPER</span>`;
    else if(eff<=.5) effHtml=`<span class="mb-eff eff-w">\u26D4 WEAK</span>`;
    const btn=document.createElement('button');
    btn.className=`move-btn${m.pp<=0?' used-up':''}`;
    btn.style.setProperty('--mc',TC[m.type]);
    btn.disabled=locked || m.pp<=0;
    btn.innerHTML=`<span class="mb-name">${m.emoji} ${m.name}</span>
      <div class="mb-meta">
        <span class="mb-type ${TCC[m.type]}">${m.type}</span>
        ${m.effect && m.power===0
          ? `<span class="mb-stat" style="color:${STATUS_META[m.effect]?.color||'#aaa'}">\u2726 ${(STATUS_META[m.effect]?.label||'STATUS').toUpperCase()} ${m.effectTarget==='self'?'SELF':'FOE'}</span>`
          : `<span class="mb-stat">PWR <b>${m.power+(m.power>0?f.atkFlat||0:0)}</b></span><span class="mb-stat">ACC <b>${m.acc}%</b></span>`
        }
        <span class="mb-pp" style="margin-left:auto">PP <b>${m.pp}/${m.maxPP}</b></span>${effHtml}
      </div>
      <div class="mb-desc">${m.desc}</div>`;
    btn.onclick=()=>{ if (!locked) p1UsesMove(i); };
    grid.appendChild(btn);
  });
  body.innerHTML=''; body.appendChild(grid);
}
