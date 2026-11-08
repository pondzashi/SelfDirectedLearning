/**
 * DashLogic.gs — คำนวณข้อมูลสำหรับ Dashboard ผู้ปกครอง (ไม่เรียก API ของ Google ทดสอบด้วย Node ได้)
 * รับแถวดิบจากชีต (ผลรายวัน / ผลรายข้อ / ความก้าวหน้า) แล้วคืนข้อมูลพร้อมแสดงผล
 */

function dashRound1(x) { return Math.round(x * 10) / 10; }
function dashPct(right, total) { return Number(total) > 0 ? dashRound1(Number(right) / Number(total) * 100) : null; }
/** สีตามเกณฑ์: green / yellow / red / none */
function dashColor(pct, green, yellow) {
  if (pct == null || pct === '') return 'none';
  return pct >= green ? 'green' : pct >= yellow ? 'yellow' : 'red';
}

/** แถวชีต "ผลรายวัน" → รายการที่ใช้ง่าย (เรียงตามวันที่) */
function dashDailyList(rows) {
  function sec(r, o) {
    return { right: Number(r[o]) || 0, total: Number(r[o + 1]) || 0, firstSec: Number(r[o + 2]) || 0, totalSec: Number(r[o + 3]) || 0,
      target: Number(r[o + 4]) || 0, rounds: Number(r[o + 5]) || 0, errors: String(r[o + 6] || '') };
  }
  return rows.filter(function (r) { return r[0]; }).map(function (r) {
    var A = sec(r, 4), B = sec(r, 12), C = sec(r, 19), daily = r[1] === 'ประจำวัน';
    var pages = String(r[33] || '').split(',').filter(function (x) { return x !== ''; }).map(Number);
    return { date: String(r[0]), mode: String(r[1]), skillName: String(r[2] || ''), stepLabel: String(r[3] || ''), A: A, B: B, C: C, pass: String(r[11] || ''),
      slot: Number(r[28]) === 2 ? 2 : 1, topic: String(r[29] || ''), round: Number(r[30]) || 0, setNo: Number(r[31]) || 0, outcome: String(r[32] || ''), pagesSec: pages,
      x: Number(r[34]) || 0, y: Number(r[35]) || 0, repeat: String(r[36] || '') === 'ซ้ำ',
      totalMin: Number(r[26]) || 0, note: String(r[27] || ''), aPct: dashPct(A.right, A.total), bPct: dashPct(B.right, B.total), cPct: dashPct(C.right, C.total),
      ratio: daily && A.target ? dashRound1(A.totalSec / A.target * 100) : null };
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.slot - b.slot; });
}

/** จำนวนวันที่ทำติดต่อกัน นับเฉพาะวันที่ตั้งไว้ว่าฝึก (วันพักข้ามได้) ถ้าวันนี้ยังไม่ทำ ไม่ถือว่าขาด */
function dashStreak(doneSet, today, practiceDays) {
  var d = doneSet[today] ? today : ymdAdd(today, -1), n = 0;
  for (var i = 0; i < 400; i++) {
    if (practiceDays.indexOf(ymdDow(d)) < 0 && !doneSet[d]) { d = ymdAdd(d, -1); continue; }
    if (doneSet[d]) { n++; d = ymdAdd(d, -1); } else break;
  }
  return n;
}

/** จำนวนวันฝึกที่พลาดติดกัน นับย้อนจากเมื่อวาน (ไม่เกินวันเริ่ม) */
function dashMissed(doneSet, startDate, today, practiceDays) {
  var d = ymdAdd(today, -1), n = 0;
  while (startDate && d >= startDate) {
    if (practiceDays.indexOf(ymdDow(d)) >= 0) { if (doneSet[d]) break; n++; }
    d = ymdAdd(d, -1);
  }
  return n;
}

/**
 * ปฏิทิน weeks สัปดาห์ (อาทิตย์–เสาร์) จบที่สัปดาห์ของวันนี้
 * status: pass / fail / done / miss / rest / today / future / before
 */
function dashCalendar(passMap, today, startDate, practiceDays, weeks) {
  weeks = weeks || 6;
  var end = ymdAdd(today, 6 - ymdDow(today)), begin = ymdAdd(end, -(weeks * 7 - 1)), out = [];
  for (var i = 0; i < weeks * 7; i++) {
    var d = ymdAdd(begin, i), p = passMap[d], st;
    if (p !== undefined) st = String(p).indexOf('ผ่าน') === 0 ? 'pass' : p === 'ไม่ผ่าน' ? 'fail' : 'done';
    else if (d > today) st = 'future';
    else if (startDate && d < startDate) st = 'before';
    else if (d === today) st = 'today';
    else if (practiceDays.indexOf(ymdDow(d)) < 0) st = 'rest';
    else st = 'miss';
    out.push({ date: d, dow: ymdDow(d), status: st });
  }
  return out;
}

/** ชื่อที่อ่านเข้าใจของคีย์ข้อ (GEN:AS03 / TPL:W01 / FIX:F012) */
function dashTagLabel(key) {
  var p = String(key).split(':'), kind = p[0], id = p[1];
  if (kind === 'GEN' && typeof STEP_BY_ID !== 'undefined' && STEP_BY_ID[id]) { var s = STEP_BY_ID[id]; return SKILL_NAMES[s.skill] + ' ขั้น ' + s.no + ' · ' + s.name; }
  if (kind === 'TPL' && typeof TPL_BY_ID !== 'undefined' && TPL_BY_ID[id]) return CAT_NAMES[TPL_BY_ID[id].cat] + ' · แบบ ' + id;
  if (kind === 'FIX') return 'ข้อจากคลังข้อสอบ ' + id;
  if (kind === 'PG' && typeof PAGE_KINDS !== 'undefined' && PAGE_KINDS[id]) return TOPIC_NAMES[PAGE_KINDS[id].topic] + ' · ' + PAGE_KINDS[id].label;
  return String(key);
}

/** สถิติข้อผิดพลาดจากแถว "ผลรายข้อ" ตั้งแต่วันที่ fromYmd (เฉพาะข้อที่ผิดรอบแรก) */
function dashErrorStats(itemRows, fromYmd) {
  var types = {}, cats = {}, tags = {}, wrongTotal = 0, total = 0;
  itemRows.forEach(function (r) {
    if (String(r[0]) < fromYmd) return;
    var cat = String(r[3]), key = String(r[4]), ok = Number(r[7]) === 1;
    total++;
    var c = cats[cat] = cats[cat] || { cat: cat, total: 0, wrong: 0 }; c.total++;
    var t = tags[key] = tags[key] || { key: key, total: 0, wrong: 0, sample: '' }; t.total++;
    if (!ok) {
      wrongTotal++; c.wrong++; t.wrong++; if (!t.sample) t.sample = String(r[16] || '');
      var e = String(r[11] || 'ตอบผิด'); types[e] = (types[e] || 0) + 1;
    }
  });
  var typeList = Object.keys(types).map(function (k) { return { type: k, n: types[k] }; }).sort(function (a, b) { return b.n - a.n; });
  var catList = Object.keys(cats).map(function (k) { var c = cats[k]; return { cat: c.cat, name: CAT_NAMES[c.cat] || c.cat, total: c.total, wrong: c.wrong, pctWrong: dashPct(c.wrong, c.total) }; })
    .sort(function (a, b) { return (b.pctWrong || 0) - (a.pctWrong || 0); });
  var tagList = Object.keys(tags).map(function (k) { return tags[k]; }).filter(function (t) { return t.wrong >= 2 && t.total >= 3; })
    .sort(function (a, b) { return (b.wrong / b.total) - (a.wrong / a.total) || b.wrong - a.wrong; }).slice(0, 8)
    .map(function (t) { return { key: t.key, label: dashTagLabel(t.key), wrong: t.wrong, total: t.total, pctWrong: dashPct(t.wrong, t.total), sample: t.sample }; });
  return { total: total, wrong: wrongTotal, types: typeList, cats: catList, tags: tagList };
}

/** สถานะของแต่ละหัวข้อจากแท็บ "รอบหัวข้อ": รอบปัจจุบัน, หัวข้อ/ชุดที่กำลังทำ, ผลสัปดาห์ล่าสุด */
function dashTopicProgress(rs) {
  return TOPICS.map(function (t) {
    var cur = rs.rot.topic === t, h = rs.hist[t] || { weeks: 0, last: '', date: '' };
    return { topic: t, name: TOPIC_NAMES[t], round: rs.rounds[t], current: cur, setNo: cur ? rs.rot.setNo : 0, repeat: cur ? !!rs.rot.repeat : false, weeks: h.weeks, last: h.last, lastDate: h.date,
      pct: cur ? Math.round((rs.rot.setNo - 1) / ROT_SETS * 100) : 0 };
  });
}
/** แนวโน้มเวลาของชุดประเมิน (ชุดที่ 6) ต่อหัวข้อ เทียบรอบ 1 กับรอบ 2: [{topic,name,points:[{round,date,totalSec,x,ratio,outcome}]}] */
function dashTopicTrend(list) {
  var by = {};
  list.forEach(function (d) {
    if (d.mode !== 'ประจำวัน' || d.setNo !== ROT_SETS || !d.topic) return;
    (by[d.topic] = by[d.topic] || []).push({ round: d.round, date: d.date, totalSec: d.A.totalSec, x: d.x, ratio: d.x ? dashRound1(d.A.totalSec / d.x * 100) : null, outcome: d.pass, repeat: d.repeat });
  });
  return TOPICS.map(function (t) { return { topic: t, name: TOPIC_NAMES[t], points: by[TOPIC_NAMES[t]] || [] }; });
}

/** ชุดข้อมูลกราฟจากแท็บ "ความก้าวหน้า": [วันที่, A%, B%, C%, เวลา÷เป้า, ขั้น×4] */
function dashSeries(progressRows) {
  var s = { dates: [], a: [], b: [], c: [], ratio: [], rounds: {} };
  TOPICS.forEach(function (t) { s.rounds[t] = []; });
  function num(v) { return v === '' || v == null ? null : Number(v); }
  progressRows.filter(function (r) { return r[0]; }).forEach(function (r) {
    s.dates.push(String(r[0])); s.a.push(num(r[1])); s.b.push(num(r[2])); s.c.push(num(r[3])); s.ratio.push(num(r[4]));
    TOPICS.forEach(function (t, i) { s.rounds[t].push(num(r[5 + i])); });
  });
  return s;
}

/** ข้อควรสนใจสำหรับผู้ปกครอง: [{level:'warn'|'info'|'good', text}] */
function dashAlerts(x) {
  var out = [], i;
  if (!x.startDate) out.push({ level: 'warn', text: 'ยังไม่ได้ตั้งวันเริ่ม (START_DATE) ในแท็บตั้งค่า' });
  else if (x.today < x.startDate) out.push({ level: 'info', text: 'ยังไม่ถึงวันเริ่ม (' + x.startDate + ')' });
  if (x.placement && !x.placement.done && x.startDate && x.today >= x.startDate) out.push({ level: 'info', text: 'อยู่ระหว่างแบบวัดระดับ ทำแล้ว ' + x.placement.days + ' จาก ' + x.placement.of + ' วัน' });
  if (x.rot) out.push({ level: 'info', text: 'ตอนนี้: ' + rotLabel(x.rot.topic, x.rot.round, x.rot.setNo, x.rot.repeat) });
  if (x.rot && x.rot.repeat) out.push({ level: 'warn', text: 'สัปดาห์' + TOPIC_NAMES[x.rot.topic] + 'เป็นการทำซ้ำ (สัปดาห์ก่อนยังไม่ผ่านการประเมิน) ถ้าชุดที่ 6 ไม่ผ่านอีก ระบบจะไปหัวข้อถัดไป ควรนั่งดูวิธีคิดกับลูก' });
  var lastAssess = (x.list || []).filter(function (d) { return d.mode === 'ประจำวัน' && d.setNo === ROT_SETS; }).slice(-1)[0];
  if (lastAssess && lastAssess.pass === 'ผ่าน(ช้า)') out.push({ level: 'info', text: '⚑ สัปดาห์' + lastAssess.topic + 'ล่าสุดผ่านแต่ช้ากว่าเป้า (ใช้ ' + fmtSec(lastAssess.A.totalSec) + ' เป้า ' + fmtSec(lastAssess.x) + ')' });
  if (lastAssess && lastAssess.pass === 'ไม่ผ่าน') out.push({ level: 'warn', text: 'สัปดาห์' + lastAssess.topic + 'ล่าสุดยังไม่ผ่านการประเมิน (' + (lastAssess.repeat ? 'ซ้ำแล้ว ระบบไปต่อหัวข้อถัดไป' : 'ต้องทำซ้ำ') + ')' });
  if (x.missed >= 2) out.push({ level: 'warn', text: 'ไม่ได้ฝึกมา ' + x.missed + ' วันฝึกติดต่อกัน' });
  var recent = (x.list || []).filter(function (d) { return d.mode === 'ประจำวัน'; }).slice(-3);
  if (recent.length === 3) {
    var avgA = recent.reduce(function (s, d) { return s + (d.aPct || 0); }, 0) / 3;
    var slow = recent.every(function (d) { return d.ratio != null && d.ratio > 150; });
    if (avgA < x.yellow) out.push({ level: 'warn', text: 'ความแม่นยำส่วน A 3 ครั้งล่าสุดเฉลี่ย ' + dashRound1(avgA) + '% (ต่ำกว่าเกณฑ์ ' + x.yellow + '%)' });
    if (slow) out.push({ level: 'warn', text: 'ส่วน A ใช้เวลาเกิน 150% ของเป้าหมายติดกัน 3 ครั้ง ลองปรับ TARGET_MULTIPLIER หรือให้ลูกฝึกขั้นก่อนหน้า' });
  }
  if ((x.dueReviews || 0) >= 8) out.push({ level: 'info', text: 'มีข้อทบทวนครบกำหนด ' + x.dueReviews + ' ข้อ (ระบบทยอยใส่ในชุดวันละไม่เกิน 8 ข้อ)' });
  (x.lowBank || []).forEach(function (b) { out.push({ level: 'warn', text: 'คลังข้อสอบหมวด "' + b.cat + '" เหลือข้อสด ' + b.fresh + ' ข้อ ควรเพิ่มข้อใหม่' }); });
  if (x.streak >= 5) out.push({ level: 'good', text: 'ทำติดต่อกัน ' + x.streak + ' วันแล้ว เยี่ยมมาก!' });
  if (x.todayDone) out.push({ level: 'good', text: 'วันนี้ลูกทำเสร็จแล้ว' + (String(x.todayPass || '').indexOf('ผ่าน') === 0 ? ' และผ่านขั้นของส่วน A' : '') });
  return out;
}

/** ข้อมูลเรดาร์: ผลวัดระดับเทียบล่าสุด (จาก computeReportModel) */
function dashRadar(model) {
  var last = model.periods.length - 1;
  return model.cats.map(function (c) { return { cat: c.cat, name: c.name, base: c.pcts[0] == null ? null : c.pcts[0], cur: last >= 0 && c.pcts[last] != null ? c.pcts[last] : null }; });
}

/** สรุปรายเดือนปัจจุบัน */
function dashMonthStats(list, month) {
  var m = list.filter(function (d) { return d.date.slice(0, 7) === month; });
  var daily = m.filter(function (d) { return d.mode === 'ประจำวัน'; });
  var assess = daily.filter(function (d) { return d.pass && d.pass !== '-'; });
  var passN = assess.filter(function (d) { return d.pass.indexOf('ผ่าน') === 0; }).length;
  var avgA = daily.length ? dashRound1(daily.reduce(function (s, d) { return s + (d.aPct || 0); }, 0) / daily.length) : null;
  var uniq = {}; m.forEach(function (d) { uniq[d.date] = 1; });
  return { days: Object.keys(uniq).length, sets: m.length, dailyCount: daily.length, assessCount: assess.length, passN: passN, avgA: avgA };
}
