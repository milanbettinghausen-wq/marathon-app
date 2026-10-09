// Garmin-Daten ueber Intervals.icu und deinen eigenen kleinen Server (Cloudflare Worker, siehe /worker).
// Der Schluessel liegt nur im Server, nie in der App oder im Repository.
let syncing = false;
let idSeq = 0;

function wcfg() {
  const w = S.settings.worker;
  return w && w.url && w.key ? w : null;
}
async function wf(path, opts = {}) {
  const w = wcfg();
  if (!w) throw new Error('Noch nicht eingerichtet');
  let res;
  try {
    res = await fetch(w.url.trim().replace(/\/+$/, '') + path, { ...opts, headers: { 'X-App-Key': w.key.trim(), ...(opts.headers || {}) } });
  } catch { throw new Error('Server nicht erreichbar (Adresse und Internet prüfen)'); }
  let data = null;
  try { data = await res.json(); } catch { /* leer */ }
  if (!res.ok) throw new Error((data && data.error) || `Fehler ${res.status}`);
  return data;
}

const round2 = (x) => Math.round(x * 100) / 100;

function mapActivity(a) {
  const sport = sportFromStrava(a.type);
  const secs = a.moving_time || a.elapsed_time || 0;
  const local = a.start_date_local || '';
  if (!local || !secs || !a.id) return null;
  const hr = a.average_heartrate ? Math.round(a.average_heartrate) : 0;
  let cad = a.average_cadence ? Math.round(a.average_cadence) : 0;
  if (sport === 'Laufen' && cad && cad < 120) cad *= 2;
  return {
    id: Date.now() * 100 + (idSeq++ % 100), sid: String(a.id), src: 'garmin', st: a.type || '',
    date: local.slice(0, 10), time: local.slice(11, 16),
    sport, name: a.name || sport,
    min: Math.max(1, Math.round(secs / 60)),
    km: sport === 'Gym' || sport === 'Fußball' ? 0 : round2((a.distance || 0) / 1000),
    rpe: hr ? rpeFromHR(hr) : (DEFAULT_RPE[sport] || 4),
    hr, maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : 0,
    elev: Math.round(a.total_elevation_gain || 0), cad,
    cal: a.calories ? Math.round(a.calories) : 0, dev: a.device_name || '',
  };
}

function mapWellness(w) {
  const o = {};
  if (w.restingHR) o.rhr = Math.round(w.restingHR);
  if (w.hrv) o.hrv = Math.round(w.hrv);
  if (w.sleepSecs) o.sleep = Math.round((w.sleepSecs / 3600) * 10) / 10;
  if (w.sleepScore) o.score = Math.round(w.sleepScore);
  if (w.steps) o.steps = Math.round(w.steps);
  if (w.weight) o.weight = Math.round(w.weight * 10) / 10;
  return Object.keys(o).length ? o : null;
}

async function icuSync(full = false, quiet = false) {
  if (!wcfg() || syncing) return;
  syncing = true;
  updateSyncUI('läuft …');
  try {
    const today = todayDate();
    const from = full || !S.settings.syncAt ? addDays(today, -730) : addDays(new Date(S.settings.syncAt * 1000), -3);
    let added = 0, updated = 0, wdays = 0;
    for (let a = from; a <= today; a = addDays(a, 150)) {
      const b = addDays(a, 149) > today ? today : addDays(a, 149);
      const acts = await wf(`/icu/activities?oldest=${iso(a)}&newest=${iso(b)}`);
      (Array.isArray(acts) ? acts : []).forEach((raw) => {
        const e = mapActivity(raw);
        if (!e) return;
        let cur = S.log.find((x) => x.sid === e.sid);
        if (!cur) cur = S.log.find((x) => !x.sid && x.date === e.date && x.sport === e.sport && (e.sport === 'Gym' || Math.abs(x.min - e.min) <= 3));
        if (cur) {
          const keep = cur.rpeManual ? { rpe: cur.rpe } : {};
          Object.assign(cur, e, { id: cur.id }, keep);
          updated++;
        } else { S.log.push(e); added++; }
      });
      try {
        const well = await wf(`/icu/wellness?oldest=${iso(a)}&newest=${iso(b)}`);
        (Array.isArray(well) ? well : []).forEach((w) => {
          const m = mapWellness(w);
          if (m && w.id) { S.wellness[w.id] = m; wdays++; }
        });
      } catch { /* Wellness ist optional */ }
    }
    S.settings.syncAt = Math.floor(Date.now() / 1000);
    persist(); refresh();
    if (!quiet || added) toast(added || updated ? `Garmin: ${added} neu, ${updated} aktualisiert${wdays ? `, ${wdays} Erholungstage` : ''}` : 'Garmin: alles aktuell');
  } catch (err) {
    toast(`Garmin: ${err.message}`);
  } finally {
    syncing = false;
    updateSyncUI();
  }
}

function syncLabel() {
  if (!wcfg()) return 'Garmin verbinden';
  if (syncing) return 'läuft …';
  const t = S.settings.syncAt;
  if (!t) return 'noch nicht abgeglichen';
  const m = Math.round((Date.now() / 1000 - t) / 60);
  return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} min` : m < 1440 ? `vor ${Math.round(m / 60)} h` : `vor ${Math.round(m / 1440)} Tagen`;
}
function updateSyncUI(txt) {
  $$('.syncstate').forEach((el) => { el.textContent = txt || syncLabel(); });
}

// Kilometer-Zeiten und Kalorien bei Bedarf nachladen
async function icuDetail(sid) {
  const d = await wf(`/icu/activity/${encodeURIComponent(sid)}`);
  const e = S.log.find((x) => x.sid === sid);
  if (!e) return;
  if (d.calories) e.cal = Math.round(d.calories);
  e.dev = d.device_name || e.dev || '';
  const iv = Array.isArray(d.icu_intervals) ? d.icu_intervals : [];
  e.splits = iv.filter((s) => s.distance > 200 && s.moving_time > 0)
    .map((s) => [Math.round(s.moving_time / (s.distance / 1000)), s.average_heartrate ? Math.round(s.average_heartrate) : 0, 0, Math.round(s.distance)]);
  e.hasDetail = true;
  persist();
}

// Erholungs-Signale aus Garmin (Schlaf, Ruhepuls, HRV), verglichen mit deinem eigenen Normalwert
function recoverySignals() {
  const days = Object.keys(S.wellness).sort();
  if (days.length < 5) return null;
  const T = iso(todayDate());
  const latestKey = days.filter((d) => d <= T).slice(-1)[0];
  if (!latestKey || daysBetween(parseISO(latestKey), todayDate()) > 1) return null;
  const last = S.wellness[latestKey];
  const base = days.filter((d) => d < latestKey).slice(-14).map((d) => S.wellness[d]);
  const avg = (k) => { const v = base.map((b) => b[k]).filter(Boolean); return v.length >= 4 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const out = { last, date: latestKey, flags: [] };
  const rhr = avg('rhr'), hrv = avg('hrv');
  if (last.rhr && rhr && last.rhr >= rhr + 5) out.flags.push(`Ruhepuls ${last.rhr} (sonst ca. ${Math.round(rhr)})`);
  if (last.hrv && hrv && last.hrv <= hrv * 0.8) out.flags.push(`HRV ${last.hrv} (sonst ca. ${Math.round(hrv)})`);
  if (last.sleep && last.sleep < 6) out.flags.push(`nur ${String(last.sleep).replace('.', ',')} h Schlaf`);
  return out;
}

function icuBoot() { autoSync(); }
function autoSync() {
  if (!wcfg() || syncing) return;
  if (Date.now() / 1000 - (S.settings.syncAt || 0) > 120) icuSync(false, true);
}
