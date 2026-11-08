/**
 * SetBuilder.gs — ประกอบชุดข้อประจำวัน / แบบวัดระดับ (สัปดาห์แรก) / แบบวัดผลรายเดือน
 * ไม่เรียก API ของ Google: รับ ctx แล้วคืนชุดข้อ (ทดสอบด้วย Node ได้)
 *
 * ctx = {
 *   levels: {addsub:ขั้น, mul:ขั้น, div:ขั้น, fracdec:ขั้น, tiers:{word,observe,analytic}},
 *   skill: ทักษะของส่วน A วันนี้ (โหมด daily),
 *   usedSigs: {ลายเซ็นโจทย์ที่เคยออกใน 30 วันที่ผ่านมา: 1},
 *   recentTpl: {รหัสแม่แบบที่ใช้ใน 3 วันล่าสุด: 1},
 *   bank: [{code,cat,level,q,ans,explain,choices}], bankUsed: {code: 'yyyy-MM-dd'},
 *   reviews: [{id,key,cat,tier,level,fixCat}]  (ที่ถึงกำหนดทบทวน)
 * }
 * ต้องเรียก setRng(...) ก่อน เพื่อให้ชุดข้อของวันเดียวกันออกมาเหมือนเดิม
 */
var PLACEMENT_PER_STEP = 2;
var DAILY_B_COUNT = 6, DAILY_C_COUNT = 6;
var MAX_REVIEW = { A: 3, B: 2, C: 3 };

/** ข้อกำหนดชุดวัดผลที่ "ตรึงไว้" ใช้ร่วมกันระหว่างวัดระดับสัปดาห์แรกกับแบบวัดผลรายเดือน (ไม่ขึ้นกับระดับปัจจุบันของเด็ก) */
var BENCH_SPEC = {
  observe: [{ grp: 'seq', tier: 1 }, { grp: 'seq', tier: 3 }, { grp: 'vis', tier: 2 }, { grp: 'odd', tier: 2 }, { grp: 'err', tier: 2 }],
  wordTiers: [1, 2, 3, 4],
  analytic: [{ grp: 'data', tier: 2 }, { grp: 'logic', tier: 2 }, { grp: 'logic', tier: 3 }, { grp: 'count', tier: 3 }]
};

function uniqueItem(gen, ctx, tries) {
  var it = null;
  for (var i = 0; i < (tries || 30); i++) {
    try { it = gen(); } catch (e) { it = null; continue; }
    it.sig = sigOf(it);
    if (!ctx.usedSigs[it.sig]) break;
  }
  if (!it) throw new Error('สร้างโจทย์ไม่สำเร็จ');
  ctx.usedSigs[it.sig] = 1;
  return it;
}
function flag(it, f) { for (var k in f) it[k] = f[k]; return it; }

function genTpl(cat, grp, tier, ctx, local, flags) {
  var ex = {}, k;
  for (k in (ctx.recentTpl || {})) ex[k] = 1;
  for (k in local) ex[k] = 1;
  var id = pickTemplate(cat, grp, tier, ex, ctx.topic ? topicPrefer(ctx.topic) : null);
  local[id] = 1;
  return flag(uniqueItem(function () { return buildTemplate(id, tier); }, ctx), flags || {});
}

function fixedMap(ctx) {
  if (!ctx._fix) {
    ctx._fix = {};
    (ctx.bank || []).forEach(function (r) { var it = fixedToItem(r); if (it) ctx._fix[r.code] = it; });
  }
  return ctx._fix;
}
/** เลือกข้อจากคลัง: ข้อที่ไม่ได้ใช้นานที่สุดก่อน ระดับไม่เกิน tier+1 */
function pickFixed(ctx, cats, tier, flags, exceptCode) {
  var fm = fixedMap(ctx), used = ctx.bankUsed || {}, local = ctx._fixLocal = ctx._fixLocal || {};
  var cands = Object.keys(fm).filter(function (c) {
    var it = fm[c];
    return cats.indexOf(it.fixCat) >= 0 && it.level <= tier + 1 && !local[c] && c !== exceptCode;
  });
  if (!cands.length) return null;
  cands = shuffle(cands);
  cands.sort(function (a, b) { return String(used[a] || '').localeCompare(String(used[b] || '')); });
  var code = cands[0];
  local[code] = 1;
  var it = JSON.parse(JSON.stringify(fm[code]));
  it.sig = sigOf(it);
  return flag(it, flags || {});
}

/** สร้างข้อทบทวนจากรายการที่ถึงกำหนด (ตัวเลขใหม่ แนวคิดเดิม) */
function regenReview(rv, ctx, local) {
  var km = /^(GEN|TPL|FIX|PG):(.+)$/.exec(String(rv.key)) || [], kind = km[1], id = km[2], it = null, fl = { review: true, reviewId: rv.id };
  if (kind === 'PG' && pageKind(id)) it = flag(uniqueItem(function () { return oneOfKind(id, rv.tier || 1); }, ctx), fl);
  else if (kind === 'GEN' && STEP_BY_ID[id]) it = flag(uniqueItem(function () { return genStep(id); }, ctx), fl);
  else if (kind === 'TPL' && TPL_BY_ID[id]) it = flag(uniqueItem(function () { return buildTemplate(id, rv.tier || 2); }, ctx), fl);
  else if (kind === 'FIX') {
    var row = fixedMap(ctx)[id];
    it = pickFixed(ctx, [(row && row.fixCat) || rv.fixCat || 'ตรรกะ'], (row && row.level) || rv.level || 2, fl, id) ||
      (row ? flag(JSON.parse(JSON.stringify(row)), fl) : null);
    if (it && !it.sig) it.sig = sigOf(it);
  }
  return it;
}
function takeReviews(ctx, cats, max, local) {
  var out = [];
  (ctx.reviews || []).forEach(function (rv) {
    if (out.length >= max || rv._taken || cats.indexOf(rv.cat) < 0) return;
    var gm = /^GEN:(.+)$/.exec(String(rv.key));
    if (gm && STEP_BY_ID[gm[1]] && ctx.levels && STEP_BY_ID[gm[1]].no > ctx.levels[STEP_BY_ID[gm[1]].skill]) return;  // ยังไม่ถึงขั้นนี้ ไว้ก่อน
    var it = regenReview(rv, ctx, local);
    if (it) { rv._taken = true; out.push(it); }
  });
  return out;
}

function mkSection(id, name, sub, kind, items, extra) {
  var s = { id: id, name: name, sub: sub, kind: kind, items: items };
  for (var k in (extra || {})) s[k] = extra[k];
  return s;
}
function reviewIdsOf(sections) {
  var ids = [];
  sections.forEach(function (s) { s.items.forEach(function (i) { if (i.reviewId) ids.push(i.reviewId); }); });
  return ids;
}

/* ---------------- ชุดประจำวัน ---------------- */
function buildDailySet(ctx) {
  var T3 = ctx.levels.tiers, rot = ctx.rot, topic = rot.topic, round = planRound(ctx.rounds[topic]), setNo = rot.setNo, local = {};
  ctx.topic = topic;
  var b = buildASetItems(topic, round, setNo, ctx);
  var revA = takeReviews(ctx, SKILLS, MAX_REVIEW.A, local);
  var xSec = Math.round(b.xSec * (ctx.targetMult || 1)), ySec = Math.round(xSec * (ctx.yFactor || 1.5)), assess = setNo === ROT_SETS;
  var pages = b.pages.slice();
  if (revA.length) pages.push({ n: revA.length, start: b.items.length, kind: 'review', label: 'ทบทวนข้อที่เคยพลาด', title: 'ทบทวนข้อที่เคยพลาด (ไม่นับในการประเมิน)', lvl: 0, pattern: false, observe: null });
  var A = mkSection('A', 'คิดเลขเร็ว', rotLabel(topic, round, setNo, rot.repeat) + ' · ' + SET_KIND_LABEL[setNo], 'drill', b.items.concat(revA),
    { mainCount: b.items.length, pages: pages, targetSec: xSec, graded: assess, assessment: assess, topic: topic, topicName: TOPIC_NAMES[topic], round: round, setNo: setNo, repeat: !!rot.repeat, weekNo: rot.weekNo, xSec: xSec, ySec: ySec, skill: TOPIC_CAT[topic] });

  // B การสังเกต
  var bSlots = ['seq', 'seq', 'vis', 'odd', 'err', 'FIX'];
  var revB = takeReviews(ctx, ['observe'], MAX_REVIEW.B, local), bItems = [];
  var bNew = bSlots.slice(0, DAILY_B_COUNT - revB.length);
  bNew.forEach(function (g) {
    var it = null;
    if (g === 'FIX') it = pickFixed(ctx, ['สังเกต'], T3.observe, {});
    bItems.push(it || genTpl('observe', g === 'FIX' ? 'seq' : g, T3.observe, ctx, local));
  });
  bItems = bItems.concat(revB);
  var B = mkSection('B', 'การสังเกต', 'แบบรูป หาตัวที่ไม่เข้าพวก หาจุดผิด', 'plain', shuffleKeepReviewLast(bItems), { recSec: 360, graded: false });

  // C คิดวิเคราะห์
  var revC = takeReviews(ctx, ['word', 'analytic'], MAX_REVIEW.C, local), cItems = [];
  var cSlots = [['word', 'w', T3.word], ['word', 'w', T3.word], ['analytic', 'data', T3.analytic], ['analytic', 'logic', T3.analytic], ['analytic', 'count', T3.analytic], 'FIX'];
  cSlots.slice(0, DAILY_C_COUNT - revC.length).forEach(function (sl) {
    var it = null;
    if (sl === 'FIX') it = pickFixed(ctx, ['ตรรกะ', 'โจทย์ปัญหา', 'อ่านข้อมูล'], T3.analytic, {});
    cItems.push(it || (sl === 'FIX' ? genTpl('analytic', 'logic', T3.analytic, ctx, local) : genTpl(sl[0], sl[1], sl[2], ctx, local)));
  });
  cItems = cItems.concat(revC);
  var C = mkSection('C', 'คิดวิเคราะห์', 'โจทย์หลายขั้นตอน ตาราง/แผนภูมิ ปริศนาตรรกะ', 'plain', cItems, { recSec: 540, graded: false });
  var secs = [A, B, C];
  return { mode: 'daily', title: 'ชุดฝึกประจำวัน', sections: secs, reviewIds: reviewIdsOf(secs),
    meta: { topic: topic, topicName: TOPIC_NAMES[topic], round: round, setNo: setNo, repeat: !!rot.repeat, assessment: assess, xSec: xSec, ySec: ySec } };
}
function shuffleKeepReviewLast(arr) {
  var a = arr.filter(function (x) { return !x.review; }), r = arr.filter(function (x) { return x.review; });
  return a.concat(r);
}

/* ---------------- บันไดวัดระดับ ---------------- */
function ladderItems(skill, ctx) {
  var list = skillSteps(skill), out = [], sum = 0;
  list.forEach(function (st, idx) {
    for (var j = 0; j < PLACEMENT_PER_STEP; j++) {
      var it = flag(uniqueItem(function () { return genStep(st.id); }, ctx), { ladder: idx, ladderSkill: skill, main: true, cmp: (j === 0 && idx % 2 === 0) });
      out.push(it); sum += st.spp;
    }
  });
  return { items: out, targetSec: sum };
}
function observeSpecItems(specs, ctx, local, cmp) {
  return specs.map(function (sp) { return genTpl('observe', sp.grp, sp.tier, ctx, local, { cmp: cmp }); });
}
function analyticSpecItems(specs, ctx, local, cmp) {
  return specs.map(function (sp) { return genTpl('analytic', sp.grp, sp.tier, ctx, local, { cmp: cmp }); });
}
function wordSpecItems(tiers, ctx, local, cmp) {
  return tiers.map(function (t) { return genTpl('word', 'w', t, ctx, local, { cmp: cmp }); });
}

/** วันวัดระดับ day = 0..4 (จันทร์..ศุกร์ของสัปดาห์แรก นับตามลำดับวันที่ทำ ไม่ผูกกับวันในสัปดาห์) */
function buildPlacementDay(ctx, day) {
  var local = {}, names = ['บวกลบ', 'คูณ', 'หาร', 'เศษส่วนและทศนิยม', 'โจทย์ปัญหา + สังเกต + วิเคราะห์'], secs;
  if (day <= 3) {
    var skill = SKILLS[day], lad = ladderItems(skill, ctx);
    var A = mkSection('A', 'คิดเลขเร็ว', 'วัดระดับ' + SKILL_NAMES[skill] + ' (จากง่ายไปยาก)', 'drill', lad.items,
      { mainCount: lad.items.length, targetSec: lad.targetSec, graded: false, placement: true, skill: skill });
    var B = mkSection('B', 'การสังเกต', 'วอร์มอัพ', 'plain', observeSpecItems([{ grp: 'seq', tier: 2 }, { grp: 'odd', tier: 2 }, { grp: 'vis', tier: 2 }], ctx, local, false), { recSec: 240, graded: false });
    var C = mkSection('C', 'คิดวิเคราะห์', 'วอร์มอัพ', 'plain', [genTpl('word', 'w', 2, ctx, local, { cmp: false }), genTpl('analytic', 'data', 2, ctx, local, { cmp: false })], { recSec: 300, graded: false });
    secs = [A, B, C];
  } else {
    var aItems = wordSpecItems(BENCH_SPEC.wordTiers, ctx, local, true).concat(wordSpecItems([1, 2, 3, 4], ctx, local, false));
    var bItems = observeSpecItems(BENCH_SPEC.observe, ctx, local, true).concat(observeSpecItems([{ grp: 'seq', tier: 2 }, { grp: 'odd', tier: 3 }], ctx, local, false));
    var cItems = analyticSpecItems(BENCH_SPEC.analytic, ctx, local, true).concat(analyticSpecItems([{ grp: 'data', tier: 1 }, { grp: 'count', tier: 2 }], ctx, local, false));
    secs = [mkSection('A', 'โจทย์ปัญหา', 'วัดระดับโจทย์ปัญหา', 'plain', aItems, { recSec: 600, graded: false }),
      mkSection('B', 'การสังเกต', 'วัดระดับการสังเกต', 'plain', bItems, { recSec: 420, graded: false }),
      mkSection('C', 'คิดวิเคราะห์', 'วัดระดับคิดวิเคราะห์', 'plain', cItems, { recSec: 540, graded: false })];
  }
  return { mode: 'placement', placementDay: day, title: 'แบบวัดระดับวันที่ ' + (day + 1) + ': ' + names[day], sections: secs, reviewIds: [], meta: {} };
}

/** แบบวัดผลรายเดือน: ระดับเดียวกับแบบวัดระดับทุกประการ (ตรึงไว้ ไม่ขึ้นกับระดับปัจจุบัน) */
function buildBenchmark(ctx) {
  var local = {}, items = [], tgt = 0;
  SKILLS.forEach(function (sk) {
    skillSteps(sk).forEach(function (st, idx) {
      if (idx % 2 === 0) { items.push(flag(uniqueItem(function () { return genStep(st.id); }, ctx), { ladder: idx, ladderSkill: sk, main: true, cmp: true })); tgt += st.spp; }
    });
  });
  var A = mkSection('A', 'คิดเลขเร็ว', 'แบบวัดผลรายเดือน (ทุกทักษะ จากง่ายไปยาก)', 'drill', items, { mainCount: items.length, targetSec: tgt, graded: false, benchmark: true });
  var B = mkSection('B', 'การสังเกต', 'แบบวัดผลรายเดือน', 'plain', observeSpecItems(BENCH_SPEC.observe, ctx, local, true), { recSec: 300, graded: false });
  var C = mkSection('C', 'คิดวิเคราะห์', 'โจทย์ปัญหา + คิดวิเคราะห์', 'plain', wordSpecItems(BENCH_SPEC.wordTiers, ctx, local, true).concat(analyticSpecItems(BENCH_SPEC.analytic, ctx, local, true)), { recSec: 600, graded: false });
  return { mode: 'benchmark', title: 'แบบวัดผลประจำเดือน (ระดับเดียวกับแบบวัดระดับ)', sections: [A, B, C], reviewIds: [], meta: {} };
}
