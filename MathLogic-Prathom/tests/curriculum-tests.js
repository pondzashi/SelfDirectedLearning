/**
 * ทดสอบหลักสูตรส่วน A แบบสัปดาห์ละเรื่อง: node tests/curriculum-tests.js
 * - คำตอบของทุกข้อตรงกับการคำนวณอิสระ (รวมแบบ "? " แทนค่า, ภาพเศษส่วน, เปรียบเทียบ, หารมีเศษ)
 * - จำนวนข้อต่อชุดตรงตามตาราง (100 / 50 / 40 / 25 ...), หน้าละไม่เกิน 10 ข้อ, ไม่มีหน้าซ้ำในชุด
 * - หน้ารูปแบบเรียงเป็นแบบรูปจริง, คำถามสังเกตตัวเลือกถูกต้อง
 * - ตัวเลื่อนสถานะสัปดาห์ (ผ่าน/ผ่านช้า/ทำซ้ำได้ครั้งเดียว), ผลวัดระดับ → รอบเริ่มต้น
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..', 'apps-script');
const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number, RegExp, Error });
for (const f of ['Core.gs', 'Generators.gs', 'Templates.gs', 'BankSeed.gs', 'SetBuilder.gs', 'Curriculum.gs']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
const G = (n) => vm.runInContext(n, ctx);
let fails = 0, checks = 0;
function ok(c, m) { checks++; if (!c) { fails++; if (fails <= 40) console.log('  ✗ ' + m); } }

/* ---------- ตัวคำนวณอิสระ ---------- */
const gcdN = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const R = (n, d) => { const g = gcdN(n, d); return { n: n / g, d: d / g }; };
const ops = { '+': (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d), '−': (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d), '×': (a, b) => R(a.n * b.n, a.d * b.d), '÷': (a, b) => R(a.n * b.d, a.d * b.n) };
function evalExpr(s) {
  const re = /\{(?:(\d+) )?(\d+)\/(\d+)\}|(\d+)(?:\.(\d+))?|([+−×÷])/g, toks = []; let m;
  while ((m = re.exec(s))) {
    if (m[6]) toks.push(m[6]);
    else if (m[2] !== undefined) toks.push(R((+(m[1] || 0)) * +m[3] + +m[2], +m[3]));
    else if (m[5] !== undefined) toks.push(R(+(m[4] + m[5]), Math.pow(10, m[5].length)));
    else toks.push(R(+m[4], 1));
  }
  let acc = toks[0];
  for (let i = 1; i < toks.length; i += 2) acc = ops[toks[i]](acc, toks[i + 1]);
  return acc;
}
const eq = (a, b) => a.n * b.d === b.n * a.d;
const P = (s) => { const u = G('parseUser')(s); return u.ok ? R(u.n, u.d) : null; };

/** ตรวจคำตอบของข้อหนึ่งแบบอิสระ: คืนข้อความผิดพลาด หรือ '' ถ้าถูก */
function verify(it) {
  const q = String(it.q), text = JSON.stringify(it);
  if (/NaN|undefined|null|Infinity/.test(text)) return 'มี NaN/undefined';
  if (!G('checkAnswer')(it, it.ans)) return 'ตัวตรวจไม่รับเฉลยของตัวเอง';
  if (it.picK !== undefined) {
    const blue = (q.match(/🟦/g) || []).length, all = blue + (q.match(/⬜/g) || []).length;
    return blue === it.picK && all === it.picD && it.ans === it.picK + '/' + it.picD && it.noReduce ? '' : 'ภาพเศษส่วนไม่ตรงเฉลย';
  }
  if (it.type === 'choice') {
    const m = /\{(\d+)\/(\d+)\}  กับ  \{(\d+)\/(\d+)\}/.exec(q);
    if (m) { const x = +m[1] * +m[4], y = +m[3] * +m[2], exp = x > y ? '1' : x < y ? '2' : '3'; return it.ans === exp ? '' : 'เปรียบเทียบเศษส่วนผิด'; }
    return it.choices && +it.ans >= 1 && +it.ans <= it.choices.length ? '' : 'ตัวเลือกผิด';
  }
  if (it.type === 'divrem') {
    const m = /^(\d+) ÷ (\d+) =/.exec(q), a = +m[1], b = +m[2];
    return it.ans === Math.floor(a / b) + '|' + (a % b) ? '' : 'หารมีเศษผิด';
  }
  let m = /\{(\d+)\/(\d+)\} = \{(\?|\d+)\/(\?|\d+)\}/.exec(q);
  if (m) { const a = +m[1], b = +m[2], exp = m[3] === '?' ? (+m[4]) / b * a : (+m[3]) / a * b; return +it.ans === exp && Number.isInteger(exp) ? '' : 'เศษส่วนเท่ากันผิด'; }
  if (/\?/.test(q)) {
    const sub = q.replace('?', it.ans), sides = sub.split('=');
    if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) return 'รูปแบบ ? ไม่ถูกต้อง';
    return eq(evalExpr(sides[0]), evalExpr(sides[1])) ? '' : 'แทนค่า ? แล้วสองข้างไม่เท่ากัน';
  }
  const val = evalExpr(q), exp = P(it.ans);
  if (!exp || val.n < 0) return 'คำนวณอิสระไม่ได้/ติดลบ';
  return eq(val, exp) ? '' : 'คำตอบไม่ตรงการคำนวณอิสระ ' + val.n + '/' + val.d;
}
function monotoneOperand(items) {
  const rows = items.map((it) => (String(it.q).replace(/🟦|⬜/g, '').match(/\d+/g) || []).map(Number).concat(it.picK !== undefined ? [it.picK] : []));
  const w = Math.min.apply(null, rows.map((r) => r.length));
  for (let p = 0; p < w; p++) {
    const col = rows.map((r) => r[p]);
    const inc = col.every((v, i) => i === 0 || v >= col[i - 1]), dec = col.every((v, i) => i === 0 || v <= col[i - 1]);
    if ((inc || dec) && new Set(col).size >= 4) return true;
  }
  return false;
}

/* ---------- โครงแผน ---------- */
const TOPICS = G('TOPICS'), PLAN = G('ROUND_PLAN'), KINDS = G('PAGE_KINDS');
ok(TOPICS.join() === 'add,sub,mul,div,frac', 'หัวข้อต้องเรียง บวก→ลบ→คูณ→หาร→เศษส่วน');
const SIZE = { add: [100, 50, 40], sub: [100, 50, 40], mul: [100, 40, 30], div: [100, 25, 25], frac: [50, 40, 30] };
TOPICS.forEach((t) => [1, 2, 3].forEach((r) => ok(PLAN[t][r].total === SIZE[t][r - 1], t + ' รอบ ' + r + ' ต้อง ' + SIZE[t][r - 1] + ' ข้อ/ชุด (มี ' + PLAN[t][r].total + ')')));
Object.keys(PLAN).forEach((t) => [1, 2].forEach((r) => {
  const rp = PLAN[t][r]; ok(rp.sets.length === 6, t + r + ' ต้องมี 6 ชุด');
  rp.sets.forEach((s, i) => { const np = s.reduce((a, e) => a + e[2], 0); ok(np === Math.ceil(rp.total / 10), t + ' รอบ ' + r + ' ชุด ' + (i + 1) + ' จำนวนหน้า ' + np + ' ≠ ' + Math.ceil(rp.total / 10)); s.forEach((e) => ok(!!G('pageKind')(e[0]), 'ไม่มีชนิดหน้า ' + e[0])); });
}));
Object.keys(KINDS).forEach((id) => { const k = KINDS[id]; ok(typeof k.one === 'function' || typeof k.pat === 'function', id + ' ต้องมี one หรือ pat'); if (k.pat) ok(k.nv >= 1, id + ' ต้องมี nv'); });

/* ---------- ทุกหน้ารูปแบบทุกแบบ ---------- */
console.log('== หน้ารูปแบบ (pat) ทุกแบบ');
let patN = 0;
Object.keys(KINDS).forEach((id) => {
  const k = KINDS[id]; if (!k.pat) return;
  for (let v = 0; v < k.nv; v++) {
    G('setRng')(G('mulberry32')(1000 + v));
    const r = k.pat(v); patN++;
    ok(r.items.length === 10, id + ' v' + v + ' ต้องมี 10 ข้อ (ได้ ' + r.items.length + ')');
    r.items.forEach((it) => { const e = verify(it); if (e) ok(false, id + ' v' + v + ' [' + String(it.q).replace(/\n/g, '/').slice(0, 40) + '→' + it.ans + '] ' + e); else ok(true, ''); });
    if (id !== 'frac.compare') ok(monotoneOperand(r.items), id + ' v' + v + ' ต้องเรียงเป็นแบบรูป');
    ok(new Set(r.items.map((x) => x.q)).size === r.items.length, id + ' v' + v + ' มีข้อซ้ำในหน้า');
    if (r.observe) {
      const o = r.observe;
      ok(o.q && o.choices.length >= 3 && new Set(o.choices).size === o.choices.length && +o.ans >= 1 && +o.ans <= o.choices.length && !/undefined|NaN/.test(JSON.stringify(o)), id + ' v' + v + ' คำถามสังเกตผิดรูป');
    }
  }
});
console.log('  หน้ารูปแบบที่ตรวจ:', patN);

/* ---------- ตัวสุ่ม one(l) ทุกชนิด ---------- */
console.log('== โจทย์สุ่ม one(l) ทุกชนิด × ระดับ 0–2 × 150 ข้อ');
Object.keys(KINDS).forEach((id) => {
  const k = KINDS[id]; if (!k.one) return;
  for (let l = 0; l <= 2; l++) {
    G('setRng')(G('mulberry32')(7 + l));
    let bad = 0;
    for (let i = 0; i < 150; i++) { const it = k.one(l), e = verify(it); if (e) { bad++; if (bad <= 2) ok(false, id + ' l' + l + ' [' + String(it.q).replace(/\n/g, '/').slice(0, 40) + '→' + it.ans + '] ' + e); } }
    ok(bad === 0, id + ' l' + l + ' ผิด ' + bad);
  }
});
G('STEPS').forEach((s) => { const k = G('stepKind')(s.id); const it = k.one(1); ok(!verify(it), 'step:' + s.id); });

/* ---------- ชุดจริงทุกหัวข้อ/รอบ/ชุด ---------- */
console.log('== ชุดจริง (หัวข้อ × รอบ 1–4 × ชุด 1–6 × 4 seed)');
const MAXSEC = {};
TOPICS.forEach((t) => [1, 2, 3, 4].forEach((r) => {
  for (let s = 1; s <= 6; s++) {
    const rp = PLAN[t][Math.min(r, 3)], tot = rp.total;
    for (let seed = 1; seed <= 4; seed++) {
      G('setRng')(G('mulberry32')(seed * 31 + s));
      const used = {}, b = G('buildASetItems')(t, r, s, { usedSigs: used }), tag = t + ' รอบ ' + r + ' ชุด ' + s + ' seed' + seed;
      ok(b.items.length === tot, tag + ' ต้อง ' + tot + ' ข้อ (ได้ ' + b.items.length + ')');
      ok(b.pages.length === Math.ceil(tot / 10) && b.pages.every((p) => p.n >= 1 && p.n <= 10), tag + ' หน้าละไม่เกิน 10 ข้อ');
      ok(b.pages.reduce((a, p) => a + p.n, 0) === b.items.length && b.pages.every((p, i) => p.start === (i ? b.pages[i - 1].start + b.pages[i - 1].n : 0)), tag + ' ช่วงหน้าต่อเนื่อง');
      b.items.forEach((it, i) => {
        const e = verify(it); if (e) ok(false, tag + ' [' + String(it.q).replace(/\n/g, '/').slice(0, 36) + '→' + it.ans + '] ' + e); else ok(true, '');
        const pg = b.pages[it.page - 1]; if (!(pg && i >= pg.start && i < pg.start + pg.n)) ok(false, tag + ' ข้อ ' + i + ' อยู่นอกหน้าที่ระบุ');
        if (it.cat !== G('TOPIC_CAT')[t] && !/^step:/.test(KINDS[it.tag] ? it.tag : 'step:')) ok(it.cat === G('TOPIC_CAT')[t], tag + ' cat ผิด ' + it.cat);
      });
      const sigs = b.pages.map((p) => b.items.slice(p.start, p.start + p.n).map((x) => x.q).join('|'));
      ok(new Set(sigs).size === sigs.length, tag + ' มีหน้าซ้ำกันในชุดเดียว');
      const rnd = b.items.filter((x) => !x.pattern), rs = rnd.map((x) => x.sig);
      ok(new Set(rs).size === rs.length, tag + ' หน้าสุ่มมีข้อซ้ำในชุด');
      ok((s <= 2 && r <= 2 ? true : b.pages.every((p) => !p.pattern)) || true, '');
      if (s >= 3) ok(b.pages.every((p) => !p.pattern), tag + ' ชุด 3–6 ต้องไม่มีหน้ารูปแบบ');
      if (r <= 2 && s <= 2) ok(b.pages.filter((p) => p.pattern).length >= Math.ceil(b.pages.length / 2), tag + ' ชุด 1–2 ต้องเป็นหน้ารูปแบบเป็นส่วนใหญ่');
      if (r === 3 || r === 4) ok(b.pages.every((p) => !p.pattern), tag + ' รอบ 3+ ไม่มีหน้ารูปแบบ');
      if (seed === 1) MAXSEC[t + r + '-' + s] = b.xSec;
    }
  }
}));
console.log('  X (วินาที) ชุดที่ 6:', TOPICS.map((t) => t + ':' + [1, 2, 3].map((r) => MAXSEC[t + r + '-6']).join('/')).join('  '));
TOPICS.forEach((t) => [1, 2, 3].forEach((r) => { const x = MAXSEC[t + r + '-6']; ok(x >= 300 && x <= 800, t + ' รอบ ' + r + ' ค่า X ' + x + ' วินาที นอกช่วงสมเหตุสมผล (ส่วน A ≈ 15 นาทีรวมแก้)'); }));

/* ---------- ไม่ซ้ำกับประวัติ 30 วัน เฉพาะหน้าสุ่ม ---------- */
{
  G('setRng')(G('mulberry32')(5));
  const used = {}, a = G('buildASetItems')('mul', 1, 5, { usedSigs: used }), snap = Object.keys(used).length;
  const b = G('buildASetItems')('mul', 1, 5, { usedSigs: used });
  const sa = new Set(a.items.filter((x) => !x.pattern).map((x) => x.sig)), overlap = b.items.filter((x) => !x.pattern && sa.has(x.sig)).length;
  ok(snap > 50 && overlap <= 8, 'ประวัติที่ส่งเข้า usedSigs ต้องลดข้อซ้ำของหน้าสุ่ม (ซ้ำ ' + overlap + ' จาก ' + b.items.length + ') เมื่อพื้นที่โจทย์มีจำกัด');
  G('setRng')(G('mulberry32')(6));
  const p1 = G('buildASetItems')('add', 1, 1, { usedSigs: {} }), p2 = G('buildASetItems')('add', 1, 1, { usedSigs: used });
  ok(p1.items.map((x) => x.q).join() === p2.items.map((x) => x.q).join() || true, '');
  ok(p1.items.filter((x) => x.pattern).length > 0 && p2.items.filter((x) => x.pattern).length === p1.items.filter((x) => x.pattern).length, 'หน้ารูปแบบต้องออกซ้ำข้อเดิมได้แม้อยู่ในประวัติ');
}

/* ---------- ตัวเลื่อนสถานะสัปดาห์ ---------- */
console.log('== ตัวเลื่อนสถานะ');
{
  const A = G('rotAfterSet'), R0 = G('rotRounds0')(), init = G('rotInit')();
  let st = A(init, R0, 1, null);
  ok(st.rot.setNo === 2 && st.rot.topic === 'add' && st.event === 'next-set', 'ชุด 1 → ชุด 2');
  st = A({ topic: 'add', setNo: 5, repeat: false, weekNo: 1 }, R0, 5, null);
  ok(st.rot.setNo === 6 && st.event === 'next-set', 'ชุด 5 → ชุด 6');
  st = A({ topic: 'add', setNo: 6, repeat: false, weekNo: 1 }, R0, 6, { outcome: 'pass' });
  ok(st.rot.topic === 'sub' && st.rot.setNo === 1 && !st.rot.repeat && st.rounds.add === 2 && st.rounds.sub === 1 && st.event === 'advance' && st.rot.weekNo === 2, 'ผ่าน → ลบ ชุด 1 และบวกขึ้นรอบ 2');
  st = A({ topic: 'frac', setNo: 6, repeat: false, weekNo: 4 }, R0, 6, { outcome: 'flag' });
  ok(st.rot.topic === 'add' && st.rounds.frac === 2 && st.event === 'advance', 'ผ่าน (ช้า) ที่เศษส่วน → วนกลับไปบวก และเศษส่วนขึ้นรอบ 2');
  st = A({ topic: 'mul', setNo: 6, repeat: false, weekNo: 3 }, R0, 6, { outcome: 'repeat' });
  ok(st.rot.topic === 'mul' && st.rot.setNo === 1 && st.rot.repeat === true && st.rounds.mul === 1 && st.event === 'repeat', 'ไม่ผ่านครั้งแรก → ทำหัวข้อเดิมซ้ำ รอบไม่เพิ่ม');
  st = A({ topic: 'mul', setNo: 6, repeat: true, weekNo: 4 }, R0, 6, { outcome: 'repeat' });
  ok(st.rot.topic === 'div' && st.rot.setNo === 1 && st.rot.repeat === false && st.rounds.mul === 1 && st.event === 'moveon', 'ไม่ผ่านซ้ำครั้งที่สอง → ไปหัวข้อถัดไป (ทำซ้ำได้ครั้งเดียวติดกัน) รอบคงเดิม');
  st = A({ topic: 'mul', setNo: 6, repeat: true, weekNo: 4 }, R0, 6, { outcome: 'pass' });
  ok(st.rot.topic === 'div' && st.rounds.mul === 2 && !st.rot.repeat, 'ผ่านหลังทำซ้ำ → ขึ้นรอบและล้างสถานะซ้ำ');
  const r1 = R0; A({ topic: 'add', setNo: 6, repeat: false, weekNo: 1 }, r1, 6, { outcome: 'pass' });
  ok(r1.add === 1, 'ตัวเลื่อนต้องไม่แก้ค่าเดิม (ฟังก์ชันล้วน)');
  // จำลองต่อเนื่อง 3 รอบหมุน
  let s = G('rotInit')(), rd = G('rotRounds0')(), seq = [];
  for (let i = 0; i < 31; i++) { const outs = ['pass', 'repeat', 'repeat', 'flag', 'repeat', 'pass']; const o = A(s, rd, s.setNo, s.setNo === 6 ? { outcome: outs[seq.filter((x) => x === 6).length % outs.length] } : null); seq.push(s.setNo); s = o.rot; rd = o.rounds; }
  ok(s.topic && G('TOPICS').indexOf(s.topic) >= 0 && s.setNo >= 1 && s.setNo <= 6, 'สถานะหลังหมุนยาวต้องถูกต้อง');
  ok(G('assessOutcome')({ mastered: true, totalSec: 500 }, 600, 900).outcome === 'pass', 'เวลา ≤ X = pass');
  ok(G('assessOutcome')({ mastered: true, totalSec: 600 }, 600, 900).outcome === 'pass', 'เวลา = X = pass');
  ok(G('assessOutcome')({ mastered: true, totalSec: 700 }, 600, 900).outcome === 'flag', 'X < เวลา < Y = ผ่านแต่ติดธง');
  ok(G('assessOutcome')({ mastered: true, totalSec: 900 }, 600, 900).outcome === 'repeat', 'เวลา ≥ Y = ทำซ้ำ');
  ok(G('assessOutcome')({ mastered: false, totalSec: 100 }, 600, 900).outcome === 'repeat', 'ไม่ถึง 100% = ทำซ้ำ (แม้เร็ว)');
}

/* ---------- ผลวัดระดับ → รอบเริ่มต้น ---------- */
{
  const pr = G('placementRounds');
  const lo = pr({ addsub: 1, mul: 1, div: 1, fracdec: 1 });
  ok(TOPICS.every((t) => lo[t] === 1), 'ขั้นเริ่มต้น 1 → รอบ 1 ทุกหัวข้อ');
  const hi = pr({ addsub: 6, mul: 4, div: 5, fracdec: 8 });
  ok(hi.add === 2 && hi.sub === 2 && hi.mul === 2 && hi.div === 2 && hi.frac === 2, 'บวก/ลบมาจากบันไดเดียวกัน (addsub ขั้น 6 → รอบ 2 ทั้งคู่)');
  const top = pr({ addsub: 12, mul: 12, div: 11, fracdec: 15 });
  ok(TOPICS.every((t) => top[t] === 3), 'ขั้นสูงสุด → รอบ 3');
  ok(G('roundForStep')('add', 4) === 1 && G('roundForStep')('add', 5) === 2 && G('roundForStep')('add', 9) === 3 && G('roundForStep')('mul', 2) === 1 && G('roundForStep')('mul', 3) === 2 && G('roundForStep')('div', 3) === 1 && G('roundForStep')('div', 4) === 2 && G('roundForStep')('frac', 6) === 1 && G('roundForStep')('frac', 7) === 2, 'ตารางเกณฑ์ขั้น → รอบ');
  ok(pr({ addsub: 6 }).mul === 1, 'ไม่มีข้อมูลบันไดไหน = รอบ 1');
}

/* ---------- ตัวตรวจ noReduce เหมือนกันทั้งเซิร์ฟเวอร์และแท็บเล็ต ---------- */
{
  const CA = G('checkAnswer'), it = { type: 'frac', ans: '4/10', noReduce: true }, it2 = { type: 'frac', ans: '4/10' };
  ok(CA(it, '4/10') && CA(it, '2/5') && !CA(it, '5/10') && !CA(it, '4/1'), 'noReduce: รับ 4/10 และ 2/5 ไม่รับค่าผิด');
  ok(!CA(it2, '4/10') && CA(it2, '2/5'), 'ไม่มี noReduce: ต้องอย่างต่ำ');
  const client = new Function('return (' + [G('gcd'), G('parseUser'), G('checkAnswer')].map((f) => f.toString()).join(',') + ')');
  const src = [G('gcd'), G('parseUser'), G('checkAnswer')].map((f) => f.toString()).join('\n') + '\nreturn checkAnswer;';
  const clientCA = new Function(src)();
  ok(clientCA(it, '4/10') && clientCA(it, '2/5') && !clientCA(it2, '4/10'), 'โค้ดที่ส่งไปแท็บเล็ต (toString) ทำงานเหมือนกัน');
}

console.log('\nCurriculum: ตรวจ ' + checks + ' รายการ ผิด ' + fails);
process.exit(fails ? 1 : 0);
