// ============================================================================
// HonkaRogue Battle Results Screen (js/ui/battle/battle-results.js)
// Animated post-battle XP/mastery progression with sound effects
// ============================================================================

// --- Music / BGM manager ---
const GameAudio = (() => {
  const tracks = {};
  let current = null;
  let currentKey = null;

  function getOrLoad(key, src) {
    if (tracks[key]) return tracks[key];
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.35;
    tracks[key] = audio;
    return audio;
  }

  return {
    play(key, src) {
      if (currentKey === key && current && !current.paused) return;
      this.stop();
      const audio = getOrLoad(key, src);
      audio.currentTime = 0;
      audio.play().catch(() => {});
      current = audio;
      currentKey = key;
    },
    stop() {
      if (current) {
        current.pause();
        current.currentTime = 0;
      }
      current = null;
      currentKey = null;
    },
    fadeOut(durationMs) {
      if (!current) return;
      const audio = current;
      const startVol = audio.volume;
      const start = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - start) / durationMs);
        audio.volume = startVol * (1 - t);
        if (t < 1 && !audio.paused) requestAnimationFrame(tick);
        else { audio.pause(); audio.currentTime = 0; audio.volume = startVol; }
      }
      requestAnimationFrame(tick);
      current = null;
      currentKey = null;
    },
  };
})();

// --- Simple Web Audio synth for result sounds ---
const ResultSFX = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function play(freqs, duration, type, vol) {
    try {
      const c = getCtx();
      const g = c.createGain();
      g.connect(c.destination);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      freqs.forEach((f, i) => {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f, c.currentTime + i * 0.08);
        o.connect(g);
        o.start(c.currentTime + i * 0.08);
        o.stop(c.currentTime + duration);
      });
    } catch (_) {}
  }
  return {
    xpTick()    { play([600], 0.06, 'sine', 0.08); },
    levelUp()   { play([523, 659, 784, 1047], 0.6, 'triangle', 0.15); },
    masteryUp() { play([440, 554, 659, 880, 1109, 1319], 1.0, 'triangle', 0.18); },
    coinJingle(){ play([880, 1109], 0.2, 'sine', 0.1); },
    victory()   { play([523, 659, 784], 0.4, 'triangle', 0.12); },
  };
})();

// --- Main results screen ---

function showBattleResults(data, onDone) {
  // data: { xpGain, coinGain, masteryResults, isBoss, stageName, stageN }
  const screen = document.getElementById('screen-results');
  const body = document.getElementById('results-body');
  if (!screen || !body) { if (onDone) onDone(); return; }

  body.innerHTML = '';
  const party = CAMPAIGN.party || [];
  const activeIdx = CAMPAIGN.activeIdx;

  // Header
  const header = document.createElement('div');
  header.className = 'res-header';
  header.innerHTML = `
    <div class="res-title">${data.isBoss ? '\u2694\uFE0F BOSS DEFEATED!' : '\u2694\uFE0F VICTORY!'}</div>
    <div class="res-stage">Stage ${data.stageN}: ${data.stageName}</div>
  `;
  body.appendChild(header);

  // Coins
  const coinRow = document.createElement('div');
  coinRow.className = 'res-coins';
  coinRow.innerHTML = `<span class="res-coin-icon">\uD83E\uDE99</span> <span class="res-coin-val" id="res-coin-counter">0</span>`;
  body.appendChild(coinRow);

  // XP section header
  const xpHeader = document.createElement('div');
  xpHeader.className = 'res-section-title';
  xpHeader.textContent = `+${data.xpGain} XP EARNED`;
  body.appendChild(xpHeader);

  // Build a row for each party member
  const rows = [];
  party.forEach((h, idx) => {
    const isActive = idx === activeIdx;
    const sharePct = isActive ? 100 : (typeof getPartyXpSharePercent === 'function' ? getPartyXpSharePercent() : 15);
    const xpForThis = isActive ? data.xpGain : Math.max(1, Math.round(data.xpGain * (sharePct / 100)));

    // Snapshot BEFORE xp (we compute from totalXp that was already updated)
    // We need the pre-XP state, so subtract back
    const totalXpNow = h.totalXp || 0;
    const totalXpBefore = Math.max(0, totalXpNow - xpForThis);
    const progBefore = typeof levelProgressFromTotalXp === 'function' ? levelProgressFromTotalXp(totalXpBefore) : null;
    const progAfter = typeof levelProgressFromTotalXp === 'function' ? levelProgressFromTotalXp(totalXpNow) : null;

    if (!progBefore || !progAfter) return;

    const leveledUp = progAfter.level > progBefore.level;

    // Mastery info
    let masteryBefore = null, masteryAfter = null, masteryTieredUp = false;
    const canMastery = typeof canGainMastery === 'function' && canGainMastery(h);
    if (canMastery && typeof getMasteryTierInfo === 'function') {
      const mResult = (data.masteryResults || []).find(r => r.honkerId === h.id);
      const mTotalNow = typeof getMasteryTotalXp === 'function' ? getMasteryTotalXp(h.id) : 0;
      const mXpGained = mResult ? xpForThis : 0; // only contributors got mastery
      const mTotalBefore = Math.max(0, mTotalNow - mXpGained);
      masteryBefore = getMasteryTierInfo(mTotalBefore);
      masteryAfter = getMasteryTierInfo(mTotalNow);
      masteryTieredUp = mResult?.leveled || false;
    }

    const row = document.createElement('div');
    row.className = 'res-honker' + (isActive ? ' res-active' : '');

    const sprite = h.emoji || '?';
    const fainted = (h.currentHP ?? getHonkerMaxHP(h)) <= 0;

    row.innerHTML = `
      <div class="res-h-sprite">${sprite}</div>
      <div class="res-h-info">
        <div class="res-h-name">${h.name}${fainted ? ' <span class="res-fainted">FAINTED</span>' : ''}${isActive ? ' <span class="res-active-tag">ACTIVE</span>' : ''}</div>
        <div class="res-h-level" id="res-lv-${idx}">LV ${progBefore.level}</div>
        <div class="res-xp-wrap">
          <div class="res-xp-track"><div class="res-xp-fill" id="res-xp-${idx}"></div></div>
          <div class="res-xp-label" id="res-xp-lbl-${idx}">${progBefore.xp}/${progBefore.xpNeeded}</div>
        </div>
        <div class="res-lvup-flash" id="res-lvup-${idx}"></div>
        ${canMastery ? `
          <div class="res-mastery-row">
            <div class="res-mastery-stars" id="res-mstars-${idx}"></div>
            <div class="res-mastery-wrap">
              <div class="res-mastery-track"><div class="res-mastery-fill" id="res-mxp-${idx}"></div></div>
              <div class="res-mastery-label" id="res-mxp-lbl-${idx}"></div>
            </div>
            <div class="res-mastery-flash" id="res-mflash-${idx}"></div>
          </div>
        ` : ''}
      </div>
    `;

    // Handle composite sprites
    if (h.assembledParts) {
      const sprEl = row.querySelector('.res-h-sprite');
      if (sprEl && typeof renderCompositePreview === 'function') {
        sprEl.textContent = '';
        renderCompositePreview(h.assembledParts, sprEl, 'res-composite');
      }
    }

    body.appendChild(row);
    rows.push({
      idx, h, isActive, xpForThis, progBefore, progAfter, leveledUp,
      canMastery, masteryBefore, masteryAfter, masteryTieredUp
    });
  });

  // Continue button (disabled during animation)
  const contBtn = document.createElement('button');
  contBtn.className = 'btn btn-gold res-continue';
  contBtn.textContent = '\u25B6 CONTINUE';
  contBtn.disabled = true;
  contBtn.onclick = () => { if (onDone) onDone(); };
  body.appendChild(contBtn);

  showScreen('screen-results');
  ResultSFX.victory();

  // Animate coin counter
  animateCounter('res-coin-counter', 0, data.coinGain, 600, () => {
    ResultSFX.coinJingle();
  });

  // Animate each row's XP bar sequentially
  let delay = 400;
  rows.forEach((r, i) => {
    setTimeout(() => animateXpRow(r, () => {
      // After last row, enable continue
      if (i === rows.length - 1) {
        contBtn.disabled = false;
        contBtn.classList.add('res-continue-ready');
      }
    }), delay);
    delay += r.leveledUp ? 1800 : 900;
  });
}

function animateCounter(elId, from, to, durationMs, onDone) {
  const el = document.getElementById(elId);
  if (!el) { if (onDone) onDone(); return; }
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (t < 1) requestAnimationFrame(tick);
    else { el.textContent = to; if (onDone) onDone(); }
  }
  requestAnimationFrame(tick);
}

function animateXpRow(r, onDone) {
  const xpFill = document.getElementById(`res-xp-${r.idx}`);
  const xpLbl = document.getElementById(`res-xp-lbl-${r.idx}`);
  const lvEl = document.getElementById(`res-lv-${r.idx}`);
  const lvFlash = document.getElementById(`res-lvup-${r.idx}`);
  if (!xpFill) { if (onDone) onDone(); return; }

  // Set initial state
  const startPct = Math.round(r.progBefore.xp / r.progBefore.xpNeeded * 100);
  xpFill.style.width = startPct + '%';
  xpLbl.textContent = `${r.progBefore.xp}/${r.progBefore.xpNeeded}`;
  lvEl.textContent = `LV ${r.progBefore.level}`;

  if (r.leveledUp) {
    // Animate to 100%, flash, then reset for new level
    animateBar(xpFill, xpLbl, startPct, 100, r.progBefore.xp, r.progBefore.xpNeeded, r.progBefore.xpNeeded, 500, () => {
      // Level up flash
      ResultSFX.levelUp();
      lvEl.textContent = `LV ${r.progAfter.level}`;
      lvEl.classList.add('res-lv-pop');
      if (lvFlash) {
        lvFlash.textContent = `\uD83C\uDF89 LEVEL UP! LV ${r.progAfter.level}`;
        lvFlash.classList.add('show');
      }
      setTimeout(() => {
        // Reset bar for new level progress
        xpFill.style.transition = 'none';
        xpFill.style.width = '0%';
        requestAnimationFrame(() => {
          xpFill.style.transition = '';
          const endPct = Math.round(r.progAfter.xp / r.progAfter.xpNeeded * 100);
          animateBar(xpFill, xpLbl, 0, endPct, 0, r.progAfter.xpNeeded, r.progAfter.xp, 400, () => {
            animateMasteryRow(r, onDone);
          });
        });
      }, 600);
    });
  } else {
    // Simple fill
    const endPct = Math.round(r.progAfter.xp / r.progAfter.xpNeeded * 100);
    animateBar(xpFill, xpLbl, startPct, endPct, r.progBefore.xp, r.progBefore.xpNeeded, r.progAfter.xp, 600, () => {
      animateMasteryRow(r, onDone);
    });
  }
}

function animateBar(fillEl, lblEl, startPct, endPct, startXp, maxXp, endXp, durationMs, onDone) {
  const start = performance.now();
  let lastTick = 0;
  function tick(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const ease = 1 - Math.pow(1 - t, 2);
    const pct = Math.round(startPct + (endPct - startPct) * ease);
    const xp = Math.round(startXp + (endXp - startXp) * ease);
    fillEl.style.width = pct + '%';
    if (lblEl) lblEl.textContent = `${xp}/${maxXp}`;
    // Tick sound every ~40ms
    if (now - lastTick > 40 && pct !== startPct) {
      ResultSFX.xpTick();
      lastTick = now;
    }
    if (t < 1) requestAnimationFrame(tick);
    else { if (onDone) onDone(); }
  }
  requestAnimationFrame(tick);
}

function animateMasteryRow(r, onDone) {
  if (!r.canMastery || !r.masteryBefore || !r.masteryAfter) {
    if (onDone) onDone();
    return;
  }

  const starsEl = document.getElementById(`res-mstars-${r.idx}`);
  const mFill = document.getElementById(`res-mxp-${r.idx}`);
  const mLbl = document.getElementById(`res-mxp-lbl-${r.idx}`);
  const mFlash = document.getElementById(`res-mflash-${r.idx}`);
  if (!mFill || !starsEl) { if (onDone) onDone(); return; }

  const tiers = typeof getMasteryTiers === 'function' ? getMasteryTiers() : [];
  const maxTiers = tiers.length || 3;

  // Stars
  starsEl.innerHTML = renderMasteryStars(r.masteryAfter.level, maxTiers);

  // Compute bar positions
  const prevThreshold = r.masteryBefore.currentTier ? r.masteryBefore.currentTier.xpRequired : 0;
  const nextThreshold = r.masteryBefore.nextTier ? r.masteryBefore.nextTier.xpRequired : prevThreshold + 1;
  const range = nextThreshold - prevThreshold;

  let startXpInTier, endXpInTier;
  if (r.masteryBefore.maxed) {
    startXpInTier = 1; endXpInTier = 1;
    mLbl.textContent = 'MAX';
  } else {
    startXpInTier = r.masteryBefore.totalXp - prevThreshold;
    endXpInTier = Math.min(range, r.masteryAfter.totalXp - prevThreshold);
  }

  const startPct = Math.round(startXpInTier / range * 100);
  const endPct = Math.round(endXpInTier / range * 100);
  mFill.style.width = startPct + '%';

  if (!r.masteryBefore.maxed) {
    mLbl.textContent = `${r.masteryBefore.totalXp}/${nextThreshold}`;
  }

  if (r.masteryTieredUp) {
    // Fill to 100%, flash, then show new tier
    animateBar(mFill, null, startPct, 100, 0, 1, 1, 500, () => {
      ResultSFX.masteryUp();
      if (mFlash) {
        const tierLabel = r.masteryAfter.currentTier?.label || ('Tier ' + r.masteryAfter.level);
        mFlash.innerHTML = `\u2728 MASTERY: <b>${tierLabel}</b>`;
        mFlash.classList.add('show');
      }
      starsEl.innerHTML = renderMasteryStars(r.masteryAfter.level, maxTiers);
      starsEl.classList.add('res-stars-pop');

      setTimeout(() => {
        // Reset bar for new tier
        if (r.masteryAfter.maxed) {
          mFill.style.width = '100%';
          mLbl.textContent = 'MAX';
        } else {
          const newPrev = r.masteryAfter.currentTier ? r.masteryAfter.currentTier.xpRequired : 0;
          const newNext = r.masteryAfter.nextTier ? r.masteryAfter.nextTier.xpRequired : newPrev + 1;
          const newPct = Math.round((r.masteryAfter.totalXp - newPrev) / (newNext - newPrev) * 100);
          mFill.style.transition = 'none';
          mFill.style.width = '0%';
          requestAnimationFrame(() => {
            mFill.style.transition = '';
            mFill.style.width = newPct + '%';
            mLbl.textContent = `${r.masteryAfter.totalXp}/${newNext}`;
          });
        }
        if (onDone) onDone();
      }, 800);
    });
  } else {
    // Simple fill
    const endLbl = r.masteryAfter.maxed ? 'MAX' : `${r.masteryAfter.totalXp}/${nextThreshold}`;
    animateBar(mFill, null, startPct, endPct, 0, 1, 1, 500, () => {
      mLbl.textContent = endLbl;
      if (onDone) onDone();
    });
  }
}

console.log('[BATTLE-RESULTS] Module loaded');
