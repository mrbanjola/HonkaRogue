// ============================================================================
// HonkaRogue UI Screens Module (js/ui/screens.js)
// Screen switching and game initialization entry point
// ============================================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

async function initTitle() {
  try {
    console.log('[INIT] initTitle starting');
    if (typeof loadPartsData === 'function') {
      await loadPartsData();
      console.log('[INIT] Parts data loaded:', PARTS_DATA?.parts?.length || 0);
    }
    if (typeof loadPassivesData === 'function') {
      await loadPassivesData();
      console.log('[INIT] Passives loaded:', Object.keys(PASSIVE_DB || {}).length);
    }
    if (typeof loadHonkDexData === 'function') {
      const dexLoaded = await loadHonkDexData();
      if (!dexLoaded) console.warn('[INIT] Honkedex load failed; using bundled fallback');
      console.log('[INIT] Honkedex loaded:', HONKER_DEX?.length || 0);
    }
    if (typeof loadMovesData === 'function') {
      const movesLoaded = await loadMovesData();
      if (!movesLoaded) {
        console.error('[INIT] Move data failed to load from all sources');
        throw new Error('Move data failed to load');
      }
      console.log('[INIT] Moves data loaded:', MOVE_POOL?.length || 0);
    }
    if (typeof loadLootData === 'function') {
      await loadLootData();
      console.log('[INIT] Loot data loaded:', CORE_LOOT_POOL?.length || 0);
    }
    if (typeof loadMasteryData === 'function') {
      await loadMasteryData();
      console.log('[INIT] Mastery data loaded');
    }
    await loadGlobalDex();
    console.log('[INIT] Global dex loaded');
    buildCharSelect();
    console.log('[INIT] Character select built, found', document.getElementById('cs-grid')?.children?.length, 'characters');
    const hasSave = await loadCampaign();
    if (hasSave) {
      document.getElementById('cont-btn').style.display = '';
    }
    if (CAMPAIGN.deepest) {
      document.getElementById('highscore-strip').innerHTML =
        `\uD83C\uDFC6 DEEPEST STAGE REACHED: <span style="color:var(--gold)">${CAMPAIGN.deepest}</span>`;
    }
    const dexBtn = document.getElementById('dex-btn-title');
    if (dexBtn) dexBtn.style.display = '';
    // Render Kevin's composite sprite as the title emblem
    const titleEmblem = document.getElementById('title-emblem');
    if (titleEmblem && typeof getDexAssembledParts === 'function' && typeof renderCompositePreview === 'function') {
      const kevinDex = (HONKER_DEX || []).find(d => d.id === 'kevin');
      if (kevinDex) {
        const kevinParts = getDexAssembledParts(kevinDex);
        if (kevinParts) {
          renderCompositePreview(kevinParts, titleEmblem, 'title-kevin');
        } else {
          titleEmblem.textContent = '\uD83E\uDD86';
        }
      } else {
        titleEmblem.textContent = '\uD83E\uDD86';
      }
    }
    console.log('[INIT] About to show title screen');
    showScreen('screen-title');
    console.log('[INIT] Title screen shown successfully');
  } catch(e) {
    console.error('[INIT] FATAL ERROR in initTitle:', e);
    console.error('[INIT] Stack trace:', e.stack);
  }
}
