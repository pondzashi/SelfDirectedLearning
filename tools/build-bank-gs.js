#!/usr/bin/env node
// แปลง CSV คลังข้อสอบเป็นไฟล์ apps-script/Bank1.gs … BankN.gs เพื่อ push ไปพร้อมโค้ด (clasp)
// แล้วนำเข้าลงแท็บ Questions จากเมนู Pre-test › นำเข้าคลังข้อสอบที่แนบมา (ไม่ต้องอัปโหลดไฟล์)
// ใช้: node tools/build-bank-gs.js data/questions_full_inline.csv
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('../apps-script/tests/harness');

const src = process.argv[2] || path.join(__dirname, '..', 'data', 'questions_full_inline.csv');
const OUT = path.join(__dirname, '..', 'apps-script');
const CHUNK = 80000; // ตัวอักษรต่อไฟล์ (ไฟล์เล็กลง editor เปิดได้ลื่น)

const rows = parseCsv(fs.readFileSync(src, 'utf8'));
const headers = rows[0];
const body = rows.slice(1).filter((r) => r.length > 1);
fs.readdirSync(OUT).filter((f) => /^Bank\d+\.gs$/.test(f)).forEach((f) => fs.unlinkSync(path.join(OUT, f)));

const parts = [];
let cur = [], size = 0;
body.forEach((r) => {
  const line = JSON.stringify(r);
  if (size + line.length > CHUNK && cur.length) { parts.push(cur); cur = []; size = 0; }
  cur.push(line); size += line.length;
});
if (cur.length) parts.push(cur);

parts.forEach((p, i) => {
  const n = i + 1;
  const head = `// สร้างอัตโนมัติจาก ${path.basename(src)} ด้วย tools/build-bank-gs.js — ห้ามแก้มือ (แก้ที่ data/src แล้วสร้างใหม่)\n`;
  const hdr = n === 1 ? `var BANK_HEADERS = ${JSON.stringify(headers)};\nvar BANK_PART_COUNT = ${parts.length};\n` : '';
  fs.writeFileSync(path.join(OUT, `Bank${n}.gs`), head + hdr + `function bankPart${n}_() {\n  return [\n    ${p.join(',\n    ')}\n  ];\n}\n`, 'utf8');
});
console.log(`เขียน Bank1..${parts.length}.gs (${body.length} ข้อ)`);
