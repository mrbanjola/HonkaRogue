// ============================================================================
// HonkaRogue Battle Animations (js/ui/battle/battle-anims.js)
// Visual effects, particle spawning, and battle log
// ============================================================================

// --- Battle SFX (Web Audio synth) ---
const BattleSFX = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function tone(freq, dur, type, vol, delay) {
    try {
      const c = getCtx();
      const t = c.currentTime + (delay || 0);
      const g = c.createGain();
      g.connect(c.destination);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.connect(g);
      o.start(t);
      o.stop(t + dur);
    } catch (_) {}
  }
  function noise(dur, vol) {
    try {
      const c = getCtx();
      const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.connect(g);
      g.connect(c.destination);
      src.start();
      src.stop(c.currentTime + dur);
    } catch (_) {}
  }
  // File-based SFX cache
  const sfxCache = {};
  function playSfxFile(src, vol) {
    try {
      if (!sfxCache[src]) sfxCache[src] = new Audio(src);
      const a = sfxCache[src];
      a.volume = vol;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (_) {}
  }
  return {
    // Swoosh on attack lunge
    swing()   { noise(0.12, 0.08); tone(200, 0.08, 'sawtooth', 0.04, 0.02); },
    // Impact by animation type
    hit(animType) {
      const t = (animType || 'hit').toLowerCase();
      if (t === 'beam')          { playSfxFile('Sounds/Attacks/beam.mp3', 0.35); }
      else if (t === 'drain')    { playSfxFile('Sounds/Attacks/drain.mp3', 0.35); }
      else if (t === 'nova' || t === 'reverse_nova') { noise(0.18, 0.12); tone(100, 0.25, 'sine', 0.08); tone(160, 0.2, 'square', 0.05, 0.06); }
      else if (t === 'projectile') { tone(350, 0.08, 'sawtooth', 0.06); noise(0.1, 0.1); tone(120, 0.15, 'square', 0.06, 0.05); }
      else /* 'hit' default */   { noise(0.1, 0.12); tone(120, 0.15, 'square', 0.06); tone(80, 0.2, 'sine', 0.08); }
    },
    // Critical/super effective (louder variant)
    critHit(animType) {
      const t = (animType || 'hit').toLowerCase();
      if (t === 'beam')          { playSfxFile('Sounds/Attacks/beam.mp3', 0.5); }
      else if (t === 'drain')    { playSfxFile('Sounds/Attacks/drain.mp3', 0.5); }
      else if (t === 'nova' || t === 'reverse_nova') { noise(0.22, 0.15); tone(80, 0.3, 'sine', 0.1); tone(140, 0.25, 'square', 0.07, 0.06); }
      else if (t === 'projectile') { tone(400, 0.1, 'sawtooth', 0.08); noise(0.14, 0.13); tone(100, 0.2, 'square', 0.08, 0.05); }
      else { noise(0.14, 0.15); tone(150, 0.12, 'square', 0.08); tone(90, 0.25, 'sine', 0.1); }
      noise(0.14, 0.1); tone(90, 0.25, 'sine', 0.06, 0.1);
    },
    // Miss / whiff
    miss()    { tone(400, 0.1, 'sine', 0.04); tone(250, 0.15, 'sine', 0.03, 0.05); },
    // Status effect applied
    status()  { tone(330, 0.15, 'triangle', 0.06); tone(440, 0.12, 'triangle', 0.05, 0.08); },
    // Buff applied
    buff()    { tone(523, 0.1, 'triangle', 0.06); tone(659, 0.1, 'triangle', 0.05, 0.08); tone(784, 0.12, 'triangle', 0.05, 0.16); },
    // Heal / drain (drain SFX)
    heal()    { playSfxFile('Sounds/Attacks/drain.mp3', 0.35); },
    // Recoil self-damage
    recoil()  { tone(200, 0.1, 'square', 0.05); noise(0.08, 0.06); },
    // KO / faint
    faint()   { tone(300, 0.15, 'square', 0.06); tone(200, 0.2, 'square', 0.05, 0.1); tone(120, 0.3, 'square', 0.04, 0.25); },
    // Frozen / paralyzed can't act
    frozen()  { tone(800, 0.08, 'sine', 0.05); tone(600, 0.08, 'sine', 0.04, 0.06); tone(400, 0.1, 'sine', 0.03, 0.12); },
  };
})();

function animAtk(aSide,dSide,animType){
  const a=document.getElementById(`spr-${aSide}`);
  const d=document.getElementById(`spr-${dSide}`);
  resetSpriteClass(aSide); void a.offsetWidth;
  setSpriteAnimClass(aSide, `a-${aSide==='left'?'l':'r'}`);
  BattleSFX.swing();
  setTimeout(()=>{ resetSpriteClass(dSide); void d.offsetWidth; setSpriteAnimClass(dSide, 'a-h');
    BattleSFX.hit(animType);
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
  BattleSFX.miss();
}

function showClash(emoji){
  const el=document.getElementById('clash-fx');
  el.textContent=emoji; el.className='clash-fx'; void el.offsetWidth; el.className='clash-fx show';
  setTimeout(()=>el.className='clash-fx',700);
}

function showToast(type,text,animType){
  const t=document.getElementById('eff-toast');
  t.textContent=text; t.className=type==='super'?'es':'en';
  t.className+=' show'; void t.offsetWidth;
  setTimeout(()=>t.className=type==='super'?'es':'en',2100);
  if (type === 'super') BattleSFX.critHit(animType);
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
