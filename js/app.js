// SURVIVOR — catálogo estático. Lee data/catalog.json y pinta grilla, buscador y chips.
// Cada tarjeta es un equipo; sus camisetas (local, visitante, retro…) son versiones dentro de la tarjeta.

import { createViewer } from './viewer.js';
import { createCart, orderMessage, waLink, totals, isCustom, SIZES } from './cart.js';

const TAGLINE_SMALL = '11 gigantes. 1 precio. <em>$159.900</em>';
const TAGLINE_BIG = 'Los gigantes <em>del fútbol</em>';
const MAX_TEAMS_SMALL = 11;

const $ = sel => document.querySelector(sel);
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const money = n => '$' + n.toLocaleString('es-CO');
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const state = { teams: [], league: 'Todas', query: '' };
let catalog, viewer, cart;

async function init() {
  const res = await fetch('data/catalog.json', { cache: 'no-cache' });
  catalog = await res.json();
  state.teams = groupByTeam(catalog.products);
  cart = createCart(catalog.products);
  viewer = createViewer({ price: catalog.price, money, onAdd: { render: renderSheetActions } });
  if (matchMedia('(pointer: fine)').matches) $('#hint').textContent = 'Clic o rueda del mouse para hacer zoom';

  const big = catalog.teams > MAX_TEAMS_SMALL;
  $('#tagline').innerHTML = big ? TAGLINE_BIG : TAGLINE_SMALL;
  $('.hero__price').hidden = !big; // la frase corta ya incluye el precio

  readHash();
  renderChips();
  bindSearch();
  bindGrid();
  bindOrder();
  render();
  watchToolbar();
}

// El catálogo ya viene ordenado; el primer producto de cada equipo fija su posición.
function groupByTeam(products) {
  const map = new Map();
  for (const p of products) {
    if (!map.has(p.team)) map.set(p.team, { team: p.team, league: p.league, color: p.color, variants: [] });
    map.get(p.team).variants.push({ ...p, haystack: fold([p.team, p.name, p.kind, p.league, ...p.tags].join(' ')) });
  }
  return [...map.values()];
}

// ---------- Filtros ----------
function variantMatches(v) {
  const words = fold(state.query).split(/\s+/).filter(Boolean);
  return words.every(w => v.haystack.includes(w));
}
function visibleVariants(t) {
  if (state.league !== 'Todas' && t.league !== state.league) return [];
  return t.variants.filter(variantMatches);
}

function renderChips() {
  const counts = {};
  for (const t of state.teams) counts[t.league] = (counts[t.league] || 0) + 1;
  const leagues = ['Todas', ...catalog.leagues.filter(l => counts[l])];
  $('#chips').innerHTML = leagues.map(l => `
    <button type="button" class="chip" data-league="${l}" aria-pressed="${l === state.league}">
      ${l} <small>${l === 'Todas' ? state.teams.length : counts[l]}</small>
    </button>`).join('');
  $('#chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.league = chip.dataset.league;
    for (const c of $('#chips').children) c.setAttribute('aria-pressed', c === chip);
    chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    render();
    writeHash();
  });
}

function bindSearch() {
  const input = $('#search'), clear = $('#clear');
  input.value = state.query;
  clear.hidden = !state.query;
  let t;
  input.addEventListener('input', () => {
    clear.hidden = !input.value;
    clearTimeout(t);
    t = setTimeout(() => { state.query = input.value; render(); writeHash(); }, 120);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  clear.addEventListener('click', () => {
    input.value = ''; state.query = ''; clear.hidden = true;
    render(); writeHash(); input.focus();
  });
}

// La búsqueda y la liga viajan en la URL (#q=retro&liga=Premier) para compartir enlaces filtrados.
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  state.query = h.get('q') || '';
  const liga = h.get('liga');
  if (liga && catalog.leagues.includes(liga)) state.league = liga;
}
function writeHash() {
  const h = new URLSearchParams();
  if (state.query) h.set('q', state.query);
  if (state.league !== 'Todas') h.set('liga', state.league);
  const s = h.toString();
  history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
}

// ---------- Grilla ----------
const badgeOf = v => v.retro ? 'Retro' : v.kind === 'Edición especial' ? 'Especial' : '';

function pictureHTML(v, alt) {
  const img = v.images[0];
  return `<picture>
    <source srcset="${img.thumb}" type="image/webp">
    <img src="${img.jpg}" alt="${esc(alt)}" width="400" height="400" loading="lazy" decoding="async">
  </picture>`;
}

function cardHTML(t, variants) {
  const v = variants[0];
  const badge = badgeOf(v);
  const swatches = variants.length > 1 ? `
    <div class="versions" role="group" aria-label="Versiones de ${esc(t.team)}">
      ${variants.map((x, i) => `
        <button type="button" class="version" data-variant="${x.id}" aria-pressed="${i === 0}" aria-label="${esc(x.name)}" title="${esc(x.name)}">
          <img src="${x.images[0].thumb}" alt="" width="40" height="40" loading="lazy" decoding="async">
        </button>`).join('')}
    </div>` : '';
  return `
  <li class="card" style="--club:${t.color}" data-team="${esc(t.team)}" data-variant="${v.id}">
    <button type="button" class="card__open" aria-label="Ver ${esc(t.team)} ${esc(v.name)}">
      <div class="card__img">
        <span class="card__badge" ${badge ? '' : 'hidden'}>${badge}</span>
        ${pictureHTML(v, `Camiseta ${t.team} ${v.name}`)}
        ${variants.length > 1 ? `<span class="card__count" aria-hidden="true">${variants.length} versiones</span>` : ''}
      </div>
    </button>
    <div class="card__body">
      <span class="card__league">${t.league}</span>
      <h2 class="card__team">${esc(t.team)}</h2>
      <p class="card__kind" aria-live="polite">${esc(v.name)}</p>
      ${swatches}
      <div class="card__foot">
        <span class="card__price">${money(catalog.price)}</span>
        ${addButtonHTML(v.id)}
      </div>
    </div>
  </li>`;
}

// Cambiar de versión dentro de la tarjeta, sin volver a pintar la grilla.
function selectVariant(card, id) {
  const t = state.teams.find(x => x.team === card.dataset.team);
  const v = t.variants.find(x => x.id === id);
  card.dataset.variant = id;
  card.querySelector('picture').outerHTML = pictureHTML(v, `Camiseta ${t.team} ${v.name}`);
  card.querySelector('.card__kind').textContent = v.name;
  card.querySelector('.card__open').setAttribute('aria-label', `Ver ${t.team} ${v.name}`);
  const badge = card.querySelector('.card__badge');
  badge.textContent = badgeOf(v);
  badge.hidden = !badge.textContent;
  for (const b of card.querySelectorAll('.version')) b.setAttribute('aria-pressed', b.dataset.variant === id);
  card.querySelector('.add').outerHTML = addButtonHTML(id);
}

// ---------- Selección ----------
function addButtonHTML(id) {
  const n = cart.countOf(id);
  return `<button type="button" class="add${n ? ' is-added' : ''}" data-add="${id}" aria-label="Agregar ${esc(catalog.products.find(p => p.id === id).name)} a la selección${n ? `, ya tienes ${n}` : ''}">
    ${n ? `<span class="add__n">${n}</span>` : '<span aria-hidden="true">+</span>'} Agregar
  </button>`;
}

function refreshAddButtons() {
  for (const b of document.querySelectorAll('#grid .add')) b.outerHTML = addButtonHTML(b.dataset.add);
}

// Talla, personalización y "Agregar" dentro de la ficha ampliada.
// Todo se elige aquí, para que el total del pedido ya incluya la personalización.
let sheetSize = null;
let sheetCustom = { on: false, name: '', number: '' };
const sheetAddLabel = () => {
  if (!sheetSize) return 'Elige una talla';
  const custom = isCustom({ custom: sheetCustom });
  return `Agregar talla ${sheetSize}${custom ? ' personalizada' : ''} · ${money(catalog.price + (custom ? catalog.customPrice : 0))}`;
};

function renderSheetActions(box, v) {
  const n = cart.countOf(v.id);
  box.innerHTML = `
    <p class="sizes__label" id="sizes-label">Talla</p>
    <div class="sizes" role="radiogroup" aria-labelledby="sizes-label">
      ${SIZES.map(s => `<button type="button" class="size" role="radio" data-size="${s}" aria-checked="${s === sheetSize}">${s}</button>`).join('')}
    </div>
    <p class="size-warn" id="size-warn" hidden>Elige una talla para agregarla.</p>
    ${customHTML('sheet', sheetCustom)}
    <button type="button" class="add add--big${sheetSize ? '' : ' is-off'}" data-sheet-add="${v.id}" aria-describedby="size-warn">${sheetAddLabel()}</button>
    ${n ? `<p class="sheet__added">✓ Tienes ${n} de esta en tu selección</p>` : ''}`;
  box.onclick = e => {
    const size = e.target.closest('.size');
    if (size) { sheetSize = size.dataset.size === sheetSize ? null : size.dataset.size; return renderSheetActions(box, v); }
    if (e.target.closest('[data-sheet-add]')) {
      if (!sheetSize) return warnSize(box);
      cart.add(v.id, sheetSize, isCustom({ custom: sheetCustom }) ? sheetCustom : null);
      sheetSize = null;
      sheetCustom = { on: false, name: '', number: '' };
      bump();
      renderSheetActions(box, v);
    }
  };
  box.onchange = e => {
    if (!e.target.matches('[data-custom-on]')) return;
    sheetCustom = { ...sheetCustom, on: e.target.checked };
    renderSheetActions(box, v);
    if (sheetCustom.on) box.querySelector('[data-custom="name"]').focus();
  };
  box.oninput = e => {
    const field = e.target.closest('[data-custom]');
    if (!field) return;
    sheetCustom = { ...sheetCustom, [field.dataset.custom]: cleanCustomInput(field) };
    box.querySelector('[data-sheet-add]').textContent = sheetAddLabel();
  };
}

// Nombre: letras y espacios en mayúscula (máx. 12). Número: 0 a 99.
function cleanCustomInput(field) {
  const clean = field.dataset.custom === 'name'
    ? field.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ .'-]/g, '').slice(0, 12)
    : field.value.replace(/\D/g, '').slice(0, 2);
  if (clean !== field.value) field.value = clean;
  return clean;
}

function warnSize(box) {
  box.querySelector('.size-warn').hidden = false;
  const sizes = box.querySelector('.sizes');
  sizes.classList.remove('is-shake');
  void sizes.offsetWidth;
  sizes.classList.add('is-shake');
}

function bump() {
  const bag = $('#bag');
  bag.classList.remove('is-bump');
  void bag.offsetWidth; // reinicia la animación
  bag.classList.add('is-bump');
}

function renderBag() {
  const n = cart.count;
  $('#bag').hidden = !n;
  $('#dock').classList.toggle('has-bag', n > 0);
  $('#bag-count').textContent = n;
  $('#bag-label').textContent = n === 1 ? 'seleccionada' : 'seleccionadas';
  $('#bag-total').textContent = money(totals(cart.lines, catalog.price, catalog.customPrice).total);
}

function renderOrder() {
  const lines = cart.lines;
  if (!lines.length) { if ($('#order').open) $('#order').close(); return; }
  $('#order-list').innerHTML = lines.map((l, i) => `
    <li class="line${l.size ? '' : ' needs-size'}" style="--club:${l.product.color}">
      <img src="${l.product.images[0].thumb}" alt="" width="64" height="64">
      <div class="line__info">
        <span class="line__n">${i + 1}</span>
        <p class="line__team">${esc(l.product.team)}</p>
        <p class="line__name">${esc(l.product.name)}</p>
        <div class="sizes sizes--sm" role="radiogroup" aria-label="Talla de ${esc(l.product.team)} ${esc(l.product.name)}">
          ${SIZES.map(s => `<button type="button" class="size" role="radio" data-uid="${l.uid}" data-size="${s}" aria-checked="${s === l.size}">${s}</button>`).join('')}
        </div>
        ${customHTML(l.uid, l.custom)}
      </div>
      <button type="button" class="line__remove" data-remove="${l.uid}" aria-label="Quitar ${esc(l.product.team)} ${esc(l.product.name)}">×</button>
    </li>`).join('');
  renderOrderFoot();
}

// Nombre y número estampados: opcional por camiseta, con costo adicional.
// uid es la línea del pedido, o "sheet" para la ficha (camiseta aún no agregada).
function customHTML(uid, custom) {
  const c = { on: false, name: '', number: '', ...custom };
  return `
    <div class="custom${c.on ? ' is-on' : ''}">
      <label class="custom__toggle">
        <input type="checkbox" data-custom-on="${uid}" ${c.on ? 'checked' : ''}>
        <span>Personalizar con nombre y número</span>
        <strong>+${money(catalog.customPrice)}</strong>
      </label>
      <div class="custom__fields" ${c.on ? '' : 'hidden'}>
        <label class="custom__field custom__field--name">Nombre
          <input type="text" data-custom="name" data-uid="${uid}" value="${esc(c.name)}" maxlength="12"
            placeholder="Ej. MESSI" autocomplete="off" autocapitalize="characters" spellcheck="false">
        </label>
        <label class="custom__field custom__field--number">Número
          <input type="text" data-custom="number" data-uid="${uid}" value="${esc(c.number)}" maxlength="2"
            placeholder="10" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
        </label>
      </div>
    </div>`;
}

// Totales y enlace de WhatsApp; se actualiza sola mientras escriben, sin repintar la lista.
function renderOrderFoot() {
  const lines = cart.lines;
  const t = totals(lines, catalog.price, catalog.customPrice);
  const missing = lines.some(l => !l.size);
  $('#order-count').innerHTML = `${t.count} ${t.count === 1 ? 'camiseta' : 'camisetas'}` +
    (t.custom ? `<small>${t.custom} ${t.custom === 1 ? 'personalizada' : 'personalizadas'} (+${money(t.custom * catalog.customPrice)})</small>` : '');
  $('#order-total').textContent = money(t.total) + ' COP';
  $('#order-send').href = missing ? '#' : waLink(catalog.whatsapp, orderMessage(lines, catalog.price, catalog.customPrice, money));
  $('#order-send').setAttribute('aria-disabled', missing);
}

let typing = false; // mientras escriben nombre/número no se repinta la lista (perdería el foco)

function bindOrder() {
  const order = $('#order');
  $('#bag').addEventListener('click', () => {
    $('#order-warn').hidden = true;
    renderOrder();
    order.showModal();
    document.documentElement.classList.add('has-sheet');
  });
  order.addEventListener('close', () => document.documentElement.classList.remove('has-sheet'));
  order.addEventListener('click', e => { if (e.target === order) order.close(); });
  $('#order-close').addEventListener('click', () => order.close());
  $('#order-clear').addEventListener('click', () => {
    if (confirm('¿Quitar todas las camisetas de tu selección?')) cart.clear();
  });
  $('#order-list').addEventListener('click', e => {
    const size = e.target.closest('.size');
    if (size) return cart.setSize(size.dataset.uid, size.dataset.size);
    const rm = e.target.closest('[data-remove]');
    if (rm) cart.remove(rm.dataset.remove);
  });
  $('#order-list').addEventListener('change', e => {
    const box = e.target.closest('[data-custom-on]');
    if (!box) return;
    cart.setCustom(box.dataset.customOn, { on: box.checked });
    if (box.checked) $(`[data-custom="name"][data-uid="${box.dataset.customOn}"]`)?.focus();
  });
  $('#order-list').addEventListener('input', e => {
    const field = e.target.closest('[data-custom]');
    if (!field) return;
    const clean = cleanCustomInput(field);
    typing = true;
    cart.setCustom(field.dataset.uid, { [field.dataset.custom]: clean });
    typing = false;
  });
  $('#order-send').addEventListener('click', e => {
    if ($('#order-send').getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      $('#order-warn').hidden = false;
      order.querySelector('.needs-size')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // "¿Tu equipo no está?": si hay una búsqueda sin resultados, la incluimos en el mensaje.
  const askHref = () => {
    const q = state.query.trim();
    return waLink(catalog.whatsapp, q
      ? `Hola Survivor 👋 No encontré en el catálogo la camiseta que busco: ${q}. ¿La pueden conseguir?`
      : 'Hola Survivor 👋 No encontré mi equipo en el catálogo. Busco la camiseta de: ');
  };
  for (const a of [$('#ask'), $('#empty-ask')]) a.addEventListener('click', () => { a.href = askHref(); });

  cart.onChange(() => {
    renderBag();
    refreshAddButtons();
    if (order.open) typing ? renderOrderFoot() : renderOrder();
    if ($('#sheet').open) renderSheetActions($('#sheet-actions'), viewer.variant);
  });
}

function bindGrid() {
  $('#grid').addEventListener('click', e => {
    const sw = e.target.closest('.version');
    if (sw) return selectVariant(sw.closest('.card'), sw.dataset.variant);
    // "Agregar" abre la ficha en la parte de talla y personalización.
    const add = e.target.closest('[data-add]');
    if (add) {
      const card = add.closest('.card');
      viewer.open(state.teams.find(t => t.team === card.dataset.team), card.dataset.variant);
      $('#sheet-actions').scrollIntoView({ block: 'center' });
      $('#sheet-actions .size')?.focus({ preventScroll: true });
      return;
    }
    const open = e.target.closest('.card__open');
    if (open) {
      const card = open.closest('.card');
      viewer.open(state.teams.find(t => t.team === card.dataset.team), card.dataset.variant);
    }
  });
}

let observer;
function render() {
  const rows = state.teams.map(t => [t, visibleVariants(t)]).filter(([, vs]) => vs.length);
  $('#grid').innerHTML = rows.map(([t, vs]) => cardHTML(t, vs)).join('');
  $('#empty').hidden = rows.length > 0;
  const shirts = rows.reduce((n, [, vs]) => n + vs.length, 0);
  $('#results').textContent = `${rows.length} ${rows.length === 1 ? 'equipo' : 'equipos'} · ${shirts} ${shirts === 1 ? 'camiseta' : 'camisetas'}`;

  // Aparición escalonada de las tarjetas a medida que entran en pantalla.
  observer?.disconnect();
  observer = new IntersectionObserver(entries => {
    let i = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.style.setProperty('--delay', `${Math.min(i++, 8) * 45}ms`);
      e.target.classList.add('is-in');
      observer.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -5% 0px' });
  document.querySelectorAll('.card').forEach(c => observer.observe(c));
}

function watchToolbar() {
  const bar = $('#toolbar');
  const sentinel = document.createElement('div');
  bar.before(sentinel);
  new IntersectionObserver(([e]) => bar.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
}

init().catch(err => {
  console.error(err);
  $('#results').textContent = 'No se pudo cargar el catálogo. Recarga la página.';
});
