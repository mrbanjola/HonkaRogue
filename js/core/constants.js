// ============================================================================
// HonkaRogue Constants (js/core/constants.js)
// Type charts, biomes, stage data, wild events, emoji pools
// ============================================================================

// TYPE EFFECTIVENESS CHART
const TYPE_EFF = {
  Fire:      { Fire:.5, Ice:2,  Lightning:.5, Shadow:1,  Normal:1 },
  Ice:       { Fire:.5, Ice:.5, Lightning:2,  Shadow:1,  Normal:1 },
  Lightning: { Fire:1,  Ice:.5, Lightning:.5, Shadow:2,  Normal:1 },
  Shadow:    { Fire:2,  Ice:1,  Lightning:.5, Shadow:.5, Normal:1 },
  Normal:    { Fire:1,  Ice:1,  Lightning:1,  Shadow:1,  Normal:1 },
};
const TC  = { Fire:'#ff4e00',Ice:'#00c8ff',Lightning:'#ffe600',Shadow:'#a020f0',Normal:'#aaaacc' };
const TCC = { Fire:'tc-fire',Ice:'tc-ice',Lightning:'tc-lightning',Shadow:'tc-shadow',Normal:'tc-normal' };

// BATTLE CONSTANTS
const LEVEL_GROWTH_RATE = 0.04; // universal for all stats — preserves build identity at every level
const STACKABLE_EFFECTS = ['cursed', 'shielded', 'pumped', 'exposed'];

// ENEMY EMOJI POOLS
const ENEMY_EMOJIS = {
  Fire:['\u{1F525}','\u{1F985}','\u{1F426}','\u{1F9A4}','\u{1F414}','\u{1F54A}'],
  Ice:['\u2744\uFE0F','\u{1F9CA}','\u{1F9CA}','\u{1F9CA}','\u{1F427}','\u{1F9CA}'],
  Lightning:['\u26A1','\u{1F329}\uFE0F','\u{1F5F2}\uFE0F','\u{1F426}','\u{1F985}','\u26A1'],
  Shadow:['\u{1F311}','\u{1F319}','\u{1F47B}','\u{1F578}\uFE0F','\u{1F5A4}','\u{1F573}\uFE0F'],
  Normal:['\u{1F986}','\u{1F426}','\u{1F985}','\u{1F423}','\u{1F413}','\u{1F9A2}'],
};
const BOSS_EMOJIS = ['\u{1F451}','\u{1F480}','\u{1F47D}','\u{1F47A}','\u{1F47F}','\u{1F52E}','\u{1F9FF}','\u{1F52F}','\u{1F480}','\u{1F52E}'];

// PART FAMILY → TYPE MAPPING
const TYPE_TO_PART_FAMILIES = {
  Fire: ['Embercrest', 'Sunflare'],
  Ice: ['Frostplume'],
  Lightning: ['Stormcall'],
  Shadow: ['Duskveil', 'Voidgild'],
  Normal: ['Marshborn', 'Ironbarb', 'Bloomcrest'],
};
const STARTER_FAMILIES = ['Embercrest', 'Sunflare', 'Frostplume', 'Stormcall', 'Duskveil', 'Voidgild'];

// BIOMES
const BIOMES = [
  { id: 'meadow', name: 'Gosling Meadow', types: ['Normal', 'Fire'], families: ['Marshborn', 'Bloomcrest', 'Sunflare'],
    visual: {
      skyTop: '#87a7d8', skyBottom: '#7f95c7', haze: 'rgba(189,216,255,.22)',
      horizon: '#3d7f42', groundA: '#3f8a48', groundB: '#377740', accent: 'rgba(255,225,145,.18)',
      stripe: 'rgba(255,255,255,.04)'
    },
    arenas: ['Sunlit Field', 'Windmill Yard', 'Barnside Ring'],
    lore: ['The wind carries feathers and old rivalry.', 'Friendly faces hide ruthless duelers.'] },
  { id: 'tundra', name: 'Frost Tundra', types: ['Ice', 'Normal'], families: ['Frostplume', 'Ironbarb', 'Marshborn'],
    visual: {
      skyTop: '#7c95b6', skyBottom: '#95abc7', haze: 'rgba(230,246,255,.24)',
      horizon: '#95afbe', groundA: '#9fc3d0', groundB: '#8fb4c2', accent: 'rgba(220,245,255,.16)',
      stripe: 'rgba(255,255,255,.06)'
    },
    arenas: ['Glacier Pass', 'Rime Basin', 'Snowglass Flats'],
    lore: ['Every breath freezes before it lands.', 'One misstep and the ice answers back.'] },
  { id: 'storm', name: 'Storm Frontier', types: ['Lightning', 'Normal'], families: ['Stormcall', 'Ironbarb', 'Bloomcrest'],
    visual: {
      skyTop: '#5a6486', skyBottom: '#707aa3', haze: 'rgba(190,220,255,.16)',
      horizon: '#2f4c5f', groundA: '#304f6a', groundB: '#2a4560', accent: 'rgba(255,238,128,.14)',
      stripe: 'rgba(255,255,255,.05)'
    },
    arenas: ['Voltage Cliffs', 'Static Causeway', 'Thunder Gate'],
    lore: ['Sparks dance before every impact.', 'Metal sings when storms roll in.'] },
  { id: 'ember', name: 'Ember Wastes', types: ['Fire', 'Shadow'], families: ['Embercrest', 'Sunflare', 'Duskveil'],
    visual: {
      skyTop: '#7a3a28', skyBottom: '#a34d2f', haze: 'rgba(255,183,124,.16)',
      horizon: '#5b3827', groundA: '#6a3a29', groundB: '#5a2f21', accent: 'rgba(255,129,52,.18)',
      stripe: 'rgba(255,230,180,.04)'
    },
    arenas: ['Cinder Pit', 'Ashen Span', 'Magma Court'],
    lore: ['Heat haze makes distance lie.', 'The ground remembers every burn.'] },
  { id: 'veil', name: 'Veil of Dusk', types: ['Shadow', 'Ice'], families: ['Duskveil', 'Voidgild', 'Frostplume'],
    visual: {
      skyTop: '#2a2448', skyBottom: '#3b2f61', haze: 'rgba(198,168,255,.13)',
      horizon: '#312d53', groundA: '#2b274a', groundB: '#241f3c', accent: 'rgba(170,120,255,.14)',
      stripe: 'rgba(255,255,255,.03)'
    },
    arenas: ['Moonlit Hollow', 'Gloom Bridge', 'Echo Crypt'],
    lore: ['Whispers linger longer than footsteps.', 'Shadows move first.'] },
];

// STAGE NAME GENERATION DATA
const STAGE_LOCATIONS = ['Honking Valley', 'Drake\'s Nest', 'Silent Bog', 'Windswept Meadow', 'Stonewood Grove',
  'Crystalline Caverns', 'Twilight Spire', 'Moonlight Thicket', 'Scorched Wastes', 'Frozen Basin'];
const E_PREFIXES = ['Rogue', 'Vicious', 'Wild', 'Strange', 'Mysterious', 'Cunning', 'Fierce', 'Daring', 'Ruthless', 'Brash',
  'Sly', 'Proud', 'Defiant', 'Vengeful', 'Shadow'];
const E_BODIES = ['Honker', 'Drake', 'Goose', 'Fowl', 'Warden', 'Guardian', 'Keeper', 'Sentinel', 'Specter', 'Phantom',
  'Relic', 'Oracle', 'Sage', 'Tyrant', 'Scourge'];
const E_BOSS_SUFFIXES = ['of the North', 'of the Depths', 'Prime', 'Ascendant', 'Reborn', 'Eternal', 'Undying', 'Sovereign', 'Absolute', 'Unlimitable'];
const STAGE_LORE = ['A place of old memory. Danger waits.', 'Few emerge unchanged from {n}.', 'The stage is set here. So is the trap.',
  'Legendary strength gathers in {n}.', 'Those who fear nothing fight here.', 'The current runs strong here.', 'Ancient power slumbers restlessly.'];

// RANDOM EVENTS
const WILD_EVENTS = [
  { id:'mercury', emoji:'*', name:'Mercury Retrograde',
    desc:'All move accuracy is HALVED this round for both fighters.',
    apply:(state)=>{ state.accuracyMod=.5; state.duration=1; },
    log:'Mercury Retrograde! All accuracy halved this round!' },
  { id:'surge',   emoji:'*', name:'Power Surge',
    desc:'The next successful hit will deal TRIPLE damage!',
    apply:(state)=>{ state.nextHitMult=3; },
    log:'Power Surge! The next hit will deal TRIPLE damage!' },
  { id:'rain',    emoji:'*', name:'Healing Rain',
    desc:'A gentle rain falls. Both fighters restore 30 HP.',
    apply:(state,bF)=>{ bF.forEach(f=>{ f.currentHP=Math.min(f.currentHP+30,f.maxHP+(f.maxHPBonus||0)); }); state.healBoth=true; },
    log:'Healing Rain! Both fighters restore 30 HP!' },
  { id:'goose',   emoji:'*', name:'WILD GOOSE INTERVENTION',
    desc:'A rogue goose crashes the arena and attacks someone at random!',
    apply:(state)=>{ state.gooseAttack=true; },
    log:'A WILD GOOSE appears and lunges at someone!' },
  { id:'amnesia', emoji:'*', name:'Type Amnesia',
    desc:'Type advantages are completely ignored for the next 3 rounds!',
    apply:(state)=>{ state.typeIgnored=true; state.typeIgnoredRounds=3; BS.typeOverride=true; },
    log:'Type Amnesia! Type advantages ignored for 3 rounds!' },
  { id:'mirror',  emoji:'*', name:'Mirror Dimension',
    desc:'The next hit reflects 50% of damage back to the attacker!',
    apply:(state)=>{ state.mirror=.5; },
    log:'Mirror Dimension! The next hit reflects 50% damage!' },
  { id:'wisdom',  emoji:'*', name:'Ancient Wisdom',
    desc:'All PP is fully restored for both fighters!',
    apply:(state,bF)=>{ bF.forEach(f=>f.moves.forEach(m=>m.pp=m.maxPP)); state.ppRestored=true; },
    log:'Ancient Wisdom! All PP fully restored for everyone!' },
  { id:'rage',    emoji:'*', name:'Rage Mode',
    desc:'The fighter below 50% HP gains +50% attack power for 3 rounds!',
    apply:(state,bF)=>{ const low=bF.find(f=>f.hpPct<.5); if(low){ state.rageTarget=low.side; state.rageMod=1.5; state.rageDur=3; } },
    log:'Rage Mode! The weakened fighter is ENRAGED!' },
  { id:'crowd',   emoji:'*', name:'Crowd Stampede',
    desc:'The audience storms the field! Both fighters take 25 damage.',
    apply:(state,bF)=>{ bF.forEach(f=>f.currentHP=Math.max(1,f.currentHP-25)); state.crowdDmg=true; },
    log:'The crowd stampedes onto the field! 25 damage to all!' },
  { id:'gravity', emoji:'*', name:'Gravity Well',
    desc:'All attacks are GUARANTEED to hit for the next 2 rounds!',
    apply:(state)=>{ state.guaranteedHit=true; state.guaranteeDur=2; },
    log:'Gravity Well! All attacks guaranteed to hit for 2 rounds!' },
  { id:'swap',    emoji:'*', name:'THE TWIST',
    desc:'The two fighters SWAP their current HP values!',
    apply:(state,bF)=>{ const tmp=bF[0].currentHP; bF[0].currentHP=bF[1].currentHP; bF[1].currentHP=tmp; state.swapped=true; },
    log:'THE TWIST! Fighters swap their HP values!' },
  { id:'doubles', emoji:'*', name:'Wild Card',
    desc:'One random move gets its power DOUBLED permanently!',
    apply:(state,bF)=>{ const f=bF[Math.floor(BS.rng()*2)]; const m=f.moves[Math.floor(BS.rng()*f.moves.length)]; m.power*=2; state.doubledMove={name:m.name,fighter:f.name}; },
    log:'Wild Card! A random move just got permanently doubled!' },
];

console.log('[CONSTANTS] Module loaded');
