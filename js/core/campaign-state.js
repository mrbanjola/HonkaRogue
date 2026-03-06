// ============================================================================
// HonkaRogue Campaign State (js/core/campaign-state.js)
// ROSTER definitions and CAMPAIGN initial state
// ============================================================================

// ROSTER (4 starter honkers)
let ROSTER = [
  { id:'bengt', name:'Bengt', emoji:'*', type:'Fire', lore:'A goose of volcanic temperament.', hp:210, luck:72, atk:95, def:75, spd:65, passive:{ id:'heat_proof', emoji:'*', name:'Heat Proof', desc:'Immune to Burn.' }, moveIds:['fire_flame_honk','fire_eruption','normal_wing_slap','fire_scorchblast']},
  { id:'robin', name:'Robin Hood', emoji:'*', type:'Ice', lore:'Stole warmth, gave frostbite.', hp:175, luck:65, atk:75, def:90, spd:95, passive:{ id:'frost_armor', emoji:'*', name:'Frost Armor', desc:'Takes 25% less Ice damage.' }, moveIds:['ice_frost_arrow','ice_blizzard','normal_peck','ice_ice_lance']},
  { id:'zephyr', name:'Zephyr', emoji:'*', type:'Lightning', lore:'Calls lightning from clear skies.', hp:155, luck:52, atk:82, def:55, spd:120, passive:{ id:'static_skin', emoji:'*', name:'Static Skin', desc:'30% chance to Paralyze any attacker.' }, moveIds:['lightning_shock_honk','lightning_thunderclap','normal_talon_strike','lightning_chain_bolt']},
  { id:'mortem', name:'Mortem', emoji:'*', type:'Shadow', lore:'A wraith from the void. Unfathomably cursed.', hp:165, luck:78, atk:88, def:70, spd:80, passive:{ id:'cursed_aura', emoji:'*', name:'Cursed Aura', desc:'Enemies begin battle Cursed for 2 rounds.' }, moveIds:['shadow_soul_drain','shadow_void_collapse','normal_scratch','shadow_dark_pulse']},
];

// CAMPAIGN INITIAL STATE
const CAMPAIGN = {
  started: false,
  playerBase: null,
  player: null,
  party: [],
  activeIdx: 0,
  stageIdx: 0,
  retries: 3,
  maxRetries: 3,
  runSeed: null,
  completedStages: [],
  totalXP: 0,
  level: 1,
  xp: 0,
  xpNeeded: 100,
  inventory: [],
  dexSeen: [],
  dexCaught: [],
  honkerMastery: {},
  deepest: 0,
  coins: 0,
  fallen: [],
  unlockedParts: [],
};

console.log('[CAMPAIGN-STATE] Module loaded');
