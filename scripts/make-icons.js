// Generates PNG app icons (no dependencies): navy rounded square, orange shield, white check.
// Usage: node scripts/make-icons.js
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function shieldInside(x, y) {
  // shield in 512-space: top y 92..140 slope, body to 252, curved bottom to 424
  if (y < 92 || y > 424 || x < 120 || x > 392) return false;
  const topY = 92 + (Math.abs(x - 256) / 136) * 48;
  if (y < topY) return false;
  if (y <= 252) return true;
  const t = (y - 252) / (424 - 252); // 0..1
  const half = 136 * Math.sqrt(Math.max(0, 1 - t * t));
  return Math.abs(x - 256) <= half;
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function color(x, y, maskable) {
  const r = maskable ? 0 : 112;
  // rounded rect
  const cx = Math.min(Math.max(x, r), 512 - r), cy = Math.min(Math.max(y, r), 512 - r);
  if (r && Math.hypot(x - cx, y - cy) > r) return [0, 0, 0, 0];
  // shrink artwork for maskable safe zone
  const s = maskable ? 1.25 : 1;
  const ax = 256 + (x - 256) * s, ay = 256 + (y - 256) * s;
  const d = Math.min(distSeg(ax, ay, 196, 262, 240, 306), distSeg(ax, ay, 240, 306, 322, 212));
  if (shieldInside(ax, ay) && d <= 17) return [255, 255, 255, 255];
  if (shieldInside(ax, ay)) { const k = (ay - 92) / 332; return [255 - 13 * k, 138 - 46 * k, 61 - 56 * k, 255]; }
  const k = (x + y) / 1024;
  return [19 - 8 * k, 49 - 12 * k, 92 - 23 * k, 255];
}

function png(size, maskable) {
  const ss = 3; // supersampling
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = color(((x + (sx + 0.5) / ss) / size) * 512, ((y + (sy + 0.5) / ss) / size) * 512, maskable);
        acc[0] += c[0] * c[3]; acc[1] += c[1] * c[3]; acc[2] += c[2] * c[3]; acc[3] += c[3];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4, a = acc[3];
      raw[o] = a ? acc[0] / a : 0; raw[o + 1] = a ? acc[1] / a : 0; raw[o + 2] = a ? acc[2] / a : 0; raw[o + 3] = a / (ss * ss);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true]]) {
  writeFileSync(join(out, name), png(size, mask));
  console.log('wrote', name);
}
