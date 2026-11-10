(function () {
  'use strict';

  const LADISPOLI_TEAM_ID = '231812';
  const STORAGE_KEYS = {
    ADMIN_CODE: 'vl_admin_code_session',
    LOCAL_DB: 'vl_local_db_backup_v1'
  };

  const DEFAULT_PLAYERS = [
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
    { id: 'michele-aiello', name: 'Michele Aiello', shortName: 'M. Aiello', avatarColor: '#7c3aed' },
    { id: 'fusco', name: 'Fusco', shortName: 'Fusco', avatarColor: '#b91c1c' },
    { id: 'tizi', name: 'Tizi', shortName: 'Tizi', avatarColor: '#0369a1' }
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
    adminCode: '',
    isAdmin: false,
    playerFilter: 'all',
    playerSort: 'priority', // 'priority' | 'alpha'
    playerSearch: '',
    activePlayerSheetId: null,
    pendingAdminCallback: null,
    // FIPAV & Spatial Calendar
    fipavCalendar: null,
    fipavTables: null,
    fipavUpdatedAt: '',
    matchFilter: 'upcoming',
    selectedGiornata: 'Giornata 1',
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
        pasteEntries: state.pasteEntries
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
    const res = await fetch(url, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Errore ${res.status}`);
    }
    return data;
  }

  async function loadAppState() {
    try {
      const data = await apiFetch('/api/state');
      state.players = data.players || DEFAULT_PLAYERS;
      state.customReasons = data.customReasons || DEFAULT_REASONS;
      state.pasteEntries = data.pasteEntries || [];
      saveLocalBackup();
    } catch (_) {
      const backup = loadLocalBackup();
      if (backup) {
        state.players = backup.players || DEFAULT_PLAYERS;
        state.customReasons = backup.customReasons || DEFAULT_REASONS;
        state.pasteEntries = backup.pasteEntries || [];
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
    renderPasteView();
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
              <div class="avatar-circle" style="background:${player.avatarColor}">${getInitials(player.name)}</div>
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
            <div class="avatar-circle" style="background:${player.avatarColor}">${getInitials(player.name)}</div>
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
      const dueStr = entry.dueDate ? formatShortDate(entry.dueDate) : 'Indefinita';
      return `
        <div class="list-row" data-action="open-player" data-player-id="${p.id}">
          <div class="row-left">
            <div class="avatar-circle" style="background:${p.avatarColor}; width:32px; height:32px; font-size:0.74rem;">${getInitials(p.name)}</div>
            <div class="row-text">
              <div class="row-title">${escapeHtml(p.name)} · ${escapeHtml(entry.reasonTitle)}</div>
              <div class="row-sub">Accaduto ${formatShortDate(entry.incidentDate)} · Consegna: ${dueStr}</div>
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
    avatar.textContent = getInitials(player.name);
    avatar.style.background = player.avatarColor;

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
      return `
        <button type="button" class="player-pick-card ${isSelected ? 'is-selected' : ''}" data-pick-player="${p.id}">
          <span class="player-pick-avatar" style="background:${p.avatarColor}">${getInitials(p.name)}</span>
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

  function renderCalendarAndStandings() {
    const matches = getLadispoliMatches();
    if (!state.calSelectedMatchId && matches.length > 0) {
      const now = new Date();
      const nextMatch = matches.find(m => !m.played && m.dateObj && m.dateObj >= new Date(now.getTime() - 3 * 3600 * 1000)) || matches[0];
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

    renderNextMatchCard();
    renderSpatialCalendar();
    renderCompactMatchesList();
    renderStandings();
    renderGironeMatchesByRound();
  }

  function renderNextMatchCard() {
    const card = document.getElementById('nextMatchCard');
    if (!card) return;

    const matches = getLadispoliMatches();
    if (matches.length === 0) return;

    const now = new Date();
    const nextMatch = matches.find(m => !m.played && m.dateObj && m.dateObj >= new Date(now.getTime() - 3 * 3600 * 1000)) || matches[0];
    const diffMs = (nextMatch.dateObj || now) - now;
    let countdown = 'Prossima gara';
    if (diffMs > 0) {
      const days = Math.floor(diffMs / 86400000);
      countdown = days > 0 ? `Tra ${days} ${days === 1 ? 'giorno' : 'giorni'}` : 'Oggi';
    }

    card.innerHTML = `
      <div class="nm-top">
        <span class="nm-tag">Prossima Partita · ${escapeHtml(nextMatch.day)}</span>
        <span class="nm-countdown">${countdown}</span>
      </div>

      <div class="nm-teams">
        <div class="nm-team">
          <img src="${escapeHtml(getTeamLogo(nextMatch.team1))}" alt="" class="nm-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          <span class="nm-team-name ${nextMatch.team1.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(nextMatch.team1.title)}</span>
        </div>

        <div class="nm-center">
          <div class="nm-time">${escapeHtml((nextMatch.time || '').replace('.', ':'))}</div>
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
          Aggiungi al Calendario
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

        cellsHtml.push(`
          <button type="button" class="cal-day-cell has-match ${haClass} ${isSelected ? 'is-selected' : ''}" data-action="select-cal-match" data-match-id="${match.id}" title="${escapeHtml(match.day)}: ${escapeHtml(match.opponent.title)}">
            <span class="cal-day-num">${day}</span>
            <img src="${escapeHtml(oppLogo)}" alt="" class="cal-cell-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            <span class="cal-cell-time">${escapeHtml(shortTime)}</span>
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
            <span class="sp-vs">VS</span>
            <div class="sp-team sp-right">
              <span class="sp-name ${spotlightMatch.team2.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(spotlightMatch.team2.title)}</span>
              <img src="${escapeHtml(getTeamLogo(spotlightMatch.team2))}" alt="" class="sp-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            </div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; flex-wrap:wrap; font-size:0.74rem; color:var(--text-tertiary);">
            <span>⏱️ Ritmo: ${escapeHtml(spacingNote)}</span>
            <button type="button" class="text-action-btn" data-action="open-match" data-match-id="${spotlightMatch.id}">
              Apri dettagli &amp; Calendario ›
            </button>
          </div>
        </div>
      `;
    }
  }

  function renderCompactMatchesList() {
    const listEl = document.getElementById('matchesList');
    if (!listEl) return;

    const matches = getLadispoliMatches().filter(m => {
      if (state.matchFilter === 'upcoming') return !m.played;
      if (state.matchFilter === 'home') return m.isHome;
      if (state.matchFilter === 'away') return !m.isHome;
      return true;
    });

    listEl.innerHTML = matches.map(m => {
      const dateStr = m.dateObj
        ? m.dateObj.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : m.date;
      const haBadge = m.isHome
        ? `<span class="ha-tag ha-home" style="margin:0;">In Casa</span>`
        : `<span class="ha-tag ha-away" style="margin:0;">Trasferta</span>`;
      const timeStr = (m.time || '18.00').replace('.', ':');

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

            <span class="mc-center-time">${escapeHtml(timeStr)}</span>

            <div class="mc-team mc-team-right">
              <span class="mc-team-title ${m.team2.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team2.title)}</span>
              <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            </div>
          </div>

          <div class="mc-footer">
            <span class="mc-gym">📍 ${escapeHtml(m.stadium)}</span>
            <span style="color:var(--accent-blue); font-weight:600; flex-shrink:0;">Calendario &amp; Maps ›</span>
          </div>
        </button>
      `;
    }).join('');
  }

  function openMatchDetailSheet(matchId) {
    const matches = getLadispoliMatches();
    const m = matches.find(item => String(item.id) === String(matchId));
    if (!m) return;

    document.getElementById('sheetMatchGiornata').textContent = `${m.day} · Gara #${m.ng}`;
    document.getElementById('sheetMatchTitle').textContent = `${m.team1.title} vs ${m.team2.title}`;

    const fullDate = m.dateObj
      ? m.dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : m.date;

    document.getElementById('sheetMatchBody').innerHTML = `
      <div class="entry-card" style="margin-bottom: 1rem;">
        <div class="mc-versus-row" style="border-top:none; padding-top:0;">
          <div class="mc-team">
            <img src="${escapeHtml(getTeamLogo(m.team1))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            <span class="mc-team-title ${m.team1.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team1.title)}</span>
          </div>
          <span class="mc-center-time">${escapeHtml((m.time || '').replace('.', ':'))}</span>
          <div class="mc-team mc-team-right">
            <span class="mc-team-title ${m.team2.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team2.title)}</span>
            <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          </div>
        </div>
        <div class="entry-title" style="text-transform: capitalize; margin-top: 0.25rem;">${escapeHtml(fullDate)}</div>
        <div class="entry-meta">
          <span>${m.isHome ? '🏠 Partita in Casa (Pallone N. Panzani)' : '🚌 Partita in Trasferta'}</span>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">
          <strong>Palestra:</strong> ${escapeHtml(m.stadium)}
        </div>
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
      meta.textContent = 'Dati ufficiali FIPAV Comitato Territoriale Roma · Girone 64602';
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

    if (!giornate.includes(state.selectedGiornata) && giornate.length > 0) {
      state.selectedGiornata = giornate[0];
    }

    sel.innerHTML = giornate.map(g =>
      `<option value="${escapeHtml(g)}" ${g === state.selectedGiornata ? 'selected' : ''}>${escapeHtml(g)}</option>`
    ).join('');

    const roundMatches = allMatches.filter(m => m.day === state.selectedGiornata);
    listEl.innerHTML = roundMatches.map(m => {
      const hasUs = m.team1?.id === LADISPOLI_TEAM_ID || m.team2?.id === LADISPOLI_TEAM_ID;
      return `
        <div class="list-row" style="cursor:default; flex-direction:column; align-items:stretch; gap:0.45rem; ${hasUs ? 'background:var(--accent-red-soft);' : ''}">
          <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-tertiary); font-weight:600;">
            <span>Gara #${escapeHtml(m.ng)} · ${escapeHtml(m.date)}</span>
            <span>Ore ${escapeHtml((m.time || '').replace('.', ':'))}</span>
          </div>
          <div class="mc-versus-row" style="border:none; padding:0.15rem 0;">
            <div class="mc-team">
              <img src="${escapeHtml(getTeamLogo(m.team1))}" alt="" class="mc-logo" style="width:28px; height:28px;" onerror="this.src='/logo-ladispoli.jpg'" />
              <span class="mc-team-title ${m.team1?.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}" style="font-size:0.8rem;">${escapeHtml(m.team1?.title)}</span>
            </div>
            <span class="sp-vs">vs</span>
            <div class="mc-team mc-team-right">
              <span class="mc-team-title ${m.team2?.id === LADISPOLI_TEAM_ID ? 'is-us' : ''}" style="font-size:0.8rem;">${escapeHtml(m.team2?.title)}</span>
              <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" style="width:28px; height:28px;" onerror="this.src='/logo-ladispoli.jpg'" />
            </div>
          </div>
          <div style="font-size:0.72rem; color:var(--text-tertiary);">📍 ${escapeHtml(m.stadium)}</div>
        </div>
      `;
    }).join('');
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

    // Topbar Admin
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
    document.getElementById('giornataSelect').addEventListener('change', (e) => {
      state.selectedGiornata = e.target.value;
      renderGironeMatchesByRound();
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
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    attachSheetDragPhysics();
    loadAppState();
    loadFipavData(false);
  });
})();
