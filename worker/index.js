// Marathon-Server (Cloudflare Worker, kostenlos).
// Er haelt den Intervals.icu-Schluessel und reicht Daten an die App weiter. Die App spricht nur mit ihm.
// Alle Endpunkte verlangen die Passphrase im Header X-App-Key.
// Quellen: Intervals.icu (Garmin-Daten) und Open Food Facts (Lebensmittel-Suche).

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...extra } });

function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function icu(env, path) {
  if (!env.ICU_API_KEY) throw Object.assign(new Error('Intervals.icu-Schlüssel fehlt im Server'), { status: 409 });
  const r = await fetch(`https://intervals.icu/api/v1${path}`, {
    headers: { Authorization: `Basic ${btoa(`API_KEY:${env.ICU_API_KEY}`)}`, Accept: 'application/json' },
  });
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Intervals.icu lehnt den Schlüssel ab'), { status: 401 });
  if (r.status === 429) throw Object.assign(new Error('Zu viele Anfragen, später erneut versuchen'), { status: 429 });
  if (!r.ok) throw Object.assign(new Error(`Intervals.icu-Fehler ${r.status}`), { status: 502 });
  return r.json();
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': env.APP_ORIGIN,
      'Access-Control-Allow-Headers': 'X-App-Key, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (!same(req.headers.get('X-App-Key'), env.APP_KEY)) return json({ error: 'Passphrase falsch' }, 401, cors);

      if (url.pathname === '/status') {
        if (!env.ICU_API_KEY) return json({ connected: false, reason: 'Schlüssel fehlt' }, 200, cors);
        const a = await icu(env, '/athlete/0');
        return json({ connected: true, athlete: { id: a.id, name: a.name || a.firstname || '' } }, 200, cors);
      }
      if (url.pathname === '/icu/activities' || url.pathname === '/icu/wellness') {
        const oldest = url.searchParams.get('oldest') || '';
        const newest = url.searchParams.get('newest') || '';
        if (!DATE.test(oldest) || !DATE.test(newest)) return json({ error: 'Datum fehlt' }, 400, cors);
        const kind = url.pathname === '/icu/wellness' ? 'wellness' : 'activities';
        return json(await icu(env, `/athlete/0/${kind}?oldest=${oldest}&newest=${newest}`), 200, cors);
      }
      const m = url.pathname.match(/^\/icu\/activity\/([A-Za-z0-9_-]+)$/);
      if (m) return json(await icu(env, `/activity/${m[1]}?intervals=true`), 200, cors);

      if (url.pathname === '/off/search') {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
        if (!q) return json({ hits: [] }, 200, cors);
        const r = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=20&langs=de&fields=code,product_name,brands,nutriments,serving_quantity,quantity`, {
          headers: { 'User-Agent': 'MarathonApp/1.0 (private use)' },
        });
        if (!r.ok) throw Object.assign(new Error('Open Food Facts gerade nicht erreichbar'), { status: 502 });
        return json(await r.json(), 200, cors);
      }
      return json({ error: 'Nicht gefunden' }, 404, cors);
    } catch (e) {
      return json({ error: e.message || 'Fehler' }, e.status || 500, cors);
    }
  },
};
