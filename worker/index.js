// Marathon-Strava-Server (Cloudflare Worker, kostenlos).
// Er haelt das Strava-Client-Secret und die Zugangs-Tokens. Die App spricht nur mit ihm, nie direkt mit Strava.
// Alle Endpunkte ausser /auth/callback verlangen die Passphrase im Header X-App-Key.

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...extra } });

function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function tokenCall(env, params) {
  const body = new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...params });
  const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error('Strava hat den Zugang abgelehnt');
  return d;
}

async function accessToken(env) {
  const raw = await env.KV.get('tokens');
  if (!raw) throw Object.assign(new Error('Strava ist noch nicht verbunden'), { status: 409 });
  let t = JSON.parse(raw);
  if (t.exp - 120 < Date.now() / 1000) {
    const d = await tokenCall(env, { grant_type: 'refresh_token', refresh_token: t.refresh });
    t = { ...t, access: d.access_token, refresh: d.refresh_token, exp: d.expires_at };
    await env.KV.put('tokens', JSON.stringify(t));
  }
  return t.access;
}

async function stravaGet(env, path) {
  const token = await accessToken(env);
  const r = await fetch(`https://www.strava.com/api/v3${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 429) throw Object.assign(new Error('Strava-Limit erreicht, später erneut versuchen'), { status: 429 });
  if (r.status === 401) throw Object.assign(new Error('Zugang abgelaufen, bitte Strava neu verbinden'), { status: 401 });
  if (!r.ok) throw Object.assign(new Error(`Strava-Fehler ${r.status}`), { status: 502 });
  return r.json();
}

async function callback(url, env) {
  const back = (s) => Response.redirect(`${env.APP_URL}?strava=${s}`, 302);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const scope = url.searchParams.get('scope') || '';
  if (!state || !(await env.KV.get(`state:${state}`))) {
    return new Response('Ungültiger oder abgelaufener Vorgang. Bitte in der App erneut auf Verbinden tippen.', { status: 400 });
  }
  await env.KV.delete(`state:${state}`);
  if (url.searchParams.get('error') || !code || !scope.includes('activity:read')) return back('denied');
  const d = await tokenCall(env, { code, grant_type: 'authorization_code' });
  await env.KV.put('tokens', JSON.stringify({
    access: d.access_token, refresh: d.refresh_token, exp: d.expires_at,
    athlete: { id: d.athlete && d.athlete.id, name: d.athlete && d.athlete.firstname },
  }));
  return back('connected');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': env.APP_ORIGIN,
      'Access-Control-Allow-Headers': 'X-App-Key, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/auth/callback' && req.method === 'GET') return await callback(url, env);
      if (!same(req.headers.get('X-App-Key'), env.APP_KEY)) return json({ error: 'Passphrase falsch' }, 401, cors);

      if (url.pathname === '/auth/start' && req.method === 'POST') {
        const state = crypto.randomUUID();
        await env.KV.put(`state:${state}`, '1', { expirationTtl: 600 });
        const q = new URLSearchParams({
          client_id: env.STRAVA_CLIENT_ID, response_type: 'code', approval_prompt: 'auto',
          redirect_uri: `${url.origin}/auth/callback`, scope: 'read,activity:read_all', state,
        });
        return json({ url: `https://www.strava.com/oauth/authorize?${q}` }, 200, cors);
      }
      if (url.pathname === '/strava/status') {
        const raw = await env.KV.get('tokens');
        return json({ connected: !!raw, athlete: raw ? JSON.parse(raw).athlete : null }, 200, cors);
      }
      if (url.pathname === '/strava/activities') {
        const after = parseInt(url.searchParams.get('after') || '0', 10) || 0;
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
        return json(await stravaGet(env, `/athlete/activities?after=${after}&page=${page}&per_page=100`), 200, cors);
      }
      const m = url.pathname.match(/^\/strava\/activity\/(\d+)$/);
      if (m) return json(await stravaGet(env, `/activities/${m[1]}`), 200, cors);
      if (url.pathname === '/strava/disconnect' && req.method === 'POST') {
        await env.KV.delete('tokens');
        return json({ ok: true }, 200, cors);
      }
      return json({ error: 'Nicht gefunden' }, 404, cors);
    } catch (e) {
      return json({ error: e.message || 'Fehler' }, e.status || 500, cors);
    }
  },
};
