// ============================================================================
// HonkaRogue Battle State (js/battle-state.js)
// Single namespace for all transient per-battle globals.
// Reset via BS.reset() at the start of each stage.
// ============================================================================
const BS = {
  bFighters:        null,   // [playerHonker, enemyHonker]
  bPhase:           'p1',   // 'p1' | 'p2' | 'busy'
  bDead:            false,  // true when battle is over
  bRound:           0,
  bAutoOn:          false,
  bAutoTurn:        0,      // alternates 0/1 in auto mode
  bAutoTmr:         null,   // setInterval handle
  bSwapMode:        false,  // party swap overlay active
  typeOverride:     false,  // disables type effectiveness (Type Amnesia event)
  eventState:       {},     // active wild-event modifiers
  lastEventRound:   -5,     // prevents event spam
  bFaintedPartyIdx: null,   // Set of fainted party indices
  _pendingCaught:   null,   // caught honker waiting for placement
  rng:              null,   // seeded RNG for this battle (set in startStageBattle)
};

BS.reset = function() {
  BS.bFighters        = null;
  BS.bPhase           = 'p1';
  BS.bDead            = false;
  BS.bRound           = 0;
  BS.bAutoOn          = false;
  BS.bAutoTurn        = 0;
  BS.bAutoTmr         = null;
  BS.bSwapMode        = false;
  BS.typeOverride     = false;
  BS.eventState       = {};
  BS.lastEventRound   = -5;
  BS.bFaintedPartyIdx = new Set();
  BS._pendingCaught   = null;
  BS.rng              = null;
};
