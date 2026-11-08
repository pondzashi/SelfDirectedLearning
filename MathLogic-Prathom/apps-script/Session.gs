/**
 * Session.gs — ฟังก์ชันที่หน้าเว็บ (Index.html) เรียก: getTodaySet / getCatchupSet / submitSection / submitSession
 * ตัดสินว่าวันนี้ทำชุดอะไร (วัดระดับ / ประจำวัน / วัดผลรายเดือน) และเลื่อนสถานะ "สัปดาห์ละเรื่อง" หลังทำเสร็จ
 *
 * ส่วน A ประจำวัน = หัวข้อละ 6 ชุด (บวก→ลบ→คูณ→หาร→เศษส่วน) นับตามจำนวน "ชุดที่ทำเสร็จ" ไม่ใช่ตามปฏิทิน
 *   วันไหนไม่ได้ทำ เนื้อหาไม่ข้าม · ทำชุดชดเชยได้ (ไม่บังคับ) รวมไม่เกิน 2 ชุดต่อวัน
 *   ชุดที่ 6 = ประเมินผล: ผ่าน / ผ่านแต่ช้า (ติดธง) / ทำหัวข้อเดิมซ้ำ 1 ครั้ง (ซ้ำแล้วยังไม่ผ่านก็ไปต่อ)
 */
var PLACEMENT_DAYS = 5;
var MAX_SETS_PER_DAY = 2;

function nextPlacementDay(st) { return st.placementDays.length; }

/** ตัดสินโหมดของวันนี้ */
function decideMode(today, cfg, st) {
  if (!cfg.START_DATE) return { status: 'notstarted' };
  if (today < cfg.START_DATE) return { status: 'notyet', startDate: cfg.START_DATE };
  if (cfg.practiceDays.indexOf(ymdDow(today)) < 0) return { status: 'rest' };
  if (!st.placementDone) {
    var stale = ymdDiff(today, cfg.START_DATE) > 10 && st.placementDays.length >= 1;
    if (st.placementDays.length >= PLACEMENT_DAYS || stale) return { status: 'ready', mode: 'daily', needFinalize: true };
    return { status: 'ready', mode: 'placement', day: nextPlacementDay(st) };
  }
  if (isLastFridayOfMonth(today) && ymdDiff(today, cfg.START_DATE) >= 21 && st.benchmarks.indexOf(ymdMonth(today)) < 0) return { status: 'ready', mode: 'benchmark' };
  return { status: 'ready', mode: 'daily' };
}

/**
 * ชุดชดเชย (ไม่บังคับ): ได้เมื่อวันนี้ทำชุดปกติ (ประจำวัน) แล้ว ยังทำชดเชยไม่ครบ 2 ชุด
 * และสัปดาห์หัวข้อที่ทำอยู่ยังไม่จบ (ชุดปกติของวันนี้ไม่ใช่ชุดที่ 6) — วันวัดระดับ/วัดผลไม่มีชดเชย
 */
function catchupState(rows, rs) {
  var s1 = rows.filter(function (r) { return slotOfRow(r) === 1; })[0];
  if (!s1 || rows.length >= MAX_SETS_PER_DAY) return { available: false };
  if (String(s1[1]) !== 'ประจำวัน') return { available: false };
  var done = Number(s1[DC.setNo]) || 0;
  if (!(done >= 1 && done < ROT_SETS)) return { available: false };
  var rot = rs.rot;
  return { available: true, remaining: ROT_SETS - done, next: rotLabel(rot.topic, planRound(rs.rounds[rot.topic]), rot.setNo, rot.repeat) };
}

function getCatchupSet() { return getTodaySet({ catchup: true }); }

function getTodaySet(req) {
  try {
    var wantCatch = !!(req && req.catchup);
    var today = todayYmd(), cfg = getSettings(), st = getState(), rows = findDailyRows(today), rs = readRotation();
    var s1 = rows.filter(function (r) { return slotOfRow(r) === 1; })[0];
    var cu = catchupState(rows, rs);
    if (s1 && !(wantCatch && cu.available)) {
      return { status: 'done', date: today, child: childLabel(), summary: doneSummaryFromRow(rows[rows.length - 1]), summaries: rows.map(doneSummaryFromRow), catchup: cu.available ? cu : null };
    }
    if (wantCatch && !cu.available) return { status: 'error', message: 'วันนี้ทำชุดชดเชยไม่ได้ (ทำได้วันละไม่เกิน 2 ชุด และเฉพาะเมื่อสัปดาห์ยังเหลือชุด)' };
    var dm = wantCatch ? { status: 'ready', mode: 'daily' } : decideMode(today, cfg, st);
    if (dm.status !== 'ready') return { status: dm.status, date: today, child: childLabel(), startDate: dm.startDate || '' };
    if (dm.needFinalize) { finalizePlacement(today); st = getState(); rs = readRotation(); }
    var slot = wantCatch ? 2 : 1, L = readLevels(), hist = historyContext(today);
    var ctx = { levels: L, rot: rs.rot, rounds: rs.rounds, targetMult: cfg.TARGET_MULTIPLIER, yFactor: cfg.ASSESS_Y_FACTOR,
      usedSigs: hist.usedSigs, recentTpl: hist.recentTpl, bankUsed: hist.bankUsed, bank: readBank(), reviews: [] };
    setRng(mulberry32(hashStr(today + '|' + dm.mode + '|' + slot + '|' + JSON.stringify([rs.rot, rs.rounds, L.tiers, st.placementDays.length]))));
    var set;
    if (dm.mode === 'placement') set = buildPlacementDay(ctx, dm.day);
    else if (dm.mode === 'benchmark') set = buildBenchmark(ctx);
    else { ctx.reviews = getDueReviews(today); set = buildDailySet(ctx); }
    var a = set.sections[0];
    set.status = 'ready'; set.date = today; set.slot = slot; set.catchup = wantCatch; set.child = childLabel(); set.childName = st.childName || '';
    set.aMaxSec = Math.max(cfg.A_MAX_SEC, (a.ySec || 0) + 300);
    if (wantCatch) set.title = 'ชุดชดเชย (ไม่บังคับ) — ' + set.title;
    return set;
  } catch (e) {
    return { status: 'error', message: String(e && e.message || e), stack: String(e && e.stack || '') };
  }
}

function errSummary(items) {
  var c = {};
  items.forEach(function (it) { if (!it.ok1) { var e = it.errType || 'ตอบผิด'; c[e] = (c[e] || 0) + 1; } });
  return Object.keys(c).map(function (k) { return k + '×' + c[k]; }).join(', ');
}
function secStat(sec) {
  var items = sec.items || [], right = items.filter(function (i) { return i.ok1; }).length;
  return { id: sec.id, name: sec.name, right: right, total: items.length, firstSec: Math.round(sec.firstSec || 0),
    totalSec: Math.round(sec.totalSec || 0), target: Math.round(sec.targetSec || sec.recSec || 0), rounds: sec.rounds || 0, errors: errSummary(items) };
}
function round1s(x) { return Math.round(x * 10) / 10; }
function pctOf(right, total) { return total ? round1s(right / total * 100) : ''; }

/** สถิติรายหมวดจากแถวข้อที่เป็นข้อวัดผล (cmp) */
function computeCatStats(rows) {
  var acc = {};
  rows.forEach(function (r) {
    if (String(r[13]) !== '1') return;
    var c = String(r[3]), a = acc[c] = acc[c] || { right: 0, total: 0, sec: 0 };
    a.total++; a.right += Number(r[7]) === 1 ? 1 : 0; a.sec += Number(r[10]) || 0;
  });
  var out = {};
  CATS.forEach(function (c) {
    var a = acc[c];
    if (a && a.total) out[c] = { right: a.right, total: a.total, pct: round1s(a.right / a.total * 100), spi: round1s(a.sec / a.total) };
  });
  return out;
}

function itemRowsFor(date, mode, sections) {
  var rows = [];
  sections.forEach(function (sec) {
    (sec.items || []).forEach(function (it) {
      rows.push([date, mode, sec.id, it.cat, it.key, it.tag || '', it.sig || '', it.ok1 ? 1 : 0, it.tries || 1, it.revealed ? 1 : 0, round1s(it.sec || 0),
        it.ok1 ? '' : (it.errType || 'ตอบผิด'), it.review ? 1 : 0, it.cmp ? 1 : 0, it.tier || '', it.ladder == null ? '' : it.ladder,
        String(it.q || '').replace(/\s+/g, ' ').slice(0, 60), it.page || '']);
    });
  });
  return rows;
}

function sectionRowCells(s) {
  return [s.right, s.total, s.firstSec, s.totalSec, s.target, s.rounds, s.errors];
}

function submitSession(res) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return doSubmit(res); } finally { lock.releaseLock(); }
}

function outcomeCell(o) { return o === 'pass' ? 'ผ่าน' : o === 'flag' ? 'ผ่าน(ช้า)' : o === 'repeat' ? 'ไม่ผ่าน' : '-'; }
function weekResultText(info) {
  if (info.outcome === 'pass') return 'ผ่าน รอบ ' + info.round + ' → รอบ ' + (info.round + 1);
  if (info.outcome === 'flag') return 'ผ่านแต่ช้า (' + info.reason + ') รอบ ' + info.round + ' → รอบ ' + (info.round + 1);
  return info.event === 'moveon' ? 'ไม่ผ่านซ้ำ (' + info.reason + ') ไปหัวข้อถัดไป รอบคงเดิม' : 'ไม่ผ่าน (' + info.reason + ') ทำหัวข้อนี้ซ้ำ';
}
function weekNote(info) {
  var tn = info.topicName;
  if (!info.assessment) return 'ชุดที่ ' + info.setNo + '/' + ROT_SETS + ' ของสัปดาห์' + tn + ' เสร็จแล้ว · ครั้งต่อไป: ' + info.nextLabel;
  if (info.outcome === 'pass') return 'ผ่านการประเมินสัปดาห์' + tn + '! ' + tn + 'ขึ้นรอบ ' + (info.round + 1) + ' · สัปดาห์ถัดไป: ' + info.nextLabel;
  if (info.outcome === 'flag') return 'ผ่านการประเมินสัปดาห์' + tn + ' แต่ช้ากว่าเป้า (' + info.reason + ') · ' + tn + 'ขึ้นรอบ ' + (info.round + 1) + ' · ต่อไป: ' + info.nextLabel;
  if (info.event === 'moveon') return 'ประเมินสัปดาห์' + tn + 'ซ้ำแล้วยังไม่ผ่าน (' + info.reason + ') ไปต่อหัวข้อถัดไป รอบคงเดิม · ต่อไป: ' + info.nextLabel;
  return 'ยังไม่ผ่านการประเมินสัปดาห์' + tn + ' (' + info.reason + ') · ทำหัวข้อนี้ซ้ำอีก 1 สัปดาห์ด้วยตัวเลขชุดใหม่ · ต่อไป: ' + info.nextLabel;
}

function doSubmit(res) {
  var cfg = getSettings(), st = getState(), today = todayYmd(), date = res.date || today;
  var nm = cleanChildName(res.childName);
  if (nm && nm !== st.childName) { st.childName = nm; setState(st); }
  if (ymdDiff(today, date) > 1 || ymdDiff(today, date) < 0) date = today;
  var mode = res.mode, slot = Number(res.slot) === 2 ? 2 : 1;

  // กันส่งซ้ำ (วันที่ + ชุดในวัน) และบังคับกติกา "ไม่เกิน 2 ชุดต่อวัน / ชดเชยเฉพาะที่ยังเหลือชุดในสัปดาห์" ฝั่งเซิร์ฟเวอร์
  var rowsToday = findDailyRows(date);
  var dup = rowsToday.filter(function (r) { return slotOfRow(r) === slot; })[0];
  if (dup) return { ok: true, duplicate: true, summary: doneSummaryFromRow(dup) };
  if (slot === 2) {
    if (mode !== 'daily' || !catchupState(rowsToday, readRotation()).available) return { ok: false, refused: true, message: 'ทำชุดชดเชยไม่ได้ในตอนนี้ (วันละไม่เกิน 2 ชุด และเฉพาะเมื่อสัปดาห์ยังเหลือชุด)' };
  } else if (rowsToday.length >= MAX_SETS_PER_DAY) return { ok: false, refused: true, message: 'วันนี้ทำครบ ' + MAX_SETS_PER_DAY + ' ชุดแล้ว' };

  var secs = {}, stats = {};
  (res.sections || []).forEach(function (s) { secs[s.id] = s; stats[s.id] = secStat(s); });
  var A = secs.A, sA = stats.A || secStat({ id: 'A', items: [] }), sB = stats.B || secStat({ id: 'B', items: [] }), sC = stats.C || secStat({ id: 'C', items: [] });

  // 1) บันทึกผลรายข้อ (คำถามสังเกต "สังเกตเห็นอะไร?" ไม่ถูกบันทึกเป็นข้อที่ให้คะแนน)
  var itemRows = itemRowsFor(date, mode, res.sections || []);
  var ish = getSheet(SH.items);
  if (itemRows.length) ish.getRange(ish.getLastRow() + 1, 1, itemRows.length, ITEM_HEAD.length).setValues(itemRows);

  // 2) ทบทวน: ข้อที่เคยมาทบทวนถือว่าทำแล้ว / ข้อที่ผิดรอบแรกเข้าคิวทบทวน 3 วัน และ 1 สัปดาห์ (คีย์ตามชนิดหน้า จึงรวมซ้ำกัน)
  var allItems = [].concat.apply([], (res.sections || []).map(function (s) { return s.items || []; }));
  markReviewsDone(allItems.filter(function (i) { return i.reviewId; }).map(function (i) { return i.reviewId; }), date);
  // แบบวัดระดับ/แบบวัดผลมีข้อยากเกินระดับโดยตั้งใจ จึงไม่ส่งข้อคิดเลขเข้าคิวทบทวน
  var wrong = allItems.filter(function (i) { return !i.ok1 && i.key && (mode === 'daily' || SKILLS.indexOf(i.cat) < 0); }).map(function (i) {
    return { key: i.key, cat: i.cat, tier: i.tier || 2, level: i.level, fixCat: i.fixCat, q: i.q };
  });
  addReviews(wrong, date);
  touchBankUsed(allItems.filter(function (i) { return /^FIX:/.test(i.key); }).map(function (i) { return i.key.slice(4); }), date);

  // 3) สถานะ
  var summary = { date: date, mode: mode, slot: slot, title: res.title || '', sections: [sA, sB, sC], note: '' }, info = null, topicName = '', stepLabel = '';
  var wk = { topic: '', round: '', setNo: '', outcome: '', pages: '', x: '', y: '', repeat: '' };
  if (mode === 'daily' && A) {
    var rs = readRotation(), rot = rs.rot, rounds = rs.rounds, L = readLevels();
    var aSet = Number(A.setNo), aTopic = String(A.topic), aRound = Number(A.round), assess = aSet === ROT_SETS;
    var matches = aTopic === rot.topic && aSet === rot.setNo && aRound === planRound(rounds[rot.topic]);
    var x = Math.round(setXSec(aTopic, aRound, aSet) * cfg.TARGET_MULTIPLIER), y = Math.round(x * cfg.ASSESS_Y_FACTOR);
    var aMain = (A.items || []).filter(function (i) { return !i.review; });
    info = { topic: aTopic, topicName: TOPIC_NAMES[aTopic], round: aRound, setNo: aSet, assessment: assess, x: x, y: y, stale: !matches, repeat: !!A.repeat,
      label: rotLabel(aTopic, aRound, aSet, !!A.repeat), totalSec: Math.round((A.firstSec || 0) + (A.correctionSec || 0)),
      pages: (A.pages || []).map(function (p) { return Math.round(p.sec || 0); }) };
    if (assess) {
      var o = assessOutcome({ mastered: aMain.every(function (i) { return !i.revealed; }), totalSec: info.totalSec }, x, y);
      info.outcome = o.outcome; info.reason = o.reason;
    }
    if (matches) {
      var tr = rotAfterSet(rot, rounds, aSet, assess ? { outcome: info.outcome } : null);
      info.event = tr.event; info.nextLabel = rotLabel(tr.rot.topic, planRound(tr.rounds[tr.rot.topic]), tr.rot.setNo, tr.rot.repeat);
      writeRotation(tr.rot, tr.rounds, assess ? { topic: aTopic, text: weekResultText(info), date: date } : null);
      summary.note = weekNote(info);
    } else summary.note = 'ชุดนี้ไม่ตรงกับสถานะปัจจุบันในแท็บ "รอบหัวข้อ" (อาจมีการแก้ไขสถานะ) จึงบันทึกผลแต่ไม่เลื่อนสถานะ';
    topicName = info.topicName; stepLabel = 'รอบ ' + aRound + ' · ชุด ' + aSet + '/' + ROT_SETS;
    wk = { topic: info.topicName, round: aRound, setNo: aSet, outcome: assess ? outcomeCell(info.outcome) : '-', pages: (A.pages || []).map(function (p) { return Math.round(p.sec || 0); }).join(','),
      x: x, y: y, repeat: A.repeat ? 'ซ้ำ' : '' };
    // ปรับระดับ B/C ตามผล 3 ครั้งล่าสุด (ไม่ใช้ตัดสินผ่าน/ไม่ผ่าน)
    var past = readDailyRows(40).filter(function (r) { return r[1] === 'ประจำวัน'; });
    var bP = past.map(function (r) { return Number(r[13]) ? Number(r[12]) / Number(r[13]) * 100 : null; }).filter(function (v) { return v != null; });
    var cP = past.map(function (r) { return Number(r[20]) ? Number(r[19]) / Number(r[20]) * 100 : null; }).filter(function (v) { return v != null; });
    if (sB.total) bP.push(sB.right / sB.total * 100);
    if (sC.total) cP.push(sC.right / sC.total * 100);
    L.tiers.observe = adjustTier(L.tiers.observe, bP);
    L.tiers.word = adjustTier(L.tiers.word, cP); L.tiers.analytic = adjustTier(L.tiers.analytic, cP);
    writeLevels(L);
    summary.drill = info;
  } else if (mode === 'placement') {
    if (st.placementDays.indexOf(res.placementDay) < 0) st.placementDays.push(res.placementDay);
    summary.note = 'วันที่ ' + st.placementDays.length + ' จาก ' + PLACEMENT_DAYS + ' ของแบบวัดระดับ';
    topicName = res.placementDay <= 3 ? SKILL_NAMES[SKILLS[res.placementDay]] : 'โจทย์ปัญหา/สังเกต/วิเคราะห์';
    setState(st);
    if (st.placementDays.length >= PLACEMENT_DAYS) {
      summary.placement = finalizePlacement(date, true);
      st = getState();
      summary.note = 'ครบ 5 วันแล้ว! ระบบกำหนดรอบเริ่มต้นของแต่ละหัวข้อให้แล้ว (เริ่มสัปดาห์บวก ชุด 1)';
    }
  } else if (mode === 'benchmark') {
    var cmpRows = itemRows.filter(function (r) { return r[13] === 1; });
    var bs = computeCatStats(cmpRows);
    st.benchmarks.push(ymdMonth(date));
    var label = 'เดือน ' + st.benchmarks.length;
    appendBench(label, date, bs);
    summary.benchmark = { label: label, stats: bs };
    summary.note = 'ทำแบบวัดผลประจำเดือนเสร็จแล้ว ผู้ปกครองจะได้รับรายงานเปรียบเทียบทางอีเมลสิ้นเดือน';
    topicName = 'แบบวัดผลประจำเดือน';
    setState(st);
    rebuildReportSheet();
  }
  summary.skillName = topicName; summary.stepLabel = stepLabel;

  // 4) บันทึกผลรายวัน (1 แถวต่อชุด: ชุดปกติ + ชุดชดเชย)
  var totalMin = Math.round(((res.totalSec || (sA.totalSec + sB.totalSec + sC.totalSec)) / 60) * 10) / 10;
  var modeLabel = mode === 'daily' ? 'ประจำวัน' : mode === 'placement' ? 'วัดระดับ' : 'วัดผลรายเดือน';
  var passCell = info ? (info.assessment ? outcomeCell(info.outcome) : '-') : '-';
  var dsh = getSheet(SH.daily), row = [date, modeLabel, topicName, stepLabel].concat(sectionRowCells(sA), [passCell], sectionRowCells(sB), sectionRowCells(sC), [totalMin, summary.note],
    [slot, wk.topic, wk.round, wk.setNo, wk.outcome, wk.pages, wk.x, wk.y, wk.repeat]);
  dsh.getRange(dsh.getLastRow() + 1, 1, 1, DAILY_HEAD.length).setValues([row]);

  // 5) ความก้าวหน้า + แผนภูมิ
  var rd2 = readRotation().rounds, psh = getSheet(SH.progress);
  psh.getRange(psh.getLastRow() + 1, 1, 1, PROGRESS_HEAD.length).setValues([[date, pctOf(sA.right, sA.total), pctOf(sB.right, sB.total), pctOf(sC.right, sC.total),
    info && sA.target ? round1s(info.totalSec / sA.target * 100) : '', rd2.add, rd2.sub, rd2.mul, rd2.div, rd2.frac]]);
  try { rebuildProgressCharts(); } catch (e) { Logger.log('chart: ' + e); }

  try { props().deleteProperty('DRAFT_' + date + '_' + slot); } catch (e) { /* ไม่สำคัญ */ }
  summary.pendingReviews = countPendingReviews();
  try { sendSessionEmail(summary); } catch (e) { Logger.log('email: ' + e); summary.emailError = String(e); }
  return { ok: true, summary: summary };
}

/** บันทึกสถิติของส่วนที่เพิ่งทำเสร็จไว้ก่อน (ร่างขนาดเล็กใน Properties) เผื่อปิดหน้าจอกลางคัน ผลเต็มจะลงชีตตอนจบทั้งชุด */
function submitSection(draft) {
  try {
    var key = 'DRAFT_' + (draft.date || todayYmd()) + '_' + (Number(draft.slot) === 2 ? 2 : 1);
    var cur = props().getProperty(key), obj = cur ? JSON.parse(cur) : { stats: {} };
    obj.stats[draft.section.id] = secStat(draft.section);
    obj.mode = draft.mode;
    props().setProperty(key, JSON.stringify(obj));
    return { ok: true };
  } catch (e) { return { ok: false, message: String(e) }; }
}

function doneSummaryFromRow(r) {
  function sec(id, name, o) { return { id: id, name: name, right: r[o], total: r[o + 1], firstSec: r[o + 2], totalSec: r[o + 3], target: r[o + 4], rounds: r[o + 5], errors: r[o + 6] }; }
  return { date: r[0], mode: r[1], skillName: r[2], stepLabel: r[3], sections: [sec('A', 'คิดเลขเร็ว', 4), sec('B', 'การสังเกต', 12), sec('C', 'คิดวิเคราะห์', 19)],
    passCell: r[11], note: r[27], totalMin: r[26], slot: slotOfRow(r), topic: String(r[DC.topic] || ''), round: r[DC.round], setNo: r[DC.setNo], outcome: String(r[DC.outcome] || ''), fromRow: true };
}

/** คำนวณขั้นเริ่มต้นจากแบบวัดระดับ 5 วัน แล้วแปลงเป็น "รอบเริ่มต้น" ของแต่ละหัวข้อ (บวก/ลบมาจากบันไดเดียวกัน) */
function finalizePlacement(date, silent) {
  var cfg = getSettings(), st = getState(), L = readLevels(), rows = readItemRowsSince(ymdAdd(date, -60)).filter(function (r) { return r[1] === 'placement'; });
  var starts = {}, startNo = {};
  SKILLS.forEach(function (sk) {
    var n = skillSteps(sk).length, scores = [], i;
    for (i = 0; i < n; i++) scores.push(0);
    var any = false;
    rows.forEach(function (r) {
      if (String(r[3]) === sk && r[15] !== '') { any = true; scores[Number(r[15])] += Number(r[7]) === 1 ? 1 : 0; }
    });
    var idx = any ? computeStartIndex(scores, cfg.PLACEMENT_BACKOFF, PLACEMENT_PER_STEP) : 0;
    L[sk] = idx + 1; L.fails[sk] = 0; startNo[sk] = idx + 1;
    starts[sk] = { no: idx + 1, name: stepOf(sk, idx + 1).name, scores: scores };
  });
  var cs = computeCatStats(rows), tiers = {};
  [['word', 'word'], ['observe', 'observe'], ['analytic', 'analytic']].forEach(function (p) {
    var s = cs[p[0]], t = 2;
    if (s) t = s.pct >= 85 ? 3 : s.pct >= 60 ? 2 : 1;
    L.tiers[p[1]] = t; tiers[p[1]] = t;
  });
  writeLevels(L, startNo);
  var startRounds = placementRounds(startNo);
  writeRotation(rotInit(), startRounds, null);
  st.placementDone = true; st.nextSkill = 0;
  setState(st);
  appendBench('วัดระดับ', date, cs);
  rebuildReportSheet();
  return { starts: starts, tiers: tiers, stats: cs, rounds: startRounds };
}

/* ---------------- ความก้าวหน้า ---------------- */
var PROGRESS_HEAD = ['วันที่', 'ส่วน A ถูกรอบแรก (%)', 'ส่วน B ถูกรอบแรก (%)', 'ส่วน C ถูกรอบแรก (%)', 'ส่วน A เวลารวม ÷ เป้า (%)', 'รอบ บวก', 'รอบ ลบ', 'รอบ คูณ', 'รอบ หาร', 'รอบ เศษส่วน'];
function rebuildProgressCharts() {
  var sh = getSheet(SH.progress), n = sh.getLastRow();
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  if (n < 2) return;
  function chart(title, cols, row, vTitle, max) {
    var b = sh.newChart().setChartType(Charts.ChartType.LINE).addRange(sh.getRange(1, 1, n, 1));
    cols.forEach(function (c) { b = b.addRange(sh.getRange(1, c, n, 1)); });
    b = b.setNumHeaders(1).setPosition(row, 12, 0, 0).setOption('title', title).setOption('legend', { position: 'bottom' })
      .setOption('pointSize', 5).setOption('width', 620).setOption('height', 300).setOption('vAxis', { title: vTitle, minValue: 0 });
    sh.insertChart(b.build());
  }
  chart('ความแม่นยำรอบแรก (% ถูก) แยกตามส่วน', [2, 3, 4], 2, '% ถูก');
  chart('ส่วน A: เวลารวม ÷ เวลาเป้าหมาย (ต่ำกว่า 100% = ทันเวลา)', [5], 18, '% ของเวลาเป้าหมาย');
  chart('รอบปัจจุบันของแต่ละหัวข้อ', [6, 7, 8, 9, 10], 34, 'รอบ');
}
