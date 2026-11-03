/**
 * Session.gs — ฟังก์ชันที่หน้าเว็บ (Index.html) เรียก: getTodaySet / submitSection / submitSession
 * ตัดสินว่าวันนี้ทำชุดอะไร (วัดระดับ / ประจำวัน / วัดผลรายเดือน) และอัปเดตระดับหลังทำเสร็จ
 */
var PLACEMENT_DAYS = 5;

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

function getTodaySet() {
  try {
    var today = todayYmd(), cfg = getSettings(), st = getState();
    var done = findDailyRow(today);
    if (done) return { status: 'done', date: today, child: childLabel(), summary: doneSummaryFromRow(done) };
    var dm = decideMode(today, cfg, st);
    if (dm.status !== 'ready') return { status: dm.status, date: today, child: childLabel(), startDate: dm.startDate || '' };
    if (dm.needFinalize) { finalizePlacement(today); st = getState(); }
    var L = readLevels(), hist = historyContext(today);
    var ctx = { levels: L, skill: SKILLS[st.nextSkill % SKILLS.length], usedSigs: hist.usedSigs, recentTpl: hist.recentTpl, bankUsed: hist.bankUsed, bank: readBank(), reviews: [] };
    setRng(mulberry32(hashStr(today + '|' + dm.mode + '|' + JSON.stringify([L.addsub, L.mul, L.div, L.fracdec, L.tiers, ctx.skill, st.placementDays.length]))));
    var set;
    if (dm.mode === 'placement') set = buildPlacementDay(ctx, dm.day);
    else if (dm.mode === 'benchmark') set = buildBenchmark(ctx);
    else {
      ctx.reviews = getDueReviews(today); set = buildDailySet(ctx);
      if (cfg.TARGET_MULTIPLIER !== 1) set.sections[0].targetSec = Math.round(set.sections[0].targetSec * cfg.TARGET_MULTIPLIER);
    }
    set.status = 'ready'; set.date = today; set.child = childLabel(); set.childName = st.childName || ''; set.aMaxSec = cfg.A_MAX_SEC;
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
        String(it.q || '').replace(/\s+/g, ' ').slice(0, 60)]);
    });
  });
  return rows;
}

function sectionRowCells(s, isA) {
  return [s.right, s.total, s.firstSec, s.totalSec, s.target, s.rounds, s.errors];
}

function submitSession(res) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return doSubmit(res); } finally { lock.releaseLock(); }
}

function doSubmit(res) {
  var cfg = getSettings(), st = getState(), today = todayYmd(), date = res.date || today;
  var nm = cleanChildName(res.childName);
  if (nm && nm !== st.childName) { st.childName = nm; setState(st); }
  if (ymdDiff(today, date) > 1 || ymdDiff(today, date) < 0) date = today;
  var existing = findDailyRow(date);
  if (existing) return { ok: true, duplicate: true, summary: doneSummaryFromRow(existing) };

  var mode = res.mode, secs = {}, stats = {};
  (res.sections || []).forEach(function (s) { secs[s.id] = s; stats[s.id] = secStat(s); });
  var A = secs.A, sA = stats.A || secStat({ id: 'A', items: [] }), sB = stats.B || secStat({ id: 'B', items: [] }), sC = stats.C || secStat({ id: 'C', items: [] });

  // 1) บันทึกผลรายข้อ
  var itemRows = itemRowsFor(date, mode, res.sections || []);
  var ish = getSheet(SH.items);
  if (itemRows.length) ish.getRange(ish.getLastRow() + 1, 1, itemRows.length, ITEM_HEAD.length).setValues(itemRows);

  // 2) ทบทวน: ข้อที่เคยมาทบทวนถือว่าทำแล้ว / ข้อที่ผิดรอบแรกเข้าคิวทบทวน 3 วัน และ 1 สัปดาห์
  var allItems = [].concat.apply([], (res.sections || []).map(function (s) { return s.items || []; }));
  markReviewsDone(allItems.filter(function (i) { return i.reviewId; }).map(function (i) { return i.reviewId; }), date);
  // แบบวัดระดับ/แบบวัดผลมีข้อยากเกินระดับโดยตั้งใจ จึงไม่ส่งข้อคิดเลขเข้าคิวทบทวน (ข้อโจทย์ปัญหา/สังเกต/วิเคราะห์ยังทบทวนตามปกติ)
  var wrong = allItems.filter(function (i) { return !i.ok1 && i.key && (mode === 'daily' || SKILLS.indexOf(i.cat) < 0); }).map(function (i) {
    var m = /^FIX:(.+)$/.exec(i.key);
    return { key: i.key, cat: i.cat, tier: i.tier || 2, level: i.level, fixCat: i.fixCat, q: i.q };
  });
  addReviews(wrong, date);
  touchBankUsed(allItems.filter(function (i) { return /^FIX:/.test(i.key); }).map(function (i) { return i.key.slice(4); }), date);

  // 3) ระดับ
  var L = readLevels(), summary = { date: date, mode: mode, title: res.title || '', sections: [sA, sB, sC], note: '' }, drillInfo = null;
  var aMainItems = A ? (A.items || []).filter(function (i) { return !i.review; }) : [];
  var stepLabel = '', skillName = '';
  if (mode === 'daily' && A) {
    var sk = A.skill, step = stepOf(sk, L[sk]);
    skillName = SKILL_NAMES[sk]; stepLabel = 'ขั้น ' + step.no;
    var dec = decideDrillPass({ items: aMainItems, totalSec: (A.firstSec || 0) + (A.correctionSec || 0), targetSec: A.targetSec });
    drillInfo = { pass: dec.pass, reason: dec.reason, skill: sk, stepNo: step.no, stepName: step.name };
    var nsteps = skillSteps(sk).length;
    if (dec.pass) {
      L.fails[sk] = 0;
      if (L[sk] < nsteps) { L[sk] += 1; var nx = stepOf(sk, L[sk]); summary.note = 'ผ่านแล้ว! พรุ่งนี้ไปขั้นต่อไป: ' + SKILL_NAMES[sk] + ' ขั้น ' + nx.no + ' (' + nx.name + ')'; }
      else summary.note = 'ผ่านขั้นสุดท้ายของทักษะ' + SKILL_NAMES[sk] + 'แล้ว เก่งมาก!';
      st.nextSkill = (st.nextSkill + 1) % SKILLS.length;
    } else {
      L.fails[sk] = (L.fails[sk] || 0) + 1;
      summary.note = 'ยังไม่ผ่านขั้นนี้ (' + dec.reason + ') พรุ่งนี้ทำขั้นเดิมอีกครั้ง';
      if (L.fails[sk] >= cfg.MAX_REPEATS) {
        drillInfo.stuck = L.fails[sk];
        st.nextSkill = (st.nextSkill + 1) % SKILLS.length;
        summary.note += ' (ทำไม่ผ่านติดกัน ' + L.fails[sk] + ' ครั้ง วันพรุ่งนี้จะสลับไปฝึกทักษะอื่นก่อน)';
      }
    }
    L.last[sk] = date;
    // ปรับระดับ B/C ตามผล 3 ครั้งล่าสุด (ไม่ใช้ตัดสินผ่าน/ไม่ผ่าน)
    var past = readDailyRows(30).filter(function (r) { return r[1] === 'ประจำวัน'; });
    var bP = past.map(function (r) { return Number(r[12 + 1]) ? Number(r[12]) / Number(r[13]) * 100 : null; }).filter(function (x) { return x != null; });
    var cP = past.map(function (r) { return Number(r[20]) ? Number(r[19]) / Number(r[20]) * 100 : null; }).filter(function (x) { return x != null; });
    if (sB.total) bP.push(sB.right / sB.total * 100);
    if (sC.total) cP.push(sC.right / sC.total * 100);
    L.tiers.observe = adjustTier(L.tiers.observe, bP);
    var cT = adjustTier(L.tiers.word, cP);
    L.tiers.word = cT; L.tiers.analytic = adjustTier(L.tiers.analytic, cP);
    writeLevels(L);
    summary.drill = drillInfo;
  } else if (mode === 'placement') {
    if (st.placementDays.indexOf(res.placementDay) < 0) st.placementDays.push(res.placementDay);
    summary.note = 'วันที่ ' + st.placementDays.length + ' จาก ' + PLACEMENT_DAYS + ' ของแบบวัดระดับ';
    skillName = res.placementDay <= 3 ? SKILL_NAMES[SKILLS[res.placementDay]] : 'โจทย์ปัญหา/สังเกต/วิเคราะห์';
    setState(st);
    if (st.placementDays.length >= PLACEMENT_DAYS) {
      summary.placement = finalizePlacement(date, true);
      st = getState();
      summary.note = 'ครบ 5 วันแล้ว! ระบบกำหนดขั้นเริ่มต้นของสัปดาห์หน้าให้แล้ว';
    }
  } else if (mode === 'benchmark') {
    var cmpRows = itemRows.filter(function (r) { return r[13] === 1; });
    var bs = computeCatStats(cmpRows);
    st.benchmarks.push(ymdMonth(date));
    var label = 'เดือน ' + st.benchmarks.length;
    appendBench(label, date, bs);
    summary.benchmark = { label: label, stats: bs };
    summary.note = 'ทำแบบวัดผลประจำเดือนเสร็จแล้ว ผู้ปกครองจะได้รับรายงานเปรียบเทียบทางอีเมลสิ้นเดือน';
    skillName = 'แบบวัดผลประจำเดือน';
    setState(st);
    rebuildReportSheet();
  }
  summary.skillName = skillName; summary.stepLabel = stepLabel;

  // 4) บันทึกผลรายวัน
  var totalMin = Math.round(((res.totalSec || (sA.totalSec + sB.totalSec + sC.totalSec)) / 60) * 10) / 10;
  var modeLabel = mode === 'daily' ? 'ประจำวัน' : mode === 'placement' ? 'วัดระดับ' : 'วัดผลรายเดือน';
  var passCell = drillInfo ? (drillInfo.pass ? 'ผ่าน' : 'ไม่ผ่าน') : '-';
  var dsh = getSheet(SH.daily), row = [date, modeLabel, skillName, stepLabel].concat(sectionRowCells(sA), [passCell], sectionRowCells(sB), sectionRowCells(sC), [totalMin, summary.note]);
  dsh.getRange(dsh.getLastRow() + 1, 1, 1, DAILY_HEAD.length).setValues([row]);
  if (mode === 'daily') setState(st);

  // 5) ความก้าวหน้า + แผนภูมิ
  var L2 = readLevels();
  var psh = getSheet(SH.progress);
  psh.getRange(psh.getLastRow() + 1, 1, 1, PROGRESS_HEAD.length).setValues([[date, pctOf(sA.right, sA.total), pctOf(sB.right, sB.total), pctOf(sC.right, sC.total),
    drillInfo && sA.target ? round1s((A.firstSec + (A.correctionSec || 0)) / sA.target * 100) : '', L2.addsub, L2.mul, L2.div, L2.fracdec]]);
  try { rebuildProgressCharts(); } catch (e) { Logger.log('chart: ' + e); }

  try { props().deleteProperty('DRAFT_' + date); } catch (e) { /* ไม่สำคัญ */ }
  summary.pendingReviews = countPendingReviews();
  try { sendSessionEmail(summary); } catch (e) { Logger.log('email: ' + e); summary.emailError = String(e); }
  return { ok: true, summary: summary };
}

/** บันทึกสถิติของส่วนที่เพิ่งทำเสร็จไว้ก่อน (ร่างขนาดเล็กใน Properties) เผื่อปิดหน้าจอกลางคัน ผลเต็มจะลงชีตตอนจบทั้งชุด */
function submitSection(draft) {
  try {
    var key = 'DRAFT_' + (draft.date || todayYmd());
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
    passCell: r[11], note: r[27], totalMin: r[26], fromRow: true };
}

/** คำนวณขั้นเริ่มต้นจากแบบวัดระดับ 5 วัน */
function finalizePlacement(date, silent) {
  var cfg = getSettings(), st = getState(), L = readLevels(), rows = readItemRows(3000).filter(function (r) { return r[1] === 'placement'; });
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
  st.placementDone = true; st.nextSkill = 0;
  setState(st);
  appendBench('วัดระดับ', date, cs);
  rebuildReportSheet();
  return { starts: starts, tiers: tiers, stats: cs };
}

/* ---------------- ความก้าวหน้า ---------------- */
var PROGRESS_HEAD = ['วันที่', 'ส่วน A ถูกรอบแรก (%)', 'ส่วน B ถูกรอบแรก (%)', 'ส่วน C ถูกรอบแรก (%)', 'ส่วน A เวลารวม ÷ เป้า (%)', 'ขั้น บวกลบ', 'ขั้น คูณ', 'ขั้น หาร', 'ขั้น เศษส่วนทศนิยม'];
function rebuildProgressCharts() {
  var sh = getSheet(SH.progress), n = sh.getLastRow();
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  if (n < 2) return;
  function chart(title, cols, row, vTitle, max) {
    var b = sh.newChart().setChartType(Charts.ChartType.LINE).addRange(sh.getRange(1, 1, n, 1));
    cols.forEach(function (c) { b = b.addRange(sh.getRange(1, c, n, 1)); });
    b = b.setNumHeaders(1).setPosition(row, 11, 0, 0).setOption('title', title).setOption('legend', { position: 'bottom' })
      .setOption('pointSize', 5).setOption('width', 620).setOption('height', 300).setOption('vAxis', { title: vTitle, minValue: 0 });
    sh.insertChart(b.build());
  }
  chart('ความแม่นยำรอบแรก (% ถูก) แยกตามส่วน', [2, 3, 4], 2, '% ถูก');
  chart('ส่วน A: เวลารวม ÷ เวลาเป้าหมาย (ต่ำกว่า 100% = ทันเวลา)', [5], 18, '% ของเวลาเป้าหมาย');
  chart('ขั้นปัจจุบันของแต่ละทักษะคิดเลข', [6, 7, 8, 9], 34, 'ขั้น');
}
