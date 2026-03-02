// ============================================================================
// HonkaRogue UI Module (js/ui.js)
// Screen rendering, UI updates, event handlers
// ============================================================================

// Screen management
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById(id);
  if(el) el.classList.add('active');
}

// TODO: Extract these functions from index.html:
// - initTitle() and all game init
// - Character select: buildCharSelect(), confirmCharSelect()
// - Campaign map: showCampaignMap(), buildStageMap(), refreshCampaignSidebar()
// - Battle UI: setupFighterUI(), renderMovePanel(), updateHP(), updatePPDots()
// - Battle animations: animAtk(), shakeSpr(), showClash(), spawnPtcl()
// - Status badges: addStatusBadge(), clearStatusBadges(), refreshStatusBadges()
// - Loot screens: showLootScreen(), showCaughtScreen(), showBossClear()
// - Dex screens: showDex(), buildDexGrid(), showPartsDex(), buildPartsDexGrid()
// - Combat UI: buildRetryIcons(), buildTypeLegend(), setupFighterUI()
// - Party management: showSwitchOverlay(), showReplaceScreen(), releaseHonker()
// - Movement panels and event display
// - Assembly/parts system UI

console.log('[UI] Module loaded (stub)');
