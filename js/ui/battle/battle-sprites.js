// ============================================================================
// HonkaRogue Battle Sprites (js/ui/battle/battle-sprites.js)
// Composite sprite rendering for battle fighters and previews
// ============================================================================

function buildCompositeSprite(parts, el, layerPrefix) {
  // layerPrefix: 'cp' for battle fspr, 'pc' for portrait
  el.innerHTML = '';
  const layers = [
    { slot:'legs',  cls:`${layerPrefix}-legs`  },
    { slot:'wings', cls:`${layerPrefix}-wings` },
    { slot:'torso', cls:`${layerPrefix}-torso` },
    { slot:'head',  cls:`${layerPrefix}-head`  },
  ];
  layers.forEach(({ slot, cls }) => {
    const part = parts[slot];
    if (!part) return;
    const div = document.createElement('div');
    div.className = `${layerPrefix}-layer ${cls}`;
    const img = document.createElement('img');
    img.src = part.file;
    img.alt = slot;
    div.appendChild(img);
    el.appendChild(div);
  });
}
function renderCompositePreview(parts, el, extraClass) {
  if (!el || !parts) return;
  el.innerHTML = '';
  el.classList.add('comp-preview');
  if (extraClass) el.classList.add(extraClass);
  const layers = ['legs', 'wings', 'torso', 'head'];
  layers.forEach(slot => {
    const part = parts[slot];
    if (!part) return;
    const layer = document.createElement('div');
    layer.className = `cv-layer cv-${slot}`;
    const img = document.createElement('img');
    img.src = part.file;
    img.alt = slot;
    layer.appendChild(img);
    el.appendChild(layer);
  });
}

function getSpriteBaseClass(side) {
  const el = document.getElementById(`spr-${side}`);
  return el && el.classList.contains('composite') ? 'fspr composite' : 'fspr';
}

function resetSpriteClass(side) {
  const el = document.getElementById(`spr-${side}`);
  if (!el) return;
  el.className = getSpriteBaseClass(side);
}

function setSpriteAnimClass(side, animClass) {
  const el = document.getElementById(`spr-${side}`);
  if (!el) return;
  const base = getSpriteBaseClass(side);
  el.className = animClass ? `${base} ${animClass}` : base;
}
