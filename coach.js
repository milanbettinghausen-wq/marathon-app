// Schreib-Coach: versteht einfache deutsche Saetze ("Knie zwickt, mach langsamer") und passt den Plan an.
// Regelbasiert und komplett auf dem Handy, ohne KI-Dienst und ohne Kosten.

const AREAS = [
  ['knie', 'Knie', 'low'], ['schienbein', 'Schienbein', 'low'], ['achilles', 'Achillessehne', 'low'], ['wade', 'Wade', 'low'],
  ['fuß|fuss|ferse|sohle|plantar', 'Fuß', 'low'], ['hüfte|huefte', 'Hüfte', 'low'], ['oberschenkel', 'Oberschenkel', 'low'],
  ['leiste', 'Leiste', 'low'], ['knöchel|knoechel|sprunggelenk', 'Knöchel', 'low'], ['waden', 'Wade', 'low'],
  ['rücken|ruecken', 'Rücken', 'back'], ['schulter', 'Schulter', 'up'], ['ellbogen|ellenbogen', 'Ellbogen', 'up'],
  ['handgelenk', 'Handgelenk', 'up'], ['nacken', 'Nacken', 'up'],
];
const NUMWORDS = { ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, zehn: 10 };

function parseDays(t, def) {
  t = t.replace(/\b(ein|eine|einen|zwei|drei|vier|fünf|fuenf|sechs|sieben|zehn)\b/g, (w) => NUMWORDS[w]);
  let m = t.match(/(\d+)\s*(tag|tage|tagen)/);
  if (m) return +m[1];
  m = t.match(/(\d+)\s*(woche|wochen)/);
  if (m) return 7 * +m[1];
  if (/ein paar tage|paar tage|wenige tage/.test(t)) return 3;
  if (/nur heute|heute nur|für heute|fuer heute/.test(t)) return 1;
  if (/wochenende/.test(t)) return 3;
  return def;
}

// Liefert { notes: [...], clear: bool, bullets: [...] }
function parseCoach(raw) {
  const t = String(raw).toLowerCase();
  const today = todayDate();
  const mk = (label, days, eff) => ({ id: uid(), text: raw.trim(), label, from: iso(today), until: iso(addDays(today, Math.max(1, days) - 1)), ...eff });
  const out = { notes: [], clear: false, bullets: [] };

  if (/wieder fit|bin gesund|schmerzfrei|geht wieder|alles gut|ist besser|zwickt nicht mehr|beschwerdefrei/.test(t)) {
    out.clear = true; out.bullets.push('Alle aktiven Hinweise werden beendet. Der Plan läuft wieder normal.');
    return out;
  }

  const sev = /kann nicht|nicht laufen|unerträglich|geschwollen|sehr stark|extrem|humpel/.test(t) ? 'severe'
    : /schmerz|probleme|tut weh|verletz|stechen/.test(t) ? 'mod'
      : /leicht|bisschen|etwas|zwickt|ziept|spannt|merke/.test(t) ? 'mild' : 'mod';
  const sevText = { mild: 'leicht', mod: 'mittel', severe: 'stark' }[sev];

  let hit = false;
  for (const [re, name, kind] of AREAS) {
    if (!new RegExp(re).test(t)) continue;
    if (out.notes.some((n) => n.area === name)) continue;
    hit = true;
    const days = parseDays(t, sev === 'severe' ? 7 : 7);
    if (kind === 'low') {
      const eff = sev === 'severe' ? { kmF: 0 } : sev === 'mild' ? { kmF: 0.8, noQ: true, paceAdd: 15 } : { kmF: 0.6, noQ: true, paceAdd: 25 };
      out.notes.push(mk(name, days, { area: name, kind: 'injury', ballWarn: 'Fußball nur, wenn es schmerzfrei geht.', ...eff }));
      out.bullets.push(`${name} (${sevText}), ${days} Tage: ${sev === 'severe' ? 'kein Lauf, stattdessen Rad oder Schwimmen, wenn schmerzfrei' : `Läufe ${sev === 'mild' ? '20' : '40'} Prozent kürzer, kein Tempo, ${sev === 'mild' ? '15' : '25'} Sekunden pro km langsamer`}.`);
    } else if (kind === 'back') {
      out.notes.push(mk(name, days, { area: name, kind: 'injury', kmF: 0.8, noQ: true, paceAdd: 10, gymWarn: 'Rücken: keine schweren Gewichte, Technik vor Gewicht.' }));
      out.bullets.push(`${name}, ${days} Tage: Läufe etwas kürzer ohne Tempo, im Gym ohne schwere Gewichte.`);
    } else {
      out.notes.push(mk(name, days, { area: name, kind: 'injury', gymWarn: `${name}: Übungen mit Schmerz und über Kopf auslassen.` }));
      out.bullets.push(`${name}, ${days} Tage: Laufen bleibt wie geplant, im Gym Übungen mit Schmerz auslassen.`);
    }
  }

  if (/krank|erkältet|erkaeltet|grippe|fieber|halsschmerz|magen|durchfall/.test(t)) {
    const days = parseDays(t, 4);
    out.notes.push(mk('krank', days, { kind: 'sick', kmF: 0, ballWarn: 'Lieber aussetzen.', gymWarn: 'Lieber frei.' }));
    out.bullets.push(`Krank, ${days} Tage: kein Training. Danach langsam wieder einsteigen.`);
    hit = true;
  }
  if (/müde|muede|schlapp|erschöpft|erschoepft|schlecht geschlafen|kaputt/.test(t) && !out.notes.some((n) => n.kind === 'sick')) {
    const days = parseDays(t, 2);
    out.notes.push(mk('müde', days, { kind: 'tired', kmF: 0.8, noQ: true, paceAdd: 10 }));
    out.bullets.push(`Müde, ${days} Tage: Läufe 20 Prozent kürzer, kein Tempo.`);
    hit = true;
  }
  if (/urlaub|verreist|reise|keine zeit|viel stress|klausur|prüfung|pruefung|stress/.test(t)) {
    const days = parseDays(t, 7);
    out.notes.push(mk('wenig Zeit', days, { kind: 'busy', kmF: 0.7 }));
    out.bullets.push(`Wenig Zeit, ${days} Tage: Läufe 30 Prozent kürzer, die Woche bleibt trotzdem sinnvoll.`);
    hit = true;
  }
  if (/langsamer|gemütlich|gemuetlich|ruhiger|runter schalten|runterschalten/.test(t) && !out.notes.some((n) => n.paceAdd)) {
    const days = parseDays(t, 7);
    out.notes.push(mk('langsamer', days, { kind: 'slow', paceAdd: 20 }));
    out.bullets.push(`Langsamer, ${days} Tage: alle Läufe 20 Sekunden pro km gemütlicher.`);
    hit = true;
  }
  if (!hit) {
    out.notes.push(mk(raw.trim().slice(0, 24), 7, { kind: 'plain' }));
    out.bullets.push('Das habe ich als Notiz gespeichert, der Plan ändert sich dadurch nicht. Mit Wörtern wie Knie, krank, müde, Urlaub oder langsamer kann ich ihn anpassen.');
  }
  return out;
}
