// ============================================================================
// HonkaRogue Encounter Intro (js/ui/battle/battle-intro.js)
// Dramatic intro overlay before battle begins
// ============================================================================

(function () {
  let introEl = null;
  let introTimeout = null;
  let resolveIntro = null;

  function ensureOverlay() {
    if (introEl) return introEl;
    introEl = document.createElement('div');
    introEl.id = 'encounter-intro';
    introEl.className = 'encounter-intro';
    introEl.addEventListener('click', dismissIntro);
    const battle = document.getElementById('screen-battle');
    if (battle) battle.appendChild(introEl);
    return introEl;
  }

  /**
   * Show the encounter intro overlay.
   * Returns a Promise that resolves when the intro is dismissed.
   *
   * @param {object} opts
   * @param {object} opts.stage   - stage object from generateStage
   * @param {object} opts.enemy   - enemy Honker fighter object
   */
  function showEncounterIntro({ stage, enemy }) {
    const el = ensureOverlay();
    const isBoss = stage.isBoss;
    const type = enemy.type || 'Normal';
    const typeColor = TC[type] || '#ccc';

    // Build sprite preview
    const spriteHTML = buildIntroSpriteHTML(enemy);

    // Boss subtitle
    const bossLine = isBoss
      ? `<div class="ei-boss-tag">BOSS ENCOUNTER</div>`
      : `<div class="ei-wild-tag">A wild honker appears!</div>`;

    // Shield line for bosses
    const shieldLine = (isBoss && enemy.shieldMax > 0)
      ? `<div class="ei-shield-line" style="color:${typeColor}">Protected by Energy Shield</div>`
      : '';

    // Type badge(s)
    let typeBadges = `<span class="ei-type" style="border-color:${typeColor};color:${typeColor}">${type}</span>`;
    if (enemy.type2) {
      const t2c = TC[enemy.type2] || '#ccc';
      typeBadges += `<span class="ei-type" style="border-color:${t2c};color:${t2c}">${enemy.type2}</span>`;
    }

    // Level
    const lvl = enemy.level || 1;

    el.innerHTML = `
      <div class="ei-backdrop ${isBoss ? 'ei-boss' : 'ei-normal'}">
        <div class="ei-sprite-wrap">${spriteHTML}</div>
        ${bossLine}
        <div class="ei-name" style="color:${typeColor}">${enemy.name || '???'}</div>
        <div class="ei-types">${typeBadges}</div>
        <div class="ei-level">LV ${lvl}</div>
        ${shieldLine}
        <div class="ei-tap">Tap to continue</div>
      </div>
    `;

    el.classList.add('show');

    // Auto-dismiss after delay
    const delay = isBoss ? 3500 : 2200;
    return new Promise(resolve => {
      resolveIntro = resolve;
      introTimeout = setTimeout(dismissIntro, delay);
    });
  }

  function dismissIntro() {
    if (introTimeout) { clearTimeout(introTimeout); introTimeout = null; }
    if (introEl) introEl.classList.remove('show');
    if (resolveIntro) { resolveIntro(); resolveIntro = null; }
  }

  function buildIntroSpriteHTML(enemy) {
    const parts = enemy.assembledParts;
    if (parts && parts.head) {
      // Build composite preview layers
      const layers = ['legs', 'wings', 'torso', 'head'];
      return layers.map(slot => {
        const part = parts[slot];
        if (!part?.file) return '';
        return `<div class="ei-cp-layer ei-cp-${slot}"><img src="${part.file}" alt="${slot}"></div>`;
      }).join('');
    }
    // Fallback: emoji
    return `<div class="ei-emoji">${enemy.emoji || '\uD83E\uDD86'}</div>`;
  }

  // Global API
  window.showEncounterIntro = showEncounterIntro;
})();

console.log('[BATTLE-INTRO] Module loaded');
