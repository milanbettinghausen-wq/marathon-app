// Strava-Archiv (activities.csv) einlesen. Erwartet englische Spaltenueberschriften.
function parseCSV(text) {
  const rows = [];
  let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const MON3 = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseStravaDate(s) {
  s = String(s).trim();
  let m = s.match(/([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?(AM|PM)?/i);
  if (m) {
    let h = +m[4];
    if (m[7]) { h = h % 12 + (m[7].toUpperCase() === 'PM' ? 12 : 0); }
    return iso(new Date(Date.UTC(+m[3], MON3[m[1].toLowerCase()], +m[2], h, +m[5], +(m[6] || 0))));
  }
  m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),? (\d{1,2}):(\d{2})/);
  if (m) return iso(new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5])));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return iso(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])));
  return null;
}
const num = (v) => { let s = String(v ?? '').trim(); if (!s) return NaN; if (!s.includes('.')) s = s.replace(',', '.'); return parseFloat(s); };
function secs(v) {
  const s = String(v ?? '').trim();
  if (s.includes(':')) { const t = parseHMS(s); return isNaN(t) ? NaN : t; }
  return num(s);
}
function sportOfStrava(t) {
  t = String(t).toLowerCase();
  if (/run|lauf|jogg/.test(t)) return 'Laufen';
  if (/ride|rad|bike|cycl/.test(t)) return 'Radfahren';
  if (/swim|schwimm/.test(t)) return 'Schwimmen';
  if (/soccer|football|fu(ß|ss)ball/.test(t)) return 'Fußball';
  if (/weight|kraft|workout|gym|crossfit|hiit/.test(t)) return 'Gym';
  return null;
}
const DEFAULT_RPE = { Laufen: 5, Radfahren: 4, Schwimmen: 5, Fußball: 7, Gym: 6 };

function importStrava(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) { toast('Die Datei ist leer'); return; }
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const all = (names) => head.map((h, i) => (names.includes(h) ? i : -1)).filter((i) => i >= 0);
  const iDate = all(['activity date', 'aktivitätsdatum', 'datum', 'date'])[0];
  const iType = all(['activity type', 'aktivitätstyp', 'typ', 'type'])[0];
  const iTime = all(['moving time', 'bewegungszeit']).concat(all(['elapsed time', 'verstrichene zeit']));
  const iDist = all(['distance', 'distanz']);
  if (iDate == null || iType == null || !iTime.length) {
    toast('Spalten nicht erkannt. Strava bitte auf Englisch stellen und neu exportieren.');
    return;
  }
  const have = new Set(S.log.map((e) => `${e.date}|${e.sport}|${e.min}`));
  let added = 0, dup = 0, ignored = 0;
  const fresh = [];
  rows.slice(1).forEach((r) => {
    const sport = sportOfStrava(r[iType]);
    const date = parseStravaDate(r[iDate]);
    if (!sport || !date) { ignored++; return; }
    let sec = NaN;
    for (const i of iTime) { const v = secs(r[i]); if (!isNaN(v) && v > 0) { sec = v; break; } }
    if (isNaN(sec)) { ignored++; return; }
    const min = Math.max(1, Math.round(sec / 60));
    const dv = iDist.map((i) => num(r[i])).filter((v) => !isNaN(v));
    let km = 0;
    if (dv.length) { const mx = Math.max(...dv); km = dv.length > 1 || mx > 300 ? mx / 1000 : mx; }
    if (sport === 'Laufen' && (km < 0.5 || km > 100)) { ignored++; return; }
    const key = `${date}|${sport}|${min}`;
    if (have.has(key)) { dup++; return; }
    have.add(key);
    fresh.push({ id: Date.now() + added, date, sport, min, km: sport === 'Laufen' || sport === 'Radfahren' || sport === 'Schwimmen' ? Math.round(km * 100) / 100 : 0, rpe: sport === 'Laufen' && km >= 18 ? 6 : DEFAULT_RPE[sport], src: 'strava' });
    added++;
  });
  if (!added) { toast(`Nichts Neues (${dup} schon vorhanden, ${ignored} ignoriert)`); return; }
  if (!confirm(`${added} Aktivitäten importieren? (${dup} schon vorhanden, ${ignored} nicht passende ignoriert, z. B. Spaziergänge)`)) return;
  S.log.push(...fresh);
  persist(); refresh();
  toast(`${added} Aktivitäten importiert. Plan neu berechnet.`);
}
