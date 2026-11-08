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
