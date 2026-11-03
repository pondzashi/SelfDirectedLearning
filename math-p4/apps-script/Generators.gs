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
