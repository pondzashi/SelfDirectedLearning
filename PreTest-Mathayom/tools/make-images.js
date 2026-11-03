#!/usr/bin/env node
// สร้างรูปประกอบข้อสอบความถนัดศิลป์ (SVG) ลง data/images/ — อัปโหลดทั้งโฟลเดอร์ขึ้น Google Drive แล้วตั้ง images_folder_id
// ข้อสอบอ้างถึงด้วย image_url = drive:<ชื่อไฟล์>
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '..', 'data', 'images');
fs.mkdirSync(OUT, { recursive: true });

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="sans-serif"><rect width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>\n`;
const label = (x, y, t) => `<text x="${x}" y="${y}" font-size="22" font-weight="bold" fill="#333" text-anchor="middle">${t}</text>`;
const swatches = (colors, x0, y, size, gap) => colors.map((c, i) => `<rect x="${x0 + i * (size + gap)}" y="${y}" width="${size}" height="${size}" rx="8" fill="${c}" stroke="#999"/>`).join('');
const frame = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f4f4f4" stroke="#555" stroke-width="2"/>`;

const IMG = {};
// ---- ทฤษฎีสี
IMG['col-analog.svg'] = svg(420, 140, swatches(['#F7D417', '#F9A11B', '#F26B1D'], 30, 20, 100, 30));
IMG['col-compl.svg'] = svg(420, 140, swatches(['#1F4FD8', '#F28C28'], 70, 20, 120, 40));
IMG['col-triad.svg'] = svg(420, 140, swatches(['#E53935', '#FDD835', '#1E88E5'], 30, 20, 100, 30));
IMG['col-mono.svg'] = svg(460, 140, swatches(['#0D2B66', '#1E4FA3', '#5B86D6', '#B3C9F0'], 20, 20, 90, 20));
IMG['col-value.svg'] = svg(500, 140, swatches(['#111111', '#444444', '#777777', '#AAAAAA', '#DDDDDD'], 20, 20, 80, 16));
IMG['col-temp.svg'] = svg(520, 300, [
  ['#E53935', '#FB8C00', '#FDD835'], ['#1E88E5', '#26A69A', '#7E57C2'], ['#E53935', '#1E88E5', '#FDD835'], ['#8D6E63', '#9E9E9E', '#F5F5F5']
].map((p, i) => label(40, 55 + i * 68, String(i + 1)) + swatches(p, 70, 20 + i * 68, 56, 14)).join(''));
IMG['col-wheel.svg'] = (() => {
  const names = ['#E53935', '#F4511E', '#FB8C00', '#FDD835', '#C0CA33', '#43A047', '#00897B', '#1E88E5', '#3949AB', '#5E35B1', '#8E24AA', '#D81B60'];
  const cx = 160, cy = 160, r = 120;
  const seg = names.map((c, i) => {
    const a0 = (i * 30 - 105) * Math.PI / 180, a1 = ((i + 1) * 30 - 105) * Math.PI / 180;
    const p = (a, rr) => `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
    return `<path d="M${p(a0, 60)} L${p(a0, r)} A${r},${r} 0 0 1 ${p(a1, r)} L${p(a1, 60)} A60,60 0 0 0 ${p(a0, 60)} Z" fill="${c}" stroke="#fff" stroke-width="2"/>`;
  }).join('');
  return svg(320, 320, seg + `<text x="160" y="168" font-size="20" text-anchor="middle" fill="#333">วงจรสี</text>`);
})();
// ---- องค์ประกอบภาพ
IMG['cmp-thirds.svg'] = svg(600, 180, [[0.5, 0.5], [0.333, 0.333], [0.92, 0.1], [0.5, 0.9]].map((d, i) => {
  const x = 15 + i * 148, w = 132, h = 100, y = 40;
  const grid = [1, 2].map((k) => `<line x1="${x + w * k / 3}" y1="${y}" x2="${x + w * k / 3}" y2="${y + h}" stroke="#bbb" stroke-dasharray="4 3"/><line x1="${x}" y1="${y + h * k / 3}" x2="${x + w}" y2="${y + h * k / 3}" stroke="#bbb" stroke-dasharray="4 3"/>`).join('');
  return frame(x, y, w, h) + grid + `<circle cx="${x + w * d[0]}" cy="${y + h * d[1]}" r="11" fill="#E53935"/>` + label(x + w / 2, 30, String(i + 1));
}).join(''));
IMG['cmp-sym.svg'] = svg(400, 240, frame(20, 20, 360, 200) + `<line x1="200" y1="20" x2="200" y2="220" stroke="#bbb" stroke-dasharray="5 4"/>` +
  `<circle cx="120" cy="120" r="50" fill="#1E88E5"/><circle cx="280" cy="120" r="50" fill="#1E88E5"/><rect x="180" y="60" width="40" height="120" fill="#333"/>` +
  `<circle cx="70" cy="60" r="15" fill="#FB8C00"/><circle cx="330" cy="60" r="15" fill="#FB8C00"/>`);
IMG['cmp-asym.svg'] = svg(400, 240, frame(20, 20, 360, 200) + `<circle cx="120" cy="130" r="75" fill="#3949AB"/>` +
  `<circle cx="290" cy="80" r="18" fill="#E53935"/><circle cx="330" cy="140" r="14" fill="#E53935"/><circle cx="280" cy="180" r="16" fill="#E53935"/>`);
IMG['cmp-lines.svg'] = svg(400, 260, frame(10, 10, 380, 240) + `<rect x="10" y="10" width="380" height="110" fill="#BBDEFB"/>` +
  `<polygon points="185,120 215,120 360,250 40,250" fill="#757575"/><line x1="200" y1="125" x2="200" y2="250" stroke="#FDD835" stroke-width="5" stroke-dasharray="18 12"/>` +
  [0, 1, 2, 3, 4].map((i) => { const t = i / 5; const x = 40 + (185 - 40) * t * 0 + 0; return `<rect x="${30 + i * 28}" y="${215 - i * 20}" width="${10 - i}" height="${30 - i * 4}" fill="#5D4037"/>`; }).join('') +
  `<circle cx="200" cy="120" r="5" fill="#E53935"/>`);
IMG['cmp-crowd.svg'] = svg(400, 240, frame(20, 20, 360, 200) + Array.from({ length: 24 }, (_, i) => {
  const cols = ['#E53935', '#1E88E5', '#FDD835', '#43A047', '#8E24AA', '#FB8C00'];
  const x = 45 + (i % 8) * 44, y = 50 + Math.floor(i / 8) * 60, s = 18 + ((i * 7) % 14);
  return i % 3 === 0 ? `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="${cols[i % 6]}"/>` : `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${cols[(i * 5) % 6]}"/>`;
}).join(''));
// ---- ทัศนธาตุและหลักการออกแบบ
IMG['ele-grad.svg'] = svg(520, 140, [10, 16, 24, 34, 46].map((r, i) => `<circle cx="${50 + i * 100}" cy="70" r="${r}" fill="#26A69A"/>`).join(''));
IMG['ele-emph.svg'] = svg(400, 260, Array.from({ length: 20 }, (_, i) => {
  const x = 30 + (i % 5) * 72, y = 25 + Math.floor(i / 5) * 58;
  return `<rect x="${x}" y="${y}" width="52" height="42" rx="4" fill="${i === 13 ? '#E53935' : '#B0BEC5'}"/>`;
}).join(''));
IMG['ele-lines.svg'] = svg(600, 160, [
  'M20,80 L170,80', 'M220,40 L250,120 L280,40 L310,120 L340,40 L370,120', 'M420,80 C450,20 480,140 510,80 S570,20 590,80'
].map((d) => `<path d="${d}" fill="none" stroke="#333" stroke-width="5"/>`).join('') + label(95, 150, 'ก') + label(295, 150, 'ข') + label(505, 150, 'ค'));
IMG['ele-texture.svg'] = svg(400, 200, `<rect x="20" y="20" width="160" height="160" fill="#8D6E63"/>` +
  Array.from({ length: 60 }, (_, i) => `<line x1="${25 + (i * 37) % 150}" y1="${25 + (i * 53) % 150}" x2="${35 + (i * 37) % 150}" y2="${28 + (i * 53) % 150}" stroke="#4E342E" stroke-width="3"/>`).join('') +
  `<rect x="220" y="20" width="160" height="160" fill="#90A4AE"/>`);
// ---- โลโก้และไอคอน
IMG['logo-neg.svg'] = svg(240, 240, `<circle cx="120" cy="120" r="100" fill="#212121"/><polygon points="120,55 175,105 160,105 160,170 80,170 80,105 65,105" fill="#ffffff"/><rect x="108" y="130" width="24" height="40" fill="#212121"/>`);
IMG['logo-sizes.svg'] = svg(520, 200, (() => {
  const simple = (x, y, s) => `<circle cx="${x}" cy="${y}" r="${s}" fill="#1E88E5"/><circle cx="${x}" cy="${y}" r="${s * 0.45}" fill="#fff"/>`;
  const busy = (x, y, s) => Array.from({ length: 14 }, (_, i) => `<circle cx="${x + Math.cos(i) * s * 0.6}" cy="${y + Math.sin(i * 1.7) * s * 0.6}" r="${s * 0.12}" fill="${['#E53935', '#43A047', '#FDD835', '#8E24AA'][i % 4]}"/>`).join('') + `<circle cx="${x}" cy="${y}" r="${s}" fill="none" stroke="#333" stroke-width="${s * 0.04}"/>`;
  return label(130, 30, '1') + simple(90, 110, 60) + simple(190, 150, 14) + label(390, 30, '2') + busy(350, 110, 60) + busy(450, 150, 14);
})());
IMG['icon-set.svg'] = svg(520, 150, [
  `<rect x="25" y="35" width="70" height="70" rx="12" fill="none" stroke="#333" stroke-width="6"/>`,
  `<circle cx="190" cy="70" r="36" fill="none" stroke="#333" stroke-width="6"/>`,
  `<polygon points="310,32 350,105 270,105" fill="none" stroke="#333" stroke-width="6"/>`,
  `<rect x="410" y="30" width="80" height="80" fill="#E53935"/><text x="450" y="85" font-size="40" fill="#FDD835" text-anchor="middle" font-family="serif" font-style="italic">ß</text>`
].join('') + label(60, 140, '1') + label(190, 140, '2') + label(310, 140, '3') + label(450, 140, '4'));

Object.entries(IMG).forEach(([name, body]) => fs.writeFileSync(path.join(OUT, name), body, 'utf8'));
console.log('สร้างรูป', Object.keys(IMG).length, 'ไฟล์ ที่', OUT);
