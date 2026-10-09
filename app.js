const KEY_SET = 'marathon.settings.v1';
const KEY_LOG = 'marathon.log.v1';
const DEFAULTS = { start: '2026-10-12', race: '2027-04-25', startKm: 25, peakKm: 55 };
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { alert('Speichern nicht möglich (privater Modus?).'); }
}

let settings = { ...DEFAULTS, ...load(KEY_SET, {}) };
let log = load(KEY_LOG, []);
let tab = 'training';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
const dayIdx = (d) => (d.getDay() + 6) % 7; // Mo = 0
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const load_ = (e) => e.min * e.rpe;

function currentPlan() { return buildPlan(settings.start, settings.startKm, settings.peakKm); }

function recoveryHint(today) {
  const t = iso(today);
  const sumRange = (from, to) => log.filter((e) => e.date >= iso(from) && e.date <= iso(to)).reduce((s, e) => s + load_(e), 0);
  const yesterday = log.filter((e) => e.date === iso(addDays(today, -1)));
  const twoDays = [1, 2].map((n) => log.filter((e) => e.date === iso(addDays(today, -n))).reduce((s, e) => s + load_(e), 0));
  const acute = sumRange(addDays(today, -6), today);
  const chronicTotal = sumRange(addDays(today, -34), addDays(today, -7));
  const chronicWeek = chronicTotal / 4;
  const hardYesterday = yesterday.some((e) => e.rpe >= 8);

  if (twoDays[0] >= 300 && twoDays[1] >= 300) {
    return { level: 'warn', text: 'Die letzten zwei Tage waren beide fordernd. Heute besser locker oder Ruhetag.' };
  }
  if (hardYesterday) {
    return { level: 'warn', text: 'Gestern war sehr hart (Anstrengung 8 oder mehr). Heute nur locker, auch wenn der Plan mehr vorsieht.' };
  }
  if (chronicWeek > 0 && acute / chronicWeek > 1.5) {
    return { level: 'bad', text: 'Deine Belastung dieser Woche ist deutlich höher als in den Wochen davor. Verletzungsrisiko: heute Ruhe oder sehr locker.' };
  }
  if (log.length < 3) {
    return { level: 'ok', text: 'Trag ein paar Trainings ein, dann kann ich dir Hinweise zu Ruhetagen geben.' };
  }
  return { level: 'ok', text: 'Kein Warnzeichen. Mach das, was im Plan steht, und hör auf dein Körpergefühl.' };
}

function renderTraining() {
  const plan = currentPlan();
  const today = parse(iso(new Date()));
  const start = parse(settings.start);
  const race = parse(settings.race);
  const daysToRace = daysBetween(today, race);
  const before = today < start;
  const wi = Math.min(27, Math.max(0, Math.floor(daysBetween(start, today) / 7)));
  const week = plan[wi];
  const weekStart = addDays(start, wi * 7);
  const todayIdx = dayIdx(today);
  const todayPlan = week.days[todayIdx];
  const hint = recoveryHint(today);

  let doneKm = 0;
  const rows = week.days.map((d, i) => {
    const date = addDays(weekStart, i);
    const entries = log.filter((e) => e.date === iso(date));
    doneKm += entries.filter((e) => e.sport === 'Laufen').reduce((s, e) => s + (e.km || 0), 0);
    const isToday = !before && iso(date) === iso(today);
    const done = entries.length ? `<span class="ok">✓ ${entries.map((e) => e.sport).join(', ')}</span>` : '';
    return `<div class="day${isToday ? ' today' : ''}"><div class="dn">${DAYS[i]}</div>
      <div class="t">${d.title}${d.km ? ` · ${d.km} km` : ''}<small>${d.detail}</small>${done}</div></div>`;
  }).join('');
  const pct = Math.min(100, Math.round((doneKm / week.plannedKm) * 100)) || 0;

  const recent = [...log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((e) =>
    `<div class="log"><div>${e.sport} · ${e.min} min${e.km ? ` · ${e.km} km` : ''}<small>${fmt(parse(e.date))} · Anstrengung ${e.rpe}/10</small></div>
     <button class="x" data-del="${e.id}" aria-label="Löschen">✕</button></div>`).join('') || '<p class="sub">Noch nichts eingetragen.</p>';

  return `
    <h1>Marathon Hamburg</h1>
    <p class="sub">${daysToRace > 0 ? `Noch ${daysToRace} Tage` : daysToRace === 0 ? 'Heute ist Renntag!' : 'Geschafft!'} · Woche ${week.week} von 28 · ${week.phase}${week.cut ? ' (Entlastung)' : ''}</p>

    <div class="card">
      <h2>Heute</h2>
      ${before
        ? `<div class="big">Plan startet am ${fmt(start)}</div><p class="sub">Bis dahin locker bewegen. Unten siehst du Woche 1.</p>`
        : `<div class="big">${todayPlan.title}${todayPlan.km ? ` · ${todayPlan.km} km` : ''}</div><p class="sub" style="margin:0">${todayPlan.detail}</p>`}
    </div>

    <div class="card hint ${hint.level === 'ok' ? '' : hint.level}">
      <h2>Ruhetag-Hinweis</h2>
      <div>${hint.text}</div>
    </div>

    <div class="card">
      <h2>Woche ${week.week}</h2>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="sub" style="margin:0 0 6px">${Math.round(doneKm * 10) / 10} von ${week.plannedKm} km gelaufen</p>
      ${rows}
    </div>

    <button class="primary" id="add">+ Training eintragen</button>

    <div class="card" style="margin-top:12px">
      <h2>Letzte Einträge</h2>
      ${recent}
    </div>`;
}

function renderFood() {
  return `<h1>Ernährung</h1><p class="sub">Kommt in Phase 3.</p>
    <div class="card"><h2>Geplant</h2>
    <p>Barcode-Scanner, Zutaten- und Gerichte-Datenbank, Tagesbilanz mit Kalorien, Eiweiß, Kohlenhydraten und Fett, Details zu allen weiteren Nährwerten.</p></div>`;
}

function renderSettings() {
  return `<h1>Einstellungen</h1><p class="sub">Der Plan wird danach neu berechnet.</p>
    <div class="card">
      <label>Plan-Start (ein Montag) <input type="date" id="s-start" value="${settings.start}"></label>
      <label>Wochenkilometer heute (ehrlich schätzen) <input type="number" id="s-startKm" min="5" max="100" value="${settings.startKm}"></label>
      <label>Spitzenwoche in km (Vorschlag 50 bis 60) <input type="number" id="s-peakKm" min="30" max="90" value="${settings.peakKm}"></label>
      <button class="primary" id="s-save">Speichern</button>
    </div>
    <div class="card">
      <h2>Sicherung</h2>
      <p class="sub">Alle Einträge liegen nur auf diesem Gerät. Exportier sie ab und zu.</p>
      <div class="row"><button class="ghost" id="exp">Exportieren</button><button class="ghost" id="imp">Importieren</button></div>
      <input type="file" id="impfile" accept="application/json" hidden>
    </div>`;
}

function render() {
  const v = document.getElementById('view');
  v.innerHTML = tab === 'training' ? renderTraining() : tab === 'food' ? renderFood() : renderSettings();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  bind();
}

function bind() {
  const $ = (s) => document.querySelector(s);
  $('#add')?.addEventListener('click', () => {
    const f = $('#logform');
    f.reset();
    f.date.value = iso(new Date());
    $('#dlg').showModal();
  });
  document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Eintrag löschen?')) return;
    log = log.filter((e) => String(e.id) !== b.dataset.del);
    save(KEY_LOG, log);
    render();
  }));
  $('#s-save')?.addEventListener('click', () => {
    const start = $('#s-start').value;
    if (!start || dayIdx(parse(start)) !== 0) { alert('Der Plan-Start muss ein Montag sein.'); return; }
    settings = { ...settings, start, startKm: +$('#s-startKm').value || 25, peakKm: +$('#s-peakKm').value || 55 };
    save(KEY_SET, settings);
    tab = 'training';
    render();
  });
  $('#exp')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ settings, log }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `marathon-sicherung-${iso(new Date())}.json`;
    a.click();
  });
  $('#imp')?.addEventListener('click', () => $('#impfile').click());
  $('#impfile')?.addEventListener('change', async (ev) => {
    try {
      const data = JSON.parse(await ev.target.files[0].text());
      if (!Array.isArray(data.log)) throw new Error('format');
      if (!confirm('Aktuelle Daten durch die Sicherung ersetzen?')) return;
      log = data.log;
      settings = { ...DEFAULTS, ...data.settings };
      save(KEY_LOG, log); save(KEY_SET, settings);
      render();
    } catch { alert('Die Datei konnte nicht gelesen werden.'); }
  });
}

document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
document.getElementById('cancel').addEventListener('click', () => document.getElementById('dlg').close());
document.getElementById('logform').addEventListener('submit', (ev) => {
  const f = ev.target;
  log.push({
    id: Date.now(), date: f.date.value, sport: f.sport.value,
    min: +f.min.value, km: f.km.value ? +f.km.value : 0, rpe: +f.rpe.value,
  });
  save(KEY_LOG, log);
  render();
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
