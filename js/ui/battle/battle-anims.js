// ============================================================================
// HonkaRogue Battle Animations (js/ui/battle/battle-anims.js)
// Visual effects, particle spawning, and battle log
// ============================================================================

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

// Battle-specific log function (shadows the utils.js log)
function log(t,html){
  const el=document.createElement('div');
  el.className=`le t-${t}`; el.innerHTML=html;
  const c=document.getElementById('log');
  if (!c) { console.warn('log element not found'); return; }
  if (!c.appendChild) { console.warn('log element has no appendChild'); return; }
  c.appendChild(el);
  setTimeout(()=>{ if(c && c.scrollTop !== undefined) c.scrollTop=c.scrollHeight; },50);
}
