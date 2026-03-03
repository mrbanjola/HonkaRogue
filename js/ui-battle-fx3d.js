// ============================================================================
// HonkaRogue 3D Battle FX (phase 1)
// Visual-only layer for attack effects; gameplay remains DOM/engine-driven.
// ============================================================================
(function () {
  const CDN_THREE = 'https://unpkg.com/three@0.161.0/build/three.module.js';
  const TYPE_COLORS = {
    Fire: '#ff6a2b',
    Ice: '#7ad7ff',
    Lightning: '#ffe15a',
    Shadow: '#b07dff',
    Normal: '#e6f1ff',
  };

  const state = {
    started: false,
    failed: false,
    modulePromise: null,
    THREE: null,
    arenaEl: null,
    layerEl: null,
    renderer: null,
    scene: null,
    camera: null,
    clock: null,
    rafId: 0,
    fx: [],
  };

  async function loadThree() {
    if (!state.modulePromise) state.modulePromise = import(CDN_THREE);
    return state.modulePromise;
  }

  function ensureLayer() {
    if (!state.arenaEl) state.arenaEl = document.getElementById('arena');
    if (!state.arenaEl) return null;
    if (state.layerEl && state.layerEl.parentElement === state.arenaEl) return state.layerEl;
    const el = document.createElement('div');
    el.id = 'arena-3d-fx-layer';
    el.className = 'arena-3d-fx-layer';
    state.arenaEl.appendChild(el);
    state.layerEl = el;
    return el;
  }

  function onResize() {
    if (!state.renderer || !state.camera || !state.layerEl) return;
    const w = Math.max(1, state.layerEl.clientWidth);
    const h = Math.max(1, state.layerEl.clientHeight);
    const aspect = w / h;
    const viewH = 6;
    state.camera.left = -viewH * aspect;
    state.camera.right = viewH * aspect;
    state.camera.top = viewH;
    state.camera.bottom = -viewH;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(w, h, false);
  }

  function sidePos(side) {
    const arena = document.getElementById('arena');
    const zone = document.getElementById(`zone-${side}`);
    if (!arena || !zone || !state.camera) return { x: side === 'left' ? -3 : 3, y: 0.5 };
    const ar = arena.getBoundingClientRect();
    const zr = zone.getBoundingClientRect();
    const nx = ((zr.left + zr.width * 0.5) - ar.left) / Math.max(1, ar.width);
    const ny = ((zr.top + zr.height * 0.35) - ar.top) / Math.max(1, ar.height);
    const x = state.camera.left + nx * (state.camera.right - state.camera.left);
    const y = state.camera.top - ny * (state.camera.top - state.camera.bottom);
    return { x, y };
  }

  function typeColor(THREE, t) {
    return new THREE.Color(TYPE_COLORS[t] || TYPE_COLORS.Normal);
  }

  function spawnHit(opts) {
    const THREE = state.THREE;
    if (!THREE || !state.scene) return;
    const atkPos = sidePos(opts.atkSide || 'left');
    const defPos = sidePos(opts.defSide || 'right');
    const color = typeColor(THREE, opts.type);
    const root = new THREE.Group();
    state.scene.add(root);

    const travel = [];
    const travelCount = opts.crit ? 16 : 11;
    const travelDur = opts.crit ? 0.34 : 0.28;
    for (let i = 0; i < travelCount; i += 1) {
      const g = new THREE.SphereGeometry(0.055 + Math.random() * 0.045, 9, 9);
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(atkPos.x, atkPos.y, 0);
      root.add(mesh);
      const lag = Math.random() * (opts.crit ? 0.10 : 0.08);
      const arc = (Math.random() - 0.5) * (opts.crit ? 0.9 : 0.55);
      const wobble = Math.random() * Math.PI * 2;
      travel.push({ mesh, lag, arc, wobble });
    }

    const impact = new THREE.Group();
    impact.position.set(defPos.x, defPos.y, 0);
    impact.visible = false;
    root.add(impact);

    const sparks = [];
    const count = opts.crit ? 18 : 12;
    for (let i = 0; i < count; i += 1) {
      const g = new THREE.SphereGeometry(0.07 + Math.random() * 0.07, 10, 10);
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.18, 0);
      impact.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const spd = 1.8 + Math.random() * 2.9;
      sparks.push({ mesh, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd });
    }
    const ringGeo = new THREE.RingGeometry(0.16, opts.crit ? 0.9 : 0.72, 40);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    impact.add(ring);

    state.fx.push({
      t: 0,
      life: travelDur + (opts.crit ? 0.52 : 0.44),
      travelDur,
      root,
      impact,
      travel,
      ring,
      sparks,
      update(dt) {
        const tTravel = Math.min(1, this.t / Math.max(0.001, this.travelDur));
        for (const tr of travel) {
          const q = Math.max(0, Math.min(1, (this.t - tr.lag) / Math.max(0.001, this.travelDur)));
          const x = atkPos.x + (defPos.x - atkPos.x) * q;
          const yBase = atkPos.y + (defPos.y - atkPos.y) * q;
          const yArc = Math.sin(Math.PI * q) * tr.arc + Math.sin(this.t * 18 + tr.wobble) * 0.02;
          tr.mesh.position.set(x, yBase + yArc, 0);
          tr.mesh.material.opacity = q < 1 ? Math.min(1, 0.30 + q * 0.85) : 0;
        }

        const impactStarted = this.t >= this.travelDur * 0.92;
        impact.visible = impactStarted;
        if (!impactStarted) return;

        const pImpact = Math.min(1, (this.t - this.travelDur * 0.92) / Math.max(0.001, this.life - this.travelDur * 0.92));
        ring.scale.setScalar(1 + pImpact * (opts.crit ? 1.5 : 1.15));
        ring.material.opacity = Math.max(0, 0.72 - pImpact * 0.72);
        for (const s of sparks) {
          s.mesh.position.x += s.vx * dt;
          s.mesh.position.y += s.vy * dt;
          s.mesh.material.opacity = Math.max(0, 1 - pImpact * 1.06);
        }
      },
    });
  }

  function spawnNova(opts) {
    const THREE = state.THREE;
    if (!THREE || !state.scene) return;
    const defPos = sidePos(opts.defSide || 'right');
    const color = typeColor(THREE, opts.type);
    const root = new THREE.Group();
    root.position.set(defPos.x, defPos.y, 0);
    state.scene.add(root);

    const coreGeo = new THREE.SphereGeometry(opts.crit ? 0.34 : 0.28, 18, 18);
    const coreMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    root.add(core);

    const flareGeo = new THREE.CircleGeometry(opts.crit ? 0.95 : 0.8, 48);
    const flareMat = new THREE.MeshBasicMaterial({
      color: color.clone().lerp(new THREE.Color('#ffffff'), 0.5),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const flare = new THREE.Mesh(flareGeo, flareMat);
    root.add(flare);

    const rings = [];
    const reverse = opts.novaMode === 'reverse';
    const ringCount = opts.crit ? 4 : 3;
    for (let i = 0; i < ringCount; i += 1) {
      const inner = 0.12 + i * 0.08;
      const outer = inner + 0.22 + i * 0.07;
      const g = new THREE.RingGeometry(inner, outer, 48);
      const m = new THREE.MeshBasicMaterial({
        color: color.clone().lerp(new THREE.Color('#ffffff'), 0.24),
        transparent: true,
        opacity: 0.92 - i * 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(g, m);
      ring.rotation.z = Math.random() * Math.PI;
      root.add(ring);
      rings.push({ mesh: ring, delay: i * 0.06 });
    }

    const sparks = [];
    const count = opts.crit ? 44 : 32;
    for (let i = 0; i < count; i += 1) {
      const g = new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 10, 10);
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(g, m);
      const a = Math.random() * Math.PI * 2;
      const r = 0.18 + Math.random() * 0.26;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      mesh.position.set(reverse ? sx : (Math.random() - 0.5) * 0.24, reverse ? sy : (Math.random() - 0.5) * 0.24, 0);
      root.add(mesh);
      const spd = 3.2 + Math.random() * 5.1;
      sparks.push({
        mesh,
        vx: reverse ? (-sx / Math.max(0.001, r)) * spd : Math.cos(a) * spd,
        vy: reverse ? (-sy / Math.max(0.001, r)) * spd : Math.sin(a) * spd,
      });
    }

    state.fx.push({
      t: 0,
      life: opts.crit ? 0.9 : 0.78,
      root,
      core,
      flare,
      rings,
      sparks,
      update(dt, p) {
        const easeIn = p * p;
        const easeOut = 1 - (1 - p) * (1 - p);
        if (reverse) {
          core.scale.setScalar((opts.crit ? 3.4 : 2.9) - easeIn * (opts.crit ? 2.7 : 2.2));
          core.material.opacity = Math.max(0, 0.2 + p * 0.8);
          flare.scale.setScalar((opts.crit ? 6.3 : 5.4) - easeIn * (opts.crit ? 4.5 : 3.9));
          flare.material.opacity = Math.max(0, 0.75 - p * 0.75);
        } else {
          core.scale.setScalar(1 + easeOut * (opts.crit ? 2.9 : 2.35));
          core.material.opacity = Math.max(0, 1 - p * 1.2);
          flare.scale.setScalar(1 + easeOut * (opts.crit ? 4.8 : 4.1));
          flare.material.opacity = Math.max(0, 0.95 - p * 1.4);
        }
        for (let i = 0; i < rings.length; i += 1) {
          const ringObj = rings[i];
          const ring = ringObj.mesh;
          const pr = Math.max(0, Math.min(1, (p - ringObj.delay) / Math.max(0.001, 1 - ringObj.delay)));
          const prEaseIn = pr * pr;
          const prEaseOut = 1 - (1 - pr) * (1 - pr);
          if (reverse) ring.scale.setScalar((opts.crit ? 7.2 : 6.1) - prEaseIn * (4.6 + i * 0.9));
          else ring.scale.setScalar(1 + prEaseOut * (4.6 + i * 1.25));
          ring.rotation.z += dt * (2 + i * 0.85) * (reverse ? -1 : 1);
          ring.material.opacity = Math.max(0, (0.95 - i * 0.12) - pr * (1.18 + i * 0.26));
        }
        for (const s of sparks) {
          s.mesh.position.x += s.vx * dt;
          s.mesh.position.y += s.vy * dt;
          s.mesh.material.opacity = Math.max(0, 1 - p * 1.12);
        }
      },
    });
  }

  function spawnProjectile(opts) {
    // Reuse travel-hit profile for projectile style.
    spawnHit(opts);
  }

  function spawnBeam(opts) {
    const THREE = state.THREE;
    if (!THREE || !state.scene) return;
    // Fail-safe: keep a guaranteed visible impact/travel effect for beam moves.
    spawnHit({ ...opts, crit: !!opts.crit });
    const atkPos = sidePos(opts.atkSide || 'left');
    const defPos = sidePos(opts.defSide || 'right');
    const color = typeColor(THREE, opts.type);
    const root = new THREE.Group();
    state.scene.add(root);

    const dx = defPos.x - atkPos.x;
    const dy = defPos.y - atkPos.y;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);

    const coreGeo = new THREE.PlaneGeometry(len, opts.crit ? 0.72 : 0.58);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set((atkPos.x + defPos.x) * 0.5, (atkPos.y + defPos.y) * 0.5, 0);
    core.rotation.z = ang;
    root.add(core);

    const glowGeo = new THREE.PlaneGeometry(len * 1.06, opts.crit ? 1.8 : 1.5);
    const glowMat = new THREE.MeshBasicMaterial({
      color: color.clone().lerp(new THREE.Color('#ffffff'), 0.15),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(core.position);
    glow.rotation.z = ang;
    root.add(glow);

    const sourceGeo = new THREE.CircleGeometry(opts.crit ? 0.42 : 0.34, 44);
    const sourceMat = new THREE.MeshBasicMaterial({
      color: color.clone().lerp(new THREE.Color('#ffffff'), 0.72),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const source = new THREE.Mesh(sourceGeo, sourceMat);
    source.position.set(atkPos.x, atkPos.y, 0);
    root.add(source);

    const sourceRingGeo = new THREE.RingGeometry(0.12, opts.crit ? 0.56 : 0.48, 44);
    const sourceRingMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const sourceRing = new THREE.Mesh(sourceRingGeo, sourceRingMat);
    sourceRing.position.copy(source.position);
    root.add(sourceRing);

    const tipGeo = new THREE.RingGeometry(0.08, opts.crit ? 0.5 : 0.42, 40);
    const tipMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(defPos.x, defPos.y, 0);
    root.add(tip);

    const impactGeo = new THREE.CircleGeometry(opts.crit ? 0.55 : 0.48, 42);
    const impactMat = new THREE.MeshBasicMaterial({
      color: color.clone().lerp(new THREE.Color('#ffffff'), 0.6),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const impact = new THREE.Mesh(impactGeo, impactMat);
    impact.position.set(defPos.x, defPos.y, 0);
    root.add(impact);

    const pulseBars = [];
    const pulseCount = opts.crit ? 4 : 3;
    for (let i = 0; i < pulseCount; i += 1) {
      const g = new THREE.PlaneGeometry(len * 0.26, opts.crit ? 0.3 : 0.25);
      const m = new THREE.MeshBasicMaterial({
        color: color.clone().lerp(new THREE.Color('#ffffff'), 0.4),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const bar = new THREE.Mesh(g, m);
      bar.rotation.z = ang;
      root.add(bar);
      pulseBars.push({ bar, phase: i / pulseCount });
    }

    const chargeDur = opts.crit ? 0.12 : 0.10;
    const sustainDur = opts.crit ? 0.62 : 0.52;
    const fadeDur = opts.crit ? 0.28 : 0.24;
    const life = chargeDur + sustainDur + fadeDur;

    state.fx.push({
      t: 0,
      life,
      chargeDur,
      sustainDur,
      fadeDur,
      root,
      core,
      glow,
      source,
      sourceRing,
      tip,
      impact,
      pulseBars,
      update(dt) {
        const t = this.t;
        const p = Math.min(1, t / this.life);
        const inCharge = t < this.chargeDur;
        const inSustain = t >= this.chargeDur && t < (this.chargeDur + this.sustainDur);
        const pCharge = Math.max(0, Math.min(1, t / Math.max(0.001, this.chargeDur)));
        const pFade = Math.max(0, Math.min(1, (t - (this.chargeDur + this.sustainDur)) / Math.max(0.001, this.fadeDur)));

        const beamAlpha = inCharge
          ? pCharge
          : (inSustain ? 1 : (1 - pFade));
        const jitter = inSustain ? (1 + Math.sin(t * 64) * 0.06) : 1;

        core.scale.y = jitter;
        glow.scale.y = 1 + (inSustain ? Math.sin(t * 42) * 0.06 : 0);
        core.material.opacity = 1.0 * beamAlpha;
        glow.material.opacity = 0.88 * beamAlpha;

        source.scale.setScalar(0.75 + pCharge * 0.45 + (inSustain ? Math.sin(t * 30) * 0.03 : 0));
        source.material.opacity = inCharge ? (0.55 + pCharge * 0.4) : (inSustain ? 0.98 : Math.max(0, 0.98 - pFade * 1.1));
        sourceRing.scale.setScalar(1 + p * (opts.crit ? 1.9 : 1.6));
        sourceRing.rotation.z += dt * 4.8;
        sourceRing.material.opacity = inCharge ? (0.3 + pCharge * 0.5) : (inSustain ? 0.82 : Math.max(0, 0.82 - pFade * 1.2));

        tip.scale.setScalar(1 + p * (opts.crit ? 2.3 : 1.9));
        tip.rotation.z += dt * 4.2;
        tip.material.opacity = 1.0 * beamAlpha;

        impact.scale.setScalar(0.85 + p * (opts.crit ? 1.6 : 1.35));
        impact.material.opacity = 0.72 * beamAlpha;

        for (const pulse of pulseBars) {
          const q = (t * 2.3 + pulse.phase) % 1;
          const px = atkPos.x + dx * q;
          const py = atkPos.y + dy * q;
          pulse.bar.position.set(px, py, 0);
          pulse.bar.material.opacity = beamAlpha * (0.18 + (1 - Math.abs(q - 0.5) * 1.6) * 0.25);
        }
      },
    });
  }

  function spawnHonk(opts) {
    // Scaffolded API for phase 2.
    spawnHit(opts);
  }

  function tick() {
    if (!state.renderer || !state.scene || !state.camera || !state.clock) return;
    const dt = state.clock.getDelta();
    for (let i = state.fx.length - 1; i >= 0; i -= 1) {
      const fx = state.fx[i];
      fx.t += dt;
      const p = Math.min(1, fx.t / Math.max(0.001, fx.life));
      fx.update(dt, p);
      if (p >= 1) {
        if (fx.root && fx.root.parent) fx.root.parent.remove(fx.root);
        fx.root.traverse(obj => {
          if (obj.geometry?.dispose) obj.geometry.dispose();
          if (obj.material?.dispose) obj.material.dispose();
        });
        state.fx.splice(i, 1);
      }
    }
    state.renderer.render(state.scene, state.camera);
    state.rafId = requestAnimationFrame(tick);
  }

  async function initIfNeeded() {
    if (state.started || state.failed) return !state.failed;
    const layer = ensureLayer();
    if (!layer) return false;
    try {
      const THREE = await loadThree();
      state.THREE = THREE;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      layer.innerHTML = '';
      layer.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, -20, 20);
      camera.position.z = 8;

      state.renderer = renderer;
      state.scene = scene;
      state.camera = camera;
      state.clock = new THREE.Clock();
      state.started = true;

      onResize();
      window.addEventListener('resize', onResize);
      tick();
      return true;
    } catch (err) {
      state.failed = true;
      console.warn('[3D FX] unavailable, using existing 2D particles only.', err?.message || err);
      return false;
    }
  }

  async function spawn(kind, options) {
    const ok = await initIfNeeded();
    if (!ok) return;
    if (kind === 'nova') return spawnNova(options || {});
    if (kind === 'projectile') return spawnProjectile(options || {});
    if (kind === 'beam') return spawnBeam(options || {});
    if (kind === 'honk') return spawnHonk(options || {});
    return spawnHit(options || {});
  }

  window.BattleThreeFx = {
    spawnHit: (opts) => spawn('hit', opts),
    spawnNova: (opts) => spawn('nova', opts),
    spawnProjectile: (opts) => spawn('projectile', opts),
    spawnBeam: (opts) => spawn('beam', opts),
    spawnHonk: (opts) => spawn('honk', opts),
  };
})();
