// Lokaler Test des Servers mit Attrappen fuer Intervals.icu und Open Food Facts (kein Netz, keine Zugangsdaten)
import worker from './index.js';

const env = { APP_KEY: 'geheim', APP_ORIGIN: 'https://x.github.io', ICU_API_KEY: 'k123' };
const calls = [];
globalThis.fetch = async (u, o) => {
  u = String(u);
  calls.push({ u, auth: o && o.headers && o.headers.Authorization });
  if (u.includes('intervals.icu/api/v1/athlete/0/activities')) return new Response(JSON.stringify([{ id: 'i1', type: 'Run' }]));
  if (u.includes('intervals.icu/api/v1/athlete/0/wellness')) return new Response(JSON.stringify([{ id: '2026-10-09', restingHR: 52 }]));
  if (u.includes('intervals.icu/api/v1/athlete/0')) return new Response(JSON.stringify({ id: 'i77', name: 'Milan' }));
  if (u.includes('intervals.icu/api/v1/activity/')) return new Response(JSON.stringify({ id: 'i1', calories: 600 }));
  if (u.includes('search.openfoodfacts.org')) return new Response(JSON.stringify({ hits: [{ code: '1' }] }));
  return new Response('{}', { status: 404 });
};
const call = (path, key = 'geheim', e = env) => worker.fetch(new Request('https://w.workers.dev' + path, { headers: { 'X-App-Key': key } }), e);
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

let r = await call('/status', 'falsch');
ok(r.status === 401, 'falsche Passphrase wird abgelehnt');
r = await call('/status');
ok((await r.json()).athlete.name === 'Milan', 'Status zeigt den Namen');
ok(calls[0].auth === 'Basic ' + Buffer.from('API_KEY:k123').toString('base64'), 'Basic-Auth mit API_KEY');
r = await call('/icu/activities?oldest=2026-01-01&newest=2026-10-09');
ok((await r.json())[0].id === 'i1', 'Aktivitaeten werden durchgereicht');
r = await call('/icu/wellness?oldest=2026-01-01&newest=2026-10-09');
ok((await r.json())[0].restingHR === 52, 'Wellness wird durchgereicht');
r = await call('/icu/activities?oldest=morgen&newest=2026-10-09');
ok(r.status === 400, 'Ungueltiges Datum wird abgelehnt');
r = await call('/icu/activity/i1');
ok((await r.json()).calories === 600, 'Aktivitaets-Detail');
r = await call('/icu/activity/../../x');
ok(r.status === 404, 'Pfad-Tricks werden abgewiesen');
r = await call('/off/search?q=hafer');
ok((await r.json()).hits.length === 1, 'Lebensmittel-Suche');
r = await call('/icu/activities?oldest=2026-01-01&newest=2026-10-09', 'geheim', { ...env, ICU_API_KEY: '' });
ok(r.status === 409, 'Ohne Schluessel klare Fehlermeldung');
