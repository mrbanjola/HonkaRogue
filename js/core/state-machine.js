// ============================================================================
// HonkaRogue State Machine (js/core/state-machine.js)
// BattleState class and GameStateMachine for screen transitions
// ============================================================================

// BattleState — instantiated fresh per battle
class BattleState {
  constructor() {
    this.bFighters        = null;   // [playerHonker, enemyHonker]
    this.bPhase           = 'p1';   // 'p1' | 'p2' | 'busy'
    this.bDead            = false;  // true when battle is over
    this.bRound           = 0;
    this.bAutoOn          = false;
    this.bAutoTurn        = 0;      // alternates 0/1 in auto mode
    this.bAutoTmr         = null;   // setInterval handle
    this.bSwapMode        = false;  // party swap overlay active
    this.typeOverride      = false;  // disables type effectiveness (Type Amnesia event)
    this.eventState        = {};    // active wild-event modifiers
    this.lastEventRound    = -5;    // prevents event spam
    this.bFaintedPartyIdx  = new Set();
    this._pendingCaught    = null;  // caught honker waiting for placement
    this.rng               = null;  // seeded RNG for this battle
  }
}

// Global battle state — reassigned to a new instance each battle
let BS = new BattleState();

// GameStateMachine — manages all screen transitions
class GameStateMachine {
  constructor() {
    this.current = null;
    this.states = {};       // name -> { enter(), exit(), screen }
    this.history = [];      // for back navigation (dex screens)
  }

  register(name, config) {
    this.states[name] = config;
  }

  transition(name, data) {
    // Exit current state
    if (this.current && this.states[this.current]?.exit) {
      this.states[this.current].exit();
    }
    this.history.push(this.current);
    this.current = name;
    const state = this.states[name];
    if (!state) {
      console.warn(`[GSM] Unknown state: ${name}`);
      return;
    }
    // Show the screen DOM element
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (state.screen) {
      const el = document.getElementById(state.screen);
      if (el) el.classList.add('active');
    }
    // Call enter hook
    if (state.enter) state.enter(data);
  }

  back() {
    const prev = this.history.pop();
    if (prev) this.transition(prev);
  }
}

const GSM = new GameStateMachine();

console.log('[STATE-MACHINE] BattleState class + GameStateMachine loaded');
