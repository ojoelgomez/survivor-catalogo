// Ficha ampliada: galería deslizable con zoom (pellizco, doble toque, clic y rueda) y selector de versión.

const MAX_SCALE = 4;
const TAP_ZOOM = 2.5;
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- Zoom de una foto ----------
// Transform con origen 0 0: el punto (px,py) del contenedor queda fijo al cambiar de escala.
class Zoomer {
  constructor(frame) {
    this.frame = frame;
    this.img = frame.querySelector('img');
    this.s = 1; this.x = 0; this.y = 0;
    this.pointers = new Map();
    this.lastTap = 0;
    frame.addEventListener('pointerdown', e => this.down(e));
    frame.addEventListener('pointermove', e => this.move(e));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) frame.addEventListener(t, e => this.up(e));
    frame.addEventListener('wheel', e => this.wheel(e), { passive: false });
    this.img.addEventListener('dragstart', e => e.preventDefault());
  }
  get zoomed() { return this.s > 1.01; }
  point(e) {
    const r = this.frame.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  apply(animate) {
    const { width: w, height: h } = this.frame.getBoundingClientRect();
    this.x = clamp(this.x, w - w * this.s, 0);
    this.y = clamp(this.y, h - h * this.s, 0);
    this.img.style.transition = animate ? 'transform .25s ease' : 'none';
    this.img.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.s})`;
    this.frame.classList.toggle('is-zoomed', this.zoomed);
  }
  zoomAt(p, s, animate) {
    const ns = clamp(s, 1, MAX_SCALE);
    this.x = p.x - (p.x - this.x) * (ns / this.s);
    this.y = p.y - (p.y - this.y) * (ns / this.s);
    this.s = ns;
    if (!this.zoomed) { this.s = 1; this.x = 0; this.y = 0; }
    this.apply(animate);
  }
  reset() { this.s = 1; this.x = 0; this.y = 0; this.apply(true); }
  toggle(p) { this.zoomed ? this.reset() : this.zoomAt(p, TAP_ZOOM, true); }

  down(e) {
    this.pointers.set(e.pointerId, { ...this.point(e), sx: e.clientX, sy: e.clientY, t: Date.now() });
    if (this.pointers.size === 2 || this.zoomed) {
      try { this.frame.setPointerCapture(e.pointerId); } catch { /* el puntero ya terminó */ }
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.s };
    }
  }
  move(e) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const p = this.point(e);
    if (this.pointers.size === 2 && this.pinch) {
      this.pointers.set(e.pointerId, { ...prev, ...p });
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.zoomAt(mid, this.pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d);
    } else if (this.zoomed && this.pointers.size === 1) {
      this.x += p.x - prev.x; this.y += p.y - prev.y;
      this.apply();
      this.pointers.set(e.pointerId, { ...prev, ...p });
    }
  }
  up(e) {
    const start = this.pointers.get(e.pointerId);
    if (!start) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (e.type !== 'pointerup') return;
    const still = Math.hypot(e.clientX - start.sx, e.clientY - start.sy) < 8 && Date.now() - start.t < 300;
    if (!still) return;
    const p = this.point(e);
    if (e.pointerType === 'mouse') return this.toggle(p);
    // Táctil: doble toque para acercar o alejar.
    const now = Date.now();
    if (now - this.lastTap < 300) { this.toggle(p); this.lastTap = 0; } else this.lastTap = now;
  }
  wheel(e) {
    e.preventDefault();
    this.zoomAt(this.point(e), this.s * Math.exp(-e.deltaY * 0.0025));
  }
}

// ---------- Ficha ----------
export function createViewer({ price, money, onAdd }) {
  const dialog = $('#sheet'), track = $('#track'), thumbs = $('#thumbs');
  let team, variant, zoomers = [], index = 0;

  function slidesHTML(v) {
    return v.images.map((img, i) => `
      <div class="slide" role="group" aria-roledescription="foto" aria-label="${i + 1} de ${v.images.length}">
        <div class="zoom">
          <picture>
            <source srcset="${img.full}" type="image/webp">
            <img src="${img.jpg}" alt="${esc(`${team.team} ${v.name}, foto ${i + 1}`)}" width="${img.w}" height="${img.h}"
              loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async" draggable="false">
          </picture>
        </div>
      </div>`).join('');
  }

  function showVariant(id, keepScroll) {
    variant = team.variants.find(v => v.id === id) || team.variants[0];
    track.innerHTML = slidesHTML(variant);
    zoomers = [...track.querySelectorAll('.zoom')].map(f => new Zoomer(f));
    thumbs.innerHTML = variant.images.map((img, i) => `
      <button type="button" class="thumb" data-i="${i}" aria-label="Foto ${i + 1}" aria-current="${i === 0}">
        <img src="${img.thumb}" alt="" width="56" height="56" loading="lazy">
      </button>`).join('');
    thumbs.hidden = variant.images.length < 2;
    $('#sheet-name').textContent = variant.name;
    for (const b of $('#sheet-versions').children) b.setAttribute('aria-pressed', b.dataset.variant === variant.id);
    if (!keepScroll) track.scrollLeft = 0;
    index = 0;
    updateCounter();
    onAdd?.render($('#sheet-actions'), variant, team);
  }

  function updateCounter() {
    const n = variant.images.length;
    $('#counter').textContent = `${index + 1} / ${n}`;
    $('#counter').hidden = n < 2;
    $('#prev').disabled = index === 0;
    $('#next').disabled = index === n - 1;
    for (const b of thumbs.children) {
      const on = +b.dataset.i === index;
      b.setAttribute('aria-current', on);
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function go(i) {
    i = clamp(i, 0, variant.images.length - 1);
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
  }

  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i === index) return;
    zoomers[index]?.reset();
    index = i;
    updateCounter();
  }, { passive: true });

  $('#prev').addEventListener('click', () => go(index - 1));
  $('#next').addEventListener('click', () => go(index + 1));
  thumbs.addEventListener('click', e => {
    const b = e.target.closest('.thumb');
    if (b) go(+b.dataset.i);
  });
  $('#sheet-versions').addEventListener('click', e => {
    const b = e.target.closest('[data-variant]');
    if (b && b.dataset.variant !== variant.id) showVariant(b.dataset.variant);
  });
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') go(index - 1);
    if (e.key === 'ArrowRight') go(index + 1);
  });
  // Clic en el fondo (fuera de la ficha) cierra en escritorio.
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  $('#sheet-close').addEventListener('click', () => close());

  // El botón "atrás" del celular cierra la ficha en vez de salir del sitio.
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-sheet');
    if (history.state?.sheet) history.back();
  });
  window.addEventListener('popstate', () => { if (dialog.open) dialog.close(); });

  function open(t, variantId) {
    team = t;
    $('#sheet-league').textContent = t.league;
    $('#sheet-team').textContent = t.team;
    $('#sheet-price').textContent = money(price);
    dialog.style.setProperty('--club', t.color);
    $('#sheet-versions').innerHTML = t.variants.length > 1 ? t.variants.map(v => `
      <button type="button" class="pill" data-variant="${v.id}" aria-pressed="false">
        <img src="${v.images[0].thumb}" alt="" width="28" height="28">${esc(v.name)}
      </button>`).join('') : '';
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('has-sheet');
      history.pushState({ sheet: true }, '');
    }
    showVariant(variantId);
    $('#hint').classList.remove('is-gone');
    setTimeout(() => $('#hint').classList.add('is-gone'), 2500);
  }

  function close() { if (dialog.open) dialog.close(); }

  return { open, close, get variant() { return variant; } };
}
