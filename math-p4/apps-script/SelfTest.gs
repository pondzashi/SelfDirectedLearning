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
      usedSigs: {}, recentTpl: {}, bank: bankRows, bankUsed: {}, reviews: [] };
    for (var k in (extra || {})) c[k] = extra[k];
    return c;
  }
  setRng(mulberry32(12345));
  var d1 = buildDailySet(mkCtx());
  setRng(mulberry32(12345));
  var d2 = buildDailySet(mkCtx());
  ok(JSON.stringify(d1) === JSON.stringify(d2), 'ชุดข้อวันเดียวกัน (seed เดียวกัน) ต้องออกเหมือนเดิม');
  var A = d1.sections[0], B = d1.sections[1], C = d1.sections[2], st = stepOf('addsub', 3);
  ok(A.mainCount === st.n && A.items.length === st.n && A.targetSec === st.n * st.spp, 'ส่วน A มี ' + st.n + ' ข้อ ขั้นเดียวกันทั้งหมด');
  ok(A.items.every(function (x) { return x.tag === st.id; }), 'ทุกข้อใน A เป็นขั้นเดียวกัน');
  ok(B.items.length === DAILY_B_COUNT && C.items.length === DAILY_C_COUNT, 'B/C มีข้อครบ');
  ok(B.items.every(function (x) { return x.cat === 'observe'; }), 'B เป็นหมวดการสังเกต');
  ok(C.items.every(function (x) { return x.cat === 'word' || x.cat === 'analytic'; }), 'C เป็นโจทย์ปัญหา/คิดวิเคราะห์');
  ok(C.items.some(function (x) { return x.key.indexOf('FIX:') === 0; }) && B.items.some(function (x) { return x.key.indexOf('FIX:') === 0; }), 'มีข้อจากคลังแทรกใน B และ C');
  var sigs = {}, dup = 0;
  d1.sections.forEach(function (s) { s.items.forEach(function (x) { if (sigs[x.sig]) dup++; sigs[x.sig] = 1; }); });
  ok(dup === 0, 'ในชุดเดียวกันต้องไม่มีโจทย์ซ้ำ (ซ้ำ ' + dup + ')');

  // ทบทวนแบบเว้นช่วง: ข้อที่ผิดกลับมาด้วยตัวเลขใหม่ แนวคิดเดิม
  setRng(mulberry32(7));
  var rv = [{ id: 'r1', key: 'GEN:AS02', cat: 'addsub' }, { id: 'r0', key: 'GEN:AS07', cat: 'addsub' }, { id: 'r2', key: 'TPL:W05', cat: 'word', tier: 2 }, { id: 'r3', key: 'TPL:O13', cat: 'observe', tier: 2 }, { id: 'r4', key: 'FIX:F40', cat: 'analytic' }];
  var d3 = buildDailySet(mkCtx({ reviews: rv }));
  var allItems = [].concat.apply([], d3.sections.map(function (s) { return s.items; }));
  var revItems = allItems.filter(function (x) { return x.review; });
  ok(revItems.length === 4, 'ข้อทบทวนต้องเข้ามาครบ 4 ข้อ (ได้ ' + revItems.length + ')');
  ok(revItems.some(function (x) { return x.key === 'GEN:AS02'; }) && revItems.some(function (x) { return x.key === 'TPL:W05'; }) && revItems.some(function (x) { return x.key === 'TPL:O13'; }), 'ทบทวนแนวคิดเดิม');
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
