// ตรวจคลังข้อสอบเต็มกับ Settings ค่าเริ่มต้นจริง: node apps-script/tests/check-bank.js [data/questions_full.csv]
// เช็ค: ไม่มีแถวผิดรูปแบบ, รูปที่อ้างถึงมีไฟล์จริง, Mock เต็มชุดได้ข้อครบไม่มี shortfall, Mock ติดกันไม่ซ้ำข้อ, Drill ใช้ได้
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createEnv, ROOT } = require('./harness');

const csv = path.resolve(process.argv[2] || path.join(ROOT, '..', 'data', 'questions_full.csv'));
const e = createEnv();
e.importCsv(csv);
e.setSetting('owner_email', 'owner@example.com');
const out = [];
const ok = (m) => { out.push('✓ ' + m); console.log('✓', m); };

const rep = JSON.parse(JSON.stringify(e.run('validateQuestions_(loadQuestionsRaw_())')));
assert.equal(rep.errors.length, 0, rep.errors.join('\n'));
ok(`ตรวจรูปแบบ: ${rep.total} ข้อ ใช้ได้ ${rep.ok} ข้อ ไม่มีแถวผิดรูปแบบ`);

const imgDir = path.join(ROOT, '..', 'data', 'images');
const qs = e.table('Questions');
const refs = qs.flatMap((q) => [q.image_url, q.explanation_image_url]).filter((r) => r && !r.startsWith('data:'));
const inline = qs.filter((q) => (q.image_url || '').startsWith('data:')).length;
if (inline) ok(`รูปฝังในเซลล์ (data URI) ${inline} ข้อ`);
const missing = refs.filter((r) => !fs.existsSync(path.join(imgDir, r.replace(/^drive:/, ''))));
assert.deepEqual(missing, []);
ok(`รูปประกอบ ${refs.length} รายการ มีไฟล์ครบใน data/images`);

const link = () => e.call('dash_createLinks', '', { mode: 'mock_full' }).urls[0].split('t=')[1];
const runs = [];
for (let i = 0; i < 3; i++) {
  const st = e.call('api_start', link(), {});
  const s = e.table('Sessions').find((x) => x.session_id === st.sessionId);
  const sf = JSON.parse(s.config_json).shortfall;
  assert.deepEqual(sf, {}, 'shortfall รอบ ' + (i + 1) + ': ' + JSON.stringify(sf));
  const ids = e.table('Answers').filter((a) => a.session_id === st.sessionId).map((a) => a.question_id);
  assert.equal(ids.length, 120);
  runs.push(ids);
  e.call('api_next', st.sessionId); e.call('api_next', st.sessionId); e.call('api_next', st.sessionId);
  e.clock.t += 60 * 60000;
}
ok('Mock เต็มชุด 3 รอบ: ได้ 120 ข้อทุกรอบ (40/40/40) ไม่มีทักษะใดขาดข้อ');
const overlap = (a, b) => a.filter((x) => b.includes(x)).length;
const dbg = (a, b) => a.filter((x) => b.includes(x)).join(',');
assert.equal(overlap(runs[0], runs[1]), 0, dbg(runs[0], runs[1]));
assert.equal(overlap(runs[1], runs[2]), 0, dbg(runs[1], runs[2]));
ok(`Mock ติดกันไม่ซ้ำข้อ (รอบ1∩รอบ2 = ${overlap(runs[0], runs[1])}, รอบ2∩รอบ3 = ${overlap(runs[1], runs[2])}); รอบ1∩รอบ3 = ${overlap(runs[0], runs[2])} (เลี่ยงเฉพาะ 2 รอบล่าสุดตาม Settings)`);

const d = e.call('api_start', e.call('dash_createLinks', '', {}).urls[0].split('t=')[1], { mode: 'drill_auto', subject: 'art' });
assert.equal(d.questions.length, 15);
ok('Drill อัตโนมัติวิชาศิลป์หลัง Mock: ได้ 15 ข้อจากทักษะที่ยังอ่อน');

// สัดส่วนความยากของ Mock รอบแรก
const qmap = Object.fromEntries(qs.map((q) => [q.id, q]));
const diff = { 1: 0, 2: 0, 3: 0 };
runs[0].forEach((id) => { diff[qmap[id].difficulty]++; });
ok(`ความยากใน Mock รอบแรก: ง่าย ${diff[1]} / กลาง ${diff[2]} / ยาก ${diff[3]} (เป้า 30/45/25%)`);

fs.writeFileSync(path.join(ROOT, '..', 'docs', 'bank-check.md'), '# ผลตรวจคลังข้อสอบเต็ม\n\nไฟล์: `' + path.relative(path.join(ROOT, '..'), csv).replace(/\\/g, '/') + '` · คำสั่ง `node apps-script/tests/check-bank.js`\n\n' + out.map((l) => '- ' + l).join('\n') + '\n');
