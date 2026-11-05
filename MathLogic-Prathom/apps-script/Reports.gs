/**
 * Reports.gs — รายงานรายเดือน (ชีต + อีเมล), อีเมลหลังทำเสร็จ, สรุปรายสัปดาห์, งานตามเวลา (triggers)
 */
var COL = {
  up: { fg: '#137333', bg: '#e6f4ea' }, down: { fg: '#c5221f', bg: '#fce8e6' },
  flat: { fg: '#5f6368', bg: '#f1f3f4' }, none: { fg: '#80868b', bg: '#ffffff' }
};
var SPEED_CATS = ['addsub', 'mul', 'div', 'fracdec'];

/** รวมข้อมูลวัดผล → โมเดลรายงาน (คำนวณล้วน ไม่แตะ Google) */
function computeReportModel(benchRows, thr) {
  var periods = [], map = {};
  benchRows.forEach(function (r) {
    if (periods.map(function (p) { return p.label; }).indexOf(r.period) < 0) periods.push({ label: r.period, date: r.date });
    map[r.period + '|' + r.cat] = r;
  });
  var cats = CATS.map(function (c) {
    var pcts = periods.map(function (p) { var r = map[p.label + '|' + c]; return r && r.pct != null && r.total ? r.pct : null; });
    var spis = periods.map(function (p) { var r = map[p.label + '|' + c]; return r && r.spi != null && r.total ? r.spi : null; });
    var rows = { pct: [], dPrev: [], dBase: [], spi: [], sPrev: [], sBase: [] };
    periods.forEach(function (p, i) {
      rows.dPrev.push(i >= 1 ? deltaInfo(pcts[i], pcts[i - 1], thr, false) : { cls: 'none', text: '–' });
      rows.dBase.push(i >= 1 ? deltaInfo(pcts[i], pcts[0], thr, false) : { cls: 'none', text: '–' });
      rows.sPrev.push(i >= 1 ? deltaInfo(spis[i], spis[i - 1], thr, true) : { cls: 'none', text: '–' });
      rows.sBase.push(i >= 1 ? deltaInfo(spis[i], spis[0], thr, true) : { cls: 'none', text: '–' });
    });
    return { cat: c, name: CAT_NAMES[c], pcts: pcts, spis: spis, rows: rows, hasSpeed: SPEED_CATS.indexOf(c) >= 0 };
  });
  var last = periods.length - 1;
  var summary = last >= 1 ? summaryLine(cats.map(function (c) { return { name: c.name, cur: c.pcts[last], base: c.pcts[0] }; })) : 'ยังมีเฉพาะผลวัดระดับตั้งต้น (รอแบบวัดผลประจำเดือนครั้งแรก)';
  return { periods: periods, cats: cats, summary: summary };
}

function periodHead(p) { return p.label + (p.date ? '\n' + p.date : ''); }

function rebuildReportSheet() {
  var cfg = getSettings(), model = computeReportModel(readBench(), cfg.DELTA_THRESHOLD);
  var sh = getSheet(SH.report);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clear();
  var np = model.periods.length;
  if (!np) { sh.getRange(1, 1).setValue('ยังไม่มีข้อมูล — จะเริ่มแสดงเมื่อทำแบบวัดระดับครบ 5 วัน'); return; }
  var ncol = 2 + np;
  sh.getRange(1, 1).setValue('รายงานความก้าวหน้ารายเดือน (ข้อวัดผลระดับเดียวกันทุกครั้ง)').setFontWeight('bold').setFontSize(14);
  sh.getRange(2, 1).setValue(model.summary).setFontWeight('bold');
  var head = ['หมวด', 'ตัวชี้วัด'].concat(model.periods.map(periodHead));
  sh.getRange(4, 1, 1, ncol).setValues([head]).setFontWeight('bold').setBackground('#e8eaed').setWrap(true).setHorizontalAlignment('center');
  var r = 5, tags = [];
  function put(label, metric, cells, isDelta) {
    var row = [label, metric].concat(cells.map(function (c) { return isDelta ? c.text : (c == null ? '–' : c); }));
    sh.getRange(r, 1, 1, ncol).setValues([row]);
    if (isDelta) cells.forEach(function (c, i) { var k = COL[c.cls] || COL.none; sh.getRange(r, 3 + i).setFontColor(k.fg).setBackground(k.bg).setFontWeight('bold'); });
    sh.getRange(r, 3, 1, np).setHorizontalAlignment('center');
    r++;
  }
  model.cats.forEach(function (c) {
    var start = r;
    put(c.name, '% ถูก', c.pcts.map(function (v) { return v == null ? null : v; }), false);
    put('', 'เทียบเดือนก่อน (จุด %)', c.rows.dPrev, true);
    put('', 'เทียบเริ่มต้น (จุด %)', c.rows.dBase, true);
    if (c.hasSpeed) {
      put('', 'ความเร็ว (วินาที/ข้อ)', c.spis, false);
      put('', 'เร็วขึ้น/ช้าลง เทียบเดือนก่อน', c.rows.sPrev, true);
      put('', 'เร็วขึ้น/ช้าลง เทียบเริ่มต้น', c.rows.sBase, true);
    }
    sh.getRange(start, 1, r - start, 1).setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(start, 1, r - start, ncol).setBorder(true, null, null, null, null, null, '#bdc1c6', SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.getRange(r + 1, 1).setValue('คำอธิบาย: ▲ สีเขียว = ดีขึ้น  ▼ สีแดง = แย่ลง  ● สีเทา = เปลี่ยนไม่เกิน ±' + cfg.DELTA_THRESHOLD + (' (เวลา: ลดลง = ดีขึ้น)')).setFontColor('#5f6368');
  // ข้อมูลสำหรับกราฟ
  var gr = r + 4;
  sh.getRange(gr, 1, 1, 1 + np).setValues([['% ถูก (ข้อมูลกราฟ)'].concat(model.periods.map(function (p) { return p.label; }))]).setFontColor('#80868b');
  model.cats.forEach(function (c, i) {
    sh.getRange(gr + 1 + i, 1, 1, 1 + np).setValues([[c.name].concat(c.pcts.map(function (v) { return v == null ? '' : v; }))]).setFontColor('#80868b');
  });
  if (np >= 1) {
    var cb = sh.newChart().setChartType(Charts.ChartType.LINE).addRange(sh.getRange(gr, 1, 1 + model.cats.length, 1 + np)).setNumHeaders(1)
      .setPosition(gr + 9, 1, 0, 0).setOption('title', '% ถูกแยกตามหมวด: วัดระดับ → เดือนถัดไป').setOption('legend', { position: 'bottom' })
      .setOption('width', 720).setOption('height', 320).setOption('pointSize', 5).setOption('vAxis', { minValue: 0, maxValue: 100 });
    try { cb = cb.setTransposeRowsAndColumns(true); } catch (e) { /* บางเวอร์ชันไม่รองรับ */ }
    sh.insertChart(cb.build());
  }
  sh.setColumnWidth(1, 130); sh.setColumnWidth(2, 210);
  for (var i = 0; i < np; i++) sh.setColumnWidth(3 + i, 110);
  sh.setFrozenRows(4); sh.setFrozenColumns(2);
}

/* ---------------- อีเมล ---------------- */
function sendMail(subject, html) {
  var to = recipients();
  if (!to.length) { Logger.log('ไม่มีอีเมลผู้รับ'); return; }
  MailApp.sendEmail({ to: to.join(','), subject: subject, htmlBody: html, name: 'ฝึกคณิต ป.4' });
}
var MAIL_CSS = 'font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#202124;max-width:640px;';
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tdS(extra) { return 'style="border:1px solid #dadce0;padding:6px 8px;' + (extra || '') + '"'; }
function deltaSpan(d) {
  var k = COL[d.cls] || COL.none;
  return '<span style="color:' + k.fg + ';font-weight:bold;">' + esc(d.text) + '</span>';
}
function mmss(s) { return fmtSec(s); }

function sendSessionEmail(sm) {
  var cfg = getSettings(), name = esc(childLabel());
  var rows = sm.sections.map(function (s) {
    var isA = s.id === 'A', target = s.target ? mmss(s.target) : '-';
    var timeTxt = mmss(s.totalSec) + (isA && sm.mode === 'daily' ? ' / เป้า ' + target : (s.target ? ' / แนะนำ ' + target : ''));
    return '<tr><td ' + tdS() + '><b>' + esc(s.id + ' ' + s.name) + '</b></td><td ' + tdS('text-align:center;') + '>' + s.right + '/' + s.total + '</td><td ' + tdS('text-align:center;') + '>' + timeTxt + '</td><td ' + tdS('text-align:center;') + '>' + s.rounds + '</td><td ' + tdS() + '>' + esc(s.errors || '–') + '</td></tr>';
  }).join('');
  var h = '<div style="' + MAIL_CSS + '"><h2 style="margin:0 0 4px;">' + name + ' ทำแบบฝึกเสร็จแล้ว ✅</h2><div style="color:#5f6368;">' + esc(thaiDate(sm.date)) + ' · ' + esc(sm.title || sm.mode) + '</div>';
  if (sm.drill) {
    h += '<p style="margin:12px 0;padding:10px;border-radius:8px;background:' + (sm.drill.pass ? '#e6f4ea' : '#fef7e0') + ';"><b>ส่วน A ' + esc(sm.skillName) + ' ขั้น ' + sm.drill.stepNo + ' (' + esc(sm.drill.stepName) + '): ' + (sm.drill.pass ? '🎉 ผ่าน' : 'ยังไม่ผ่าน') + '</b>' + (sm.drill.reason ? '<br>' + esc(sm.drill.reason) : '') + '</p>';
  }
  h += '<table style="border-collapse:collapse;width:100%;"><tr style="background:#f1f3f4;"><th ' + tdS() + '>ส่วน</th><th ' + tdS() + '>ถูกรอบแรก</th><th ' + tdS() + '>เวลา</th><th ' + tdS() + '>รอบแก้</th><th ' + tdS() + '>ข้อผิดพลาด</th></tr>' + rows + '</table>';
  h += '<p>' + esc(sm.note || '') + '</p>';
  if (sm.drill && sm.drill.stuck) h += '<p style="color:#c5221f;"><b>⚠ ติดขั้นเดิมมา ' + sm.drill.stuck + ' ครั้งแล้ว</b> ควรนั่งดูวิธีคิดด้วยกันสักครั้ง (ระบบจะสลับไปฝึกทักษะอื่นก่อน)</p>';
  if (sm.placement) {
    h += '<h3>ผลวัดระดับ → ขั้นเริ่มต้น</h3><ul>' + SKILLS.map(function (sk) { var p = sm.placement.starts[sk]; return '<li>' + esc(SKILL_NAMES[sk]) + ': เริ่มที่ขั้น ' + p.no + ' (' + esc(p.name) + ')</li>'; }).join('') + '</ul>';
  }
  if (sm.benchmark) {
    h += '<h3>ผลแบบวัดผล ' + esc(sm.benchmark.label) + '</h3><ul>' + CATS.map(function (c) { var s = sm.benchmark.stats[c]; return s ? '<li>' + esc(CAT_NAMES[c]) + ': ' + s.pct + '%' + (SPEED_CATS.indexOf(c) >= 0 ? ' (' + s.spi + ' วินาที/ข้อ)' : '') + '</li>' : ''; }).join('') + '</ul>';
  }
  h += '<p style="color:#5f6368;font-size:13px;">ข้อที่ผิดจะกลับมาทบทวนอีกครั้งหลัง 3 วันและ 1 สัปดาห์ (ตอนนี้รอทบทวน ' + (sm.pendingReviews || 0) + ' รายการ)</p></div>';
  var subj = '[ฝึกคณิต] ' + childLabel() + ' ' + sm.date + ' — ' + (sm.drill ? (sm.drill.pass ? 'ผ่าน ' : 'ยังไม่ผ่าน ') + sm.skillName + ' ' : '') + sm.sections.map(function (s) { return s.id + ' ' + s.right + '/' + s.total; }).join(' ');
  sendMail(subj, h);
}

function weeklyJob() { sendWeeklySummary(); }
function sendWeeklySummary() {
  var cfg = getSettings(), today = todayYmd(), from = ymdAdd(today, -6);
  var rows = readDailyRows(60).filter(function (r) { return r[0] >= from && r[0] <= today; });
  var items = readItemRows(2500).filter(function (r) { return r[0] >= from && r[0] <= today && Number(r[7]) !== 1; });
  var err = {};
  items.forEach(function (r) { var e = String(r[11] || 'ตอบผิด'); err[e] = (err[e] || 0) + 1; });
  var errList = Object.keys(err).sort(function (a, b) { return err[b] - err[a]; }).slice(0, 5);
  var L = readLevels(), st = getState();
  var pct = function (a, b) { return Number(b) ? Math.round(Number(a) / Number(b) * 100) : null; };
  var tr = rows.map(function (r) {
    return '<tr><td ' + tdS() + '>' + esc(thaiDate(r[0])) + '</td><td ' + tdS() + '>' + esc(r[1]) + '</td><td ' + tdS() + '>' + esc((r[2] || '') + ' ' + (r[3] || '')) + '</td><td ' + tdS('text-align:center;') + '>' + esc(r[11]) + '</td><td ' + tdS('text-align:center;') + '>' + (pct(r[4], r[5]) == null ? '–' : pct(r[4], r[5]) + '%') + '</td><td ' + tdS('text-align:center;') + '>' + (pct(r[12], r[13]) == null ? '–' : pct(r[12], r[13]) + '%') + '</td><td ' + tdS('text-align:center;') + '>' + (pct(r[19], r[20]) == null ? '–' : pct(r[19], r[20]) + '%') + '</td></tr>';
  }).join('');
  var passN = rows.filter(function (r) { return r[11] === 'ผ่าน'; }).length, drillN = rows.filter(function (r) { return r[11] === 'ผ่าน' || r[11] === 'ไม่ผ่าน'; }).length;
  var h = '<div style="' + MAIL_CSS + '"><h2 style="margin:0 0 4px;">สรุปประจำสัปดาห์ของ' + esc(childLabel()) + '</h2><div style="color:#5f6368;">' + esc(thaiDate(from)) + ' – ' + esc(thaiDate(today)) + '</div>';
  h += '<p>ทำแบบฝึก <b>' + rows.length + '</b> วัน' + (drillN ? ' · ผ่านส่วน A <b>' + passN + '/' + drillN + '</b> ครั้ง' : '') + '</p>';
  if (rows.length) h += '<table style="border-collapse:collapse;width:100%;font-size:14px;"><tr style="background:#f1f3f4;"><th ' + tdS() + '>วัน</th><th ' + tdS() + '>ประเภท</th><th ' + tdS() + '>ส่วน A</th><th ' + tdS() + '>ผล A</th><th ' + tdS() + '>A ถูก</th><th ' + tdS() + '>B ถูก</th><th ' + tdS() + '>C ถูก</th></tr>' + tr + '</table>';
  else h += '<p style="color:#c5221f;">สัปดาห์นี้ยังไม่มีการทำแบบฝึก</p>';
  h += '<h3>ขั้นปัจจุบัน</h3><ul>' + SKILLS.map(function (sk) { var s = stepOf(sk, L[sk]); return '<li>' + esc(SKILL_NAMES[sk]) + ': ขั้น ' + s.no + ' — ' + esc(s.name) + (L.fails[sk] >= cfg.MAX_REPEATS ? ' <b style="color:#c5221f;">(ติดอยู่ ' + L.fails[sk] + ' ครั้ง)</b>' : '') + '</li>'; }).join('') + '</ul>';
  if (!st.placementDone) h += '<p>ยังอยู่ระหว่างแบบวัดระดับ (ทำแล้ว ' + st.placementDays.length + '/' + PLACEMENT_DAYS + ' วัน)</p>';
  if (errList.length) h += '<h3>ข้อผิดพลาดที่พบบ่อย</h3><ul>' + errList.map(function (e) { return '<li>' + esc(e) + ' × ' + err[e] + '</li>'; }).join('') + '</ul>';
  h += '<p style="color:#5f6368;font-size:13px;">รอทบทวน ' + countPendingReviews() + ' รายการ</p>' + dashLinkHtml() + '</div>';
  sendMail('[ฝึกคณิต] สรุปสัปดาห์ ' + childLabel() + ' ' + from + ' ถึง ' + today, h);
}

/** คลังข้อสอบหมวดไหนเหลือข้อที่ยังไม่ได้ใช้ใน BANK_RECENT_DAYS วัน น้อยกว่าเกณฑ์ */
function lowBankReport() {
  var cfg = getSettings(), today = todayYmd(), hist = historyContext(today), bank = readBank(), res = [], by = {};
  BANK_CATS.forEach(function (c) { by[c] = { fresh: 0, total: 0 }; });
  bank.forEach(function (b) {
    var a = by[b.cat] = by[b.cat] || { fresh: 0, total: 0 }, used = hist.bankUsed[b.code];
    a.total++;
    if (!used || ymdDiff(today, used) > cfg.BANK_RECENT_DAYS) a.fresh++;
  });
  Object.keys(by).forEach(function (c) { if (by[c].fresh < cfg.LOW_BANK_THRESHOLD) res.push({ cat: c, fresh: by[c].fresh, total: by[c].total }); });
  return res;
}

function dailyJob() {
  var today = todayYmd();
  if (isLastDayOfMonth(today)) sendMonthlyReport();
}
function sendMonthlyReport() {
  var cfg = getSettings(), today = todayYmd(), model = computeReportModel(readBench(), cfg.DELTA_THRESHOLD), mon = ymdMonth(today);
  var rows = readDailyRows(80).filter(function (r) { return ymdMonth(r[0]) === mon; });
  var low = lowBankReport(), np = model.periods.length;
  var h = '<div style="' + MAIL_CSS + 'max-width:760px;"><h2 style="margin:0 0 4px;">รายงานประจำเดือน ' + esc(thaiMonthLabel(today + '')) + ' ของ' + esc(childLabel()) + '</h2>';
  h += '<p>ทำแบบฝึกเดือนนี้ <b>' + rows.length + '</b> วัน</p><p style="padding:10px;border-radius:8px;background:#f1f3f4;"><b>' + esc(model.summary) + '</b></p>';
  if (np) {
    var th = '<tr style="background:#f1f3f4;"><th ' + tdS() + '>หมวด</th>' + model.periods.map(function (p) { return '<th ' + tdS() + '>' + esc(p.label) + '</th>'; }).join('') + (np >= 2 ? '<th ' + tdS() + '>เทียบเดือนก่อน</th><th ' + tdS() + '>เทียบเริ่มต้น</th>' : '') + '</tr>';
    var last = np - 1, body = model.cats.map(function (c) {
      var cells = c.pcts.map(function (v, i) { return '<td ' + tdS('text-align:center;') + '>' + (v == null ? '–' : v + '%') + (c.hasSpeed && c.spis[i] != null ? '<br><span style="color:#5f6368;font-size:12px;">' + c.spis[i] + ' วิ/ข้อ</span>' : '') + '</td>'; }).join('');
      var dp = np >= 2 ? '<td ' + tdS('text-align:center;') + '>' + deltaSpan(c.rows.dPrev[last]) + (c.hasSpeed ? '<br><span style="font-size:12px;">เวลา ' + deltaSpan(c.rows.sPrev[last]) + '</span>' : '') + '</td><td ' + tdS('text-align:center;') + '>' + deltaSpan(c.rows.dBase[last]) + (c.hasSpeed ? '<br><span style="font-size:12px;">เวลา ' + deltaSpan(c.rows.sBase[last]) + '</span>' : '') + '</td>' : '';
      return '<tr><td ' + tdS('font-weight:bold;') + '>' + esc(c.name) + '</td>' + cells + dp + '</tr>';
    }).join('');
    h += '<table style="border-collapse:collapse;width:100%;">' + th + body + '</table><p style="color:#5f6368;font-size:13px;">▲ เขียว = ดีขึ้น · ▼ แดง = แย่ลง · ● เทา = เปลี่ยนไม่เกิน ±' + cfg.DELTA_THRESHOLD + ' (เวลา: ลดลง = ดีขึ้น)</p>';
    if (model.periods[np - 1].label === 'วัดระดับ') h += '<p>เดือนนี้ยังไม่มีแบบวัดผลประจำเดือน (จะจัดวันศุกร์สุดท้ายของเดือน)</p>';
  } else h += '<p>ยังไม่มีข้อมูลวัดผล</p>';
  if (low.length) h += '<div style="margin-top:14px;padding:10px;border-radius:8px;background:#fef7e0;"><b>⚠ คลังข้อสอบกำลังจะหมด</b><ul>' + low.map(function (l) { return '<li>หมวด "' + esc(l.cat) + '": เหลือข้อที่ยังไม่ได้ใช้ใน ' + cfg.BANK_RECENT_DAYS + ' วัน เพียง ' + l.fresh + ' จาก ' + l.total + ' ข้อ — เพิ่มข้อในแท็บ "คลังข้อสอบ" ได้เลย</li>'; }).join('') + '</ul></div>';
  h += dashLinkHtml() + '</div>';
  sendMail('[ฝึกคณิต] รายงานประจำเดือน ' + childLabel() + ' ' + mon, h);
}
