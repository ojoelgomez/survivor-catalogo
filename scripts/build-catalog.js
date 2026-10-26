#!/usr/bin/env node
/**
 * Recorre ./fotos/<Equipo>/<Camiseta>/*.{jpg,png,webp} y genera:
 *   - ./img/<id>/<nn>-400.webp   (grilla)
 *   - ./img/<id>/<nn>-1600.webp  (zoom)
 *   - ./img/<id>/<nn>.jpg        (respaldo, 1200px)
 *   - ./data/catalog.json
 * Carpetas que empiezan por "_" (ej. _parches) se ignoran.
 * ./data/overrides.json (opcional) permite cambiar nombres, liga, color, orden, portada u ocultar productos.
 *
 * Uso: node scripts/build-catalog.js [--force]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const FOTOS = path.join(ROOT, 'fotos');
const IMG = path.join(ROOT, 'img');
const DATA = path.join(ROOT, 'data');
const FORCE = process.argv.includes('--force');
const EXT = /\.(jpe?g|png|webp)$/i;

// Liga, color y palabras clave de búsqueda por equipo. Equipos que no estén aquí van a "Otros".
const TEAMS = {
  'AC Milan':          { league: 'Serie A',    color: '#D6001C', tags: ['milan', 'rossoneri', 'italia'] },
  'Alemania':          { league: 'Selecciones', color: '#DD0000', tags: ['germany', 'deutschland', 'mundial'] },
  'Argentina':         { league: 'Selecciones', color: '#75AADB', tags: ['afa', 'albiceleste', 'messi', 'mundial'] },
  'Arsenal':           { league: 'Premier',    color: '#EF0107', tags: ['gunners', 'londres', 'inglaterra'] },
  'Barcelona':         { league: 'La Liga',    color: '#A50044', tags: ['barca', 'fcb', 'blaugrana', 'espana'] },
  'Bayern Munich':     { league: 'Bundesliga', color: '#DC052D', tags: ['bayern', 'munchen', 'alemania'] },
  'Brasil':            { league: 'Selecciones', color: '#FFDF00', tags: ['brazil', 'cbf', 'canarinha', 'mundial'] },
  'Croacia':           { league: 'Selecciones', color: '#E3001B', tags: ['croatia', 'hns', 'mundial'] },
  'España':            { league: 'Selecciones', color: '#C60B1E', tags: ['spain', 'espana', 'roja', 'mundial'] },
  'Inglaterra':        { league: 'Selecciones', color: '#CF142B', tags: ['england', 'three lions', 'mundial'] },
  'Manchester City':   { league: 'Premier',    color: '#6CABDD', tags: ['city', 'man city', 'citizens'] },
  'Manchester United': { league: 'Premier',    color: '#DA291C', tags: ['united', 'man utd', 'red devils'] },
  'Noruega':           { league: 'Selecciones', color: '#BA0C2F', tags: ['norway', 'norge', 'haaland', 'mundial'] },
  'PSG':               { league: 'Ligue 1',    color: '#004170', tags: ['paris', 'paris saint germain', 'francia'] },
  'Portugal':          { league: 'Selecciones', color: '#A6192E', tags: ['cristiano', 'cr7', 'mundial'] },
  'Real Madrid':       { league: 'La Liga',    color: '#FEBE10', tags: ['madrid', 'merengue', 'blancos', 'espana'] },
};
const LEAGUES = ['La Liga', 'Premier', 'Serie A', 'Bundesliga', 'Ligue 1', 'Selecciones', 'Otros'];

// Tipo de camiseta a partir del nombre de la subcarpeta.
const KINDS = [
  [/especial|edicion|edici[oó]n/i, 'Edición especial'],
  [/arquero|portero|goalkeeper/i, 'Arquero'],
  [/tercera|third/i, 'Tercera'],
  [/visitante|away|alterna/i, 'Visitante'],
  [/local|home/i, 'Local'],
];

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const readJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
const dirs = p => fs.readdirSync(p, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.')).map(d => d.name).sort();

// Regenera una variante sólo si falta o la foto original es más nueva.
const stale = (src, out) => FORCE || !fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs;

async function processImage(src, outDir, base) {
  const thumb = path.join(outDir, `${base}-400.webp`);
  const full = path.join(outDir, `${base}-1600.webp`);
  const jpg = path.join(outDir, `${base}.jpg`);
  const img = () => sharp(src).rotate(); // respeta la orientación EXIF
  if (stale(src, thumb)) await img().resize(400, 400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(thumb);
  if (stale(src, full)) await img().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(full);
  if (stale(src, jpg)) await img().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 78, mozjpeg: true }).toFile(jpg);
  const { width: w, height: h } = await sharp(full).metadata();
  const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
  return { thumb: rel(thumb), full: rel(full), jpg: rel(jpg), w, h };
}

// Imagen para compartir (WhatsApp, Instagram): logo + las portadas de los primeros equipos.
// Sin texto dibujado, para no depender de las fuentes instaladas en el servidor de GitHub.
async function buildOgImage(products) {
  const W = 1200, H = 630, TILE = 300, GAP = 18;
  const firstPerTeam = [];
  for (const p of products) if (!firstPerTeam.some(x => x.team === p.team)) firstPerTeam.push(p);
  firstPerTeam.length = Math.min(firstPerTeam.length, 4);
  const tiles = await Promise.all(firstPerTeam.map(async (p, i) => {
    const src = path.join(ROOT, p.images[0].full);
    const photo = await sharp(src).resize(TILE - 12, TILE - 12, { fit: 'cover' }).toBuffer();
    const tile = await sharp({ create: { width: TILE, height: TILE, channels: 3, background: p.color } })
      .composite([{ input: photo, left: 6, top: 6 }]).png().toBuffer();
    return { input: tile, left: 560 + (i % 2) * (TILE + GAP), top: 6 + Math.floor(i / 2) * (TILE + GAP) };
  }));
  const logoFile = path.join(ROOT, 'assets', 'logo-survivor-stacked.png');
  const logo = await sharp(logoFile).resize({ width: 420 }).toBuffer();
  const { height: lh } = await sharp(logo).metadata();
  const stripes = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="g" cx="25%" cy="45%" r="45%"><stop offset="0" stop-color="#D4FF3A" stop-opacity=".28"/><stop offset="1" stop-color="#D4FF3A" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="0" y="${H - 14}" width="${W}" height="14" fill="#D4FF3A"/></svg>`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#070708' } })
    .composite([{ input: stripes }, { input: logo, left: 70, top: Math.round((H - lh) / 2) - 10 }, ...tiles])
    .jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(IMG, 'og-image.jpg'));
}

async function main() {
  if (!fs.existsSync(FOTOS)) throw new Error('No existe ./fotos');
  const overrides = readJSON(path.join(DATA, 'overrides.json'), {});
  const teamOv = overrides.teams || {};
  const prodOv = overrides.products || {};

  const products = [];
  const liveDirs = new Set();
  let images = 0;

  for (const team of dirs(FOTOS)) {
    const meta = { league: 'Otros', color: '#D4FF3A', tags: [], ...TEAMS[team], ...teamOv[team] };
    const teamName = meta.name || team;
    for (const shirt of dirs(path.join(FOTOS, team))) {
      const id = slug(`${team} ${shirt}`);
      const ov = prodOv[id] || {};
      if (ov.hidden) continue;

      const folder = path.join(FOTOS, team, shirt);
      let files = fs.readdirSync(folder).filter(f => EXT.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (!files.length) continue;
      if (ov.cover && files.includes(ov.cover)) files = [ov.cover, ...files.filter(f => f !== ov.cover)];

      const outDir = path.join(IMG, id);
      fs.mkdirSync(outDir, { recursive: true });
      liveDirs.add(id);
      const imgs = [];
      for (const f of files) {
        imgs.push(await processImage(path.join(folder, f), outDir, slug(path.parse(f).name)));
        images++;
      }

      // Los nombres de carpeta van sin tildes; se restauran para mostrarlos.
      const name = ov.name || shirt.replace(/\bEdicion\b/g, 'Edición');
      const kind = ov.kind || (KINDS.find(([re]) => re.test(shirt)) || [, 'Local'])[1];
      const retro = /retro/i.test(shirt);
      const tags = [...new Set([teamName, team, meta.league, kind, name, ...(retro ? ['retro', 'clasica'] : []),
        ...(/manga larga/i.test(shirt) ? ['manga larga'] : []), ...meta.tags, ...(ov.tags || [])].map(fold))];

      products.push({
        id, team: teamName, league: meta.league, name, kind, retro,
        color: ov.color || meta.color,
        order: ov.order ?? meta.order ?? 1000,
        tags, images: imgs,
      });
      process.stdout.write(`✓ ${teamName} — ${name} (${imgs.length})\n`);
    }
  }

  // Borra imágenes de productos que ya no existen.
  if (fs.existsSync(IMG)) for (const d of fs.readdirSync(IMG)) {
    if (!liveDirs.has(d) && d !== 'og-image.jpg') fs.rmSync(path.join(IMG, d), { recursive: true, force: true });
  }

  // Orden: override numérico, equipo, actuales antes que retro, y Local → Visitante → Tercera → Especial.
  const kindRank = k => ['Local', 'Visitante', 'Tercera', 'Edición especial', 'Arquero'].indexOf(k);
  products.sort((a, b) => a.order - b.order || a.team.localeCompare(b.team, 'es') ||
    a.retro - b.retro || kindRank(a.kind) - kindRank(b.kind) || b.name.localeCompare(a.name, 'es'));

  const teams = new Set(products.map(p => p.team)).size;
  const catalog = {
    generated: new Date().toISOString(),
    price: overrides.price ?? 159000,
    currency: 'COP',
    whatsapp: overrides.whatsapp ?? '573113348648',
    leagues: LEAGUES,
    teams,
    count: products.length,
    products,
  };
  await buildOgImage(products);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'catalog.json'), JSON.stringify(catalog, null, 1));
  console.log(`\n${products.length} camisetas · ${teams} equipos · ${images} fotos → data/catalog.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
