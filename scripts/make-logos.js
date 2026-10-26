// Genera los logos blancos (fondo transparente) y los íconos con la S a partir de los PNG originales.
// Uso: node scripts/make-logos.js  (sólo hace falta si cambia el logo)
const sharp = require('sharp');
const path = require('path');
const A = p => path.join(__dirname, '..', p);
const LIME = '#D4FF3A';
const BLACK = '#070708';

// Máscara del logo: alfa = luminancia invertida (sirve con fondo blanco o transparente).
async function mask(src, region) {
  let img = sharp(A(src)).flatten({ background: '#fff' });
  if (region) img = sharp(await img.extract(region).toBuffer());
  return img.trim({ threshold: 20 }).toColourspace('b-w').negate().linear(1.2, 0).toBuffer(); // la S original es gris oscuro: se lleva a opaco
}

async function tinted(maskBuf, color, height) {
  const m = await sharp(maskBuf).resize({ height }).toBuffer();
  const { width, height: h } = await sharp(m).metadata();
  return sharp({ create: { width, height: h, channels: 3, background: color } }).joinChannel(m).png().toBuffer();
}

async function icon(sMask, size, out, pad = 0.18) {
  const inner = Math.round(size * (1 - pad * 2));
  const s = await tinted(sMask, LIME, inner);
  const { width } = await sharp(s).metadata();
  const fit = width > inner ? await sharp(s).resize({ width: inner }).toBuffer() : s;
  await sharp({ create: { width: size, height: size, channels: 4, background: BLACK } })
    .composite([{ input: fit, gravity: 'center' }]).png().toFile(A(out));
}

(async () => {
  const horiz = await mask('Logo-Survivor-1.png');
  const stacked = await mask('Logo-Survivor-2.png');
  await sharp(await tinted(horiz, '#fff', 160)).toFile(A('assets/logo-survivor.png'));
  await sharp(await tinted(stacked, '#fff', 400)).toFile(A('assets/logo-survivor-stacked.png'));

  // La S es la parte superior del logo apilado.
  const sMask = await mask('Logo-Survivor-2.png', { left: 400, top: 60, width: 1120, height: 680 });
  await icon(sMask, 32, 'assets/favicon-32.png', 0.06);
  await icon(sMask, 180, 'assets/apple-touch-icon.png');
  await icon(sMask, 512, 'assets/icon-512.png');
  console.log('Logos e íconos listos en ./assets');
})();
