// Rebuilds the logo's clapper icon from the print-resolution Illustrator file (CMYK + soft mask) as an RGBA PNG.
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { PNG } from 'pngjs';

const SCALE = 6;
const ai = await readFile(new URL('../Logo Zoom In2.ai', import.meta.url));
const svg = await readFile(new URL('../Logo Transparent.svg', import.meta.url), 'utf8');
const text = ai.toString('latin1');

function readImages() {
  const found = [];
  const marker = /\/Width (\d+)>>stream\r?\n/g;
  let match;
  while ((match = marker.exec(text))) {
    const head = text.slice(Math.max(0, match.index - 700), match.index);
    const length = Number([...head.matchAll(/\/Length (\d+)/g)].pop()[1]);
    const height = Number([...head.matchAll(/\/Height (\d+)/g)].pop()[1]);
    const colors = /\/ColorSpace\/DeviceGray/.test(head.slice(head.lastIndexOf('obj'))) ? 1 : 4;
    const start = match.index + match[0].length;
    found.push({ width: Number(match[1]), height, colors, data: inflateSync(ai.subarray(start, start + length)) });
  }
  return found;
}

const images = readImages();
const color = images.find((image) => image.colors === 4 && image.width > 4000);
const mask = images.find((image) => image.colors === 1 && image.width === color?.width);
if (!color || !mask) throw new Error('Could not find the CMYK icon and its soft mask in the .ai file.');
const { width: W, height: H } = color;
if (color.data.length !== W * H * 4 || mask.data.length !== W * H) {
  throw new Error(`Unexpected pixel data sizes: ${color.data.length} / ${mask.data.length} for ${W}x${H}.`);
}

const w = Math.ceil(W / SCALE);
const h = Math.ceil(H / SCALE);
const rgba = new Uint8ClampedArray(w * h * 4);
for (let oy = 0; oy < h; oy += 1) {
  for (let ox = 0; ox < w; ox += 1) {
    let c = 0, m = 0, y = 0, k = 0, a = 0, n = 0;
    for (let sy = oy * SCALE; sy < Math.min(H, (oy + 1) * SCALE); sy += 1) {
      for (let sx = ox * SCALE; sx < Math.min(W, (ox + 1) * SCALE); sx += 1) {
        const i = sy * W + sx;
        const alpha = mask.data[i];
        n += 1;
        a += alpha;
        c += color.data[i * 4] * alpha;
        m += color.data[i * 4 + 1] * alpha;
        y += color.data[i * 4 + 2] * alpha;
        k += color.data[i * 4 + 3] * alpha;
      }
    }
    const o = (oy * w + ox) * 4;
    if (a > 0) {
      const kk = 1 - k / a / 255;
      rgba[o] = 255 * (1 - c / a / 255) * kk;
      rgba[o + 1] = 255 * (1 - m / a / 255) * kk;
      rgba[o + 2] = 255 * (1 - y / a / 255) * kk;
    }
    rgba[o + 3] = a / n;
  }
}

// The embedded RGB PNG in the SVG is the colour reference; fit a gain/offset per channel against it.
const embedded = svg.match(/<image width="([\d.]+)" height="([\d.]+)" transform="translate\(([-\d.]+) ([-\d.]+)\)" xlink:href="data:image\/png;base64,([^"]+)"/);
if (!embedded) throw new Error('Reference PNG not found in the SVG.');
const ref = PNG.sync.read(Buffer.from(embedded[5], 'base64'));
const svgScale = Number(embedded[1]) / ref.width;
const bounds = (data, bw, bh, step) => {
  let minX = bw, minY = bh, maxX = 0, maxY = 0;
  for (let y = 0; y < bh; y += 1) for (let x = 0; x < bw; x += 1) {
    if (data[(y * bw + x) * 4 + 3] > 128) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
};
const refBox = bounds(ref.data, ref.width, ref.height);
const aiBox = bounds(rgba, w, h);
const fit = [0, 1, 2].map((channel) => {
  let sx = 0, sy = 0, sxx = 0, sxy = 0, count = 0;
  for (let y = refBox.minY; y < refBox.maxY; y += 2) for (let x = refBox.minX; x < refBox.maxX; x += 2) {
    const r = (y * ref.width + x) * 4;
    if (ref.data[r + 3] < 250) continue;
    const ax = Math.min(w - 1, Math.floor(aiBox.minX + ((x - refBox.minX) / (refBox.maxX - refBox.minX)) * (aiBox.maxX - aiBox.minX)));
    const ay = Math.min(h - 1, Math.floor(aiBox.minY + ((y - refBox.minY) / (refBox.maxY - refBox.minY)) * (aiBox.maxY - aiBox.minY)));
    const a = (ay * w + ax) * 4;
    if (rgba[a + 3] < 250) continue;
    const xv = rgba[a + channel], yv = ref.data[r + channel];
    sx += xv; sy += yv; sxx += xv * xv; sxy += xv * yv; count += 1;
  }
  const gain = (count * sxy - sx * sy) / (count * sxx - sx * sx);
  return { gain, offset: (sy - gain * sx) / count };
});
console.log('colour fit', fit.map((f) => `${f.gain.toFixed(3)}x+${f.offset.toFixed(1)}`).join(' | '));
for (let i = 0; i < rgba.length; i += 4) {
  for (let channel = 0; channel < 3; channel += 1) rgba[i + channel] = fit[channel].gain * rgba[i + channel] + fit[channel].offset;
}

const cropW = aiBox.maxX - aiBox.minX;
const cropH = aiBox.maxY - aiBox.minY;
const out = new PNG({ width: cropW, height: cropH });
for (let y = 0; y < cropH; y += 1) {
  for (let x = 0; x < cropW; x += 1) {
    const s = ((y + aiBox.minY) * w + x + aiBox.minX) * 4;
    const d = (y * cropW + x) * 4;
    out.data[d] = rgba[s]; out.data[d + 1] = rgba[s + 1]; out.data[d + 2] = rgba[s + 2]; out.data[d + 3] = rgba[s + 3];
  }
}
const png = PNG.sync.write(out, { colorType: 6 });
await writeFile(new URL('../src/intro/clapper-icon.png', import.meta.url), png);

// Where the opaque artwork sits in logo (SVG) units, taken from the reference image's opaque bounds.
const originX = Number(embedded[3]);
const originY = Number(embedded[4]);
const refHeight = (refBox.maxY - refBox.minY) * svgScale;
const refCenterX = originX + ((refBox.minX + refBox.maxX) / 2) * svgScale;
const artWidth = (refHeight * cropW) / cropH;
const art = {
  x: +(refCenterX - artWidth / 2).toFixed(2),
  y: +(originY + refBox.minY * svgScale).toFixed(2),
  width: +artWidth.toFixed(2),
  height: +refHeight.toFixed(2)
};
await writeFile(
  new URL('../src/intro/icon-data.ts', import.meta.url),
  `// Generated by scripts/extract-icon.mjs. Do not edit.\nexport const ICON_ART = ${JSON.stringify(art)} as const;\n`
);
console.log(`icon ${cropW}x${cropH}px, ${(png.length / 1024).toFixed(0)} KB, art`, art, 'aspect ai', (cropW / cropH).toFixed(3), 'ref', (art.width / art.height).toFixed(3));
