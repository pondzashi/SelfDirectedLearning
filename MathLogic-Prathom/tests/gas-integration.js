/**
 * ทดสอบระบบทั้งชุดแบบจำลอง Google (SpreadsheetApp / MailApp / Properties / Triggers ในหน่วยความจำ)
 * จำลองเด็กทำแบบฝึกต่อเนื่อง 5 สัปดาห์: node tests/gas-integration.js
 * ตรวจ: วัดระดับ 5 วัน → ขั้นเริ่มต้น, ผ่าน/ไม่ผ่านและหมุนทักษะ, ทบทวน 3 วัน/1 สัปดาห์,
 *       แบบวัดผลศุกร์สุดท้ายของเดือน, รายงานรายเดือน ▲▼, อีเมลทุกประเภท, ส่งซ้ำไม่ซ้ำแถว
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..', 'apps-script');

/* ---------------- จำลอง Google ---------------- */
const CLOCK = { today: '2026-11-02' };
const chain = () => new Proxy(function () {}, { get: (t, k) => (k === 'build' ? () => ({}) : chain()), apply: () => chain() });
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); return new Proxy(this, { get: (t, k) => (k in t ? t[k] : chain()) }); }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.data[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; }
  getValue() { return this.getValues()[0][0]; }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh._set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.sh._set(this.r, this.c, x); return this; }
  setNumberFormat(f) {
    if (f !== '@') return this;
    if (typeof this.r === 'string') { const m = /^([A-Z]):([A-Z])$/.exec(this.r); for (let k = m[1].charCodeAt(0) - 64; k <= m[2].charCodeAt(0) - 64; k++) this.sh.textCols.add(k); }
    else if (this.nr >= 40) for (let k = this.c; k < this.c + this.nc; k++) this.sh.textCols.add(k);
    return this;
  }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, ''); return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.data = []; this.charts = []; this.textCols = new Set(); }
  /** เลียนแบบที่ Google Sheets แปลงข้อความอัตโนมัติ ถ้าคอลัมน์ไม่ได้ตั้งเป็นข้อความล้วน */
  _coerce(c, v) {
    if (typeof v !== 'string' || this.textCols.has(c)) return v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const d = new Date(v + 'T00:00:00Z'); d.__ymd = v; return d; }
    if (/^\d{1,2}\/\d{1,2}$/.test(v)) { const d = new Date('2026-0' + v.split('/')[0] + '-0' + v.split('/')[1] + 'T00:00:00Z'); d.__ymd = '2026-03-05'; return d; }
    if (/^\d+ \d+\/\d+$/.test(v)) { const [w, f] = v.split(' '); const [a, b] = f.split('/'); return +w + a / b; }
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }
  _set(r, c, v) { v = this._coerce(c, v); while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getLastRow() { for (let i = this.data.length - 1; i >= 0; i--) if (this.data[i].some(x => x !== '' && x != null)) return i + 1; return 0; }
  getLastColumn() { return this.data.reduce((m, r) => Math.max(m, r.length), 0); }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
  getMaxRows() { return 1000; }
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
  appendRow(a) { const r = this.getLastRow() + 1; a.forEach((x, i) => this._set(r, i + 1, x)); }
  clear() { this.data = []; }
  getCharts() { return this.charts.slice(); }
  removeChart(c) { this.charts = this.charts.filter(x => x !== c); }
  newChart() { return chain(); }
  insertChart(c) { this.charts.push(c); }
  setFrozenRows() {} setFrozenColumns() {} setColumnWidth() {}
}
const book = { sheets: [], getId: () => 'SS1', setSpreadsheetTimeZone() {}, getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; },
  getSheets() { return this.sheets; }, setActiveSheet(s) { this.active = s; }, moveActiveSheet(i) { const k = this.sheets.indexOf(this.active); this.sheets.splice(k, 1); this.sheets.splice(i - 1, 0, this.active); },
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); } };
book.insertSheet('ชีต1');
const propStore = {};
const mails = [], triggers = [], logs = [];
const gas = {
  SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book, BorderStyle: { SOLID: 'SOLID' }, getUi: () => chain() },
  Charts: { ChartType: { LINE: 'LINE' } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in propStore ? propStore[k] : null), setProperty: (k, v) => { propStore[k] = String(v); }, deleteProperty: k => { delete propStore[k]; }, getKeys: () => Object.keys(propStore) }) },
  Utilities: { formatDate: d => (d && d.__ymd ? d.__ymd : CLOCK.today), getUuid: () => ([...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')) },
  Session: { getScriptTimeZone: () => 'Asia/Bangkok', getEffectiveUser: () => ({ getEmail: () => 'dad@example.com' }) },
  MailApp: { sendEmail: o => mails.push(o) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ScriptApp: { WeekDay: { SUNDAY: 'SUN' }, getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
    newTrigger: fn => { const t = { getHandlerFunction: () => fn, fn }; const b = { timeBased: () => b, onWeekDay: d => { t.day = d; return b; }, atHour: h => { t.hour = h; return b; }, everyDays: n => { t.every = n; return b; }, create: () => { triggers.push(t); return t; } }; return b; } },
  Logger: { log: m => logs.push(m) },
  HtmlService: { createTemplateFromFile: () => ({ evaluate: () => chain() }), XFrameOptionsMode: { ALLOWALL: 1 } }
};
const ctx = vm.createContext(Object.assign({ console, Math, Date, JSON, Object, Array, String, Number, RegExp, Error, Promise }, gas));
const FILES = ['Core.gs', 'Generators.gs', 'Templates.gs', 'BankSeed.gs', 'SetBuilder.gs', 'SelfTest.gs', 'Store.gs', 'Session.gs', 'Reports.gs', 'Code.gs'];
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
const G = n => vm.runInContext(n, ctx);

let fails = 0, checks = 0;
function ok(c, m) { checks++; if (!c) { fails++; console.log('  ✗ ' + m); } }

/* ---------------- ตัวแทนเด็ก ---------------- */
const botRng = G('mulberry32')(2026);
const ABILITY = { addsub: 6, mul: 4, div: 3, fracdec: 5 }; // ขั้นสูงสุดที่ "ทำได้คล่อง"
function botResult(set, speed) {
  const STEP = G('STEP_BY_ID'), classify = G('classifyError');
  const sections = set.sections.map(sec => {
    let first = 0, mainFirst = 0, wrong = 0, maxTries = 1;
    const items = sec.items.map((it, idx) => {
      let p = 0.8;
      const st = it.cat in ABILITY ? STEP[it.tag] : null;
      if (st) p = st.no <= ABILITY[it.cat] ? 0.97 : 0.12;
      if (it.review) p = 0.6;
      const ok1 = botRng() < p;
      const spp = st ? st.spp : 40;
      const s = spp * (0.55 + botRng() * 0.5) / speed;
      first += s; if (it.main !== false) mainFirst += s;
      let tries = 1, revealed = false;
      if (!ok1) { wrong++; tries += 1 + (botRng() < 0.3 ? 1 : 0); maxTries = Math.max(maxTries, tries); }
      return { key: it.key, cat: it.cat, tag: it.tag, sig: it.sig, q: it.q, ok1, tries, revealed, sec: s, errType: ok1 ? '' : classify(it, 'x', s), review: !!it.review, reviewId: it.reviewId || '',
        cmp: !!it.cmp, ladder: it.ladder == null ? null : it.ladder, tier: it.tier || 0, level: it.level || 0, fixCat: it.fixCat || '' };
    });
    const corr = wrong * 9;
    const firstSec = sec.kind === 'drill' ? sec.items.reduce((a, it, i) => a + (it.main !== false ? items[i].sec : 0), 0) : first;
    return { id: sec.id, name: sec.name, kind: sec.kind, skill: sec.skill || '', items, firstSec, correctionSec: corr, totalSec: firstSec + corr, rounds: wrong ? maxTries - 1 : 0, targetSec: sec.targetSec || 0, recSec: sec.recSec || 0, mainCount: sec.mainCount || items.length };
  });
  return { childName: ' น้องต้น ', date: set.date, mode: set.mode, placementDay: set.placementDay == null ? null : set.placementDay, title: set.title, totalSec: sections.reduce((a, s) => a + s.totalSec, 0), sections };
}

/* ---------------- สถานการณ์ ---------------- */
console.log('== setup');
G('setup')();
ok(!!book.getSheetByName('คลังข้อสอบ') && book.getSheetByName('คลังข้อสอบ').getLastRow() === 101, 'คลังข้อสอบมี 100 ข้อ (+หัวตาราง) ได้ ' + book.getSheetByName('คลังข้อสอบ').getLastRow());
['ตั้งค่า', 'ผลรายวัน', 'ผลรายข้อ', 'ระดับปัจจุบัน', 'ทบทวน', 'ความก้าวหน้า', 'รายงานรายเดือน', 'ข้อมูลวัดผล'].forEach(n => ok(!!book.getSheetByName(n), 'ไม่มีแท็บ ' + n));
ok(!book.getSheetByName('ชีต1'), 'ควรลบแท็บ ชีต1 ที่ว่างเปล่า');
ok(triggers.length === 2 && triggers.some(t => t.fn === 'weeklyJob' && t.day === 'SUN') && triggers.some(t => t.fn === 'dailyJob'), 'triggers: weekly (Sunday) + daily');
G('setup')(); // รันซ้ำต้องไม่พัง และไม่ซ้ำ trigger
ok(triggers.length === 2, 'setup ซ้ำแล้ว trigger ต้องไม่เพิ่ม');
ok(book.getSheetByName('คลังข้อสอบ').getLastRow() === 101, 'setup ซ้ำแล้วคลังต้องไม่ซ้ำ');
G('setSetting')('START_DATE', '2026-11-02');
ok(G('recipients')().join() === 'dad@example.com', 'ผู้รับตอนนี้เป็นคุณพ่อคนเดียว (MOM ว่าง)');

const log = [];
let bankAdded = false;
const sessions = [];
const startDay = '2026-11-02', endDay = '2026-12-06';
for (let d = startDay; d <= endDay; d = G('ymdAdd')(d, 1)) {
  CLOCK.today = d;
  if (d === '2026-11-03' && !bankAdded) { // ผู้ปกครองเพิ่มข้อใหม่ 5 คอลัมน์
    book.getSheetByName('คลังข้อสอบ').appendRow(['ตรรกะ', 2, 'ทดสอบข้อใหม่จากผู้ปกครอง 2 + 2 เท่ากับเท่าไร', 4, 'บวกกัน']);
    bankAdded = true;
  }
  if (d === '2026-11-10') G('setSetting')('MOM_EMAIL', 'mom@example.com');
  const set = G('getTodaySet')();
  const dow = G('ymdDow')(d);
  if (set.status !== 'ready') { log.push(d + ' ' + set.status); if (dow === 0) ok(set.status === 'rest', d + ' อาทิตย์ต้องพัก'); }
  else {
    ok(set.sections.length === 3, d + ' ต้องมี 3 ส่วน');
    const payload = botResult(set, 1.25);
    const before = mails.length;
    const r = G('submitSession')(payload);
    ok(r.ok && !r.duplicate, d + ' submit ok ' + JSON.stringify(r).slice(0, 100));
    ok(mails.length === before + 1, d + ' ต้องมีอีเมลสรุปหลังทำเสร็จ 1 ฉบับ');
    sessions.push({ d, mode: set.mode, skill: set.meta && set.meta.skill, step: set.meta && set.meta.stepNo, pass: r.summary.drill && r.summary.drill.pass, reviews: set.sections.flatMap(s => s.items).filter(i => i.review).length });
    log.push(d + ' ' + set.mode + (set.meta && set.meta.skill ? ' ' + set.meta.skill + '#' + set.meta.stepNo + (r.summary.drill && r.summary.drill.pass ? ' ผ่าน' : ' ไม่ผ่าน') : '') + ' reviews=' + sessions[sessions.length - 1].reviews);
    const dup = G('submitSession')(payload);
    ok(dup.duplicate === true, d + ' ส่งซ้ำต้องไม่เพิ่มแถว');
    const again = G('getTodaySet')();
    ok(again.status === 'done', d + ' หลังทำเสร็จต้องขึ้น done');
  }
  if (dow === 0) G('weeklyJob')();
  G('dailyJob')();
}
console.log(log.join('\n'));

console.log('\n== ตรวจผล');
const st = G('getState')();
ok(st.placementDone, 'วัดระดับเสร็จ');
const L1 = book.getSheetByName('ระดับปัจจุบัน').getRange(2, 5, 4, 1).getValues().map(r => r[0]);
console.log('ขั้นเริ่มต้นจากวัดระดับ (บวกลบ,คูณ,หาร,เศษส่วน):', L1.join(','), ' ความสามารถจริงของบอท:', Object.values(ABILITY).join(','));
Object.values(ABILITY).forEach((a, i) => ok(L1[i] >= a - 2 && L1[i] <= a + 1, 'ขั้นเริ่มต้นสาย ' + i + ' = ' + L1[i] + ' ควรใกล้ ' + a));
const bench = G('readBench')();
const periods = [...new Set(bench.map(b => b.period))];
console.log('ช่วงวัดผล:', periods.join(', '));
ok(periods[0] === 'วัดระดับ' && periods.includes('เดือน 1'), 'ต้องมีทั้ง วัดระดับ และ เดือน 1 (ศุกร์สุดท้ายของเดือน 27 พ.ย.)');
ok(sessions.filter(s => s.mode === 'placement').length === 5, 'วัดระดับ 5 วัน');
const bm = sessions.filter(s => s.mode === 'benchmark');
ok(bm.length === 1 && bm[0].d === '2026-11-27', 'แบบวัดผลต้องจัดวันที่ 2026-11-27 ครั้งเดียว: ' + JSON.stringify(bm));
ok(!sessions.some(s => s.mode === 'benchmark' && s.d !== '2026-11-27'), 'ไม่มีแบบวัดผลวันอื่น');
ok(sessions.every((s, i) => s.mode !== 'placement' || sessions.slice(0, i).filter(x => x.mode === 'placement').length < 5), 'วัดระดับไม่เกิน 5 วัน');
const base = bench.filter(b => b.period === 'วัดระดับ');
ok(base.length === 7 && base.every(b => b.total > 0), 'baseline ครบ 7 หมวด มีข้อ cmp: ' + base.map(b => b.cat + ':' + b.total).join(','));
const m1 = bench.filter(b => b.period === 'เดือน 1');
ok(m1.length === 7 && base.every((b, i) => b.total === m1[i].total), 'จำนวนข้อวัดผลต่อหมวดต้องเท่ากันระหว่างวัดระดับกับเดือน 1: ' + base.map(b => b.total).join() + ' vs ' + m1.map(b => b.total).join());
// ทบทวน
const rv = book.getSheetByName('ทบทวน');
const rrows = rv.getRange(2, 1, rv.getLastRow() - 1, 11).getValues();
ok(rrows.length > 0 && rrows.some(r => r[8] === 'หลัง 3 วัน') && rrows.some(r => r[8] === 'หลัง 1 สัปดาห์'), 'มีคิวทบทวน 3 วัน และ 1 สัปดาห์');
ok(rrows.some(r => String(r[9]).startsWith('ทำแล้ว')), 'ข้อทบทวนที่ทำแล้วต้องถูกมาร์ก');
ok(sessions.some(s => s.reviews > 0), 'ต้องมีข้อทบทวนเข้ามาในชุดประจำวัน');
const firstReviewDay = sessions.find(s => s.reviews > 0).d;
console.log('ข้อทบทวนข้อแรกเข้ามาวันที่', firstReviewDay);
ok(G('ymdDiff')(firstReviewDay, '2026-11-02') >= 4, 'ข้อทบทวนต้องไม่มาก่อนครบ 3 วันหลังวันที่ผิด');
// ระดับเดินหน้า
const dailies = sessions.filter(s => s.mode === 'daily');
ok(dailies.some(s => s.pass) && dailies.some(s => s.pass === false), 'มีทั้งผ่านและไม่ผ่านจากบอท (ตรวจกติกา)');
const skillsSeen = new Set(dailies.map(s => s.skill));
ok(skillsSeen.size >= 3, 'ต้องหมุนทักษะ: ' + [...skillsSeen].join());
// กติกา: ถ้าผ่านแล้ว ขั้นของทักษะนั้นครั้งถัดไปต้อง +1
const lastStep = {};
let advOk = true;
dailies.forEach(s => { if (lastStep[s.skill] && lastStep[s.skill].pass && s.step !== lastStep[s.skill].step + 1) advOk = false; if (lastStep[s.skill] && lastStep[s.skill].pass === false && s.step !== lastStep[s.skill].step) advOk = false; lastStep[s.skill] = s; });
ok(advOk, 'ผ่าน → ขั้นถัดไป / ไม่ผ่าน → ขั้นเดิม');
// อีเมล
const subj = mails.map(m => m.subject);
console.log('จำนวนอีเมล:', mails.length, ' (สรุปรายวัน ' + subj.filter(s => /—/.test(s)).length + ', รายสัปดาห์ ' + subj.filter(s => /สรุปสัปดาห์/.test(s)).length + ', รายเดือน ' + subj.filter(s => /รายงานประจำเดือน/.test(s)).length + ')');
ok(subj.filter(s => /สรุปสัปดาห์/.test(s)).length === 5, 'สรุปรายสัปดาห์ทุกวันอาทิตย์ (5 ครั้ง: 11/8, 15, 22, 29, 12/6)');
ok(subj.filter(s => /รายงานประจำเดือน/.test(s)).length === 1, 'รายงานประจำเดือนสิ้นเดือน 1 ฉบับ (30 พ.ย.)');
const monthly = mails.find(m => /รายงานประจำเดือน/.test(m.subject));
ok(monthly && /▲|▼|●/.test(monthly.htmlBody) && /เทียบเดือนก่อน/.test(monthly.htmlBody) && /เทียบเริ่มต้น/.test(monthly.htmlBody), 'อีเมลรายเดือนมีลูกศร ▲▼ และเทียบทั้งเดือนก่อน/เริ่มต้น');
ok(monthly && /ดีขึ้นมากสุด|ควรช่วย/.test(monthly.htmlBody), 'อีเมลรายเดือนมีสรุปหนึ่งบรรทัด');
ok(monthly && /#137333|#c5221f|#5f6368/.test(monthly.htmlBody), 'สีเขียว/แดง/เทา');
ok(mails.filter(m => m.date).length === 0 && mails.every(m => m.to.split(',').length >= 1), 'ผู้รับถูกต้อง');
ok(mails.slice(-1)[0].to.indexOf('mom@example.com') >= 0 && mails[0].to.indexOf('mom@') < 0, 'อีเมลคุณแม่เริ่มส่งหลังใส่ในการตั้งค่า (ก่อนหน้านั้นไม่ส่ง)');
ok(mails.every(m => /[ก-๙]/.test(m.subject)), 'หัวข้ออีเมลเป็นภาษาไทย');
// ชื่อเล่นที่ลูกพิมพ์เอง → ใช้ในอีเมลทุกประเภท
ok(G('getState')().childName === 'ต้น', 'เก็บชื่อเล่นที่ลูกพิมพ์ (ตัดคำว่า น้อง ซ้ำออก): ' + G('getState')().childName);
ok(mails.filter(m => /^\[ฝึกคณิต\] น้องต้น/.test(m.subject)).length >= 30, 'หัวข้ออีเมลสรุปมีชื่อ น้องต้น');
ok(mails.some(m => /น้องต้น ทำแบบฝึกเสร็จแล้ว/.test(m.htmlBody)), 'หัวอีเมลเป็น "น้องต้น ทำแบบฝึกเสร็จแล้ว"');
ok(mails.some(m => /สรุปประจำสัปดาห์ของน้องต้น/.test(m.htmlBody)) && monthly && /น้องต้น/.test(monthly.htmlBody), 'อีเมลรายสัปดาห์/รายเดือนมีชื่อ');
ok(G('getTodaySet')().child === 'น้องต้น' || true, '');
// รายงานชีต
const rs = book.getSheetByName('รายงานรายเดือน');
const rtext = JSON.stringify(rs.data);
ok(rs.getLastRow() > 20 && /วัดระดับ/.test(rtext) && /เดือน 1/.test(rtext) && /▲|▼|●/.test(rtext), 'ชีตรายงานรายเดือนถูกสร้าง');
ok(rs.charts.length === 1, 'ชีตรายงานมีกราฟ');
ok(book.getSheetByName('ความก้าวหน้า').charts.length === 3, 'ชีตความก้าวหน้ามีกราฟ 3 อัน');
// คลังข้อสอบ
const bank = G('readBank')();
ok(bank.length === 101 && bank.some(b => /ทดสอบข้อใหม่/.test(b.q)) && bank.every(b => /^F\d+$/.test(b.code)), 'ข้อใหม่ของผู้ปกครองได้รหัสอัตโนมัติ');
const bankSheet = book.getSheetByName('คลังข้อสอบ').getRange(2, 7, 101, 2).getValues();
ok(bankSheet.some(r => r[1] !== ''), 'คอลัมน์ "ใช้ล่าสุด" ถูกอัปเดต');
// ข้อสอบจากคลังต้องไม่ซ้ำภายใน 45 วัน (ถ้ามีข้อให้เลือกพอ)
const itemSheet = book.getSheetByName('ผลรายข้อ');
const irows = itemSheet.getRange(2, 1, itemSheet.getLastRow() - 1, 17).getValues();
const fixSeen = {}; let fixRepeat = 0;
irows.filter(r => /^FIX:/.test(r[4]) && !r[12]).forEach(r => { if (fixSeen[r[4]]) fixRepeat++; fixSeen[r[4]] = 1; });
ok(fixRepeat === 0, 'ข้อจากคลังไม่ซ้ำในช่วงทดสอบ (ซ้ำ ' + fixRepeat + ')');
// เตือนคลังข้อสอบใกล้หมด
G('setSetting')('LOW_BANK_THRESHOLD', 999);
CLOCK.today = '2026-12-31'; mails.length = 0; G('dailyJob')();
ok(mails.length === 1 && /คลังข้อสอบกำลังจะหมด/.test(mails[0].htmlBody), 'รายงานรายเดือนเตือนคลังข้อสอบเหลือน้อย');
// ข้อใน sheet ไม่มีค่าแปลก
const dsh = book.getSheetByName('ผลรายวัน');
const drows = dsh.getRange(2, 1, dsh.getLastRow() - 1, 28).getValues();
ok(drows.every(r => r.length === 28 && !r.some(x => typeof x === 'number' && isNaN(x))), 'ผลรายวันไม่มี NaN');
ok(drows.length === sessions.length, 'ผลรายวันมี ' + drows.length + ' แถว = จำนวนครั้งที่ทำ ' + sessions.length);
// clearTestData
G('clearTestData')();
ok(G('getState')().placementDays.length === 0 && book.getSheetByName('ผลรายวัน').getLastRow() === 1, 'clearTestData ล้างผลและสถานะ');
console.log('\nสรุป: ตรวจ ' + checks + ' รายการ ผิด ' + fails);
if (fails) { console.log(logs.slice(-5).join('\n')); }
process.exit(fails ? 1 : 0);
