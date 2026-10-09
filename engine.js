// Trainings-Engine: berechnet Wochenvolumen und Einheiten aus dem, was wirklich passiert ist.
// Alle Zahlen sind Faustwerte, kein medizinischer Rat.

let M = { weeks: {}, A: 0, baseLong: 0, peak: 0, wo0: 0, form: null };

function paces() {
  const mp = S.settings.goalSec / 42.195;
  const rg = (a, b) => `${fmtPace(mp * a)} bis ${fmtPace(mp * b)}`;
  return { mp: fmtPace(mp), easy: rg(1.14, 1.26), tempo: rg(0.93, 0.955), interval: rg(0.85, 0.88), mpSec: mp };
}

const sportOfType = (t) => SPORT_NAME[t];
const logsOn = (d) => S.log.filter((e) => e.date === d);
function runKm(fromD, toD) {
  const a = iso(fromD), b = iso(toD);
  return S.log.filter((e) => e.sport === 'Laufen' && e.date >= a && e.date <= b).reduce((s, e) => s + (e.km || 0), 0);
}
function dailyLoads() {
  const m = {};
  S.log.forEach((e) => { m[e.date] = (m[e.date] || 0) + e.min * e.rpe; });
  return m;
}
// Fitness (CTL, 42 Tage) gegen Ermuedung (ATL, 7 Tage), wie bei TrainingPeaks
function formSeries(days = 56) {
  const loads = dailyLoads();
  const today = todayDate();
  const first = S.log.length ? parseISO(S.log.map((e) => e.date).sort()[0]) : today;
  const start = first < addDays(today, -150) ? addDays(today, -150) : first;
  let atl = 0, ctl = 0;
  const out = [];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const l = loads[iso(d)] || 0;
    atl += (l - atl) / 7;
    ctl += (l - ctl) / 42;
    out.push({ date: iso(d), atl, ctl });
  }
  return { series: out.slice(-days), atl, ctl, span: daysBetween(start, today) };
}

// ---------- Wochenvolumen ueber alle Wochen bis zum Rennen ----------
function runModel() {
  const st = S.settings;
  const today = todayDate();
  const thisMon = mondayOf(today);
  const raceMon = mondayOf(parseISO(st.race));
  const wo0 = daysBetween(thisMon, raceMon) / 7;

  const hist = [1, 2, 3, 4].map((k) => runKm(addDays(thisMon, -7 * k), addDays(thisMon, -7 * k + 6)));
  const wts = [2, 1.5, 1, 1];
  let num = 0, den = 0;
  hist.forEach((h, i) => { if (h > 0) { num += h * wts[i]; den += wts[i]; } });
  const hasData = den > 0;
  const A = Math.max(10, hasData ? num / den : st.startKm);
  const since = iso(addDays(today, -35));
  const longs = S.log.filter((e) => e.sport === 'Laufen' && e.date >= since).map((e) => e.km || 0);
  const baseLong = Math.max(6, longs.length ? Math.max(...longs) : st.startLong);

  const weeks = {};
  let prevNC = A, curLong = baseLong, peak = 0;
  const isCut = (wo) => wo % 4 === 0 && wo >= 4;
  for (let k = 0; ; k++) {
    const wo = wo0 - k;
    if (wo < 0) break;
    const mon = iso(addDays(thisMon, 7 * k));
    let vol, long, cut = false;
    if (wo >= 3) {
      cut = isCut(wo) && k > 0;
      if (cut) {
        vol = prevNC * 0.75; long = curLong * 0.7;
      } else {
        let left = 0;
        for (let w = wo; w >= 3; w--) if (!isCut(w)) left++;
        vol = Math.min(prevNC * 1.1, prevNC + Math.max(0.5, (st.peakKm - prevNC) / left));
        vol = Math.min(vol, Math.max(st.peakKm, prevNC));
        const inc = clamp((st.maxLong - curLong) / left, 0, 2.5);
        curLong = Math.min(st.maxLong, curLong + inc);
        long = curLong;
        prevNC = vol;
        peak = Math.max(peak, vol);
      }
      long = Math.min(long, vol * 0.6);
    } else if (wo === 2) { vol = prevNC * 0.7; long = Math.min(18, vol * 0.5); }
    else if (wo === 1) { vol = prevNC * 0.55; long = Math.min(12, vol * 0.4); }
    else { vol = 14; long = 0; }
    const phase = wo === 0 ? 'Rennwoche' : wo <= 2 ? 'Tapering' : wo <= 8 ? 'Spezifisch' : wo <= 18 ? 'Aufbau' : 'Grundlage';
    weeks[mon] = { mon, wo, cut, phase, vol: Math.round(vol), long: Math.round(long) };
  }
  return { weeks, A, baseLong, peak: Math.round(peak), wo0, hasData, form: formSeries() };
}

// ---------- Einheiten pro Woche ----------
function mkSession(it, key, date) {
  return { ...it, key, date, id: key };
}

function weekSessions(monISO) {
  const mon = parseISO(monISO);
  const m = M.weeks[monISO];
  const days = {};
  const runs = [];
  for (let d = 0; d < 7; d++) {
    const di = iso(addDays(mon, d));
    const list = [];
    S.settings.week[d].forEach((it, i) => {
      const key = `t${d}.${i}`;
      if (!S.ov.skip[`${di}|${key}`]) list.push(mkSession(it, key, di));
    });
    (S.ov.extra[di] || []).forEach((it) => list.push(mkSession(it, it.id, di)));
    if (di === S.settings.race) list.push(mkSession({ t: 'race' }, 'race', di));
    days[di] = list;
    list.filter((s) => s.t === 'run').forEach((s) => runs.push(s));
  }

  // erledigt-Status: Log-Eintraege der gleichen Sportart am selben Tag
  Object.entries(days).forEach(([di, list]) => {
    const pool = logsOn(di).slice();
    list.forEach((s) => {
      const name = sportOfType(s.t);
      const idx = pool.findIndex((e) => e.sport === name);
      if (idx >= 0) { s.done = true; s.entry = pool[idx]; pool.splice(idx, 1); }
    });
  });

  if (m) {
    if (m.wo === 0) {
      runs.forEach((s) => {
        if (s.role === 'long') s.hidden = true;
        else s.km = s.role === 'quality' ? 5 : (s.date === iso(addDays(parseISO(S.settings.race), -1)) ? 3 : 5);
      });
    } else {
      const longs = runs.filter((s) => s.role === 'long');
      const others = runs.filter((s) => s.role !== 'long');
      longs.forEach((s) => { s.km = Math.max(5, m.long); });
      const rest = Math.max(0, m.vol - m.long * longs.length);
      const wt = (s) => (s.role === 'quality' ? 1.25 : 1);
      const tot = others.reduce((a, s) => a + wt(s), 0) || 1;
      others.forEach((s) => { s.km = Math.max(3, Math.round((rest * wt(s)) / tot)); });
    }
    adaptCurrentWeek(runs, mon);
    applyReadiness(days);
  }
  runs.forEach((s) => { if (s.km != null && s.km <= 0) s.km = 0; });
  Object.values(days).flat().forEach((s) => describe(s, m));
  return { days, m };
}

// Hast du diese Woche mehr oder weniger gelaufen als geplant, rutscht der Rest mit
function adaptCurrentWeek(runs, mon) {
  const T = iso(todayDate());
  const a = iso(mon), b = iso(addDays(mon, 6));
  if (T < a || T > b) return;
  if (!S.log.length) return;
  const since = S.settings.since || T;
  const visible = runs.filter((s) => !s.hidden);
  const isPast = (s) => s.date < T || (s.date === T && s.done);
  const past = visible.filter((s) => isPast(s) && s.date >= since);
  const rest = visible.filter((s) => !isPast(s));
  if (!rest.length) return;
  const plannedSoFar = past.reduce((x, s) => x + (s.km || 0), 0);
  const actualSoFar = S.log.filter((e) => e.sport === 'Laufen' && e.date >= (since > a ? since : a) && e.date <= T).reduce((x, e) => x + (e.km || 0), 0);
  const delta = actualSoFar - plannedSoFar;
  if (Math.abs(delta) < 1.5) return;
  const R = rest.reduce((x, s) => x + s.km, 0);
  const newR = clamp(R - 0.5 * delta, 0.5 * R, 1.15 * R);
  const f = newR / R;
  rest.forEach((s) => {
    s.km = Math.max(3, Math.min(S.settings.maxLong, Math.round(s.km * f)));
    s.adj = delta > 0
      ? `Angepasst: Du bist diese Woche schon ${r1(delta)} km mehr gelaufen als geplant.`
      : `Angepasst: Ein Teil der ${r1(-delta)} km, die diese Woche fehlen, wird nachgeholt, nicht alles.`;
  });
}

function applyReadiness(days) {
  const T = iso(todayDate());
  const ci = S.checkin[T];
  if (!ci || ci === 'fit' || !days[T]) return;
  days[T].forEach((s) => {
    if (s.done) return;
    if (s.t === 'run') {
      if (ci === 'sick') { s.km = 0; s.restDay = true; s.adj = 'Angeschlagen: heute kein Lauf.'; }
      else { s.role = s.role === 'quality' ? 'easy' : s.role; s.km = Math.max(3, Math.round(s.km * 0.8)); s.adj = 'Müde: lockerer und etwa 20 Prozent kürzer.'; }
    }
    if (s.t === 'football' && ci === 'sick') s.warn = 'Heute lieber aussetzen.';
    if (s.t === 'football' && ci === 'tired') s.warn = 'Heute locker mitmachen, keine Vollgas-Zweikämpfe.';
    if (s.t === 'gym' && ci === 'sick') s.warn = 'Heute lieber frei.';
  });
}

const QUALITY_ORDER = (wo) => (wo <= 10 ? ['mp', 'tempo', 'intervals', 'mp'] : ['intervals', 'tempo', 'fartlek', 'tempo']);

function describe(s, m) {
  const P = paces();
  const wo = m ? m.wo : 20;
  const st = S.settings;
  if (s.t === 'football') {
    s.title = s.n || 'Fußball';
    s.detail = `${s.min} min · Anstrengung etwa ${s.rpe}/10${m && m.wo === 0 ? ' · In der Rennwoche lieber locker.' : ''}`;
    s.est = { min: s.min, rpe: s.rpe };
  } else if (s.t === 'gym') {
    const sp = st.gymSplits[s.split] || { name: 'Gym', ex: [] };
    s.title = `Gym · ${sp.name}`;
    s.detail = sp.ex.length ? sp.ex.join(', ') : 'Übungen unter Mehr festlegen';
    s.est = { min: 60, rpe: 6 };
  } else if (s.t === 'swim') {
    s.title = 'Schwimmen'; s.detail = '30 bis 45 min locker, schont die Gelenke.'; s.est = { min: 40, rpe: 4 };
  } else if (s.t === 'bike') {
    s.title = 'Radfahren'; s.detail = '45 bis 60 min locker, hohe Trittfrequenz.'; s.est = { min: 50, rpe: 4 };
  } else if (s.t === 'race') {
    s.title = 'Haspa Marathon Hamburg';
    s.detail = `Ziel ${fmtHMS(st.goalSec)}, Pace ${P.mp} min/km. Die ersten 10 km eher zu langsam als zu schnell.`;
    s.km = 42.2; s.est = { min: Math.round(st.goalSec / 60), rpe: 9 };
  } else if (s.t === 'run') {
    const km = s.km || 0;
    s.est = { min: Math.round(km * (P.mpSec * 1.2) / 60), rpe: 5 };
    if (s.restDay) { s.title = 'Pause'; s.detail = 'Ruh dich aus. Wenn es besser ist, geht es morgen normal weiter.'; return; }
    if (!m) { s.title = s.role === 'long' ? 'Langer Lauf' : 'Lauf'; s.detail = s.done ? '' : 'Kein Plan für diese Woche.'; return; }
    if (s.role === 'long') {
      const mpKm = km >= 18 && wo <= 14 && !(m && m.cut) ? clamp(Math.round(km * 0.2), 3, 6) : 0;
      s.title = 'Langer Lauf';
      s.detail = `${km} km ruhig (${P.easy} min/km)${mpKm ? `, die letzten ${mpKm} km in Marathonpace (${P.mp})` : ''}`;
      s.est.rpe = 6;
    } else if (s.role === 'quality' && km >= 5) {
      const kind = QUALITY_ORDER(wo)[wo % 4];
      const wc = km >= 8 ? 2 : 1.5;
      const core = Math.max(2, r1(km - 2 * wc));
      if (kind === 'intervals') {
        const n = Math.max(3, Math.round(core / 1.4));
        s.title = 'Intervalle'; s.detail = `${wc} km einlaufen, ${Math.max(3, Math.round(core / 1.4))} x 1000 m in ${P.interval} min/km (400 m Trabpause), ${wc} km auslaufen`;
      } else if (kind === 'tempo') {
        s.title = 'Tempodauerlauf'; s.detail = `${wc} km einlaufen, ${core} km in ${P.tempo} min/km, ${wc} km auslaufen`;
      } else if (kind === 'fartlek') {
        const n = clamp(Math.round((km - 3) / 0.7), 4, 10);
        s.title = 'Fahrtspiel'; s.detail = `${km} km locker mit ${n} x 2 min flott (${P.tempo}) und 2 min Trab dazwischen`;
      } else {
        s.title = 'Marathonpace-Block'; s.detail = `${wc} km einlaufen, ${Math.max(2, core)} km in ${P.mp} min/km, ${wc} km auslaufen`;
      }
      s.est.rpe = 7;
    } else {
      s.title = m && m.wo === 0 ? 'Lockerer Lauf mit Steigerungen' : 'Lockerer Lauf';
      s.detail = `${km} km locker (${P.easy} min/km), du solltest dich dabei unterhalten können${m && m.wo === 0 ? ', am Ende 4 x 80 m Steigerung' : ''}`;
    }
  }
}

// ---------- Hinweis fuer heute ----------
function coachToday() {
  const T = iso(todayDate());
  const ci = S.checkin[T];
  const f = M.form;
  const ratio = f && f.ctl > 15 && f.span >= 21 ? f.atl / f.ctl : null;
  const yesterday = logsOn(iso(addDays(todayDate(), -1)));
  const hardY = yesterday.some((e) => e.rpe >= 8);
  const twoHard = [1, 2].every((n) => logsOn(iso(addDays(todayDate(), -n))).reduce((s, e) => s + e.min * e.rpe, 0) >= 300);
  if (ci === 'sick') return { level: 'bad', head: 'Erholung zuerst', text: 'Du hast dich angeschlagen gemeldet. Der Plan für heute ist angepasst. Gesundheit geht vor, ein verpasster Tag kostet fast nichts.' };
  if (ratio && ratio > 1.5) return { level: 'bad', head: 'Belastung sehr hoch', text: `Deine Ermüdung liegt ${Math.round((ratio - 1) * 100)} Prozent über deinem Fitnessniveau. Heute Ruhe oder sehr locker, sonst steigt das Verletzungsrisiko.` };
  if (twoHard) return { level: 'warn', head: 'Zwei harte Tage in Folge', text: 'Heute besser locker oder Pause. Die Anpassung passiert in der Erholung.' };
  if (hardY) return { level: 'warn', head: 'Gestern war hart', text: 'Wenn heute Tempo geplant ist, lieber locker laufen. Tippe oben auf „Müde", dann passe ich die Einheit an.' };
  if (ratio && ratio > 1.3) return { level: 'warn', head: 'Belastung erhöht', text: 'Du bist über deinem Normalniveau. Kein Problem, aber achte auf lockere Tage und genug Schlaf.' };
  if (ratio && ratio < 0.7 && f.span > 28) return { level: 'ok', head: 'Frisch', text: 'Du hast weniger Belastung als sonst. Gute Tage für eine anspruchsvolle Einheit.' };
  if (S.log.length < 5) return { level: 'ok', head: 'Daten fehlen noch', text: 'Importiere deine Strava-Historie unter „Form". Dann wird der Plan genauer und der Hinweis zuverlässiger.' };
  return { level: 'ok', head: 'Alles im grünen Bereich', text: 'Mach, was im Plan steht, und hör auf dein Körpergefühl.' };
}
