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
