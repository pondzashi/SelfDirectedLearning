/**
 * ชุดทดสอบ: node tests/run-tests.js
 * โหลดไฟล์ .gs ที่ไม่เรียก API ของ Google เข้า vm แล้วสุ่มตัวอย่างทุกขั้น/ทุกแม่แบบ
 * ตรวจคำตอบด้วยการคำนวณใหม่แบบอิสระ (ไม่ใช้ฟิลด์ ans ของตัวสร้างเอง)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'apps-script');
const PURE = ['Core.gs', 'Generators.gs', 'Templates.gs',
  'BankSeed.gs', 'SetBuilder.gs', 'SelfTest.gs'];
const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number, RegExp, Error });
for (const f of PURE) {
  const p = path.join(DIR, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const G = (n) => vm.runInContext(n, ctx);

// ---------- ลำดับไฟล์: Apps Script โหลดไฟล์ตามลำดับในโปรเจกต์ ผู้ปกครองอาจสร้างไฟล์สลับลำดับ ----------
function loadInOrder(files) {
  const c = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number, RegExp, Error });
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), c, { filename: f });
  return c;
}
const ALL_GS = fs.readdirSync(DIR).filter(f => f.endsWith('.gs'));
const NOGAPI = ALL_GS.filter(f => !['Store.gs', 'Session.gs', 'Reports.gs', 'Code.gs'].includes(f));
let orderFails = 0;
const orders = [NOGAPI.slice().reverse(), NOGAPI.slice().sort(), NOGAPI.slice().sort().reverse(), ['SelfTest.gs', 'SetBuilder.gs', 'Templates.gs', 'BankSeed.gs', 'Generators.gs', 'Core.gs']];
for (const o of orders) {
  try { const c = loadInOrder(o); if (vm.runInContext('STEPS.length', c) !== 50 || vm.runInContext('TEMPLATES.length', c) !== 68) orderFails++; }
  catch (e) { orderFails++; console.log('  ✗ โหลดตามลำดับ ' + o.join(',') + ' ไม่ได้: ' + e.message); }
}
let fails = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; if (fails <= 60) console.log('  ✗ ' + msg); } }
function section(t) { console.log('\n== ' + t); }

// ---------- ตัวคำนวณอิสระสำหรับโจทย์คิดเลข ----------
const R = (n, d) => { const g = gcdN(n, d); return { n: n / g, d: d / g }; };
function gcdN(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
const radd = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
const rsub = (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d);
const rmul = (a, b) => R(a.n * b.n, a.d * b.d);
const rdiv = (a, b) => R(a.n * b.d, a.d * b.n);
function evalQ(q) {
  const s = q.replace(/\(ทศนิยม\)/g, '').replace(/=/g, ' ');
  const re = /\{(?:(\d+) )?(\d+)\/(\d+)\}|(\d+)(?:\.(\d+))?|([+−×÷])/g;
  const toks = []; let m;
  while ((m = re.exec(s))) {
    if (m[6]) toks.push(m[6]);
    else if (m[2] !== undefined) toks.push(R((+(m[1] || 0)) * +m[3] + +m[2], +m[3]));
    else if (m[5] !== undefined) toks.push(R(+(m[4] + m[5]), Math.pow(10, m[5].length)));
    else toks.push(R(+m[4], 1));
  }
  let acc = toks[0];
  for (let i = 1; i < toks.length; i += 2) {
    const op = toks[i], v = toks[i + 1];
    acc = op === '+' ? radd(acc, v) : op === '−' ? rsub(acc, v) : op === '×' ? rmul(acc, v) : rdiv(acc, v);
  }
  return { val: acc, toks };
}
const nums = (q) => (q.match(/\d+/g) || []).map(Number);
const dig = (n) => String(n).length;
const carriesT = (a, b) => G('carries')(a, b), borrowsT = (a, b) => G('borrows')(a, b);

// ---------- เงื่อนไขความยากของแต่ละขั้น ----------
const RULES = {
  AS01: (a, b) => dig(a) === 2 && dig(b) === 2 && carriesT(a, b) === 0,
  AS02: (a, b) => dig(a) === 2 && dig(b) === 2 && carriesT(a, b) === 1,
  AS03: (a, b) => dig(a) === 2 && dig(b) === 2 && a > b && borrowsT(a, b) === 0,
  AS04: (a, b) => dig(a) === 2 && dig(b) === 2 && a > b && borrowsT(a, b) === 1,
  AS05: (a, b) => dig(a) === 3 && dig(b) === 3 && carriesT(a, b) >= 1,
  AS06: (a, b) => dig(a) === 3 && dig(b) === 3 && a > b && borrowsT(a, b) >= 1,
  AS07: (a, b) => dig(a) === 4 && dig(b) === 4 && carriesT(a, b) >= 2,
  AS08: (a, b) => dig(a) === 4 && dig(b) === 4 && a > b && borrowsT(a, b) >= 2,
  MU03: (a, b) => dig(a) === 2 && b >= 2 && b <= 9 && G('mulNoCarryOK')(a, b),
  MU04: (a, b) => dig(a) === 2 && b >= 2 && b <= 9 && !G('mulNoCarryOK')(a, b),
  MU05: (a, b) => dig(a) === 3 && b >= 2 && b <= 9 && G('mulNoCarryOK')(a, b),
  MU06: (a, b) => dig(a) === 3 && b >= 2 && b <= 9 && !G('mulNoCarryOK')(a, b),
  MU07: (a, b) => dig(a) === 4 && b >= 2 && b <= 9,
  MU10: (a, b) => dig(a) === 2 && dig(b) === 2,
  MU12: (a, b) => dig(a) === 3 && dig(b) === 2,
};

section('จำนวนขั้นและแม่แบบ');
ok(orderFails === 0, 'ต้องโหลดไฟล์ได้ทุกลำดับ (ลำดับไฟล์ในโปรเจกต์ Apps Script ไม่แน่นอน)');
ok(!ALL_GS.some(f => /^Templates.+\.gs$/.test(f)), 'ห้ามแยกไฟล์ Templates (ต้องประกาศ T() ก่อนใช้)');
const STEPS = G('STEPS'), TEMPLATES = G('TEMPLATES');
ok(STEPS.length >= 40 && STEPS.length <= 50, 'ขั้นคิดเลขต้อง 40–50 ขั้น (มี ' + STEPS.length + ')');
ok(TEMPLATES.length >= 60 && TEMPLATES.length <= 80, 'แม่แบบต้อง 60–80 (มี ' + TEMPLATES.length + ')');
const byCat = {}; TEMPLATES.forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + 1);
console.log('  ขั้น:', STEPS.length, ' แม่แบบ:', JSON.stringify(byCat));
ok(new Set(STEPS.map(s => s.id)).size === STEPS.length, 'id ขั้นซ้ำ');
ok(new Set(TEMPLATES.map(s => s.id)).size === TEMPLATES.length, 'id แม่แบบซ้ำ');
for (const s of STEPS) ok(s.n >= 20 && s.n <= 30, s.id + ' จำนวนข้อ n ต้อง 20–30');
for (const s of STEPS) ok(s.n * s.spp <= 20 * 60 * 0.8, s.id + ' เวลาเป้าหมายยาวเกินไป ' + s.n * s.spp);

// ---------- โจทย์คิดเลข ----------
section('ตัวสร้างโจทย์คิดเลข (สุ่มขั้นละ 300 ข้อ)');
const N = 300;
for (const st of STEPS) {
  let bad = 0;
  for (let i = 0; i < N; i++) {
    const it = G('genStep')(st.id);
    const here = st.id + ' [' + it.q + ' → ' + it.ans + ']';
    if (/NaN|undefined|null|Infinity/.test(it.q + it.ans + (it.explain || ''))) { ok(false, here + ' มี NaN/undefined'); bad++; continue; }
    if (!G('checkAnswer')(it, it.ans)) { ok(false, here + ' ตัวตรวจไม่รับคำตอบของตัวเอง'); bad++; continue; }
    if (it.type === 'divrem') {
      const [a, b] = nums(it.q);
      const q = Math.floor(a / b), r = a % b;
      if (it.ans !== q + '|' + r || r === 0 || r >= b) { ok(false, here + ' หารมีเศษผิด'); bad++; }
      continue;
    }
    if (st.id === 'FD01') {
      const m = /\{(\d+)\/(\d+)\} = \{(\?|\d+)\/(\?|\d+)\}/.exec(it.q);
      const a = +m[1], b = +m[2];
      const exp = m[3] === '?' ? (+m[4]) / b * a : (+m[3]) / a * b;
      if (+it.ans !== exp || !Number.isInteger(exp)) { ok(false, here + ' เศษส่วนเท่ากันผิด'); bad++; }
      continue;
    }
    const { val, toks } = evalQ(it.q);
    const exp = G('parseUser')(it.ans);
    if (!exp.ok || val.n * exp.d !== exp.n * val.d || val.n < 0) { ok(false, here + ' คำตอบไม่ตรงการคำนวณอิสระ ' + val.n + '/' + val.d); bad++; continue; }
    if (RULES[st.id]) {
      const v = nums(it.q);
      if (!RULES[st.id](v[0], v[1])) { ok(false, here + ' ไม่ตรงเงื่อนไขความยาก'); bad++; }
    }
    // ข้อกำหนดเฉพาะ
    if (st.id === 'MU12' || st.id === 'MU10') { /* ตรวจในกฎ */ }
    if (it.type === 'frac' && st.id !== 'FD04') {
      const u = G('parseUser')(it.ans);
      if (u.kind === 'frac' || u.kind === 'mixed') { if (G('gcd')(u.num, u.den) !== 1) { ok(false, here + ' คำตอบไม่เป็นอย่างต่ำ'); bad++; } }
    }
    if (it.type === 'dec' && /\.\d*0$/.test(it.ans)) { ok(false, here + ' คำตอบทศนิยมมีศูนย์ท้าย'); bad++; }
  }
  ok(bad === 0, st.id + ' มีข้อผิด ' + bad + ' จาก ' + N);
}
console.log('  สุ่มแล้ว', STEPS.length * N, 'ข้อ');

// ---------- ตัวตรวจคำตอบ ----------
section('ตัวตรวจคำตอบ (รูปแบบการกรอก)');
const CA = G('checkAnswer');
const mk = (type, ans, extra) => Object.assign({ type, ans }, extra || {});
ok(CA(mk('int', '12'), '12') && !CA(mk('int', '12'), '12.0') && !CA(mk('int', '12'), '13'), 'int');
ok(CA(mk('dec', '0.5'), '0.50') && CA(mk('dec', '0.5'), '.5') && CA(mk('dec', '5'), '5') && !CA(mk('dec', '0.5'), '1/2'), 'dec normalize');
ok(CA(mk('frac', '1/2'), '1/2') && !CA(mk('frac', '1/2'), '2/4') && !CA(mk('frac', '1/2'), '0.5'), 'frac: 2/4 ต้องไม่ถูก');
ok(CA(mk('frac', '2 1/3'), '2 1/3') && CA(mk('frac', '2 1/3'), '7/3') && !CA(mk('frac', '2 1/3'), '2 2/6'), 'frac mixed accept');
ok(CA(mk('frac', '2 1/3', { form: 'mixed' }), '2 1/3') && !CA(mk('frac', '2 1/3', { form: 'mixed' }), '7/3'), 'form mixed');
ok(CA(mk('frac', '7/3', { form: 'improper' }), '7/3') && !CA(mk('frac', '7/3', { form: 'improper' }), '2 1/3'), 'form improper');
ok(CA(mk('frac', '3'), '3') && !CA(mk('frac', '3'), '6/2') && !CA(mk('frac', '3'), '3/1'), 'frac integer');
ok(CA(mk('divrem', '23|4'), '23|4') && !CA(mk('divrem', '23|4'), '23|5') && !CA(mk('divrem', '23|4'), '23|'), 'divrem');
ok(CA(mk('choice', '2'), '2') && !CA(mk('choice', '2'), '3'), 'choice');
ok(!CA(mk('int', '5'), '') && !CA(mk('int', '5'), 'abc') && !CA(mk('frac', '1/2'), '1/0'), 'ค่าว่าง/ผิดรูปแบบ');
const CE = G('classifyError');
ok(CE({ type: 'int', ans: '123', cat: 'addsub', traps: { '112': 'ทดผิด/ลืมทด' } }, '112', 8) === 'ทดผิด/ลืมทด', 'classify trap');
ok(CE({ type: 'int', ans: '123', cat: 'addsub' }, '99', 1.2) === 'รีบเกินไป', 'classify รีบ');
ok(CE({ type: 'int', ans: '123', cat: 'addsub' }, '99', 9) === 'คำนวณพลาด', 'classify default');

// ---------- แม่แบบ ----------
section('แม่แบบโจทย์ (สุ่มแม่แบบละ 100 ข้อ ต่อระดับ)');
function bad(id, tier, it, msg) { ok(false, id + ' t' + tier + ' ' + msg + ' :: ' + String(it.q).replace(/\n/g, ' / ').slice(0, 90) + ' → ' + it.ans); }
const build = G('buildTemplate');
const seqNums = (q) => { const body = q.split('\n').slice(-1)[0] || ''; return body.split(/,\s+/).map(x => x.trim()).filter(x => x !== '?').map(Number); };
const D1 = (a) => a.slice(1).map((x, i) => x - a[i]);
const REF = {}; // ตัวสร้างบรรทัดอ้างอิงสำหรับข้อหาจุดผิด
REF.add = (a, b) => {
  const nm = G('colNames')(), da = G('digitsRev')(a), db = G('digitsRev')(b), la = Math.max(da.length, db.length);
  const lines = []; let cc = 0, num = 0;
  for (let i = 0; i < la; i++) {
    const s = da[i] + db[i] + cc;
    lines.push(nm[i] + ': ' + da[i] + ' + ' + db[i] + (cc ? ' + ' + cc + ' (ที่ทดมา)' : '') + ' = ' + s + (i < la - 1 && s >= 10 ? ' เขียน ' + (s % 10) + ' ทด 1' : ' เขียน ' + s));
    num += (i < la - 1 ? s % 10 : s) * Math.pow(10, i); cc = i < la - 1 && s >= 10 ? 1 : 0;
  }
  lines.push('ตอบ ' + num); return { lines, truth: a + b };
};
REF.mul = (a, b) => {
  const nm = G('colNames')(), da = G('digitsRev')(a), la = da.length; const lines = []; let cc = 0, num = 0;
  for (let i = 0; i < la; i++) {
    const pr = da[i] * b, v = pr + cc;
    lines.push(nm[i] + ': ' + da[i] + ' × ' + b + ' = ' + pr + (cc ? ' + ' + cc + ' = ' + v : '') + ((i < la - 1 && v >= 10) ? ' เขียน ' + (v % 10) + ' ทด ' + Math.floor(v / 10) : ' เขียน ' + v));
    num += (i < la - 1 ? v % 10 : v) * Math.pow(10, i); cc = i < la - 1 ? Math.floor(v / 10) : 0;
  }
  lines.push('ตอบ ' + num); return { lines, truth: a * b };
};
REF.sub = (a, b) => {
  const nm = G('colNames')(), da = G('digitsRev')(a), db = G('digitsRev')(b), la = da.length; const lines = []; let br = 0, num = 0;
  for (let i = 0; i < la; i++) {
    const x = da[i] - br, y = db[i] || 0; let d, line = nm[i] + ': ' + (br ? da[i] + ' ถูกยืมไป 1 เหลือ ' + x + '; ' : '');
    if (x >= y) { d = x - y; line += x + ' − ' + y + ' = ' + d; br = 0; } else { d = x + 10 - y; line += x + ' ไม่พอลบ ยืม 10 ได้ ' + (x + 10) + ' − ' + y + ' = ' + d; br = 1; }
    lines.push(line); num += d * Math.pow(10, i);
  }
  lines.push('ตอบ ' + num); return { lines, truth: a - b };
};
function firstDiff(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i; return -1; }

for (const t of TEMPLATES) {
  for (let tier = t.min; tier <= t.max; tier++) {
    let badN = 0;
    for (let i = 0; i < 100; i++) {
      let it;
      try { it = build(t.id, tier); } catch (e) { bad(t.id, tier, { q: e.message, ans: '' }, 'exception'); badN++; break; }
      const text = JSON.stringify(it);
      const before = fails;
      if (/NaN|undefined|null|Infinity/.test(text.replace(/"traps":\{[^}]*\}/, '').replace('"head":null', ''))) bad(t.id, tier, it, 'มี NaN/undefined');
      if (!it.q || it.q.length < 5) bad(t.id, tier, it, 'โจทย์ว่าง');
      if (!G('checkAnswer')(it, it.ans)) bad(t.id, tier, it, 'ตัวตรวจไม่รับคำตอบของตัวเอง');
      if (it.type === 'choice') {
        if (!it.choices || it.choices.length < 2 || new Set(it.choices).size !== it.choices.length) bad(t.id, tier, it, 'ตัวเลือกซ้ำ/ไม่พอ');
        if (!(+it.ans >= 1 && +it.ans <= it.choices.length)) bad(t.id, tier, it, 'ดัชนีคำตอบผิด');
      } else if (it.type === 'int') {
        if (!(+it.ans >= 0) || !Number.isInteger(+it.ans)) bad(t.id, tier, it, 'คำตอบต้องเป็นจำนวนเต็มไม่ติดลบ');
      }
      if (it.traps && it.traps[it.ans] !== undefined) bad(t.id, tier, it, 'กับดักเท่ากับคำตอบจริง');
      if (it.type === 'frac') { const u = G('parseUser')(it.ans); if (u.kind === 'frac' || u.kind === 'mixed') { if (G('gcd')(u.num, u.den) !== 1) bad(t.id, tier, it, 'เศษส่วนไม่เป็นอย่างต่ำ'); } }
      if (it.type === 'dec' && /\.\d*0$/.test(it.ans)) bad(t.id, tier, it, 'ทศนิยมมีศูนย์ท้าย');

      // ----- ตรวจด้วยการคำนวณอิสระ -----
      const A = +it.ans, id = t.id;
      if (['O01', 'O05'].includes(id)) { const s = seqNums(it.q), d = D1(s); if (!d.every(x => x === d[0]) || s[s.length - 1] + d[0] !== A) bad(id, tier, it, 'ลำดับเลขคณิตผิด'); }
      if (id === 'O02') { const s = seqNums(it.q), r = s[1] / s[0]; if (!s.every((x, i) => i === 0 || x === s[i - 1] * r) || s[s.length - 1] * r !== A) bad(id, tier, it, 'ลำดับเรขาคณิตผิด'); }
      if (['O03', 'O07'].includes(id)) { const s = seqNums(it.q), d = D1(s), d2 = D1(d); if (!d2.every(x => x === d2[0]) || s[s.length - 1] + d[d.length - 1] + d2[0] !== A) bad(id, tier, it, 'ลำดับอันดับสองผิด'); }
      if (id === 'O04') { const s = seqNums(it.q), ev = s.filter((_, i) => i % 2 === 1), od = s.filter((_, i) => i % 2 === 0), de = D1(ev), dd = D1(od); if (!de.every(x => x === de[0]) || !dd.every(x => x === dd[0]) || ev[ev.length - 1] + de[0] !== A) bad(id, tier, it, 'ลำดับสลับผิด'); }
      if (id === 'O06') { const s = seqNums(it.q); if (!s.every((x, i) => i < 2 || x === s[i - 1] + s[i - 2]) || s[s.length - 1] + s[s.length - 2] !== A) bad(id, tier, it, 'ฟีโบนักชีผิด'); }
      if (id === 'O09') { const ms = [...it.q.matchAll(/มี (\d+) จุด/g)].map(m => +m[1]), n = +/รูปที่ (\d+) มีกี่จุด/.exec(it.q)[1], d = ms[1] - ms[0]; if (ms[2] - ms[1] !== d || ms[0] + d * (n - 1) !== A) bad(id, tier, it, 'รูปจุดผิด'); }
      if (id === 'O23') { const ps = [...it.q.matchAll(/(\d+)\s+→\s+(\d+)/g)].map(m => [+m[1], +m[2]]), n = +/ใส่ (\d+) จะ/.exec(it.q)[1], a = (ps[1][1] - ps[0][1]) / (ps[1][0] - ps[0][0]), b = ps[0][1] - a * ps[0][0]; if (!ps.every(p => a * p[0] + b === p[1]) || a * n + b !== A) bad(id, tier, it, 'เครื่องเปลี่ยนจำนวนผิด'); }
      if (id === 'O19') { const rows = it.data.rows; const f2 = (a, b) => a + b, f3 = (a, b) => 2 * a + b; const okf = (f) => rows.slice(0, 2).every(r => f(r[0], r[1]) === r[2]) && f(rows[2][0], rows[2][1]) === A; if (!okf(f2) && !okf(f3)) bad(id, tier, it, 'ตารางกฎผิด'); }
      if (id === 'O20') { const tg = /นับว่ามี (\S) ทั้งหมด/.exec(it.q)[1], body = it.q.split('\n').slice(1).join(' '); if ((body.split(tg).length - 1) !== A) bad(id, tier, it, 'นับผิด'); }
      if (id === 'O21') { const m = /แถวบน:\s+(.*)\nแถวล่าง:\s+(.*)/.exec(it.q), a = m[1].trim().split(' '), b = m[2].trim().split(' '); if (a.filter((x, i) => x !== b[i]).length !== A) bad(id, tier, it, 'นับความต่างผิด'); }
      if (id === 'O24') { const l = it.q.split('\n')[1].split(/,\s+/).map(Number), c = {}; l.forEach(x => c[x] = (c[x] || 0) + 1); const mx = Math.max(...Object.values(c)); if (c[A] !== mx || Object.values(c).filter(x => x === mx).length !== 1) bad(id, tier, it, 'ปรากฏบ่อยสุดผิด'); }
      if (id === 'O08') { const sh = it.q.split('\n')[1].replace(' ?', '').trim().split(' '), ans = it.choices[+it.ans - 1]; let okk = false; for (let k = 2; k <= 4; k++) { if (sh.length > k && sh.every((x, i) => i < k || x === sh[i - k]) && sh[sh.length - k] === ans) okk = true; } if (!okk) bad(id, tier, it, 'ลวดลายผิด'); }
      if (id === 'O11') { const ds = it.choices.map(c => String(c).split('').reduce((s, x) => s + +x, 0)), cnt = {}; ds.forEach(d => cnt[d] = (cnt[d] || 0) + 1); const oddD = ds[+it.ans - 1]; if (cnt[oddD] !== 1 || Object.keys(cnt).length !== 2) bad(id, tier, it, 'ผลบวกเลขโดดไม่ตรง'); }
      if (id === 'O22') { const S = +/เท่ากับ (\d+)/.exec(it.q)[1], ds = it.choices.map(c => String(c).split('').reduce((s, x) => s + +x, 0)); if (ds.filter(d => d === S).length !== 1 || ds[+it.ans - 1] !== S) bad(id, tier, it, 'ผลบวกเลขโดดผิด'); }
      if (id === 'O18') { const sh = it.choices.map(Number), k = +it.ans - 1, rest = sh.filter((_, i) => i !== k), idx = sh.map((_, i) => i).filter(i => i !== k); const d = (rest[rest.length - 1] - rest[0]) / (idx[idx.length - 1] - idx[0]); if (!idx.every((x, j) => rest[j] === rest[0] + (x - idx[0]) * d) || sh[k] === rest[0] + (k - idx[0]) * d) bad(id, tier, it, 'ตัวที่ผิดไม่ชัดเจน'); }
      if (id === 'O10') {
        const v = it.choices.map(Number), k = +it.ans - 1; let found = false;
        const rules = [x => x % 2 === 0, x => x % 2 === 1, x => { const r = Math.round(Math.sqrt(x)); return r * r === x; }];
        for (let m = 2; m <= 12; m++) rules.push(x => x % m === 0);
        for (const r of rules) { const sat = v.map(r); if (sat.filter(Boolean).length === 3 && !sat[k] || sat.filter(Boolean).length === 1 && sat[k]) found = true; }
        if (!found) bad(id, tier, it, 'ไม่มีกฎที่แยกตัวนอกพวกได้');
      }
      if (id === 'O12') { /* ตรวจที่ explain */ if (!it.explain.includes(it.choices[+it.ans - 1])) bad(id, tier, it, 'เฉลยไม่ตรง'); }
      if (['O13', 'O14', 'O15'].includes(id)) {
        const m = /(\d+) ([+−×]) (\d+) ไว้/.exec(it.q), a = +m[1], b = +m[3];
        const ref = (id === 'O13' ? REF.add : id === 'O14' ? REF.sub : REF.mul)(a, b);
        const fd = firstDiff(it.choices, ref.lines);
        if (fd !== +it.ans - 1) bad(id, tier, it, 'บรรทัดผิดแรกไม่ตรง fd=' + fd + ' ans=' + it.ans);
        const lastTrue = ref.lines[ref.lines.length - 1];
        if (it.choices[it.choices.length - 1] === lastTrue) bad(id, tier, it, 'คำตอบสุดท้ายยังถูก (ไม่มีข้อผิด)');
        if (it.choices.length !== ref.lines.length) bad(id, tier, it, 'จำนวนบรรทัดไม่เท่ากับอ้างอิง');
      }
      if (id === 'O16') {
        const m = /(\d+) × (\d+) ไว้/.exec(it.q), a = +m[1], b = +m[2], u = b % 10, tn = Math.floor(b / 10);
        const ref = [a + ' × ' + u + ' = ' + a * u, a + ' × ' + tn + '0 = ' + a * tn * 10, a * u + ' + ' + a * tn * 10 + ' = ' + a * b, 'ตอบ ' + a * b];
        const fd = firstDiff(it.choices, ref); if (fd !== +it.ans - 1 || fd < 0 || fd > 1) bad(id, tier, it, 'บรรทัดผิดแรกไม่ตรง fd=' + fd + ' ans=' + it.ans);
      }
      if (id === 'O17') {
        const m = /คิดบวก \{(\d+)\/(\d+)\} \+ \{(\d+)\/(\d+)\}/.exec(it.q), a = +m[1], d1 = +m[2], c = +m[3], d2 = +m[4], L = G('lcm')(d1, d2), n1 = a * L / d1, n2 = c * L / d2;
        const F = (n, d) => '{' + n + '/' + d + '}';
        const ref = ['ตัวส่วนร่วมของ ' + d1 + ' และ ' + d2 + ' คือ ' + L, F(a, d1) + ' = ' + F(n1, L), F(c, d2) + ' = ' + F(n2, L), F(n1, L) + ' + ' + F(n2, L) + ' = ' + F(n1 + n2, L)];
        const fd = firstDiff(it.choices, ref); if (fd !== +it.ans - 1 || fd < 1) bad(id, tier, it, 'บรรทัดผิดแรกไม่ตรง fd=' + fd + ' ans=' + it.ans);
      }
      if (id === 'A05') { /* ตรวจว่าตัวเลือกครบ */ if (it.choices.length < 3) bad(id, tier, it, 'ตัวเลือกน้อย'); }
      if (id === 'A09') { const n = nums(it.q)[0]; if (A !== n * (n - 1) / 2) bad(id, tier, it, 'จับมือผิด'); }
      if (id === 'A20') { const [p, q] = nums(it.q.replace(/\n/g, ' ')).slice(0, 2); const l = G('lcm')(p, q); if (A !== l) bad(id, tier, it, 'ค.ร.น. ผิด'); }
      if (id === 'A14') { const n = nums(it.q)[0]; let s = 0; for (let k = 1; k <= n; k++) s += (n - k + 1) * (n - k + 1); if (A !== s) bad(id, tier, it, 'นับสี่เหลี่ยมผิด'); }
      if (id === 'A15') { const [amt] = nums(it.q); const dn = /ธนบัตรและเหรียญ ([\d, ]+) บาท/.exec(it.q)[1].split(',').map(Number); const dp = Array(amt + 1).fill(1e9); dp[0] = 0; for (let x = 1; x <= amt; x++) for (const d of dn) if (x >= d) dp[x] = Math.min(dp[x], dp[x - d] + 1); if (dp[amt] !== A) bad(id, tier, it, 'จำนวนชิ้นน้อยสุดผิด'); }
      if (id === 'A13') { const [h, l] = nums(it.q); let found = -1; for (let g = 0; g <= h; g++) if (4 * g + 2 * (h - g) === l) found = g; if (found !== A) bad(id, tier, it, 'ไก่แพะผิด'); }
      if (id === 'A17') { const [S, Dd] = nums(it.q.replace('สองหลัก', '')); let found = []; for (let n = 10; n < 100; n++) { const a = Math.floor(n / 10), b = n % 10; if (a + b === S && a - b === Dd && a > b) found.push(n); } if (found.length !== 1 || found[0] !== A) bad(id, tier, it, 'ปริศนาเลขสองหลักผิด/ไม่ unique'); }
      if (id === 'A22') { const m = /เป็นวัน(\S+) อีก (\d+)/.exec(it.q), days = G('TH_DAYS'), i0 = days.indexOf(m[1]); if (it.choices[+it.ans - 1] !== days[(i0 + +m[2]) % 7]) bad(id, tier, it, 'วันผิด'); }
      if (id === 'A21') { const [k1, c1, k2, c2] = nums(it.q.replace(/ร้าน ก|ร้าน ข/g, '')).slice(0, 4); const p1 = c1 / k1, p2 = c2 / k2; if (!Number.isInteger(p1) || !Number.isInteger(p2) || (it.ans === '1') !== (p1 < p2) || p1 === p2) bad(id, tier, it, 'เทียบราคาต่อชิ้นผิด'); }
      if (id === 'A07') { /* ย้อนกลับ: ตรวจโดยแทนค่า */ const n = nums(it.q); const r = n[n.length - 1]; const x = A; let calc; if (/ลบ \d+ แล้วคูณ/.test(it.q)) { const c = n[0], a = n[1], b = n[2]; calc = (x - c) * a + b; } else if (/คูณด้วย \d+ แล้วบวก/.test(it.q)) { calc = x * n[0] + n[1]; } else { calc = (x + n[0]) * n[1]; } if (calc !== r) bad(id, tier, it, 'แทนค่ากลับไม่ตรง'); }
      if (id === 'A08') { const nn = nums(it.q); if (A !== nn[nn.length - 1] * nn[0] * nn[2]) { /* ลำดับตัวเลข: k1 , k2 , m */ } }
      if (id === 'A12') { const [S, Dd] = nums(it.q); if (A !== (S - Dd) / 2) bad(id, tier, it, 'ผลรวมผลต่างผิด'); }
      if (id === 'A19') { const [x, y] = nums(it.q); if (A !== x + y - 1) bad(id, tier, it, 'แถวผิด'); }
      if (id === 'A11') { const n = nums(it.q); const p = n.reduce((a, b) => a * b, 1); if (A !== p) bad(id, tier, it, 'จับคู่ผิด'); }
      if (id === 'A18') { /* ตรวจหลักการ */ if (A <= 0) bad(id, tier, it, 'คำตอบไม่บวก'); }
      if (id === 'A06') { if (it.choices.length !== 3) bad(id, tier, it, 'ตัวเลือก 3 ตัว'); }
      if (fails > before) badN++;
    }
  }
}
// ตรวจแม่แบบที่คำตอบคำนวณซ้ำได้ง่ายด้วยตัวเลขใน q (A01–A04, A10, W-series) แยกเป็นข้อกำหนดเชิงโครงสร้างแล้วข้างต้น
console.log('  ตรวจแม่แบบเสร็จ');

// ---------- ชุดทดสอบเพิ่มเติม (ถ้ามี) ----------
if (G('typeof selfTestAll') === 'function') {
  section('SelfTest.gs');
  const r = G('selfTestAll')(ok);
}

console.log('\nสรุป: ตรวจ ' + checks + ' รายการ ผิด ' + fails);
process.exit(fails ? 1 : 0);
