#!/usr/bin/env node
// สร้าง CSV คลังข้อสอบจากไฟล์ย่อใน data/src/*.js ให้คอลัมน์ตรงกับแท็บ Questions
// ใช้: node tools/build-csv.js <ชื่อไฟล์ใน data/src ไม่ต้องใส่ .js ได้หลายไฟล์> --out data/questions_sample.csv
// ตรวจ: id ไม่ซ้ำ, ทักษะอยู่ในรายการ, เฉลย A-D, ตัวเลือก/เหตุผลครบ 4, กลุ่ม passage, สัดส่วนเฉลย
const fs = require('fs');
const path = require('path');

const SKILLS = {
  english: ['Vocabulary', 'Grammar', 'Reading', 'Error Identification'],
  thai_social: ['อักขรวิธี', 'จับใจความ', 'ความรู้ทั่วไปทางศิลปะ', 'ประวัติศาสตร์ศิลป์', 'ข่าวปัจจุบัน'],
  art: ['ทฤษฎีสี', 'องค์ประกอบภาพ', 'ทัศนธาตุและหลักการออกแบบ', 'โลโก้และไอคอน']
};
const HEADERS = ['id', 'subject', 'skill', 'difficulty', 'cognitive', 'group_id', 'passage', 'stem',
  'choice_a', 'choice_b', 'choice_c', 'choice_d', 'image_url', 'answer', 'explanation',
  'why_a', 'why_b', 'why_c', 'why_d', 'takeaway', 'explanation_image_url', 'fact_date', 'status', 'source'];
const COG = ['จำ', 'เข้าใจ', 'ประยุกต์', 'วิเคราะห์'];

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : null;
const names = args.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1);
// --inline-images: ฝังรูปจาก data/images ลงในเซลล์เป็น data URI (ไม่ต้องอัปโหลดรูปขึ้น Drive)
const INLINE = args.includes('--inline-images');
const inlineImg = (ref) => {
  if (!INLINE || !ref || !ref.startsWith('drive:')) return ref || '';
  const f = path.resolve(__dirname, '..', 'data', 'images', ref.slice(6));
  const type = f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return 'data:' + type + ';base64,' + fs.readFileSync(f).toString('base64');
};
if (!names.length || !out) { console.error('ใช้: node tools/build-csv.js <ไฟล์> [<ไฟล์>...] --out <csv>'); process.exit(2); }

const all = [];
for (const n of names) all.push(...require(path.resolve(__dirname, '..', 'data', 'src', n + '.js')));

// กระจายตำแหน่งเฉลยให้สมดุลในไฟล์ CSV (ตอนสอบระบบสลับตัวเลือกอีกชั้นอยู่แล้ว จึงไม่กระทบความหมาย)
// หมุนตัวเลือก+เหตุผลไป k ตำแหน่งตาม id (คงที่ทุกครั้งที่ build)
all.forEach((q) => {
  if (!Array.isArray(q.o) || q.o.length !== 4 || !Array.isArray(q.w) || q.w.length !== 4) return;
  const k = [...q.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 4;
  if (!k) return;
  const rot = (arr) => arr.slice(k).concat(arr.slice(0, k));
  const ai = 'ABCD'.indexOf(q.a);
  q.o = rot(q.o); q.w = rot(q.w);
  if (ai >= 0) q.a = 'ABCD'[(ai - k + 4) % 4];
});

const errors = [], ids = new Set();
const esc = (v) => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const rows = all.map((q) => {
  const bad = (m) => errors.push(`${q.id || '(ไม่มี id)'}: ${m}`);
  if (!q.id) bad('ไม่มี id'); else if (ids.has(q.id)) bad('id ซ้ำ'); else ids.add(q.id);
  if (!SKILLS[q.s]) bad('วิชาไม่ถูกต้อง'); else if (!SKILLS[q.s].includes(q.k)) bad('ทักษะไม่ถูกต้อง: ' + q.k);
  if (![1, 2, 3].includes(q.d)) bad('difficulty ต้อง 1-3');
  if (!COG.includes(q.c)) bad('cognitive ไม่ถูกต้อง: ' + q.c);
  if (!q.q) bad('ไม่มีโจทย์');
  if (!Array.isArray(q.o) || q.o.length !== 4 || q.o.some((x) => !String(x).trim())) bad('ตัวเลือกต้องครบ 4');
  if (!Array.isArray(q.w) || q.w.length !== 4 || q.w.some((x) => !String(x).trim())) bad('เหตุผลต้องครบ 4');
  if (!['A', 'B', 'C', 'D'].includes(q.a)) bad('เฉลยต้อง A-D');
  if (!q.e || !q.t) bad('ไม่มีคำอธิบาย/หลักที่ควรจำ');
  if (q.o && new Set(q.o).size !== 4) bad('ตัวเลือกซ้ำกัน');
  if (q.s === 'thai_social' && q.k === 'ข่าวปัจจุบัน' && !q.f) bad('ข่าวปัจจุบันต้องมี fact_date');
  if (q.w && q.a && !/^ถูก/.test(q.w['ABCD'.indexOf(q.a)] || '')) bad('เหตุผลของข้อที่ถูกต้องขึ้นต้นด้วย "ถูกต้อง"');
  const r = [q.id, q.s, q.k, q.d, q.c, q.g || '', q.p || '', q.q, ...(q.o || []), inlineImg(q.img), q.a, q.e, ...(q.w || []), q.t,
    inlineImg(q.eimg), q.f || '', q.status || 'active', q.src || 'original'];
  return r.map(esc).join(',');
});

// กลุ่ม passage ต้องมี passage อย่างน้อย 1 แถว และทักษะ/วิชาเดียวกัน
const groups = {};
all.forEach((q) => { if (q.g) (groups[q.g] = groups[q.g] || []).push(q); });
Object.entries(groups).forEach(([g, qs]) => {
  if (!qs.some((x) => x.p)) errors.push(`กลุ่ม ${g}: ไม่มีบทอ่าน`);
  if (new Set(qs.map((x) => x.s + '/' + x.k)).size > 1) errors.push(`กลุ่ม ${g}: ทักษะไม่ตรงกัน`);
});

const stat = {};
all.forEach((q) => { const k = q.s + '/' + q.k; stat[k] = stat[k] || { n: 0, A: 0, B: 0, C: 0, D: 0, d1: 0, d2: 0, d3: 0 }; stat[k].n++; stat[k][q.a]++; stat[k]['d' + q.d]++; });
console.log('ทักษะ'.padEnd(46), 'ข้อ  A  B  C  D  ง่าย กลาง ยาก');
Object.entries(stat).forEach(([k, v]) => console.log(k.padEnd(46), String(v.n).padStart(3), [v.A, v.B, v.C, v.D].map((x) => String(x).padStart(2)).join(' '), ' ', v.d1, v.d2, v.d3));
console.log('รวม', all.length, 'ข้อ');

if (errors.length) { console.error('\nพบปัญหา ' + errors.length + ' รายการ:\n' + errors.join('\n')); process.exit(1); }
fs.writeFileSync(path.resolve(out), '﻿' + HEADERS.join(',') + '\n' + rows.join('\n') + '\n', 'utf8');
console.log('เขียนแล้ว:', out);
