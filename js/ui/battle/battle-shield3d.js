// ============================================================================
// HonkaRogue Boss Shield 3D (js/ui/battle/battle-shield3d.js)
// Hex-pattern energy shield sphere rendered over the boss sprite via Three.js
// ============================================================================
(function () {
  const CDN_THREE = 'https://unpkg.com/three@0.161.0/build/three.module.js';

  const TYPE_SHIELD_COLORS = {
    Fire:      { main: '#ff6a2b', glow: '#ff9e5a' },
    Ice:       { main: '#7ad7ff', glow: '#b0eaff' },
    Lightning: { main: '#ffe15a', glow: '#fff5a0' },
    Shadow:    { main: '#b07dff', glow: '#d4b0ff' },
    Normal:    { main: '#a0c4ff', glow: '#d0e6ff' },
  };

  let shield = null; // { renderer, scene, camera, mesh, material, canvas, rafId, clock }

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    uniform vec3 uGlow;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uBreaking; // 0..1 break animation progress
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;

    // Hex grid pattern
    float hexGrid(vec2 p, float scale) {
      p *= scale;
      vec2 h = vec2(1.0, sqrt(3.0));
      vec2 a = mod(p, h) - h * 0.5;
      vec2 b = mod(p - h * 0.5, h) - h * 0.5;
      vec2 g = length(a) < length(b) ? a : b;
      float d = max(abs(g.x), abs(g.y * 0.577 + abs(g.x) * 0.5));
      return smoothstep(0.4, 0.42, d);
    }

    void main() {
      // Fresnel — brighter at edges
      float fresnel = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
      fresnel = pow(fresnel, 1.8);

      // Map 3D position to 2D for hex pattern
      vec2 hexUV = vPosition.xy * 2.5 + vec2(uTime * 0.1, uTime * 0.07);
      float hex = hexGrid(hexUV, 3.5);

      // Edge lines of hexagons glow
      float edgeGlow = (1.0 - hex) * 0.6;

      // Pulse
      float pulse = 0.85 + 0.15 * sin(uTime * 2.0);

      // Combine
      float alpha = (fresnel * 0.5 + edgeGlow * 0.7) * pulse * uOpacity;

      // Break effect — dissolve from top
      if (uBreaking > 0.0) {
        float dissolve = smoothstep(uBreaking * 2.0 - 0.5, uBreaking * 2.0, vPosition.y * 0.5 + 0.5);
        alpha *= (1.0 - dissolve);
        // Add crackle at dissolve edge
        float edge = smoothstep(0.0, 0.08, abs((vPosition.y * 0.5 + 0.5) - uBreaking * 2.0 + 0.25));
        alpha += (1.0 - edge) * (1.0 - uBreaking) * 0.8;
      }

      vec3 color = mix(uColor, uGlow, fresnel * 0.6 + edgeGlow * 0.4);
      gl_FragColor = vec4(color, alpha * 0.65);
    }
  `;

  async function createBossShield(side, type) {
    const sprEl = document.getElementById(`spr-${side}`);
    if (!sprEl) return;

    // Clean up previous shield
    disposeBossShieldInternal();

    let THREE;
    try {
      THREE = await import(CDN_THREE);
    } catch (e) {
      console.warn('[SHIELD3D] Three.js unavailable:', e?.message);
      return;
    }

    const colors = TYPE_SHIELD_COLORS[type] || TYPE_SHIELD_COLORS.Normal;

    // Place canvas as sibling after sprite, positioned via CSS over the sprite
    const canvas = document.createElement('canvas');
    canvas.className = 'shield-3d-canvas';
    const res = 256;
    canvas.width = res;
    canvas.height = res;
    sprEl.style.position = 'relative';
    sprEl.after(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(res, res, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
    camera.position.z = 2.4;

    const geo = new THREE.IcosahedronGeometry(1.0, 4);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor:    { value: new THREE.Color(colors.main) },
        uGlow:     { value: new THREE.Color(colors.glow) },
        uTime:     { value: 0 },
        uOpacity:  { value: 1.0 },
        uBreaking: { value: 0.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);

    const clock = new THREE.Clock();

    shield = { renderer, scene, camera, mesh, material, geo, canvas, clock, rafId: 0, breaking: false, breakT: 0 };

    // Start render loop
    function tick() {
      if (!shield) return;
      const dt = shield.clock.getDelta();
      shield.material.uniforms.uTime.value += dt;
      shield.mesh.rotation.y += dt * 0.3;
      shield.mesh.rotation.x = Math.sin(shield.material.uniforms.uTime.value * 0.5) * 0.1;

      if (shield.breaking) {
        shield.breakT = Math.min(1, shield.breakT + dt * 1.5);
        shield.material.uniforms.uBreaking.value = shield.breakT;
        if (shield.breakT >= 1) {
          disposeBossShieldInternal();
          return;
        }
      }

      shield.renderer.render(shield.scene, shield.camera);
      shield.rafId = requestAnimationFrame(tick);
    }
    shield.rafId = requestAnimationFrame(tick);
  }

  function breakBossShield() {
    if (!shield) return;
    shield.breaking = true;
  }

  function disposeBossShieldInternal() {
    if (!shield) return;
    if (shield.rafId) cancelAnimationFrame(shield.rafId);
    shield.geo.dispose();
    shield.material.dispose();
    shield.renderer.dispose();
    if (shield.canvas.parentElement) shield.canvas.remove();
    // Clean up sprite inline style
    const spr = document.querySelector('.fspr[style*="position"]');
    if (spr) spr.style.position = '';
    shield = null;
  }

  // Global API
  window.createBossShield = createBossShield;
  window.breakBossShield = breakBossShield;
  window.disposeBossShield = function () { disposeBossShieldInternal(); };
})();
