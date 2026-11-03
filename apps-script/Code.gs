/**
 * Code.gs — Web App: route หน้า, API ของหน้าสอบ (api_*), API ของ Dashboard (dash_*), ตัวปิดการสอบอัตโนมัติ
 * เวลาทั้งหมดตัดสินที่ server (nowMs_()) ไม่เชื่อเวลาจาก client
 */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'exam';
  var tpl;
  if (page === 'dashboard') {
    tpl = HtmlService.createTemplateFromFile('Dashboard');
  } else {
    tpl = HtmlService.createTemplateFromFile('Exam'); // token อ่านฝั่งหน้าเว็บด้วย google.script.url
  }
  tpl.title = String(settings_().exam_title || 'Pre-test');
  return tpl.evaluate()
    .setTitle(tpl.title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

// ================================================================ ตัวช่วยกลาง

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function graceMs_() { return toNumber_(settings_().grace_sec, 5) * 1000; }
function isDrill_(mode) { return mode === 'drill_auto' || mode === 'drill_custom'; }

function newToken_() { return 'T' + Utilities.getUuid().replace(/-/g, '').slice(0, 23); }

/** แปลงแถว Sessions เป็น object ใช้งาน (parse JSON) */
function loadSession_(row) {
  var s = row;
  s.plan = s.plan_json ? JSON.parse(s.plan_json) : [];
  s.config = s.config_json ? JSON.parse(s.config_json) : {};
  s.current_idx = toNumber_(s.current_idx, 0);
  s.started_ms = toMs_(s.started_ms);
  s.last_event_ms = toMs_(s.last_event_ms);
  s.ans_row_start = toNumber_(s.ans_row_start, 0);
  s.ans_count = toNumber_(s.ans_count, 0);
  s.tab_switches = toNumber_(s.tab_switches, 0);
  s.review_released = toBool_(s.review_released);
  return s;
}

function saveSession_(s) {
  var o = {};
  Object.keys(s).forEach(function (k) { if (k !== 'plan' && k !== 'config') o[k] = s[k]; });
  o.plan_json = JSON.stringify(s.plan);
  o.config_json = JSON.stringify(s.config || {});
  writeRow_('Sessions', s.__row, o);
}

function findSessionByCol_(col, value) {
  var sh = sheet_('Sessions');
  var last = sh.getLastRow();
  if (last < 2) return null;
  var ci = headersOf_(sh).indexOf(col);
  var vals = sh.getRange(2, ci + 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return null;
}

function getSessionById_(sid) {
  var row = findSessionByCol_('session_id', sid);
  if (!row) throw new Error('ไม่พบ session');
  return loadSession_(readRow_('Sessions', row));
}

function readAnswers_(s) { return readRows_('Answers', s.ans_row_start, s.ans_count); }

/** ประเมินเวลา แล้วบันทึก/ปิด session ถ้าจำเป็น. คืน {finished, evalResult} */
function tick_(s, nowMs) {
  if (s.status !== 'in_progress') return { finished: true };
  var ev = evaluatePlan_(s.plan, s.current_idx, nowMs, graceMs_());
  if (ev.changed) { s.plan = ev.plan; s.current_idx = ev.currentIdx; }
  if (ev.finished) {
    finalize_(s, 'time_up', ev.finishedAt, nowMs);
    return { finished: true };
  }
  if (ev.changed) saveSession_(s);
  return { finished: false };
}

/** ตรวจคำตอบทั้งหมด เขียน Results และสรุปคะแนน แล้วล็อก session */
function finalize_(s, reason, endMs, nowMs) {
  var answers = readAnswers_(s);
  var g = gradeAnswers_(answers.map(function (a) {
    return { subject: a.subject, skill: a.skill, difficulty: a.difficulty, correct: str_(a.correct),
      chosen: str_(a.chosen), time_spent_ms: a.time_spent_ms };
  }));
  writeColumn_('Answers', 'is_correct', s.ans_row_start, g.answers.map(function (a) { return a.is_correct; }));
  var finishedAt = new Date(endMs);
  var rows = g.rows.map(function (r, i) {
    return { result_id: s.session_id + '|' + i, session_id: s.session_id, mode: s.mode, subject: r.subject, skill: r.skill,
      finished_at: finishedAt, finished_ms: endMs, n_total: r.n_total, n_correct: r.n_correct, n_wrong: r.n_wrong,
      n_skipped: r.n_skipped, pct: r.pct, avg_time_sec: r.avg_time_sec,
      d1_n: r.d1_n, d1_correct: r.d1_correct, d2_n: r.d2_n, d2_correct: r.d2_correct, d3_n: r.d3_n, d3_correct: r.d3_correct };
  });
  appendRows_('Results', rows);
  s.status = reason === 'manual' ? 'submitted' : 'expired_auto';
  s.submitted_at = new Date(endMs);
  s.submitted_ms = endMs;
  s.submit_reason = reason;
  s.n_total = g.summary.n_total; s.n_correct = g.summary.n_correct;
  s.n_wrong = g.summary.n_wrong; s.n_skipped = g.summary.n_skipped; s.score_pct = g.summary.score_pct;
  s.used_sec = Math.max(0, Math.round((endMs - s.started_ms) / 1000));
  saveSession_(s);
}

/** ตัวปิดการสอบที่หมดเวลา (trigger ทุก 5 นาที และเรียกตอนเปิด Dashboard) */
function sweepExpiredSessions() {
  return withLock_(function () {
    var now = nowMs_(), n = 0;
    readTable_('Sessions').forEach(function (r) {
      if (String(r.status) !== 'in_progress') return;
      var s = loadSession_(r);
      var res = tick_(s, now);
      if (res.finished) n++;
    });
    return n;
  });
}

// ================================================================ API หน้าสอบ

function labelOf_(subject) { return subjectLabels_()[subject] || subject; }

/** ข้อมูลหน้าแรก/สถานะ ตาม token */
function api_open(token) {
  return withLock_(function () {
    var row = findSessionByCol_('token', String(token || ''));
    if (!row) return { phase: 'invalid' };
    var s = loadSession_(readRow_('Sessions', row));
    if (s.status === 'void') return { phase: 'invalid' };
    if (s.status === 'issued') return lobbyInfo_(s);
    return stateFor_(s);
  });
}

function api_getState(sessionId) {
  return withLock_(function () { return stateFor_(getSessionById_(sessionId)); });
}

/** ซิงก์นาฬิกาแบบเบา (client เรียกทุก 30 วินาที) */
function api_ping(sessionId) {
  return withLock_(function () {
    var now = nowMs_();
    var s = getSessionById_(sessionId);
    tick_(s, now);
    if (s.status !== 'in_progress') return { phase: 'done', serverNow: now };
    return { phase: 'exam', serverNow: now, currentIdx: s.current_idx, remainingMs: Math.max(0, s.plan[s.current_idx].deadline_ms - now) };
  });
}

function lobbyInfo_(s) {
  var settings = settings_();
  var labels = subjectLabels_();
  var mockDone = mockSubjectsDone_();
  var subjects = SUBJECTS.map(function (sub) {
    var bp = blueprint_(sub);
    return { subject: sub, label: labels[sub], minutes: durationMin_(sub),
      questions: bp.reduce(function (a, b) { return a + b[1]; }, 0),
      skills: SKILLS[sub], drillAutoReady: !!mockDone[sub] };
  });
  return { phase: 'lobby', sessionId: s.session_id, title: String(settings.exam_title), locked: s.config || {},
    subjects: subjects, drillDefault: { total: toNumber_(settings.drill_default_total, 15),
      secPerQuestion: toNumber_(settings.drill_sec_per_question, 60) }, label: s.label || '' };
}

function mockSubjectsDone_() {
  var done = {};
  readTable_('Results').forEach(function (r) {
    if (String(r.mode).indexOf('mock') === 0) done[String(r.subject)] = true;
  });
  return done;
}

function reviewAllowed_(s) {
  if (s.status !== 'submitted' && s.status !== 'expired_auto') return false;
  if (isDrill_(s.mode)) return true;
  return s.reveal_policy === 'immediate' || s.review_released;
}

/** สถานะที่ส่งให้ client (ไม่มีเฉลยของข้อที่ยังสอบอยู่) */
function stateFor_(s) {
  var now = nowMs_();
  var res = tick_(s, now);
  if (s.status !== 'in_progress') return finishedInfo_(s);
  var plan = s.plan;
  var cur = plan[s.current_idx];
  var qmap = questionMap_(false);
  var answers = readAnswers_(s).filter(function (a) { return toNumber_(a.subject_idx, 0) === s.current_idx; });
  var groupPassage = {};
  Object.keys(qmap).forEach(function (id) {
    var q = qmap[id];
    if (q.group_id && q.passage && !groupPassage[q.group_id]) groupPassage[q.group_id] = q.passage;
  });
  var drill = isDrill_(s.mode);
  var questions = answers.map(function (a) {
    var q = qmap[str_(a.question_id)];
    var order = JSON.parse(a.option_order);
    var o = {
      qid: q.id, pos: toNumber_(a.position, 0), group_id: q.group_id,
      passage: q.passage || (q.group_id ? groupPassage[q.group_id] || '' : ''),
      stem: q.stem, hasImage: !!q.image_url,
      choices: order.map(function (k) { return { k: k, t: q.choices[k] }; }),
      chosen: str_(a.chosen), flagged: toBool_(a.flagged), skipped: toBool_(a.skipped)
    };
    if (drill && str_(a.is_correct) !== '') o.reveal = revealOf_(q, str_(a.chosen));
    return o;
  });
  return {
    phase: 'exam', sessionId: s.session_id, mode: s.mode, title: String(settings_().exam_title),
    serverNow: now, currentIdx: s.current_idx,
    subjects: plan.map(function (p, i) {
      return { subject: p.subject, label: labelOf_(p.subject), minutes: Math.round(p.duration_ms / 600) / 100,
        status: i < s.current_idx ? 'done' : (i === s.current_idx ? 'current' : 'upcoming') };
    }),
    deadlineMs: cur.deadline_ms, remainingMs: Math.max(0, cur.deadline_ms - now),
    warnMinutes: String(settings_().warn_minutes).split(',').map(Number).filter(function (x) { return x > 0; }),
    isLast: s.current_idx === plan.length - 1, drill: drill, questions: questions
  };
}

function revealOf_(q, chosen) {
  return { answer: q.answer, correct: chosen === q.answer, explanation: q.explanation, why: q.why, takeaway: q.takeaway,
    hasExplImage: !!q.explanation_image_url };
}

function finishedInfo_(s) {
  var info = { phase: 'done', sessionId: s.session_id, mode: s.mode, title: String(settings_().exam_title),
    reason: s.submit_reason, canReview: reviewAllowed_(s), drill: isDrill_(s.mode) };
  if (info.canReview) {
    info.summary = { score_pct: toNumber_(s.score_pct, 0), n_correct: toNumber_(s.n_correct, 0), n_wrong: toNumber_(s.n_wrong, 0),
      n_skipped: toNumber_(s.n_skipped, 0), n_total: toNumber_(s.n_total, 0), used_sec: toNumber_(s.used_sec, 0) };
    info.bySubject = subjectBreakdown_(s.session_id);
  }
  return info;
}

function subjectBreakdown_(sessionId) {
  var m = {}, order = [];
  readTable_('Results').forEach(function (r) {
    if (String(r.session_id) !== sessionId) return;
    var k = String(r.subject);
    if (!m[k]) { m[k] = { subject: k, label: labelOf_(k), n_total: 0, n_correct: 0, skills: [] }; order.push(k); }
    m[k].n_total += toNumber_(r.n_total, 0); m[k].n_correct += toNumber_(r.n_correct, 0);
    m[k].skills.push({ skill: String(r.skill), n_total: toNumber_(r.n_total, 0), n_correct: toNumber_(r.n_correct, 0), pct: toNumber_(r.pct, 0) });
  });
  return order.map(function (k) { m[k].pct = m[k].n_total ? Math.round(1000 * m[k].n_correct / m[k].n_total) / 10 : 0; return m[k]; });
}

/** ผู้สอบกด "เริ่มสอบ": ใช้ token (ครั้งเดียว) สุ่มข้อ สร้างแถว Answers */
function api_start(token, choice) {
  return withLock_(function () {
    var row = findSessionByCol_('token', String(token || ''));
    if (!row) return { phase: 'invalid' };
    var s = loadSession_(readRow_('Sessions', row));
    if (s.status !== 'issued') return stateFor_(s);
    var now = nowMs_();
    var cfg = s.config || {};
    choice = choice || {};
    var mode = cfg.mode || choice.mode;
    var subject = cfg.subject || choice.subject;
    if (['mock_subject', 'mock_full', 'drill_auto', 'drill_custom'].indexOf(mode) < 0) throw new Error('โหมดไม่ถูกต้อง');
    var settings = settings_();
    var questions = loadQuestions_(true).filter(function (q) {
      return q.status === 'active' || (q.status === 'flagged' && String(settings.flagged_policy) !== 'exclude');
    });
    var history = recentHistory_();
    var rng = Math.random;
    var subjects, blueprints = {}, durations = {};
    var secPer = toNumber_(settings.drill_sec_per_question, 60);

    if (mode === 'mock_full') {
      subjects = SUBJECTS.slice();
      subjects.forEach(function (sub) { blueprints[sub] = blueprint_(sub); durations[sub] = durationMin_(sub); });
    } else {
      if (SUBJECTS.indexOf(subject) < 0) throw new Error('กรุณาเลือกวิชา');
      subjects = [subject];
      if (mode === 'mock_subject') {
        blueprints[subject] = blueprint_(subject); durations[subject] = durationMin_(subject);
      } else if (mode === 'drill_auto') {
        var stats = skillStatsFor_(subject);
        if (!stats.hasMock) throw new Error('Drill อัตโนมัติใช้ได้หลังทำ Mock วิชานี้อย่างน้อย 1 ครั้ง');
        var total = toNumber_(cfg.count || choice.count, toNumber_(settings.drill_default_total, 15));
        blueprints[subject] = allocateDrill_(stats.skills, total, toNumber_(settings.drill_min_per_skill, 2));
        if (!blueprints[subject].length) throw new Error('ยังไม่มีข้อมูลทักษะพอจะฝึกอัตโนมัติ');
        durations[subject] = (cfg.minutes || choice.minutes) ? Number(cfg.minutes || choice.minutes) : total * secPer / 60;
      } else {
        var picked = (cfg.skills || choice.skills || []).filter(function (k) { return SKILLS[subject].indexOf(k) >= 0; });
        if (!picked.length) picked = SKILLS[subject].slice();
        var cnt = Math.max(1, Math.min(100, toNumber_(cfg.count || choice.count, 10)));
        blueprints[subject] = splitEvenly_(picked, cnt);
        durations[subject] = (cfg.minutes || choice.minutes) ? Number(cfg.minutes || choice.minutes) : cnt * secPer / 60;
      }
    }
    if (durations[subject || subjects[0]] <= 0) throw new Error('เวลาไม่ถูกต้อง');

    var ansRows = [], position, shortfall = {};
    subjects.forEach(function (sub, si) {
      var pool = questions.filter(function (q) { return q.subject === sub; });
      var sel = selectQuestions_(pool, blueprints[sub], mix_(), history.recentIds, history.lastSeen, rng);
      Object.keys(sel.shortfall).forEach(function (k) { shortfall[sub + '/' + k] = sel.shortfall[k]; });
      var qm = {};
      pool.forEach(function (q) { qm[q.id] = q; });
      position = 0;
      sel.ids.forEach(function (id) {
        var q = qm[id];
        position++;
        ansRows.push({ answer_key: s.session_id + '|' + id, session_id: s.session_id, question_id: id, subject: sub,
          skill: q.skill, difficulty: q.difficulty, position: position, subject_idx: si,
          option_order: JSON.stringify(shuffle_(LETTERS, rng)), correct: q.answer, chosen: '', is_correct: '',
          flagged: false, skipped: false, time_spent_ms: 0, visits: 0, answered_at: '', updated_at: '', late_rejected: 0 });
      });
    });
    if (!ansRows.length) throw new Error('ไม่มีข้อสอบในคลังสำหรับการสอบแบบนี้ (ตรวจแท็บ Questions)');

    var start = appendRows_('Answers', ansRows);
    s.status = 'in_progress';
    s.mode = mode;
    s.subjects = JSON.stringify(subjects);
    s.started_at = new Date(now);
    s.started_ms = now;
    s.plan = buildPlan_(subjects, durations, now);
    s.current_idx = 0;
    s.last_event_ms = now;
    s.reveal_policy = String(settings.reveal_policy) === 'immediate' ? 'immediate' : 'parent_release';
    s.review_released = false;
    s.ans_row_start = start;
    s.ans_count = ansRows.length;
    s.config = Object.assign({}, cfg, { shortfall: shortfall });
    saveSession_(s);
    return stateFor_(s);
  });
}

/** ข้อที่ปรากฏใน N รอบล่าสุด (เลี่ยง) + เวลาที่เห็นล่าสุดของแต่ละข้อ (จัดลำดับเมื่อจำเป็นต้องซ้ำ) */
function recentHistory_() {
  var n = toNumber_(settings_().avoid_recent_sessions, 2);
  var sess = readTable_('Sessions').filter(function (r) { return String(r.status) !== 'issued' && String(r.status) !== 'void' && toNumber_(r.ans_count, 0) > 0; })
    .sort(function (a, b) { return toNumber_(b.started_ms, 0) - toNumber_(a.started_ms, 0); })
    .slice(0, Math.max(n, 6));
  var recentIds = {}, lastSeen = {};
  sess.forEach(function (r, i) {
    readRows_('Answers', toNumber_(r.ans_row_start, 0), toNumber_(r.ans_count, 0)).forEach(function (a) {
      var id = str_(a.question_id);
      if (i < n) recentIds[id] = true;
      lastSeen[id] = Math.max(lastSeen[id] || 0, toNumber_(r.started_ms, 0));
    });
  });
  return { recentIds: recentIds, lastSeen: lastSeen };
}

/** สถิติทักษะรายวิชา (ใช้กับ Drill อัตโนมัติ) */
function skillStatsFor_(subject) {
  var rows = resultRows_(true).filter(function (r) { return r.subject === subject; });
  var hasMock = rows.some(function (r) { return r.mode.indexOf('mock') === 0; });
  return { hasMock: hasMock, skills: computeStats_(rows, 'skill', statsOpts_()) };
}

/** แถว Results ในรูปที่คำนวณได้. forSkill=true ใช้กติกา skill_include_drill */
function resultRows_(forSkill) {
  var incl = toBool_(settings_().skill_include_drill);
  return readTable_('Results').map(function (r) {
    return { session_id: str_(r.session_id), mode: str_(r.mode), subject: str_(r.subject), skill: str_(r.skill),
      finished_ms: toNumber_(r.finished_ms, 0), n_total: toNumber_(r.n_total, 0), n_correct: toNumber_(r.n_correct, 0),
      n_wrong: toNumber_(r.n_wrong, 0), n_skipped: toNumber_(r.n_skipped, 0), pct: toNumber_(r.pct, 0),
      avg_time_sec: toNumber_(r.avg_time_sec, 0),
      d1_n: toNumber_(r.d1_n, 0), d1_correct: toNumber_(r.d1_correct, 0), d2_n: toNumber_(r.d2_n, 0),
      d2_correct: toNumber_(r.d2_correct, 0), d3_n: toNumber_(r.d3_n, 0), d3_correct: toNumber_(r.d3_correct, 0) };
  }).filter(function (r) { return !forSkill || incl || r.mode.indexOf('mock') === 0; });
}

/**
 * บันทึกคำตอบ/ธง/ข้าม/เวลา. payload: {qid, chosen?, flagged?, skipped?, delta_ms?, visit?, confirm?}
 * คืน {ok, reason?, remainingMs, serverNow, currentIdx, phase, reveal?}
 */
function api_saveAnswer(sessionId, payload) {
  return withLock_(function () {
    var now = nowMs_();
    var s = getSessionById_(sessionId);
    var res = tick_(s, now);
    var base = function (extra) {
      var out = { serverNow: now, currentIdx: s.current_idx, phase: s.status === 'in_progress' ? 'exam' : 'done' };
      if (s.status === 'in_progress') out.remainingMs = Math.max(0, s.plan[s.current_idx].deadline_ms - now);
      return Object.assign(out, extra);
    };
    payload = payload || {};
    // หาแถวคำตอบของข้อนี้
    var keys = readRows_('Answers', s.ans_row_start, s.ans_count);
    var a = null;
    for (var i = 0; i < keys.length; i++) if (str_(keys[i].question_id) === String(payload.qid)) { a = keys[i]; break; }
    if (!a) return base({ ok: false, reason: 'notfound' });
    var acc = acceptAnswer_(s.plan, toNumber_(a.subject_idx, 0), s.status !== 'in_progress', now, graceMs_());
    if (!acc.ok) {
      if (acc.reason === 'late') {
        a.late_rejected = toNumber_(a.late_rejected, 0) + 1;
        writeRow_('Answers', a.__row, a);
      }
      return base({ ok: false, reason: acc.reason });
    }
    var drill = isDrill_(s.mode);
    var checked = drill && str_(a.is_correct) !== '';
    var changed = false;
    if (!checked) {
      if (payload.chosen !== undefined) {
        var c = String(payload.chosen || '').toUpperCase();
        if (c && LETTERS.indexOf(c) < 0) return base({ ok: false, reason: 'invalid' });
        a.chosen = c;
        a.answered_at = new Date(now);
        if (c) a.skipped = false;
        changed = true;
      }
      if (payload.flagged !== undefined) { a.flagged = !!payload.flagged; changed = true; }
      if (payload.skipped !== undefined) {
        a.skipped = !!payload.skipped;
        if (a.skipped) a.chosen = '';
        changed = true;
      }
    }
    var delta = clampDelta_(payload.delta_ms, s.last_event_ms, now);
    if (delta > 0) { a.time_spent_ms = toNumber_(a.time_spent_ms, 0) + delta; changed = true; }
    if (payload.visit) { a.visits = toNumber_(a.visits, 0) + 1; changed = true; }
    var reveal = null;
    if (drill && payload.confirm && !checked && str_(a.chosen)) {
      var q = questionMap_(false)[str_(a.question_id)];
      a.is_correct = str_(a.chosen) === q.answer;
      reveal = revealOf_(q, str_(a.chosen));
      changed = true;
    } else if (checked) {
      reveal = revealOf_(questionMap_(false)[str_(a.question_id)], str_(a.chosen));
    }
    if (changed) {
      a.updated_at = new Date(now);
      writeRow_('Answers', a.__row, a);
    }
    s.last_event_ms = now;
    patchRow_('Sessions', s.__row, { last_event_ms: now });
    return base({ ok: true, reveal: reveal });
  });
}

/** ไปวิชาถัดไป (Mock เต็มชุด) หรือส่งข้อสอบ (วิชาสุดท้าย/โหมดอื่น) */
function api_next(sessionId) {
  return withLock_(function () {
    var now = nowMs_();
    var s = getSessionById_(sessionId);
    tick_(s, now);
    if (s.status !== 'in_progress') return finishedInfo_(s);
    if (s.current_idx + 1 < s.plan.length) {
      var r = advancePlan_(s.plan, s.current_idx, now);
      s.plan = r.plan; s.current_idx = r.currentIdx;
      saveSession_(s);
      return stateFor_(s);
    }
    s.plan = closeLastManual_(s.plan, s.current_idx, now);
    finalize_(s, 'manual', now, now);
    return finishedInfo_(s);
  });
}

function api_logTabSwitch(sessionId) {
  return withLock_(function () {
    var s = getSessionById_(sessionId);
    if (s.status !== 'in_progress') return { ok: false };
    s.tab_switches += 1;
    patchRow_('Sessions', s.__row, { tab_switches: s.tab_switches });
    return { ok: true, count: s.tab_switches };
  });
}

/** รายการทบทวนทีละข้อ (เฉพาะเมื่อนโยบายอนุญาต) */
function reviewItems_(s) {
  var qmap = questionMap_(false);
  return readAnswers_(s).map(function (a) {
    var q = qmap[str_(a.question_id)];
    if (!q) return null;
    var order = JSON.parse(a.option_order);
    var passage = q.passage;
    if (!passage && q.group_id) {
      Object.keys(qmap).some(function (id) { if (qmap[id].group_id === q.group_id && qmap[id].passage) { passage = qmap[id].passage; return true; } return false; });
    }
    return {
      qid: q.id, subject: str_(a.subject), subjectLabel: labelOf_(str_(a.subject)), skill: str_(a.skill),
      difficulty: toNumber_(a.difficulty, 2), pos: toNumber_(a.position, 0), passage: passage, stem: q.stem,
      hasImage: !!q.image_url, hasExplImage: !!q.explanation_image_url,
      choices: order.map(function (k) { return { k: k, t: q.choices[k], why: q.why[k] }; }),
      chosen: str_(a.chosen), answer: q.answer, isCorrect: str_(a.is_correct) === '' ? null : toBool_(a.is_correct),
      flagged: toBool_(a.flagged), skipped: toBool_(a.skipped) || !str_(a.chosen),
      timeSec: Math.round(toNumber_(a.time_spent_ms, 0) / 1000), explanation: q.explanation, takeaway: q.takeaway,
      fact_date: q.fact_date
    };
  }).filter(Boolean);
}

function api_getReview(sessionId) {
  return withLock_(function () {
    var s = getSessionById_(sessionId);
    tick_(s, nowMs_());
    if (!reviewAllowed_(s)) return { ok: false, reason: 'locked' };
    var info = finishedInfo_(s);
    return { ok: true, summary: info.summary, bySubject: info.bySubject, items: reviewItems_(s) };
  });
}

function api_getImage(sessionId, qid, which) {
  var s = getSessionById_(sessionId);
  var rows = readAnswers_(s);
  var row = rows.filter(function (a) { return str_(a.question_id) === String(qid); })[0];
  if (!row) throw new Error('ไม่พบข้อนี้ใน session');
  var q = questionMap_(false)[String(qid)];
  if (which === 'e') {
    // รูปประกอบคำอธิบาย = ส่วนหนึ่งของเฉลย: ดูได้เมื่อเปิดเฉลยแล้ว หรือ Drill ที่ตอบข้อนั้นแล้ว
    var drillChecked = isDrill_(s.mode) && str_(row.is_correct) !== '';
    if (!reviewAllowed_(s) && !drillChecked) throw new Error('ยังดูไม่ได้');
    return fetchImage_(q.explanation_image_url);
  }
  return fetchImage_(q.image_url);
}

function api_report(sessionId, qid, reason) {
  return withLock_(function () {
    var s = getSessionById_(sessionId);
    if (!reviewAllowed_(s)) return { ok: false };
    var a = readAnswers_(s).filter(function (x) { return str_(x.question_id) === String(qid); })[0];
    if (!a) return { ok: false };
    appendRows_('Reports', [{ report_id: Utilities.getUuid(), created_at: new Date(nowMs_()), session_id: sessionId,
      question_id: String(qid), chosen: str_(a.chosen), reason: String(reason || '').slice(0, 1000), status: 'open' }]);
    var qrow = readTable_('Questions').filter(function (r) { return str_(r.id).trim() === String(qid); })[0];
    if (qrow && (str_(qrow.status).trim().toLowerCase() || 'active') === 'active') {
      patchRow_('Questions', qrow.__row, { status: 'flagged' });
      clearQuestionCache_();
    }
    return { ok: true };
  });
}

// ================================================================ Dashboard (ผู้ปกครอง)

function authOk_(pin) {
  var st = settings_();
  var owner = String(st.owner_email || '').trim().toLowerCase();
  var email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) { email = ''; }
  if (owner && email && email === owner) return true;
  var want = String(st.parent_pin || '').trim();
  if (want && String(pin || '').trim() === want) return true;
  return false;
}

function requireAuth_(pin) { if (!authOk_(pin)) throw new Error('ไม่มีสิทธิ์'); }

function dash_check(pin) {
  var ok = authOk_(pin);
  return { ok: ok, pinAvailable: !!String(settings_().parent_pin || '').trim() };
}

function toIso_(ms) { return ms ? ms : null; }

function dash_getBundle(pin) {
  requireAuth_(pin);
  sweepExpiredSessions();
  var st = settings_(), labels = subjectLabels_(), opts = statsOpts_();
  var allRows = resultRows_(false);
  var mockRows = allRows.filter(function (r) { return r.mode.indexOf('mock') === 0; });
  var skillRows = resultRows_(true);
  var sessionsRaw = readTable_('Sessions').map(loadSession_);

  var skillStats = {}, subjectStats = {}, difficulty = {}, timeStats = {}, history = {}, expectedSec = {};
  SUBJECTS.forEach(function (sub) {
    var rows = skillRows.filter(function (r) { return r.subject === sub; });
    var sk = computeStats_(rows, 'skill', opts);
    skillStats[sub] = SKILLS[sub].map(function (k) {
      return sk[k] ? { skill: k, pct: sk[k].pct, n: sk[k].n, color: sk[k].color, sessions: sk[k].sessions }
        : { skill: k, pct: null, n: 0, color: 'none', sessions: 0 };
    });
    var ss = computeStats_(rows, 'subject', opts);
    subjectStats[sub] = ss[sub] || { pct: null, n: 0, color: 'none', sessions: 0 };
    var d = { 1: { n: 0, c: 0 }, 2: { n: 0, c: 0 }, 3: { n: 0, c: 0 } };
    var tstat = {};
    rows.forEach(function (r) {
      [1, 2, 3].forEach(function (x) { d[x].n += r['d' + x + '_n']; d[x].c += r['d' + x + '_correct']; });
      var t = tstat[r.skill] = tstat[r.skill] || { sum: 0, n: 0 };
      t.sum += r.avg_time_sec * r.n_total; t.n += r.n_total;
    });
    difficulty[sub] = d;
    timeStats[sub] = SKILLS[sub].map(function (k) {
      var t = tstat[k];
      return { skill: k, avg_sec: t && t.n ? Math.round(10 * t.sum / t.n) / 10 : null, n: t ? t.n : 0 };
    });
    var totalQ = blueprint_(sub).reduce(function (a, b) { return a + b[1]; }, 0);
    expectedSec[sub] = totalQ ? Math.round(10 * durationMin_(sub) * 60 / totalQ) / 10 : null;
    // กราฟพัฒนาการ: Mock เท่านั้น
    var bySess = {};
    mockRows.filter(function (r) { return r.subject === sub; }).forEach(function (r) {
      var b = bySess[r.session_id] = bySess[r.session_id] || { session_id: r.session_id, finished_ms: r.finished_ms, mode: r.mode, t: 0, c: 0 };
      b.t += r.n_total; b.c += r.n_correct;
    });
    history[sub] = Object.keys(bySess).map(function (k) { var b = bySess[k];
      return { session_id: b.session_id, finished_ms: b.finished_ms, mode: b.mode, pct: b.t ? Math.round(1000 * b.c / b.t) / 10 : 0, n: b.t }; })
      .sort(function (a, b) { return a.finished_ms - b.finished_ms; });
  });
  var latest = latestPerSubject_(mockRows, opts);
  var overallSkills = [];
  SUBJECTS.forEach(function (sub) { skillStats[sub].forEach(function (x) { overallSkills.push({ subject: sub, skill: x.skill, pct: x.pct, n: x.n, color: x.color }); }); });

  var qmap = questionMap_(false);
  var wrongCount = {}, seenCount = {};
  readTable_('Answers').forEach(function (a) {
    var ic = str_(a.is_correct);
    if (ic === '') return;
    var id = str_(a.question_id);
    seenCount[id] = (seenCount[id] || 0) + 1;
    if (!toBool_(ic)) wrongCount[id] = (wrongCount[id] || 0) + 1;
  });
  var repeatWrong = {};
  SUBJECTS.forEach(function (sub) { repeatWrong[sub] = []; });
  Object.keys(wrongCount).forEach(function (id) {
    var q = qmap[id];
    if (q && wrongCount[id] >= 2) repeatWrong[q.subject].push({ qid: id, skill: q.skill, stem: q.stem.slice(0, 120), wrong: wrongCount[id], total: seenCount[id] });
  });
  SUBJECTS.forEach(function (sub) { repeatWrong[sub].sort(function (a, b) { return b.wrong - a.wrong; }); });

  var base = ScriptApp.getService().getUrl() || '';
  var sessions = sessionsRaw.map(function (s) {
    return { session_id: s.session_id, label: str_(s.label), mode: str_(s.mode), status: s.status,
      subjects: s.subjects ? JSON.parse(s.subjects) : [], issued_ms: toMs_(s.issued_at), started_ms: s.started_ms,
      submitted_ms: toMs_(s.submitted_ms), submit_reason: str_(s.submit_reason), score_pct: s.score_pct === '' ? null : toNumber_(s.score_pct, null),
      n_correct: toNumber_(s.n_correct, 0), n_wrong: toNumber_(s.n_wrong, 0), n_skipped: toNumber_(s.n_skipped, 0),
      n_total: toNumber_(s.n_total, 0), used_sec: toNumber_(s.used_sec, 0), tab_switches: s.tab_switches,
      reveal_policy: str_(s.reveal_policy), review_released: s.review_released,
      config: s.config, url: s.status === 'issued' ? base + '?page=exam&t=' + s.token : '' };
  }).sort(function (a, b) { return (b.submitted_ms || b.started_ms || b.issued_ms || 0) - (a.submitted_ms || a.started_ms || a.issued_ms || 0); });

  var reports = readTable_('Reports').map(function (r) {
    var q = qmap[str_(r.question_id)];
    return { report_id: str_(r.report_id), created_ms: toMs_(r.created_at), session_id: str_(r.session_id), qid: str_(r.question_id),
      chosen: str_(r.chosen), reason: str_(r.reason), status: str_(r.status) || 'open', note: str_(r.resolution_note),
      stem: q ? q.stem.slice(0, 140) : '', answer: q ? q.answer : '' };
  }).sort(function (a, b) { return (b.created_ms || 0) - (a.created_ms || 0); });

  return {
    title: String(st.exam_title), labels: labels, skills: SKILLS, subjects: SUBJECTS,
    thresholds: { green: opts.greenMin, yellow: opts.yellowMin }, revealPolicy: String(st.reveal_policy),
    skillStats: skillStats, subjectStats: subjectStats, latest: latest.bySubject, overall: latest.overall,
    overallSkills: overallSkills, history: history, difficulty: difficulty, timeStats: timeStats, expectedSec: expectedSec,
    repeatWrong: repeatWrong, sessions: sessions, reports: reports,
    serverNow: nowMs_(), baseUrl: base
  };
}

function dash_getSession(pin, sessionId) {
  requireAuth_(pin);
  var s = getSessionById_(sessionId);
  if (!s.ans_count) return { items: [], session: { status: s.status } };
  return { session: { session_id: s.session_id, mode: s.mode, status: s.status, tab_switches: s.tab_switches,
    n_correct: toNumber_(s.n_correct, 0), n_wrong: toNumber_(s.n_wrong, 0), n_skipped: toNumber_(s.n_skipped, 0),
    n_total: toNumber_(s.n_total, 0), score_pct: toNumber_(s.score_pct, 0), used_sec: toNumber_(s.used_sec, 0) },
    bySubject: s.status === 'in_progress' ? [] : subjectBreakdown_(s.session_id), items: reviewItems_(s) };
}

function dash_getImage(pin, qid, which) {
  requireAuth_(pin);
  var q = questionMap_(false)[String(qid)];
  if (!q) throw new Error('ไม่พบข้อ');
  return fetchImage_(which === 'e' ? q.explanation_image_url : q.image_url);
}

/** สร้างลิงก์ (qty ลิงก์) opts: {mode?, subject?, label?, count?, minutes?, skills?, qty?} mode ว่าง = ให้ลูกเลือกเอง */
function dash_createLinks(pin, opts) {
  requireAuth_(pin);
  return withLock_(function () {
    opts = opts || {};
    var qty = Math.max(1, Math.min(20, toNumber_(opts.qty, 1)));
    var cfg = {};
    if (opts.mode) cfg.mode = String(opts.mode);
    if (opts.subject) cfg.subject = String(opts.subject);
    if (opts.count) cfg.count = Number(opts.count);
    if (opts.minutes) cfg.minutes = Number(opts.minutes);
    if (opts.skills && opts.skills.length) cfg.skills = opts.skills;
    var rows = [], base = ScriptApp.getService().getUrl() || '', out = [];
    for (var i = 0; i < qty; i++) {
      var tok = newToken_();
      rows.push({ session_id: Utilities.getUuid(), token: tok, status: 'issued', mode: cfg.mode || '', subjects: '',
        config_json: JSON.stringify(cfg), label: String(opts.label || ''), issued_at: new Date(nowMs_()), tab_switches: 0 });
      out.push(base + '?page=exam&t=' + tok);
    }
    appendRows_('Sessions', rows);
    return { urls: out };
  });
}

function dash_voidLink(pin, sessionId) {
  requireAuth_(pin);
  return withLock_(function () {
    var s = getSessionById_(sessionId);
    if (s.status !== 'issued') return { ok: false };
    patchRow_('Sessions', s.__row, { status: 'void' });
    return { ok: true };
  });
}

function dash_releaseReview(pin, sessionId, release) {
  requireAuth_(pin);
  return withLock_(function () {
    var s = getSessionById_(sessionId);
    patchRow_('Sessions', s.__row, { review_released: release !== false });
    return { ok: true };
  });
}

function dash_setRevealPolicy(pin, policy) {
  requireAuth_(pin);
  if (policy !== 'immediate' && policy !== 'parent_release') throw new Error('ค่าไม่ถูกต้อง');
  setSetting_('reveal_policy', policy);
  return { ok: true };
}

function dash_resolveReport(pin, reportId, status, note, retireQuestion) {
  requireAuth_(pin);
  return withLock_(function () {
    var rep = readTable_('Reports').filter(function (r) { return str_(r.report_id) === String(reportId); })[0];
    if (!rep) return { ok: false };
    patchRow_('Reports', rep.__row, { status: status === 'rejected' ? 'rejected' : 'resolved', resolution_note: String(note || ''),
      resolved_at: new Date(nowMs_()) });
    if (retireQuestion) {
      var q = readTable_('Questions').filter(function (r) { return str_(r.id).trim() === str_(rep.question_id); })[0];
      if (q) { patchRow_('Questions', q.__row, { status: 'retired' }); clearQuestionCache_(); }
    }
    return { ok: true };
  });
}
