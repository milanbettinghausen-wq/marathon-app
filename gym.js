// Gym: Logger, Statistik, Rekorde
let G = null;
let gymTick = null;

const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);
const tonnage = (g) => g.ex.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);
const fmtKg = (x) => (x >= 1000 ? `${r1(x / 1000)} t` : `${Math.round(x)} kg`);

function lastGym(split) {
  return [...S.gym].filter((g) => g.split === split).sort((a, b) => b.date.localeCompare(a.date) || (b.id || 0) - (a.id || 0))[0];
}
// Bester geschaetzter Max-Wert je Uebung und Datum
function exerciseHistory() {
  const h = {};
  [...S.gym].sort((a, b) => a.date.localeCompare(b.date)).forEach((g) => {
    g.ex.forEach((e) => {
      const best = Math.max(0, ...e.sets.map((s) => e1rm(s.w, s.r)));
      const top = e.sets.reduce((a, s) => (s.w > a.w ? s : a), { w: 0, r: 0 });
      if (best > 0) (h[e.name] = h[e.name] || []).push({ date: g.date, e1: best, top });
    });
  });
  return h;
}
function gymWeeks(n = 8) {
  const thisMon = mondayOf(todayDate());
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const mon = addDays(thisMon, -7 * k), a = iso(mon), b = iso(addDays(mon, 6));
    const gs = S.gym.filter((g) => g.date >= a && g.date <= b);
    out.push({ label: fmtShort(mon).replace(/\.\d+\.$/, '.'), v: gs.reduce((s, g) => s + tonnage(g), 0) / 1000, n: gs.length, cur: k === 0 });
  }
  return out;
}
function nextGym() {
  const t = todayDate();
  for (let i = 0; i < 14; i++) {
    const d = addDays(t, i), di = iso(d);
    const wp = weekSessions(iso(mondayOf(d)));
    const s = (wp.days[di] || []).find((x) => x.t === 'gym' && !x.done);
    if (s) return { date: di, s, d };
  }
  return null;
}

function startGym(date, split) {
  const sp = S.settings.gymSplits[split];
  if (!sp || !sp.ex.length) { toast('Lege erst Übungen für den Split fest'); return; }
  const prev = lastGym(split);
  G = {
    date, split, start: Date.now(), restEnd: 0,
    ex: sp.ex.map((name) => makeEx(name, prev)),
  };
  renderGym();
  clearInterval(gymTick);
  gymTick = setInterval(tickGym, 1000);
}
function makeEx(name, prevSession) {
  let p = prevSession && prevSession.ex.find((x) => x.name === name);
  if (!p) { // zuletzt irgendwo gemachte Werte nehmen
    const last = [...S.gym].sort((a, b) => b.date.localeCompare(a.date)).find((g) => g.ex.some((x) => x.name === name));
    p = last && last.ex.find((x) => x.name === name);
  }
  const sets = p && p.sets.length ? p.sets.map((s) => ({ w: s.w, r: s.r, done: false })) : [0, 1, 2].map(() => ({ w: '', r: '', done: false }));
  let tip = '';
  if (p && p.sets.length) {
    const top = Math.max(...p.sets.map((s) => s.w));
    tip = p.sets.every((s) => s.r >= 12) ? `Alle Sätze geschafft: probiere ${top + 2.5} kg` : 'Ziel: 8 bis 12 Wiederholungen, bei 12 steigern';
  }
  return { name, sets, last: p ? p.sets : null, tip };
}

function renderGym() {
  const el = $('#gymview');
  if (!G) { el.classList.remove('open'); el.innerHTML = ''; return; }
  const sp = S.settings.gymSplits[G.split] || { name: 'Freies Training' };
  el.innerHTML = `<div class="gtop"><button class="chip" data-act="gclose">✕</button><div><b>${esc(sp.name)}</b><small id="gtime">0:00</small></div><button class="btn sm" data-act="gfinish">Beenden</button></div>
  <div class="gbody">${G.ex.map((e, ei) => `<div class="card gex"><h2>${esc(e.name)}</h2>
    ${e.last ? `<p class="muted">Letztes Mal: ${e.last.map((s) => `${s.w}×${s.r}`).join(' · ')}</p>` : '<p class="muted">Noch keine Vorwerte</p>'}
    ${e.tip ? `<p class="tip">${esc(e.tip)}</p>` : ''}
    <div class="sets">${e.sets.map((s, si) => `<div class="set${s.done ? ' done' : ''}"><span>${si + 1}</span>
      <input inputmode="decimal" placeholder="kg" value="${s.w}" data-gw="${ei}.${si}.w"><input inputmode="numeric" placeholder="Wdh" value="${s.r}" data-gw="${ei}.${si}.r">
      <button data-act="gtoggle" data-e="${ei}" data-s="${si}" class="tick">${s.done ? '✓' : '○'}</button></div>`).join('')}</div>
    <button class="addrow" data-act="gaddset" data-e="${ei}">+ Satz</button></div>`).join('')}
    <button class="addrow" data-act="gaddex">+ Übung hinzufügen</button></div>
  <div class="grest" id="grest"></div>`;
  el.classList.add('open');
  tickGym();
}

function tickGym() {
  if (!G) return;
  const t = $('#gtime');
  if (t) { const s = Math.floor((Date.now() - G.start) / 1000); t.textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`; }
  const r = $('#grest');
  if (r) {
    const left = Math.ceil((G.restEnd - Date.now()) / 1000);
    r.classList.toggle('on', left > 0);
    r.textContent = left > 0 ? `Pause ${Math.floor(left / 60)}:${pad(left % 60)}` : '';
  }
}

function startGymFree(date) {
  G = { date, split: 'F', start: Date.now(), restEnd: 0, ex: [] };
  renderGym();
  clearInterval(gymTick);
  gymTick = setInterval(tickGym, 1000);
  openExercisePicker();
}

// Uebungsbibliothek: nach Muskelgruppe waehlen oder suchen
let exGroup = 'Alle';
function exerciseListHTML(q) {
  const n = norm(q || '');
  const used = new Set(G ? G.ex.map((e) => e.name) : []);
  const known = [...new Set(S.gym.flatMap((g) => g.ex.map((e) => e.name)))];
  let list = EXERCISES.slice();
  known.forEach((k) => { if (!list.find((x) => x.name === k)) list.push({ name: k, group: 'Eigene' }); });
  if (exGroup !== 'Alle') list = list.filter((x) => x.group === exGroup);
  if (n) list = list.filter((x) => norm(x.name).includes(n));
  return list.slice(0, 60).map((x) => `<button class="fr" data-act="gpick" data-name="${esc(x.name)}"><span>${esc(x.name)}<small>${esc(x.group)}</small></span>${used.has(x.name) ? '<i>✓</i>' : ''}</button>`).join('') || '<p class="muted">Nichts gefunden. Tippe den Namen oben ein und wähle „Eigene Übung".</p>';
}
function openExercisePicker() {
  const groups = ['Alle', ...new Set(EXERCISES.map((x) => x.group))];
  openSheet('Übung auswählen', `<input id="exq" class="fsearch" placeholder="Übung suchen oder eigenen Namen tippen …" autocomplete="off">
    <div class="exgroups">${groups.map((g) => `<button class="chip${g === exGroup ? ' on' : ''}" data-act="gexgroup" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>
    <div class="exlist" id="exlist">${exerciseListHTML('')}</div>
    <button class="addrow" data-act="gexown">+ Eigene Übung mit diesem Namen</button>`);
}

function gymHandlers(D) {
  return {
    gclose: () => { if (confirm('Training abbrechen? Eingaben gehen verloren.')) { G = null; clearInterval(gymTick); renderGym(); } },
    gaddset: () => { const e = G.ex[D.e]; const l = e.sets[e.sets.length - 1]; e.sets.push({ w: l ? l.w : '', r: l ? l.r : '', done: false }); renderGym(); },
    gtoggle: () => {
      const s = G.ex[D.e].sets[D.s];
      s.done = !s.done;
      if (s.done) G.restEnd = Date.now() + 90000;
      renderGym();
    },
    gaddex: () => openExercisePicker(),
    gfree: () => startGymFree(D.date || iso(todayDate())),
    gexgroup: () => {
      exGroup = D.g;
      $$('.exgroups .chip').forEach((b) => b.classList.toggle('on', b.dataset.g === exGroup));
      $('#exlist').innerHTML = exerciseListHTML(($('#exq') || {}).value);
    },
    gpick: () => {
      if (!G) return;
      if (!G.ex.find((e) => e.name === D.name)) G.ex.push(makeEx(D.name, null));
      renderGym();
      const b = document.querySelector(`#exlist [data-name="${CSS.escape(D.name)}"]`);
      if (b && !b.querySelector('i')) b.insertAdjacentHTML('beforeend', '<i>✓</i>');
      toast(`${D.name} hinzugefügt`);
    },
    gexown: () => {
      const v = ($('#exq') || {}).value || '';
      const name = v.trim();
      if (!name) { toast('Tippe oben erst einen Namen ein'); return; }
      if (G && !G.ex.find((e) => e.name === name)) G.ex.push(makeEx(name, null));
      renderGym(); closeSheet();
    },
    gfinish: () => {
      const done = G.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
      if (!done && !confirm('Kein Satz abgehakt. Trotzdem beenden?')) return;
      const vol = G.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).reduce((b, s) => b + (+s.w || 0) * (+s.r || 0), 0), 0);
      openSheet('Training beenden', `<p class="muted">${done} Sätze · ${fmtKg(vol)} Gesamtvolumen · ${Math.max(1, Math.round((Date.now() - G.start) / 60000))} min</p>
        <form data-form="gymfinish"><label>Wie anstrengend war es? <output id="rpeout">6</output>/10<input type="range" name="rpe" min="1" max="10" value="6" oninput="document.getElementById('rpeout').textContent=this.value"></label>
        <button class="btn full">Speichern</button></form>`);
    },
    gsession: () => {
      const g = S.gym.find((x) => String(x.id) === D.id);
      if (!g) return;
      openSheet(`${S.settings.gymSplits[g.split] ? S.settings.gymSplits[g.split].name : 'Gym'} · ${fmtShort(parseISO(g.date))}`,
        `<p class="muted">${g.min} min · ${fmtKg(tonnage(g))}</p>${g.ex.map((e) => `<div class="gline"><b>${esc(e.name)}</b><span>${e.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}</span></div>`).join('')}
        <div class="row"><button class="ghost danger" data-act="gdel" data-id="${g.id}">Löschen</button><button class="ghost" data-act="close">Schließen</button></div>`);
    },
    gdel: () => {
      if (!confirm('Dieses Gym-Training löschen?')) return;
      S.gym = S.gym.filter((x) => String(x.id) !== D.id);
      persist(); closeSheet(); refresh();
    },
    gnext: () => startGym(D.date, D.split),
  };
}

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'exq') { const l = $('#exlist'); if (l) l.innerHTML = exerciseListHTML(ev.target.value); return; }
  const k = ev.target.dataset && ev.target.dataset.gw;
  if (!k || !G) return;
  const [ei, si, f] = k.split('.');
  G.ex[ei].sets[si][f] = ev.target.value.replace(',', '.');
});

document.addEventListener('submit', (ev) => {
  const add = ev.target.closest('form[data-form="gymadd"]');
  if (add && G) {
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(add));
    const name = fd.name.trim();
    if (!name) return;
    G.ex.push(makeEx(name, null));
    if (fd.keep) { const sp = S.settings.gymSplits[G.split]; if (!sp.ex.includes(name)) { sp.ex.push(name); persist(); } }
    closeSheet(); renderGym();
    return;
  }
  const f = ev.target.closest('form[data-form="gymfinish"]');
  if (!f || !G) return;
  ev.preventDefault();
  const rpe = +new FormData(f).get('rpe');
  const min = Math.max(1, Math.round((Date.now() - G.start) / 60000));
  const ex = G.ex.map((e) => ({ name: e.name, sets: e.sets.filter((s) => s.done || (s.w && s.r)).map((s) => ({ w: +s.w || 0, r: +s.r || 0 })) })).filter((e) => e.sets.length);
  // Rekorde: bester geschaetzter Max-Wert vor und nach diesem Training
  const before = exerciseHistory();
  const prs = [];
  ex.forEach((e) => {
    const now = Math.max(0, ...e.sets.map((s) => e1rm(s.w, s.r)));
    const old = Math.max(0, ...(before[e.name] || []).map((x) => x.e1));
    if (old > 0 && now > old + 0.5) prs.push(e.name);
  });
  S.gym.push({ id: Date.now(), date: G.date, split: G.split, ex, min });
  S.log.push({ id: Date.now() + 1, date: G.date, sport: 'Gym', min, km: 0, rpe, rpeManual: 1 });
  G = null; clearInterval(gymTick);
  persist(); closeSheet(); renderGym(); refresh();
  toast(prs.length ? `Neuer Rekord: ${prs.slice(0, 2).join(', ')} 🎉` : 'Gym gespeichert. Beim nächsten Mal siehst du deine Werte.');
});
