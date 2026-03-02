// HonkaRogue Data Module (js/data.js)
// All constants, data structures, and configuration
// ============================================================================

// PARTS DATA
// PARTS DATA (loaded from server at runtime; fallback to bundled file when not served)
let PARTS_DATA = { version:'0.0.0', generatedAt:null, source:'runtime', statsGuide:{}, summary:{ totalParts:0, perSlot:{ head:0, torso:0, wings:0, legs:0 }, rarityBreakdown:{}, archetypeBreakdown:{} }, families:[], parts:[] };
const FAMILY_NAME_TYPE_HINT = {
  Marshborn:'Normal', Embercrest:'Fire', Frostplume:'Ice', Stormcall:'Lightning',
  Ironbarb:'Normal', Duskveil:'Shadow', Sunflare:'Fire', Bloomcrest:'Normal', Voidgild:'Shadow',
};
const FAMILY_THEME_TYPE_HINT = {
  fire:'Fire', solar:'Fire', ice:'Ice', lightning:'Lightning',
  shadow:'Shadow', arcane:'Shadow', bog:'Normal', stone:'Normal', wild:'Normal', normal:'Normal',
};
function inferFamilyType(typeRaw, nameRaw, themeRaw) {
  const explicit = String(typeRaw || '').trim();
  if (explicit) return explicit;
  const byName = FAMILY_NAME_TYPE_HINT[String(nameRaw || '').trim()];
  if (byName) return byName;
  const byTheme = FAMILY_THEME_TYPE_HINT[String(themeRaw || '').trim().toLowerCase()];
  if (byTheme) return byTheme;
  return 'Normal';
}
function ensureFamiliesRegistry(data) {
  if (!data) return;
  if (!Array.isArray(data.families)) data.families = [];
  if (!Array.isArray(data.parts)) data.parts = [];
  const byId = new Map();
  const byName = new Map();
  for (const fam of data.families) {
    if (!fam || !fam.name) continue;
    const id = Number(fam.id) || 0;
    const rec = {
      id,
      name: String(fam.name),
      theme: String(fam.theme || ''),
      type: inferFamilyType(fam.type, fam.name, fam.theme),
      description: String(fam.description || ''),
      baseMoveIds: Array.isArray(fam.baseMoveIds) ? [...new Set(fam.baseMoveIds.filter(Boolean))] : [],
    };
    if (id) byId.set(id, rec);
    byName.set(rec.name.toLowerCase(), rec);
  }
  for (const part of data.parts) {
    const pFam = part?.family || {};
    const pName = String(pFam.name || '').trim();
    const pTheme = String(pFam.theme || '').trim();
    const pType = String(pFam.type || '').trim();
    const pId = Number(part?.familyId || pFam.id) || 0;
    let fam = null;
    if (pId && byId.has(pId)) fam = byId.get(pId);
    if (!fam && pName && byName.has(pName.toLowerCase())) fam = byName.get(pName.toLowerCase());
    if (!fam) {
      const nextId = pId || Math.max(0, ...byId.keys()) + 1;
      const nextName = pName || `Family${nextId}`;
      const nextTheme = pTheme || 'normal';
      fam = { id: nextId, name: nextName, theme: nextTheme, type: inferFamilyType(pType, nextName, nextTheme), description: '', baseMoveIds: [] };
      byId.set(fam.id, fam);
      byName.set(fam.name.toLowerCase(), fam);
    } else {
      if (!fam.theme && pTheme) fam.theme = pTheme;
      if (!fam.id && pId) fam.id = pId;
      if (!fam.type || fam.type === 'Normal') fam.type = inferFamilyType(pType, fam.name, fam.theme);
    }
    part.familyId = fam.id;
    part.family = { id: fam.id, name: fam.name, theme: fam.theme, type: fam.type };
  }
  data.families = [...byId.values()].sort((a, b) => (a.id || 0) - (b.id || 0) || a.name.localeCompare(b.name));
}
function getPartFamily(part, data = PARTS_DATA) {
  if (!part) return null;
  const fams = data?.families || [];
  const byId = Number(part.familyId || part.family?.id) || 0;
  if (byId) {
    const f = fams.find(x => Number(x.id) === byId);
    if (f) return f;
  }
  const byName = String(part.family?.name || '').toLowerCase();
  if (byName) {
    const f = fams.find(x => String(x.name || '').toLowerCase() === byName);
    if (f) return f;
  }
  return part.family || null;
}
async function loadPartsData() {
  const urls = ['/api/parts-data', 'data/parts_data.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.parts)) {
        PARTS_DATA = data;
        ensureFamiliesRegistry(PARTS_DATA);
        // Keep JSON-authored rarity unless explicitly requested.
        if (PARTS_DATA.autoNormalizeRarity === true) normalizePartRarityByFamily(PARTS_DATA);
        // Keep JSON-authored part stats unless explicitly requested.
        if (PARTS_DATA.autoApplyProgressionCurve === true) applyPartProgressionCurve(PARTS_DATA);
        return PARTS_DATA;
      }
    } catch (_) {}
  }
  return PARTS_DATA;
}

function normalizePartRarityByFamily(data) {
  if (!data || !Array.isArray(data.parts)) return;
  const groups = new Map();
  for (const part of data.parts) {
    const fam = getPartFamily(part, data);
    const key = `${part.slot}::${fam?.name || 'Unknown'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(part);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => (a.variant || 0) - (b.variant || 0));
    const n = arr.length;
    if (n === 1) {
      arr[0].rarity = 'common';
      continue;
    }
    const legendaryIndex = n - 1;
    const rareCount = Math.max(1, Math.floor((n - 1) * 0.25));
    const rareStart = Math.max(0, legendaryIndex - rareCount);
    for (let i = 0; i < n; i++) {
      if (i === legendaryIndex) arr[i].rarity = 'legendary';
      else if (i >= rareStart) arr[i].rarity = 'rare';
      else arr[i].rarity = 'common';
    }
  }
}

function applyPartProgressionCurve(data) {
  if (!data || !Array.isArray(data.parts)) return;

  const rarityRank = { common: 0, rare: 2, legendary: 4 };
  const archetypeBonus = { balanced: 1.0, bulwark: 1.04, raider: 1.08, trickster: 1.03 };
  const statCaps = {
    head:  { hp: 28,  atk: 110, def: 30, spd: 46, luck: 40 },
    torso: { hp: 140, atk: 40,  def: 86, spd: 22, luck: 20 },
    wings: { hp: 38,  atk: 45,  def: 36, spd: 62, luck: 28 },
    legs:  { hp: 42,  atk: 42,  def: 38, spd: 50, luck: 26 },
  };

  for (const part of data.parts) {
    if (!part || !part.stats) continue;
    const slot = part.slot || 'head';
    const caps = statCaps[slot] || statCaps.head;
    const fam = getPartFamily(part, data);
    const familyId = Math.max(1, Math.min(9, Number(fam?.id) || 1));
    const familyRank = ((familyId - 1) / 8) * 3;
    const baseRank = (rarityRank[part.rarity] ?? 0) + familyRank;
    const rankMult = 0.82 + baseRank * 0.16;
    const archMult = archetypeBonus[part.archetype] || 1.0;
    const mult = rankMult * archMult;

    const next = {};
    for (const key of ['hp', 'atk', 'def', 'spd', 'luck']) {
      const raw = Number(part.stats[key]) || 0;
      next[key] = Math.max(1, Math.min(caps[key], Math.round(raw * mult)));
    }

    part.stats = next;
    part.powerScore = next.hp + next.atk + next.def + next.spd + next.luck;
  }
}

if (PARTS_DATA.autoNormalizeRarity === true) normalizePartRarityByFamily(PARTS_DATA);
if (PARTS_DATA.autoApplyProgressionCurve === true) applyPartProgressionCurve(PARTS_DATA);

// TYPE EFFECTIVENESS CHART
const TYPE_EFF = {
  Fire:      { Fire:.5, Ice:2,  Lightning:.5, Shadow:1,  Normal:1 },
  Ice:       { Fire:.5, Ice:.5, Lightning:2,  Shadow:1,  Normal:1 },
  Lightning: { Fire:1,  Ice:.5, Lightning:.5, Shadow:2,  Normal:1 },
  Shadow:    { Fire:2,  Ice:1,  Lightning:.5, Shadow:.5, Normal:1 },
  Normal:    { Fire:1,  Ice:1,  Lightning:1,  Shadow:1,  Normal:1 },
};
let typeOverride = false;
function getEff(a, d1, d2 = null) {
  if (typeOverride) return 1;
  const e1 = (TYPE_EFF[a]?.[d1]) ?? 1;
  const e2 = d2 ? ((TYPE_EFF[a]?.[d2]) ?? 1) : 1;
  return e1 * e2;
}
const TC  = { Fire:'#ff4e00',Ice:'#00c8ff',Lightning:'#ffe600',Shadow:'#a020f0',Normal:'#aaaacc' };
const TCC = { Fire:'tc-fire',Ice:'tc-ice',Lightning:'tc-lightning',Shadow:'tc-shadow',Normal:'tc-normal' };

// ROSTER (4 starter honkers)
const ROSTER = [
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

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  HONK?DEX   -  30 named honkers that fill stages 1 - 30
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
const HONKER_DEX = [
  // Stage 1
  { dexNum:1,  id:'gerald',     name:'Gerald',              emoji:'*', type:'Normal',
    atk:50, def:55, spd:55,
    lore:'Just a goose. No lore. He does his best.', passive:null },
  // Stage 2
  { dexNum:2,  id:'embertail',  name:'Embertail',           emoji:'*', type:'Fire',
    atk:80, def:65, spd:75,
    lore:'Born in a volcanic crater. Always slightly on fire.',
    passive:{id:'heat_proof',   emoji:'*', name:'Heat Proof',    desc:'Immune to Burn.'}},
  // Stage 3
  { dexNum:3,  id:'frosting',   name:'Frosting',            emoji:'*', type:'Ice',
    atk:62, def:95, spd:70,
    lore:'Named after the dessert. Extremely dangerous.',
    passive:{id:'frost_armor',  emoji:'*', name:'Frost Armor',   desc:'Takes 25% less Ice damage.'}},
  // Stage 4
  { dexNum:4,  id:'zappington', name:'Zappington',          emoji:'*', type:'Lightning',
    atk:75, def:55, spd:110,
    lore:'Has never been in the same room as a microwave.',
    passive:{id:'static_skin',  emoji:'*', name:'Static Skin',   desc:'30% chance to Paralyze attackers.'}},
  // Stage 5  -  BOSS
  { dexNum:5,  id:'voidwing',   name:'Voidwing',            emoji:'*', type:'Shadow',
    atk:90, def:80, spd:75,
    lore:'Gazes into you. Does not blink. Has no eyelids.',
    passive:{id:'cursed_aura',  emoji:'*', name:'Cursed Aura',   desc:'Enemy starts battle Cursed.'}, isBoss:true },
  // Stage 6
  { dexNum:6,  id:'kevin',      name:'Kevin',               emoji:'*', type:'Normal',
    atk:115, def:60, spd:70,
    lore:'Suspiciously strong for a Kevin.',
    passive:{id:'underdog',     emoji:'*', name:'Underdog',      desc:'+30% ATK when below 50% HP.'}},
  // Stage 7
  { dexNum:7,  id:'scorchwick', name:'Scorchwick',          emoji:'*', type:'Fire',
    atk:100, def:60, spd:85,
    lore:'Breathes fire. Also talks about breathing fire constantly.',
    passive:{id:'type_mastery', emoji:'*', name:'Type Mastery',  desc:'STAB bonus is -1.5 instead of -1.25.'}},
  // Stage 8
  { dexNum:8,  id:'brrrbeak',   name:'Brrrbeak',            emoji:'*', type:'Ice',
    atk:65, def:105, spd:58,
    lore:'Makes a brrrr sound. Not from the cold. Just vibes.',
    passive:{id:'resilient',    emoji:'*', name:'Resilient',     desc:'Immune to Paralysis.'}},
  // Stage 9
  { dexNum:9,  id:'thunderbeak',name:'Thunderbeak',         emoji:'*', type:'Lightning',
    atk:80, def:60, spd:105,
    lore:'His beak is a lightning rod. He is fine with this.',
    passive:{id:'thick_skin',   emoji:'*', name:'Thick Skin',    desc:'Takes 20% less damage from all sources.'}},
  // Stage 10  -  BOSS
  { dexNum:10, id:'magnaroo',   name:'Magnaroo Rex',        emoji:'*', type:'Fire',
    atk:110, def:85, spd:72,
    lore:'The lava cools when he arrives. Out of respect.',
    passive:{id:'heat_proof',   emoji:'*', name:'Heat Proof',    desc:'Immune to Burn.'}, isBoss:true },
  // Stage 11
  { dexNum:11, id:'capthonk',   name:'Captain Honk',        emoji:'*', type:'Normal',
    atk:78, def:85, spd:80,
    lore:'Decorated veteran of the First Honk War.',
    passive:{id:'shield_wall',  emoji:'*', name:'Shield Wall',   desc:'Enters battle Shielded for 1 round.'}},
  // Stage 12
  { dexNum:12, id:'glaciergus', name:'Glacier Gus',         emoji:'*', type:'Ice',
    atk:60, def:125, spd:38,
    lore:'Very slow. Very wide. Immovable object energy.',
    passive:{id:'regeneration', emoji:'*', name:'Regeneration',  desc:'Heals 6% max HP at the start of each round.'}},
  // Stage 13
  { dexNum:13, id:'gloomfeather',name:'Gloomfeather',       emoji:'*', type:'Shadow',
    atk:90, def:65, spd:85,
    lore:'Brings a noticeable chill to every room.',
    passive:{id:'cursed_aura',  emoji:'*', name:'Cursed Aura',   desc:'Enemy starts battle Cursed.'}},
  // Stage 14
  { dexNum:14, id:'staticlina', name:'Staticlina',          emoji:'*', type:'Lightning',
    atk:78, def:60, spd:108,
    lore:'Her feathers are frizzled. Has always been this way.',
    passive:{id:'static_skin',  emoji:'*', name:'Static Skin',   desc:'30% chance to Paralyze attackers.'}},
  // Stage 15  -  BOSS
  { dexNum:15, id:'crystalwing',name:'Crystalwing Prime',   emoji:'*', type:'Ice',
    atk:85, def:112, spd:62,
    lore:'Carved from a single glacier. Hates room temperature.',
    passive:{id:'frost_armor',  emoji:'*', name:'Frost Armor',   desc:'Takes 25% less Ice damage.'}, isBoss:true },
  // Stage 16
  { dexNum:16, id:'sirquacks',  name:'Sir Quacks-a-Lot',    emoji:'*', type:'Normal',
    atk:80, def:80, spd:80,
    lore:'Knighted for services to honking. No further questions.',
    passive:{id:'underdog',     emoji:'*', name:'Underdog',      desc:'+30% ATK when below 50% HP.'}},
  // Stage 17
  { dexNum:17, id:'dreadquack', name:'Dreadquack',          emoji:'*', type:'Shadow',
    atk:95, def:90, spd:68,
    lore:'Arrived without invitation. Left without explanation.',
    passive:{id:'thick_skin',   emoji:'*', name:'Thick Skin',    desc:'Takes 20% less damage from all sources.'}},
  // Stage 18
  { dexNum:18, id:'pyrocluck',  name:'Pyrocluck',           emoji:'*', type:'Fire',
    atk:112, def:55, spd:90,
    lore:'Spontaneously combusted once. Liked it.',
    passive:{id:'type_mastery', emoji:'*', name:'Type Mastery',  desc:'STAB bonus is -1.5 instead of -1.25.'}},
  // Stage 19
  { dexNum:19, id:'voltmare',   name:'Voltmare',            emoji:'*', type:'Lightning',
    atk:85, def:58, spd:122,
    lore:'Nightmare horse energy. Lightning bird body.',
    passive:{id:'resilient',    emoji:'*', name:'Resilient',     desc:'Immune to Paralysis.'}},
  // Stage 20  -  BOSS
  { dexNum:20, id:'eclipsar',   name:'Eclipsar Omega',      emoji:'*', type:'Shadow',
    atk:102, def:90, spd:78,
    lore:'Blocked out the sun. Filed the necessary paperwork.',
    passive:{id:'cursed_aura',  emoji:'*', name:'Cursed Aura',   desc:'Enemy starts battle Cursed.'}, isBoss:true },
  // Stage 21
  { dexNum:21, id:'profwaddle', name:'Professor Waddle',    emoji:'*', type:'Normal',
    atk:65, def:85, spd:62,
    lore:'Has a PhD. In honking. From an accredited institution.',
    passive:{id:'regeneration', emoji:'*', name:'Regeneration',  desc:'Heals 6% max HP at the start of each round.'}},
  // Stage 22
  { dexNum:22, id:'cinderquill',name:'Cinderquill',         emoji:'*', type:'Fire',
    atk:98, def:68, spd:82,
    lore:'Sheds smoldering feathers. They sell well.',
    passive:{id:'heat_proof',   emoji:'*', name:'Heat Proof',    desc:'Immune to Burn.'}},
  // Stage 23
  { dexNum:23, id:'snowquack',  name:'Snowquack',           emoji:'*', type:'Ice',
    atk:68, def:102, spd:62,
    lore:'Emerged from a blizzard. Has not fully melted.',
    passive:{id:'shield_wall',  emoji:'*', name:'Shield Wall',   desc:'Enters battle Shielded for 1 round.'}},
  // Stage 24
  { dexNum:24, id:'boltclaw',   name:'Boltclaw',            emoji:'*', type:'Lightning',
    atk:90, def:65, spd:115,
    lore:'Claws conduct electricity. Very gentle hugs.',
    passive:{id:'type_mastery', emoji:'*', name:'Type Mastery',  desc:'STAB bonus is -1.5 instead of -1.25.'}},
  // Stage 25  -  BOSS
  { dexNum:25, id:'regularbarry',name:'Regular Barry',      emoji:'*', type:'Normal',
    atk:122, def:65, spd:68,
    lore:'"I am just a regular Barry."  -  Barry, who is not regular.',
    passive:{id:'underdog',     emoji:'*', name:'Underdog',      desc:'+30% ATK when below 50% HP.'}, isBoss:true },
  // Stage 26
  { dexNum:26, id:'hexdown',    name:'Hexdown',             emoji:'Y,', type:'Shadow',
    atk:85, def:85, spd:75,
    lore:'Carries a grudge and several curses. Available for parties.',
    passive:{id:'thick_skin',   emoji:'*', name:'Thick Skin',    desc:'Takes 20% less damage from all sources.'}},
  // Stage 27
  { dexNum:27, id:'blazefowl',  name:'Blazefowl',           emoji:'*', type:'Fire',
    atk:108, def:70, spd:85,
    lore:'Historically mistaken for a roast dinner. Does not appreciate it.',
    passive:{id:'regeneration', emoji:'*', name:'Regeneration',  desc:'Heals 6% max HP at the start of each round.'}},
  // Stage 28
  { dexNum:28, id:'arcticclyde',name:'Arctic Clyde',        emoji:'*', type:'Ice',
    atk:70, def:112, spd:48,
    lore:'From the Northern Reaches. Doesn\'t talk about the Northern Reaches.',
    passive:{id:'resilient',    emoji:'*', name:'Resilient',     desc:'Immune to Paralysis.'}},
  // Stage 29
  { dexNum:29, id:'sparksworth',name:'Sparksworth',         emoji:'*', type:'Lightning',
    atk:88, def:62, spd:118,
    lore:'Delicate appearance. Devastating voltage. Wears a monocle.',
    passive:{id:'static_skin',  emoji:'*', name:'Static Skin',   desc:'30% chance to Paralyze attackers.'}},
  // Stage 30  -  BOSS
  { dexNum:30, id:'thewraith',  name:'The Wraith Ascendant',emoji:'*', type:'Shadow',
    atk:118, def:95, spd:85,
    lore:'The end of the known dex. And yet the stages continue.',
    passive:{id:'cursed_aura',  emoji:'*', name:'Cursed Aura',   desc:'Enemy starts battle Cursed.'}, isBoss:true },
];

// MOVE POOL (single source of truth)
// Add/edit moves here; all type indexes and learnable loot are derived automatically.
const MOVE_POOL = [
  {
    "name": "Flame Honk",
    "types": [
      "Fire"
    ],
    "emoji": "🔥",
    "desc": "Reliable fiery bread-and-butter.",
    "basePower": 50,
    "acc": 95,
    "pp": 20,
    "id": "",
    "tier": "common",
    "type": "Fire"
  },
  {
    "name": "Flame Burst",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "A quick flame",
    "basePower": 44,
    "acc": 95,
    "pp": 20
  },
  {
    "name": "Scorchblast",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "Ignites the target",
    "basePower": 55,
    "acc": 85,
    "pp": 12
  },
  {
    "name": "Ember",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "Leaves a lingering burn.",
    "basePower": 35,
    "acc": 100,
    "pp": 18,
    "effect": "burn",
    "effectTarget": "enemy",
    "effectChance": 100,
    "effectDur": 3,
    "isLootLearnable": true,
    "lootId": "move_ember",
    "lootRarity": "common",
    "lootColor": "#ff4e00",
    "lootDesc": "Adds <b>Ember</b> (Fire) to your moveset. <i>Guarantees Burn for 3 rounds.</i>"
  },
  {
    "name": "Magma Crash",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "Molten impact",
    "basePower": 80,
    "acc": 75,
    "pp": 8
  },
  {
    "name": "Emit Spark",
    "types": [
      "Fire"
    ],
    "emoji": "🔥",
    "desc": "Ignites the foe, increasing burn.",
    "basePower": 30,
    "acc": 95,
    "pp": 16,
    "effect": "burn",
    "effectTarget": "enemy",
    "effectChance": 95,
    "effectDur": 3,
    "id": "",
    "tier": "common",
    "type": "Fire"
  },
  {
    "name": "Inferno Wave",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "Massive heat wave.",
    "basePower": 85,
    "acc": 68,
    "pp": 6
  },
  {
    "name": "Eruption",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "Volcano emerges from below.",
    "basePower": 69,
    "acc": 80,
    "pp": 8
  },
  {
    "name": "Lava Spit",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "Steady, scorching.",
    "basePower": 47,
    "acc": 98,
    "pp": 18
  },
  {
    "name": "Solar Flare",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "The sun itself, weaponised. User takes recoil.",
    "basePower": 120,
    "acc": 82,
    "pp": 4,
    "recoil": 0.25,
    "isLootLearnable": true,
    "lootId": "sig_solarflare",
    "lootName": "Solar Flare",
    "lootRarity": "legendary",
    "lootColor": "#ff6a00",
    "lootExclusiveTo": [
      "bengt",
      "embertail",
      "scorchwick",
      "pyrocluck",
      "cinderquill",
      "blazefowl",
      "magnaroo"
    ],
    "lootDesc": "<b>Solar Flare</b>  -  Fire, PWR 155, 25% recoil. <i>Signature of fire glass cannons.</i>"
  },
  {
    "name": "Flamewing",
    "types": [
      "Fire"
    ],
    "emoji": "*",
    "desc": "Wings ablaze with power.",
    "basePower": 43,
    "acc": 96,
    "pp": 22
  },
  {
    "name": "Frost Arrow",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "Icy precision shot.",
    "basePower": 55,
    "acc": 96,
    "pp": 20
  },
  {
    "name": "Ice Lance",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "Sharp and piercing.",
    "basePower": 70,
    "acc": 84,
    "pp": 10
  },
  {
    "name": "Blizzard",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "Total chaos. Very unreliable.",
    "basePower": 95,
    "acc": 65,
    "pp": 5
  },
  {
    "name": "Icy Gust",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "A freezing wind.",
    "basePower": 44,
    "acc": 95,
    "pp": 20
  },
  {
    "name": "Frozen Spire",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "Icicles from above.",
    "basePower": 61,
    "acc": 85,
    "pp": 10
  },
  {
    "name": "Flash Freeze",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "May freeze the target solid.",
    "basePower": 35,
    "acc": 90,
    "pp": 15,
    "effect": "frozen",
    "effectTarget": "enemy",
    "effectChance": 65,
    "effectDur": 1,
    "isLootLearnable": true,
    "lootId": "move_freeze",
    "lootRarity": "rare",
    "lootColor": "#00c8ff",
    "lootDesc": "Adds <b>Flash Freeze</b> (Ice) to your moveset. <i>Chance to skip the enemy's next turn.</i>"
  },
  {
    "name": "Ice Shell",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "Wraps self in a frigid barrier. Stacks shield.",
    "basePower": 30,
    "acc": 100,
    "pp": 12,
    "effect": "shielded",
    "effectTarget": "self",
    "effectChance": 100,
    "effectDur": 3
  },
  {
    "name": "Permafrost",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "Guarantees freeze. Low damage.",
    "basePower": 30,
    "acc": 88,
    "pp": 12,
    "effect": "frozen",
    "effectTarget": "enemy",
    "effectChance": 100,
    "effectDur": 1
  },
  {
    "name": "Permafrost Slam",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "Seals the opponent in ice. Guaranteed freeze.",
    "basePower": 60,
    "acc": 90,
    "pp": 10,
    "effect": "frozen",
    "effectTarget": "enemy",
    "effectChance": 100,
    "effectDur": 1,
    "isLootLearnable": true,
    "lootId": "sig_permafrost",
    "lootName": "Permafrost Slam",
    "lootRarity": "legendary",
    "lootColor": "#00c8ff",
    "lootExclusiveTo": [
      "robin",
      "frosting",
      "brrrbeak",
      "glaciergus",
      "arcticclyde",
      "snowquack",
      "crystalwing"
    ],
    "lootDesc": "<b>Permafrost Slam</b>  -  Ice, PWR 60, <i>Guaranteed freeze</i>. Signature of icy tanks."
  },
  {
    "name": "Glacial Slam",
    "types": [
      "Ice"
    ],
    "emoji": "*",
    "desc": "Slow but crushingly powerful.",
    "basePower": 96,
    "acc": 70,
    "pp": 4
  },
  {
    "name": "Shock Honk",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Quick electric jab.",
    "basePower": 48,
    "acc": 95,
    "pp": 20
  },
  {
    "name": "Chain Bolt",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Arcs between targets.",
    "basePower": 61,
    "acc": 83,
    "pp": 10
  },
  {
    "name": "Thunderclap",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Overwhelming voltage.",
    "basePower": 91,
    "acc": 65,
    "pp": 5
  },
  {
    "name": "Arc Pulse",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Ricochets unpredictably.",
    "basePower": 66,
    "acc": 80,
    "pp": 8
  },
  {
    "name": "Static Honk",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Consistent voltage.",
    "basePower": 51,
    "acc": 93,
    "pp": 15
  },
  {
    "name": "Ball Lightning",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Slow but catastrophically explosive.",
    "basePower": 72,
    "acc": 76,
    "pp": 8
  },
  {
    "name": "Zap Field",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Bathes the foe in static charge.",
    "basePower": 30,
    "acc": 93,
    "pp": 15,
    "effect": "paralyzed",
    "effectTarget": "enemy",
    "effectChance": 90,
    "effectDur": 3,
    "isLootLearnable": true,
    "lootId": "move_zap",
    "lootRarity": "rare",
    "lootColor": "#ffe600",
    "lootDesc": "Adds <b>Zap Field</b> (Lightning). <i>Paralyzes the enemy, reducing their accuracy.</i>"
  },
  {
    "name": "Overclock",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Overloads own nervous system.",
    "basePower": 30,
    "acc": 100,
    "pp": 10,
    "effect": "pumped",
    "effectTarget": "self",
    "effectChance": 100,
    "effectDur": 2
  },
  {
    "name": "Volt Dive",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Priority strike. Always moves first.",
    "basePower": 38,
    "acc": 100,
    "pp": 18,
    "priority": true,
    "isLootLearnable": true,
    "lootId": "sig_voltdive",
    "lootName": "Volt Dive",
    "lootRarity": "rare",
    "lootColor": "#ffe600",
    "lootExclusiveTo": [
      "zephyr",
      "zappington",
      "voltmare",
      "staticlina",
      "sparksworth",
      "boltclaw",
      "thunderbeak"
    ],
    "lootDesc": "<b>Volt Dive</b>  -  Lightning, always goes first (priority). Signature of fast electric types."
  },
  {
    "name": "Discharge",
    "types": [
      "Lightning"
    ],
    "emoji": "*",
    "desc": "Massive AoE  -  hurts user for 18%.",
    "basePower": 85,
    "acc": 78,
    "pp": 6,
    "recoil": 0.18
  },
  {
    "name": "Soul Drain",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Saps the enemy's life force.",
    "basePower": 48,
    "acc": 94,
    "pp": 20,
    "drain": 0.3
  },
  {
    "name": "Dark Pulse",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "A wave of pure darkness.",
    "basePower": 61,
    "acc": 84,
    "pp": 10
  },
  {
    "name": "Void Collapse",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Opens an abyss beneath them.",
    "basePower": 91,
    "acc": 63,
    "pp": 5
  },
  {
    "name": "Void Rend",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Tears a void through the enemy. Heals attacker.",
    "basePower": 120,
    "acc": 80,
    "pp": 6,
    "drain": 0.35,
    "isLootLearnable": true,
    "lootId": "sig_voidrend",
    "lootName": "Void Rend",
    "lootRarity": "legendary",
    "lootColor": "#a020f0",
    "lootExclusiveTo": [
      "mortem",
      "thewraith",
      "voidwing",
      "gloomfeather",
      "hexdown",
      "eclipsar"
    ],
    "lootDesc": "<b>Void Rend</b>  -  Shadow, PWR 125, drains 35% as HP. <i>Signature of Mortem & The Wraith.</i>"
  },
  {
    "name": "Shadow Slam",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Pure dark force.",
    "basePower": 66,
    "acc": 80,
    "pp": 8
  },
  {
    "name": "Void Touch",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Dark and draining.",
    "basePower": 51,
    "acc": 93,
    "pp": 15,
    "drain": 0.2
  },
  {
    "name": "Eclipse Strike",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Blots out hope itself.",
    "basePower": 72,
    "acc": 79,
    "pp": 8
  },
  {
    "name": "Hex",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "A dark curse saps their strength.",
    "basePower": 30,
    "acc": 92,
    "pp": 15,
    "effect": "cursed",
    "effectTarget": "enemy",
    "effectChance": 90,
    "effectDur": 3,
    "isLootLearnable": true,
    "lootId": "move_hex",
    "lootRarity": "common",
    "lootColor": "#a020f0",
    "lootDesc": "Adds <b>Hex</b> (Shadow) to your moveset. <i>Curses the enemy, reducing their attack.</i>"
  },
  {
    "name": "Umbral Veil",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Cloaks self in protective darkness. Stacks shield.",
    "basePower": 30,
    "acc": 100,
    "pp": 12,
    "effect": "shielded",
    "effectTarget": "self",
    "effectChance": 100,
    "effectDur": 3
  },
  {
    "name": "Oblivion",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Terrifying. Unreliable. Legendary.",
    "basePower": 116,
    "acc": 52,
    "pp": 3
  },
  {
    "name": "Leech Feather",
    "types": [
      "Shadow"
    ],
    "emoji": "*",
    "desc": "Drains 40% of damage as healing.",
    "basePower": 44,
    "acc": 90,
    "pp": 14,
    "drain": 0.4
  },
  {
    "name": "Wing Slap",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Always connects. No type bonus.",
    "basePower": 43,
    "acc": 100,
    "pp": 25
  },
  {
    "name": "Peck",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Classic peck.",
    "basePower": 37,
    "acc": 100,
    "pp": 30
  },
  {
    "name": "Scratch",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Basic cursed scratch.",
    "basePower": 40,
    "acc": 100,
    "pp": 30
  },
  {
    "name": "Dive Bomb",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Straight down.",
    "basePower": 50,
    "acc": 92,
    "pp": 15
  },
  {
    "name": "Honk Slam",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Raw honk energy.",
    "basePower": 52,
    "acc": 88,
    "pp": 12
  },
  {
    "name": "Talon Strike",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Reliable talon.",
    "basePower": 45,
    "acc": 100,
    "pp": 20
  },
  {
    "name": "Wild Flap",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Chaotic but earnest.",
    "basePower": 61,
    "acc": 78,
    "pp": 10
  },
  {
    "name": "Iron Guard",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Raises an iron defensive shield. Stacks shield.",
    "basePower": 30,
    "acc": 100,
    "pp": 12,
    "effect": "shielded",
    "effectTarget": "self",
    "effectChance": 100,
    "effectDur": 3,
    "isLootLearnable": true,
    "lootId": "move_shield",
    "lootRarity": "rare",
    "lootColor": "#00ff88",
    "lootDesc": "Adds <b>Iron Guard</b> (Normal). <i>Applies stackable Shield (max 4), persistent until swap/boss clear.</i>"
  },
  {
    "name": "War Honk",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Unleash a terrifying battle cry.",
    "basePower": 30,
    "acc": 100,
    "pp": 12,
    "effect": "pumped",
    "effectTarget": "self",
    "effectChance": 100,
    "effectDur": 2,
    "isLootLearnable": true,
    "lootId": "move_pump",
    "lootRarity": "common",
    "lootColor": "#ff9800",
    "lootDesc": "Adds <b>War Honk</b> (Normal). <i>Pumps yourself up  -  boosts your attack for 2 rounds.</i>"
  },
  {
    "name": "Rampage",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Unstoppable. Unreliable. Legendary.",
    "basePower": 110,
    "acc": 60,
    "pp": 5,
    "isLootLearnable": true,
    "lootId": "move_rampage",
    "lootRarity": "legendary",
    "lootColor": "#ffd700",
    "lootDesc": "Adds <b>Rampage</b> (Normal, PWR 110) to your moveset. <i>Extremely powerful, low accuracy.</i>"
  },
  {
    "name": "Kevin's Fury",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Only activates when cornered. Enormous.",
    "basePower": 120,
    "acc": 85,
    "pp": 6,
    "lowHPOnly": true,
    "isLootLearnable": true,
    "lootId": "sig_kevinfury",
    "lootName": "Kevin's Fury",
    "lootRarity": "legendary",
    "lootColor": "#ffd700",
    "lootExclusiveTo": [
      "kevin",
      "regularbarry"
    ],
    "lootDesc": "<b>Kevin's Fury</b>  -  Normal, PWR 145. <i>Only usable below 50% HP. Signature of Kevin & Barry.</i>"
  },
  {
    "name": "Battle Cry",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "A rousing shout empowers attacks.",
    "basePower": 30,
    "acc": 100,
    "pp": 12,
    "effect": "pumped",
    "effectTarget": "self",
    "effectChance": 100,
    "effectDur": 2
  },
  {
    "name": "Feather Guard",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Raises a defensive wing shield. Stacks shield.",
    "basePower": 30,
    "acc": 100,
    "pp": 12,
    "effect": "shielded",
    "effectTarget": "self",
    "effectChance": 100,
    "effectDur": 3
  },
  {
    "name": "Quick Strike",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Always moves first. Low damage.",
    "basePower": 30,
    "acc": 100,
    "pp": 20,
    "priority": true
  },
  {
    "name": "Bulldoze",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Brute force. Never misses.",
    "basePower": 63,
    "acc": 100,
    "pp": 8
  },
  {
    "name": "Berserker Charge",
    "types": [
      "Normal"
    ],
    "emoji": "*",
    "desc": "Massive. 25% recoil damage.",
    "basePower": 104,
    "acc": 82,
    "pp": 5,
    "recoil": 0.25
  }
];

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seeded01(key) { return (hash32(String(key)) % 1000000) / 1000000; }
function slugMoveName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
function moveTier(m) {
  const desc = String(m?.desc || '').toLowerCase();
  const bp = Number(m?.basePower || 0);
  if (desc.includes('legendary') || bp >= 96 || (m.acc || 100) <= 60 || (m.pp || 99) <= 4) return 'legendary';
  if (bp >= 69 || (m.acc || 100) <= 80 || (m.pp || 99) <= 8 || m.effect || m.drain || m.recoil || m.priority) return 'rare';
  return 'common';
}

function normalizeMoveDef(m) {
  const types = Array.isArray(m.types) && m.types.length ? [...new Set(m.types)] : [m.type || 'Normal'];
  const primaryType = types[0] || 'Normal';
  const id = m.id || `${primaryType.toLowerCase()}_${slugMoveName(m.name)}`;
  const category = m.category || ((m.effect || (m.basePower || 0) <= 0) ? 'status' : 'attack');
  return { ...m, id, types, type: primaryType, category };
}

const MOVE_DB = {};
const MOVES_BY_TYPE = {};
const MOVES_BY_CATEGORY = {};
(() => {
  for (const raw of MOVE_POOL) {
    const rec = { ...normalizeMoveDef(raw) };
    rec.tier = moveTier(rec);
    MOVE_DB[rec.id] = rec;
    for (const t of rec.types) {
      if (!MOVES_BY_TYPE[t]) MOVES_BY_TYPE[t] = [];
      MOVES_BY_TYPE[t].push(rec);
    }
    if (!MOVES_BY_CATEGORY[rec.category]) MOVES_BY_CATEGORY[rec.category] = [];
    MOVES_BY_CATEGORY[rec.category].push(rec);
  }
})();

function materializeMoveFromId(moveId, opts = {}) {
  const rec = MOVE_DB[moveId];
  if (!rec) return null;
  const basePow = Number.isFinite(opts.basePow) ? opts.basePow : 55;
  const powerScale = Number.isFinite(opts.powerScale) ? opts.powerScale : 1;
  const fixedPower = Number.isFinite(opts.fixedPower) ? opts.fixedPower : null;
  const out = {
    id: rec.id,
    name: rec.name,
    type: opts.type || rec.type,
    emoji: rec.emoji,
    desc: rec.desc,
    power: rec.effect ? 0 : (fixedPower ?? Math.max(0, Math.round((rec.basePower || basePow) * powerScale))),
    acc: rec.acc,
    pp: rec.pp,
    maxPP: rec.pp,
    ...(rec.effect ? {
      effect: rec.effect,
      effectTarget: rec.effectTarget,
      effectChance: rec.effectChance,
      effectDur: rec.effectDur,
    } : {}),
    ...(rec.drain ? { drain: rec.drain } : {}),
    ...(rec.recoil ? { recoil: rec.recoil } : {}),
    ...(rec.priority ? { priority: true } : {}),
    ...(rec.lowHPOnly ? { lowHPOnly: true } : {}),
  };
  return out;
}
function materializeMovesFromIds(moveIds, opts = {}) {
  return (moveIds || []).map(id => materializeMoveFromId(id, opts)).filter(Boolean);
}
function resolveMoveId(move) {
  if (!move) return null;
  if (move.id && MOVE_DB[move.id]) return move.id;
  const byName = Object.values(MOVE_DB).find(rec => rec.name === move.name);
  return byName ? byName.id : null;
}
function ensureHonkerMoveIds(honker) {
  if (!honker) return;
  if (!Array.isArray(honker.moveIds)) honker.moveIds = [];
  if (!Array.isArray(honker.moves)) honker.moves = [];
  const ids = honker.moves.map(resolveMoveId).filter(Boolean);
  if (ids.length) honker.moveIds = [...new Set(ids)];
}
function moveSetHasId(moves, moveId) {
  return !!(moves || []).find(m => m.id === moveId || (MOVE_DB[moveId] && m.name === MOVE_DB[moveId].name));
}
function addMoveById(honker, moveId, opts = {}) {
  if (!honker) return false;
  if (!Array.isArray(honker.moves)) honker.moves = [];
  if (!Array.isArray(honker.moveIds)) honker.moveIds = [];
  if (moveSetHasId(honker.moves, moveId)) return false;
  const mv = materializeMoveFromId(moveId, opts);
  if (!mv) return false;
  honker.moves.push(mv);
  if (!honker.moveIds.includes(moveId)) honker.moveIds.push(moveId);
  return true;
}
function normalizeRosterMoveSets() {
  (ROSTER || []).forEach(h => {
    if (Array.isArray(h.moveIds) && h.moveIds.length) {
      h.moves = materializeMovesFromIds(h.moveIds, { type: h.type, basePow: 55 });
    } else {
      ensureHonkerMoveIds(h);
      h.moves = materializeMovesFromIds(h.moveIds, { type: h.type, basePow: 55 });
    }
  });
}
normalizeRosterMoveSets();

const SLOT_MOVE_PREF = {
  head:  { status: 1.25, priority: 0.8, utility: 0.55, heavy: 0.55 },
  torso: { status: 1.4,  priority: 0.35, utility: 1.0,  heavy: 0.7  },
  wings: { status: 0.65, priority: 1.35, utility: 0.55, heavy: 0.85 },
  legs:  { status: 0.45, priority: 0.7,  utility: 0.35, heavy: 1.35 },
};
const PART_FAMILY_TYPE = {
  Marshborn:'Normal',
  Embercrest:'Fire',
  Frostplume:'Ice',
  Stormcall:'Lightning',
  Ironbarb:'Normal',
  Duskveil:'Shadow',
  Sunflare:'Fire',
  Bloomcrest:'Normal',
  Voidgild:'Shadow',
};
const PART_THEME_TYPE = {
  fire:'Fire', solar:'Fire',
  ice:'Ice',
  lightning:'Lightning',
  shadow:'Shadow', arcane:'Shadow',
  bog:'Normal', stone:'Normal', wild:'Normal',
};
function rarityTargetTier(rarity) {
  if (rarity === 'legendary') return 'legendary';
  if (rarity === 'rare') return 'rare';
  return 'common';
}
function tierDistance(a, b) {
  const r = { common: 0, rare: 1, legendary: 2 };
  return Math.abs((r[a] ?? 0) - (r[b] ?? 0));
}
function partTypeFromData(part) {
  if (!part) return 'Normal';
  const fam = getPartFamily(part, PARTS_DATA) || part.family || {};
  const explicitType = String(fam?.type || '').trim();
  if (explicitType) return explicitType;
  const famType = PART_FAMILY_TYPE[fam?.name];
  const themeType = PART_THEME_TYPE[fam?.theme];
  return famType || themeType || 'Normal';
}
function inheritedFamilyMoveIds(part, data = PARTS_DATA) {
  const fam = getPartFamily(part, data);
  const ids = fam?.baseMoveIds;
  if (!Array.isArray(ids) || !ids.length) return null;
  return [...new Set(ids.filter(id => !!MOVE_DB[id]))];
}
function scoreMoveForPart(move, part, idx) {
  const slot = part.slot || 'head';
  const pref = SLOT_MOVE_PREF[slot] || SLOT_MOVE_PREF.head;
  const pType = partTypeFromData(part);
  const targetTier = rarityTargetTier(part.rarity);
  const moveBasePower = Number(move.basePower || 0);
  const isStatus = !!move.effect || moveBasePower <= 0;
  const isUtility = !!move.effect || !!move.drain || !!move.priority;
  const isHeavy = moveBasePower >= 69 || !!move.recoil;
  let s = 0;
  s += (move.type === pType ? 2.1 : (move.type === 'Normal' ? 0.65 : -0.35));
  s += 2.2 - (tierDistance(move.tier, targetTier) * 1.0);
  if (isStatus) s += pref.status;
  if (!!move.priority) s += pref.priority;
  if (isUtility) s += pref.utility;
  if (isHeavy) s += pref.heavy;
  s += ((moveBasePower / 120) * 0.55);
  s += ((move.acc || 100) / 100) * 0.35;
  s += seeded01(`${part.id}|${idx}|${move.id}`) * 0.1; // deterministic tie-breaker
  return s;
}
function pickPartMoves(part) {
  const pType = partTypeFromData(part);
  const typePool = MOVES_BY_TYPE[pType] || MOVES_BY_TYPE.Normal || [];
  const normalPool = MOVES_BY_TYPE.Normal || [];
  const allPool = [...typePool, ...normalPool];
  const ranked = allPool
    .map((m, i) => ({ m, s: scoreMoveForPart(m, part, i) }))
    .sort((a, b) => b.s - a.s);
  const first = ranked[0]?.m || typePool[0] || normalPool[0];
  let second = ranked.find(x => x.m.id !== first.id)?.m || ranked[1]?.m || first;

  if (part.rarity === 'legendary' && first.tier !== 'legendary' && second.tier !== 'legendary') {
    const leg = ranked.find(x => x.m.tier === 'legendary' && x.m.id !== first.id)?.m;
    if (leg) second = leg;
  }
  return [first.id, second.id];
}
function attachPartMoveLinks(data) {
  if (!data || !Array.isArray(data.parts)) return;
  for (const part of data.parts) {
    const explicit = Array.isArray(part.moveIds) && part.moveIds.length
      ? [...new Set(part.moveIds.filter(id => !!MOVE_DB[id]))]
      : null;
    const inherited = inheritedFamilyMoveIds(part, data);
    const ids = explicit || inherited || pickPartMoves(part);
    part.moveIds = ids;
  }
}

const ENEMY_EMOJIS = {
  Fire:['\u{1F525}','\u{1F985}','\u{1F426}','\u{1F9A4}','\u{1F414}','\u{1F54A}'],
  Ice:['\u2744\uFE0F','\u{1F9CA}','\u{1F9CA}','\u{1F9CA}','\u{1F427}','\u{1F9CA}'],
  Lightning:['\u26A1','\u{1F329}\uFE0F','\u{1F5F2}\uFE0F','\u{1F426}','\u{1F985}','\u26A1'],
  Shadow:['\u{1F311}','\u{1F319}','\u{1F47B}','\u{1F578}\uFE0F','\u{1F5A4}','\u{1F573}\uFE0F'],
  Normal:['\u{1F986}','\u{1F426}','\u{1F985}','\u{1F423}','\u{1F413}','\u{1F9A2}'],
};
const BOSS_EMOJIS = ['\u{1F451}','\u{1F480}','\u{1F47D}','\u{1F47A}','\u{1F47F}','\u{1F52E}','\u{1F9FF}','\u{1F52F}','\u{1F480}','\u{1F52E}'];
attachPartMoveLinks(PARTS_DATA);
const TYPE_TO_PART_FAMILIES = {
  Fire: ['Embercrest', 'Sunflare'],
  Ice: ['Frostplume'],
  Lightning: ['Stormcall'],
  Shadow: ['Duskveil', 'Voidgild'],
  Normal: ['Marshborn', 'Ironbarb', 'Bloomcrest'],
};
const STARTER_FAMILIES = ['Embercrest', 'Sunflare', 'Frostplume', 'Stormcall', 'Duskveil', 'Voidgild'];
function getStarterUnlockedPartIds() {
  const parts = PARTS_DATA?.parts || [];
  const byFamSlot = new Map();
  for (const p of parts) {
    const fam = p.family?.name || 'Unknown';
    const key = `${fam}::${p.slot}`;
    if (!byFamSlot.has(key)) byFamSlot.set(key, []);
    byFamSlot.get(key).push(p);
  }
  const out = new Set();
  for (const arr of byFamSlot.values()) {
    arr.sort((a, b) => {
      const ra = { common: 0, rare: 1, legendary: 2 }[a.rarity] ?? 3;
      const rb = { common: 0, rare: 1, legendary: 2 }[b.rarity] ?? 3;
      if (ra !== rb) return ra - rb;
      if ((a.variant || 0) !== (b.variant || 0)) return (a.variant || 0) - (b.variant || 0);
      return (a.powerScore || 0) - (b.powerScore || 0);
    });
    if (arr[0]?.id) out.add(arr[0].id);
  }
  return [...out];
}
function ensurePartTrackingState() {
  if (!Array.isArray(CAMPAIGN.caughtParts)) CAMPAIGN.caughtParts = [];
  if (!Array.isArray(CAMPAIGN.partsSeen)) CAMPAIGN.partsSeen = [];
  // Backfill legacy saves: any caught part should always be considered seen.
  if (CAMPAIGN.caughtParts.length) {
    const seenSet = new Set(CAMPAIGN.partsSeen);
    let changed = false;
    for (const id of CAMPAIGN.caughtParts) {
      if (!seenSet.has(id)) {
        seenSet.add(id);
        changed = true;
      }
    }
    if (changed) CAMPAIGN.partsSeen = [...seenSet];
  }
}
function getAllPartIds() {
  return (PARTS_DATA?.parts || []).map(p => p.id);
}
function isPartCaught(partOrId) {
  const id = typeof partOrId === 'string' ? partOrId : partOrId?.id;
  if (!id) return false;
  ensurePartTrackingState();
  return CAMPAIGN.caughtParts.includes(id);
}
function isPartSeen(partOrId) {
  const id = typeof partOrId === 'string' ? partOrId : partOrId?.id;
  if (!id) return false;
  ensurePartTrackingState();
  return CAMPAIGN.partsSeen.includes(id);
}
function isPartUnlocked(partOrId) {
  // For backwards compatibility: unlocked = caught (can use in assembly)
  return isPartCaught(partOrId);
}
function catchPartIds(ids) {
  ensurePartTrackingState();
  const caughtBefore = CAMPAIGN.caughtParts.length;
  const caughtSet = new Set(CAMPAIGN.caughtParts);
  const seenSet = new Set(CAMPAIGN.partsSeen);
  (ids || []).forEach(id => { 
    if (id) { 
      caughtSet.add(id);
      seenSet.add(id); 
    } 
  });
  CAMPAIGN.caughtParts = [...caughtSet];
  CAMPAIGN.partsSeen = [...seenSet];
  return CAMPAIGN.caughtParts.length - caughtBefore;
}
function seePartIds(ids) {
  ensurePartTrackingState();
  const before = CAMPAIGN.partsSeen.length;
  const set = new Set(CAMPAIGN.partsSeen);
  (ids || []).forEach(id => { if (id) set.add(id); });
  CAMPAIGN.partsSeen = [...set];
  return CAMPAIGN.partsSeen.length - before;
}
function resetStarterCaughtParts() {
  ensurePartTrackingState();
  CAMPAIGN.caughtParts = getStarterUnlockedPartIds();
  CAMPAIGN.partsSeen = getStarterUnlockedPartIds();
}
function unlockedPartsByFamilyType(type) {
  const fams = TYPE_TO_PART_FAMILIES[type] || [];
  if (!fams.length) return [];
  const set = new Set(fams);
  return (PARTS_DATA?.parts || []).filter(p => set.has(p.family?.name));
}
function resetStarterUnlockedParts() {
  // Reset parts to starter unlock state (parts available at game start)
  resetStarterCaughtParts();
}
function unlockAllParts() {
  // Unlock all parts for assembly UI (for visual browsing)
  ensurePartTrackingState();
  CAMPAIGN.caughtParts = getAllPartIds();
  CAMPAIGN.partsSeen = getAllPartIds();
}
function grantCatchPartUnlocks(caught, enemyRef) {
  const catchIds = [];
  const seeIds = [];
  const sourceParts = enemyRef?.assembledParts || null;
  if (sourceParts) {
    // Direct enemy: unlock the parts that composed them
    ['head', 'torso', 'wings', 'legs'].forEach(slot => {
      const id = sourceParts[slot]?.id;
      if (id) catchIds.push(id);
    });
  } else {
    // Procedural enemy: give random uncaught parts of matching type
    const pool = unlockedPartsByFamilyType(caught?.type).filter(p => !isPartCaught(p.id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const bySlot = new Map();
    for (const p of pool) {
      if (bySlot.has(p.slot)) continue;
      bySlot.set(p.slot, p.id);
      if (bySlot.size >= 2) break;
    }
    catchIds.push(...bySlot.values());
  }
  // Always see the enemy's type-matching parts
  seeIds.push(...(sourceParts ? catchIds : unlockedPartsByFamilyType(caught?.type).slice(0, 3).map(p => p.id)));
  const newCaught = catchPartIds(catchIds);
  seePartIds(seeIds);
  return newCaught;
}
function enemyHasUncaughtParts(enemyData) {
  if (!enemyData) return false;
  const sourceParts = enemyData.assembledParts;
  if (sourceParts) {
    // Named honker: check if any of its 4 parts are uncaught
    return ['head', 'torso', 'wings', 'legs'].some(slot => {
      const id = sourceParts[slot]?.id;
      return id && !isPartCaught(id);
    });
  } else {
    // Procedural enemy: check if type has uncaught parts
    const pool = unlockedPartsByFamilyType(enemyData.type);
    return pool.some(p => !isPartCaught(p.id));
  }
}

const DEX_PARTS_OVERRIDES = {
  // Kevin - Underdog with legendary all-rounder parts
  kevin: {
    head: { id: 'head-sprite_132', slot: 'head', file: 'Heads/sprite_132.png', family: { id: 8, name: 'Bloomcrest', theme: 'wild' }, variant: 16, rarity: 'common', archetype: 'balanced', stats: { hp: 10, atk: 53, def: 7, spd: 12, luck: 15 }, powerScore: 110, tags: ['wild', 'balanced', 'prime', 'night', 'sprite_132'], description: 'Bloomcrest headpiece with a balanced profile. Visual theme aligned to sprite style.', moveIds: ['normal_battle_cry', 'normal_feather_guard'] },
    torso: { id: 'torso-sprite_133', slot: 'torso', file: 'Torsos/sprite_133.png', family: { id: 8, name: 'Bloomcrest', theme: 'wild' }, variant: 16, rarity: 'legendary', archetype: 'bulwark', stats: { hp: 55, atk: 6, def: 27, spd: 2, luck: 2 }, powerScore: 57.95, tags: ['wild', 'bulwark', 'brutal', 'gloom', 'sprite_133'], description: 'Bloomcrest torso profile aligned for Normal typing.', moveIds: ['normal_berserker_charge', 'normal_feather_guard'] },
    wings: { id: 'wings-sprite_124', slot: 'wings', file: 'Wings/sprite_124.png', family: { id: 8, name: 'Bloomcrest', theme: 'wild' }, variant: 14, rarity: 'legendary', archetype: 'trickster', stats: { hp: 4, atk: 8, def: 4, spd: 33, luck: 12 }, powerScore: 60.980000000000004, tags: ['wild', 'trickster', 'arc', 'thunder', 'sprite_124'], description: 'Bloomcrest wing rig with a trickster profile. Visual theme aligned to sprite style.', moveIds: ['normal_berserker_charge', 'normal_quick_strike'] },
    legs: { id: 'legs-sprite_127', slot: 'legs', file: 'Legs/sprite_127.png', family: { id: 8, name: 'Bloomcrest', theme: 'wild' }, variant: 47, rarity: 'rare', archetype: 'balanced', stats: { hp: 14, atk: 6, def: 8, spd: 14, luck: 2 }, powerScore: 38.38000000000001, tags: ['wild', 'balanced', 'razor', 'sprite_127'], description: 'Bloomcrest legs profile aligned for Normal typing.', moveIds: ['normal_quick_strike', 'normal_berserker_charge'] },
  },
  // Voidwing - Shadow boss with rare arcane combination
  voidwing: {
    head: { id: 'head-sprite_092', slot: 'head', file: 'Heads/sprite_092.png', family: { id: 9, name: 'Voidgild', theme: 'arcane' }, variant: 12, rarity: 'rare', archetype: 'balanced', stats: { hp: 14, atk: 43, def: 9, spd: 13, luck: 19 }, powerScore: 103.39999999999999, tags: ['arcane', 'balanced', 'swift', 'thunder', 'sprite_092'], description: 'Voidgild rare headpiece with exceptional stats.', moveIds: ['shadow_soul_drain', 'shadow_dark_pulse'] },
    torso: { id: 'torso-sprite_016', slot: 'torso', file: 'Torsos/sprite_016.png', family: { id: 9, name: 'Voidgild', theme: 'arcane' }, variant: 3, rarity: 'common', archetype: 'balanced', stats: { hp: 54, atk: 6, def: 32, spd: 1, luck: 8 }, powerScore: 67.3, tags: ['arcane', 'balanced', 'ancient', 'marsh', 'sprite_016'], description: 'Voidgild ancient torso with strong defense.', moveIds: ['shadow_soul_drain', 'shadow_dark_pulse'] },
    wings: { id: 'wings-sprite_085', slot: 'wings', file: 'Wings/sprite_085.png', family: { id: 3, name: 'Frostplume', theme: 'ice' }, variant: 10, rarity: 'rare', archetype: 'trickster', stats: { hp: 2, atk: 7, def: 1, spd: 16, luck: 6 }, powerScore: 31, tags: ['ice', 'trickster', 'arc', 'glacier', 'sprite_085'], description: 'Rare wings with extreme speed, speed-based shadow power.', moveIds: ['shadow_void_collapse', 'shadow_eclipse_strike'] },
    legs: { id: 'legs-sprite_006', slot: 'legs', file: 'Legs/sprite_006.png', family: { id: 6, name: 'Duskveil', theme: 'shadow' }, variant: 4, rarity: 'rare', archetype: 'balanced', stats: { hp: 11, atk: 6, def: 7, spd: 11, luck: 3 }, powerScore: 32, tags: ['shadow', 'balanced', 'hollow', 'marsh', 'sprite_006'], description: 'Duskveil rare legs with shadow synergy.', moveIds: ['shadow_soul_drain', 'shadow_void_touch'] },
  },
  // Magnaroo Rex - Fire boss with legendary pyro combo
  magnaroo: {
    head: { id: 'head-sprite_129', slot: 'head', file: 'Heads/sprite_129.png', family: { id: 7, name: 'Sunflare', theme: 'solar' }, variant: 15, rarity: 'rare', archetype: 'raider', stats: { hp: 14, atk: 46, def: 11, spd: 10, luck: 19 }, powerScore: 108.6, tags: ['solar', 'raider', 'swift', 'iron', 'sprite_129'], description: 'Sunflare rare head designed for high attack.', moveIds: ['fire_scorchblast', 'fire_magma_crash'] },
    torso: { id: 'torso-sprite_035', slot: 'torso', file: 'Torsos/sprite_035.png', family: { id: 2, name: 'Embercrest', theme: 'fire' }, variant: 6, rarity: 'common', archetype: 'bulwark', stats: { hp: 22, atk: 2, def: 12, spd: 0, luck: 1 }, powerScore: 24, tags: ['fire', 'bulwark', 'ancient', 'ember', 'sprite_035'], description: 'Embercrest ancient torso, extremely tanky.', moveIds: ['fire_magma_crash', 'fire_inferno_wave'] },
    wings: { id: 'wings-sprite_065', slot: 'wings', file: 'Wings/sprite_065.png', family: { id: 2, name: 'Embercrest', theme: 'fire' }, variant: 9, rarity: 'common', archetype: 'balanced', stats: { hp: 2, atk: 6, def: 1, spd: 15, luck: 5 }, powerScore: 28, tags: ['fire', 'balanced', 'mythic', 'rime', 'sprite_065'], description: 'Embercrest wings optimized for fire attacks.', moveIds: ['fire_magma_crash', 'fire_eruption'] },
    legs: { id: 'legs-sprite_045', slot: 'legs', file: 'Legs/sprite_045.png', family: { id: 2, name: 'Embercrest', theme: 'fire' }, variant: 24, rarity: 'rare', archetype: 'balanced', stats: { hp: 15, atk: 6, def: 7, spd: 12, luck: 3 }, powerScore: 34.6, tags: ['fire', 'balanced', 'hollow', 'anvil', 'sprite_045'], description: 'Embercrest rare legs with fire affinity.', moveIds: ['fire_magma_crash', 'fire_lava_spit'] },
  },
  // Eclipsar - Shadow final boss with maximum rare synergy
  eclipsar: {
    head: { id: 'head-sprite_092', slot: 'head', file: 'Heads/sprite_092.png', family: { id: 9, name: 'Voidgild', theme: 'arcane' }, variant: 12, rarity: 'rare', archetype: 'balanced', stats: { hp: 14, atk: 43, def: 9, spd: 13, luck: 19 }, powerScore: 103.39999999999999, tags: ['arcane', 'balanced', 'swift', 'thunder', 'sprite_092'], description: 'Voidgild rare head for eclipse power.', moveIds: ['shadow_oblivion', 'shadow_eclipse_strike'] },
    torso: { id: 'torso-sprite_016', slot: 'torso', file: 'Torsos/sprite_016.png', family: { id: 9, name: 'Voidgild', theme: 'arcane' }, variant: 3, rarity: 'common', archetype: 'balanced', stats: { hp: 54, atk: 6, def: 32, spd: 1, luck: 8 }, powerScore: 67.3, tags: ['arcane', 'balanced', 'ancient', 'marsh', 'sprite_016'], description: 'Voidgild torso for shadow durability.', moveIds: ['shadow_oblivion', 'shadow_void_collapse'] },
    wings: { id: 'wings-sprite_085', slot: 'wings', file: 'Wings/sprite_085.png', family: { id: 3, name: 'Frostplume', theme: 'ice' }, variant: 10, rarity: 'rare', archetype: 'trickster', stats: { hp: 2, atk: 7, def: 1, spd: 16, luck: 6 }, powerScore: 31, tags: ['ice', 'trickster', 'arc', 'glacier', 'sprite_085'], description: 'Rare wings for evasion against eclipse.', moveIds: ['shadow_eclipse_strike', 'shadow_void_collapse'] },
    legs: { id: 'legs-sprite_015', slot: 'legs', file: 'Legs/sprite_015.png', family: { id: 6, name: 'Duskveil', theme: 'shadow' }, variant: 9, rarity: 'rare', archetype: 'balanced', stats: { hp: 12, atk: 6, def: 8, spd: 12, luck: 3 }, powerScore: 34.4, tags: ['shadow', 'balanced', 'hollow', 'ember', 'sprite_015'], description: 'Duskveil rare legs for shadow mastery.', moveIds: ['shadow_oblivion', 'shadow_leech_feather'] },
  },
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
function rarityWeight(rarity) {
  if (rarity === 'legendary') return 2;
  if (rarity === 'rare') return 1;
  return 0;
}
function pickDexPartForSlot(dex, slot) {
  const all = (PARTS_DATA?.parts || []).filter(p => p.slot === slot);
  if (!all.length) return null;
  const fams = TYPE_TO_PART_FAMILIES[dex.type] || [];
  let pool = all.filter(p => fams.includes(p.family?.name));
  if (!pool.length) pool = all;
  pool = pool.slice().sort((a, b) => {
    const ra = rarityWeight(a.rarity);
    const rb = rarityWeight(b.rarity);
    if (ra !== rb) return ra - rb;
    if ((a.powerScore || 0) !== (b.powerScore || 0)) return (a.powerScore || 0) - (b.powerScore || 0);
    return String(a.id).localeCompare(String(b.id));
  });
  const roll = seeded01(`${dex.id}|${slot}|part`);
  const bias = dex.isBoss ? 0.58 : 0.18;
  const t = Math.max(0, Math.min(0.9999, bias + roll * (1 - bias)));
  const idx = Math.floor(t * pool.length);
  return cloneJson(pool[Math.min(pool.length - 1, idx)]);
}
function computeDexAssembledParts(dex) {
  if (!dex || !PARTS_DATA || !Array.isArray(PARTS_DATA.parts)) return null;
  const ov = DEX_PARTS_OVERRIDES[dex.id];
  if (ov) return cloneJson(ov);
  const out = {
    head: pickDexPartForSlot(dex, 'head'),
    torso: pickDexPartForSlot(dex, 'torso'),
    wings: pickDexPartForSlot(dex, 'wings'),
    legs: pickDexPartForSlot(dex, 'legs'),
  };
  return (out.head && out.torso && out.wings && out.legs) ? out : null;
}
function getPartById(partId) {
  if (!partId) return null;
  return (PARTS_DATA?.parts || []).find(p => p.id === partId) || null;
}
function partIdsFromAssembledParts(parts) {
  if (!parts) return null;
  const out = {
    head: parts.head?.id || null,
    torso: parts.torso?.id || null,
    wings: parts.wings?.id || null,
    legs: parts.legs?.id || null,
  };
  return (out.head && out.torso && out.wings && out.legs) ? out : null;
}
function computeDexPartIds(dex) {
  const parts = computeDexAssembledParts(dex);
  return partIdsFromAssembledParts(parts);
}
function getDexPartIds(dex) {
  if (!dex) return null;
  const explicit = dex.partIds;
  if (explicit && explicit.head && explicit.torso && explicit.wings && explicit.legs) return { ...explicit };
  const legacy = partIdsFromAssembledParts(dex.assembledParts);
  if (legacy) return legacy;
  return computeDexPartIds(dex);
}
function initDexPartIds() {
  for (const dex of (HONKER_DEX || [])) {
    if (!dex?.partIds) {
      const ids = getDexPartIds(dex);
      if (ids) dex.partIds = ids;
    }
  }
}
function getDexAssembledParts(dex) {
  const ids = getDexPartIds(dex);
  if (!ids) return null;
  const out = {
    head: cloneJson(getPartById(ids.head)),
    torso: cloneJson(getPartById(ids.torso)),
    wings: cloneJson(getPartById(ids.wings)),
    legs: cloneJson(getPartById(ids.legs)),
  };
  return (out.head && out.torso && out.wings && out.legs) ? out : null;
}
function buildDexPartBlueprint(dex) {
  const assembledParts = getDexAssembledParts(dex);
  if (!assembledParts) return null;
  const derived = deriveHonkerFromParts(assembledParts);
  return { assembledParts, derived };
}
initDexPartIds();

const BIOMES = [
  { id: 'meadow', name: 'Gosling Meadow', types: ['Normal', 'Fire'], families: ['Marshborn', 'Bloomcrest', 'Sunflare'],
    arenas: ['Sunlit Field', 'Windmill Yard', 'Barnside Ring'],
    lore: ['The wind carries feathers and old rivalry.', 'Friendly faces hide ruthless duelers.'] },
  { id: 'tundra', name: 'Frost Tundra', types: ['Ice', 'Normal'], families: ['Frostplume', 'Ironbarb', 'Marshborn'],
    arenas: ['Glacier Pass', 'Rime Basin', 'Snowglass Flats'],
    lore: ['Every breath freezes before it lands.', 'One misstep and the ice answers back.'] },
  { id: 'storm', name: 'Storm Frontier', types: ['Lightning', 'Normal'], families: ['Stormcall', 'Ironbarb', 'Bloomcrest'],
    arenas: ['Voltage Cliffs', 'Static Causeway', 'Thunder Gate'],
    lore: ['Sparks dance before every impact.', 'Metal sings when storms roll in.'] },
  { id: 'ember', name: 'Ember Wastes', types: ['Fire', 'Shadow'], families: ['Embercrest', 'Sunflare', 'Duskveil'],
    arenas: ['Cinder Pit', 'Ashen Span', 'Magma Court'],
    lore: ['Heat haze makes distance lie.', 'The ground remembers every burn.'] },
  { id: 'veil', name: 'Veil of Dusk', types: ['Shadow', 'Ice'], families: ['Duskveil', 'Voidgild', 'Frostplume'],
    arenas: ['Moonlit Hollow', 'Gloom Bridge', 'Echo Crypt'],
    lore: ['Whispers linger longer than footsteps.', 'Shadows move first.'] },
];
function getBiomeForStage(n) {
  const idx = Math.floor((Math.max(1, n) - 1) / 5) % BIOMES.length;
  return BIOMES[idx];
}
function pickWeightedIndex(weights, rng) {
  const total = (weights || []).reduce((a, b) => a + Math.max(0, b || 0), 0);
  if (!total) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i] || 0);
    if (r <= 0) return i;
  }
  return Math.max(0, weights.length - 1);
}
function pickBiomeType(biome, rng, isBoss) {
  const base = biome?.types?.length ? biome.types : ['Normal'];
  const pool = isBoss ? base : [...base, 'Normal'];
  return pool[Math.floor(rng() * pool.length)] || 'Normal';
}
function chooseDexForStage(n, isBoss, rng, biome) {
  const all = (HONKER_DEX || []).filter(d => !!d.isBoss === !!isBoss);
  if (!all.length) return null;
  const maxDex = Math.min(HONKER_DEX.length, Math.max(isBoss ? 5 : 6, Math.floor(6 + n * 1.15)));
  const minDex = Math.max(1, maxDex - (isBoss ? 14 : 12));
  let pool = all.filter(d => d.dexNum >= minDex && d.dexNum <= maxDex);
  if (!pool.length) pool = all.slice();
  const weights = pool.map(d => {
    let w = 1;
    if ((biome?.types || []).includes(d.type)) w *= 2.6;
    const dist = Math.abs(d.dexNum - maxDex);
    w *= Math.max(0.55, 1.2 - dist * 0.05);
    return w;
  });
  return pool[pickWeightedIndex(weights, rng)] || pool[0];
}
function xpRewardForEnemyLevel(level, isBoss) {
  const lv = Math.max(1, Number(level) || 1);
  const base = 45;
  const growth = 1.18;
  let xp = Math.round(base * Math.pow(growth, lv - 1));
  if (isBoss) xp = Math.round(xp * 1.6);
  return Math.max(25, xp);
}

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

// "?"? CORE GENERATOR "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
function generateStage(n) {
  const rng    = seededRng(n * 7919 + 31337);
  const biome = getBiomeForStage(n);
  const isBoss = (n % 5 === 0);
  // Named honkers are rare encounters that players discover more as they progress
  // Early game (stages 1-20): 2-5% chance, Mid game (21-50): 8-12%, Late game (50+): 15%+
  rng(); rng(); // Burn entropy
  const rngRoll = rng();
  let dexThreshold;
  if (n <= 20) {
    dexThreshold = isBoss ? 0.05 : 0.02;  // Very rare early on
  } else if (n <= 50) {
    dexThreshold = isBoss ? 0.12 : 0.08;  // Moderate mid-game
  } else {
    dexThreshold = isBoss ? 0.20 : 0.15;  // More common late game
  }
  const useDex = rngRoll < dexThreshold;
  // DEBUG: show spawn determination
  console.log(`Stage ${n} | RNG: ${rngRoll.toFixed(3)} | Threshold: ${(dexThreshold*100).toFixed(0)}% | UseDex: ${useDex} | ${useDex ? '? RARE' : 'PROCEDURAL'}`);
  const dex    = useDex ? chooseDexForStage(n, isBoss, rng, biome) : null;
  if (dex) console.log(`  ? Named Honker: ${dex.name}`);
  const dexBlueprint = dex ? buildDexPartBlueprint(dex) : null;
  const types  = ['Fire','Ice','Lightning','Shadow','Normal'];
  let type   = dex ? (dexBlueprint?.derived?.type || dex.type) : (pickBiomeType(biome, rng, isBoss) || types[Math.floor(rng() * (isBoss ? 4 : 5))]);
  const earlyRamp = Math.min(1, n / 16);
  const earlyHpScale = n <= 15 ? (0.84 + earlyRamp * 0.16) : 1;
  const earlyPowScale = n <= 15 ? (0.72 + earlyRamp * 0.28) : 1;
  const earlyStatScale = n <= 15 ? (0.88 + earlyRamp * 0.12) : 1;

  // Name
  let enemyName;
  if (dex) {
    enemyName = dex.name;
  } else if (isBoss) {
    const p = E_PREFIXES[Math.floor(rng() * E_PREFIXES.length)];
    const b = E_BODIES[Math.floor(rng() * E_BODIES.length)];
    const s = E_BOSS_SUFFIXES[Math.floor(rng() * E_BOSS_SUFFIXES.length)];
    enemyName = `${p} ${b} ${s}`;
  } else {
    const p = E_PREFIXES[Math.floor(rng() * E_PREFIXES.length)];
    const b = E_BODIES[Math.floor(rng() * E_BODIES.length)];
    enemyName = `${p} ${b}`;
  }

  const arena = biome?.arenas?.[Math.floor(rng() * biome.arenas.length)] || STAGE_LOCATIONS[(n - 1) % STAGE_LOCATIONS.length];
  const location = `${biome?.name || 'Honklands'} â€“ ${arena}`;
  const loreRaw  = dex ? dex.lore : (biome?.lore?.[Math.floor(rng() * biome.lore.length)] || STAGE_LORE[Math.floor(rng() * STAGE_LORE.length)]);
  const lore     = dex ? `"${loreRaw}"` : `"${loreRaw.replace('{n}', n)}"`;

  const hpBase  = Math.round(100 + n * 19 + Math.pow(n, 1.35) * 1.8);
  const hpRaw   = isBoss ? Math.round(hpBase * 1.75) : hpBase;
  const hp      = Math.round(hpRaw * earlyHpScale);
  const luck    = Math.min(88, Math.round(25 + n * 2.2));
  const basePow = 26 + n * 3.2 + (isBoss ? 18 : 0);

  let moves;
  if (dexBlueprint?.derived?.moves?.length) {
    moves = dexBlueprint.derived.moves.map(m => ({ ...cloneJson(m), pp: m.maxPP || m.pp, maxPP: m.maxPP || m.pp }));
  } else {
    const pool    = MOVES_BY_TYPE[type] || MOVES_BY_TYPE.Normal;
    const nrmPool = MOVES_BY_TYPE.Normal;
    const usedIdx = new Set();
    const picked  = [];
    const pickFrom = (p, t) => {
      for (let tries = 0; tries < 20; tries++) {
        const idx = Math.floor(rng() * p.length);
        if (!usedIdx.has(`${t}-${idx}`)) { usedIdx.add(`${t}-${idx}`); return { ...p[idx], type: t }; }
      }
      return { ...p[0], type: t };
    };
    picked.push(pickFrom(pool, type));
    picked.push(pickFrom(pool, type));
    picked.push(pickFrom(pool, type));
    picked.push(isBoss ? pickFrom(pool, type) : pickFrom(nrmPool, 'Normal'));
    moves = picked.map(m => ({
      id: m.id,
      name: m.name, type: m.type, emoji: m.emoji, desc: m.desc,
      power: Math.max(20, Math.round((m.basePower || 55) * (basePow / 55) * earlyPowScale)),
      acc: m.acc, pp: m.pp, maxPP: m.pp,
      ...(m.effect ? { effect: m.effect, effectTarget: m.effectTarget,
        effectChance: m.effectChance, effectDur: m.effectDur } : {}),
      ...(m.drain ? { drain: m.drain } : {}),
      ...(m.recoil ? { recoil: m.recoil } : {}),
      ...(m.priority ? { priority: true } : {}),
      ...(m.lowHPOnly ? { lowHPOnly: true } : {}),
    }));
  }

  // Procedural stats for stages beyond dex range
  const rawAtk = dex ? (dex.atk||80) : Math.min(130, Math.round(60 + n * 1.8 + (isBoss ? 18 : 0) + (rng()-0.5)*20));
  const rawDef = dex ? (dex.def||80) : Math.min(130, Math.round(60 + n * 1.4 + (isBoss ? 15 : 0) + (rng()-0.5)*20));
  const rawSpd = dex ? (dex.spd||80) : Math.min(130, Math.round(60 + n * 1.2 + (rng()-0.5)*25));
  const genAtk = Math.max(30, Math.round(rawAtk * earlyStatScale));
  const genDef = Math.max(30, Math.round(rawDef * earlyStatScale));
  const genSpd = Math.max(30, Math.round(rawSpd * earlyStatScale));
  const emojiPool  = dex ? null : (isBoss ? BOSS_EMOJIS : (ENEMY_EMOJIS[type] || ENEMY_EMOJIS.Normal));
  const emoji      = dex ? dex.emoji : emojiPool[Math.floor(rng() * emojiPool.length)];
  const passive    = dex ? (dex.passive || dexBlueprint?.derived?.passive || null) : null;
  const enemyLevel = Math.max(1, Math.round(n * 0.18) + (isBoss ? 1 : 0) - (n <= 15 ? 1 : 0));
  const difficulty = isBoss ? 5 : Math.min(4, Math.ceil(n / 4));
  const xpReward   = xpRewardForEnemyLevel(enemyLevel, isBoss);

  // Procedural sprite fallback when not using a premade dex honker.
  let assembledParts = dexBlueprint?.assembledParts || null;
  if (!dex && PARTS_DATA && PARTS_DATA.parts) {
    const pickByRarityWeights = (pool) => {
      if (!pool.length) return null;
      const common = pool.filter(p => (p.rarity || 'common') === 'common');
      const rare = pool.filter(p => p.rarity === 'rare');
      const legendary = pool.filter(p => p.rarity === 'legendary');
      const r = rng();
      let bucket = null;
      if (r < 0.75) bucket = common.length ? common : (rare.length ? rare : legendary);
      else if (r < 0.95) bucket = rare.length ? rare : (common.length ? common : legendary);
      else bucket = legendary.length ? legendary : (rare.length ? rare : common);
      if (!bucket || !bucket.length) bucket = pool;
      return bucket[Math.floor(rng() * bucket.length)] || pool[0] || null;
    };
    const pickPart = slot => {
      const famSet = new Set(biome?.families || []);
      let pool = PARTS_DATA.parts.filter(p => p.slot === slot && famSet.has(p.family?.name));
      if (!pool.length) pool = PARTS_DATA.parts.filter(p => p.slot === slot);
      return pickByRarityWeights(pool);
    };
    assembledParts = {
      head:  pickPart('head'),
      torso: pickPart('torso'),
      wings: pickPart('wings'),
      legs:  pickPart('legs'),
    };
  }
  
  const enemyData = { name: enemyName, emoji, type, hp, luck, atk:genAtk, def:genDef, spd:genSpd,
                      moves, passive, dexId: dex?.id || null, assembledParts, level: enemyLevel };
  const hasNewParts = enemyHasUncaughtParts(enemyData);

  return { num: n, name: location, desc: lore, isBoss, difficulty, xpReward, hasNewParts,
    enemy: enemyData };
}

// "?"? POWER BALANCE DISPLAY "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
// Returns a rough numeric "threat level" for a stage used in the map UI
function stageThreat(n) { return Math.round(100 + n * 19 + Math.pow(n, 1.35) * 1.8); }
function playerPower(pb) {
  const hp = getHonkerMaxHP(pb);
  const atkBase = Math.round((pb.atk || 80) * levelStatScale(pb.level || 1, 'atk'));
  const atk = (pb.atkMult||1) * (atkBase + (pb.atkFlat||0));
  return Math.round(hp * 0.6 + atk * 2);
}

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  LOOT POOL
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
const CORE_LOOT_POOL = [
  { id:'hp_tonic',    name:'HP Tonic',       emoji:'*', rarity:'common',    color:'#aaaacc',
    desc:'Permanently increase <b>Max HP by +25</b>.',
    apply:(p)=>{ const prevMax=getHonkerMaxHP(p); const cur=(p.currentHP ?? prevMax); p.maxHPBonus=(p.maxHPBonus||0)+25; const mx=getHonkerMaxHP(p); p.currentHP=Math.min(mx, cur+25); }},
  { id:'lucky_clover',name:'Lucky Clover',   emoji:'*', rarity:'common',    color:'#aaaacc',
    desc:'Permanently increase <b>Luck by +8%</b>.',
    apply:(p)=>{ p.luckBonus=(p.luckBonus||0)+8; }},
  { id:'sharp_beak',  name:'Sharp Beak',     emoji:'*', rarity:'common',    color:'#aaaacc',
    desc:'All move power permanently <b>+8</b>.',
    apply:(p)=>{ p.atkFlat=(p.atkFlat||0)+8; }},
  { id:'pp_seed',     name:'PP Seed',        emoji:'*', rarity:'common',    color:'#aaaacc',
    desc:'Permanently increase all moves <b>max PP by +3</b>.',
    apply:(p)=>{ p.ppBonus=(p.ppBonus||0)+3; p.moves.forEach(m=>{ m.maxPP+=3; m.pp=m.maxPP; }); }},
  { id:'power_crystal',name:'Power Crystal', emoji:'*', rarity:'rare',      color:'#00c8ff',
    desc:'All move power permanently <b>+18</b>.',
    apply:(p)=>{ p.atkFlat=(p.atkFlat||0)+18; }},
  { id:'iron_feathers',name:'Iron Feathers', emoji:'*', rarity:'rare',      color:'#00c8ff',
    desc:'Permanently increase <b>Max HP by +50</b>.',
    apply:(p)=>{ const prevMax=getHonkerMaxHP(p); const cur=(p.currentHP ?? prevMax); p.maxHPBonus=(p.maxHPBonus||0)+50; const mx=getHonkerMaxHP(p); p.currentHP=Math.min(mx, cur+50); }},
  { id:'lucky_star',  name:'Lucky Star',     emoji:'*', rarity:'rare',      color:'#00c8ff',
    desc:'Permanently increase <b>Luck by +20%</b>.',
    apply:(p)=>{ p.luckBonus=(p.luckBonus||0)+20; }},
  { id:'stab_orb',    name:'STAB Orb',       emoji:'*', rarity:'rare',      color:'#00c8ff',
    desc:'Same-type attack bonus increases to <b>-1.5</b> (from -1.25).',
    apply:(p)=>{ p.stabBonus=1.5; }},
  { id:'extra_life',  name:'Phoenix Feather',emoji:'*', rarity:'legendary', color:'#ffd700', global:true,
    desc:'Gain <b>+1 extra retry</b> for this and all future battles.',
    apply:(p)=>{ CAMPAIGN.maxRetries=Math.min(CAMPAIGN.maxRetries+1,5); CAMPAIGN.retries=Math.min(CAMPAIGN.retries+1,CAMPAIGN.maxRetries); }},
  { id:'chaos_core',  name:'Chaos Core',     emoji:'*', rarity:'legendary', color:'#ffd700',
    desc:'All moves deal <b>-1.4 damage</b> but become random type.',
    apply:(p)=>{ p.chaosMod=1.4; }},
  { id:'ancient_honk',name:'Ancient Honk',   emoji:'*', rarity:'legendary', color:'#ffd700',
    desc:'All moves permanently <b>+25% damage</b>.',
    apply:(p)=>{ p.atkMult=(p.atkMult||1)*1.25; }},
  { id:'heal_flask',  name:'Heal Flask',     emoji:'*', rarity:'rare',      color:'#00c8ff',
    desc:'Immediately restore <b>60 HP</b> right now.',
    apply:(p)=>{ const mx=getHonkerMaxHP(p); const cur=(p.currentHP ?? mx); p.currentHP=Math.min(mx, cur+60); }},
];

const MOVE_TYPE_LOOT_COLOR = {
  Fire: '#ff4e00',
  Ice: '#00c8ff',
  Lightning: '#ffe600',
  Shadow: '#a020f0',
  Normal: '#ff9800',
};
function buildMoveLootItem(move) {
  if (!move?.isLootLearnable) return null;
  const moveType = move.type || (Array.isArray(move.types) && move.types[0]) || 'Normal';
  const rarity = move.lootRarity || (move.tier || 'common');
  return {
    id: move.lootId || `move_${move.id}`,
    name: move.lootName || `Learn: ${move.name}`,
    emoji: move.emoji || '*',
    rarity,
    color: move.lootColor || MOVE_TYPE_LOOT_COLOR[moveType] || '#aaaacc',
    desc: move.lootDesc || `Adds <b>${move.name}</b> (${moveType}) to your moveset.`,
    ...(Array.isArray(move.lootExclusiveTo) && move.lootExclusiveTo.length ? { exclusiveTo: move.lootExclusiveTo.slice() } : {}),
    moveId: move.id,
    apply:(p)=>{ addMoveById(p, move.id, { type: moveType, basePow: 55 }); },
  };
}
const MOVE_LEARN_LOOT_POOL = MOVE_POOL.map(buildMoveLootItem).filter(Boolean);
const LOOT_POOL = [...CORE_LOOT_POOL, ...MOVE_LEARN_LOOT_POOL];

// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
//  RANDOM EVENTS
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
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
    apply:(state)=>{ state.typeIgnored=true; state.typeIgnoredRounds=3; typeOverride=true; },
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
    apply:(state,bF)=>{ const f=bF[Math.floor(Math.random()*2)]; const m=f.moves[Math.floor(Math.random()*f.moves.length)]; m.power*=2; state.doubledMove={name:m.name,fighter:f.name}; },
    log:'Wild Card! A random move just got permanently doubled!' },
];

// BATTLE CONSTANTS
const LEVEL_GROWTH = { hp: 0.045, atk: 0.035, def: 0.035, spd: 0.03 };
const STACKABLE_EFFECTS = ['paralyzed', 'cursed', 'shielded', 'pumped'];

function levelStatScale(level, key) {
  const lv = Math.max(1, Number(level) || 1);
  const g = LEVEL_GROWTH[key] || 0;
  return 1 + g * (lv - 1);
}

function deriveHonkerFromParts(parts) {
  // Stub - needed by buildDexPartBlueprint, will be implemented in game.js
  return { type:'Normal', moves:[], passive:null };
}

function getHonkerMaxHP(h) {
  if (!h) return 0;
  const lv = Math.max(1, h.level || 1);
  const parts = h.assembledParts || null;
  const partHpBase = parts
    ? ['head', 'torso', 'wings', 'legs']
      .map(slot => Number(parts?.[slot]?.stats?.hp || 0))
      .reduce((a, b) => a + b, 0)
    : 0;
  const hpBase = Math.max(1, partHpBase || Number(h.hp || 0));
  const hpWithBonus = hpBase + Number(h.maxHPBonus || 0);
  const masteryMult = (typeof masteryStatMultiplier === 'function')
    ? masteryStatMultiplier(h.masteryLevel || 0)
    : 1;
  return Math.max(1, Math.floor((((2 * hpWithBonus * lv) / 100) + lv + 10) * masteryMult));
}

console.log('[DATA] Module loaded: PARTS_DATA, ROSTER, CAMPAIGN');




