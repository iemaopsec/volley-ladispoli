const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const FIPAV_CAL_FILE = path.join(DATA_DIR, 'fipav_calendar_64602.json');
const FIPAV_TAB_FILE = path.join(DATA_DIR, 'fipav_tables_64602.json');

const DEFAULT_DB = {
  adminCode: '098765',
  players: [
    { id: 'alessandro-paris', name: 'Alessandro Paris', shortName: 'A. Paris', avatarColor: '#e11d48' },
    { id: 'apox', name: 'Apox', shortName: 'Apox', avatarColor: '#2563eb' },
    { id: 'emanuele', name: 'Emanuele', shortName: 'Emanuele', avatarColor: '#0284c7' },
    { id: 'francesco', name: 'Francesco', shortName: 'Francesco', avatarColor: '#dc2626' },
    { id: 'luca', name: 'Luca', shortName: 'Luca', avatarColor: '#4f46e5' },
    { id: 'simone', name: 'Simone', shortName: 'Simone', avatarColor: '#0891b2' },
    { id: 'michael', name: 'Michael', shortName: 'Michael', avatarColor: '#be123c' },
    { id: 'matteo', name: 'Matteo', shortName: 'Matteo', avatarColor: '#1d4ed8' },
    { id: 'sandru', name: 'Sandru', shortName: 'Sandru', avatarColor: '#ea580c' },
    { id: 'andrea', name: 'Andrea', shortName: 'Andrea', avatarColor: '#0d9488' },
    { id: 'michele-aiello', name: 'Michele', shortName: 'Michele', avatarColor: '#7c3aed' },
    { id: 'fusco', name: 'Fusco', shortName: 'Fusco', avatarColor: '#b91c1c' },
    { id: 'tizi', name: 'Tizi', shortName: 'Tizi', avatarColor: '#0369a1' },
    { id: 'frezza', name: 'Frezza', shortName: 'Frezza', avatarColor: '#16a34a' }
  ],
  customReasons: [
    { id: 'spogliatoio', icon: '🎒', label: 'Dimenticanza nello spogliatoio', isBuiltIn: true },
    { id: 'cartellino', icon: '🟨', label: 'Cartellino Giallo / Rosso', isBuiltIn: true },
    { id: 'fidanzamento', icon: '❤️', label: 'Si è fidanzato!', isBuiltIn: true },
    { id: 'patente', icon: '🚗', label: 'Patente / Auto nuova', isBuiltIn: true },
    { id: 'compleanno', icon: '🎂', label: 'Compleanno / Festeggiamento', isBuiltIn: true },
    { id: 'ritardo-allenamento', icon: '⏰', label: 'Ritardo in allenamento', isBuiltIn: true },
    { id: 'evento-importante', icon: '🥂', label: 'Evento importante', isBuiltIn: true }
  ],
  pasteEntries: []
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.players || !Array.isArray(parsed.players)) parsed.players = DEFAULT_DB.players;
    if (!parsed.customReasons || !Array.isArray(parsed.customReasons)) parsed.customReasons = DEFAULT_DB.customReasons;
    if (!parsed.pasteEntries || !Array.isArray(parsed.pasteEntries)) parsed.pasteEntries = [];
    if (!parsed.adminCode) parsed.adminCode = DEFAULT_DB.adminCode;
    return parsed;
  } catch (err) {
    console.error('Error reading db.json, resetting to default:', err);
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function fetchJsonHttps(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (VolleyLadispoliHub/1.0)',
        'Accept': 'application/json'
      },
      timeout: 6000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJsonHttps(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject).on('timeout', function () {
      this.destroy(new Error('Request timeout'));
    });
  });
}

let fipavCache = {
  lastUpdated: 0,
  calendar: null,
  tables: null
};

async function getFipavData(forceRefresh = false) {
  const now = Date.now();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  if (!forceRefresh && fipavCache.calendar && fipavCache.tables && (now - fipavCache.lastUpdated < CACHE_TTL)) {
    return {
      calendar: fipavCache.calendar,
      tables: fipavCache.tables,
      source: 'memory-cache',
      updatedAt: new Date(fipavCache.lastUpdated).toISOString()
    };
  }

  try {
    const [calData, tabData] = await Promise.all([
      fetchJsonHttps('https://data.fipavonline.it/api/v2/calendar/0/64602'),
      fetchJsonHttps('https://data.fipavonline.it/api/v2/tables/64602')
    ]);
    fipavCache = {
      lastUpdated: now,
      calendar: calData,
      tables: tabData
    };
    try {
      fs.writeFileSync(FIPAV_CAL_FILE, JSON.stringify(calData), 'utf8');
      fs.writeFileSync(FIPAV_TAB_FILE, JSON.stringify(tabData), 'utf8');
    } catch (_) {}
    return {
      calendar: calData,
      tables: tabData,
      source: 'live-fipav',
      updatedAt: new Date(now).toISOString()
    };
  } catch (err) {
    // Fallback to local disk files
    const calRaw = fs.existsSync(FIPAV_CAL_FILE) ? JSON.parse(fs.readFileSync(FIPAV_CAL_FILE, 'utf8')) : { data: { matches: [] } };
    const tabRaw = fs.existsSync(FIPAV_TAB_FILE) ? JSON.parse(fs.readFileSync(FIPAV_TAB_FILE, 'utf8')) : [];
    fipavCache = {
      lastUpdated: now,
      calendar: calRaw,
      tables: tabRaw
    };
    return {
      calendar: calRaw,
      tables: tabRaw,
      source: 'local-cache',
      updatedAt: fs.existsSync(FIPAV_CAL_FILE) ? fs.statSync(FIPAV_CAL_FILE).mtime.toISOString() : new Date().toISOString()
    };
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Code'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function checkAdmin(req, body, db) {
  const headerCode = req.headers['x-admin-code'];
  const bodyCode = body && body.adminCode;
  const provided = (headerCode || bodyCode || '').trim();
  return provided && provided === db.adminCode;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ics': 'text/calendar; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // API ROUTES
    if (pathname === '/api/state' && req.method === 'GET') {
      const db = ensureDb();
      return sendJson(res, 200, {
        players: db.players,
        customReasons: db.customReasons,
        pasteEntries: db.pasteEntries
      });
    }

    if (pathname === '/api/admin/verify' && req.method === 'POST') {
      const db = ensureDb();
      const body = await parseBody(req);
      const valid = Boolean(body.code && body.code.trim() === db.adminCode);
      if (!valid) {
        return sendJson(res, 401, { valid: false, error: 'Codice Admin non valido' });
      }
      return sendJson(res, 200, { valid: true });
    }

    if (pathname === '/api/admin/change-code' && req.method === 'POST') {
      const db = ensureDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: 'Codice Admin attuale errato' });
      }
      const newCode = (body.newCode || '').trim();
      if (newCode.length < 3) {
        return sendJson(res, 400, { error: 'Il nuovo codice deve avere almeno 3 caratteri' });
      }
      db.adminCode = newCode;
      saveDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/paste' && req.method === 'POST') {
      const db = ensureDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: 'Codice Admin richiesto o non valido' });
      }

      const {
        playerId,
        categoryIcon,
        reasonTitle,
        reasonDetails,
        quantity,
        incidentDate,
        dueDate,
        saveAsPreset
      } = body;

      const player = db.players.find(p => p.id === playerId);
      if (!player) {
        return sendJson(res, 400, { error: 'Giocatore non trovato' });
      }
      if (!reasonTitle || !reasonTitle.trim()) {
        return sendJson(res, 400, { error: 'Inserisci il motivo delle paste' });
      }
      if (!incidentDate) {
        return sendJson(res, 400, { error: 'Inserisci la data dell\'accaduto' });
      }

      const cleanTitle = reasonTitle.trim();
      const cleanIcon = (categoryIcon || '🥐').trim();

      if (saveAsPreset) {
        const exists = db.customReasons.some(r => r.label.toLowerCase() === cleanTitle.toLowerCase());
        if (!exists) {
          db.customReasons.push({
            id: 'custom-' + Date.now(),
            icon: cleanIcon,
            label: cleanTitle,
            isBuiltIn: false
          });
        }
      }

      const entry = {
        id: 'paste-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        playerId: player.id,
        categoryIcon: cleanIcon,
        reasonTitle: cleanTitle,
        reasonDetails: (reasonDetails || '').trim(),
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        incidentDate,
        dueDate: dueDate ? dueDate : null,
        status: 'pending',
        completedDate: null,
        createdAt: new Date().toISOString()
      };

      db.pasteEntries.unshift(entry);
      saveDb(db);
      return sendJson(res, 201, {
        entry,
        customReasons: db.customReasons,
        pasteEntries: db.pasteEntries
      });
    }

    if (pathname.startsWith('/api/paste/') && req.method === 'PUT') {
      const db = ensureDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: 'Codice Admin richiesto o non valido' });
      }
      const id = pathname.replace('/api/paste/', '');
      const idx = db.pasteEntries.findIndex(e => e.id === id);
      if (idx === -1) {
        return sendJson(res, 404, { error: 'Voce non trovata' });
      }

      const current = db.pasteEntries[idx];
      if (body.playerId !== undefined) current.playerId = body.playerId;
      if (body.categoryIcon !== undefined) current.categoryIcon = body.categoryIcon;
      if (body.reasonTitle !== undefined) current.reasonTitle = body.reasonTitle.trim();
      if (body.reasonDetails !== undefined) current.reasonDetails = body.reasonDetails.trim();
      if (body.quantity !== undefined) current.quantity = Math.max(1, parseInt(body.quantity, 10) || 1);
      if (body.incidentDate !== undefined) current.incidentDate = body.incidentDate;
      if (body.dueDate !== undefined) current.dueDate = body.dueDate;
      if (body.status !== undefined) {
        current.status = body.status;
        if (body.status === 'completed' && !current.completedDate) {
          current.completedDate = body.completedDate || new Date().toISOString().slice(0, 10);
        } else if (body.status === 'pending') {
          current.completedDate = null;
        }
      }
      if (body.completedDate !== undefined && current.status === 'completed') {
        current.completedDate = body.completedDate;
      }

      saveDb(db);
      return sendJson(res, 200, {
        entry: current,
        pasteEntries: db.pasteEntries
      });
    }

    if (pathname.startsWith('/api/paste/') && req.method === 'DELETE') {
      const db = ensureDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: 'Codice Admin richiesto o non valido' });
      }
      const id = pathname.replace('/api/paste/', '');
      db.pasteEntries = db.pasteEntries.filter(e => e.id !== id);
      saveDb(db);
      return sendJson(res, 200, { pasteEntries: db.pasteEntries });
    }

    if (pathname === '/api/reasons' && req.method === 'POST') {
      const db = ensureDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: 'Codice Admin richiesto o non valido' });
      }
      const label = (body.label || '').trim();
      const icon = (body.icon || '🥐').trim();
      if (!label) {
        return sendJson(res, 400, { error: 'Inserisci il nome del motivo' });
      }
      const exists = db.customReasons.some(r => r.label.toLowerCase() === label.toLowerCase());
      if (!exists) {
        db.customReasons.push({
          id: 'custom-' + Date.now(),
          icon,
          label,
          isBuiltIn: false
        });
        saveDb(db);
      }
      return sendJson(res, 201, { customReasons: db.customReasons });
    }

    if (pathname.startsWith('/api/reasons/') && req.method === 'DELETE') {
      const db = ensureDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: 'Codice Admin richiesto o non valido' });
      }
      const id = pathname.replace('/api/reasons/', '');
      db.customReasons = db.customReasons.filter(r => r.id !== id);
      saveDb(db);
      return sendJson(res, 200, { customReasons: db.customReasons });
    }

    if (pathname === '/api/fipav' && req.method === 'GET') {
      const force = parsedUrl.searchParams.get('refresh') === '1';
      const data = await getFipavData(force);
      return sendJson(res, 200, data);
    }

    // STATIC FILES
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
    const absPath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      const ext = path.extname(absPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(absPath).pipe(res);
    } else {
      // Fallback SPA to index.html
      const indexHtml = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexHtml).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    }
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: err.message || 'Errore interno del server' });
  }
});

server.listen(PORT, () => {
  console.log(`🏐 Volley Ladispoli Hub attivo su http://localhost:${PORT}`);
});
