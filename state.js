// Zustand und Speicher. Alles liegt nur auf dem Geraet (localStorage).
const KEYS = { settings: 'mar2.settings', log: 'mar2.log', ov: 'mar2.ov', checkin: 'mar2.checkin', gym: 'mar2.gym' };

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

const DEFAULT_SETTINGS = {
  race: '2027-04-25',
  goalSec: 4 * 3600,
  startKm: 20,      // Wochenkilometer, falls noch keine Laeufe eingetragen sind
  startLong: 10,    // laengster Lauf, falls noch keine Daten da sind
  peakKm: 55,
  maxLong: 32,
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
    A: { name: 'Schultern, Arme, Brust', ex: ['Bankdrücken', 'Schrägbankdrücken (Kurzhantel)', 'Schulterdrücken', 'Seitheben', 'Trizepsdrücken (Kabel)', 'Bizeps-Curls'] },
    B: { name: 'Rücken', ex: ['Latzug', 'Rudern vorgebeugt', 'Kabelrudern', 'Face Pulls', 'Rückenstrecker'] },
  },
};

const S = {
  settings: { ...DEFAULT_SETTINGS, ...store.get(KEYS.settings, {}) },
  log: store.get(KEYS.log, []),
  ov: { skip: {}, extra: {}, ...store.get(KEYS.ov, {}) },
  checkin: store.get(KEYS.checkin, {}),
  gym: store.get(KEYS.gym, []),
};

function persist() {
  const ok = [
    store.set(KEYS.settings, S.settings), store.set(KEYS.log, S.log), store.set(KEYS.ov, S.ov),
    store.set(KEYS.checkin, S.checkin), store.set(KEYS.gym, S.gym),
  ].every(Boolean);
  if (!ok) toast('Speichern nicht möglich (privater Modus?)');
}

// Tag der ersten Nutzung: davor verpasste Einheiten zaehlen nicht
if (!S.settings.since) { S.settings.since = iso(todayDate()); persist(); }
