/**
 * Db.gs — อ่าน/เขียน Google Sheet, Settings, คลังข้อสอบ
 */

var __ss = null;

function nowMs_() { return Date.now(); }

function ss_() {
  if (__ss) return __ss;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) __ss = SpreadsheetApp.openById(id);
  else __ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!__ss) throw new Error('ยังไม่ได้เตรียมระบบ: เปิด Google Sheet แล้วเลือกเมนู Pre-test › เตรียมระบบ');
  return __ss;
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบแท็บ ' + name + ' (เลือกเมนู Pre-test › เตรียมระบบ)');
  return sh;
}

function toMs_(v) {
  if (v instanceof Date) return v.getTime();
  var n = Number(v);
  return isNaN(n) || v === '' || v === null ? null : n;
}
function toBool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function toNumber_(v, d) { var n = Number(v); return (v === '' || v === null || isNaN(n)) ? d : n; }
function str_(v) { return v == null ? '' : (v instanceof Date ? Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd') : String(v)); }

/** ชีตจริงมีขนาดจำกัด (เริ่ม 1000 แถว × 26 คอลัมน์) getRange เกินขอบจะ error จึงต้องขยายก่อนเขียน */
function ensureSize_(sh, rows, cols) {
  var mr = sh.getMaxRows(), mc = sh.getMaxColumns();
  if (rows > mr) sh.insertRowsAfter(mr, rows - mr + 500);
  if (cols > mc) sh.insertColumnsAfter(mc, cols - mc);
}

function headersOf_(sh) {
  var n = sh.getLastColumn();
  return sh.getRange(1, 1, 1, n).getValues()[0].map(String);
}

function rowToObj_(headers, arr, rowNum) {
  var o = { __row: rowNum };
  for (var i = 0; i < headers.length; i++) o[headers[i]] = arr[i];
  return o;
}

function objToRow_(headers, obj) {
  return headers.map(function (h) { var v = obj[h]; return v === undefined || v === null ? '' : v; });
}

/** อ่านทั้งแท็บเป็น array ของ object (มี __row = เลขแถวจริง) */
function readTable_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var headers = headersOf_(sh);
  var vals = sh.getRange(2, 1, last - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) out.push(rowToObj_(headers, vals[i], i + 2));
  return out;
}

/** อ่านช่วงแถว [startRow, startRow+count) */
function readRows_(name, startRow, count) {
  if (!count) return [];
  var sh = sheet_(name);
  var headers = headersOf_(sh);
  var vals = sh.getRange(startRow, 1, count, headers.length).getValues();
  return vals.map(function (v, i) { return rowToObj_(headers, v, startRow + i); });
}

function readRow_(name, rowNum) { return readRows_(name, rowNum, 1)[0]; }

/** เขียนทับทั้งแถว (obj ต้องมีทุกฟิลด์ที่ต้องการเก็บ) */
function writeRow_(name, rowNum, obj) {
  var sh = sheet_(name);
  var headers = headersOf_(sh);
  ensureSize_(sh, rowNum, headers.length);
  sh.getRange(rowNum, 1, 1, headers.length).setValues([objToRow_(headers, obj)]);
}

/** แก้บางฟิลด์ของแถว */
function patchRow_(name, rowNum, patch) {
  var cur = readRow_(name, rowNum);
  Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
  writeRow_(name, rowNum, cur);
  return cur;
}

/** ต่อท้ายหลายแถว คืนเลขแถวแรกที่เขียน */
function appendRows_(name, objs) {
  if (!objs.length) return null;
  var sh = sheet_(name);
  var headers = headersOf_(sh);
  var start = sh.getLastRow() + 1;
  ensureSize_(sh, start + objs.length - 1, headers.length);
  sh.getRange(start, 1, objs.length, headers.length).setValues(objs.map(function (o) { return objToRow_(headers, o); }));
  return start;
}

/** เขียนค่าทั้งคอลัมน์ในช่วงแถว (ใช้อัปเดต is_correct พร้อมกัน) */
function writeColumn_(name, colName, startRow, values) {
  var sh = sheet_(name);
  var ci = headersOf_(sh).indexOf(colName);
  if (ci < 0 || !values.length) return;
  sh.getRange(startRow, ci + 1, values.length, 1).setValues(values.map(function (v) { return [v]; }));
}

// ---------------------------------------------------------------- Settings

var __settings = null;

function settings_() {
  if (__settings) return __settings;
  var s = {};
  DEFAULT_SETTINGS.forEach(function (d) { s[d[0]] = d[1]; });
  try {
    readTable_('Settings').forEach(function (r) {
      var k = String(r.key || '').trim();
      if (k && r.value !== '' && r.value !== null) s[k] = r.value;
    });
  } catch (e) { /* ใช้ค่าเริ่มต้น */ }
  __settings = s;
  return s;
}

function setSetting_(key, value) {
  var rows = readTable_('Settings');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].key) === key) { patchRow_('Settings', rows[i].__row, { value: value }); __settings = null; return; }
  }
  appendRows_('Settings', [{ key: key, value: value, note: '' }]);
  __settings = null;
}

function subjectLabels_() {
  var m = {};
  parseKV_(settings_().subject_labels).forEach(function (p) { m[p[0]] = p[1]; });
  SUBJECTS.forEach(function (s) { if (!m[s]) m[s] = s; });
  return m;
}

function durationMin_(subject) { return toNumber_(settings_()['duration_min_' + subject], 40); }

function blueprint_(subject) {
  return parseKV_(settings_()['blueprint_' + subject]).map(function (p) { return [p[0], toNumber_(p[1], 0)]; });
}

function mix_() {
  var m = {};
  parseKV_(settings_().difficulty_mix).forEach(function (p) { m[p[0]] = toNumber_(p[1], 0); });
  return m;
}

function statsOpts_() {
  var s = settings_();
  return {
    decay: toNumber_(s.recency_decay, 0.7),
    maxSessions: toNumber_(s.recency_max_sessions, 5),
    greenMin: toNumber_(s.color_green_min, 80),
    yellowMin: toNumber_(s.color_yellow_min, 60)
  };
}

// ---------------------------------------------------------------- Questions

function loadQuestionsRaw_() { return readTable_('Questions'); }

function normQuestion_(r) {
  return {
    id: str_(r.id).trim(),
    subject: str_(r.subject).trim(),
    skill: str_(r.skill).trim(),
    difficulty: toNumber_(r.difficulty, 2),
    cognitive: str_(r.cognitive),
    group_id: str_(r.group_id).trim(),
    passage: str_(r.passage),
    stem: str_(r.stem),
    choices: { A: str_(r.choice_a), B: str_(r.choice_b), C: str_(r.choice_c), D: str_(r.choice_d) },
    image_url: str_(r.image_url).trim(),
    answer: str_(r.answer).trim().toUpperCase(),
    explanation: str_(r.explanation),
    why: { A: str_(r.why_a), B: str_(r.why_b), C: str_(r.why_c), D: str_(r.why_d) },
    takeaway: str_(r.takeaway),
    explanation_image_url: str_(r.explanation_image_url).trim(),
    fact_date: str_(r.fact_date),
    status: (str_(r.status).trim().toLowerCase() || 'active')
  };
}

var QCACHE_KEY = 'questions_v1';
var QCACHE_CHUNK = 20000; // ตัวอักษรต่อชิ้น (ไทย 3 ไบต์/ตัว ต้องไม่เกิน 100KB ต่อค่า)
var __qs = null;

function clearQuestionCache_() {
  __qs = null;
  try {
    var c = CacheService.getScriptCache();
    var n = Number(c.get(QCACHE_KEY + '_n')) || 0;
    var keys = [QCACHE_KEY + '_n'];
    for (var i = 0; i < n; i++) keys.push(QCACHE_KEY + '_' + i);
    c.removeAll(keys);
  } catch (e) { /* ไม่สำคัญ */ }
}

/** คืนข้อสอบที่ผ่านการตรวจรูปแบบ (ทุกสถานะ) fresh=true ข้ามแคช */
function loadQuestions_(fresh) {
  if (__qs) return __qs;
  var cache = null, list = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  if (cache && !fresh) {
    try {
      var n = Number(cache.get(QCACHE_KEY + '_n')) || 0;
      if (n > 0) {
        var keys = [];
        for (var i = 0; i < n; i++) keys.push(QCACHE_KEY + '_' + i);
        var got = cache.getAll(keys), parts = [], okAll = true;
        keys.forEach(function (k) { if (got[k] == null) okAll = false; else parts.push(got[k]); });
        if (okAll) list = JSON.parse(parts.join(''));
      }
    } catch (e) { list = null; }
  }
  if (!list) {
    var raw = loadQuestionsRaw_();
    var rep = validateQuestions_(raw);
    var bad = {};
    rep.errors.forEach(function (e) { var m = e.match(/^แถว (\d+)/); if (m) bad[m[1]] = true; });
    var seen = {};
    list = [];
    raw.forEach(function (r) {
      if (bad[r.__row]) return;
      var q = normQuestion_(r);
      if (!q.id || seen[q.id]) return;
      seen[q.id] = true;
      list.push(q);
    });
    if (cache) {
      try {
        var json = JSON.stringify(list), pieces = {}, cnt = 0;
        for (var p = 0; p < json.length; p += QCACHE_CHUNK) pieces[QCACHE_KEY + '_' + (cnt++)] = json.slice(p, p + QCACHE_CHUNK);
        pieces[QCACHE_KEY + '_n'] = String(cnt);
        cache.putAll(pieces, 300);
      } catch (e) { /* แคชไม่ได้ก็ไม่เป็นไร */ }
    }
  }
  __qs = list;
  return list;
}

function questionMap_(fresh) {
  var m = {};
  loadQuestions_(fresh).forEach(function (q) { m[q.id] = q; });
  return m;
}

// ---------------------------------------------------------------- รูปประกอบ

/** คืน {src} เป็น data URI (Drive) หรือ URL https; ref = "drive:<fileId หรือชื่อไฟล์>" / https://… / data:image/… (ฝังรูปในเซลล์) */
function fetchImage_(ref) {
  ref = String(ref || '').trim();
  if (!ref) return { src: '' };
  if (/^https:\/\//i.test(ref)) return { src: ref };
  if (/^data:image\//i.test(ref)) return { src: ref };
  if (ref.indexOf('drive:') !== 0) return { src: '' };
  var key = 'img_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ref)).replace(/[^A-Za-z0-9]/g, '');
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return { src: hit };
  var name = ref.slice(6).trim(), file = null;
  if (/^[A-Za-z0-9_-]{25,}$/.test(name)) {
    file = DriveApp.getFileById(name);
  } else {
    var folderId = String(settings_().images_folder_id || '').trim();
    if (!folderId) throw new Error('ตั้ง images_folder_id ใน Settings ก่อน (หรือใช้ drive:<fileId>)');
    var it = DriveApp.getFolderById(folderId).getFilesByName(name);
    if (!it.hasNext()) throw new Error('ไม่พบไฟล์รูป ' + name);
    file = it.next();
  }
  var blob = file.getBlob();
  var uri = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  if (uri.length < 90000) { try { cache.put(key, uri, 3600); } catch (e) { /* ไม่สำคัญ */ } }
  return { src: uri };
}
