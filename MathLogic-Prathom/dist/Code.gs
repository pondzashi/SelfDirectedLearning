/** ฝึกคณิต ป.4 — ไฟล์รวมทุกสคริปต์ (สร้างโดย tools/build-bundle.js) วางทับ Code.gs ได้ทั้งไฟล์ */

// ======================= Core.gs =======================
/**
 * Core.gs — ฟังก์ชันพื้นฐานที่ไม่เรียก API ของ Google
 * (ใช้ได้ทั้งใน Apps Script และในชุดทดสอบ Node: tests/run-tests.js)
 *
 * - ตัวสุ่ม (กำหนด seed ได้ ทำให้ชุดข้อของวันเดียวกันออกมาเหมือนเดิมทุกครั้งที่เปิด)
 * - ตัวแปลง/ตรวจคำตอบ (จำนวนเต็ม ทศนิยม เศษส่วน จำนวนคละ หารมีเศษ ตัวเลือก)
 * - ตรรกะวันที่ การหาขั้นเริ่มต้นจากแบบทดสอบ การตัดสินผ่าน/ไม่ผ่าน การเทียบผลรายเดือน
 */

/* ---------------- ตัวสุ่ม ---------------- */
var _rngFn = Math.random;
function setRng(fn) { _rngFn = fn || Math.random; }
function rnd() { return _rngFn(); }
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function chance(p) { return rnd() < p; }
function shuffle(a) {
  var x = a.slice();
  for (var i = x.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = x[i]; x[i] = x[j]; x[j] = t; }
  return x;
}
function sample(arr, k) { return shuffle(arr).slice(0, k); }
/** สุ่มซ้ำจนกว่าเงื่อนไขจะเป็นจริง */
function retry(fn, ok, max) {
  max = max || 5000;
  for (var i = 0; i < max; i++) { var v = fn(); if (ok(v)) return v; }
  throw new Error('retry exhausted');
}

/* ---------------- ตัวเลข ---------------- */
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
function lcm(a, b) { return a / gcd(a, b) * b; }
/** จำนวนสุ่มที่มี d หลัก */
function rndN(d) { return ri(Math.pow(10, d - 1), Math.pow(10, d) - 1); }
function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
/** แสดงจำนวนเต็มที่ถูกคูณด้วย 10^p เป็นทศนิยม p ตำแหน่ง เช่น (305,2) -> "3.05" */
function fmtScaled(v, p) {
  var neg = v < 0; v = Math.abs(v);
  var s = String(v);
  if (!p) return (neg ? '-' : '') + s;
  while (s.length <= p) s = '0' + s;
  return (neg ? '-' : '') + s.slice(0, s.length - p) + '.' + s.slice(s.length - p);
}
function trimDec(s) { return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); }
/** เศษส่วนรูปอย่างต่ำ (เกิน 1 เขียนเป็นจำนวนคละ) */
function fracStr(n, d) {
  var g = gcd(n, d); n /= g; d /= g;
  if (d === 1) return String(n);
  var w = Math.floor(n / d), r = n % d;
  return w > 0 ? w + ' ' + r + '/' + d : r + '/' + d;
}
/** markup เศษส่วนสำหรับแสดงผลแบบซ้อน: {3/4} หรือ {2 1/3} */
function F(n, d) { return '{' + n + '/' + d + '}'; }
function FM(w, n, d) { return w ? '{' + w + ' ' + n + '/' + d + '}' : F(n, d); }
/** markup เศษส่วนจากสตริงคำตอบ เช่น "2 1/3" -> {2 1/3} */
function FS(s) { return s.indexOf('/') < 0 ? s : '{' + s + '}'; }

/* ---------------- ตรวจคำตอบ (โค้ดชุดนี้ถูกส่งไปทำงานบนแท็บเล็ตด้วย) ---------------- */
function parseUser(s) {
  s = String(s == null ? '' : s).replace(/,/g, '').replace(/\s+/g, ' ').trim();
  var m;
  if ((m = /^(\d+)$/.exec(s))) return { ok: true, kind: 'int', n: +m[1], d: 1, num: 0, den: 1 };
  if ((m = /^(\d*)\.(\d+)$/.exec(s))) {
    if (m[2].length > 6) return { ok: false };
    return { ok: true, kind: 'dec', n: +((m[1] || '0') + m[2]), d: Math.pow(10, m[2].length), num: 0, den: 1 };
  }
  if ((m = /^(\d+)\/(\d+)$/.exec(s))) {
    if (+m[2] === 0) return { ok: false };
    return { ok: true, kind: 'frac', n: +m[1], d: +m[2], num: +m[1], den: +m[2] };
  }
  if ((m = /^(\d+) (\d+)\/(\d+)$/.exec(s))) {
    if (+m[3] === 0) return { ok: false };
    return { ok: true, kind: 'mixed', n: +m[1] * +m[3] + +m[2], d: +m[3], whole: +m[1], num: +m[2], den: +m[3] };
  }
  return { ok: false };
}

/**
 * ตรวจคำตอบ
 * - int: ต้องเป็นจำนวนเต็ม
 * - dec: เทียบค่า (0.50 = 0.5)
 * - frac: ต้องเป็นรูปอย่างต่ำ (2/4 ถือว่ายังไม่ถูก) ส่วนของจำนวนคละต้องน้อยกว่าตัวส่วน
 *         item.form = 'mixed' บังคับตอบเป็นจำนวนคละ, 'improper' บังคับตอบเป็นเศษเกิน
 *         item.noReduce = true รับเศษส่วนที่ยังไม่อย่างต่ำ (เช่น อ่านเศษส่วนจากรูป 4/10)
 * - divrem: "ผลหาร|เศษ"
 * - choice: หมายเลขตัวเลือก (เริ่มที่ 1)
 */
function checkAnswer(item, userStr) {
  var t = item.type;
  if (t === 'choice') return String(userStr) === String(item.ans);
  if (t === 'divrem') {
    var a = String(item.ans).split('|'), u2 = String(userStr == null ? '' : userStr).split('|');
    if (u2.length !== 2) return false;
    var q = u2[0].trim(), r = u2[1].trim();
    return /^\d+$/.test(q) && /^\d+$/.test(r) && +q === +a[0] && +r === +a[1];
  }
  var u = parseUser(userStr), e = parseUser(item.ans);
  if (!u.ok || !e.ok) return false;
  if (u.n * e.d !== e.n * u.d) return false;
  if (t === 'int') return u.kind === 'int';
  if (t === 'dec') return u.kind === 'dec' || u.kind === 'int';
  if (t === 'frac') {
    if (u.kind === 'dec') return false;
    if (u.kind === 'frac' && (u.den < 2 || (!item.noReduce && gcd(u.num, u.den) !== 1))) return false;
    if (u.kind === 'mixed' && (u.num < 1 || u.num >= u.den || gcd(u.num, u.den) !== 1)) return false;
    if (item.form === 'mixed') return u.kind === 'mixed' || u.kind === 'int' || (u.kind === 'frac' && u.num < u.den);
    if (item.form === 'improper') return u.kind === 'frac' || u.kind === 'int';
    return true;
  }
  return false;
}

/** ประเภทข้อผิดพลาดเริ่มต้นตามหมวด */
var ERR_DEFAULT = {
  addsub: 'คำนวณพลาด', mul: 'คำนวณพลาด', div: 'คำนวณพลาด', fracdec: 'คำนวณพลาด',
  word: 'ตั้งวิธีคิดผิด', observe: 'สังเกตไม่ครบ', analytic: 'วิเคราะห์ไม่ครบ'
};

/** จำแนกข้อผิดพลาดจากคำตอบที่ผิด (ใช้ "กับดัก" ที่ตัวสร้างโจทย์เตรียมไว้ เช่น คำตอบที่ได้เมื่อลืมทด) */
function classifyError(item, userStr, sec) {
  if (item.traps && item.type !== 'choice' && item.type !== 'divrem') {
    var u = parseUser(userStr);
    if (u.ok) {
      for (var k in item.traps) {
        var e = parseUser(k);
        if (e.ok && u.n * e.d === e.n * u.d) return item.traps[k];
      }
    }
  }
  if (item.type === 'frac') {
    var uf = parseUser(userStr), ef = parseUser(item.ans);
    if (uf.ok && ef.ok && uf.n * ef.d === ef.n * uf.d) return 'ยังไม่ทำเป็นอย่างต่ำ/รูปแบบไม่ตรง';
  }
  if (item.type === 'choice' && item.choiceErr && item.choiceErr[userStr]) return item.choiceErr[userStr];
  if (sec != null && sec < 2.5) return 'รีบเกินไป';
  return item.defErr || ERR_DEFAULT[item.cat] || 'ตอบผิด';
}

/** ลายเซ็นของโจทย์ ใช้กันโจทย์ซ้ำ */
function sigOf(item) {
  return (item.key || '') + '|' + String(item.q || '').replace(/\s+/g, '').slice(0, 90) +
    (item.choices ? '|' + item.choices.join('~').slice(0, 60) : '');
}

/** ตัวเลือก: คืน {choices, ans} โดยสลับตำแหน่ง */
function mkChoices(correct, wrongs, n) {
  n = n || 4;
  var c = String(correct), pool = [];
  wrongs.forEach(function (w) { w = String(w); if (w !== c && pool.indexOf(w) < 0) pool.push(w); });
  var all = shuffle([c].concat(shuffle(pool).slice(0, n - 1)));
  return { choices: all, ans: String(all.indexOf(c) + 1) };
}

/* ---------------- วันที่ (ใช้สตริง yyyy-MM-dd เพื่อไม่ให้เพี้ยนเรื่องเขตเวลา) ---------------- */
var TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function ymdToUtc(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function utcToYmd(ms) {
  var d = new Date(ms);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function ymdAdd(s, n) { return utcToYmd(ymdToUtc(s) + n * 86400000); }
function ymdDow(s) { return new Date(ymdToUtc(s)).getUTCDay(); }
function ymdDiff(a, b) { return Math.round((ymdToUtc(a) - ymdToUtc(b)) / 86400000); }
function ymdMonth(s) { return s.slice(0, 7); }
function isLastDayOfMonth(s) { return ymdMonth(ymdAdd(s, 1)) !== ymdMonth(s); }
function isLastFridayOfMonth(s) { return ymdDow(s) === 5 && ymdMonth(ymdAdd(s, 7)) !== ymdMonth(s); }
function thaiDate(s) {
  var p = s.split('-');
  return 'วัน' + TH_DAYS[ymdDow(s)] + 'ที่ ' + (+p[2]) + ' ' + TH_MONTHS[+p[1] - 1] + ' ' + (+p[0] + 543);
}
function thaiMonthLabel(s) { var p = s.split('-'); return TH_MONTHS[+p[1] - 1] + ' ' + String(+p[0] + 543).slice(-2); }
function fmtSec(sec) { sec = Math.round(sec || 0); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + ('0' + s).slice(-2); }

/* ---------------- ตรรกะการเรียน ---------------- */

/**
 * หาขั้นเริ่มต้นจากแบบทดสอบวัดระดับ
 * scores[i] = จำนวนข้อที่ถูกในรอบแรก (เต็ม 2) ของขั้นที่ i
 * หยุดที่ขั้นแรกที่ "ไม่ผ่าน" และขั้นถัดไปก็ไม่ผ่านด้วย (กันพลาดข้อเดียวแล้วถูกตัดสินต่ำเกินไป)
 * แล้วถอยลงมา backoff ขั้น เพื่อเริ่มจากระดับที่ทำได้คล่อง (หลักของคุมอง)
 * คืนค่า index เริ่มที่ 0
 */
function computeStartIndex(scores, backoff, perStep) {
  perStep = perStep || 2;
  var n = scores.length, stop = n - 1;
  for (var i = 0; i < n; i++) {
    var fail = scores[i] < perStep;
    var nextFail = (i === n - 1) || scores[i + 1] < perStep;
    if (fail && nextFail) { stop = i; break; }
  }
  return Math.max(0, stop - (backoff == null ? 1 : backoff));
}

/**
 * ตัดสินผ่าน/ไม่ผ่านของส่วน A (คิดเลขเร็ว)
 * ผ่าน = ทุกข้อแก้จนถูกได้เอง (ไม่ต้องดูเฉลย) และ เวลารวม (ทำรอบแรก + แก้) ไม่เกินเวลาเป้าหมาย
 */
function decideDrillPass(sec) {
  var mastered = sec.items.every(function (it) { return !it.revealed; });
  var withinTime = sec.totalSec <= sec.targetSec;
  var reason = [];
  if (!mastered) reason.push('มีข้อที่ต้องดูเฉลย');
  if (!withinTime) reason.push('เกินเวลาเป้าหมาย ' + fmtSec(sec.totalSec - sec.targetSec));
  return { pass: mastered && withinTime, mastered: mastered, withinTime: withinTime, reason: reason.join(', ') };
}

/** ปรับระดับความยาก (1–4) ของส่วน B/C ตามผล 3 ครั้งล่าสุด (เปอร์เซ็นต์ 0–100) */
function adjustTier(tier, recentPcts) {
  if (recentPcts.length < 3) return tier;
  var last3 = recentPcts.slice(-3);
  var avg = last3.reduce(function (s, x) { return s + x; }, 0) / 3;
  if (avg >= 85 && tier < 4) return tier + 1;
  if (avg <= 50 && tier > 1) return tier - 1;
  return tier;
}

/**
 * เปรียบเทียบค่า: คืน {cls:'up'|'down'|'flat', diff, arrow, text}
 * lowerBetter = true สำหรับเวลา (วินาที/ข้อ) — ลดลง = ดีขึ้น
 * ถ้าเปลี่ยนไม่เกิน thr (หน่วยเดียวกับค่า สำหรับ %, หรือเป็น % ของค่าเดิมสำหรับเวลา) = เทา
 */
function deltaInfo(cur, prev, thr, lowerBetter) {
  if (cur == null || prev == null || cur === '' || prev === '') return { cls: 'none', diff: null, arrow: '', text: '–' };
  var diff = cur - prev;
  var size = lowerBetter ? (prev ? Math.abs(diff) / prev * 100 : 0) : Math.abs(diff);
  var better = lowerBetter ? diff < 0 : diff > 0;
  if (size <= thr) return { cls: 'flat', diff: diff, arrow: '●', text: '● ' + (diff >= 0 ? '+' : '') + round1(diff) };
  return {
    cls: better ? 'up' : 'down', diff: diff, arrow: better ? '▲' : '▼',
    text: (better ? '▲ ' : '▼ ') + (diff >= 0 ? '+' : '') + round1(diff)
  };
}
function round1(x) { return Math.round(x * 10) / 10; }

/**
 * สรุปหนึ่งบรรทัด: stats = [{name, cur, base}] (เปอร์เซ็นต์ถูก)
 */
function summaryLine(stats) {
  var withBase = stats.filter(function (s) { return s.cur != null && s.base != null; });
  if (!withBase.length) return 'ยังไม่มีข้อมูลเทียบ';
  var best = withBase.slice().sort(function (a, b) { return (b.cur - b.base) - (a.cur - a.base); })[0];
  var weak = withBase.slice().sort(function (a, b) { return a.cur - b.cur; })[0];
  var s = 'ดีขึ้นมากสุด: ' + best.name + ' (' + (best.cur - best.base >= 0 ? '+' : '') + round1(best.cur - best.base) + '%)';
  s += ' / ควรช่วย: ' + weak.name + ' (ถูก ' + round1(weak.cur) + '%)';
  return s;
}

// ======================= Generators.gs =======================
/**
 * Generators.gs — ตัวสร้างโจทย์คิดเลขเร็วแบบคุมอง (50 ขั้น) สุ่มตัวเลขใหม่ทุกครั้ง
 * ไม่เรียก API ของ Google (ทดสอบด้วย Node ได้)
 *
 * แต่ละขั้น: id, skill, no (ลำดับในทักษะ), name, n (จำนวนข้อต่อวัน), spp (วินาทีเป้าหมายต่อข้อ)
 * เวลาเป้าหมายของส่วน A = n × spp
 */

var SKILLS = ['addsub', 'mul', 'div', 'fracdec'];
var SKILL_NAMES = { addsub: 'บวกลบ', mul: 'คูณ', div: 'หาร', fracdec: 'เศษส่วนทศนิยม' };
var CAT_NAMES = {
  addsub: 'บวกลบ', mul: 'คูณ', div: 'หาร', fracdec: 'เศษส่วนทศนิยม',
  word: 'โจทย์ปัญหา', observe: 'การสังเกต', analytic: 'คิดวิเคราะห์'
};
var CATS = ['addsub', 'mul', 'div', 'fracdec', 'word', 'observe', 'analytic'];

var STEPS = [];
var STEP_BY_ID = {};
function S(id, skill, name, n, spp, gen) {
  var st = { id: id, skill: skill, name: name, n: n, spp: spp, gen: gen };
  st.no = STEPS.filter(function (x) { return x.skill === skill; }).length + 1;
  STEPS.push(st); STEP_BY_ID[id] = st;
}
function skillSteps(skill) { return STEPS.filter(function (s) { return s.skill === skill; }); }
function stepOf(skill, no) {
  var list = skillSteps(skill);
  return list[Math.max(1, Math.min(no, list.length)) - 1];
}

/** สร้างโจทย์ 1 ข้อของขั้น id */
function genStep(id) {
  var st = STEP_BY_ID[id];
  var it = st.gen();
  it.cat = st.skill;
  it.key = 'GEN:' + id;
  it.tag = id;
  it.type = it.type || 'int';
  it.ans = String(it.ans);
  if (!it.explain) it.explain = 'ลองคิดใหม่ทีละหลักอย่างระมัดระวัง';
  return it;
}

/* ---------- ตัวช่วยเรื่องหลัก ---------- */
function carries(a, b) {
  var c = 0, n = 0;
  while (a > 0 || b > 0) { var s = a % 10 + b % 10 + c; c = s >= 10 ? 1 : 0; n += c; a = Math.floor(a / 10); b = Math.floor(b / 10); }
  return n;
}
function borrows(a, b) {
  var br = 0, n = 0;
  while (a > 0 || b > 0) { var d = a % 10 - br - b % 10; br = d < 0 ? 1 : 0; n += br; a = Math.floor(a / 10); b = Math.floor(b / 10); }
  return n;
}
function addNoCarry(a, b) {
  var r = 0, p = 1;
  while (a > 0 || b > 0) { r += ((a % 10 + b % 10) % 10) * p; p *= 10; a = Math.floor(a / 10); b = Math.floor(b / 10); }
  return r;
}
function subNoBorrow(a, b) {
  var r = 0, p = 1;
  while (a > 0 || b > 0) { r += Math.abs(a % 10 - b % 10) * p; p *= 10; a = Math.floor(a / 10); b = Math.floor(b / 10); }
  return r;
}
function mulNoCarry(a, m) {
  var r = 0, p = 1;
  while (a > 0) { r += ((a % 10) * m % 10) * p; p *= 10; a = Math.floor(a / 10); }
  return r;
}
/** ทุกหลักคูณ m แล้วไม่เกิน 9 */
function mulNoCarryOK(a, m) { while (a > 0) { if ((a % 10) * m > 9) return false; a = Math.floor(a / 10); } return true; }

function C(q, ans, extra) {
  var it = { q: q, ans: String(ans), type: 'int' };
  if (extra) for (var k in extra) it[k] = extra[k];
  return it;
}
function trap(obj) { var o = {}; for (var k in obj) if (String(k) !== 'undefined') o[k] = obj[k]; return o; }
function addItem(a, b, ex) {
  var t = {}; if (carries(a, b)) t[addNoCarry(a, b)] = 'ทดผิด/ลืมทด';
  return C(a + ' + ' + b + ' =', a + b, { traps: t, explain: ex || 'บวกจากหลักหน่วยไปทางซ้าย อย่าลืมเลขที่ทดไว้' });
}
function subItem(a, b, ex) {
  var t = {}; if (borrows(a, b)) t[subNoBorrow(a, b)] = 'ยืมผิด/ลืมยืม';
  return C(a + ' − ' + b + ' =', a - b, { traps: t, explain: ex || 'ลบจากหลักหน่วย ถ้าตัวบนน้อยกว่าให้ยืมหลักถัดไป และอย่าลืมลดหลักที่ถูกยืม' });
}
function mulItem(a, b, ex) {
  var t = {}; if (b < 10 && mulNoCarry(a, b) !== a * b) t[mulNoCarry(a, b)] = 'ทดผิด/ลืมทด';
  return C(a + ' × ' + b + ' =', a * b, { traps: t, explain: ex || 'คูณทีละหลักจากหลักหน่วย แล้วบวกเลขที่ทดไว้' });
}
function divItem(a, b) {
  return C(a + ' ÷ ' + b + ' =', a / b, { explain: 'ใช้สูตรคูณช่วย: ' + b + ' × ? = ' + a });
}
function divRemItem(a, b) {
  var q = Math.floor(a / b), r = a % b;
  return C(a + ' ÷ ' + b + ' =', q + '|' + r, {
    type: 'divrem', fields: ['ผลหาร', 'เศษ'],
    explain: 'ตรวจคำตอบ: ผลหาร × ' + b + ' + เศษ ต้องได้ ' + a + ' และเศษต้องน้อยกว่า ' + b
  });
}
function pair(la, lb) { return [rndN(la), rndN(lb)]; }

/* =================== บวกลบ (12 ขั้น) =================== */
S('AS01', 'addsub', 'บวก 2 หลัก ไม่มีทด', 30, 6, function () {
  var p = retry(function () { return pair(2, 2); }, function (p) { return carries(p[0], p[1]) === 0; });
  return addItem(p[0], p[1]);
});
S('AS02', 'addsub', 'บวก 2 หลัก มีทดหลักหน่วย', 30, 8, function () {
  var p = retry(function () { return pair(2, 2); }, function (p) { return carries(p[0], p[1]) === 1 && p[0] % 10 + p[1] % 10 >= 10; });
  return addItem(p[0], p[1]);
});
S('AS03', 'addsub', 'ลบ 2 หลัก ไม่มียืม', 30, 7, function () {
  var p = retry(function () { return pair(2, 2); }, function (p) { return p[0] > p[1] && borrows(p[0], p[1]) === 0; });
  return subItem(p[0], p[1]);
});
S('AS04', 'addsub', 'ลบ 2 หลัก มียืม', 30, 9, function () {
  var p = retry(function () { return pair(2, 2); }, function (p) { return p[0] > p[1] && borrows(p[0], p[1]) === 1; });
  return subItem(p[0], p[1]);
});
S('AS05', 'addsub', 'บวก 3 หลัก มีทด', 25, 12, function () {
  var p = retry(function () { return pair(3, 3); }, function (p) { var c = carries(p[0], p[1]); return c >= 1 && c <= 2 && p[0] + p[1] < 1000; });
  return addItem(p[0], p[1]);
});
S('AS06', 'addsub', 'ลบ 3 หลัก มียืม', 25, 14, function () {
  var p = retry(function () { return pair(3, 3); }, function (p) { return p[0] > p[1] && borrows(p[0], p[1]) >= 1; });
  return subItem(p[0], p[1]);
});
S('AS07', 'addsub', 'บวก 4 หลัก ทดหลายครั้ง', 25, 16, function () {
  var p = retry(function () { return pair(4, 4); }, function (p) { return carries(p[0], p[1]) >= 2; });
  return addItem(p[0], p[1]);
});
S('AS08', 'addsub', 'ลบ 4 หลัก ยืมหลายครั้ง', 25, 18, function () {
  var p = retry(function () { return pair(4, 4); }, function (p) { return p[0] > p[1] && borrows(p[0], p[1]) >= 2; });
  return subItem(p[0], p[1]);
});
S('AS09', 'addsub', 'บวก/ลบ 5 หลัก', 20, 22, function () {
  if (chance(0.5)) {
    var p = retry(function () { return pair(5, 5); }, function (p) { return carries(p[0], p[1]) >= 2; });
    return addItem(p[0], p[1]);
  }
  var q = retry(function () { return pair(5, 5); }, function (p) { return p[0] > p[1] && borrows(p[0], p[1]) >= 2; });
  return subItem(q[0], q[1]);
});
S('AS10', 'addsub', 'ลบจากจำนวนที่มีศูนย์ (เช่น 5000 − 2467)', 25, 18, function () {
  var a;
  if (chance(0.5)) a = pick([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000, 50000]);
  else a = ri(1, 9) * 1000 + pick([ri(1, 9), ri(1, 9) * 10]);
  var b = retry(function () { return ri(Math.floor(a / 10) + 1, a - 1); }, function (b) { return borrows(a, b) >= 2; });
  return subItem(a, b, 'ยืมต่อกันข้ามหลักที่เป็นศูนย์ ศูนย์ที่ถูกยืมจะกลายเป็น 9');
});
S('AS11', 'addsub', 'บวกลบระคน 3 จำนวน (4 หลัก)', 20, 28, function () {
  var a = rndN(4), b = rndN(4), c;
  if (chance(0.5)) {
    c = ri(1000, Math.min(9999, a + b - 1));
    return C(a + ' + ' + b + ' − ' + c + ' =', a + b - c, { explain: 'ทำจากซ้ายไปขวา: บวกก่อน แล้วค่อยลบ' });
  }
  var x = Math.max(a, b), y = Math.min(a, b);
  if (x === y) x++;
  c = rndN(4);
  return C(x + ' − ' + y + ' + ' + c + ' =', x - y + c, { explain: 'ทำจากซ้ายไปขวา: ลบก่อน แล้วค่อยบวก' });
});
S('AS12', 'addsub', 'บวก/ลบ จำนวนหลักแสน–หลักล้าน', 20, 30, function () {
  var la = pick([6, 6, 7]);
  if (chance(0.5)) {
    var p = retry(function () { return pair(la, 6); }, function (p) { return carries(p[0], p[1]) >= 2; });
    return addItem(p[0], p[1]);
  }
  var q = retry(function () { return pair(la, 6); }, function (p) { return p[0] > p[1] && borrows(p[0], p[1]) >= 2; });
  return subItem(q[0], q[1]);
});

/* =================== คูณ (12 ขั้น) =================== */
S('MU01', 'mul', 'สูตรคูณแม่ 2–5', 30, 4, function () {
  var a = ri(2, 5), b = ri(1, 9);
  return chance(0.5) ? mulItem(a, b) : mulItem(b, a);
});
S('MU02', 'mul', 'สูตรคูณแม่ 6–12', 30, 5, function () {
  var a = ri(6, 12), b = ri(2, 9);
  return chance(0.5) ? mulItem(a, b) : mulItem(b, a);
});
S('MU03', 'mul', '2 หลัก × 1 หลัก ไม่มีทด', 30, 7, function () {
  var p = retry(function () { return [rndN(2), ri(2, 4)]; }, function (p) { return mulNoCarryOK(p[0], p[1]); });
  return mulItem(p[0], p[1]);
});
S('MU04', 'mul', '2 หลัก × 1 หลัก มีทด', 25, 10, function () {
  var p = retry(function () { return [rndN(2), ri(2, 9)]; }, function (p) { return !mulNoCarryOK(p[0], p[1]); });
  return mulItem(p[0], p[1]);
});
S('MU05', 'mul', '3 หลัก × 1 หลัก ไม่มีทด', 25, 10, function () {
  var p = retry(function () { return [rndN(3), ri(2, 4)]; }, function (p) { return mulNoCarryOK(p[0], p[1]); });
  return mulItem(p[0], p[1]);
});
S('MU06', 'mul', '3 หลัก × 1 หลัก มีทด', 25, 14, function () {
  var p = retry(function () { return [rndN(3), ri(3, 9)]; }, function (p) { return mulNoCarry(p[0], p[1]) !== p[0] * p[1]; });
  return mulItem(p[0], p[1]);
});
S('MU07', 'mul', '4 หลัก × 1 หลัก', 20, 18, function () {
  var p = retry(function () { return [rndN(4), ri(3, 9)]; }, function (p) { return mulNoCarry(p[0], p[1]) !== p[0] * p[1]; });
  return mulItem(p[0], p[1]);
});
S('MU08', 'mul', 'คูณด้วย 10, 100, 1000 และพหุคูณของ 10', 30, 8, function () {
  var t = ri(0, 2);
  if (t === 0) return mulItem(ri(11, 99), pick([10, 100, 1000]), 'คูณ 10 เติมศูนย์ 1 ตัว คูณ 100 เติม 2 ตัว คูณ 1000 เติม 3 ตัว');
  if (t === 1) return mulItem(ri(2, 9) * 10, ri(2, 9) * 10, 'คูณเลขหน้าก่อน แล้วเติมศูนย์ตามจำนวนศูนย์ทั้งหมด');
  return mulItem(ri(11, 99), ri(2, 9) * 10, 'คูณกับเลขหน้าศูนย์ก่อน แล้วเติมศูนย์ 1 ตัว');
});
S('MU09', 'mul', '2 หลัก × 2 หลัก ไม่มีทด', 25, 20, function () {
  var a = ri(1, 4) * 10 + ri(0, 2), b = ri(1, 2) * 10 + ri(1, 2);
  return chance(0.5) ? mulItem(a, b, 'คูณหลักหน่วยก่อน แล้วคูณหลักสิบ (อย่าลืมเลื่อนหลัก) แล้วนำมาบวกกัน') :
    mulItem(b, a, 'คูณหลักหน่วยก่อน แล้วคูณหลักสิบ (อย่าลืมเลื่อนหลัก) แล้วนำมาบวกกัน');
});
S('MU10', 'mul', '2 หลัก × 2 หลัก มีทด', 20, 35, function () {
  var a = ri(13, 99), b = ri(13, 99);
  return mulItem(a, b, 'แยกคูณ: ' + a + ' × ' + (b % 10) + ' และ ' + a + ' × ' + (b - b % 10) + ' แล้วบวกกัน');
});
S('MU11', 'mul', '3 หลัก × 2 หลัก (ตัวคูณเลขเล็ก)', 20, 40, function () {
  var a = rndN(3), b = ri(1, 3) * 10 + ri(1, 3);
  return mulItem(a, b, 'แยกคูณ: ' + a + ' × ' + (b % 10) + ' และ ' + a + ' × ' + (b - b % 10) + ' แล้วบวกกัน');
});
S('MU12', 'mul', '3 หลัก × 2 หลัก', 20, 45, function () {
  var a = ri(100, 499), b = ri(14, 49);
  return mulItem(a, b, 'แยกคูณ: ' + a + ' × ' + (b % 10) + ' และ ' + a + ' × ' + (b - b % 10) + ' แล้วบวกกัน');
});

/* =================== หาร (11 ขั้น) =================== */
S('DV01', 'div', 'สูตรหาร (หารลงตัว)', 30, 5, function () {
  var b = ri(2, 9), q = ri(2, 9);
  return divItem(b * q, b);
});
S('DV02', 'div', '2 หลัก ÷ 1 หลัก ลงตัว', 30, 8, function () {
  var b = ri(2, 9), q = ri(Math.ceil(20 / b), Math.floor(99 / b));
  q = Math.max(q, Math.ceil(10 / b));
  return divItem(b * q, b);
});
S('DV03', 'div', '2 หลัก ÷ 1 หลัก มีเศษ', 30, 12, function () {
  var p = retry(function () { return [ri(20, 99), ri(3, 9)]; }, function (p) { return p[0] % p[1] !== 0; });
  return divRemItem(p[0], p[1]);
});
S('DV04', 'div', '3 หลัก ÷ 1 หลัก ลงตัว', 25, 14, function () {
  var b = ri(2, 9), q = ri(Math.ceil(100 / b), Math.floor(999 / b));
  return divItem(b * q, b);
});
S('DV05', 'div', '3 หลัก ÷ 1 หลัก มีเศษ', 25, 18, function () {
  var p = retry(function () { return [ri(100, 999), ri(3, 9)]; }, function (p) { return p[0] % p[1] !== 0; });
  return divRemItem(p[0], p[1]);
});
S('DV06', 'div', '4 หลัก ÷ 1 หลัก ลงตัว (มีศูนย์ในผลหาร)', 25, 22, function () {
  var p = retry(function () {
    var b = ri(2, 9), q = chance(0.6) ? ri(1, 9) * 100 + pick([ri(1, 9), ri(1, 9) * 10]) + (chance(0.5) ? ri(1, 9) * 1000 : 0) : ri(100, 4999);
    return [b * q, b];
  }, function (p) { return p[0] >= 1000 && p[0] <= 9999; });
  return divItem(p[0], p[1]);
});
S('DV07', 'div', '4 หลัก ÷ 1 หลัก มีเศษ', 20, 28, function () {
  var p = retry(function () { return [ri(1000, 9999), ri(3, 9)]; }, function (p) { return p[0] % p[1] !== 0; });
  return divRemItem(p[0], p[1]);
});
S('DV08', 'div', 'หารด้วย 10, 100 และตัวหารลงท้ายด้วยศูนย์', 30, 8, function () {
  if (chance(0.5)) {
    var m = pick([10, 100, 1000]), q = ri(2, 99);
    return C((q * m) + ' ÷ ' + m + ' =', q, { explain: 'หารด้วย ' + m + ' ตัดศูนย์ออกเท่ากับจำนวนศูนย์ของตัวหาร' });
  }
  var b = ri(2, 9) * 10, q2 = ri(2, 99);
  return C((q2 * b) + ' ÷ ' + b + ' =', q2, { explain: 'ตัดศูนย์ออกข้างละ 1 ตัวก่อน แล้วค่อยหาร' });
});
S('DV09', 'div', '2–3 หลัก ÷ 2 หลัก ลงตัว', 20, 30, function () {
  var b = ri(11, 30), q = ri(Math.ceil(100 / b), Math.floor(999 / b));
  return divItem(b * q, b);
});
S('DV10', 'div', '3–4 หลัก ÷ 2 หลัก มีเศษ', 20, 40, function () {
  var p = retry(function () { return [ri(300, 9999), ri(11, 60)]; }, function (p) { return p[0] % p[1] !== 0; });
  return divRemItem(p[0], p[1]);
});
S('DV11', 'div', '4–5 หลัก ÷ 2 หลัก', 20, 45, function () {
  var b = ri(12, 89);
  if (chance(0.5)) return divItem(b * ri(Math.ceil(1000 / b), Math.floor(99999 / b)), b);
  var a = retry(function () { return ri(1000, 99999); }, function (a) { return a % b !== 0; });
  return divRemItem(a, b);
});

/* =================== เศษส่วนและทศนิยม (15 ขั้น) =================== */
function fracItem(q, n, d, extra) {
  return C(q, fracStr(n, d), Object.assign({ type: 'frac' }, extra || {}));
}
S('FD01', 'fracdec', 'เศษส่วนที่เท่ากัน (เติมตัวเลข)', 25, 12, function () {
  var b = ri(2, 9), a = ri(1, b - 1), k = ri(2, 6);
  if (chance(0.5)) return C(F(a, b) + ' = ' + F('?', b * k), a * k, { explain: 'ตัวส่วนคูณ ' + k + ' ตัวเศษก็ต้องคูณ ' + k });
  return C(F(a, b) + ' = ' + F(a * k, '?'), b * k, { explain: 'ตัวเศษคูณ ' + k + ' ตัวส่วนก็ต้องคูณ ' + k });
});
S('FD02', 'fracdec', 'ทำเศษส่วนให้เป็นอย่างต่ำ', 25, 15, function () {
  var xy = retry(function () { var y = ri(2, 9); return [ri(1, y - 1), y]; }, function (p) { return gcd(p[0], p[1]) === 1; });
  var g = ri(2, 6);
  return fracItem('ทำให้เป็นอย่างต่ำ  ' + F(xy[0] * g, xy[1] * g) + ' =', xy[0], xy[1], { explain: 'หาเลขที่หารทั้งตัวเศษและตัวส่วนลงตัว (ห.ร.ม.) แล้วหาร' });
});
S('FD03', 'fracdec', 'เศษเกิน → จำนวนคละ', 25, 15, function () {
  var b = ri(2, 9), w = ri(1, 6);
  var r = retry(function () { return ri(1, b - 1); }, function (r) { return gcd(r, b) === 1; });
  return fracItem('เขียนเป็นจำนวนคละ  ' + F(w * b + r, b) + ' =', w * b + r, b,
    { form: 'mixed', explain: (w * b + r) + ' ÷ ' + b + ' ได้ ' + w + ' เศษ ' + r + ' → จำนวนเต็ม ' + w + ' เศษ ' + r + ' ส่วน ' + b });
});
S('FD04', 'fracdec', 'จำนวนคละ → เศษเกิน', 25, 15, function () {
  var b = ri(2, 9), w = ri(1, 6);
  var r = retry(function () { return ri(1, b - 1); }, function (r) { return gcd(r, b) === 1; });
  return C('เขียนเป็นเศษเกิน  ' + FM(w, r, b) + ' =', (w * b + r) + '/' + b,
    { type: 'frac', form: 'improper', explain: w + ' × ' + b + ' + ' + r + ' = ' + (w * b + r) + ' เป็นตัวเศษ ตัวส่วนเท่าเดิม' });
});
S('FD05', 'fracdec', 'บวกเศษส่วน ตัวส่วนเท่ากัน', 25, 15, function () {
  var b = ri(3, 12), a = ri(1, b - 1), c = ri(1, b - 1);
  return fracItem(F(a, b) + ' + ' + F(c, b) + ' =', a + c, b, { explain: 'ตัวส่วนเท่ากัน บวกเฉพาะตัวเศษ แล้วทำเป็นอย่างต่ำ/จำนวนคละ' });
});
S('FD06', 'fracdec', 'ลบเศษส่วน ตัวส่วนเท่ากัน', 25, 15, function () {
  var b = ri(3, 12), a = ri(2, b - 1), c = ri(1, a - 1);
  return fracItem(F(a, b) + ' − ' + F(c, b) + ' =', a - c, b, { explain: 'ตัวส่วนเท่ากัน ลบเฉพาะตัวเศษ แล้วทำเป็นอย่างต่ำ' });
});
S('FD07', 'fracdec', 'บวกจำนวนคละ ตัวส่วนเท่ากัน', 25, 20, function () {
  var b = ri(3, 12), a = ri(1, b - 2), c = ri(1, b - 1 - a), w1 = ri(1, 5), w2 = ri(1, 5);
  return fracItem(FM(w1, a, b) + ' + ' + FM(w2, c, b) + ' =', (w1 + w2) * b + a + c, b, { explain: 'บวกจำนวนเต็มกับจำนวนเต็ม บวกเศษส่วนกับเศษส่วน' });
});
S('FD08', 'fracdec', 'ลบจำนวนคละ ตัวส่วนเท่ากัน (ต้องยืม)', 25, 25, function () {
  var b = ri(3, 12), c = ri(2, b - 1), a = ri(1, c - 1), w2 = ri(1, 4), w1 = w2 + ri(1, 4);
  return fracItem(FM(w1, a, b) + ' − ' + FM(w2, c, b) + ' =', (w1 * b + a) - (w2 * b + c), b,
    { explain: 'เศษส่วนตัวตั้งน้อยกว่า ยืม 1 จากจำนวนเต็ม (1 = ' + F(b, b) + ')' });
});
S('FD09', 'fracdec', 'บวกลบเศษส่วน ตัวส่วนเป็นพหุคูณกัน', 20, 30, function () {
  var d1 = ri(2, 6), d2 = d1 * pick(d1 <= 4 ? [2, 3] : [2]);
  var a = ri(1, d1 - 1), c = ri(1, d2 - 1);
  var A = a * (d2 / d1), first = [F(a, d1), A], second = [F(c, d2), c];
  if (chance(0.5) && A !== c) {
    var big = A > c ? first : second, small = A > c ? second : first;
    return fracItem(big[0] + ' − ' + small[0] + ' =', big[1] - small[1], d2, { explain: 'ทำตัวส่วนให้เท่ากันเป็น ' + d2 + ' ก่อน แล้วลบตัวเศษ' });
  }
  var o = chance(0.5);
  return fracItem((o ? first[0] + ' + ' + second[0] : second[0] + ' + ' + first[0]) + ' =', A + c, d2, { explain: 'ทำตัวส่วนให้เท่ากันเป็น ' + d2 + ' ก่อน แล้วบวกตัวเศษ' });
});
S('FD10', 'fracdec', 'บวกลบจำนวนคละ ตัวส่วนต่างกัน', 20, 45, function () {
  var pr = pick([[2, 3], [3, 4], [2, 5], [4, 6], [3, 6], [2, 4], [4, 3], [6, 4], [5, 2], [2, 6]]);
  var d1 = pr[0], d2 = pr[1], L = lcm(d1, d2);
  var v = retry(function () {
    var w1 = ri(1, 6), a = ri(1, d1 - 1), w2 = ri(1, 5), c = ri(1, d2 - 1);
    return { w1: w1, a: a, w2: w2, c: c, N1: (w1 * d1 + a) * (L / d1), N2: (w2 * d2 + c) * (L / d2), minus: chance(0.5) };
  }, function (v) { return !v.minus || v.N1 > v.N2; });
  var q = FM(v.w1, v.a, d1) + (v.minus ? ' − ' : ' + ') + FM(v.w2, v.c, d2) + ' =';
  return fracItem(q, v.minus ? v.N1 - v.N2 : v.N1 + v.N2, L, { explain: 'ทำตัวส่วนให้เท่ากันเป็น ' + L + ' ก่อน แล้วคิดจำนวนเต็มกับเศษส่วนแยกกัน' });
});
S('FD11', 'fracdec', 'เศษส่วน (ส่วน 10, 100) → ทศนิยม', 30, 10, function () {
  var d = pick([10, 100]), p = d === 10 ? 1 : 2, n = d === 10 ? ri(1, 9) : ri(1, 99);
  if (d === 100 && n % 10 === 0) n += ri(1, 9);
  var w = chance(0.3) ? ri(1, 5) : 0;
  return C(FM(w, n, d) + ' = (ทศนิยม)', trimDec(fmtScaled(w * d + n, p)), { type: 'dec', explain: 'ส่วน 10 = ทศนิยม 1 ตำแหน่ง, ส่วน 100 = ทศนิยม 2 ตำแหน่ง' });
});
S('FD12', 'fracdec', 'บวกทศนิยม 1 ตำแหน่ง', 25, 12, function () {
  var a = retry(function () { return [ri(11, 199), ri(11, 199)]; }, function (p) { return p[0] % 10 && p[1] % 10; });
  return C(fmtScaled(a[0], 1) + ' + ' + fmtScaled(a[1], 1) + ' =', trimDec(fmtScaled(a[0] + a[1], 1)), { type: 'dec', explain: 'ตั้งจุดทศนิยมให้ตรงกัน แล้วบวกเหมือนจำนวนเต็ม' });
});
S('FD13', 'fracdec', 'ลบทศนิยม 1 ตำแหน่ง', 25, 12, function () {
  var a = retry(function () { return [ri(21, 199), ri(11, 189)]; }, function (p) { return p[0] > p[1] && p[0] % 10 && p[1] % 10; });
  return C(fmtScaled(a[0], 1) + ' − ' + fmtScaled(a[1], 1) + ' =', trimDec(fmtScaled(a[0] - a[1], 1)), { type: 'dec', explain: 'ตั้งจุดทศนิยมให้ตรงกัน แล้วลบเหมือนจำนวนเต็ม' });
});
S('FD14', 'fracdec', 'บวกลบทศนิยม 2 ตำแหน่ง', 25, 22, function () {
  var a = retry(function () { return [ri(101, 9999), ri(101, 9999)]; }, function (p) { return p[0] !== p[1] && (p[0] % 10 || p[1] % 10); });
  if (chance(0.5)) return C(fmtScaled(a[0], 2) + ' + ' + fmtScaled(a[1], 2) + ' =', trimDec(fmtScaled(a[0] + a[1], 2)), { type: 'dec', explain: 'ตั้งจุดทศนิยมให้ตรงกัน' });
  var x = Math.max(a[0], a[1]), y = Math.min(a[0], a[1]);
  return C(fmtScaled(x, 2) + ' − ' + fmtScaled(y, 2) + ' =', trimDec(fmtScaled(x - y, 2)), { type: 'dec', explain: 'ตั้งจุดทศนิยมให้ตรงกัน' });
});
S('FD15', 'fracdec', 'ทศนิยม × จำนวนเต็ม', 20, 25, function () {
  var p = pick([1, 1, 2]), a = p === 1 ? retry(function () { return ri(2, 99); }, function (x) { return x % 10; }) : retry(function () { return ri(11, 499); }, function (x) { return x % 10; });
  var m = ri(2, 9);
  return C(fmtScaled(a, p) + ' × ' + m + ' =', trimDec(fmtScaled(a * m, p)), { type: 'dec', explain: 'คูณเหมือนจำนวนเต็ม แล้วใส่จุดทศนิยมให้มีตำแหน่งเท่าตัวตั้ง (' + p + ' ตำแหน่ง)' });
});

// ======================= Templates.gs =======================
/**
 * Templates.gs — แม่แบบโจทย์ 68 แบบ: โจทย์ปัญหา 22 / การสังเกต 24 / คิดวิเคราะห์ 22 (รวมไว้ในไฟล์เดียว เพราะต้องประกาศฟังก์ชัน T() ก่อนใช้)
 * สุ่มชื่อ สิ่งของ ตัวเลขใหม่ทุกครั้ง ระดับความยาก t = 1..4
 * ไม่เรียก API ของ Google (ทดสอบด้วย Node ได้)
 *
 * item = {key, cat, tpl, q, ans, type, choices?, data?, unit?, traps?, explain, tier}
 */
var TEMPLATES = [];
var TPL_BY_ID = {};
function T(id, cat, grp, min, max, fn) {
  var t = { id: id, cat: cat, grp: grp, min: min, max: max, fn: fn };
  TEMPLATES.push(t); TPL_BY_ID[id] = t;
}
function buildTemplate(id, tier) {
  var t = TPL_BY_ID[id];
  tier = Math.max(t.min, Math.min(t.max, tier));
  var it = t.fn(tier);
  it.cat = t.cat; it.tpl = id; it.key = 'TPL:' + id; it.tag = id; it.tier = tier;
  it.type = it.type || 'int';
  it.ans = String(it.ans);
  if (it.traps) delete it.traps[it.ans];
  if (!it.explain) it.explain = 'อ่านโจทย์ช้า ๆ ขีดเส้นใต้ข้อมูลที่ต้องใช้ แล้วลองคิดทีละขั้น';
  return it;
}
/** เลือกแม่แบบที่รองรับระดับ tier ในหมวด cat (กลุ่ม grp ถ้าระบุ) โดยเลี่ยง exclude */
function pickTemplate(cat, grp, tier, exclude, prefer) {
  var all = TEMPLATES.filter(function (t) { return t.cat === cat && (!grp || t.grp === grp) && t.min <= tier && tier <= t.max; });
  var fresh = all.filter(function (t) { return !exclude || !exclude[t.id]; });
  // prefer = {รหัสแม่แบบ: 1} ที่สอดคล้องกับหัวข้อประจำสัปดาห์: เลือกจากกลุ่มนี้ก่อน (เฉพาะที่ยังไม่ออกซ้ำ) ถ้าไม่มีให้สุ่มรวม
  var pf = prefer ? fresh.filter(function (t) { return prefer[t.id]; }) : [];
  if (pf.length) return pick(pf).id;
  return pick(fresh.length ? fresh : all).id;
}

var PEOPLE = ['ต้น', 'ฟ้า', 'นุ่น', 'บอส', 'มะลิ', 'ภูมิ', 'แพรว', 'กวาง', 'ปลื้ม', 'น้ำใส', 'เจ', 'ใบบัว', 'ก้อง', 'ขวัญ', 'พลอย', 'ธีร์'];
var THINGS = [['ดินสอ', 'แท่ง', 5, 12], ['สมุด', 'เล่ม', 10, 35], ['ขนมปัง', 'ก้อน', 8, 25], ['ไอศกรีม', 'แท่ง', 10, 30],
  ['ปากกา', 'ด้าม', 6, 25], ['ยางลบ', 'ก้อน', 5, 15], ['ลูกโป่ง', 'ลูก', 3, 10], ['สติกเกอร์', 'แผ่น', 2, 8], ['ไข่ไก่', 'ฟอง', 4, 6], ['ลูกอม', 'ถุง', 6, 20]];
function two() { var a = pick(PEOPLE), b = retry(function () { return pick(PEOPLE); }, function (x) { return x !== a; }); return [a, b]; }
/** ประโยคที่ไม่เกี่ยวข้อง (ข้อมูลหลอก) ใส่ตั้งแต่ระดับ 2 */
function distract(t) {
  if (t < 2 || !chance(0.65)) return '';
  return pick(['โรงเรียนนี้มีนักเรียน ' + ri(300, 900) + ' คน', 'วันนั้นเป็นวันเกิดคุณยาย อายุ ' + ri(60, 85) + ' ปี',
    'บ้านอยู่ชั้น ' + ri(2, 9) + ' ของอาคาร', 'ฝนตกตั้งแต่เวลา ' + ri(1, 5) + ' โมงเย็น', 'ร้านนี้เปิดมาแล้ว ' + ri(5, 20) + ' ปี']);
}
function WP(parts) { return parts.filter(function (x) { return x; }).join(' '); }

/* ======================= โจทย์ปัญหา (22) ======================= */
T('W01', 'word', 'w', 1, 4, function (t) {
  var p = pick(PEOPLE), a = pick(THINGS), k = ri(2, 3 + t), pr = ri(a[2], a[3]), total = pr * k, q;
  if (t >= 3) {
    var b = pick(THINGS.filter(function (x) { return x !== a; })), k2 = ri(2, 5), pr2 = ri(b[2], b[3]);
    total += pr2 * k2;
    q = p + 'ซื้อ' + a[0] + a[1] + 'ละ ' + pr + ' บาท จำนวน ' + k + ' ' + a[1] + ' และซื้อ' + b[0] + b[1] + 'ละ ' + pr2 + ' บาท จำนวน ' + k2 + ' ' + b[1];
  } else q = p + 'ซื้อ' + a[0] + a[1] + 'ละ ' + pr + ' บาท จำนวน ' + k + ' ' + a[1];
  var pay = (Math.floor(total / 50) + 1) * 50, tp = {}; tp[total] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([q, distract(t), 'จ่ายเงิน ' + pay + ' บาท จะได้เงินทอนกี่บาท']), ans: pay - total, unit: 'บาท', traps: tp, explain: 'หาราคารวมก่อน แล้วนำเงินที่จ่ายลบราคารวม = ' + pay + ' − ' + total };
});
T('W02', 'word', 'w', 1, 4, function (t) {
  var n = two(), x = ri(8 * t, 20 * t), y = ri(3, 10) * t, tp = {}; tp[x + y] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([n[0] + 'มีสติกเกอร์ ' + x + ' แผ่น ' + n[1] + 'มีมากกว่า' + n[0] + ' ' + y + ' แผ่น', distract(t), 'ทั้งสองคนมีสติกเกอร์รวมกันกี่แผ่น']), ans: 2 * x + y, unit: 'แผ่น', traps: tp, explain: n[1] + 'มี ' + x + ' + ' + y + ' = ' + (x + y) + ' แผ่น แล้วรวมกับของ' + n[0] };
});
T('W03', 'word', 'w', 1, 4, function (t) {
  var m = ri(4, 9), bags = ri(3, 5 + t), r = ri(1, m - 1), Tt = m * bags + r, th = pick(THINGS), tp = {}; tp[bags] = 'ลืมเศษที่เหลือ';
  return { q: WP(['มี' + th[0] + ' ' + Tt + ' ' + th[1] + ' ใส่ถุงได้ถุงละ ' + m + ' ' + th[1], distract(t), 'ต้องใช้ถุงอย่างน้อยกี่ใบจึงใส่ได้หมด']), ans: bags + 1, unit: 'ใบ', traps: tp, explain: Tt + ' ÷ ' + m + ' ได้ ' + bags + ' เศษ ' + r + ' ของที่เหลือต้องใช้ถุงเพิ่มอีก 1 ใบ' };
});
T('W04', 'word', 'w', 1, 4, function (t) {
  var a = ri(3, 8 + 3 * t), b = ri(3, 8 + 3 * t), p = pick(PEOPLE), tp = {}; tp[a + b] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([p + 'ปั่นจักรยานจากบ้านไปตลาด ' + a + ' กิโลเมตร แล้วไปต่อที่โรงเรียนอีก ' + b + ' กิโลเมตร', distract(t), 'ถ้าปั่นกลับบ้านทางเดิม ตลอดการไปและกลับ' + p + 'ปั่นรวมกี่กิโลเมตร']), ans: 2 * (a + b), unit: 'กิโลเมตร', traps: tp, explain: 'ขาไป ' + a + ' + ' + b + ' = ' + (a + b) + ' กม. ขากลับเท่ากัน จึงคูณ 2' };
});
T('W05', 'word', 'w', 1, 4, function (t) {
  var k = ri(3, 6), u = ri(3, 9) + t, P = k * u, m = ri(5, 12 + 2 * t), th = pick(THINGS), tp = {}; tp[P * m] = 'ไม่ได้หาราคาต่อชิ้น';
  return { q: WP([th[0] + ' 1 แพ็คมี ' + k + ' ' + th[1] + ' ราคาแพ็คละ ' + P + ' บาท', distract(t), 'ถ้าซื้อ ' + m + ' ' + th[1] + ' ต้องจ่ายกี่บาท (ขายแยกชิ้นได้ในราคาเท่ากัน)']), ans: u * m, unit: 'บาท', traps: tp, explain: 'ราคาต่อชิ้น = ' + P + ' ÷ ' + k + ' = ' + u + ' บาท แล้วคูณ ' + m };
});
T('W06', 'word', 'w', 1, 4, function (t) {
  var h = ri(1, 1 + t), m = ri(10, 50), ad = ri(5, 20), p = pick(PEOPLE);
  return { q: WP([p + 'ดูภาพยนตร์ความยาว ' + h + ' ชั่วโมง ' + m + ' นาที', 'ก่อนฉายมีโฆษณา ' + ad + ' นาที', distract(t), 'รวมเวลาที่' + p + 'นั่งอยู่ในโรงภาพยนตร์กี่นาที']), ans: h * 60 + m + ad, unit: 'นาที', explain: '1 ชั่วโมง = 60 นาที แปลงเป็นนาทีทั้งหมดก่อนบวก' };
});
T('W07', 'word', 'w', 1, 4, function (t) {
  var w = ri(4, 10 + 2 * t), l = w + ri(2, 8), tp = {};
  if (t <= 2) { tp[w * l] = 'สับสนพื้นที่กับเส้นรอบรูป'; return { q: WP(['สนามรูปสี่เหลี่ยมผืนผ้ากว้าง ' + w + ' เมตร ยาว ' + l + ' เมตร', distract(t), 'ต้องใช้รั้วล้อมรอบสนามยาวกี่เมตร']), ans: 2 * (w + l), unit: 'เมตร', traps: tp, explain: 'เส้นรอบรูป = (กว้าง + ยาว) × 2' }; }
  if (t === 3) { tp[2 * (w + l)] = 'สับสนพื้นที่กับเส้นรอบรูป'; return { q: WP(['สวนรูปสี่เหลี่ยมผืนผ้ากว้าง ' + w + ' เมตร ยาว ' + l + ' เมตร', distract(t), 'สวนนี้มีพื้นที่กี่ตารางเมตร']), ans: w * l, unit: 'ตารางเมตร', traps: tp, explain: 'พื้นที่ = กว้าง × ยาว' }; }
  var c = ri(3, 9) * 10; tp[2 * (w + l)] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP(['ทำรั้วล้อมแปลงผักรูปสี่เหลี่ยมผืนผ้ากว้าง ' + w + ' เมตร ยาว ' + l + ' เมตร รั้วราคาเมตรละ ' + c + ' บาท', distract(t), 'ต้องจ่ายค่ารั้วกี่บาท']), ans: 2 * (w + l) * c, unit: 'บาท', traps: tp, explain: 'หาเส้นรอบรูปก่อน แล้วคูณราคาต่อเมตร' };
});
T('W08', 'word', 'w', 1, 4, function (t) {
  var b = ri(3, 8), a = retry(function () { return ri(1, b - 1); }, function (x) { return gcd(x, b) === 1; }), u = ri(3, 9) * t + 1, Tt = b * u, tp = {}; tp[u * a] = 'อ่านโจทย์ไม่ครบ';
  var p = pick(PEOPLE), th = pick(THINGS);
  return { q: WP([p + 'มี' + th[0] + ' ' + Tt + ' ' + th[1], 'ให้เพื่อนไป ' + F(a, b) + ' ของทั้งหมด', distract(t), p + 'เหลือ' + th[0] + 'กี่' + th[1]]), ans: Tt - u * a, unit: th[1], traps: tp, explain: Tt + ' ÷ ' + b + ' = ' + u + ' (1 ส่วน) ให้ไป ' + a + ' ส่วน แล้วหาที่เหลือ' };
});
T('W09', 'word', 'w', 1, 4, function (t) {
  var b = ri(5, 12), a = ri(5, b - 1), c = ri(1, a - 1), d = ri(1, b - 1);
  return { q: WP(['ในขวดมีน้ำ ' + F(a, b) + ' ลิตร ดื่มไป ' + F(c, b) + ' ลิตร แล้วเติมน้ำอีก ' + F(d, b) + ' ลิตร', distract(t), 'ตอนนี้ในขวดมีน้ำกี่ลิตร']), ans: fracStr(a - c + d, b), type: 'frac', unit: 'ลิตร', explain: 'ตัวส่วนเท่ากัน คิดเฉพาะตัวเศษ ' + a + ' − ' + c + ' + ' + d + ' แล้วทำให้เป็นอย่างต่ำ' };
});
T('W10', 'word', 'w', 1, 4, function (t) {
  var p = t >= 3 ? 2 : 1, A = p === 1 ? ri(21, 99) : ri(201, 999), B = ri(Math.floor(A / 5), A - 5), n = pick(PEOPLE);
  return { q: WP([n + 'มีริบบิ้นยาว ' + fmtScaled(A, p) + ' เมตร ตัดไปใช้ ' + fmtScaled(B, p) + ' เมตร', distract(t), 'เหลือริบบิ้นยาวกี่เมตร']), ans: trimDec(fmtScaled(A - B, p)), type: 'dec', unit: 'เมตร', explain: 'ตั้งจุดทศนิยมให้ตรงกันแล้วลบ' };
});
T('W11', 'word', 'w', 1, 4, function (t) {
  var A = retry(function () { return ri(12, 19 + 10 * t); }, function (x) { return x % 10; }), m = ri(3, 9), th = pick(['แอปเปิ้ล', 'ส้ม', 'มะม่วง', 'ลำไย']);
  return { q: WP([th + 'ถุงหนึ่งหนัก ' + fmtScaled(A, 1) + ' กิโลกรัม', distract(t), 'ซื้อ ' + m + ' ถุง รวมหนักกี่กิโลกรัม']), ans: trimDec(fmtScaled(A * m, 1)), type: 'dec', unit: 'กิโลกรัม', explain: 'คูณ ' + fmtScaled(A, 1) + ' × ' + m + ' (คูณเหมือนจำนวนเต็มแล้วใส่จุดทศนิยม 1 ตำแหน่ง)' };
});
T('W12', 'word', 'w', 1, 4, function (t) {
  var r = ri(4, 6 + t), c = ri(5, 9), s = r * c - ri(2, 9), tp = {}; tp[r * c] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP(['ห้องประชุมมีเก้าอี้ ' + r + ' แถว แถวละ ' + c + ' ตัว', distract(t), 'วันนี้มีคนมา ' + s + ' คน นั่งคนละ 1 ตัว เหลือเก้าอี้ว่างกี่ตัว']), ans: r * c - s, unit: 'ตัว', traps: tp, explain: 'เก้าอี้ทั้งหมด ' + r + ' × ' + c + ' = ' + (r * c) + ' แล้วลบจำนวนคน' };
});
T('W13', 'word', 'w', 1, 4, function (t) {
  var s = ri(20, 60) + 10 * t, wk = ri(3, 5 + t), h = ri(50, 200), G = h + s * wk, p = pick(PEOPLE);
  return { q: WP([p + 'อยากซื้อของราคา ' + commas(G) + ' บาท มีเงินอยู่แล้ว ' + h + ' บาท และออมเพิ่มสัปดาห์ละ ' + s + ' บาท', distract(t), 'ต้องออมอีกกี่สัปดาห์จึงจะพอซื้อ']), ans: wk, unit: 'สัปดาห์', explain: 'เงินที่ยังขาด = ' + (G - h) + ' แล้วหารด้วย ' + s };
});
T('W14', 'word', 'w', 2, 4, function (t) {
  var x = ri(10, 40) * (t - 1) + ri(5, 20), d = ri(5, 30), S = 2 * x + d, n = two(), tp = {}; tp[S - d] = 'ใช้วิธีผิด (ลืมหารสอง)';
  return { q: WP([n[0] + 'กับ' + n[1] + 'มีเงินรวมกัน ' + commas(S) + ' บาท ' + n[0] + 'มีมากกว่า' + n[1] + ' ' + d + ' บาท', n[0] + 'มีเงินกี่บาท']), ans: x + d, unit: 'บาท', traps: tp, explain: 'เอาส่วนต่างออก ' + S + ' − ' + d + ' = ' + (S - d) + ' แบ่งสองส่วนเท่ากัน ได้ส่วนน้อย ' + x + ' แล้วบวกส่วนต่างให้คนที่มีมากกว่า' };
});
T('W15', 'word', 'w', 1, 4, function (t) {
  var m = ri(4, 8), bx = ri(5, 9 + t), P = ri(20, 60), th = pick(['ส้ม', 'มะม่วง', 'ไข่ไก่', 'ลูกอม']), tp = {};
  if (t < 3) return { q: WP([th + ' ' + (m * bx) + ' ผล ใส่กล่องละ ' + m + ' ผล ขายกล่องละ ' + P + ' บาท', distract(t), 'ขายหมดทุกกล่องได้เงินกี่บาท']), ans: bx * P, unit: 'บาท', explain: 'หาจำนวนกล่อง ' + (m * bx) + ' ÷ ' + m + ' = ' + bx + ' แล้วคูณราคา' };
  var r = ri(1, m - 1); tp[(bx + 1) * P] = 'ลืมเศษที่เหลือ';
  return { q: WP([th + ' ' + (m * bx + r) + ' ผล ใส่กล่องละ ' + m + ' ผล (ต้องใส่ให้เต็มกล่องเท่านั้นจึงขาย) ขายกล่องละ ' + P + ' บาท', distract(t), 'ขายกล่องที่เต็มทั้งหมดได้เงินกี่บาท']), ans: bx * P, unit: 'บาท', traps: tp, explain: 'กล่องที่เต็มมี ' + bx + ' กล่อง ผลที่เหลือ ' + r + ' ผลไม่นับ' };
});
T('W16', 'word', 'w', 1, 4, function (t) {
  var k = ri(10, 30 + 5 * t), c = ri(5, 20), s = c + ri(2, 10), tp = {}, p = pick(PEOPLE); tp[k * s] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([p + 'ซื้อขนมมา ' + k + ' ชิ้น ราคาชิ้นละ ' + c + ' บาท แล้วขายหมดในราคาชิ้นละ ' + s + ' บาท', distract(t), p + 'ได้กำไรกี่บาท']), ans: k * (s - c), unit: 'บาท', traps: tp, explain: 'กำไรต่อชิ้น = ' + s + ' − ' + c + ' แล้วคูณจำนวนชิ้น' };
});
T('W17', 'word', 'w', 1, 4, function (t) {
  var a = ri(1, 1 + t), b = ri(1, 9) * 100, u = ri(2, Math.floor((a * 1000 + b) / 50) - 1) * 50;
  return { q: WP(['ซื้อน้ำตาล ' + a + ' กิโลกรัม กับอีก ' + b + ' กรัม ใช้ทำขนมไป ' + u + ' กรัม', distract(t), 'เหลือน้ำตาลกี่กรัม']), ans: a * 1000 + b - u, unit: 'กรัม', explain: '1 กิโลกรัม = 1,000 กรัม แปลงเป็นกรัมทั้งหมดก่อน' };
});
T('W18', 'word', 'w', 1, 4, function (t) {
  var A = ri(20, 60) + 10 * t, Cc = ri(10, A - 5), x = ri(1, 3), y = ri(2, 4), total = x * A + y * Cc, tp = {};
  if (t < 3) { tp[x * A] = 'อ่านโจทย์ไม่ครบ'; return { q: WP(['บัตรเข้าสวนสัตว์ ผู้ใหญ่ใบละ ' + A + ' บาท เด็กใบละ ' + Cc + ' บาท ซื้อบัตรผู้ใหญ่ ' + x + ' ใบ เด็ก ' + y + ' ใบ', distract(t), 'ต้องจ่ายกี่บาท']), ans: total, unit: 'บาท', traps: tp, explain: 'ผู้ใหญ่ ' + x + ' × ' + A + ' บวกเด็ก ' + y + ' × ' + Cc }; }
  var pay = (Math.floor(total / 100) + 1) * 100; tp[total] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP(['บัตรเข้าสวนสัตว์ ผู้ใหญ่ใบละ ' + A + ' บาท เด็กใบละ ' + Cc + ' บาท ซื้อบัตรผู้ใหญ่ ' + x + ' ใบ เด็ก ' + y + ' ใบ จ่ายด้วยเงิน ' + pay + ' บาท', distract(t), 'ได้เงินทอนกี่บาท']), ans: pay - total, unit: 'บาท', traps: tp, explain: 'หาราคารวม ' + total + ' แล้วนำไปลบจากเงินที่จ่าย' };
});
T('W19', 'word', 'w', 1, 4, function (t) {
  var m = ri(2, 6), pcs = ri(4, 6 + 2 * t), r = ri(1, m - 1), L = m * pcs + r, ask = chance(0.5);
  return { q: WP(['เชือกยาว ' + L + ' เมตร ตัดเป็นท่อน ท่อนละ ' + m + ' เมตร', distract(t), ask ? 'ตัดได้กี่ท่อน' : 'เหลือเชือกกี่เมตร']), ans: ask ? pcs : r, unit: ask ? 'ท่อน' : 'เมตร', explain: L + ' ÷ ' + m + ' ได้ ' + pcs + ' เศษ ' + r };
});
T('W20', 'word', 'w', 1, 4, function (t) {
  var n = ri(2, 5 + t), c = ri(2, 8) * 50, D = n * c + ri(50, 400), p = pick(PEOPLE), tp = {}; tp[n * c] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([p + 'ต้องวิ่งให้ครบ ' + commas(D) + ' เมตร สนามยาวรอบละ ' + c + ' เมตร วิ่งไปแล้ว ' + n + ' รอบ', distract(t), 'ต้องวิ่งอีกกี่เมตร']), ans: D - n * c, unit: 'เมตร', traps: tp, explain: 'ระยะที่วิ่งแล้ว ' + n + ' × ' + c + ' = ' + (n * c) + ' เมตร แล้วลบจากระยะทั้งหมด' };
});
T('W21', 'word', 'w', 1, 4, function (t) {
  var w = ri(20, 80), a = ri(3, 9) + t, m = ri(3, 8), q = ri(5, w + a * m - 5), tp = {}; tp[w + a * m] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP(['ถังน้ำมีน้ำอยู่ ' + w + ' ลิตร เปิดก๊อกเติมน้ำนาทีละ ' + a + ' ลิตร นาน ' + m + ' นาที แล้วตักน้ำออก ' + q + ' ลิตร', distract(t), 'ตอนนี้ในถังมีน้ำกี่ลิตร']), ans: w + a * m - q, unit: 'ลิตร', traps: tp, explain: 'น้ำที่เติม ' + a + ' × ' + m + ' = ' + (a * m) + ' ลิตร บวกกับของเดิม แล้วลบที่ตักออก' };
});
T('W22', 'word', 'w', 1, 4, function (t) {
  var n = two(), x = ri(5, 15 + 5 * t), k = ri(2, 3 + t), tp = {}; tp[k * x] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([n[0] + 'มีลูกอม ' + x + ' เม็ด ' + n[1] + 'มีลูกอมเป็น ' + k + ' เท่าของ' + n[0], distract(t), 'สองคนมีลูกอมรวมกันกี่เม็ด']), ans: x + k * x, unit: 'เม็ด', traps: tp, explain: n[1] + 'มี ' + x + ' × ' + k + ' = ' + (k * x) + ' เม็ด แล้วบวกของ' + n[0] };
});
/**
 * TemplatesObserve.gs — แม่แบบ "การสังเกต" 24 แบบ
 * กลุ่ม: seq = แบบรูปของจำนวน, vis = สังเกตรูป/ตาราง/การนับ, odd = หาตัวที่ไม่เข้าพวก, err = หาจุดผิดในวิธีทำ
 */
function seqQ(terms) { return 'หาจำนวนถัดไป\n' + terms.join(',  ') + ',  ?'; }
function colNames() { return ['หลักหน่วย', 'หลักสิบ', 'หลักร้อย', 'หลักพัน', 'หลักหมื่น']; }
function digitsRev(n) { return String(n).split('').reverse().map(Number); }
function digitSum(n) { return String(n).split('').reduce(function (s, x) { return s + +x; }, 0); }
function isSquare(n) { var r = Math.round(Math.sqrt(n)); return r * r === n; }
var SYMS = ['●', '▲', '■', '★', '◆', '♥'];

/* ---------------- แบบรูปของจำนวน ---------------- */
T('O01', 'observe', 'seq', 1, 4, function (t) {
  var d = [ri(2, 9), ri(5, 20), ri(10, 60), ri(25, 150)][t - 1], s = ri(1, 10 * t), terms = [];
  for (var i = 0; i < 5; i++) terms.push(s + i * d);
  return { q: seqQ(terms), ans: s + 5 * d, explain: 'แต่ละจำนวนเพิ่มขึ้นทีละ ' + d };
});
T('O02', 'observe', 'seq', 1, 4, function (t) {
  var r = t <= 2 ? ri(2, 3) : ri(2, 4), s = ri(1, 4), terms = [], n = t === 1 ? 4 : 5;
  for (var i = 0; i < n; i++) terms.push(s * Math.pow(r, i));
  return { q: seqQ(terms), ans: s * Math.pow(r, n), explain: 'แต่ละจำนวนคูณด้วย ' + r };
});
T('O03', 'observe', 'seq', 1, 4, function (t) {
  var d0 = ri(1, 3) + (t > 2 ? 2 : 0), inc = ri(1, 2) + (t > 3 ? 1 : 0), s = ri(1, 10 * t), terms = [s], d = d0;
  for (var i = 0; i < 4; i++) { terms.push(terms[terms.length - 1] + d); d += inc; }
  return { q: seqQ(terms), ans: terms[4] + d, explain: 'ส่วนต่างเพิ่มขึ้นทีละ ' + inc + ' (' + d0 + ', ' + (d0 + inc) + ', ...) ต่อไปบวก ' + d };
});
T('O04', 'observe', 'seq', 2, 4, function (t) {
  var a = ri(1, 9), b = ri(20, 40), d1 = ri(2, 5) + t, d2 = ri(2, 5) + t, terms = [];
  for (var i = 0; i < 7; i++) terms.push(i % 2 === 0 ? a + (i / 2) * d1 : b + ((i - 1) / 2) * d2);
  return { q: 'มีสองแบบรูปสลับกัน หาจำนวนถัดไป\n' + terms.join(',  ') + ',  ?', ans: b + 3 * d2, explain: 'ตำแหน่งคู่ (2, 4, 6, 8) เพิ่มทีละ ' + d2 + ' แยกดูทีละแบบรูป' };
});
T('O05', 'observe', 'seq', 1, 4, function (t) {
  var d = [ri(2, 9), ri(5, 15), ri(10, 40), ri(20, 80)][t - 1], s = ri(5, 9) * d + ri(0, d), terms = [];
  for (var i = 0; i < 5; i++) terms.push(s - i * d);
  return { q: seqQ(terms), ans: s - 5 * d, explain: 'แต่ละจำนวนลดลงทีละ ' + d };
});
T('O06', 'observe', 'seq', 2, 4, function (t) {
  var a = ri(1, 4), b = ri(1, 5) + a, terms = [a, b];
  for (var i = 2; i < 6; i++) terms.push(terms[i - 1] + terms[i - 2]);
  return { q: seqQ(terms), ans: terms[5] + terms[4], explain: 'แต่ละจำนวนเท่ากับสองจำนวนก่อนหน้ารวมกัน' };
});
T('O07', 'observe', 'seq', 2, 4, function (t) {
  var terms = [], i;
  if (chance(0.5)) {
    var s = ri(1, 3), c = t > 3 ? ri(1, 5) : 0;
    for (i = 0; i < 5; i++) terms.push((s + i) * (s + i) + c);
    return { q: seqQ(terms), ans: (s + 5) * (s + 5) + c, explain: 'จำนวนกำลังสอง ' + (s) + '×' + (s) + ', ' + (s + 1) + '×' + (s + 1) + ', ...' + (c ? ' แล้วบวก ' + c : '') };
  }
  var sum = 0;
  for (i = 1; i <= 5; i++) { sum += i; terms.push(sum); }
  return { q: seqQ(terms), ans: sum + 6, explain: 'ส่วนต่างเพิ่มทีละ 1 (+2, +3, +4, +5) ต่อไปบวก 6' };
});
T('O09', 'observe', 'seq', 1, 4, function (t) {
  var a = ri(2, 5), d = ri(2, 4), n = ri(8, 10 + 5 * t), sh = ri(0, 1);
  var w = [1, 2, 3].map(function (k) { return 'รูปที่ ' + k + ' มี ' + (a + d * (k - 1)) + ' จุด'; });
  return { q: w.join('\n') + '\nรูปที่ ' + n + ' มีกี่จุด', ans: a + d * (n - 1), unit: 'จุด', explain: 'รูปที่ 1 มี ' + a + ' จุด แต่ละรูปเพิ่มทีละ ' + d + ' ไปอีก ' + (n - 1) + ' รูป' };
});
T('O23', 'observe', 'seq', 1, 4, function (t) {
  var a = t === 2 ? 1 : ri(2, 4), b = t === 1 ? 0 : ri(1, 6), n = ri(8, 20), ins = shuffle([2, 3, 4, 5, 6]).slice(0, 3).sort(function (x, y) { return x - y; });
  var rows = ins.map(function (x) { return x + '  →  ' + (a * x + b); });
  return { q: 'เครื่องเปลี่ยนจำนวนทำงานตามกฎอย่างหนึ่ง\n' + rows.join('\n') + '\nถ้าใส่ ' + n + ' จะได้เท่าไร', ans: a * n + b, explain: 'กฎคือ ' + (a > 1 ? 'คูณ ' + a : '') + (a > 1 && b ? ' แล้ว' : '') + (b ? 'บวก ' + b : '') };
});

/* ---------------- สังเกตรูป / ตาราง / การนับ ---------------- */
T('O08', 'observe', 'vis', 1, 4, function (t) {
  var k = ri(2, t > 2 ? 4 : 3), pat = sample(SYMS, k), len = k * ri(2, 3) + ri(1, k - 1), shown = [];
  for (var i = 0; i < len; i++) shown.push(pat[i % k]);
  var ans = pat[len % k], ch = mkChoices(ans, SYMS.filter(function (s) { return s !== ans; }), 4);
  return { type: 'choice', q: 'รูปถัดไปคือรูปใด\n' + shown.join(' ') + ' ?', choices: ch.choices, ans: ch.ans, explain: 'ลวดลายซ้ำทุก ' + k + ' รูป: ' + pat.join(' ') };
});
T('O19', 'observe', 'vis', 1, 4, function (t) {
  var f = t <= 2 ? function (a, b) { return a + b; } : function (a, b) { return 2 * a + b; };
  var rows = [], i;
  for (i = 0; i < 3; i++) { var a = ri(2, 9 + 3 * t), b = ri(2, 9 + 3 * t); rows.push([a, b, f(a, b)]); }
  var ans = rows[2][2]; rows[2][2] = '?';
  return { q: 'ตัวเลขในแต่ละแถวมีกฎเดียวกัน ช่อง ? คือจำนวนใด', data: { kind: 'table', head: null, rows: rows }, ans: ans, explain: t <= 2 ? 'ช่องที่ 3 = ช่องที่ 1 + ช่องที่ 2' : 'ช่องที่ 3 = ช่องที่ 1 × 2 + ช่องที่ 2' };
});
T('O20', 'observe', 'vis', 1, 4, function (t) {
  var pool = sample(SYMS, 3), len = 16 + 4 * t, arr = [], i;
  for (i = 0; i < len; i++) arr.push(pick(pool));
  var target = pick(pool);
  var cnt = arr.filter(function (x) { return x === target; }).length;
  if (cnt < 2) { arr[0] = target; arr[1] = target; cnt = arr.filter(function (x) { return x === target; }).length; }
  var rows = []; for (i = 0; i < len; i += 8) rows.push(arr.slice(i, i + 8).join(' '));
  return { q: 'นับว่ามี ' + target + ' ทั้งหมดกี่ตัว\n' + rows.join('\n'), ans: cnt, explain: 'นับทีละแถว แล้วรวมกัน ระวังอย่านับซ้ำหรือข้าม' };
});
T('O21', 'observe', 'vis', 1, 4, function (t) {
  var pool = sample(SYMS, 3), len = 8 + t * 2, a = [], i;
  for (i = 0; i < len; i++) a.push(pick(pool));
  var k = ri(1, Math.min(4, 1 + t)), idx = sample(a.map(function (_, j) { return j; }), k), b = a.slice();
  idx.forEach(function (j) { b[j] = pick(pool.filter(function (s) { return s !== a[j]; })); });
  return { q: 'สองแถวนี้ต่างกันกี่ตำแหน่ง\nแถวบน:  ' + a.join(' ') + '\nแถวล่าง: ' + b.join(' '), ans: k, unit: 'ตำแหน่ง', explain: 'เทียบทีละตำแหน่งจากซ้ายไปขวา แล้วนับตำแหน่งที่ไม่เหมือนกัน' };
});
T('O24', 'observe', 'vis', 1, 4, function (t) {
  var nums = [], rep = ri(10, 99), n = 7 + t;
  while (nums.length < n) { var x = ri(10, 99); if (x !== rep && nums.indexOf(x) < 0) nums.push(x); }
  var list = shuffle(nums.concat([rep, rep, rep]));
  return { q: 'ในรายการนี้ ตัวเลขใดปรากฏบ่อยที่สุด\n' + list.join(',  '), ans: rep, explain: 'นับว่าแต่ละตัวเลขปรากฏกี่ครั้ง ตัวที่ปรากฏ 3 ครั้งคือ ' + rep };
});

/* ---------------- หาตัวที่ไม่เข้าพวก ---------------- */
function oddItem(vals, oddVal, expl, qtxt) {
  var all = shuffle(vals.concat([oddVal])).map(String);
  return { type: 'choice', q: qtxt || 'ข้อใดไม่เข้าพวก', choices: all, ans: String(all.indexOf(String(oddVal)) + 1), explain: expl };
}
T('O10', 'observe', 'odd', 1, 4, function (t) {
  var kind = t === 1 ? 'par' : t === 2 ? 'mul' : t === 3 ? 'sq' : pick(['mul', 'sq']);
  var vals, odd, e;
  if (kind === 'par') {
    var oddPar = chance(0.5) ? 1 : 0, pool = [];
    while (pool.length < 4) { var x = ri(11, 99); if (pool.indexOf(x) < 0) pool.push(x); }
    var same = [], other;
    pool.forEach(function (x) { if (same.length < 3 && x % 2 === oddPar) same.push(x); });
    while (same.length < 3) { var y = ri(11, 99); if (y % 2 === oddPar && same.indexOf(y) < 0) same.push(y); }
    do { other = ri(11, 99); } while (other % 2 === oddPar || same.indexOf(other) >= 0);
    return oddItem(same, other, 'สามจำนวนเป็นเลข' + (oddPar ? 'คี่' : 'คู่') + ' แต่ ' + other + ' เป็นเลข' + (oddPar ? 'คู่' : 'คี่'), 'จำนวนใดไม่เข้าพวก');
  }
  if (kind === 'mul') {
    var k = t === 2 ? pick([3, 4, 5, 6]) : pick([6, 7, 8, 9]), ms = sample([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3).map(function (m) { return m * k; });
    do { odd = ri(2 * k, 12 * k); } while (odd % k === 0);
    return oddItem(ms, odd, 'สามจำนวนเป็นพหุคูณของ ' + k + ' แต่ ' + odd + ' หาร ' + k + ' ไม่ลงตัว', 'จำนวนใดไม่เข้าพวก');
  }
  var sq = sample([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3).map(function (m) { return m * m; });
  do { odd = ri(5, 150); } while (isSquare(odd) || Math.abs(odd - sq[0]) < 1);
  return oddItem(sq, odd, 'สามจำนวนเป็นจำนวนกำลังสอง (เช่น 4 = 2×2) แต่ ' + odd + ' ไม่ใช่', 'จำนวนใดไม่เข้าพวก');
});
T('O11', 'observe', 'odd', 2, 4, function (t) {
  var S = ri(6, 16), len = t >= 3 ? 3 : 2, vals = [];
  while (vals.length < 3) { var x = rndN(len); if (digitSum(x) === S && vals.indexOf(x) < 0) vals.push(x); }
  var odd; do { odd = rndN(len); } while (digitSum(odd) === S);
  return oddItem(vals, odd, 'สามจำนวนมีผลบวกของเลขโดดเท่ากับ ' + S + ' แต่ ' + odd + ' มีผลบวก ' + digitSum(odd), 'จำนวนใดไม่เข้าพวก (ลองบวกเลขโดดในแต่ละจำนวน)');
});
var WORD_GROUPS = [
  ['ผลไม้', ['แอปเปิ้ล', 'กล้วย', 'ส้ม', 'องุ่น', 'มะม่วง']], ['สัตว์เลี้ยง', ['แมว', 'สุนัข', 'กระต่าย', 'หนูแฮมสเตอร์', 'นกแก้ว']],
  ['ยานพาหนะ', ['รถยนต์', 'เรือ', 'เครื่องบิน', 'จักรยาน', 'รถไฟ']], ['เครื่องเขียน', ['ดินสอ', 'ปากกา', 'ไม้บรรทัด', 'ยางลบ', 'กรรไกร']],
  ['ผัก', ['แครอท', 'ผักกาด', 'มะเขือ', 'ฟักทอง', 'กะหล่ำปลี']], ['เครื่องแต่งกาย', ['เสื้อ', 'กางเกง', 'หมวก', 'ถุงเท้า', 'กระโปรง']]
];
T('O12', 'observe', 'odd', 1, 4, function (t) {
  var g = sample(WORD_GROUPS, 2);
  var three = sample(g[0][1], 3), odd = pick(g[1][1]);
  return oddItem(three, odd, 'สามคำเป็น' + g[0][0] + ' แต่ ' + odd + ' เป็น' + g[1][0], 'คำใดไม่เข้าพวก');
});
T('O22', 'observe', 'odd', 2, 4, function (t) {
  var S = ri(7, 18), len = t >= 3 ? 3 : 2, ans, others = [];
  ans = retry(function () { return rndN(len); }, function (x) { return digitSum(x) === S; });
  while (others.length < 3) { var x = rndN(len); if (digitSum(x) !== S && others.indexOf(x) < 0) others.push(x); }
  var all = shuffle(others.concat([ans])).map(String);
  return { type: 'choice', q: 'จำนวนใดมีผลบวกของเลขโดดเท่ากับ ' + S, choices: all, ans: String(all.indexOf(String(ans)) + 1), explain: 'ลองบวกเลขโดดของแต่ละจำนวน จำนวนที่ได้ ' + S + ' คือ ' + ans };
});
T('O18', 'observe', 'odd', 1, 4, function (t) {
  var d = [ri(2, 9), ri(5, 20), ri(10, 50), ri(20, 90)][t - 1], s = ri(1, 20), terms = [], i;
  for (i = 0; i < 6; i++) terms.push(s + i * d);
  var k = ri(0, 5), wrong;
  do { wrong = terms[k] + pick([-1, 1, -2, 2, -d, d, 10, -10]); } while (wrong < 0 || terms.indexOf(wrong) >= 0 || wrong === terms[k]);
  var shown = terms.slice(); shown[k] = wrong;
  return { type: 'choice', q: 'ลำดับนี้มีตัวเลขหนึ่งตัวที่ผิดแบบรูป ตัวใดผิด\n(แต่ละจำนวนเพิ่มขึ้นอย่างสม่ำเสมอ)', choices: shown.map(String), ans: String(k + 1), explain: 'แบบรูปที่ถูกคือเพิ่มทีละ ' + d + ' จำนวนที่ถูกต้องตำแหน่งนี้ควรเป็น ' + terms[k] };
});

/* ---------------- หาจุดผิดในวิธีทำ (ตอบด้วยการแตะบรรทัดแรกที่ผิด) ---------------- */
function errItem(q, lines, k, why) {
  return { type: 'choice', q: q, choices: lines, ans: String(k + 1), lineMode: true, defErr: 'หาจุดผิดไม่เจอ', explain: why };
}
T('O13', 'observe', 'err', 1, 4, function (t) {
  var la = t <= 1 ? 2 : (t <= 3 ? 3 : 4), nm = colNames(), i;
  var ab = retry(function () { return [rndN(la), rndN(la)]; }, function (p) {
    var da = digitsRev(p[0]), db = digitsRev(p[1]), c = 0, ok = false;
    for (var j = 0; j < la; j++) { if (j >= 1 && c > 0) ok = true; c = (da[j] + db[j] + c) >= 10 ? 1 : 0; }
    return ok;
  });
  var a = ab[0], b = ab[1], da = digitsRev(a), db = digitsRev(b), c = 0, carryIn = [], ks = [];
  for (i = 0; i < la; i++) { carryIn[i] = c; if (i >= 1 && c > 0) ks.push(i); c = (da[i] + db[i] + c) >= 10 ? 1 : 0; }
  var k = pick(ks), lines = [], cc = 0, num = 0;
  for (i = 0; i < la; i++) {
    var withC = cc > 0 && i !== k, s = da[i] + db[i] + (withC ? cc : 0);
    lines.push(nm[i] + ': ' + da[i] + ' + ' + db[i] + (withC ? ' + ' + cc + ' (ที่ทดมา)' : '') + ' = ' + s + (i < la - 1 && s >= 10 ? ' เขียน ' + (s % 10) + ' ทด 1' : ' เขียน ' + s));
    num += (i < la - 1 ? s % 10 : s) * Math.pow(10, i);
    cc = i < la - 1 && s >= 10 ? 1 : 0;
  }
  lines.push('ตอบ ' + num);
  return errItem(pick(PEOPLE) + 'คิดบวก ' + a + ' + ' + b + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, 'ที่' + nm[k - 1] + 'ทดไว้ 1 แต่' + nm[k] + 'ไม่ได้นำเลขที่ทดมาบวก');
});
T('O14', 'observe', 'err', 1, 4, function (t) {
  var la = t <= 1 ? 2 : (t <= 3 ? 3 : 4), nm = colNames(), i;
  var p = retry(function () { return [rndN(la), rndN(la)]; }, function (p) {
    return p[0] > p[1] && borrows(p[0], p[1]) >= 1 && digitsRev(p[0]).every(function (d) { return d >= 1; }) && borrows(p[0], p[1]) < la;
  });
  var a = p[0], b = p[1], da = digitsRev(a), db = digitsRev(b), br = 0, needs = [];
  for (i = 0; i < la; i++) { var x0 = da[i] - br; if (x0 < db[i]) { needs.push(i); br = 1; } else br = 0; }
  var k = pick(needs.filter(function (j) { return j < la - 1; }).concat(needs.length ? [] : [0]));
  if (k === undefined) k = needs[0];
  var lines = [], num = 0; br = 0;
  for (i = 0; i < la; i++) {
    var x = da[i] - br, y = db[i], d, line = nm[i] + ': ' + (br ? da[i] + ' ถูกยืมไป 1 เหลือ ' + x + '; ' : '');
    if (i === k) { d = y - x; line += y + ' − ' + x + ' = ' + d; br = 0; }
    else if (x >= y) { d = x - y; line += x + ' − ' + y + ' = ' + d; br = 0; }
    else { d = x + 10 - y; line += x + ' ไม่พอลบ ยืม 10 ได้ ' + (x + 10) + ' − ' + y + ' = ' + d; br = 1; }
    lines.push(line); num += d * Math.pow(10, i);
  }
  lines.push('ตอบ ' + num);
  return errItem(pick(PEOPLE) + 'คิดลบ ' + a + ' − ' + b + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, nm[k] + ': เลขบนน้อยกว่าเลขล่าง ต้องยืมจากหลักถัดไป จะเอาเลขมากลบเลขน้อยสลับกันไม่ได้');
});
T('O15', 'observe', 'err', 1, 4, function (t) {
  var la = t <= 2 ? 3 : 4, nm = colNames(), i;
  var p = retry(function () { return [rndN(la), ri(3, 9)]; }, function (p) {
    var da = digitsRev(p[0]), c = 0, ok = false;
    for (var j = 0; j < la; j++) { if (j >= 1 && c > 0) ok = true; c = Math.floor((da[j] * p[1] + c) / 10); }
    return ok;
  });
  var a = p[0], b = p[1], da = digitsRev(a), c = 0, ks = [];
  for (i = 0; i < la; i++) { if (i >= 1 && c > 0) ks.push(i); c = Math.floor((da[i] * b + c) / 10); }
  var k = pick(ks), lines = [], cc = 0, num = 0;
  for (i = 0; i < la; i++) {
    var withC = cc > 0 && i !== k, pr = da[i] * b, v = pr + (withC ? cc : 0);
    var line = nm[i] + ': ' + da[i] + ' × ' + b + ' = ' + pr + (withC ? ' + ' + cc + ' = ' + v : '');
    line += (i < la - 1 && v >= 10) ? ' เขียน ' + (v % 10) + ' ทด ' + Math.floor(v / 10) : ' เขียน ' + v;
    lines.push(line);
    num += (i < la - 1 ? v % 10 : v) * Math.pow(10, i);
    cc = i < la - 1 ? Math.floor(v / 10) : 0;
  }
  lines.push('ตอบ ' + num);
  return errItem(pick(PEOPLE) + 'คิดคูณ ' + a + ' × ' + b + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, nm[k] + ': ลืมนำเลขที่ทดมาบวกกับผลคูณ');
});
T('O16', 'observe', 'err', 2, 4, function (t) {
  var a = ri(12, 49), b = retry(function () { return ri(12, 49); }, function (x) { return x % 10 !== 0; }), u = b % 10, tn = Math.floor(b / 10);
  var p1 = a * u, p2 = a * tn * 10, m = ri(1, 3), l1 = p1, l2 = p2, l2txt = a + ' × ' + tn + '0 = ', k, why;
  if (m === 1) { l1 = p1 + pick([10, -10, 1, -1]); k = 0; why = a + ' × ' + u + ' = ' + p1 + ' ไม่ใช่ ' + l1; }
  else if (m === 2) { l2 = a * tn; k = 1; why = 'การคูณด้วยหลักสิบ ต้องเลื่อนหลัก (เติมศูนย์) ' + a + ' × ' + tn + '0 = ' + p2; }
  else { l2 = p2 + pick([10, -10, 100]); k = 1; why = a + ' × ' + tn + '0 = ' + p2 + ' ไม่ใช่ ' + l2; }
  var lines = [a + ' × ' + u + ' = ' + l1, l2txt + l2, l1 + ' + ' + l2 + ' = ' + (l1 + l2), 'ตอบ ' + (l1 + l2)];
  return errItem(pick(PEOPLE) + 'คิดคูณ ' + a + ' × ' + b + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, why);
});
T('O17', 'observe', 'err', 2, 4, function (t) {
  var pr = pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 6]]), d1 = pr[0], d2 = pr[1], L = lcm(d1, d2);
  var a = ri(1, d1 - 1), c = ri(1, d2 - 1), n1 = a * L / d1, n2 = c * L / d2, m = ri(2, 4), x1 = n1, x2 = n2, lastDen = L, k, why;
  if (m === 2) { x1 = a; k = 1; why = F(a, d1) + ' = ' + F(n1, L) + ' ต้องคูณทั้งตัวเศษและตัวส่วน'; }
  else if (m === 3) { x2 = c; k = 2; why = F(c, d2) + ' = ' + F(n2, L) + ' ต้องคูณทั้งตัวเศษและตัวส่วน'; }
  else { lastDen = L + L; k = 3; why = 'เมื่อตัวส่วนเท่ากันแล้ว บวกเฉพาะตัวเศษ ตัวส่วนยังคงเป็น ' + L; }
  var lines = ['ตัวส่วนร่วมของ ' + d1 + ' และ ' + d2 + ' คือ ' + L,
    F(a, d1) + ' = ' + F(x1, m === 2 ? L : L), F(c, d2) + ' = ' + F(x2, L),
    F(x1, L) + ' + ' + F(x2, L) + ' = ' + F(x1 + x2, lastDen)];
  if (m === 2) lines[1] = F(a, d1) + ' = ' + F(a, L);
  if (m === 3) lines[2] = F(c, d2) + ' = ' + F(c, L);
  return errItem(pick(PEOPLE) + 'คิดบวก ' + F(a, d1) + ' + ' + F(c, d2) + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, why);
});
/**
 * TemplatesAnalytic.gs — แม่แบบ "คิดวิเคราะห์" 22 แบบ
 * กลุ่ม: data = อ่านตาราง/แผนภูมิ, logic = ตรรกะ/ปริศนา, count = นับ/จัดกลุ่ม
 */
var ITEM_NAMES = ['แอปเปิ้ล', 'ส้ม', 'กล้วย', 'มะม่วง', 'องุ่น', 'ลำไย'];
var WEEKDAYS5 = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

/* ---------------- อ่านตาราง / แผนภูมิ ---------------- */
T('A01', 'analytic', 'data', 1, 4, function (t) {
  var th = pick(['ขนมปัง', 'น้ำส้ม', 'ไอศกรีม', 'หนังสือ']), vals = WEEKDAYS5.map(function () { return ri(10, 30) * t + ri(0, 9); });
  var rows = WEEKDAYS5.map(function (d, i) { return [d, vals[i]]; });
  var base = { data: { kind: 'table', head: ['วัน', 'ขายได้ (ชิ้น)'], rows: rows, title: 'ร้านขาย' + th + ' ขายได้แต่ละวัน' } };
  var r = ri(0, 3), mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals), i1 = ri(0, 4), i2 = (i1 + ri(1, 4)) % 5;
  var tot = vals.reduce(function (s, x) { return s + x; }, 0);
  if (r === 0) base.q = 'ตลอดทั้ง 5 วัน ขาย' + th + 'ได้รวมกี่ชิ้น', base.ans = tot;
  else if (r === 1) base.q = 'วันที่ขายได้มากที่สุดกับน้อยที่สุด ต่างกันกี่ชิ้น', base.ans = mx - mn;
  else if (r === 2) base.q = 'วัน' + WEEKDAYS5[i1] + 'และวัน' + WEEKDAYS5[i2] + ' ขายได้รวมกันกี่ชิ้น', base.ans = vals[i1] + vals[i2];
  else base.q = 'วัน' + WEEKDAYS5[i1] + 'ขายได้มากกว่าวัน' + WEEKDAYS5[i2] + 'กี่ชิ้น (ถ้าน้อยกว่าให้ตอบผลต่าง)', base.ans = Math.abs(vals[i1] - vals[i2]);
  base.unit = 'ชิ้น'; base.explain = 'อ่านค่าจากตารางให้ตรงแถว แล้วค่อยคำนวณ';
  return base;
});
T('A02', 'analytic', 'data', 1, 4, function (t) {
  var names = sample(ITEM_NAMES, ri(4, 5)), st = [5, 10, 10, 20][t - 1], vals = names.map(function () { return ri(2, 9) * st; });
  var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
  if (mx === mn) vals[0] += st;
  mx = Math.max.apply(null, vals); mn = Math.min.apply(null, vals);
  return { q: 'ผลไม้ที่มีมากที่สุดกับน้อยที่สุด ต่างกันกี่ผล', data: { kind: 'bar', title: 'จำนวนผลไม้ในตะกร้า', labels: names, values: vals, unit: 'ผล' }, ans: mx - mn, unit: 'ผล', explain: 'อ่านค่าที่ปลายแท่งของแผนภูมิ แล้วลบกัน' };
});
T('A03', 'analytic', 'data', 1, 4, function (t) {
  var n = two(), names = ['ป.1', 'ป.2', 'ป.3', 'ป.4'], st = [5, 10, 10, 20][t - 1], vals = names.map(function () { return ri(3, 9) * st; });
  var r = ri(0, 2), i = ri(0, 3), j = (i + ri(1, 3)) % 4, tot = vals.reduce(function (s, x) { return s + x; }, 0), q, ans;
  if (r === 0) { q = 'นักเรียน ' + names[i] + ' กับ ' + names[j] + ' รวมกันกี่คน'; ans = vals[i] + vals[j]; }
  else if (r === 1) { q = 'นักเรียนทั้ง 4 ชั้นรวมกันกี่คน'; ans = tot; }
  else { q = names[i] + ' ต้องมีนักเรียนเพิ่มอีกกี่คน จึงจะเท่ากับ ' + names[j] + ' (ถ้า ' + names[i] + ' มากกว่าให้ตอบผลต่าง)'; ans = Math.abs(vals[i] - vals[j]); }
  return { q: q, data: { kind: 'bar', title: 'จำนวนนักเรียนที่มาเข้าแถว', labels: names, values: vals, unit: 'คน' }, ans: ans, unit: 'คน', explain: 'อ่านค่าของแต่ละแท่งก่อน แล้วค่อยคำนวณ' };
});
T('A04', 'analytic', 'data', 1, 4, function (t) {
  var menu = sample([['ข้าวผัด', 35], ['น้ำเปล่า', 10], ['ไข่ดาว', 12], ['ส้มตำ', 30], ['ขนมครก', 20], ['น้ำส้ม', 15]], 4), rows = menu.map(function (m) { return [m[0], m[1] + t * 5 * 0]; });
  var a = ri(0, 3), b = (a + ri(1, 3)) % 4, ka = ri(1, 2 + (t > 2 ? 1 : 0)), kb = ri(1, 3), total = menu[a][1] * ka + menu[b][1] * kb, pay = (Math.floor(total / 50) + 1) * 50, tp = {};
  tp[total] = 'อ่านโจทย์ไม่ครบ';
  return { q: 'ซื้อ' + menu[a][0] + ' ' + ka + ' ที่ และ' + menu[b][0] + ' ' + kb + ' ที่ จ่ายเงิน ' + pay + ' บาท ได้เงินทอนกี่บาท', data: { kind: 'table', head: ['รายการ', 'ราคา (บาท)'], rows: rows, title: 'รายการอาหาร' }, ans: pay - total, unit: 'บาท', traps: tp, explain: 'หาราคารวมจากตารางราคาก่อน แล้วลบจากเงินที่จ่าย' };
});
T('A16', 'analytic', 'data', 1, 4, function (t) {
  var k = pick([15, 20, 25, 30]), h = ri(6, 15), times = [0, 1, 2, 3, 4].map(function (i) { return h * 60 + i * k; });
  function hm(m) { return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
  var arr = ri(times[1] + 1, times[2] - 1), nxt = times[2];
  return { q: 'ป้ายรถเมล์มีรถออกเวลา ' + times.map(hm).join(', ') + ' น.\nต้นมาถึงป้ายเวลา ' + hm(arr) + ' น. ต้องรอรถคันถัดไปกี่นาที', ans: nxt - arr, unit: 'นาที', explain: 'หารถคันแรกที่ออกหลังเวลา ' + hm(arr) + ' คือ ' + hm(nxt) + ' แล้วหาผลต่างเป็นนาที' };
});
T('A18', 'analytic', 'data', 2, 4, function (t) {
  var c = ri(3, 8), a = ri(c + 3, 20), b = ri(c + 3, 20), un = a + b - c, N = un + ri(2, 8), ask = t >= 3;
  return { q: 'ในห้องเรียนมีนักเรียน ' + N + ' คน ชอบว่ายน้ำ ' + a + ' คน ชอบวาดรูป ' + b + ' คน ชอบทั้งสองอย่าง ' + c + ' คน' + (ask ? '\nมีนักเรียนที่ไม่ชอบทั้งสองอย่างกี่คน' : '\nมีนักเรียนที่ชอบอย่างน้อยหนึ่งอย่างกี่คน'), ans: ask ? N - un : un, unit: 'คน', traps: (function () { var o = {}; o[a + b] = 'นับคนที่ชอบทั้งสองซ้ำ'; return o; })(), explain: 'คนที่ชอบทั้งสองอย่างถูกนับซ้ำ 2 ครั้ง ต้องลบออก 1 ครั้ง: ' + a + ' + ' + b + ' − ' + c + ' = ' + un };
});

/* ---------------- ตรรกะ / ปริศนา ---------------- */
T('A05', 'analytic', 'logic', 1, 4, function (t) {
  var n = t <= 2 ? 3 : 4, names = sample(PEOPLE, n), order = names.slice(), ask = pick(['สูงที่สุด', 'เตี้ยที่สุด']), clues = [];
  for (var i = 0; i < n - 1; i++) clues.push(chance(0.5) ? order[i] + 'สูงกว่า' + order[i + 1] : order[i + 1] + 'เตี้ยกว่า' + order[i]);
  var ans = ask === 'สูงที่สุด' ? order[0] : order[n - 1], ch = mkChoices(ans, names, n);
  return { type: 'choice', q: shuffle(clues).join('\n') + '\nใคร' + ask, choices: ch.choices, ans: ch.ans, explain: 'เรียงลำดับจากข้อมูล: ' + order.join(' > ') + ' (สูง → เตี้ย)' };
});
T('A06', 'analytic', 'logic', 1, 4, function (t) {
  var ppl = sample(PEOPLE, 3), pets = sample(['แมว', 'สุนัข', 'ปลา', 'กระต่าย', 'นกแก้ว'], 3), x = pets[0], y = pets[1], z = pets[2];
  var clues = [ppl[1] + 'เลี้ยง' + y, ppl[0] + 'ไม่ได้เลี้ยง' + z], askC = chance(0.5), who = askC ? ppl[2] : ppl[0], ans = askC ? z : x;
  var ch = mkChoices(ans, pets, 3);
  return { type: 'choice', q: ppl.join(' ') + ' เลี้ยงสัตว์คนละชนิด คือ ' + pets.join(' ') + ' (คนละ 1 ตัว)\n' + shuffle(clues).join('\n') + '\n' + who + 'เลี้ยงอะไร', choices: ch.choices, ans: ch.ans, explain: ppl[1] + 'เลี้ยง' + y + ' และ' + ppl[0] + 'ไม่ได้เลี้ยง' + z + ' จึงเหลือให้' + ppl[0] + 'เลี้ยง' + x + ' และ' + ppl[2] + 'เลี้ยง' + z };
});
T('A07', 'analytic', 'logic', 1, 4, function (t) {
  var x = ri(2, 12 + 5 * t), a = ri(2, 5), b = ri(2, 9), c = ri(1, x - 1), v = ri(1, 3), q, r;
  if (t <= 2 && v !== 3) { if (v === 1) { r = x * a + b; q = 'คูณด้วย ' + a + ' แล้วบวก ' + b; } else { r = (x + b) * a; q = 'บวก ' + b + ' แล้วคูณด้วย ' + a; } }
  else { r = (x - c) * a + b; q = 'ลบ ' + c + ' แล้วคูณด้วย ' + a + ' แล้วบวก ' + b; }
  return { q: 'ฉันคิดจำนวนหนึ่งไว้ ' + q + ' ได้ ' + r + ' จำนวนที่ฉันคิดไว้คือเท่าไร', ans: x, explain: 'ทำย้อนกลับจากคำตอบทีละขั้น: ' + r + ' แล้วทำตรงข้าม (บวก↔ลบ, คูณ↔หาร) ย้อนไปจนถึงจำนวนตั้งต้น' };
});
T('A08', 'analytic', 'logic', 1, 4, function (t) {
  var f = sample(ITEM_NAMES, 3), k1 = ri(2, 3 + (t > 2 ? 1 : 0)), k2 = ri(2, 3 + (t > 2 ? 2 : 0)), m = ri(2, 3 + t);
  return { q: f[0] + ' 1 ผล หนักเท่ากับ' + f[1] + ' ' + k1 + ' ผล\n' + f[1] + ' 1 ผล หนักเท่ากับ' + f[2] + ' ' + k2 + ' ผล\n' + f[0] + ' ' + m + ' ผล หนักเท่ากับ' + f[2] + 'กี่ผล', ans: m * k1 * k2, unit: 'ผล', explain: f[0] + ' 1 ผล = ' + f[1] + ' ' + k1 + ' ผล = ' + f[2] + ' ' + (k1 * k2) + ' ผล แล้วคูณ ' + m };
});
T('A12', 'analytic', 'logic', 1, 4, function (t) {
  var x = ri(5, 20 * t + 5), d = ri(3, 20), S = 2 * x + d;
  return { q: 'จำนวนสองจำนวนรวมกันได้ ' + S + ' และต่างกัน ' + d + ' จำนวนที่น้อยกว่าคือเท่าไร', ans: x, explain: 'ตัดส่วนต่างออก ' + S + ' − ' + d + ' = ' + (S - d) + ' แล้วแบ่งสองส่วนเท่ากัน' };
});
T('A13', 'analytic', 'logic', 2, 4, function (t) {
  var g = ri(2, 4 + t), c = ri(2, 5 + t), h = g + c, legs = 2 * c + 4 * g;
  return { q: 'ในคอกมีไก่และแพะรวม ' + h + ' ตัว นับขาได้ทั้งหมด ' + legs + ' ขา (ไก่ 2 ขา แพะ 4 ขา)\nมีแพะกี่ตัว', ans: g, unit: 'ตัว', explain: 'ถ้าทุกตัวเป็นไก่จะมี ' + (2 * h) + ' ขา ขาที่เกินมา ' + (legs - 2 * h) + ' ขา มาจากแพะ ตัวละ 2 ขาที่เกิน → ' + g + ' ตัว' };
});
T('A17', 'analytic', 'logic', 2, 4, function (t) {
  var tn = ri(2, 9), u = ri(0, tn - 1), S = tn + u, D = tn - u;
  return { q: 'จำนวนสองหลักจำนวนหนึ่ง ผลบวกของเลขโดดสองหลักเป็น ' + S + ' ผลต่างของเลขโดดเป็น ' + D + ' และหลักสิบมีค่ามากกว่าหลักหน่วย จำนวนนี้คือเท่าไร', ans: tn * 10 + u, explain: 'หลักสิบ = (' + S + ' + ' + D + ') ÷ 2 = ' + tn + ' หลักหน่วย = (' + S + ' − ' + D + ') ÷ 2 = ' + u };
});
T('A19', 'analytic', 'logic', 1, 4, function (t) {
  var x = ri(3, 8 + 3 * t), y = ri(3, 8 + 3 * t), p = pick(PEOPLE), tp = {}; tp[x + y] = 'นับ' + p + 'ซ้ำสองครั้ง';
  return { q: p + 'ยืนอยู่ในแถว นับจากหัวแถวเป็นคนที่ ' + x + ' นับจากท้ายแถวเป็นคนที่ ' + y + ' แถวนี้มีกี่คน', ans: x + y - 1, unit: 'คน', traps: tp, explain: x + ' + ' + y + ' นับ' + p + 'ไปสองครั้ง ต้องลบออก 1' };
});
T('A20', 'analytic', 'logic', 1, 4, function (t) {
  var prs = [[2, 3], [3, 4], [4, 6], [6, 8], [5, 6], [4, 10], [6, 9], [8, 12], [3, 5]], pr = pick(prs.slice(0, 3 + 2 * t)), L = lcm(pr[0], pr[1]);
  return { q: 'ไฟสองดวงเริ่มกะพริบพร้อมกัน ดวงแรกกะพริบทุก ' + pr[0] + ' วินาที ดวงที่สองกะพริบทุก ' + pr[1] + ' วินาที\nอีกกี่วินาทีจึงจะกะพริบพร้อมกันอีกครั้ง', ans: L, unit: 'วินาที', explain: 'หาจำนวนที่เล็กที่สุดที่ทั้ง ' + pr[0] + ' และ ' + pr[1] + ' หารลงตัว (ค.ร.น.) = ' + L };
});
T('A21', 'analytic', 'logic', 1, 4, function (t) {
  var k1 = ri(2, 6), k2 = ri(2, 6), p1 = ri(4, 9) + t, p2 = retry(function () { return ri(4, 10) + t; }, function (x) { return x !== p1; });
  var ch = ['ร้าน ก ถูกกว่า', 'ร้าน ข ถูกกว่า', 'ราคาต่อชิ้นเท่ากัน'], ans = p1 < p2 ? '1' : '2';
  return { type: 'choice', q: 'ร้าน ก ขายขนม ' + k1 + ' ชิ้น ราคา ' + (k1 * p1) + ' บาท\nร้าน ข ขายขนมชนิดเดียวกัน ' + k2 + ' ชิ้น ราคา ' + (k2 * p2) + ' บาท\nร้านไหนขายถูกกว่า (เทียบราคาต่อชิ้น)', choices: ch, ans: ans, explain: 'ร้าน ก ชิ้นละ ' + p1 + ' บาท ร้าน ข ชิ้นละ ' + p2 + ' บาท' };
});

/* ---------------- นับ / จัดกลุ่ม ---------------- */
T('A09', 'analytic', 'count', 1, 4, function (t) {
  var n = ri(4, 5 + t + 1);
  return { q: 'นักเรียน ' + n + ' คนจับมือทักทายกันให้ครบทุกคู่ (คู่ละ 1 ครั้ง) จะมีการจับมือทั้งหมดกี่ครั้ง', ans: n * (n - 1) / 2, unit: 'ครั้ง', explain: 'แต่ละคนจับมือกับอีก ' + (n - 1) + ' คน = ' + n + ' × ' + (n - 1) + ' แต่นับซ้ำสองเท่า จึงหารสอง' };
});
T('A10', 'analytic', 'count', 1, 4, function (t) {
  var d = ri(2, 6), m = ri(4, 6 + 2 * t), L = d * m, v = t <= 2 ? 0 : ri(1, 2), q, ans, ex;
  if (v === 0) { q = 'ปลูกต้นไม้ตลอดแนวถนนยาว ' + L + ' เมตร ต้นละห่างกัน ' + d + ' เมตร ปลูกต้นแรกที่จุดเริ่มต้นและต้นสุดท้ายที่ปลายถนน ใช้ต้นไม้กี่ต้น'; ans = m + 1; ex = 'ช่วงห่าง ' + m + ' ช่วง ต้นไม้ต้องมีมากกว่าจำนวนช่วง 1 ต้น'; }
  else if (v === 1) { q = 'ปลูกต้นไม้ตลอดแนวถนนยาว ' + L + ' เมตร ต้นละห่างกัน ' + d + ' เมตร ปลูกที่จุดเริ่มต้น แต่ไม่ปลูกที่ปลายถนน ใช้ต้นไม้กี่ต้น'; ans = m; ex = 'ปลูกด้านเดียว จำนวนต้นเท่ากับจำนวนช่วง ' + m; }
  else { q = 'ปลูกต้นไม้รอบสระน้ำรูปวงกลม เส้นรอบวงยาว ' + L + ' เมตร ต้นละห่างกัน ' + d + ' เมตร ใช้ต้นไม้กี่ต้น'; ans = m; ex = 'รอบวงกลมไม่มีจุดเริ่มต้นและปลายสุด จำนวนต้นเท่ากับจำนวนช่วง'; }
  var tp = {}; tp[m] = 'นับจุดปลายไม่ถูก'; if (v) tp[m + 1] = 'นับจุดปลายไม่ถูก';
  return { q: q, ans: ans, unit: 'ต้น', traps: tp, explain: ex };
});
T('A11', 'analytic', 'count', 1, 4, function (t) {
  var s = ri(2, 4 + t), p = ri(2, 4), sh = t >= 3 ? ri(2, 3) : 1;
  return { q: 'ต้นมีเสื้อ ' + s + ' ตัว กางเกง ' + p + ' ตัว' + (sh > 1 ? ' รองเท้า ' + sh + ' คู่' : '') + ' ถ้าแต่งตัวโดยเลือกอย่างละ 1 ชิ้น จะแต่งตัวได้ต่างกันกี่แบบ', ans: s * p * sh, unit: 'แบบ', explain: 'เสื้อแต่ละตัวจับคู่ได้กับกางเกงทุกตัว: ' + s + ' × ' + p + (sh > 1 ? ' × ' + sh : '') };
});
T('A14', 'analytic', 'count', 1, 4, function (t) {
  var n = [2, 3, 3, 4][t - 1], ans = 0, parts = [];
  for (var k = 1; k <= n; k++) { ans += k * k; parts.push(k * k); }
  return { q: 'ตารางสี่เหลี่ยมจัตุรัสขนาด ' + n + ' × ' + n + ' ช่อง มีรูปสี่เหลี่ยมจัตุรัสทั้งหมดกี่รูป (นับทุกขนาด รวมทั้งรูปใหญ่ที่ประกอบจากหลายช่อง)', ans: ans, unit: 'รูป', explain: 'นับตามขนาด: ' + parts.join(' + ') + ' = ' + ans };
});
T('A15', 'analytic', 'count', 1, 4, function (t) {
  var dn = t === 1 ? [10, 5, 1] : [50, 20, 10, 5, 1], amt = ri(31, t === 1 ? 79 : 199), left = amt, cnt = 0;
  dn.forEach(function (d) { cnt += Math.floor(left / d); left %= d; });
  return { q: 'ต้องจ่ายเงิน ' + amt + ' บาท โดยมีธนบัตรและเหรียญ ' + dn.join(', ') + ' บาท (มีอย่างละหลายใบ) ถ้าต้องการใช้จำนวนชิ้นน้อยที่สุด ต้องใช้กี่ชิ้น', ans: cnt, unit: 'ชิ้น', explain: 'เริ่มจากชนิดที่มีค่ามากที่สุดก่อน แล้วค่อยลงมาชนิดที่น้อยลง' };
});
T('A22', 'analytic', 'count', 1, 4, function (t) {
  var i = ri(0, 6), n = [ri(8, 20), ri(10, 40), ri(20, 60), ri(30, 100)][t - 1], ans = TH_DAYS[(i + n) % 7];
  var wrongs = [1, 2, 3, 4, 5, 6].map(function (k) { return TH_DAYS[(i + n + k) % 7]; }), ch = mkChoices(ans, wrongs, 4);
  return { type: 'choice', q: 'วันนี้เป็นวัน' + TH_DAYS[i] + ' อีก ' + n + ' วันข้างหน้าจะเป็นวันอะไร', choices: ch.choices, ans: ch.ans, explain: '1 สัปดาห์มี 7 วัน ' + n + ' ÷ 7 ได้ ' + Math.floor(n / 7) + ' เศษ ' + (n % 7) + ' นับต่อจากวัน' + TH_DAYS[i] + ' ไปอีก ' + (n % 7) + ' วัน' };
});

// ======================= BankSeed.gs =======================
/**
 * BankSeed.gs — ข้อสอบแบบกำหนดเอง 100 ข้อ สำหรับใส่ในแท็บ "คลังข้อสอบ" ตอนติดตั้ง
 * คอลัมน์: หมวด | ระดับ(1-4) | โจทย์ | คำตอบ | คำอธิบาย | ตัวเลือก (ไม่บังคับ คั่นด้วย |)
 *  - ถ้ามี "ตัวเลือก" คำตอบต้องเป็นข้อความที่ตรงกับตัวเลือกหนึ่งข้อ (เด็กจะแตะเลือก)
 *  - ถ้าไม่มีตัวเลือก คำตอบต้องเป็นตัวเลข: 12 / 3.5 / 2/5 / 2 1/3 (เด็กจะกดแป้นตัวเลข)
 *  - ในโจทย์เขียนเศษส่วนแบบ {3/4} หรือ {2 1/3} จะแสดงเป็นเศษส่วนซ้อนบนหน้าจอ
 * หมวดที่ใช้: สังเกต / ตรรกะ / โจทย์ปัญหา / อ่านข้อมูล
 */
var BANK_CATS = ['สังเกต', 'ตรรกะ', 'โจทย์ปัญหา', 'อ่านข้อมูล'];
var BANK_HEADERS = ['หมวด', 'ระดับ', 'โจทย์', 'คำตอบ', 'คำอธิบาย', 'ตัวเลือก', 'รหัส', 'ใช้ล่าสุด'];

var BANK_SEED_ROWS = [
  // ---------- สังเกต (25) ----------
  ['สังเกต', 1, 'หาจำนวนถัดไป\n1,  4,  7,  10,  13,  ?', '16', 'เพิ่มทีละ 3'],
  ['สังเกต', 1, 'หาจำนวนถัดไป\n2,  4,  8,  16,  32,  ?', '64', 'คูณ 2 ทุกครั้ง'],
  ['สังเกต', 1, 'หาจำนวนถัดไป\n100,  90,  80,  70,  ?', '60', 'ลดทีละ 10'],
  ['สังเกต', 1, 'หาจำนวนถัดไป\n3,  6,  12,  24,  ?', '48', 'คูณ 2 ทุกครั้ง'],
  ['สังเกต', 1, 'หาจำนวนที่หายไป\n5,  10,  15,  ?,  25', '20', 'เพิ่มทีละ 5'],
  ['สังเกต', 2, 'หาจำนวนถัดไป\n1,  1,  2,  3,  5,  8,  ?', '13', 'แต่ละจำนวนเท่ากับสองจำนวนก่อนหน้ารวมกัน 5 + 8 = 13'],
  ['สังเกต', 2, 'หาจำนวนถัดไป\n1,  3,  6,  10,  15,  ?', '21', 'ส่วนต่างเพิ่มทีละ 1 (+2, +3, +4, +5) ต่อไปบวก 6'],
  ['สังเกต', 2, 'หาจำนวนถัดไป\n2,  3,  5,  8,  12,  ?', '17', 'ส่วนต่าง 1, 2, 3, 4 ต่อไปบวก 5'],
  ['สังเกต', 2, 'หาจำนวนถัดไป\n1,  2,  4,  7,  11,  ?', '16', 'ส่วนต่าง 1, 2, 3, 4 ต่อไปบวก 5'],
  ['สังเกต', 2, 'หาจำนวนถัดไป\n81,  27,  9,  3,  ?', '1', 'หารด้วย 3 ทุกครั้ง'],
  ['สังเกต', 2, 'หาจำนวนถัดไป\n1,  4,  9,  16,  25,  ?', '36', 'จำนวนกำลังสอง 6 × 6'],
  ['สังเกต', 2, 'ตัวเลขใดผิดแบบรูป\n12,  18,  24,  31,  36', '31', 'แบบรูปคือพหุคูณของ 6 ตัวที่ผิดคือ 31 (ควรเป็น 30)', '12|24|31|36'],
  ['สังเกต', 2, 'ลำดับ 4, 7, 10, 13, ... จำนวนที่ 10 ของลำดับคือเท่าไร', '31', 'เริ่มที่ 4 เพิ่มทีละ 3 อีก 9 ครั้ง = 4 + 3 × 9 = 31'],
  ['สังเกต', 2, 'ลำดับ 7, 14, 21, 28, ... จำนวนที่ 9 ของลำดับคือเท่าไร', '63', 'คือแม่ 7 × 9 = 63'],
  ['สังเกต', 3, 'หาจำนวนถัดไป\n1,  8,  27,  64,  ?', '125', 'จำนวนยกกำลังสาม 5 × 5 × 5'],
  ['สังเกต', 3, 'หาจำนวนถัดไป\n2,  6,  12,  20,  30,  ?', '42', 'ส่วนต่าง 4, 6, 8, 10 ต่อไปบวก 12'],
  ['สังเกต', 3, 'หาจำนวนถัดไป\n5,  6,  8,  11,  15,  ?', '20', 'ส่วนต่าง 1, 2, 3, 4 ต่อไปบวก 5'],
  ['สังเกต', 3, 'หาจำนวนถัดไป\n3,  5,  9,  17,  33,  ?', '65', 'ส่วนต่าง 2, 4, 8, 16 ต่อไปบวก 32'],
  ['สังเกต', 3, 'หาจำนวนถัดไป\n2,  5,  11,  23,  47,  ?', '95', 'คูณ 2 แล้วบวก 1 ทุกครั้ง'],
  ['สังเกต', 3, 'หาจำนวนถัดไป\n10,  9,  7,  4,  ?', '0', 'ส่วนต่าง −1, −2, −3 ต่อไปลบ 4'],
  ['สังเกต', 3, 'จำนวนใดไม่เข้าพวก\n2,  3,  9,  11', '9', 'จำนวนอื่นเป็นจำนวนเฉพาะ (หารลงตัวด้วย 1 และตัวเองเท่านั้น) แต่ 9 หารด้วย 3 ลงตัว', '2|3|9|11'],
  ['สังเกต', 3, 'จำนวนใดไม่เข้าพวก\n16,  25,  36,  48,  49', '48', 'จำนวนอื่นเป็นจำนวนกำลังสอง แต่ 48 ไม่ใช่', '16|25|48|49'],
  ['สังเกต', 3, 'ลำดับ 5, 9, 13, 17, ... จำนวนที่ 20 ของลำดับคือเท่าไร', '81', 'เริ่มที่ 5 เพิ่มทีละ 4 อีก 19 ครั้ง = 5 + 4 × 19 = 81'],
  ['สังเกต', 3, 'ลำดับ 100, 95, 90, ... จำนวนที่ 12 ของลำดับคือเท่าไร', '45', 'ลดทีละ 5 อีก 11 ครั้ง = 100 − 5 × 11 = 45'],
  ['สังเกต', 4, 'หาจำนวนถัดไป\n1,  2,  6,  24,  ?', '120', 'คูณด้วย 2, 3, 4 ต่อไปคูณ 5'],

  // ---------- ตรรกะ (25) ----------
  ['ตรรกะ', 1, 'ต้นสูงกว่าฟ้า ฟ้าสูงกว่าบอส ใครเตี้ยที่สุด', 'บอส', 'เรียง: ต้น > ฟ้า > บอส', 'ต้น|ฟ้า|บอส'],
  ['ตรรกะ', 1, 'ก อยู่หน้า ข และ ค อยู่หลัง ข (ทั้งสามยืนเรียงแถวเดียวกัน) ใครยืนตรงกลาง', 'ข', 'เรียง: ก ข ค', 'ก|ข|ค'],
  ['ตรรกะ', 1, 'วันนี้เป็นวันพุธ เมื่อวานซืนเป็นวันอะไร', 'จันทร์', 'เมื่อวานซืนคือย้อนหลัง 2 วัน พุธ → อังคาร (เมื่อวาน) → จันทร์ (เมื่อวานซืน)', 'อาทิตย์|จันทร์|อังคาร|ศุกร์'],
  ['ตรรกะ', 2, 'ฉันคิดจำนวนหนึ่ง คูณด้วย 4 แล้วลบ 6 ได้ 30 จำนวนที่คิดคือเท่าไร', '9', 'ย้อนกลับ: 30 + 6 = 36 แล้ว 36 ÷ 4 = 9'],
  ['ตรรกะ', 2, 'ต้นยืนอยู่ในแถว เป็นคนที่ 5 จากหัวแถว และเป็นคนที่ 8 จากท้ายแถว แถวนี้มีกี่คน', '12', '5 + 8 − 1 = 12 (นับต้นซ้ำสองครั้ง)'],
  ['ตรรกะ', 2, '▲ + ▲ = 10 และ ▲ + ■ = 7 แล้ว ■ มีค่าเท่าไร', '2', '▲ = 5 จึง ■ = 7 − 5 = 2'],
  ['ตรรกะ', 2, '★ + ★ + ★ = 18 และ ★ + ● = 10 แล้ว ● มีค่าเท่าไร', '4', '★ = 6 จึง ● = 10 − 6 = 4'],
  ['ตรรกะ', 2, 'ไฟสามสีติดวนซ้ำ: แดง เขียว เหลือง แดง เขียว เหลือง ... ไฟดวงที่ 20 เป็นสีอะไร', 'เขียว', '20 ÷ 3 ได้ 6 เศษ 2 เศษ 2 คือสีที่สอง = เขียว', 'แดง|เขียว|เหลือง'],
  ['ตรรกะ', 2, 'วันนี้วันเสาร์ อีก 10 วันข้างหน้าเป็นวันอะไร', 'อังคาร', '10 ÷ 7 เศษ 3 เสาร์ + 3 วัน = อังคาร (อาทิตย์, จันทร์, อังคาร)', 'อาทิตย์|จันทร์|อังคาร|พุธ'],
  ['ตรรกะ', 2, 'ก วิ่งเร็วกว่า ข, ค วิ่งเร็วกว่า ก, ง วิ่งช้ากว่า ข ใครวิ่งเร็วที่สุด', 'ค', 'เรียงจากเร็ว: ค > ก > ข > ง', 'ก|ข|ค|ง'],
  ['ตรรกะ', 2, 'จำนวนคู่ที่อยู่ระหว่าง 11 กับ 21 มีกี่จำนวน', '5', '12, 14, 16, 18, 20 = 5 จำนวน'],
  ['ตรรกะ', 2, 'จำนวนนับตั้งแต่ 15 ถึง 40 (รวม 15 และ 40) มีกี่จำนวน', '26', '40 − 15 + 1 = 26'],
  ['ตรรกะ', 2, 'มีเสื้อชาย 3 ตัวและเสื้อหญิง 2 ตัว (ต่างกันหมด) เลือกชาย 1 ตัวและหญิง 1 ตัว ได้กี่แบบ', '6', '3 × 2 = 6'],
  ['ตรรกะ', 3, 'มีม้าและคนเดินอยู่รวม 5 หัว นับขาได้ 14 ขา (ม้า 4 ขา คน 2 ขา) มีม้ากี่ตัว', '2', 'ถ้าทุกหัวเป็นคนมี 10 ขา เกินมา 4 ขา ม้าแต่ละตัวเกินมา 2 ขา → 2 ตัว'],
  ['ตรรกะ', 3, 'ไฟสี่สีติดวนซ้ำ: ฟ้า ชมพู เหลือง ขาว ฟ้า ชมพู เหลือง ขาว ... ไฟดวงที่ 30 เป็นสีอะไร', 'ชมพู', '30 ÷ 4 ได้ 7 เศษ 2 เศษ 2 คือสีที่สอง = ชมพู', 'ฟ้า|ชมพู|เหลือง|ขาว'],
  ['ตรรกะ', 3, 'พี่อายุมากกว่าน้อง 5 ปี รวมอายุสองคน 25 ปี พี่อายุกี่ปี', '15', 'น้อง = (25 − 5) ÷ 2 = 10 พี่ = 10 + 5 = 15'],
  ['ตรรกะ', 3, 'มีเหรียญ 5 บาทและ 10 บาท รวม 8 เหรียญ เป็นเงิน 60 บาท มีเหรียญ 10 บาทกี่เหรียญ', '4', 'ถ้าเป็น 5 บาททั้งหมดได้ 40 บาท ขาด 20 บาท เหรียญ 10 บาทเพิ่มเหรียญละ 5 → 4 เหรียญ'],
  ['ตรรกะ', 3, 'จำนวนสองหลักที่หลักสิบเป็น 2 เท่าของหลักหน่วย และผลบวกของเลขโดดเป็น 9 คือจำนวนใด', '63', 'หลักหน่วย x หลักสิบ 2x รวม 3x = 9 → x = 3 จำนวนคือ 63'],
  ['ตรรกะ', 3, 'ปลูกต้นไม้ 12 ต้นเป็นแถวตรง ต้นละห่างกัน 3 เมตร ปลูกที่ปลายทั้งสองข้าง แนวนี้ยาวกี่เมตร', '33', 'มี 11 ช่วง 11 × 3 = 33'],
  ['ตรรกะ', 3, 'เลข 1, 2, 3 นำมาเรียงเป็นจำนวนสามหลัก ใช้ครบทุกตัวไม่ซ้ำ ได้กี่จำนวน', '6', '123, 132, 213, 231, 312, 321'],
  ['ตรรกะ', 4, '■ + ■ + ▲ = 17 และ ■ + ▲ + ▲ = 13 แล้ว ■ มีค่าเท่าไร', '7', '■ มากกว่า ▲ อยู่ 4 แทน ▲ = ■ − 4 ใน 2■ + ▲ = 17 → 3■ − 4 = 17 → ■ = 7'],
  ['ตรรกะ', 4, 'เดินขึ้นบันได 4 ขั้น ก้าวทีละ 1 หรือ 2 ขั้น มีวิธีขึ้นกี่แบบ', '5', '1111, 112, 121, 211, 22'],
  ['ตรรกะ', 4, 'มีกล่อง 3 ใบ ใบที่ 1 มีลูกบอล 5 ลูก ใบที่ 2 มากกว่าใบที่ 1 อยู่ 3 ลูก ใบที่ 3 มากกว่าใบที่ 2 อยู่ 3 ลูก รวมกี่ลูก', '24', 'ใบ 1 = 5, ใบ 2 = 5 + 3 = 8, ใบ 3 = 8 + 3 = 11 รวม 5 + 8 + 11 = 24'],
  ['ตรรกะ', 3, 'ตะกร้ามีลูกบอลสีแดง สีน้ำเงิน และสีเขียว รวม 21 ลูก สีแดงมากกว่าสีน้ำเงิน 3 ลูก สีน้ำเงินมากกว่าสีเขียว 3 ลูก มีลูกบอลสีเขียวกี่ลูก', '4', 'ให้สีเขียว = x สีน้ำเงิน = x + 3 สีแดง = x + 6 รวม 3x + 9 = 21 ดังนั้น 3x = 12 x = 4'],
  ['ตรรกะ', 4, 'แถวนักเรียนมี 4 คน จับมือกันทุกคู่คนละครั้ง จะจับมือกันทั้งหมดกี่ครั้ง', '6', 'ก-ข ก-ค ก-ง ข-ค ข-ง ค-ง = 6 ครั้ง'],

  // ---------- โจทย์ปัญหา (25) ----------
  ['โจทย์ปัญหา', 1, 'ซื้อดินสอ 3 แท่ง แท่งละ 8 บาท และยางลบ 1 ก้อน ราคา 5 บาท จ่ายเงิน 50 บาท ได้เงินทอนกี่บาท', '21', 'ราคารวม 3 × 8 + 5 = 29 ทอน 50 − 29 = 21'],
  ['โจทย์ปัญหา', 1, 'รถยนต์วิ่งชั่วโมงละ 60 กิโลเมตร นาน 3 ชั่วโมง แล้ววิ่งต่ออีก 45 กิโลเมตร รวมวิ่งกี่กิโลเมตร', '225', '60 × 3 = 180 แล้ว 180 + 45 = 225'],
  ['โจทย์ปัญหา', 1, 'ห้องมีเก้าอี้ 6 แถว แถวละ 8 ตัว นำออกไป 9 ตัว เหลือเก้าอี้กี่ตัว', '39', '6 × 8 = 48 แล้ว 48 − 9 = 39'],
  ['โจทย์ปัญหา', 1, 'ใช้น้ำมัน {2/5} ลิตรตอนเช้า และ {1/5} ลิตรตอนบ่าย รวมใช้น้ำมันกี่ลิตร', '3/5', 'ตัวส่วนเท่ากัน บวกตัวเศษ 2 + 1 = 3'],
  ['โจทย์ปัญหา', 1, 'นักเรียน 24 คน แบ่งเป็นกลุ่มกลุ่มละ 5 คน จะเหลือนักเรียนกี่คนที่ไม่มีกลุ่มเต็ม', '4', '24 ÷ 5 ได้ 4 เศษ 4'],
  ['โจทย์ปัญหา', 1, 'ดูภาพยนตร์ 2 ชั่วโมง 15 นาที คิดเป็นกี่นาที', '135', '2 × 60 + 15 = 135'],
  ['โจทย์ปัญหา', 1, 'เดินทาง 3 ชั่วโมง 40 นาที คิดเป็นกี่นาที', '220', '3 × 60 + 40 = 220'],
  ['โจทย์ปัญหา', 2, 'ผ้าผืนหนึ่งยาว 2.5 เมตร ซื้อ 3 ผืน รวมยาวกี่เมตร', '7.5', '2.5 × 3 = 7.5'],
  ['โจทย์ปัญหา', 2, 'ขนมปัง 1 ก้อนหนัก 125 กรัม 8 ก้อนหนักกี่กิโลกรัม', '1', '125 × 8 = 1,000 กรัม = 1 กิโลกรัม'],
  ['โจทย์ปัญหา', 2, 'มีเงิน 500 บาท ซื้อเสื้อ 2 ตัว ตัวละ 120 บาท และกางเกง 1 ตัว ราคา 175 บาท เหลือเงินกี่บาท', '85', 'ราคารวม 240 + 175 = 415 เหลือ 500 − 415 = 85'],
  ['โจทย์ปัญหา', 2, 'นักเรียน 38 คน นั่งรถตู้ คันละไม่เกิน 9 คน ต้องใช้รถตู้อย่างน้อยกี่คัน', '5', '38 ÷ 9 ได้ 4 เศษ 2 เศษต้องใช้อีก 1 คัน'],
  ['โจทย์ปัญหา', 2, 'ฟ้ามีลูกแก้ว 14 เม็ด ต้นมีลูกแก้วเป็น 3 เท่าของฟ้า สองคนมีลูกแก้วรวมกันกี่เม็ด', '56', 'ต้นมี 14 × 3 = 42 รวม 14 + 42 = 56'],
  ['โจทย์ปัญหา', 2, 'ริบบิ้นยาว 3.6 เมตร ตัดไปใช้ 1.85 เมตร เหลือริบบิ้นยาวกี่เมตร', '1.75', '3.60 − 1.85 = 1.75'],
  ['โจทย์ปัญหา', 2, 'สมุด 5 เล่ม ราคา 60 บาท ถ้าซื้อ 8 เล่ม ต้องจ่ายกี่บาท', '96', 'เล่มละ 60 ÷ 5 = 12 บาท 12 × 8 = 96'],
  ['โจทย์ปัญหา', 2, 'ต้นอ่านหนังสือไป {3/4} ของหนังสือที่มี 48 หน้า ต้นอ่านไปกี่หน้า', '36', '48 ÷ 4 = 12 แล้ว 12 × 3 = 36'],
  ['โจทย์ปัญหา', 2, 'เก็บเงินวันละ 15 บาท เป็นเวลา 6 วัน แล้วใช้ไป 38 บาท เหลือเงินกี่บาท', '52', '15 × 6 = 90 แล้ว 90 − 38 = 52'],
  ['โจทย์ปัญหา', 3, 'ซื้อแอปเปิ้ล 2.5 กิโลกรัม กิโลกรัมละ 40 บาท ต้องจ่ายกี่บาท', '100', '2.5 × 40 = 100'],
  ['โจทย์ปัญหา', 3, 'สวนมะม่วงมี 96 ต้น ตายไป {1/4} ของทั้งหมด เหลือมะม่วงกี่ต้น', '72', '96 ÷ 4 = 24 ตาย เหลือ 96 − 24 = 72'],
  ['โจทย์ปัญหา', 3, 'ถังน้ำจุ 120 ลิตร ตอนนี้มีน้ำ {3/8} ของถัง ต้องเติมอีกกี่ลิตรจึงเต็ม', '75', 'ส่วนที่ว่าง {5/8} ของ 120 = 120 ÷ 8 × 5 = 75'],
  ['โจทย์ปัญหา', 3, 'รถไฟออกเวลา 14:35 น. ถึงปลายทางเวลา 16:10 น. ใช้เวลาเดินทางกี่นาที', '95', '14:35 → 15:00 = 25 นาที 15:00 → 16:10 = 70 นาที รวม 95'],
  ['โจทย์ปัญหา', 3, 'ซื้อขนมมา 45 ชิ้น ในราคารวม 400 บาท ขายหมดชิ้นละ 12 บาท ได้กำไรกี่บาท', '140', 'ขายได้ 45 × 12 = 540 กำไร 540 − 400 = 140'],
  ['โจทย์ปัญหา', 3, 'ห้องรูปสี่เหลี่ยมผืนผ้ากว้าง 6 เมตร ยาว 8 เมตร ปูพรมแผ่นละ 2 ตารางเมตร ต้องใช้พรมกี่แผ่น', '24', 'พื้นที่ 6 × 8 = 48 ตารางเมตร 48 ÷ 2 = 24'],
  ['โจทย์ปัญหา', 3, 'ซื้อหนังสือ 3 เล่ม ราคารวม 267 บาท เล่มแรก 85 บาท เล่มสอง 96 บาท เล่มสามราคากี่บาท', '86', '85 + 96 = 181 แล้ว 267 − 181 = 86'],
  ['โจทย์ปัญหา', 3, 'แม่ซื้อไข่ 3 แผง แผงละ 30 ฟอง ใช้ไป 47 ฟอง เหลือไข่กี่ฟอง', '43', '3 × 30 = 90 แล้ว 90 − 47 = 43'],
  ['โจทย์ปัญหา', 4, 'จักรยานมี 2 ล้อ สามล้อมี 3 ล้อ รวมกัน 10 คัน นับล้อได้ 24 ล้อ มีสามล้อกี่คัน', '4', 'ถ้าเป็นจักรยานหมดมี 20 ล้อ เกินมา 4 ล้อ สามล้อแต่ละคันเกิน 1 ล้อ → 4 คัน'],

  // ---------- อ่านข้อมูล (25) ----------
  ['อ่านข้อมูล', 1, 'ยอดขายขนมแต่ละวัน: จันทร์ 25 อังคาร 32 พุธ 18 พฤหัสบดี 40 ชิ้น\nขายได้รวมกี่ชิ้น', '115', '25 + 32 + 18 + 40 = 115'],
  ['อ่านข้อมูล', 1, 'คะแนนของ ก 12, ข 15, ค 9, ง 20\nคะแนนสูงสุดมากกว่าคะแนนต่ำสุดกี่คะแนน', '11', '20 − 9 = 11'],
  ['อ่านข้อมูล', 1, 'จำนวนหนังสือในห้องสมุด: นิทาน 45 เล่ม การ์ตูน 60 เล่ม วิทยาศาสตร์ 35 เล่ม\nการ์ตูนมากกว่าวิทยาศาสตร์กี่เล่ม', '25', '60 − 35 = 25'],
  ['อ่านข้อมูล', 1, 'ปริมาณน้ำฝน: จันทร์ 5 อังคาร 0 พุธ 12 พฤหัสบดี 8 ศุกร์ 0 มิลลิเมตร\nรวมวัดน้ำฝนได้กี่มิลลิเมตร', '25', '5 + 0 + 12 + 8 + 0 = 25'],
  ['อ่านข้อมูล', 1, 'แท่งกราฟความยาวของเชือก: ก ยาว 20 ซม. ข ยาว 35 ซม. ค ยาว 50 ซม.\nเชือก ค ยาวกว่าเชือก ก กี่เซนติเมตร', '30', '50 − 20 = 30'],
  ['อ่านข้อมูล', 2, 'จำนวนผลไม้: ก 20 ผล ข 35 ผล ค 15 ผล ง 30 ผล\nสองชนิดที่มีมากที่สุดรวมกันกี่ผล', '65', '35 + 30 = 65'],
  ['อ่านข้อมูล', 2, 'เริ่มเรียนเวลา 8:30 น. พักเที่ยงเวลา 12:00 น.\nเรียนช่วงเช้ากี่นาที', '210', '8:30 → 12:00 = 3 ชั่วโมง 30 นาที = 210 นาที'],
  ['อ่านข้อมูล', 2, 'ราคา: ปากกา 12 บาท ดินสอ 7 บาท ยางลบ 5 บาท\nซื้อปากกา 2 ด้าม ดินสอ 3 แท่ง ยางลบ 1 ก้อน ต้องจ่ายกี่บาท', '50', '24 + 21 + 5 = 50'],
  ['อ่านข้อมูล', 2, 'ตั๋วเข้างาน ผู้ใหญ่ 80 บาท เด็ก 50 บาท\nซื้อผู้ใหญ่ 2 ใบ เด็ก 3 ใบ ต้องจ่ายกี่บาท', '310', '160 + 150 = 310'],
  ['อ่านข้อมูล', 2, 'ห้อง ป.4/1 มี 32 คน ป.4/2 มี 30 คน ป.4/3 มี 35 คน\nนักเรียนป.4 ทั้งหมดกี่คน', '97', '32 + 30 + 35 = 97'],
  ['อ่านข้อมูล', 2, 'ค่าขนมต้นแต่ละวัน: จันทร์ 20 อังคาร 25 พุธ 20 พฤหัสบดี 30 ศุกร์ 25 บาท\nวันที่ใช้มากที่สุดใช้มากกว่าวันที่ใช้น้อยที่สุดกี่บาท', '10', '30 − 20 = 10'],
  ['อ่านข้อมูล', 2, 'น้ำหนัก: ต้น 32 กก. ฟ้า 28 กก. บอส 35 กก. นุ่น 30 กก.\nสองคนที่หนักที่สุดรวมน้ำหนักกี่กิโลกรัม', '67', '35 + 32 = 67'],
  ['อ่านข้อมูล', 2, 'ความสูง: ก 130 ซม. ข 142 ซม. ค 125 ซม.\nข สูงกว่า ค กี่เซนติเมตร', '17', '142 − 125 = 17'],
  ['อ่านข้อมูล', 2, 'จำนวนคนเลือกกีฬา: ว่ายน้ำ 12 คน ฟุตบอล 18 คน เทนนิส 9 คน\nจำนวนคนเลือกฟุตบอลเป็นกี่เท่าของเทนนิส', '2', '18 ÷ 9 = 2'],
  ['อ่านข้อมูล', 2, 'รถออกเวลา 9:15 น. ถึงเวลา 11:00 น.\nใช้เวลาเดินทางกี่นาที', '105', '9:15 → 10:00 = 45 นาที 10:00 → 11:00 = 60 นาที รวม 105'],
  ['อ่านข้อมูล', 2, 'คะแนนสอบ 4 วิชา: 18, 15, 20, 17 (เต็มวิชาละ 20 คะแนน)\nคะแนนที่ขาดไปจากคะแนนเต็มรวมกี่คะแนน', '10', 'เต็มรวม 80 ได้ 70 ขาด 10'],
  ['อ่านข้อมูล', 2, 'เด็กเกิดเดือนมกราคม 3 คน กุมภาพันธ์ 5 คน มีนาคม 4 คน เมษายน 2 คน\nรวมกี่คน', '14', '3 + 5 + 4 + 2 = 14'],
  ['อ่านข้อมูล', 2, 'ราคาส้มกิโลกรัมละ 35 บาท มะม่วงกิโลกรัมละ 40 บาท\nซื้อส้ม 2 กิโลกรัม มะม่วง 3 กิโลกรัม ต้องจ่ายกี่บาท', '190', '70 + 120 = 190'],
  ['อ่านข้อมูล', 2, 'ผู้เข้าชมงานวันเสาร์ 1,250 คน วันอาทิตย์ 1,480 คน\nรวมสองวันกี่คน', '2730', '1,250 + 1,480 = 2,730'],
  ['อ่านข้อมูล', 2, 'ลดราคาเสื้อ 35 บาท จากราคาเดิม 150 บาท\nราคาหลังลดกี่บาท', '115', '150 − 35 = 115'],
  ['อ่านข้อมูล', 3, 'ร้านขายของได้: เช้า 48 ชิ้น บ่าย 65 ชิ้น เย็น 37 ชิ้น\nยอดช่วงเช้ากับเย็นรวมกันมากกว่าช่วงบ่ายกี่ชิ้น', '20', '48 + 37 = 85 แล้ว 85 − 65 = 20'],
  ['อ่านข้อมูล', 3, 'อุณหภูมิ: จันทร์ 30 อังคาร 32 พุธ 29 พฤหัสบดี 33 ศุกร์ 31 องศา\nค่าเฉลี่ยเป็นกี่องศา', '31', 'รวม 155 ÷ 5 = 31'],
  ['อ่านข้อมูล', 3, 'แต้มสะสมของต้นในหกวัน: 3, 5, 4, 6, 2, 4\nเฉลี่ยวันละกี่แต้ม', '4', 'รวม 24 ÷ 6 = 4'],
  ['อ่านข้อมูล', 3, 'นาฬิกาบอกเวลา 3:45 น. อีก 50 นาทีจะถึงเวลา 4:35 น.\nเวลา 4:35 น. เลยเวลา 4:00 น. ไปกี่นาที', '35', '4:35 − 4:00 = 35 นาที'],
  ['อ่านข้อมูล', 3, 'สีที่ชอบ: แดง 14 คน ฟ้า 11 คน เขียว 9 คน เหลือง 6 คน\nมีกี่คนที่ชอบสีอื่นที่ไม่ใช่สีแดง', '26', '11 + 9 + 6 = 26']
];

/** แปลงแถวจากแท็บคลังข้อสอบ เป็นข้อสอบพร้อมใช้ (คืน null ถ้าแถวไม่สมบูรณ์) */
function fixedToItem(row) {
  var cat = String(row.cat || '').trim(), q = String(row.q || '').trim(), ans = String(row.ans == null ? '' : row.ans).trim();
  if (!cat || !q || ans === '') return null;
  var it = {
    key: 'FIX:' + row.code, tag: row.code, fixCat: cat, level: Number(row.level) || 1,
    cat: cat === 'สังเกต' ? 'observe' : cat === 'โจทย์ปัญหา' ? 'word' : 'analytic',
    q: q, explain: String(row.explain || '').trim() || 'ลองอ่านโจทย์อีกครั้ง แล้วคิดทีละขั้น'
  };
  var ch = String(row.choices || '').trim();
  if (ch) {
    var list = ch.split('|').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
    var idx = list.indexOf(ans);
    if (list.length < 2 || idx < 0) return null;
    it.type = 'choice'; it.choices = list; it.ans = String(idx + 1);
    return it;
  }
  var u = parseUser(ans);
  if (!u.ok) return null;
  it.type = u.kind === 'dec' ? 'dec' : (u.kind === 'frac' || u.kind === 'mixed') ? 'frac' : 'int';
  it.ans = ans.replace(/,/g, '');
  return it;
}

// ======================= Curriculum.gs =======================
/**
 * Curriculum.gs — หลักสูตรส่วน A แบบ "สัปดาห์ละเรื่อง" (บวก → ลบ → คูณ → หาร → เศษส่วน, หัวข้อละ 6 ชุด)
 * ไม่เรียก API ของ Google (ทดสอบด้วย Node ได้) และไม่เรียกฟังก์ชันของไฟล์อื่นตอนโหลดไฟล์
 *
 * หน่วย: "ชนิดหน้า" (page kind) = โจทย์ 10 ข้อ
 *   pat(v)  → หน้ารูปแบบ (ข้อเรียงเป็นแบบรูปให้เด็กสังเกตเอง + คำถามสังเกตไม่ให้คะแนนท้ายหน้า) มี nv แบบ
 *   one(l)  → โจทย์สุ่ม 1 ข้อ ที่ระดับ l (0 ง่าย, 1 ใช้เทคนิค, 2 ยากขึ้น)
 * แผน: ROUND_PLAN[หัวข้อ][รอบ] = {total: ข้อต่อชุด, sets: [6 ชุด × [[ชนิดหน้า, ระดับ, จำนวนหน้า, ตัวแปรเริ่มต้น]]]}
 */
var TOPICS = ['add', 'sub', 'mul', 'div', 'frac'];
var TOPIC_NAMES = { add: 'บวก', sub: 'ลบ', mul: 'คูณ', div: 'หาร', frac: 'เศษส่วน' };
var TOPIC_CAT = { add: 'addsub', sub: 'addsub', mul: 'mul', div: 'div', frac: 'fracdec' };
var ROT_SETS = 6;
var PAGE_SIZE = 10;
var MAX_PLAN_ROUND = 3;
var SET_KIND_LABEL = ['', 'ฝึกสังเกตรูปแบบ', 'ฝึกสังเกตรูปแบบ', 'ใช้เทคนิคกับโจทย์ที่ยากขึ้น', 'ใช้เทคนิคกับโจทย์ที่ยากขึ้น', 'ฝึกผสม', 'ประเมินผลประจำสัปดาห์'];

var PAGE_KINDS = {};
function PK(id, topic, label, spp, def) {
  def.id = id; def.topic = topic; def.label = label; def.spp = spp; def.nv = def.nv || 0;
  PAGE_KINDS[id] = def;
}
function pkRange(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }
function PI(q, ans, o) {
  var it = { q: q, ans: String(ans), type: 'int' };
  if (o) for (var k in o) it[k] = o[k];
  return it;
}
/** คำถามสังเกต (ไม่ให้คะแนน): ตัวเลือกสลับตำแหน่งตาม seed */
function obsQ(q, correct, wrongs, explain) {
  var c = String(correct), ws = [];
  wrongs.forEach(function (w) { w = String(w); if (w !== c && ws.indexOf(w) < 0) ws.push(w); });
  var all = shuffle([c].concat(ws.slice(0, 3)));
  return { q: q, choices: all, ans: String(all.indexOf(c) + 1), explain: explain || '' };
}
function stepItem(id) { var it = genStep(id); delete it.key; return it; }
var TL = [2, 5, 10, 3, 4, 6, 7, 8, 9, 11, 12];

/* ======================= บวก ======================= */
PK('add.pairs10', 'add', 'บวกให้ครบสิบ', [3, 4, 5], {
  nv: 4,
  pat: function (v) {
    var items, tot = v === 3 ? 20 : 10;
    if (v === 0) items = pkRange(0, 9).map(function (a) { return PI(a + ' + ' + (10 - a) + ' =', 10); });
    else if (v === 1) items = pkRange(0, 9).map(function (a) { return PI(a + ' + ? = 10', 10 - a); });
    else if (v === 2) items = pkRange(0, 9).map(function (a) { return PI('? + ' + (10 - a) + ' = 10', a); });
    else items = pkRange(10, 19).map(function (a) { return PI(a + ' + ' + (20 - a) + ' =', 20); });
    return { items: items, observe: obsQ('สองจำนวนในทุกข้อบวกกันได้เท่าไรเสมอ?', tot, [tot - 5, tot + 5, tot + 1], 'ตัวหนึ่งเพิ่มขึ้น อีกตัวลดลง ผลรวมจึงเท่าเดิมคือ ' + tot) };
  },
  one: function (l) {
    if (l === 0) { var a = ri(0, 10); return PI(a + ' + ' + (10 - a) + ' =', 10); }
    var b = ri(11, 89);
    return PI(b + ' + ' + (100 - b) + ' =', 100, { explain: 'ตัวหนึ่งบวกอีกตัวให้ครบ 100' });
  }
});
PK('add.plus9', 'add', 'บวก 9 / บวก 8', [3, 4, 5], {
  nv: 4,
  pat: function (v) {
    var items, ob;
    if (v === 0) { items = pkRange(1, 10).map(function (x) { return PI(x + ' + 9 =', x + 9); }); ob = obsQ('บวก 9 เหมือนบวก 10 แล้วทำอย่างไรต่อ?', 'ลบ 1', ['บวก 1', 'ลบ 9', 'คูณ 10'], '+9 = +10 แล้วลบ 1'); }
    else if (v === 1) { items = pkRange(0, 9).map(function (i) { var x = 11 + i * 10; return PI(x + ' + 9 =', x + 9); }); ob = obsQ('เลขหน่วยของคำตอบเป็นอย่างไรเมื่อเทียบกับเลขหน่วยของตัวตั้ง?', 'น้อยลง 1', ['มากขึ้น 1', 'เท่าเดิม', 'น้อยลง 9'], '+9 คือ +10 −1 หลักสิบเพิ่ม 1 หลักหน่วยลด 1'); }
    else if (v === 2) { items = pkRange(1, 10).map(function (x) { return PI(x + ' + 8 =', x + 8); }); ob = obsQ('บวก 8 เหมือนบวก 10 แล้วลบเท่าไร?', 'ลบ 2', ['ลบ 1', 'ลบ 8', 'บวก 2'], '+8 = +10 แล้วลบ 2'); }
    else { items = pkRange(11, 20).map(function (x) { return PI(x + ' + 9 =', x + 9); }); ob = null; }
    return { items: items, observe: ob };
  },
  one: function (l) {
    if (l <= 1) { var x = ri(11, 89), d = pick([9, 9, 8]); return PI(x + ' + ' + d + ' =', x + d, { explain: '+' + d + ' = +10 แล้วลบ ' + (10 - d) }); }
    var y = ri(21, 79), e = pick([19, 29, 18]);
    return PI(y + ' + ' + e + ' =', y + e, { explain: 'บวกเต็มสิบแล้วลบส่วนที่เกิน' });
  }
});
PK('add.bridge10', 'add', 'บวกข้ามสิบ', [3, 4, 5], {
  nv: 8,
  pat: function (v) {
    var a = 6 + (v % 4), items = pkRange(1, 10).map(function (b) { return PI(a + ' + ' + b + ' =', a + b); });
    if (v >= 4) items.reverse();
    return { items: items, observe: obsQ(a + ' + 5: เติมให้ครบ 10 ก่อน แล้วเหลืออีกเท่าไร?', a - 5, [5, 10 - a, a - 4], a + ' + 5 = ' + a + ' + ' + (10 - a) + ' + ' + (a - 5)) };
  },
  one: function (l) {
    if (l <= 1) { var a = ri(6, 9), b = retry(function () { return ri(2, 9); }, function (b) { return a + b > 10; }); return PI(a + ' + ' + b + ' =', a + b, { explain: 'เติมให้ครบ 10 ก่อน แล้วบวกที่เหลือ' }); }
    var x = retry(function () { return ri(14, 89); }, function (x) { return x % 10 >= 4; }), c = retry(function () { return ri(3, 9); }, function (c) { return x % 10 + c > 10; });
    return PI(x + ' + ' + c + ' =', x + c, { explain: 'เติมให้ครบสิบก่อน แล้วบวกที่เหลือ' });
  }
});
PK('add.bridge2d', 'add', 'บวกสองหลักข้ามสิบ', [4, 5, 7], {
  nv: 8,
  pat: function (v) {
    var base = [37, 48, 59, 66, 75, 84, 29, 18][v % 8], u = base % 10, need = 10 - u, b2 = need + 3;
    return { items: pkRange(1, 10).map(function (b) { return PI(base + ' + ' + b + ' =', base + b); }),
      observe: obsQ(base + ' + ' + b2 + ': เติม ' + need + ' ให้ครบสิบก่อน แล้วเหลืออีกเท่าไร?', 3, [need, b2, 10], base + ' + ' + b2 + ' = ' + (base + need) + ' + 3') };
  },
  one: function (l) {
    if (l <= 1) { var x = retry(function () { return ri(23, 89); }, function (x) { return x % 10 >= 3; }), c = retry(function () { return ri(3, 9); }, function (c) { return x % 10 + c > 10; }); return PI(x + ' + ' + c + ' =', x + c); }
    var p = retry(function () { return [ri(20, 99), ri(20, 99)]; }, function (p) { return carries(p[0], p[1]) >= 1 && p[0] + p[1] > 100; });
    return PI(p[0] + ' + ' + p[1] + ' =', p[0] + p[1], { traps: addTraps(p[0], p[1]), explain: 'บวกหลักสิบก่อน แล้วบวกหลักหน่วย หรือปัดเป็นสิบ' });
  }
});
function addTraps(a, b) { var t = {}; if (carries(a, b)) t[addNoCarry(a, b)] = 'ทดผิด/ลืมทด'; return t; }
function subTraps(a, b) { var t = {}; if (borrows(a, b)) t[subNoBorrow(a, b)] = 'ยืมผิด/ลืมยืม'; return t; }
PK('add.twod', 'add', 'บวกสองหลัก', [5, 6, 7], {
  one: function (l) {
    var p = retry(function () { return [rndN(2), rndN(2)]; }, function (p) { var c = carries(p[0], p[1]); return l === 0 ? c === 0 : c >= 1; });
    return PI(p[0] + ' + ' + p[1] + ' =', p[0] + p[1], { traps: addTraps(p[0], p[1]) });
  }
});
PK('add.near100', 'add', 'ปัดเป็นสิบแล้วชดเชย', [7, 8, 10], {
  nv: 5,
  pat: function (v) {
    var b1 = 35 + v, b2 = 47 + v, items = [];
    pkRange(0, 4).forEach(function (i) { var a = 58 + 10 * i; items.push(PI(a + ' + ' + b1 + ' =', a + b1)); items.push(PI(a + ' + ' + b2 + ' =', a + b2)); });
    return { items: items, observe: obsQ('68 + 35: ปัด 68 เป็น 70 (เพิ่ม 2) ต้องลด 35 ลงกี่?', 2, [3, 5, 10], '68 + 35 = 70 + 33') };
  },
  one: function (l) {
    if (l <= 1) { var a = retry(function () { return ri(48, 198); }, function (a) { return a % 10 >= 7; }), b = ri(24, 58); return PI(a + ' + ' + b + ' =', a + b, { traps: addTraps(a, b) }); }
    return stepItem('AS05');
  }
});
PK('add.vert', 'add', 'บวก 3–4 หลัก', [10, 12, 14], { one: function (l) { return stepItem(l <= 1 ? 'AS05' : 'AS07'); } });

/* ======================= ลบ ======================= */
PK('sub.from10', 'sub', 'ลบจาก 10 / 20', [3, 4, 5], {
  nv: 4,
  pat: function (v) {
    var items;
    if (v === 0) items = pkRange(0, 9).map(function (a) { return PI('10 − ' + a + ' =', 10 - a); });
    else if (v === 1) items = pkRange(0, 9).map(function (a) { return PI('10 − ? = ' + a, 10 - a); });
    else if (v === 2) items = pkRange(10, 19).map(function (a) { return PI('20 − ' + a + ' =', 20 - a); });
    else items = pkRange(10, 19).map(function (a) { return PI('20 − ? = ' + a, 20 - a); });
    var t = v >= 2 ? 20 : 10;
    return { items: items, observe: obsQ(t + ' − 3 = ' + (t - 3) + ' ตรวจคำตอบโดย ' + (t - 3) + ' + 3 ได้เท่าไร?', t, [t - 3, 3, t + 3], 'ลบกับบวกเป็นตรงข้ามกัน') };
  },
  one: function (l) {
    if (l === 0) { var a = ri(0, 9); return PI('10 − ' + a + ' =', 10 - a); }
    var b = ri(3, 19); return PI('20 − ' + b + ' =', 20 - b);
  }
});
PK('sub.thinkAdd', 'sub', 'ลบด้วยการคิดบวก', [4, 5, 6], {
  nv: 6,
  pat: function (v) {
    var m = 11 + v;
    return { items: pkRange(1, 10).map(function (b) { return PI(m + ' − ' + b + ' =', m - b); }), observe: obsQ(m + ' − 4: คิดเป็น 4 + ? = ' + m + ' ได้เท่าไร?', m - 4, [m - 5, m - 3, 4], m + ' − 4 = ' + (m - 4) + ' เพราะ 4 + ' + (m - 4) + ' = ' + m) };
  },
  one: function (l) {
    if (l <= 1) { var m = ri(11, 18), b = retry(function () { return ri(2, 9); }, function (b) { return b > m % 10; }); return PI(m + ' − ' + b + ' =', m - b, { explain: 'คิดว่า ' + b + ' + ? = ' + m }); }
    var x = retry(function () { return ri(21, 90); }, function (x) { return x % 10 >= 1 && x % 10 <= 6; }), c = retry(function () { return ri(3, 9); }, function (c) { return c > x % 10; });
    return PI(x + ' − ' + c + ' =', x - c, { traps: subTraps(x, c) });
  }
});
PK('sub.bridge', 'sub', 'ลบข้ามสิบ', [4, 5, 6], {
  nv: 8,
  pat: function (v) {
    var m = [52, 63, 41, 74, 85, 36, 92, 57][v % 8], u = m % 10, b = u + 3;
    return { items: pkRange(1, 10).map(function (x) { return PI(m + ' − ' + x + ' =', m - x); }), observe: obsQ(m + ' − ' + b + ': ลบ ' + u + ' ให้ได้ ' + (m - u) + ' ก่อน แล้วลบอีกเท่าไร?', 3, [u, b, 10], m + ' − ' + b + ' = ' + (m - u) + ' − 3') };
  },
  one: function (l) {
    var x = retry(function () { return ri(l <= 1 ? 22 : 31, l <= 1 ? 75 : 98); }, function (x) { return x % 10 >= 1 && x % 10 <= 7; }), c = retry(function () { return ri(2, 9); }, function (c) { return c > x % 10; });
    return PI(x + ' − ' + c + ' =', x - c, { traps: subTraps(x, c), explain: 'ลบให้เหลือเต็มสิบก่อน แล้วลบที่เหลือ' });
  }
});
PK('sub.minus9', 'sub', 'ลบ 9 / ลบ 8', [3, 4, 5], {
  nv: 4,
  pat: function (v) {
    var items, ob;
    if (v === 0) { items = pkRange(10, 19).map(function (x) { return PI(x + ' − 9 =', x - 9); }); ob = obsQ('ลบ 9 เหมือนลบ 10 แล้วทำอย่างไรต่อ?', 'บวก 1', ['ลบ 1', 'บวก 9', 'คูณ 10'], '−9 = −10 แล้วบวกคืน 1'); }
    else if (v === 1) { items = pkRange(0, 9).map(function (i) { var x = 11 + i * 10; return PI(x + ' − 9 =', x - 9); }); ob = obsQ('คำตอบของข้อต่อ ๆ ไปเพิ่มขึ้นทีละเท่าไร (ตัวตั้งเพิ่มทีละ 10)?', 10, [9, 1, 11], 'ตัวตั้งเพิ่ม 10 คำตอบก็เพิ่ม 10'); }
    else if (v === 2) { items = pkRange(10, 19).map(function (x) { return PI(x + ' − 8 =', x - 8); }); ob = obsQ('ลบ 8 เหมือนลบ 10 แล้วบวกคืนเท่าไร?', 2, [1, 8, 10], '−8 = −10 แล้วบวกคืน 2'); }
    else { items = pkRange(21, 30).map(function (x) { return PI(x + ' − 9 =', x - 9); }); ob = null; }
    return { items: items, observe: ob };
  },
  one: function (l) {
    if (l <= 1) { var x = ri(21, 99), d = pick([9, 9, 8]); return PI(x + ' − ' + d + ' =', x - d, { explain: '−' + d + ' = −10 แล้วบวกคืน ' + (10 - d) }); }
    var y = ri(41, 99), e = pick([19, 29, 18]); return PI(y + ' − ' + e + ' =', y - e, { explain: 'ลบเต็มสิบแล้วบวกคืน' });
  }
});
PK('sub.compensate', 'sub', 'ลบแบบปัดแล้วชดเชย', [5, 6, 8], {
  nv: 4,
  pat: function (v) {
    var top = [100, 100, 200, 200][v], e = [9, 8, 9, 8][v];
    return { items: pkRange(0, 9).map(function (k) { return PI(top + ' − ' + (10 * k + e) + ' =', top - 10 * k - e); }),
      observe: obsQ('100 − 39: ลบ 40 ก่อน (ลบเกินไป 1) ต้องทำอย่างไร?', 'บวกคืน 1', ['ลบเพิ่ม 1', 'บวกคืน 9', 'ไม่ต้องทำอะไร'], '100 − 39 = 100 − 40 + 1') };
  },
  one: function (l) {
    if (l <= 1) { var a = ri(41, 99), k = ri(1, 3), b = 10 * k + pick([9, 9, 8]); if (a <= b + 1) a = b + 12; return PI(a + ' − ' + b + ' =', a - b, { traps: subTraps(a, b), explain: 'ลบเต็มสิบ แล้วชดเชย' }); }
    var p = retry(function () { return [rndN(2), rndN(2)]; }, function (p) { return p[0] > p[1] && borrows(p[0], p[1]) === 1; });
    return PI(p[0] + ' − ' + p[1] + ' =', p[0] - p[1], { traps: subTraps(p[0], p[1]) });
  }
});
PK('sub.twod', 'sub', 'ลบสองหลัก', [5, 6, 7], {
  one: function (l) {
    var p = retry(function () { return [rndN(2), rndN(2)]; }, function (p) { return p[0] > p[1] && (l === 0 ? borrows(p[0], p[1]) === 0 : borrows(p[0], p[1]) === 1); });
    return PI(p[0] + ' − ' + p[1] + ' =', p[0] - p[1], { traps: subTraps(p[0], p[1]) });
  }
});
PK('sub.zeros', 'sub', 'ลบจากเลขที่มีศูนย์', [8, 10, 12], {
  nv: 3,
  pat: function (v) {
    var top = [1000, 2000, 3000][v], k = [11, 11, 21][v];
    return { items: pkRange(1, 10).map(function (i) { return PI(top + ' − ' + (k * i) + ' =', top - k * i); }),
      observe: obsQ('คำตอบของข้อต่อ ๆ ไปลดลงทีละเท่าไร?', k, [k - 1, k + 1, 10], 'ตัวลบเพิ่มทีละ ' + k + ' คำตอบก็ลดทีละ ' + k) };
  },
  one: function (l) {
    if (l <= 1) { var a = pick([1000, 2000, 3000, 4000]), b = ri(101, 899); return PI(a + ' − ' + b + ' =', a - b, { traps: subTraps(a, b), explain: 'ยืมข้ามศูนย์ ศูนย์ที่ถูกยืมกลายเป็น 9' }); }
    return stepItem('AS10');
  }
});
PK('sub.borrow', 'sub', 'ลบ 3–4 หลัก', [10, 12, 14], { one: function (l) { return stepItem(l <= 1 ? 'AS06' : 'AS08'); } });

/* ======================= คูณ ======================= */
PK('mul.table', 'mul', 'สูตรคูณ', [3, 4, 5], {
  nv: 22,
  pat: function (v) {
    var t = TL[Math.floor(v / 2) % TL.length], dir = v % 2, items = [];
    if (dir === 0) pkRange(1, 10).forEach(function (n) { items.push(PI(t + ' × ' + n + ' =', t * n)); });
    else pkRange(1, 10).reverse().forEach(function (n) { items.push(PI(n + ' × ' + t + ' =', t * n)); });
    return { items: items, observe: dir === 0 ? obsQ('คำตอบของแม่ ' + t + ' เพิ่มขึ้นทีละเท่าไร?', t, [t + 1, t - 1, 2 * t], 'แต่ละข้อเพิ่มทีละ ' + t) : null };
  },
  one: function (l) {
    if (l === 0) { var a = pick([2, 5, 10, 3, 4]), b = ri(1, 10); return PI(a + ' × ' + b + ' =', a * b); }
    var hi = l === 1 ? 9 : 12, x = ri(2, hi), y = ri(2, hi); return chance(0.5) ? PI(x + ' × ' + y + ' =', x * y) : PI(y + ' × ' + x + ' =', x * y);
  }
});
PK('mul.times5', 'mul', '×5 = ×10 แล้วหารสอง', [3, 4, 5], {
  nv: 4,
  pat: function (v) {
    var ns = (v % 2 === 0) ? pkRange(1, 10).map(function (i) { return 2 * i; }) : pkRange(1, 10).map(function (i) { return 2 * i - 1; });
    return { items: ns.map(function (n) { return v < 2 ? PI(n + ' × 5 =', n * 5) : PI('5 × ' + n + ' =', n * 5); }), observe: obsQ('คูณ 5 เหมือนคูณ 10 แล้วทำอย่างไรต่อ?', 'หารด้วย 2', ['คูณ 2', 'ลบ 5', 'บวก 5'], '×5 = ×10 ÷ 2') };
  },
  one: function (l) { var n = l <= 1 ? ri(11, 50) : ri(21, 99); return PI(n + ' × 5 =', n * 5, { explain: '×10 แล้วหารสอง' }); }
});
PK('mul.times4', 'mul', '×4 = คูณสองสองครั้ง', [3, 4, 5], {
  nv: 3,
  pat: function (v) {
    var items = pkRange(1, 10).map(function (i) { var n = 10 * v + i; return PI(n + ' × 4 =', 4 * n); });
    return { items: items, observe: obsQ('คูณ 4 เหมือนคูณ 2 อีกกี่ครั้ง?', '2 ครั้ง', ['1 ครั้ง', '3 ครั้ง', '4 ครั้ง'], '×4 = ×2 แล้ว ×2 อีกครั้ง') };
  },
  one: function (l) { var n = l <= 1 ? ri(11, 49) : ri(31, 99); return PI(n + ' × 4 =', n * 4, { explain: 'คูณ 2 สองครั้ง' }); }
});
PK('mul.times9', 'mul', '×9 = ×10 ลบ 1 ชุด', [3, 4, 5], {
  nv: 3,
  pat: function (v) {
    var items = pkRange(1, 10).map(function (i) { var n = 10 * v + i; return PI(n + ' × 9 =', 9 * n); });
    return { items: items, observe: v < 1 ? obsQ('เลขโดดของคำตอบแต่ละข้อ บวกกันได้เท่าไร?', 9, [8, 10, 18], 'ผลคูณของ 9 เลขโดดรวมกันเป็น 9 เสมอ (ในแม่ 9 ถึง 9 × 10)') : null };
  },
  one: function (l) { var n = l <= 1 ? ri(11, 30) : ri(31, 99); return PI(n + ' × 9 =', n * 9, { explain: '×10 แล้วลบ ' + n }); }
});
PK('mul.mixed', 'mul', 'สูตรคูณผสม', [3, 4, 5], {
  one: function (l) { var hi = l <= 1 ? 9 : 12, x = ri(2, hi), y = ri(2, hi); return PI(x + ' × ' + y + ' =', x * y); }
});
PK('mul.split2d', 'mul', 'แยกสิบแยกหน่วย', [7, 8, 10], {
  nv: 4,
  pat: function (v) {
    var m = 3 + v;
    return { items: pkRange(21, 30).map(function (n) { return PI(n + ' × ' + m + ' =', n * m); }), observe: obsQ('23 × ' + m + ' = 20 × ' + m + ' + 3 × ' + m + ' = ' + (20 * m) + ' + ?', 3 * m, [3 * m + 1, 3 * m - 1, m], '3 × ' + m + ' = ' + (3 * m)) };
  },
  one: function (l) {
    if (l <= 1) { var p = retry(function () { return [rndN(2), ri(3, 9)]; }, function (p) { return !mulNoCarryOK(p[0], p[1]); }); return PI(p[0] + ' × ' + p[1] + ' =', p[0] * p[1], { traps: mulTraps(p[0], p[1]), explain: 'แยกสิบแยกหน่วยแล้วบวกกัน' }); }
    return stepItem(chance(0.5) ? 'MU05' : 'MU06');
  }
});
function mulTraps(a, m) { var t = {}; if (m < 10 && mulNoCarry(a, m) !== a * m) t[mulNoCarry(a, m)] = 'ทดผิด/ลืมทด'; return t; }
PK('mul.d3', 'mul', '3 หลัก × 1 หลัก', [9, 10, 12], { one: function (l) { return stepItem(l <= 1 ? 'MU05' : 'MU06'); } });

/* ======================= หาร ======================= */
PK('div.inverse', 'div', 'หารคือสูตรคูณย้อนกลับ', [3, 4, 5], {
  nv: 22,
  pat: function (v) {
    var t = TL[Math.floor(v / 2) % TL.length], form = v % 2;
    var items = form === 0 ? pkRange(1, 10).map(function (n) { return PI((t * n) + ' ÷ ' + t + ' =', n); }) : pkRange(1, 10).map(function (n) { return PI(t + ' × ? = ' + (t * n), n); });
    return { items: items, observe: obsQ((t * 6) + ' ÷ ' + t + ' คิดว่า ' + t + ' คูณอะไรได้ ' + (t * 6) + '?', 6, [5, 7, t], 'หารคือย้อนกลับของคูณ') };
  },
  one: function (l) { var hi = l <= 1 ? 9 : 12, t = l === 0 ? pick([2, 3, 4, 5, 10]) : ri(2, hi), n = ri(l === 0 ? 1 : 2, hi); return PI((t * n) + ' ÷ ' + t + ' =', n, { explain: t + ' × ? = ' + (t * n) }); }
});
PK('div.half4', 'div', '÷4 = ครึ่งสองครั้ง', [3, 4, 5], {
  nv: 3,
  pat: function (v) {
    return { items: pkRange(1, 10).map(function (i) { var n = 10 * v + i; return PI((4 * n) + ' ÷ 4 =', n); }), observe: obsQ('หารด้วย 4 เหมือนหารด้วย 2 อีกกี่ครั้ง?', '2 ครั้ง', ['1 ครั้ง', '3 ครั้ง', '4 ครั้ง'], '÷4 = ÷2 แล้ว ÷2 อีกครั้ง') };
  },
  one: function (l) { var n = l <= 1 ? ri(12, 49) : ri(50, 249); return PI((4 * n) + ' ÷ 4 =', n, { explain: 'ครึ่งสองครั้ง' }); }
});
PK('div.mixed', 'div', 'หารลงตัวผสม', [4, 5, 10], { one: function (l) { return stepItem(l <= 1 ? 'DV02' : 'DV04'); } });
PK('div.rem', 'div', 'หารมีเศษ', [7, 9, 11], {
  nv: 14,
  pat: function (v) {
    var b = 3 + (v % 7), lo = Math.ceil(20 / b), hi = Math.floor(80 / b), q = lo + (Math.floor(v / 7) * 3) % Math.max(1, hi - lo + 1), items = [];
    pkRange(0, 9).forEach(function (i) { items.push(divRemItem(b * q + i, b)); });
    return { items: items, observe: obsQ('เมื่อหารด้วย ' + b + ' เศษที่มากที่สุดที่เป็นไปได้คือเท่าไร?', b - 1, [b, b + 1, b - 2], 'เศษต้องน้อยกว่าตัวหารเสมอ') };
  },
  one: function (l) { return stepItem(l <= 1 ? 'DV03' : 'DV05'); }
});
PK('div.long3', 'div', 'หาร 3 หลัก', [15, 17, 20], {
  nv: 6,
  pat: function (v) {
    var b = 3 + (v % 6), q0 = Math.ceil(100 / b) + 1 + Math.floor(v / 6) * 3;
    return { items: pkRange(0, 9).map(function (i) { return PI((b * (q0 + i)) + ' ÷ ' + b + ' =', q0 + i); }), observe: obsQ('ตัวตั้งเพิ่มทีละ ' + b + ' ผลหารเพิ่มทีละเท่าไร?', 1, [b, 2, 10], 'เพิ่มตัวตั้ง ' + b + ' = ผลหารเพิ่ม 1') };
  },
  one: function (l) { return stepItem(l <= 1 ? 'DV04' : 'DV05'); }
});

/* ======================= เศษส่วน ======================= */
function fracPic(k, d) {
  var cells = [], rows = [], i;
  for (i = 0; i < d; i++) cells.push(i < k ? '🟦' : '⬜');
  for (i = 0; i < d; i += 10) rows.push(cells.slice(i, i + 10).join(''));
  return rows.join('\n');
}
PK('frac.picture', 'frac', 'อ่านเศษส่วนจากรูป', [6, 7, 8], {
  nv: 6,
  pat: function (v) {
    var d = [11, 12, 14, 16, 15, 18][v % 6];
    return { items: pkRange(1, 10).map(function (k) { return PI(fracPic(k, d) + '\nส่วนที่ระบายสีเป็นเศษส่วนเท่าไร', k + '/' + d, { type: 'frac', noReduce: true, picK: k, picD: d, explain: 'ตัวเศษ = ช่องที่ระบายสี ตัวส่วน = ช่องทั้งหมด' }); }),
      observe: obsQ('ตัวส่วนของเศษส่วนบอกอะไร?', 'จำนวนช่องทั้งหมด', ['จำนวนช่องที่ระบายสี', 'จำนวนช่องที่ว่าง', 'ผลต่างของสองช่อง'], 'ตัวส่วน = ช่องทั้งหมด ตัวเศษ = ช่องที่ระบายสี') };
  },
  one: function (l) { var d = ri(3, 12), k = ri(1, d - 1); return PI(fracPic(k, d) + '\nส่วนที่ระบายสีเป็นเศษส่วนเท่าไร', k + '/' + d, { type: 'frac', noReduce: true, picK: k, picD: d }); }
});
PK('frac.equiv', 'frac', 'เศษส่วนที่เท่ากัน', [8, 9, 10], {
  nv: 8,
  pat: function (v) {
    var base = [[1, 2], [1, 3], [2, 3], [3, 4], [1, 4], [2, 5], [3, 5], [1, 5]][v % 8], a = base[0], b = base[1];
    return { items: pkRange(2, 11).map(function (k) { return PI(F(a, b) + ' = ' + F('?', b * k), a * k, { explain: 'ตัวส่วนคูณ ' + k + ' ตัวเศษก็ต้องคูณ ' + k }); }),
      observe: obsQ('จากข้อหนึ่งไปอีกข้อ ตัวเศษกับตัวส่วนเปลี่ยนอย่างไรเพื่อให้เศษส่วนเท่าเดิม?', 'คูณด้วยจำนวนเดียวกัน', ['บวกด้วยจำนวนเดียวกัน', 'ลบด้วยจำนวนเดียวกัน', 'เปลี่ยนแค่ตัวส่วน'], 'คูณทั้งตัวเศษและตัวส่วนด้วยจำนวนเดียวกัน') };
  },
  one: function (l) { return stepItem('FD01'); }
});
PK('frac.simplest', 'frac', 'ทำเป็นเศษส่วนอย่างต่ำ', [8, 9, 11], {
  nv: 8,
  pat: function (v) {
    var base = [[1, 2], [2, 3], [1, 3], [3, 4], [2, 5], [3, 5], [1, 4], [4, 5]][v % 8], a = base[0], b = base[1];
    return { items: pkRange(2, 11).map(function (k) { return PI('ทำให้เป็นอย่างต่ำ  ' + F(a * k, b * k) + ' =', a + '/' + b, { type: 'frac', explain: 'หารทั้งตัวเศษและตัวส่วนด้วย ' + k }); }),
      observe: obsQ('ทำไมทุกข้อจึงได้คำตอบเดียวกัน?', 'เป็นเศษส่วนที่เท่ากัน', ['เป็นเลขเดียวกัน', 'บังเอิญ', 'คิดผิด'], 'ทุกข้อเป็นเศษส่วนที่เท่ากัน ทำให้เป็นอย่างต่ำได้ค่าเดียวกัน') };
  },
  one: function (l) { return stepItem('FD02'); }
});
function fracCompareItem(a, b, c, d) {
  var x = a * d, y = c * b, ans = x > y ? '1' : x < y ? '2' : '3';
  return { q: 'เศษส่วนใดมากกว่า\n' + F(a, b) + '  กับ  ' + F(c, d), type: 'choice', choices: [F(a, b), F(c, d), 'เท่ากัน'], ans: ans, explain: 'เทียบด้วยการทำตัวส่วนให้เท่ากัน หรือดูตัวเศษ/ตัวส่วน' };
}
PK('frac.compare', 'frac', 'เปรียบเทียบเศษส่วน', [6, 7, 8], {
  nv: 10,
  pat: function (v) {
    var items = [], i;
    if (v < 5) {
      var d = [8, 10, 6, 9, 12][v], pairs = [];
      for (i = 1; i < d; i++) for (var j = i + 1; j < d; j++) pairs.push([i, j]);
      shuffle(pairs).slice(0, 10).forEach(function (p) { items.push(chance(0.5) ? fracCompareItem(p[0], d, p[1], d) : fracCompareItem(p[1], d, p[0], d)); });
      return { items: items, observe: obsQ('ตัวส่วนเท่ากัน เศษส่วนที่ตัวเศษมากกว่าเป็นอย่างไร?', 'มากกว่า', ['น้อยกว่า', 'เท่ากัน', 'บอกไม่ได้'], 'ส่วนเท่ากัน ตัวเศษมากกว่า = มากกว่า') };
    }
    var n = [1, 2, 3, 1, 2][v - 5], dens = [];
    for (i = n + 1; i <= 12; i++) dens.push(i);
    var pr = []; for (i = 0; i < dens.length; i++) for (var k = i + 1; k < dens.length; k++) pr.push([dens[i], dens[k]]);
    shuffle(pr).slice(0, 10).forEach(function (p) { items.push(chance(0.5) ? fracCompareItem(n, p[0], n, p[1]) : fracCompareItem(n, p[1], n, p[0])); });
    return { items: items, observe: obsQ('ตัวเศษเท่ากัน เศษส่วนที่ตัวส่วนน้อยกว่าเป็นอย่างไร?', 'มากกว่า', ['น้อยกว่า', 'เท่ากัน', 'บอกไม่ได้'], 'ตัวเศษเท่ากัน ตัวส่วนน้อยกว่า = ชิ้นใหญ่กว่า = มากกว่า') };
  },
  one: function (l) {
    var ds = [2, 3, 4, 5, 6, 8, 10], b = pick(ds), d = pick(ds), a = ri(1, b - 1), c = ri(1, d - 1);
    if (a * d === c * b) c = c === 1 ? 2 : c - 1;
    if (c >= d) c = d - 1;
    if (a * d === c * b) return fracCompareItem(1, 2, 1, 3);
    return fracCompareItem(a, b, c, d);
  }
});
PK('frac.addsub', 'frac', 'บวกลบเศษส่วน', [8, 10, 14], {
  nv: 4,
  pat: function (v) {
    var d = [13, 13, 17, 17][v], k = [2, 2, 3, 3][v], sub = v % 2 === 1, items;
    items = pkRange(sub ? k + 1 : 1, sub ? k + 10 : 10).map(function (n) { return sub ? PI(F(n, d) + ' − ' + F(k, d) + ' =', (n - k) + '/' + d, { type: 'frac' }) : PI(F(n, d) + ' + ' + F(k, d) + ' =', (n + k) + '/' + d, { type: 'frac' }); });
    return { items: items, observe: obsQ('บวก/ลบเศษส่วนที่ตัวส่วนเท่ากัน ตัวส่วนของคำตอบเป็นอย่างไร?', 'เท่าเดิม', ['บวกกัน', 'คูณกัน', 'เปลี่ยนไปมาก'], 'ตัวส่วนเท่ากันแล้วคิดเฉพาะตัวเศษ ตัวส่วนคงเดิม') };
  },
  one: function (l) { return stepItem(l <= 1 ? pick(['FD05', 'FD06']) : 'FD09'); }
});
PK('frac.mixImp', 'frac', 'เศษเกิน ↔ จำนวนคละ', [10, 12, 14], {
  nv: 6,
  pat: function (v) {
    var d = [7, 5, 11, 9, 13, 8][v % 6], items = [], n = d + 1;
    while (items.length < 10) {
      if (n % d !== 0 && gcd(n % d, d) === 1) items.push(PI('เขียนเป็นจำนวนคละ  ' + F(n, d) + ' =', fracStr(n, d), { type: 'frac', form: 'mixed', explain: n + ' ÷ ' + d + ' ได้ ' + Math.floor(n / d) + ' เศษ ' + (n % d) }));
      n++;
    }
    return { items: items, observe: obsQ('ผลหารของ ตัวเศษ ÷ ตัวส่วน คือส่วนใดของจำนวนคละ?', 'จำนวนเต็ม', ['ตัวเศษ', 'ตัวส่วน', 'ตัวส่วนร่วม'], 'ผลหารคือจำนวนเต็ม เศษที่เหลือคือตัวเศษ') };
  },
  one: function (l) { return stepItem(l <= 1 ? 'FD03' : 'FD04'); }
});
PK('frac.addMixed', 'frac', 'บวกลบจำนวนคละ', [14, 16, 20], { one: function (l) { return stepItem(l <= 1 ? 'FD07' : pick(['FD08', 'FD10'])); } });
PK('frac.dec1', 'frac', 'ทศนิยม 1 ตำแหน่ง', [8, 10, 12], { one: function (l) { return stepItem(l <= 1 ? 'FD11' : pick(['FD12', 'FD13'])); } });
PK('frac.dec2', 'frac', 'ทศนิยม 2 ตำแหน่ง / คูณทศนิยม', [14, 16, 18], { one: function (l) { return stepItem(l <= 1 ? 'FD14' : 'FD15'); } });

/* ======================= รอบ 3 ขึ้นไป: ใช้ตัวสร้าง 50 ขั้นเดิม ======================= */
function stepKind(id) {
  var k = 'step:' + id;
  if (!PAGE_KINDS[k]) {
    var st = STEP_BY_ID[id];
    var sp = Math.max(3, Math.round(st.spp * 0.55));
    PK(k, null, st.name, [sp, sp, sp], { one: function () { return stepItem(id); } });
    PAGE_KINDS[k].topic = ({ addsub: 'add', mul: 'mul', div: 'div', fracdec: 'frac' })[st.skill];
  }
  return PAGE_KINDS[k];
}

/* ======================= แผนรอบ/สัปดาห์ ======================= */
/** รายการ [ชนิดหน้า, ระดับ, จำนวนหน้า, ตัวแปรเริ่มต้น] */
var ROUND_PLAN = {
  add: {
    1: { total: 100, sets: [
      [['add.pairs10', 0, 4, 0], ['add.plus9', 0, 2, 0], ['add.bridge10', 0, 2, 0], ['add.bridge2d', 0, 2, 0]],
      [['add.plus9', 0, 2, 2], ['add.bridge10', 0, 3, 4], ['add.bridge2d', 0, 3, 2], ['add.pairs10', 1, 2, 0]],
      [['add.plus9', 1, 2], ['add.bridge10', 1, 2], ['add.bridge2d', 1, 3], ['add.twod', 1, 3]],
      [['add.plus9', 2, 2], ['add.bridge10', 2, 2], ['add.bridge2d', 2, 2], ['add.twod', 2, 4]],
      [['add.pairs10', 1, 1], ['add.plus9', 1, 1], ['add.bridge10', 2, 2], ['add.bridge2d', 2, 3], ['add.twod', 2, 3]],
      [['add.plus9', 2, 2], ['add.bridge10', 2, 2], ['add.bridge2d', 2, 3], ['add.twod', 2, 3]]] },
    2: { total: 50, sets: [
      [['add.near100', 0, 3, 0], ['add.vert', 1, 2]], [['add.near100', 0, 3, 3], ['add.vert', 1, 2]],
      [['add.near100', 1, 2], ['add.vert', 1, 2], ['add.vert', 2, 1]], [['add.near100', 2, 2], ['add.vert', 2, 3]],
      [['add.near100', 2, 1], ['add.vert', 1, 1], ['add.vert', 2, 3]], [['add.near100', 2, 2], ['add.vert', 2, 3]]] },
    3: { total: 40, steps: ['AS07', 'AS11', 'AS12', 'AS09'] }
  },
  sub: {
    1: { total: 100, sets: [
      [['sub.from10', 0, 2, 0], ['sub.thinkAdd', 0, 2, 0], ['sub.bridge', 0, 2, 0], ['sub.minus9', 0, 2, 0], ['sub.compensate', 0, 2, 0]],
      [['sub.from10', 0, 2, 2], ['sub.thinkAdd', 0, 2, 2], ['sub.bridge', 0, 2, 2], ['sub.minus9', 0, 2, 2], ['sub.compensate', 0, 2, 2]],
      [['sub.from10', 1, 1], ['sub.thinkAdd', 1, 2], ['sub.bridge', 1, 2], ['sub.minus9', 1, 2], ['sub.compensate', 1, 3]],
      [['sub.thinkAdd', 2, 1], ['sub.bridge', 2, 2], ['sub.minus9', 2, 2], ['sub.compensate', 2, 3], ['sub.twod', 1, 2]],
      [['sub.from10', 1, 1], ['sub.thinkAdd', 2, 1], ['sub.bridge', 2, 2], ['sub.minus9', 2, 2], ['sub.compensate', 2, 2], ['sub.twod', 2, 2]],
      [['sub.thinkAdd', 2, 1], ['sub.bridge', 2, 2], ['sub.minus9', 2, 2], ['sub.compensate', 2, 3], ['sub.twod', 2, 2]]] },
    2: { total: 50, sets: [
      [['sub.zeros', 0, 3, 0], ['sub.borrow', 1, 2]], [['sub.zeros', 0, 3, 1], ['sub.borrow', 1, 2]],
      [['sub.zeros', 1, 2], ['sub.borrow', 1, 1], ['sub.borrow', 2, 2]], [['sub.zeros', 2, 2], ['sub.borrow', 2, 3]],
      [['sub.zeros', 2, 2], ['sub.borrow', 1, 1], ['sub.borrow', 2, 2]], [['sub.zeros', 2, 2], ['sub.borrow', 2, 3]]] },
    3: { total: 40, steps: ['AS08', 'AS10', 'AS09', 'AS12'] }
  },
  mul: {
    1: { total: 100, sets: [
      [['mul.table', 0, 1, 0], ['mul.table', 0, 1, 2], ['mul.table', 0, 1, 4], ['mul.times5', 0, 2, 0], ['mul.table', 0, 1, 6], ['mul.table', 0, 1, 8], ['mul.times4', 0, 2, 0], ['mul.table', 0, 1, 1]],
      [['mul.table', 0, 1, 10], ['mul.table', 0, 1, 12], ['mul.table', 0, 1, 14], ['mul.table', 0, 1, 16], ['mul.times9', 0, 2, 0], ['mul.times4', 0, 1, 2], ['mul.table', 0, 1, 18], ['mul.table', 0, 1, 20], ['mul.times5', 0, 1, 2]],
      [['mul.table', 1, 4], ['mul.times9', 1, 2], ['mul.times4', 1, 2], ['mul.times5', 1, 2]],
      [['mul.table', 2, 3], ['mul.times9', 2, 2], ['mul.times4', 2, 2], ['mul.times5', 2, 1], ['mul.mixed', 1, 2]],
      [['mul.mixed', 1, 3], ['mul.mixed', 2, 3], ['mul.table', 2, 1], ['mul.times9', 1, 1], ['mul.times4', 1, 1], ['mul.times5', 1, 1]],
      [['mul.mixed', 2, 6], ['mul.table', 2, 1], ['mul.times9', 2, 1], ['mul.times4', 2, 1], ['mul.times5', 2, 1]]] },
    2: { total: 40, sets: [
      [['mul.split2d', 0, 3, 0], ['mul.split2d', 1, 1]], [['mul.split2d', 0, 2, 3], ['mul.split2d', 1, 2]],
      [['mul.split2d', 1, 2], ['mul.d3', 1, 2]], [['mul.split2d', 2, 1], ['mul.d3', 1, 1], ['mul.d3', 2, 2]],
      [['mul.split2d', 2, 1], ['mul.d3', 2, 3]], [['mul.split2d', 2, 1], ['mul.d3', 2, 3]]] },
    3: { total: 30, steps: ['MU09', 'MU10', 'MU11', 'MU12'] }
  },
  div: {
    1: { total: 100, sets: [
      [['div.inverse', 0, 6, 0], ['div.half4', 0, 2, 0], ['div.rem', 0, 2, 0]],
      [['div.inverse', 0, 1, 6], ['div.inverse', 0, 1, 8], ['div.inverse', 0, 1, 10], ['div.inverse', 0, 1, 12], ['div.inverse', 0, 1, 14], ['div.inverse', 0, 1, 16], ['div.half4', 0, 1, 2], ['div.rem', 0, 3, 2]],
      [['div.inverse', 1, 3], ['div.mixed', 1, 2], ['div.rem', 1, 3], ['div.half4', 1, 2]],
      [['div.inverse', 2, 3], ['div.mixed', 1, 2], ['div.rem', 1, 3], ['div.half4', 2, 2]],
      [['div.mixed', 1, 3], ['div.rem', 1, 3], ['div.inverse', 2, 2], ['div.half4', 1, 1], ['div.mixed', 2, 1]],
      [['div.mixed', 2, 3], ['div.rem', 1, 3], ['div.inverse', 2, 2], ['div.half4', 2, 2]]] },
    2: { total: 25, sets: [
      [['div.long3', 0, 3, 0]], [['div.long3', 0, 3, 3]], [['div.long3', 1, 2], ['div.long3', 2, 1]],
      [['div.long3', 1, 1], ['div.long3', 2, 2]], [['div.long3', 1, 1], ['div.long3', 2, 2]], [['div.long3', 1, 1], ['div.long3', 2, 2]]] },
    3: { total: 25, steps: ['DV09', 'DV10', 'DV11'] }
  },
  frac: {
    1: { total: 50, sets: [
      [['frac.picture', 0, 2, 0], ['frac.equiv', 0, 1, 0], ['frac.simplest', 0, 1, 0], ['frac.compare', 0, 1, 0]],
      [['frac.picture', 0, 1, 2], ['frac.equiv', 0, 1, 1], ['frac.simplest', 0, 1, 1], ['frac.compare', 0, 1, 5], ['frac.addsub', 0, 1, 0]],
      [['frac.equiv', 1, 1], ['frac.simplest', 1, 1], ['frac.compare', 1, 2], ['frac.addsub', 1, 1]],
      [['frac.equiv', 1, 1], ['frac.simplest', 1, 1], ['frac.compare', 1, 1], ['frac.addsub', 1, 2]],
      [['frac.picture', 1, 1], ['frac.equiv', 1, 1], ['frac.simplest', 1, 1], ['frac.compare', 1, 1], ['frac.addsub', 1, 1]],
      [['frac.equiv', 1, 1], ['frac.simplest', 1, 1], ['frac.compare', 1, 1], ['frac.addsub', 1, 2]]] },
    2: { total: 40, sets: [
      [['frac.mixImp', 0, 3, 0], ['frac.addMixed', 1, 1]], [['frac.mixImp', 0, 2, 3], ['frac.addMixed', 1, 1], ['frac.dec1', 1, 1]],
      [['frac.mixImp', 1, 1], ['frac.addMixed', 1, 2], ['frac.dec1', 1, 1]], [['frac.mixImp', 2, 1], ['frac.addMixed', 2, 2], ['frac.dec1', 1, 1]],
      [['frac.mixImp', 1, 1], ['frac.addMixed', 2, 1], ['frac.dec1', 2, 2]], [['frac.mixImp', 2, 1], ['frac.addMixed', 2, 2], ['frac.dec1', 2, 1]]] },
    3: { total: 30, steps: ['FD09', 'FD10', 'FD14', 'FD15'] }
  }
};

function planRound(round) { return Math.max(1, Math.min(MAX_PLAN_ROUND, Number(round) || 1)); }
/** คืนแผนของชุดที่ setNo (1–6): {total, pages:[{kind, lvl, v}]} */
function setPlan(topic, round, setNo) {
  var rp = ROUND_PLAN[topic][planRound(round)], total = rp.total, np = Math.ceil(total / PAGE_SIZE), pages = [], j;
  if (rp.steps) {
    for (j = 0; j < np; j++) pages.push({ kind: 'step:' + rp.steps[(setNo + j) % rp.steps.length], lvl: 1, v: 0 });
  } else {
    rp.sets[setNo - 1].forEach(function (e) {
      for (var i = 0; i < e[2]; i++) pages.push({ kind: e[0], lvl: e[1], v: (e[3] || 0) + i });
    });
  }
  return { total: total, pages: pages.slice(0, np), np: np };
}
function pageKind(id) {
  if (id.indexOf('step:') === 0) return stepKind(id.slice(5));
  return PAGE_KINDS[id];
}
function pageSpp(kindId, lvl) { var k = pageKind(kindId); return k.spp[Math.min(lvl, k.spp.length - 1)]; }
/** เวลาเป้าหมาย X ของชุด (วินาที) = Σ ข้อ × วินาทีต่อข้อ */
function setXSec(topic, round, setNo) {
  var p = setPlan(topic, round, setNo), s = 0;
  p.pages.forEach(function (pg, i) { var n = i === p.np - 1 ? p.total - PAGE_SIZE * (p.np - 1) : PAGE_SIZE; s += n * pageSpp(pg.kind, pg.lvl); });
  return Math.round(s);
}

/**
 * สร้างข้อของชุด A
 * ctx.usedSigs = ลายเซ็นที่เคยออกใน 30 วัน (ใช้กับหน้าสุ่มเท่านั้น หน้ารูปแบบซ้ำข้อเดิมได้โดยตั้งใจ)
 * คืน {items, pages:[{n, start, kind, label, lvl, pattern, title, observe}], xSec}
 */
function buildASetItems(topic, round, setNo, ctx) {
  var plan = setPlan(topic, round, setNo), items = [], pages = [], inSet = {};
  plan.pages.forEach(function (pg, pi) {
    var kind = pageKind(pg.kind), n = pi === plan.np - 1 ? plan.total - PAGE_SIZE * (plan.np - 1) : PAGE_SIZE, got = [], obs = null, pattern = false;
    if (pg.lvl === 0 && kind.pat) {
      var r = kind.pat(pg.v % kind.nv);
      got = r.items.slice(0, n); obs = r.observe; pattern = true;
    } else {
      for (var i = 0; i < n; i++) {
        var it = null, base = '';
        for (var t = 0; t < 40; t++) {
          it = kind.one(pg.lvl);
          base = 'PG:' + kind.id + '|' + String(it.q).replace(/\s+/g, '');
          if (!inSet[base] && !(ctx.usedSigs && ctx.usedSigs[base])) break;
        }
        inSet[base] = 1;
        got.push(it);
      }
    }
    got.forEach(function (it) {
      var base = 'PG:' + kind.id + '|' + String(it.q).replace(/\s+/g, '');
      it.key = 'PG:' + kind.id; it.tag = kind.id; it.cat = it.cat || TOPIC_CAT[topic]; it.tier = pg.lvl; it.main = true;
      it.page = pi + 1; it.pattern = pattern; it.topic = topic; it.round = planRound(round);
      it.sig = base;
      if (!pattern && ctx.usedSigs) ctx.usedSigs[base] = 1;
      items.push(it);
    });
    pages.push({ n: got.length, start: items.length - got.length, kind: kind.id, label: kind.label, lvl: pg.lvl, pattern: pattern,
      title: (pattern ? 'หา "เคล็ดลับ" จากแบบรูป: ' : '') + kind.label, observe: obs });
  });
  return { items: items, pages: pages, xSec: setXSec(topic, round, setNo) };
}
/** โจทย์ 1 ข้อของชนิดหน้าเดิม ใช้ทบทวน (ตัวเลขใหม่ แนวคิดเดิม) */
function oneOfKind(kindId, lvl) {
  var k = pageKind(kindId); if (!k) return null;
  var it = k.one(lvl == null || lvl < 1 ? 1 : lvl);
  it.key = 'PG:' + kindId; it.tag = kindId; it.cat = it.cat || TOPIC_CAT[k.topic || 'add']; it.tier = lvl || 1;
  return it;
}

/* ======================= สถานะการหมุนเวียนและผลประเมิน ======================= */
function rotInit() { return { topic: 'add', setNo: 1, repeat: false, weekNo: 1 }; }
function rotRounds0() { return { add: 1, sub: 1, mul: 1, div: 1, frac: 1 }; }
function nextTopic(topic) { return TOPICS[(TOPICS.indexOf(topic) + 1) % TOPICS.length]; }

/**
 * ตัดสินผลชุดที่ 6: sec = {mastered: แก้ถูกเองทุกข้อ(ไม่ดูเฉลย), totalSec}, x, y
 * pass = 100% หลังแก้ และเวลา ≤ X / flag = 100% และ X < เวลา < Y / repeat = ไม่ถึง 100% หรือเวลา ≥ Y
 */
function assessOutcome(sec, x, y) {
  if (!sec.mastered) return { outcome: 'repeat', reason: 'มีข้อที่ต้องดูเฉลย (ไม่ถึง 100% หลังแก้)' };
  if (sec.totalSec >= y) return { outcome: 'repeat', reason: 'ใช้เวลา ' + fmtSec(sec.totalSec) + ' ถึงเกณฑ์สูงสุด ' + fmtSec(y) };
  if (sec.totalSec > x) return { outcome: 'flag', reason: 'ผ่าน แต่ช้ากว่าเป้า ' + fmtSec(x) + ' (ใช้ ' + fmtSec(sec.totalSec) + ')' };
  return { outcome: 'pass', reason: '' };
}
/**
 * ตัวเลื่อนสถานะ (ฟังก์ชันล้วน): ทำเสร็จชุด setNo แล้ว → สถานะถัดไป
 * result = {outcome} เฉพาะชุดที่ 6 ('pass'|'flag'|'repeat')
 * ทำซ้ำได้ครั้งเดียวติดกัน: ซ้ำแล้วยังไม่ผ่านให้ไปหัวข้อถัดไป โดยรอบคงเดิม
 */
function rotAfterSet(rot, rounds, setNo, result) {
  var r = { topic: rot.topic, setNo: rot.setNo, repeat: !!rot.repeat, weekNo: rot.weekNo || 1 }, rd = {}, k, event;
  for (k in rounds) rd[k] = rounds[k];
  if (setNo < ROT_SETS) { r.setNo = setNo + 1; return { rot: r, rounds: rd, event: 'next-set' }; }
  var out = (result && result.outcome) || 'repeat';
  r.weekNo = r.weekNo + 1;
  if (out === 'pass' || out === 'flag') { rd[rot.topic] = (rd[rot.topic] || 1) + 1; r.topic = nextTopic(rot.topic); r.setNo = 1; r.repeat = false; event = 'advance'; }
  else if (!rot.repeat) { r.setNo = 1; r.repeat = true; event = 'repeat'; }
  else { r.topic = nextTopic(rot.topic); r.setNo = 1; r.repeat = false; event = 'moveon'; }
  return { rot: r, rounds: rd, event: event, outcome: out };
}
/** ผลวัดระดับ (ขั้นเริ่มต้นของแต่ละบันไดเดิม) → รอบเริ่มต้นของแต่ละหัวข้อ */
var ROUND_STEP_FROM = { add: [1, 5, 9], sub: [1, 5, 9], mul: [1, 3, 9], div: [1, 4, 8], frac: [1, 7, 14] };
var TOPIC_LADDER = { add: 'addsub', sub: 'addsub', mul: 'mul', div: 'div', frac: 'fracdec' };
function roundForStep(topic, stepNo) {
  var th = ROUND_STEP_FROM[topic], r = 1;
  for (var i = 0; i < th.length; i++) if (stepNo >= th[i]) r = i + 1;
  return r;
}
function placementRounds(starts) {
  var out = {};
  TOPICS.forEach(function (t) { out[t] = roundForStep(t, Number(starts[TOPIC_LADDER[t]]) || 1); });
  return out;
}
/** ข้อความสถานะ เช่น "รอบ 1 · สัปดาห์บวก · ชุด 3/6" */
function rotLabel(topic, round, setNo, repeat) {
  return 'รอบ ' + round + ' · สัปดาห์' + TOPIC_NAMES[topic] + ' · ชุด ' + setNo + '/' + ROT_SETS + (repeat ? ' (ทำซ้ำ)' : '');
}

/* ======================= ส่วน B/C: แม่แบบที่สอดคล้องกับหัวข้อประจำสัปดาห์ ======================= */
var TPL_TOPICS = {
  W01: ['add', 'sub', 'mul'], W02: ['add'], W03: ['div'], W04: ['add', 'mul'], W05: ['mul', 'div'], W06: ['add'], W07: ['add', 'mul'], W08: ['frac', 'mul', 'div'],
  W09: ['frac'], W10: ['frac', 'sub'], W11: ['frac', 'mul'], W12: ['mul', 'sub'], W13: ['div', 'sub'], W14: ['add', 'sub', 'div'], W15: ['div', 'mul'], W16: ['mul', 'sub'],
  W17: ['sub', 'add'], W18: ['add', 'mul', 'sub'], W19: ['div', 'sub'], W20: ['mul', 'sub'], W21: ['add', 'sub', 'mul'], W22: ['mul', 'add'],
  O01: ['add'], O02: ['mul'], O03: ['add'], O04: ['add'], O05: ['sub'], O06: ['add'], O07: ['mul'], O09: ['add'], O10: ['mul', 'div'], O11: ['add'], O13: ['add'], O14: ['sub'],
  O15: ['mul'], O16: ['mul'], O17: ['frac'], O18: ['add', 'sub'], O19: ['add'], O22: ['add'], O23: ['mul', 'div'],
  A04: ['add', 'sub', 'mul'], A07: ['add', 'sub', 'mul', 'div'], A08: ['mul', 'div'], A09: ['add'], A10: ['div', 'add'], A11: ['mul'], A12: ['add', 'sub', 'div'], A13: ['mul', 'sub', 'div'],
  A14: ['add', 'mul'], A15: ['div', 'add'], A16: ['sub', 'add'], A17: ['add', 'sub'], A18: ['add', 'sub'], A19: ['add', 'sub'], A20: ['mul', 'div', 'frac'], A21: ['div'], A22: ['div']
};
/** {รหัสแม่แบบ: 1} ของแม่แบบที่เหมาะกับหัวข้อ */
function topicPrefer(topic) {
  var o = {};
  for (var id in TPL_TOPICS) if (TPL_TOPICS[id].indexOf(topic) >= 0) o[id] = 1;
  return o;
}

// ======================= SetBuilder.gs =======================
/**
 * SetBuilder.gs — ประกอบชุดข้อประจำวัน / แบบวัดระดับ (สัปดาห์แรก) / แบบวัดผลรายเดือน
 * ไม่เรียก API ของ Google: รับ ctx แล้วคืนชุดข้อ (ทดสอบด้วย Node ได้)
 *
 * ctx = {
 *   levels: {addsub:ขั้น, mul:ขั้น, div:ขั้น, fracdec:ขั้น, tiers:{word,observe,analytic}},
 *   skill: ทักษะของส่วน A วันนี้ (โหมด daily),
 *   usedSigs: {ลายเซ็นโจทย์ที่เคยออกใน 30 วันที่ผ่านมา: 1},
 *   recentTpl: {รหัสแม่แบบที่ใช้ใน 3 วันล่าสุด: 1},
 *   bank: [{code,cat,level,q,ans,explain,choices}], bankUsed: {code: 'yyyy-MM-dd'},
 *   reviews: [{id,key,cat,tier,level,fixCat}]  (ที่ถึงกำหนดทบทวน)
 * }
 * ต้องเรียก setRng(...) ก่อน เพื่อให้ชุดข้อของวันเดียวกันออกมาเหมือนเดิม
 */
var PLACEMENT_PER_STEP = 2;
var DAILY_B_COUNT = 6, DAILY_C_COUNT = 6;
var MAX_REVIEW = { A: 3, B: 2, C: 3 };

/** ข้อกำหนดชุดวัดผลที่ "ตรึงไว้" ใช้ร่วมกันระหว่างวัดระดับสัปดาห์แรกกับแบบวัดผลรายเดือน (ไม่ขึ้นกับระดับปัจจุบันของเด็ก) */
var BENCH_SPEC = {
  observe: [{ grp: 'seq', tier: 1 }, { grp: 'seq', tier: 3 }, { grp: 'vis', tier: 2 }, { grp: 'odd', tier: 2 }, { grp: 'err', tier: 2 }],
  wordTiers: [1, 2, 3, 4],
  analytic: [{ grp: 'data', tier: 2 }, { grp: 'logic', tier: 2 }, { grp: 'logic', tier: 3 }, { grp: 'count', tier: 3 }]
};

function uniqueItem(gen, ctx, tries) {
  var it = null;
  for (var i = 0; i < (tries || 30); i++) {
    try { it = gen(); } catch (e) { it = null; continue; }
    it.sig = sigOf(it);
    if (!ctx.usedSigs[it.sig]) break;
  }
  if (!it) throw new Error('สร้างโจทย์ไม่สำเร็จ');
  ctx.usedSigs[it.sig] = 1;
  return it;
}
function flag(it, f) { for (var k in f) it[k] = f[k]; return it; }

function genTpl(cat, grp, tier, ctx, local, flags) {
  var ex = {}, k;
  for (k in (ctx.recentTpl || {})) ex[k] = 1;
  for (k in local) ex[k] = 1;
  var id = pickTemplate(cat, grp, tier, ex, ctx.topic ? topicPrefer(ctx.topic) : null);
  local[id] = 1;
  return flag(uniqueItem(function () { return buildTemplate(id, tier); }, ctx), flags || {});
}

function fixedMap(ctx) {
  if (!ctx._fix) {
    ctx._fix = {};
    (ctx.bank || []).forEach(function (r) { var it = fixedToItem(r); if (it) ctx._fix[r.code] = it; });
  }
  return ctx._fix;
}
/** เลือกข้อจากคลัง: ข้อที่ไม่ได้ใช้นานที่สุดก่อน ระดับไม่เกิน tier+1 */
function pickFixed(ctx, cats, tier, flags, exceptCode) {
  var fm = fixedMap(ctx), used = ctx.bankUsed || {}, local = ctx._fixLocal = ctx._fixLocal || {};
  var cands = Object.keys(fm).filter(function (c) {
    var it = fm[c];
    return cats.indexOf(it.fixCat) >= 0 && it.level <= tier + 1 && !local[c] && c !== exceptCode;
  });
  if (!cands.length) return null;
  cands = shuffle(cands);
  cands.sort(function (a, b) { return String(used[a] || '').localeCompare(String(used[b] || '')); });
  var code = cands[0];
  local[code] = 1;
  var it = JSON.parse(JSON.stringify(fm[code]));
  it.sig = sigOf(it);
  return flag(it, flags || {});
}

/** สร้างข้อทบทวนจากรายการที่ถึงกำหนด (ตัวเลขใหม่ แนวคิดเดิม) */
function regenReview(rv, ctx, local) {
  var km = /^(GEN|TPL|FIX|PG):(.+)$/.exec(String(rv.key)) || [], kind = km[1], id = km[2], it = null, fl = { review: true, reviewId: rv.id };
  if (kind === 'PG' && pageKind(id)) it = flag(uniqueItem(function () { return oneOfKind(id, rv.tier || 1); }, ctx), fl);
  else if (kind === 'GEN' && STEP_BY_ID[id]) it = flag(uniqueItem(function () { return genStep(id); }, ctx), fl);
  else if (kind === 'TPL' && TPL_BY_ID[id]) it = flag(uniqueItem(function () { return buildTemplate(id, rv.tier || 2); }, ctx), fl);
  else if (kind === 'FIX') {
    var row = fixedMap(ctx)[id];
    it = pickFixed(ctx, [(row && row.fixCat) || rv.fixCat || 'ตรรกะ'], (row && row.level) || rv.level || 2, fl, id) ||
      (row ? flag(JSON.parse(JSON.stringify(row)), fl) : null);
    if (it && !it.sig) it.sig = sigOf(it);
  }
  return it;
}
function takeReviews(ctx, cats, max, local) {
  var out = [];
  (ctx.reviews || []).forEach(function (rv) {
    if (out.length >= max || rv._taken || cats.indexOf(rv.cat) < 0) return;
    var gm = /^GEN:(.+)$/.exec(String(rv.key));
    if (gm && STEP_BY_ID[gm[1]] && ctx.levels && STEP_BY_ID[gm[1]].no > ctx.levels[STEP_BY_ID[gm[1]].skill]) return;  // ยังไม่ถึงขั้นนี้ ไว้ก่อน
    var it = regenReview(rv, ctx, local);
    if (it) { rv._taken = true; out.push(it); }
  });
  return out;
}

function mkSection(id, name, sub, kind, items, extra) {
  var s = { id: id, name: name, sub: sub, kind: kind, items: items };
  for (var k in (extra || {})) s[k] = extra[k];
  return s;
}
function reviewIdsOf(sections) {
  var ids = [];
  sections.forEach(function (s) { s.items.forEach(function (i) { if (i.reviewId) ids.push(i.reviewId); }); });
  return ids;
}

/* ---------------- ชุดประจำวัน ---------------- */
function buildDailySet(ctx) {
  var T3 = ctx.levels.tiers, rot = ctx.rot, topic = rot.topic, round = planRound(ctx.rounds[topic]), setNo = rot.setNo, local = {};
  ctx.topic = topic;
  var b = buildASetItems(topic, round, setNo, ctx);
  var revA = takeReviews(ctx, SKILLS, MAX_REVIEW.A, local);
  var xSec = Math.round(b.xSec * (ctx.targetMult || 1)), ySec = Math.round(xSec * (ctx.yFactor || 1.5)), assess = setNo === ROT_SETS;
  var pages = b.pages.slice();
  if (revA.length) pages.push({ n: revA.length, start: b.items.length, kind: 'review', label: 'ทบทวนข้อที่เคยพลาด', title: 'ทบทวนข้อที่เคยพลาด (ไม่นับในการประเมิน)', lvl: 0, pattern: false, observe: null });
  var A = mkSection('A', 'คิดเลขเร็ว', rotLabel(topic, round, setNo, rot.repeat) + ' · ' + SET_KIND_LABEL[setNo], 'drill', b.items.concat(revA),
    { mainCount: b.items.length, pages: pages, targetSec: xSec, graded: assess, assessment: assess, topic: topic, topicName: TOPIC_NAMES[topic], round: round, setNo: setNo, repeat: !!rot.repeat, weekNo: rot.weekNo, xSec: xSec, ySec: ySec, skill: TOPIC_CAT[topic] });

  // B การสังเกต
  var bSlots = ['seq', 'seq', 'vis', 'odd', 'err', 'FIX'];
  var revB = takeReviews(ctx, ['observe'], MAX_REVIEW.B, local), bItems = [];
  var bNew = bSlots.slice(0, DAILY_B_COUNT - revB.length);
  bNew.forEach(function (g) {
    var it = null;
    if (g === 'FIX') it = pickFixed(ctx, ['สังเกต'], T3.observe, {});
    bItems.push(it || genTpl('observe', g === 'FIX' ? 'seq' : g, T3.observe, ctx, local));
  });
  bItems = bItems.concat(revB);
  var B = mkSection('B', 'การสังเกต', 'แบบรูป หาตัวที่ไม่เข้าพวก หาจุดผิด', 'plain', shuffleKeepReviewLast(bItems), { recSec: 360, graded: false });

  // C คิดวิเคราะห์
  var revC = takeReviews(ctx, ['word', 'analytic'], MAX_REVIEW.C, local), cItems = [];
  var cSlots = [['word', 'w', T3.word], ['word', 'w', T3.word], ['analytic', 'data', T3.analytic], ['analytic', 'logic', T3.analytic], ['analytic', 'count', T3.analytic], 'FIX'];
  cSlots.slice(0, DAILY_C_COUNT - revC.length).forEach(function (sl) {
    var it = null;
    if (sl === 'FIX') it = pickFixed(ctx, ['ตรรกะ', 'โจทย์ปัญหา', 'อ่านข้อมูล'], T3.analytic, {});
    cItems.push(it || (sl === 'FIX' ? genTpl('analytic', 'logic', T3.analytic, ctx, local) : genTpl(sl[0], sl[1], sl[2], ctx, local)));
  });
  cItems = cItems.concat(revC);
  var C = mkSection('C', 'คิดวิเคราะห์', 'โจทย์หลายขั้นตอน ตาราง/แผนภูมิ ปริศนาตรรกะ', 'plain', cItems, { recSec: 540, graded: false });
  var secs = [A, B, C];
  return { mode: 'daily', title: 'ชุดฝึกประจำวัน', sections: secs, reviewIds: reviewIdsOf(secs),
    meta: { topic: topic, topicName: TOPIC_NAMES[topic], round: round, setNo: setNo, repeat: !!rot.repeat, assessment: assess, xSec: xSec, ySec: ySec } };
}
function shuffleKeepReviewLast(arr) {
  var a = arr.filter(function (x) { return !x.review; }), r = arr.filter(function (x) { return x.review; });
  return a.concat(r);
}

/* ---------------- บันไดวัดระดับ ---------------- */
function ladderItems(skill, ctx) {
  var list = skillSteps(skill), out = [], sum = 0;
  list.forEach(function (st, idx) {
    for (var j = 0; j < PLACEMENT_PER_STEP; j++) {
      var it = flag(uniqueItem(function () { return genStep(st.id); }, ctx), { ladder: idx, ladderSkill: skill, main: true, cmp: (j === 0 && idx % 2 === 0) });
      out.push(it); sum += st.spp;
    }
  });
  return { items: out, targetSec: sum };
}
function observeSpecItems(specs, ctx, local, cmp) {
  return specs.map(function (sp) { return genTpl('observe', sp.grp, sp.tier, ctx, local, { cmp: cmp }); });
}
function analyticSpecItems(specs, ctx, local, cmp) {
  return specs.map(function (sp) { return genTpl('analytic', sp.grp, sp.tier, ctx, local, { cmp: cmp }); });
}
function wordSpecItems(tiers, ctx, local, cmp) {
  return tiers.map(function (t) { return genTpl('word', 'w', t, ctx, local, { cmp: cmp }); });
}

/** วันวัดระดับ day = 0..4 (จันทร์..ศุกร์ของสัปดาห์แรก นับตามลำดับวันที่ทำ ไม่ผูกกับวันในสัปดาห์) */
function buildPlacementDay(ctx, day) {
  var local = {}, names = ['บวกลบ', 'คูณ', 'หาร', 'เศษส่วนและทศนิยม', 'โจทย์ปัญหา + สังเกต + วิเคราะห์'], secs;
  if (day <= 3) {
    var skill = SKILLS[day], lad = ladderItems(skill, ctx);
    var A = mkSection('A', 'คิดเลขเร็ว', 'วัดระดับ' + SKILL_NAMES[skill] + ' (จากง่ายไปยาก)', 'drill', lad.items,
      { mainCount: lad.items.length, targetSec: lad.targetSec, graded: false, placement: true, skill: skill });
    var B = mkSection('B', 'การสังเกต', 'วอร์มอัพ', 'plain', observeSpecItems([{ grp: 'seq', tier: 2 }, { grp: 'odd', tier: 2 }, { grp: 'vis', tier: 2 }], ctx, local, false), { recSec: 240, graded: false });
    var C = mkSection('C', 'คิดวิเคราะห์', 'วอร์มอัพ', 'plain', [genTpl('word', 'w', 2, ctx, local, { cmp: false }), genTpl('analytic', 'data', 2, ctx, local, { cmp: false })], { recSec: 300, graded: false });
    secs = [A, B, C];
  } else {
    var aItems = wordSpecItems(BENCH_SPEC.wordTiers, ctx, local, true).concat(wordSpecItems([1, 2, 3, 4], ctx, local, false));
    var bItems = observeSpecItems(BENCH_SPEC.observe, ctx, local, true).concat(observeSpecItems([{ grp: 'seq', tier: 2 }, { grp: 'odd', tier: 3 }], ctx, local, false));
    var cItems = analyticSpecItems(BENCH_SPEC.analytic, ctx, local, true).concat(analyticSpecItems([{ grp: 'data', tier: 1 }, { grp: 'count', tier: 2 }], ctx, local, false));
    secs = [mkSection('A', 'โจทย์ปัญหา', 'วัดระดับโจทย์ปัญหา', 'plain', aItems, { recSec: 600, graded: false }),
      mkSection('B', 'การสังเกต', 'วัดระดับการสังเกต', 'plain', bItems, { recSec: 420, graded: false }),
      mkSection('C', 'คิดวิเคราะห์', 'วัดระดับคิดวิเคราะห์', 'plain', cItems, { recSec: 540, graded: false })];
  }
  return { mode: 'placement', placementDay: day, title: 'แบบวัดระดับวันที่ ' + (day + 1) + ': ' + names[day], sections: secs, reviewIds: [], meta: {} };
}

/** แบบวัดผลรายเดือน: ระดับเดียวกับแบบวัดระดับทุกประการ (ตรึงไว้ ไม่ขึ้นกับระดับปัจจุบัน) */
function buildBenchmark(ctx) {
  var local = {}, items = [], tgt = 0;
  SKILLS.forEach(function (sk) {
    skillSteps(sk).forEach(function (st, idx) {
      if (idx % 2 === 0) { items.push(flag(uniqueItem(function () { return genStep(st.id); }, ctx), { ladder: idx, ladderSkill: sk, main: true, cmp: true })); tgt += st.spp; }
    });
  });
  var A = mkSection('A', 'คิดเลขเร็ว', 'แบบวัดผลรายเดือน (ทุกทักษะ จากง่ายไปยาก)', 'drill', items, { mainCount: items.length, targetSec: tgt, graded: false, benchmark: true });
  var B = mkSection('B', 'การสังเกต', 'แบบวัดผลรายเดือน', 'plain', observeSpecItems(BENCH_SPEC.observe, ctx, local, true), { recSec: 300, graded: false });
  var C = mkSection('C', 'คิดวิเคราะห์', 'โจทย์ปัญหา + คิดวิเคราะห์', 'plain', wordSpecItems(BENCH_SPEC.wordTiers, ctx, local, true).concat(analyticSpecItems(BENCH_SPEC.analytic, ctx, local, true)), { recSec: 600, graded: false });
  return { mode: 'benchmark', title: 'แบบวัดผลประจำเดือน (ระดับเดียวกับแบบวัดระดับ)', sections: [A, B, C], reviewIds: [], meta: {} };
}

// ======================= SelfTest.gs =======================
/**
 * SelfTest.gs — ชุดตรวจตรรกะ (ไม่เรียก API ของ Google)
 * รันใน Apps Script: เลือกฟังก์ชัน runSelfTest ในเมนูแล้วกด ▶ ดูผลที่ "บันทึกการดำเนินการ"
 * รันในเครื่อง: node tests/run-tests.js (ตรวจละเอียดกว่า)
 */
function selfTestAll(ok) {
  var i, bankRows = [];
  // ----- คลังข้อสอบ -----
  var counts = {};
  BANK_SEED_ROWS.forEach(function (r, idx) {
    var row = { code: 'F' + (idx + 1), cat: r[0], level: r[1], q: r[2], ans: r[3], explain: r[4], choices: r[5] || '' };
    var it = fixedToItem(row);
    ok(!!it, 'ข้อในคลังแถว ' + (idx + 1) + ' ไม่สมบูรณ์: ' + r[2]);
    if (it) { ok(checkAnswer(it, it.ans), 'ตัวตรวจไม่รับเฉลยของข้อคลัง ' + (idx + 1)); bankRows.push(row); }
    counts[r[0]] = (counts[r[0]] || 0) + 1;
  });
  ok(BANK_SEED_ROWS.length >= 95 && BANK_SEED_ROWS.length <= 110, 'คลังต้องมีประมาณ 100 ข้อ (มี ' + BANK_SEED_ROWS.length + ')');
  BANK_CATS.forEach(function (c) { ok(counts[c] >= 20, 'หมวด ' + c + ' ต้องมีอย่างน้อย 20 ข้อ'); });

  // ----- วันที่ -----
  ok(ymdDow('2026-11-02') === 1, 'วันที่ 2 พ.ย. 2026 เป็นวันจันทร์');
  ok(isLastFridayOfMonth('2026-11-27') && !isLastFridayOfMonth('2026-11-20') && isLastFridayOfMonth('2026-10-30'), 'ศุกร์สุดท้ายของเดือน');
  ok(isLastDayOfMonth('2026-11-30') && !isLastDayOfMonth('2026-11-29') && isLastDayOfMonth('2028-02-29'), 'วันสิ้นเดือน');
  ok(ymdAdd('2026-12-31', 1) === '2027-01-01' && ymdDiff('2026-11-09', '2026-11-02') === 7, 'บวก/ลบวัน');

  // ----- ตรรกะระดับ -----
  ok(computeStartIndex([2, 2, 2, 2, 2, 2], 1) === 4, 'ผ่านหมด → เริ่มที่ขั้นรองสุดท้าย');
  ok(computeStartIndex([2, 2, 2, 1, 0, 0], 1) === 2, 'ตกสองขั้นติดกันที่ index 3,4 → หยุดที่ 3 ถอยหนึ่งขั้น = 2');
  ok(computeStartIndex([2, 1, 2, 2, 0, 0], 1) === 3, 'พลาดขั้นเดียวไม่ตัดสิน → หยุดที่ index 4 ถอย 1 = 3');
  ok(computeStartIndex([0, 0, 0], 1) === 0, 'ตกตั้งแต่ขั้นแรก → เริ่มขั้น 0');
  var pass = decideDrillPass({ items: [{ revealed: false }, { revealed: false }], totalSec: 100, targetSec: 120 });
  ok(pass.pass, 'ผ่านเมื่อครบและไม่เกินเวลา');
  ok(!decideDrillPass({ items: [{ revealed: true }], totalSec: 10, targetSec: 120 }).pass, 'ดูเฉลย = ไม่ผ่าน');
  ok(!decideDrillPass({ items: [{ revealed: false }], totalSec: 130, targetSec: 120 }).pass, 'เกินเวลา = ไม่ผ่าน');
  ok(adjustTier(2, [90, 90, 90]) === 3 && adjustTier(2, [40, 40, 40]) === 1 && adjustTier(2, [90, 90]) === 2 && adjustTier(4, [95, 95, 95]) === 4, 'ปรับ tier');
  ok(deltaInfo(85, 80, 3, false).cls === 'up' && deltaInfo(80, 85, 3, false).cls === 'down' && deltaInfo(82, 80, 3, false).cls === 'flat', 'delta %');
  ok(deltaInfo(15, 20, 3, true).cls === 'up' && deltaInfo(25, 20, 3, true).cls === 'down' && deltaInfo(20.4, 20, 3, true).cls === 'flat', 'delta เวลา (น้อย = ดี)');

  // ----- ชุดข้อ -----
  function mkCtx(extra) {
    var c = { levels: { addsub: 3, mul: 1, div: 1, fracdec: 1, tiers: { word: 2, observe: 2, analytic: 2 } }, skill: 'addsub',
      usedSigs: {}, recentTpl: {}, bank: bankRows, bankUsed: {}, reviews: [], rot: rotInit(), rounds: rotRounds0() };
    for (var k in (extra || {})) c[k] = extra[k];
    return c;
  }
  setRng(mulberry32(12345));
  var d1 = buildDailySet(mkCtx());
  setRng(mulberry32(12345));
  var d2 = buildDailySet(mkCtx());
  ok(JSON.stringify(d1) === JSON.stringify(d2), 'ชุดข้อวันเดียวกัน (seed เดียวกัน) ต้องออกเหมือนเดิม');
  var A = d1.sections[0], B = d1.sections[1], C = d1.sections[2], plan0 = setPlan('add', 1, 1);
  ok(A.mainCount === 100 && A.items.length === 100 && A.targetSec === setXSec('add', 1, 1) && A.topic === 'add' && A.setNo === 1, 'ส่วน A ชุดที่ 1 สัปดาห์บวก รอบ 1 มี 100 ข้อ (ได้ ' + A.items.length + ')');
  ok(A.items.every(function (x) { return x.topic === 'add' && x.page >= 1 && x.key.indexOf('PG:') === 0; }) && A.pages.length === 10, 'ทุกข้อใน A เป็นหัวข้อบวก แบ่งเป็น 10 หน้า');
  ok(d1.meta.topic === 'add' && d1.meta.round === 1 && d1.meta.setNo === 1 && d1.meta.xSec === A.targetSec && d1.meta.ySec > d1.meta.xSec, 'meta ของชุดมีหัวข้อ/รอบ/ชุด/X/Y');
  ok(B.items.length === DAILY_B_COUNT && C.items.length === DAILY_C_COUNT, 'B/C มีข้อครบ');
  ok(B.items.every(function (x) { return x.cat === 'observe'; }), 'B เป็นหมวดการสังเกต');
  ok(C.items.every(function (x) { return x.cat === 'word' || x.cat === 'analytic'; }), 'C เป็นโจทย์ปัญหา/คิดวิเคราะห์');
  ok(C.items.some(function (x) { return x.key.indexOf('FIX:') === 0; }) && B.items.some(function (x) { return x.key.indexOf('FIX:') === 0; }), 'มีข้อจากคลังแทรกใน B และ C');
  var sigs = {}, dup = 0;
  d1.sections.forEach(function (s) { s.items.forEach(function (x) { if (sigs[x.sig]) dup++; sigs[x.sig] = 1; }); });
  ok(dup === 0, 'ในชุดเดียวกันต้องไม่มีโจทย์ซ้ำ (ซ้ำ ' + dup + ')');

  // ทบทวนแบบเว้นช่วง: ข้อที่ผิดกลับมาด้วยตัวเลขใหม่ แนวคิดเดิม
  setRng(mulberry32(7));
  var rv = [{ id: 'r1', key: 'PG:add.pairs10', cat: 'addsub', tier: 1 }, { id: 'r0', key: 'GEN:AS07', cat: 'addsub' }, { id: 'r2', key: 'TPL:W05', cat: 'word', tier: 2 }, { id: 'r3', key: 'TPL:O13', cat: 'observe', tier: 2 }, { id: 'r4', key: 'FIX:F40', cat: 'analytic' }];
  var d3 = buildDailySet(mkCtx({ reviews: rv }));
  var allItems = [].concat.apply([], d3.sections.map(function (s) { return s.items; }));
  var revItems = allItems.filter(function (x) { return x.review; });
  ok(revItems.length === 4, 'ข้อทบทวนต้องเข้ามาครบ 4 ข้อ (ได้ ' + revItems.length + ')');
  ok(revItems.some(function (x) { return x.key === 'PG:add.pairs10'; }) && revItems.some(function (x) { return x.key === 'TPL:W05'; }) && revItems.some(function (x) { return x.key === 'TPL:O13'; }), 'ทบทวนแนวคิดเดิม');
  ok(d3.reviewIds.length === 4 && d3.reviewIds.indexOf('r0') < 0, 'รายการ reviewIds ต้องครบ และข้อทบทวนของขั้นที่ยังไม่ถึง (AS07 ขณะที่ระดับ = 3) ต้องรอไว้ก่อน');
  ok(d3.sections[1].items.length === DAILY_B_COUNT && d3.sections[2].items.length === DAILY_C_COUNT, 'ข้อทบทวนต้องไม่ทำให้จำนวนข้อ B/C เกิน');

  // วัดระดับ
  var totalLad = 0;
  for (var day = 0; day < 5; day++) {
    setRng(mulberry32(100 + day));
    var p = buildPlacementDay(mkCtx(), day);
    ok(p.sections.length === 3, 'วันวัดระดับ ' + day + ' มี 3 ส่วน');
    if (day <= 3) {
      var sk = SKILLS[day], steps = skillSteps(sk).length, ai = p.sections[0].items;
      ok(ai.length === steps * PLACEMENT_PER_STEP, sk + ' บันไดต้องมี ' + steps * PLACEMENT_PER_STEP + ' ข้อ (ได้ ' + ai.length + ')');
      ok(ai.length <= 30, 'บันไดไม่เกิน 30 ข้อ');
      var ordered = ai.every(function (x, j) { return j === 0 || x.ladder >= ai[j - 1].ladder; });
      ok(ordered, 'บันไดเรียงจากง่ายไปยาก');
      totalLad += ai.filter(function (x) { return x.cmp; }).length;
    } else {
      var cm = [].concat.apply([], p.sections.map(function (s) { return s.items.filter(function (x) { return x.cmp; }); }));
      ok(cm.filter(function (x) { return x.cat === 'word'; }).length === 4 && cm.filter(function (x) { return x.cat === 'observe'; }).length === 5 && cm.filter(function (x) { return x.cat === 'analytic'; }).length === 4, 'วันศุกร์: ข้อวัดผล word 4 / observe 5 / analytic 4');
    }
  }
  ok(totalLad === 26, 'ข้อวัดผลคิดเลขในสัปดาห์วัดระดับต้องมี 26 ข้อ (ได้ ' + totalLad + ')');

  // แบบวัดผลรายเดือน = โครงเดียวกับวัดระดับ (ตรึงไว้)
  setRng(mulberry32(555));
  var bm = buildBenchmark(mkCtx({ levels: { addsub: 9, mul: 9, div: 9, fracdec: 9, tiers: { word: 4, observe: 4, analytic: 4 } } }));
  var bmAll = [].concat.apply([], bm.sections.map(function (s) { return s.items; }));
  ok(bmAll.every(function (x) { return x.cmp; }), 'ทุกข้อในแบบวัดผลต้องเป็นข้อเปรียบเทียบ');
  var bmCalc = bmAll.filter(function (x) { return SKILLS.indexOf(x.cat) >= 0; });
  ok(bmCalc.length === 26, 'แบบวัดผล: คิดเลข 26 ข้อ (ได้ ' + bmCalc.length + ')');
  var byCat = {}; bmAll.forEach(function (x) { byCat[x.cat] = (byCat[x.cat] || 0) + 1; });
  ok(byCat.word === 4 && byCat.observe === 5 && byCat.analytic === 4, 'แบบวัดผล: word 4 / observe 5 / analytic 4 → ' + JSON.stringify(byCat));
  var calcSteps = {}; bmCalc.forEach(function (x) { calcSteps[x.tag] = 1; });
  var plSteps = {};
  for (var d = 0; d < 4; d++) { setRng(mulberry32(100 + d)); buildPlacementDay(mkCtx(), d).sections[0].items.forEach(function (x) { if (x.cmp) plSteps[x.tag] = 1; }); }
  ok(Object.keys(calcSteps).sort().join() === Object.keys(plSteps).sort().join(), 'ขั้นที่ใช้วัดเปรียบเทียบต้องเป็นชุดเดียวกับตอนวัดระดับ');
  var wT = bm.sections[2].items.filter(function (x) { return x.cat === 'word'; }).map(function (x) { return x.tier; }).join();
  ok(wT === '1,2,3,4', 'โจทย์ปัญหา tier เป็น 1–4 เหมือนวัดระดับ');
  ok(bm.sections[0].targetSec > 0, 'แบบวัดผลมีเวลาอ้างอิง');
}

// ======================= DashLogic.gs =======================
/**
 * DashLogic.gs — คำนวณข้อมูลสำหรับ Dashboard ผู้ปกครอง (ไม่เรียก API ของ Google ทดสอบด้วย Node ได้)
 * รับแถวดิบจากชีต (ผลรายวัน / ผลรายข้อ / ความก้าวหน้า) แล้วคืนข้อมูลพร้อมแสดงผล
 */

function dashRound1(x) { return Math.round(x * 10) / 10; }
function dashPct(right, total) { return Number(total) > 0 ? dashRound1(Number(right) / Number(total) * 100) : null; }
/** สีตามเกณฑ์: green / yellow / red / none */
function dashColor(pct, green, yellow) {
  if (pct == null || pct === '') return 'none';
  return pct >= green ? 'green' : pct >= yellow ? 'yellow' : 'red';
}

/** แถวชีต "ผลรายวัน" → รายการที่ใช้ง่าย (เรียงตามวันที่) */
function dashDailyList(rows) {
  function sec(r, o) {
    return { right: Number(r[o]) || 0, total: Number(r[o + 1]) || 0, firstSec: Number(r[o + 2]) || 0, totalSec: Number(r[o + 3]) || 0,
      target: Number(r[o + 4]) || 0, rounds: Number(r[o + 5]) || 0, errors: String(r[o + 6] || '') };
  }
  return rows.filter(function (r) { return r[0]; }).map(function (r) {
    var A = sec(r, 4), B = sec(r, 12), C = sec(r, 19), daily = r[1] === 'ประจำวัน';
    var pages = String(r[33] || '').split(',').filter(function (x) { return x !== ''; }).map(Number);
    return { date: String(r[0]), mode: String(r[1]), skillName: String(r[2] || ''), stepLabel: String(r[3] || ''), A: A, B: B, C: C, pass: String(r[11] || ''),
      slot: Number(r[28]) === 2 ? 2 : 1, topic: String(r[29] || ''), round: Number(r[30]) || 0, setNo: Number(r[31]) || 0, outcome: String(r[32] || ''), pagesSec: pages,
      x: Number(r[34]) || 0, y: Number(r[35]) || 0, repeat: String(r[36] || '') === 'ซ้ำ',
      totalMin: Number(r[26]) || 0, note: String(r[27] || ''), aPct: dashPct(A.right, A.total), bPct: dashPct(B.right, B.total), cPct: dashPct(C.right, C.total),
      ratio: daily && A.target ? dashRound1(A.totalSec / A.target * 100) : null };
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.slot - b.slot; });
}

/** จำนวนวันที่ทำติดต่อกัน นับเฉพาะวันที่ตั้งไว้ว่าฝึก (วันพักข้ามได้) ถ้าวันนี้ยังไม่ทำ ไม่ถือว่าขาด */
function dashStreak(doneSet, today, practiceDays) {
  var d = doneSet[today] ? today : ymdAdd(today, -1), n = 0;
  for (var i = 0; i < 400; i++) {
    if (practiceDays.indexOf(ymdDow(d)) < 0 && !doneSet[d]) { d = ymdAdd(d, -1); continue; }
    if (doneSet[d]) { n++; d = ymdAdd(d, -1); } else break;
  }
  return n;
}

/** จำนวนวันฝึกที่พลาดติดกัน นับย้อนจากเมื่อวาน (ไม่เกินวันเริ่ม) */
function dashMissed(doneSet, startDate, today, practiceDays) {
  var d = ymdAdd(today, -1), n = 0;
  while (startDate && d >= startDate) {
    if (practiceDays.indexOf(ymdDow(d)) >= 0) { if (doneSet[d]) break; n++; }
    d = ymdAdd(d, -1);
  }
  return n;
}

/**
 * ปฏิทิน weeks สัปดาห์ (อาทิตย์–เสาร์) จบที่สัปดาห์ของวันนี้
 * status: pass / fail / done / miss / rest / today / future / before
 */
function dashCalendar(passMap, today, startDate, practiceDays, weeks) {
  weeks = weeks || 6;
  var end = ymdAdd(today, 6 - ymdDow(today)), begin = ymdAdd(end, -(weeks * 7 - 1)), out = [];
  for (var i = 0; i < weeks * 7; i++) {
    var d = ymdAdd(begin, i), p = passMap[d], st;
    if (p !== undefined) st = String(p).indexOf('ผ่าน') === 0 ? 'pass' : p === 'ไม่ผ่าน' ? 'fail' : 'done';
    else if (d > today) st = 'future';
    else if (startDate && d < startDate) st = 'before';
    else if (d === today) st = 'today';
    else if (practiceDays.indexOf(ymdDow(d)) < 0) st = 'rest';
    else st = 'miss';
    out.push({ date: d, dow: ymdDow(d), status: st });
  }
  return out;
}

/** ชื่อที่อ่านเข้าใจของคีย์ข้อ (GEN:AS03 / TPL:W01 / FIX:F012) */
function dashTagLabel(key) {
  var p = String(key).split(':'), kind = p[0], id = p[1];
  if (kind === 'GEN' && typeof STEP_BY_ID !== 'undefined' && STEP_BY_ID[id]) { var s = STEP_BY_ID[id]; return SKILL_NAMES[s.skill] + ' ขั้น ' + s.no + ' · ' + s.name; }
  if (kind === 'TPL' && typeof TPL_BY_ID !== 'undefined' && TPL_BY_ID[id]) return CAT_NAMES[TPL_BY_ID[id].cat] + ' · แบบ ' + id;
  if (kind === 'FIX') return 'ข้อจากคลังข้อสอบ ' + id;
  if (kind === 'PG' && typeof PAGE_KINDS !== 'undefined' && PAGE_KINDS[id]) return TOPIC_NAMES[PAGE_KINDS[id].topic] + ' · ' + PAGE_KINDS[id].label;
  return String(key);
}

/** สถิติข้อผิดพลาดจากแถว "ผลรายข้อ" ตั้งแต่วันที่ fromYmd (เฉพาะข้อที่ผิดรอบแรก) */
function dashErrorStats(itemRows, fromYmd) {
  var types = {}, cats = {}, tags = {}, wrongTotal = 0, total = 0;
  itemRows.forEach(function (r) {
    if (String(r[0]) < fromYmd) return;
    var cat = String(r[3]), key = String(r[4]), ok = Number(r[7]) === 1;
    total++;
    var c = cats[cat] = cats[cat] || { cat: cat, total: 0, wrong: 0 }; c.total++;
    var t = tags[key] = tags[key] || { key: key, total: 0, wrong: 0, sample: '' }; t.total++;
    if (!ok) {
      wrongTotal++; c.wrong++; t.wrong++; if (!t.sample) t.sample = String(r[16] || '');
      var e = String(r[11] || 'ตอบผิด'); types[e] = (types[e] || 0) + 1;
    }
  });
  var typeList = Object.keys(types).map(function (k) { return { type: k, n: types[k] }; }).sort(function (a, b) { return b.n - a.n; });
  var catList = Object.keys(cats).map(function (k) { var c = cats[k]; return { cat: c.cat, name: CAT_NAMES[c.cat] || c.cat, total: c.total, wrong: c.wrong, pctWrong: dashPct(c.wrong, c.total) }; })
    .sort(function (a, b) { return (b.pctWrong || 0) - (a.pctWrong || 0); });
  var tagList = Object.keys(tags).map(function (k) { return tags[k]; }).filter(function (t) { return t.wrong >= 2 && t.total >= 3; })
    .sort(function (a, b) { return (b.wrong / b.total) - (a.wrong / a.total) || b.wrong - a.wrong; }).slice(0, 8)
    .map(function (t) { return { key: t.key, label: dashTagLabel(t.key), wrong: t.wrong, total: t.total, pctWrong: dashPct(t.wrong, t.total), sample: t.sample }; });
  return { total: total, wrong: wrongTotal, types: typeList, cats: catList, tags: tagList };
}

/** สถานะของแต่ละหัวข้อจากแท็บ "รอบหัวข้อ": รอบปัจจุบัน, หัวข้อ/ชุดที่กำลังทำ, ผลสัปดาห์ล่าสุด */
function dashTopicProgress(rs) {
  return TOPICS.map(function (t) {
    var cur = rs.rot.topic === t, h = rs.hist[t] || { weeks: 0, last: '', date: '' };
    return { topic: t, name: TOPIC_NAMES[t], round: rs.rounds[t], current: cur, setNo: cur ? rs.rot.setNo : 0, repeat: cur ? !!rs.rot.repeat : false, weeks: h.weeks, last: h.last, lastDate: h.date,
      pct: cur ? Math.round((rs.rot.setNo - 1) / ROT_SETS * 100) : 0 };
  });
}
/** แนวโน้มเวลาของชุดประเมิน (ชุดที่ 6) ต่อหัวข้อ เทียบรอบ 1 กับรอบ 2: [{topic,name,points:[{round,date,totalSec,x,ratio,outcome}]}] */
function dashTopicTrend(list) {
  var by = {};
  list.forEach(function (d) {
    if (d.mode !== 'ประจำวัน' || d.setNo !== ROT_SETS || !d.topic) return;
    (by[d.topic] = by[d.topic] || []).push({ round: d.round, date: d.date, totalSec: d.A.totalSec, x: d.x, ratio: d.x ? dashRound1(d.A.totalSec / d.x * 100) : null, outcome: d.pass, repeat: d.repeat });
  });
  return TOPICS.map(function (t) { return { topic: t, name: TOPIC_NAMES[t], points: by[TOPIC_NAMES[t]] || [] }; });
}

/** ชุดข้อมูลกราฟจากแท็บ "ความก้าวหน้า": [วันที่, A%, B%, C%, เวลา÷เป้า, ขั้น×4] */
function dashSeries(progressRows) {
  var s = { dates: [], a: [], b: [], c: [], ratio: [], rounds: {} };
  TOPICS.forEach(function (t) { s.rounds[t] = []; });
  function num(v) { return v === '' || v == null ? null : Number(v); }
  progressRows.filter(function (r) { return r[0]; }).forEach(function (r) {
    s.dates.push(String(r[0])); s.a.push(num(r[1])); s.b.push(num(r[2])); s.c.push(num(r[3])); s.ratio.push(num(r[4]));
    TOPICS.forEach(function (t, i) { s.rounds[t].push(num(r[5 + i])); });
  });
  return s;
}

/** ข้อควรสนใจสำหรับผู้ปกครอง: [{level:'warn'|'info'|'good', text}] */
function dashAlerts(x) {
  var out = [], i;
  if (!x.startDate) out.push({ level: 'warn', text: 'ยังไม่ได้ตั้งวันเริ่ม (START_DATE) ในแท็บตั้งค่า' });
  else if (x.today < x.startDate) out.push({ level: 'info', text: 'ยังไม่ถึงวันเริ่ม (' + x.startDate + ')' });
  if (x.placement && !x.placement.done && x.startDate && x.today >= x.startDate) out.push({ level: 'info', text: 'อยู่ระหว่างแบบวัดระดับ ทำแล้ว ' + x.placement.days + ' จาก ' + x.placement.of + ' วัน' });
  if (x.rot) out.push({ level: 'info', text: 'ตอนนี้: ' + rotLabel(x.rot.topic, x.rot.round, x.rot.setNo, x.rot.repeat) });
  if (x.rot && x.rot.repeat) out.push({ level: 'warn', text: 'สัปดาห์' + TOPIC_NAMES[x.rot.topic] + 'เป็นการทำซ้ำ (สัปดาห์ก่อนยังไม่ผ่านการประเมิน) ถ้าชุดที่ 6 ไม่ผ่านอีก ระบบจะไปหัวข้อถัดไป ควรนั่งดูวิธีคิดกับลูก' });
  var lastAssess = (x.list || []).filter(function (d) { return d.mode === 'ประจำวัน' && d.setNo === ROT_SETS; }).slice(-1)[0];
  if (lastAssess && lastAssess.pass === 'ผ่าน(ช้า)') out.push({ level: 'info', text: '⚑ สัปดาห์' + lastAssess.topic + 'ล่าสุดผ่านแต่ช้ากว่าเป้า (ใช้ ' + fmtSec(lastAssess.A.totalSec) + ' เป้า ' + fmtSec(lastAssess.x) + ')' });
  if (lastAssess && lastAssess.pass === 'ไม่ผ่าน') out.push({ level: 'warn', text: 'สัปดาห์' + lastAssess.topic + 'ล่าสุดยังไม่ผ่านการประเมิน (' + (lastAssess.repeat ? 'ซ้ำแล้ว ระบบไปต่อหัวข้อถัดไป' : 'ต้องทำซ้ำ') + ')' });
  if (x.missed >= 2) out.push({ level: 'warn', text: 'ไม่ได้ฝึกมา ' + x.missed + ' วันฝึกติดต่อกัน' });
  var recent = (x.list || []).filter(function (d) { return d.mode === 'ประจำวัน'; }).slice(-3);
  if (recent.length === 3) {
    var avgA = recent.reduce(function (s, d) { return s + (d.aPct || 0); }, 0) / 3;
    var slow = recent.every(function (d) { return d.ratio != null && d.ratio > 150; });
    if (avgA < x.yellow) out.push({ level: 'warn', text: 'ความแม่นยำส่วน A 3 ครั้งล่าสุดเฉลี่ย ' + dashRound1(avgA) + '% (ต่ำกว่าเกณฑ์ ' + x.yellow + '%)' });
    if (slow) out.push({ level: 'warn', text: 'ส่วน A ใช้เวลาเกิน 150% ของเป้าหมายติดกัน 3 ครั้ง ลองปรับ TARGET_MULTIPLIER หรือให้ลูกฝึกขั้นก่อนหน้า' });
  }
  if ((x.dueReviews || 0) >= 8) out.push({ level: 'info', text: 'มีข้อทบทวนครบกำหนด ' + x.dueReviews + ' ข้อ (ระบบทยอยใส่ในชุดวันละไม่เกิน 8 ข้อ)' });
  (x.lowBank || []).forEach(function (b) { out.push({ level: 'warn', text: 'คลังข้อสอบหมวด "' + b.cat + '" เหลือข้อสด ' + b.fresh + ' ข้อ ควรเพิ่มข้อใหม่' }); });
  if (x.streak >= 5) out.push({ level: 'good', text: 'ทำติดต่อกัน ' + x.streak + ' วันแล้ว เยี่ยมมาก!' });
  if (x.todayDone) out.push({ level: 'good', text: 'วันนี้ลูกทำเสร็จแล้ว' + (String(x.todayPass || '').indexOf('ผ่าน') === 0 ? ' และผ่านการประเมินสัปดาห์' : '') });
  return out;
}

/** ข้อมูลเรดาร์: ผลวัดระดับเทียบล่าสุด (จาก computeReportModel) */
function dashRadar(model) {
  var last = model.periods.length - 1;
  return model.cats.map(function (c) { return { cat: c.cat, name: c.name, base: c.pcts[0] == null ? null : c.pcts[0], cur: last >= 0 && c.pcts[last] != null ? c.pcts[last] : null }; });
}

/** สรุปรายเดือนปัจจุบัน */
function dashMonthStats(list, month) {
  var m = list.filter(function (d) { return d.date.slice(0, 7) === month; });
  var daily = m.filter(function (d) { return d.mode === 'ประจำวัน'; });
  var assess = daily.filter(function (d) { return d.pass && d.pass !== '-'; });
  var passN = assess.filter(function (d) { return d.pass.indexOf('ผ่าน') === 0; }).length;
  var avgA = daily.length ? dashRound1(daily.reduce(function (s, d) { return s + (d.aPct || 0); }, 0) / daily.length) : null;
  var uniq = {}; m.forEach(function (d) { uniq[d.date] = 1; });
  return { days: Object.keys(uniq).length, sets: m.length, dailyCount: daily.length, assessCount: assess.length, passN: passN, avgA: avgA };
}

// ======================= Store.gs =======================
/**
 * Store.gs — อ่าน/เขียน Google Sheet, ตั้งค่า, สถานะระบบ
 * (ใช้ SpreadsheetApp / PropertiesService จึงรันได้เฉพาะใน Apps Script)
 */
var SH = {
  settings: 'ตั้งค่า', bank: 'คลังข้อสอบ', daily: 'ผลรายวัน', items: 'ผลรายข้อ', levels: 'ระดับปัจจุบัน',
  review: 'ทบทวน', rotation: 'รอบหัวข้อ', progress: 'ความก้าวหน้า', report: 'รายงานรายเดือน', bench: 'ข้อมูลวัดผล'
};

/** [คีย์, ค่าเริ่มต้น, คำอธิบาย] — ผู้ปกครองแก้ในแท็บ "ตั้งค่า" ได้เลย */
var DEFAULT_SETTINGS = [
  ['CHILD_NAME', 'น้อง', 'ชื่อเล่นลูก (ใช้ทักทายในหน้าจอและอีเมล)'],
  ['DAD_EMAIL', '', 'อีเมลคุณพ่อ (เว้นว่าง = ใช้อีเมลเจ้าของสคริปต์)'],
  ['MOM_EMAIL', '', 'อีเมลคุณแม่ — ใส่ภายหลังได้ ถ้าเว้นว่างจะไม่ส่ง'],
  ['START_DATE', '', 'วันเริ่มแบบวัดระดับสัปดาห์แรก รูปแบบ ปปปป-ดด-วว (ค.ศ.) เช่น 2026-11-09 — ถ้าเว้นว่างระบบจะตั้งเป็นวันที่รัน setup'],
  ['PRACTICE_DAYS', '1,2,3,4,5,6', 'วันที่ฝึก (0=อาทิตย์ 1=จันทร์ ... 6=เสาร์) ค่าเริ่มต้น จันทร์–เสาร์'],
  ['MAX_REPEATS', 3, 'ถ้าทำขั้นเดิมไม่ผ่านติดกันกี่ครั้ง ให้สลับไปฝึกทักษะอื่นก่อน (และแจ้งผู้ปกครอง)'],
  ['PLACEMENT_BACKOFF', 1, 'หลังวัดระดับ ถอยกลับกี่ขั้นเพื่อเริ่มจากระดับที่คล่อง'],
  ['DELTA_THRESHOLD', 3, 'เปลี่ยนแปลงไม่เกินกี่ % ถือว่า "เท่าเดิม" (สีเทา) ในรายงานรายเดือน'],
  ['ASSESS_Y_FACTOR', 1.5, 'ชุดที่ 6 (ประเมินผลประจำสัปดาห์): เวลาสูงสุด Y = เวลาเป้าหมาย X × ค่านี้ — ใช้เวลา ≤ X = ผ่าน, ระหว่าง X–Y = ผ่านแต่ติดธงในอีเมล, ≥ Y หรือไม่ถึง 100% หลังแก้ = ทำหัวข้อเดิมซ้ำ 1 สัปดาห์'],
  ['TARGET_MULTIPLIER', 1, 'ปรับเวลาเป้าหมายของส่วน A ในชุดประจำวัน: 1 = ตามที่ตั้งไว้, 1.2 = ให้เวลามากขึ้น 20%, 0.9 = เข้มขึ้น 10% (ไม่มีผลกับแบบวัดระดับ/แบบวัดผล)'],
  ['PARENT_PIN', '', 'รหัสเข้า Dashboard ผู้ปกครอง (ตัวเลขหรือตัวอักษรก็ได้ ตั้งเอง) — ถ้าเว้นว่าง Dashboard จะเข้าไม่ได้ ลิงก์: ลิงก์เว็บแอป + ?page=dashboard'],
  ['DASH_GREEN', 85, 'Dashboard: ตั้งแต่กี่ % ถือว่า 🟢 ดี'],
  ['DASH_YELLOW', 60, 'Dashboard: ตั้งแต่กี่ % ถือว่า 🟡 พอใช้ (ต่ำกว่านี้ = 🔴)'],
  ['A_MAX_SEC', 1200, 'เวลาสูงสุดของรอบแรกส่วน A (วินาที) เกินแล้วระบบจะปิดรอบแรกอัตโนมัติ'],
  ['LOW_BANK_THRESHOLD', 8, 'คลังข้อสอบหมวดไหนมีข้อที่ยังไม่ได้ใช้ใน 45 วันเหลือน้อยกว่านี้ จะเตือนทางอีเมลรายเดือน'],
  ['BANK_RECENT_DAYS', 45, 'ข้อในคลังที่เคยออกไปแล้ว จะไม่ออกซ้ำภายในกี่วัน']
];
var _ss = null, _cfg = null;

function props() { return PropertiesService.getScriptProperties(); }
function ss() {
  if (!_ss) {
    var id = props().getProperty('SS_ID');
    _ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  }
  return _ss;
}
function getSheet(name) { return ss().getSheetByName(name) || ss().insertSheet(name); }
function tz() { return Session.getScriptTimeZone() || 'Asia/Bangkok'; }
function todayYmd() { return Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd'); }
function cellToYmd(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz(), 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}

function getSettings() {
  if (_cfg) return _cfg;
  var cfg = {};
  DEFAULT_SETTINGS.forEach(function (d) { cfg[d[0]] = d[1]; });
  var sh = ss().getSheetByName(SH.settings);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0]).trim();
      if (k && r[1] !== '' && r[1] != null) cfg[k] = r[1];
    });
  }
  cfg.START_DATE = cellToYmd(cfg.START_DATE);
  ['ASSESS_Y_FACTOR', 'DASH_GREEN', 'DASH_YELLOW', 'TARGET_MULTIPLIER', 'MAX_REPEATS', 'PLACEMENT_BACKOFF', 'DELTA_THRESHOLD', 'A_MAX_SEC', 'LOW_BANK_THRESHOLD', 'BANK_RECENT_DAYS'].forEach(function (k) { cfg[k] = Number(cfg[k]); });
  if (!(cfg.TARGET_MULTIPLIER > 0)) cfg.TARGET_MULTIPLIER = 1;
  if (!(cfg.ASSESS_Y_FACTOR > 1)) cfg.ASSESS_Y_FACTOR = 1.5;
  if (!(cfg.DASH_GREEN > 0)) cfg.DASH_GREEN = 85;
  if (!(cfg.DASH_YELLOW > 0)) cfg.DASH_YELLOW = 60;
  cfg.PARENT_PIN = cfg.PARENT_PIN == null ? '' : String(cfg.PARENT_PIN);
  cfg.practiceDays = String(cfg.PRACTICE_DAYS).split(/[,\s]+/).filter(function (x) { return x !== ''; }).map(Number);
  _cfg = cfg;
  return cfg;
}
function setSetting(key, value) {
  var sh = getSheet(SH.settings), last = sh.getLastRow();
  for (var r = 2; r <= last; r++) if (String(sh.getRange(r, 1).getValue()).trim() === key) { sh.getRange(r, 2).setValue(value); _cfg = null; return; }
  sh.appendRow([key, value, '']); _cfg = null;
}
function recipients() {
  var cfg = getSettings(), dad = String(cfg.DAD_EMAIL || '').trim() || Session.getEffectiveUser().getEmail(), mom = String(cfg.MOM_EMAIL || '').trim();
  return [dad, mom].filter(function (e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }).filter(function (e, i, a) { return a.indexOf(e) === i; });
}

/* ---------------- สถานะ ---------------- */
function getState() {
  var raw = props().getProperty('STATE');
  var st = raw ? JSON.parse(raw) : {};
  st.placementDays = st.placementDays || [];
  st.placementDone = !!st.placementDone;
  st.nextSkill = st.nextSkill || 0;
  st.benchmarks = st.benchmarks || [];
  return st;
}
/** ชื่อที่ใช้เรียกลูกในหน้าจอและอีเมล: "น้อง" + ชื่อเล่นที่ลูกพิมพ์เอง (ถ้ายังไม่มี ใช้ค่า CHILD_NAME ในแท็บตั้งค่า) */
function childLabel() {
  var st = getState();
  return st.childName ? 'น้อง' + st.childName : getSettings().CHILD_NAME;
}
function cleanChildName(v) { return String(v == null ? '' : v).replace(/[<>&"']/g, '').replace(/^\s*น้อง\s*/, '').trim().slice(0, 20); }
function setState(st) { props().setProperty('STATE', JSON.stringify(st)); }

/* ---------------- ระดับปัจจุบัน ---------------- */
var LEVEL_HEAD = ['ทักษะ (บันไดวัดระดับ)', 'ขั้นล่าสุดจากวัดระดับ (อ้างอิง)', 'ชื่อขั้น', 'เวลาเป้าหมาย (วินาที)', 'ขั้นเริ่มต้นจากวัดระดับ', 'ทำไม่ผ่านติดกัน', 'ทำล่าสุด', 'หมายเหตุ'];
var TIER_ROWS = [['โจทย์ปัญหา (ระดับ 1-4)', 'word'], ['การสังเกต (ระดับ 1-4)', 'observe'], ['คิดวิเคราะห์ (ระดับ 1-4)', 'analytic']];

function readLevels() {
  var sh = getSheet(SH.levels), L = { tiers: {}, fails: {}, last: {} };
  var v = sh.getRange(2, 1, 8, 8).getValues();
  SKILLS.forEach(function (sk, i) {
    L[sk] = Math.max(1, Math.min(skillSteps(sk).length, Number(v[i][1]) || 1));
    L.fails[sk] = Number(v[i][5]) || 0;
    L.last[sk] = cellToYmd(v[i][6]);
  });
  TIER_ROWS.forEach(function (t, i) { L.tiers[t[1]] = Math.max(1, Math.min(4, Number(v[4 + i][1]) || 2)); });
  return L;
}
function writeLevels(L, startSteps) {
  var sh = getSheet(SH.levels);
  SKILLS.forEach(function (sk, i) {
    var st = stepOf(sk, L[sk]), r = 2 + i;
    sh.getRange(r, 2).setValue(L[sk]);
    sh.getRange(r, 3).setValue(st.name);
    sh.getRange(r, 4).setValue(st.n * st.spp);
    if (startSteps && startSteps[sk]) sh.getRange(r, 5).setValue(startSteps[sk]);
    sh.getRange(r, 6).setValue(L.fails[sk] || 0);
    if (L.last && L.last[sk]) sh.getRange(r, 7).setValue(L.last[sk]);
  });
  TIER_ROWS.forEach(function (t, i) { sh.getRange(6 + i, 2).setValue(L.tiers[t[1]]); });
}

/* ---------------- คลังข้อสอบ ---------------- */
function ensureBank() {
  var sh = getSheet(SH.bank);
  // ต้องเป็นข้อความล้วน ไม่งั้น Google Sheets จะแปลง 3/5 เป็นวันที่ และ 2 1/3 เป็นทศนิยม (แถวที่ผู้ปกครองเพิ่มทีหลังจะรับรูปแบบนี้ต่อไปเอง)
  sh.getRange('C:F').setNumberFormat('@');
  sh.getRange('H:H').setNumberFormat('@');
  if (sh.getLastRow() < 2) {
    sh.getRange(1, 1, 1, BANK_HEADERS.length).setValues([BANK_HEADERS]);
    var rows = BANK_SEED_ROWS.map(function (r, i) { return [r[0], r[1], r[2], r[3], r[4], r[5] || '', 'F' + ('00' + (i + 1)).slice(-3), '']; });
    sh.getRange(2, 1, rows.length, BANK_HEADERS.length).setValues(rows);
  }
  return sh;
}
/** อ่านคลัง + เติมรหัสให้แถวที่ผู้ปกครองเพิ่มใหม่ */
function readBank() {
  var sh = ensureBank(), last = sh.getLastRow();
  if (last < 2) return [];
  var rng = sh.getRange(2, 1, last - 1, 8), v = rng.getValues(), out = [], dirty = false, maxN = 0;
  v.forEach(function (r) { var m = /^F(\d+)$/.exec(String(r[6])); if (m) maxN = Math.max(maxN, +m[1]); });
  v.forEach(function (r) {
    if (!String(r[2]).trim() || String(r[3]).trim() === '') return;
    if (!String(r[6]).trim()) { r[6] = 'F' + ('00' + (++maxN)).slice(-3); dirty = true; }
    out.push({ code: String(r[6]).trim(), cat: String(r[0]).trim(), level: Number(r[1]) || 1, q: String(r[2]), ans: r[3], explain: r[4], choices: r[5] });
  });
  if (dirty) rng.setValues(v);
  return out;
}
function touchBankUsed(codes, date) {
  if (!codes.length) return;
  var sh = getSheet(SH.bank), last = sh.getLastRow();
  if (last < 2) return;
  var rng = sh.getRange(2, 7, last - 1, 2), v = rng.getValues(), dirty = false;
  v.forEach(function (r) { if (codes.indexOf(String(r[0]).trim()) >= 0) { r[1] = date; dirty = true; } });
  if (dirty) rng.setValues(v);
}

/* ---------------- ประวัติข้อ (กันโจทย์ซ้ำ + สถิติ) ---------------- */
var ITEM_HEAD = ['วันที่', 'ประเภทชุด', 'ส่วน', 'หมวด', 'คีย์', 'ขั้น/แม่แบบ', 'ลายเซ็น', 'ถูกรอบแรก', 'จำนวนครั้งที่ตอบ', 'ต้องดูเฉลย', 'เวลา (วิ)', 'ประเภทข้อผิดพลาด', 'ข้อทบทวน', 'ข้อวัดผล', 'ระดับ', 'ลำดับบันได', 'โจทย์ (ย่อ)', 'หน้า'];
function readItemRows(maxRows) {
  var sh = getSheet(SH.items), last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - maxRows + 1);
  return sh.getRange(start, 1, last - start + 1, ITEM_HEAD.length).getValues().map(function (r) {
    r[0] = cellToYmd(r[0]); return r;
  });
}
/** อ่านแถวผลรายข้อตั้งแต่วันที่ cutoff (yyyy-MM-dd) เป็นต้นไป — อ่านเฉพาะคอลัมน์วันที่ก่อนเพื่อหาจุดเริ่ม (ชุดละ ~110 แถว/วัน จึงไม่อ่านตามจำนวนแถวตายตัว) */
function readItemRowsSince(cutoff) {
  var sh = getSheet(SH.items), last = sh.getLastRow();
  if (last < 2) return [];
  var dates = sh.getRange(2, 1, last - 1, 1).getValues(), start = 2;
  for (var i = dates.length - 1; i >= 0; i--) { if (cellToYmd(dates[i][0]) < cutoff) { start = i + 3; break; } }
  if (start > last) return [];
  return sh.getRange(start, 1, last - start + 1, ITEM_HEAD.length).getValues().map(function (r) { r[0] = cellToYmd(r[0]); return r; });
}
function historyContext(today) {
  var rows = readItemRowsSince(ymdAdd(today, -Math.max(60, (getSettings().BANK_RECENT_DAYS || 45) + 7))), ctx = { usedSigs: {}, recentTpl: {}, bankUsed: {} };
  rows.forEach(function (r) {
    var d = r[0], key = String(r[4]), diff = ymdDiff(today, d);
    if (diff <= 30 && diff >= 0) ctx.usedSigs[String(r[6])] = 1;
    if (diff <= 3 && diff >= 0 && key.indexOf('TPL:') === 0) ctx.recentTpl[key.slice(4)] = 1;
    if (key.indexOf('FIX:') === 0) { var c = key.slice(4); if (!ctx.bankUsed[c] || ctx.bankUsed[c] < d) ctx.bankUsed[c] = d; }
  });
  return ctx;
}

/* ---------------- ทบทวนแบบเว้นช่วง ---------------- */
var REVIEW_HEAD = ['รหัส', 'คีย์', 'หมวด', 'ระดับ (tier)', 'ระดับข้อคลัง', 'หมวดคลัง', 'วันที่ผิดครั้งแรก', 'ครบกำหนด', 'รอบ', 'สถานะ', 'หมายเหตุ'];
function addReviews(items, today) {
  if (!items.length) return;
  var sh = getSheet(SH.review), last = sh.getLastRow(), exist = {};
  if (last > 1) sh.getRange(2, 1, last - 1, 10).getValues().forEach(function (r) { if (r[9] === 'รอ') exist[r[1] + '|' + cellToYmd(r[7])] = 1; });
  var rows = [];
  items.forEach(function (it) {
    [[3, 'หลัง 3 วัน'], [7, 'หลัง 1 สัปดาห์']].forEach(function (p) {
      var due = ymdAdd(today, p[0]);
      if (exist[it.key + '|' + due]) return;
      exist[it.key + '|' + due] = 1;
      rows.push([Utilities.getUuid().slice(0, 8), it.key, it.cat, it.tier || 2, it.level || '', it.fixCat || '', today, due, p[1], 'รอ', String(it.q || '').slice(0, 40)]);
    });
  });
  if (rows.length) sh.getRange(last + 1, 1, rows.length, REVIEW_HEAD.length).setValues(rows);
}
function getDueReviews(today) {
  var sh = getSheet(SH.review), last = sh.getLastRow();
  if (last < 2) return [];
  var out = [];
  sh.getRange(2, 1, last - 1, 10).getValues().forEach(function (r) {
    var due = cellToYmd(r[7]);
    if (r[9] === 'รอ' && due && due <= today) out.push({ id: String(r[0]), key: String(r[1]), cat: String(r[2]), tier: Number(r[3]) || 2, level: Number(r[4]) || 0, fixCat: String(r[5]), due: due });
  });
  out.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
  return out.slice(0, 12);
}
function markReviewsDone(ids, today) {
  if (!ids.length) return;
  var sh = getSheet(SH.review), last = sh.getLastRow();
  if (last < 2) return;
  var rng = sh.getRange(2, 1, last - 1, REVIEW_HEAD.length), v = rng.getValues(), dirty = false;
  v.forEach(function (r) { if (ids.indexOf(String(r[0])) >= 0 && r[9] === 'รอ') { r[9] = 'ทำแล้ว ' + today; dirty = true; } });
  if (dirty) rng.setValues(v);
}
function countPendingReviews() {
  var sh = getSheet(SH.review), last = sh.getLastRow(), n = 0;
  if (last < 2) return 0;
  sh.getRange(2, 10, last - 1, 1).getValues().forEach(function (r) { if (r[0] === 'รอ') n++; });
  return n;
}

/* ---------------- ผลรายวัน ---------------- */
function sectionCols(p) { return [p + ' คะแนนรอบแรก', p + ' เต็ม', p + ' เวลารอบแรก (วิ)', p + ' เวลารวมรวมแก้ (วิ)', p + ' เวลาเป้าหมาย/แนะนำ (วิ)', p + ' รอบแก้', p + ' ข้อผิดพลาด']; }
var DAILY_HEAD = ['วันที่', 'ประเภท', 'A ทักษะ', 'A ขั้น'].concat(sectionCols('A'), ['A ผ่าน?'], sectionCols('B'), sectionCols('C'), ['เวลารวม (นาที)', 'สรุป'],
  ['ชุดในวัน (1=ปกติ 2=ชดเชย)', 'หัวข้อ', 'รอบ', 'ชุดที่ (1-6)', 'ผลประเมินสัปดาห์', 'เวลาแต่ละหน้า A (วินาที)', 'เป้าหมาย X (วินาที)', 'เกณฑ์สูงสุด Y (วินาที)', 'ทำซ้ำสัปดาห์นี้?']);
/** ตำแหน่งคอลัมน์ที่เพิ่มต่อท้ายใน "ผลรายวัน" */
var DC = { slot: 28, topic: 29, round: 30, setNo: 31, outcome: 32, pages: 33, x: 34, y: 35, repeat: 36 };
function slotOfRow(r) { return Number(r[DC.slot]) === 2 ? 2 : 1; }
function readDailyRows(maxRows) {
  var sh = getSheet(SH.daily), last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - maxRows + 1);
  return sh.getRange(start, 1, last - start + 1, DAILY_HEAD.length).getValues().map(function (r) { r[0] = cellToYmd(r[0]); return r; });
}
/** แถวผลรายวันทั้งหมดของวันนั้น (ชุดปกติ + ชุดชดเชย) */
function findDailyRows(date) {
  return readDailyRows(400).filter(function (r) { return r[0] === date; });
}
function findDailyRow(date) {
  var rows = readDailyRows(400);
  for (var i = rows.length - 1; i >= 0; i--) if (rows[i][0] === date) return rows[i];
  return null;
}

/* ---------------- ข้อมูลวัดผล (วัดระดับ / รายเดือน) ---------------- */
var BENCH_HEAD = ['รอบ', 'วันที่', 'หมวด', 'ถูก', 'ทั้งหมด', '% ถูก', 'วินาที/ข้อ'];
function readBench() {
  var sh = getSheet(SH.bench), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, BENCH_HEAD.length).getValues().map(function (r) {
    return { period: String(r[0]), date: cellToYmd(r[1]), cat: String(r[2]), right: r[3], total: r[4], pct: r[5] === '' ? null : Number(r[5]), spi: r[6] === '' ? null : Number(r[6]) };
  });
}
function appendBench(period, date, stats) {
  var sh = getSheet(SH.bench), rows = CATS.map(function (c) {
    var s = stats[c] || { right: 0, total: 0, pct: '', spi: '' };
    return [period, date, c, s.right, s.total, s.pct, s.spi];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, BENCH_HEAD.length).setValues(rows);
}

/* ---------------- สถานะการหมุนเวียนหัวข้อ (แท็บ "รอบหัวข้อ") ---------------- */
var ROT_HEAD = ['หัวข้อ', 'รอบปัจจุบัน (แก้เองได้)', 'ทำครบสัปดาห์แล้ว (ครั้ง)', 'ผลสัปดาห์ล่าสุด', 'วันที่'];
function topicByName(n) { for (var i = 0; i < TOPICS.length; i++) if (TOPIC_NAMES[TOPICS[i]] === String(n).trim()) return TOPICS[i]; return null; }
function clampInt(v, lo, hi, d) { v = Math.floor(Number(v)); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); }
function ensureRotationSheet() {
  var sh = getSheet(SH.rotation);
  if (sh.getLastRow() < 1) {
    sh.getRange('E:E').setNumberFormat('@');
    sh.getRange(1, 1, 1, ROT_HEAD.length).setValues([ROT_HEAD]);
    var seed = rotRounds0();
    try { if (getState().placementDone) seed = placementRounds(readLevels()); } catch (e) { seed = rotRounds0(); }  // อัปเกรดจากเวอร์ชันเดิม: ใช้ผลวัดระดับที่มีอยู่แล้ว
    sh.getRange(2, 1, TOPICS.length, 5).setValues(TOPICS.map(function (t) { return [TOPIC_NAMES[t], seed[t], 0, '', '']; }));
    sh.getRange(8, 1, 4, 2).setValues([['หัวข้อสัปดาห์นี้', TOPIC_NAMES.add], ['ชุดถัดไป (1-6)', 1], ['สัปดาห์นี้เป็นการทำซ้ำ (ใช่ / ไม่ใช่)', 'ไม่ใช่'], ['สัปดาห์ที่ (นับรวมทุกหัวข้อ)', 1]]);
  }
  return sh;
}
/** อ่านสถานะ: {rot:{topic,setNo,repeat,weekNo}, rounds:{add..frac}, hist:{topic:{weeks,last,date}}} (ค่าที่ผู้ปกครองแก้ในชีตมีผลทันที) */
function readRotation() {
  var sh = ensureRotationSheet(), v = sh.getRange(2, 1, 10, 5).getValues(), rounds = {}, hist = {};
  TOPICS.forEach(function (t, i) {
    rounds[t] = clampInt(v[i][1], 1, 99, 1);
    hist[t] = { weeks: Number(v[i][2]) || 0, last: String(v[i][3] || ''), date: cellToYmd(v[i][4]) };
  });
  return { rot: { topic: topicByName(v[6][1]) || 'add', setNo: clampInt(v[7][1], 1, ROT_SETS, 1), repeat: String(v[8][1]).trim() === 'ใช่', weekNo: clampInt(v[9][1], 1, 9999, 1) }, rounds: rounds, hist: hist };
}
/** เขียนสถานะ; weekResult = {topic, text, date} เมื่อจบสัปดาห์ (บันทึกผลของหัวข้อนั้น) */
function writeRotation(rot, rounds, weekResult) {
  var sh = ensureRotationSheet();
  sh.getRange(2, 2, TOPICS.length, 1).setValues(TOPICS.map(function (t) { return [rounds[t]]; }));
  sh.getRange(8, 2, 4, 1).setValues([[TOPIC_NAMES[rot.topic]], [rot.setNo], [rot.repeat ? 'ใช่' : 'ไม่ใช่'], [rot.weekNo]]);
  if (weekResult) {
    var i = TOPICS.indexOf(weekResult.topic), r = sh.getRange(2 + i, 3, 1, 3), cur = r.getValues()[0];
    r.setValues([[(Number(cur[0]) || 0) + 1, weekResult.text, weekResult.date]]);
  }
}

// ======================= Session.gs =======================
/**
 * Session.gs — ฟังก์ชันที่หน้าเว็บ (Index.html) เรียก: getTodaySet / getCatchupSet / submitSection / submitSession
 * ตัดสินว่าวันนี้ทำชุดอะไร (วัดระดับ / ประจำวัน / วัดผลรายเดือน) และเลื่อนสถานะ "สัปดาห์ละเรื่อง" หลังทำเสร็จ
 *
 * ส่วน A ประจำวัน = หัวข้อละ 6 ชุด (บวก→ลบ→คูณ→หาร→เศษส่วน) นับตามจำนวน "ชุดที่ทำเสร็จ" ไม่ใช่ตามปฏิทิน
 *   วันไหนไม่ได้ทำ เนื้อหาไม่ข้าม · ทำชุดชดเชยได้ (ไม่บังคับ) รวมไม่เกิน 2 ชุดต่อวัน
 *   ชุดที่ 6 = ประเมินผล: ผ่าน / ผ่านแต่ช้า (ติดธง) / ทำหัวข้อเดิมซ้ำ 1 ครั้ง (ซ้ำแล้วยังไม่ผ่านก็ไปต่อ)
 */
var PLACEMENT_DAYS = 5;
var MAX_SETS_PER_DAY = 2;

function nextPlacementDay(st) { return st.placementDays.length; }

/** ตัดสินโหมดของวันนี้ */
function decideMode(today, cfg, st) {
  if (!cfg.START_DATE) return { status: 'notstarted' };
  if (today < cfg.START_DATE) return { status: 'notyet', startDate: cfg.START_DATE };
  if (cfg.practiceDays.indexOf(ymdDow(today)) < 0) return { status: 'rest' };
  if (!st.placementDone) {
    var stale = ymdDiff(today, cfg.START_DATE) > 10 && st.placementDays.length >= 1;
    if (st.placementDays.length >= PLACEMENT_DAYS || stale) return { status: 'ready', mode: 'daily', needFinalize: true };
    return { status: 'ready', mode: 'placement', day: nextPlacementDay(st) };
  }
  if (isLastFridayOfMonth(today) && ymdDiff(today, cfg.START_DATE) >= 21 && st.benchmarks.indexOf(ymdMonth(today)) < 0) return { status: 'ready', mode: 'benchmark' };
  return { status: 'ready', mode: 'daily' };
}

/**
 * ชุดชดเชย (ไม่บังคับ): ได้เมื่อวันนี้ทำชุดปกติ (ประจำวัน) แล้ว ยังทำชดเชยไม่ครบ 2 ชุด
 * และสัปดาห์หัวข้อที่ทำอยู่ยังไม่จบ (ชุดปกติของวันนี้ไม่ใช่ชุดที่ 6) — วันวัดระดับ/วัดผลไม่มีชดเชย
 */
function catchupState(rows, rs) {
  var s1 = rows.filter(function (r) { return slotOfRow(r) === 1; })[0];
  if (!s1 || rows.length >= MAX_SETS_PER_DAY) return { available: false };
  if (String(s1[1]) !== 'ประจำวัน') return { available: false };
  var done = Number(s1[DC.setNo]) || 0;
  if (!(done >= 1 && done < ROT_SETS)) return { available: false };
  var rot = rs.rot;
  return { available: true, remaining: ROT_SETS - done, next: rotLabel(rot.topic, planRound(rs.rounds[rot.topic]), rot.setNo, rot.repeat) };
}

function getCatchupSet() { return getTodaySet({ catchup: true }); }

function getTodaySet(req) {
  try {
    var wantCatch = !!(req && req.catchup);
    var today = todayYmd(), cfg = getSettings(), st = getState(), rows = findDailyRows(today), rs = readRotation();
    var s1 = rows.filter(function (r) { return slotOfRow(r) === 1; })[0];
    var cu = catchupState(rows, rs);
    if (s1 && !(wantCatch && cu.available)) {
      return { status: 'done', date: today, child: childLabel(), summary: doneSummaryFromRow(rows[rows.length - 1]), summaries: rows.map(doneSummaryFromRow), catchup: cu.available ? cu : null };
    }
    if (wantCatch && !cu.available) return { status: 'error', message: 'วันนี้ทำชุดชดเชยไม่ได้ (ทำได้วันละไม่เกิน 2 ชุด และเฉพาะเมื่อสัปดาห์ยังเหลือชุด)' };
    var dm = wantCatch ? { status: 'ready', mode: 'daily' } : decideMode(today, cfg, st);
    if (dm.status !== 'ready') return { status: dm.status, date: today, child: childLabel(), startDate: dm.startDate || '' };
    if (dm.needFinalize) { finalizePlacement(today); st = getState(); rs = readRotation(); }
    var slot = wantCatch ? 2 : 1, L = readLevels(), hist = historyContext(today);
    var ctx = { levels: L, rot: rs.rot, rounds: rs.rounds, targetMult: cfg.TARGET_MULTIPLIER, yFactor: cfg.ASSESS_Y_FACTOR,
      usedSigs: hist.usedSigs, recentTpl: hist.recentTpl, bankUsed: hist.bankUsed, bank: readBank(), reviews: [] };
    setRng(mulberry32(hashStr(today + '|' + dm.mode + '|' + slot + '|' + JSON.stringify([rs.rot, rs.rounds, L.tiers, st.placementDays.length]))));
    var set;
    if (dm.mode === 'placement') set = buildPlacementDay(ctx, dm.day);
    else if (dm.mode === 'benchmark') set = buildBenchmark(ctx);
    else { ctx.reviews = getDueReviews(today); set = buildDailySet(ctx); }
    var a = set.sections[0];
    set.status = 'ready'; set.date = today; set.slot = slot; set.catchup = wantCatch; set.child = childLabel(); set.childName = st.childName || '';
    set.aMaxSec = Math.max(cfg.A_MAX_SEC, (a.ySec || 0) + 300);
    if (wantCatch) set.title = 'ชุดชดเชย (ไม่บังคับ) — ' + set.title;
    return set;
  } catch (e) {
    return { status: 'error', message: String(e && e.message || e), stack: String(e && e.stack || '') };
  }
}

function errSummary(items) {
  var c = {};
  items.forEach(function (it) { if (!it.ok1) { var e = it.errType || 'ตอบผิด'; c[e] = (c[e] || 0) + 1; } });
  return Object.keys(c).map(function (k) { return k + '×' + c[k]; }).join(', ');
}
function secStat(sec) {
  var items = sec.items || [], right = items.filter(function (i) { return i.ok1; }).length;
  return { id: sec.id, name: sec.name, right: right, total: items.length, firstSec: Math.round(sec.firstSec || 0),
    totalSec: Math.round(sec.totalSec || 0), target: Math.round(sec.targetSec || sec.recSec || 0), rounds: sec.rounds || 0, errors: errSummary(items) };
}
function round1s(x) { return Math.round(x * 10) / 10; }
function pctOf(right, total) { return total ? round1s(right / total * 100) : ''; }

/** สถิติรายหมวดจากแถวข้อที่เป็นข้อวัดผล (cmp) */
function computeCatStats(rows) {
  var acc = {};
  rows.forEach(function (r) {
    if (String(r[13]) !== '1') return;
    var c = String(r[3]), a = acc[c] = acc[c] || { right: 0, total: 0, sec: 0 };
    a.total++; a.right += Number(r[7]) === 1 ? 1 : 0; a.sec += Number(r[10]) || 0;
  });
  var out = {};
  CATS.forEach(function (c) {
    var a = acc[c];
    if (a && a.total) out[c] = { right: a.right, total: a.total, pct: round1s(a.right / a.total * 100), spi: round1s(a.sec / a.total) };
  });
  return out;
}

function itemRowsFor(date, mode, sections) {
  var rows = [];
  sections.forEach(function (sec) {
    (sec.items || []).forEach(function (it) {
      rows.push([date, mode, sec.id, it.cat, it.key, it.tag || '', it.sig || '', it.ok1 ? 1 : 0, it.tries || 1, it.revealed ? 1 : 0, round1s(it.sec || 0),
        it.ok1 ? '' : (it.errType || 'ตอบผิด'), it.review ? 1 : 0, it.cmp ? 1 : 0, it.tier || '', it.ladder == null ? '' : it.ladder,
        String(it.q || '').replace(/\s+/g, ' ').slice(0, 60), it.page || '']);
    });
  });
  return rows;
}

function sectionRowCells(s) {
  return [s.right, s.total, s.firstSec, s.totalSec, s.target, s.rounds, s.errors];
}

function submitSession(res) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return doSubmit(res); } finally { lock.releaseLock(); }
}

function outcomeCell(o) { return o === 'pass' ? 'ผ่าน' : o === 'flag' ? 'ผ่าน(ช้า)' : o === 'repeat' ? 'ไม่ผ่าน' : '-'; }
function weekResultText(info) {
  if (info.outcome === 'pass') return 'ผ่าน รอบ ' + info.round + ' → รอบ ' + (info.round + 1);
  if (info.outcome === 'flag') return 'ผ่านแต่ช้า (' + info.reason + ') รอบ ' + info.round + ' → รอบ ' + (info.round + 1);
  return info.event === 'moveon' ? 'ไม่ผ่านซ้ำ (' + info.reason + ') ไปหัวข้อถัดไป รอบคงเดิม' : 'ไม่ผ่าน (' + info.reason + ') ทำหัวข้อนี้ซ้ำ';
}
function weekNote(info) {
  var tn = info.topicName;
  if (!info.assessment) return 'ชุดที่ ' + info.setNo + '/' + ROT_SETS + ' ของสัปดาห์' + tn + ' เสร็จแล้ว · ครั้งต่อไป: ' + info.nextLabel;
  if (info.outcome === 'pass') return 'ผ่านการประเมินสัปดาห์' + tn + '! ' + tn + 'ขึ้นรอบ ' + (info.round + 1) + ' · สัปดาห์ถัดไป: ' + info.nextLabel;
  if (info.outcome === 'flag') return 'ผ่านการประเมินสัปดาห์' + tn + ' แต่ช้ากว่าเป้า (' + info.reason + ') · ' + tn + 'ขึ้นรอบ ' + (info.round + 1) + ' · ต่อไป: ' + info.nextLabel;
  if (info.event === 'moveon') return 'ประเมินสัปดาห์' + tn + 'ซ้ำแล้วยังไม่ผ่าน (' + info.reason + ') ไปต่อหัวข้อถัดไป รอบคงเดิม · ต่อไป: ' + info.nextLabel;
  return 'ยังไม่ผ่านการประเมินสัปดาห์' + tn + ' (' + info.reason + ') · ทำหัวข้อนี้ซ้ำอีก 1 สัปดาห์ด้วยตัวเลขชุดใหม่ · ต่อไป: ' + info.nextLabel;
}

function doSubmit(res) {
  var cfg = getSettings(), st = getState(), today = todayYmd(), date = res.date || today;
  var nm = cleanChildName(res.childName);
  if (nm && nm !== st.childName) { st.childName = nm; setState(st); }
  if (ymdDiff(today, date) > 1 || ymdDiff(today, date) < 0) date = today;
  var mode = res.mode, slot = Number(res.slot) === 2 ? 2 : 1;

  // กันส่งซ้ำ (วันที่ + ชุดในวัน) และบังคับกติกา "ไม่เกิน 2 ชุดต่อวัน / ชดเชยเฉพาะที่ยังเหลือชุดในสัปดาห์" ฝั่งเซิร์ฟเวอร์
  var rowsToday = findDailyRows(date);
  var dup = rowsToday.filter(function (r) { return slotOfRow(r) === slot; })[0];
  if (dup) return { ok: true, duplicate: true, summary: doneSummaryFromRow(dup) };
  if (slot === 2) {
    if (mode !== 'daily' || !catchupState(rowsToday, readRotation()).available) return { ok: false, refused: true, message: 'ทำชุดชดเชยไม่ได้ในตอนนี้ (วันละไม่เกิน 2 ชุด และเฉพาะเมื่อสัปดาห์ยังเหลือชุด)' };
  } else if (rowsToday.length >= MAX_SETS_PER_DAY) return { ok: false, refused: true, message: 'วันนี้ทำครบ ' + MAX_SETS_PER_DAY + ' ชุดแล้ว' };

  var secs = {}, stats = {};
  (res.sections || []).forEach(function (s) { secs[s.id] = s; stats[s.id] = secStat(s); });
  var A = secs.A, sA = stats.A || secStat({ id: 'A', items: [] }), sB = stats.B || secStat({ id: 'B', items: [] }), sC = stats.C || secStat({ id: 'C', items: [] });

  // 1) บันทึกผลรายข้อ (คำถามสังเกต "สังเกตเห็นอะไร?" ไม่ถูกบันทึกเป็นข้อที่ให้คะแนน)
  var itemRows = itemRowsFor(date, mode, res.sections || []);
  var ish = getSheet(SH.items);
  if (itemRows.length) ish.getRange(ish.getLastRow() + 1, 1, itemRows.length, ITEM_HEAD.length).setValues(itemRows);

  // 2) ทบทวน: ข้อที่เคยมาทบทวนถือว่าทำแล้ว / ข้อที่ผิดรอบแรกเข้าคิวทบทวน 3 วัน และ 1 สัปดาห์ (คีย์ตามชนิดหน้า จึงรวมซ้ำกัน)
  var allItems = [].concat.apply([], (res.sections || []).map(function (s) { return s.items || []; }));
  markReviewsDone(allItems.filter(function (i) { return i.reviewId; }).map(function (i) { return i.reviewId; }), date);
  // แบบวัดระดับ/แบบวัดผลมีข้อยากเกินระดับโดยตั้งใจ จึงไม่ส่งข้อคิดเลขเข้าคิวทบทวน
  var wrong = allItems.filter(function (i) { return !i.ok1 && i.key && (mode === 'daily' || SKILLS.indexOf(i.cat) < 0); }).map(function (i) {
    return { key: i.key, cat: i.cat, tier: i.tier || 2, level: i.level, fixCat: i.fixCat, q: i.q };
  });
  addReviews(wrong, date);
  touchBankUsed(allItems.filter(function (i) { return /^FIX:/.test(i.key); }).map(function (i) { return i.key.slice(4); }), date);

  // 3) สถานะ
  var summary = { date: date, mode: mode, slot: slot, title: res.title || '', sections: [sA, sB, sC], note: '' }, info = null, topicName = '', stepLabel = '';
  var wk = { topic: '', round: '', setNo: '', outcome: '', pages: '', x: '', y: '', repeat: '' };
  if (mode === 'daily' && A) {
    var rs = readRotation(), rot = rs.rot, rounds = rs.rounds, L = readLevels();
    var aSet = Number(A.setNo), aTopic = String(A.topic), aRound = Number(A.round), assess = aSet === ROT_SETS;
    var matches = aTopic === rot.topic && aSet === rot.setNo && aRound === planRound(rounds[rot.topic]);
    var x = Math.round(setXSec(aTopic, aRound, aSet) * cfg.TARGET_MULTIPLIER), y = Math.round(x * cfg.ASSESS_Y_FACTOR);
    var aMain = (A.items || []).filter(function (i) { return !i.review; });
    info = { topic: aTopic, topicName: TOPIC_NAMES[aTopic], round: aRound, setNo: aSet, assessment: assess, x: x, y: y, stale: !matches, repeat: !!A.repeat,
      label: rotLabel(aTopic, aRound, aSet, !!A.repeat), totalSec: Math.round((A.firstSec || 0) + (A.correctionSec || 0)),
      pages: (A.pages || []).map(function (p) { return Math.round(p.sec || 0); }) };
    if (assess) {
      var o = assessOutcome({ mastered: aMain.every(function (i) { return !i.revealed; }), totalSec: info.totalSec }, x, y);
      info.outcome = o.outcome; info.reason = o.reason;
    }
    if (matches) {
      var tr = rotAfterSet(rot, rounds, aSet, assess ? { outcome: info.outcome } : null);
      info.event = tr.event; info.nextLabel = rotLabel(tr.rot.topic, planRound(tr.rounds[tr.rot.topic]), tr.rot.setNo, tr.rot.repeat);
      writeRotation(tr.rot, tr.rounds, assess ? { topic: aTopic, text: weekResultText(info), date: date } : null);
      summary.note = weekNote(info);
    } else summary.note = 'ชุดนี้ไม่ตรงกับสถานะปัจจุบันในแท็บ "รอบหัวข้อ" (อาจมีการแก้ไขสถานะ) จึงบันทึกผลแต่ไม่เลื่อนสถานะ';
    topicName = info.topicName; stepLabel = 'รอบ ' + aRound + ' · ชุด ' + aSet + '/' + ROT_SETS;
    wk = { topic: info.topicName, round: aRound, setNo: aSet, outcome: assess ? outcomeCell(info.outcome) : '-', pages: (A.pages || []).map(function (p) { return Math.round(p.sec || 0); }).join(','),
      x: x, y: y, repeat: A.repeat ? 'ซ้ำ' : '' };
    // ปรับระดับ B/C ตามผล 3 ครั้งล่าสุด (ไม่ใช้ตัดสินผ่าน/ไม่ผ่าน)
    var past = readDailyRows(40).filter(function (r) { return r[1] === 'ประจำวัน'; });
    var bP = past.map(function (r) { return Number(r[13]) ? Number(r[12]) / Number(r[13]) * 100 : null; }).filter(function (v) { return v != null; });
    var cP = past.map(function (r) { return Number(r[20]) ? Number(r[19]) / Number(r[20]) * 100 : null; }).filter(function (v) { return v != null; });
    if (sB.total) bP.push(sB.right / sB.total * 100);
    if (sC.total) cP.push(sC.right / sC.total * 100);
    L.tiers.observe = adjustTier(L.tiers.observe, bP);
    L.tiers.word = adjustTier(L.tiers.word, cP); L.tiers.analytic = adjustTier(L.tiers.analytic, cP);
    writeLevels(L);
    summary.drill = info;
  } else if (mode === 'placement') {
    if (st.placementDays.indexOf(res.placementDay) < 0) st.placementDays.push(res.placementDay);
    summary.note = 'วันที่ ' + st.placementDays.length + ' จาก ' + PLACEMENT_DAYS + ' ของแบบวัดระดับ';
    topicName = res.placementDay <= 3 ? SKILL_NAMES[SKILLS[res.placementDay]] : 'โจทย์ปัญหา/สังเกต/วิเคราะห์';
    setState(st);
    if (st.placementDays.length >= PLACEMENT_DAYS) {
      summary.placement = finalizePlacement(date, true);
      st = getState();
      summary.note = 'ครบ 5 วันแล้ว! ระบบกำหนดรอบเริ่มต้นของแต่ละหัวข้อให้แล้ว (เริ่มสัปดาห์บวก ชุด 1)';
    }
  } else if (mode === 'benchmark') {
    var cmpRows = itemRows.filter(function (r) { return r[13] === 1; });
    var bs = computeCatStats(cmpRows);
    st.benchmarks.push(ymdMonth(date));
    var label = 'เดือน ' + st.benchmarks.length;
    appendBench(label, date, bs);
    summary.benchmark = { label: label, stats: bs };
    summary.note = 'ทำแบบวัดผลประจำเดือนเสร็จแล้ว ผู้ปกครองจะได้รับรายงานเปรียบเทียบทางอีเมลสิ้นเดือน';
    topicName = 'แบบวัดผลประจำเดือน';
    setState(st);
    rebuildReportSheet();
  }
  summary.skillName = topicName; summary.stepLabel = stepLabel;

  // 4) บันทึกผลรายวัน (1 แถวต่อชุด: ชุดปกติ + ชุดชดเชย)
  var totalMin = Math.round(((res.totalSec || (sA.totalSec + sB.totalSec + sC.totalSec)) / 60) * 10) / 10;
  var modeLabel = mode === 'daily' ? 'ประจำวัน' : mode === 'placement' ? 'วัดระดับ' : 'วัดผลรายเดือน';
  var passCell = info ? (info.assessment ? outcomeCell(info.outcome) : '-') : '-';
  var dsh = getSheet(SH.daily), row = [date, modeLabel, topicName, stepLabel].concat(sectionRowCells(sA), [passCell], sectionRowCells(sB), sectionRowCells(sC), [totalMin, summary.note],
    [slot, wk.topic, wk.round, wk.setNo, wk.outcome, wk.pages, wk.x, wk.y, wk.repeat]);
  dsh.getRange(dsh.getLastRow() + 1, 1, 1, DAILY_HEAD.length).setValues([row]);

  // 5) ความก้าวหน้า + แผนภูมิ
  var rd2 = readRotation().rounds, psh = getSheet(SH.progress);
  psh.getRange(psh.getLastRow() + 1, 1, 1, PROGRESS_HEAD.length).setValues([[date, pctOf(sA.right, sA.total), pctOf(sB.right, sB.total), pctOf(sC.right, sC.total),
    info && sA.target ? round1s(info.totalSec / sA.target * 100) : '', rd2.add, rd2.sub, rd2.mul, rd2.div, rd2.frac]]);
  try { rebuildProgressCharts(); } catch (e) { Logger.log('chart: ' + e); }

  try { props().deleteProperty('DRAFT_' + date + '_' + slot); } catch (e) { /* ไม่สำคัญ */ }
  summary.pendingReviews = countPendingReviews();
  try { sendSessionEmail(summary); } catch (e) { Logger.log('email: ' + e); summary.emailError = String(e); }
  return { ok: true, summary: summary };
}

/** บันทึกสถิติของส่วนที่เพิ่งทำเสร็จไว้ก่อน (ร่างขนาดเล็กใน Properties) เผื่อปิดหน้าจอกลางคัน ผลเต็มจะลงชีตตอนจบทั้งชุด */
function submitSection(draft) {
  try {
    var key = 'DRAFT_' + (draft.date || todayYmd()) + '_' + (Number(draft.slot) === 2 ? 2 : 1);
    var cur = props().getProperty(key), obj = cur ? JSON.parse(cur) : { stats: {} };
    obj.stats[draft.section.id] = secStat(draft.section);
    obj.mode = draft.mode;
    props().setProperty(key, JSON.stringify(obj));
    return { ok: true };
  } catch (e) { return { ok: false, message: String(e) }; }
}

function doneSummaryFromRow(r) {
  function sec(id, name, o) { return { id: id, name: name, right: r[o], total: r[o + 1], firstSec: r[o + 2], totalSec: r[o + 3], target: r[o + 4], rounds: r[o + 5], errors: r[o + 6] }; }
  return { date: r[0], mode: r[1], skillName: r[2], stepLabel: r[3], sections: [sec('A', 'คิดเลขเร็ว', 4), sec('B', 'การสังเกต', 12), sec('C', 'คิดวิเคราะห์', 19)],
    passCell: r[11], note: r[27], totalMin: r[26], slot: slotOfRow(r), topic: String(r[DC.topic] || ''), round: r[DC.round], setNo: r[DC.setNo], outcome: String(r[DC.outcome] || ''), fromRow: true };
}

/** คำนวณขั้นเริ่มต้นจากแบบวัดระดับ 5 วัน แล้วแปลงเป็น "รอบเริ่มต้น" ของแต่ละหัวข้อ (บวก/ลบมาจากบันไดเดียวกัน) */
function finalizePlacement(date, silent) {
  var cfg = getSettings(), st = getState(), L = readLevels(), rows = readItemRowsSince(ymdAdd(date, -60)).filter(function (r) { return r[1] === 'placement'; });
  var starts = {}, startNo = {};
  SKILLS.forEach(function (sk) {
    var n = skillSteps(sk).length, scores = [], i;
    for (i = 0; i < n; i++) scores.push(0);
    var any = false;
    rows.forEach(function (r) {
      if (String(r[3]) === sk && r[15] !== '') { any = true; scores[Number(r[15])] += Number(r[7]) === 1 ? 1 : 0; }
    });
    var idx = any ? computeStartIndex(scores, cfg.PLACEMENT_BACKOFF, PLACEMENT_PER_STEP) : 0;
    L[sk] = idx + 1; L.fails[sk] = 0; startNo[sk] = idx + 1;
    starts[sk] = { no: idx + 1, name: stepOf(sk, idx + 1).name, scores: scores };
  });
  var cs = computeCatStats(rows), tiers = {};
  [['word', 'word'], ['observe', 'observe'], ['analytic', 'analytic']].forEach(function (p) {
    var s = cs[p[0]], t = 2;
    if (s) t = s.pct >= 85 ? 3 : s.pct >= 60 ? 2 : 1;
    L.tiers[p[1]] = t; tiers[p[1]] = t;
  });
  writeLevels(L, startNo);
  var startRounds = placementRounds(startNo);
  writeRotation(rotInit(), startRounds, null);
  st.placementDone = true; st.nextSkill = 0;
  setState(st);
  appendBench('วัดระดับ', date, cs);
  rebuildReportSheet();
  return { starts: starts, tiers: tiers, stats: cs, rounds: startRounds };
}

/* ---------------- ความก้าวหน้า ---------------- */
var PROGRESS_HEAD = ['วันที่', 'ส่วน A ถูกรอบแรก (%)', 'ส่วน B ถูกรอบแรก (%)', 'ส่วน C ถูกรอบแรก (%)', 'ส่วน A เวลารวม ÷ เป้า (%)', 'รอบ บวก', 'รอบ ลบ', 'รอบ คูณ', 'รอบ หาร', 'รอบ เศษส่วน'];
function rebuildProgressCharts() {
  var sh = getSheet(SH.progress), n = sh.getLastRow();
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  if (n < 2) return;
  function chart(title, cols, row, vTitle, max) {
    var b = sh.newChart().setChartType(Charts.ChartType.LINE).addRange(sh.getRange(1, 1, n, 1));
    cols.forEach(function (c) { b = b.addRange(sh.getRange(1, c, n, 1)); });
    b = b.setNumHeaders(1).setPosition(row, 12, 0, 0).setOption('title', title).setOption('legend', { position: 'bottom' })
      .setOption('pointSize', 5).setOption('width', 620).setOption('height', 300).setOption('vAxis', { title: vTitle, minValue: 0 });
    sh.insertChart(b.build());
  }
  chart('ความแม่นยำรอบแรก (% ถูก) แยกตามส่วน', [2, 3, 4], 2, '% ถูก');
  chart('ส่วน A: เวลารวม ÷ เวลาเป้าหมาย (ต่ำกว่า 100% = ทันเวลา)', [5], 18, '% ของเวลาเป้าหมาย');
  chart('รอบปัจจุบันของแต่ละหัวข้อ', [6, 7, 8, 9, 10], 34, 'รอบ');
}

// ======================= Reports.gs =======================
/**
 * Reports.gs — รายงานรายเดือน (ชีต + อีเมล), อีเมลหลังทำเสร็จ, สรุปรายสัปดาห์, งานตามเวลา (triggers)
 */
var COL = {
  up: { fg: '#137333', bg: '#e6f4ea' }, down: { fg: '#c5221f', bg: '#fce8e6' },
  flat: { fg: '#5f6368', bg: '#f1f3f4' }, none: { fg: '#80868b', bg: '#ffffff' }
};
var SPEED_CATS = ['addsub', 'mul', 'div', 'fracdec'];

/** รวมข้อมูลวัดผล → โมเดลรายงาน (คำนวณล้วน ไม่แตะ Google) */
function computeReportModel(benchRows, thr) {
  var periods = [], map = {};
  benchRows.forEach(function (r) {
    if (periods.map(function (p) { return p.label; }).indexOf(r.period) < 0) periods.push({ label: r.period, date: r.date });
    map[r.period + '|' + r.cat] = r;
  });
  var cats = CATS.map(function (c) {
    var pcts = periods.map(function (p) { var r = map[p.label + '|' + c]; return r && r.pct != null && r.total ? r.pct : null; });
    var spis = periods.map(function (p) { var r = map[p.label + '|' + c]; return r && r.spi != null && r.total ? r.spi : null; });
    var rows = { pct: [], dPrev: [], dBase: [], spi: [], sPrev: [], sBase: [] };
    periods.forEach(function (p, i) {
      rows.dPrev.push(i >= 1 ? deltaInfo(pcts[i], pcts[i - 1], thr, false) : { cls: 'none', text: '–' });
      rows.dBase.push(i >= 1 ? deltaInfo(pcts[i], pcts[0], thr, false) : { cls: 'none', text: '–' });
      rows.sPrev.push(i >= 1 ? deltaInfo(spis[i], spis[i - 1], thr, true) : { cls: 'none', text: '–' });
      rows.sBase.push(i >= 1 ? deltaInfo(spis[i], spis[0], thr, true) : { cls: 'none', text: '–' });
    });
    return { cat: c, name: CAT_NAMES[c], pcts: pcts, spis: spis, rows: rows, hasSpeed: SPEED_CATS.indexOf(c) >= 0 };
  });
  var last = periods.length - 1;
  var summary = last >= 1 ? summaryLine(cats.map(function (c) { return { name: c.name, cur: c.pcts[last], base: c.pcts[0] }; })) : 'ยังมีเฉพาะผลวัดระดับตั้งต้น (รอแบบวัดผลประจำเดือนครั้งแรก)';
  return { periods: periods, cats: cats, summary: summary };
}

function periodHead(p) { return p.label + (p.date ? '\n' + p.date : ''); }

function rebuildReportSheet() {
  var cfg = getSettings(), model = computeReportModel(readBench(), cfg.DELTA_THRESHOLD);
  var sh = getSheet(SH.report);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clear();
  var np = model.periods.length;
  if (!np) { sh.getRange(1, 1).setValue('ยังไม่มีข้อมูล — จะเริ่มแสดงเมื่อทำแบบวัดระดับครบ 5 วัน'); return; }
  var ncol = 2 + np;
  sh.getRange(1, 1).setValue('รายงานความก้าวหน้ารายเดือน (ข้อวัดผลระดับเดียวกันทุกครั้ง)').setFontWeight('bold').setFontSize(14);
  sh.getRange(2, 1).setValue(model.summary).setFontWeight('bold');
  var head = ['หมวด', 'ตัวชี้วัด'].concat(model.periods.map(periodHead));
  sh.getRange(4, 1, 1, ncol).setValues([head]).setFontWeight('bold').setBackground('#e8eaed').setWrap(true).setHorizontalAlignment('center');
  var r = 5, tags = [];
  function put(label, metric, cells, isDelta) {
    var row = [label, metric].concat(cells.map(function (c) { return isDelta ? c.text : (c == null ? '–' : c); }));
    sh.getRange(r, 1, 1, ncol).setValues([row]);
    if (isDelta) cells.forEach(function (c, i) { var k = COL[c.cls] || COL.none; sh.getRange(r, 3 + i).setFontColor(k.fg).setBackground(k.bg).setFontWeight('bold'); });
    sh.getRange(r, 3, 1, np).setHorizontalAlignment('center');
    r++;
  }
  model.cats.forEach(function (c) {
    var start = r;
    put(c.name, '% ถูก', c.pcts.map(function (v) { return v == null ? null : v; }), false);
    put('', 'เทียบเดือนก่อน (จุด %)', c.rows.dPrev, true);
    put('', 'เทียบเริ่มต้น (จุด %)', c.rows.dBase, true);
    if (c.hasSpeed) {
      put('', 'ความเร็ว (วินาที/ข้อ)', c.spis, false);
      put('', 'เร็วขึ้น/ช้าลง เทียบเดือนก่อน', c.rows.sPrev, true);
      put('', 'เร็วขึ้น/ช้าลง เทียบเริ่มต้น', c.rows.sBase, true);
    }
    sh.getRange(start, 1, r - start, 1).setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(start, 1, r - start, ncol).setBorder(true, null, null, null, null, null, '#bdc1c6', SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.getRange(r + 1, 1).setValue('คำอธิบาย: ▲ สีเขียว = ดีขึ้น  ▼ สีแดง = แย่ลง  ● สีเทา = เปลี่ยนไม่เกิน ±' + cfg.DELTA_THRESHOLD + (' (เวลา: ลดลง = ดีขึ้น)')).setFontColor('#5f6368');
  // ข้อมูลสำหรับกราฟ
  var gr = r + 4;
  sh.getRange(gr, 1, 1, 1 + np).setValues([['% ถูก (ข้อมูลกราฟ)'].concat(model.periods.map(function (p) { return p.label; }))]).setFontColor('#80868b');
  model.cats.forEach(function (c, i) {
    sh.getRange(gr + 1 + i, 1, 1, 1 + np).setValues([[c.name].concat(c.pcts.map(function (v) { return v == null ? '' : v; }))]).setFontColor('#80868b');
  });
  if (np >= 1) {
    var cb = sh.newChart().setChartType(Charts.ChartType.LINE).addRange(sh.getRange(gr, 1, 1 + model.cats.length, 1 + np)).setNumHeaders(1)
      .setPosition(gr + 9, 1, 0, 0).setOption('title', '% ถูกแยกตามหมวด: วัดระดับ → เดือนถัดไป').setOption('legend', { position: 'bottom' })
      .setOption('width', 720).setOption('height', 320).setOption('pointSize', 5).setOption('vAxis', { minValue: 0, maxValue: 100 });
    try { cb = cb.setTransposeRowsAndColumns(true); } catch (e) { /* บางเวอร์ชันไม่รองรับ */ }
    sh.insertChart(cb.build());
  }
  sh.setColumnWidth(1, 130); sh.setColumnWidth(2, 210);
  for (var i = 0; i < np; i++) sh.setColumnWidth(3 + i, 110);
  sh.setFrozenRows(4); sh.setFrozenColumns(2);
}

/* ---------------- อีเมล ---------------- */
function sendMail(subject, html) {
  var to = recipients();
  if (!to.length) { Logger.log('ไม่มีอีเมลผู้รับ'); return; }
  MailApp.sendEmail({ to: to.join(','), subject: subject, htmlBody: html, name: 'ฝึกคณิต ป.4' });
}
var MAIL_CSS = 'font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#202124;max-width:640px;';
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tdS(extra) { return 'style="border:1px solid #dadce0;padding:6px 8px;' + (extra || '') + '"'; }
function deltaSpan(d) {
  var k = COL[d.cls] || COL.none;
  return '<span style="color:' + k.fg + ';font-weight:bold;">' + esc(d.text) + '</span>';
}
function mmss(s) { return fmtSec(s); }

function sendSessionEmail(sm) {
  var cfg = getSettings(), name = esc(childLabel());
  var rows = sm.sections.map(function (s) {
    var isA = s.id === 'A', target = s.target ? mmss(s.target) : '-';
    var timeTxt = mmss(s.totalSec) + (isA && sm.mode === 'daily' ? ' / เป้า ' + target : (s.target ? ' / แนะนำ ' + target : ''));
    return '<tr><td ' + tdS() + '><b>' + esc(s.id + ' ' + s.name) + '</b></td><td ' + tdS('text-align:center;') + '>' + s.right + '/' + s.total + '</td><td ' + tdS('text-align:center;') + '>' + timeTxt + '</td><td ' + tdS('text-align:center;') + '>' + s.rounds + '</td><td ' + tdS() + '>' + esc(s.errors || '–') + '</td></tr>';
  }).join('');
  var h = '<div style="' + MAIL_CSS + '"><h2 style="margin:0 0 4px;">' + name + ' ทำแบบฝึกเสร็จแล้ว ✅</h2><div style="color:#5f6368;">' + esc(thaiDate(sm.date)) + ' · ' + esc(sm.title || sm.mode) + '</div>';
  if (sm.drill) {
    var d = sm.drill, bg = d.assessment ? (d.outcome === 'pass' ? '#e6f4ea' : d.outcome === 'flag' ? '#fff4d6' : '#fef0e6') : '#eef3fb';
    var hd = d.assessment ? 'ประเมินสัปดาห์' + d.topicName + ': ' + (d.outcome === 'pass' ? '🎉 ผ่าน' : d.outcome === 'flag' ? '⚑ ผ่านแต่ช้า (ติดธง)' : '↻ ต้องทำหัวข้อนี้ซ้ำ') : 'ส่วน A · ' + d.label;
    h += '<p style="margin:12px 0;padding:10px;border-radius:8px;background:' + bg + ';"><b>' + esc(hd) + '</b><br>เวลารวมส่วน A (รวมเวลาแก้) ' + mmss(d.totalSec) +
      (d.assessment ? ' · เป้า X ' + mmss(d.x) + ' · เกณฑ์สูงสุด Y ' + mmss(d.y) : ' · เป้าอ้างอิง ' + mmss(d.x)) + (d.reason ? '<br>' + esc(d.reason) : '') +
      (d.pages && d.pages.length ? '<br><span style="font-size:13px;color:#5f6368;">เวลาแต่ละหน้า (วินาที): ' + d.pages.join(', ') + '</span>' : '') + (d.stale ? '<br><i>ชุดนี้ไม่ตรงสถานะปัจจุบัน จึงไม่เลื่อนสถานะ</i>' : '') + '</p>';
  }
  h += '<table style="border-collapse:collapse;width:100%;"><tr style="background:#f1f3f4;"><th ' + tdS() + '>ส่วน</th><th ' + tdS() + '>ถูกรอบแรก</th><th ' + tdS() + '>เวลา</th><th ' + tdS() + '>รอบแก้</th><th ' + tdS() + '>ข้อผิดพลาด</th></tr>' + rows + '</table>';
  h += '<p>' + esc(sm.note || '') + '</p>';
  if (sm.placement) {
    h += '<h3>ผลวัดระดับ → ขั้นเริ่มต้น</h3><ul>' + SKILLS.map(function (sk) { var p = sm.placement.starts[sk]; return '<li>' + esc(SKILL_NAMES[sk]) + ': ทำได้ถึงขั้น ' + p.no + ' (' + esc(p.name) + ')</li>'; }).join('') + '</ul>' +
      (sm.placement.rounds ? '<p><b>รอบเริ่มต้นของแต่ละหัวข้อ:</b> ' + TOPICS.map(function (t) { return esc(TOPIC_NAMES[t]) + ' รอบ ' + sm.placement.rounds[t]; }).join(' · ') + '</p>' : '');
  }
  if (sm.benchmark) {
    h += '<h3>ผลแบบวัดผล ' + esc(sm.benchmark.label) + '</h3><ul>' + CATS.map(function (c) { var s = sm.benchmark.stats[c]; return s ? '<li>' + esc(CAT_NAMES[c]) + ': ' + s.pct + '%' + (SPEED_CATS.indexOf(c) >= 0 ? ' (' + s.spi + ' วินาที/ข้อ)' : '') + '</li>' : ''; }).join('') + '</ul>';
  }
  h += '<p style="color:#5f6368;font-size:13px;">ข้อที่ผิดจะกลับมาทบทวนอีกครั้งหลัง 3 วันและ 1 สัปดาห์ (ตอนนี้รอทบทวน ' + (sm.pendingReviews || 0) + ' รายการ)</p></div>';
  var subj = '[ฝึกคณิต] ' + childLabel() + ' ' + sm.date + ' — ' + (sm.drill ? (sm.drill.assessment ? (sm.drill.outcome === 'pass' ? 'ผ่านสัปดาห์' : sm.drill.outcome === 'flag' ? 'ผ่าน(ช้า)สัปดาห์' : 'ทำซ้ำสัปดาห์') + sm.drill.topicName + ' ' : 'ชุด ' + sm.drill.setNo + '/' + ROT_SETS + ' ' + sm.drill.topicName + ' ') : '') + sm.sections.map(function (s) { return s.id + ' ' + s.right + '/' + s.total; }).join(' ');
  sendMail(subj, h);
}

function weeklyJob() { sendWeeklySummary(); }
function sendWeeklySummary() {
  var cfg = getSettings(), today = todayYmd(), from = ymdAdd(today, -6);
  var rows = readDailyRows(60).filter(function (r) { return r[0] >= from && r[0] <= today; });
  var items = readItemRowsSince(from).filter(function (r) { return r[0] <= today && Number(r[7]) !== 1; });
  var err = {};
  items.forEach(function (r) { var e = String(r[11] || 'ตอบผิด'); err[e] = (err[e] || 0) + 1; });
  var errList = Object.keys(err).sort(function (a, b) { return err[b] - err[a]; }).slice(0, 5);
  var L = readLevels(), st = getState();
  var pct = function (a, b) { return Number(b) ? Math.round(Number(a) / Number(b) * 100) : null; };
  var tr = rows.map(function (r) {
    return '<tr><td ' + tdS() + '>' + esc(thaiDate(r[0])) + '</td><td ' + tdS() + '>' + esc(r[1]) + '</td><td ' + tdS() + '>' + esc((r[2] || '') + ' ' + (r[3] || '')) + '</td><td ' + tdS('text-align:center;') + '>' + esc(r[11]) + '</td><td ' + tdS('text-align:center;') + '>' + (pct(r[4], r[5]) == null ? '–' : pct(r[4], r[5]) + '%') + '</td><td ' + tdS('text-align:center;') + '>' + (pct(r[12], r[13]) == null ? '–' : pct(r[12], r[13]) + '%') + '</td><td ' + tdS('text-align:center;') + '>' + (pct(r[19], r[20]) == null ? '–' : pct(r[19], r[20]) + '%') + '</td></tr>';
  }).join('');
  var assessRows = rows.filter(function (r) { return r[11] && r[11] !== '-'; }), passN = assessRows.filter(function (r) { return String(r[11]).indexOf('ผ่าน') === 0; }).length, drillN = assessRows.length;
  var dayN = Object.keys(rows.reduce(function (o, r) { o[r[0]] = 1; return o; }, {})).length;
  var h = '<div style="' + MAIL_CSS + '"><h2 style="margin:0 0 4px;">สรุปประจำสัปดาห์ของ' + esc(childLabel()) + '</h2><div style="color:#5f6368;">' + esc(thaiDate(from)) + ' – ' + esc(thaiDate(today)) + '</div>';
  h += '<p>ทำแบบฝึก <b>' + dayN + '</b> วัน (<b>' + rows.length + '</b> ชุด)' + (drillN ? ' · ผ่านการประเมินสัปดาห์ <b>' + passN + '/' + drillN + '</b> ครั้ง' : '') + '</p>';
  if (rows.length) h += '<table style="border-collapse:collapse;width:100%;font-size:14px;"><tr style="background:#f1f3f4;"><th ' + tdS() + '>วัน</th><th ' + tdS() + '>ประเภท</th><th ' + tdS() + '>ส่วน A</th><th ' + tdS() + '>ผล A</th><th ' + tdS() + '>A ถูก</th><th ' + tdS() + '>B ถูก</th><th ' + tdS() + '>C ถูก</th></tr>' + tr + '</table>';
  else h += '<p style="color:#c5221f;">สัปดาห์นี้ยังไม่มีการทำแบบฝึก</p>';
  if (assessRows.length) {
    h += '<h3>ผลประเมินสัปดาห์ (ชุดที่ 6)</h3><table style="border-collapse:collapse;width:100%;font-size:14px;"><tr style="background:#f1f3f4;"><th ' + tdS() + '>หัวข้อ</th><th ' + tdS() + '>ผล</th><th ' + tdS() + '>เวลา (รวมแก้)</th><th ' + tdS() + '>เป้า X / สูงสุด Y</th></tr>' + assessRows.map(function (r) {
      var o = String(r[11]), col = o === 'ผ่าน' ? '#137333' : o === 'ผ่าน(ช้า)' ? '#b06000' : '#c5221f';
      return '<tr><td ' + tdS() + '>' + esc(r[DC.topic] + ' รอบ ' + r[DC.round]) + (r[DC.repeat] ? ' (ซ้ำ)' : '') + '</td><td ' + tdS('font-weight:bold;color:' + col + ';') + '>' + esc(o === 'ผ่าน(ช้า)' ? '⚑ ผ่านแต่ช้า' : o === 'ผ่าน' ? 'ผ่าน' : 'ทำซ้ำ') + '</td><td ' + tdS('text-align:center;') + '>' + mmss(Number(r[7])) + '</td><td ' + tdS('text-align:center;') + '>' + mmss(Number(r[DC.x])) + ' / ' + mmss(Number(r[DC.y])) + '</td></tr>';
    }).join('') + '</table>';
  }
  var rsn = readRotation();
  h += '<h3>สถานะหัวข้อ</h3><p>ตอนนี้: <b>' + esc(rotLabel(rsn.rot.topic, planRound(rsn.rounds[rsn.rot.topic]), rsn.rot.setNo, rsn.rot.repeat)) + '</b></p><ul>' + TOPICS.map(function (t) {
    var hs = rsn.hist[t]; return '<li>' + esc(TOPIC_NAMES[t]) + ': รอบ ' + rsn.rounds[t] + (hs.last ? ' · ผลสัปดาห์ล่าสุด: ' + esc(hs.last) : '') + '</li>';
  }).join('') + '</ul>';
  if (!st.placementDone) h += '<p>ยังอยู่ระหว่างแบบวัดระดับ (ทำแล้ว ' + st.placementDays.length + '/' + PLACEMENT_DAYS + ' วัน)</p>';
  if (errList.length) h += '<h3>ข้อผิดพลาดที่พบบ่อย</h3><ul>' + errList.map(function (e) { return '<li>' + esc(e) + ' × ' + err[e] + '</li>'; }).join('') + '</ul>';
  h += '<p style="color:#5f6368;font-size:13px;">รอทบทวน ' + countPendingReviews() + ' รายการ</p>' + dashLinkHtml() + '</div>';
  sendMail('[ฝึกคณิต] สรุปสัปดาห์ ' + childLabel() + ' ' + from + ' ถึง ' + today, h);
}

/** คลังข้อสอบหมวดไหนเหลือข้อที่ยังไม่ได้ใช้ใน BANK_RECENT_DAYS วัน น้อยกว่าเกณฑ์ */
function lowBankReport() {
  var cfg = getSettings(), today = todayYmd(), hist = historyContext(today), bank = readBank(), res = [], by = {};
  BANK_CATS.forEach(function (c) { by[c] = { fresh: 0, total: 0 }; });
  bank.forEach(function (b) {
    var a = by[b.cat] = by[b.cat] || { fresh: 0, total: 0 }, used = hist.bankUsed[b.code];
    a.total++;
    if (!used || ymdDiff(today, used) > cfg.BANK_RECENT_DAYS) a.fresh++;
  });
  Object.keys(by).forEach(function (c) { if (by[c].fresh < cfg.LOW_BANK_THRESHOLD) res.push({ cat: c, fresh: by[c].fresh, total: by[c].total }); });
  return res;
}

function dailyJob() {
  var today = todayYmd();
  if (isLastDayOfMonth(today)) sendMonthlyReport();
}
function sendMonthlyReport() {
  var cfg = getSettings(), today = todayYmd(), model = computeReportModel(readBench(), cfg.DELTA_THRESHOLD), mon = ymdMonth(today);
  var rows = readDailyRows(80).filter(function (r) { return ymdMonth(r[0]) === mon; });
  var low = lowBankReport(), np = model.periods.length;
  var h = '<div style="' + MAIL_CSS + 'max-width:760px;"><h2 style="margin:0 0 4px;">รายงานประจำเดือน ' + esc(thaiMonthLabel(today + '')) + ' ของ' + esc(childLabel()) + '</h2>';
  var dayN = Object.keys(rows.reduce(function (o, r) { o[r[0]] = 1; return o; }, {})).length;
  h += '<p>ทำแบบฝึกเดือนนี้ <b>' + dayN + '</b> วัน (<b>' + rows.length + '</b> ชุด)</p><p style="padding:10px;border-radius:8px;background:#f1f3f4;"><b>' + esc(model.summary) + '</b></p>';
  if (np) {
    var th = '<tr style="background:#f1f3f4;"><th ' + tdS() + '>หมวด</th>' + model.periods.map(function (p) { return '<th ' + tdS() + '>' + esc(p.label) + '</th>'; }).join('') + (np >= 2 ? '<th ' + tdS() + '>เทียบเดือนก่อน</th><th ' + tdS() + '>เทียบเริ่มต้น</th>' : '') + '</tr>';
    var last = np - 1, body = model.cats.map(function (c) {
      var cells = c.pcts.map(function (v, i) { return '<td ' + tdS('text-align:center;') + '>' + (v == null ? '–' : v + '%') + (c.hasSpeed && c.spis[i] != null ? '<br><span style="color:#5f6368;font-size:12px;">' + c.spis[i] + ' วิ/ข้อ</span>' : '') + '</td>'; }).join('');
      var dp = np >= 2 ? '<td ' + tdS('text-align:center;') + '>' + deltaSpan(c.rows.dPrev[last]) + (c.hasSpeed ? '<br><span style="font-size:12px;">เวลา ' + deltaSpan(c.rows.sPrev[last]) + '</span>' : '') + '</td><td ' + tdS('text-align:center;') + '>' + deltaSpan(c.rows.dBase[last]) + (c.hasSpeed ? '<br><span style="font-size:12px;">เวลา ' + deltaSpan(c.rows.sBase[last]) + '</span>' : '') + '</td>' : '';
      return '<tr><td ' + tdS('font-weight:bold;') + '>' + esc(c.name) + '</td>' + cells + dp + '</tr>';
    }).join('');
    h += '<table style="border-collapse:collapse;width:100%;">' + th + body + '</table><p style="color:#5f6368;font-size:13px;">▲ เขียว = ดีขึ้น · ▼ แดง = แย่ลง · ● เทา = เปลี่ยนไม่เกิน ±' + cfg.DELTA_THRESHOLD + ' (เวลา: ลดลง = ดีขึ้น)</p>';
    if (model.periods[np - 1].label === 'วัดระดับ') h += '<p>เดือนนี้ยังไม่มีแบบวัดผลประจำเดือน (จะจัดวันศุกร์สุดท้ายของเดือน)</p>';
  } else h += '<p>ยังไม่มีข้อมูลวัดผล</p>';
  if (low.length) h += '<div style="margin-top:14px;padding:10px;border-radius:8px;background:#fef7e0;"><b>⚠ คลังข้อสอบกำลังจะหมด</b><ul>' + low.map(function (l) { return '<li>หมวด "' + esc(l.cat) + '": เหลือข้อที่ยังไม่ได้ใช้ใน ' + cfg.BANK_RECENT_DAYS + ' วัน เพียง ' + l.fresh + ' จาก ' + l.total + ' ข้อ — เพิ่มข้อในแท็บ "คลังข้อสอบ" ได้เลย</li>'; }).join('') + '</ul></div>';
  h += dashLinkHtml() + '</div>';
  sendMail('[ฝึกคณิต] รายงานประจำเดือน ' + childLabel() + ' ' + mon, h);
}

// ======================= Dashboard.gs =======================
/**
 * Dashboard.gs — API ของหน้า Dashboard ผู้ปกครอง (?page=dashboard)
 * เว็บแอปเปิดแบบ "Anyone" จึงเช็กอีเมลผู้เปิดไม่ได้ ใช้รหัส PIN (PARENT_PIN ในแท็บตั้งค่า) แทน
 * ใส่ผิดเกิน 5 ครั้งจะล็อก 10 นาที ถ้าไม่ได้ตั้ง PIN จะเข้าไม่ได้เลย (ปลอดภัยไว้ก่อน)
 */
var DASH_FAIL_KEY = 'dash_fail', DASH_MAX_FAILS = 5, DASH_LOCK_SEC = 600;

function dash_auth_(pin) {
  var want = String(getSettings().PARENT_PIN == null ? '' : getSettings().PARENT_PIN).trim();
  if (!want) return { ok: false, reason: 'nopin' };
  var given = String(pin == null ? '' : pin).trim();
  if (!given) return { ok: false, reason: 'need' };
  var cache = CacheService.getScriptCache(), fails = Number(cache.get(DASH_FAIL_KEY) || 0);
  if (fails >= DASH_MAX_FAILS) return { ok: false, reason: 'locked' };
  if (given === want) { cache.remove(DASH_FAIL_KEY); return { ok: true }; }
  cache.put(DASH_FAIL_KEY, String(fails + 1), DASH_LOCK_SEC);
  return { ok: false, reason: 'wrong', left: DASH_MAX_FAILS - fails - 1 };
}
function dash_need_(pin) { var r = dash_auth_(pin); if (!r.ok) throw new Error('ไม่มีสิทธิ์เข้าถึง'); }

/** หน้าเว็บเรียกตอนเปิด เพื่อรู้ว่าต้องขอรหัสหรือไม่ */
function dash_check(pin) { return dash_auth_(pin); }

function readProgressRows_(maxRows) {
  var sh = getSheet(SH.progress), last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - maxRows + 1);
  return sh.getRange(start, 1, last - start + 1, PROGRESS_HEAD.length).getValues().map(function (r) { r[0] = cellToYmd(r[0]); return r; });
}

/** แพ็กข้อมูลทั้งหมดของ Dashboard เป็นก้อนเดียว */
function dash_getBundle(pin) {
  dash_need_(pin);
  var cfg = getSettings(), st = getState(), L = readLevels(), today = todayYmd(), green = cfg.DASH_GREEN, yellow = cfg.DASH_YELLOW;
  var list = dashDailyList(readDailyRows(500)), doneSet = {}, passMap = {};
  list.forEach(function (d) {
    doneSet[d.date] = true;
    // วันที่มี 2 ชุด: ผลประเมินสัปดาห์ (ผ่าน/ไม่ผ่าน) ชนะชุดที่ไม่ได้ประเมิน
    var cur = passMap[d.date];
    if (cur === undefined || cur === '-' || (cur !== 'ผ่าน' && d.pass && d.pass !== '-')) passMap[d.date] = d.pass;
  });
  var from30 = ymdAdd(today, -30), from14 = ymdAdd(today, -14);
  var items = readItemRowsSince(from30);
  var model = computeReportModel(readBench(), cfg.DELTA_THRESHOLD);
  var streak = dashStreak(doneSet, today, cfg.practiceDays), missed = dashMissed(doneSet, cfg.START_DATE, today, cfg.practiceDays);
  var due = getDueReviews(today), low = [];
  try { low = lowBankReport(); } catch (e) { low = []; }
  var todayRow = list.filter(function (d) { return d.date === today; })[0];
  var rs = readRotation();
  var alerts = dashAlerts({ startDate: cfg.START_DATE, today: today, placement: { done: st.placementDone, days: st.placementDays.length, of: PLACEMENT_DAYS },
    rot: { topic: rs.rot.topic, round: planRound(rs.rounds[rs.rot.topic]), setNo: rs.rot.setNo, repeat: rs.rot.repeat }, missed: missed, list: list, yellow: yellow, dueReviews: due.length, lowBank: low,
    streak: streak, todayDone: !!todayRow, todayPass: todayRow && todayRow.pass });
  var history = list.slice().reverse().slice(0, 60).map(function (d) {
    return { date: d.date, mode: d.mode, skillName: d.skillName, stepLabel: d.stepLabel, pass: d.pass, aPct: d.aPct, bPct: d.bPct, cPct: d.cPct, ratio: d.ratio,
      A: d.A, B: d.B, C: d.C, totalMin: d.totalMin, note: d.note, slot: d.slot, topic: d.topic, round: d.round, setNo: d.setNo, pagesSec: d.pagesSec, x: d.x, y: d.y, repeat: d.repeat };
  });
  var bank = [];
  try {
    var hist = historyContext(today), by = {};
    readBank().forEach(function (b) { var a = by[b.cat] = by[b.cat] || { cat: b.cat, fresh: 0, total: 0 }, u = hist.bankUsed[b.code]; a.total++; if (!u || ymdDiff(today, u) > cfg.BANK_RECENT_DAYS) a.fresh++; });
    bank = Object.keys(by).map(function (k) { return by[k]; });
  } catch (e) { bank = []; }
  return {
    title: 'ฝึกคณิต ป.4', child: childLabel(), today: today, startDate: cfg.START_DATE, practiceDays: cfg.practiceDays,
    thresholds: { green: green, yellow: yellow }, deltaThreshold: cfg.DELTA_THRESHOLD,
    placement: { done: st.placementDone, days: st.placementDays.length, of: PLACEMENT_DAYS }, tiers: L.tiers,
    kpi: { streak: streak, missed: missed, sessions: list.length, month: dashMonthStats(list, ymdMonth(today)), pendingReviews: countPendingReviews(), dueReviews: due.length,
      today: todayRow ? { pass: todayRow.pass, aPct: todayRow.aPct, bPct: todayRow.bPct, cPct: todayRow.cPct, mode: todayRow.mode } : null },
    topics: dashTopicProgress(rs), rotation: { topic: rs.rot.topic, topicName: TOPIC_NAMES[rs.rot.topic], round: planRound(rs.rounds[rs.rot.topic]), setNo: rs.rot.setNo, repeat: rs.rot.repeat, weekNo: rs.rot.weekNo,
      label: rotLabel(rs.rot.topic, planRound(rs.rounds[rs.rot.topic]), rs.rot.setNo, rs.rot.repeat) }, trend: dashTopicTrend(list), alerts: alerts,
    calendar: dashCalendar(passMap, today, cfg.START_DATE, cfg.practiceDays, 6),
    series: dashSeries(readProgressRows_(200)),
    report: model, radar: dashRadar(model),
    errors30: dashErrorStats(items, from30), errors14: dashErrorStats(items, from14),
    history: history, reviews: { pending: countPendingReviews(), due: due.slice(0, 12).map(function (r) { return { key: r.key, label: dashTagLabel(r.key), cat: r.cat, due: r.due }; }) },
    bank: bank, serverNow: new Date().getTime()
  };
}

/** รายละเอียดของวันหนึ่ง: ข้อที่ผิดรอบแรกพร้อมโจทย์ */
function dash_getSession(pin, date) {
  dash_need_(pin);
  date = String(date || '');
  var rows = readItemRowsSince(date).filter(function (r) { return String(r[0]) === date; });
  var sets = dashDailyList(findDailyRows(date)).map(function (d) { return { slot: d.slot, mode: d.mode, label: (d.topic ? d.topic + ' ' : '') + d.stepLabel, outcome: d.pass, x: d.x, y: d.y, totalSec: d.A.totalSec, pagesSec: d.pagesSec, pageCount: d.pagesSec.length }; });
  var secName = { A: 'คิดเลขเร็ว', B: 'การสังเกต', C: 'คิดวิเคราะห์' };
  return {
    date: date, total: rows.length, sets: sets,
    wrong: rows.filter(function (r) { return Number(r[7]) !== 1; }).map(function (r) {
      return { section: secName[r[2]] || String(r[2]), cat: CAT_NAMES[r[3]] || String(r[3]), label: dashTagLabel(r[4]), q: String(r[16] || ''), errType: String(r[11] || ''), tries: Number(r[8]) || 1, revealed: Number(r[9]) === 1, review: Number(r[12]) === 1 };
    })
  };
}

function dashLinkHtml() {
  var u = dashboardUrl();
  return u ? '<p style="margin-top:14px;"><a href="' + u + '" style="display:inline-block;padding:8px 14px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;">เปิด Dashboard ผู้ปกครอง</a> <span style="color:#5f6368;font-size:12px;">(ต้องใช้รหัส PARENT_PIN)</span></p>' : '';
}

/** ลิงก์ Dashboard ใส่ท้ายอีเมล (ถ้าหาไม่ได้ก็ว่าง) */
function dashboardUrl() {
  try { var u = ScriptApp.getService().getUrl(); return u ? u + '?page=dashboard' : ''; } catch (e) { return ''; }
}

// ======================= Code.gs =======================
/**
 * Code.gs — จุดเริ่มต้นของเว็บแอป + ฟังก์ชันติดตั้ง (setup) + เมนูในชีต
 *
 * ขั้นตอนสำหรับผู้ปกครอง (ละเอียดใน README-TH.md):
 *   1) เลือกฟังก์ชัน setup แล้วกด ▶ รัน (ครั้งเดียว) — สร้างแท็บ ใส่คลังข้อสอบ ตั้งเวลาส่งอีเมล
 *   2) Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
 */

/** ถ้าสคริปต์นี้สร้างแยกจาก script.google.com (ไม่ได้ผูกกับชีต) ให้ใส่ ID ของ Google Sheet ตรงนี้ (ข้อความระหว่าง /d/ และ /edit ใน URL ของชีต) ถ้าเปิดจากเมนูในชีตให้เว้นว่าง */
var SHEET_ID = '';

function doGet(e) {
  // ?page=dashboard = หน้า Dashboard ผู้ปกครอง (ล็อกด้วย PIN) / ไม่ระบุ = หน้าฝึกของลูก (ลิงก์เดิมใช้ต่อได้)
  if (e && e.parameter && e.parameter.page === 'dashboard') {
    return HtmlService.createTemplateFromFile('Dashboard').evaluate()
      .setTitle('Dashboard · ฝึกคณิต ป.4')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate()
    .setTitle('ฝึกคณิต ป.4')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** โค้ดตรวจคำตอบชุดเดียวกับฝั่งเซิร์ฟเวอร์ ส่งไปทำงานบนแท็บเล็ต (แหล่งความจริงเดียว: Core.gs) */
function clientCore() {
  return [gcd, parseUser, checkAnswer, classifyError].map(function (f) { return f.toString(); }).join('\n') +
    '\nvar ERR_DEFAULT=' + JSON.stringify(ERR_DEFAULT) + ';';
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('ฝึกคณิต ป.4')
      .addItem('ส่งอีเมลทดสอบ', 'sendTestEmail')
      .addItem('ตั้งเวลาส่งอีเมลใหม่ (triggers)', 'installTriggers')
      .addItem('สร้างรายงานรายเดือนใหม่', 'rebuildReportSheet')
      .addItem('ล้างข้อมูลทดลอง (เริ่มใหม่)', 'clearTestData')
      .addToUi();
  } catch (e) { /* ไม่ได้เปิดจากชีต */ }
}

/* ---------------- ติดตั้ง ---------------- */
function setup() {
  var active = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('ต้องสร้างสคริปต์จากเมนู ส่วนขยาย > Apps Script ภายใน Google Sheet หรือใส่ SHEET_ID ที่ต้นไฟล์ Code (ดู README-TH.md ขั้นที่ 2)');
  props().setProperty('SS_ID', active.getId());
  _ss = null; _cfg = null;
  active.setSpreadsheetTimeZone(Session.getScriptTimeZone() || 'Asia/Bangkok');  // กันวันที่เลื่อนข้ามวัน

  function head(name, headers, widths, textCols) {
    var sh = getSheet(name);
    (textCols || []).forEach(function (c) { sh.getRange(c + ':' + c).setNumberFormat('@'); });  // วันที่/ข้อความ เก็บเป็นข้อความล้วน ไม่ให้ชีตแปลงเป็นวันที่เอง
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8eaed').setWrap(true).setVerticalAlignment('middle');
    sh.setFrozenRows(1);
    (widths || []).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    return sh;
  }
  // ตั้งค่า
  var set = head(SH.settings, ['คีย์', 'ค่า', 'คำอธิบาย'], [170, 180, 620]);
  set.getRange(2, 2, 40, 1).setNumberFormat('@');
  var have = {};
  if (set.getLastRow() > 1) set.getRange(2, 1, set.getLastRow() - 1, 1).getValues().forEach(function (r) { have[String(r[0]).trim()] = 1; });
  DEFAULT_SETTINGS.forEach(function (d) {
    if (have[d[0]]) return;
    var val = d[1];
    if (d[0] === 'START_DATE') {
      var t = todayYmd(), dow = ymdDow(t);
      val = dow === 1 ? t : ymdAdd(t, (8 - dow) % 7 || 7);
    }
    var r = set.getLastRow() + 1;
    set.getRange(r, 1, 1, 3).setValues([[d[0], val, d[2]]]);
    set.getRange(r, 2).setNumberFormat('@').setValue(String(val));
  });
  set.getRange(2, 3, 40, 1).setWrap(true);
  // คลังข้อสอบ
  ensureBank();
  var bank = head(SH.bank, BANK_HEADERS, [90, 60, 520, 120, 360, 200, 70, 110]);
  bank.getRange(1, 1, 1, 6).setBackground('#d2e3fc');
  bank.getRange(2, 3, Math.max(1, bank.getLastRow() - 1), 3).setWrap(true);
  bank.getRange(1, 9).setValue('← เพิ่มข้อใหม่ต่อท้ายได้เลย กรอกแค่ 5 คอลัมน์แรก (หมวด/ระดับ/โจทย์/คำตอบ/คำอธิบาย) ถ้าคำตอบไม่ใช่ตัวเลข ให้ใส่ตัวเลือกคั่นด้วย | ในคอลัมน์ F').setFontColor('#5f6368');
  // ผลและข้อมูล
  head(SH.daily, DAILY_HEAD, [95, 90, 100, 90], ['A', 'AB', 'AC', 'AF', 'AG']);
  head(SH.items, ITEM_HEAD, [95, 80, 50, 80, 110, 80, 220, 70, 70, 70, 70, 140, 60, 60, 50, 60, 360, 50], ['A', 'E', 'F', 'G', 'Q']);
  var lv = head(SH.levels, LEVEL_HEAD, [190, 150, 330, 140, 150, 130, 100, 260], ['G']);
  if (!lv.getRange(2, 1).getValue()) {
    SKILLS.forEach(function (sk, i) { lv.getRange(2 + i, 1).setValue(SKILL_NAMES[sk]); });
    TIER_ROWS.forEach(function (t, i) { lv.getRange(6 + i, 1).setValue(t[0]); });
    var L0 = { tiers: { word: 2, observe: 2, analytic: 2 }, fails: {}, last: {} };
    SKILLS.forEach(function (sk) { L0[sk] = 1; L0.fails[sk] = 0; });
    writeLevels(L0);
    lv.getRange(10, 1).setValue('หมายเหตุ: แท็บนี้เก็บผลจากแบบวัดระดับ (ขั้นเริ่มต้นของแต่ละบันไดเดิม) ไว้อ้างอิงและใช้กับแบบวัดผลรายเดือน — การฝึกประจำวันใช้แท็บ "รอบหัวข้อ" แทน ส่วนระดับความยากของโจทย์ปัญหา/สังเกต/วิเคราะห์ปรับในแถวล่างของแท็บนี้').setFontColor('#5f6368');
  }
  head(SH.review, REVIEW_HEAD, [80, 110, 90, 70, 80, 90, 110, 110, 100, 130, 300], ['B', 'G', 'H', 'K']);
  head(SH.progress, PROGRESS_HEAD, [95, 110, 110, 110, 130, 80, 80, 80, 80, 90], ['A']);
  var rot = head(SH.rotation, ROT_HEAD, [210, 170, 170, 360, 110], ['E']);
  ensureRotationSheet();
  rot.getRange(1, 1, 1, ROT_HEAD.length).setValues([ROT_HEAD]);
  rot.getRange(13, 1).setValue('หมายเหตุ: ระบบเลื่อนสถานะให้เองหลังทำเสร็จแต่ละชุด ผู้ปกครองแก้รอบ/ชุดถัดไปได้เมื่อต้องการ (ชุดที่เปิดค้างอยู่ก่อนแก้จะไม่เลื่อนสถานะ)').setFontColor('#5f6368');
  head(SH.bench, BENCH_HEAD, [100, 100, 130, 60, 70, 70, 90], ['A', 'B']);
  getSheet(SH.report);
  // เรียงแท็บ และลบแท็บเปล่าเริ่มต้น
  [SH.settings, SH.daily, SH.rotation, SH.levels, SH.progress, SH.report, SH.bank, SH.review, SH.items, SH.bench].forEach(function (n, i) {
    var sh = ss().getSheetByName(n); ss().setActiveSheet(sh); ss().moveActiveSheet(i + 1);
  });
  ['ชีต1', 'Sheet1'].forEach(function (n) {
    var sh = ss().getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss().getSheets().length > 1) ss().deleteSheet(sh);
  });
  rebuildReportSheet();
  installTriggers();
  Logger.log('ติดตั้งเสร็จแล้ว ✅ ต่อไป: Deploy > New deployment > Web app (ดู README-TH.md ขั้นที่ 4)');
  return 'ติดตั้งเสร็จแล้ว';
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === 'weeklyJob' || h === 'dailyJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyJob').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).create();
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(20).create();
}

function sendTestEmail() {
  var to = recipients();
  sendMail('[ฝึกคณิต] ทดสอบส่งอีเมล', '<div style="' + MAIL_CSS + '"><h3>ทดสอบสำเร็จ ✅</h3><p>ถ้าคุณเห็นอีเมลนี้ แปลว่าระบบส่งอีเมลได้ ผู้รับตอนนี้: ' + esc(to.join(', ') || '(ไม่มี)') + '</p></div>');
  return 'ส่งไปที่: ' + to.join(', ');
}

/** ล้างผลที่ทำไว้ทั้งหมดเพื่อเริ่มใหม่จริง (ไม่ลบแท็บตั้งค่าและคลังข้อสอบ) */
function clearTestData() {
  [SH.daily, SH.items, SH.review, SH.progress, SH.bench].forEach(function (n) {
    var sh = ss().getSheetByName(n);
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    if (sh) sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  });
  var L0 = { tiers: { word: 2, observe: 2, analytic: 2 }, fails: {}, last: {} };
  SKILLS.forEach(function (sk) { L0[sk] = 1; L0.fails[sk] = 0; });
  writeLevels(L0);
  props().deleteProperty('STATE');
  var rsh = ss().getSheetByName(SH.rotation);
  if (rsh) { rsh.clear(); ensureRotationSheet(); }
  props().getKeys().forEach(function (k) { if (k.indexOf('DRAFT_') === 0) props().deleteProperty(k); });
  rebuildReportSheet();
  return 'ล้างข้อมูลแล้ว';
}

/** ตรวจตรรกะภายใน: เลือกฟังก์ชันนี้แล้วกด ▶ ดูผลที่ View > Logs */
function runSelfTest() {
  var fails = 0, n = 0;
  selfTestAll(function (c, m) { n++; if (!c) { fails++; Logger.log('✗ ' + m); } });
  // สุ่มตรวจตัวสร้างโจทย์ทุกขั้นขั้นละ 50 ข้อ
  setRng(null);
  STEPS.forEach(function (st) {
    for (var i = 0; i < 50; i++) {
      var it = genStep(st.id); n++;
      if (!checkAnswer(it, it.ans)) { fails++; Logger.log('✗ ' + st.id + ' ' + it.q + ' → ' + it.ans); }
    }
  });
  TEMPLATES.forEach(function (t) {
    for (var tier = t.min; tier <= t.max; tier++) for (var i = 0; i < 20; i++) {
      var it = buildTemplate(t.id, tier); n++;
      if (!checkAnswer(it, it.ans) || /NaN|undefined/.test(it.q)) { fails++; Logger.log('✗ ' + t.id + ' ' + it.q); }
    }
  });
  try {
    readBank().forEach(function (r) {
      if (!fixedToItem(r)) { fails++; Logger.log('✗ แถวในคลังข้อสอบรหัส ' + r.code + ' ใช้ไม่ได้ (คำตอบต้องเป็นตัวเลข หรือเป็นข้อความที่ตรงกับตัวเลือกในคอลัมน์ F): ' + String(r.q).slice(0, 40)); }
    });
  } catch (e) { Logger.log('ข้ามการตรวจคลังข้อสอบ: ' + e); }
  Logger.log('ตรวจ ' + n + ' รายการ ผิด ' + fails + (fails ? ' ❌' : ' ✅'));
  return fails;
}
