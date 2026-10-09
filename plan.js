// Trainingsplan-Generator: 28 Wochen, 4 Laufeinheiten pro Woche plus Alternativsport.
// Alle Zahlen sind Faustwerte fuer ein Ziel um 4:00 h, kein medizinischer Rat.

const PACES = {
  easy: '6:30 bis 7:00',
  mp: '5:41',
  tempo: '5:15 bis 5:25',
  interval: '4:50 bis 5:00',
};

const QUALITY = [
  (km) => ({ title: 'Intervalle', detail: `${km} km gesamt: 2 km Einlaufen, 5 x 1000 m in ${PACES.interval} min/km, 400 m Trabpause, Auslaufen` }),
  (km) => ({ title: 'Tempodauerlauf', detail: `${km} km gesamt: 2 km Einlaufen, ${Math.max(3, km - 4)} km in ${PACES.tempo} min/km, 2 km Auslaufen` }),
  (km) => ({ title: 'Fahrtspiel', detail: `${km} km locker mit 6 x 2 min flotter (${PACES.tempo}), 2 min Trab dazwischen` }),
  (km) => ({ title: 'Marathonpace-Block', detail: `${km} km gesamt: 2 km Einlaufen, ${Math.max(4, km - 4)} km in ${PACES.mp} min/km, 2 km Auslaufen` }),
];

function buildPlan(startISO, startKm, peakKm) {
  const weeks = 28;
  const plan = [];
  for (let i = 0; i < weeks; i++) {
    const build = i <= 24;
    let vol;
    if (build) {
      vol = startKm + (peakKm - startKm) * (i / 24);
      if (i % 4 === 3) vol *= 0.75; // Entlastungswoche
    } else {
      vol = peakKm * [0.7, 0.55, 0.35][i - 25]; // Tapering
    }
    vol = Math.round(vol);
    const race = i === 27;
    const phase = i < 8 ? 'Grundlage' : i < 20 ? 'Aufbau' : i < 25 ? 'Spezifisch' : 'Tapering';
    const days = new Array(7);
    const cut = build && i % 4 === 3;

    if (race) {
      days[0] = { type: 'cross', title: 'Gym locker oder frei', detail: 'Nur leichte Mobilisation, keine Beine.' };
      days[1] = { type: 'run', km: 6, title: 'Lockerer Lauf', detail: `6 km locker (${PACES.easy} min/km)` };
      days[2] = { type: 'rest', title: 'Ruhe', detail: 'Viel Kohlenhydrate, viel trinken.' };
      days[3] = { type: 'run', km: 5, title: 'Lauf mit Steigerungen', detail: `5 km locker plus 4 x 80 m Steigerung` };
      days[4] = { type: 'rest', title: 'Ruhe', detail: 'Startunterlagen, Beine hochlegen.' };
      days[5] = { type: 'run', km: 3, title: 'Shakeout', detail: '3 km ganz locker.' };
      days[6] = { type: 'race', km: 42.2, title: 'Haspa Marathon Hamburg', detail: `Ziel 4:00 h, Pace ${PACES.mp} min/km. Die ersten 10 km eher zu langsam als zu schnell.` };
    } else {
      // Langer Lauf waechst jede Woche um 1 km bis 32 km (Woche 21), in Entlastungswochen 70 Prozent
      let long = Math.min(32, 12 + i);
      if (cut) long = Math.round(long * 0.7);
      if (i >= 25) long = i === 25 ? 18 : 12;
      const rest = Math.max(10, vol - long);
      const tue = Math.round(rest * 0.33);
      const thu = Math.round(rest * 0.4);
      const sat = Math.max(3, rest - tue - thu);
      const q = QUALITY[i % QUALITY.length](thu);
      days[0] = { type: 'cross', title: 'Gym', detail: 'Kraft: Beine, Rumpf, Rücken, 40 bis 50 min. In Entlastungs- und Taperwochen kürzer.' };
      days[1] = { type: 'run', km: tue, title: 'Lockerer Lauf', detail: `${tue} km locker (${PACES.easy} min/km)` };
      days[2] = { type: 'cross', title: 'Schwimmen oder Rad', detail: '30 bis 45 min locker, schont die Gelenke.' };
      days[3] = { type: 'run', km: thu, title: q.title, detail: q.detail };
      days[4] = { type: 'rest', title: 'Ruhe oder Fußball', detail: 'Fußball nur locker, vor dem Wochenende nicht auspowern.' };
      days[5] = { type: 'run', km: sat, title: 'Lockerer Lauf', detail: `${sat} km sehr locker (${PACES.easy} min/km)` };
      days[6] = { type: 'run', km: long, title: 'Langer Lauf', detail: `${long} km ruhig (${PACES.easy} min/km)${i >= 12 && !cut && i < 25 ? ', die letzten 3 bis 5 km in Marathonpace' : ''}` };
    }

    const plannedKm = days.reduce((s, d) => s + (d.type === 'run' || d.type === 'race' ? d.km : 0), 0);
    plan.push({ week: i + 1, phase, cut, plannedKm: Math.round(plannedKm), days });
  }
  return plan;
}
