/**
 * ทดสอบ DashLogic (ตรรกะของ Dashboard ผู้ปกครอง): node tests/dash-tests.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..', 'apps-script');
const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number, RegExp, Error });
for (const f of ['Core.gs', 'Generators.gs', 'Templates.gs', 'BankSeed.gs', 'SetBuilder.gs', 'DashLogic.gs']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
const G = (n) => vm.runInContext(n, ctx);
let fails = 0, checks = 0;
function ok(c, m) { checks++; if (!c) { fails++; console.log('  ✗ ' + m); } }

const row = (date, mode, pass, aR, aT, extra) => {
  const r = Array(28).fill('');
  r[0] = date; r[1] = mode; r[2] = 'บวกลบ'; r[3] = 'ขั้น 3'; r[4] = aR; r[5] = aT; r[6] = 100; r[7] = (extra && extra.totalSec) || 120; r[8] = 150; r[9] = 0;
  r[11] = pass; r[12] = 3; r[13] = 4; r[19] = 2; r[20] = 5; r[26] = 28; r[27] = 'x';
  return r;
};
const list = G('dashDailyList')([row('2026-11-04', 'ประจำวัน', 'ไม่ผ่าน', 18, 25, { totalSec: 300 }), row('2026-11-03', 'ประจำวัน', 'ผ่าน', 25, 25)]);
ok(list[0].date === '2026-11-03' && list[1].aPct === 72 && list[0].aPct === 100 && list[1].ratio === 200 && list[0].bPct === 75 && list[0].cPct === 40, 'dashDailyList: เรียงวันที่ + คำนวณ %/อัตราเวลา');

const ds = (arr) => Object.fromEntries(arr.map((d) => [d, true]));
const pd = [1, 2, 3, 4, 5, 6]; // จันทร์–เสาร์
ok(G('dashStreak')(ds(['2026-11-02', '2026-11-03', '2026-11-04']), '2026-11-04', pd) === 3, 'streak นับต่อเนื่อง 3 วัน');
ok(G('dashStreak')(ds(['2026-11-02', '2026-11-03']), '2026-11-04', pd) === 2, 'streak: วันนี้ยังไม่ทำ ไม่ทำให้ขาด');
ok(G('dashStreak')(ds(['2026-11-02', '2026-11-04']), '2026-11-04', pd) === 1, 'streak: ขาดวันกลางแล้วนับใหม่');
ok(G('dashStreak')(ds(['2026-11-07', '2026-11-09']), '2026-11-09', pd) === 2, 'streak: ข้ามวันอาทิตย์ (พัก) ได้');
ok(G('dashStreak')({}, '2026-11-09', pd) === 0, 'streak: ไม่มีข้อมูล = 0');
ok(G('dashMissed')(ds(['2026-11-02']), '2026-11-02', '2026-11-05', pd) === 2, 'missed: พลาด 2 วันฝึกติดกัน');
ok(G('dashMissed')(ds(['2026-11-04']), '2026-11-02', '2026-11-05', pd) === 0, 'missed: เมื่อวานทำแล้ว = 0');
ok(G('dashMissed')({}, '2026-11-09', '2026-11-09', pd) === 0, 'missed: วันเริ่มคือวันนี้ = 0');
ok(G('dashMissed')({}, '2026-11-02', '2026-11-09', pd) === 6, 'missed: ข้ามวันอาทิตย์ (นับเฉพาะวันฝึก)');

const cal = G('dashCalendar')({ '2026-11-02': 'ผ่าน', '2026-11-03': 'ไม่ผ่าน', '2026-11-04': '-' }, '2026-11-06', '2026-11-02', pd, 2);
const st = (d) => cal.find((c) => c.date === d).status;
ok(cal.length === 14 && cal[0].dow === 0 && cal[13].dow === 6, 'calendar: 2 สัปดาห์ อาทิตย์–เสาร์');
ok(st('2026-11-02') === 'pass' && st('2026-11-03') === 'fail' && st('2026-11-04') === 'done' && st('2026-11-05') === 'miss' && st('2026-11-06') === 'today' && st('2026-11-07') === 'future' && st('2026-11-01') === 'before', 'calendar: สถานะแต่ละวัน');
ok(G('dashCalendar')({}, '2026-11-08', '2026-11-02', pd, 1).find((c) => c.date === '2026-11-08').status === 'today', 'calendar: วันนี้ที่เป็นวันพักก็ขึ้น today');
ok(G('dashColor')(90, 85, 60) === 'green' && G('dashColor')(70, 85, 60) === 'yellow' && G('dashColor')(10, 85, 60) === 'red' && G('dashColor')(null, 85, 60) === 'none', 'dashColor');

const items = [];
const it = (date, cat, key, ok1, err, q) => { const r = Array(17).fill(''); r[0] = date; r[3] = cat; r[4] = key; r[7] = ok1; r[11] = err; r[16] = q; items.push(r); };
for (let i = 0; i < 5; i++) it('2026-11-04', 'mul', 'GEN:MU04', i < 2 ? 1 : 0, i < 2 ? '' : 'ทดผิด/ลืมทด', '23 × 4 =');
for (let i = 0; i < 4; i++) it('2026-11-04', 'word', 'TPL:W01', 1, '', 'ซื้อของ');
it('2026-10-01', 'mul', 'GEN:MU04', 0, 'เก่า', 'เก่า');
const es = G('dashErrorStats')(items, '2026-10-20');
ok(es.total === 9 && es.wrong === 3 && es.types.length === 1 && es.types[0].type === 'ทดผิด/ลืมทด' && es.types[0].n === 3, 'errorStats: นับเฉพาะช่วงวันที่ + ประเภท');
ok(es.cats[0].cat === 'mul' && es.cats[0].pctWrong === 60 && es.tags.length === 1 && /คูณ ขั้น 4/.test(es.tags[0].label) && es.tags[0].sample === '23 × 4 =', 'errorStats: หมวดที่พลาดบ่อยสุด + ป้ายขั้น');

const base = { startDate: '2026-11-02', today: '2026-11-05', placement: { done: true, days: 5, of: 5 }, fails: { addsub: 3, mul: 0, div: 0, fracdec: 0 }, levels: { addsub: 4, mul: 1, div: 1, fracdec: 1 },
  maxRepeats: 3, missed: 2, list: [], yellow: 60, dueReviews: 9, lowBank: [{ cat: 'สังเกต', fresh: 2 }], streak: 6, todayDone: true, todayPass: 'ผ่าน' };
const al = G('dashAlerts')(base), txt = al.map((a) => a.text).join('|');
ok(/ติดขั้นเดิมของบวกลบ/.test(txt) && /ไม่ได้ฝึกมา 2 วัน/.test(txt) && /ข้อทบทวนครบกำหนด 9/.test(txt) && /คลังข้อสอบหมวด "สังเกต"/.test(txt) && /ติดต่อกัน 6 วัน/.test(txt) && /วันนี้ลูกทำเสร็จแล้ว/.test(txt), 'alerts: ครบทุกประเภท');
ok(al.filter((a) => a.level === 'warn').length === 3 && al.filter((a) => a.level === 'good').length === 2, 'alerts: ระดับ warn/good ถูกต้อง');
ok(G('dashAlerts')(Object.assign({}, base, { startDate: '' })).some((a) => /ยังไม่ได้ตั้งวันเริ่ม/.test(a.text)), 'alerts: ยังไม่ตั้ง START_DATE');
const bad = [1, 2, 3].map((i) => G('dashDailyList')([row('2026-11-0' + i, 'ประจำวัน', 'ไม่ผ่าน', 10, 25, { totalSec: 400 })])[0]);
const al2 = G('dashAlerts')(Object.assign({}, base, { list: bad, fails: {}, missed: 0, dueReviews: 0, lowBank: [], streak: 0, todayDone: false })).map((a) => a.text).join('|');
ok(/ความแม่นยำส่วน A 3 ครั้งล่าสุด/.test(al2) && /เกิน 150%/.test(al2), 'alerts: แม่นยำต่ำ/ช้าเกินติดกัน');

const sp = G('dashSkillProgress')({ addsub: 6, mul: 1, div: 11, fracdec: 15, fails: { addsub: 1 }, tiers: {} });
ok(sp[0].pct === 42 && sp[0].total === 12 && sp[0].stepName && sp[2].pct === 91 && sp[3].pct === 93 && sp[0].fails === 1, 'skillProgress: % ของจำนวนขั้นทั้งหมด');
const ser = G('dashSeries')([['2026-11-03', 80, 50, '', 90, 1, 1, 1, 1], ['2026-11-04', 90, 60, 70, '', 2, 1, 1, 1]]);
ok(ser.dates.length === 2 && ser.c[0] === null && ser.ratio[1] === null && ser.steps.addsub[1] === 2 && ser.a[1] === 90, 'series: ค่าว่างเป็น null');
const rd = G('dashRadar')({ periods: [{ label: 'วัดระดับ' }, { label: 'เดือน 1' }], cats: [{ cat: 'mul', name: 'คูณ', pcts: [50, 70] }, { cat: 'div', name: 'หาร', pcts: [40, null] }] });
ok(rd[0].base === 50 && rd[0].cur === 70 && rd[1].cur === null, 'radar: ตอนเริ่ม vs ล่าสุด');
const ms = G('dashMonthStats')(G('dashDailyList')([row('2026-11-03', 'ประจำวัน', 'ผ่าน', 25, 25), row('2026-11-04', 'ประจำวัน', 'ไม่ผ่าน', 15, 25), row('2026-10-30', 'ประจำวัน', 'ผ่าน', 25, 25)]), '2026-11');
ok(ms.days === 2 && ms.passN === 1 && ms.avgA === 80, 'monthStats');
ok(G('dashTagLabel')('TPL:O13') === 'การสังเกต · แบบ O13' && /หาร ขั้น 3/.test(G('dashTagLabel')('GEN:DV03')) && G('dashTagLabel')('FIX:F012') === 'ข้อจากคลังข้อสอบ F012', 'tagLabel');

console.log('DashLogic: ตรวจ ' + checks + ' รายการ ผิด ' + fails);
process.exit(fails ? 1 : 0);
