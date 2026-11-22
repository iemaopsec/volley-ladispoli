(function () {
  'use strict';

  const COMPETITIONS = {
    '2df': {
      key: '2df',
      gironeId: '64591',
      teamId: '231808',
      label: '2ª Divisione',
      shortTag: '2ª Div',
      fullTitle: 'Seconda Divisione Femminile Girone A',
      subtitle: '2ª Div. Femminile · Girone A',
      fipavUrl: 'https://public.fipavonline.it/gironi/64591',
      backupKey: 'vl_fem_fipav_64591_v1'
    },
    'u19': {
      key: 'u19',
      gironeId: '64854',
      teamId: '234864',
      label: 'Under 19',
      shortTag: 'U19',
      fullTitle: 'Under 19 Femminile Promozionale Girone A',
      subtitle: 'Under 19 Femminile · Girone A',
      fipavUrl: 'https://public.fipavonline.it/gironi/64854',
      backupKey: 'vl_fem_fipav_64854_v1'
    }
  };

  const PHOTOS_BACKUP_KEY = 'vl_fem_photos_backup_v1';

  const LOCAL_TEAM_LOGOS = {
    '227760': '/logos/227760.png',
    '231135': '/logos/231135.png',
    '231603': '/logos/231603.jpg',
    '231634': '/logos/231634.png',
    '231719': '/logos/231719.png',
    '231743': '/logos/231743.png',
    '231808': '/logo-ladispoli.jpg',
    '231834': '/logos/231834.jpg',
    '232108': '/logos/232108.jpg',
    '234691': '/logos/234691.jpg',
    '234786': '/logos/234786.png',
    '234885': '/logos/234885.jpg',
    '233786': '/logos/233786.png',
    '234864': '/logo-ladispoli.jpg',
    '234903': '/logos/234903.jpg',
    '235171': '/logos/235171.jpg',
    '235462': '/logos/235462.jpg',
    '235729': '/logos/235729.jpg',
    '235801': '/logos/235801.png',
    '235887': '/logos/235887.png'
  };

  const IT_MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const IT_MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  const BASE_SEASON_MONTHS = [
    { key: '2026-11', year: 2026, month: 10, shortLabel: 'Nov 26', fullLabel: 'Novembre 2026' },
    { key: '2026-12', year: 2026, month: 11, shortLabel: 'Dic 26', fullLabel: 'Dicembre 2026' },
    { key: '2027-01', year: 2027, month: 0, shortLabel: 'Gen 27', fullLabel: 'Gennaio 2027' },
    { key: '2027-02', year: 2027, month: 1, shortLabel: 'Feb 27', fullLabel: 'Febbraio 2027' },
    { key: '2027-03', year: 2027, month: 2, shortLabel: 'Mar 27', fullLabel: 'Marzo 2027' },
    { key: '2027-04', year: 2027, month: 3, shortLabel: 'Apr 27', fullLabel: 'Aprile 2027' },
    { key: '2027-05', year: 2027, month: 4, shortLabel: 'Mag 27', fullLabel: 'Maggio 2027' }
  ];

  const state = {
    fipav: {
      '2df': { calendar: null, tables: null, updatedAt: '' },
      'u19': { calendar: null, tables: null, updatedAt: '' }
    },
    activeComp: '2df',      // '2df' | 'u19' | 'all'
    standingsComp: '2df',   // '2df' | 'u19'
    matchFilter: 'upcoming',
    selectedGiornataByComp: { '2df': 'Giornata 1', 'u19': 'Giornata 1' },
    hasAutoSelectedRoundByComp: { '2df': false, 'u19': false },
    calMonthKey: '2026-11',
    calSelectedDayKey: null,
    femPhotos: [],
    femPhotoSort: 'top', // 'top' | 'recent'
    femPhotoCompressedDataUrl: '',
    chatMessages: [],
    currentUser: null,
    appConfig: { googleClientId: '', cloudinaryEnabled: false },
    pendingLoginCallback: null,
    deferredInstallPrompt: null,
    activeView: 'calendario',
    chatPollTimer: null
  };

  function getInitials(name) {
    const words = (name || '').trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return (name || 'VL').slice(0, 2).toUpperCase();
  }

  async function apiFetch(url, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Errore ${res.status}`);
    }
    return data;
  }

  // ==========================================
  // UTILITIES
  // ==========================================
  function getTodayYMD() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTeamLogo(teamObj) {
    if (!teamObj) return '/logo-ladispoli.jpg';
    const tid = String(teamObj.id || '');
    if (LOCAL_TEAM_LOGOS[tid]) return LOCAL_TEAM_LOGOS[tid];
    return teamObj.logo || '/logo-ladispoli.jpg';
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

  function getSeasonMonths(matches) {
    const map = new Map(BASE_SEASON_MONTHS.map(m => [m.key, m]));
    for (const m of (matches || [])) {
      if (!m.dateObj) continue;
      const y = m.dateObj.getFullYear();
      const mo = m.dateObj.getMonth();
      const key = `${y}-${String(mo + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          year: y,
          month: mo,
          shortLabel: `${IT_MONTHS_SHORT[mo]} ${String(y).slice(-2)}`,
          fullLabel: `${IT_MONTHS_FULL[mo]} ${y}`
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  function showToast(msg, variant = 'default') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const text = String(msg || '');
    let tone = variant;
    if (tone === 'default') {
      if (text.includes('⚠️') || /errat|non valid|non riuscit|manca|impossibil/i.test(text)) {
        tone = 'error';
      } else if (/aggiornat|scaricat|copiat|condivis|pubblicat|eliminat/i.test(text)) {
        tone = 'success';
      }
    }

    const el = document.createElement('div');
    el.className = `toast-item toast-${tone}`;
    el.setAttribute('role', 'status');
    el.textContent = text;

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 220);
    };
    el.addEventListener('click', dismiss);

    if (tone === 'success') {
      container.querySelectorAll('.toast-error').forEach(old => old.remove());
    }
    while (container.children.length >= 2) {
      container.firstElementChild.remove();
    }

    container.appendChild(el);
    setTimeout(dismiss, 2800);
  }

  function saveCompBackup(compKey, data) {
    try {
      localStorage.setItem(COMPETITIONS[compKey].backupKey, JSON.stringify({
        calendar: data.calendar,
        tables: data.tables,
        updatedAt: data.updatedAt || ''
      }));
    } catch (_) {}
  }

  function loadCompBackup(compKey) {
    try {
      const raw = localStorage.getItem(COMPETITIONS[compKey].backupKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // ==========================================
  // BOTTOM SHEETS & DRAG PHYSICS
  // ==========================================
  const sheetCloseTimers = new Map();

  function syncStackedSheetDepth() {
    const openSheets = Array.from(document.querySelectorAll('.sheet-backdrop.is-open'));
    openSheets.sort((a, b) => {
      const za = parseInt(window.getComputedStyle(a).zIndex, 10) || 100;
      const zb = parseInt(window.getComputedStyle(b).zIndex, 10) || 100;
      return za - zb;
    });
    const topBackdrop = openSheets[openSheets.length - 1] || null;
    document.querySelectorAll('.sheet-backdrop').forEach(el => {
      const isReceded = el.classList.contains('is-open') && el !== topBackdrop;
      el.classList.toggle('is-receded', isReceded);
    });
  }

  function syncBodyScrollLock() {
    const anyOpen = Boolean(document.querySelector('.sheet-backdrop.is-open'));
    document.body.classList.toggle('sheet-open', anyOpen);
    syncStackedSheetDepth();
  }

  function openSheet(sheetId) {
    const backdrop = document.getElementById(sheetId);
    if (!backdrop) return;
    if (sheetCloseTimers.has(sheetId)) {
      clearTimeout(sheetCloseTimers.get(sheetId));
      sheetCloseTimers.delete(sheetId);
    }
    const sheet = backdrop.querySelector('.bottom-sheet');
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.transform = '';
    }
    backdrop.style.background = '';
    backdrop.classList.remove('hidden', 'is-closing', 'is-receded');
    void backdrop.offsetWidth;
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      syncBodyScrollLock();
    });
  }

  function closeSheet(sheetId) {
    const backdrop = document.getElementById(sheetId);
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    if (sheetCloseTimers.has(sheetId)) {
      clearTimeout(sheetCloseTimers.get(sheetId));
      sheetCloseTimers.delete(sheetId);
    }

    backdrop.classList.remove('is-open', 'is-receded');
    backdrop.classList.add('is-closing');
    syncBodyScrollLock();

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const waitMs = prefersReduced ? 130 : 210;
    const timer = setTimeout(() => {
      backdrop.classList.add('hidden');
      backdrop.classList.remove('is-closing');
      backdrop.style.background = '';
      const sheet = backdrop.querySelector('.bottom-sheet');
      if (sheet) {
        sheet.style.transition = '';
        sheet.style.transform = '';
      }
      sheetCloseTimers.delete(sheetId);
      syncBodyScrollLock();
    }, waitMs);
    sheetCloseTimers.set(sheetId, timer);
  }

  function closeTopmostSheet() {
    const openSheets = Array.from(document.querySelectorAll('.sheet-backdrop.is-open'));
    if (openSheets.length === 0) return;
    openSheets.sort((a, b) => {
      const za = parseInt(window.getComputedStyle(a).zIndex, 10) || 100;
      const zb = parseInt(window.getComputedStyle(b).zIndex, 10) || 100;
      return za - zb;
    });
    closeSheet(openSheets[openSheets.length - 1].id);
  }

  function attachSheetDragPhysics() {
    const projectMomentum = (vPxPerSec, decelerationRate = 0.992) => {
      return (vPxPerSec / 1000) * decelerationRate / (1 - decelerationRate);
    };

    document.querySelectorAll('.bottom-sheet').forEach(sheet => {
      const grabberArea = sheet.querySelector('.sheet-grabber-area');
      const headerArea = sheet.querySelector('.sheet-header');
      const backdrop = sheet.closest('.sheet-backdrop');
      if (!grabberArea || !backdrop) return;

      let activePointerId = null;
      let startY = 0;
      let currentY = 0;
      let hasCommittedDrag = false;
      let samples = [];
      let snapClearTimer = null;

      const onPointerDown = (e) => {
        if (window.innerWidth >= 700) return;
        if (activePointerId !== null) return;
        if (e.target.closest('button, input, select, a, label, [data-action="open-lightbox"]')) return;
        if (snapClearTimer) {
          clearTimeout(snapClearTimer);
          snapClearTimer = null;
        }
        activePointerId = e.pointerId;
        startY = e.clientY;
        currentY = 0;
        hasCommittedDrag = false;
        samples = [{ y: 0, t: performance.now() }];
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) {}
      };

      const onPointerMove = (e) => {
        if (activePointerId !== e.pointerId) return;
        const rawDelta = e.clientY - startY;
        if (!hasCommittedDrag) {
          if (Math.abs(rawDelta) < 8) return;
          hasCommittedDrag = true;
          sheet.style.transition = 'none';
        }
        if (rawDelta < 0) {
          const overshoot = Math.abs(rawDelta);
          currentY = -((overshoot * 120 * 0.35) / (120 + 0.35 * overshoot));
        } else {
          currentY = rawDelta;
        }
        const now = performance.now();
        samples.push({ y: currentY, t: now });
        while (samples.length > 2 && now - samples[0].t > 110) {
          samples.shift();
        }
        sheet.style.transform = `translateY(${currentY}px)`;
        const dismissDistance = Math.max(sheet.offsetHeight * 0.45, 160);
        const fadeFactor = Math.max(0.08, 1 - Math.max(0, currentY) / dismissDistance * 0.65);
        backdrop.style.background = `rgba(17, 17, 24, ${(0.34 * fadeFactor).toFixed(3)})`;
      };

      const onPointerUp = (e) => {
        if (activePointerId !== e.pointerId) return;
        activePointerId = null;
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
        if (!hasCommittedDrag) return;
        hasCommittedDrag = false;

        let velocity = 0;
        if (samples.length >= 2) {
          const first = samples[0];
          const last = samples[samples.length - 1];
          const dt = Math.max(8, last.t - first.t);
          velocity = ((last.y - first.y) / dt) * 1000;
        }

        const projectedY = currentY + projectMomentum(Math.max(0, velocity));
        const sheetHeight = sheet.offsetHeight || 420;
        const shouldDismiss = (currentY > 0 && projectedY > Math.min(sheetHeight * 0.36, 175)) || velocity > 720;

        backdrop.style.background = '';
        if (shouldDismiss) {
          sheet.style.transition = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)';
          sheet.style.transform = `translateY(${Math.max(sheetHeight, 480)}px)`;
          closeSheet(backdrop.id);
        } else {
          sheet.style.transition = 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)';
          sheet.style.transform = 'translateY(0px)';
          snapClearTimer = setTimeout(() => {
            sheet.style.transition = '';
            sheet.style.transform = '';
          }, 330);
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
  // FIPAV DATA LOADING (2DF + U19)
  // ==========================================
  function hydrateCompFromFallbackOrBackup(compKey) {
    if (state.fipav[compKey].calendar) return;
    const backup = loadCompBackup(compKey);
    if (backup && backup.calendar) {
      state.fipav[compKey] = {
        calendar: backup.calendar,
        tables: backup.tables || [],
        updatedAt: backup.updatedAt || ''
      };
      return;
    }
    const globalFallback = compKey === '2df'
      ? window.FIPAV_FALLBACK_DATA_64591
      : window.FIPAV_FALLBACK_DATA_64854;
    if (globalFallback && globalFallback.calendar) {
      state.fipav[compKey] = {
        calendar: globalFallback.calendar,
        tables: globalFallback.tables || [],
        updatedAt: globalFallback.updatedAt || ''
      };
    }
  }

  async function loadAllFipavData(forceRefresh = false) {
    hydrateCompFromFallbackOrBackup('2df');
    hydrateCompFromFallbackOrBackup('u19');
    renderCalendarAndStandings();

    try {
      const results = await Promise.all(['2df', 'u19'].map(async (compKey) => {
        const gid = COMPETITIONS[compKey].gironeId;
        const res = await fetch(`/api/fipav?girone=${gid}${forceRefresh ? '&refresh=1' : ''}`, {
          cache: 'no-store'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { compKey, data };
      }));

      let updatedAny = false;
      for (const { compKey, data } of results) {
        if (data && data.calendar) {
          state.fipav[compKey] = {
            calendar: data.calendar,
            tables: data.tables || [],
            updatedAt: data.updatedAt || new Date().toISOString()
          };
          saveCompBackup(compKey, state.fipav[compKey]);
          updatedAny = true;
        }
      }

      if (updatedAny) {
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
  // MATCH NORMALIZATION & CALENDAR HELPERS
  // ==========================================
  function parseFipavMatchDate(dateStr, timeStr) {
    if (!dateStr) return null;
    const [dd, mm, yyyy] = dateStr.split('/').map(Number);
    const [hh, min] = (timeStr || '18.00').replace(':', '.').split('.').map(Number);
    return new Date(yyyy, mm - 1, dd, hh || 18, min || 0, 0);
  }

  function getMatchesForComp(compKey) {
    const comp = COMPETITIONS[compKey];
    if (!comp) return [];
    const allMatches = state.fipav[compKey]?.calendar?.data?.matches || [];
    return allMatches
      .filter(m => String(m.team1?.id) === comp.teamId || String(m.team2?.id) === comp.teamId)
      .map(m => {
        const isHome = String(m.team1?.id) === comp.teamId;
        const opponent = isHome ? m.team2 : m.team1;
        const dt = parseFipavMatchDate(m.date, m.time);
        const ymd = dt
          ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
          : '';
        const giornataNum = parseInt((m.day || '').replace(/\D+/g, ''), 10) || 0;
        return Object.assign({}, m, {
          compKey: comp.key,
          compTag: comp.shortTag,
          compFullTitle: comp.fullTitle,
          gironeId: comp.gironeId,
          ladispoliTeamId: comp.teamId,
          uidKey: `${comp.key}:${m.id}`,
          isHome,
          opponent,
          dateObj: dt,
          ymd,
          giornataNum
        });
      });
  }

  function getDisplayedMatches() {
    let list = [];
    if (state.activeComp === 'all') {
      list = [...getMatchesForComp('2df'), ...getMatchesForComp('u19')];
    } else {
      list = getMatchesForComp(state.activeComp);
    }
    return list.sort((a, b) => {
      const ta = a.dateObj ? a.dateObj.getTime() : 0;
      const tb = b.dateObj ? b.dateObj.getTime() : 0;
      if (ta !== tb) return ta - tb;
      if (a.compKey !== b.compKey) return a.compKey.localeCompare(b.compKey);
      return a.giornataNum - b.giornataNum;
    });
  }

  function getAllKnownMatches() {
    return [...getMatchesForComp('2df'), ...getMatchesForComp('u19')];
  }

  function renderCompBadgeHtml(m) {
    if (state.activeComp !== 'all') return '';
    return `<span class="comp-badge comp-badge-${escapeHtml(m.compKey)}">${escapeHtml(m.compTag)}</span>`;
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
    const ladId = m.ladispoliTeamId || '';
    const isUsInvolved = Boolean(ladId && (String(m.team1?.id) === ladId || String(m.team2?.id) === ladId));
    const isUsHome = Boolean(ladId && String(m.team1?.id) === ladId);
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

  function buildGoogleCalendarUrl(match) {
    const dtStart = match.dateObj || new Date();
    const dtEnd = new Date(dtStart.getTime() + 2 * 3600 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const prefix = match.compTag ? `Volley ${match.compTag}` : 'Volley';
    const title = `${prefix}: ${match.team1.title} vs ${match.team2.title} (${match.day})`;
    const details = `${match.compFullTitle || 'Campionato FIPAV'} (${match.day}, Gara ${match.ng})\nPalestra: ${match.stadium}`;
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
      const summary = `Volley ${m.compTag || ''}: ${m.team1.title} vs ${m.team2.title} (${m.day})`;
      const desc = `Campionato FIPAV ${m.compFullTitle || ''} - ${m.day} (Gara ${m.ng}). Palestra: ${m.stadium}`;
      return [
        'BEGIN:VEVENT',
        `UID:fipav-${m.gironeId || '64591'}-${m.id}@volleyladispoli.it`,
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
      'PRODID:-//Volley Ladispoli Femminile//FIPAV//IT',
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

  // ==========================================
  // RENDERERS: MATCHES, SPATIAL CAL & STANDINGS
  // ==========================================
  function updateBrandSubtitle() {
    const labelEl = document.getElementById('brandSubLabel');
    if (!labelEl) return;
    if (state.activeComp === 'all') {
      labelEl.textContent = '2ª Div. & Under 19 Femminile';
    } else {
      labelEl.textContent = COMPETITIONS[state.activeComp].subtitle;
    }
  }

  function renderCalendarAndStandings() {
    updateBrandSubtitle();
    const matches = getDisplayedMatches();
    const seasonMonths = getSeasonMonths(matches);
    if (!state.calSelectedDayKey && matches.length > 0) {
      const now = new Date();
      const nextMatch = matches.find(m => !isMatchPlayed(m) && m.dateObj && m.dateObj >= new Date(now.getTime() - 3 * 3600 * 1000)) || matches[matches.length - 1];
      state.calSelectedDayKey = nextMatch.ymd || null;
      if (nextMatch.dateObj) {
        const y = nextMatch.dateObj.getFullYear();
        const m = String(nextMatch.dateObj.getMonth() + 1).padStart(2, '0');
        const candidateKey = `${y}-${m}`;
        if (seasonMonths.some(sm => sm.key === candidateKey)) {
          state.calMonthKey = candidateKey;
        }
      }
    }

    renderLastMatchCard(matches);
    renderNextMatchCard(matches);
    renderSpatialCalendar(matches);
    renderCompactMatchesList(matches);
    renderStandings();
    renderGironeMatchesByRound();
  }

  function renderLastMatchCard(matches) {
    const card = document.getElementById('lastMatchCard');
    if (!card) return;

    const playedMatches = (matches || getDisplayedMatches()).filter(m => isMatchPlayed(m));
    if (playedMatches.length === 0) {
      card.classList.add('hidden');
      card.innerHTML = '';
      card.onclick = null;
      card.onkeydown = null;
      return;
    }

    const lastMatch = playedMatches[playedMatches.length - 1];
    const res = getMatchResultInfo(lastMatch);
    const outcomeLabel = res.didWeWin ? 'Vittoria' : 'Sconfitta';
    const outcomeCls = res.didWeWin ? 'is-win' : 'is-loss';

    card.classList.remove('hidden', 'is-loss');
    if (!res.didWeWin) card.classList.add('is-loss');

    card.innerHTML = `
      <div class="lm-top">
        <span style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
          ${renderCompBadgeHtml(lastMatch)}
          <span>Ultimo Risultato · ${escapeHtml(lastMatch.day)} · ${escapeHtml(lastMatch.date)}</span>
        </span>
        <span class="lm-result-badge ${outcomeCls}">${outcomeLabel}</span>
      </div>

      <div class="mc-versus-row" style="border-top:none; padding-top:0;">
        <div class="mc-team">
          <img src="${escapeHtml(getTeamLogo(lastMatch.team1))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          <span class="mc-team-title ${String(lastMatch.team1.id) === lastMatch.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(lastMatch.team1.title)}</span>
        </div>

        <span class="mc-score-pill ${outcomeCls}">${res.scoreText}</span>

        <div class="mc-team mc-team-right">
          <span class="mc-team-title ${String(lastMatch.team2.id) === lastMatch.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(lastMatch.team2.title)}</span>
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

    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.onclick = () => openMatchDetailSheet(lastMatch.uidKey);
    card.onkeydown = (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openMatchDetailSheet(lastMatch.uidKey);
      }
    };
  }

  function renderNextMatchCard(matches) {
    const card = document.getElementById('nextMatchCard');
    if (!card) return;

    const list = matches || getDisplayedMatches();
    if (list.length === 0) {
      card.innerHTML = '';
      return;
    }

    const now = new Date();
    const nextMatch = list.find(m => !isMatchPlayed(m) && m.dateObj && m.dateObj >= new Date(now.getTime() - 3 * 3600 * 1000)) || list[list.length - 1];
    const res = getMatchResultInfo(nextMatch);
    const diffMs = (nextMatch.dateObj || now) - now;
    let countdown = res.played ? `Risultato ${res.scoreText}` : 'Prossima gara';
    if (!res.played && diffMs > 0) {
      const days = Math.floor(diffMs / 86400000);
      countdown = days > 0 ? `Tra ${days} ${days === 1 ? 'giorno' : 'giorni'}` : 'Oggi';
    }

    card.innerHTML = `
      <div class="nm-top">
        <span class="nm-tag" style="display:inline-flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
          ${renderCompBadgeHtml(nextMatch)}
          <span>${res.played ? 'Ultima Partita' : 'Prossima Partita'} · ${escapeHtml(nextMatch.day)}</span>
        </span>
        <span class="nm-countdown">${countdown}</span>
      </div>

      <div class="nm-teams">
        <div class="nm-team">
          <img src="${escapeHtml(getTeamLogo(nextMatch.team1))}" alt="" class="nm-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          <span class="nm-team-name ${String(nextMatch.team1.id) === nextMatch.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(nextMatch.team1.title)}</span>
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
          <span class="nm-team-name ${String(nextMatch.team2.id) === nextMatch.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(nextMatch.team2.title)}</span>
        </div>
      </div>

      <div class="nm-venue">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(nextMatch.stadium)}</span>
      </div>

      <div class="nm-actions">
        <button type="button" class="btn-primary-half" data-action="open-match" data-match-uid="${escapeHtml(nextMatch.uidKey)}">
          ${res.played ? 'Vedi Parziali' : 'Al Calendario'}
        </button>
        <a href="${buildGoogleMapsUrl(nextMatch)}" target="_blank" rel="noopener noreferrer" class="btn-secondary-half">
          Apri in Maps
        </a>
      </div>
    `;
  }

  function renderSpatialCalendar(matchesInput) {
    const pillsWrap = document.getElementById('calMonthPills');
    const monthLabel = document.getElementById('calCurrentMonthLabel');
    const monthMatchCount = document.getElementById('calMonthMatchCount');
    const gridEl = document.getElementById('calDaysGrid');
    const spotlightEl = document.getElementById('calSelectedMatchSpotlight');
    const compLegend = document.getElementById('calCompLegend');
    if (!pillsWrap || !gridEl) return;

    const matches = matchesInput || getDisplayedMatches();
    const seasonMonths = getSeasonMonths(matches);
    const currentMonthObj = seasonMonths.find(m => m.key === state.calMonthKey) || seasonMonths[0];

    if (compLegend) {
      compLegend.classList.toggle('hidden', state.activeComp !== 'all');
    }

    const matchesByMonth = new Map();
    const matchesByDay = new Map();
    for (const m of matches) {
      if (!m.dateObj || !m.ymd) continue;
      const mKey = m.ymd.slice(0, 7);
      matchesByMonth.set(mKey, (matchesByMonth.get(mKey) || 0) + 1);
      if (!matchesByDay.has(m.ymd)) {
        matchesByDay.set(m.ymd, []);
      }
      matchesByDay.get(m.ymd).push(m);
    }

    pillsWrap.innerHTML = seasonMonths.map(sm => {
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
      monthMatchCount.textContent = `${countThisMonth} ${countThisMonth === 1 ? 'partita' : 'partite'}`;
    }

    const firstDayOfMonth = new Date(currentMonthObj.year, currentMonthObj.month, 1);
    const daysInMonth = new Date(currentMonthObj.year, currentMonthObj.month + 1, 0).getDate();
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const todayYmd = getTodayYMD();

    const cellsHtml = [];
    for (let i = 0; i < startOffset; i++) {
      cellsHtml.push(`<div class="cal-day-cell is-empty"></div>`);
    }

    const mmStr = String(currentMonthObj.month + 1).padStart(2, '0');
    for (let day = 1; day <= daysInMonth; day++) {
      const ddStr = String(day).padStart(2, '0');
      const ymd = `${currentMonthObj.year}-${mmStr}-${ddStr}`;
      const dayMatches = matchesByDay.get(ymd) || [];
      const isToday = ymd === todayYmd;

      if (dayMatches.length === 1) {
        const match = dayMatches[0];
        const isSelected = state.calSelectedDayKey === ymd;
        const haClass = match.isHome ? 'match-home' : 'match-away';
        const oppLogo = getTeamLogo(match.opponent);
        const shortTime = (match.time || '18.00').replace('.', ':');
        const res = getMatchResultInfo(match);
        const playedClass = res.played ? (res.didWeWin ? 'is-played-win' : 'is-played-loss') : '';
        const cellBottom = res.played
          ? `<span class="cal-cell-score ${res.didWeWin ? 'is-win' : 'is-loss'}">${res.scoreText}</span>`
          : `<span class="cal-cell-time">${escapeHtml(shortTime)}</span>`;
        const compDot = state.activeComp === 'all'
          ? `<span class="cal-comp-dot cal-comp-dot-${escapeHtml(match.compKey)}" aria-hidden="true"></span>`
          : '';

        cellsHtml.push(`
          <button type="button" class="cal-day-cell has-match ${haClass} ${playedClass} ${isSelected ? 'is-selected' : ''}" data-action="select-cal-day" data-day-key="${ymd}" title="${escapeHtml(match.compTag)} · ${escapeHtml(match.day)}: ${escapeHtml(match.opponent.title)}">
            ${compDot}
            <span class="cal-day-num">${day}</span>
            <img src="${escapeHtml(oppLogo)}" alt="" class="cal-cell-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            ${cellBottom}
          </button>
        `);
      } else if (dayMatches.length >= 2) {
        const isSelected = state.calSelectedDayKey === ymd;
        const titleAttr = dayMatches.map(mm => `${mm.compTag}: ${mm.opponent.title}`).join(' / ');
        cellsHtml.push(`
          <button type="button" class="cal-day-cell has-match has-multi-match ${isSelected ? 'is-selected' : ''}" data-action="select-cal-day" data-day-key="${ymd}" title="${escapeHtml(titleAttr)}">
            <span class="cal-day-num">${day}</span>
            <div class="cal-multi-logos">
              ${dayMatches.slice(0, 2).map(mm => `<img src="${escapeHtml(getTeamLogo(mm.opponent))}" alt="" class="cal-multi-logo" onerror="this.src='/logo-ladispoli.jpg'" />`).join('')}
            </div>
            <span class="cal-multi-count">${dayMatches.length} gare</span>
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

    // Pick spotlight day inside active month
    const monthPrefix = `${currentMonthObj.key}-`;
    const monthMatches = matches.filter(m => m.ymd && m.ymd.startsWith(monthPrefix));
    if (!state.calSelectedDayKey || !state.calSelectedDayKey.startsWith(monthPrefix) || !matchesByDay.has(state.calSelectedDayKey)) {
      const now = new Date();
      const candidate = monthMatches.find(m => !isMatchPlayed(m) && m.dateObj && m.dateObj >= new Date(now.getTime() - 3 * 3600 * 1000)) || monthMatches[0];
      state.calSelectedDayKey = candidate ? candidate.ymd : null;
    }

    const spotlightMatches = state.calSelectedDayKey ? (matchesByDay.get(state.calSelectedDayKey) || []) : [];
    if (spotlightEl) {
      if (spotlightMatches.length === 0) {
        const compLabel = state.activeComp === 'all' ? 'nessun campionato' : COMPETITIONS[state.activeComp].label;
        spotlightEl.innerHTML = `
          <div class="spotlight-box" style="text-align:center; color:var(--text-tertiary); font-size:0.82rem;">
            Nessuna partita in ${escapeHtml(currentMonthObj.fullLabel)} (${escapeHtml(compLabel)}).
          </div>
        `;
      } else {
        spotlightEl.innerHTML = `
          <div class="cal-spotlight-stack">
            ${spotlightMatches.map(spotlightMatch => {
              const res = getMatchResultInfo(spotlightMatch);
              const sameCompMatches = matches.filter(m => m.compKey === spotlightMatch.compKey);
              const matchIdx = sameCompMatches.findIndex(m => m.uidKey === spotlightMatch.uidKey);
              const prevMatch = matchIdx > 0 ? sameCompMatches[matchIdx - 1] : null;
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

              return `
                <div class="spotlight-box">
                  <div class="spotlight-meta">
                    <span style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                      ${renderCompBadgeHtml(spotlightMatch)}
                      <span><strong>${escapeHtml(spotlightMatch.day)}</strong> · ${escapeHtml(fullDateStr)} · Ore ${escapeHtml((spotlightMatch.time || '').replace('.', ':'))}</span>
                    </span>
                    <span class="ha-tag ${spotlightMatch.isHome ? 'ha-home' : 'ha-away'}" style="margin:0;">
                      ${spotlightMatch.isHome ? 'In Casa' : 'Trasferta'}
                    </span>
                  </div>

                  <div class="spotlight-teams-line">
                    <div class="sp-team">
                      <img src="${escapeHtml(getTeamLogo(spotlightMatch.team1))}" alt="" class="sp-logo" onerror="this.src='/logo-ladispoli.jpg'" />
                      <span class="sp-name ${String(spotlightMatch.team1.id) === spotlightMatch.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(spotlightMatch.team1.title)}</span>
                    </div>
                    ${centerBadge}
                    <div class="sp-team sp-right">
                      <span class="sp-name ${String(spotlightMatch.team2.id) === spotlightMatch.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(spotlightMatch.team2.title)}</span>
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
                    <span>Ritmo: ${escapeHtml(spacingNote)}</span>
                    <button type="button" class="text-action-btn" data-action="open-match" data-match-uid="${escapeHtml(spotlightMatch.uidKey)}">
                      ${res.played ? 'Vedi dettaglio gara ›' : 'Apri dettagli &amp; Calendario ›'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }
  }

  function renderCompactMatchesList(matchesInput) {
    const listEl = document.getElementById('matchesList');
    const headingEl = document.getElementById('matchesListHeading');
    if (!listEl) return;

    const allMatches = matchesInput || getDisplayedMatches();
    if (headingEl) {
      headingEl.textContent = `Tutte le ${allMatches.length} Partite`;
    }

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
        <button type="button" class="matchup-card" data-action="open-match" data-match-uid="${escapeHtml(m.uidKey)}">
          <div class="mc-header">
            <span style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              ${renderCompBadgeHtml(m)}
              <span><strong>${escapeHtml(m.day)}</strong> · <span class="mc-date-time" style="text-transform:capitalize;">${escapeHtml(dateStr)}</span></span>
            </span>
            ${haBadge}
          </div>

          <div class="mc-versus-row">
            <div class="mc-team">
              <img src="${escapeHtml(getTeamLogo(m.team1))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
              <span class="mc-team-title ${String(m.team1.id) === m.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(m.team1.title)}</span>
            </div>

            ${centerSlot}

            <div class="mc-team mc-team-right">
              <span class="mc-team-title ${String(m.team2.id) === m.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(m.team2.title)}</span>
              <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            </div>
          </div>

          ${res.played && res.sets.length > 0 ? `
            <div class="set-partials-row">
              ${res.sets.map((s, idx) => `<span class="set-chip">${idx + 1}° Set: ${escapeHtml(s)}</span>`).join('')}
            </div>
          ` : ''}

          <div class="mc-footer">
            <span class="mc-gym">${escapeHtml(m.stadium)}</span>
            <span style="color:var(--accent-blue); font-weight:600; flex-shrink:0;">${res.played ? 'Dettaglio Set ›' : 'Calendario &amp; Maps ›'}</span>
          </div>
        </button>
      `;
    }).join('');
  }

  function openMatchDetailSheet(uidKey) {
    const matches = getAllKnownMatches();
    const m = matches.find(item => item.uidKey === uidKey);
    if (!m) return;

    const res = getMatchResultInfo(m);
    document.getElementById('sheetMatchGiornata').textContent = `${m.compTag} · ${m.day} · Gara #${m.ng}`;
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

    const homeLabel = m.isHome && String(m.stadium || '').toUpperCase().includes('PANZANI')
      ? 'Partita in Casa (Pallone N. Panzani)'
      : (m.isHome ? 'Partita in Casa' : 'Partita in Trasferta');

    document.getElementById('sheetMatchBody').innerHTML = `
      <div class="entry-card" style="margin-bottom: 1rem;">
        <div class="mc-versus-row" style="border-top:none; padding-top:0;">
          <div class="mc-team">
            <img src="${escapeHtml(getTeamLogo(m.team1))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            <span class="mc-team-title ${String(m.team1.id) === m.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(m.team1.title)}</span>
          </div>
          ${centerEl}
          <div class="mc-team mc-team-right">
            <span class="mc-team-title ${String(m.team2.id) === m.ladispoliTeamId ? 'is-us' : ''}">${escapeHtml(m.team2.title)}</span>
            <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
          </div>
        </div>
        ${res.played ? `<div style="margin-top:0.2rem;"><span class="lm-result-badge ${res.didWeWin ? 'is-win' : 'is-loss'}">${res.didWeWin ? 'Vittoria Volley Ladispoli' : 'Partita conclusa'}</span></div>` : ''}
        ${setsHtml}
        <div class="entry-title" style="text-transform: capitalize; margin-top: 0.45rem;">${escapeHtml(fullDate)} · Ore ${escapeHtml((m.time || '').replace('.', ':'))}</div>
        <div class="entry-meta">
          <span>${homeLabel}</span>
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
        <button type="button" class="btn-secondary-half" style="width:100%;" data-action="download-match-ics" data-match-uid="${escapeHtml(m.uidKey)}">
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
    const titleEl = document.getElementById('standingsTitle');
    const linkEl = document.getElementById('standingsFipavLink');
    if (!tbody) return;

    const comp = COMPETITIONS[state.standingsComp] || COMPETITIONS['2df'];
    const store = state.fipav[comp.key];
    const teams = (Array.isArray(store.tables) ? store.tables[0]?.data?.teams : store.tables?.data?.teams) || [];

    if (titleEl) {
      titleEl.textContent = `Classifica ${comp.label} · Gir. A`;
    }
    if (linkEl) {
      linkEl.href = comp.fipavUrl;
    }

    tbody.innerHTML = teams.map((t, idx) => {
      const isUs = String(t.id) === comp.teamId;
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
      if (store.updatedAt) {
        try {
          const d = new Date(store.updatedAt);
          if (!isNaN(d.getTime())) {
            timeLabel = ` · Aggiornato ${d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
          }
        } catch (_) {}
      }
      meta.textContent = `Dati ufficiali FIPAV Comitato Territoriale Roma · Girone ${comp.gironeId}${timeLabel}`;
    }
  }

  function renderGironeMatchesByRound() {
    const sel = document.getElementById('giornataSelect');
    const listEl = document.getElementById('gironeMatchesList');
    if (!sel || !listEl) return;

    const comp = COMPETITIONS[state.standingsComp] || COMPETITIONS['2df'];
    const allMatches = state.fipav[comp.key]?.calendar?.data?.matches || [];
    if (allMatches.length === 0) return;

    const giornate = [];
    allMatches.forEach(m => {
      if (m.day && !giornate.includes(m.day)) giornate.push(m.day);
    });
    giornate.sort((a, b) => (parseInt(a.replace(/\D+/g, ''), 10) || 0) - (parseInt(b.replace(/\D+/g, ''), 10) || 0));

    if (!state.hasAutoSelectedRoundByComp[comp.key]) {
      let latestPlayedRound = '';
      for (const g of giornate) {
        if (allMatches.some(m => m.day === g && isMatchPlayed(m))) {
          latestPlayedRound = g;
        }
      }
      if (latestPlayedRound) {
        state.selectedGiornataByComp[comp.key] = latestPlayedRound;
      }
      state.hasAutoSelectedRoundByComp[comp.key] = true;
    }

    let selectedRound = state.selectedGiornataByComp[comp.key];
    if (!giornate.includes(selectedRound) && giornate.length > 0) {
      selectedRound = giornate[0];
      state.selectedGiornataByComp[comp.key] = selectedRound;
    }

    sel.innerHTML = giornate.map(g =>
      `<option value="${escapeHtml(g)}" ${g === selectedRound ? 'selected' : ''}>${escapeHtml(g)}</option>`
    ).join('');

    const roundMatches = allMatches.filter(m => m.day === selectedRound);
    listEl.innerHTML = roundMatches.map(m => {
      const hasUs = String(m.team1?.id) === comp.teamId || String(m.team2?.id) === comp.teamId;
      const res = getMatchResultInfo(Object.assign({}, m, { ladispoliTeamId: comp.teamId }));
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
              <span class="mc-team-title ${String(m.team1?.id) === comp.teamId ? 'is-us' : ''}" style="font-size:0.8rem;">${escapeHtml(m.team1?.title)}</span>
            </div>
            ${centerTag}
            <div class="mc-team mc-team-right">
              <span class="mc-team-title ${String(m.team2?.id) === comp.teamId ? 'is-us' : ''}" style="font-size:0.8rem;">${escapeHtml(m.team2?.title)}</span>
              <img src="${escapeHtml(getTeamLogo(m.team2))}" alt="" class="mc-logo" style="width:28px; height:28px;" onerror="this.src='/logo-ladispoli.jpg'" />
            </div>
          </div>
          ${res.played && res.sets.length > 0 ? `
            <div class="set-partials-row">
              ${res.sets.map(s => `<span class="set-chip">${escapeHtml(s)}</span>`).join('')}
            </div>
          ` : ''}
          <div style="font-size:0.72rem; color:var(--text-tertiary);">${escapeHtml(m.stadium)}</div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // FOTO SPUTTANANTI
  // ==========================================
  function savePhotosBackup() {
    try {
      const light = state.femPhotos.filter(p => !String(p.imageUrl || '').startsWith('data:'));
      localStorage.setItem(PHOTOS_BACKUP_KEY, JSON.stringify(light.slice(0, 20)));
    } catch (_) {}
  }

  async function loadFemPhotos() {
    try {
      const data = await apiFetch('/api/fem-photos', { cache: 'no-store' });
      if (Array.isArray(data.photos)) {
        state.femPhotos = data.photos;
        savePhotosBackup();
        renderFemPhotosFeed();
        if (state.currentUser) populateAccountSheetStatsOnly();
      }
    } catch (_) {
      renderFemPhotosFeed();
    }
  }

  function renderPhotoAuthorHtml(p) {
    const name = p.authorName || 'Squadra';
    const timeStr = formatRelativeTime(p.createdAt);
    const avatarHtml = p.authorPicture
      ? `<img src="${escapeHtml(p.authorPicture)}" alt="${escapeHtml(name)}" class="fem-photo-avatar is-zoomable" data-action="open-lightbox" data-img-url="${escapeHtml(p.authorPicture)}" data-caption="${escapeHtml(name)}" loading="lazy" />`
      : `<div class="fem-photo-avatar">${escapeHtml(getInitials(name))}</div>`;
    return `
      <div class="fem-photo-author">
        ${avatarHtml}
        <div class="sock-meta" style="margin:0;">${escapeHtml(name)} · ${escapeHtml(timeStr)}</div>
      </div>
    `;
  }

  function renderFemPhotosFeed() {
    const gridEl = document.getElementById('femPhotosGrid');
    const sortBtn = document.getElementById('btnFemPhotoSortToggle');
    if (sortBtn) {
      sortBtn.textContent = state.femPhotoSort === 'top' ? 'Più votate' : 'Più recenti';
    }
    if (!gridEl) return;

    const items = [...(state.femPhotos || [])];
    if (state.femPhotoSort === 'top') {
      items.sort((a, b) => {
        const diff = (b.upvotesCount || 0) - (a.upvotesCount || 0);
        if (diff !== 0) return diff;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    } else {
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    if (items.length === 0) {
      gridEl.innerHTML = `
        <div class="media-empty-card" style="grid-column: 1 / -1;">
          <div>Nessuna foto caricata.</div>
          <button type="button" class="btn-small-primary" data-action="open-upload-fem-photo">
            + Carica foto
          </button>
        </div>
      `;
      return;
    }

    const rankedIds = [...items]
      .sort((a, b) => {
        const diff = (b.upvotesCount || 0) - (a.upvotesCount || 0);
        if (diff !== 0) return diff;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      })
      .map(p => p.id);

    gridEl.innerHTML = items.map(p => {
      const rankNum = rankedIds.indexOf(p.id) + 1;
      const rankCls = rankNum <= 3 ? `rank-${rankNum}` : '';
      const medal = `#${rankNum}`;
      const caption = p.targetName ? `${p.title} (${p.targetName})` : p.title;

      return `
        <article class="sock-card">
          <span class="sock-rank-badge ${rankCls}">${medal}</span>
          <button type="button" class="sock-photo-btn" data-action="open-lightbox" data-img-url="${escapeHtml(p.imageUrl)}" data-caption="${escapeHtml(caption)}">
            <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.title)}" class="sock-photo-img" loading="lazy" />
          </button>
          <div class="sock-card-body">
            <div>
              <div class="sock-title">${escapeHtml(p.title)}</div>
              ${p.targetName ? `<span class="fem-target-pill">${escapeHtml(p.targetName)}</span>` : ''}
              ${renderPhotoAuthorHtml(p)}
            </div>
            <div class="sock-actions-row">
              <button type="button" class="upvote-btn ${p.hasUpvoted ? 'is-upvoted' : ''}" data-action="upvote-fem-photo" data-photo-id="${escapeHtml(p.id)}">
                <span>▲</span>
                <span>${p.upvotesCount || 0}</span>
              </button>
              ${p.canDelete ? `<button type="button" class="text-action-btn" style="color:var(--accent-red); font-size:0.75rem;" data-action="delete-fem-photo" data-photo-id="${escapeHtml(p.id)}">Elimina</button>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function compressImageToJpeg(file, maxDim = 960, quality = 0.78, maxBinaryBytes = 320 * 1024) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let curMax = maxDim;
          let curQuality = quality;
          let dataUrl = '';
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const renderPass = () => {
            let { width, height } = img;
            if (width > curMax || height > curMax) {
              if (width >= height) {
                height = Math.round((height * curMax) / width);
                width = curMax;
              } else {
                width = Math.round((width * curMax) / height);
                height = curMax;
              }
            }
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            dataUrl = canvas.toDataURL('image/jpeg', curQuality);
          };

          renderPass();
          if (maxBinaryBytes > 0) {
            let attempts = 0;
            while (Math.ceil((dataUrl.length - 23) * 0.75) > maxBinaryBytes && attempts < 6) {
              attempts += 1;
              if (curQuality > 0.52) {
                curQuality = Math.max(0.5, Number((curQuality - 0.1).toFixed(2)));
              } else {
                curMax = Math.max(480, Math.round(curMax * 0.8));
              }
              renderPass();
            }
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Immagine non valida'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Errore lettura file'));
      reader.readAsDataURL(file);
    });
  }

  function compressSquareAvatarToJpeg(file, size = 360, quality = 0.84) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = Math.floor((img.width - side) / 2);
          const sy = Math.floor((img.height - side) / 2);
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Immagine non valida'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Errore lettura file'));
      reader.readAsDataURL(file);
    });
  }

  function openUploadFemPhotoSheet() {
    requireGoogleLogin(() => {
      state.femPhotoCompressedDataUrl = '';
      const form = document.getElementById('formUploadFemPhoto');
      if (form) form.reset();
      document.getElementById('femPhotoPreviewWrap')?.classList.add('hidden');
      const dropLabel = document.getElementById('femPhotoDropLabel');
      if (dropLabel) dropLabel.textContent = 'Tocca per scegliere o scattare la foto';

      const submitBtn = document.getElementById('btnSubmitFemPhoto');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Pubblica Foto';
      }
      openSheet('sheetUploadFemPhoto');
    });
  }

  // ==========================================
  // SHARED TEAM CHAT
  // ==========================================
  function formatChatDayLabel(iso) {
    if (!iso) return '';
    try {
      const dt = new Date(iso);
      const today = new Date();
      const dtMid = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const diffDays = Math.round((todayMid - dtMid) / 86400000);
      if (diffDays === 0) return 'Oggi';
      if (diffDays === 1) return 'Ieri';
      return dt.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    } catch (_) {
      return '';
    }
  }

  function formatChatTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function renderChatComposerState() {
    const form = document.getElementById('chatComposerForm');
    const prompt = document.getElementById('chatLoginPrompt');
    if (!form || !prompt) return;
    form.classList.toggle('hidden', !state.currentUser);
    prompt.classList.toggle('hidden', Boolean(state.currentUser));
  }

  function renderChatMessages(forceScrollBottom = false) {
    const listEl = document.getElementById('chatMessagesList');
    if (!listEl) return;

    const wasNearBottom = (listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight) < 90;
    const msgs = state.chatMessages || [];

    if (msgs.length === 0) {
      listEl.innerHTML = `
        <div class="media-empty-card" style="border:none; background:transparent;">
          <div>Nessun messaggio ancora. Scrivi il primo!</div>
        </div>
      `;
      return;
    }

    let lastDay = '';
    const htmlParts = [];
    for (const m of msgs) {
      const dayLabel = formatChatDayLabel(m.createdAt);
      if (dayLabel && dayLabel !== lastDay) {
        lastDay = dayLabel;
        htmlParts.push(`<div class="chat-date-divider">${escapeHtml(dayLabel)}</div>`);
      }

      const name = m.authorName || 'Squadra';
      const avatarHtml = m.authorPicture
        ? `<img src="${escapeHtml(m.authorPicture)}" alt="${escapeHtml(name)}" class="chat-avatar is-zoomable" data-action="open-lightbox" data-img-url="${escapeHtml(m.authorPicture)}" data-caption="${escapeHtml(name)}" loading="lazy" />`
        : `<div class="chat-avatar">${escapeHtml(getInitials(name))}</div>`;

      const timeStr = formatChatTime(m.createdAt);
      const delHtml = m.canDelete
        ? `<button type="button" class="chat-delete-btn" data-action="delete-chat-msg" data-msg-id="${escapeHtml(m.id)}">Elimina</button>`
        : '';

      htmlParts.push(`
        <div class="chat-msg-row ${m.isMine ? 'is-mine' : ''}">
          ${avatarHtml}
          <div class="chat-msg-col">
            <div class="chat-msg-meta">
              ${m.isMine ? '' : `<strong>${escapeHtml(name)}</strong>`}
              <span>${escapeHtml(timeStr)}</span>
              ${delHtml}
            </div>
            <div class="chat-bubble">${escapeHtml(m.text)}</div>
          </div>
        </div>
      `);
    }

    listEl.innerHTML = htmlParts.join('');
    if (forceScrollBottom || wasNearBottom) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  }

  async function loadChatMessages(forceScrollBottom = false) {
    try {
      const data = await apiFetch('/api/chat', { cache: 'no-store' });
      if (Array.isArray(data.messages)) {
        const prevLast = state.chatMessages[state.chatMessages.length - 1]?.id || '';
        const prevLen = state.chatMessages.length;
        state.chatMessages = data.messages;
        const nextLast = data.messages[data.messages.length - 1]?.id || '';
        const changed = prevLen !== data.messages.length || prevLast !== nextLast;
        renderChatMessages(forceScrollBottom || changed);
      }
    } catch (_) {}
  }

  function startChatPolling() {
    if (state.chatPollTimer) return;
    state.chatPollTimer = setInterval(() => {
      if (state.activeView === 'chat' && document.visibilityState === 'visible') {
        loadChatMessages(false);
      }
    }, 4000);
  }

  function stopChatPolling() {
    if (state.chatPollTimer) {
      clearInterval(state.chatPollTimer);
      state.chatPollTimer = null;
    }
  }

  // ==========================================
  // GOOGLE ACCOUNT & PWA INSTALL
  // ==========================================
  let googleInitStarted = false;
  let googleButtonRendered = false;

  async function loadAppConfig() {
    try {
      const cfg = await apiFetch('/api/config');
      state.appConfig = Object.assign({}, state.appConfig, cfg);
      if (state.appConfig.googleClientId) {
        initGoogleSignIn();
      }
    } catch (_) {}
  }

  async function loadAuthMe() {
    try {
      const data = await apiFetch('/api/auth/me', { cache: 'no-store' });
      state.currentUser = data.user || null;
      updateAccountChrome();
      renderChatComposerState();
    } catch (_) {}
  }

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
      renderChatComposerState();
      closeSheet('sheetAccount');
      loadFemPhotos();
      loadChatMessages(state.activeView === 'chat');
      showToast(`Benvenuta, ${(res.user.name || '').split(' ')[0]}!`);

      if (typeof state.pendingLoginCallback === 'function') {
        const cb = state.pendingLoginCallback;
        state.pendingLoginCallback = null;
        cb();
      }
    } catch (err) {
      showToast(err.message || 'Accesso Google non riuscito', 'error');
    }
  }

  function populateAccountSheetStatsOnly() {
    if (!state.currentUser) return;
    const uid = state.currentUser.id;
    const photoCount = (state.femPhotos || []).filter(p => p.authorId === uid).length;
    const votesReceived = (state.femPhotos || [])
      .filter(p => p.authorId === uid)
      .reduce((sum, p) => sum + (p.upvotesCount || 0), 0);
    const msgCount = (state.chatMessages || []).filter(m => m.authorId === uid).length;

    const statsEl = document.getElementById('accountUserStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="sheet-kpi-box">
          <div class="sheet-kpi-num">${photoCount}</div>
          <span class="sheet-kpi-label">Foto</span>
        </div>
        <div class="sheet-kpi-box">
          <div class="sheet-kpi-num" style="color:var(--accent-red);">${votesReceived}</div>
          <span class="sheet-kpi-label">Voti ricevuti</span>
        </div>
        <div class="sheet-kpi-box">
          <div class="sheet-kpi-num">${msgCount}</div>
          <span class="sheet-kpi-label">Messaggi</span>
        </div>
      `;
    }
  }

  function populateAccountSheet() {
    const outPanel = document.getElementById('accountLoggedOutPanel');
    const inPanel = document.getElementById('accountLoggedInPanel');
    const title = document.getElementById('sheetAccountTitle');
    const sub = document.getElementById('sheetAccountSubtitle');

    if (state.currentUser) {
      title.textContent = 'Il tuo Profilo';
      sub.textContent = 'Collegato con Google';
      outPanel.classList.add('hidden');
      inPanel.classList.remove('hidden');

      const avUrl = state.currentUser.picture || '/logo-ladispoli.jpg';
      const av = document.getElementById('accountUserAvatar');
      if (av) av.src = avUrl;
      const zoomBtn = document.getElementById('accountAvatarZoomBtn');
      if (zoomBtn) {
        zoomBtn.setAttribute('data-action', 'open-lightbox');
        zoomBtn.setAttribute('data-img-url', avUrl);
        zoomBtn.setAttribute('data-caption', state.currentUser.name || 'Profilo');
      }
      document.getElementById('accountUserName').textContent = state.currentUser.name || 'Squadra';
      document.getElementById('accountUserEmail').textContent = state.currentUser.email || '';

      const resetBtn = document.getElementById('btnResetAccountAvatar');
      if (resetBtn) {
        resetBtn.classList.toggle('hidden', !state.currentUser.customPicture);
      }

      populateAccountSheetStatsOnly();
    } else {
      title.textContent = 'Accedi con Google';
      sub.textContent = 'Carica foto sputtananti, vota e scrivi in chat';
      inPanel.classList.add('hidden');
      outPanel.classList.remove('hidden');
      renderGoogleSignInButton();
    }

    renderPwaInstallState();
  }

  function openAccountSheet(onLoginCallback = null) {
    state.pendingLoginCallback = onLoginCallback;
    populateAccountSheet();
    openSheet('sheetAccount');
  }

  function requireGoogleLogin(callback) {
    if (state.currentUser) {
      return callback();
    }
    showToast('Accedi con Google per continuare');
    openAccountSheet(callback);
  }

  async function shareCurrentPage() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Volley Ladispoli · 2ª Divisione & Under 19 Femminile',
          text: 'Calendari 2ª Divisione e Under 19, classifiche FIPAV e foto sputtananti Volley Ladispoli',
          url
        });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('Link copiato!', 'success');
        return;
      }
    } catch (_) {}

    const tmp = document.createElement('input');
    tmp.value = url;
    document.body.appendChild(tmp);
    tmp.select();
    try {
      document.execCommand('copy');
      showToast('Link copiato!', 'success');
    } catch (_) {
      showToast('Copia il link dalla barra del browser');
    } finally {
      tmp.remove();
    }
  }

  // ==========================================
  // EVENT WIRING & INITIALIZATION
  // ==========================================
  function initEvents() {
    const topbar = document.querySelector('.topbar');
    const sentinel = document.getElementById('topScrollSentinel');
    if (topbar && sentinel && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        topbar.classList.toggle('is-scrolled', !entry.isIntersecting);
      }, { threshold: 0 }).observe(sentinel);
    }

    // Bottom Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const viewName = tab.getAttribute('data-view');
        state.activeView = viewName;
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.view-panel').forEach(p => p.classList.toggle('active', p.id === `view-${viewName}`));
        if (viewName === 'chat') {
          loadChatMessages(true);
          startChatPolling();
        } else {
          stopChatPolling();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.activeView === 'chat') {
        loadChatMessages(false);
        startChatPolling();
      } else if (document.visibilityState !== 'visible') {
        stopChatPolling();
      }
    });

    // Championship switcher in Partite
    document.querySelectorAll('#compSwitcherPartite [data-comp]').forEach(btn => {
      btn.addEventListener('click', () => {
        const comp = btn.getAttribute('data-comp');
        state.activeComp = comp;
        state.calSelectedDayKey = null;
        document.querySelectorAll('#compSwitcherPartite [data-comp]').forEach(b => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (comp === '2df' || comp === 'u19') {
          state.standingsComp = comp;
          document.querySelectorAll('#compSwitcherClassifica [data-standings]').forEach(sb => {
            const sActive = sb.getAttribute('data-standings') === comp;
            sb.classList.toggle('active', sActive);
            sb.setAttribute('aria-selected', sActive ? 'true' : 'false');
          });
        }
        renderCalendarAndStandings();
      });
    });

    // Championship switcher in Classifiche
    document.querySelectorAll('#compSwitcherClassifica [data-standings]').forEach(btn => {
      btn.addEventListener('click', () => {
        const comp = btn.getAttribute('data-standings');
        state.standingsComp = comp;
        document.querySelectorAll('#compSwitcherClassifica [data-standings]').forEach(b => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        renderStandings();
        renderGironeMatchesByRound();
      });
    });

    // Sheets close
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeSheet(btn.getAttribute('data-close')));
    });
    document.querySelectorAll('.sheet-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeSheet(backdrop.id);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTopmostSheet();
      }
    });

    // Topbar Account & Share
    document.getElementById('btnAccountToggle')?.addEventListener('click', () => openAccountSheet());
    document.getElementById('btnSharePage')?.addEventListener('click', shareCurrentPage);
    document.getElementById('btnChatLogin')?.addEventListener('click', () => openAccountSheet());

    // Account Sheet: Custom Avatar, Logout & PWA Install
    document.getElementById('accountAvatarInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const uploadLbl = document.getElementById('btnUploadAccountAvatar');
      if (uploadLbl) uploadLbl.textContent = 'Salvataggio...';
      try {
        const avatarUrl = await compressSquareAvatarToJpeg(file, 360, 0.84);
        const res = await apiFetch('/api/auth/avatar', {
          method: 'POST',
          body: JSON.stringify({ avatarUrl })
        });
        state.currentUser = res.user;
        updateAccountChrome();
        populateAccountSheet();
        loadFemPhotos();
        loadChatMessages(false);
        showToast('Foto profilo aggiornata!', 'success');
      } catch (err) {
        showToast(err.message || 'Errore aggiornamento foto profilo', 'error');
      } finally {
        if (uploadLbl) uploadLbl.textContent = 'Cambia foto profilo';
      }
    });

    document.getElementById('btnResetAccountAvatar')?.addEventListener('click', async () => {
      try {
        const res = await apiFetch('/api/auth/avatar', {
          method: 'POST',
          body: JSON.stringify({ avatarUrl: '' })
        });
        state.currentUser = res.user;
        updateAccountChrome();
        populateAccountSheet();
        loadFemPhotos();
        loadChatMessages(false);
        showToast('Ripristinata foto Google');
      } catch (err) {
        showToast(err.message || 'Errore ripristino foto', 'error');
      }
    });

    document.getElementById('btnLogoutGoogle')?.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (_) {}
      state.currentUser = null;
      updateAccountChrome();
      renderChatComposerState();
      closeSheet('sheetAccount');
      loadFemPhotos();
      loadChatMessages(false);
      showToast('Uscito dall\'account Google');
    });

    document.getElementById('btnPwaInstall')?.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      renderPwaInstallState();
    });

    // Spatial Calendar Month Arrows
    document.getElementById('btnCalPrevMonth')?.addEventListener('click', () => {
      const seasonMonths = getSeasonMonths(getDisplayedMatches());
      const idx = seasonMonths.findIndex(m => m.key === state.calMonthKey);
      if (idx > 0) {
        state.calMonthKey = seasonMonths[idx - 1].key;
        renderSpatialCalendar();
      }
    });
    document.getElementById('btnCalNextMonth')?.addEventListener('click', () => {
      const seasonMonths = getSeasonMonths(getDisplayedMatches());
      const idx = seasonMonths.findIndex(m => m.key === state.calMonthKey);
      if (idx >= 0 && idx < seasonMonths.length - 1) {
        state.calMonthKey = seasonMonths[idx + 1].key;
        renderSpatialCalendar();
      }
    });

    // Matches filter
    document.querySelectorAll('#matchFilterControl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.matchFilter = btn.getAttribute('data-matchfilter');
        document.querySelectorAll('#matchFilterControl .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderCompactMatchesList();
      });
    });

    // Download all ICS
    document.getElementById('btnDownloadAllIcs')?.addEventListener('click', () => {
      const matches = getDisplayedMatches();
      if (matches.length === 0) return;
      const suffix = state.activeComp === 'all' ? '2df-u19' : state.activeComp;
      downloadIcsFile(`calendario-volley-ladispoli-${suffix}-2026-2027.ics`, generateIcsContent(matches));
      showToast('Calendario .ics scaricato');
    });

    document.getElementById('btnRefreshFipav')?.addEventListener('click', () => loadAllFipavData(true));
    document.getElementById('btnRefreshFipavCal')?.addEventListener('click', () => loadAllFipavData(true));

    document.getElementById('giornataSelect')?.addEventListener('change', (e) => {
      state.selectedGiornataByComp[state.standingsComp] = e.target.value;
      renderGironeMatchesByRound();
    });

    // Foto sputtananti controls
    document.getElementById('btnOpenUploadFemPhoto')?.addEventListener('click', openUploadFemPhotoSheet);
    document.getElementById('btnFemPhotoSortToggle')?.addEventListener('click', () => {
      state.femPhotoSort = state.femPhotoSort === 'top' ? 'recent' : 'top';
      renderFemPhotosFeed();
    });

    document.getElementById('femPhotoInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!/^image\//i.test(file.type || '') && !/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name || '')) {
        showToast('Seleziona un file immagine valido', 'error');
        e.target.value = '';
        return;
      }
      const lbl = document.getElementById('femPhotoDropLabel');
      if (lbl) lbl.textContent = 'Ottimizzazione foto...';
      try {
        const dataUrl = await compressImageToJpeg(file, 960, 0.78, 320 * 1024);
        state.femPhotoCompressedDataUrl = dataUrl;
        const previewImg = document.getElementById('femPhotoPreviewImg');
        if (previewImg) previewImg.src = dataUrl;
        document.getElementById('femPhotoPreviewWrap')?.classList.remove('hidden');
        if (lbl) lbl.textContent = 'Foto pronta! Tocca per cambiare';
      } catch (err) {
        if (lbl) lbl.textContent = 'Tocca per scegliere o scattare la foto';
        showToast(err.message || 'Errore lettura immagine', 'error');
      }
    });

    document.getElementById('formUploadFemPhoto')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = (document.getElementById('femPhotoTitleInput')?.value || '').trim();
      const targetName = (document.getElementById('femPhotoTargetInput')?.value || '').trim();
      const imageUrl = state.femPhotoCompressedDataUrl;

      if (!imageUrl) {
        showToast('Scegli o scatta prima una foto!', 'error');
        return;
      }
      if (!title) {
        showToast('Scrivi una descrizione per la foto', 'error');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitFemPhoto');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Pubblicazione...';
      try {
        const data = await apiFetch('/api/fem-photos', {
          method: 'POST',
          body: JSON.stringify({ title, targetName, imageUrl })
        });
        if (Array.isArray(data.photos)) {
          state.femPhotos = data.photos;
          savePhotosBackup();
          renderFemPhotosFeed();
        }
        closeSheet('sheetUploadFemPhoto');
        showToast('Foto pubblicata!', 'success');
      } catch (err) {
        showToast(err.message || 'Errore pubblicazione foto', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Pubblica Foto';
      }
    });

    // Chat Composer
    document.getElementById('chatComposerForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('chatMessageInput');
      const btn = document.getElementById('btnSendChat');
      const text = (input?.value || '').trim();
      if (!text) return;
      requireGoogleLogin(async () => {
        if (btn) btn.disabled = true;
        try {
          const data = await apiFetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ text })
          });
          if (input) input.value = '';
          if (Array.isArray(data.messages)) {
            state.chatMessages = data.messages;
            renderChatMessages(true);
          }
        } catch (err) {
          showToast(err.message || 'Errore invio messaggio', 'error');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    });

    // Delegated Click Handler
    document.body.addEventListener('click', async (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.getAttribute('data-action');

      if (action === 'select-cal-month') {
        state.calMonthKey = actionEl.getAttribute('data-month-key');
        renderSpatialCalendar();
      } else if (action === 'select-cal-day') {
        const dKey = actionEl.getAttribute('data-day-key');
        if (state.calSelectedDayKey === dKey) {
          const dayMatches = getDisplayedMatches().filter(m => m.ymd === dKey);
          if (dayMatches.length === 1) {
            openMatchDetailSheet(dayMatches[0].uidKey);
          }
        } else {
          state.calSelectedDayKey = dKey;
          renderSpatialCalendar();
        }
      } else if (action === 'open-match') {
        const uidKey = actionEl.getAttribute('data-match-uid');
        openMatchDetailSheet(uidKey);
      } else if (action === 'download-match-ics') {
        const uidKey = actionEl.getAttribute('data-match-uid');
        const m = getAllKnownMatches().find(item => item.uidKey === uidKey);
        if (m) {
          downloadIcsFile(`volley-ladispoli-${m.compKey}-${m.day.toLowerCase().replace(/\s+/g, '-')}.ics`, generateIcsContent([m]));
          showToast('File .ics scaricato');
        }
      } else if (action === 'open-upload-fem-photo') {
        openUploadFemPhotoSheet();
      } else if (action === 'upvote-fem-photo') {
        const photoId = actionEl.getAttribute('data-photo-id');
        if (!photoId) return;
        requireGoogleLogin(async () => {
          try {
            const data = await apiFetch(`/api/fem-photos/${encodeURIComponent(photoId)}/upvote`, { method: 'POST' });
            if (Array.isArray(data.photos)) {
              state.femPhotos = data.photos;
              savePhotosBackup();
              renderFemPhotosFeed();
            }
          } catch (err) {
            showToast(err.message || 'Errore voto foto', 'error');
          }
        });
      } else if (action === 'delete-fem-photo') {
        const photoId = actionEl.getAttribute('data-photo-id');
        if (!photoId) return;
        if (actionEl.getAttribute('data-confirm-armed') !== 'true') {
          actionEl.setAttribute('data-confirm-armed', 'true');
          actionEl.textContent = 'Conferma?';
          setTimeout(() => {
            if (actionEl.isConnected && actionEl.getAttribute('data-confirm-armed') === 'true') {
              actionEl.removeAttribute('data-confirm-armed');
              actionEl.textContent = 'Elimina';
            }
          }, 3500);
          return;
        }
        try {
          const data = await apiFetch(`/api/fem-photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' });
          if (Array.isArray(data.photos)) {
            state.femPhotos = data.photos;
            savePhotosBackup();
            renderFemPhotosFeed();
            showToast('Foto eliminata', 'success');
          }
        } catch (err) {
          showToast(err.message || 'Impossibile eliminare', 'error');
        }
      } else if (action === 'delete-chat-msg') {
        const msgId = actionEl.getAttribute('data-msg-id');
        if (!msgId) return;
        if (actionEl.getAttribute('data-confirm-armed') !== 'true') {
          actionEl.setAttribute('data-confirm-armed', 'true');
          actionEl.textContent = 'Conferma?';
          setTimeout(() => {
            if (actionEl.isConnected && actionEl.getAttribute('data-confirm-armed') === 'true') {
              actionEl.removeAttribute('data-confirm-armed');
              actionEl.textContent = 'Elimina';
            }
          }, 3500);
          return;
        }
        try {
          const data = await apiFetch(`/api/chat/${encodeURIComponent(msgId)}`, { method: 'DELETE' });
          if (Array.isArray(data.messages)) {
            state.chatMessages = data.messages;
            renderChatMessages(false);
            showToast('Messaggio eliminato', 'success');
          }
        } catch (err) {
          showToast(err.message || 'Impossibile eliminare', 'error');
        }
      } else if (action === 'open-lightbox') {
        e.stopPropagation();
        e.preventDefault();
        const imgUrl = actionEl.getAttribute('data-img-url');
        if (!imgUrl) return;
        const cap = actionEl.getAttribute('data-caption') || '';
        document.getElementById('lightboxImg').src = imgUrl;
        document.getElementById('lightboxCaption').textContent = cap;
        openSheet('sheetImageLightbox');
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
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
    loadAuthMe();
    loadAllFipavData(false);
    loadFemPhotos();
    loadChatMessages(false);
  });
})();
