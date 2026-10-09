// Strava-Anbindung ueber deinen eigenen kleinen Server (Cloudflare Worker, siehe /worker).
// Das Client-Secret liegt nur dort, nie in der App oder im Repository.
let syncing = false;

function wcfg() {
  const w = S.settings.worker;
  return w && w.url && w.key ? w : null;
}
async function wf(path, opts = {}) {
  const w = wcfg();
  if (!w) throw new Error('Strava ist noch nicht eingerichtet');
  const res = await fetch(w.url.trim().replace(/\/+$/, '') + path, { ...opts, headers: { 'X-App-Key': w.key.trim(), ...(opts.headers || {}) } });
  let data = null;
  try { data = await res.json(); } catch { /* leer */ }
  if (!res.ok) throw new Error((data && data.error) || `Fehler ${res.status}`);
  return data;
}

function mapActivity(a) {
  const st = a.sport_type || a.type;
  const sport = sportFromStrava(st);
  const hr = a.average_heartrate ? Math.round(a.average_heartrate) : 0;
  const local = a.start_date_local || a.start_date || '';
  return {
    id: a.id, sid: a.id, src: 'strava', st,
    date: local.slice(0, 10), time: local.slice(11, 16),
    sport, name: a.name || sport,
    min: Math.max(1, Math.round((a.moving_time || a.elapsed_time || 0) / 60)),
    km: Math.round(((a.distance || 0) / 1000) * 100) / 100,
    rpe: hr ? rpeFromHR(hr) : (DEFAULT_RPE[sport] || 4),
    hr, maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : 0,
    elev: Math.round(a.total_elevation_gain || 0),
    cad: a.average_cadence ? Math.round(a.average_cadence * (sport === 'Laufen' ? 2 : 1)) : 0,
    speed: a.average_speed || 0,
  };
}

async function stravaSync(full = false, quiet = false) {
  if (!wcfg() || syncing) return;
  syncing = true;
  updateSyncUI('läuft …');
  try {
    const after = full || !S.settings.syncAt ? 0 : S.settings.syncAt - 3 * 86400;
    let page = 1;
    const all = [];
    for (;;) {
      const arr = await wf(`/strava/activities?after=${after}&page=${page}`);
      if (!Array.isArray(arr) || !arr.length) break;
      all.push(...arr);
      if (arr.length < 100 || page >= 40) break;
      page++;
    }
    let added = 0, updated = 0;
    all.forEach((a) => {
      const e = mapActivity(a);
      if (!e.date) return;
      let cur = S.log.find((x) => x.sid === a.id);
      if (!cur) {
        // Gleiche Einheit schon per CSV oder von Hand eingetragen? Dann zusammenfuehren
        cur = S.log.find((x) => !x.sid && x.date === e.date && x.sport === e.sport && (e.sport === 'Gym' || Math.abs(x.min - e.min) <= 3));
      }
      if (cur) {
        const keepRpe = cur.rpeManual ? cur.rpe : e.rpe;
        Object.assign(cur, e, { id: cur.id, rpe: keepRpe });
        updated++;
      } else { S.log.push(e); added++; }
    });
    S.settings.syncAt = Math.floor(Date.now() / 1000);
    persist(); refresh();
    if (!quiet || added) toast(added || updated ? `Strava: ${added} neu, ${updated} aktualisiert` : 'Strava: alles aktuell');
  } catch (err) {
    toast(`Strava: ${err.message}`);
  } finally {
    syncing = false;
    updateSyncUI();
  }
}

function syncLabel() {
  if (!wcfg()) return 'Strava verbinden';
  if (syncing) return 'läuft …';
  const t = S.settings.syncAt;
  if (!t) return 'noch nicht synchronisiert';
  const m = Math.round((Date.now() / 1000 - t) / 60);
  return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} min` : m < 1440 ? `vor ${Math.round(m / 60)} h` : `vor ${Math.round(m / 1440)} Tagen`;
}
function updateSyncUI(txt) {
  $$('.syncstate').forEach((el) => { el.textContent = txt || syncLabel(); });
}

async function stravaConnect() {
  try {
    const d = await wf('/auth/start', { method: 'POST' });
    location.href = d.url;
  } catch (err) { toast(`Strava: ${err.message}`); }
}

// Detail-Daten (Kilometer-Zeiten, Kalorien) bei Bedarf nachladen
async function stravaDetail(sid) {
  const d = await wf(`/strava/activity/${sid}`);
  const e = S.log.find((x) => x.sid === sid);
  if (!e) return;
  e.cal = Math.round(d.calories || 0);
  e.dev = d.device_name || '';
  e.desc = d.description || '';
  e.splits = (d.splits_metric || []).map((s) => [s.distance ? Math.round(s.moving_time / (s.distance / 1000)) : 0, s.average_heartrate ? Math.round(s.average_heartrate) : 0, Math.round(s.elevation_difference || 0), Math.round(s.distance || 0)]);
  e.hasDetail = true;
  persist();
}

// Rueckkehr von Strava (nach der Freigabe) und automatischer Abgleich
function stravaBoot() {
  const p = new URLSearchParams(location.search);
  if (p.get('strava')) {
    const ok = p.get('strava') === 'connected';
    history.replaceState(null, '', location.pathname);
    if (ok) { toast('Strava verbunden. Lade deine Aktivitäten …'); stravaSync(true); } else toast('Strava-Verbindung nicht zustande gekommen');
    return;
  }
  autoSync();
}
function autoSync() {
  if (!wcfg() || syncing) return;
  if (Date.now() / 1000 - (S.settings.syncAt || 0) > 120) stravaSync(false, true);
}
