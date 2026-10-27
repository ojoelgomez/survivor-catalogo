// Selección de camisetas: cada línea es una camiseta con su talla. Se guarda en localStorage.

export const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const KEY = 'survivor-seleccion-v1';

export function createCart(products) {
  const byId = new Map(products.map(p => [p.id, p]));
  const listeners = new Set();
  let lines = load();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY)) || [];
      // Descarta camisetas que ya no están en el catálogo.
      return saved.filter(l => byId.has(l.id) && (!l.size || SIZES.includes(l.size)));
    } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* modo privado o almacenamiento lleno */ }
    for (const fn of listeners) fn(api);
  }

  const api = {
    get lines() { return lines.map(l => ({ ...l, product: byId.get(l.id) })); },
    get count() { return lines.length; },
    countOf: id => lines.filter(l => l.id === id).length,
    add(id, size = null) {
      lines = [...lines, { uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), id, size }];
      save();
    },
    setSize(uid, size) { lines = lines.map(l => l.uid === uid ? { ...l, size } : l); save(); },
    // custom = { on, name, number }: nombre y número estampados en la espalda.
    setCustom(uid, patch) {
      lines = lines.map(l => l.uid === uid ? { ...l, custom: { on: false, name: '', number: '', ...l.custom, ...patch } } : l);
      save();
    },
    remove(uid) { lines = lines.filter(l => l.uid !== uid); save(); },
    clear() { lines = []; save(); },
    onChange(fn) { listeners.add(fn); fn(api); },
  };
  return api;
}

// Sólo cuenta como personalizada si está activada y tiene nombre o número.
export const isCustom = l => !!(l.custom?.on && (l.custom.name.trim() || l.custom.number));
const customText = c => [c.name.trim().toUpperCase(), c.number && `#${c.number}`].filter(Boolean).join(' ');

export function totals(lines, price, customPrice) {
  const custom = lines.filter(isCustom).length;
  return { count: lines.length, custom, total: lines.length * price + custom * customPrice };
}

// Mensaje del pedido, en el formato acordado con la tienda.
export function orderMessage(lines, price, customPrice, money) {
  const items = lines.map((l, i) => `${i + 1}. ${l.product.team} – ${l.product.name} – Talla ${l.size}` +
    (isCustom(l) ? ` – Personalizada: ${customText(l.custom)} (+${money(customPrice)})` : ''));
  const t = totals(lines, price, customPrice);
  const extra = t.custom ? ` (${t.custom} ${t.custom === 1 ? 'personalizada' : 'personalizadas'})` : '';
  return [
    'Hola Survivor 👋 Me interesan estas camisetas:',
    ...items,
    `Total: ${t.count} ${t.count === 1 ? 'camiseta' : 'camisetas'}${extra} – ${money(t.total)} COP`,
  ].join('\n');
}

export const waLink = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
