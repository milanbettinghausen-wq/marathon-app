// Oberflaeche: Tabs, Karten, Sheets, Diagramme
const ui = { tab: 'today', sel: iso(todayDate()), openWeek: null };

const NAV = [
  ['today', 'Heute', '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'],
  ['plan', 'Plan', '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ['form', 'Form', '<path d="M3 17l5-6 4 4 8-10"/><path d="M15 5h5v5"/>'],
  ['food', 'Essen', '<path d="M7 3v8a3 3 0 0 0 3 3v7M7 3v5M10 3v5M4 3v5a3 3 0 0 0 3 3M17 3c-2 1-3 4-3 7 0 2 1 3 3 3v8"/>'],
  ['more', 'Mehr', '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'],
];

function refresh() {
  M = runModel();
  render();
}

function render() {
  const v = $('#view');
  const scroll = window.scrollY;
  v.innerHTML = { today: viewToday, plan: viewPlan, form: viewForm, food: viewFood, more: viewMore }[ui.tab]();
  $('#tabs').innerHTML = NAV.map(([k, l, p]) =>
    `<button data-act="tab" data-k="${k}" class="${ui.tab === k ? 'on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg><span>${l}</span></button>`).join('');
  window.scrollTo(0, scroll);
}

// ---------- kleine Bausteine ----------
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
  const W = 320, H = 130, top = 16, bot = 20;
  const max = Math.max(10, ...items.map((i) => i.v));
  const bw = W / items.length;
  const bars = items.map((it, i) => {
    const h = ((H - top - bot) * it.v) / max;
    const x = i * bw + bw * 0.18, w = bw * 0.64, y = H - bot - h;
    const cls = it.kind === 'plan' ? 'bar plan' : it.cur ? 'bar cur' : 'bar';
    return `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${Math.max(h, 1)}" rx="5" style="animation-delay:${i * 40}ms"/>
      <text x="${x + w / 2}" y="${y - 4}" class="bv">${it.v ? Math.round(it.v) : ''}</text>
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

// ---------- HEUTE ----------
function findSession(date, key) {
  const mon = iso(mondayOf(parseISO(date)));
  return (weekSessions(mon).days[date] || []).find((s) => s.key === key);
}

function sessionCard(s) {
  const sp = SPORTS[s.t];
  const km = s.t === 'run' && s.km ? `<b>${s.km} km</b>` : '';
  const doneInfo = s.done && s.entry ? `${s.entry.min} min${s.entry.km ? ` · ${r1(s.entry.km)} km` : ''}${s.entry.src === 'strava' ? ' · Strava' : ''}` : '';
  const acts = s.done
    ? `<button class="chip" data-act="more" data-date="${s.date}" data-key="${s.key}">···</button>`
    : s.restDay
      ? `<button class="chip" data-act="more" data-date="${s.date}" data-key="${s.key}">···</button>`
      : `${s.t === 'gym' ? `<button class="btn sm" data-act="gym" data-date="${s.date}" data-split="${s.split}">Starten</button>` : ''}
         <button class="${s.t === 'gym' ? 'chip' : 'btn sm'}" data-act="quick" data-date="${s.date}" data-key="${s.key}">✓ Erledigt</button>
         <button class="chip" data-act="more" data-date="${s.date}" data-key="${s.key}">···</button>`;
  return `<article class="sess${s.done ? ' done' : ''}" style="--c:${sp.color}">
    <div class="sess-ic">${s.done ? '✓' : sp.icon}</div>
    <div class="sess-b">
      <div class="sess-t"><span>${esc(s.title)}</span>${km}</div>
      <div class="sess-d">${esc(s.detail)}</div>
      ${s.adj ? `<div class="sess-n">↻ ${esc(s.adj)}</div>` : ''}
      ${s.warn ? `<div class="sess-w">⚠ ${esc(s.warn)}</div>` : ''}
      ${doneInfo ? `<div class="sess-ok">Erledigt · ${esc(doneInfo)}</div>` : ''}
      <div class="sess-a">${acts}</div>
    </div></article>`;
}

function viewToday() {
  const T = iso(todayDate());
  const selD = parseISO(ui.sel);
  const mon = mondayOf(selD), monISO = iso(mon);
  const wp = weekSessions(monISO);
  const m = wp.m;
  const daysToRace = daysBetween(todayDate(), parseISO(S.settings.race));
  const isToday = ui.sel === T;

  const strip = [...Array(7)].map((_, i) => {
    const d = addDays(mon, i), di = iso(d);
    const list = (wp.days[di] || []).filter((s) => !s.hidden);
    const dots = list.map((s) => `<i style="background:${SPORTS[s.t].color};opacity:${s.done ? 1 : .45}"></i>`).join('');
    const allDone = list.length && list.every((s) => s.done);
    return `<button class="dpill${di === ui.sel ? ' sel' : ''}${di === T ? ' tod' : ''}${allDone ? ' ok' : ''}" data-act="sel" data-d="${di}">
      <small>${WD[i]}</small><strong>${d.getDate()}</strong><span class="dots">${dots || '<i class="none"></i>'}</span></button>`;
  }).join('');

  const sessions = (wp.days[ui.sel] || []).filter((s) => !s.hidden);
  const skipped = Object.keys(S.ov.skip).filter((k) => k.startsWith(ui.sel + '|')).length;
  const dayHtml = sessions.length
    ? sessions.map(sessionCard).join('')
    : `<div class="empty">Frei. Erholung gehört zum Training dazu.</div>`;

  const sinceD = S.settings.since || '';
  const runs = Object.values(wp.days).flat().filter((s) => s.t === 'run' && !s.hidden && (s.done || s.date >= sinceD));
  const expected = runs.reduce((a, s) => a + (s.done && s.entry ? s.entry.km || 0 : s.km || 0), 0);
  const done = runKm(mon, addDays(mon, 6));
  const coach = isToday ? coachToday() : null;
  const ci = S.checkin[T];

  return `
  <header class="top">
    <div><p class="eyebrow">${fmtLong(selD)}</p><h1>${isToday ? 'Heute' : WDL[dayIdx(selD)]}</h1></div>
    <div class="race"><strong>${daysToRace > 0 ? daysToRace : daysToRace === 0 ? '🏁' : '✓'}</strong><small>${daysToRace > 0 ? 'Tage bis<br>Hamburg' : daysToRace === 0 ? 'Renntag' : 'geschafft'}</small></div>
  </header>

  <div class="weeknav"><button data-act="week" data-n="-7" aria-label="Vorherige Woche">‹</button>
    <span>${m ? `${m.wo === 0 ? 'Rennwoche' : `Noch ${m.wo} ${m.wo === 1 ? 'Woche' : 'Wochen'} bis zum Rennen`} · ${m.phase}${m.cut ? ' · Entlastung' : ''}` : `${fmtShort(mon)} bis ${fmtShort(addDays(mon, 6))}`}</span>
    <button data-act="week" data-n="7" aria-label="Nächste Woche">›</button></div>
  <div class="strip">${strip}</div>

  ${isToday ? `<div class="check"><span>Wie fühlst du dich heute?</span><div class="seg">
    ${[['fit', 'Fit'], ['tired', 'Müde'], ['sick', 'Angeschlagen']].map(([k, l]) => `<button data-act="checkin" data-v="${k}" class="${ci === k ? 'on ' + k : ''}">${l}</button>`).join('')}
  </div></div>` : ''}

  <section>${dayHtml}</section>
  ${skipped ? `<button class="link" data-act="restore" data-d="${ui.sel}">${skipped} übersprungen · wiederherstellen</button>` : ''}
  <button class="addrow" data-act="add-day" data-d="${ui.sel}">+ Einheit hinzufügen</button>

  ${coach ? `<div class="card coach ${coach.level}"><p class="eyebrow">Coach</p><h2>${esc(coach.head)}</h2><p>${esc(coach.text)}</p></div>` : ''}

  <div class="card weekcard">
    ${ring(expected ? done / expected : 0, 'var(--run)', `<strong>${r1(done)}</strong><small>von ${Math.round(expected)} km</small>`)}
    <div class="weekstats">
      <p class="eyebrow">Diese Woche</p>
      ${m ? `<div><b>${m.vol}</b><small>km Wochenziel</small></div><div><b>${m.long || '–'}</b><small>km langer Lauf</small></div>` : ''}
      <div><b>${Math.round(S.log.filter((e) => e.date >= monISO && e.date <= iso(addDays(mon, 6))).reduce((a, e) => a + e.min, 0))}</b><small>min Training gesamt</small></div>
    </div>
  </div>
  ${S.log.length < 5 ? `<div class="card nudge"><h2>Mehr Genauigkeit mit deinen Strava-Daten</h2><p>Importiere deine bisherigen Läufe, dann startet der Plan auf deinem echten Niveau statt auf einer Schätzung.</p><button class="btn" data-act="tab" data-k="form">Zum Import</button></div>` : ''}`;
}

// ---------- PLAN ----------
function viewPlan() {
  const weeks = Object.values(M.weeks);
  const peak = Math.max(...weeks.map((w) => w.vol), 1);
  const rows = weeks.map((w) => {
    const open = ui.openWeek === w.mon;
    let detail = '';
    if (open) {
      const wp = weekSessions(w.mon);
      detail = `<div class="wkdetail">${Object.entries(wp.days).map(([di, list]) => {
        const d = parseISO(di);
        const items = list.filter((s) => !s.hidden).map((s) => `<span class="mini" style="--c:${SPORTS[s.t].color}">${SPORTS[s.t].icon} ${esc(s.title)}${s.t === 'run' && s.km ? ` ${s.km} km` : ''}</span>`).join('') || '<span class="muted">frei</span>';
        return `<div class="wkday"><b>${WD[dayIdx(d)]} ${d.getDate()}.</b><div>${items}</div></div>`;
      }).join('')}</div>`;
    }
    return `<div class="wk ${w.cut ? 'cut' : ''}"><button data-act="openweek" data-w="${w.mon}">
      <div class="wk-h"><span class="wk-n">${w.wo === 0 ? '🏁' : `−${w.wo}`}</span><div><b>${fmtShort(parseISO(w.mon))}</b><small>${w.phase}${w.cut ? ' · Entlastung' : ''}</small></div>
      <div class="wk-v"><b>${w.vol}</b><small>km${w.long ? ` · lang ${w.long}` : ''}</small></div></div>
      <div class="wk-bar"><i style="width:${(w.vol / peak) * 100}%"></i></div></button>${detail}</div>`;
  }).join('');
  return `<header class="top"><div><p class="eyebrow">Haspa Marathon Hamburg · ${fmtShort(parseISO(S.settings.race))}</p><h1>Plan</h1></div></header>
    <div class="card"><p class="eyebrow">Dein Verlauf</p>
      <div class="tiles"><div><b>${M.peak || '–'}</b><small>Spitzenwoche km</small></div><div><b>${S.settings.maxLong}</b><small>längster Lauf km</small></div><div><b>${fmtHMS(S.settings.goalSec).replace(/^0:/, '')}</b><small>Ziel</small></div></div>
      <p class="muted" style="margin:10px 0 0">Der Plan rechnet bei jeder Änderung neu. Er startet bei deinem echten Niveau (zuletzt ca. ${Math.round(M.A)} km pro Woche) und steigert maximal 10 Prozent pro Woche.${M.peak && M.peak < S.settings.peakKm ? ` Dein Wunsch von ${S.settings.peakKm} km Spitze ist in der verbleibenden Zeit nicht ganz sicher erreichbar, daher ${M.peak} km.` : ''}</p></div>
    <section class="wks">${rows}</section>`;
}

// ---------- FORM ----------
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
  const formLabel = f.span < 21 ? 'noch zu wenig Daten' : tsb > 8 ? 'frisch' : tsb > -8 ? 'ausgeglichen' : tsb > -20 ? 'müde' : 'sehr müde';
  const longest = Math.max(0, ...S.log.filter((e) => e.sport === 'Laufen' && e.date >= iso(addDays(todayDate(), -35))).map((e) => e.km || 0));
  const hist = [...S.log].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 40);
  return `<header class="top"><div><p class="eyebrow">Auswertung</p><h1>Form</h1></div></header>
  <div class="card"><p class="eyebrow">Laufkilometer pro Woche</p>${barChart(items)}<p class="legend"><i class="l1"></i>gelaufen <i class="l2"></i>geplant</p></div>
  <div class="card"><p class="eyebrow">Fitness gegen Ermüdung</p>${lineChart(f.series)}
    <p class="legend"><i style="background:var(--swim)"></i>Fitness <i style="background:var(--ball)"></i>Ermüdung</p>
    <div class="tiles"><div><b>${Math.round(f.ctl)}</b><small>Fitness</small></div><div><b>${Math.round(f.atl)}</b><small>Ermüdung</small></div><div><b>${f.span >= 21 ? (tsb > 0 ? '+' : '') + Math.round(tsb) : '–'}</b><small>${formLabel}</small></div></div>
    <p class="muted">Berechnet aus Dauer mal Anstrengung. Ein Wert, der deutlich unter −20 liegt, heißt: eine Erholungsphase einplanen.</p></div>
  <div class="card tiles4"><div><b>${r1(runKm(thisMon, addDays(thisMon, 6)))}</b><small>km diese Woche</small></div>
    <div><b>${r1(Math.round(M.A * 10) / 10)}</b><small>km Schnitt/Woche</small></div><div><b>${r1(longest) || '–'}</b><small>längster Lauf (5 Wo.)</small></div></div>
  <div class="card"><h2>Strava-Daten importieren</h2>
    <p class="muted">1. Strava im Browser: Einstellungen, Sprache auf <b>English</b> stellen.<br>2. Mein Konto, „Daten herunterladen oder Konto löschen", Archiv anfordern (kommt per Mail).<br>3. ZIP entpacken und die Datei <b>activities.csv</b> hier auswählen.</p>
    <button class="btn" data-act="import">activities.csv auswählen</button><input type="file" id="csvfile" accept=".csv,text/csv" hidden></div>
  <div class="card"><h2>Einträge</h2>${hist.map((e) => `<button class="log" data-act="editlog" data-id="${e.id}">
      <span class="lg-i">${SPORTS[TYPE_OF_NAME[e.sport]].icon}</span><div><b>${e.sport}</b> · ${e.min} min${e.km ? ` · ${r1(e.km)} km` : ''}<small>${fmtShort(parseISO(e.date))} · Anstrengung ${e.rpe}/10${e.src === 'strava' ? ' · Strava' : ''}</small></div></button>`).join('') || '<p class="muted">Noch nichts eingetragen.</p>'}
    <button class="addrow" data-act="newlog">+ Training manuell eintragen</button></div>`;
}

function viewFood() {
  return `<header class="top"><div><p class="eyebrow">Phase 3</p><h1>Essen</h1></div></header>
  <div class="card hero-food"><h2>Kommt als Nächstes</h2><p>So wird der Ernährungstracker, orientiert an den besten Apps:</p>
  <ul class="feat"><li><b>Barcode-Scanner</b> mit Open Food Facts für Produkte im Supermarkt</li>
  <li><b>Schnelles Loggen</b> wie bei MacroFactor: Suche, zuletzt gegessen, Favoriten, Schnell-Kalorien</li>
  <li><b>Eigene Gerichte</b> aus Zutaten berechnet, plus Standardgerichte</li>
  <li><b>Tagesringe</b> für Kalorien, Eiweiß, Kohlenhydrate, Fett, Details für alle Nährwerte</li>
  <li><b>Kalorien-Ziel, das mitwächst</b>: mehr Training, mehr Budget, Verbrauch aus Strava</li></ul></div>`;
}

// ---------- MEHR ----------
function chip(it, d, i) {
  const sp = SPORTS[it.t];
  const label = it.t === 'run' ? { easy: 'Lockerer Lauf', quality: 'Tempolauf', long: 'Langer Lauf' }[it.role] : it.t === 'gym' ? `Gym ${it.split}` : it.t === 'football' ? `${it.n} ${it.min}′` : sp.name;
  return `<button class="ec" style="--c:${sp.color}" data-act="edititem" data-d="${d}" data-i="${i}">${sp.icon} ${esc(label)}${it.fixed ? ' 🔒' : ''}</button>`;
}

function viewMore() {
  const st = S.settings;
  const week = st.week.map((list, d) => `<div class="eday"><b>${WD[d]}</b><div>${list.map((it, i) => chip(it, d, i)).join('')}<button class="ec plus" data-act="additem" data-d="${d}">+</button></div></div>`).join('');
  return `<header class="top"><div><p class="eyebrow">Anpassen</p><h1>Mehr</h1></div></header>
  <div class="card"><h2>Ziel</h2><form data-form="goal" class="grid2">
    <label>Rennen<input type="date" name="race" value="${st.race}"></label>
    <label>Zielzeit<input name="goal" value="${fmtHMS(st.goalSec)}" inputmode="numeric" placeholder="4:00:00"></label>
    <label>Wunsch Spitzenwoche (km)<input type="number" name="peak" value="${st.peakKm}" min="30" max="100"></label>
    <label>Längster Lauf (km)<input type="number" name="maxLong" value="${st.maxLong}" min="25" max="38"></label>
    <label>Startniveau km/Woche<input type="number" name="startKm" value="${st.startKm}" min="5" max="100"></label>
    <label>Längster Lauf bisher (km)<input type="number" name="startLong" value="${st.startLong}" min="3" max="42"></label>
    <button class="btn full">Speichern</button></form>
    <p class="muted">Startniveau und bisheriger langer Lauf gelten nur, bis echte Läufe eingetragen oder importiert sind.</p></div>
  <div class="card"><h2>Wochenstruktur</h2><p class="muted">Tippe eine Einheit zum Ändern. 🔒 sind fest eingeplant, der Rest passt sich an.</p>${week}</div>
  <div class="card"><h2>Gym-Splits</h2>${['A', 'B'].map((k) => `<form data-form="split" data-k="${k}" class="split"><label>Split ${k}<input name="name" value="${esc(st.gymSplits[k].name)}"></label>
    <label>Übungen, eine pro Zeile<textarea name="ex" rows="5">${esc(st.gymSplits[k].ex.join('\n'))}</textarea></label><button class="btn sm">Split ${k} speichern</button></form>`).join('')}</div>
  <div class="card"><h2>Sicherung</h2><p class="muted">Alles liegt nur auf diesem Handy. Exportiere ab und zu.</p>
    <div class="row"><button class="ghost" data-act="export">Exportieren</button><button class="ghost" data-act="importjson">Importieren</button></div><input type="file" id="jsonfile" accept="application/json" hidden>
    <button class="link danger" data-act="reset">Alle Daten löschen</button></div>`;
}

// ---------- Sheets und Formulare ----------
function logForm(e) {
  const sp = Object.values(SPORTS).filter((s) => s.name !== 'Marathon').map((s) => s.name);
  return `<form data-form="log"><input type="hidden" name="id" value="${e.id || ''}">
    <label>Datum<input type="date" name="date" value="${e.date}" required></label>
    <label>Sportart<select name="sport">${sp.map((n) => `<option${n === e.sport ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="grid2"><label>Minuten<input type="number" name="min" value="${e.min || ''}" min="1" max="600" required></label>
    <label>Distanz km<input type="number" name="km" value="${e.km || ''}" min="0" step="0.1"></label></div>
    <label>Anstrengung <output id="rpeout">${e.rpe}</output>/10<input type="range" name="rpe" min="1" max="10" value="${e.rpe}" oninput="document.getElementById('rpeout').textContent=this.value"></label>
    <div class="row">${e.id ? '<button type="button" class="ghost danger" data-act="dellog" data-id="' + e.id + '">Löschen</button>' : '<button type="button" class="ghost" data-act="close">Abbrechen</button>'}<button class="btn">Speichern</button></div></form>`;
}

function openLog(e, title = 'Training eintragen') { openSheet(title, logForm(e)); }

function addLog(e) {
  S.log.push({ ...e, id: Date.now() + Math.floor(Math.random() * 1000) });
  persist(); refresh();
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
    dellog: () => { S.log = S.log.filter((x) => String(x.id) !== D.id); persist(); closeSheet(); refresh(); toast('Eintrag gelöscht'); },
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
    delitem: () => {
      const it = S.settings.week[D.d][D.i];
      if (it.fixed && !confirm('Diese Einheit ist fest eingeplant. Wirklich entfernen?')) return;
      S.settings.week[D.d].splice(D.i, 1);
      persist(); closeSheet(); refresh();
    },
    import: () => $('#csvfile').click(),
    importjson: () => $('#jsonfile').click(),
    export: exportData,
    reset: () => {
      if (!confirm('Wirklich ALLE Daten auf diesem Gerät löschen?')) return;
      Object.values(KEYS).forEach((k) => { try { localStorage.removeItem(k); } catch { /* egal */ } });
      location.reload();
    },
    ...gymHandlers(D),
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
      Object.assign(old, e);
      persist(); closeSheet(); refresh(); toast('Gespeichert');
    } else { addLog(e); closeSheet(); toast('Eingetragen. Plan angepasst.'); }
  } else if (kind === 'goal') {
    const sec = parseHMS(fd.goal);
    if (isNaN(sec) || sec < 7200 || sec > 25200) { toast('Zielzeit bitte als Stunden:Minuten, z. B. 4:00'); return; }
    Object.assign(S.settings, { race: fd.race, goalSec: sec, peakKm: +fd.peak, maxLong: +fd.maxLong, startKm: +fd.startKm, startLong: +fd.startLong });
    persist(); refresh(); toast('Gespeichert, Plan neu berechnet');
  } else if (kind === 'split') {
    S.settings.gymSplits[f.dataset.k] = { name: fd.name.trim() || 'Split', ex: fd.ex.split('\n').map((x) => x.trim()).filter(Boolean) };
    persist(); refresh(); toast('Split gespeichert');
  } else if (kind === 'item') {
    const it = S.settings.week[f.dataset.d][f.dataset.i];
    if (fd.n != null) it.n = fd.n; if (fd.min) it.min = +fd.min; if (fd.rpe) it.rpe = +fd.rpe;
    if (fd.split) it.split = fd.split; if (fd.role) it.role = fd.role;
    it.fixed = fd.fixed ? 1 : 0; if (!it.fixed) delete it.fixed;
    persist(); closeSheet(); refresh();
  }
});

document.addEventListener('change', async (ev) => {
  if (ev.target.id === 'csvfile' && ev.target.files[0]) importStrava(await ev.target.files[0].text());
  if (ev.target.id === 'jsonfile' && ev.target.files[0]) importData(await ev.target.files[0].text());
});

function exportData() {
  const blob = new Blob([JSON.stringify({ v: 2, settings: S.settings, log: S.log, ov: S.ov, checkin: S.checkin, gym: S.gym }, null, 2)], { type: 'application/json' });
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
    S.settings = { ...DEFAULT_SETTINGS, ...d.settings }; S.log = d.log; S.ov = d.ov || { skip: {}, extra: {} };
    S.checkin = d.checkin || {}; S.gym = d.gym || [];
    persist(); refresh(); toast('Sicherung eingespielt');
  } catch { toast('Die Datei konnte nicht gelesen werden'); }
}
