// รัน: node apps-script/tests/run.js   (ต้องมี Node 18+; ไม่ต้องติดตั้งแพ็กเกจเพิ่ม)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createEnv, ROOT } = require('./harness');

const MIN = 60000;
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message.split('\n').slice(0, 4).join('\n      ')); }
}
const J = (v) => JSON.parse(JSON.stringify(v));

// ------------------------------------------------------------------ Logic ล้วน
const L = vm.createContext({ console, Math, JSON, Object, Array, String, Number, isNaN });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'Logic.gs'), 'utf8'), L);
const lg = (fn, ...a) => { L.__a = a; return J(vm.runInContext(`${fn}.apply(null, __a)`, L)); };

function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
L.seeded = seeded;

console.log('\n[1] จับเวลาฝั่ง server (evaluatePlan_/acceptAnswer_)');
const T0 = 1_000_000_000_000, GRACE = 5000;
const dur = { english: 40, thai_social: 40, art: 50 };
const plan0 = lg('buildPlan_', ['english', 'thai_social', 'art'], dur, T0);

test('ก่อนหมดเวลาวิชาแรก ยังอยู่วิชาแรก และเวลาที่เหลือถูกต้อง', () => {
  const r = lg('evaluatePlan_', plan0, 0, T0 + 10 * MIN, GRACE);
  assert.equal(r.currentIdx, 0); assert.equal(r.finished, false);
  assert.equal(r.plan[0].deadline_ms - (T0 + 10 * MIN), 30 * MIN);
});
test('หมดวิชา 1 ระหว่างไม่มีใครเปิดหน้า -> เปิดมาเป็นวิชา 2 โดยนับจาก deadline เดิม (ไม่ใช่ตอนเปิด)', () => {
  const now = T0 + 55 * MIN;
  const r = lg('evaluatePlan_', plan0, 0, now, GRACE);
  assert.equal(r.currentIdx, 1);
  assert.equal(r.plan[1].start_ms, T0 + 40 * MIN);
  assert.equal(r.plan[1].deadline_ms, T0 + 80 * MIN);
  assert.equal(r.plan[1].deadline_ms - now, 25 * MIN);      // เหลือ 25 นาที ไม่ใช่ 40
  assert.equal(r.plan[0].closed_reason, 'time_up');
});
test('หมดหลายวิชาพร้อมกัน (cascade) ไล่ปิดต่อเนื่อง', () => {
  const r = lg('evaluatePlan_', plan0, 0, T0 + 100 * MIN, GRACE);
  assert.equal(r.currentIdx, 2);
  assert.equal(r.plan[2].start_ms, T0 + 80 * MIN);
  assert.equal(r.plan[2].deadline_ms, T0 + 130 * MIN);
  assert.equal(r.finished, false);
});
test('หมดเวลาทั้งหมด -> finished, finishedAt = deadline วิชาสุดท้าย', () => {
  const r = lg('evaluatePlan_', plan0, 0, T0 + 500 * MIN, GRACE);
  assert.equal(r.finished, true); assert.equal(r.finishedAt, T0 + 130 * MIN);
});
test('วิชาสุดท้ายในช่วง grace ยังไม่ปิด session; พ้น grace ปิด', () => {
  const p = lg('buildPlan_', ['english'], dur, T0);
  assert.equal(lg('evaluatePlan_', p, 0, T0 + 40 * MIN + 4000, GRACE).finished, false);
  assert.equal(lg('evaluatePlan_', p, 0, T0 + 40 * MIN + 5000, GRACE).finished, false);
  assert.equal(lg('evaluatePlan_', p, 0, T0 + 40 * MIN + 5001, GRACE).finished, true);
});
test('รับคำตอบ: ก่อนหมดเวลารับ / ในช่วง grace รับ / เกิน grace ปฏิเสธ', () => {
  const p = lg('buildPlan_', ['english'], dur, T0);
  assert.equal(lg('acceptAnswer_', p, 0, false, T0 + 39 * MIN, GRACE).ok, true);
  assert.equal(lg('acceptAnswer_', p, 0, false, T0 + 40 * MIN + 3000, GRACE).ok, true);
  const late = lg('acceptAnswer_', p, 0, false, T0 + 40 * MIN + 5001, GRACE);
  assert.deepEqual(late, { ok: false, reason: 'late' });
});
test('ผู้สอบเปลี่ยนวิชาเอง: วิชาใหม่เริ่มตอนกด และย้อนกลับไปวิชาก่อนหน้าไม่ได้', () => {
  const adv = lg('advancePlan_', plan0, 0, T0 + 10 * MIN);
  assert.equal(adv.currentIdx, 1);
  assert.equal(adv.plan[1].start_ms, T0 + 10 * MIN);
  assert.equal(adv.plan[1].deadline_ms, T0 + 50 * MIN);
  assert.equal(lg('acceptAnswer_', adv.plan, 0, false, T0 + 11 * MIN, GRACE).reason, 'closed');
  assert.equal(lg('acceptAnswer_', adv.plan, 1, false, T0 + 11 * MIN, GRACE).ok, true);
  assert.equal(lg('acceptAnswer_', adv.plan, 2, false, T0 + 11 * MIN, GRACE).reason, 'closed'); // ยังไม่ถึงวิชา 3
});
test('วิชาที่หมดเวลาแล้วเลื่อนไปวิชาถัดไป ยังรับคำตอบที่มาช้าภายใน grace แต่ไม่เกิน', () => {
  const ev = lg('evaluatePlan_', plan0, 0, T0 + 40 * MIN + 3000, GRACE);
  assert.equal(ev.currentIdx, 1);
  assert.equal(lg('acceptAnswer_', ev.plan, 0, false, T0 + 40 * MIN + 3000, GRACE).ok, true);
  assert.equal(lg('acceptAnswer_', ev.plan, 0, false, T0 + 40 * MIN + 6000, GRACE).reason, 'late');
});
test('clampDelta_: เวลาที่ใช้ต่อข้อไม่เกินเวลาที่ผ่านไปจริงบน server', () => {
  assert.equal(lg('clampDelta_', 99999999, T0, T0 + 5000), 5000);
  assert.equal(lg('clampDelta_', -5, T0, T0 + 5000), 0);
  assert.equal(lg('clampDelta_', 3000, T0, T0 + 5000), 3000);
});

console.log('\n[2] คำนวณ % รายทักษะ (computeStats_)');
const opts = { decay: 0.7, maxSessions: 5, greenMin: 80, yellowMin: 60 };
const r = (sid, f, skill, t, c, subject) => ({ session_id: sid, finished_ms: f, skill, subject: subject || 'english', n_total: t, n_correct: c });
test('ให้น้ำหนักรอบล่าสุดมากกว่า: (9 + 0.7×5)/(10 + 0.7×10) = 73.5 และ n = 20', () => {
  const s = lg('computeStats_', [r('A', 1, 'Grammar', 10, 5), r('B', 2, 'Grammar', 10, 9)], 'skill', opts);
  assert.equal(s.Grammar.pct, 73.5); assert.equal(s.Grammar.n, 20); assert.equal(s.Grammar.color, 'yellow');
});
test('รอบเดียว = % ธรรมดา และข้อที่ข้ามนับเป็นผิด (อยู่ใน n_total)', () => {
  const s = lg('computeStats_', [r('A', 1, 'Reading', 12, 9)], 'skill', opts);
  assert.equal(s.Reading.pct, 75);
});
test('เกณฑ์สีที่ขอบ: 80.0=เขียว, 79.9=เหลือง, 60.0=เหลือง, 59.9=แดง', () => {
  const c = (p) => lg('colorFor_', p, 80, 60);
  assert.deepEqual([c(80), c(79.9), c(60), c(59.9), c(0)], ['green', 'yellow', 'yellow', 'red', 'red']);
  assert.equal(c(null), 'none');
});
test('เกณฑ์สีปรับได้ (Settings)', () => { assert.equal(lg('colorFor_', 75, 70, 50), 'green'); });
test('ใช้ไม่เกิน recency_max_sessions รอบล่าสุด (รอบที่ 6 ถูกตัด)', () => {
  const rows = [];
  for (let i = 1; i <= 6; i++) rows.push(r('S' + i, i, 'Grammar', 10, i === 1 ? 0 : 10)); // รอบเก่าสุดได้ 0
  const s = lg('computeStats_', rows, 'skill', opts);
  assert.equal(s.Grammar.pct, 100); assert.equal(s.Grammar.n, 50); assert.equal(s.Grammar.sessions, 5);
});
test('ทักษะที่ไม่มีข้อมูลไม่ปรากฏในผล', () => { assert.equal(lg('computeStats_', [], 'skill', opts).Grammar, undefined); });
test('หลายแถวใน session เดียวกัน (คีย์ = วิชา) รวมก่อนถ่วงน้ำหนัก', () => {
  const rows = [r('A', 1, 'Vocabulary', 10, 10), r('A', 1, 'Grammar', 10, 0), r('B', 2, 'Vocabulary', 10, 5), r('B', 2, 'Grammar', 10, 5)];
  const s = lg('computeStats_', rows, 'subject', opts);
  // B (ล่าสุด) 10/20, A 10/20 -> 50%
  assert.equal(s.english.pct, 50); assert.equal(s.english.n, 40);
});

console.log('\n[3] ภาพรวม = ผลล่าสุดของแต่ละวิชา');
test('ใช้เฉพาะรอบล่าสุดต่อวิชา และถ่วงด้วยจำนวนข้อ', () => {
  const rows = [
    { session_id: 'E1', finished_ms: 1, subject: 'english', mode: 'mock_subject', n_total: 40, n_correct: 10 },
    { session_id: 'E2', finished_ms: 5, subject: 'english', mode: 'mock_subject', n_total: 40, n_correct: 30 },
    { session_id: 'F1', finished_ms: 3, subject: 'art', mode: 'mock_full', n_total: 40, n_correct: 20 }];
  const x = lg('latestPerSubject_', rows, opts);
  assert.equal(x.bySubject.english.pct, 75); assert.equal(x.bySubject.english.session_id, 'E2');
  assert.equal(x.bySubject.art.mode, 'mock_full');
  assert.equal(x.overall.pct, 62.5); assert.equal(x.overall.n, 80);
});

console.log('\n[4] Drill อัตโนมัติ (allocateDrill_)');
test('ทักษะอ่อนกว่าได้ข้อมากกว่า รวมเท่ากับจำนวนที่ขอ และข้ามทักษะสีเขียว/ไม่มีข้อมูล', () => {
  const a = lg('allocateDrill_', { Grammar: { pct: 40, color: 'red' }, Vocabulary: { pct: 70, color: 'yellow' }, Reading: { pct: 90, color: 'green' } }, 15, 2);
  assert.deepEqual(a.map((x) => x[0]), ['Grammar', 'Vocabulary']);
  assert.equal(a[0][1] + a[1][1], 15); assert.ok(a[0][1] > a[1][1]); assert.ok(a[1][1] >= 2);
});
test('ทุกทักษะเขียว -> ฝึก 2 ทักษะที่ต่ำสุด', () => {
  const a = lg('allocateDrill_', { A: { pct: 95, color: 'green' }, B: { pct: 82, color: 'green' }, C: { pct: 88, color: 'green' } }, 10, 2);
  assert.deepEqual(a.map((x) => x[0]), ['B', 'C']); assert.equal(a[0][1] + a[1][1], 10);
});
test('จำนวนข้อน้อยกว่าขั้นต่ำรวม -> เลือกเฉพาะทักษะที่อ่อนสุด', () => {
  const st = { A: { pct: 10, color: 'red' }, B: { pct: 20, color: 'red' }, C: { pct: 30, color: 'red' } };
  const a = lg('allocateDrill_', st, 5, 2);
  assert.equal(a.reduce((s, x) => s + x[1], 0), 5); assert.equal(a.length, 2);
});

console.log('\n[5] สุ่มข้อสอบ (selectQuestions_)');
function bigPool() {
  const pool = [];
  for (let i = 0; i < 30; i++) pool.push({ id: 'V' + String(i).padStart(2, '0'), skill: 'Vocabulary', difficulty: (i % 3) + 1, group_id: '' });
  for (let g = 0; g < 4; g++) for (let k = 0; k < 3; k++) pool.push({ id: `R${g}${k}`, skill: 'Reading', difficulty: 2, group_id: 'G' + g });
  return pool;
}
test('ได้จำนวนข้อตาม blueprint และไม่มีข้อซ้ำ', () => {
  const pool = bigPool();
  L.pool = pool; L.rng = seeded(1);
  const out = J(vm.runInContext(`selectQuestions_(pool, [["Vocabulary", 10], ["Reading", 6]], {1:30,2:45,3:25}, {}, {}, seeded(7))`, L));
  assert.equal(out.ids.length, 16); assert.equal(new Set(out.ids).size, 16);
  assert.equal(out.ids.filter((i) => i[0] === 'V').length, 10);
});
test('กลุ่มบทอ่านไม่แตก: เลือกครบทั้งกลุ่ม เรียงต่อกัน', () => {
  L.pool = bigPool();
  const out = J(vm.runInContext(`selectQuestions_(pool, [["Reading", 6]], {1:0,2:100,3:0}, {}, {}, seeded(3))`, L));
  assert.equal(out.ids.length, 6);
  for (let i = 0; i < 6; i += 2) { /* สองกลุ่ม กลุ่มละ 3 */ }
  const groups = out.ids.map((i) => i.slice(0, 2));
  const first = groups.slice(0, 3), second = groups.slice(3);
  assert.ok(first.every((g) => g === first[0]) && second.every((g) => g === second[0]), groups.join());
});
test('เลี่ยงข้อที่เพิ่งทำเมื่อคลังพอ', () => {
  L.pool = bigPool();
  const recent = {}; for (let i = 0; i < 10; i++) recent['V' + String(i).padStart(2, '0')] = true;
  L.recent = recent;
  for (let seed = 1; seed <= 20; seed++) {
    L.seed = seed;
    const out = J(vm.runInContext(`selectQuestions_(pool, [["Vocabulary", 12]], {1:30,2:45,3:25}, recent, {}, seeded(seed))`, L));
    assert.ok(out.ids.every((id) => !recent[id]), 'seed ' + seed);
  }
});
test('คลังไม่พอสำหรับข้อที่เพิ่งทำ -> ยอมซ้ำข้อที่เห็นนานที่สุดก่อน', () => {
  L.pool = [{ id: 'a', skill: 'S', difficulty: 2 }, { id: 'b', skill: 'S', difficulty: 2 }, { id: 'c', skill: 'S', difficulty: 2 }];
  L.recent = { a: true, b: true, c: true }; L.seen = { a: 300, b: 100, c: 200 };
  const out = J(vm.runInContext(`selectQuestions_(pool, [["S", 2]], {2:100}, recent, seen, seeded(1))`, L));
  assert.deepEqual(out.ids.sort(), ['b', 'c']);
});
test('คลังไม่พอ -> รายงาน shortfall (ไม่ล้มเหลวเงียบ)', () => {
  L.pool = bigPool();
  const out = J(vm.runInContext(`selectQuestions_(pool, [["Vocabulary", 40]], {1:30,2:45,3:25}, {}, {}, seeded(1))`, L));
  assert.equal(out.ids.length, 30); assert.equal(out.shortfall.Vocabulary, 10);
});
test('สัดส่วนความยากใกล้เป้า (30/45/25) เมื่อคลังพอ', () => {
  const pool = [];
  for (let i = 0; i < 90; i++) pool.push({ id: 'Q' + i, skill: 'S', difficulty: (i % 3) + 1 });
  L.pool = pool;
  const out = J(vm.runInContext(`selectQuestions_(pool, [["S", 20]], {1:30,2:45,3:25}, {}, {}, seeded(5))`, L));
  const d = { 1: 0, 2: 0, 3: 0 }; out.ids.forEach((id) => { d[(Number(id.slice(1)) % 3) + 1]++; });
  assert.deepEqual([d[1], d[2], d[3]], [6, 9, 5]);
});

test('กลุ่มบทอ่านขนาดไม่ลงตัว: สลับกลุ่มให้พอดีก่อนยอมใช้ข้อที่เพิ่งทำ', () => {
  // ข้อใหม่ที่เหลือ: กลุ่ม 2 ข้อ 1 กลุ่ม + กลุ่ม 4 ข้อ 3 กลุ่ม ต้องการ 12 ข้อ → ต้องได้ 4+4+4 ไม่ใช่ 2+4+4 + ข้อเก่า 2 ข้อ
  const pool = [{ id: 'P1', skill: 'R', difficulty: 2, group_id: 'G2' }, { id: 'P2', skill: 'R', difficulty: 2, group_id: 'G2' }];
  ['A', 'B', 'C'].forEach((g) => { for (let k = 0; k < 4; k++) pool.push({ id: g + k, skill: 'R', difficulty: 2, group_id: 'G' + g }); });
  for (let k = 0; k < 6; k++) pool.push({ id: 'OLD' + k, skill: 'R', difficulty: 2, group_id: '' });
  L.pool = pool; L.recent = Object.fromEntries([0, 1, 2, 3, 4, 5].map((k) => ['OLD' + k, true]));
  for (let seed = 1; seed <= 30; seed++) {
    L.seed = seed;
    const out = J(vm.runInContext(`selectQuestions_(pool, [["R", 12]], {1:30,2:45,3:25}, recent, {}, seeded(seed))`, L));
    assert.equal(out.ids.length, 12);
    assert.ok(out.ids.every((id) => !id.startsWith('OLD')), 'seed ' + seed + ': ' + out.ids.join());
  }
});

console.log('\n[6] ตรวจคะแนน (gradeAnswers_)');
test('นับถูก/ผิด/ข้าม แยกทักษะ/ความยาก/เวลาเฉลี่ย', () => {
  const g = lg('gradeAnswers_', [
    { subject: 'english', skill: 'Grammar', difficulty: 1, correct: 'A', chosen: 'A', time_spent_ms: 20000 },
    { subject: 'english', skill: 'Grammar', difficulty: 3, correct: 'B', chosen: 'C', time_spent_ms: 40000 },
    { subject: 'english', skill: 'Grammar', difficulty: 2, correct: 'D', chosen: '', time_spent_ms: 0 },
    { subject: 'english', skill: 'Reading', difficulty: 2, correct: 'D', chosen: 'D', time_spent_ms: 10000 }]);
  const gr = g.rows.find((x) => x.skill === 'Grammar');
  assert.deepEqual([gr.n_total, gr.n_correct, gr.n_wrong, gr.n_skipped, gr.pct, gr.avg_time_sec], [3, 1, 1, 1, 33.3, 20]);
  assert.deepEqual([gr.d1_n, gr.d1_correct, gr.d3_n, gr.d3_correct], [1, 1, 1, 0]);
  assert.equal(g.summary.score_pct, 50); assert.equal(g.answers[2].is_correct, '');
});

// ------------------------------------------------------------------ ทั้งระบบ (Code.gs จริง + Sheet จำลอง)
console.log('\n[7] ทั้งระบบกับข้อสอบชุดเล็ก 15 ข้อ (Code.gs + Sheet จำลอง)');
function freshEnv() {
  const e = createEnv();
  e.importCsv(path.join(ROOT, '..', 'data', 'questions_sample.csv'));
  e.setSetting('blueprint_english', 'Vocabulary=1;Grammar=1;Reading=2;Error Identification=1');
  e.setSetting('blueprint_thai_social', 'อักขรวิธี=1;จับใจความ=1;ความรู้ทั่วไปทางศิลปะ=1;ประวัติศาสตร์ศิลป์=1;ข่าวปัจจุบัน=1');
  e.setSetting('blueprint_art', 'ทฤษฎีสี=2;องค์ประกอบภาพ=1;ทัศนธาตุและหลักการออกแบบ=1;โลโก้และไอคอน=1');
  e.setSetting('owner_email', 'owner@example.com');
  e.setSetting('parent_pin', '4321');
  e.setSetting('reveal_policy', 'parent_release');
  return e;
}
function newLink(e, opts) {
  const res = e.call('dash_createLinks', '', opts || {});
  return res.urls[0].split('t=')[1];
}
const collectKeys = (v, acc = new Set()) => { if (v && typeof v === 'object') Object.keys(v).forEach((k) => { acc.add(k); collectKeys(v[k], acc); }); return acc; };
/** ตอบทุกข้อของวิชาปัจจุบัน: pick(q) คืนตัวอักษรเดิม (A-D) หรือ null */
function answerAll(e, state, pickFn) {
  state.questions.forEach((q) => {
    const row = e.table('Answers').find((a) => a.session_id === state.sessionId && a.question_id === q.qid);
    const pick = pickFn(q, row);
    if (pick) e.clock.t += 1000, assert.equal(e.call('api_saveAnswer', state.sessionId, { qid: q.qid, chosen: pick, delta_ms: 1000 }).ok, true);
  });
}
const correctOf = (e, sid, qid) => e.table('Answers').find((a) => a.session_id === sid && a.question_id === qid).correct;

test('ไม่มีสิทธิ์: อีเมลอื่นสร้างลิงก์/ดู Dashboard ไม่ได้ แต่ PIN ผ่านได้', () => {
  const e = freshEnv();
  e.env.activeEmail = 'someone@else.com';
  assert.throws(() => e.call('dash_getBundle', ''), /ไม่มีสิทธิ์/);
  assert.throws(() => e.call('dash_createLinks', '', {}), /ไม่มีสิทธิ์/);
  assert.equal(e.call('dash_check', '').ok, false);
  assert.equal(e.call('dash_check', '4321').ok, true);
  assert.doesNotThrow(() => e.call('dash_getBundle', '4321'));
  e.env.activeEmail = '';
  assert.equal(e.call('dash_check', '').ok, false);
});

test('token ใช้ครั้งเดียว: เริ่มซ้ำไม่สร้าง session/ชุดข้อสอบใหม่ และลิงก์เดิมกลับมาต่อ session เดิมได้', () => {
  const e = freshEnv();
  const tok = newLink(e);
  const lobby = e.call('api_open', tok);
  assert.equal(lobby.phase, 'lobby');
  const st = e.call('api_start', tok, { mode: 'mock_subject', subject: 'english' });
  assert.equal(st.phase, 'exam');
  const nAns = e.table('Answers').length;
  const again = e.call('api_start', tok, { mode: 'mock_subject', subject: 'art' });
  assert.equal(again.sessionId, st.sessionId); assert.equal(again.subjects[0].subject, 'english');
  assert.equal(e.table('Answers').length, nAns); assert.equal(e.table('Sessions').length, 1);
  assert.equal(e.call('api_open', tok).phase, 'exam');
  assert.equal(e.call('api_open', 'T-nonexistent').phase, 'invalid');
});

test('ยกเลิกลิงก์ที่ยังไม่ใช้ได้ และลิงก์ที่ยกเลิกเปิดไม่ได้', () => {
  const e = freshEnv();
  const tok = newLink(e);
  const sid = e.table('Sessions')[0].session_id;
  assert.equal(e.call('dash_voidLink', '', sid).ok, true);
  assert.equal(e.call('api_open', tok).phase, 'invalid');
});

test('เริ่มสอบบันทึกเวลาเริ่มลง Sheet, สุ่มตาม blueprint, กลุ่มบทอ่านอยู่ติดกัน, ไม่ส่งเฉลยให้ client', () => {
  const e = freshEnv();
  const t0 = e.clock.t;
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'english' });
  const s = e.table('Sessions')[0];
  assert.equal(s.status, 'in_progress'); assert.equal(Number(s.started_ms), t0);
  assert.equal(st.questions.length, 5);
  assert.equal(st.remainingMs, 40 * MIN);
  const ids = st.questions.map((q) => q.qid);
  assert.equal(Math.abs(ids.indexOf('EN-REA-001') - ids.indexOf('EN-REA-002')), 1);
  assert.ok(st.questions.every((q) => q.choices.length === 4));
  const rea = st.questions.filter((q) => q.group_id === 'G-EN-001');
  assert.ok(rea.every((q) => q.passage.startsWith('Vincent van Gogh')));      // บทอ่านมาจากแถวแรกของกลุ่ม
  const keys = collectKeys(st);
  ['answer', 'correct', 'explanation', 'why', 'takeaway'].forEach((k) => assert.ok(!keys.has(k), 'หลุด: ' + k));
});

test('รีเฟรช/เปิดใหม่: ได้ข้อเดิม ลำดับตัวเลือกเดิม คำตอบ/ธงเดิม และเวลาที่เหลือจริง', () => {
  const e = freshEnv();
  const tok = newLink(e);
  const st = e.call('api_start', tok, { mode: 'mock_subject', subject: 'english' });
  const q = st.questions[2];
  e.clock.t += 5 * MIN;
  assert.equal(e.call('api_saveAnswer', st.sessionId, { qid: q.qid, chosen: q.choices[1].k, flagged: true, delta_ms: 20000 }).ok, true);
  e.clock.t += 7 * MIN;
  const again = e.call('api_open', tok);
  assert.equal(again.remainingMs, 28 * MIN);
  assert.deepEqual(again.questions.map((x) => x.qid), st.questions.map((x) => x.qid));
  assert.deepEqual(again.questions[2].choices.map((c) => c.k), q.choices.map((c) => c.k));
  assert.equal(again.questions[2].chosen, q.choices[1].k); assert.equal(again.questions[2].flagged, true);
  const row = e.table('Answers').find((a) => a.question_id === q.qid);
  assert.equal(Number(row.time_spent_ms), 20000);
});

test('autosave: ตอบ/ข้าม/ปักธง/เปลี่ยนคำตอบ บันทึกลง Sheet; ตัวอักษรไม่ถูกต้องถูกปฏิเสธ', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
  const [a, b] = st.questions;
  e.clock.t += 2000;
  assert.equal(e.call('api_saveAnswer', st.sessionId, { qid: a.qid, skipped: true }).ok, true);
  assert.equal(e.table('Answers').find((r) => r.question_id === a.qid).skipped, true);
  e.call('api_saveAnswer', st.sessionId, { qid: a.qid, chosen: 'C' });
  let row = e.table('Answers').find((r) => r.question_id === a.qid);
  assert.equal(row.chosen, 'C'); assert.equal(row.skipped, false);
  e.call('api_saveAnswer', st.sessionId, { qid: a.qid, chosen: 'D' });
  assert.equal(e.table('Answers').find((r) => r.question_id === a.qid).chosen, 'D');
  assert.equal(e.call('api_saveAnswer', st.sessionId, { qid: b.qid, chosen: 'Z' }).ok, false);
  assert.equal(e.call('api_saveAnswer', st.sessionId, { qid: 'NOPE', chosen: 'A' }).reason, 'notfound');
});

test('เวลาต่อข้อ: ไม่เชื่อ client เกินเวลาที่ผ่านไปจริง และนับสลับแท็บ', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
  e.clock.t += 3000;
  e.call('api_saveAnswer', st.sessionId, { qid: st.questions[0].qid, chosen: 'A', delta_ms: 9_999_999 });
  assert.equal(Number(e.table('Answers').find((r) => r.question_id === st.questions[0].qid).time_spent_ms), 3000);
  e.call('api_logTabSwitch', st.sessionId); e.call('api_logTabSwitch', st.sessionId);
  assert.equal(Number(e.table('Sessions')[0].tab_switches), 2);
});

test('หมดเวลาวิชาเดียว: ใน grace ยังรับ, พ้น grace ปฏิเสธ + auto-submit + ล็อก session', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'english' });
  const [q1, q2, q3] = st.questions;
  e.clock.t += 10 * MIN;
  e.call('api_saveAnswer', st.sessionId, { qid: q1.qid, chosen: correctOf(e, st.sessionId, q1.qid) });
  e.clock.t += 30 * MIN + 3000;                                         // หมดเวลาแล้ว 3 วินาที (ใน grace)
  const inGrace = e.call('api_saveAnswer', st.sessionId, { qid: q2.qid, chosen: correctOf(e, st.sessionId, q2.qid) });
  assert.equal(inGrace.ok, true); assert.equal(inGrace.remainingMs, 0);
  assert.equal(e.table('Sessions')[0].status, 'in_progress');
  e.clock.t += 3000;                                                    // เกิน grace
  const late = e.call('api_saveAnswer', st.sessionId, { qid: q3.qid, chosen: correctOf(e, st.sessionId, q3.qid) });
  assert.equal(late.ok, false);
  const s = e.table('Sessions')[0];
  assert.equal(s.status, 'expired_auto'); assert.equal(s.submit_reason, 'time_up');
  assert.equal(Number(s.submitted_ms), Number(s.started_ms) + 40 * MIN);   // ปิดที่ deadline
  assert.equal(Number(s.used_sec), 40 * 60);
  assert.equal(Number(s.n_correct), 2); assert.equal(Number(s.n_skipped), 3); assert.equal(Number(s.n_total), 5);
  assert.equal(e.table('Answers').find((r) => r.question_id === q3.qid).chosen, '');   // คำตอบที่มาช้าไม่ถูกบันทึก
  assert.equal(e.call('api_getState', st.sessionId).phase, 'done');
  assert.equal(e.table('Results').length, 4);
});

test('Mock เต็มชุด: หมดเวลาวิชา 1 แล้วเปิดหน้ามา -> อยู่วิชา 2 ด้วยเวลาที่เหลือจริง และย้อนวิชา 1 ไม่ได้', () => {
  const e = freshEnv();
  const tok = newLink(e, { mode: 'mock_full' });
  const st = e.call('api_start', tok, {});
  assert.deepEqual(st.subjects.map((x) => x.subject), ['english', 'thai_social', 'art']);
  const q1 = st.questions[0].qid;
  e.clock.t += 55 * MIN;                                                // ปิดหน้าไปนาน เลยวิชาอังกฤษ (40)
  const back = e.call('api_open', tok);
  assert.equal(back.currentIdx, 1); assert.equal(back.subjects[0].status, 'done');
  assert.equal(back.remainingMs, 25 * MIN);
  assert.ok(back.questions.every((q) => q.qid.startsWith('TH-')));
  const r = e.call('api_saveAnswer', st.sessionId, { qid: q1, chosen: 'A' });   // ข้อของวิชาที่ปิดแล้ว
  assert.equal(r.ok, false); assert.equal(r.reason, 'late');                     // เกิน grace แล้ว
  assert.equal(e.table('Sessions')[0].status, 'in_progress');
});

test('Mock เต็มชุด: กด "วิชาถัดไป" เอง -> วิชาใหม่เริ่มตอนกด, วิชาเดิมล็อก, ส่งท้ายสุดจบ session', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e, { mode: 'mock_full' }), {});
  const en1 = st.questions[0].qid;
  e.clock.t += 12 * MIN;
  const s2 = e.call('api_next', st.sessionId);
  assert.equal(s2.currentIdx, 1); assert.equal(s2.remainingMs, 40 * MIN);
  assert.equal(e.call('api_saveAnswer', st.sessionId, { qid: en1, chosen: 'A' }).reason, 'closed');
  e.clock.t += 5 * MIN;
  const s3 = e.call('api_next', st.sessionId);
  assert.equal(s3.currentIdx, 2); assert.equal(s3.remainingMs, 50 * MIN); assert.equal(s3.isLast, true);
  e.clock.t += 60000;
  const done = e.call('api_next', st.sessionId);
  assert.equal(done.phase, 'done');
  const s = e.table('Sessions')[0];
  assert.equal(s.status, 'submitted'); assert.equal(s.submit_reason, 'manual');
  assert.equal(e.call('api_saveAnswer', st.sessionId, { qid: s3.questions[0].qid, chosen: 'A' }).ok, false);
});

test('api_ping (ซิงก์นาฬิกาทุก 30 วินาที) คืนเวลาที่เหลือจริงและตรวจพบการหมดเวลา', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'english' });
  e.clock.t += 90000;
  assert.equal(e.call('api_ping', st.sessionId).remainingMs, 40 * MIN - 90000);
  e.clock.t += 40 * MIN;
  assert.equal(e.call('api_ping', st.sessionId).phase, 'done');
});

test('sweepExpiredSessions ปิด session ที่ไม่มีใครเปิด (trigger) และคำนวณผลให้ครบทุกวิชา', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e, { mode: 'mock_full' }), {});
  e.clock.t += 3 * 60 * MIN;
  assert.equal(e.call('sweepExpiredSessions'), 1);
  const s = e.table('Sessions')[0];
  assert.equal(s.status, 'expired_auto'); assert.equal(Number(s.n_total), 15); assert.equal(Number(s.n_skipped), 15);
  assert.equal(Number(s.submitted_ms), Number(s.started_ms) + 130 * MIN);
  assert.equal(new Set(e.table('Results').map((r) => r.subject)).size, 3);
});

test('นโยบายเฉลย parent_release: ลูกไม่เห็นคะแนน/เฉลยจนผู้ปกครองเปิดให้; แล้วทบทวนได้ครบ', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
  answerAll(e, st, (q) => correctOf(e, st.sessionId, q.qid));
  const done = e.call('api_next', st.sessionId);
  assert.equal(done.phase, 'done'); assert.equal(done.canReview, false); assert.equal(done.summary, undefined);
  assert.equal(e.call('api_getReview', st.sessionId).ok, false);
  assert.equal(e.call('api_report', st.sessionId, 'AR-COL-001', 'x').ok, false);
  e.call('dash_releaseReview', '', st.sessionId, true);
  const rv = e.call('api_getReview', st.sessionId);
  assert.equal(rv.ok, true); assert.equal(rv.summary.score_pct, 100); assert.equal(rv.items.length, 5);
  const it = rv.items[0];
  assert.ok(it.explanation && it.takeaway && it.choices.every((c) => c.why));
  assert.equal(it.isCorrect, true);
});

test('นโยบาย immediate: เห็นคะแนนและเฉลยทันทีหลังส่ง', () => {
  const e = freshEnv(); e.setSetting('reveal_policy', 'immediate');
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
  const done = e.call('api_next', st.sessionId);
  assert.equal(done.canReview, true); assert.equal(done.summary.n_total, 5); assert.equal(done.summary.n_skipped, 5);
});

test('แจ้งเฉลยผิด: เขียน Reports, ข้อสอบถูกตั้งเป็น flagged, ผู้ปกครองปิดเรื่อง/พักข้อได้', () => {
  const e = freshEnv(); e.setSetting('reveal_policy', 'immediate');
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
  e.call('api_next', st.sessionId);
  assert.equal(e.call('api_report', st.sessionId, 'AR-COL-001', 'น่าจะเป็นสีเขียว').ok, true);
  assert.equal(e.table('Reports').length, 1);
  assert.equal(e.table('Questions').find((q) => q.id === 'AR-COL-001').status, 'flagged');
  const b = e.call('dash_getBundle', '');
  assert.equal(b.reports.length, 1); assert.equal(b.reports[0].status, 'open');
  e.call('dash_resolveReport', '', b.reports[0].report_id, 'resolved', 'ตรวจแล้วเฉลยถูก', true);
  assert.equal(e.table('Questions').find((q) => q.id === 'AR-COL-001').status, 'retired');
});

test('ผลรายทักษะ + Dashboard: % สี "(จาก n ข้อ)" ถูกต้อง และไม่มีค่า Date ที่ส่งผ่าน google.script.run ไม่ได้', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'english' });
  answerAll(e, st, (q) => {
    const c = correctOf(e, st.sessionId, q.qid);
    const skill = e.table('Answers').find((a) => a.session_id === st.sessionId && a.question_id === q.qid).skill;
    if (skill === 'Grammar') return c === 'A' ? 'B' : 'A';          // ผิด
    if (skill === 'Reading' && q.qid === 'EN-REA-002') return null;  // ข้าม
    return c;
  });
  e.call('api_next', st.sessionId);
  const b = e.call('dash_getBundle', '');
  const sk = Object.fromEntries(b.skillStats.english.map((x) => [x.skill, x]));
  assert.deepEqual([sk.Vocabulary.pct, sk.Vocabulary.color, sk.Vocabulary.n], [100, 'green', 1]);
  assert.deepEqual([sk.Grammar.pct, sk.Grammar.color], [0, 'red']);
  assert.deepEqual([sk.Reading.pct, sk.Reading.color, sk.Reading.n], [50, 'red', 2]);
  assert.deepEqual([sk['Error Identification'].pct], [100]);
  assert.equal(b.subjectStats.english.pct, 60);                     // 3/5
  assert.equal(b.latest.english.pct, 60); assert.equal(b.overall.pct, 60);
  assert.equal(b.skillStats.art[0].color, 'none');                  // ยังไม่เคยสอบ
  assert.equal(b.sessions[0].mode, 'mock_subject');
  assert.equal(b.difficulty.english[1].n, 2);
  assert.equal(b.timeStats.english.find((x) => x.skill === 'Vocabulary').avg_sec, 1);
});

test('ภาพรวมใช้ผลล่าสุดต่อวิชา; Drill ไม่ปนกับ Mock; ป้ายโหมดแยกชัด', () => {
  const e = freshEnv(); e.setSetting('reveal_policy', 'immediate');
  const mk = (subject, pickWrong) => {
    const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject });
    answerAll(e, st, (q) => { const c = correctOf(e, st.sessionId, q.qid); return pickWrong ? (c === 'A' ? 'B' : 'A') : c; });
    e.clock.t += 1000;
    e.call('api_next', st.sessionId);
    e.clock.t += 60000;
  };
  mk('english', true);     // 0%
  mk('english', false);    // 100% (ล่าสุด)
  mk('art', true);         // 0%
  let b = e.call('dash_getBundle', '');
  assert.equal(b.latest.english.pct, 100); assert.equal(b.latest.art.pct, 0);
  assert.equal(b.overall.pct, 50);
  // Drill เลือกเอง ตอบผิด ไม่ควรกระทบภาพรวม/ทักษะ
  const d = e.call('api_start', newLink(e), { mode: 'drill_custom', subject: 'english', skills: ['Grammar'], count: 1, minutes: 2 });
  e.call('api_saveAnswer', d.sessionId, { qid: d.questions[0].qid, chosen: 'A', confirm: true });
  e.call('api_next', d.sessionId);
  b = e.call('dash_getBundle', '');
  assert.equal(b.overall.pct, 50); assert.equal(b.skillStats.english.find((x) => x.skill === 'Grammar').n, 2);
  assert.ok(b.sessions.some((s) => s.mode === 'drill_custom'));
  assert.equal(b.history.english.length, 2);                         // กราฟพัฒนาการนับเฉพาะ Mock
  e.setSetting('skill_include_drill', true);
  b = e.call('dash_getBundle', '');
  assert.equal(b.skillStats.english.find((x) => x.skill === 'Grammar').n, 3);
});

test('Drill อัตโนมัติ: ปิดจนกว่าวิชานั้นมี Mock; เปิดแล้วเลือกเฉพาะทักษะ 🔴🟡', () => {
  const e = freshEnv(); e.setSetting('reveal_policy', 'immediate');
  const tok = newLink(e);
  const lobby = e.call('api_open', tok);
  assert.ok(lobby.subjects.every((s) => s.drillAutoReady === false));
  assert.throws(() => e.call('api_start', tok, { mode: 'drill_auto', subject: 'english' }), /Mock/);
  // ทำ Mock อังกฤษ: Vocabulary ถูก, Grammar ผิด, Reading ถูก, Error ผิด
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'english' });
  answerAll(e, st, (q) => {
    const row = e.table('Answers').find((a) => a.session_id === st.sessionId && a.question_id === q.qid);
    return ['Grammar', 'Error Identification'].includes(row.skill) ? (row.correct === 'A' ? 'B' : 'A') : row.correct;
  });
  e.call('api_next', st.sessionId);
  const l2 = e.call('api_open', tok);
  assert.equal(l2.subjects.find((s) => s.subject === 'english').drillAutoReady, true);
  assert.equal(l2.subjects.find((s) => s.subject === 'art').drillAutoReady, false);
  const d = e.call('api_start', tok, { mode: 'drill_auto', subject: 'english', count: 2 });
  const skills = d.questions.map((q) => e.table('Answers').find((a) => a.session_id === d.sessionId && a.question_id === q.qid).skill);
  assert.ok(skills.every((s) => ['Grammar', 'Error Identification'].includes(s)), skills.join());
  assert.equal(d.drill, true); assert.equal(d.remainingMs, 2 * MIN);
});

test('Drill: เฉลยทันทีหลังยืนยันคำตอบ แล้วล็อกข้อนั้น (เปลี่ยนคำตอบไม่ได้); รีเฟรชแล้วเฉลยยังอยู่', () => {
  const e = freshEnv();
  const st = e.call('api_start', newLink(e), { mode: 'drill_custom', subject: 'art', skills: ['ทฤษฎีสี'], count: 2, minutes: 5 });
  const q = st.questions[0];
  assert.equal(q.reveal, undefined);
  const right = correctOf(e, st.sessionId, q.qid);
  const wrong = right === 'A' ? 'B' : 'A';
  const r1 = e.call('api_saveAnswer', st.sessionId, { qid: q.qid, chosen: wrong, confirm: true });
  assert.equal(r1.reveal.correct, false); assert.equal(r1.reveal.answer, right); assert.ok(r1.reveal.explanation);
  const r2 = e.call('api_saveAnswer', st.sessionId, { qid: q.qid, chosen: right, confirm: true });
  assert.equal(r2.reveal.correct, false);                                  // ยังเป็นคำตอบแรก
  assert.equal(e.table('Answers').find((a) => a.question_id === q.qid).chosen, wrong);
  const again = e.call('api_getState', st.sessionId);
  assert.equal(again.questions.find((x) => x.qid === q.qid).reveal.answer, right);
  assert.equal(again.questions.find((x) => x.qid !== q.qid).reveal, undefined);
  const done = e.call('api_next', st.sessionId);                           // Drill เห็นสรุปทันที
  assert.equal(done.canReview, true); assert.equal(done.summary.n_wrong, 1);
});

test('คลังไม่พอสำหรับ blueprint: เริ่มสอบด้วยจำนวนที่มีและบันทึก shortfall; คลังว่างแจ้งข้อผิดพลาดชัดเจน', () => {
  const e = freshEnv();
  e.setSetting('blueprint_art', 'ทฤษฎีสี=9;องค์ประกอบภาพ=1');
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
  assert.equal(st.questions.length, 3);
  assert.equal(JSON.parse(e.table('Sessions')[0].config_json).shortfall['art/ทฤษฎีสี'], 7);
  const e2 = freshEnv();
  e2.ss.getSheetByName('Questions').data = [e2.ss.getSheetByName('Questions').data[0]];
  e2.run('clearQuestionCache_()');
  assert.throws(() => e2.call('api_start', newLink(e2), { mode: 'mock_subject', subject: 'art' }), /ไม่มีข้อสอบ/);
});

test('สุ่มซ้ำหลายรอบ: เลี่ยงข้อที่เพิ่งทำเมื่อคลังพอ (วิชาศิลป์ 5 ข้อ ขอ 2 ข้อ/รอบ)', () => {
  const e = freshEnv(); e.setSetting('avoid_recent_sessions', 2);
  e.setSetting('blueprint_art', 'ทฤษฎีสี=1;องค์ประกอบภาพ=1;ทัศนธาตุและหลักการออกแบบ=1;โลโก้และไอคอน=1');
  const seenPerRound = [];
  for (let i = 0; i < 2; i++) {
    const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
    seenPerRound.push(st.questions.map((q) => q.qid));
    e.call('api_next', st.sessionId); e.clock.t += 60000;
  }
  const colors = seenPerRound.map((r) => r.filter((id) => id.startsWith('AR-COL')));
  assert.notEqual(colors[0][0], colors[1][0]);                              // ทฤษฎีสีมี 2 ข้อ: รอบสองต้องได้อีกข้อ
});

test('ชีตจริงจำกัด 1000 แถว × 26 คอลัมน์: เตรียมระบบขยาย Sessions (27 คอลัมน์) และต่อท้าย Answers เกิน 1000 แถวได้', () => {
  const e = freshEnv();
  assert.ok(e.ss.getSheetByName('Sessions').getMaxColumns() >= 27);
  const ans = e.ss.getSheetByName('Answers');
  for (let i = 0; i < 995; i++) ans.data.push(['filler' + i]);         // เหมือนสอบมาแล้วหลายสิบรอบ
  const st = e.call('api_start', newLink(e, { mode: 'mock_full' }), {});
  assert.equal(st.phase, 'exam');
  assert.ok(ans.getLastRow() > 1000);
  e.clock.t += 1000;
  assert.equal(e.call('api_saveAnswer', st.sessionId, { qid: st.questions[0].qid, chosen: 'A' }).ok, true);
  e.clock.t += 4 * 60 * MIN;
  assert.equal(e.call('sweepExpiredSessions'), 1);
  assert.equal(e.table('Sessions')[0].status, 'expired_auto');
});

test('รูปประกอบ: โจทย์ดูได้ระหว่างสอบ, รูปคำอธิบายดูได้เมื่อเปิดเฉลยหรือ Drill ที่ตอบแล้ว', () => {
  const e = freshEnv();
  e.setSetting('images_folder_id', 'FOLDER1');
  e.env.files = { F1: { name: 'wheel.png', folder: 'FOLDER1', type: 'image/png', bytes: [1, 2, 3] },
    F2: { name: 'wheel-ans.png', folder: 'FOLDER1', type: 'image/png', bytes: [4, 5] } };
  const qs = e.ss.getSheetByName('Questions'), h = qs.data[0];
  const row = qs.data.find((r) => r[0] === 'AR-COL-001');
  row[h.indexOf('image_url')] = 'drive:wheel.png';
  row[h.indexOf('explanation_image_url')] = 'drive:wheel-ans.png';
  e.run('clearQuestionCache_()');
  const st = e.call('api_start', newLink(e), { mode: 'drill_custom', subject: 'art', skills: ['ทฤษฎีสี'], count: 2, minutes: 5 });
  const q = st.questions.find((x) => x.qid === 'AR-COL-001');
  assert.equal(q.hasImage, true);
  assert.equal(e.call('api_getImage', st.sessionId, 'AR-COL-001', 'q').src, 'data:image/png;base64,' + Buffer.from([1, 2, 3]).toString('base64'));
  assert.throws(() => e.call('api_getImage', st.sessionId, 'AR-COL-001', 'e'), /ยังดูไม่ได้/);   // ยังไม่ได้ตอบ
  const r = e.call('api_saveAnswer', st.sessionId, { qid: 'AR-COL-001', chosen: 'B', confirm: true });
  assert.equal(r.reveal.hasExplImage, true);
  assert.ok(e.call('api_getImage', st.sessionId, 'AR-COL-001', 'e').src.startsWith('data:image/png;base64,'));
  assert.throws(() => e.call('api_getImage', st.sessionId, 'EN-VOC-001', 'q'), /ไม่พบข้อนี้/);   // ข้อที่ไม่อยู่ใน session
  // Mock ที่ยังไม่เปิดเฉลย ดูรูปคำอธิบายไม่ได้ แต่ผู้ปกครองดูได้
  const m = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
  e.call('api_next', m.sessionId);
  assert.throws(() => e.call('api_getImage', m.sessionId, 'AR-COL-001', 'e'), /ยังดูไม่ได้/);
  assert.ok(e.call('dash_getImage', '', 'AR-COL-001', 'e').src.startsWith('data:'));
  assert.equal(e.call('dash_getSession', '', m.sessionId).items.find((x) => x.qid === 'AR-COL-001').hasExplImage, true);
});

test('รูปฝังในเซลล์ (data:image/…) ส่งกลับได้ทันทีโดยไม่ต้องใช้ Drive', () => {
  const e = freshEnv();
  const uri = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
  const qs = e.ss.getSheetByName('Questions'), h = qs.data[0];
  qs.data.find((r) => r[0] === 'AR-LOG-001')[h.indexOf('image_url')] = uri;
  e.run('clearQuestionCache_()');
  const st = e.call('api_start', newLink(e), { mode: 'mock_subject', subject: 'art' });
  assert.equal(st.questions.find((q) => q.qid === 'AR-LOG-001').hasImage, true);
  assert.equal(e.call('api_getImage', st.sessionId, 'AR-LOG-001', 'q').src, uri);
});

test('เมนูนำเข้าคลังที่แนบมา (Bank*.gs): ได้ 437 ข้อครบ รูปฝังในเซลล์ และกดซ้ำไม่เพิ่มซ้ำ', () => {
  const e = freshEnv();
  const qs = e.ss.getSheetByName('Questions');
  qs.data = [qs.data[0]];
  const r1 = J(e.run('importBundledBank_()'));
  assert.equal(r1.added, 437);
  const rep = J(e.run('validateQuestions_(loadQuestionsRaw_())'));
  assert.equal(rep.ok, 437); assert.equal(rep.errors.length, 0);
  assert.equal(e.table('Questions').filter((q) => String(q.image_url).startsWith('data:image/svg+xml;base64,')).length, 21);
  assert.equal(J(e.run('importBundledBank_()')).added, 0);
  const st = e.call('api_start', newLink(e, { mode: 'mock_full' }), {});
  assert.equal(st.phase, 'exam');
  assert.deepEqual(JSON.parse(e.table('Sessions')[0].config_json).shortfall, {});
});

test('ข้อมูล fact_date ที่ Sheets แปลงเป็นวันที่ ยังอ่านเป็นข้อความ yyyy-mm-dd', () => {
  const e = freshEnv();
  const q = e.run('loadQuestions_(true)').find((x) => x.id === 'TH-NEW-001');
  assert.equal(q.fact_date, '2024-07-31');
});

test('ตรวจคลังข้อสอบ: แถวผิดรูปแบบถูกรายงานและไม่ถูกนำไปออกสอบ', () => {
  const e = freshEnv();
  const sh = e.ss.getSheetByName('Questions');
  const h = sh.data[0];
  const row = h.map(() => ''); row[h.indexOf('id')] = 'BAD-1'; row[h.indexOf('subject')] = 'art'; row[h.indexOf('skill')] = 'ไม่มีทักษะนี้';
  sh.data.push(row);
  const dup = sh.data[1].slice(); sh.data.push(dup);
  e.run('clearQuestionCache_()');
  const rep = J(e.run('validateQuestions_(loadQuestionsRaw_())'));
  assert.equal(rep.total, 17); assert.equal(rep.ok, 15); assert.equal(rep.errors.length, 2);
  assert.ok(rep.errors.some((m) => /id ซ้ำ/.test(m)));
  assert.equal(e.run('loadQuestions_(true)').length, 15);
});

console.log(`\nผ่าน ${passed} / ล้มเหลว ${failed}`);
process.exit(failed ? 1 : 0);
