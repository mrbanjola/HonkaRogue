// ============================================================================
// HonkaRogue Dex Data (js/data/dex-data.js)
// HONKER_DEX, DEX_PARTS_OVERRIDES, dex computation, and loading
// ============================================================================

let HONKER_DEX = [
  {
    "dexNum": 1,
    "id": "gerald",
    "name": "Gerald",
    "emoji": "*",
    "type": "Normal",
    "atk": 50,
    "def": 55,
    "spd": 55,
    "lore": "Just a goose. No lore. He does his best.",
    "passive": null
  },
  {
    "dexNum": 2,
    "id": "embertail",
    "name": "Embertail",
    "emoji": "*",
    "type": "Fire",
    "atk": 80,
    "def": 65,
    "spd": 75,
    "lore": "Born in a volcanic crater. Always slightly on fire.",
    "passive": {
      "id": "heat_proof",
      "emoji": "*",
      "name": "Heat Proof",
      "desc": "Immune to Burn."
    }
  },
  {
    "dexNum": 3,
    "id": "frosting",
    "name": "Frosting",
    "emoji": "*",
    "type": "Ice",
    "atk": 62,
    "def": 95,
    "spd": 70,
    "lore": "Named after the dessert. Extremely dangerous.",
    "passive": {
      "id": "frost_armor",
      "emoji": "*",
      "name": "Frost Armor",
      "desc": "Takes 25% less Ice damage."
    }
  },
  {
    "dexNum": 4,
    "id": "zappington",
    "name": "Zappington",
    "emoji": "*",
    "type": "Lightning",
    "atk": 75,
    "def": 55,
    "spd": 110,
    "lore": "Has never been in the same room as a microwave.",
    "passive": {
      "id": "static_skin",
      "emoji": "*",
      "name": "Static Skin",
      "desc": "30% chance to Paralyze attackers."
    }
  },
  {
    "dexNum": 5,
    "id": "voidwing",
    "name": "Voidwing",
    "emoji": "*",
    "type": "Shadow",
    "atk": 90,
    "def": 80,
    "spd": 75,
    "lore": "Gazes into you. Does not blink. Has no eyelids.",
    "passive": {
      "id": "cursed_aura",
      "emoji": "*",
      "name": "Cursed Aura",
      "desc": "Enemy starts battle Cursed."
    },
    "isBoss": true
  },
  {
    "dexNum": 6,
    "id": "kevin",
    "name": "Kevin",
    "emoji": "*",
    "type": "Normal",
    "atk": 115,
    "def": 60,
    "spd": 70,
    "lore": "Suspiciously strong for a Kevin.",
    "passive": {
      "id": "underdog",
      "emoji": "*",
      "name": "Underdog",
      "desc": "+30% ATK when below 50% HP."
    }
  },
  {
    "dexNum": 7,
    "id": "scorchwick",
    "name": "Scorchwick",
    "emoji": "*",
    "type": "Fire",
    "atk": 100,
    "def": 60,
    "spd": 85,
    "lore": "Breathes fire. Also talks about breathing fire constantly.",
    "passive": {
      "id": "type_mastery",
      "emoji": "*",
      "name": "Type Mastery",
      "desc": "STAB bonus is -1.5 instead of -1.25."
    }
  },
  {
    "dexNum": 8,
    "id": "brrrbeak",
    "name": "Brrrbeak",
    "emoji": "*",
    "type": "Ice",
    "atk": 65,
    "def": 105,
    "spd": 58,
    "lore": "Makes a brrrr sound. Not from the cold. Just vibes.",
    "passive": {
      "id": "resilient",
      "emoji": "*",
      "name": "Resilient",
      "desc": "Immune to Paralysis."
    }
  },
  {
    "dexNum": 9,
    "id": "thunderbeak",
    "name": "Thunderbeak",
    "emoji": "*",
    "type": "Lightning",
    "atk": 80,
    "def": 60,
    "spd": 105,
    "lore": "His beak is a lightning rod. He is fine with this.",
    "passive": {
      "id": "thick_skin",
      "emoji": "*",
      "name": "Thick Skin",
      "desc": "Takes 20% less damage from all sources."
    }
  },
  {
    "dexNum": 10,
    "id": "magnaroo",
    "name": "Magnaroo Rex",
    "emoji": "*",
    "type": "Fire",
    "atk": 110,
    "def": 85,
    "spd": 72,
    "lore": "The lava cools when he arrives. Out of respect.",
    "passive": {
      "id": "heat_proof",
      "emoji": "*",
      "name": "Heat Proof",
      "desc": "Immune to Burn."
    },
    "isBoss": true
  },
  {
    "dexNum": 11,
    "id": "capthonk",
    "name": "Captain Honk",
    "emoji": "*",
    "type": "Normal",
    "atk": 78,
    "def": 85,
    "spd": 80,
    "lore": "Decorated veteran of the First Honk War.",
    "passive": {
      "id": "shield_wall",
      "emoji": "*",
      "name": "Shield Wall",
      "desc": "Enters battle Shielded for 1 round."
    }
  },
  {
    "dexNum": 12,
    "id": "glaciergus",
    "name": "Glacier Gus",
    "emoji": "*",
    "type": "Ice",
    "atk": 60,
    "def": 125,
    "spd": 38,
    "lore": "Very slow. Very wide. Immovable object energy.",
    "passive": {
      "id": "regeneration",
      "emoji": "*",
      "name": "Regeneration",
      "desc": "Heals 6% max HP at the start of each round."
    }
  },
  {
    "dexNum": 13,
    "id": "gloomfeather",
    "name": "Gloomfeather",
    "emoji": "*",
    "type": "Shadow",
    "atk": 90,
    "def": 65,
    "spd": 85,
    "lore": "Brings a noticeable chill to every room.",
    "passive": {
      "id": "cursed_aura",
      "emoji": "*",
      "name": "Cursed Aura",
      "desc": "Enemy starts battle Cursed."
    }
  },
  {
    "dexNum": 14,
    "id": "staticlina",
    "name": "Staticlina",
    "emoji": "*",
    "type": "Lightning",
    "atk": 78,
    "def": 60,
    "spd": 108,
    "lore": "Her feathers are frizzled. Has always been this way.",
    "passive": {
      "id": "static_skin",
      "emoji": "*",
      "name": "Static Skin",
      "desc": "30% chance to Paralyze attackers."
    }
  },
  {
    "dexNum": 15,
    "id": "crystalwing",
    "name": "Crystalwing Prime",
    "emoji": "*",
    "type": "Ice",
    "atk": 85,
    "def": 112,
    "spd": 62,
    "lore": "Carved from a single glacier. Hates room temperature.",
    "passive": {
      "id": "frost_armor",
      "emoji": "*",
      "name": "Frost Armor",
      "desc": "Takes 25% less Ice damage."
    },
    "isBoss": true
  },
  {
    "dexNum": 16,
    "id": "sirquacks",
    "name": "Sir Quacks-a-Lot",
    "emoji": "*",
    "type": "Normal",
    "atk": 80,
    "def": 80,
    "spd": 80,
    "lore": "Knighted for services to honking. No further questions.",
    "passive": {
      "id": "underdog",
      "emoji": "*",
      "name": "Underdog",
      "desc": "+30% ATK when below 50% HP."
    }
  },
  {
    "dexNum": 17,
    "id": "dreadquack",
    "name": "Dreadquack",
    "emoji": "*",
    "type": "Shadow",
    "atk": 95,
    "def": 90,
    "spd": 68,
    "lore": "Arrived without invitation. Left without explanation.",
    "passive": {
      "id": "thick_skin",
      "emoji": "*",
      "name": "Thick Skin",
      "desc": "Takes 20% less damage from all sources."
    }
  },
  {
    "dexNum": 18,
    "id": "pyrocluck",
    "name": "Pyrocluck",
    "emoji": "*",
    "type": "Fire",
    "atk": 112,
    "def": 55,
    "spd": 90,
    "lore": "Spontaneously combusted once. Liked it.",
    "passive": {
      "id": "type_mastery",
      "emoji": "*",
      "name": "Type Mastery",
      "desc": "STAB bonus is -1.5 instead of -1.25."
    }
  },
  {
    "dexNum": 19,
    "id": "voltmare",
    "name": "Voltmare",
    "emoji": "*",
    "type": "Lightning",
    "atk": 85,
    "def": 58,
    "spd": 122,
    "lore": "Nightmare horse energy. Lightning bird body.",
    "passive": {
      "id": "resilient",
      "emoji": "*",
      "name": "Resilient",
      "desc": "Immune to Paralysis."
    }
  },
  {
    "dexNum": 20,
    "id": "eclipsar",
    "name": "Eclipsar Omega",
    "emoji": "*",
    "type": "Shadow",
    "atk": 102,
    "def": 90,
    "spd": 78,
    "lore": "Blocked out the sun. Filed the necessary paperwork.",
    "passive": {
      "id": "cursed_aura",
      "emoji": "*",
      "name": "Cursed Aura",
      "desc": "Enemy starts battle Cursed."
    },
    "isBoss": true
  },
  {
    "dexNum": 21,
    "id": "profwaddle",
    "name": "Professor Waddle",
    "emoji": "*",
    "type": "Normal",
    "atk": 65,
    "def": 85,
    "spd": 62,
    "lore": "Has a PhD. In honking. From an accredited institution.",
    "passive": {
      "id": "regeneration",
      "emoji": "*",
      "name": "Regeneration",
      "desc": "Heals 6% max HP at the start of each round."
    }
  },
  {
    "dexNum": 22,
    "id": "cinderquill",
    "name": "Cinderquill",
    "emoji": "*",
    "type": "Fire",
    "atk": 98,
    "def": 68,
    "spd": 82,
    "lore": "Sheds smoldering feathers. They sell well.",
    "passive": {
      "id": "heat_proof",
      "emoji": "*",
      "name": "Heat Proof",
      "desc": "Immune to Burn."
    }
  },
  {
    "dexNum": 23,
    "id": "snowquack",
    "name": "Snowquack",
    "emoji": "*",
    "type": "Ice",
    "atk": 68,
    "def": 102,
    "spd": 62,
    "lore": "Emerged from a blizzard. Has not fully melted.",
    "passive": {
      "id": "shield_wall",
      "emoji": "*",
      "name": "Shield Wall",
      "desc": "Enters battle Shielded for 1 round."
    }
  },
  {
    "dexNum": 24,
    "id": "boltclaw",
    "name": "Boltclaw",
    "emoji": "*",
    "type": "Lightning",
    "atk": 90,
    "def": 65,
    "spd": 115,
    "lore": "Claws conduct electricity. Very gentle hugs.",
    "passive": {
      "id": "type_mastery",
      "emoji": "*",
      "name": "Type Mastery",
      "desc": "STAB bonus is -1.5 instead of -1.25."
    }
  },
  {
    "dexNum": 25,
    "id": "regularbarry",
    "name": "Regular Barry",
    "emoji": "*",
    "type": "Normal",
    "atk": 122,
    "def": 65,
    "spd": 68,
    "lore": "\"I am just a regular Barry.\"  -  Barry, who is not regular.",
    "passive": {
      "id": "underdog",
      "emoji": "*",
      "name": "Underdog",
      "desc": "+30% ATK when below 50% HP."
    },
    "isBoss": true
  },
  {
    "dexNum": 26,
    "id": "hexdown",
    "name": "Hexdown",
    "emoji": "Y,",
    "type": "Shadow",
    "atk": 85,
    "def": 85,
    "spd": 75,
    "lore": "Carries a grudge and several curses. Available for parties.",
    "passive": {
      "id": "thick_skin",
      "emoji": "*",
      "name": "Thick Skin",
      "desc": "Takes 20% less damage from all sources."
    }
  },
  {
    "dexNum": 27,
    "id": "blazefowl",
    "name": "Blazefowl",
    "emoji": "*",
    "type": "Fire",
    "atk": 108,
    "def": 70,
    "spd": 85,
    "lore": "Historically mistaken for a roast dinner. Does not appreciate it.",
    "passive": {
      "id": "regeneration",
      "emoji": "*",
      "name": "Regeneration",
      "desc": "Heals 6% max HP at the start of each round."
    }
  },
  {
    "dexNum": 28,
    "id": "arcticclyde",
    "name": "Arctic Clyde",
    "emoji": "*",
    "type": "Ice",
    "atk": 70,
    "def": 112,
    "spd": 48,
    "lore": "From the Northern Reaches. Doesn't talk about the Northern Reaches.",
    "passive": {
      "id": "resilient",
      "emoji": "*",
      "name": "Resilient",
      "desc": "Immune to Paralysis."
    }
  },
  {
    "dexNum": 29,
    "id": "sparksworth",
    "name": "Sparksworth",
    "emoji": "*",
    "type": "Lightning",
    "atk": 88,
    "def": 62,
    "spd": 118,
    "lore": "Delicate appearance. Devastating voltage. Wears a monocle.",
    "passive": {
      "id": "static_skin",
      "emoji": "*",
      "name": "Static Skin",
      "desc": "30% chance to Paralyze attackers."
    }
  },
  {
    "dexNum": 30,
    "id": "thewraith",
    "name": "The Wraith Ascendant",
    "emoji": "*",
    "type": "Shadow",
    "atk": 118,
    "def": 95,
    "spd": 85,
    "lore": "The end of the known dex. And yet the stages continue.",
    "passive": {
      "id": "cursed_aura",
      "emoji": "*",
      "name": "Cursed Aura",
      "desc": "Enemy starts battle Cursed."
    },
    "isBoss": true
  }
];

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

function pickDexPartForSlot(dex, slot) {
  const all = (PARTS_DATA?.parts || []).filter(p => p.slot === slot && !isPartUnique(p));
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
initDexPartIds();

async function loadHonkDexData() {
  const urls = ['/api/honkedex', 'data/honkedex.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      if (!Array.isArray(items) || !items.length) continue;
      HONKER_DEX = items;
      if (typeof initDexPartIds === 'function') initDexPartIds();
      console.log('[DEX-DATA] Honkedex loaded:', HONKER_DEX.length);
      return true;
    } catch (_) {}
  }
  console.warn('[DEX-DATA] loadHonkDexData: failed to load from all sources');
  return false;
}

console.log('[DEX-DATA] Module loaded');
