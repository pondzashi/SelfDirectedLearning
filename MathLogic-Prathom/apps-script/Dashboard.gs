/**
 * Dashboard.gs — API ของหน้า Dashboard ผู้ปกครอง (?page=dashboard)
 * เว็บแอปเปิดแบบ "Anyone" จึงเช็กอีเมลผู้เปิดไม่ได้ ใช้รหัส PIN (PARENT_PIN ในแท็บตั้งค่า) แทน
 * ใส่ผิดเกิน 5 ครั้งจะล็อก 10 นาที ถ้าไม่ได้ตั้ง PIN จะเข้าไม่ได้เลย (ปลอดภัยไว้ก่อน)
 */
var DASH_FAIL_KEY = 'dash_fail', DASH_MAX_FAILS = 5, DASH_LOCK_SEC = 600;

function dash_auth_(pin) {
  var want = String(getSettings().PARENT_PIN == null ? '' : getSettings().PARENT_PIN).trim();
  if (!want) return { ok: false, reason: 'nopin' };
  var given = String(pin == null ? '' : pin).trim();
  if (!given) return { ok: false, reason: 'need' };
  var cache = CacheService.getScriptCache(), fails = Number(cache.get(DASH_FAIL_KEY) || 0);
  if (fails >= DASH_MAX_FAILS) return { ok: false, reason: 'locked' };
  if (given === want) { cache.remove(DASH_FAIL_KEY); return { ok: true }; }
  cache.put(DASH_FAIL_KEY, String(fails + 1), DASH_LOCK_SEC);
  return { ok: false, reason: 'wrong', left: DASH_MAX_FAILS - fails - 1 };
}
function dash_need_(pin) { var r = dash_auth_(pin); if (!r.ok) throw new Error('ไม่มีสิทธิ์เข้าถึง'); }

/** หน้าเว็บเรียกตอนเปิด เพื่อรู้ว่าต้องขอรหัสหรือไม่ */
function dash_check(pin) { return dash_auth_(pin); }

function readProgressRows_(maxRows) {
  var sh = getSheet(SH.progress), last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - maxRows + 1);
  return sh.getRange(start, 1, last - start + 1, PROGRESS_HEAD.length).getValues().map(function (r) { r[0] = cellToYmd(r[0]); return r; });
}

/** แพ็กข้อมูลทั้งหมดของ Dashboard เป็นก้อนเดียว */
function dash_getBundle(pin) {
  dash_need_(pin);
  var cfg = getSettings(), st = getState(), L = readLevels(), today = todayYmd(), green = cfg.DASH_GREEN, yellow = cfg.DASH_YELLOW;
  var list = dashDailyList(readDailyRows(400)), doneSet = {}, passMap = {};
  list.forEach(function (d) { doneSet[d.date] = true; passMap[d.date] = d.pass; });
  var from30 = ymdAdd(today, -30), from14 = ymdAdd(today, -14);
  var items = readItemRows(6000);
  var model = computeReportModel(readBench(), cfg.DELTA_THRESHOLD);
  var streak = dashStreak(doneSet, today, cfg.practiceDays), missed = dashMissed(doneSet, cfg.START_DATE, today, cfg.practiceDays);
  var due = getDueReviews(today), low = [];
  try { low = lowBankReport(); } catch (e) { low = []; }
  var todayRow = list.filter(function (d) { return d.date === today; })[0];
  var alerts = dashAlerts({ startDate: cfg.START_DATE, today: today, placement: { done: st.placementDone, days: st.placementDays.length, of: PLACEMENT_DAYS },
    fails: L.fails, levels: L, maxRepeats: cfg.MAX_REPEATS, missed: missed, list: list, yellow: yellow, dueReviews: due.length, lowBank: low,
    streak: streak, todayDone: !!todayRow, todayPass: todayRow && todayRow.pass });
  var history = list.slice().reverse().slice(0, 60).map(function (d) {
    return { date: d.date, mode: d.mode, skillName: d.skillName, stepLabel: d.stepLabel, pass: d.pass, aPct: d.aPct, bPct: d.bPct, cPct: d.cPct, ratio: d.ratio,
      A: d.A, B: d.B, C: d.C, totalMin: d.totalMin, note: d.note };
  });
  var bank = [];
  try {
    var hist = historyContext(today), by = {};
    readBank().forEach(function (b) { var a = by[b.cat] = by[b.cat] || { cat: b.cat, fresh: 0, total: 0 }, u = hist.bankUsed[b.code]; a.total++; if (!u || ymdDiff(today, u) > cfg.BANK_RECENT_DAYS) a.fresh++; });
    bank = Object.keys(by).map(function (k) { return by[k]; });
  } catch (e) { bank = []; }
  return {
    title: 'ฝึกคณิต ป.4', child: childLabel(), today: today, startDate: cfg.START_DATE, practiceDays: cfg.practiceDays,
    thresholds: { green: green, yellow: yellow }, deltaThreshold: cfg.DELTA_THRESHOLD,
    placement: { done: st.placementDone, days: st.placementDays.length, of: PLACEMENT_DAYS }, tiers: L.tiers,
    kpi: { streak: streak, missed: missed, sessions: list.length, month: dashMonthStats(list, ymdMonth(today)), pendingReviews: countPendingReviews(), dueReviews: due.length,
      today: todayRow ? { pass: todayRow.pass, aPct: todayRow.aPct, bPct: todayRow.bPct, cPct: todayRow.cPct, mode: todayRow.mode } : null },
    skills: dashSkillProgress(L), alerts: alerts,
    calendar: dashCalendar(passMap, today, cfg.START_DATE, cfg.practiceDays, 6),
    series: dashSeries(readProgressRows_(200)),
    report: model, radar: dashRadar(model),
    errors30: dashErrorStats(items, from30), errors14: dashErrorStats(items, from14),
    history: history, reviews: { pending: countPendingReviews(), due: due.slice(0, 12).map(function (r) { return { key: r.key, label: dashTagLabel(r.key), cat: r.cat, due: r.due }; }) },
    bank: bank, serverNow: new Date().getTime()
  };
}

/** รายละเอียดของวันหนึ่ง: ข้อที่ผิดรอบแรกพร้อมโจทย์ */
function dash_getSession(pin, date) {
  dash_need_(pin);
  date = String(date || '');
  var rows = readItemRows(6000).filter(function (r) { return String(r[0]) === date; });
  var secName = { A: 'คิดเลขเร็ว', B: 'การสังเกต', C: 'คิดวิเคราะห์' };
  return {
    date: date, total: rows.length,
    wrong: rows.filter(function (r) { return Number(r[7]) !== 1; }).map(function (r) {
      return { section: secName[r[2]] || String(r[2]), cat: CAT_NAMES[r[3]] || String(r[3]), label: dashTagLabel(r[4]), q: String(r[16] || ''), errType: String(r[11] || ''), tries: Number(r[8]) || 1, revealed: Number(r[9]) === 1, review: Number(r[12]) === 1 };
    })
  };
}

function dashLinkHtml() {
  var u = dashboardUrl();
  return u ? '<p style="margin-top:14px;"><a href="' + u + '" style="display:inline-block;padding:8px 14px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;">เปิด Dashboard ผู้ปกครอง</a> <span style="color:#5f6368;font-size:12px;">(ต้องใช้รหัส PARENT_PIN)</span></p>' : '';
}

/** ลิงก์ Dashboard ใส่ท้ายอีเมล (ถ้าหาไม่ได้ก็ว่าง) */
function dashboardUrl() {
  try { var u = ScriptApp.getService().getUrl(); return u ? u + '?page=dashboard' : ''; } catch (e) { return ''; }
}
