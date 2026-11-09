import { SUPABASE_URL, SUPABASE_ANON_KEY, PARTNER_NAAM } from './config.js';

const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const $ = (sel) => document.querySelector(sel);

// ---------- Opslag: Supabase, of localStorage in demo-modus ----------

function createLocalStore() {
  const KEY = 'auto-investeringen-demo';
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { cars: [], cash_movements: [] }; }
    catch { return { cars: [], cash_movements: [] }; }
  };
  const save = (data) => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };
  return {
    async list(table) { return load()[table]; },
    async insert(table, row) {
      const data = load();
      data[table].push({ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() });
      save(data);
    },
    async update(table, id, row) {
      const data = load();
      data[table] = data[table].map((r) => (r.id === id ? { ...r, ...row } : r));
      save(data);
    },
    async remove(table, id) {
      const data = load();
      data[table] = data[table].filter((r) => r.id !== id);
      save(data);
    },
  };
}

function createSupabaseStore(client) {
  const check = ({ data, error }) => { if (error) throw error; return data; };
  return {
    async list(table) { return check(await client.from(table).select('*')); },
    async insert(table, row) { check(await client.from(table).insert(row)); },
    async update(table, id, row) { check(await client.from(table).update(row).eq('id', id)); },
    async remove(table, id) { check(await client.from(table).delete().eq('id', id)); },
  };
}

let store;
let supabase;
let state = { cars: [], cash: [] };

// ---------- Hulpfuncties ----------

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const euroExact = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const fmt = (n) => (Math.round(n * 100) % 100 === 0 ? euro : euroExact).format(n);
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => Number(v) || 0;
const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
const costBasis = (c) => num(c.aankoopprijs) + num(c.kosten);
const has = (v) => v !== null && v !== undefined && v !== '';
const isSold = (c) => has(c.verkoopdatum);
const isSettled = (c) => isSold(c) && has(c.winst_deel); // afgerekend: inleg + winst is terug
const signClass = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
const signed = (n) => `${n > 0 ? '+' : ''}${fmt(n)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function carLabel(c) {
  const meta = [c.bouwjaar, c.inruil && !/^geen$/i.test(c.inruil) ? `inruil: ${c.inruil}` : null, c.notities].filter(Boolean);
  return `<div class="car-name">${esc(c.merk)} ${esc(c.model)}${c.kenteken ? `<span class="plate">${esc(c.kenteken.toUpperCase())}</span>` : ''}</div>`
    + (meta.length ? `<div class="car-meta">${meta.map(esc).join(' · ')}</div>` : '');
}

// ---------- Berekeningen ----------

function totals() {
  const stock = state.cars.filter((c) => !isSold(c));
  const sold = state.cars.filter(isSold);
  const settled = sold.filter(isSettled);
  const pending = sold.filter((c) => !isSettled(c));
  const deposits = state.cash.filter((m) => m.soort === 'storting').reduce((s, m) => s + num(m.bedrag), 0);
  const withdrawals = state.cash.filter((m) => m.soort === 'opname').reduce((s, m) => s + num(m.bedrag), 0);
  const spent = state.cars.reduce((s, c) => s + costBasis(c), 0);
  const returned = settled.reduce((s, c) => s + costBasis(c) + num(c.winst_deel), 0);
  const profit = settled.reduce((s, c) => s + num(c.winst_deel), 0);
  const cash = deposits - withdrawals - spent + returned;
  // Auto's die nog niet afgerekend zijn tellen mee tegen het bedrag waarvoor ze gekocht zijn.
  const stockValue = [...stock, ...pending].reduce((s, c) => s + costBasis(c), 0);
  return { stock, sold, settled, pending, deposits, withdrawals, netInvested: deposits - withdrawals, cash, stockValue, profit, total: cash + stockValue };
}

// ---------- Weergave ----------

function render() {
  const t = totals();

  $('#kpi-total').textContent = fmt(t.total);
  $('#kpi-total-sub').textContent = `gestort ${fmt(t.netInvested)} + winst ${fmt(t.profit)}`;
  $('#kpi-cash').textContent = fmt(t.cash);
  $('#kpi-cash').className = 'kpi-value' + (t.cash < -0.005 ? ' neg' : '');
  $('#kpi-cash-sub').textContent = t.cash < -0.005 ? 'tekort: er is meer uitgegeven dan gestort' : 'nog niet in een auto';
  $('#kpi-stock').textContent = fmt(t.stockValue);
  $('#kpi-stock-sub').textContent = plural(t.stock.length, 'auto', "auto's") + ' te koop'
    + (t.pending.length ? ` · ${t.pending.length} wacht op afrekening` : '');
  $('#kpi-profit').textContent = fmt(t.profit);
  $('#kpi-profit').className = 'kpi-value ' + signClass(t.profit);
  const roi = t.netInvested > 0 ? ` · ${((t.profit / t.netInvested) * 100).toFixed(1).replace('.', ',')}% op inleg` : '';
  $('#kpi-profit-sub').textContent = plural(t.settled.length, 'auto', "auto's") + ' afgerekend' + roi;

  $('#split-cash').style.flexGrow = Math.max(0, t.cash);
  $('#split-stock').style.flexGrow = Math.max(0, t.stockValue);

  // Voorraad
  const stock = [...t.stock].sort((a, b) => (a.aankoopdatum < b.aankoopdatum ? 1 : -1));
  $('#stock-body').innerHTML = stock.map((c) => `
    <tr>
      <td>${carLabel(c)}</td>
      <td>${fmtDate(c.aankoopdatum)}</td>
      <td class="num">${fmt(num(c.aankoopprijs))}</td>
      <td class="num">${num(c.kosten) ? fmt(num(c.kosten)) : '–'}</td>
      <td class="num"><strong>${fmt(costBasis(c))}</strong></td>
      <td class="num">${daysBetween(c.aankoopdatum, today())}</td>
      <td class="actions-cell">
        <button class="btn small primary" data-sell="${c.id}">Verkocht</button>
        <button class="btn small ghost" data-edit="${c.id}">Bewerk</button>
      </td>
    </tr>`).join('');
  $('#stock-empty').hidden = stock.length > 0;
  $('#count-stock').textContent = stock.length;

  // Verkocht (nog te bepalen bovenaan)
  const sold = [...t.sold].sort((a, b) => (isSettled(a) - isSettled(b)) || (a.verkoopdatum < b.verkoopdatum ? 1 : -1));
  $('#sold-body').innerHTML = sold.map((c) => {
    const settled = isSettled(c);
    const p = num(c.winst_deel);
    return `
    <tr>
      <td>${carLabel(c)}</td>
      <td>${fmtDate(c.aankoopdatum)}</td>
      <td>${fmtDate(c.verkoopdatum)}</td>
      <td class="num">${fmt(costBasis(c))}</td>
      <td class="num ${settled ? signClass(p) : 'muted'}">${settled ? `<strong>${signed(p)}</strong>` : 'nog te bepalen'}</td>
      <td class="num">${settled ? fmt(costBasis(c) + p) : '–'}</td>
      <td class="num">${daysBetween(c.aankoopdatum, c.verkoopdatum)}</td>
      <td class="actions-cell">
        ${settled ? '' : `<button class="btn small primary" data-sell="${c.id}">Winst invullen</button>`}
        <button class="btn small ghost" data-edit="${c.id}">Bewerk</button>
      </td>
    </tr>`;
  }).join('');
  $('#sold-empty').hidden = sold.length > 0;
  $('#count-sold').textContent = sold.length;

  // Kas: stortingen/opnames plus aankopen en afrekeningen als tijdlijn
  const ledger = [
    ...state.cash.map((m) => ({ datum: m.datum, text: esc(m.omschrijving || (m.soort === 'storting' ? 'Storting' : 'Opname')), bedrag: m.soort === 'storting' ? num(m.bedrag) : -num(m.bedrag), id: m.id })),
    ...state.cars.map((c) => ({ datum: c.aankoopdatum, text: `Aankoop ${esc(c.merk)} ${esc(c.model)}${num(c.kosten) ? ' (incl. kosten)' : ''}`, bedrag: -costBasis(c) })),
    ...t.settled.map((c) => ({ datum: c.verkoopdatum, text: `Verkoop ${esc(c.merk)} ${esc(c.model)}: inleg ${fmt(costBasis(c))} + winst ${fmt(num(c.winst_deel))}`, bedrag: costBasis(c) + num(c.winst_deel) })),
  ].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
  $('#cash-body').innerHTML = ledger.map((r) => `
    <tr>
      <td>${fmtDate(r.datum)}</td>
      <td>${r.text}</td>
      <td class="num ${signClass(r.bedrag)}">${signed(r.bedrag)}</td>
      <td class="actions-cell">${r.id ? `<button class="btn small ghost danger" data-del-cash="${r.id}">Verwijder</button>` : ''}</td>
    </tr>`).join('');
  $('#cash-empty').hidden = ledger.length > 0;
  $('#count-cash').textContent = ledger.length;
  $('#cash-note').textContent = ledger.length ? `Totaal gestort ${fmt(t.deposits)} · opgenomen ${fmt(t.withdrawals)} · cash bij ${PARTNER_NAAM} ${fmt(t.cash)}` : '';
}

async function refresh() {
  try {
    const [cars, cash] = await Promise.all([store.list('cars'), store.list('cash_movements')]);
    state = { cars, cash };
    render();
  } catch (err) {
    alert('Kon gegevens niet laden: ' + err.message);
  }
}

// ---------- Tabs ----------

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
  ['stock', 'sold', 'cash'].forEach((name) => { $(`#panel-${name}`).hidden = name !== tab.dataset.tab; });
}));

// ---------- Formulieren ----------

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

function formData(form) {
  const out = {};
  for (const [k, v] of new FormData(form)) out[k] = typeof v === 'string' ? v.trim() : v;
  return out;
}
const nullIfEmpty = (v) => (v === '' || v === undefined ? null : v);
const numOrNull = (v) => (v === '' || v === undefined ? null : Number(v));

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

async function submitWith(form, errorEl, action) {
  const btn = form.querySelector('button[type=submit]');
  errorEl.hidden = true;
  btn.disabled = true;
  try {
    await action();
    form.closest('dialog').close();
    await refresh();
  } catch (err) {
    showError(errorEl, err.message || String(err));
  } finally {
    btn.disabled = false;
  }
}

// Auto toevoegen / bewerken
let editingCarId = null;
function openCarDialog(car) {
  const form = $('#car-form');
  form.reset();
  editingCarId = car?.id ?? null;
  $('#car-dialog-title').textContent = car ? 'Auto bewerken' : 'Auto gekocht';
  $('#car-delete').hidden = !car;
  $('#sale-fields').hidden = !car;
  $('#car-error').hidden = true;
  form.aankoopdatum.value = today();
  if (car) {
    for (const key of ['merk', 'model', 'bouwjaar', 'kenteken', 'inruil', 'aankoopdatum', 'aankoopprijs', 'kosten', 'verkoopdatum', 'winst_deel', 'notities']) {
      form[key].value = car[key] ?? '';
    }
  }
  $('#car-dialog').showModal();
}

$('#add-car-btn').addEventListener('click', () => openCarDialog(null));

$('#car-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = formData(e.target);
  const row = {
    merk: f.merk,
    model: f.model,
    bouwjaar: numOrNull(f.bouwjaar),
    kenteken: nullIfEmpty(f.kenteken),
    inruil: nullIfEmpty(f.inruil),
    aankoopdatum: f.aankoopdatum,
    aankoopprijs: Number(f.aankoopprijs),
    kosten: num(f.kosten),
    notities: nullIfEmpty(f.notities),
  };
  if (editingCarId) {
    row.verkoopdatum = nullIfEmpty(f.verkoopdatum);
    row.winst_deel = numOrNull(f.winst_deel);
    if (row.winst_deel !== null && row.verkoopdatum === null) {
      return showError($('#car-error'), 'Vul een verkoopdatum in als je de winst invult.');
    }
    if (row.verkoopdatum && row.verkoopdatum < row.aankoopdatum) {
      return showError($('#car-error'), 'De verkoopdatum ligt voor de aankoopdatum.');
    }
  }
  submitWith(e.target, $('#car-error'), () => (editingCarId ? store.update('cars', editingCarId, row) : store.insert('cars', row)));
});

$('#car-delete').addEventListener('click', async () => {
  if (!editingCarId || !confirm('Deze auto definitief verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
  try {
    await store.remove('cars', editingCarId);
    $('#car-dialog').close();
    await refresh();
  } catch (err) {
    alert(err.message);
  }
});

// Auto verkopen / winst invullen
let sellingCar = null;
function updateSellPreview() {
  const winst = $('#sell-form').winst_deel.value;
  if (!sellingCar) return;
  if (winst === '') {
    $('#sell-preview').textContent = `Winst nog niet bekend: de auto blijft voor ${fmt(costBasis(sellingCar))} meetellen tot je de winst invult.`;
    return;
  }
  const p = Number(winst);
  $('#sell-preview').innerHTML = `Je krijgt terug: ${fmt(costBasis(sellingCar))} + <span class="${signClass(p)}">${fmt(p)}</span> = <strong>${fmt(costBasis(sellingCar) + p)}</strong>`;
}
$('#sell-form').winst_deel.addEventListener('input', updateSellPreview);

$('#sell-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = formData(e.target);
  if (f.verkoopdatum < sellingCar.aankoopdatum) {
    return showError($('#sell-error'), 'De verkoopdatum ligt voor de aankoopdatum.');
  }
  submitWith(e.target, $('#sell-error'), () => store.update('cars', sellingCar.id, { verkoopdatum: f.verkoopdatum, winst_deel: numOrNull(f.winst_deel) }));
});

// Klikken in tabellen
document.addEventListener('click', async (e) => {
  const { sell: sellId, edit: editId, delCash: delCashId } = e.target.dataset ?? {};
  if (sellId) {
    sellingCar = state.cars.find((c) => c.id === sellId);
    const form = $('#sell-form');
    form.reset();
    form.verkoopdatum.value = sellingCar.verkoopdatum || today();
    $('#sell-car-name').textContent = `${sellingCar.merk} ${sellingCar.model}${sellingCar.kenteken ? ' · ' + sellingCar.kenteken.toUpperCase() : ''} · gekocht voor ${fmt(costBasis(sellingCar))}`;
    $('#sell-error').hidden = true;
    updateSellPreview();
    $('#sell-dialog').showModal();
  } else if (editId) {
    openCarDialog(state.cars.find((c) => c.id === editId));
  } else if (delCashId) {
    if (!confirm('Deze storting/opname verwijderen?')) return;
    try { await store.remove('cash_movements', delCashId); await refresh(); } catch (err) { alert(err.message); }
  }
});

// Storten / opnemen
$('#add-cash-btn').addEventListener('click', () => {
  const form = $('#cash-form');
  form.reset();
  form.datum.value = today();
  $('#cash-error').hidden = true;
  $('#cash-dialog').showModal();
});

$('#cash-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = formData(e.target);
  submitWith(e.target, $('#cash-error'), () => store.insert('cash_movements', {
    soort: f.soort, datum: f.datum, bedrag: Number(f.bedrag), omschrijving: nullIfEmpty(f.omschrijving),
  }));
});

// ---------- Inloggen en opstarten ----------

function showApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  refresh();
}
function showLogin() {
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
}

async function init() {
  document.querySelectorAll('.partner').forEach((el) => { el.textContent = PARTNER_NAAM; });

  if (DEMO) {
    store = createLocalStore();
    $('#demo-badge').hidden = false;
    showApp();
    return;
  }

  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.99.3/+esm');
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  store = createSupabaseStore(supabase);
  $('#logout-btn').hidden = false;

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    $('#login-error').hidden = true;
    const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
    btn.disabled = false;
    if (error) showError($('#login-error'), error.message === 'Invalid login credentials' ? 'E-mail of wachtwoord klopt niet.' : error.message);
  });
  $('#logout-btn').addEventListener('click', () => supabase.auth.signOut());

  supabase.auth.onAuthStateChange((_event, session) => (session ? showApp() : showLogin()));
}

init();
