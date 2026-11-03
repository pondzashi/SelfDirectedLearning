#!/usr/bin/env node
// แปลง CSV คลังข้อสอบเป็นไฟล์ Markdown อ่านง่ายสำหรับผู้ปกครองตรวจ: node tools/review-md.js data/questions_full.csv docs/questions_full_review.md
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('../apps-script/tests/harness');
const [src, out] = process.argv.slice(2);
const rows = parseCsv(fs.readFileSync(src, 'utf8'));
const h = rows[0];
const qs = rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
const LBL = { english: 'อังกฤษ', thai_social: 'ไทยและสังคม', art: 'ความถนัดศิลป์' };
const DIF = { 1: 'ง่าย', 2: 'กลาง', 3: 'ยาก' };
let md = `# คลังข้อสอบสำหรับตรวจ (${qs.length} ข้อ)\n\nสร้างจาก \`${path.basename(src)}\` · ✅ = เฉลย · ตอนสอบจริงระบบสลับลำดับตัวเลือกให้เอง · รูปประกอบอยู่ในโฟลเดอร์ \`data/images\`\n\n`;
const groups = {};
qs.forEach((q) => { const k = q.subject + '|' + q.skill; (groups[k] = groups[k] || []).push(q); });
md += '## สารบัญ\n\n' + Object.keys(groups).map((k) => { const [s, sk] = k.split('|'); return `- ${LBL[s]} › ${sk} (${groups[k].length} ข้อ)`; }).join('\n') + '\n';
const passages = {};
qs.forEach((q) => { if (q.group_id && q.passage) passages[q.group_id] = q.passage; });
Object.entries(groups).forEach(([k, list]) => {
  const [s, sk] = k.split('|');
  md += `\n## ${LBL[s]} › ${sk}\n`;
  let lastGroup = '';
  list.forEach((q) => {
    if (q.group_id && q.group_id !== lastGroup) md += `\n> **บทอ่าน ${q.group_id}:** ${passages[q.group_id].replace(/\n/g, ' ')}\n`;
    lastGroup = q.group_id;
    md += `\n**${q.id}** · ${DIF[q.difficulty]} · ${q.cognitive}${q.fact_date ? ' · ข้อมูล ณ ' + q.fact_date : ''}${q.image_url ? ' · 🖼 ' + q.image_url.replace('drive:', '') : ''}\n\n${q.stem.replace(/\n/g, '  \n')}\n\n`;
    ['a', 'b', 'c', 'd'].forEach((x) => {
      const L = x.toUpperCase();
      md += `- ${L === q.answer ? '✅ ' : ''}${L}. ${q['choice_' + x]} — _${L === q.answer ? q.explanation : q['why_' + x]}_\n`;
    });
    md += `\n💡 ${q.takeaway}\n`;
  });
});
fs.writeFileSync(out, md, 'utf8');
console.log('เขียนแล้ว', out, md.length, 'ตัวอักษร');
