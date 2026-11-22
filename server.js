const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ALLOWED_FIPAV_GIRONI = new Set(['64602', '64591', '64854']);

function getFipavFiles(gironeId = '64602') {
  const gid = ALLOWED_FIPAV_GIRONI.has(gironeId) ? gironeId : '64602';
  return {
    calFile: path.join(DATA_DIR, `fipav_calendar_${gid}.json`),
    tabFile: path.join(DATA_DIR, `fipav_tables_${gid}.json`)
  };
}

const GITHUB_GIST_ID = (process.env.GITHUB_GIST_ID || '').trim();
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const GITHUB_GIST_FILENAME = 'volley-ladispoli-db.json';

const DEFAULT_DB = {
  adminCode: '098765',
  players: [
    { id: 'alessandro-paris', name: 'Paris', shortName: 'Paris', avatarColor: '#e11d48', avatarUrl: '/pp/PARIS.jpeg' },
    { id: 'apox', name: 'Apox', shortName: 'Apox', avatarColor: '#2563eb' },
    { id: 'emanuele', name: 'Emanuele', shortName: 'Emanuele', avatarColor: '#0284c7', avatarUrl: '/pp/IEMA.jpeg' },
    { id: 'francesco', name: 'Francesco', shortName: 'Francesco', avatarColor: '#dc2626', avatarUrl: '/pp/FRANCESCO.jpeg' },
    { id: 'luca', name: 'Luca', shortName: 'Luca', avatarColor: '#4f46e5', avatarUrl: '/pp/LUCA.jpeg' },
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
  pasteEntries: [],
  sandruProofs: [],
  users: {},
  videos: [],
  socks: [],
  femPhotos: []
};

const PHOTO_NAME_ALIASES = {
  paris: 'alessandro-paris',
  alessandro: 'alessandro-paris',
  iema: 'emanuele',
  emanuele: 'emanuele',
  francesco: 'francesco',
  luca: 'luca',
  apox: 'apox',
  simone: 'simone',
  michael: 'michael',
  matteo: 'matteo',
  sandru: 'sandru',
  andrea: 'andrea',
  michele: 'michele-aiello',
  fusco: 'fusco',
  tizi: 'tizi',
  frezza: 'frezza'
};

function attachProfilePhotos(players) {
  const dirs = [path.join(__dirname, 'pp'), path.join(PUBLIC_DIR, 'pp')];
  const foundByPlayerId = {};
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
        const base = path.basename(file, path.extname(file)).trim().toLowerCase();
        const mappedId = PHOTO_NAME_ALIASES[base] || base;
        foundByPlayerId[mappedId] = `/pp/${file}`;
      }
    } catch (_) {}
  }
  for (const p of players) {
    if (p.customAvatarUrl) {
      p.avatarUrl = p.customAvatarUrl;
    } else if (foundByPlayerId[p.id]) {
      p.avatarUrl = foundByPlayerId[p.id];
    } else {
      delete p.avatarUrl;
    }
  }
}

function getClaimedPlayersMap(db) {
  const claimed = {};
  if (!db || !db.users || typeof db.users !== 'object') return claimed;
  for (const u of Object.values(db.users)) {
    if (u && u.linkedPlayerId) {
      claimed[u.linkedPlayerId] = {
        userId: u.id,
        name: u.name || 'Giocatore'
      };
    }
  }
  return claimed;
}

function serializeFemPhotos(list, deviceId = '', isAdmin = false) {
  const did = String(deviceId || '').trim();
  return (Array.isArray(list) ? list : []).map(item => {
    const upvotes = Array.isArray(item.upvotes) ? item.upvotes : [];
    const canDelete = Boolean(isAdmin || (did && item.authorDeviceId && item.authorDeviceId === did));
    return {
      id: item.id,
      title: item.title || '',
      targetName: item.targetName || '',
      imageUrl: item.imageUrl || '',
      authorName: item.authorName || 'Squadra',
      upvotesCount: upvotes.length,
      hasUpvoted: Boolean(did && upvotes.includes(did)),
      canDelete,
      createdAt: item.createdAt || ''
    };
  });
}

function normalizeDb(rawObj) {
  const db = rawObj && typeof rawObj === 'object' ? rawObj : {};
  if (!db.players || !Array.isArray(db.players) || db.players.length === 0) {
    db.players = JSON.parse(JSON.stringify(DEFAULT_DB.players));
  }
  if (!db.customReasons || !Array.isArray(db.customReasons)) {
    db.customReasons = JSON.parse(JSON.stringify(DEFAULT_DB.customReasons));
  }
  if (!db.pasteEntries || !Array.isArray(db.pasteEntries)) db.pasteEntries = [];
  if (!db.sandruProofs || !Array.isArray(db.sandruProofs)) db.sandruProofs = [];
  if (!db.users || typeof db.users !== 'object' || Array.isArray(db.users)) db.users = {};
  if (!db.videos || !Array.isArray(db.videos)) db.videos = [];
  if (!db.socks || !Array.isArray(db.socks)) db.socks = [];
  if (!db.femPhotos || !Array.isArray(db.femPhotos)) db.femPhotos = [];
  if (!db.adminCode) db.adminCode = DEFAULT_DB.adminCode;
  attachProfilePhotos(db.players);
  return db;
}

function ensureLocalDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return normalizeDb(JSON.parse(raw));
  } catch (err) {
    console.error('Error reading db.json, resetting to default:', err);
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
    return normalizeDb(JSON.parse(JSON.stringify(DEFAULT_DB)));
  }
}

function saveLocalDb(db) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function httpsRequestJson(targetUrl, options = {}, bodyStr = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const reqOpts = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: Object.assign({ 'Accept': 'application/json' }, options.headers || {}),
      timeout: options.timeout || 10000
    };
    if (bodyStr !== null) {
      reqOpts.headers['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8');
    }

    const req = https.request(reqOpts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (!options.method || options.method === 'GET')) {
        return httpsRequestJson(res.headers.location, options, null).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            return reject(e);
          }
          parsed = { raw: text };
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const msg = (parsed && parsed.message) || `HTTP ${res.statusCode}`;
          return reject(new Error(msg));
        }
        resolve(parsed);
      });
    });

    req.on('error', reject);
    req.on('timeout', function () {
      this.destroy(new Error('Request timeout'));
    });

    if (bodyStr !== null) {
      req.write(bodyStr, 'utf8');
    }
    req.end();
  });
}

function fetchJsonHttps(url) {
  return httpsRequestJson(url, {
    method: 'GET',
    timeout: 6000,
    headers: { 'User-Agent': 'Mozilla/5.0 (VolleyLadispoliHub/2.0)' }
  });
}

function isGistEnabled() {
  return Boolean(GITHUB_GIST_ID && GITHUB_TOKEN);
}

async function uploadDataUriToCloudinary(dataUri, subFolder = 'fem-photos') {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `volley-ladispoli/${subFolder}`;
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const formBody = new URLSearchParams({
    file: dataUri,
    folder,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature
  }).toString();

  const resp = await httpsRequestJson(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    {
      method: 'POST',
      timeout: 20000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    },
    formBody
  );
  return resp && typeof resp.secure_url === 'string' && resp.secure_url ? resp.secure_url : null;
}

let dbCache = null;
let dbLoaded = false;
let dbLoadPromise = null;
let dbWriteQueue = Promise.resolve();

async function loadDbFromGist() {
  const gist = await httpsRequestJson(`https://api.github.com/gists/${GITHUB_GIST_ID}`, {
    method: 'GET',
    timeout: 8000,
    headers: {
      'User-Agent': 'VolleyLadispoliHub/2.0',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json'
    }
  });
  const fileEntry = gist?.files?.[GITHUB_GIST_FILENAME];
  if (!fileEntry) return null;
  if (fileEntry.truncated && fileEntry.raw_url) {
    const rawJson = await httpsRequestJson(fileEntry.raw_url, {
      method: 'GET',
      timeout: 12000,
      headers: {
        'User-Agent': 'VolleyLadispoliHub/2.0',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      }
    });
    return normalizeDb(rawJson);
  }
  if (typeof fileEntry.content === 'string') {
    return normalizeDb(JSON.parse(fileEntry.content));
  }
  return null;
}

async function saveDbToGist(db) {
  const payload = JSON.stringify({
    files: {
      [GITHUB_GIST_FILENAME]: {
        content: JSON.stringify(db, null, 2)
      }
    }
  });
  await httpsRequestJson(`https://api.github.com/gists/${GITHUB_GIST_ID}`, {
    method: 'PATCH',
    timeout: 10000,
    headers: {
      'User-Agent': 'VolleyLadispoliHub/2.0',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }
  }, payload);
}

async function loadDb() {
  if (dbLoaded && dbCache) return dbCache;
  if (dbLoadPromise) return dbLoadPromise;

  dbLoadPromise = (async () => {
    let db = ensureLocalDb();
    if (isGistEnabled()) {
      try {
        const remoteDb = await loadDbFromGist();
        if (remoteDb) {
          db = remoteDb;
          saveLocalDb(db);
        }
      } catch (err) {
        console.warn('Gist load warning (usata copia locale):', err.message);
      }
    }
    dbCache = db;
    dbLoaded = true;
    dbLoadPromise = null;
    return dbCache;
  })();

  return dbLoadPromise;
}

async function persistDb(db) {
  dbCache = normalizeDb(db);
  dbLoaded = true;
  saveLocalDb(dbCache);

  if (isGistEnabled()) {
    const snapshot = JSON.parse(JSON.stringify(dbCache));
    const writeOp = dbWriteQueue.then(() => saveDbToGist(snapshot));
    dbWriteQueue = writeOp.catch(() => {});
    await writeOp;
  }
}

// ==========================================
// SESSION AUTH (HMAC-SHA256)
// ==========================================
const SESSION_COOKIE_NAME = 'vl_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getSessionSecret(db) {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) {
    return process.env.SESSION_SECRET.trim();
  }
  return crypto
    .createHash('sha256')
    .update(`${db.adminCode || '098765'}:vl-session-v1`)
    .digest('hex');
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64').toString('utf8');
}

function signSessionToken(userId, secret) {
  const payload = base64UrlEncode(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS }));
  const sig = base64UrlEncode(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = base64UrlEncode(crypto.createHmac('sha256', secret).update(payload).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const data = JSON.parse(base64UrlDecode(payload));
    if (!data || !data.uid || !data.exp || data.exp <= Date.now()) return null;
    return data.uid;
  } catch (_) {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie || '';
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch (_) {
        out[key] = val;
      }
    }
  }
  return out;
}

function getCurrentUser(req, db) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const secret = getSessionSecret(db);
  const uid = verifySessionToken(token, secret);
  if (!uid) return null;
  return (db.users && db.users[uid]) || null;
}

function buildSessionCookie(req, token, clear = false) {
  const isHttps = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket && req.socket.encrypted);
  const maxAge = clear ? 0 : Math.floor(SESSION_TTL_MS / 1000);
  const val = clear ? '' : encodeURIComponent(token);
  return `${SESSION_COOKIE_NAME}=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps ? '; Secure' : ''}`;
}

// ==========================================
// VIDEO LINK PARSER
// ==========================================
function parseVideoLink(rawUrl, explicitThumb = '') {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return { error: 'Inserisci il link o carica un file video' };

  if (trimmed.startsWith('/uploads/')) {
    return {
      mediaUrl: trimmed,
      sourceType: 'mp4',
      embedUrl: '',
      thumbUrl: explicitThumb || ''
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_) {
    return { error: 'Link non valido' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { error: 'Usa un link https://' };
  }

  const host = parsed.hostname.toLowerCase();

  // Google Drive
  if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
    let driveId = '';
    const mFile = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (mFile) driveId = mFile[1];
    if (!driveId) {
      const qId = parsed.searchParams.get('id');
      if (qId && /^[a-zA-Z0-9_-]{10,}$/.test(qId)) driveId = qId;
    }
    if (driveId) {
      return {
        mediaUrl: trimmed,
        sourceType: 'gdrive',
        embedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
        thumbUrl: explicitThumb || `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`
      };
    }
    return {
      mediaUrl: trimmed,
      sourceType: 'gdrive',
      embedUrl: '',
      thumbUrl: explicitThumb || ''
    };
  }

  // YouTube / Shorts
  if (host.includes('youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) {
    let ytId = '';
    if (host.includes('youtu.be')) {
      ytId = parsed.pathname.replace(/^\//, '').split('/')[0];
    } else if (parsed.pathname.startsWith('/shorts/')) {
      ytId = parsed.pathname.split('/')[2] || '';
    } else if (parsed.pathname.startsWith('/embed/')) {
      ytId = parsed.pathname.split('/')[2] || '';
    } else {
      ytId = parsed.searchParams.get('v') || '';
    }
    if (ytId && /^[a-zA-Z0-9_-]{6,20}$/.test(ytId)) {
      return {
        mediaUrl: trimmed,
        sourceType: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${ytId}`,
        thumbUrl: explicitThumb || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
      };
    }
  }

  // Instagram
  if (host.includes('instagram.com')) {
    return {
      mediaUrl: trimmed,
      sourceType: 'instagram',
      embedUrl: '',
      thumbUrl: explicitThumb || ''
    };
  }

  // TikTok
  if (host.includes('tiktok.com')) {
    return {
      mediaUrl: trimmed,
      sourceType: 'tiktok',
      embedUrl: '',
      thumbUrl: explicitThumb || ''
    };
  }

  // Direct MP4 / MOV / WEBM / Cloudinary
  return {
    mediaUrl: trimmed,
    sourceType: 'mp4',
    embedUrl: '',
    thumbUrl: explicitThumb || ''
  };
}

// ==========================================
// FIPAV DATA CACHE
// ==========================================
const fipavCacheByGirone = new Map();

async function getFipavData(gironeId = '64602', forceRefresh = false) {
  const gid = ALLOWED_FIPAV_GIRONI.has(String(gironeId || '')) ? String(gironeId) : '64602';
  const { calFile, tabFile } = getFipavFiles(gid);
  const cached = fipavCacheByGirone.get(gid) || { lastUpdated: 0, calendar: null, tables: null };
  const now = Date.now();
  const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  if (!forceRefresh && cached.calendar && cached.tables && (now - cached.lastUpdated < CACHE_TTL)) {
    return {
      calendar: cached.calendar,
      tables: cached.tables,
      source: 'memory-cache',
      updatedAt: new Date(cached.lastUpdated).toISOString()
    };
  }

  try {
    const [calData, tabData] = await Promise.all([
      fetchJsonHttps(`https://data.fipavonline.it/api/v2/calendar/0/${gid}`),
      fetchJsonHttps(`https://data.fipavonline.it/api/v2/tables/${gid}`)
    ]);
    fipavCacheByGirone.set(gid, {
      lastUpdated: now,
      calendar: calData,
      tables: tabData
    });
    try {
      fs.writeFileSync(calFile, JSON.stringify(calData), 'utf8');
      fs.writeFileSync(tabFile, JSON.stringify(tabData), 'utf8');
    } catch (_) {}
    return {
      calendar: calData,
      tables: tabData,
      source: 'live-fipav',
      updatedAt: new Date(now).toISOString()
    };
  } catch (err) {
    const calRaw = fs.existsSync(calFile) ? JSON.parse(fs.readFileSync(calFile, 'utf8')) : { data: { matches: [] } };
    const tabRaw = fs.existsSync(tabFile) ? JSON.parse(fs.readFileSync(tabFile, 'utf8')) : [];
    fipavCacheByGirone.set(gid, {
      lastUpdated: now,
      calendar: calRaw,
      tables: tabRaw
    });
    return {
      calendar: calRaw,
      tables: tabRaw,
      source: 'local-cache',
      updatedAt: fs.existsSync(calFile) ? fs.statSync(calFile).mtime.toISOString() : new Date().toISOString()
    };
  }
}

// ==========================================
// HTTP HELPERS
// ==========================================
function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Code, X-Filename, X-Device-Id'
  }, extraHeaders));
  res.end(JSON.stringify(payload));
}

function parseBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        const err = new Error('Richiesta troppo grande (riduci la dimensione dei file)');
        err.status = 413;
        return reject(err);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        const err = new Error('JSON non valido');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseRawBody(req, maxBytes = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        const err = new Error('File troppo grande (max 15 MB)');
        err.status = 413;
        return reject(err);
      }
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function checkAdmin(req, body, db) {
  const headerCode = req.headers['x-admin-code'];
  const bodyCode = body && body.adminCode;
  const provided = (headerCode || bodyCode || '').trim();
  return Boolean(provided && provided === db.adminCode);
}

const WRONG_PIN_MSG = '⚠️ PIN errato! Attenzione: se sei Sandru che sta provando a fare l\'accesso di nascosto, il tuo telefono verrà bloccato all\'istante (e porti 2 vassoi di paste).';

function validateSandruJpegProof(rawValue, label) {
  const val = String(rawValue || '').trim();
  if (!val) {
    return { valid: false, error: `Manca la foto JPEG (${label})` };
  }

  // Case 1: Base64 JPEG Data URL (strictly JPEG + magic bytes check)
  const dataMatch = val.match(/^data:image\/(jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (dataMatch) {
    const cleanB64 = dataMatch[2].replace(/\s+/g, '');
    let buf;
    try {
      buf = Buffer.from(cleanB64, 'base64');
    } catch (_) {
      return { valid: false, error: `Foto JPEG non valida (${label})` };
    }
    if (!buf || buf.length < 100) {
      return { valid: false, error: `File JPEG troppo piccolo o danneggiato (${label})` };
    }
    if (buf.length > 750 * 1024) {
      return { valid: false, error: `Foto JPEG troppo pesante dopo la compressione (${label})` };
    }
    // Check JPEG SOI marker (0xFF 0xD8 0xFF) and EOI marker (0xFF 0xD9)
    const hasSoi = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const hasEoi = buf.lastIndexOf(Buffer.from([0xFF, 0xD9])) > 2;
    if (!hasSoi || !hasEoi) {
      return { valid: false, error: `Il file per "${label}" non è un vero JPEG (.jpg / .jpeg)` };
    }
    const fingerprint = crypto.createHash('sha256').update(buf).digest('hex');
    return { valid: true, value: `data:image/jpeg;base64,${cleanB64}`, fingerprint };
  }

  // Case 2: Configured Cloudinary URL ending strictly in .jpg/.jpeg
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  if (cloudName && val.startsWith(`https://res.cloudinary.com/${cloudName}/`)) {
    try {
      const parsed = new URL(val);
      if (/\.jpe?g$/i.test(parsed.pathname)) {
        return { valid: true, value: val, fingerprint: val };
      }
    } catch (_) {}
  }

  // Case 3: Local /uploads/ file that actually exists on disk and has JPEG magic bytes
  if (val.startsWith('/uploads/')) {
    const fileName = path.basename(val.split('?')[0]);
    const absUpload = path.join(UPLOADS_DIR, fileName);
    if (/\.jpe?g$/i.test(fileName) && fs.existsSync(absUpload) && fs.statSync(absUpload).isFile()) {
      const diskBuf = fs.readFileSync(absUpload);
      const hasSoi = diskBuf.length >= 100 && diskBuf[0] === 0xFF && diskBuf[1] === 0xD8 && diskBuf[2] === 0xFF;
      const hasEoi = diskBuf.lastIndexOf(Buffer.from([0xFF, 0xD9])) > 2;
      if (hasSoi && hasEoi) {
        const fingerprint = crypto.createHash('sha256').update(diskBuf).digest('hex');
        return { valid: true, value: `/uploads/${fileName}`, fingerprint };
      }
    }
  }

  return { valid: false, error: `Solo formato JPEG (.jpg / .jpeg) consentito per "${label}"` };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ics': 'text/calendar; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm'
};

function serveFileWithRange(req, res, absPath) {
  const stat = fs.statSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const total = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
    if (isNaN(start) || isNaN(end) || start >= total || end >= total || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      return res.end();
    }
    const chunkSize = (end - start) + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    });
    fs.createReadStream(absPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': total,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType
    });
    fs.createReadStream(absPath).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // HEALTH & CONFIG
    if (pathname === '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        return res.end();
      }
      return sendJson(res, 200, {
        ok: true,
        persistence: isGistEnabled() ? 'github-gist' : 'local-disk',
        uptime: Math.round(process.uptime())
      });
    }

    if (pathname === '/api/config' && req.method === 'GET') {
      const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
      const cloudKey = (process.env.CLOUDINARY_API_KEY || '').trim();
      const cloudSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
      return sendJson(res, 200, {
        googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
        cloudinaryCloudName: cloudName,
        cloudinaryEnabled: Boolean(cloudName && cloudKey && cloudSecret),
        persistence: isGistEnabled() ? 'github-gist' : 'local-disk'
      });
    }

    // AUTH GOOGLE & SESSION
    if (pathname === '/api/auth/google' && req.method === 'POST') {
      const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
      if (!googleClientId) {
        return sendJson(res, 503, { error: 'Login Google non ancora configurato (manca GOOGLE_CLIENT_ID su Render)' });
      }
      const db = await loadDb();
      const body = await parseBody(req);
      const credential = (body.credential || '').trim();
      if (!credential) {
        return sendJson(res, 400, { error: 'Token Google mancante' });
      }

      let info;
      try {
        info = await fetchJsonHttps(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      } catch (err) {
        return sendJson(res, 401, { error: 'Verifica token Google fallita' });
      }

      if (!info || info.aud !== googleClientId) {
        return sendJson(res, 401, { error: 'Client ID Google non corrispondente' });
      }
      if (info.email_verified !== 'true' && info.email_verified !== true) {
        return sendJson(res, 401, { error: 'Email Google non verificata' });
      }

      const existing = db.users[info.sub] || {};
      const googlePic = info.picture || existing.googlePicture || '';
      const customPic = existing.customPicture || '';
      const userObj = {
        id: info.sub,
        name: info.name || info.given_name || info.email || 'Giocatore',
        email: info.email || '',
        googlePicture: googlePic,
        customPicture: customPic,
        picture: customPic || googlePic || '',
        linkedPlayerId: existing.linkedPlayerId || '',
        createdAt: existing.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      db.users[info.sub] = userObj;
      await persistDb(db);

      const token = signSessionToken(userObj.id, getSessionSecret(db));
      return sendJson(res, 200, { user: userObj, claimedPlayers: getClaimedPlayersMap(db) }, {
        'Set-Cookie': buildSessionCookie(req, token, false)
      });
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const db = await loadDb();
      return sendJson(res, 200, {
        user: getCurrentUser(req, db),
        claimedPlayers: getClaimedPlayersMap(db)
      });
    }

    if (pathname === '/api/auth/link-player' && req.method === 'POST') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      if (!user) {
        return sendJson(res, 401, { error: 'Accedi con Google prima di collegare il giocatore' });
      }
      const body = await parseBody(req);
      const pid = String(body.playerId || '').trim();
      if (pid && !db.players.some(p => p.id === pid)) {
        return sendJson(res, 400, { error: 'Giocatore non trovato nella rosa' });
      }
      if (pid) {
        const owner = Object.values(db.users || {}).find(
          u => u && u.linkedPlayerId === pid && u.id !== user.id
        );
        if (owner) {
          return sendJson(res, 409, {
            error: `Questo giocatore è già stato verificato da ${owner.name || 'un altro account'}`
          });
        }
      }
      const oldPid = user.linkedPlayerId || '';
      user.linkedPlayerId = pid;
      db.users[user.id] = user;

      if (user.customPicture) {
        if (oldPid && oldPid !== pid) {
          const oldPlayer = db.players.find(p => p.id === oldPid);
          if (oldPlayer && oldPlayer.customAvatarUrl === user.customPicture) {
            delete oldPlayer.customAvatarUrl;
          }
        }
        if (pid) {
          const newPlayer = db.players.find(p => p.id === pid);
          if (newPlayer) newPlayer.customAvatarUrl = user.customPicture;
        }
        attachProfilePhotos(db.players);
      }

      await persistDb(db);
      return sendJson(res, 200, {
        user,
        players: db.players,
        claimedPlayers: getClaimedPlayersMap(db)
      });
    }

    if (pathname === '/api/auth/avatar' && req.method === 'POST') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      if (!user) {
        return sendJson(res, 401, { error: 'Accedi con Google per impostare la foto profilo' });
      }
      const body = await parseBody(req, 1.5 * 1024 * 1024);
      const avatarUrl = String(body.avatarUrl || '').trim();

      if (avatarUrl) {
        const isDataImage = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(avatarUrl);
        const isSafeUrl = avatarUrl.startsWith('/uploads/') || avatarUrl.startsWith('https://') || avatarUrl.startsWith('http://');
        if (!isDataImage && !isSafeUrl) {
          return sendJson(res, 400, { error: 'Formato foto profilo non supportato' });
        }
        if (isDataImage && avatarUrl.length > 450 * 1024) {
          return sendJson(res, 400, { error: 'Foto profilo troppo pesante' });
        }
      }

      user.customPicture = avatarUrl;
      user.picture = avatarUrl || user.googlePicture || '';
      db.users[user.id] = user;

      if (user.linkedPlayerId) {
        const linked = db.players.find(p => p.id === user.linkedPlayerId);
        if (linked) {
          if (avatarUrl) {
            linked.customAvatarUrl = avatarUrl;
          } else {
            delete linked.customAvatarUrl;
          }
          attachProfilePhotos(db.players);
        }
      }

      for (const v of db.videos) {
        if (v.authorId === user.id) v.authorPicture = user.picture;
      }
      for (const s of db.socks) {
        if (s.authorId === user.id) s.authorPicture = user.picture;
      }

      await persistDb(db);
      return sendJson(res, 200, { user, players: db.players });
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true }, {
        'Set-Cookie': buildSessionCookie(req, '', true)
      });
    }

    // STATE
    if (pathname === '/api/state' && req.method === 'GET') {
      const db = await loadDb();
      return sendJson(res, 200, {
        players: db.players,
        customReasons: db.customReasons,
        pasteEntries: db.pasteEntries,
        sandruProofs: db.sandruProofs,
        videos: db.videos,
        socks: db.socks,
        currentUser: getCurrentUser(req, db),
        claimedPlayers: getClaimedPlayersMap(db)
      });
    }

    // ADMIN
    if (pathname === '/api/admin/verify' && req.method === 'POST') {
      const db = await loadDb();
      const body = await parseBody(req);
      const valid = Boolean(body.code && body.code.trim() === db.adminCode);
      if (!valid) {
        return sendJson(res, 401, { valid: false, error: WRONG_PIN_MSG });
      }
      return sendJson(res, 200, { valid: true });
    }

    if (pathname === '/api/admin/change-code' && req.method === 'POST') {
      const db = await loadDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: WRONG_PIN_MSG });
      }
      const newCode = (body.newCode || '').trim();
      if (newCode.length < 3) {
        return sendJson(res, 400, { error: 'Il nuovo codice deve avere almeno 3 caratteri' });
      }
      db.adminCode = newCode;
      await persistDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/unlink-player' && req.method === 'POST') {
      const db = await loadDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: WRONG_PIN_MSG });
      }
      const playerId = String(body.playerId || '').trim();
      if (!playerId) {
        return sendJson(res, 400, { error: 'ID giocatore mancante' });
      }
      const targetPlayer = db.players.find(p => p.id === playerId);
      let avatarChanged = false;
      for (const u of Object.values(db.users || {})) {
        if (u && u.linkedPlayerId === playerId) {
          u.linkedPlayerId = '';
          if (targetPlayer && u.customPicture && targetPlayer.customAvatarUrl === u.customPicture) {
            delete targetPlayer.customAvatarUrl;
            avatarChanged = true;
          }
        }
      }
      if (avatarChanged) {
        attachProfilePhotos(db.players);
      }
      await persistDb(db);
      return sendJson(res, 200, {
        ok: true,
        players: db.players,
        claimedPlayers: getClaimedPlayersMap(db)
      });
    }

    // PASTE CRUD
    if (pathname === '/api/paste' && req.method === 'POST') {
      const db = await loadDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: WRONG_PIN_MSG });
      }

      const {
        playerId,
        categoryIcon,
        reasonTitle,
        reasonDetails,
        quantity,
        incidentDate,
        incidentLabel,
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
        incidentLabel: (incidentLabel || '').trim(),
        dueDate: dueDate ? dueDate : null,
        status: 'pending',
        completedDate: null,
        createdAt: new Date().toISOString()
      };

      db.pasteEntries.unshift(entry);
      await persistDb(db);
      return sendJson(res, 201, {
        entry,
        customReasons: db.customReasons,
        pasteEntries: db.pasteEntries
      });
    }

    if (pathname.startsWith('/api/paste/') && pathname.endsWith('/sandru-clear') && req.method === 'POST') {
      const db = await loadDb();
      const body = await parseBody(req, 3 * 1024 * 1024);
      const id = pathname.slice('/api/paste/'.length, -'/sandru-clear'.length);
      const entry = db.pasteEntries.find(e => e.id === id);

      if (!entry) {
        return sendJson(res, 404, { error: 'Pasta non trovata' });
      }
      if (entry.playerId !== 'sandru') {
        return sendJson(res, 403, { error: 'Questa opzione di verifica è valida esclusivamente per le paste di Sandru' });
      }
      if (entry.status === 'completed') {
        return sendJson(res, 400, { error: 'Questa pasta risulta già portata e archiviata.' });
      }

      const docCheck = validateSandruJpegProof(body.docPhoto, 'Foto con documento in mano');
      if (!docCheck.valid) {
        return sendJson(res, 400, { error: docCheck.error });
      }
      const receiptCheck = validateSandruJpegProof(body.receiptPhoto, 'Foto scontrino delle paste');
      if (!receiptCheck.valid) {
        return sendJson(res, 400, { error: receiptCheck.error });
      }
      if (docCheck.value === receiptCheck.value || (docCheck.fingerprint && docCheck.fingerprint === receiptCheck.fingerprint)) {
        return sendJson(res, 400, { error: 'Furbacchione Sandru! Hai caricato la stessa foto due volte: servono sia il documento in mano sia lo scontrino.' });
      }

      const proof = {
        id: 'sproof-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        entryId: entry.id,
        playerId: 'sandru',
        reasonTitle: entry.reasonTitle,
        incidentDate: entry.incidentDate,
        incidentLabel: entry.incidentLabel || '',
        docPhotoUrl: docCheck.value,
        receiptPhotoUrl: receiptCheck.value,
        clearedAt: new Date().toISOString()
      };

      db.pasteEntries = db.pasteEntries.filter(e => e.id !== id);
      db.sandruProofs.unshift(proof);
      await persistDb(db);

      return sendJson(res, 200, {
        ok: true,
        proof,
        pasteEntries: db.pasteEntries,
        sandruProofs: db.sandruProofs
      });
    }

    if (pathname.startsWith('/api/sandru-proofs/') && req.method === 'DELETE') {
      const db = await loadDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: WRONG_PIN_MSG });
      }
      const id = pathname.replace('/api/sandru-proofs/', '');
      const exists = db.sandruProofs.some(p => p.id === id);
      if (!exists) {
        return sendJson(res, 404, { error: 'Prova verifica non trovata' });
      }
      db.sandruProofs = db.sandruProofs.filter(p => p.id !== id);
      await persistDb(db);
      return sendJson(res, 200, { sandruProofs: db.sandruProofs });
    }

    if (pathname.startsWith('/api/paste/') && req.method === 'PUT') {
      const db = await loadDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: WRONG_PIN_MSG });
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
      if (body.incidentLabel !== undefined) current.incidentLabel = String(body.incidentLabel || '').trim();
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

      await persistDb(db);
      return sendJson(res, 200, {
        entry: current,
        pasteEntries: db.pasteEntries
      });
    }

    if (pathname.startsWith('/api/paste/') && req.method === 'DELETE') {
      const db = await loadDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: WRONG_PIN_MSG });
      }
      const id = pathname.replace('/api/paste/', '');
      db.pasteEntries = db.pasteEntries.filter(e => e.id !== id);
      await persistDb(db);
      return sendJson(res, 200, { pasteEntries: db.pasteEntries });
    }

    // REASONS
    if (pathname === '/api/reasons' && req.method === 'POST') {
      const db = await loadDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: WRONG_PIN_MSG });
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
        await persistDb(db);
      }
      return sendJson(res, 201, { customReasons: db.customReasons });
    }

    if (pathname.startsWith('/api/reasons/') && req.method === 'DELETE') {
      const db = await loadDb();
      const body = await parseBody(req);
      if (!checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: WRONG_PIN_MSG });
      }
      const id = pathname.replace('/api/reasons/', '');
      db.customReasons = db.customReasons.filter(r => r.id !== id);
      await persistDb(db);
      return sendJson(res, 200, { customReasons: db.customReasons });
    }

    // VIDEOS API
    if (pathname === '/api/videos' && req.method === 'POST') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      const body = await parseBody(req);
      const isAdmin = checkAdmin(req, body, db);

      if (!user && !isAdmin) {
        return sendJson(res, 401, { error: 'Accedi con Google per caricare un video' });
      }

      const category = body.category === 'match' ? 'match' : 'funny';
      const title = (body.title || '').trim();
      const description = (body.description || '').trim();
      if (!title) {
        return sendJson(res, 400, { error: 'Inserisci un titolo per il video' });
      }

      const parsedLink = parseVideoLink(body.mediaUrl, (body.thumbUrl || '').trim());
      if (parsedLink.error) {
        return sendJson(res, 400, { error: parsedLink.error });
      }

      const video = {
        id: 'vid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        category,
        title,
        description,
        sourceType: parsedLink.sourceType,
        mediaUrl: parsedLink.mediaUrl,
        embedUrl: parsedLink.embedUrl,
        thumbUrl: parsedLink.thumbUrl,
        likes: [],
        authorId: user ? user.id : 'admin',
        authorName: user ? user.name : 'Admin Spogliatoio',
        authorPicture: user ? user.picture : '',
        authorPlayerId: user ? (user.linkedPlayerId || '') : '',
        createdAt: new Date().toISOString()
      };

      db.videos.unshift(video);
      await persistDb(db);
      return sendJson(res, 201, { video, videos: db.videos });
    }

    if (pathname.startsWith('/api/videos/') && pathname.endsWith('/like') && req.method === 'POST') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      if (!user) {
        return sendJson(res, 401, { error: 'Accedi con Google per mettere Mi piace' });
      }
      const id = pathname.slice('/api/videos/'.length, -'/like'.length);
      const video = db.videos.find(v => v.id === id);
      if (!video) {
        return sendJson(res, 404, { error: 'Video non trovato' });
      }
      if (!Array.isArray(video.likes)) video.likes = [];
      const idx = video.likes.indexOf(user.id);
      if (idx === -1) {
        video.likes.push(user.id);
      } else {
        video.likes.splice(idx, 1);
      }
      await persistDb(db);
      return sendJson(res, 200, { video, videos: db.videos });
    }

    if (pathname.startsWith('/api/videos/') && req.method === 'DELETE') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      const body = await parseBody(req);
      const id = pathname.replace('/api/videos/', '');
      const video = db.videos.find(v => v.id === id);
      if (!video) {
        return sendJson(res, 404, { error: 'Video non trovato' });
      }
      const canDelete = checkAdmin(req, body, db) || (user && user.id === video.authorId);
      if (!canDelete) {
        return sendJson(res, 401, { error: 'Non autorizzato a eliminare questo video' });
      }
      db.videos = db.videos.filter(v => v.id !== id);
      await persistDb(db);
      return sendJson(res, 200, { videos: db.videos });
    }

    // SOCKS API ("Calzini più stilosi" + Upvote)
    if (pathname === '/api/socks' && req.method === 'POST') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      const body = await parseBody(req, 2 * 1024 * 1024);
      const isAdmin = checkAdmin(req, body, db);

      if (!user && !isAdmin) {
        return sendJson(res, 401, { error: 'Accedi con Google per caricare i calzini' });
      }

      const title = (body.title || '').trim();
      const playerId = (body.playerId || '').trim();
      const imageUrl = (body.imageUrl || '').trim();

      if (!title) {
        return sendJson(res, 400, { error: 'Dai un nome o descrizione ai calzini' });
      }
      if (!imageUrl) {
        return sendJson(res, 400, { error: 'Seleziona una foto dei calzini' });
      }

      const isDataImage = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageUrl);
      const isSafeUrl = imageUrl.startsWith('/uploads/') || imageUrl.startsWith('https://') || imageUrl.startsWith('http://');
      if (!isDataImage && !isSafeUrl) {
        return sendJson(res, 400, { error: 'Formato foto non supportato' });
      }
      if (isDataImage && imageUrl.length > 700 * 1024) {
        return sendJson(res, 400, { error: 'Foto troppo pesante dopo la compressione' });
      }

      const sock = {
        id: 'sock-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        title,
        playerId,
        imageUrl,
        upvotes: user ? [user.id] : [],
        authorId: user ? user.id : 'admin',
        authorName: user ? user.name : 'Admin Spogliatoio',
        authorPicture: user ? user.picture : '',
        authorPlayerId: user ? (user.linkedPlayerId || '') : '',
        createdAt: new Date().toISOString()
      };

      db.socks.unshift(sock);
      await persistDb(db);
      return sendJson(res, 201, { sock, socks: db.socks });
    }

    if (pathname.startsWith('/api/socks/') && pathname.endsWith('/upvote') && req.method === 'POST') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      if (!user) {
        return sendJson(res, 401, { error: 'Accedi con Google per votare i calzini' });
      }
      const id = pathname.slice('/api/socks/'.length, -'/upvote'.length);
      const sock = db.socks.find(s => s.id === id);
      if (!sock) {
        return sendJson(res, 404, { error: 'Foto calzini non trovata' });
      }
      if (!Array.isArray(sock.upvotes)) sock.upvotes = [];
      const idx = sock.upvotes.indexOf(user.id);
      if (idx === -1) {
        sock.upvotes.push(user.id);
      } else {
        sock.upvotes.splice(idx, 1);
      }
      await persistDb(db);
      return sendJson(res, 200, { sock, socks: db.socks });
    }

    if (pathname.startsWith('/api/socks/') && req.method === 'DELETE') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      const body = await parseBody(req);
      const id = pathname.replace('/api/socks/', '');
      const sock = db.socks.find(s => s.id === id);
      if (!sock) {
        return sendJson(res, 404, { error: 'Calzini non trovati' });
      }
      const canDelete = checkAdmin(req, body, db) || (user && user.id === sock.authorId);
      if (!canDelete) {
        return sendJson(res, 401, { error: 'Non autorizzato a eliminare questa foto' });
      }
      db.socks = db.socks.filter(s => s.id !== id);
      await persistDb(db);
      return sendJson(res, 200, { socks: db.socks });
    }

    // WOMEN'S FUNNY PHOTOS ("Foto divertenti" / "Spunnate")
    if (pathname === '/api/fem-photos' && req.method === 'GET') {
      const db = await loadDb();
      const deviceId = String(req.headers['x-device-id'] || '').trim().slice(0, 80);
      const isAdmin = checkAdmin(req, {}, db);
      return sendJson(res, 200, { photos: serializeFemPhotos(db.femPhotos, deviceId, isAdmin) });
    }

    if (pathname === '/api/fem-photos' && req.method === 'POST') {
      const db = await loadDb();
      const body = await parseBody(req, 2 * 1024 * 1024);
      const deviceId = String(body.deviceId || req.headers['x-device-id'] || '').trim().slice(0, 80);
      const isAdmin = checkAdmin(req, body, db);

      const title = String(body.title || '').trim().slice(0, 120);
      const authorName = String(body.authorName || '').trim().slice(0, 50);
      const targetName = String(body.targetName || '').trim().slice(0, 50);
      const imageUrl = String(body.imageUrl || '').trim();

      if (!title) {
        return sendJson(res, 400, { error: 'Scrivi una descrizione per la foto' });
      }
      if (!authorName) {
        return sendJson(res, 400, { error: 'Inserisci il tuo nome' });
      }
      if (!imageUrl) {
        return sendJson(res, 400, { error: 'Seleziona una foto da pubblicare' });
      }

      const isDataImage = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageUrl);
      const isSafeUrl = imageUrl.startsWith('/uploads/') || imageUrl.startsWith('https://') || imageUrl.startsWith('http://');
      if (!isDataImage && !isSafeUrl) {
        return sendJson(res, 400, { error: 'Formato foto non supportato' });
      }
      if (isDataImage && imageUrl.length > 700 * 1024) {
        return sendJson(res, 400, { error: 'Foto troppo pesante dopo la compressione' });
      }

      let finalImageUrl = imageUrl;
      if (isDataImage) {
        try {
          const cloudUrl = await uploadDataUriToCloudinary(imageUrl, 'fem-photos');
          if (cloudUrl) finalImageUrl = cloudUrl;
        } catch (err) {
          console.warn('Cloudinary fem-photo upload fallback:', err.message);
        }
      }

      const photo = {
        id: 'femphoto-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        title,
        targetName,
        imageUrl: finalImageUrl,
        authorName,
        authorDeviceId: deviceId,
        upvotes: deviceId ? [deviceId] : [],
        createdAt: new Date().toISOString()
      };

      db.femPhotos.unshift(photo);
      await persistDb(db);
      const serializedList = serializeFemPhotos(db.femPhotos, deviceId, isAdmin);
      return sendJson(res, 201, { photo: serializedList[0], photos: serializedList });
    }

    if (pathname.startsWith('/api/fem-photos/') && pathname.endsWith('/upvote') && req.method === 'POST') {
      const db = await loadDb();
      const body = await parseBody(req);
      const deviceId = String(body.deviceId || req.headers['x-device-id'] || '').trim().slice(0, 80);
      if (!deviceId) {
        return sendJson(res, 400, { error: 'Identificativo dispositivo mancante' });
      }
      const isAdmin = checkAdmin(req, body, db);
      const id = pathname.slice('/api/fem-photos/'.length, -'/upvote'.length);
      const photo = db.femPhotos.find(p => p.id === id);
      if (!photo) {
        return sendJson(res, 404, { error: 'Foto non trovata' });
      }
      if (!Array.isArray(photo.upvotes)) photo.upvotes = [];
      const idx = photo.upvotes.indexOf(deviceId);
      if (idx === -1) {
        photo.upvotes.push(deviceId);
      } else {
        photo.upvotes.splice(idx, 1);
      }
      await persistDb(db);
      return sendJson(res, 200, {
        photo: serializeFemPhotos([photo], deviceId, isAdmin)[0],
        photos: serializeFemPhotos(db.femPhotos, deviceId, isAdmin)
      });
    }

    if (pathname.startsWith('/api/fem-photos/') && req.method === 'DELETE') {
      const db = await loadDb();
      const body = await parseBody(req);
      const deviceId = String(body.deviceId || req.headers['x-device-id'] || '').trim().slice(0, 80);
      const isAdmin = checkAdmin(req, body, db);
      const id = pathname.slice('/api/fem-photos/'.length);
      const photo = db.femPhotos.find(p => p.id === id);
      if (!photo) {
        return sendJson(res, 404, { error: 'Foto non trovata' });
      }
      const canDelete = Boolean(isAdmin || (deviceId && photo.authorDeviceId && photo.authorDeviceId === deviceId));
      if (!canDelete) {
        return sendJson(res, 401, { error: 'Puoi eliminare solo le foto caricate dal tuo telefono' });
      }
      db.femPhotos = db.femPhotos.filter(p => p.id !== id);
      await persistDb(db);
      return sendJson(res, 200, { photos: serializeFemPhotos(db.femPhotos, deviceId, isAdmin) });
    }

    // MEDIA UPLOADS (Cloudinary signature + local fallback <= 15MB)
    if (pathname === '/api/upload/signature' && req.method === 'POST') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      const body = await parseBody(req);
      if (!user && !checkAdmin(req, body, db)) {
        return sendJson(res, 401, { error: 'Accedi con Google per caricare file' });
      }

      const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
      const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
      const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
      if (!cloudName || !apiKey || !apiSecret) {
        return sendJson(res, 503, { error: 'Cloudinary non configurato' });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const allowedFolders = new Set(['socks', 'videos', 'avatars', 'fem-photos']);
      const sub = allowedFolders.has(body.folder) ? body.folder : 'videos';
      const folder = `volley-ladispoli/${sub}`;
      const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(toSign).digest('hex');

      return sendJson(res, 200, { cloudName, apiKey, timestamp, folder, signature });
    }

    if (pathname === '/api/upload/file' && req.method === 'POST') {
      const db = await loadDb();
      const user = getCurrentUser(req, db);
      if (!user && !checkAdmin(req, {}, db)) {
        return sendJson(res, 401, { error: 'Accedi con Google per caricare file' });
      }

      const rawHeaderName = String(req.headers['x-filename'] || 'video.mp4');
      let decodedName = rawHeaderName;
      try { decodedName = decodeURIComponent(rawHeaderName); } catch (_) {}
      const ext = path.extname(path.basename(decodedName)).toLowerCase();
      const allowedExts = ['.mp4', '.mov', '.webm', '.jpg', '.jpeg', '.png', '.webp'];
      if (!allowedExts.includes(ext)) {
        return sendJson(res, 400, { error: 'Estensione file non consentita (usa MP4, MOV, WEBM, JPG, PNG)' });
      }

      const buf = await parseRawBody(req, 15 * 1024 * 1024);
      if (!buf || buf.length === 0) {
        return sendJson(res, 400, { error: 'File vuoto' });
      }

      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      const safeName = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buf);
      return sendJson(res, 201, { url: `/uploads/${safeName}` });
    }

    // FIPAV LIVE PROXY
    if (pathname === '/api/fipav' && req.method === 'GET') {
      const girone = (parsedUrl.searchParams.get('girone') || '64602').trim();
      if (!ALLOWED_FIPAV_GIRONI.has(girone)) {
        return sendJson(res, 400, { error: 'Girone FIPAV non supportato' });
      }
      const force = parsedUrl.searchParams.get('refresh') === '1';
      const data = await getFipavData(girone, force);
      return sendJson(res, 200, data);
    }

    // EXTERNAL WOMEN'S CALENDAR (/femminile & /2df)
    if (pathname === '/femminile' || pathname === '/femminile/' || pathname === '/2df' || pathname === '/2df/') {
      const femHtml = path.join(PUBLIC_DIR, 'femminile.html');
      if (fs.existsSync(femHtml)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(femHtml).pipe(res);
      }
    }

    // UPLOADED FILES STATIC WITH RANGE SUPPORT
    if (pathname.startsWith('/uploads/')) {
      const fileName = path.basename(decodeURIComponent(pathname.slice('/uploads/'.length)));
      const absUpload = path.join(UPLOADS_DIR, fileName);
      if (fileName && fs.existsSync(absUpload) && fs.statSync(absUpload).isFile()) {
        return serveFileWithRange(req, res, absUpload);
      }
      res.writeHead(404);
      return res.end('Not Found');
    }

    // STATIC FILES
    let filePath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
    const safePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
    let absPath = path.join(PUBLIC_DIR, safePath);
    if ((!fs.existsSync(absPath)) && (safePath.startsWith(path.sep + 'pp' + path.sep) || safePath.startsWith('/pp/'))) {
      const rootPpCandidate = path.join(__dirname, safePath);
      if (fs.existsSync(rootPpCandidate)) {
        absPath = rootPpCandidate;
      }
    }

    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      return serveFileWithRange(req, res, absPath);
    }

    // Fallback SPA to index.html
    const indexHtml = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexHtml).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  } catch (err) {
    const status = (err && Number.isInteger(err.status)) ? err.status : 500;
    if (status >= 500) {
      console.error('Server error:', err);
    }
    sendJson(res, status, { error: err.message || 'Errore interno del server' });
  }
});

function startRenderKeepAlive() {
  const rawUrl = (process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
  if (!rawUrl || !rawUrl.startsWith('https://')) return;
  if (process.env.DISABLE_SELF_PING === '1') return;
  if (!isGistEnabled()) return; // Keep only the primary Gist-backed service awake (750h/mo free limit)

  const healthUrl = `${rawUrl}/api/health`;
  const intervalMs = 10 * 60 * 1000;
  const timer = setInterval(() => {
    const req = https.get(healthUrl, { timeout: 10000 }, (res) => {
      res.resume();
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => {});
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`Keep-alive self-ping attivo ogni 10 minuti verso ${healthUrl}`);
}

server.listen(PORT, () => {
  console.log(`🏐 Volley Ladispoli Hub attivo su http://localhost:${PORT}`);
  startRenderKeepAlive();
});
