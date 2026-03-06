// ============================================================================
// HonkaRogue Campaign Map Module (js/ui-campaign.js)
// Campaign map, sidebar, stage path, and party management
// ============================================================================

function showCampaignMap() {
  refreshCampaignSidebar();
  buildStageMap();
  const deepest = CAMPAIGN.deepest || CAMPAIGN.stageIdx;
  document.getElementById('camp-map-sub').textContent =
    `Stage ${CAMPAIGN.stageIdx + 1} of Infinite \u2022 Deepest: ${deepest}`;
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
    h.textContent='\u2764\uFE0F'; rc.appendChild(h);
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
      `<span class="diff-star" style="color:${j<stage.difficulty?'var(--gold)':'var(--border)'}">\u2605</span>`
    ).join('');

    // Power balance hint for current stage
    let balanceHint = '';
    if (current && CAMPAIGN.playerBase) {
      const pp = playerPower(CAMPAIGN.playerBase);
      const ep = stageThreat(stageN);
      const ratio = pp / ep;
      if (ratio >= 1.1)       balanceHint = `<span style="color:#76ff03;font-size:.65rem">\u25B2 Favoured</span>`;
      else if (ratio >= 0.85) balanceHint = `<span style="color:var(--gold);font-size:.65rem">\u2696 Balanced</span>`;
      else                     balanceHint = `<span style="color:#ff5252;font-size:.65rem">\u25BC Dangerous</span>`;
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
            ${locked ? 'Unknown Type' : (stage.enemy.type2 ? `${stage.enemy.type}/${stage.enemy.type2}` : stage.enemy.type) + ' Type \u2022 HP ' + stage.enemy.hp}
          </div>
        </div>
      </div>
      ${!locked ? `<div class="sn-desc">${stage.desc}</div>` : ''}
      <div class="sn-rewards" style="margin-top:.4rem">
        <span class="reward-tag" style="color:#00ff88;border-color:#00ff88">+${stage.xpReward} XP</span>
        <span class="reward-tag" style="color:var(--gold);border-color:var(--gold)">LOOT CHOICE</span>
        ${stage.isBoss ? '<span class="reward-tag" style="color:#ff6a00;border-color:#ff6a00">\u2694 BOSS</span>' : ''}
        ${balanceHint}
      </div>
      ${current ? `<button class="btn btn-gold btn-fight" style="margin-top:.7rem;width:100%" onclick="startStageBattle(${i})">\u2694 FIGHT \u2022 STAGE ${stageN}</button>` : ''}
    `;
    path.appendChild(node);
  }

  // Bottom "continues forever" indicator
  const inf = document.createElement('div');
  inf.style.cssText = 'text-align:center;padding:1rem;font-family:"Press Start 2P",monospace;font-size:.35rem;color:var(--dim);letter-spacing:.15em;';
  inf.innerHTML = '\u221E THE HONK REALM HAS NO END \u221E';
  path.appendChild(inf);
}

function buildRetryIcons() {
  const r=document.getElementById('bt-retries');
  r.innerHTML='';
  for(let i=0;i<CAMPAIGN.maxRetries;i++){
    const ic=document.createElement('span');
    ic.className='retry-icon'+(i>=CAMPAIGN.retries?' lost':'');
    ic.textContent='\u2764\uFE0F'; r.appendChild(ic);
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
