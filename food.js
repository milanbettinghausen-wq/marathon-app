// Ernaehrung: Tagebuch, Suche, Barcode, eigene Lebensmittel und Gerichte, Kalorienbudget aus dem Training
const MEALS = ['Frühstück', 'Mittag', 'Abend', 'Snacks'];
const NUTS = ['k', 'p', 'c', 'f', 's', 'sf', 'fi', 'sa'];
const fui = { date: iso(todayDate()), meal: 'Frühstück', cur: null, recipe: null, mode: 'log', reader: null, stream: null };

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
const allFoods = () => [...S.foods, ...FOODS];
const foodById = (id) => allFoods().find((f) => f.id === id);
function defaultMeal() { const h = new Date().getHours(); return h < 10 ? 'Frühstück' : h < 15 ? 'Mittag' : h < 21 ? 'Abend' : 'Snacks'; }
const round1 = (x) => Math.round(x * 10) / 10;

function nutOf(food, g) {
  const f = g / 100, o = {};
  NUTS.forEach((k) => { o[k] = round1((food[k] || 0) * f); });
  return o;
}
const dayEntries = (d) => S.food.filter((e) => e.date === d);
function sumNut(list) {
  const o = {};
  NUTS.forEach((k) => { o[k] = list.reduce((a, e) => a + (e[k] || 0), 0); });
  return o;
}

// ---------- Ziele ----------
const MET = { Laufen: 9.8, Radfahren: 7, Schwimmen: 6, Fußball: 7.5, Gym: 4.5, Wandern: 5.3, Spazieren: 3.5, Yoga: 2.5, Pilates: 3, Tennis: 7, Rudern: 7, Crossfit: 8, HIIT: 8, Workout: 5 };
const bmr = (p) => 10 * p.kg + 6.25 * p.cm - 5 * p.age + (p.sex === 'f' ? -161 : 5);
function actKcal(e, p) {
  const h = e.min / 60;
  if (e.cal) return Math.max(0, e.cal - (bmr(p) / 24) * h);
  if (e.sport === 'Laufen' && e.km) return 0.95 * p.kg * e.km;
  return Math.max(0, ((MET[e.sport] || 5) - 1) * p.kg * h);
}
function dayTarget(d) {
  const p = S.settings.profile;
  if (!p || !p.kg) return null;
  const base = p.tdeeBase || bmr(p) * 1.2;
  const done = logsOn(d).reduce((a, e) => a + actKcal(e, p), 0);
  let planned = 0;
  if (d === iso(todayDate())) {
    const wp = weekSessions(iso(mondayOf(todayDate())));
    (wp.days[d] || []).filter((s) => !s.done && !s.hidden && !s.restDay && s.est).forEach((s) => {
      planned += ((MET[SPORT_NAME[s.t]] || 5) - 1) * p.kg * (s.est.min / 60);
    });
  }
  const adj = p.goal === 'lose' ? 0.85 : p.goal === 'gain' ? 1.1 : 1;
  const k = Math.round((base + done + planned) * adj);
  const prot = Math.round(1.8 * p.kg);
  const fat = Math.round(Math.max((0.25 * k) / 9, 0.8 * p.kg));
  const carb = Math.max(0, Math.round((k - prot * 4 - fat * 9) / 4));
  return { k, p: prot, f: fat, c: carb, base: Math.round(base * adj), act: Math.round(done), planned: Math.round(planned) };
}

// Gewichtstrend (gleitender Mittelwert) und aus Essen und Gewicht abgeleiteter Verbrauch
function weightTrend() {
  const w = [...S.body].sort((a, b) => a.date.localeCompare(b.date));
  let t = null;
  const series = w.map((x) => { t = t == null ? x.kg : t + 0.25 * (x.kg - t); return { date: x.date, kg: x.kg, trend: t }; });
  return series;
}
function observedTdee() {
  const ser = weightTrend();
  if (ser.length < 3) return null;
  const last = ser[ser.length - 1];
  const from = iso(addDays(parseISO(last.date), -28));
  const win = ser.filter((s) => s.date >= from);
  if (win.length < 3) return null;
  const span = daysBetween(parseISO(win[0].date), parseISO(last.date));
  if (span < 14) return null;
  const days = {};
  S.food.filter((e) => e.date >= win[0].date && e.date <= last.date).forEach((e) => { days[e.date] = (days[e.date] || 0) + e.k; });
  const vals = Object.values(days).filter((v) => v > 800);
  if (vals.length < 10) return null;
  const intake = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(intake - ((last.trend - win[0].trend) * 7700) / span);
}

// ---------- Ansicht ----------
function recentFoods(n = 8) {
  const seen = new Set(), out = [];
  [...S.food].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))).forEach((e) => {
    if (!e.ref || seen.has(e.ref) || out.length >= n) return;
    const f = foodById(e.ref);
    if (f) { seen.add(e.ref); out.push({ f, g: e.g }); }
  });
  return out;
}

function macroBar(label, v, t, color) {
  const pct = t ? clamp(v / t, 0, 1) * 100 : 0;
  return `<div class="mac"><div class="mac-h"><span>${label}</span><b>${Math.round(v)}${t ? ` / ${t}` : ''} g</b></div><div class="mac-b"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}

function viewFood() {
  const d = fui.date, T = iso(todayDate());
  const ents = dayEntries(d), tot = sumNut(ents), tg = dayTarget(d);
  const dd = parseISO(d);
  const left = tg ? tg.k - tot.k : null;
  const over = left != null && left < 0;
  const meals = MEALS.map((m) => {
    const list = ents.filter((e) => e.meal === m);
    const mk = list.reduce((a, e) => a + e.k, 0);
    return `<div class="card meal"><div class="meal-h"><div><b>${m}</b><small>${Math.round(mk)} kcal</small></div><button class="chip" data-act="f-add" data-meal="${m}">+ Hinzufügen</button></div>
      ${list.map((e) => `<button class="ent" data-act="f-edit" data-id="${e.id}"><span>${esc(e.name)}<small>${e.g ? `${r1(e.g)} g` : 'Schnell eingetragen'}</small></span><b>${Math.round(e.k)}</b></button>`).join('') || '<p class="muted" style="margin:6px 0 0">Noch nichts.</p>'}</div>`;
  }).join('');
  const rec = recentFoods();
  const sparkSer = weightTrend().slice(-10);
  const lastW = sparkSer[sparkSer.length - 1];
  const obs = observedTdee();
  const p = S.settings.profile;
  const satLimit = tg ? Math.round((0.1 * tg.k) / 9) : 22;
  const row = (label, v, lim, unit, below) => `<div class="drow"><span>${label}</span><div class="mac-b"><i style="width:${clamp(v / lim, 0, 1) * 100}%;background:${below ? (v >= lim ? 'var(--run)' : 'var(--bike)') : (v > lim ? 'var(--bad)' : 'var(--run)')}"></i></div><b>${r1(v)} ${unit}</b></div>`;
  return `${pageTop('Ernährung', d === T ? 'Heute' : fmtLong(dd))}
  <div class="weeknav"><button data-act="f-day" data-n="-1" aria-label="Vorheriger Tag">‹</button><span>${fmtLong(dd)}</span><button data-act="f-day" data-n="1" aria-label="Nächster Tag">›</button></div>
  ${!p || !p.kg ? '<div class="card nudge"><h2>Kalorienziel einrichten</h2><p>Mit Gewicht, Größe und Alter berechne ich dein Tagesbudget. Es wächst mit, wenn du trainierst.</p><button class="btn" data-act="f-profile">Angaben eintragen</button></div>' : ''}
  <div class="card kcalcard">
    ${ring(tg ? tot.k / tg.k : 0, over ? 'var(--bad)' : 'var(--ball)', `<strong>${tg ? Math.abs(Math.round(left)) : Math.round(tot.k)}</strong><small>${tg ? (over ? 'kcal drüber' : 'kcal übrig') : 'kcal gegessen'}</small>`, 150, 13)}
    <div class="kc-r">${macroBar('Eiweiß', tot.p, tg && tg.p, 'var(--swim)')}${macroBar('Kohlenh.', tot.c, tg && tg.c, 'var(--bike)')}${macroBar('Fett', tot.f, tg && tg.f, 'var(--gym)')}</div>
  </div>
  ${tg ? `<p class="muted tgline">Ziel ${tg.k} kcal = Grundumsatz plus Alltag ${tg.base}${tg.act ? `, Training ${tg.act}` : ''}${tg.planned ? `, geplantes Training ${tg.planned}` : ''}. Gegessen ${Math.round(tot.k)}.</p>` : ''}
  <div class="row wrap faddrow"><button class="btn" data-act="f-add" data-meal="${defaultMeal()}">+ Essen hinzufügen</button><button class="ghost" data-act="f-scan" data-meal="${defaultMeal()}">📷 Scannen</button></div>
  ${rec.length ? `<p class="eyebrow sp">Schnell wieder hinzufügen</p><div class="filters">${rec.map((r) => `<button class="chip" data-act="f-quick" data-ref="${r.f.id}" data-g="${r.g}">${esc(r.f.name)} · ${r1(r.g)} g</button>`).join('')}</div>` : ''}
  ${meals}
  <div class="card"><details><summary>Nährwerte im Detail</summary>
    ${row('Zucker', tot.s, 50, 'g', false)}${row('Gesättigte Fette', tot.sf, satLimit, 'g', false)}${row('Ballaststoffe', tot.fi, 30, 'g', true)}${row('Salz', tot.sa, 6, 'g', false)}
    <p class="muted">Richtwerte: höchstens 50 g Zucker, 10 % der Energie als gesättigtes Fett, 6 g Salz, mindestens 30 g Ballaststoffe. Vitamine und Mineralstoffe zeige ich nicht, dazu sind die Daten nicht verlässlich genug.</p></details></div>
  <div class="card"><h2>Gewicht</h2>
    ${lastW ? `<div class="wline"><b>${r1(lastW.trend)} kg</b><small>Trend · zuletzt ${r1(lastW.kg)} kg am ${fmtShort(parseISO(lastW.date))}</small>${spark(sparkSer.map((s) => s.trend), 'var(--ball)')}</div>` : '<p class="muted">Trag dein Gewicht ein, am besten morgens. Ich glätte Schwankungen zu einem Trend.</p>'}
    <form data-form="f-weight" class="coachform"><input name="kg" type="number" step="0.1" min="30" max="250" placeholder="kg" inputmode="decimal"><button class="btn sm">Eintragen</button></form>
    ${obs ? `<p class="muted">Aus deinem Essen und Gewichtsverlauf der letzten Wochen ergibt sich ein Verbrauch von etwa <b>${obs} kcal</b> pro Tag (ohne Training zusätzlich gerechnet ist das dein tatsächlicher Durchschnitt).</p>` : '<p class="muted">Nach etwa zwei Wochen mit Essen und Gewicht kann ich deinen echten Verbrauch ausrechnen.</p>'}
    <button class="link" data-act="f-profile">Angaben und Ziel ändern</button></div>`;
}

// ---------- Hinzufuegen ----------
function openAddSheet(meal) {
  fui.meal = meal || defaultMeal();
  fui.mode = 'log';
  openSheet(`${fui.meal} hinzufügen`, `<input id="fq" class="fsearch" placeholder="Lebensmittel suchen …" autocomplete="off" enterkeyhint="search">
    <div class="row wrap" style="margin-top:8px"><button class="ghost" data-act="f-scan" data-meal="${fui.meal}">📷 Scannen</button><button class="ghost" data-act="f-quickcal">Kalorien direkt</button></div>
    <div class="row wrap"><button class="ghost" data-act="f-custom">Eigenes Lebensmittel</button><button class="ghost" data-act="f-recipe">Gericht aus Zutaten</button></div>
    <div id="fres" class="fres"></div>`);
  fillResults('');
}

function foodRow(f, extra = '') {
  const sub = [f.brand, f.k != null ? `${Math.round(f.k)} kcal / 100 g` : ''].filter(Boolean).join(' · ');
  return `<button class="fr" data-act="f-pick" data-id="${esc(f.id)}"><span>${esc(f.name)}<small>${esc(sub)}</small></span>${S.fav[f.id] ? '<i>★</i>' : ''}${extra}</button>`;
}

function fillResults(q) {
  const box = $('#fres');
  if (!box) return;
  const n = norm(q.trim());
  if (!n) {
    const favs = allFoods().filter((f) => S.fav[f.id]);
    const rec = recentFoods(10).map((r) => r.f);
    box.innerHTML = `${favs.length ? `<p class="eyebrow sp">Favoriten</p>${favs.map((f) => foodRow(f)).join('')}` : ''}
      ${rec.length ? `<p class="eyebrow sp">Zuletzt gegessen</p>${rec.map((f) => foodRow(f)).join('')}` : '<p class="muted sp">Tippe oben einen Namen ein oder scanne ein Produkt.</p>'}`;
    return;
  }
  const toks = n.split(/\s+/);
  const hits = allFoods().filter((f) => { const nm = norm(f.name + ' ' + (f.brand || '')); return toks.every((t) => nm.includes(t)); })
    .sort((a, b) => (norm(a.name).startsWith(toks[0]) ? 0 : 1) - (norm(b.name).startsWith(toks[0]) ? 0 : 1) || a.name.length - b.name.length).slice(0, 30);
  box.innerHTML = `${hits.map((f) => foodRow(f)).join('') || '<p class="muted sp">Nichts in deiner Liste gefunden.</p>'}
    ${wcfg() ? `<button class="addrow" data-act="f-online" data-q="${esc(q)}">🌐 Auch in Open Food Facts suchen</button>` : '<p class="muted sp">Für die Online-Suche muss die Server-Verbindung eingerichtet sein (Einstellungen).</p>'}
    <div id="fonline"></div>`;
}

function offToFood(p, code) {
  const n = p.nutriments || {};
  let k = n['energy-kcal_100g'];
  if (k == null && n['energy-kj_100g'] != null) k = n['energy-kj_100g'] / 4.184;
  if (k == null && n['energy_100g'] != null) k = n['energy_100g'] / 4.184;
  if (k == null) return null;
  const brand = Array.isArray(p.brands) ? p.brands[0] : String(p.brands || '').split(',')[0].trim();
  const sq = +p.serving_quantity;
  return {
    id: 'o' + (code || p.code), name: p.product_name || 'Produkt ohne Namen', brand, code: code || p.code, src: 'off',
    k: Math.round(k), p: n.proteins_100g || 0, c: n.carbohydrates_100g || 0, f: n.fat_100g || 0, s: n.sugars_100g || 0,
    sf: n['saturated-fat_100g'] || 0, fi: n.fiber_100g || 0, sa: n.salt_100g != null ? n.salt_100g : (n.sodium_100g || 0) * 2.5,
    portions: sq > 0 ? [{ n: 'Portion', g: sq }] : [],
  };
}

async function onlineSearch(q) {
  const box = $('#fonline');
  if (!box) return;
  box.innerHTML = '<p class="muted sp">Suche …</p>';
  try {
    const d = await wf(`/off/search?q=${encodeURIComponent(q)}`);
    const foods = (d.hits || []).map((h) => offToFood(h, h.code)).filter(Boolean);
    foods.forEach((f) => { fui['o' + f.code] = f; });
    box.innerHTML = foods.map((f) => foodRow(f)).join('') || '<p class="muted sp">Dazu gibt es online nichts mit Nährwerten.</p>';
    fui.onlineFoods = foods;
  } catch (err) { box.innerHTML = `<p class="muted sp">Online-Suche nicht möglich: ${esc(err.message)}</p>`; }
}

function rememberFood(f) {
  if (f.src === 'off' && !S.foods.find((x) => x.id === f.id)) { S.foods.push(f); persist(); }
}

// Menge waehlen
function openAmount(food, entry) {
  fui.cur = { food, entry: entry || null };
  const last = recentFoods(50).find((r) => r.f.id === food.id);
  const g0 = entry ? entry.g : (last ? last.g : (food.portions[0] ? food.portions[0].g : 100));
  const meal = entry ? entry.meal : fui.meal;
  const portions = food.portions.map((p) => `<button type="button" class="chip" data-act="f-portion" data-g="${p.g}">${esc(p.n)} · ${p.g} g</button>`).join('');
  openSheet(food.name, `${food.brand ? `<p class="muted" style="margin-top:-8px">${esc(food.brand)}</p>` : ''}
    <form data-form="f-entry">
      <label>Menge in Gramm<input type="number" name="g" id="fg" value="${g0}" min="1" step="1" inputmode="decimal" required></label>
      ${portions ? `<div class="filters">${portions}<button type="button" class="chip" data-act="f-portion" data-g="100">100 g</button></div>` : ''}
      <div class="tiles" id="fprev"></div>
      <label>Mahlzeit<select name="meal">${MEALS.map((m) => `<option${m === meal ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
      <div class="row"><button type="button" class="ghost" data-act="f-fav" data-id="${esc(food.id)}">${S.fav[food.id] ? '★ Favorit' : '☆ Favorit'}</button>
        ${entry ? `<button type="button" class="ghost danger" data-act="f-del" data-id="${entry.id}">Löschen</button>` : ''}
        <button class="btn">${fui.mode === 'recipe' ? 'Zur Zutatenliste' : entry ? 'Speichern' : 'Hinzufügen'}</button></div>
    </form>`);
  updatePreview();
}
function updatePreview() {
  const el = $('#fprev'), g = +($('#fg') || {}).value || 0;
  if (!el || !fui.cur) return;
  const n = nutOf(fui.cur.food, g);
  el.innerHTML = `<div><b>${Math.round(n.k)}</b><small>kcal</small></div><div><b>${r1(n.p)}</b><small>Eiweiß g</small></div><div><b>${r1(n.c)}</b><small>Kohlenh. g</small></div><div><b>${r1(n.f)}</b><small>Fett g</small></div>`;
  el.style.gridTemplateColumns = 'repeat(4, 1fr)';
}

function saveEntry(food, g, meal, date, id) {
  const n = nutOf(food, g);
  const e = { id: id || uid(), date, meal, name: food.name + (food.brand && !food.name.includes(food.brand) ? ` (${food.brand})` : ''), g, ref: food.id, ...n };
  if (id) { const i = S.food.findIndex((x) => x.id === id); S.food[i] = { ...S.food[i], ...e }; } else S.food.push(e);
  rememberFood(food);
  persist();
}

// ---------- Barcode ----------
function loadZXing() {
  return new Promise((res, rej) => {
    if (window.ZXing) return res();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('Scanner konnte nicht geladen werden (Internet?)'));
    document.head.appendChild(s);
  });
}
function stopScan() {
  try { if (fui.reader) fui.reader.reset(); } catch { /* egal */ }
  fui.reader = null;
  const o = $('#scanview');
  if (o) o.remove();
}
async function startScan(meal) {
  fui.meal = meal || defaultMeal();
  fui.mode = 'log';
  closeSheet();
  stopScan();
  const o = document.createElement('div');
  o.id = 'scanview';
  o.innerHTML = `<video id="scanvid" playsinline muted></video><div class="scanframe"></div>
    <div class="scanbar"><p id="scanmsg">Halte den Strichcode ins Bild …</p>
    <form data-form="f-code" class="coachform"><input name="code" inputmode="numeric" placeholder="oder Nummer eintippen"><button class="btn sm">Suchen</button></form>
    <button class="ghost" data-act="f-scanstop">Abbrechen</button></div>`;
  document.body.appendChild(o);
  try {
    await loadZXing();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
    const reader = new ZXing.BrowserMultiFormatReader(hints);
    fui.reader = reader;
    reader.decodeFromVideoDevice(null, 'scanvid', (result) => {
      if (result) { const c = result.getText(); stopScan(); lookupCode(c); }
    }).catch((err) => { const m = $('#scanmsg'); if (m) m.textContent = `Kamera nicht verfügbar: ${err.message || err}. Du kannst die Nummer eintippen.`; });
  } catch (err) {
    const m = $('#scanmsg');
    if (m) m.textContent = `${err.message}. Du kannst die Nummer eintippen.`;
  }
}
async function lookupCode(code) {
  code = String(code).replace(/\D/g, '');
  if (!code) return;
  const known = S.foods.find((f) => f.code === code);
  if (known) { openAmount(known); return; }
  toast('Suche Produkt …');
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_quantity,quantity`);
    const d = await r.json();
    const f = d && d.status === 1 ? offToFood(d.product, code) : null;
    if (f) { openAmount(f); return; }
    toast('Produkt nicht gefunden oder ohne Nährwerte. Trag es einmal selbst ein.');
  } catch { toast('Keine Verbindung zu Open Food Facts'); }
  openCustom({ code });
}

// ---------- Eigene Lebensmittel und Gerichte ----------
function openCustom(pre = {}) {
  openSheet('Eigenes Lebensmittel', `<form data-form="f-custom"><input type="hidden" name="code" value="${esc(pre.code || '')}">
    <label>Name<input name="name" required value="${esc(pre.name || '')}"></label>
    <p class="muted" style="margin:0">Werte pro 100 g (steht auf der Verpackung):</p>
    <div class="grid2"><label>kcal<input name="k" type="number" step="any" required></label><label>Eiweiß g<input name="p" type="number" step="any" value="0"></label>
    <label>Kohlenhydrate g<input name="c" type="number" step="any" value="0"></label><label>Fett g<input name="f" type="number" step="any" value="0"></label>
    <label>davon Zucker g<input name="s" type="number" step="any" value="0"></label><label>ges. Fett g<input name="sf" type="number" step="any" value="0"></label>
    <label>Ballaststoffe g<input name="fi" type="number" step="any" value="0"></label><label>Salz g<input name="sa" type="number" step="any" value="0"></label>
    <label>Portion (Gramm)<input name="pg" type="number" step="any" placeholder="optional"></label><label>Portionsname<input name="pn" placeholder="z. B. 1 Scheibe"></label></div>
    <button class="btn full">Speichern und verwenden</button></form>`);
}
function openQuick() {
  openSheet('Kalorien direkt eintragen', `<form data-form="f-quick"><label>Name<input name="name" placeholder="z. B. Restaurant, Kuchen" required></label>
    <div class="grid2"><label>kcal<input name="k" type="number" required></label><label>Eiweiß g<input name="p" type="number" step="any" value="0"></label>
    <label>Kohlenhydrate g<input name="c" type="number" step="any" value="0"></label><label>Fett g<input name="f" type="number" step="any" value="0"></label></div>
    <label>Mahlzeit<select name="meal">${MEALS.map((m) => `<option${m === fui.meal ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
    <button class="btn full">Eintragen</button></form>`);
}

function openRecipe() {
  if (!fui.recipe) fui.recipe = { name: '', servings: 2, items: [] };
  const r = fui.recipe;
  const tot = r.items.reduce((a, it) => { const n = nutOf(it.food, it.g); NUTS.forEach((k) => { a[k] = (a[k] || 0) + n[k]; }); a.g = (a.g || 0) + it.g; return a; }, {});
  openSheet('Gericht aus Zutaten', `<form data-form="f-recipe"><label>Name des Gerichts<input name="name" value="${esc(r.name)}" placeholder="z. B. Hack-Wraps" required></label>
    <label>Anzahl Portionen<input name="servings" type="number" min="1" value="${r.servings}"></label>
    <p class="eyebrow sp">Zutaten</p>
    ${r.items.map((it, i) => `<div class="ing"><span>${esc(it.food.name)}<small>${r1(it.g)} g · ${Math.round(nutOf(it.food, it.g).k)} kcal</small></span><button type="button" class="x" data-act="f-ingdel" data-i="${i}">✕</button></div>`).join('') || '<p class="muted">Noch keine Zutat.</p>'}
    <button type="button" class="addrow" data-act="f-ingadd">+ Zutat hinzufügen</button>
    ${r.items.length ? `<p class="muted">Gesamt ${Math.round(tot.k)} kcal, pro Portion ${Math.round(tot.k / r.servings)} kcal (Eiweiß ${r1(tot.p / r.servings)} g).</p>` : ''}
    <button class="btn full"${r.items.length ? '' : ' disabled'}>Gericht speichern</button></form>`);
}

// ---------- Profil ----------
function openProfile() {
  const p = S.settings.profile || { kg: '', cm: '', age: '', sex: 'm', goal: 'hold' };
  const obs = observedTdee();
  openSheet('Deine Angaben', `<form data-form="f-profile"><div class="grid2"><label>Gewicht kg<input name="kg" type="number" step="0.1" value="${p.kg}" required></label>
    <label>Größe cm<input name="cm" type="number" value="${p.cm}" required></label><label>Alter<input name="age" type="number" value="${p.age}" required></label>
    <label>Geschlecht<select name="sex"><option value="m"${p.sex === 'm' ? ' selected' : ''}>männlich</option><option value="f"${p.sex === 'f' ? ' selected' : ''}>weiblich</option></select></label></div>
    <label>Ziel<select name="goal"><option value="hold"${p.goal === 'hold' ? ' selected' : ''}>Gewicht halten</option><option value="lose"${p.goal === 'lose' ? ' selected' : ''}>Abnehmen (15 % weniger)</option><option value="gain"${p.goal === 'gain' ? ' selected' : ''}>Aufbauen (10 % mehr)</option></select></label>
    ${obs ? `<label class="check-l"><input type="checkbox" name="useobs"${p.tdeeBase ? ' checked' : ''}> Meinen gemessenen Verbrauch (${obs} kcal) als Basis nehmen</label>` : ''}
    <p class="muted">Das Budget besteht aus Grundumsatz mal 1,2 (Alltag) plus deinem Training. Das sind Schätzwerte, kein Ersatz für Ernährungsberatung.</p>
    <button class="btn full">Speichern</button></form>`);
}

// ---------- Events ----------
function foodHandlers(D) {
  return {
    'f-day': () => { fui.date = iso(addDays(parseISO(fui.date), +D.n)); render(); },
    'f-add': () => openAddSheet(D.meal),
    'f-scan': () => startScan(D.meal),
    'f-scanstop': stopScan,
    'f-pick': () => {
      const f = foodById(D.id) || (fui.onlineFoods || []).find((x) => x.id === D.id);
      if (f) openAmount(f);
    },
    'f-quick': () => {
      const f = foodById(D.ref);
      if (!f) return;
      saveEntry(f, +D.g, defaultMeal(), fui.date);
      render(); toast(`${f.name} hinzugefügt`);
    },
    'f-portion': () => { const el = $('#fg'); if (el) { el.value = D.g; updatePreview(); } },
    'f-fav': () => {
      if (S.fav[D.id]) delete S.fav[D.id]; else S.fav[D.id] = 1;
      persist();
      const f = fui.cur && fui.cur.food;
      if (f) rememberFood(f);
      el_toggleFav(D.id);
    },
    'f-edit': () => {
      const e = S.food.find((x) => String(x.id) === D.id);
      if (!e) return;
      const f = e.ref && foodById(e.ref);
      if (f) openAmount(f, e);
      else openSheet(e.name, `<p class="muted">${Math.round(e.k)} kcal · ${r1(e.p)} g Eiweiß · ${r1(e.c)} g Kohlenhydrate · ${r1(e.f)} g Fett</p><div class="row"><button class="ghost danger" data-act="f-del" data-id="${e.id}">Löschen</button><button class="ghost" data-act="close">Schließen</button></div>`);
    },
    'f-del': () => { S.food = S.food.filter((x) => String(x.id) !== D.id); persist(); closeSheet(); render(); toast('Gelöscht'); },
    'f-online': () => onlineSearch(D.q),
    'f-quickcal': openQuick,
    'f-custom': () => openCustom(),
    'f-recipe': () => { fui.mode = 'recipe-edit'; openRecipe(); },
    'f-ingadd': () => {
      const form = document.querySelector('form[data-form="f-recipe"]');
      if (form && fui.recipe) { fui.recipe.name = form.name.value; fui.recipe.servings = Math.max(1, +form.servings.value || 1); }
      fui.mode = 'recipe';
      openAddSheet(fui.meal);
      fui.mode = 'recipe';
    },
    'f-ingdel': () => { fui.recipe.items.splice(+D.i, 1); openRecipe(); },
    'f-profile': openProfile,
  };
}
function el_toggleFav(id) {
  const b = document.querySelector(`[data-act="f-fav"][data-id="${CSS.escape(id)}"]`);
  if (b) b.textContent = S.fav[id] ? '★ Favorit' : '☆ Favorit';
}

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'fq') fillResults(ev.target.value);
  if (ev.target.id === 'fg') updatePreview();
});

document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-form^="f-"]');
  if (!f) return;
  ev.preventDefault();
  const fd = Object.fromEntries(new FormData(f));
  const kind = f.dataset.form;
  if (kind === 'f-entry') {
    const cur = fui.cur;
    if (!cur) return;
    const g = +fd.g;
    if (fui.mode === 'recipe') {
      fui.recipe.items.push({ food: cur.food, g });
      rememberFood(cur.food);
      fui.mode = 'recipe-edit';
      openRecipe();
      return;
    }
    saveEntry(cur.food, g, fd.meal, fui.date, cur.entry ? cur.entry.id : null);
    fui.meal = fd.meal;
    closeSheet(); render(); toast(cur.entry ? 'Gespeichert' : `${cur.food.name} hinzugefügt`);
  } else if (kind === 'f-quick') {
    S.food.push({ id: uid(), date: fui.date, meal: fd.meal, name: fd.name, g: 0, k: +fd.k, p: +fd.p || 0, c: +fd.c || 0, f: +fd.f || 0, s: 0, sf: 0, fi: 0, sa: 0 });
    persist(); closeSheet(); render(); toast('Eingetragen');
  } else if (kind === 'f-custom') {
    const food = {
      id: 'c' + uid(), name: fd.name.trim(), src: 'custom', code: fd.code || '', k: +fd.k, p: +fd.p || 0, c: +fd.c || 0, f: +fd.f || 0,
      s: +fd.s || 0, sf: +fd.sf || 0, fi: +fd.fi || 0, sa: +fd.sa || 0, portions: fd.pg ? [{ n: fd.pn || 'Portion', g: +fd.pg }] : [],
    };
    S.foods.push(food);
    persist();
    openAmount(food);
  } else if (kind === 'f-recipe') {
    const r = fui.recipe;
    r.name = fd.name.trim(); r.servings = Math.max(1, +fd.servings || 1);
    const tot = { g: 0 };
    NUTS.forEach((k) => { tot[k] = 0; });
    r.items.forEach((it) => { const n = nutOf(it.food, it.g); NUTS.forEach((k) => { tot[k] += n[k]; }); tot.g += it.g; });
    const per100 = (v) => round1((v / tot.g) * 100);
    const food = {
      id: 'r' + uid(), name: r.name, src: 'custom', k: Math.round((tot.k / tot.g) * 100), p: per100(tot.p), c: per100(tot.c), f: per100(tot.f),
      s: per100(tot.s), sf: per100(tot.sf), fi: per100(tot.fi), sa: per100(tot.sa),
      portions: [{ n: '1 Portion', g: Math.round(tot.g / r.servings) }, { n: 'Alles', g: Math.round(tot.g) }],
    };
    S.foods.push(food);
    fui.recipe = null; fui.mode = 'log';
    persist();
    openAmount(food);
  } else if (kind === 'f-profile') {
    const p = { kg: +fd.kg, cm: +fd.cm, age: +fd.age, sex: fd.sex, goal: fd.goal };
    const obs = observedTdee();
    if (fd.useobs && obs) p.tdeeBase = obs;
    S.settings.profile = p;
    persist(); closeSheet(); render(); toast('Gespeichert');
  } else if (kind === 'f-weight') {
    const kg = +fd.kg;
    if (!kg) return;
    const T = iso(todayDate());
    S.body = S.body.filter((x) => x.date !== T);
    S.body.push({ date: T, kg });
    persist(); render(); toast('Gewicht eingetragen');
  } else if (kind === 'f-code') {
    stopScan();
    lookupCode(fd.code);
  }
});
