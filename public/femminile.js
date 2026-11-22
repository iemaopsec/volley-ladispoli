(function () {
  'use strict';

  const GIRONE_ID = '64591';
  const LADISPOLI_TEAM_ID = '231808';
  const STORAGE_BACKUP_KEY = 'vl_femminile_fipav_backup_v1';

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
    '234885': '/logos/234885.jpg'
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
      if (text.includes('⚠️') || /errat|non valid|non riuscit|manca/i.test(text)) {
        tone = 'error';
      } else if (/aggiornat|scaricat|copiat|condivis/i.test(text)) {
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

  function saveFipavBackup(data) {
    try {
      localStorage.setItem(STORAGE_BACKUP_KEY, JSON.stringify({
        calendar: data.calendar,
        tables: data.tables,
        updatedAt: data.updatedAt || ''
      }));
    } catch (_) {}
  }

  function loadFipavBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_BACKUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // ==========================================
  // BOTTOM SHEET & DRAG PHYSICS
  // ==========================================
  const sheetCloseTimers = new Map();

  function syncBodyScrollLock() {
    const anyOpen = Boolean(document.querySelector('.sheet-backdrop.is-open'));
    document.body.classList.toggle('sheet-open', anyOpen);
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
        if (e.target.closest('button, input, select, a, label')) return;
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
  // FIPAV DATA LOADING
  // ==========================================
  async function loadFipavData(forceRefresh = false) {
    if (!state.fipavCalendar) {
      const localBackup = loadFipavBackup();
      if (localBackup && localBackup.calendar) {
        state.fipavCalendar = localBackup.calendar;
        state.fipavTables = localBackup.tables || [];
        state.fipavUpdatedAt = localBackup.updatedAt || '';
        renderCalendarAndStandings();
      } else if (window.FIPAV_FALLBACK_DATA_64591) {
        state.fipavCalendar = window.FIPAV_FALLBACK_DATA_64591.calendar;
        state.fipavTables = window.FIPAV_FALLBACK_DATA_64591.tables;
        state.fipavUpdatedAt = window.FIPAV_FALLBACK_DATA_64591.updatedAt;
        renderCalendarAndStandings();
      }
    }

    try {
      const res = await fetch(`/api/fipav?girone=${GIRONE_ID}${forceRefresh ? '&refresh=1' : ''}`, {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.calendar) {
        state.fipavCalendar = data.calendar;
        state.fipavTables = data.tables;
        state.fipavUpdatedAt = data.updatedAt || new Date().toISOString();
        saveFipavBackup(data);
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
  // CALENDARIO & CLASSIFICA RENDERING
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
      .filter(m => String(m.team1?.id) === LADISPOLI_TEAM_ID || String(m.team2?.id) === LADISPOLI_TEAM_ID)
      .map(m => {
        const isHome = String(m.team1?.id) === LADISPOLI_TEAM_ID;
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
    const title = `Volley 2DF: ${match.team1.title} vs ${match.team2.title} (${match.day})`;
    const details = `Seconda Divisione Femminile Girone A (${match.day}, Gara ${match.ng})\nPalestra: ${match.stadium}`;
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
      const summary = `Volley 2DF: ${m.team1.title} vs ${m.team2.title} (${m.day})`;
      const desc = `Campionato FIPAV 2a Divisione Femminile Gir. A - ${m.day} (Gara ${m.ng}). Palestra: ${m.stadium}`;
      return [
        'BEGIN:VEVENT',
        `UID:fipav-${GIRONE_ID}-${m.id}@volleyladispoli.it`,
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
      `PRODID:-//Volley Ladispoli 2DF//FIPAV ${GIRONE_ID}//IT`,
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
    const seasonMonths = getSeasonMonths(matches);
    if (!state.calSelectedMatchId && matches.length > 0) {
      const now = new Date();
      const nextMatch = matches.find(m => !isMatchPlayed(m) && m.dateObj && m.dateObj >= new Date(now.getTime() - 3 * 3600 * 1000)) || matches[matches.length - 1];
      state.calSelectedMatchId = nextMatch.id;
      if (nextMatch.dateObj) {
        const y = nextMatch.dateObj.getFullYear();
        const m = String(nextMatch.dateObj.getMonth() + 1).padStart(2, '0');
        const candidateKey = `${y}-${m}`;
        if (seasonMonths.some(sm => sm.key === candidateKey)) {
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
    const outcomeLabel = res.didWeWin ? 'Vittoria' : 'Sconfitta';
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
          <span class="mc-team-title ${String(lastMatch.team1.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(lastMatch.team1.title)}</span>
        </div>

        <span class="mc-score-pill ${outcomeCls}">${res.scoreText}</span>

        <div class="mc-team mc-team-right">
          <span class="mc-team-title ${String(lastMatch.team2.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(lastMatch.team2.title)}</span>
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
    card.onclick = () => openMatchDetailSheet(lastMatch.id);
    card.onkeydown = (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openMatchDetailSheet(lastMatch.id);
      }
    };
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
          <span class="nm-team-name ${String(nextMatch.team1.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(nextMatch.team1.title)}</span>
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
          <span class="nm-team-name ${String(nextMatch.team2.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(nextMatch.team2.title)}</span>
        </div>
      </div>

      <div class="nm-venue">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(nextMatch.stadium)}</span>
      </div>

      <div class="nm-actions">
        <button type="button" class="btn-primary-half" data-action="open-match" data-match-id="${nextMatch.id}">
          ${res.played ? 'Vedi Parziali' : 'Al Calendario'}
        </button>
        <a href="${buildGoogleMapsUrl(nextMatch)}" target="_blank" rel="noopener noreferrer" class="btn-secondary-half">
          Apri in Maps
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
    const seasonMonths = getSeasonMonths(matches);
    const currentMonthObj = seasonMonths.find(m => m.key === state.calMonthKey) || seasonMonths[0];

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
              <span class="sp-name ${String(spotlightMatch.team1.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(spotlightMatch.team1.title)}</span>
            </div>
            ${centerBadge}
            <div class="sp-team sp-right">
              <span class="sp-name ${String(spotlightMatch.team2.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(spotlightMatch.team2.title)}</span>
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
              <span class="mc-team-title ${String(m.team1.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team1.title)}</span>
            </div>

            ${centerSlot}

            <div class="mc-team mc-team-right">
              <span class="mc-team-title ${String(m.team2.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team2.title)}</span>
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

    const homeLabel = m.isHome && String(m.stadium || '').toUpperCase().includes('PANZANI')
      ? '🏠 Partita in Casa (Pallone N. Panzani)'
      : (m.isHome ? '🏠 Partita in Casa' : '🚌 Partita in Trasferta');

    document.getElementById('sheetMatchBody').innerHTML = `
      <div class="entry-card" style="margin-bottom: 1rem;">
        <div class="mc-versus-row" style="border-top:none; padding-top:0;">
          <div class="mc-team">
            <img src="${escapeHtml(getTeamLogo(m.team1))}" alt="" class="mc-logo" onerror="this.src='/logo-ladispoli.jpg'" />
            <span class="mc-team-title ${String(m.team1.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team1.title)}</span>
          </div>
          ${centerEl}
          <div class="mc-team mc-team-right">
            <span class="mc-team-title ${String(m.team2.id) === LADISPOLI_TEAM_ID ? 'is-us' : ''}">${escapeHtml(m.team2.title)}</span>
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
      meta.textContent = `Dati ufficiali FIPAV Comitato Territoriale Roma · Girone ${GIRONE_ID}${timeLabel}`;
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

  async function shareCurrentPage() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Volley Ladispoli · 2ª Divisione Femminile',
          text: 'Calendario partite, orari e classifica Girone A Volley Ladispoli',
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

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const viewName = tab.getAttribute('data-view');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.view-panel').forEach(p => p.classList.toggle('active', p.id === `view-${viewName}`));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

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
        closeSheet('sheetMatch');
      }
    });

    const btnPrevM = document.getElementById('btnCalPrevMonth');
    const btnNextM = document.getElementById('btnCalNextMonth');
    if (btnPrevM) {
      btnPrevM.addEventListener('click', () => {
        const seasonMonths = getSeasonMonths(getLadispoliMatches());
        const idx = seasonMonths.findIndex(m => m.key === state.calMonthKey);
        if (idx > 0) {
          state.calMonthKey = seasonMonths[idx - 1].key;
          renderSpatialCalendar();
        }
      });
    }
    if (btnNextM) {
      btnNextM.addEventListener('click', () => {
        const seasonMonths = getSeasonMonths(getLadispoliMatches());
        const idx = seasonMonths.findIndex(m => m.key === state.calMonthKey);
        if (idx >= 0 && idx < seasonMonths.length - 1) {
          state.calMonthKey = seasonMonths[idx + 1].key;
          renderSpatialCalendar();
        }
      });
    }

    document.querySelectorAll('#matchFilterControl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.matchFilter = btn.getAttribute('data-matchfilter');
        document.querySelectorAll('#matchFilterControl .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderCompactMatchesList();
      });
    });

    document.getElementById('btnDownloadAllIcs')?.addEventListener('click', () => {
      const matches = getLadispoliMatches();
      if (matches.length === 0) return;
      downloadIcsFile('calendario-volley-ladispoli-2df-2026-2027.ics', generateIcsContent(matches));
      showToast('Calendario .ics scaricato');
    });

    document.getElementById('btnSharePage')?.addEventListener('click', shareCurrentPage);
    document.getElementById('btnRefreshTop')?.addEventListener('click', () => loadFipavData(true));
    document.getElementById('btnRefreshFipav')?.addEventListener('click', () => loadFipavData(true));
    document.getElementById('btnRefreshFipavCal')?.addEventListener('click', () => loadFipavData(true));

    document.getElementById('giornataSelect')?.addEventListener('change', (e) => {
      state.selectedGiornata = e.target.value;
      renderGironeMatchesByRound();
    });

    document.body.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.getAttribute('data-action');

      if (action === 'select-cal-month') {
        state.calMonthKey = actionEl.getAttribute('data-month-key');
        renderSpatialCalendar();
      } else if (action === 'select-cal-match') {
        const mId = actionEl.getAttribute('data-match-id');
        if (String(state.calSelectedMatchId) === String(mId)) {
          openMatchDetailSheet(mId);
        } else {
          state.calSelectedMatchId = mId;
          renderSpatialCalendar();
        }
      } else if (action === 'open-match') {
        const matchId = actionEl.getAttribute('data-match-id');
        openMatchDetailSheet(matchId);
      } else if (action === 'download-match-ics') {
        const matchId = actionEl.getAttribute('data-match-id');
        const m = getLadispoliMatches().find(item => String(item.id) === String(matchId));
        if (m) {
          downloadIcsFile(`volley-ladispoli-2df-${m.day.toLowerCase().replace(/\s+/g, '-')}.ics`, generateIcsContent([m]));
          showToast('File .ics scaricato');
        }
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    attachSheetDragPhysics();
    registerServiceWorker();
    loadFipavData(false);
  });
})();
