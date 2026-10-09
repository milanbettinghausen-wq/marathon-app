// Lokaler Test des Servers mit Attrappen fuer Strava und KV (kein Netz, keine Zugangsdaten)
import worker from './index.js';

const kvStore = new Map();
const env = {
  APP_KEY: 'geheim', APP_ORIGIN: 'https://x.github.io', APP_URL: 'https://x.github.io/app/',
  STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 's',
  KV: { get: async (k) => kvStore.get(k) ?? null, put: async (k, v) => { kvStore.set(k, v); }, delete: async (k) => { kvStore.delete(k); } },
};
const calls = [];
globalThis.fetch = async (u, o) => {
  calls.push(String(u));
  if (String(u).includes('/oauth/token')) {
    const refresh = o.body.get('grant_type') === 'refresh_token';
    return new Response(JSON.stringify({
      access_token: refresh ? 'A2' : 'A1', refresh_token: 'R1',
      expires_at: refresh ? Date.now() / 1000 + 21600 : Date.now() / 1000 - 10, athlete: { id: 7, firstname: 'Milan' },
    }));
  }
  if (String(u).includes('/athlete/activities')) return new Response(JSON.stringify([{ id: 1, name: 'Lauf', sport_type: 'Run' }]));
  return new Response('{}', { status: 404 });
};
const call = (path, opts = {}, key = 'geheim') => worker.fetch(new Request('https://w.workers.dev' + path, { ...opts, headers: { 'X-App-Key': key, ...(opts.headers || {}) } }), env);
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

let r = await call('/strava/status', {}, 'falsch');
ok(r.status === 401, 'falsche Passphrase wird abgelehnt');
r = await call('/auth/start', { method: 'POST' });
const { url } = await r.json();
const state = new URL(url).searchParams.get('state');
ok(new URL(url).searchParams.get('scope') === 'read,activity:read_all', 'Autorisierungs-Link mit Scope');
ok(new URL(url).searchParams.get('redirect_uri') === 'https://w.workers.dev/auth/callback', 'Redirect auf den Worker');
r = await worker.fetch(new Request('https://w.workers.dev/auth/callback?code=c&state=boese&scope=read,activity:read_all'), env);
ok(r.status === 400, 'Fremder state wird abgelehnt');
r = await worker.fetch(new Request(`https://w.workers.dev/auth/callback?code=c&state=${state}&scope=read`), env);
ok(r.headers.get('location').endsWith('?strava=denied'), 'Fehlender Scope wird abgelehnt');
r = await call('/auth/start', { method: 'POST' });
const s2 = new URL((await r.json()).url).searchParams.get('state');
r = await worker.fetch(new Request(`https://w.workers.dev/auth/callback?code=c&state=${s2}&scope=read,activity:read_all`), env);
ok(r.headers.get('location') === 'https://x.github.io/app/?strava=connected', 'Verbinden klappt');
r = await call('/strava/activities?after=0&page=1');
const d = await r.json();
ok(Array.isArray(d) && d[0].id === 1, 'Aktivitaeten werden durchgereicht');
ok(calls.some((c) => c.includes('oauth/token')) && kvStore.get('tokens').includes('A2'), 'Abgelaufener Token wurde erneuert');
r = await call('/strava/activity/abc');
ok(r.status === 404, 'Nur numerische Aktivitaets-IDs');
await call('/strava/disconnect', { method: 'POST' });
r = await call('/strava/activities');
ok(r.status === 409, 'Nach dem Trennen kein Zugriff');
