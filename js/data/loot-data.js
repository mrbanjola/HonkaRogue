// ============================================================================
// HonkaRogue Loot Data (js/data/loot-data.js)
// Loot pool definitions, enrichment, move loot builder, and loading
// ============================================================================

const CORE_LOOT_DEFAULT_DEFS = [
  { id:'hp_tonic',       name:'HP Tonic',        emoji:'*', rarity:'common',    color:'#aaaacc', desc:'Permanently increase <b>HP by +3</b>.' },
  { id:'lucky_clover',   name:'Lucky Clover',    emoji:'*', rarity:'common',    color:'#aaaacc', desc:'Permanently increase <b>Luck by +8%</b>.' },
  { id:'sharp_beak',     name:'Sharp Beak',      emoji:'*', rarity:'common',    color:'#aaaacc', desc:'Permanently increase <b>ATK by +3</b>.' },
  { id:'pp_seed',        name:'PP Seed',         emoji:'*', rarity:'common',    color:'#aaaacc', desc:'Permanently increase all moves <b>max PP by +3</b>.' },
  { id:'power_crystal',  name:'Power Crystal',   emoji:'*', rarity:'rare',      color:'#00c8ff', desc:'Permanently increase <b>ATK by +6</b>.' },
  { id:'iron_feathers',  name:'Iron Feathers',   emoji:'*', rarity:'rare',      color:'#00c8ff', desc:'Permanently increase <b>HP by +6</b>.' },
  { id:'lucky_star',     name:'Lucky Star',      emoji:'*', rarity:'rare',      color:'#00c8ff', desc:'Permanently increase <b>Luck by +20%</b>.' },
  { id:'stab_orb',       name:'STAB Orb',        emoji:'*', rarity:'rare',      color:'#00c8ff', desc:'Same-type attack bonus increases to <b>1.5</b> (from 1.25).' },
  { id:'extra_life',     name:'Phoenix Feather', emoji:'*', rarity:'legendary', color:'#ffd700', desc:'Gain <b>+1 extra retry</b> for this and all future battles.', global:true },
  { id:'chaos_core',     name:'Chaos Core',      emoji:'*', rarity:'legendary', color:'#ffd700', desc:'All moves deal <b>1.4x damage</b> but become random type.' },
  { id:'ancient_honk',   name:'Ancient Honk',    emoji:'*', rarity:'legendary', color:'#ffd700', desc:'All moves permanently <b>+25% damage</b>.' },
  { id:'heal_flask',     name:'Heal Flask',      emoji:'*', rarity:'rare',      color:'#00c8ff', desc:'Immediately restore <b>60 HP</b> right now.' },
  { id:'mentor_whistle', name:'Mentor Whistle',  emoji:'*', rarity:'rare',      color:'#00c8ff', desc:'Party XP share bonus <b>+5%</b> for non-active honkers (stackable).', global:true },
];

const CORE_LOOT_APPLIERS = {
  hp_tonic: (p)=>{ p.hp=(p.hp||80)+3; const mx=getHonkerMaxHP(p); p.currentHP=Math.min(mx,(p.currentHP??mx)+3); },
  lucky_clover: (p)=>{ p.luckBonus=(p.luckBonus||0)+8; },
  sharp_beak: (p)=>{ p.atk=(p.atk||80)+3; },
  pp_seed: (p)=>{ p.ppBonus=(p.ppBonus||0)+3; (p.moves||[]).forEach(m=>{ m.maxPP+=3; m.pp=m.maxPP; }); },
  power_crystal: (p)=>{ p.atk=(p.atk||80)+6; },
  iron_feathers: (p)=>{ p.hp=(p.hp||80)+6; const mx=getHonkerMaxHP(p); p.currentHP=Math.min(mx,(p.currentHP??mx)+6); },
  lucky_star: (p)=>{ p.luckBonus=(p.luckBonus||0)+20; },
  stab_orb: (p)=>{ p.stabBonus=1.5; },
  extra_life: ()=>{ CAMPAIGN.maxRetries=Math.min(CAMPAIGN.maxRetries+1,5); CAMPAIGN.retries=Math.min(CAMPAIGN.retries+1,CAMPAIGN.maxRetries); },
  chaos_core: (p)=>{ p.chaosMod=1.4; },
  ancient_honk: (p)=>{ p.atkMult=(p.atkMult||1)*1.25; },
  heal_flask: (p)=>{ const mx=getHonkerMaxHP(p); const cur=(p.currentHP ?? mx); p.currentHP=Math.min(mx, cur+60); },
  mentor_whistle: ()=>{},
};

function enrichCoreLootItems(defs) {
  return defs.map(d => ({ ...d, apply: CORE_LOOT_APPLIERS[d.id] || (()=>{}) }));
}

let CORE_LOOT_POOL = enrichCoreLootItems(CORE_LOOT_DEFAULT_DEFS);

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
    apply:(p)=>{ addMoveById(p, move.id); },
  };
}
let MOVE_LEARN_LOOT_POOL = [];
let LOOT_POOL = [...CORE_LOOT_POOL];

async function loadLootData() {
  const urls = ['/api/loot-pool', 'data/loot_pool.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const defs = Array.isArray(data) ? data : (data.items || []);
      if (!Array.isArray(defs) || !defs.length) continue;
      CORE_LOOT_POOL = enrichCoreLootItems(defs);
      LOOT_POOL = [...CORE_LOOT_POOL, ...MOVE_LEARN_LOOT_POOL];
      console.log('[LOOT-DATA] Loot loaded:', CORE_LOOT_POOL.length);
      return true;
    } catch (_) {}
  }
  console.warn('[LOOT-DATA] loadLootData: failed to load from all sources; using defaults');
  return false;
}

console.log('[LOOT-DATA] Module loaded');
