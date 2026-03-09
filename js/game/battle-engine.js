// ============================================================================
// HonkaRogue Battle Engine Module (battle/engine.js)
// Turn execution, status logic, and damage resolution
// ============================================================================

const OPENERS=['With blazing resolve,','Eyes locked in fury,','Without warning,',
  'Channeling pure rage,','Sensing an opening,','Drawing on hidden power,',
  'In a burst of energy,','Calculating coldly,','With a battle cry,','Seizing the moment,'];
const MISSES=['But the attack whiffs!','But it sails past!','But the target sidesteps!',
  'But fate denies the strike!','But the blow goes wide!','But the honk misses entirely!'];

function resolveMoveFxType(move) {
  const raw = String(move?.animationType || '').trim().toLowerCase();
  if (raw === 'nova') return 'nova';
  if (raw === 'reverse nova') return 'reverse_nova';
  if (raw === 'projectile') return 'projectile';
  if (raw === 'beam') return 'beam';
  if (raw === 'drain') return 'drain';
  return 'hit';
}

function p1UsesMove(idx) {
  if(BS.bDead||BS.bPhase!=='p1') return;
  const move=BS.bFighters[0].moves[idx];
  if(!move||move.pp<=0) return;

  // lowHPOnly signature moves
  if (move.lowHPOnly && BS.bFighters[0].hpPct >= 0.5) {
    log('ms', `⚠ <b>${BS.bFighters[0].name}</b> isn't desperate enough! ${move.name} won't work above 50% HP.`);
    return;
  }

  BS.bPhase='busy';
  BS.bRound++;
  document.getElementById('round-badge').textContent=`ROUND ${BS.bRound}`;
  log('r',`━━━━ ROUND ${BS.bRound} ━━━━`);
  maybeFireEvent();
  renderMovePanel();

  // Speed-based turn order: priority moves always go first.
  // Otherwise: enemy needs a clearer speed edge to strike first.
  const playerSpd = BS.bFighters[0].spd || 80;
  const enemySpd  = BS.bFighters[1].spd || 80;
  const playerPriority = !!move.priority;
  const enemyGoesFirst = !playerPriority && (enemySpd - playerSpd > 16);

  if (enemyGoesFirst) {
    log('ev', `⚡ <b>${BS.bFighters[1].name}</b> is faster and strikes first! (SPD ${enemySpd} vs ${playerSpd})`);
    BS.bPhase='p2'; renderMovePanel();
    const aiMove = BS.bFighters[1].aiPickMove(BS.bFighters[0]);
    BS.bPhase='busy';
    doMove(BS.bFighters[1], BS.bFighters[0], aiMove, ()=>{
      if(BS.bDead) return;
      doMove(BS.bFighters[0], BS.bFighters[1], move, ()=>{
        if(BS.bDead) return;
        tickEventState();
        BS.bPhase='p1'; renderMovePanel(); updateCatchButton();
      });
    });
  } else {
    if (playerPriority) log('ev', `⚡ <b>${BS.bFighters[0].name}</b> uses ${move.emoji} ${move.name} • priority move strikes first!`);
    doMove(BS.bFighters[0], BS.bFighters[1], move, ()=>{
      if(BS.bDead) return;
      BS.bPhase='p2'; renderMovePanel(); updateCatchButton();
      setTimeout(()=>{
        if(BS.bDead) return;
        const aiMove=BS.bFighters[1].aiPickMove(BS.bFighters[0]);
        BS.bPhase='busy';
        doMove(BS.bFighters[1], BS.bFighters[0], aiMove, ()=>{
          if(BS.bDead) return;
          tickEventState();
          BS.bPhase='p1'; renderMovePanel(); updateCatchButton();
        });
      }, BS.bAutoOn?600:880);
    });
  }
}

function autoStep() {
  if(BS.bDead) return;
  const atk=BS.bFighters[BS.bAutoTurn%2], def=BS.bFighters[(BS.bAutoTurn+1)%2];
  if(BS.bAutoTurn%2===0){
    BS.bRound++;
    document.getElementById('round-badge').textContent=`ROUND ${BS.bRound}`;
    log('r',`━━━━ ROUND ${BS.bRound} ━━━━`);
    maybeFireEvent();
  }
  BS.bAutoTurn++;
  const move=atk.aiPickMove(def);
  doMove(atk, def, move, ()=>{
    if(BS.bAutoTurn%2===0) tickEventState();
  });
}

const STATUS_META = {
  burn:      { emoji:'🔥', color:'#ff4e00', label:'BURN'    },
  frozen:    { emoji:'❄️', color:'#00c8ff', label:'FROZEN'  },
  paralyzed: { emoji:'⚡', color:'#ffe600', label:'PARA'    },
  cursed:    { emoji:'🌑', color:'#a020f0', label:'CURSE'   },
  shielded:  { emoji:'🛡️', color:'#00ff88', label:'SHIELD'  },
  pumped:    { emoji:'💪', color:'#ff9800', label:'PUMPED'  },
  exposed:   { emoji:'🔓', color:'#ff4444', label:'EXPOSED' },
};
const STATUS_DURATIONS = { burn: 3, frozen: 3, paralyzed: 2 };

const TYPE_ICON = {
  Fire: '🔥',
  Ice: '❄️',
  Lightning: '⚡',
  Shadow: '🌑',
  Normal: '🦆',
};

function restoreEmojiIcons() {
  const specials = {
    kevin: '🐓', // rooster
  };
  const passiveIcon = {
    heat_proof: TYPE_ICON.Fire,
    frost_armor: TYPE_ICON.Ice,
    static_skin: TYPE_ICON.Lightning,
    cursed_aura: TYPE_ICON.Shadow,
    thick_skin: '🛡️',
    underdog: '💪',
    regeneration: '🪴',
    shield_wall: '🛡️',
    type_mastery: '✨',
    resilient: '🧱',
  };
  const statusIcon = {
    burn: TYPE_ICON.Fire,
    frozen: TYPE_ICON.Ice,
    paralyzed: TYPE_ICON.Lightning,
    cursed: TYPE_ICON.Shadow,
    shielded: '🛡️',
    pumped: '💪',
  };
  const itemIcon = {
    hp_tonic: '❤️',
    lucky_clover: '🍀',
    sharp_beak: '🐦',
    pp_seed: '🌱',
    power_crystal: '💎',
    iron_feathers: '🛡️',
    lucky_star: '⭐',
    stab_orb: '✨',
    extra_life: '🪶',
    chaos_core: '🌀',
    ancient_honk: '📜',
    heal_flask: '🧪',
  };
  const badEmoji = (v) => !v || v === '*' || (/^[A-Za-z0-9 ?._'":-]{1,4}$/.test(v));
  const fix = (obj, fallback) => {
    if (!obj || typeof obj !== 'object') return;
    if (badEmoji(obj.emoji)) obj.emoji = fallback;
  };

  for (const k of Object.keys(STATUS_META)) STATUS_META[k].emoji = statusIcon[k] || '✨';

  (ROSTER || []).forEach(h => {
    const base = specials[h.id] || TYPE_ICON[h.type] || '🦆';
    fix(h, base);
    if (h.passive) fix(h.passive, passiveIcon[h.passive.id] || '✨');
    (h.moves || []).forEach(m => fix(m, TYPE_ICON[m.type] || '✨'));
  });

  (HONKER_DEX || []).forEach(h => {
    const base = specials[h.id] || TYPE_ICON[h.type] || '🦆';
    fix(h, base);
    if (h.passive) fix(h.passive, passiveIcon[h.passive.id] || '✨');
  });

  if (typeof MOVES_BY_TYPE !== 'undefined' && MOVES_BY_TYPE) {
    Object.entries(MOVES_BY_TYPE).forEach(([type, list]) => {
      (list || []).forEach(m => fix(m, TYPE_ICON[type] || '✨'));
    });
  }

  if (typeof ITEMS !== 'undefined' && ITEMS) (ITEMS || []).forEach(it => fix(it, itemIcon[it.id] || '🎁'));
  if (typeof WILD_EVENTS !== 'undefined' && WILD_EVENTS) (WILD_EVENTS || []).forEach(ev => fix(ev, '✨'));
  if (typeof PART_PASSIVES !== 'undefined' && PART_PASSIVES) Object.values(PART_PASSIVES || {}).forEach(p => fix(p, passiveIcon[p.id] || '✨'));
}
try { restoreEmojiIcons(); } catch (e) { console.warn('restoreEmojiIcons failed', e); }

function refreshStatusBadges(f) {
  const el = document.getElementById(`sb-${f.side}`);
  el.innerHTML = '';
  Object.entries(f.statusEffects).forEach(([key, val]) => {
    if (!val || val <= 0) return;
    const meta = STATUS_META[key];
    if (!meta) return;
    const suffix = STACKABLE_EFFECTS.includes(key) ? ` x${Math.max(1, Math.min(4, val))}` : (val>1 ? ` ·${val}` : '');
    addStatusBadge(f.side, `${meta.emoji} ${meta.label}${suffix}`, meta.color);
  });
}

function applyStatusEffect(target, effect, duration) {
  // Passive: resilient blocks paralysis
  if (effect === 'paralyzed' && target.passive?.id === 'resilient') {
    log('n', `🛡️ <b>${target.name}</b>'s Resilient passive blocks paralysis!`);
    return;
  }
  // Passive: heat_proof blocks burn
  if (effect === 'burn' && target.passive?.id === 'heat_proof') {
    log('n', `🔥 <b>${target.name}</b>'s Heat Proof passive blocks burn!`);
    return;
  }
  if (STACKABLE_EFFECTS.includes(effect)) {
    const cur = target.statusEffects[effect] || 0;
    target.statusEffects[effect] = Math.max(1, Math.min(4, cur + 1));
  } else {
    // Classic timed effects (burn/frozen)
    target.statusEffects[effect] = duration;
  }
  refreshStatusBadges(target);
  const meta = STATUS_META[effect];
  const stackTxt = STACKABLE_EFFECTS.includes(effect) ? ` (stack ${target.statusEffects[effect]}/4)` : '';
  const msgs = {
    burn:      `🔥 <b>${target.name}</b> is now <span style="color:#ff4e00">BURNING</span>! Takes damage each round.`,
    frozen:    `❄️ <b>${target.name}</b> is <span style="color:#00c8ff">FROZEN SOLID</span>! Will skip their next turn!`,
    paralyzed: `⚡ <b>${target.name}</b> is <span style="color:#ffe600">PARALYZED</span>! Accuracy reduced.`,
    cursed:    `🌑 <b>${target.name}</b> is <span style="color:#a020f0">CURSED</span>! Attack power reduced${stackTxt}.`,
    shielded:  `🛡️ <b>${target.name}</b> raises a <span style="color:#00ff88">SHIELD</span>! Incoming damage reduced${stackTxt}.`,
    pumped:    `💪 <b>${target.name}</b> is <span style="color:#ff9800">PUMPED UP</span>! Attack power increased${stackTxt}.`,
    exposed:   `🔓 <b>${target.name}</b> is <span style="color:#ff4444">EXPOSED</span>! Defense reduced${stackTxt}.`,
  };
  log('ev', msgs[effect] || `${meta.emoji} ${target.name} gains ${effect}!`);
}

function tickStatusEffects(f) {
  // Passive: heat_proof - immune to burn (also blocked at apply, belt+suspenders)
  if (f.passive?.id === 'heat_proof' && f.statusEffects.burn) {
    delete f.statusEffects.burn;
    refreshStatusBadges(f);
  }
  // Passive: regeneration - heal 6% max HP each round
  if (f.passive?.id === 'regeneration' && f.currentHP < f.maxHP) {
    const heal = Math.max(3, Math.round(f.maxHP * 0.06));
    f.currentHP = Math.min(f.maxHP, f.currentHP + heal);
    updateHP(f, f.side);
    log('n', `🌱 <b>${f.name}</b> regenerates <span style="color:#00ff88">${heal} HP</span>!`);
  }
  // Burn deals 8% max HP damage per round
  if (f.statusEffects.burn > 0) {
    const burnDmg = Math.max(4, Math.round(f.maxHP * 0.08));
    f.currentHP = Math.max(0, f.currentHP - burnDmg);
    updateHP(f, f.side);
    log('ev', `🔥 <b>${f.name}</b> takes <span style="color:#ff4e00">${burnDmg} burn damage</span>!`);
    f.statusEffects.burn--;
    if (f.statusEffects.burn <= 0) {
      delete f.statusEffects.burn;
      log('n', `🔥 ${f.name}'s burn fades.`);
    }
    if (f.isDead()) return true; // signal death from burn
  }
  // Paralyzed ticks down each round
  if (f.statusEffects.paralyzed > 0) {
    f.statusEffects.paralyzed--;
    if (f.statusEffects.paralyzed <= 0) {
      delete f.statusEffects.paralyzed;
      log('n', `⚡ ${f.name}'s paralysis fades.`);
    }
  }
  // Stackable effects (cursed/shielded/pumped/exposed) persist until swap/faint/boss-clear.
  refreshStatusBadges(f);
  return false;
}

function doMove(atk, def, move, cb) {
  // Frozen: skip turn
  if (atk.statusEffects.frozen > 0) {
    if (BS.rng() < 0.5) {
      // Thawed! Act normally this turn
      atk.statusEffects.frozen--;
      if (atk.statusEffects.frozen <= 0) delete atk.statusEffects.frozen;
      refreshStatusBadges(atk);
      log('n', `❄️ <b>${atk.name}</b> thaws out and acts!`);
    } else {
      atk.statusEffects.frozen--;
      if (atk.statusEffects.frozen <= 0) delete atk.statusEffects.frozen;
      refreshStatusBadges(atk);
      move.pp = Math.max(0, move.pp - 1);
      updatePPDots(atk, atk.side);
      log('ms', `❄️ <b>${atk.name}</b> is frozen solid and cannot move!`);
      shakeSpr(atk.side);
      setTimeout(cb, 370);
      return;
    }
  }

  const accMod    = (BS.eventState.accuracyMod || 1) * atk.accModifier;
  const guaranteed = BS.eventState.guaranteedHit;
  const effAcc    = guaranteed ? 100 : move.acc * accMod;
  // Luck-based evasion: defender has a small chance to dodge (luck/400 = 0-24% based on luck)
  const evadeChance = (def.effectiveLuck || 50) / 400;
  const evaded = !guaranteed && BS.rng() < evadeChance;
  const hit = !evaded && (BS.rng() * 100 <= effAcc);

  move.pp = Math.max(0, move.pp - 1);
  updatePPDots(atk, atk.side);

  const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];

  // STATUS / BUFF MOVE (no damage)
  if (move.power <= 0 && (move.inflictStatus || move.applyBuff)) {
    log('m', `${opener} <b style="color:${TC[atk.type]}">${atk.name}</b> uses <b>${move.emoji} ${move.name}</b>!`);
    if (!hit) { log('ms', 'But it fails!'); shakeSpr(atk.side); setTimeout(cb, 370); return; }
    if (move.inflictStatus) {
      if (BS.rng() * 100 > move.inflictStatus.chance) {
        log('ms', 'But it had no effect!');
        setTimeout(cb, 370);
        return;
      }
      animAtk(atk.side, def.side);
      setTimeout(() => {
        const dur = STATUS_DURATIONS[move.inflictStatus.type] || 2;
        applyStatusEffect(def, move.inflictStatus.type, dur);
        spawnPtcl(def.side, STATUS_META[move.inflictStatus.type]?.color || '#fff', move.emoji);
        setTimeout(cb, 350);
      }, 300);
      return;
    }
    if (move.applyBuff) {
      animAtk(atk.side, def.side);
      setTimeout(() => {
        const target = move.applyBuff.target === 'self' ? atk : def;
        for (let i = 0; i < (move.applyBuff.stacks || 1); i++) {
          applyStatusEffect(target, move.applyBuff.type, 99);
        }
        spawnPtcl(target.side, STATUS_META[move.applyBuff.type]?.color || '#fff', move.emoji);
        setTimeout(cb, 350);
      }, 300);
      return;
    }
  }

  log('m', `${opener} <b style="color:${TC[atk.type]}">${atk.name}</b> uses <b>${move.emoji} ${move.name}</b>!`);

  if (evaded) {
    log('ms', `🌀 <b>${def.name}</b> dodged the attack! (Lucky!)`);
    shakeSpr(def.side);
    setTimeout(cb, 370);
    return;
  }
  if (!hit) {
    log('ms', MISSES[Math.floor(Math.random() * MISSES.length)]);
    shakeSpr(atk.side);
    setTimeout(cb, 370);
    return;
  }

  // Gen-1 style core damage formula with game-specific modifiers layered on top.
  let   mType = move.type;
  if (atk.chaosMod && atk.chaosMod > 1) {
    const types = ['Fire','Ice','Lightning','Shadow','Normal'];
    mType = types[Math.floor(Math.random() * types.length)];
  }
  const eff   = getEff(mType, def.type, def.type2);
  const stab   = (mType === atk.type || mType === atk.type2) ? (atk.stabBonus || 1.25) : 1.0;
  const rage   = (BS.eventState.rageTarget === atk.side && BS.eventState.rageMod) ? BS.eventState.rageMod : 1;
  // Luck-based crits: attacker's luck/500 = 0-19% crit chance.
  const critChance = (atk.effectiveLuck || 50) / 500;
  const isCrit = BS.rng() < critChance;
  const level = Math.max(1, atk.level || 1);
  const critLevelMult = isCrit ? 2 : 1;
  const randomMult = 0.85 + BS.rng() * 0.15;
  const atkStat = Math.max(1, Math.round(((atk.atk || 80) + (atk.atkFlat || 0)) * (atk.atkMult || 1) * atk.atkModifier));
  const defStat = Math.max(1, Math.round(def.def || 80));
  const chaos  = atk.chaosMod || 1;
  const shield = def.defModifier; // < 1 if shielded
  // Passive: frost_armor - 25% less Ice damage
  const frostArmor = (def.passive?.id === 'frost_armor' && (mType||move.type) === 'Ice') ? 0.75 : 1;
  const pwr = Math.max(1, Math.round(move.power || 0));
  const core1 = Math.floor((2 * level * critLevelMult) / 5) + 2;
  const core2 = Math.floor((core1 * pwr * atkStat) / defStat);
  const core3 = Math.floor(core2 / 15) + 2;
  let dmg = Math.floor(core3 * stab * eff * randomMult * rage * chaos * shield * frostArmor);
  if (eff <= 0) dmg = 0;
  else dmg = Math.max(1, dmg);
  if (isCrit) log('g', `🎯 <b>CRITICAL HIT!</b> (${atk.name}'s luck comes through!)`);

  if (BS.eventState.nextHitMult) {
    dmg = Math.round(dmg * BS.eventState.nextHitMult);
    delete BS.eventState.nextHitMult;
    log('ev', `⚡ POWER SURGE activates! Damage tripled!`);
  }

  animAtk(atk.side, def.side);
  setTimeout(() => {
    showClash(move.emoji);
    spawnPtcl(def.side, TC[mType || atk.type], move.emoji);
    if (window.BattleThreeFx) {
      const fxType = resolveMoveFxType(move);
      const payload = {
        atkSide: atk.side,
        defSide: def.side,
        type: mType || atk.type,
        crit: isCrit,
        novaMode: fxType === 'reverse_nova' ? 'reverse' : 'normal',
      };
      if ((fxType === 'nova' || fxType === 'reverse_nova') && typeof window.BattleThreeFx.spawnNova === 'function') {
        window.BattleThreeFx.spawnNova(payload);
      } else if (fxType === 'beam' && typeof window.BattleThreeFx.spawnBeam === 'function') {
        window.BattleThreeFx.spawnBeam(payload);
        if (typeof window.BattleThreeFx.spawnHit === 'function') window.BattleThreeFx.spawnHit(payload);
      } else if (fxType === 'projectile' && typeof window.BattleThreeFx.spawnProjectile === 'function') {
        window.BattleThreeFx.spawnProjectile(payload);
      } else if (fxType === 'drain' && typeof window.BattleThreeFx.spawnDrain === 'function') {
        window.BattleThreeFx.spawnDrain(payload);
      } else if (typeof window.BattleThreeFx.spawnHit === 'function') {
        window.BattleThreeFx.spawnHit(payload);
      }
    }
    if (eff >= 2)    showToast('super', '⚡ SUPER EFFECTIVE!');
    else if (eff <= .5) showToast('not', '🛡 Not very effective...');

    setTimeout(() => {
      let reflected = 0;
      if (BS.eventState.mirror) {
        reflected = Math.round(dmg * BS.eventState.mirror);
        delete BS.eventState.mirror;
        clearStatusBadges('left'); clearStatusBadges('right');
        BS.bFighters.forEach(f => refreshStatusBadges(f));
      }

      // Boss shield absorbs damage before HP
      let shieldBroke = false;
      let shieldAbsorbed = 0;
      if (def.shieldHP > 0 && dmg > 0) {
        shieldAbsorbed = Math.min(def.shieldHP, dmg);
        def.shieldHP -= shieldAbsorbed;
        dmg -= shieldAbsorbed;
        if (typeof updateShieldBar === 'function') updateShieldBar(def, def.side);
        if (def.shieldHP <= 0) {
          shieldBroke = true;
          if (typeof onShieldBreak === 'function') onShieldBreak(def, def.side);
        }
      }

      def.currentHP = Math.max(0, def.currentHP - dmg);
      updateHP(def, def.side);
      if (reflected > 0) {
        atk.currentHP = Math.max(0, atk.currentHP - reflected);
        updateHP(atk, atk.side);
        log('ev', `🪞 Mirror reflects ${reflected} damage back to ${atk.name}!`);
      }

      if (shieldAbsorbed > 0) log('n', `🛡️ Shield absorbs <span style="color:#7ad7ff">${shieldAbsorbed} damage</span>!`);
      if (shieldBroke) log('ev', `💥 <b>${def.name}</b>'s <span style="color:#ff4e00">SHIELD SHATTERED!</span>`);
      if (eff >= 2)       log('s', '🔥 It\'s super effective!');
      else if (eff <= .5) log('w', '🛡 Not very effective...');
      if (stab > 1)       log('n', '✨ Same-type bonus!');
      if (def.statusEffects.shielded) log('n', `🛡️ Shield absorbs some damage!`);
      if (frostArmor < 1) log('n', `❄️ Frost Armor reduces the Ice damage!`);

      const effLbl = eff !== 1 ? ` (x${eff})` : '';
      const totalHit = shieldAbsorbed + dmg;
      log('d', `💥 <b>${def.name}</b> takes <span style="color:#ff5252">${totalHit} damage</span>${effLbl}! HP: ${def.currentHP}/${def.maxHP}`);

      // Passive: static_skin - 30% chance to paralyze attacker on hit
      if (def.passive?.id === 'static_skin' && dmg > 0 && !atk.statusEffects.paralyzed && BS.rng() < 0.3) {
        applyStatusEffect(atk, 'paralyzed', 2);
        log('ev', `⚡ ${def.name}'s Static Skin zaps ${atk.name}!`);
        spawnPtcl(atk.side, '#ffe600', '⚡');
      }

      // --- secondaryEffect: drain or recoil ---
      if (move.secondaryEffect && dmg > 0) {
        const se = move.secondaryEffect;
        if (se.type === 'drain') {
          const healAmt = Math.max(1, Math.round(dmg * se.value));
          atk.currentHP = Math.min(atk.maxHP, atk.currentHP + healAmt);
          updateHP(atk, atk.side);
          log('ev', `💚 <b>${atk.name}</b> drains <span style="color:#00ff88">${healAmt} HP</span>!`);
          spawnPtcl(atk.side, '#00ff88', '💚');
        } else if (se.type === 'recoil') {
          const recoilAmt = Math.max(1, Math.round(dmg * se.value));
          atk.currentHP = Math.max(0, atk.currentHP - recoilAmt);
          updateHP(atk, atk.side);
          log('ev', `💥 <b>${atk.name}</b> takes <span style="color:#ff9800">${recoilAmt} recoil damage</span>!`);
          spawnPtcl(atk.side, '#ff9800', '💥');
        }
      }

      // --- inflictStatus: chance-based timed status on enemy ---
      if (move.inflictStatus && dmg > 0) {
        if (BS.rng() * 100 <= move.inflictStatus.chance) {
          const st = move.inflictStatus.type;
          const dur = STATUS_DURATIONS[st] || 2;
          const canApply = !def.statusEffects[st];
          if (canApply) {
            applyStatusEffect(def, st, dur);
            spawnPtcl(def.side, STATUS_META[st]?.color || '#fff', STATUS_META[st]?.emoji || '●');
          }
        }
      }

      // --- applyBuff: stackable effect on hit ---
      if (move.applyBuff && dmg > 0) {
        const target = move.applyBuff.target === 'self' ? atk : def;
        for (let i = 0; i < (move.applyBuff.stacks || 1); i++) {
          applyStatusEffect(target, move.applyBuff.type, 99);
        }
        spawnPtcl(target.side, STATUS_META[move.applyBuff.type]?.color || '#fff', STATUS_META[move.applyBuff.type]?.emoji || '●');
      }

      updateCatchButton();

      if (def.isDead())       { endBattle(atk, def); }
      else if (atk.isDead())  { endBattle(def, atk); }
      else { setTimeout(cb, 270); }
    }, 330);
  }, 230);
}


