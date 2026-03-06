// ============================================================================
// HonkaRogue Battle Events (js/ui/battle/battle-events.js)
// Wild event system for in-battle random events
// ============================================================================

function maybeFireEvent() {
  if(BS.bRound<=2) return;
  if(BS.bRound-BS.lastEventRound<3) return;
  if(BS.rng()>0.28) return;
  const ev=WILD_EVENTS[Math.floor(BS.rng()*WILD_EVENTS.length)];
  BS.lastEventRound=BS.bRound;
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
  ev.apply(BS.eventState, BS.bFighters);
  log('ev', ev.log);
  // Handle immediate HP changes
  if(ev.id==='rain'||ev.id==='crowd'||ev.id==='swap') {
    BS.bFighters.forEach(f=>{ updateHP(f,f.side); });
  }
  if(ev.id==='goose') {
    const target=BS.bFighters[Math.floor(BS.rng()*2)];
    const dmg=25+Math.floor(BS.rng()*25);
    target.currentHP=Math.max(1,target.currentHP-dmg);
    updateHP(target,target.side);
    log('ev',`\uD83E\uDEBF The wild goose honks ${target.name} for ${dmg} damage!`);
    spawnPtcl(target.side,'#ff9800','\uD83E\uDEBF');
  }
  if(ev.id==='doubles'&&BS.eventState.doubledMove) {
    log('ev',`\uD83C\uDFB4 ${BS.eventState.doubledMove.fighter}'s "${BS.eventState.doubledMove.name}" power DOUBLED!`);
  }
  if(ev.id==='rage'&&BS.eventState.rageTarget) {
    addStatusBadge(BS.eventState.rageTarget,'\uD83D\uDE24 RAGE','#ff4444');
    log('ev',`\uD83D\uDE24 ${BS.bFighters.find(f=>f.side===BS.eventState.rageTarget)?.name} enters RAGE MODE (+50% ATK)!`);
  }
  if(ev.id==='wisdom') {
    BS.bFighters.forEach(f=>updatePPDots(f,f.side));
    log('ev','\uD83D\uDCDC All PP restored!');
  }
  if(ev.id==='gravity') addStatusBadge('left','\uD83C\uDF0C CERTAIN','#00c8ff'), addStatusBadge('right','\uD83C\uDF0C CERTAIN','#00c8ff');
  if(ev.id==='mirror') addStatusBadge('left','\uD83E\uDE9E MIRROR','#e040fb'), addStatusBadge('right','\uD83E\uDE9E MIRROR','#e040fb');
  if(ev.id==='amnesia') addStatusBadge('left','\u2754 NO TYPE','#aaa'), addStatusBadge('right','\u2754 NO TYPE','#aaa');
}

function tickEventState() {
  if(BS.eventState.duration>0){ BS.eventState.duration--; if(BS.eventState.duration<=0) delete BS.eventState.accuracyMod; }
  if(BS.eventState.typeIgnoredRounds>0){ BS.eventState.typeIgnoredRounds--; if(BS.eventState.typeIgnoredRounds<=0){ BS.typeOverride=false; BS.eventState.typeIgnored=false; BS.bFighters.forEach(f=>refreshStatusBadges(f)); log('n','\u2754 Type advantages return to normal.'); }}
  if(BS.eventState.guaranteeDur>0){ BS.eventState.guaranteeDur--; if(BS.eventState.guaranteeDur<=0){ delete BS.eventState.guaranteedHit; BS.bFighters.forEach(f=>refreshStatusBadges(f)); }}
  if(BS.eventState.rageDur>0){ BS.eventState.rageDur--; if(BS.eventState.rageDur<=0){ delete BS.eventState.rageTarget; delete BS.eventState.rageMod; BS.bFighters.forEach(f=>refreshStatusBadges(f)); log('n','\uD83D\uDE24 Rage fades.'); }}
  // Tick each fighter's status effects
  BS.bFighters.forEach(f => {
    const died = tickStatusEffects(f);
    if (died && !BS.bDead) endBattle(BS.bFighters.find(x=>x.side!==f.side), f);
  });
}
