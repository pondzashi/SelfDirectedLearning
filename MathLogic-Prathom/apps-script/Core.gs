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
