// Kleine Helfer: Datum, Formatierung, Speicher
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayIdx = (d) => (d.getDay() + 6) % 7; // Mo = 0
const mondayOf = (d) => addDays(d, -dayIdx(d));
const daysBetween = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
const todayDate = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const fmtShort = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WDL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const fmtLong = (d) => `${WDL[dayIdx(d)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
const fmtPace = (sec) => { let m = Math.floor(sec / 60), s = Math.round(sec % 60); if (s === 60) { m++; s = 0; } return `${m}:${pad(s)}`; };
const fmtHMS = (sec) => `${Math.floor(sec / 3600)}:${pad(Math.floor((sec % 3600) / 60))}:${pad(Math.round(sec % 60))}`;
const parseHMS = (t) => { const p = String(t).split(':').map(Number); if (p.some(isNaN)) return NaN; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 3600 + p[1] * 60 : NaN; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r1 = (x) => Math.round(x * 10) / 10;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const store = {
  get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
