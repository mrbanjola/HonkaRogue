const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const vm = require('vm');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8080);
const MAX_BODY = 1 * 1024 * 1024; // 1 MB
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const SAVES_DIR = path.join(ROOT, 'saves');
const DATA_JS = path.join(ROOT, 'js', 'data.js');
const MOVES_DATA_FILE = path.join(DATA_DIR, 'moves_data.json');
const SLOT_DIRS = [
  { dir: 'Heads', slot: 'head' },
  { dir: 'Torsos', slot: 'torso' },
  { dir: 'Wings', slot: 'wings' },
  { dir: 'Legs', slot: 'legs' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(body);
}

function safeJsonParse(raw) {
  try {
    const normalized = typeof raw === 'string' ? raw.replace(/^\uFEFF/, '') : raw;
    return JSON.parse(normalized);
  } catch (_) {
    return null;
  }
}

function savePathForKey(key) {
  if (key === 'run' || key === 'campaign') return path.join(SAVES_DIR, 'run_save.json');
  if (key === 'global' || key === 'dex') return path.join(SAVES_DIR, 'global_save.json');
  return null;
}
function legacySavePathForKey(key) {
  if (key === 'run' || key === 'campaign') return path.join(SAVES_DIR, 'campaign.json');
  if (key === 'global' || key === 'dex') return path.join(SAVES_DIR, 'dex.json');
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function isImageFile(name) {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(name || '');
}

function readDirFiles(fullDir, relDir) {
  const out = [];
  if (!fs.existsSync(fullDir)) return out;
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const e of entries) {
    const childFull = path.join(fullDir, e.name);
    const childRel = path.posix.join(relDir, e.name);
    if (e.isDirectory()) {
      out.push(...readDirFiles(childFull, childRel));
      continue;
    }
    if (e.isFile() && isImageFile(e.name)) out.push(childRel);
  }
  return out;
}

function collectUnassignedPartImages() {
  const dataFile = path.join(DATA_DIR, 'parts_data.json');
  const raw = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf8') : '';
  const parsed = safeJsonParse(raw) || { parts: [] };
  const assigned = new Set((parsed.parts || []).map(p => String(p.file || '').replace(/\\/g, '/').toLowerCase()));
  const unassigned = [];
  for (const item of SLOT_DIRS) {
    const relFiles = readDirFiles(path.join(ROOT, item.dir), item.dir);
    for (const rel of relFiles) {
      const normalized = rel.replace(/\\/g, '/').toLowerCase();
      if (assigned.has(normalized)) continue;
      unassigned.push({
        slot: item.slot,
        file: rel.replace(/\\/g, '/'),
        name: path.basename(rel),
      });
    }
  }
  return unassigned;
}

function findConstArrayRange(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const arrStart = source.indexOf('[', start);
  if (arrStart < 0) return null;
  let depth = 0;
  let inStr = false;
  let strQ = '';
  let esc = false;
  for (let i = arrStart; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === strQ) { inStr = false; strQ = ''; }
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; strQ = ch; continue; }
    if (ch === '[') { depth += 1; continue; }
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        while (end < source.length && /\s/.test(source[end])) end += 1;
        if (source[end] === ';') end += 1;
        return { start, arrStart, arrEnd: i + 1, end };
      }
    }
  }
  return null;
}
function findConstObjectRange(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const objStart = source.indexOf('{', start);
  if (objStart < 0) return null;
  let depth = 0;
  let inStr = false;
  let strQ = '';
  let esc = false;
  for (let i = objStart; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === strQ) { inStr = false; strQ = ''; }
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; strQ = ch; continue; }
    if (ch === '{') { depth += 1; continue; }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        while (end < source.length && /\s/.test(source[end])) end += 1;
        if (source[end] === ';') end += 1;
        return { start, objStart, objEnd: i + 1, end };
      }
    }
  }
  return null;
}
function findRosterRange(source) {
  return findConstArrayRange(source, 'let ROSTER = [');
}
function findHonkDexRange(source) {
  return findConstArrayRange(source, 'let HONKER_DEX = [');
}
function findDexPartOverridesRange(source) {
  return findConstObjectRange(source, 'const DEX_PARTS_OVERRIDES = {');
}

function readMovePoolFromFile() {
  const raw = fs.readFileSync(MOVES_DATA_FILE, 'utf8');
  const parsed = safeJsonParse(raw);
  if (!parsed) throw new Error('Invalid moves_data.json');
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) throw new Error('Invalid move pool payload');
  return items;
}

function writeMovePoolToFile(items) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = { items };
  fs.writeFileSync(MOVES_DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
}
function readRosterFromDataJs() {
  const src = fs.readFileSync(DATA_JS, 'utf8');
  const range = findRosterRange(src);
  if (!range) throw new Error('ROSTER not found');
  const arrExpr = src.slice(range.arrStart, range.arrEnd);
  const roster = vm.runInNewContext(`(${arrExpr})`, {});
  if (!Array.isArray(roster)) throw new Error('ROSTER parse failed');
  return roster;
}
function writeRosterToDataJs(roster) {
  const src = fs.readFileSync(DATA_JS, 'utf8');
  const range = findRosterRange(src);
  if (!range) throw new Error('ROSTER not found');
  const replacement = `const ROSTER = ${JSON.stringify(roster, null, 2)};`;
  const next = src.slice(0, range.start) + replacement + src.slice(range.end);
  fs.writeFileSync(DATA_JS, next, 'utf8');
}
function readHonkDexFromDataJs() {
  const src = fs.readFileSync(DATA_JS, 'utf8');
  const range = findHonkDexRange(src);
  if (!range) throw new Error('HONKER_DEX not found');
  const arrExpr = src.slice(range.arrStart, range.arrEnd);
  const dex = vm.runInNewContext(`(${arrExpr})`, {});
  if (!Array.isArray(dex)) throw new Error('HONKER_DEX parse failed');
  return dex;
}
function writeHonkDexToDataJs(dex) {
  const src = fs.readFileSync(DATA_JS, 'utf8');
  const range = findHonkDexRange(src);
  if (!range) throw new Error('HONKER_DEX not found');
  const replacement = `const HONKER_DEX = ${JSON.stringify(dex, null, 2)};`;
  const next = src.slice(0, range.start) + replacement + src.slice(range.end);
  fs.writeFileSync(DATA_JS, next, 'utf8');
}
function readDexPartOverridesFromDataJs() {
  const src = fs.readFileSync(DATA_JS, 'utf8');
  const range = findDexPartOverridesRange(src);
  if (!range) throw new Error('DEX_PARTS_OVERRIDES not found');
  const objExpr = src.slice(range.objStart, range.objEnd);
  const obj = vm.runInNewContext(`(${objExpr})`, {});
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('DEX_PARTS_OVERRIDES parse failed');
  const out = {};
  for (const [dexId, slots] of Object.entries(obj)) {
    if (!slots || typeof slots !== 'object') continue;
    out[dexId] = {};
    for (const slot of ['head', 'torso', 'wings', 'legs']) {
      const pid = slots?.[slot]?.id;
      if (pid) out[dexId][slot] = String(pid);
    }
  }
  return out;
}

function serveStatic(reqPath, res) {
  let rel = reqPath === '/' ? '/index.html' : reqPath;
  rel = decodeURIComponent(rel);
  const normalized = path.normalize(rel).replace(/^([/\\])+/, '');
  const full = path.join(ROOT, normalized);
  if (!full.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(full).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const rs = fs.createReadStream(full);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    rs.pipe(res);
    rs.on('error', () => send(res, 500, 'Read error'));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const pathname = url.pathname;

  if (pathname === '/api/parts-data') {
    const file = path.join(DATA_DIR, 'parts_data.json');
    if (req.method === 'GET') {
      fs.readFile(file, 'utf8', (err, raw) => {
        if (err) return send(res, 500, JSON.stringify({ error: 'parts_data.json missing' }), MIME['.json']);
        const parsed = safeJsonParse(raw);
        if (!parsed) return send(res, 500, JSON.stringify({ error: 'Invalid parts_data.json' }), MIME['.json']);
        send(res, 200, JSON.stringify(parsed), MIME['.json']);
      });
      return;
    }
    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const parsed = safeJsonParse(raw);
        if (!parsed || !Array.isArray(parsed.parts)) {
          send(res, 400, JSON.stringify({ error: 'Invalid parts payload: expected object with parts[]' }), MIME['.json']);
          return;
        }
        fs.mkdir(DATA_DIR, { recursive: true }, mkErr => {
          if (mkErr) return send(res, 500, JSON.stringify({ error: 'Data directory unavailable' }), MIME['.json']);
          fs.writeFile(file, JSON.stringify(parsed, null, 2), 'utf8', wrErr => {
            if (wrErr) return send(res, 500, JSON.stringify({ error: 'Write failed' }), MIME['.json']);
            send(res, 204, '');
          });
        });
      } catch (_) {
        send(res, 400, JSON.stringify({ error: 'Bad request' }), MIME['.json']);
      }
      return;
    }
    send(res, 405, JSON.stringify({ error: 'Method not allowed' }), MIME['.json']);
    return;
  }

  if (pathname === '/api/unassigned-part-images' && req.method === 'GET') {
    try {
      const unassigned = collectUnassignedPartImages();
      send(res, 200, JSON.stringify({ count: unassigned.length, items: unassigned }), MIME['.json']);
    } catch (err) {
      send(res, 500, JSON.stringify({ error: 'Failed to scan image folders' }), MIME['.json']);
    }
    return;
  }

  if (pathname === '/api/move-pool') {
    if (req.method === 'GET') {
      try {
        const pool = readMovePoolFromFile();
        send(res, 200, JSON.stringify({ count: pool.length, items: pool }), MIME['.json']);
      } catch (err) {
        send(res, 500, JSON.stringify({ error: 'Failed to read move pool data' }), MIME['.json']);
      }
      return;
    }
    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const parsed = safeJsonParse(raw);
        const items = Array.isArray(parsed) ? parsed : parsed?.items;
        if (!Array.isArray(items)) {
          send(res, 400, JSON.stringify({ error: 'Expected array or {items:[]}' }), MIME['.json']);
          return;
        }
        writeMovePoolToFile(items);
        send(res, 204, '');
      } catch (err) {
        send(res, 500, JSON.stringify({ error: 'Failed to write move pool data' }), MIME['.json']);
      }
      return;
    }
    send(res, 405, JSON.stringify({ error: 'Method not allowed' }), MIME['.json']);
    return;
  }

  if (pathname === '/api/roster') {
    if (req.method === 'GET') {
      try {
        const roster = readRosterFromDataJs();
        send(res, 200, JSON.stringify({ count: roster.length, items: roster }), MIME['.json']);
      } catch (err) {
        send(res, 500, JSON.stringify({ error: 'Failed to read ROSTER' }), MIME['.json']);
      }
      return;
    }
    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const parsed = safeJsonParse(raw);
        const items = Array.isArray(parsed) ? parsed : parsed?.items;
        if (!Array.isArray(items)) {
          send(res, 400, JSON.stringify({ error: 'Expected array or {items:[]}' }), MIME['.json']);
          return;
        }
        writeRosterToDataJs(items);
        send(res, 204, '');
      } catch (err) {
        send(res, 500, JSON.stringify({ error: 'Failed to write ROSTER' }), MIME['.json']);
      }
      return;
    }
    send(res, 405, JSON.stringify({ error: 'Method not allowed' }), MIME['.json']);
    return;
  }

  if (pathname === '/api/honkedex') {
    if (req.method === 'GET') {
      try {
        const dex = readHonkDexFromDataJs();
        send(res, 200, JSON.stringify({ count: dex.length, items: dex }), MIME['.json']);
      } catch (err) {
        send(res, 500, JSON.stringify({ error: 'Failed to read HONKER_DEX' }), MIME['.json']);
      }
      return;
    }
    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const parsed = safeJsonParse(raw);
        const items = Array.isArray(parsed) ? parsed : parsed?.items;
        if (!Array.isArray(items)) {
          send(res, 400, JSON.stringify({ error: 'Expected array or {items:[]}' }), MIME['.json']);
          return;
        }
        writeHonkDexToDataJs(items);
        send(res, 204, '');
      } catch (err) {
        send(res, 500, JSON.stringify({ error: 'Failed to write HONKER_DEX' }), MIME['.json']);
      }
      return;
    }
    send(res, 405, JSON.stringify({ error: 'Method not allowed' }), MIME['.json']);
    return;
  }

  if (pathname === '/api/dex-part-overrides' && req.method === 'GET') {
    try {
      const items = readDexPartOverridesFromDataJs();
      send(res, 200, JSON.stringify({ count: Object.keys(items).length, items }), MIME['.json']);
    } catch (err) {
      send(res, 500, JSON.stringify({ error: 'Failed to read DEX_PARTS_OVERRIDES' }), MIME['.json']);
    }
    return;
  }

  if (pathname.startsWith('/api/save/')) {
    const key = pathname.slice('/api/save/'.length);
    const file = savePathForKey(key);
    if (!file) {
      send(res, 404, JSON.stringify({ error: 'Unknown save key' }), MIME['.json']);
      return;
    }

    if (req.method === 'GET') {
      fs.readFile(file, 'utf8', (err, raw) => {
        if (!err) return send(res, 200, raw, MIME['.json']);
        const legacyFile = legacySavePathForKey(key);
        if (!legacyFile || legacyFile === file) return send(res, 204, '');
        fs.readFile(legacyFile, 'utf8', (legacyErr, legacyRaw) => {
          if (legacyErr) return send(res, 204, '');
          send(res, 200, legacyRaw, MIME['.json']);
        });
      });
      return;
    }

    if (req.method === 'DELETE') {
      fs.unlink(file, err => {
        if (err && err.code !== 'ENOENT') return send(res, 500, JSON.stringify({ error: 'Delete failed' }), MIME['.json']);
        const legacyFile = legacySavePathForKey(key);
        if (!legacyFile || legacyFile === file) return send(res, 204, '');
        fs.unlink(legacyFile, legacyErr => {
          if (legacyErr && legacyErr.code !== 'ENOENT') return send(res, 500, JSON.stringify({ error: 'Delete failed' }), MIME['.json']);
          send(res, 204, '');
        });
      });
      return;
    }

    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const parsed = safeJsonParse(raw);
        if (!parsed) return send(res, 400, JSON.stringify({ error: 'Invalid JSON' }), MIME['.json']);
        fs.mkdir(SAVES_DIR, { recursive: true }, mkErr => {
          if (mkErr) return send(res, 500, JSON.stringify({ error: 'Save directory unavailable' }), MIME['.json']);
          fs.writeFile(file, JSON.stringify(parsed), 'utf8', wrErr => {
            if (wrErr) return send(res, 500, JSON.stringify({ error: 'Save failed' }), MIME['.json']);
            send(res, 204, '');
          });
        });
      } catch (err) {
        if (err?.message === 'Payload too large') {
          send(res, 413, JSON.stringify({ error: 'Payload too large' }), MIME['.json']);
        } else {
          send(res, 400, JSON.stringify({ error: 'Bad request' }), MIME['.json']);
        }
      }
      return;
    }

    send(res, 405, JSON.stringify({ error: 'Method not allowed' }), MIME['.json']);
    return;
  }

  if (pathname === '/favicon.ico') {
    send(res, 204, '');
    return;
  }

  serveStatic(pathname, res);
});

server.listen(PORT, HOST, () => {
  console.log(`HonkaRogue server running at http://${HOST}:${PORT}`);
});
