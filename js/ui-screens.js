// ============================================================================
// HonkaRogue UI Screens Module (js/ui-screens.js)
// Screen switching and game initialization entry point
// ============================================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  TITLE
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
async function initTitle() {
  try {
    console.log('[INIT] initTitle starting');
    if (typeof loadPartsData === 'function') {
      await loadPartsData();
      console.log('[INIT] Parts data loaded:', PARTS_DATA?.parts?.length || 0);
    }
    if (typeof loadMovesData === 'function') {
      const movesLoaded = await loadMovesData();
      if (!movesLoaded) {
        console.error('[INIT] Move data failed to load from all sources');
        throw new Error('Move data failed to load');
      }
      console.log('[INIT] Moves data loaded:', MOVE_POOL?.length || 0);
    }
    await loadGlobalDex();
    console.log('[INIT] Global dex loaded');
    buildCharSelect();
    console.log('[INIT] Character select built, found', document.getElementById('cs-grid')?.children?.length, 'characters');
    // Check for saved campaign
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
    console.log('[INIT] About to show title screen');
    showScreen('screen-title');
    console.log('[INIT] Title screen shown successfully');
  } catch(e) {
    console.error('[INIT] FATAL ERROR in initTitle:', e);
    console.error('[INIT] Stack trace:', e.stack);
  }
}
