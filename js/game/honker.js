// ============================================================================
// HonkaRogue Honker Class (js/game/honker.js)
// Honker class, HP calculation, mastery multipliers
// ============================================================================

function getHonkerMaxHP(h) {
  if (!h) return 0;
  const lv = Math.max(1, h.level || 1);
  const partHpBase = (h.assembledParts && typeof h.assembledParts === 'object')
    ? ['head', 'torso', 'wings', 'legs']
        .map(slot => Number(h.assembledParts?.[slot]?.stats?.hp || 0))
        .reduce((a, b) => a + b, 0)
    : 0;
  const hpStatBase = Number(h.hp || 0);
  const hpBase = Math.max(1, hpStatBase > 0 ? hpStatBase : partHpBase);
  const hpWithBonus = hpBase + Number(h.maxHPBonus || 0);
  const masteryMult = masteryStatMultiplier(h.masteryLevel || 0);
  return Math.max(1, Math.floor(hpWithBonus * levelStatScale(lv) * masteryMult));
}

function masteryStatMultiplier(level) {
  const lv = Math.max(0, Number(level) || 0);
  return 1 + (lv * 0.05);
}
function masteryAttackMultiplier(level) {
  return masteryStatMultiplier(level);
}

class Honker {
  constructor(data, side, campBoosts={}) {
    Object.assign(this, JSON.parse(JSON.stringify(data)));
    if (typeof normalizePassiveRef === 'function') normalizePassiveRef(this);
    this.side = side;
    this.maxHPBonus = campBoosts.maxHPBonus||0;
    this.atkFlat    = campBoosts.atkFlat||0;
    this.atkMult    = campBoosts.atkMult||1;
    this.luckBonus  = campBoosts.luckBonus||0;
    this.stabBonus  = campBoosts.stabBonus||1.25;
    this.chaosMod   = campBoosts.chaosMod||1;
    this.ppBonus    = campBoosts.ppBonus||0;
    this.level      = campBoosts.level ?? this.level ?? 1;
    this.movePP     = campBoosts.movePP||null;
    this.persistentEffects = campBoosts.persistentEffects || null;
    this.masteryLevel = Math.max(0, Number(this.masteryLevel) || 0);
    this.statusEffects = {};
    this.moves.forEach(m=>{
      m.maxPP += this.ppBonus;
      const saved = this.movePP ? (this.movePP[m.id] ?? this.movePP[m.name]) : null;
      m.pp = saved == null ? m.maxPP : Math.max(0, Math.min(m.maxPP, saved));
    });
    const masteryMult = masteryStatMultiplier(this.masteryLevel);
    this.maxHP = getHonkerMaxHP(this);
    this.currentHP = Math.max(0, Math.min(this.maxHP, campBoosts.currentHP ?? this.maxHP));
    if (this.persistentEffects) {
      STACKABLE_EFFECTS.forEach(k => {
        const v = this.persistentEffects[k] || 0;
        if (v > 0) this.statusEffects[k] = Math.max(1, Math.min(4, v));
      });
    }
    const statScale = levelStatScale(this.level) * masteryMult;
    this.atk = Math.max(1, Math.round((this.atk || 80) * statScale));
    this.def = Math.max(1, Math.round((this.def || 80) * statScale));
    this.spd = Math.max(1, Math.round((this.spd || 80) * statScale));
    // Boss shield — separate HP pool that absorbs damage first
    const shieldPct = Number(this.shieldPct) || 0;
    this.shieldMax = shieldPct > 0 ? Math.max(1, Math.round(this.maxHP * shieldPct)) : 0;
    this.shieldHP  = this.shieldMax;
  }
  get hpPct() { return Math.max(0, this.currentHP/this.maxHP); }
  isDead() { return this.currentHP<=0; }
  get effectiveLuck() {
    const baseLuck = (this.luck||50)+(this.luckBonus||0);
    return Math.min(95, Math.round(baseLuck * masteryStatMultiplier(this.masteryLevel)));
  }
  get atkModifier() {
    let m = 1;
    if (this.statusEffects.cursed)  m *= Math.max(0.25, 1 - (0.15 * this.statusEffects.cursed));
    if (this.statusEffects.pumped)  m *= (1 + (0.25 * this.statusEffects.pumped));
    const ctx = { self: this, mult: m };
    if (typeof runPassiveHook === 'function') runPassiveHook(this, 'modifyAttack', ctx);
    m = ctx.mult;
    return m;
  }
  get defModifier() {
    let m = 1;
    if (this.statusEffects.shielded) m *= (1 / (1 + (0.25 * this.statusEffects.shielded)));
    if (this.statusEffects.exposed) m *= (1 + 0.2 * this.statusEffects.exposed);
    return m;
  }
  get accModifier() {
    let m = 1;
    if (this.statusEffects.paralyzed) m *= Math.max(0.3, 1 - (0.12 * this.statusEffects.paralyzed));
    return m;
  }
  aiPickMove(enemy) {
    const avail = this.moves.filter(m=>m.pp>0 && !(m.lowHPOnly && this.hpPct >= 0.5));
    if (!avail.length) return this.moves[0];
    const self = this;
    const scoreMove = (m) => {
      if (m.inflictStatus) {
        const already = enemy.statusEffects[m.inflictStatus.type];
        let s = already ? 5 : 50;
        s *= (m.inflictStatus.chance / 100);
        return s;
      }
      if (m.applyBuff) {
        const target = m.applyBuff.target === 'self' ? self : enemy;
        const already = target.statusEffects[m.applyBuff.type];
        let s = already >= 4 ? 5 : 45;
        if (m.applyBuff.target === 'self' && self.hpPct < 0.4) s *= 1.5;
        return s;
      }
      let s = m.power * (m.acc/100) * getEff(m.type, enemy.type, enemy.type2) * (0.7 + (BS.rng?.() ?? Math.random())*.6) * self.atkModifier;
      if (m.secondaryEffect?.type === 'drain') s *= 1.2;
      if (m.secondaryEffect?.type === 'recoil') s *= 0.85;
      return s;
    };
    let best = avail[0];
    let bestScore = scoreMove(best);
    for (let i = 1; i < avail.length; i++) {
      const s = scoreMove(avail[i]);
      if (s > bestScore) { best = avail[i]; bestScore = s; }
    }
    return best;
  }
}

console.log('[HONKER] Module loaded');
