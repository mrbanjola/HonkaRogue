// ============================================================================
// HonkaRogue 3D Battle Background (phase 2)
// Non-invasive Three.js overlay that sits above arena-bg and below fighters.
// Falls back silently if WebGL/Three.js is unavailable.
// ============================================================================
(function () {
  const CDN_THREE = 'https://unpkg.com/three@0.161.0/build/three.module.js';

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
    particles: null,
    fogMesh: null,
    ringMesh: null,
    biomeGroup: null,
    biomeNodes: [],
    biomeId: '',
    clock: null,
    rafId: 0,
    bossPulse: false,
  };

  const BIOME_PRESETS = {
    meadow: { particles: 220, particleSize: 0.10, swirl: 0.06, bob: 0.06, ringRot: 0.22, ringY: -0.95, ringZ: -1.8, fogOpacity: 0.12 },
    tundra: { particles: 280, particleSize: 0.075, swirl: 0.09, bob: 0.03, ringRot: 0.16, ringY: -1.08, ringZ: -2.0, fogOpacity: 0.16 },
    storm:  { particles: 300, particleSize: 0.085, swirl: 0.22, bob: 0.08, ringRot: 0.55, ringY: -0.86, ringZ: -1.6, fogOpacity: 0.11 },
    ember:  { particles: 260, particleSize: 0.09, swirl: 0.14, bob: 0.10, ringRot: 0.30, ringY: -0.9, ringZ: -1.7, fogOpacity: 0.13 },
    veil:   { particles: 240, particleSize: 0.095, swirl: 0.08, bob: 0.12, ringRot: 0.26, ringY: -0.82, ringZ: -1.55, fogOpacity: 0.15 },
    default:{ particles: 240, particleSize: 0.10, swirl: 0.08, bob: 0.07, ringRot: 0.24, ringY: -0.92, ringZ: -1.75, fogOpacity: 0.13 },
  };

  function getPreset(biomeId) {
    return BIOME_PRESETS[biomeId] || BIOME_PRESETS.default;
  }

  function cssColor(THREE, value, fallback) {
    try {
      return new THREE.Color(value || fallback);
    } catch (_) {
      return new THREE.Color(fallback);
    }
  }

  function setLayerVisibility(visible) {
    if (!state.layerEl) return;
    state.layerEl.style.display = visible ? 'block' : 'none';
  }

  async function loadThree() {
    if (!state.modulePromise) {
      state.modulePromise = import(CDN_THREE);
    }
    return state.modulePromise;
  }

  function ensureLayer() {
    if (!state.arenaEl) state.arenaEl = document.getElementById('arena');
    if (!state.arenaEl) return null;
    if (state.layerEl && state.layerEl.parentElement === state.arenaEl) return state.layerEl;
    const layer = document.createElement('div');
    layer.id = 'arena-3d-layer';
    layer.className = 'arena-3d-layer';
    state.arenaEl.appendChild(layer);
    state.layerEl = layer;
    return layer;
  }

  function onResize() {
    if (!state.renderer || !state.camera || !state.layerEl) return;
    const w = Math.max(1, state.layerEl.clientWidth);
    const h = Math.max(1, state.layerEl.clientHeight);
    state.camera.aspect = w / h;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(w, h, false);
  }

  function buildParticles(THREE, count, size) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;
      positions[idx + 0] = (Math.random() - 0.5) * 22;
      positions[idx + 1] = (Math.random() - 0.15) * 8;
      positions[idx + 2] = -Math.random() * 14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      color: '#ffffff',
    });
    return new THREE.Points(geo, mat);
  }

  function clearBiomeNodes() {
    if (!state.scene || !state.biomeNodes.length) return;
    for (const n of state.biomeNodes) {
      if (n.mesh && n.mesh.parent) n.mesh.parent.remove(n.mesh);
      if (n.mesh?.geometry?.dispose) n.mesh.geometry.dispose();
      if (n.mesh?.material?.dispose) n.mesh.material.dispose();
    }
    state.biomeNodes = [];
    if (state.biomeGroup && state.biomeGroup.parent) state.biomeGroup.parent.remove(state.biomeGroup);
    state.biomeGroup = null;
  }

  function addNode(mesh, speed, amp, axis, phase) {
    state.biomeNodes.push({ mesh, speed, amp, axis, phase });
  }

  function buildBiomeMeshes(THREE, biomeId, colors) {
    clearBiomeNodes();
    const group = new THREE.Group();
    group.position.set(0, -0.35, -3.25);
    state.scene.add(group);
    state.biomeGroup = group;

    const cA = colors.horizon;
    const cB = colors.accent;
    const cC = colors.skyBottom;

    if (biomeId === 'tundra') {
      for (let i = 0; i < 6; i += 1) {
        const g = new THREE.ConeGeometry(0.34 + Math.random() * 0.45, 1.2 + Math.random() * 1.1, 4);
        const m = new THREE.MeshBasicMaterial({ color: cA.clone().lerp(cB, 0.35), transparent: true, opacity: 0.28 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(-4.9 + i * 1.9, -0.78, -0.5 + Math.random() * 0.8);
        mesh.rotation.z = (Math.random() - 0.5) * 0.15;
        group.add(mesh);
        addNode(mesh, 0.5 + Math.random() * 0.4, 0.035, 'y', Math.random() * Math.PI * 2);
      }
    } else if (biomeId === 'storm') {
      for (let i = 0; i < 8; i += 1) {
        const g = new THREE.TorusGeometry(0.45 + Math.random() * 0.55, 0.035, 8, 30, Math.PI * (0.75 + Math.random() * 0.4));
        const m = new THREE.MeshBasicMaterial({ color: cB.clone().lerp(cC, 0.25), transparent: true, opacity: 0.24 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(-5.2 + i * 1.45, -0.35 + (Math.random() - 0.5) * 0.9, -0.9 + Math.random() * 0.8);
        mesh.rotation.z = Math.random() * Math.PI;
        group.add(mesh);
        addNode(mesh, 0.9 + Math.random() * 0.7, 0.18, 'r', Math.random() * Math.PI * 2);
      }
    } else if (biomeId === 'ember') {
      for (let i = 0; i < 7; i += 1) {
        const g = new THREE.OctahedronGeometry(0.28 + Math.random() * 0.35, 0);
        const m = new THREE.MeshBasicMaterial({ color: cB.clone().lerp(cA, 0.45), transparent: true, opacity: 0.27 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(-5 + i * 1.7, -0.66 + Math.random() * 0.65, -0.7 + Math.random() * 0.8);
        group.add(mesh);
        addNode(mesh, 0.85 + Math.random() * 0.6, 0.26, 'x', Math.random() * Math.PI * 2);
      }
    } else if (biomeId === 'veil') {
      for (let i = 0; i < 6; i += 1) {
        const g = new THREE.SphereGeometry(0.38 + Math.random() * 0.28, 14, 12);
        const m = new THREE.MeshBasicMaterial({ color: cC.clone().lerp(cB, 0.4), transparent: true, opacity: 0.2 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(-5 + i * 1.9, -0.3 + (Math.random() - 0.5) * 0.9, -0.9 + Math.random() * 0.7);
        group.add(mesh);
        addNode(mesh, 0.42 + Math.random() * 0.35, 0.18, 'xy', Math.random() * Math.PI * 2);
      }
    } else {
      for (let i = 0; i < 9; i += 1) {
        const g = new THREE.PlaneGeometry(0.16 + Math.random() * 0.15, 0.8 + Math.random() * 0.45);
        const m = new THREE.MeshBasicMaterial({ color: cA.clone().lerp(cB, 0.22), transparent: true, opacity: 0.21, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(-5.5 + i * 1.35, -0.74 + Math.random() * 0.3, -0.6 + Math.random() * 0.8);
        mesh.rotation.z = (Math.random() - 0.5) * 0.18;
        group.add(mesh);
        addNode(mesh, 0.55 + Math.random() * 0.45, 0.08, 'y', Math.random() * Math.PI * 2);
      }
    }
  }

  function animate() {
    if (!state.renderer || !state.scene || !state.camera || !state.clock) return;
    const dt = state.clock.getDelta();
    const t = state.clock.elapsedTime;
    const preset = getPreset(state.biomeId);

    if (state.particles) {
      state.particles.rotation.y += dt * preset.swirl;
      state.particles.rotation.x = Math.sin(t * 0.13) * 0.035;
    }
    if (state.fogMesh) {
      state.fogMesh.position.x = Math.sin(t * 0.24) * 0.85;
      state.fogMesh.position.y = -0.2 + Math.cos(t * 0.31) * (0.12 + preset.bob);
    }
    if (state.ringMesh) {
      state.ringMesh.rotation.z += dt * preset.ringRot;
      const pulse = state.bossPulse ? (0.2 + Math.sin(t * 4.2) * 0.11) : 0.05;
      state.ringMesh.material.opacity = Math.max(0.03, pulse);
      state.ringMesh.scale.setScalar(state.bossPulse ? (1 + Math.sin(t * 2.4) * 0.04) : 1);
    }
    if (state.biomeNodes.length) {
      for (const n of state.biomeNodes) {
        if (!n.mesh) continue;
        const wave = Math.sin(t * n.speed + n.phase) * n.amp;
        if (n.axis === 'y') n.mesh.position.y += wave * dt;
        if (n.axis === 'x') n.mesh.position.x += wave * dt;
        if (n.axis === 'xy') {
          n.mesh.position.x += wave * dt * 0.55;
          n.mesh.position.y += Math.cos(t * n.speed + n.phase) * n.amp * dt * 0.45;
        }
        if (n.axis === 'r') n.mesh.rotation.z += wave * dt;
      }
    }

    state.renderer.render(state.scene, state.camera);
    state.rafId = window.requestAnimationFrame(animate);
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
      const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
      camera.position.set(0, 1.3, 8.8);

      const hemi = new THREE.HemisphereLight(0x99ccff, 0x224422, 0.8);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 0.75);
      dir.position.set(-2, 3, 2);
      scene.add(dir);

      const fogGeo = new THREE.CircleGeometry(6.6, 48);
      const fogMat = new THREE.MeshBasicMaterial({ color: 0x88aacc, transparent: true, opacity: 0.14, depthWrite: false });
      const fogMesh = new THREE.Mesh(fogGeo, fogMat);
      fogMesh.position.set(0, -0.2, -2.8);
      fogMesh.scale.set(1.8, 0.9, 1);
      scene.add(fogMesh);

      const ringGeo = new THREE.TorusGeometry(2.7, 0.09, 16, 96);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.06, depthWrite: false });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(0, -0.9, -1.7);
      ringMesh.rotation.x = Math.PI / 2.9;
      scene.add(ringMesh);

      const particles = buildParticles(THREE, BIOME_PRESETS.default.particles, BIOME_PRESETS.default.particleSize);
      particles.position.set(0, 0.72, -2.15);
      scene.add(particles);

      state.renderer = renderer;
      state.scene = scene;
      state.camera = camera;
      state.fogMesh = fogMesh;
      state.ringMesh = ringMesh;
      state.particles = particles;
      state.clock = new THREE.Clock();
      state.started = true;

      onResize();
      window.addEventListener('resize', onResize);
      animate();
      return true;
    } catch (err) {
      state.failed = true;
      console.warn('[3D BG] Three.js unavailable, using CSS background only.', err?.message || err);
      setLayerVisibility(false);
      return false;
    }
  }

  function rebuildParticlesForBiome(THREE, preset, accent) {
    if (!state.scene) return;
    if (state.particles) {
      state.scene.remove(state.particles);
      if (state.particles.geometry?.dispose) state.particles.geometry.dispose();
      if (state.particles.material?.dispose) state.particles.material.dispose();
      state.particles = null;
    }
    state.particles = buildParticles(THREE, preset.particles, preset.particleSize);
    state.particles.position.set(0, 0.72, -2.15);
    state.particles.material.color.copy(accent);
    state.scene.add(state.particles);
  }

  async function applyStage(stage) {
    const ok = await initIfNeeded();
    if (!ok) return;
    setLayerVisibility(true);
    const THREE = state.THREE;
    if (!THREE || !state.scene) return;

    const biomeId = String(stage?.biomeId || 'default');
    const visual = stage?.biomeVisual || {};
    const preset = getPreset(biomeId);

    const colors = {
      skyTop: cssColor(THREE, visual.skyTop, '#87a7d8'),
      skyBottom: cssColor(THREE, visual.skyBottom, '#5f77a8'),
      horizon: cssColor(THREE, visual.horizon, '#3f8a48'),
      accent: cssColor(THREE, visual.accent, '#ffd266'),
      haze: cssColor(THREE, visual.haze, '#b3d1ff'),
    };

    state.scene.fog = new THREE.Fog(colors.horizon, 7, 24);
    if (state.fogMesh) {
      state.fogMesh.material.color.copy(colors.haze);
      state.fogMesh.material.opacity = preset.fogOpacity;
    }
    if (state.ringMesh) {
      state.ringMesh.material.color.copy(colors.skyBottom.clone().lerp(colors.accent, 0.55));
      state.ringMesh.position.y = preset.ringY;
      state.ringMesh.position.z = preset.ringZ;
    }
    if (state.renderer) {
      const bg = colors.skyTop.clone().lerp(colors.skyBottom, 0.55);
      state.renderer.setClearColor(bg, 0.14);
    }

    if (state.biomeId !== biomeId) {
      state.biomeId = biomeId;
      rebuildParticlesForBiome(THREE, preset, colors.accent);
      buildBiomeMeshes(THREE, biomeId, colors);
    } else if (state.particles) {
      state.particles.material.color.copy(colors.accent);
    }

    state.bossPulse = !!stage?.isBoss;
  }

  function dispose() {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    window.removeEventListener('resize', onResize);

    clearBiomeNodes();

    if (state.renderer) {
      state.renderer.dispose();
      const cnv = state.renderer.domElement;
      if (cnv && cnv.parentElement) cnv.parentElement.removeChild(cnv);
    }
    if (state.particles?.geometry?.dispose) state.particles.geometry.dispose();
    if (state.particles?.material?.dispose) state.particles.material.dispose();
    if (state.fogMesh?.geometry?.dispose) state.fogMesh.geometry.dispose();
    if (state.fogMesh?.material?.dispose) state.fogMesh.material.dispose();
    if (state.ringMesh?.geometry?.dispose) state.ringMesh.geometry.dispose();
    if (state.ringMesh?.material?.dispose) state.ringMesh.material.dispose();

    state.started = false;
    state.renderer = null;
    state.scene = null;
    state.camera = null;
    state.particles = null;
    state.fogMesh = null;
    state.ringMesh = null;
    state.clock = null;
    state.biomeId = '';
  }

  window.BattleThreeBg = { applyStage, dispose };
})();
