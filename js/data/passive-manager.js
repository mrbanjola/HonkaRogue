// ============================================================================
// HonkaRogue Passive Manager
// Passive metadata loading, normalization, and hook dispatch
// ============================================================================

let PASSIVE_DB = {};

const PASSIVE_HOOKS = {
  underdog: {
    modifyAttack(ctx) {
      if (ctx?.self?.hpPct < 0.5) ctx.mult *= 1.3;
    },
  },
  thick_skin: {
    modifyIncomingDamage(ctx) {
      ctx.mult *= 0.8;
    },
  },
  frost_armor: {
    modifyIncomingDamage(ctx) {
      if (ctx.mType === 'Ice') ctx.mult *= 0.75;
    },
  },
  resilient: {
    onApplyStatus(ctx) {
      if (ctx.effect === 'paralyzed') {
        ctx.cancel = true;
        ctx.message = `🛡️ <b>${ctx.target.name}</b>'s Resilient passive blocks paralysis!`;
      }
    },
  },
  heat_proof: {
    onApplyStatus(ctx) {
      if (ctx.effect === 'burn') {
        ctx.cancel = true;
        ctx.message = `🔥 <b>${ctx.target.name}</b>'s Heat Proof passive blocks burn!`;
      }
    },
    onTurnStart(ctx) {
      if (ctx.self?.statusEffects?.burn) {
        delete ctx.self.statusEffects.burn;
        if (typeof refreshStatusBadges === 'function') refreshStatusBadges(ctx.self);
      }
    },
  },
  regeneration: {
    onTurnStart(ctx) {
      const self = ctx.self;
      if (!self || self.currentHP >= self.maxHP) return;
      const heal = Math.max(3, Math.round(self.maxHP * 0.06));
      self.currentHP = Math.min(self.maxHP, self.currentHP + heal);
      if (typeof updateHP === 'function') updateHP(self, self.side);
      if (typeof log === 'function') log('n', `🌱 <b>${self.name}</b> regenerates <span style="color:#00ff88">${heal} HP</span>!`);
    },
  },
  cursed_aura: {
    onBattleStart(ctx) {
      const foe = ctx.opponent;
      if (!foe) return;
      foe.statusEffects.cursed = Math.max(foe.statusEffects.cursed || 0, 2);
      if (typeof refreshStatusBadges === 'function') refreshStatusBadges(foe);
    },
  },
  shield_wall: {
    onBattleStart(ctx) {
      const self = ctx.self;
      if (!self) return;
      self.statusEffects.shielded = Math.max(1, Math.min(4, (self.statusEffects.shielded || 0) + 1));
      if (typeof refreshStatusBadges === 'function') refreshStatusBadges(self);
    },
  },
  static_skin: {
    onAfterDamaged(ctx) {
      const self = ctx.self;
      const attacker = ctx.attacker;
      if (!self || !attacker || ctx.damageDealt <= 0 || attacker.statusEffects?.paralyzed) return;
      if ((ctx.rng?.() ?? Math.random()) < 0.3) {
        applyStatusEffect(attacker, 'paralyzed', 2);
        if (typeof log === 'function') log('ev', `⚡ ${self.name}'s Static Skin zaps ${attacker.name}!`);
        if (typeof spawnPtcl === 'function') spawnPtcl(attacker.side, '#ffe600', '⚡');
      }
    },
  },
  type_mastery: {
    modifyStab(ctx) {
      if (ctx.isStab) ctx.stab = Math.max(ctx.stab, 1.5);
    },
  },
};

function clonePassiveMeta(passive) {
  return passive ? JSON.parse(JSON.stringify(passive)) : null;
}

function rebuildPassiveDb(items) {
  PASSIVE_DB = {};
  (items || []).forEach(passive => {
    if (!passive?.id) return;
    PASSIVE_DB[passive.id] = clonePassiveMeta(passive);
  });
}

function getPassiveMetaById(passiveId) {
  if (!passiveId) return null;
  return clonePassiveMeta(PASSIVE_DB[passiveId] || null);
}

function getPassiveId(target) {
  return target?.passiveId || target?.passive?.id || null;
}

function setPassiveRef(target, passiveId) {
  if (!target) return null;
  if (!passiveId) {
    delete target.passiveId;
    target.passive = null;
    return null;
  }
  target.passiveId = passiveId;
  target.passive = getPassiveMetaById(passiveId) || target.passive || { id: passiveId };
  return target.passive;
}

function normalizePassiveRef(target) {
  if (!target || typeof target !== 'object') return target;
  return setPassiveRef(target, getPassiveId(target));
}

function normalizePassiveList(list) {
  (list || []).forEach(normalizePassiveRef);
}

function runPassiveHook(target, hookName, ctx = {}) {
  const passiveId = getPassiveId(target);
  const hook = passiveId ? PASSIVE_HOOKS[passiveId]?.[hookName] : null;
  if (typeof hook !== 'function') return ctx;
  hook({ ...ctx, passiveId, passive: getPassiveMetaById(passiveId), self: ctx.self || target });
  return ctx;
}

function normalizeGlobalPassiveRefs() {
  normalizePassiveList(ROSTER);
  normalizePassiveList(HONKER_DEX);
  if (typeof PART_PASSIVES !== 'undefined' && PART_PASSIVES) normalizePassiveList(Object.values(PART_PASSIVES));
}

async function loadPassivesData() {
  const urls = ['/data/passives.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      if (!Array.isArray(items) || !items.length) continue;
      rebuildPassiveDb(items);
      normalizeGlobalPassiveRefs();
      console.log('[PASSIVE-MANAGER] Passives loaded:', items.length);
      return true;
    } catch (_) {}
  }
  console.warn('[PASSIVE-MANAGER] Failed to load passives data');
  rebuildPassiveDb([]);
  normalizeGlobalPassiveRefs();
  return false;
}

console.log('[PASSIVE-MANAGER] Module loaded');
