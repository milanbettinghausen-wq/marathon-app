// Oberflaeche: Tabs, Karten, Sheets, Diagramme
const ui = { tab: 'today', sel: iso(todayDate()), openWeek: null, filter: 'Alle', pending: null };

const NAV = [
  ['today', 'Heute', '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'],
  ['gym', 'Gym', '<path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12"/>'],
  ['plan', 'Plan', '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ['form', 'Verlauf', '<path d="M3 17l5-6 4 4 8-10"/><path d="M15 5h5v5"/>'],
  ['food', 'Essen', '<path d="M7 3v8a3 3 0 0 0 3 3v7M7 3v5M10 3v5M4 3v5a3 3 0 0 0 3 3M17 3c-2 1-3 4-3 7 0 2 1 3 3 3v8"/>'],
];

function refresh() {
  M = runModel();
  render();
}

function render() {
  const v = $('#view');
  const scroll = window.scrollY;
  v.innerHTML = { today: viewToday, gym: viewGym, plan: viewPlan, form: viewForm, food: viewFood, more: viewMore }[ui.tab]();
  $('#tabs').innerHTML = NAV.map(([k, l, p]) =>
    `<button data-act="tab" data-k="${k}" class="${ui.tab === k ? 'on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg><span>${l}</span></button>`).join('');
  window.scrollTo(0, scroll);
  if (ui.tab === 'more') loadSourceStatus();
}

// ---------- kleine Bausteine ----------
function pageTop(eyebrow, title, right = '', gear = true) {
  return `<header class="top"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="topr">${right}${gear ? '<button class="icon" data-act="tab" data-k="more" aria-label="Einstellungen">⚙</button>' : '<button class="icon" data-act="tab" data-k="today" aria-label="Zurück">✕</button>'}</div></header>`;
}

function ring(pct, color, inner, size = 132, stroke = 11) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = clamp(pct, 0, 1);
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="${stroke}"/>
    <circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" style="--full:${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <div class="ring-c">${inner}</div></div>`;
}

function barChart(items) {
  const W = 320, H = 130, top_ = 16, bot = 20;
  const max = Math.max(1, ...items.map((i) => i.v));
  const bw = W / items.length;
  const bars = items.map((it, i) => {
    const h = ((H - top_ - bot) * it.v) / max;
    const x = i * bw + bw * 0.18, w = bw * 0.64, y = H - bot - h;
    const cls = it.kind === 'plan' ? 'bar plan' : it.cur ? 'bar cur' : 'bar';
    const txt = it.txt != null ? it.txt : (it.v ? Math.round(it.v) : '');
    return `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${Math.max(h, 1)}" rx="5" style="animation-delay:${i * 40}ms"/>
      <text x="${x + w / 2}" y="${y - 4}" class="bv">${txt}</text>
      <text x="${x + w / 2}" y="${H - 5}" class="bl">${esc(it.label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${bars}</svg>`;
}

function lineChart(series) {
  const W = 320, H = 120, p = 8;
  if (series.length < 2) return '<p class="muted">Noch zu wenig Daten.</p>';
  const max = Math.max(20, ...series.map((s) => Math.max(s.atl, s.ctl)));
  const pt = (k) => series.map((s, i) => `${(p + (i / (series.length - 1)) * (W - 2 * p)).toFixed(1)},${(H - p - (s[k] / max) * (H - 2 * p)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart"><polyline points="${pt('ctl')}" fill="none" stroke="var(--swim)" stroke-width="2.5" stroke-linejoin="round"/>
    <polyline points="${pt('atl')}" fill="none" stroke="var(--ball)" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}

function spark(vals, color = 'var(--gym)') {
  if (vals.length < 2) return '';
  const W = 70, H = 26, min = Math.min(...vals), max = Math.max(...vals), rg = max - min || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - 3 - ((v - min) / rg) * (H - 6)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="spark"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function toast(msg, label, fn) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button id="toast-act">${esc(label)}</button>` : ''}`;
  t.classList.add('show');
  if (label) $('#toast-act').onclick = () => { t.classList.remove('show'); fn(); };
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 4500);
}

function openSheet(title, body) {
  $('#sheet').innerHTML = `<div class="scrim" data-act="close"></div><div class="panel"><div class="grab"></div><h3>${esc(title)}</h3>${body}</div>`;
  $('#sheet').classList.add('open');
}
function closeSheet() { $('#sheet').classList.remove('open'); }

const paceOf = (e) => (e.km > 0 ? fmtPace((e.min * 60) / e.km) : '');

// ---------- HEUTE ----------
function findSession(date, key) {
  const mon = iso(mondayOf(parseISO(date)));
  return (weekSessions(mon).days[date] || []).find((s) => s.key === key);
}

function actRow(e) {
  const sp = sportMeta(e.sport);
  const bits = [`${e.min} min`, e.km ? `${r1(e.km)} km` : '', e.sport === 'Laufen' && e.km ? `${paceOf(e)} /km` : '', e.hr ? `♥ ${e.hr}` : ''].filter(Boolean).join(' · ');
  return `<button class="act" style="--c:${sp.color}" data-act="openact" data-id="${e.id}"><span class="act-i">${sp.icon}</span><div><b>${esc(e.name || e.sport)}</b><small>${fmtShort(parseISO(e.date))} · ${bits}</small></div><span class="act-go">›</span></button>`;
}

function sessionCard(s) {
  const sp = SPORTS[s.t];
  if (s.t === 'gym' && !s.done && !s.restDay) {
    const sps = S.settings.gymSplits[s.split] || { ex: [] };
    const last = lastGym(s.split);
    return `<article class="sess gymcard" style="--c:${sp.color}">
      <div class="gc-top"><span class="gc-ic">🏋️</span><div><p class="eyebrow">Gym</p><div class="gc-t">${esc(s.title)}</div></div></div>
      <div class="gc-ex">${sps.ex.slice(0, 5).map((x) => `<span>${esc(x)}</span>`).join('')}${sps.ex.length > 5 ? `<span>+${sps.ex.length - 5}</span>` : ''}</div>
      ${last ? `<p class="muted">Zuletzt ${fmtShort(parseISO(last.date))} · ${fmtKg(tonnage(last))} bewegt</p>` : '<p class="muted">Dein erstes Training in dieser App. Danach siehst du deine Werte vom letzten Mal.</p>'}
      ${s.warn ? `<div class="sess-w">⚠ ${esc(s.warn)}</div>` : ''}
      <div class="sess-a"><button class="btn big" data-act="gym" data-date="${s.date}" data-split="${s.split}">Gym starten</button>
        <button class="chip" data-act="quick" data-date="${s.date}" data-key="${s.key}">✓ Erledigt</button><button class="chip" data-act="more" data-date="${s.date}" data-key="${s.key}">···</button></div></article>`;
  }
  const km = s.t === 'run' && s.km ? `<b>${s.km} km</b>` : '';
  const e = s.entry;
  const doneInfo = s.done && e ? `${e.min} min${e.km ? ` · ${r1(e.km)} km` : ''}${e.sport === 'Laufen' && e.km ? ` · ${paceOf(e)} /km` : ''}${e.hr ? ` · ♥ ${e.hr}` : ''}` : '';
  const acts = s.done || s.restDay
    ? `${s.done && e ? `<button class="chip" data-act="openact" data-id="${e.id}">Details</button>` : ''}<button class="chip" data-act="more" data-date="${s.date}" data-key="${s.key}">···</button>`
    : `<button class="btn sm" data-act="quick" data-date="${s.date}" data-key="${s.key}">✓ Erledigt</button>
       <button class="chip" data-act="more" data-date="${s.date}" data-key="${s.key}">···</button>`;
  return `<article class="sess${s.done ? ' done' : ''}" style="--c:${sp.color}">
    <div class="sess-ic">${s.done ? '✓' : sp.icon}</div>
    <div class="sess-b">
      <div class="sess-t"><span>${esc(s.title)}</span>${km}</div>
      <div class="sess-d">${esc(s.detail)}</div>
      ${s.adj ? `<div class="sess-n">↻ ${esc(s.adj)}</div>` : ''}
      ${s.tip && !s.done ? `<div class="sess-tip">⚡ ${esc(s.tip)}</div>` : ''}
      ${s.warn ? `<div class="sess-w">⚠ ${esc(s.warn)}</div>` : ''}
      ${doneInfo ? `<div class="sess-ok">Erledigt · ${esc(doneInfo)}</div>` : ''}
      <div class="sess-a">${acts}</div>
    </div></article>`;
}

function coachCard(coach) {
  const chips = S.notes.filter((n) => n.until >= iso(todayDate())).map((n) => `<span class="nchip">${esc(n.label)} · bis ${fmtShort(parseISO(n.until))}<button data-act="delnote" data-id="${n.id}" aria-label="Entfernen">✕</button></span>`).join('');
  return `<div class="card coach ${coach.level}"><p class="eyebrow">Coach</p><h2>${esc(coach.head)}</h2><p>${esc(coach.text)}</p>
    ${chips ? `<div class="nchips">${chips}</div>` : ''}
    <form data-form="coach" class="coachform"><input name="t" placeholder="Schreib mir: z. B. Knie zwickt, mach langsamer" autocomplete="off" enterkeyhint="send"><button class="btn sm">Senden</button></form></div>`;
}

function viewToday() {
  const T = iso(todayDate());
  const selD = parseISO(ui.sel);
  const mon = mondayOf(selD), monISO = iso(mon);
  const wp = weekSessions(monISO);
  const m = wp.m;
  const isToday = ui.sel === T;

  const strip = [...Array(7)].map((_, i) => {
    const d = addDays(mon, i), di = iso(d);
    const list = (wp.days[di] || []).filter((s) => !s.hidden);
    const dots = list.map((s) => `<i style="background:${SPORTS[s.t].color};opacity:${s.done ? 1 : .4}"></i>`).join('');
    const allDone = list.length && list.every((s) => s.done);
    return `<button class="dpill${di === ui.sel ? ' sel' : ''}${di === T ? ' tod' : ''}${allDone ? ' ok' : ''}" data-act="sel" data-d="${di}">
      <small>${WD[i]}</small><strong>${d.getDate()}</strong><span class="dots">${dots || '<i class="none"></i>'}</span></button>`;
  }).join('');

  const sessions = (wp.days[ui.sel] || []).filter((s) => !s.hidden);
  const extras = wp.extras[ui.sel] || [];
  const skipped = Object.keys(S.ov.skip).filter((k) => k.startsWith(ui.sel + '|')).length;
  const hasGymToday = sessions.some((s) => s.t === 'gym');
  const ng = isToday && !hasGymToday ? nextGym() : null;
  const dayHtml = sessions.length || extras.length
    ? sessions.map(sessionCard).join('') + (extras.length ? `<p class="eyebrow sp">Weitere Aktivitäten</p>${extras.map(actRow).join('')}` : '')
    : '<div class="empty">Frei. Erholung gehört zum Training dazu.</div>';

  const sinceD = S.settings.since || '';
  const runs = Object.values(wp.days).flat().filter((s) => s.t === 'run' && !s.hidden && (s.done || s.date >= sinceD));
  const expected = runs.reduce((a, s) => a + (s.done && s.entry ? s.entry.km || 0 : s.km || 0), 0);
  const done = runKm(mon, addDays(mon, 6));
  const gymDone = S.log.filter((e) => e.sport === 'Gym' && e.date >= monISO && e.date <= iso(addDays(mon, 6))).length;
  const gymPlan = S.settings.week.flat().filter((it) => it.t === 'gym').length;
  const coach = isToday ? coachToday() : null;
  const ci = S.checkin[T];
  const daysToRace = daysBetween(todayDate(), parseISO(S.settings.race));
  const racePill = M.maintain
    ? `<span class="pill gold">🔥 ${activeStreak()} ${activeStreak() === 1 ? 'Woche' : 'Wochen'} aktiv</span>`
    : `<span class="pill gold">🏁 ${daysToRace > 0 ? `${daysToRace} Tage bis Hamburg` : daysToRace === 0 ? 'Renntag!' : 'Geschafft'}</span>`;
  const sync = wcfg()
    ? `<button class="pill" data-act="sync">↻ Garmin · <span class="syncstate">${syncLabel()}</span></button>`
    : '<button class="pill" data-act="tab" data-k="more">Garmin verbinden</button>';

  return `
  ${pageTop(fmtLong(selD), isToday ? 'Heute' : WDL[dayIdx(selD)])}
  <div class="pills">${racePill}${sync}</div>

  <div class="weeknav"><button data-act="week" data-n="-7" aria-label="Vorherige Woche">‹</button>
    <span>${fmtShort(mon)} – ${fmtShort(addDays(mon, 6))}${m && !m.maintain ? ` · ${m.wo === 0 ? 'Rennwoche' : `noch ${m.wo} ${m.wo === 1 ? 'Woche' : 'Wochen'}`} · ${m.phase}` : m ? ` · ${m.phase}` : ''}${m && m.cut ? ' · leichte Woche' : ''}</span>
    <button data-act="week" data-n="7" aria-label="Nächste Woche">›</button></div>
  <div class="strip">${strip}</div>

  ${isToday ? `<div class="check"><span>Wie fühlst du dich?</span><div class="seg">
    ${[['fit', 'Fit'], ['tired', 'Müde'], ['sick', 'Angeschlagen']].map(([k, l]) => `<button data-act="checkin" data-v="${k}" class="${ci === k ? 'on ' + k : ''}">${l}</button>`).join('')}
  </div></div>` : ''}

  <section>${dayHtml}</section>
  ${ng ? `<div class="card nextgym"><p class="eyebrow">Nächstes Gym</p><div class="ng"><div><b>${esc(ng.s.title)}</b><small>${WDL[dayIdx(ng.d)]}, ${fmtShort(ng.d)}</small></div><button class="btn sm" data-act="gym" data-date="${ng.date}" data-split="${ng.s.split}">Jetzt starten</button></div></div>` : ''}
  ${skipped ? `<button class="link" data-act="restore" data-d="${ui.sel}">${skipped} übersprungen · wiederherstellen</button>` : ''}
  <button class="addrow" data-act="add-day" data-d="${ui.sel}">+ Einheit hinzufügen</button>

  ${setupCard()}${backupNudge()}
  ${coach ? coachCard(coach) : ''}
  <div class="card weekcard">
    ${ring(expected ? done / expected : 0, 'var(--run)', `<strong>${r1(done)}</strong><small>von ${Math.round(expected)} km</small>`)}
    <div class="weekstats">
      <p class="eyebrow">Diese Woche</p>
      <div><b>${gymDone}/${gymPlan}</b><small>Gym</small></div>
      ${m ? `<div><b>${m.vol}</b><small>km Ziel</small></div>` : ''}
      <div><b>${Math.round(S.log.filter((e) => e.date >= monISO && e.date <= iso(addDays(mon, 6))).reduce((a, e) => a + e.min, 0))}</b><small>min Training</small></div>
    </div>
  </div>
  ${!wcfg() && S.log.length < 5 ? '<div class="card nudge"><h2>Mehr Genauigkeit mit Garmin</h2><p>Verbinde Garmin über Intervals.icu, dann startet der Plan auf deinem echten Niveau, neue Aktivitäten erscheinen automatisch und du siehst Schlaf und Ruhepuls.</p><button class="btn" data-act="tab" data-k="more">Garmin einrichten</button></div>' : ''}`;
}

function setupCard() {
  const st = S.settings, su = st.setup || {};
  if (su.hide) return '';
  const steps = [
    [!!(st.profile && st.profile.kg), 'Gewicht, Größe, Alter eintragen', 'Damit rechne ich dein Kalorienziel.', 'f-profile', 'Eintragen'],
    [!!wcfg(), 'Garmin verbinden', 'Aktivitäten und Erholungsdaten kommen automatisch.', 'tab', 'Einrichten', 'more'],
    [!!su.week, 'Wochenstruktur prüfen', 'Fußball, Gym und Läufe auf deine Tage legen.', 'setup-week', 'Ansehen'],
    [!!su.gym, 'Gym-Übungen prüfen', 'Split A und B mit deinen Übungen füllen.', 'setup-gym', 'Ansehen'],
  ];
  const done = steps.filter((x) => x[0]).length;
  if (done === steps.length) return '';
  const next = steps.find((x) => !x[0]);
  const btn = (x) => `<button class="chip" data-act="${x[3]}"${x[5] ? ` data-k="${x[5]}"` : ''}>${x[4]}</button>`;
  return `<div class="card setup"><div class="stp"><span class="stp-i">${done}/${steps.length}</span><div><b>${next[1]}</b><small>${next[2]}</small></div>${btn(next)}</div>
    <details><summary>Alle Schritte</summary>${steps.map((x) => `<div class="stp${x[0] ? ' ok' : ''}"><span class="stp-i">${x[0] ? '✓' : '○'}</span><div><b>${x[1]}</b></div>${x[0] ? '' : btn(x)}</div>`).join('')}
      <button class="link" data-act="setup-hide">Ausblenden</button></details></div>`;
}
function backupNudge() {
  const old = Date.now() - (S.settings.lastExport || 0) > 30 * 86400000;
  if (!(S.log.length >= 15 && old)) return '';
  return '<div class="card nudge"><div class="meal-h"><div><b>Sicherung fällig</b><small>Deine Daten liegen nur auf diesem Handy.</small></div><button class="btn sm" data-act="export">Sichern</button></div></div>';
}

function weekRecap() {
  const T = todayDate(), from = iso(addDays(T, -6)), to = iso(T);
  const logs = S.log.filter((e) => e.date >= from && e.date <= to);
  if (logs.length < 2) return '';
  const km = logs.filter((e) => e.sport === 'Laufen').reduce((a, e) => a + (e.km || 0), 0);
  const mins = logs.reduce((a, e) => a + e.min, 0);
  const gyms = S.gym.filter((g) => g.date >= from && g.date <= to);
  const ton = gyms.reduce((a, g) => a + tonnage(g), 0);
  const fd = {};
  S.food.filter((e) => e.date >= from && e.date <= to).forEach((e) => { fd[e.date] = (fd[e.date] || 0) + e.k; });
  const days = Object.values(fd).filter((v) => v > 500);
  const avgK = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
  const sports = [...new Set(logs.map((e) => e.sport))];
  return `<div class="card"><p class="eyebrow">Letzte 7 Tage</p>
    <div class="tiles"><div><b>${logs.length}</b><small>Einheiten</small></div><div><b>${r1(km)}</b><small>km gelaufen</small></div><div><b>${Math.round(mins / 60 * 10) / 10}</b><small>Stunden</small></div></div>
    <p class="muted" style="margin:10px 0 0">${sports.join(', ')}${gyms.length ? ` · Gym ${gyms.length}x, ${fmtKg(ton)} bewegt` : ''}${avgK ? ` · Ø ${avgK} kcal gegessen (${days.length} Tage geloggt)` : ''}.</p></div>`;
}

// ---------- GYM ----------
function viewGym() {
  const ng = nextGym();
  const T = iso(todayDate());
  const mon = mondayOf(todayDate());
  const gymDone = S.log.filter((e) => e.sport === 'Gym' && e.date >= iso(mon) && e.date <= iso(addDays(mon, 6))).length;
  const gymPlan = Math.max(1, S.settings.week.flat().filter((it) => it.t === 'gym').length);
  const hist = exerciseHistory();
  const names = Object.keys(hist).sort((a, b) => hist[b].length - hist[a].length).slice(0, 6);
  const strength = names.map((n) => {
    const a = hist[n], last = a[a.length - 1], base = a[Math.max(0, a.length - 6)];
    const d = last.e1 - base.e1;
    return `<div class="srow"><div><b>${esc(n)}</b><small>Bester Satz: ${last.top.w} kg × ${last.top.r} · geschätztes Maximum ${Math.round(last.e1)} kg</small></div>
      <div class="sr-r">${spark(a.slice(-8).map((x) => x.e1))}<span class="${d > 0.5 ? 'up' : d < -0.5 ? 'down' : ''}">${a.length < 2 ? '' : d > 0.5 ? '▲ +' + Math.round(d) : d < -0.5 ? '▼ ' + Math.round(d) : '＝'}</span></div></div>`;
  }).join('');
  const weeks = gymWeeks(8);
  const sessions = [...S.gym].sort((a, b) => b.date.localeCompare(a.date) || (b.id || 0) - (a.id || 0)).slice(0, 8);
  const splitCard = (k) => {
    const sp = S.settings.gymSplits[k], last = lastGym(k);
    return `<div class="card splitc"><div class="sc-h"><div><p class="eyebrow">Split ${k}</p><b>${esc(sp.name)}</b></div><button class="chip" data-act="editsplit" data-k="${k}">Bearbeiten</button></div>
      <p class="muted">${sp.ex.length} Übungen · ${last ? `zuletzt ${fmtShort(parseISO(last.date))}, ${fmtKg(tonnage(last))}` : 'noch nicht gemacht'}</p>
      <button class="btn full" data-act="gym" data-date="${T}" data-split="${k}">Split ${k} starten</button></div>`;
  };
  return `${pageTop('Krafttraining', 'Gym')}
  <div class="card gymhero">
    <p class="eyebrow">${gymDone >= gymPlan ? 'Diese Woche geschafft' : 'Als Nächstes'}</p>
    ${ng ? `<div class="gh-t">${esc(ng.s.title)}</div><p class="muted">${ng.date === T ? 'Heute' : WDL[dayIdx(ng.d)] + ', ' + fmtShort(ng.d)} · ${S.settings.gymSplits[ng.s.split].ex.length} Übungen</p>
      <button class="btn big full" data-act="gym" data-date="${ng.date}" data-split="${ng.s.split}">Gym starten</button>` : '<div class="gh-t">Kein Gym geplant</div><p class="muted">Starte unten einen Split oder füge Gym in der Wochenstruktur hinzu.</p>'}
    <div class="gh-w">${[...Array(gymPlan)].map((_, i) => `<i class="${i < gymDone ? 'on' : ''}"></i>`).join('')}<small>${gymDone} von ${gymPlan} diese Woche</small></div>
  </div>
  ${splitCard('A')}${splitCard('B')}
  <div class="card splitc"><div class="sc-h"><div><p class="eyebrow">Frei</p><b>Freies Training</b></div></div><p class="muted">Stelle dein Training aus über 80 Übungen nach Muskelgruppe zusammen, ohne Vorlage.</p><button class="btn full" data-act="gfree" data-date="${T}">Freies Training starten</button></div>
  <div class="card"><h2>Stärke-Fortschritt</h2>${strength || '<p class="muted">Sobald du ein paar Mal trainiert hast, siehst du hier, wie du bei jeder Übung stärker wirst.</p>'}
    ${strength ? '<p class="muted">„Geschätztes Maximum" ist eine Rechnung aus Gewicht und Wiederholungen (Epley). Pfeile zeigen die Veränderung zu vor ein paar Einheiten.</p>' : ''}</div>
  <div class="card"><h2>Bewegtes Gewicht pro Woche</h2>${barChart(weeks.map((w) => ({ label: w.label, v: w.v, cur: w.cur, txt: w.v ? r1(w.v) : '' })))}<p class="legend">in Tonnen</p></div>
  <div class="card"><h2>Letzte Einheiten</h2>${sessions.map((g) => `<button class="log" data-act="gsession" data-id="${g.id}"><span class="lg-i">🏋️</span><div><b>${esc(S.settings.gymSplits[g.split] ? S.settings.gymSplits[g.split].name : 'Freies Training')}</b><small>${fmtShort(parseISO(g.date))} · ${g.ex.reduce((a, e) => a + e.sets.length, 0)} Sätze · ${fmtKg(tonnage(g))}</small></div></button>`).join('') || '<p class="muted">Noch nichts gespeichert.</p>'}</div>`;
}

// ---------- PLAN ----------
const PHASE_COLOR = { Grundlage: 'var(--swim)', Aufbau: 'var(--run)', Spezifisch: 'var(--gym)', Tapering: 'var(--bike)', Rennwoche: 'var(--gold)', Erholung: 'var(--swim)', 'Fit bleiben': 'var(--run)' };
const PHASE_TEXT = {
  Grundlage: 'Ausdauer ohne Druck aufbauen. Fast alles locker, die Strecke wächst langsam.',
  Aufbau: 'Strecke und Tempo steigen. Alle vier Wochen gibt es eine leichte Woche zum Erholen.',
  Spezifisch: 'Die längsten Läufe und Training im Marathontempo. Das ist die Kernphase.',
  Tapering: 'Weniger Strecke, damit du frisch an den Start gehst.',
  Rennwoche: 'Kurz locker laufen, viel Kohlenhydrate, früh schlafen. Dann das Rennen.',
  Erholung: 'Nach dem Rennen: der Körper darf sich erholen. Nur lockere, kurze Läufe.',
  'Fit bleiben': 'Gleichmäßiger Wochenrhythmus ohne Rennziel. Alle vier Wochen eine leichte Woche.',
};

function planChart(weeks) {
  const W = 320, H = 130, top_ = 14, bot = 22;
  const max = Math.max(...weeks.map((w) => w.vol), 1);
  const bw = W / weeks.length;
  const cur = iso(mondayOf(todayDate()));
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${weeks.map((w, i) => {
    const h = ((H - top_ - bot) * w.vol) / max, x = i * bw + bw * 0.12, ww = bw * 0.76, y = H - bot - h;
    const lab = i % Math.ceil(weeks.length / 7) === 0 ? `<text x="${x + ww / 2}" y="${H - 6}" class="bl">${fmtShort(parseISO(w.mon)).replace(/\.\d+\.$/, '.')}</text>` : '';
    return `<rect x="${x}" y="${y}" width="${ww}" height="${Math.max(h, 1)}" rx="3" fill="${PHASE_COLOR[w.phase]}" opacity="${w.cut ? .45 : .95}" ${w.mon === cur ? 'stroke="#fff" stroke-width="1.5"' : ''}/>${lab}`;
  }).join('')}<text x="2" y="10" class="bl" style="text-anchor:start">${Math.round(max)} km</text></svg>`;
}

function viewPlan() {
  const weeks = Object.values(M.weeks);
  const cur = iso(mondayOf(todayDate()));
  const groups = [];
  weeks.forEach((w) => {
    const g = groups[groups.length - 1];
    if (g && g.phase === w.phase) g.weeks.push(w); else groups.push({ phase: w.phase, weeks: [w] });
  });
  const phases = [...new Set(weeks.map((w) => w.phase))];
  const row = (w) => {
    const open = ui.openWeek === w.mon;
    const sun = addDays(parseISO(w.mon), 6);
    let detail = '';
    if (open) {
      const wp = weekSessions(w.mon);
      detail = `<div class="wkdetail">${Object.entries(wp.days).map(([di, list]) => {
        const d = parseISO(di);
        const items = list.filter((s) => !s.hidden).map((s) => `<span class="mini" style="--c:${SPORTS[s.t].color}">${SPORTS[s.t].icon} ${esc(s.title)}${s.t === 'run' && s.km ? ` · ${s.km} km` : ''}</span>`).join('') || '<span class="muted">frei</span>';
        return `<div class="wkday"><b>${WD[dayIdx(d)]} ${d.getDate()}.</b><div>${items}</div></div>`;
      }).join('')}</div>`;
    }
    const tag = w.phase === 'Rennwoche' ? '🏁' : w.cut ? '<span class="tag soft">leicht</span>' : w.vol === M.peak && !M.maintain ? '<span class="tag hot">Spitze</span>' : '';
    return `<div class="wk${w.mon === cur ? ' now' : ''}"><button data-act="openweek" data-w="${w.mon}">
      <div class="wk-l"><b>${fmtShort(parseISO(w.mon))} – ${fmtShort(sun)}</b><small>${w.mon === cur ? 'diese Woche' : w.wo && w.wo < 99 ? `in ${w.wo} Wochen` : ''}</small></div>
      <div class="wk-m"><b>${w.vol} km</b><small>${w.long ? `langer Lauf ${w.long} km` : 'Rennwoche'}</small></div>
      <div class="wk-r">${tag}<span class="chev">${open ? '⌃' : '⌄'}</span></div></button>${detail}</div>`;
  };
  const sections = groups.map((g) => `<section class="phase" style="--p:${PHASE_COLOR[g.phase]}"><div class="ph-h"><i></i><div><b>${g.phase}</b><small>${PHASE_TEXT[g.phase]}</small></div></div>${g.weeks.map(row).join('')}</section>`).join('');
  const title = M.maintain ? 'Fit bleiben' : 'Marathon Hamburg';
  return `${pageTop(M.maintain ? 'Wochenrhythmus' : `Haspa Marathon Hamburg · ${fmtShort(parseISO(S.settings.race))}`, 'Plan')}
  <div class="card"><p class="eyebrow">${title}</p>
    <div class="tiles"><div><b>${M.peak || '–'}</b><small>${M.maintain ? 'km pro Woche' : 'km in der Spitzenwoche'}</small></div><div><b>${S.settings.maxLong}</b><small>km längster Lauf</small></div><div><b>${M.maintain ? '–' : fmtHMS(S.settings.goalSec).replace(/^0:/, '')}</b><small>${M.maintain ? 'kein Rennziel' : 'Zielzeit'}</small></div></div>
    <p class="muted" style="margin:12px 0 0"><b>So liest du den Plan:</b> Jeder Balken ist eine Woche, die Höhe ist die Laufstrecke. Blasse Balken sind bewusst leichte Wochen. Der weiße Rand ist diese Woche. Tippe unten auf eine Woche, dann siehst du jeden Tag.</p></div>
  <div class="card"><p class="eyebrow">Laufkilometer pro Woche</p>${planChart(weeks)}
    <div class="legend2">${phases.map((p) => `<span><i style="background:${PHASE_COLOR[p]}"></i>${p}</span>`).join('')}</div>
    ${!M.maintain && M.peak && M.peak < S.settings.peakKm ? `<p class="muted">Dein Wunsch von ${S.settings.peakKm} km in der Spitze ist in der verbleibenden Zeit nicht sicher erreichbar, daher ${M.peak} km.</p>` : ''}
    <p class="muted">Der Plan rechnet bei jeder Änderung neu. Er startet auf deinem echten Niveau (zuletzt ca. ${Math.round(M.A)} km pro Woche) und steigert höchstens 10 Prozent pro Woche.</p></div>
  ${sections}`;
}

// ---------- VERLAUF ----------
function viewForm() {
  const thisMon = mondayOf(todayDate());
  const items = [];
  for (let k = 8; k >= 1; k--) {
    const mon = addDays(thisMon, -7 * k);
    items.push({ label: fmtShort(mon).replace(/\.\d+\.$/, '.'), v: runKm(mon, addDays(mon, 6)) });
  }
  items.push({ label: 'jetzt', v: runKm(thisMon, addDays(thisMon, 6)), cur: true });
  for (let k = 1; k <= 3; k++) {
    const mon = addDays(thisMon, 7 * k), w = M.weeks[iso(mon)];
    items.push({ label: fmtShort(mon).replace(/\.\d+\.$/, '.'), v: w ? w.vol : 0, kind: 'plan' });
  }
  const f = M.form;
  const tsb = f.ctl - f.atl;
  const enough = f.span >= 21;
  const state = !enough ? ['Noch zu wenig Daten', 'Nach drei Wochen mit Einträgen sage ich dir, wie frisch du bist.', '']
    : tsb > 8 ? ['Frisch', 'Du bist erholt. Gut für harte Einheiten.', 'ok']
      : tsb > -8 ? ['Ausgeglichen', 'Belastung und Erholung passen zusammen.', 'ok']
        : tsb > -20 ? ['Müde', 'Du hast viel trainiert. Achte auf lockere Tage und Schlaf.', 'warn']
          : ['Sehr müde', 'Plane eine Erholungsphase ein, sonst steigt das Verletzungsrisiko.', 'bad'];
  const longest = Math.max(0, ...S.log.filter((e) => e.sport === 'Laufen' && e.date >= iso(addDays(todayDate(), -35))).map((e) => e.km || 0));
  const runs28 = S.log.filter((e) => e.sport === 'Laufen' && e.km > 1 && e.date >= iso(addDays(todayDate(), -28)));
  const avgPace = runs28.length ? fmtPace(runs28.reduce((a, e) => a + e.min * 60, 0) / runs28.reduce((a, e) => a + e.km, 0)) : '–';
  const sports = ['Alle', ...new Set(S.log.map((e) => e.sport))];
  const list = [...S.log].filter((e) => ui.filter === 'Alle' || e.sport === ui.filter).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')).slice(0, 40);
  return `${pageTop('Auswertung', 'Verlauf')}
  <div class="card state ${state[2]}"><p class="eyebrow">Wie frisch bist du?</p><div class="st-t">${state[0]}</div><p class="muted">${state[1]}</p>
    <details><summary>Zahlen und Kurve</summary>${lineChart(f.series)}
      <p class="legend"><i style="background:var(--swim)"></i>Fitness (letzte Wochen) <i style="background:var(--ball)"></i>Ermüdung (letzte Tage)</p>
      <div class="tiles"><div><b>${Math.round(f.ctl)}</b><small>Fitness</small></div><div><b>${Math.round(f.atl)}</b><small>Ermüdung</small></div><div><b>${enough ? (tsb > 0 ? '+' : '') + Math.round(tsb) : '–'}</b><small>Frische</small></div></div>
      <p class="muted">Berechnet aus Dauer mal Anstrengung (bei Strava aus dem Puls). Frische = Fitness minus Ermüdung.</p></details></div>
  ${weekRecap()}
  ${recoveryCard()}
  <div class="tiles4 card"><div><b>${r1(runKm(thisMon, addDays(thisMon, 6)))}</b><small>km diese Woche</small></div>
    <div><b>${Math.round(M.A * 10) / 10}</b><small>km Schnitt/Woche</small></div><div><b>${avgPace}</b><small>Ø Pace /km (4 Wo.)</small></div></div>
  <div class="card"><p class="eyebrow">Laufkilometer pro Woche</p>${barChart(items)}<p class="legend"><i class="l1"></i>gelaufen <i class="l2"></i>geplant · längster Lauf der letzten 5 Wochen: ${r1(longest) || '–'} km</p></div>
  <div class="card"><h2>Aktivitäten</h2>
    <div class="filters">${sports.map((s) => `<button class="chip${ui.filter === s ? ' on' : ''}" data-act="filter" data-f="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    ${list.map(actRow).join('') || '<p class="muted">Noch nichts eingetragen.</p>'}
    <button class="addrow" data-act="newlog">+ Aktivität manuell eintragen</button></div>`;
}

function recoveryCard() {
  const rec = recoverySignals();
  if (!rec) return '';
  const l = rec.last;
  const t = (v, u, k) => (v ? `<div><b>${String(v).replace('.', ',')}${u}</b><small>${k}</small></div>` : '');
  return `<div class="card"><p class="eyebrow">Erholung laut Garmin · ${fmtShort(parseISO(rec.date))}</p>
    <div class="tiles">${t(l.sleep, ' h', 'Schlaf')}${t(l.rhr, '', 'Ruhepuls')}${t(l.hrv, '', 'HRV')}</div>
    <p class="muted" style="margin:10px 0 0">${rec.flags.length ? `Auffällig: ${rec.flags.join(', ')}.` : 'Alles im Normalbereich deiner letzten Wochen.'}</p></div>`;
}

// ---------- EINSTELLUNGEN ----------
function chip(it, d, i) {
  const sp = SPORTS[it.t];
  const label = it.t === 'run' ? { easy: 'Lockerer Lauf', quality: 'Tempolauf', long: 'Langer Lauf' }[it.role] : it.t === 'gym' ? `Gym ${it.split}` : it.t === 'football' ? `${it.n} ${it.min}′` : sp.name;
  return `<button class="ec" style="--c:${sp.color}" data-act="edititem" data-d="${d}" data-i="${i}">${sp.icon} ${esc(label)}${it.fixed ? ' 🔒' : ''}</button>`;
}

function viewMore() {
  const st = S.settings;
  const week = st.week.map((list, d) => `<div class="eday"><b>${WD[d]}</b><div>${list.map((it, i) => chip(it, d, i)).join('')}<button class="ec plus" data-act="additem" data-d="${d}">+</button></div></div>`).join('');
  const goal = st.mode === 'marathon'
    ? `<label>Rennen<input type="date" name="race" value="${st.race}"></label>
       <label>Zielzeit<input name="goal" value="${fmtHMS(st.goalSec)}" inputmode="numeric" placeholder="4:00:00"></label>
       <label>Wunsch Spitzenwoche (km)<input type="number" name="peak" value="${st.peakKm}" min="30" max="100"></label>
       <label>Längster Lauf (km)<input type="number" name="maxLong" value="${st.maxLong}" min="25" max="38"></label>
       <label>Startniveau km/Woche<input type="number" name="startKm" value="${st.startKm}" min="5" max="100"></label>
       <label>Längster Lauf bisher (km)<input type="number" name="startLong" value="${st.startLong}" min="3" max="42"></label>`
    : `<label>Wunsch km pro Woche<input type="number" name="maintainKm" value="${st.maintainKm}" min="5" max="100"></label>
       <label>Längster Lauf (km)<input type="number" name="maxLong" value="${st.maxLong}" min="8" max="38"></label>`;
  return `${pageTop('Anpassen', 'Einstellungen', '', false)}
  <div class="card"><h2>Garmin über Intervals.icu</h2><p class="muted" id="stravastate">${wcfg() ? 'Prüfe Verbindung …' : 'Noch nicht eingerichtet. Claude führt dich Schritt für Schritt durch.'}</p>
    <form data-form="source"><label>Server-Adresse<input name="url" value="${esc(st.worker.url)}" placeholder="https://marathon-strava.….workers.dev" inputmode="url" autocapitalize="off" autocorrect="off"></label>
    <label>Passphrase<input name="key" type="password" value="${esc(st.worker.key)}" autocomplete="off"></label><button class="btn full">Speichern</button></form>
    <div class="row wrap"><button class="ghost" data-act="sync">Jetzt abgleichen</button><button class="ghost" data-act="fullsync">Alles neu laden</button></div>
    <div class="row wrap"><button class="ghost" data-act="import">Strava-CSV importieren</button></div>
    <input type="file" id="csvfile" accept=".csv,text/csv" hidden>
    <p class="muted">Neue Aktivitäten kommen automatisch, sobald du die App öffnest (und alle paar Minuten, solange sie offen ist). Alle Sportarten werden übernommen, dazu Schlaf, Ruhepuls und HRV, soweit Garmin sie liefert.</p></div>
  <div class="card"><h2>${st.mode === 'marathon' ? 'Marathon-Ziel' : 'Fit bleiben'}</h2><form data-form="goal" class="grid2">${goal}
    <label>Maximalpuls (für die Anstrengung)<input type="number" name="maxHR" value="${st.maxHR}" min="150" max="220"></label>
    <button class="btn full">Speichern</button></form>
    ${st.mode === 'marathon' ? '<button class="link" data-act="endplan">Marathon-Plan beenden und ohne Rennen weitermachen</button>' : '<button class="link" data-act="newrace">Neues Rennen planen</button>'}</div>
  <div class="card"><h2>Wochenstruktur</h2><p class="muted">Tippe eine Einheit zum Ändern. 🔒 sind fest eingeplant, der Rest passt sich an.</p>${week}</div>
  <div class="card"><h2>Sicherung</h2><p class="muted">Alles liegt nur auf diesem Handy. Exportiere ab und zu.</p>
    <div class="row"><button class="ghost" data-act="export">Exportieren</button><button class="ghost" data-act="importjson">Importieren</button></div><input type="file" id="jsonfile" accept="application/json" hidden>
    <button class="link danger" data-act="reset">Alle Daten löschen</button></div>`;
}

async function loadSourceStatus() {
  const el = $('#stravastate');
  if (!el || !wcfg()) return;
  try {
    const d = await wf('/status');
    el.textContent = d.connected ? `Verbunden${d.athlete && d.athlete.name ? ` als ${d.athlete.name}` : ''}. Letzter Abgleich: ${syncLabel()}.` : 'Server erreichbar, aber der Intervals.icu-Schlüssel fehlt noch im Server.';
  } catch (err) { el.textContent = `Keine Verbindung: ${err.message}`; }
}

// ---------- Sheets und Formulare ----------
function logForm(e) {
  return `<form data-form="log"><input type="hidden" name="id" value="${e.id || ''}">
    <label>Datum<input type="date" name="date" value="${e.date}" required></label>
    <label>Sportart<select name="sport">${SPORT_LIST.map((n) => `<option${n === e.sport ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="grid2"><label>Minuten<input type="number" name="min" value="${e.min || ''}" min="1" max="900" required></label>
    <label>Distanz km<input type="number" name="km" value="${e.km || ''}" min="0" step="0.01"></label></div>
    <label>Anstrengung <output id="rpeout">${e.rpe}</output>/10<input type="range" name="rpe" min="1" max="10" value="${e.rpe}" oninput="document.getElementById('rpeout').textContent=this.value"></label>
    <div class="row">${e.id ? '<button type="button" class="ghost danger" data-act="dellog" data-id="' + e.id + '">Löschen</button>' : '<button type="button" class="ghost" data-act="close">Abbrechen</button>'}<button class="btn">Speichern</button></div></form>`;
}
function openLog(e, title = 'Aktivität eintragen') { openSheet(title, logForm(e)); }
function addLog(e) {
  S.log.push({ ...e, id: Date.now() + Math.floor(Math.random() * 1000), rpeManual: 1 });
  persist(); refresh();
}

function openAct(id) {
  const e = S.log.find((x) => String(x.id) === String(id));
  if (!e) return;
  const sp = sportMeta(e.sport);
  const tiles = [
    ['Dauer', `${e.min} min`], e.km ? ['Distanz', `${r1(e.km)} km`] : null,
    e.sport === 'Laufen' && e.km ? ['Pace', `${paceOf(e)} /km`] : e.sport === 'Radfahren' && e.km ? ['Tempo', `${r1((e.km * 60) / e.min)} km/h`] : null,
    e.hr ? ['Ø Puls', `${e.hr}`] : null, e.maxHr ? ['Max Puls', `${e.maxHr}`] : null,
    e.elev ? ['Höhenmeter', `${e.elev} m`] : null, e.cad ? ['Kadenz', `${e.cad}`] : null, e.cal ? ['Kalorien', `${e.cal}`] : null,
    ['Anstrengung', `${e.rpe}/10`],
  ].filter(Boolean);
  let splits = '';
  if (e.splits && e.splits.length) {
    const paces = e.splits.map((s) => s[0]).filter(Boolean);
    const fast = Math.min(...paces), slow = Math.max(...paces);
    splits = `<h3 style="margin-top:14px">Kilometer</h3>${e.splits.map((s, i) => `<div class="split-r"><span>${i + 1}</span><div class="sp-bar"><i style="width:${s[0] ? 30 + (70 * (slow - s[0])) / Math.max(1, slow - fast) : 0}%"></i></div><b>${s[0] ? fmtPace(s[0]) : '–'}</b><small>${s[1] ? '♥ ' + s[1] : ''}</small></div>`).join('')}`;
  }
  openSheet(`${sp.icon} ${e.name || e.sport}`, `<p class="muted">${WDL[dayIdx(parseISO(e.date))]}, ${fmtShort(parseISO(e.date))}${e.time ? ' · ' + e.time : ''}${e.src === 'strava' ? ' · von Strava' : e.src === 'garmin' ? ' · von Garmin' : ''}${e.dev ? ' · ' + esc(e.dev) : ''}</p>
    <div class="tiles tg">${tiles.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('')}</div>${splits}
    <div class="row wrap">${e.sid && wcfg() && !e.hasDetail ? `<button class="ghost" data-act="loadact" data-id="${e.id}">Mehr Details laden</button>` : ''}<button class="ghost" data-act="editlog" data-id="${e.id}">Bearbeiten</button><button class="ghost" data-act="close">Schließen</button></div>`);
}

const itemTypes = [['football', 'Fußball'], ['gym', 'Gym'], ['run', 'Lauf'], ['swim', 'Schwimmen'], ['bike', 'Radfahren']];

function itemForm(d, i) {
  const it = S.settings.week[d][i];
  let f = '';
  if (it.t === 'football') f = `<label>Name<input name="n" value="${esc(it.n)}"></label><div class="grid2"><label>Minuten<input type="number" name="min" value="${it.min}"></label><label>Anstrengung 1 bis 10<input type="number" name="rpe" value="${it.rpe}" min="1" max="10"></label></div>`;
  if (it.t === 'gym') f = `<label>Split<select name="split">${['A', 'B'].map((k) => `<option value="${k}"${it.split === k ? ' selected' : ''}>${k}: ${esc(S.settings.gymSplits[k].name)}</option>`).join('')}</select></label>`;
  if (it.t === 'run') f = `<label>Art<select name="role">${[['easy', 'Lockerer Lauf'], ['quality', 'Tempolauf / Intervalle'], ['long', 'Langer Lauf']].map(([v, l]) => `<option value="${v}"${it.role === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  return `<form data-form="item" data-d="${d}" data-i="${i}">${f}<label class="check-l"><input type="checkbox" name="fixed"${it.fixed ? ' checked' : ''}> Fest eingeplant (wird nie angepasst)</label>
    <div class="row"><button type="button" class="ghost danger" data-act="delitem" data-d="${d}" data-i="${i}">Entfernen</button><button class="btn">Speichern</button></div></form>`;
}
function splitForm(k) {
  const sp = S.settings.gymSplits[k];
  return `<form data-form="split" data-k="${k}"><label>Name<input name="name" value="${esc(sp.name)}"></label>
    <label>Übungen, eine pro Zeile<textarea name="ex" rows="8">${esc(sp.ex.join('\n'))}</textarea></label><button class="btn full">Speichern</button></form>`;
}

// ---------- Events ----------
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  const D = el.dataset;
  const handlers = {
    tab: () => { ui.tab = D.k; render(); window.scrollTo(0, 0); },
    close: closeSheet,
    sel: () => { ui.sel = D.d; render(); },
    week: () => { ui.sel = iso(addDays(parseISO(ui.sel), +D.n)); render(); },
    openweek: () => { ui.openWeek = ui.openWeek === D.w ? null : D.w; render(); },
    filter: () => { ui.filter = D.f; render(); },
    checkin: () => {
      const T = iso(todayDate());
      S.checkin[T] = S.checkin[T] === D.v ? null : D.v;
      if (!S.checkin[T]) delete S.checkin[T];
      persist(); refresh();
    },
    quick: () => {
      const s = findSession(D.date, D.key);
      if (!s) return;
      const e = s.est || { min: 45, rpe: 5 };
      openLog({ date: D.date, sport: sportOfType(s.t), min: e.min, km: s.t === 'run' || s.t === 'race' ? s.km || '' : '', rpe: e.rpe }, `${s.title} abhaken`);
    },
    more: () => {
      const s = findSession(D.date, D.key);
      if (!s) return;
      openSheet(s.title, `<div class="menu">
        ${s.done ? `<button data-act="undo" data-date="${D.date}" data-key="${D.key}">Als nicht erledigt markieren</button>` : ''}
        <button data-act="movepick" data-date="${D.date}" data-key="${D.key}">Auf anderen Tag verschieben</button>
        <button data-act="skip" data-date="${D.date}" data-key="${D.key}">Überspringen</button>
        ${s.t === 'run' ? `<button data-act="newlog" data-date="${D.date}">Anderen Lauf eintragen</button>` : ''}</div>`);
    },
    undo: () => {
      const s = findSession(D.date, D.key);
      if (s && s.entry) { S.log = S.log.filter((e) => e.id !== s.entry.id); persist(); closeSheet(); refresh(); }
    },
    movepick: () => {
      const days = [...Array(14)].map((_, i) => addDays(todayDate(), i));
      openSheet('Verschieben auf', `<div class="menu grid">${days.map((d) => `<button data-act="move" data-date="${D.date}" data-key="${D.key}" data-to="${iso(d)}">${WD[dayIdx(d)]}<br><small>${fmtShort(d)}</small></button>`).join('')}</div>`);
    },
    move: () => {
      const s = findSession(D.date, D.key);
      if (!s) return;
      const item = { t: s.t, role: s.role, split: s.split, n: s.n, min: s.min, rpe: s.rpe, fixed: s.fixed, id: 'x' + uid() };
      removeSession(D.date, D.key);
      (S.ov.extra[D.to] = S.ov.extra[D.to] || []).push(item);
      persist(); closeSheet(); ui.sel = D.to; refresh();
      toast(`Verschoben auf ${fmtShort(parseISO(D.to))}`);
    },
    skip: () => {
      const s = findSession(D.date, D.key);
      removeSession(D.date, D.key);
      persist(); closeSheet(); refresh();
      toast(`${s ? s.title : 'Einheit'} übersprungen`, 'Rückgängig', () => { delete S.ov.skip[`${D.date}|${D.key}`]; persist(); refresh(); });
    },
    restore: () => {
      Object.keys(S.ov.skip).filter((k) => k.startsWith(D.d + '|')).forEach((k) => delete S.ov.skip[k]);
      persist(); refresh();
    },
    'add-day': () => {
      openSheet('Einheit hinzufügen', `<div class="menu">${itemTypes.map(([t, n]) => `<button data-act="addto" data-d="${D.d}" data-t="${t}">${SPORTS[t].icon} ${n}</button>`).join('')}</div>`);
    },
    addto: () => {
      const it = { t: D.t, id: 'x' + uid() };
      if (D.t === 'run') it.role = 'easy';
      if (D.t === 'gym') it.split = 'A';
      if (D.t === 'football') Object.assign(it, { n: 'Fußball', min: 90, rpe: 7 });
      (S.ov.extra[D.d] = S.ov.extra[D.d] || []).push(it);
      persist(); closeSheet(); refresh();
    },
    gym: () => startGym(D.date, D.split),
    newlog: () => openLog({ date: D.date || iso(todayDate()), sport: 'Laufen', min: '', km: '', rpe: 5 }),
    editlog: () => { const e = S.log.find((x) => String(x.id) === D.id); if (e) openLog(e, 'Eintrag bearbeiten'); },
    dellog: () => {
      const old = S.log.find((x) => String(x.id) === D.id);
      S.log = S.log.filter((x) => String(x.id) !== D.id);
      persist(); closeSheet(); refresh();
      toast('Eintrag gelöscht', 'Rückgängig', () => { if (old) { S.log.push(old); persist(); refresh(); } });
    },
    'setup-week': () => { S.settings.setup = { ...S.settings.setup, week: true }; persist(); ui.tab = 'more'; render(); window.scrollTo(0, 0); },
    'setup-gym': () => { S.settings.setup = { ...S.settings.setup, gym: true }; persist(); ui.tab = 'gym'; render(); window.scrollTo(0, 0); },
    'setup-hide': () => { S.settings.setup = { ...S.settings.setup, hide: true }; persist(); render(); },
    openact: () => openAct(D.id),
    loadact: async () => {
      const e = S.log.find((x) => String(x.id) === D.id);
      if (!e) return;
      toast('Lade Details …');
      try { await icuDetail(e.sid); openAct(e.id); } catch (err) { toast(`Garmin: ${err.message}`); }
    },
    delnote: () => { S.notes = S.notes.filter((n) => n.id !== D.id); persist(); refresh(); },
    coachok: () => {
      const p = ui.pending;
      if (!p) return;
      if (p.clear) {
        const y = iso(addDays(todayDate(), -1));
        S.notes.forEach((n) => { if (n.until >= iso(todayDate())) n.until = y; });
      } else S.notes.push(...p.notes);
      ui.pending = null; persist(); closeSheet(); refresh(); toast(p.clear ? 'Schön, dass es dir besser geht. Plan läuft wieder normal.' : 'Plan angepasst');
    },
    additem: () => openSheet(`${WDL[D.d]}: Einheit hinzufügen`, `<div class="menu">${itemTypes.map(([t, n]) => `<button data-act="tpladd" data-d="${D.d}" data-t="${t}">${SPORTS[t].icon} ${n}</button>`).join('')}</div>`),
    tpladd: () => {
      const it = { t: D.t };
      if (D.t === 'run') it.role = 'easy';
      if (D.t === 'gym') it.split = 'A';
      if (D.t === 'football') Object.assign(it, { n: 'Fußball-Training', min: 90, rpe: 6, fixed: 1 });
      S.settings.week[D.d].push(it);
      persist(); closeSheet(); refresh();
    },
    edititem: () => openSheet(`${WDL[D.d]}`, itemForm(+D.d, +D.i)),
    editsplit: () => openSheet(`Split ${D.k} bearbeiten`, splitForm(D.k)),
    delitem: () => {
      const it = S.settings.week[D.d][D.i];
      if (it.fixed && !confirm('Diese Einheit ist fest eingeplant. Wirklich entfernen?')) return;
      S.settings.week[D.d].splice(D.i, 1);
      persist(); closeSheet(); refresh();
    },
    sync: () => { if (!wcfg()) { ui.tab = 'more'; render(); } else icuSync(false); },
    fullsync: () => icuSync(true),
    import: () => $('#csvfile').click(),
    importjson: () => $('#jsonfile').click(),
    export: exportData,
    endplan: () => {
      if (!confirm('Marathon-Plan beenden? Die App macht dann mit einem gleichmäßigen Wochenrhythmus weiter. Deine Daten bleiben.')) return;
      S.settings.mode = 'maintain'; persist(); refresh(); toast('Plan beendet. Die App läuft jetzt ohne Rennen weiter.');
    },
    newrace: () => { S.settings.mode = 'marathon'; persist(); refresh(); toast('Trage unten Rennen und Zielzeit ein'); },
    reset: () => {
      if (!confirm('Wirklich ALLE Daten auf diesem Gerät löschen?')) return;
      Object.values(KEYS).forEach((k) => { try { localStorage.removeItem(k); } catch { /* egal */ } });
      location.reload();
    },
    ...gymHandlers(D),
    ...foodHandlers(D),
  };
  if (handlers[a]) handlers[a]();
});

function removeSession(date, key) {
  if (key.startsWith('x')) S.ov.extra[date] = (S.ov.extra[date] || []).filter((x) => x.id !== key);
  else S.ov.skip[`${date}|${key}`] = 1;
}

document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  const fd = Object.fromEntries(new FormData(f));
  const kind = f.dataset.form;
  if (kind === 'log') {
    const e = { date: fd.date, sport: fd.sport, min: +fd.min, km: fd.km ? +fd.km : 0, rpe: +fd.rpe };
    if (fd.id) {
      const old = S.log.find((x) => String(x.id) === fd.id);
      if (old.rpe !== e.rpe) old.rpeManual = 1;
      Object.assign(old, e);
      persist(); closeSheet(); refresh(); toast('Gespeichert');
    } else { addLog(e); closeSheet(); toast('Eingetragen. Plan angepasst.'); }
  } else if (kind === 'goal') {
    if (fd.goal != null) {
      const sec = parseHMS(fd.goal);
      if (isNaN(sec) || sec < 7200 || sec > 25200) { toast('Zielzeit bitte als Stunden:Minuten, z. B. 4:00'); return; }
      S.settings.goalSec = sec;
    }
    const set = (k, key) => { if (fd[k] != null && fd[k] !== '') S.settings[key] = k === 'race' ? fd[k] : +fd[k]; };
    set('race', 'race'); set('peak', 'peakKm'); set('maxLong', 'maxLong'); set('startKm', 'startKm'); set('startLong', 'startLong'); set('maxHR', 'maxHR'); set('maintainKm', 'maintainKm');
    persist(); refresh(); toast('Gespeichert, Plan neu berechnet');
  } else if (kind === 'split') {
    S.settings.gymSplits[f.dataset.k] = { name: fd.name.trim() || 'Split', ex: fd.ex.split('\n').map((x) => x.trim()).filter(Boolean) };
    persist(); closeSheet(); refresh(); toast('Split gespeichert');
  } else if (kind === 'item') {
    const it = S.settings.week[f.dataset.d][f.dataset.i];
    if (fd.n != null) it.n = fd.n; if (fd.min) it.min = +fd.min; if (fd.rpe) it.rpe = +fd.rpe;
    if (fd.split) it.split = fd.split; if (fd.role) it.role = fd.role;
    it.fixed = fd.fixed ? 1 : 0; if (!it.fixed) delete it.fixed;
    persist(); closeSheet(); refresh();
  } else if (kind === 'source') {
    S.settings.worker = { url: (fd.url || '').trim(), key: (fd.key || '').trim() };
    persist(); render(); toast('Gespeichert');
  } else if (kind === 'coach') {
    const txt = (fd.t || '').trim();
    if (!txt) return;
    const p = parseCoach(txt);
    ui.pending = p;
    openSheet('Das habe ich verstanden', `<ul class="feat">${p.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      <div class="row"><button class="ghost" data-act="close">Abbrechen</button><button class="btn" data-act="coachok">Übernehmen</button></div>`);
  }
});

document.addEventListener('change', async (ev) => {
  if (ev.target.id === 'csvfile' && ev.target.files[0]) importStrava(await ev.target.files[0].text());
  if (ev.target.id === 'jsonfile' && ev.target.files[0]) importData(await ev.target.files[0].text());
});

function exportData() {
  S.settings.lastExport = Date.now();
  persist();
  const copy = { ...S.settings, worker: { url: '', key: '' } };
  const blob = new Blob([JSON.stringify({ v: 3, settings: copy, log: S.log, ov: S.ov, checkin: S.checkin, gym: S.gym, notes: S.notes, wellness: S.wellness, food: S.food, foods: S.foods, fav: S.fav, body: S.body, water: S.water }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `marathon-sicherung-${iso(new Date())}.json`;
  a.click();
}
function importData(text) {
  try {
    const d = JSON.parse(text);
    if (!Array.isArray(d.log)) throw new Error('format');
    if (!confirm(`Aktuelle Daten durch die Sicherung (${d.log.length} Einträge) ersetzen?`)) return;
    const w = S.settings.worker;
    S.settings = { ...DEFAULT_SETTINGS, ...d.settings, worker: w }; S.log = d.log; S.ov = d.ov || { skip: {}, extra: {} };
    S.checkin = d.checkin || {}; S.gym = d.gym || []; S.notes = d.notes || []; S.wellness = d.wellness || {}; S.food = d.food || []; S.foods = d.foods || []; S.fav = d.fav || {}; S.body = d.body || []; S.water = d.water || {};
    persist(); refresh(); toast('Sicherung eingespielt');
  } catch { toast('Die Datei konnte nicht gelesen werden'); }
}
