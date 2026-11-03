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
    if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
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
  head(SH.daily, DAILY_HEAD, [95, 90, 100, 70], ['A']);
  head(SH.items, ITEM_HEAD, [95, 80, 50, 80, 110, 80, 220, 70, 70, 70, 70, 140, 60, 60, 50, 60, 360], ['A', 'E', 'F', 'G', 'Q']);
  var lv = head(SH.levels, LEVEL_HEAD, [190, 150, 330, 140, 150, 130, 100, 260], ['G']);
  if (!lv.getRange(2, 1).getValue()) {
    SKILLS.forEach(function (sk, i) { lv.getRange(2 + i, 1).setValue(SKILL_NAMES[sk]); });
    TIER_ROWS.forEach(function (t, i) { lv.getRange(6 + i, 1).setValue(t[0]); });
    var L0 = { tiers: { word: 2, observe: 2, analytic: 2 }, fails: {}, last: {} };
    SKILLS.forEach(function (sk) { L0[sk] = 1; L0.fails[sk] = 0; });
    writeLevels(L0);
    lv.getRange(10, 1).setValue('หมายเหตุ: ขั้นเริ่มต้นจะถูกกำหนดอัตโนมัติหลังทำแบบวัดระดับครบ 5 วัน — ผู้ปกครองแก้เลขในคอลัมน์ B เองได้ทุกเมื่อ').setFontColor('#5f6368');
  }
  head(SH.review, REVIEW_HEAD, [80, 110, 90, 70, 80, 90, 110, 110, 100, 130, 300], ['B', 'G', 'H', 'K']);
  head(SH.progress, PROGRESS_HEAD, [95, 110, 110, 110, 130, 80, 80, 80, 110], ['A']);
  head(SH.bench, BENCH_HEAD, [100, 100, 130, 60, 70, 70, 90], ['A', 'B']);
  getSheet(SH.report);
  // เรียงแท็บ และลบแท็บเปล่าเริ่มต้น
  [SH.settings, SH.daily, SH.levels, SH.progress, SH.report, SH.bank, SH.review, SH.items, SH.bench].forEach(function (n, i) {
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
