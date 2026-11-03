/**
 * Setup.gs — โครงสร้างแท็บ, ค่าเริ่มต้น, เมนูใน Google Sheet
 * ชื่อคอลัมน์ต้องตรงกับ docs/spec.md §3 (โค้ดอ้างตามชื่อ ไม่ใช่ตำแหน่ง)
 */

var SCHEMA = {
  Questions: ['id', 'subject', 'skill', 'difficulty', 'cognitive', 'group_id', 'passage', 'stem',
    'choice_a', 'choice_b', 'choice_c', 'choice_d', 'image_url', 'answer', 'explanation',
    'why_a', 'why_b', 'why_c', 'why_d', 'takeaway', 'explanation_image_url', 'fact_date', 'status', 'source'],
  Sessions: ['session_id', 'token', 'status', 'mode', 'subjects', 'config_json', 'label', 'issued_at',
    'started_at', 'started_ms', 'plan_json', 'current_idx', 'last_event_ms', 'submitted_at', 'submitted_ms',
    'submit_reason', 'tab_switches', 'reveal_policy', 'review_released', 'ans_row_start', 'ans_count',
    'score_pct', 'n_correct', 'n_wrong', 'n_skipped', 'n_total', 'used_sec'],
  Answers: ['answer_key', 'session_id', 'question_id', 'subject', 'skill', 'difficulty', 'position',
    'subject_idx', 'option_order', 'correct', 'chosen', 'is_correct', 'flagged', 'skipped',
    'time_spent_ms', 'visits', 'answered_at', 'updated_at', 'late_rejected'],
  Results: ['result_id', 'session_id', 'mode', 'subject', 'skill', 'finished_at', 'finished_ms',
    'n_total', 'n_correct', 'n_wrong', 'n_skipped', 'pct', 'avg_time_sec',
    'd1_n', 'd1_correct', 'd2_n', 'd2_correct', 'd3_n', 'd3_correct'],
  Settings: ['key', 'value', 'note'],
  Reports: ['report_id', 'created_at', 'session_id', 'question_id', 'chosen', 'reason', 'status',
    'resolution_note', 'resolved_at']
};

var DEFAULT_SETTINGS = [
  ['exam_title', 'Pre-test ม.4 เอกสายศิลปะ', 'ชื่อที่แสดง (เปลี่ยนเป็นชื่อเอกจริงได้)'],
  ['owner_email', '', 'อีเมล Google ของผู้ปกครอง (เข้า Dashboard ได้เฉพาะอีเมลนี้)'],
  ['parent_pin', '', 'รหัสสำรองสำหรับเข้า Dashboard (ใช้เมื่อเช็คอีเมลไม่ได้) เว้นว่างถ้าไม่ใช้'],
  ['subject_labels', 'english=อังกฤษ;thai_social=ไทยและสังคม;art=ความถนัดศิลป์', 'ชื่อไทยของแต่ละวิชา'],
  ['duration_min_english', 40, 'เวลาสอบวิชาอังกฤษ (นาที)'],
  ['duration_min_thai_social', 40, 'เวลาสอบวิชาไทยและสังคม (นาที)'],
  ['duration_min_art', 50, 'เวลาสอบวิชาความถนัดศิลป์ (นาที)'],
  ['blueprint_english', 'Vocabulary=10;Grammar=12;Reading=12;Error Identification=6', 'จำนวนข้อต่อทักษะ'],
  ['blueprint_thai_social', 'อักขรวิธี=10;จับใจความ=10;ความรู้ทั่วไปทางศิลปะ=8;ประวัติศาสตร์ศิลป์=6;ข่าวปัจจุบัน=6', 'จำนวนข้อต่อทักษะ'],
  ['blueprint_art', 'ทฤษฎีสี=12;องค์ประกอบภาพ=10;ทัศนธาตุและหลักการออกแบบ=10;โลโก้และไอคอน=8', 'จำนวนข้อต่อทักษะ'],
  ['difficulty_mix', '1=30;2=45;3=25', 'สัดส่วนความยากเป้าหมาย (%) ง่าย/กลาง/ยาก'],
  ['grace_sec', 5, 'เผื่อเวลาให้ server ยังรับคำตอบหลังหมดเวลา (วินาที)'],
  ['warn_minutes', '5,1', 'แจ้งเตือนตอนเหลือกี่นาที'],
  ['color_green_min', 80, '🟢 เมื่อ % ตั้งแต่ค่านี้ขึ้นไป'],
  ['color_yellow_min', 60, '🟡 เมื่อ % ตั้งแต่ค่านี้ขึ้นไป (ต่ำกว่า = 🔴)'],
  ['recency_decay', 0.7, 'น้ำหนักของรอบก่อนหน้า (รอบล่าสุด = 1, ถัดไป = ค่านี้, ถัดไปอีก = ค่านี้²)'],
  ['recency_max_sessions', 5, 'จำนวนรอบย้อนหลังที่นำมาคิด % ต่อทักษะ'],
  ['avoid_recent_sessions', 2, 'เลี่ยงข้อที่ปรากฏใน N รอบล่าสุด'],
  ['reveal_policy', 'parent_release', 'immediate = ลูกเห็นเฉลยทันทีหลังสอบ / parent_release = รอผู้ปกครองเปิดให้'],
  ['drill_default_total', 15, 'จำนวนข้อ Drill อัตโนมัติ'],
  ['drill_sec_per_question', 60, 'เวลาต่อข้อใน Drill (วินาที)'],
  ['drill_min_per_skill', 2, 'ขั้นต่ำต่อทักษะใน Drill อัตโนมัติ'],
  ['skill_include_drill', false, 'TRUE = รวมผล Drill ในคะแนนทักษะ'],
  ['flagged_policy', 'keep', 'keep = ข้อที่ถูกแจ้งผิดยังออกสอบต่อ / exclude = พักไว้'],
  ['images_folder_id', '', 'ID โฟลเดอร์ Google Drive ที่เก็บรูป (ใช้กับ image_url แบบ drive:<ชื่อไฟล์หรือ fileId>)']
];

/** คอลัมน์ที่เป็นข้อความล้วน (กัน Sheets แปลงเป็นวันที่/ตัวเลข) */
var TEXT_COLUMNS = {
  Questions: ['id', 'group_id', 'answer', 'fact_date'],
  Sessions: ['session_id', 'token'],
  Answers: ['answer_key', 'session_id', 'question_id', 'option_order', 'correct', 'chosen'],
  Results: ['result_id', 'session_id'],
  Reports: ['report_id', 'session_id', 'question_id']
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Pre-test')
    .addItem('1. เตรียมระบบ (สร้างแท็บ/ค่าเริ่มต้น)', 'menuSetup')
    .addItem('2. นำเข้าคลังข้อสอบที่แนบมา (Bank*.gs)', 'menuImportBank')
    .addItem('ตรวจคลังข้อสอบ', 'menuValidate')
    .addItem('3. ติดตั้งตัวตั้งเวลา (ปิดการสอบที่หมดเวลา)', 'menuInstallTrigger')
    .addItem('ล้างแคชข้อสอบ', 'menuClearCache')
    .addItem('แสดงลิงก์ Web App', 'menuShowUrl')
    .addToUi();
}

/** สร้างแท็บที่ขาด ใส่หัวคอลัมน์ ใส่ค่าเริ่มต้นใน Settings (ไม่ทับค่าที่มีอยู่) */
function setupSheets_(ss) {
  var created = [];
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); created.push(name); }
    var headers = SCHEMA[name];
    ensureSize_(sh, 2, headers.length);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold'); } catch (e) { /* ไม่สำคัญ */ }
    }
    var tc = TEXT_COLUMNS[name] || [];
    var row1 = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn())).getValues()[0];
    tc.forEach(function (h) {
      var ci = row1.indexOf(h);
      if (ci >= 0) { try { sh.getRange(1, ci + 1, sh.getMaxRows(), 1).setNumberFormat('@'); } catch (e) { /* ไม่สำคัญ */ } }
    });
  });
  var st = ss.getSheetByName('Settings');
  var have = {};
  if (st.getLastRow() > 1) {
    st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().forEach(function (r) { have[String(r[0])] = true; });
  }
  var add = DEFAULT_SETTINGS.filter(function (d) { return !have[d[0]]; });
  if (add.length) {
    ensureSize_(st, st.getLastRow() + add.length, 3);
    st.getRange(st.getLastRow() + 1, 1, add.length, 3).setValues(add);
  }
  return created;
}

function menuSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  var created = setupSheets_(ss);
  var email = '';
  try { email = Session.getEffectiveUser().getEmail(); } catch (e) { /* ว่างได้ */ }
  var me = getSettingRow_(ss, 'owner_email');
  if (email && me && !me.value) ss.getSheetByName('Settings').getRange(me.row, 2).setValue(email);
  SpreadsheetApp.getUi().alert('เตรียมระบบเสร็จ' + (created.length ? '\nสร้างแท็บ: ' + created.join(', ') : '\n(แท็บครบแล้ว)') +
    '\n\nขั้นต่อไป: ตรวจค่าในแท็บ Settings (owner_email) แล้ววางข้อสอบต่อท้ายแท็บ Questions');
}

function getSettingRow_(ss, key) {
  var st = ss.getSheetByName('Settings');
  if (!st || st.getLastRow() < 2) return null;
  var vals = st.getRange(2, 1, st.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === key) return { row: i + 2, value: vals[i][1] };
  return null;
}

function menuValidate() {
  var rep = validateQuestions_(loadQuestionsRaw_());
  var msg = 'ข้อสอบทั้งหมด ' + rep.total + ' ข้อ  ใช้ได้ ' + rep.ok + ' ข้อ';
  if (rep.errors.length) msg += '\n\nปัญหา (' + rep.errors.length + '):\n' + rep.errors.slice(0, 25).join('\n');
  msg += '\n\nจำนวนข้อต่อทักษะ (เฉพาะ active):\n' + Object.keys(rep.perSkill).map(function (k) { return k + ': ' + rep.perSkill[k]; }).join('\n');
  SpreadsheetApp.getUi().alert(msg);
}

function menuImportBank() {
  var res = importBundledBank_();
  SpreadsheetApp.getUi().alert(res.message);
}

/** นำเข้าข้อสอบจากไฟล์ Bank*.gs (สร้างด้วย tools/build-bank-gs.js) เฉพาะ id ที่ยังไม่มีในแท็บ Questions */
function importBundledBank_() {
  if (typeof BANK_HEADERS === 'undefined') return { added: 0, message: 'ไม่พบไฟล์ Bank*.gs ในโปรเจกต์' };
  var sh = sheet_('Questions');
  var headers = headersOf_(sh);
  var have = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, headers.indexOf('id') + 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { have[String(r[0]).trim()] = true; });
  }
  var objs = [], skipped = 0;
  for (var i = 1; i <= BANK_PART_COUNT; i++) {
    globalThis['bankPart' + i + '_']().forEach(function (row) {
      var o = {};
      BANK_HEADERS.forEach(function (h, j) { o[h] = row[j]; });
      if (have[o.id]) { skipped++; return; }
      o.difficulty = Number(o.difficulty);
      have[o.id] = true;
      objs.push(o);
    });
  }
  appendRows_('Questions', objs);
  clearQuestionCache_();
  var rep = validateQuestions_(loadQuestionsRaw_());
  return { added: objs.length, skipped: skipped,
    message: 'นำเข้าแล้ว ' + objs.length + ' ข้อ' + (skipped ? ' (ข้าม ' + skipped + ' ข้อที่มีอยู่แล้ว)' : '') +
      '\nคลังทั้งหมด ' + rep.total + ' ข้อ ใช้ได้ ' + rep.ok + ' ข้อ' + (rep.errors.length ? '\nมีปัญหา ' + rep.errors.length + ' แถว (ดูเมนู ตรวจคลังข้อสอบ)' : '') };
}

function menuInstallTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sweepExpiredSessions') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sweepExpiredSessions').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert('ติดตั้งตัวตั้งเวลาแล้ว (ตรวจทุก 5 นาที)');
}

function menuClearCache() {
  clearQuestionCache_();
  SpreadsheetApp.getUi().alert('ล้างแคชแล้ว');
}

function menuShowUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url ? 'ลิงก์ Web App:\n' + url + '\n\nDashboard: ' + url + '?page=dashboard' :
    'ยังไม่ได้ Deploy เป็น Web App — ดู README ขั้นตอนที่ 5');
}

/**
 * ตรวจคลังข้อสอบ: คืน {total, ok, errors[], perSkill{}}
 * raw = แถวดิบจากชีต (object ต่อแถว)
 */
function validateQuestions_(raw) {
  var errors = [], seen = {}, ok = 0, perSkill = {};
  raw.forEach(function (r) {
    var id = String(r.id || '').trim();
    var where = 'แถว ' + r.__row + ' (' + (id || 'ไม่มี id') + ')';
    if (!id) { errors.push(where + ': ไม่มี id'); return; }
    if (seen[id]) { errors.push(where + ': id ซ้ำกับแถว ' + seen[id]); return; }
    seen[id] = r.__row;
    var subject = String(r.subject || '').trim();
    var skill = String(r.skill || '').trim();
    var ans = String(r.answer || '').trim().toUpperCase();
    var diff = Number(r.difficulty);
    var bad = [];
    if (SUBJECTS.indexOf(subject) < 0) bad.push('subject ไม่ถูกต้อง "' + subject + '"');
    else if ((SKILLS[subject] || []).indexOf(skill) < 0) bad.push('skill "' + skill + '" ไม่อยู่ในวิชา ' + subject);
    if (LETTERS.indexOf(ans) < 0) bad.push('answer ต้องเป็น A-D');
    if (!(diff >= 1 && diff <= 3)) bad.push('difficulty ต้องเป็น 1-3');
    if (!String(r.stem || '').trim()) bad.push('ไม่มีโจทย์');
    ['choice_a', 'choice_b', 'choice_c', 'choice_d'].forEach(function (c) {
      if (!String(r[c] == null ? '' : r[c]).trim()) bad.push('ไม่มี ' + c);
    });
    if (!String(r.explanation || '').trim()) bad.push('ไม่มีคำอธิบาย');
    if (bad.length) { errors.push(where + ': ' + bad.join(', ')); return; }
    ok++;
    var st = String(r.status || 'active').trim().toLowerCase();
    if (st === 'active' || st === '') perSkill[subject + '/' + skill] = (perSkill[subject + '/' + skill] || 0) + 1;
  });
  return { total: raw.length, ok: ok, errors: errors, perSkill: perSkill };
}
