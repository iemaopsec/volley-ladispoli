(function () {
  'use strict';

  const LADISPOLI_TEAM_ID = '231812';
  const STORAGE_KEYS = {
    ADMIN_CODE: 'vl_admin_code_session',
    LOCAL_DB: 'vl_local_db_backup_v1'
  };

  const DEFAULT_PLAYERS = [
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
  ];

  const DEFAULT_REASONS = [
    { id: 'spogliatoio', icon: '🎒', label: 'Dimenticanza nello spogliatoio', isBuiltIn: true },
    { id: 'cartellino', icon: '🟨', label: 'Cartellino Giallo / Rosso', isBuiltIn: true },
    { id: 'fidanzamento', icon: '❤️', label: 'Si è fidanzato', isBuiltIn: true },
    { id: 'patente', icon: '🚗', label: 'Patente / Auto nuova', isBuiltIn: true },
    { id: 'compleanno', icon: '🎂', label: 'Compleanno', isBuiltIn: true },
    { id: 'ritardo-allenamento', icon: '⏰', label: 'Ritardo in allenamento', isBuiltIn: true },
    { id: 'evento-importante', icon: '🥂', label: 'Evento importante', isBuiltIn: true }
  ];

  const LOCAL_TEAM_LOGOS = {
    '230434': '/logos/230434.png',
    '232269': '/logos/232269.png',
    '231255': '/logos/231255.png',
    '231849': '/logos/231849.jpg',
    '232006': '/logos/232006.png',
    '232122': '/logos/232122.png',
    '235026': '/logos/235026.png',
    '231833': '/logos/231833.jpg',
    '231819': '/logos/231819.jpg',
    '231932': '/logos/231932.png',
    '231812': '/logos/231812.jpg',
    '231716': '/logos/231716.jpg'
  };

  function getTeamLogo(teamObj) {
    if (!teamObj) return '/logo-ladispoli.jpg';
    const tid = String(teamObj.id || '');
    if (LOCAL_TEAM_LOGOS[tid]) return LOCAL_TEAM_LOGOS[tid];
    return teamObj.logo || '/logo-ladispoli.jpg';
  }

  const SEASON_MONTHS = [
    { key: '2026-11', year: 2026, month: 10, shortLabel: 'Nov 26', fullLabel: 'Novembre 2026' },
    { key: '2026-12', year: 2026, month: 11, shortLabel: 'Dic 26', fullLabel: 'Dicembre 2026' },
    { key: '2027-01', year: 2027, month: 0, shortLabel: 'Gen 27', fullLabel: 'Gennaio 2027' },
    { key: '2027-02', year: 2027, month: 1, shortLabel: 'Feb 27', fullLabel: 'Febbraio 2027' },
    { key: '2027-03', year: 2027, month: 2, shortLabel: 'Mar 27', fullLabel: 'Marzo 2027' },
    { key: '2027-04', year: 2027, month: 3, shortLabel: 'Apr 27', fullLabel: 'Aprile 2027' },
    { key: '2027-05', year: 2027, month: 4, shortLabel: 'Mag 27', fullLabel: 'Maggio 2027' }
  ];

  // Clean up any legacy persistent admin tokens so the user is never stuck as Admin
  try {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
  } catch (_) {}

  const state = {
    players: [...DEFAULT_PLAYERS],
    customReasons: [...DEFAULT_REASONS],
    pasteEntries: [],
    videos: [],
    socks: [],
    currentUser: null,
    appConfig: {
      googleClientId: '',
      cloudinaryCloudName: '',
      cloudinaryEnabled: false,
      persistence: 'local-disk'
    },
    adminCode: '',
    isAdmin: false,
    playerFilter: 'all',
    playerSort: 'priority', // 'priority' | 'alpha'
    playerSearch: '',
    activePlayerSheetId: null,
    pendingAdminCallback: null,
    pendingLoginCallback: null,
    // Media & Socks
    mediaTab: 'funny', // 'funny' | 'match' | 'socks'
    sockSort: 'top',   // 'top' | 'recent'
    videoUploadSource: 'link', // 'link' | 'file'
    sockCompressedDataUrl: '',
    sockRawFile: null,
    deferredInstallPrompt: null,
    // FIPAV & Spatial Calendar
    fipavCalendar: null,
    fipavTables: null,
    fipavUpdatedAt: '',
    matchFilter: 'upcoming',
    selectedGiornata: 'Giornata 1',
    hasAutoSelectedRound: false,
    calMonthKey: '2026-11',
    calSelectedMatchId: null
  };

  // ==========================================
  // UTILITIES & DATE HELPERS
  // ==========================================
  function getTodayYMD() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDaysYMD(baseYmd, daysOffset) {
    const [y, m, d] = baseYmd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + daysOffset);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }

  // > 0 means overdue by N days. 0 means due today. < 0 means due in |N| days.
  function calcDaysDiff(dueDateYmd) {
    if (!dueDateYmd) return 0;
    const todayYmd = getTodayYMD();
    const [ty, tm, td] = todayYmd.split('-').map(Number);
    const [dy, dm, dd] = dueDateYmd.split('-').map(Number);
    const tMs = Date.UTC(ty, tm - 1, td);
    const dMs = Date.UTC(dy, dm - 1, dd);
    return Math.round((tMs - dMs) / 86400000);
  }

  function formatShortDate(ymd) {
    if (!ymd) return '';
    const parts = ymd.split('-').map(Number);
    if (parts.length !== 3) return ymd;
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }

  function getInitials(name) {
    const words = (name || '').trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return (name || 'VL').slice(0, 2).toUpperCase();
  }

  function renderAvatarHtml(player, cls = 'avatar-circle', extraStyle = '') {
    const initials = getInitials(player?.name);
    const bg = player?.avatarColor || '#515158';
    const styleStr = `background:${bg};${extraStyle}`;
    if (player && player.avatarUrl) {
      return `<div class="${cls} has-photo" style="${styleStr}"><img src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.name)}" class="avatar-img" loading="lazy" /></div>`;
    }
    return `<div class="${cls}" style="${styleStr}">${initials}</div>`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  // ==========================================
  // API & LOCAL STORAGE FALLBACK
  // ==========================================
  function saveLocalBackup() {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_DB, JSON.stringify({
        players: state.players,
        customReasons: state.customReasons,
        pasteEntries: state.pasteEntries,
        videos: state.videos,
        socks: state.socks
      }));
    } catch (_) {}
  }

  function loadLocalBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_DB);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  async function apiFetch(url, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (state.adminCode) {
      headers['X-Admin-Code'] = state.adminCode;
    }
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Errore ${res.status}`);
    }
    return data;
  }

  async function loadAppConfig() {
    try {
      const cfg = await apiFetch('/api/config');
      state.appConfig = Object.assign({}, state.appConfig, cfg);
      if (state.appConfig.googleClientId) {
        initGoogleSignIn();
      }
    } catch (_) {}
  }

  async function loadAppState() {
    try {
      const data = await apiFetch('/api/state');
      state.players = data.players || DEFAULT_PLAYERS;
      state.customReasons = data.customReasons || DEFAULT_REASONS;
      state.pasteEntries = data.pasteEntries || [];
      state.videos = data.videos || [];
      state.socks = data.socks || [];
      state.currentUser = data.currentUser || null;
      saveLocalBackup();
    } catch (_) {
      const backup = loadLocalBackup();
      if (backup) {
        state.players = backup.players || DEFAULT_PLAYERS;
        state.customReasons = backup.customReasons || DEFAULT_REASONS;
        state.pasteEntries = backup.pasteEntries || [];
        state.videos = backup.videos || [];
        state.socks = backup.socks || [];
      }
    }

    if (state.adminCode) {
      try {
        const check = await apiFetch('/api/admin/verify', {
          method: 'POST',
          body: JSON.stringify({ code: state.adminCode })
        });
        state.isAdmin = Boolean(check.valid);
      } catch (_) {
        state.isAdmin = false;
      }
    }

    updateAdminChrome();
    updateAccountChrome();
    renderPasteView();
    renderMediaView();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  async function loadFipavData(forceRefresh = false) {
    if (window.FIPAV_FALLBACK_DATA && !state.fipavCalendar) {
      state.fipavCalendar = window.FIPAV_FALLBACK_DATA.calendar;
      state.fipavTables = window.FIPAV_FALLBACK_DATA.tables;
      state.fipavUpdatedAt = window.FIPAV_FALLBACK_DATA.updatedAt;
      renderCalendarAndStandings();
    }

    try {
      const data = await apiFetch(`/api/fipav${forceRefresh ? '?refresh=1' : ''}`);
      if (data && data.calendar) {
        state.fipavCalendar = data.calendar;
        state.fipavTables = data.tables;
        state.fipavUpdatedAt = data.updatedAt;
        renderCalendarAndStandings();
        if (forceRefresh) {
          showToast('Dati FIPAV aggiornati');
        }
      }
    } catch (_) {
      if (forceRefresh) {
        showToast('Usata cache locale FIPAV');
      }
    }
  }

  // ==========================================
  // PLAYER STATS CALCULATION
  // ==========================================
  function computePlayerStats(playerId) {
    const entries = state.pasteEntries.filter(e => e.playerId === playerId);
    const pendingEntries = [];
    const overdueEntries = [];
    const completedEntries = [];

    let pendingQty = 0;
    let overdueQty = 0;
    let completedQty = 0;
    let maxDaysLate = 0;

    for (const entry of entries) {
      if (entry.status === 'completed') {
        completedEntries.push(entry);
        completedQty += 1;
      } else {
        const elapsedDays = Math.max(0, calcDaysDiff(entry.incidentDate));
        const isOverdue = elapsedDays >= 7;
        const enriched = Object.assign({}, entry, {
          daysLate: elapsedDays,
          isOverdue
        });
        pendingEntries.push(enriched);
        pendingQty += 1;
        if (isOverdue) {
          overdueEntries.push(enriched);
          overdueQty += 1;
          if (elapsedDays > maxDaysLate) maxDaysLate = elapsedDays;
        }
      }
    }

    pendingEntries.sort((a, b) => (a.incidentDate || '9999-99-99').localeCompare(b.incidentDate || '9999-99-99'));
    completedEntries.sort((a, b) => (b.completedDate || b.incidentDate || '').localeCompare(a.completedDate || a.incidentDate || ''));

    return {
      entries,
      pendingEntries,
      overdueEntries,
      completedEntries,
      pendingQty,
      overdueQty,
      completedQty,
      maxDaysLate
    };
  }

  function formatDelayLabel(entry) {
    if (entry.status === 'completed') {
      return { text: `Portata ${formatShortDate(entry.completedDate || entry.incidentDate)}`, cls: 'badge-done' };
    }
    const elapsed = Math.max(0, calcDaysDiff(entry.incidentDate));
    if (elapsed >= 7) {
      return { text: `Arretrata (${elapsed}g fa)`, cls: 'badge-overdue' };
    }
    if (elapsed === 0) {
      return { text: 'Oggi', cls: 'badge-owing-red' };
    }
    if (elapsed === 1) {
      return { text: 'Ieri', cls: 'badge-owing-red' };
    }
    return { text: `${elapsed}g fa`, cls: 'badge-owing-red' };
  }

  // ==========================================
  // RENDER VIEW 1: PASTE & SPOGLIATOIO
  // ==========================================
  function renderPasteView() {
    let totalPending = 0;
    let totalOverdue = 0;
    let totalCompleted = 0;
    const activeDebtsFlat = [];
    const playerMap = new Map();

    for (const p of state.players) {
      playerMap.set(p.id, p);
      const st = computePlayerStats(p.id);
      totalPending += st.pendingQty;
      totalOverdue += st.overdueQty;
      totalCompleted += st.completedQty;
      for (const pe of st.pendingEntries) {
        activeDebtsFlat.push({ player: p, entry: pe });
      }
    }

    // 1. Summary Strip
    document.getElementById('kpiTotalPending').textContent = totalPending;
    document.getElementById('kpiTotalOverdue').textContent = totalOverdue;
    document.getElementById('kpiTotalCompleted').textContent = totalCompleted;

    const navBadge = document.getElementById('tabBadgePending');
    if (totalPending > 0) {
      navBadge.textContent = totalPending;
      navBadge.classList.remove('hidden');
    } else {
      navBadge.classList.add('hidden');
    }

    const noteEl = document.getElementById('summaryStatusNote');
    if (totalOverdue > 0) {
      noteEl.className = 'summary-note has-alert';
      noteEl.textContent = `Attenzione: ${totalOverdue} ${totalOverdue === 1 ? 'pasta arretrata da' : 'paste arretrate da'} oltre una settimana`;
    } else if (totalPending > 0) {
      noteEl.className = 'summary-note has-alert';
      noteEl.textContent = `${totalPending} ${totalPending === 1 ? 'pasta da portare' : 'paste da portare'} nello spogliatoio`;
    } else {
      noteEl.className = 'summary-note';
      noteEl.textContent = 'Tutti in regola · Tocca + Segna in basso quando qualcuno deve portare le paste';
    }

    // 2. Group 1: "Da portare all'allenamento" (Active Debts)
    const activeSection = document.getElementById('activeDebtsSection');
    const activeList = document.getElementById('activeDebtsList');
    const activeCountBadge = document.getElementById('activeDebtsCountBadge');

    if (activeDebtsFlat.length > 0) {
      activeDebtsFlat.sort((a, b) => (a.entry.incidentDate || '9999-99-99').localeCompare(b.entry.incidentDate || '9999-99-99'));
      activeSection.classList.remove('hidden');
      activeCountBadge.textContent = totalPending;

      activeList.innerHTML = activeDebtsFlat.map(({ player, entry }) => {
        const delay = formatDelayLabel(entry);
        return `
          <div class="list-row" data-action="open-player" data-player-id="${player.id}">
            <div class="row-left">
              ${renderAvatarHtml(player, 'avatar-circle')}
              <div class="row-text">
                <div class="row-title">${escapeHtml(player.name)}</div>
                <div class="row-sub sub-owing">
                  <span class="status-dot status-dot-red"></span>
                  <span>Da portare · ${escapeHtml(entry.reasonTitle)} (${formatShortDate(entry.incidentDate)})</span>
                </div>
              </div>
            </div>
            <div class="row-right">
              <span class="badge-pill ${delay.cls}">${escapeHtml(delay.text)}</span>
              <button type="button" class="quick-check-btn" data-action="quick-complete" data-entry-id="${entry.id}" title="Segna come portata">
                Portata
              </button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      activeSection.classList.add('hidden');
      activeList.innerHTML = '';
    }

    // 3. Group 2: Compact 13 Players List
    renderCompactPlayersList();

    // 4. Archive Log
    renderHistoryArchive(playerMap);

    // 5. Refresh open player sheet if visible
    if (state.activePlayerSheetId) {
      populatePlayerSheet(state.activePlayerSheetId);
    }
  }

  function renderCompactPlayersList() {
    const listEl = document.getElementById('playersList');
    if (!listEl) return;

    const q = state.playerSearch.trim().toLowerCase();
    const items = state.players.map(player => ({
      player,
      stats: computePlayerStats(player.id)
    })).filter(({ player, stats }) => {
      if (q && !player.name.toLowerCase().includes(q)) return false;
      if (state.playerFilter === 'owing') return stats.pendingQty > 0;
      if (state.playerFilter === 'overdue') return stats.overdueQty > 0;
      return true;
    });

    items.sort((a, b) => {
      if (state.playerSort === 'alpha') {
        return a.player.name.localeCompare(b.player.name, 'it');
      }
      if (b.stats.overdueQty !== a.stats.overdueQty) return b.stats.overdueQty - a.stats.overdueQty;
      if (b.stats.maxDaysLate !== a.stats.maxDaysLate) return b.stats.maxDaysLate - a.stats.maxDaysLate;
      if (b.stats.pendingQty !== a.stats.pendingQty) return b.stats.pendingQty - a.stats.pendingQty;
      if (b.stats.completedQty !== a.stats.completedQty) return b.stats.completedQty - a.stats.completedQty;
      return a.player.name.localeCompare(b.player.name, 'it');
    });

    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">
          Nessun giocatore in questa vista
        </div>
      `;
      return;
    }

    listEl.innerHTML = items.map(({ player, stats }) => {
      let subHtml = '';
      let rightBadge = '';

      if (stats.overdueQty > 0) {
        const firstReason = stats.overdueEntries[0]?.reasonTitle || 'Paste in ritardo';
        subHtml = `
          <div class="row-sub sub-overdue">
            <span class="status-dot status-dot-red"></span>
            <span>Da portare (${stats.maxDaysLate}g fa) · ${escapeHtml(firstReason)}</span>
          </div>
        `;
        rightBadge = `<span class="badge-pill badge-overdue">${stats.overdueQty} ${stats.overdueQty === 1 ? 'arretrata' : 'arretrate'}</span>`;
      } else if (stats.pendingQty > 0) {
        const nextEntry = stats.pendingEntries[0];
        subHtml = `
          <div class="row-sub sub-owing">
            <span class="status-dot status-dot-red"></span>
            <span>Da portare · ${escapeHtml(nextEntry.reasonTitle)} (${formatShortDate(nextEntry.incidentDate)})</span>
          </div>
        `;
        rightBadge = `<span class="badge-pill badge-owing-red">${stats.pendingQty} da portare</span>`;
      } else {
        const extraDone = stats.completedQty > 0
          ? ` · ${stats.completedQty} già ${stats.completedQty === 1 ? 'portata' : 'portate'}`
          : '';
        subHtml = `
          <div class="row-sub sub-clean">
            <span class="status-dot status-dot-green"></span>
            <span>In regola${extraDone}</span>
          </div>
        `;
        rightBadge = `<span class="badge-pill badge-clean-green">✓ In regola</span>`;
      }

      return `
        <button type="button" class="list-row" data-action="open-player" data-player-id="${player.id}">
          <div class="row-left">
            ${renderAvatarHtml(player, 'avatar-circle')}
            <div class="row-text">
              <div class="row-title">${escapeHtml(player.name)}</div>
              ${subHtml}
            </div>
          </div>
          <div class="row-right">
            ${rightBadge}
            <svg class="row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </button>
      `;
    }).join('');
  }

  function renderHistoryArchive(playerMap) {
    const container = document.getElementById('historyLogContainer');
    if (!container) return;

    if (state.pasteEntries.length === 0) {
      container.innerHTML = `
        <div style="padding: 1.25rem; text-align: center; color: var(--text-tertiary); font-size: 0.82rem;">
          Lo storico delle paste è vuoto.
        </div>
      `;
      return;
    }

    container.innerHTML = state.pasteEntries.map(entry => {
      const p = playerMap.get(entry.playerId) || { name: entry.playerId, avatarColor: '#515158' };
      const delay = formatDelayLabel(entry);
      return `
        <div class="list-row" data-action="open-player" data-player-id="${p.id}">
          <div class="row-left">
            ${renderAvatarHtml(p, 'avatar-circle', 'width:32px; height:32px; font-size:0.74rem;')}
            <div class="row-text">
              <div class="row-title">${escapeHtml(p.name)} · ${escapeHtml(entry.reasonTitle)}</div>
              <div class="row-sub">Quando è successo: ${formatShortDate(entry.incidentDate)}</div>
            </div>
          </div>
          <div class="row-right">
            <span class="badge-pill ${delay.cls}">${escapeHtml(delay.text)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // BOTTOM SHEETS MANAGEMENT & DRAG GESTURE
  // ==========================================
  function openSheet(sheetId) {
    const backdrop = document.getElementById(sheetId);
    if (!backdrop) return;
    const sheet = backdrop.querySelector('.bottom-sheet');
    if (sheet) {
      sheet.style.transform = '';
    }
    backdrop.classList.remove('hidden');
  }

  function closeSheet(sheetId) {
    const backdrop = document.getElementById(sheetId);
    if (!backdrop) return;
    backdrop.classList.add('hidden');
    if (sheetId === 'sheetPlayer') {
      state.activePlayerSheetId = null;
    }
  }

  // Apple Fluid Interfaces + Emil Kowalski velocity-aware drag-to-dismiss
  function attachSheetDragPhysics() {
    document.querySelectorAll('.bottom-sheet').forEach(sheet => {
      const grabberArea = sheet.querySelector('.sheet-grabber-area');
      const headerArea = sheet.querySelector('.sheet-header');
      const backdrop = sheet.closest('.sheet-backdrop');
      if (!grabberArea || !backdrop) return;

      let isDragging = false;
      let startY = 0;
      let currentY = 0;
      let startTime = 0;

      const onPointerDown = (e) => {
        if (e.target.closest('button, input, select, a')) return;
        isDragging = true;
        startY = e.clientY;
        currentY = 0;
        startTime = performance.now();
        sheet.style.transition = 'none';
        e.currentTarget.setPointerCapture(e.pointerId);
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const rawDelta = e.clientY - startY;
        if (rawDelta < 0) {
          // Progressive rubber-banding when pulling upward past top boundary
          const overshoot = Math.abs(rawDelta);
          currentY = -((overshoot * 120 * 0.35) / (120 + 0.35 * overshoot));
        } else {
          currentY = rawDelta;
        }
        sheet.style.transform = `translateY(${currentY}px)`;
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        const elapsed = Math.max(1, performance.now() - startTime);
        const velocity = currentY / elapsed; // px/ms

        sheet.style.transition = 'transform 260ms var(--ease-drawer)';
        if (currentY > 110 || velocity > 0.35) {
          sheet.style.transform = 'translateY(100%)';
          setTimeout(() => closeSheet(backdrop.id), 220);
        } else {
          sheet.style.transform = 'translateY(0)';
        }
      };

      [grabberArea, headerArea].forEach(area => {
        if (!area) return;
        area.addEventListener('pointerdown', onPointerDown);
        area.addEventListener('pointermove', onPointerMove);
        area.addEventListener('pointerup', onPointerUp);
        area.addEventListener('pointercancel', onPointerUp);
      });
    });
  }

  // ==========================================
  // PLAYER DETAIL SHEET
  // ==========================================
  function populatePlayerSheet(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    state.activePlayerSheetId = playerId;

    const stats = computePlayerStats(playerId);
    const avatar = document.getElementById('sheetPlayerAvatar');
    avatar.style.background = player.avatarColor;
    if (player.avatarUrl) {
      avatar.innerHTML = `<img src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.name)}" class="avatar-img" />`;
    } else {
      avatar.textContent = getInitials(player.name);
    }

    document.getElementById('sheetPlayerName').textContent = player.name;
    const sheetSub = document.getElementById('sheetPlayerSubtitle');
    if (stats.overdueQty > 0) {
      sheetSub.textContent = `Da portare · In ritardo di ${stats.maxDaysLate} giorni`;
      sheetSub.style.color = 'var(--accent-red)';
      sheetSub.style.fontWeight = '600';
    } else if (stats.pendingQty > 0) {
      sheetSub.textContent = `Da portare (${stats.pendingQty})`;
      sheetSub.style.color = 'var(--accent-red)';
      sheetSub.style.fontWeight = '600';
    } else {
      sheetSub.textContent = '✓ In regola';
      sheetSub.style.color = 'var(--status-green)';
      sheetSub.style.fontWeight = '600';
    }

    document.getElementById('sheetPlayerCounters').innerHTML = `
      <div class="sheet-kpi-box">
        <div class="sheet-kpi-num" style="${stats.pendingQty > 0 ? 'color:var(--accent-red)' : ''}">${stats.pendingQty}</div>
        <span class="sheet-kpi-label">Da portare</span>
      </div>
      <div class="sheet-kpi-box">
        <div class="sheet-kpi-num" style="${stats.overdueQty > 0 ? 'color:var(--accent-red)' : ''}">${stats.overdueQty}</div>
        <span class="sheet-kpi-label">Arretrate</span>
      </div>
      <div class="sheet-kpi-box">
        <div class="sheet-kpi-num" style="color:var(--status-green)">${stats.completedQty}</div>
        <span class="sheet-kpi-label">Già portate</span>
      </div>
    `;

    const entriesContainer = document.getElementById('sheetPlayerEntries');
    if (stats.entries.length === 0) {
      entriesContainer.innerHTML = `
        <div style="text-align:center; padding: 1.5rem 0.5rem; color: var(--text-tertiary); font-size: 0.84rem;">
          Nessuna pasta registrata per ${escapeHtml(player.name)}.
        </div>
      `;
      return;
    }

    entriesContainer.innerHTML = stats.entries.map(entry => {
      const delay = formatDelayLabel(entry);
      return `
        <div class="entry-card">
          <div class="entry-card-top">
            <div class="entry-title">${escapeHtml(entry.reasonTitle)}</div>
            <span class="badge-pill ${delay.cls}">${escapeHtml(delay.text)}</span>
          </div>
          <div class="entry-meta">
            <span>Quando è successo: ${formatShortDate(entry.incidentDate)}</span>
          </div>
          <div class="entry-actions">
            ${entry.status === 'pending' ? `
              <button type="button" class="btn-small-primary" data-action="quick-complete" data-entry-id="${entry.id}">Segna Portata</button>
            ` : `
              <button type="button" class="btn-small-secondary" data-action="reopen-entry" data-entry-id="${entry.id}">Riapri</button>
            `}
            <button type="button" class="btn-small-secondary" data-action="edit-entry" data-entry-id="${entry.id}">Modifica</button>
            <button type="button" class="btn-small-secondary" style="color:var(--accent-red);" data-action="delete-entry" data-entry-id="${entry.id}">Elimina</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // ADD / EDIT PASTE FORM SHEET (SIMPLIFIED PREMIUM)
  // ==========================================
  const DEFAULT_REASON_OPTIONS = [
    'Dimenticanza nello spogliatoio',
    'Cartellino Giallo / Rosso',
    'Si è fidanzato',
    'Patente / Auto nuova',
    'Compleanno',
    'Ritardo in allenamento'
  ];

  function openPasteFormSheet({ playerId = '', entryId = '' } = {}) {
    const entry = entryId ? state.pasteEntries.find(e => e.id === entryId) : null;
    const today = getTodayYMD();
    const yesterday = addDaysYMD(today, -1);

    document.getElementById('sheetFormTitle').textContent = entry ? 'Modifica Paste' : 'Segna Paste';
    document.getElementById('pasteEntryId').value = entry ? entry.id : '';

    // 1. Premium Player Picker Grid
    const selectedPid = entry ? entry.playerId : (playerId || state.players[0]?.id || '');
    const playerHidden = document.getElementById('pastePlayerSelect');
    playerHidden.value = selectedPid;
    renderPremiumPlayerPicker(selectedPid);

    // 2. Default Reason Options + "Altro..."
    const initialReason = entry ? entry.reasonTitle : DEFAULT_REASON_OPTIONS[0];
    renderReasonPills(initialReason);

    // 3. Incident Date ("Quando è successo")
    const incDate = entry ? (entry.incidentDate || today) : today;
    const incInput = document.getElementById('pasteIncidentDateInput');
    incInput.value = incDate;

    const tabsWrap = document.getElementById('incidentQuickTabs');
    if (tabsWrap) {
      tabsWrap.querySelectorAll('.inc-tab').forEach(btn => btn.classList.remove('active'));
      if (incDate === today) {
        tabsWrap.querySelector('[data-offset="0"]')?.classList.add('active');
        incInput.classList.add('hidden');
      } else if (incDate === yesterday) {
        tabsWrap.querySelector('[data-offset="-1"]')?.classList.add('active');
        incInput.classList.add('hidden');
      } else {
        tabsWrap.querySelector('[data-offset="custom"]')?.classList.add('active');
        incInput.classList.remove('hidden');
      }
    }

    // 4. Admin Box
    const adminBox = document.getElementById('formAdminBox');
    const adminInp = document.getElementById('formAdminCodeInput');
    if (state.isAdmin) {
      adminBox.classList.add('hidden');
      adminInp.required = false;
    } else {
      adminBox.classList.remove('hidden');
      adminInp.required = true;
      adminInp.value = '';
    }

    openSheet('sheetPasteForm');
  }

  function renderPremiumPlayerPicker(selectedPlayerId) {
    const grid = document.getElementById('premiumPlayerGrid');
    const hiddenInput = document.getElementById('pastePlayerSelect');
    if (!grid || !hiddenInput) return;

    grid.innerHTML = state.players.map(p => {
      const isSelected = p.id === selectedPlayerId;
      const avatarContent = p.avatarUrl
        ? `<img src="${escapeHtml(p.avatarUrl)}" alt="${escapeHtml(p.name)}" class="avatar-img" loading="lazy" />`
        : getInitials(p.name);
      return `
        <button type="button" class="player-pick-card ${isSelected ? 'is-selected' : ''}" data-pick-player="${p.id}">
          <span class="player-pick-avatar" style="background:${p.avatarColor}">${avatarContent}</span>
          <span class="player-pick-name">${escapeHtml(p.name)}</span>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.player-pick-card').forEach(card => {
      card.addEventListener('click', () => {
        const pid = card.getAttribute('data-pick-player');
        hiddenInput.value = pid;
        grid.querySelectorAll('.player-pick-card').forEach(c => c.classList.toggle('is-selected', c === card));
      });
    });
  }

  function renderReasonPills(activeLabel = '') {
    const wrap = document.getElementById('reasonChipsWrap');
    const customWrap = document.getElementById('customReasonWrap');
    const titleInput = document.getElementById('pasteReasonTitleInput');
    if (!wrap || !titleInput) return;

    const matchedPreset = DEFAULT_REASON_OPTIONS.find(
      opt => activeLabel && opt.toLowerCase() === activeLabel.toLowerCase()
    );
    const isOtherActive = Boolean(activeLabel && !matchedPreset);

    wrap.innerHTML = DEFAULT_REASON_OPTIONS.map(label => {
      const isActive = matchedPreset === label;
      return `
        <button type="button" class="reason-option-btn ${isActive ? 'active' : ''}" data-reason-label="${escapeHtml(label)}">
          ${escapeHtml(label)}
        </button>
      `;
    }).join('') + `
      <button type="button" class="reason-option-btn is-other-btn ${isOtherActive ? 'active' : ''}" data-reason-other="true">
        Altro motivo...
      </button>
    `;

    if (isOtherActive) {
      customWrap?.classList.remove('hidden');
      titleInput.value = activeLabel;
    } else {
      customWrap?.classList.add('hidden');
      titleInput.value = matchedPreset || DEFAULT_REASON_OPTIONS[0];
    }

    wrap.querySelectorAll('.reason-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.reason-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (btn.hasAttribute('data-reason-other')) {
          customWrap?.classList.remove('hidden');
          if (DEFAULT_REASON_OPTIONS.includes(titleInput.value)) {
            titleInput.value = '';
          }
          setTimeout(() => titleInput.focus(), 30);
        } else {
          const label = btn.getAttribute('data-reason-label') || '';
          customWrap?.classList.add('hidden');
          titleInput.value = label;
        }
      });
    });
  }

  // ==========================================
  // VIEW 2 & 3: CALENDARIO FIPAV & CLASSIFICA
  // ==========================================
  function parseFipavMatchDate(dateStr, timeStr) {
    if (!dateStr) return null;
    const [dd, mm, yyyy] = dateStr.split('/').map(Number);
    const [hh, min] = (timeStr || '18.00').replace(':', '.').split('.').map(Number);
    return new Date(yyyy, mm - 1, dd, hh || 18, min || 0, 0);
  }

  function getLadispoliMatches() {
    const allMatches = state.fipavCalendar?.data?.matches || [];
    return allMatches
      .filter(m => m.team1?.id === LADISPOLI_TEAM_ID || m.team2?.id === LADISPOLI_TEAM_ID)
      .map(m => {
        const isHome = m.team1?.id === LADISPOLI_TEAM_ID;
        const opponent = isHome ? m.team2 : m.team1;
        const dt = parseFipavMatchDate(m.date, m.time);
        const giornataNum = parseInt((m.day || '').replace(/\D+/g, ''), 10) || 0;
        return Object.assign({}, m, { isHome, opponent, dateObj: dt, giornataNum });
      })
      .sort((a, b) => a.giornataNum - b.giornataNum);
  }

  function buildGoogleCalendarUrl(match) {
    const dtStart = match.dateObj || new Date();
    const dtEnd = new Date(dtStart.getTime() + 2 * 3600 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const title = `Volley: ${match.team1.title} vs ${match.team2.title} (${match.day})`;
    const details = `Seconda Divisione Maschile Girone A (${match.day}, Gara ${match.ng})\nPalestra: ${match.stadium}`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${fmt(dtStart)}/${fmt(dtEnd)}`,
      details,
      location: match.stadium || ''
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function buildGoogleMapsUrl(match) {
    if (match.stadium) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.stadium)}`;
    }
    return 'https://www.google.com/maps';
  }

  function generateIcsContent(matchesArray) {
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const nowStamp = fmt(new Date());
    const events = matchesArray.map(m => {
      const dtStart = m.dateObj || new Date();
      const dtEnd = new Date(dtStart.getTime() + 2 * 3600 * 1000);
      const summary = `Volley: ${m.team1.title} vs ${m.team2.title} (${m.day})`;
      const desc = `Campionato FIPAV 2a Divisione Gir. A - ${m.day} (Gara ${m.ng}). Palestra: ${m.stadium}`;
      return [
        'BEGIN:VEVENT',
        `UID:fipav-64602-${m.id}@volleyladispoli.it`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${fmt(dtStart)}`,
        `DTEND:${fmt(dtEnd)}`,
        `SUMMARY:${summary.replace(/,/g, '\\,')}`,
        `DESCRIPTION:${desc.replace(/,/g, '\\,')}`,
        `LOCATION:${(m.stadium || '').replace(/,/g, '\\,')}`,
        'END:VEVENT'
      ].join('\r\n');
    }).join('\r\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Volley Ladispoli//FIPAV 64602//IT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      events,
      'END:VCALENDAR'
    ].join('\r\n');
  }

  function downloadIcsFile(filename, icsText) {
    const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function isMatchPlayed(m) {
    if (!m) return false;
    if (m.played === true || m.played === 1 || m.played === '1') return true;
    const s1 = Number(m['team1-setwin'] || 0);
    const s2 = Number(m['team2-setwin'] || 0);
    return (s1 + s2) > 0;
  }

  function getMatchResultInfo(m) {
    const played = isMatchPlayed(m);
    const s1 = Number(m['team1-setwin'] || 0);
    const s2 = Number(m['team2-setwin'] || 0);
    const ptA = Array.isArray(m.pt_a) ? m.pt_a : [];
    const ptB = Array.isArray(m.pt_b) ? m.pt_b : [];
    const sets = [];
    const len = Math.max(ptA.length, ptB.length);
    for (let i = 0; i < len; i++) {
      if (ptA[i] !== undefined || ptB[i] !== undefined) {
        sets.push(`${ptA[i] ?? 0}-${ptB[i] ?? 0}`);
      }
    }
    const isUsInvolved = String(m.team1?.id) === LADISPOLI_TEAM_ID || String(m.team2?.id) === LADISPOLI_TEAM_ID;
    const isUsHome = String(m.team1?.id) === LADISPOLI_TEAM_ID;
    const didWeWin = played && isUsInvolved ? (isUsHome ? s1 > s2 : s2 > s1) : null;
    return {
      played,
      s1,
      s2,
      scoreText: `${s1}-${s2}`,
      sets,
      didWeWin
    };
  }

  function renderCalendarAndStandings() {
    const matches = getLadispoliMatches();
    if (!state.calSelectedMatchId && matches.length > 0) {
      const now = new Date();
      const nextMatch = matches.find(m => !isMatchPlayed(m) && m.dateObj && m.dateObj >= new Date(now.getTime() - 3 * 3600 * 1000)) || matches[matches.length - 1];
      state.calSelectedMatchId = nextMatch.id;
      if (nextMatch.dateObj) {
        const y = nextMatch.dateObj.getFullYear();
        const m = String(nextMatch.dateObj.getMonth() + 1).padStart(2, '0');
        const candidateKey = `${y}-${m}`;
        if (SEASON_MONTHS.some(sm => sm.key === candidateKey)) {
          state.calMonthKey = candidateKey;
        }
      }
    }

    renderLastMatchCard();
    renderNextMatchCard();
    renderSpatialCalendar();
    renderCompactMatchesList();
    renderStandings();
    renderGironeMatchesByRound();
  }

  function renderLastMatchCard() {
    const card = document.getElementById('lastMatchCard');
    if (!card) return;

    const playedMatches = getLadispoliMatches().filter(m => isMatchPlayed(m));
    if (playedMatches.length === 0) {
      card.classList.add('hidden');
      card.innerHTML = '';
      return;
    }

    const lastMatch = playedMatches[playedMatches.length - 1];
    const res = getMatchResultInfo(lastMatch);
    const outcomeLabel = res.didWeWin ? 'Vittoria Volley Ladispoli' : 'Sconfitta';
    const outcomeCls = res.didWeWin ? 'is-win' : 'is-loss';

    card.classList.remove('hidden', 'is-loss');
    if (!res.didWeWin) card.classList.add('is-loss');

    card.innerHTML = `
      <div class="lm-top">
        <span>Ultimo Risultato · ${escapeHtml(lastMatch.day)} · ${escapeHtml(lastMatch.date)}</span>
        <span class="lm-result-badge ${outcomeCls}">${outcomeLabel}</span>
      </div>

      <div class="mc-versus-row" style="border-top:none; padding-top:0;">
        <div class="mc-team">
          <img src="${escapeHtml(getTeamLogo(lastMatch.team1))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          <span class="mc-team-title ${lastMatch.team1.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(lastMatch.team1.title)}</span>
        </div>

        <span class="mc-score-pill ${outcomeCls}">${res.scoreText}</span>

        <div class="mc-team mc-team-right">
          <span class="mc-team-title ${lastMatch.team2.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(lastMatch.team2.title)}</span>
          <img src="${escapeHtml(getTeamLogo(lastMatch.team2))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
        </div>
      </div>

      ${res.sets.length > 0 ? `
        <div class="set-partials-row">
          <span style="font-size:0.7rem; font-weight:700; color:var(--text-tertiary);">Set:</span>
          ${res.sets.map(s => `<span class="set-chip">${escapeHtml(s)}</span>`).join('')}
        </div>
      ` : ''}
    `;

    card.onclick = () => openMatchDetailSheet(lastMatch.id);
  }

  function renderNextMatchCard() {
    const card = document.getElementById('nextMatchCard');
    if (!card) return;

    const matches = getLadispoliMatches();
    if (matches.length === 0) return;

    const now = new Date();
    const nextMatch = matches.find(m => !isMatchPlayed(m) && m.dateObj && m.dateObj >= new Date(now.getTime() - 3 * 3600 * 1000)) || matches[matches.length - 1];
    const res = getMatchResultInfo(nextMatch);
    const diffMs = (nextMatch.dateObj || now) - now;
    let countdown = res.played ? `Risultato ${res.scoreText}` : 'Prossima gara';
    if (!res.played && diffMs > 0) {
      const days = Math.floor(diffMs / 86400000);
      countdown = days > 0 ? `Tra ${days} ${days === 1 ? 'giorno' : 'giorni'}` : 'Oggi';
    }

    card.innerHTML = `
      <div class="nm-top">
        <span class="nm-tag">${res.played ? 'Ultima Partita' : 'Prossima Partita'} · ${escapeHtml(nextMatch.day)}</span>
        <span class="nm-countdown">${countdown}</span>
      </div>

      <div class="nm-teams">
        <div class="nm-team">
          <img src="${escapeHtml(getTeamLogo(nextMatch.team1))}" alt="" class="nm-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          <span class="nm-team-name ${nextMatch.team1.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(nextMatch.team1.title)}</span>
        </div>

        <div class="nm-center">
          <div class="nm-time">${res.played ? escapeHtml(res.scoreText) : escapeHtml((nextMatch.time || '').replace('.', ':'))}</div>
          <div class="nm-date">${escapeHtml(nextMatch.date)}</div>
          <span class="ha-tag ${nextMatch.isHome ? 'ha-home' : 'ha-away'}" style="margin:0.25rem 0 0; display:inline-block;">
            ${nextMatch.isHome ? 'In Casa' : 'Trasferta'}
          </span>
        </div>

        <div class="nm-team">
          <img src="${escapeHtml(getTeamLogo(nextMatch.team2))}" alt="" class="nm-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          <span class="nm-team-name ${nextMatch.team2.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(nextMatch.team2.title)}</span>
        </div>
      </div>

      <div class="nm-venue">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(nextMatch.stadium)}</span>
      </div>

      <div class="nm-actions">
        <button type="button" class="btn-primary-half" data-action="open-match" data-match-id="${nextMatch.id}">
          ${res.played ? 'Vedi Parziali Set' : 'Aggiungi al Calendario'}
        </button>
        <a href="${buildGoogleMapsUrl(nextMatch)}" target="_blank" rel="noopener noreferrer" class="btn-secondary-half">
          Apri Palestra in Maps
        </a>
      </div>
    `;
  }

  function renderSpatialCalendar() {
    const pillsWrap = document.getElementById('calMonthPills');
    const monthLabel = document.getElementById('calCurrentMonthLabel');
    const monthMatchCount = document.getElementById('calMonthMatchCount');
    const gridEl = document.getElementById('calDaysGrid');
    const spotlightEl = document.getElementById('calSelectedMatchSpotlight');
    if (!pillsWrap || !gridEl) return;

    const matches = getLadispoliMatches();
    const currentMonthObj = SEASON_MONTHS.find(m => m.key === state.calMonthKey) || SEASON_MONTHS[0];

    // Group matches by YYYY-MM and YYYY-MM-DD
    const matchesByMonth = new Map();
    const matchesByDay = new Map();
    for (const m of matches) {
      if (!m.dateObj) continue;
      const yy = m.dateObj.getFullYear();
      const mm = String(m.dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(m.dateObj.getDate()).padStart(2, '0');
      const mKey = `${yy}-${mm}`;
      const dKey = `${yy}-${mm}-${dd}`;
      matchesByMonth.set(mKey, (matchesByMonth.get(mKey) || 0) + 1);
      matchesByDay.set(dKey, m);
    }

    // 1. Month Pills Bar
    pillsWrap.innerHTML = SEASON_MONTHS.map(sm => {
      const cnt = matchesByMonth.get(sm.key) || 0;
      const isActive = sm.key === currentMonthObj.key;
      return `
        <button type="button" class="month-pill-btn ${isActive ? 'active' : ''}" data-action="select-cal-month" data-month-key="${sm.key}">
          <span>${escapeHtml(sm.shortLabel)}</span>
          <span class="month-pill-count">(${cnt})</span>
        </button>
      `;
    }).join('');

    monthLabel.textContent = currentMonthObj.fullLabel;
    const countThisMonth = matchesByMonth.get(currentMonthObj.key) || 0;
    if (monthMatchCount) {
      monthMatchCount.textContent = `${countThisMonth} ${countThisMonth === 1 ? 'partita nel mese' : 'partite nel mese'}`;
    }

    // 2. Build 7-Col Spatial Grid (Monday = 0 .. Sunday = 6)
    const firstDayOfMonth = new Date(currentMonthObj.year, currentMonthObj.month, 1);
    const daysInMonth = new Date(currentMonthObj.year, currentMonthObj.month + 1, 0).getDate();
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7; // Convert Sun=0..Sat=6 to Mon=0..Sun=6
    const todayYmd = getTodayYMD();

    const cellsHtml = [];
    for (let i = 0; i < startOffset; i++) {
      cellsHtml.push(`<div class="cal-day-cell is-empty"></div>`);
    }

    const mmStr = String(currentMonthObj.month + 1).padStart(2, '0');
    for (let day = 1; day <= daysInMonth; day++) {
      const ddStr = String(day).padStart(2, '0');
      const ymd = `${currentMonthObj.year}-${mmStr}-${ddStr}`;
      const match = matchesByDay.get(ymd);
      const isToday = ymd === todayYmd;

      if (match) {
        const isSelected = String(state.calSelectedMatchId) === String(match.id);
        const haClass = match.isHome ? 'match-home' : 'match-away';
        const oppLogo = getTeamLogo(match.opponent);
        const shortTime = (match.time || '18.00').replace('.', ':');
        const res = getMatchResultInfo(match);
        const playedClass = res.played ? (res.didWeWin ? 'is-played-win' : 'is-played-loss') : '';
        const cellBottom = res.played
          ? `<span class="cal-cell-score ${res.didWeWin ? 'is-win' : 'is-loss'}">${res.scoreText}</span>`
          : `<span class="cal-cell-time">${escapeHtml(shortTime)}</span>`;

        cellsHtml.push(`
          <button type="button" class="cal-day-cell has-match ${haClass} ${playedClass} ${isSelected ? 'is-selected' : ''}" data-action="select-cal-match" data-match-id="${match.id}" title="${escapeHtml(match.day)}: ${escapeHtml(match.opponent.title)}">
            <span class="cal-day-num">${day}</span>
            <img src="${escapeHtml(oppLogo)}" alt="" class="cal-cell-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            ${cellBottom}
          </button>
        `);
      } else {
        cellsHtml.push(`
          <div class="cal-day-cell ${isToday ? 'is-today' : ''}">
            <span class="cal-day-num">${day}</span>
          </div>
        `);
      }
    }

    gridEl.innerHTML = cellsHtml.join('');

    // 3. Spotlight Card for Selected Match (or first match of the active month)
    let spotlightMatch = matches.find(m => String(m.id) === String(state.calSelectedMatchId));
    if (!spotlightMatch || !spotlightMatch.dateObj || `${spotlightMatch.dateObj.getFullYear()}-${String(spotlightMatch.dateObj.getMonth() + 1).padStart(2, '0')}` !== currentMonthObj.key) {
      spotlightMatch = matches.find(m => m.dateObj && `${m.dateObj.getFullYear()}-${String(m.dateObj.getMonth() + 1).padStart(2, '0')}` === currentMonthObj.key) || matches[0];
      if (spotlightMatch) {
        state.calSelectedMatchId = spotlightMatch.id;
      }
    }

    if (spotlightMatch && spotlightEl) {
      const res = getMatchResultInfo(spotlightMatch);
      const matchIdx = matches.findIndex(m => m.id === spotlightMatch.id);
      const prevMatch = matchIdx > 0 ? matches[matchIdx - 1] : null;
      let spacingNote = 'Prima giornata di campionato';
      if (prevMatch && prevMatch.dateObj && spotlightMatch.dateObj) {
        const gapDays = Math.round((spotlightMatch.dateObj - prevMatch.dateObj) / 86400000);
        spacingNote = `${gapDays} giorni dopo la ${prevMatch.day}`;
      }

      const fullDateStr = spotlightMatch.dateObj
        ? spotlightMatch.dateObj.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : spotlightMatch.date;

      const centerBadge = res.played
        ? `<span class="mc-score-pill ${res.didWeWin ? 'is-win' : 'is-loss'}">${res.scoreText}</span>`
        : `<span class="sp-vs">VS</span>`;

      spotlightEl.innerHTML = `
        <div class="spotlight-box">
          <div class="spotlight-meta">
            <span><strong>${escapeHtml(spotlightMatch.day)}</strong> · ${escapeHtml(fullDateStr)} · Ore ${escapeHtml((spotlightMatch.time || '').replace('.', ':'))}</span>
            <span class="ha-tag ${spotlightMatch.isHome ? 'ha-home' : 'ha-away'}" style="margin:0;">
              ${spotlightMatch.isHome ? 'In Casa' : 'Trasferta'}
            </span>
          </div>

          <div class="spotlight-teams-line">
            <div class="sp-team">
              <img src="${escapeHtml(getTeamLogo(spotlightMatch.team1))}" alt="" class="sp-logo" onerror="this.src='/logo-ladispoli.jpg'" />
              <span class="sp-name ${spotlightMatch.team1.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(spotlightMatch.team1.title)}</span>
            </div>
            ${centerBadge}
            <div class="sp-team sp-right">
              <span class="sp-name ${spotlightMatch.team2.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(spotlightMatch.team2.title)}</span>
              <img src="${escapeHtml(getTeamLogo(spotlightMatch.team2))}" alt="" class="sp-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            </div>
          </div>

          ${res.played && res.sets.length > 0 ? `
            <div class="set-partials-row">
              <span style="font-size:0.7rem; font-weight:700; color:var(--text-tertiary);">Parziali:</span>
              ${res.sets.map(s => `<span class="set-chip">${escapeHtml(s)}</span>`).join('')}
            </div>
          ` : ''}

          <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; flex-wrap:wrap; font-size:0.74rem; color:var(--text-tertiary);">
            <span>⏱️ Ritmo: ${escapeHtml(spacingNote)}</span>
            <button type="button" class="text-action-btn" data-action="open-match" data-match-id="${spotlightMatch.id}">
              ${res.played ? 'Vedi dettaglio gara ›' : 'Apri dettagli &amp; Calendario ›'}
            </button>
          </div>
        </div>
      `;
    }
  }

  function renderCompactMatchesList() {
    const listEl = document.getElementById('matchesList');
    if (!listEl) return;

    const allMatches = getLadispoliMatches();
    const playedCount = allMatches.filter(m => isMatchPlayed(m)).length;
    const playedTab = document.querySelector('#matchFilterControl [data-matchfilter="played"]');
    if (playedTab) {
      playedTab.textContent = playedCount > 0 ? `Risultati (${playedCount})` : 'Risultati';
    }

    const matches = allMatches.filter(m => {
      const played = isMatchPlayed(m);
      if (state.matchFilter === 'upcoming') return !played;
      if (state.matchFilter === 'played') return played;
      if (state.matchFilter === 'home') return m.isHome;
      if (state.matchFilter === 'away') return !m.isHome;
      return true;
    });

    if (matches.length === 0) {
      listEl.innerHTML = `
        <div class="media-empty-card">
          <span>Nessuna partita in questa sezione al momento.</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = matches.map(m => {
      const res = getMatchResultInfo(m);
      const dateStr = m.dateObj
        ? m.dateObj.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : m.date;
      const haBadge = res.played
        ? `<span class="lm-result-badge ${res.didWeWin ? 'is-win' : 'is-loss'}">${res.didWeWin ? 'Vittoria' : 'Sconfitta'}</span>`
        : (m.isHome
          ? `<span class="ha-tag ha-home" style="margin:0;">In Casa</span>`
          : `<span class="ha-tag ha-away" style="margin:0;">Trasferta</span>`);
      const timeStr = (m.time || '18.00').replace('.', ':');
      const centerSlot = res.played
        ? `<span class="mc-score-pill ${res.didWeWin ? 'is-win' : 'is-loss'}">${res.scoreText}</span>`
        : `<span class="mc-center-time">${escapeHtml(timeStr)}</span>`;

      return `
        <button type="button" class="matchup-card" data-action="open-match" data-match-id="${m.id}">
          <div class="mc-header">
            <span><strong>${escapeHtml(m.day)}</strong> · <span class="mc-date-time" style="text-transform:capitalize;">${escapeHtml(dateStr)}</span></span>
            ${haBadge}
          </div>

          <div class="mc-versus-row">
            <div class="mc-team">
              <img src="${escapeHtml(getTeamLogo(m.team1))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
              <span class="mc-team-title ${m.team1.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team1.title)}</span>
            </div>

            ${centerSlot}

            <div class="mc-team mc-team-right">
              <span class="mc-team-title ${m.team2.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team2.title)}</span>
              <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            </div>
          </div>

          ${res.played && res.sets.length > 0 ? `
            <div class="set-partials-row">
              ${res.sets.map((s, idx) => `<span class="set-chip">${idx + 1}° Set: ${escapeHtml(s)}</span>`).join('')}
            </div>
          ` : ''}

          <div class="mc-footer">
            <span class="mc-gym">📍 ${escapeHtml(m.stadium)}</span>
            <span style="color:var(--accent-blue); font-weight:600; flex-shrink:0;">${res.played ? 'Dettaglio Set ›' : 'Calendario &amp; Maps ›'}</span>
          </div>
        </button>
      `;
    }).join('');
  }

  function openMatchDetailSheet(matchId) {
    const matches = getLadispoliMatches();
    const m = matches.find(item => String(item.id) === String(matchId));
    if (!m) return;

    const res = getMatchResultInfo(m);
    document.getElementById('sheetMatchGiornata').textContent = `${m.day} · Gara #${m.ng}`;
    document.getElementById('sheetMatchTitle').textContent = `${m.team1.title} vs ${m.team2.title}`;

    const fullDate = m.dateObj
      ? m.dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : m.date;

    const centerEl = res.played
      ? `<span class="mc-score-pill ${res.didWeWin ? 'is-win' : 'is-loss'}" style="font-size:1.05rem;">${res.scoreText}</span>`
      : `<span class="mc-center-time">${escapeHtml((m.time || '').replace('.', ':'))}</span>`;

    const refereeHtml = m['1referee'] && m['1referee'] !== 'DESIGNATO'
      ? `<div style="font-size:0.78rem; color:var(--text-tertiary); margin-top:0.25rem;"><strong>1° Arbitro:</strong> ${escapeHtml(m['1referee'])}</div>`
      : '';

    const setsHtml = res.played && res.sets.length > 0
      ? `<div class="set-partials-row" style="margin-top:0.55rem;">${res.sets.map((s, idx) => `<span class="set-chip">${idx + 1}° Set: ${escapeHtml(s)}</span>`).join('')}</div>`
      : '';

    document.getElementById('sheetMatchBody').innerHTML = `
      <div class="entry-card" style="margin-bottom: 1rem;">
        <div class="mc-versus-row" style="border-top:none; padding-top:0;">
          <div class="mc-team">
            <img src="${escapeHtml(getTeamLogo(m.team1))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            <span class="mc-team-title ${m.team1.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team1.title)}</span>
          </div>
          ${centerEl}
          <div class="mc-team mc-team-right">
            <span class="mc-team-title ${m.team2.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team2.title)}</span>
            <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          </div>
        </div>
        ${res.played ? `<div style="margin-top:0.2rem;"><span class="lm-result-badge ${res.didWeWin ? 'is-win' : 'is-loss'}">${res.didWeWin ? 'Vittoria Volley Ladispoli' : 'Partita conclusa'}</span></div>` : ''}
        ${setsHtml}
        <div class="entry-title" style="text-transform: capitalize; margin-top: 0.45rem;">${escapeHtml(fullDate)}</div>
        <div class="entry-meta">
          <span>${m.isHome ? '🏠 Partita in Casa (Pallone N. Panzani)' : '🚌 Partita in Trasferta'}</span>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">
          <strong>Palestra:</strong> ${escapeHtml(m.stadium)}
        </div>
        ${refereeHtml}
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.55rem;">
        <a href="${buildGoogleCalendarUrl(m)}" target="_blank" rel="noopener noreferrer" class="btn-primary-full">
          Aggiungi a Google Calendar
        </a>
        <button type="button" class="btn-secondary-half" style="width:100%;" data-action="download-match-ics" data-match-id="${m.id}">
          Scarica per Calendario iPhone / Apple (.ics)
        </button>
        <a href="${buildGoogleMapsUrl(m)}" target="_blank" rel="noopener noreferrer" class="btn-secondary-half" style="width:100%;">
          Apri indicazioni Palestra su Google Maps
        </a>
      </div>
    `;

    openSheet('sheetMatch');
  }

  function renderStandings() {
    const tbody = document.getElementById('standingsBody');
    if (!tbody) return;
    const teams = (Array.isArray(state.fipavTables) ? state.fipavTables[0]?.data?.teams : state.fipavTables?.data?.teams) || [];

    tbody.innerHTML = teams.map((t, idx) => {
      const isUs = String(t.id) === LADISPOLI_TEAM_ID;
      return `
        <tr class="${isUs ? 'is-ladispoli-row' : ''}">
          <td class="col-rank">${t.pos || (idx + 1)}</td>
          <td>
            <div class="team-cell">
              <img src="${escapeHtml(getTeamLogo(t))}" alt="" class="mini-logo" onerror="this.src='/logo-ladispoli.jpg'" />
              <span>${escapeHtml(t.title)}</span>
            </div>
          </td>
          <td class="col-num"><strong>${escapeHtml(t.p)}</strong></td>
          <td class="col-num">${escapeHtml(t.g)}</td>
          <td class="col-num">${escapeHtml(t.gv)}</td>
          <td class="col-num">${escapeHtml(t.gp)}</td>
          <td class="col-num hide-xs">${escapeHtml(t.sv)}/${escapeHtml(t.sp)}</td>
        </tr>
      `;
    }).join('');

    const meta = document.getElementById('fipavSyncMeta');
    if (meta) {
      let timeLabel = '';
      if (state.fipavUpdatedAt) {
        try {
          const d = new Date(state.fipavUpdatedAt);
          if (!isNaN(d.getTime())) {
            timeLabel = ` · Aggiornato ${d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
          }
        } catch (_) {}
      }
      meta.textContent = `Dati ufficiali FIPAV Comitato Territoriale Roma · Girone 64602${timeLabel}`;
    }
  }

  function renderGironeMatchesByRound() {
    const sel = document.getElementById('giornataSelect');
    const listEl = document.getElementById('gironeMatchesList');
    if (!sel || !listEl) return;

    const allMatches = state.fipavCalendar?.data?.matches || [];
    if (allMatches.length === 0) return;

    const giornate = [];
    allMatches.forEach(m => {
      if (m.day && !giornate.includes(m.day)) giornate.push(m.day);
    });
    giornate.sort((a, b) => (parseInt(a.replace(/\D+/g, ''), 10) || 0) - (parseInt(b.replace(/\D+/g, ''), 10) || 0));

    if (!state.hasAutoSelectedRound) {
      let latestPlayedRound = '';
      for (const g of giornate) {
        if (allMatches.some(m => m.day === g && isMatchPlayed(m))) {
          latestPlayedRound = g;
        }
      }
      if (latestPlayedRound) {
        state.selectedGiornata = latestPlayedRound;
      }
      state.hasAutoSelectedRound = true;
    }

    if (!giornate.includes(state.selectedGiornata) && giornate.length > 0) {
      state.selectedGiornata = giornate[0];
    }

    sel.innerHTML = giornate.map(g =>
      `<option value="${escapeHtml(g)}" ${g === state.selectedGiornata ? 'selected' : ''}>${escapeHtml(g)}</option>`
    ).join('');

    const roundMatches = allMatches.filter(m => m.day === state.selectedGiornata);
    listEl.innerHTML = roundMatches.map(m => {
      const hasUs = String(m.team1?.id) === LADISPOLI_TEAM_ID || String(m.team2?.id) === LADISPOLI_TEAM_ID;
      const res = getMatchResultInfo(m);
      const centerTag = res.played
        ? `<span class="mc-score-pill ${hasUs ? (res.didWeWin ? 'is-win' : 'is-loss') : 'is-neutral'}">${res.scoreText}</span>`
        : `<span class="sp-vs">vs</span>`;

      return `
        <div class="list-row" style="cursor:default; flex-direction:column; align-items:stretch; gap:0.45rem; ${hasUs ? 'background:var(--accent-red-soft);' : ''}">
          <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-tertiary); font-weight:600;">
            <span>Gara #${escapeHtml(m.ng)} · ${escapeHtml(m.date)}</span>
            <span>${res.played ? 'Conclusa' : 'Ore ' + escapeHtml((m.time || '').replace('.', ':'))}</span>
          </div>
          <div class="mc-versus-row" style="border:none; padding:0.15rem 0;">
            <div class="mc-team">
              <img src="${escapeHtml(getTeamLogo(m.team1))}" alt="" class="mc-logo" style="width:28px; height:28px;" onerror="this.src='/logo-ladispoli.jpg'" />
              <span class="mc-team-title ${String(m.team1?.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}" style="font-size:0.8rem;">${escapeHtml(m.team1?.title)}</span>
            </div>
            ${centerTag}
            <div class="mc-team mc-team-right">
              <span class="mc-team-title ${String(m.team2?.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}" style="font-size:0.8rem;">${escapeHtml(m.team2?.title)}</span>
              <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" style="width:28px; height:28px;" onerror="this.src='/logo-ladispoli.jpg'" />
            </div>
          </div>
          ${res.played && res.sets.length > 0 ? `
            <div class="set-partials-row">
              ${res.sets.map(s => `<span class="set-chip">${escapeHtml(s)}</span>`).join('')}
            </div>
          ` : ''}
          <div style="font-size:0.72rem; color:var(--text-tertiary);">📍 ${escapeHtml(m.stadium)}</div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // GOOGLE ACCOUNT & PWA INSTALL
  // ==========================================
  let googleInitStarted = false;
  let googleButtonRendered = false;

  function updateAccountChrome() {
    const btn = document.getElementById('btnAccountToggle');
    const av = document.getElementById('accountPillAvatar');
    const gIcon = document.getElementById('accountGoogleIcon');
    const label = document.getElementById('accountPillLabel');
    if (!btn || !av || !gIcon || !label) return;

    if (state.currentUser) {
      btn.classList.add('is-signed-in');
      gIcon.classList.add('hidden');
      av.classList.remove('hidden');
      const firstName = (state.currentUser.name || 'Tu').split(' ')[0];
      label.textContent = firstName;
      if (state.currentUser.picture) {
        av.innerHTML = `<img src="${escapeHtml(state.currentUser.picture)}" alt="" />`;
      } else {
        av.textContent = getInitials(state.currentUser.name);
      }
    } else {
      btn.classList.remove('is-signed-in');
      av.classList.add('hidden');
      av.innerHTML = '';
      gIcon.classList.remove('hidden');
      label.textContent = 'Accedi';
    }
  }

  function renderPwaInstallState() {
    const row = document.getElementById('pwaInstallRow');
    const hint = document.getElementById('pwaInstallHint');
    const btn = document.getElementById('btnPwaInstall');
    if (!row || !hint || !btn) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      hint.textContent = 'App già installata e avviata a schermo intero.';
      btn.classList.add('hidden');
      return;
    }

    if (state.deferredInstallPrompt) {
      hint.textContent = 'Installa Volley Ladispoli sulla schermata Home in 1 tocco.';
      btn.classList.remove('hidden');
    } else {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      hint.textContent = isIos
        ? 'Su iPhone/iPad tocca Condividi (in basso) poi "Aggiungi alla schermata Home".'
        : 'Dal menu del browser (⋮) tocca "Installa app" o "Aggiungi a schermata Home".';
      btn.classList.add('hidden');
    }
  }

  function initGoogleSignIn() {
    if (!state.appConfig.googleClientId || googleInitStarted) return;

    let attempts = 0;
    const tryInit = () => {
      if (window.google?.accounts?.id) {
        googleInitStarted = true;
        window.google.accounts.id.initialize({
          client_id: state.appConfig.googleClientId,
          callback: handleGoogleCredentialResponse
        });
        renderGoogleSignInButton();
      } else if (attempts < 25) {
        attempts += 1;
        setTimeout(tryInit, 200);
      }
    };
    tryInit();
  }

  function renderGoogleSignInButton() {
    const wrap = document.getElementById('googleSignInBtnContainer');
    const missingNote = document.getElementById('googleConfigMissingNote');
    if (!wrap) return;

    if (!state.appConfig.googleClientId) {
      wrap.innerHTML = '';
      missingNote?.classList.remove('hidden');
      return;
    }

    missingNote?.classList.add('hidden');
    if (window.google?.accounts?.id && !googleButtonRendered) {
      wrap.innerHTML = '';
      window.google.accounts.id.renderButton(wrap, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        locale: 'it'
      });
      googleButtonRendered = true;
    }
  }

  async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    try {
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: response.credential })
      });
      state.currentUser = res.user;
      updateAccountChrome();
      closeSheet('sheetAccount');
      renderMediaView();
      showToast(`Benvenuto, ${(res.user.name || '').split(' ')[0]}!`);

      if (typeof state.pendingLoginCallback === 'function') {
        const cb = state.pendingLoginCallback;
        state.pendingLoginCallback = null;
        cb();
      }
    } catch (err) {
      showToast(err.message || 'Accesso Google non riuscito');
    }
  }

  function openAccountSheet(onLoginCallback = null) {
    state.pendingLoginCallback = onLoginCallback;
    const outPanel = document.getElementById('accountLoggedOutPanel');
    const inPanel = document.getElementById('accountLoggedInPanel');
    const title = document.getElementById('sheetAccountTitle');
    const sub = document.getElementById('sheetAccountSubtitle');

    if (state.currentUser) {
      title.textContent = 'Il tuo Profilo';
      sub.textContent = 'Collegato con Google · Tracking social attivo';
      outPanel.classList.add('hidden');
      inPanel.classList.remove('hidden');

      const av = document.getElementById('accountUserAvatar');
      av.src = state.currentUser.picture || '/logo-ladispoli.jpg';
      document.getElementById('accountUserName').textContent = state.currentUser.name || 'Giocatore';
      document.getElementById('accountUserEmail').textContent = state.currentUser.email || '';

      const uid = state.currentUser.id;
      const vidCount = state.videos.filter(v => v.authorId === uid).length;
      const sockCount = state.socks.filter(s => s.authorId === uid).length;
      const likesReceived = state.videos
        .filter(v => v.authorId === uid)
        .reduce((sum, v) => sum + (Array.isArray(v.likes) ? v.likes.length : 0), 0) +
        state.socks
          .filter(s => s.authorId === uid)
          .reduce((sum, s) => sum + (Array.isArray(s.upvotes) ? s.upvotes.length : 0), 0);

      document.getElementById('accountUserStats').innerHTML = `
        <div class="sheet-kpi-box">
          <div class="sheet-kpi-num">${vidCount}</div>
          <span class="sheet-kpi-label">Video</span>
        </div>
        <div class="sheet-kpi-box">
          <div class="sheet-kpi-num">${sockCount}</div>
          <span class="sheet-kpi-label">Calzini</span>
        </div>
        <div class="sheet-kpi-box">
          <div class="sheet-kpi-num" style="color:var(--accent-red);">${likesReceived}</div>
          <span class="sheet-kpi-label">Voti ricevuti</span>
        </div>
      `;

      const sel = document.getElementById('accountLinkPlayerSelect');
      const currentPid = state.currentUser.linkedPlayerId || '';
      sel.innerHTML = `<option value="">-- Nessun giocatore collegato --</option>` +
        state.players.map(p => `<option value="${p.id}" ${p.id === currentPid ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    } else {
      title.textContent = 'Accedi con Google';
      sub.textContent = 'Carica video, partecipa ai calzini e vota come sui social';
      inPanel.classList.add('hidden');
      outPanel.classList.remove('hidden');
      renderGoogleSignInButton();
    }

    renderPwaInstallState();
    openSheet('sheetAccount');
  }

  function requireGoogleLogin(callback, allowAdminFallback = false) {
    if (state.currentUser) {
      return callback();
    }
    if (allowAdminFallback && state.isAdmin && state.adminCode) {
      return callback();
    }
    showToast('Accedi con Google per continuare');
    openAccountSheet(callback);
  }

  // ==========================================
  // MEDIA: VIDEOS & STYLISH SOCKS
  // ==========================================
  function detectVideoPlatform(url) {
    const val = String(url || '').trim();
    if (!val) return '';
    const low = val.toLowerCase();
    if (low.includes('drive.google.com') || low.includes('docs.google.com')) return 'Google Drive rilevato';
    if (low.includes('youtube.com') || low.includes('youtu.be')) return 'YouTube / Shorts rilevato';
    if (low.includes('instagram.com')) return 'Instagram Reels rilevato';
    if (low.includes('tiktok.com')) return 'TikTok rilevato';
    if (/\.(mp4|mov|webm)(\?|$)/i.test(low) || low.includes('cloudinary.com')) return 'Video diretto MP4 rilevato';
    if (val.startsWith('http://') || val.startsWith('https://')) return 'Link video rilevato';
    return '';
  }

  function getSourceBadgeText(sourceType) {
    if (sourceType === 'gdrive') return 'Google Drive';
    if (sourceType === 'youtube') return 'YouTube';
    if (sourceType === 'instagram') return 'Instagram';
    if (sourceType === 'tiktok') return 'TikTok';
    return 'Video MP4';
  }

  function formatRelativeTime(iso) {
    if (!iso) return '';
    try {
      const dt = new Date(iso);
      const diffMin = Math.floor((Date.now() - dt.getTime()) / 60000);
      if (diffMin < 1) return 'Adesso';
      if (diffMin < 60) return `${diffMin}m fa`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h fa`;
      return dt.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    } catch (_) {
      return '';
    }
  }

  function renderAuthorAvatarHtml(item) {
    const linkedPlayer = item.authorPlayerId ? state.players.find(p => p.id === item.authorPlayerId) : null;
    const photo = linkedPlayer?.avatarUrl || item.authorPicture;
    const displayName = linkedPlayer ? linkedPlayer.name : (item.authorName || 'Squadra');
    if (photo) {
      return `<img src="${escapeHtml(photo)}" alt="" class="social-author-avatar" />`;
    }
    return `<div class="social-author-avatar" style="background:${linkedPlayer?.avatarColor || '#515158'}">${getInitials(displayName)}</div>`;
  }

  function renderMediaView() {
    const vidPane = document.getElementById('mediaVideosPane');
    const sockPane = document.getElementById('mediaSocksPane');
    if (!vidPane || !sockPane) return;

    if (state.mediaTab === 'socks') {
      vidPane.classList.add('hidden');
      sockPane.classList.remove('hidden');
      renderSocksFeed();
    } else {
      sockPane.classList.add('hidden');
      vidPane.classList.remove('hidden');
      const heading = document.getElementById('mediaVideosHeading');
      const sub = document.getElementById('mediaVideosSub');
      if (state.mediaTab === 'match') {
        heading.textContent = 'Video Partite & Allenamenti';
        sub.textContent = 'Azioni di gioco, set e allenamenti da Drive o MP4';
      } else {
        heading.textContent = 'Video divertenti della squadra';
        sub.textContent = 'Momenti dello spogliatoio da Drive, YouTube, Reels o MP4';
      }
      renderVideosFeed();
    }
  }

  function renderVideosFeed() {
    const listEl = document.getElementById('videosFeedList');
    if (!listEl) return;

    const category = state.mediaTab === 'match' ? 'match' : 'funny';
    const items = (state.videos || []).filter(v => (v.category || 'funny') === category);

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="media-empty-card">
          <div style="font-size:1.5rem;">🎬</div>
          <div>Nessun video in "${category === 'match' ? 'Partite / Allenamenti' : 'Divertenti'}" ancora.</div>
          <button type="button" class="btn-small-primary" onclick="document.getElementById('btnOpenUploadVideo').click()">
            + Carica il primo video
          </button>
        </div>
      `;
      return;
    }

    const uid = state.currentUser?.id || '';
    listEl.innerHTML = items.map(v => {
      const likes = Array.isArray(v.likes) ? v.likes : [];
      const isLiked = uid && likes.includes(uid);
      const linkedPlayer = v.authorPlayerId ? state.players.find(p => p.id === v.authorPlayerId) : null;
      const authorLabel = linkedPlayer ? `${v.authorName} (${linkedPlayer.name})` : (v.authorName || 'Compagno');
      const canDelete = state.isAdmin || (uid && uid === v.authorId);

      let playerHtml = '';
      if (v.sourceType === 'mp4') {
        playerHtml = `
          <div class="video-frame-wrap">
            <video src="${escapeHtml(v.mediaUrl)}" controls playsinline preload="metadata"></video>
          </div>
        `;
      } else if (v.embedUrl) {
        playerHtml = `
          <div class="video-frame-wrap">
            <iframe src="${escapeHtml(v.embedUrl)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>
          </div>
        `;
      } else {
        playerHtml = `
          <a href="${escapeHtml(v.mediaUrl)}" target="_blank" rel="noopener noreferrer" class="video-ext-card">
            <div>
              <div style="font-weight:700; font-size:0.86rem;">Apri su ${getSourceBadgeText(v.sourceType)}</div>
              <div style="font-size:0.74rem; color:var(--text-tertiary);">Tocca per guardare il video nel player esterno</div>
            </div>
            <span style="font-size:1.1rem; font-weight:700;">↗</span>
          </a>
        `;
      }

      return `
        <article class="video-card">
          <div class="video-author-row">
            <div class="video-author-left">
              ${renderAuthorAvatarHtml(v)}
              <div>
                <div class="video-author-name">${escapeHtml(authorLabel)}</div>
                <div class="video-author-meta">${escapeHtml(formatRelativeTime(v.createdAt))}</div>
              </div>
            </div>
            <span class="video-source-badge">${getSourceBadgeText(v.sourceType)}</span>
          </div>

          <div class="video-title">${escapeHtml(v.title)}</div>
          ${v.description ? `<div class="video-desc">${escapeHtml(v.description)}</div>` : ''}

          ${playerHtml}

          <div class="video-footer">
            <button type="button" class="like-btn ${isLiked ? 'is-liked' : ''}" data-action="like-video" data-video-id="${v.id}">
              <span>${isLiked ? '❤️' : '🤍'}</span>
              <span>${likes.length}</span>
            </button>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <a href="${escapeHtml(v.mediaUrl)}" target="_blank" rel="noopener noreferrer" class="text-action-btn" style="font-size:0.76rem;">Apri link ↗</a>
              ${canDelete ? `<button type="button" class="text-action-btn" style="color:var(--accent-red); font-size:0.76rem;" data-action="delete-video" data-video-id="${v.id}">Elimina</button>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderSocksFeed() {
    const listEl = document.getElementById('socksFeedList');
    if (!listEl) return;

    const items = [...(state.socks || [])];
    if (state.sockSort === 'top') {
      items.sort((a, b) => {
        const diff = (b.upvotes?.length || 0) - (a.upvotes?.length || 0);
        if (diff !== 0) return diff;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    } else {
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="media-empty-card" style="grid-column: 1 / -1;">
          <div style="font-size:1.6rem;">🧦</div>
          <div>Nessun calzino caricato ancora.</div>
          <button type="button" class="btn-small-primary" onclick="document.getElementById('btnOpenUploadSock').click()">
            + Carica i tuoi calzini
          </button>
        </div>
      `;
      return;
    }

    // Compute rank map by upvotes so #1/2/3 reflect leaderboard
    const rankedIds = [...items]
      .sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0))
      .map(s => s.id);

    const uid = state.currentUser?.id || '';
    listEl.innerHTML = items.map(s => {
      const upvotes = Array.isArray(s.upvotes) ? s.upvotes : [];
      const isUpvoted = uid && upvotes.includes(uid);
      const rankNum = rankedIds.indexOf(s.id) + 1;
      const rankCls = rankNum <= 3 ? `rank-${rankNum}` : '';
      const medal = rankNum === 1 ? '🥇 #1' : rankNum === 2 ? '🥈 #2' : rankNum === 3 ? '🥉 #3' : `#${rankNum}`;
      const ownerPlayer = s.playerId ? state.players.find(p => p.id === s.playerId) : null;
      const metaText = ownerPlayer
        ? `Di ${ownerPlayer.name} · postato da ${(s.authorName || '').split(' ')[0]}`
        : `Postato da ${s.authorName || 'Compagno'} · ${formatRelativeTime(s.createdAt)}`;
      const canDelete = state.isAdmin || (uid && uid === s.authorId);

      return `
        <article class="sock-card">
          <span class="sock-rank-badge ${rankCls}">${medal}</span>
          <button type="button" class="sock-photo-btn" data-action="open-lightbox" data-img-url="${escapeHtml(s.imageUrl)}" data-caption="${escapeHtml(s.title)}">
            <img src="${escapeHtml(s.imageUrl)}" alt="${escapeHtml(s.title)}" class="sock-photo-img" loading="lazy" />
          </button>
          <div class="sock-card-body">
            <div>
              <div class="sock-title">${escapeHtml(s.title)}</div>
              <div class="sock-meta">${escapeHtml(metaText)}</div>
            </div>
            <div class="sock-actions-row">
              <button type="button" class="upvote-btn ${isUpvoted ? 'is-upvoted' : ''}" data-action="upvote-sock" data-sock-id="${s.id}">
                <span>▲</span>
                <span>${upvotes.length}</span>
              </button>
              ${canDelete ? `<button type="button" class="text-action-btn" style="color:var(--accent-red); font-size:0.75rem;" data-action="delete-sock" data-sock-id="${s.id}">Elimina</button>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function compressImageToJpeg(file, maxDim = 1080, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          canvas.toBlob(blob => resolve({ dataUrl, blob }), 'image/jpeg', quality);
        };
        img.onerror = () => reject(new Error('Immagine non valida'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Errore lettura file'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadFileToMediaStorage(file, folder, resourceType, onProgress) {
    if (state.appConfig.cloudinaryEnabled) {
      const sig = await apiFetch('/api/upload/signature', {
        method: 'POST',
        body: JSON.stringify({ folder })
      });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sig.apiKey);
      formData.append('timestamp', String(sig.timestamp));
      formData.append('folder', sig.folder);
      formData.append('signature', sig.signature);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable && typeof onProgress === 'function') {
            onProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && parsed.secure_url) {
              resolve({ url: parsed.secure_url, thumbUrl: '' });
            } else {
              reject(new Error(parsed?.error?.message || 'Errore upload Cloudinary'));
            }
          } catch (_) {
            reject(new Error('Risposta Cloudinary non valida'));
          }
        };
        xhr.onerror = () => reject(new Error('Errore di rete durante upload'));
        xhr.send(formData);
      });
    }

    // Local fallback (max 15 MB)
    if (file.size > 15 * 1024 * 1024) {
      throw new Error('File oltre 15 MB: usa un link Google Drive oppure configura Cloudinary Free');
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/file');
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name || 'media.mp4'));
      if (state.adminCode) {
        xhr.setRequestHeader('X-Admin-Code', state.adminCode);
      }
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && parsed.url) {
            resolve({ url: parsed.url, thumbUrl: '' });
          } else {
            reject(new Error(parsed?.error || 'Errore upload file'));
          }
        } catch (_) {
          reject(new Error('Errore risposta server upload'));
        }
      };
      xhr.onerror = () => reject(new Error('Errore di rete upload'));
      xhr.send(file);
    });
  }

  function openUploadVideoSheet() {
    requireGoogleLogin(() => {
      const defaultCat = state.mediaTab === 'match' ? 'match' : 'funny';
      document.getElementById('videoCategoryInput').value = defaultCat;
      document.querySelectorAll('#videoCategoryTabs .seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-vcat') === defaultCat);
      });

      state.videoUploadSource = 'link';
      document.querySelectorAll('#videoSourceTabs .seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-vsrc') === 'link');
      });
      document.getElementById('videoLinkPane').classList.remove('hidden');
      document.getElementById('videoFilePane').classList.add('hidden');
      document.getElementById('videoUrlInput').value = '';
      document.getElementById('videoUrlDetectedBadge').classList.add('hidden');
      document.getElementById('videoFileInput').value = '';
      document.getElementById('videoFileDropLabel').textContent = 'Tocca per selezionare un video MP4 / MOV / WEBM';
      document.getElementById('videoFileHint').textContent = state.appConfig.cloudinaryEnabled
        ? 'Cloudinary attivo: supporta file video fino a 100 MB.'
        : 'Upload diretto fino a 15 MB (per video lunghi usa Link Google Drive).';
      document.getElementById('videoUploadProgressWrap').classList.add('hidden');
      document.getElementById('videoTitleInput').value = '';
      document.getElementById('videoDescInput').value = '';
      openSheet('sheetUploadVideo');
    }, true);
  }

  function openUploadSockSheet() {
    requireGoogleLogin(() => {
      state.sockCompressedDataUrl = '';
      state.sockRawFile = null;
      document.getElementById('sockPhotoInput').value = '';
      document.getElementById('sockDropLabel').textContent = 'Tocca per scegliere o scattare la foto';
      document.getElementById('sockPhotoPreviewWrap').classList.add('hidden');
      document.getElementById('sockUploadProgressWrap').classList.add('hidden');
      document.getElementById('sockTitleInput').value = '';

      const sel = document.getElementById('sockPlayerSelect');
      const linked = state.currentUser?.linkedPlayerId || '';
      sel.innerHTML = `<option value="">-- Non specificato --</option>` +
        state.players.map(p => `<option value="${p.id}" ${p.id === linked ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');

      openSheet('sheetUploadSock');
    }, true);
  }

  // ==========================================
  // ADMIN PANEL & PERMISSIONS
  // ==========================================
  function updateAdminChrome() {
    const btn = document.getElementById('btnAdminToggle');
    const label = document.getElementById('adminStatusLabel');
    if (!btn || !label) return;

    if (state.isAdmin) {
      btn.classList.add('is-unlocked');
      label.textContent = 'Admin attivo';
    } else {
      btn.classList.remove('is-unlocked');
      label.textContent = 'Admin';
    }
  }

  function openAdminSheet(onSuccessCallback = null) {
    state.pendingAdminCallback = onSuccessCallback;
    const unlockForm = document.getElementById('formAdminUnlock');
    const unlockedPanel = document.getElementById('adminUnlockedPanel');
    const title = document.getElementById('sheetAdminTitle');
    const sub = document.getElementById('sheetAdminSubtitle');

    if (state.isAdmin && !onSuccessCallback) {
      title.textContent = 'Impostazioni Admin';
      sub.textContent = 'Gestisci la sessione temporanea o cambia il codice Admin';
      unlockForm.classList.add('hidden');
      unlockedPanel.classList.remove('hidden');
    } else {
      title.textContent = 'Codice Admin';
      sub.textContent = onSuccessCallback
        ? 'Inserisci il codice Admin (098765) per confermare questa operazione'
        : 'Inserisci il codice Admin per sbloccare la sessione temporanea';
      unlockForm.classList.remove('hidden');
      unlockedPanel.classList.add('hidden');
      document.getElementById('adminCodeModalInput').value = '';
      setTimeout(() => document.getElementById('adminCodeModalInput')?.focus(), 60);
    }
    openSheet('sheetAdmin');
  }

  function ensureAdminOrPrompt(callback) {
    if (state.isAdmin && state.adminCode) {
      return callback(state.adminCode);
    }
    openAdminSheet(callback);
  }

  // ==========================================
  // EVENTS SETUP
  // ==========================================
  function initEvents() {
    // Bottom Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const viewName = tab.getAttribute('data-view');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.view-panel').forEach(p => p.classList.toggle('active', p.id === `view-${viewName}`));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Bottom Bar "+ Segna" Button
    document.getElementById('btnFabAddPaste').addEventListener('click', () => openPasteFormSheet());

    // Topbar Account & Admin
    document.getElementById('btnAccountToggle').addEventListener('click', () => openAccountSheet());
    document.getElementById('btnAdminToggle').addEventListener('click', () => openAdminSheet());

    // Sheet Close Buttons & Backdrop click
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeSheet(btn.getAttribute('data-close')));
    });
    document.querySelectorAll('.sheet-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeSheet(backdrop.id);
      });
    });

    // Account Sheet: Link Player, Logout & PWA Install
    document.getElementById('accountLinkPlayerSelect').addEventListener('change', async (e) => {
      try {
        const res = await apiFetch('/api/auth/link-player', {
          method: 'POST',
          body: JSON.stringify({ playerId: e.target.value })
        });
        state.currentUser = res.user;
        renderMediaView();
        showToast('Profilo giocatore aggiornato');
      } catch (err) {
        showToast(err.message);
      }
    });

    document.getElementById('btnLogoutGoogle').addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (_) {}
      state.currentUser = null;
      updateAccountChrome();
      closeSheet('sheetAccount');
      renderMediaView();
      showToast('Uscito dall\'account Google');
    });

    document.getElementById('btnPwaInstall').addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      renderPwaInstallState();
    });

    // Sort Toggle (Priorità vs A-Z)
    const btnSort = document.getElementById('btnSortToggle');
    btnSort.addEventListener('click', () => {
      state.playerSort = state.playerSort === 'priority' ? 'alpha' : 'priority';
      btnSort.textContent = state.playerSort === 'priority' ? 'Ordine: Priorità' : 'Ordine: A-Z';
      renderCompactPlayersList();
    });

    // Player Segmented Filter
    document.querySelectorAll('#playerFilterControl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.playerFilter = btn.getAttribute('data-filter');
        document.querySelectorAll('#playerFilterControl .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderCompactPlayersList();
      });
    });

    // Player Search
    document.getElementById('playerSearchInput').addEventListener('input', (e) => {
      state.playerSearch = e.target.value;
      renderCompactPlayersList();
    });

    // Disclosure Archive Toggle
    const btnArchive = document.getElementById('btnToggleHistoryLog');
    const archiveBox = document.getElementById('historyLogContainer');
    btnArchive.addEventListener('click', () => {
      const isExpanded = btnArchive.getAttribute('aria-expanded') === 'true';
      btnArchive.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      archiveBox.classList.toggle('hidden', isExpanded);
    });

    // Add Paste from Player Sheet
    document.getElementById('btnAddPasteFromSheet').addEventListener('click', () => {
      const pid = state.activePlayerSheetId;
      closeSheet('sheetPlayer');
      openPasteFormSheet({ playerId: pid });
    });

    // Quick Incident Date Tabs ("Oggi" / "Ieri" / "Altra data")
    document.querySelectorAll('#incidentQuickTabs .inc-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const rawOffset = tab.getAttribute('data-offset');
        const incInput = document.getElementById('pasteIncidentDateInput');
        document.querySelectorAll('#incidentQuickTabs .inc-tab').forEach(b => b.classList.toggle('active', b === tab));

        if (rawOffset === 'custom') {
          incInput.classList.remove('hidden');
          setTimeout(() => {
            incInput.focus();
            if (typeof incInput.showPicker === 'function') {
              try { incInput.showPicker(); } catch (_) {}
            }
          }, 20);
        } else {
          const offset = parseInt(rawOffset, 10) || 0;
          incInput.value = addDaysYMD(getTodayYMD(), offset);
          incInput.classList.add('hidden');
        }
      });
    });

    // Submit Paste Form
    document.getElementById('formPaste').addEventListener('submit', async (e) => {
      e.preventDefault();
      const entryId = document.getElementById('pasteEntryId').value;
      const providedCode = state.isAdmin
        ? state.adminCode
        : document.getElementById('formAdminCodeInput').value.trim();

      if (!providedCode) {
        showToast('Inserisci il codice Admin');
        document.getElementById('formAdminCodeInput')?.focus();
        return;
      }

      const playerId = document.getElementById('pastePlayerSelect').value;
      const reasonTitle = document.getElementById('pasteReasonTitleInput').value.trim();
      const incidentDate = document.getElementById('pasteIncidentDateInput').value || getTodayYMD();

      if (!playerId) {
        showToast('Seleziona un giocatore');
        return;
      }
      if (!reasonTitle) {
        showToast('Scegli o scrivi il motivo delle paste');
        document.getElementById('pasteReasonTitleInput')?.focus();
        return;
      }

      const existingEntry = entryId ? state.pasteEntries.find(x => x.id === entryId) : null;
      const payload = {
        adminCode: providedCode,
        playerId,
        quantity: 1,
        categoryIcon: '🥐',
        reasonTitle,
        reasonDetails: '',
        incidentDate,
        dueDate: null,
        status: existingEntry ? existingEntry.status : 'pending',
        saveAsPreset: false
      };

      const submitBtn = document.getElementById('btnSubmitPasteForm');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvataggio...';
      }

      try {
        if (entryId) {
          const res = await apiFetch(`/api/paste/${entryId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
          state.pasteEntries = res.pasteEntries;
          showToast('Modifica salvata');
        } else {
          const res = await apiFetch('/api/paste', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          state.pasteEntries = res.pasteEntries;
          showToast('Paste segnate nello spogliatoio');
        }

        saveLocalBackup();
        closeSheet('sheetPasteForm');
        renderPasteView();
      } catch (err) {
        showToast(err.message || 'Codice Admin non valido');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Conferma';
        }
      }
    });

    // Admin Unlock Form
    document.getElementById('formAdminUnlock').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('adminCodeModalInput').value.trim();
      if (!code) return;
      try {
        await apiFetch('/api/admin/verify', {
          method: 'POST',
          body: JSON.stringify({ code })
        });
        closeSheet('sheetAdmin');
        if (typeof state.pendingAdminCallback === 'function') {
          const cb = state.pendingAdminCallback;
          state.pendingAdminCallback = null;
          cb(code);
        } else {
          state.adminCode = code;
          state.isAdmin = true;
          updateAdminChrome();
          renderPasteView();
          renderMediaView();
          showToast('Modalità Admin temporanea attiva');
        }
      } catch (err) {
        showToast(err.message || 'Codice errato');
      }
    });

    // Change Admin Code
    document.getElementById('formAdminChangeCode')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newCode = document.getElementById('newAdminCodeInput').value.trim();
      try {
        await apiFetch('/api/admin/change-code', {
          method: 'POST',
          body: JSON.stringify({ adminCode: state.adminCode, newCode })
        });
        state.adminCode = newCode;
        document.getElementById('newAdminCodeInput').value = '';
        showToast('Nuovo codice Admin salvato');
      } catch (err) {
        showToast(err.message);
      }
    });

    // Lock Admin
    document.getElementById('btnLockAdmin').addEventListener('click', () => {
      state.isAdmin = false;
      state.adminCode = '';
      updateAdminChrome();
      closeSheet('sheetAdmin');
      renderPasteView();
      renderMediaView();
      showToast('Sessione Admin bloccata');
    });

    // Calendar Prev/Next Month Buttons
    const btnPrevM = document.getElementById('btnCalPrevMonth');
    const btnNextM = document.getElementById('btnCalNextMonth');
    if (btnPrevM) {
      btnPrevM.addEventListener('click', () => {
        const idx = SEASON_MONTHS.findIndex(m => m.key === state.calMonthKey);
        if (idx > 0) {
          state.calMonthKey = SEASON_MONTHS[idx - 1].key;
          renderSpatialCalendar();
        }
      });
    }
    if (btnNextM) {
      btnNextM.addEventListener('click', () => {
        const idx = SEASON_MONTHS.findIndex(m => m.key === state.calMonthKey);
        if (idx !== -1 && idx < SEASON_MONTHS.length - 1) {
          state.calMonthKey = SEASON_MONTHS[idx + 1].key;
          renderSpatialCalendar();
        }
      });
    }

    // Calendar Filter & Export
    document.querySelectorAll('#matchFilterControl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.matchFilter = btn.getAttribute('data-matchfilter');
        document.querySelectorAll('#matchFilterControl .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderCompactMatchesList();
      });
    });

    document.getElementById('btnDownloadAllIcs').addEventListener('click', () => {
      const matches = getLadispoliMatches();
      if (matches.length === 0) return;
      downloadIcsFile('calendario-volley-ladispoli-2026-2027.ics', generateIcsContent(matches));
      showToast('Calendario completo (22 gare) scaricato');
    });

    document.getElementById('btnRefreshFipav').addEventListener('click', () => loadFipavData(true));
    document.getElementById('btnRefreshFipavCal')?.addEventListener('click', () => loadFipavData(true));
    document.getElementById('giornataSelect').addEventListener('change', (e) => {
      state.selectedGiornata = e.target.value;
      renderGironeMatchesByRound();
    });

    // MEDIA VIEW CONTROLS (Divertenti / Partite / Calzini)
    document.querySelectorAll('#mediaTabControl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mediaTab = btn.getAttribute('data-mediatab');
        document.querySelectorAll('#mediaTabControl .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderMediaView();
      });
    });

    document.getElementById('btnOpenUploadVideo').addEventListener('click', openUploadVideoSheet);
    document.getElementById('btnOpenUploadSock').addEventListener('click', openUploadSockSheet);

    const btnSockSort = document.getElementById('btnSockSortToggle');
    btnSockSort.addEventListener('click', () => {
      state.sockSort = state.sockSort === 'top' ? 'recent' : 'top';
      btnSockSort.textContent = state.sockSort === 'top' ? 'Più votati' : 'Più recenti';
      renderSocksFeed();
    });

    // Upload Video Form Controls
    document.querySelectorAll('#videoCategoryTabs .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-vcat');
        document.getElementById('videoCategoryInput').value = cat;
        document.querySelectorAll('#videoCategoryTabs .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    document.querySelectorAll('#videoSourceTabs .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const src = btn.getAttribute('data-vsrc');
        state.videoUploadSource = src;
        document.querySelectorAll('#videoSourceTabs .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('videoLinkPane').classList.toggle('hidden', src !== 'link');
        document.getElementById('videoFilePane').classList.toggle('hidden', src !== 'file');
      });
    });

    document.getElementById('videoUrlInput').addEventListener('input', (e) => {
      const badge = document.getElementById('videoUrlDetectedBadge');
      const detected = detectVideoPlatform(e.target.value);
      if (detected) {
        badge.textContent = detected;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });

    document.getElementById('videoFileInput').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      const lbl = document.getElementById('videoFileDropLabel');
      if (file) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        lbl.textContent = `${file.name} (${mb} MB)`;
      } else {
        lbl.textContent = 'Tocca per selezionare un video MP4 / MOV / WEBM';
      }
    });

    document.getElementById('formUploadVideo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('videoTitleInput').value.trim();
      const description = document.getElementById('videoDescInput').value.trim();
      const category = document.getElementById('videoCategoryInput').value;
      const submitBtn = document.getElementById('btnSubmitVideo');

      if (!title) {
        showToast('Inserisci il titolo del video');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Pubblicazione...';

      try {
        let mediaUrl = '';
        let thumbUrl = '';

        if (state.videoUploadSource === 'file') {
          const file = document.getElementById('videoFileInput').files?.[0];
          if (!file) {
            throw new Error('Seleziona prima un file video dal telefono');
          }
          const progWrap = document.getElementById('videoUploadProgressWrap');
          const progBar = document.getElementById('videoUploadProgressBar');
          const progText = document.getElementById('videoUploadProgressText');
          progWrap.classList.remove('hidden');
          const uploaded = await uploadFileToMediaStorage(file, 'videos', 'video', (pct) => {
            progBar.style.width = `${pct}%`;
            progText.textContent = `${pct}%`;
          });
          mediaUrl = uploaded.url;
          thumbUrl = uploaded.thumbUrl || '';
        } else {
          mediaUrl = document.getElementById('videoUrlInput').value.trim();
          if (!mediaUrl) {
            throw new Error('Incolla il link del video');
          }
        }

        const res = await apiFetch('/api/videos', {
          method: 'POST',
          body: JSON.stringify({ category, title, description, mediaUrl, thumbUrl })
        });
        state.videos = res.videos;
        saveLocalBackup();
        closeSheet('sheetUploadVideo');

        state.mediaTab = category === 'match' ? 'match' : 'funny';
        document.querySelectorAll('#mediaTabControl .seg-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-mediatab') === state.mediaTab);
        });
        renderMediaView();
        showToast('Video pubblicato nello spogliatoio!');
      } catch (err) {
        showToast(err.message || 'Errore pubblicazione video');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Pubblica Video';
      }
    });

    // Upload Stylish Sock Form
    document.getElementById('sockPhotoInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      document.getElementById('sockDropLabel').textContent = file.name;
      try {
        const compressed = await compressImageToJpeg(file, 1080, 0.82);
        state.sockCompressedDataUrl = compressed.dataUrl;
        state.sockRawFile = compressed.blob || file;
        document.getElementById('sockPhotoPreviewImg').src = compressed.dataUrl;
        document.getElementById('sockPhotoPreviewWrap').classList.remove('hidden');
      } catch (err) {
        showToast('Immagine non leggibile');
      }
    });

    document.getElementById('formUploadSock').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('sockTitleInput').value.trim();
      const playerId = document.getElementById('sockPlayerSelect').value;
      const submitBtn = document.getElementById('btnSubmitSock');

      if (!state.sockCompressedDataUrl) {
        showToast('Scegli prima una foto dei calzini');
        return;
      }
      if (!title) {
        showToast('Dai un titolo ai calzini');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Pubblicazione...';

      try {
        let imageUrl = state.sockCompressedDataUrl;
        if (state.appConfig.cloudinaryEnabled && state.sockRawFile) {
          const progWrap = document.getElementById('sockUploadProgressWrap');
          const progBar = document.getElementById('sockUploadProgressBar');
          const progText = document.getElementById('sockUploadProgressText');
          progWrap.classList.remove('hidden');
          const uploaded = await uploadFileToMediaStorage(state.sockRawFile, 'socks', 'image', (pct) => {
            progBar.style.width = `${pct}%`;
            progText.textContent = `${pct}%`;
          });
          imageUrl = uploaded.url;
        }

        const res = await apiFetch('/api/socks', {
          method: 'POST',
          body: JSON.stringify({ title, playerId, imageUrl })
        });
        state.socks = res.socks;
        saveLocalBackup();
        closeSheet('sheetUploadSock');
        renderMediaView();
        showToast('Calzini caricati! Che la sfida abbia inizio 🧦');
      } catch (err) {
        showToast(err.message || 'Errore pubblicazione calzini');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Pubblica Calzini';
      }
    });

    // Delegated Click Handler
    document.body.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.getAttribute('data-action');

      if (action === 'select-cal-month') {
        state.calMonthKey = actionEl.getAttribute('data-month-key');
        renderSpatialCalendar();
        return;
      }
      if (action === 'select-cal-match') {
        const mId = actionEl.getAttribute('data-match-id');
        if (String(state.calSelectedMatchId) === String(mId)) {
          openMatchDetailSheet(mId);
        } else {
          state.calSelectedMatchId = mId;
          renderSpatialCalendar();
        }
        return;
      }

      if (action === 'quick-complete') {
        e.stopPropagation();
        const entryId = actionEl.getAttribute('data-entry-id');
        ensureAdminOrPrompt(async (code) => {
          try {
            const res = await apiFetch(`/api/paste/${entryId}`, {
              method: 'PUT',
              body: JSON.stringify({
                adminCode: code,
                status: 'completed',
                completedDate: getTodayYMD()
              })
            });
            state.pasteEntries = res.pasteEntries;
            saveLocalBackup();
            renderPasteView();
            showToast('Paste segnate come portate');
          } catch (err) {
            showToast(err.message);
          }
        });
      } else if (action === 'open-player') {
        const playerId = actionEl.getAttribute('data-player-id');
        populatePlayerSheet(playerId);
        openSheet('sheetPlayer');
      } else if (action === 'edit-entry') {
        const entryId = actionEl.getAttribute('data-entry-id');
        closeSheet('sheetPlayer');
        openPasteFormSheet({ entryId });
      } else if (action === 'reopen-entry') {
        const entryId = actionEl.getAttribute('data-entry-id');
        ensureAdminOrPrompt(async (code) => {
          try {
            const res = await apiFetch(`/api/paste/${entryId}`, {
              method: 'PUT',
              body: JSON.stringify({ adminCode: code, status: 'pending' })
            });
            state.pasteEntries = res.pasteEntries;
            saveLocalBackup();
            renderPasteView();
            showToast('Paste riaperte');
          } catch (err) {
            showToast(err.message);
          }
        });
      } else if (action === 'delete-entry') {
        const entryId = actionEl.getAttribute('data-entry-id');
        ensureAdminOrPrompt(async (code) => {
          try {
            const res = await apiFetch(`/api/paste/${entryId}`, {
              method: 'DELETE',
              body: JSON.stringify({ adminCode: code })
            });
            state.pasteEntries = res.pasteEntries;
            saveLocalBackup();
            renderPasteView();
            showToast('Voce eliminata');
          } catch (err) {
            showToast(err.message);
          }
        });
      } else if (action === 'open-match') {
        const matchId = actionEl.getAttribute('data-match-id');
        openMatchDetailSheet(matchId);
      } else if (action === 'download-match-ics') {
        const matchId = actionEl.getAttribute('data-match-id');
        const m = getLadispoliMatches().find(item => String(item.id) === String(matchId));
        if (m) {
          downloadIcsFile(`volley-ladispoli-${m.day.toLowerCase().replace(/\s+/g, '-')}.ics`, generateIcsContent([m]));
          showToast('File .ics scaricato');
        }
      } else if (action === 'like-video') {
        const vidId = actionEl.getAttribute('data-video-id');
        requireGoogleLogin(async () => {
          try {
            const res = await apiFetch(`/api/videos/${vidId}/like`, { method: 'POST' });
            state.videos = res.videos;
            saveLocalBackup();
            renderVideosFeed();
          } catch (err) {
            showToast(err.message);
          }
        });
      } else if (action === 'delete-video') {
        const vidId = actionEl.getAttribute('data-video-id');
        const doDelete = async (code = '') => {
          try {
            const res = await apiFetch(`/api/videos/${vidId}`, {
              method: 'DELETE',
              body: JSON.stringify({ adminCode: code || state.adminCode })
            });
            state.videos = res.videos;
            saveLocalBackup();
            renderVideosFeed();
            showToast('Video eliminato');
          } catch (err) {
            showToast(err.message);
          }
        };
        if (state.currentUser || state.isAdmin) {
          doDelete();
        } else {
          ensureAdminOrPrompt(doDelete);
        }
      } else if (action === 'upvote-sock') {
        const sockId = actionEl.getAttribute('data-sock-id');
        requireGoogleLogin(async () => {
          try {
            const res = await apiFetch(`/api/socks/${sockId}/upvote`, { method: 'POST' });
            state.socks = res.socks;
            saveLocalBackup();
            renderSocksFeed();
          } catch (err) {
            showToast(err.message);
          }
        });
      } else if (action === 'delete-sock') {
        const sockId = actionEl.getAttribute('data-sock-id');
        const doDelete = async (code = '') => {
          try {
            const res = await apiFetch(`/api/socks/${sockId}`, {
              method: 'DELETE',
              body: JSON.stringify({ adminCode: code || state.adminCode })
            });
            state.socks = res.socks;
            saveLocalBackup();
            renderSocksFeed();
            showToast('Calzini eliminati');
          } catch (err) {
            showToast(err.message);
          }
        };
        if (state.currentUser || state.isAdmin) {
          doDelete();
        } else {
          ensureAdminOrPrompt(doDelete);
        }
      } else if (action === 'open-lightbox') {
        const imgUrl = actionEl.getAttribute('data-img-url');
        const cap = actionEl.getAttribute('data-caption') || '';
        document.getElementById('lightboxImg').src = imgUrl;
        document.getElementById('lightboxCaption').textContent = cap;
        openSheet('sheetImageLightbox');
      }
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    renderPwaInstallState();
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    renderPwaInstallState();
    showToast('App Volley Ladispoli installata!');
  });

  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    attachSheetDragPhysics();
    registerServiceWorker();
    loadAppConfig();
    loadAppState();
    loadFipavData(false);
  });
})();
