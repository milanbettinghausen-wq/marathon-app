// Gym-Logger: Saetze eintragen, Vorwerte sehen, Pausentimer, Steigerungs-Vorschlag
let G = null;
let gymTick = null;

function lastGym(split) {
  return [...S.gym].filter((g) => g.split === split).sort((a, b) => b.date.localeCompare(a.date))[0];
}

function startGym(date, split) {
  const sp = S.settings.gymSplits[split];
  if (!sp || !sp.ex.length) { toast('Lege unter „Mehr" erst Übungen für den Split fest'); return; }
  const prev = lastGym(split);
  G = {
    date, split, start: Date.now(), restEnd: 0,
    ex: sp.ex.map((name) => {
      const p = prev && prev.ex.find((x) => x.name === name);
      const sets = p && p.sets.length ? p.sets.map((s) => ({ w: s.w, r: s.r, done: false })) : [0, 1, 2].map(() => ({ w: '', r: '', done: false }));
      let tip = '';
      if (p && p.sets.length) {
        const top = Math.max(...p.sets.map((s) => s.w));
        tip = p.sets.every((s) => s.r >= 12) ? `Alle Sätze geschafft: probiere ${top + 2.5} kg` : 'Ziel: 8 bis 12 Wiederholungen, bei 12 steigern';
      }
      return { name, sets, last: p ? p.sets : null, tip };
    }),
  };
  renderGym();
  clearInterval(gymTick);
  gymTick = setInterval(tickGym, 1000);
}

function renderGym() {
  const el = $('#gymview');
  if (!G) { el.classList.remove('open'); el.innerHTML = ''; return; }
  const sp = S.settings.gymSplits[G.split];
  el.innerHTML = `<div class="gtop"><button class="chip" data-act="gclose">✕</button><div><b>${esc(sp.name)}</b><small id="gtime">0:00</small></div><button class="btn sm" data-act="gfinish">Beenden</button></div>
  <div class="gbody">${G.ex.map((e, ei) => `<div class="card gex"><h2>${esc(e.name)}</h2>
    ${e.last ? `<p class="muted">Letztes Mal: ${e.last.map((s) => `${s.w}×${s.r}`).join(' · ')}</p>` : '<p class="muted">Noch keine Vorwerte</p>'}
    ${e.tip ? `<p class="tip">${esc(e.tip)}</p>` : ''}
    <div class="sets">${e.sets.map((s, si) => `<div class="set${s.done ? ' done' : ''}"><span>${si + 1}</span>
      <input inputmode="decimal" placeholder="kg" value="${s.w}" data-gw="${ei}.${si}.w"><input inputmode="numeric" placeholder="Wdh" value="${s.r}" data-gw="${ei}.${si}.r">
      <button data-act="gtoggle" data-e="${ei}" data-s="${si}" class="tick">${s.done ? '✓' : '○'}</button></div>`).join('')}</div>
    <button class="addrow" data-act="gaddset" data-e="${ei}">+ Satz</button></div>`).join('')}</div>
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
    gfinish: () => {
      const done = G.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
      if (!done && !confirm('Kein Satz abgehakt. Trotzdem beenden?')) return;
      const vol = G.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).reduce((b, s) => b + (+s.w || 0) * (+s.r || 0), 0), 0);
      openSheet('Training beenden', `<p class="muted">${done} Sätze · ${Math.round(vol)} kg Gesamtvolumen · ${Math.max(1, Math.round((Date.now() - G.start) / 60000))} min</p>
        <form data-form="gymfinish"><label>Wie anstrengend war es? <output id="rpeout">6</output>/10<input type="range" name="rpe" min="1" max="10" value="6" oninput="document.getElementById('rpeout').textContent=this.value"></label>
        <button class="btn full">Speichern</button></form>`);
    },
  };
}

document.addEventListener('input', (ev) => {
  const k = ev.target.dataset && ev.target.dataset.gw;
  if (!k || !G) return;
  const [ei, si, f] = k.split('.');
  G.ex[ei].sets[si][f] = ev.target.value.replace(',', '.');
});

document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-form="gymfinish"]');
  if (!f || !G) return;
  ev.preventDefault();
  const rpe = +new FormData(f).get('rpe');
  const min = Math.max(1, Math.round((Date.now() - G.start) / 60000));
  const ex = G.ex.map((e) => ({ name: e.name, sets: e.sets.filter((s) => s.done || (s.w && s.r)).map((s) => ({ w: +s.w || 0, r: +s.r || 0 })) })).filter((e) => e.sets.length);
  S.gym.push({ date: G.date, split: G.split, ex, min });
  S.log.push({ id: Date.now(), date: G.date, sport: 'Gym', min, km: 0, rpe });
  G = null; clearInterval(gymTick);
  persist(); closeSheet(); renderGym(); refresh();
  toast('Gym gespeichert. Beim nächsten Mal siehst du deine Werte.');
});
