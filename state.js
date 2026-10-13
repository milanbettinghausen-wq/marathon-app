// Zustand und Speicher. Alles liegt nur auf dem Geraet (localStorage).
const KEYS = { settings: 'mar2.settings', log: 'mar2.log', ov: 'mar2.ov', checkin: 'mar2.checkin', gym: 'mar2.gym', notes: 'mar2.notes', wellness: 'mar2.wellness', food: 'mar2.food', foods: 'mar2.foods', fav: 'mar2.fav', body: 'mar2.body', water: 'mar2.water' };

const SPORTS = {
  run: { name: 'Laufen', icon: '🏃', color: 'var(--run)' },
  football: { name: 'Fußball', icon: '⚽', color: 'var(--ball)' },
  gym: { name: 'Gym', icon: '🏋️', color: 'var(--gym)' },
  swim: { name: 'Schwimmen', icon: '🏊', color: 'var(--swim)' },
  bike: { name: 'Radfahren', icon: '🚴', color: 'var(--bike)' },
  race: { name: 'Marathon', icon: '🏁', color: 'var(--gold)' },
};
const SPORT_NAME = { run: 'Laufen', football: 'Fußball', gym: 'Gym', swim: 'Schwimmen', bike: 'Radfahren', race: 'Laufen' };
const TYPE_OF_NAME = { Laufen: 'run', Fußball: 'football', Gym: 'gym', Schwimmen: 'swim', Radfahren: 'bike' };

// Alles andere, was Strava kennt, landet unter eigenem Namen
const OTHER_ICONS = {
  Spazieren: '🚶', Wandern: '🥾', Yoga: '🧘', Pilates: '🧘', Klettern: '🧗', Tennis: '🎾', Badminton: '🏸', Tischtennis: '🏓',
  Basketball: '🏀', Volleyball: '🏐', Rudern: '🚣', Kajak: '🚣', Ski: '⛷️', Snowboard: '🏂', Eislaufen: '⛸️', Crosstrainer: '🏃',
  Workout: '💪', Crossfit: '💪', HIIT: '🔥', Golf: '⛳', Surfen: '🏄', Skateboard: '🛹', Sonstiges: '🏅',
};
const SPORT_LIST = ['Laufen', 'Fußball', 'Gym', 'Radfahren', 'Schwimmen', ...Object.keys(OTHER_ICONS)];
function sportMeta(name) {
  const t = TYPE_OF_NAME[name];
  if (t) return SPORTS[t];
  return { name, icon: OTHER_ICONS[name] || '🏅', color: 'var(--other)' };
}

// Strava-Sportart (englisch, ohne Leerzeichen, klein) -> deutscher Name
const STRAVA_SPORT = {
  run: 'Laufen', trailrun: 'Laufen', virtualrun: 'Laufen',
  ride: 'Radfahren', gravelride: 'Radfahren', mountainbikeride: 'Radfahren', ebikeride: 'Radfahren', emountainbikeride: 'Radfahren', virtualride: 'Radfahren', handcycle: 'Radfahren', velomobile: 'Radfahren',
  swim: 'Schwimmen', soccer: 'Fußball', football: 'Fußball',
  weighttraining: 'Gym', workout: 'Workout', crossfit: 'Crossfit', highintensityintervaltraining: 'HIIT', hiit: 'HIIT',
  walk: 'Spazieren', hike: 'Wandern', yoga: 'Yoga', pilates: 'Pilates', rockclimbing: 'Klettern',
  tennis: 'Tennis', badminton: 'Badminton', tabletennis: 'Tischtennis', pickleball: 'Tennis', squash: 'Tennis', racquetball: 'Tennis',
  basketball: 'Basketball', volleyball: 'Volleyball', rowing: 'Rudern', virtualrow: 'Rudern', canoeing: 'Kajak', kayaking: 'Kajak',
  alpineski: 'Ski', backcountryski: 'Ski', nordicski: 'Ski', snowboard: 'Snowboard', snowshoe: 'Wandern', iceskate: 'Eislaufen', golf: 'Golf',
  surfing: 'Surfen', skateboard: 'Skateboard', elliptical: 'Crosstrainer', stairstepper: 'Workout',
};
function sportFromStrava(t) {
  const k = String(t || '').toLowerCase().replace(/[\s_-]/g, '');
  if (STRAVA_SPORT[k]) return STRAVA_SPORT[k];
  if (/lauf|jogg/.test(k)) return 'Laufen';
  if (/rad|bike/.test(k)) return 'Radfahren';
  if (/schwimm/.test(k)) return 'Schwimmen';
  if (/fu(ß|ss)ball/.test(k)) return 'Fußball';
  if (/kraft/.test(k)) return 'Gym';
  if (/spazier/.test(k)) return 'Spazieren';
  if (/wander/.test(k)) return 'Wandern';
  return 'Sonstiges';
}

const DEFAULT_SETTINGS = {
  mode: 'marathon',   // 'marathon' = Plan bis zum Rennen, 'maintain' = fit bleiben ohne Rennen
  race: '2027-04-25',
  goalSec: 4 * 3600,
  startKm: 20,        // Wochenkilometer, falls noch keine Laeufe eingetragen sind
  startLong: 10,      // laengster Lauf, falls noch keine Daten da sind
  peakKm: 55,
  maxLong: 32,
  maintainKm: 25,     // Wunsch-Wochenkilometer im Modus "fit bleiben"
  maxHR: 195,         // Maximalpuls, wird fuer die Anstrengung aus dem Puls gebraucht
  worker: { url: '', key: '' },
  profile: null,      // Gewicht, Groesse, Alter fuer das Kalorienziel
  syncAt: 0,
  lastExport: 0,      // wann zuletzt eine Sicherung exportiert wurde
  setup: {},          // erledigte Einrichtungsschritte
  week: [
    [{ t: 'football', n: 'Fußball-Training', min: 90, rpe: 6, fixed: 1 }],
    [{ t: 'gym', split: 'A' }, { t: 'run', role: 'easy' }],
    [{ t: 'football', n: 'Fußball-Training', min: 90, rpe: 6, fixed: 1 }],
    [{ t: 'gym', split: 'B' }],
    [{ t: 'run', role: 'quality' }],
    [{ t: 'football', n: 'Spiel', min: 90, rpe: 8, fixed: 1 }],
    [{ t: 'run', role: 'long' }],
  ],
  gymSplits: {
    A: { name: 'Schultern & Arme', ex: ['Schulterdrücken (Kurzhantel)', 'Seitheben', 'Face Pulls', 'Bizeps-Curls', 'Hammer-Curls', 'Trizepsdrücken (Kabel)', 'Overhead-Trizeps'] },
    B: { name: 'Brust & Rücken', ex: ['Bankdrücken', 'Schrägbankdrücken (Kurzhantel)', 'Fliegende (Kabel)', 'Latzug', 'Rudern vorgebeugt', 'Kabelrudern'] },
  },
};

const S = {
  settings: { ...DEFAULT_SETTINGS, ...store.get(KEYS.settings, {}) },
  log: store.get(KEYS.log, []),
  ov: { skip: {}, extra: {}, ...store.get(KEYS.ov, {}) },
  checkin: store.get(KEYS.checkin, {}),
  gym: store.get(KEYS.gym, []),
  notes: store.get(KEYS.notes, []),
  wellness: store.get(KEYS.wellness, {}),
  food: store.get(KEYS.food, []),
  foods: store.get(KEYS.foods, []),
  fav: store.get(KEYS.fav, {}),
  body: store.get(KEYS.body, []),
  water: store.get(KEYS.water, {}),
};
S.settings.worker = { ...DEFAULT_SETTINGS.worker, ...(S.settings.worker || {}) };

function persist() {
  const ok = [
    store.set(KEYS.settings, S.settings), store.set(KEYS.log, S.log), store.set(KEYS.ov, S.ov),
    store.set(KEYS.checkin, S.checkin), store.set(KEYS.gym, S.gym), store.set(KEYS.notes, S.notes), store.set(KEYS.wellness, S.wellness), store.set(KEYS.food, S.food), store.set(KEYS.foods, S.foods), store.set(KEYS.fav, S.fav), store.set(KEYS.body, S.body), store.set(KEYS.water, S.water),
  ].every(Boolean);
  if (!ok) toast('Speichern nicht möglich (privater Modus?)');
}

// Tag der ersten Nutzung: davor verpasste Einheiten zaehlen nicht
if (!S.settings.since) { S.settings.since = iso(todayDate()); persist(); }

// Dauerhaften Speicher anfragen, damit das System die Daten nicht aufraeumt
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* egal */ }
