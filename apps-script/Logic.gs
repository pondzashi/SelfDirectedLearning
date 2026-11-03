/**
 * Logic.gs — ตรรกะล้วน (ไม่เรียกบริการของ Google) ทดสอบด้วย Node ได้: node apps-script/tests/run.js
 * ชื่อฟังก์ชันลงท้าย _ = ภายในเท่านั้น (google.script.run เรียกจากหน้าเว็บไม่ได้)
 */

var SUBJECTS = ['english', 'thai_social', 'art'];

var SKILLS = {
  english: ['Vocabulary', 'Grammar', 'Reading', 'Error Identification'],
  thai_social: ['อักขรวิธี', 'จับใจความ', 'ความรู้ทั่วไปทางศิลปะ', 'ประวัติศาสตร์ศิลป์', 'ข่าวปัจจุบัน'],
  art: ['ทฤษฎีสี', 'องค์ประกอบภาพ', 'ทัศนธาตุและหลักการออกแบบ', 'โลโก้และไอคอน']
};

var LETTERS = ['A', 'B', 'C', 'D'];

/** "a=1;b=2" -> [["a","1"],["b","2"]] */
function parseKV_(s) {
  var out = [];
  String(s == null ? '' : s).split(';').forEach(function (p) {
    var i = p.indexOf('=');
    if (i < 1) return;
    out.push([p.slice(0, i).trim(), p.slice(i + 1).trim()]);
  });
  return out;
}

function shuffle_(arr, rng) {
  rng = rng || Math.random;
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ---------------------------------------------------------------- เวลา

/** durationsMin: {subject: นาที}. ช่วงแรกเริ่มที่ startMs ช่วงถัดไปยังไม่เริ่ม */
function buildPlan_(subjects, durationsMin, startMs) {
  return subjects.map(function (s, i) {
    var d = Math.round(durationsMin[s] * 60000);
    return {
      subject: s,
      duration_ms: d,
      start_ms: i === 0 ? startMs : null,
      deadline_ms: i === 0 ? startMs + d : null,
      closed_at: null,
      closed_reason: ''
    };
  });
}

/**
 * ประเมินสถานะตามเวลาจริงของ server (เรียกก่อนทุกคำสั่ง)
 * - วิชาที่ไม่ใช่วิชาสุดท้าย: หมดเวลาที่ deadline -> วิชาถัดไปเริ่มนับที่ deadline เดิม (ไม่ใช่ตอนเปิดหน้า)
 * - วิชาสุดท้าย: ปิด session เมื่อเลย deadline + grace (ช่วง grace ยังรับคำตอบที่ส่งมาช้านิดหน่อย)
 * คืน {plan, currentIdx, finished, finishedAt, changed}
 */
function evaluatePlan_(plan, currentIdx, nowMs, graceMs) {
  var p = JSON.parse(JSON.stringify(plan));
  var idx = currentIdx, changed = false;
  while (true) {
    var cur = p[idx];
    if (nowMs <= cur.deadline_ms) break;
    if (idx + 1 < p.length) {
      cur.closed_at = cur.deadline_ms;
      cur.closed_reason = 'time_up';
      var nx = p[idx + 1];
      nx.start_ms = cur.deadline_ms;
      nx.deadline_ms = nx.start_ms + nx.duration_ms;
      idx++;
      changed = true;
      continue;
    }
    if (nowMs > cur.deadline_ms + graceMs) {
      cur.closed_at = cur.deadline_ms;
      cur.closed_reason = 'time_up';
      return { plan: p, currentIdx: idx, finished: true, finishedAt: cur.deadline_ms, changed: true };
    }
    break; // วิชาสุดท้ายอยู่ในช่วง grace
  }
  return { plan: p, currentIdx: idx, finished: false, finishedAt: null, changed: changed };
}

/** ผู้สอบกดไปวิชาถัดไปเอง (เรียกหลัง evaluatePlan_ แล้ว) */
function advancePlan_(plan, idx, nowMs) {
  var p = JSON.parse(JSON.stringify(plan));
  if (idx + 1 >= p.length) return { plan: p, currentIdx: idx, ok: false };
  var cur = p[idx];
  cur.closed_at = nowMs;
  cur.closed_reason = 'manual';
  var nx = p[idx + 1];
  nx.start_ms = nowMs;
  nx.deadline_ms = nowMs + nx.duration_ms;
  return { plan: p, currentIdx: idx + 1, ok: true };
}

/** ปิดวิชาสุดท้ายด้วยการกดส่ง */
function closeLastManual_(plan, idx, nowMs) {
  var p = JSON.parse(JSON.stringify(plan));
  p[idx].closed_at = nowMs;
  p[idx].closed_reason = 'manual';
  return p;
}

/**
 * ข้อของวิชา subjectIdx รับคำตอบได้ไหม (เรียกหลัง evaluatePlan_)
 * - วิชาที่กดปิดเอง/ยังไม่เริ่ม/เลยไปแล้ว -> closed
 * - วิชาที่หมดเวลา รับได้ถ้ายังไม่เกิน deadline + grace
 */
function acceptAnswer_(plan, subjectIdx, sessionFinished, nowMs, graceMs) {
  if (sessionFinished) return { ok: false, reason: 'closed' };
  var e = plan[subjectIdx];
  if (!e || e.start_ms == null) return { ok: false, reason: 'closed' };
  if (e.closed_reason === 'manual') return { ok: false, reason: 'closed' };
  if (nowMs > e.deadline_ms + graceMs) return { ok: false, reason: 'late' };
  return { ok: true, reason: '' };
}

function clampDelta_(deltaMs, lastEventMs, nowMs) {
  var d = Number(deltaMs) || 0;
  var cap = Math.max(0, nowMs - (lastEventMs || nowMs));
  return Math.max(0, Math.min(d, cap, 30 * 60000));
}

// ---------------------------------------------------------------- สุ่มข้อสอบ

function distributeByMix_(want, mix) {
  var keys = ['1', '2', '3'], tot = 0, i;
  keys.forEach(function (k) { tot += Number(mix[k]) || 0; });
  var out = { 1: 0, 2: 0, 3: 0 };
  if (tot <= 0) { out[2] = want; return out; }
  var rem = [], used = 0;
  keys.forEach(function (k) {
    var raw = want * (Number(mix[k]) || 0) / tot;
    out[k] = Math.floor(raw);
    used += out[k];
    rem.push({ k: k, r: raw - out[k] });
  });
  rem.sort(function (a, b) { return b.r - a.r; });
  for (i = 0; used < want; i++, used++) out[rem[i % 3].k]++;
  return out;
}

/**
 * pool: [{id, skill, difficulty, group_id}] (กรองสถานะแล้ว)
 * blueprint: [[skill, count], ...]; mix: {1:30,2:45,3:25}
 * recentIds: {id:true} ข้อที่เพิ่งทำ (พยายามเลี่ยง); lastSeen: {id: ms}
 * คืน {ids:[...], shortfall:{skill:จำนวนที่ขาด}}
 */
function selectQuestions_(pool, blueprint, mix, recentIds, lastSeen, rng) {
  recentIds = recentIds || {};
  lastSeen = lastSeen || {};
  var allUnits = [], shortfall = {};
  blueprint.forEach(function (bp) {
    var skill = bp[0], want = Number(bp[1]) || 0;
    var groups = {}, units = [];
    pool.forEach(function (q) {
      if (q.skill !== skill) return;
      if (q.group_id) (groups[q.group_id] = groups[q.group_id] || []).push(q);
      else units.push({ qs: [q] });
    });
    Object.keys(groups).forEach(function (g) {
      groups[g].sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
      units.push({ qs: groups[g] });
    });
    units.forEach(function (u) {
      u.size = u.qs.length;
      u.recent = u.qs.some(function (q) { return recentIds[q.id]; });
      u.seen = Math.max.apply(null, u.qs.map(function (q) { return lastSeen[q.id] || 0; }));
      u.diff = Math.round(u.qs.reduce(function (s, q) { return s + (Number(q.difficulty) || 2); }, 0) / u.size);
    });
    var fresh = shuffle_(units.filter(function (u) { return !u.recent; }), rng);
    var old = shuffle_(units.filter(function (u) { return u.recent; }), rng)
      .sort(function (a, b) { return a.seen - b.seen; });
    var target = distributeByMix_(want, mix || {});
    var taken = [], got = 0, perDiff = { 1: 0, 2: 0, 3: 0 };
    // เลี่ยงข้อที่เพิ่งทำสำคัญกว่าสัดส่วนความยาก: เติมจากข้อใหม่ก่อน (ตามสัดส่วนแล้วเติมส่วนที่เหลือ) ค่อยใช้ข้อที่เคยทำ
    [fresh, old].forEach(function (tier) {
      [1, 2, 3].forEach(function (d) {
        tier.forEach(function (u) {
          if (u.taken || u.diff !== d) return;
          if (perDiff[d] >= target[d] || got + u.size > want) return;
          u.taken = true; taken.push(u); got += u.size; perDiff[d] += u.size;
        });
      });
      tier.forEach(function (u) {
        if (u.taken || got + u.size > want) return;
        u.taken = true; taken.push(u); got += u.size; perDiff[u.diff] += u.size;
      });
      // ยังขาดเพราะขนาดกลุ่มบทอ่านไม่ลงตัว (เช่น เลือกกลุ่ม 2 ข้อไว้ แต่ที่เหลือเป็นกลุ่ม 4 ข้อ):
      // สลับกลุ่มที่เลือกแล้วกับกลุ่มที่ยังไม่เลือกในชั้นเดียวกันให้พอดี ก่อนจะยอมใช้ข้อที่เพิ่งทำ
      for (var guard = 0; got < want && guard < 50; guard++) {
        var gap = want - got, swapped = false;
        for (var i = 0; i < taken.length && !swapped; i++) {
          var a = taken[i];
          if (tier.indexOf(a) < 0) continue;
          for (var j = 0; j < tier.length; j++) {
            var b = tier[j];
            if (b.taken || b.size - a.size <= 0 || b.size - a.size > gap) continue;
            a.taken = false; b.taken = true; taken[i] = b;
            got += b.size - a.size; perDiff[a.diff] -= a.size; perDiff[b.diff] += b.size;
            swapped = true; break;
          }
        }
        if (!swapped) break;
      }
      // ยังไม่พอดีอีก: หาชุดกลุ่มจากข้อใหม่ที่รวมได้พอดีที่สุด (subset sum) โดยให้กลุ่มที่เลือกไว้แล้วมาก่อน
      if (got < want && tier === fresh) {
        var order = taken.slice().concat(fresh.filter(function (u) { return !u.taken; }));
        var reach = [[]];
        order.forEach(function (u) {
          for (var s = want - u.size; s >= 0; s--) {
            if (reach[s] && !reach[s + u.size]) reach[s + u.size] = reach[s].concat([u]);
          }
        });
        var best = want;
        while (best > got && !reach[best]) best--;
        if (best > got) {
          taken.forEach(function (u) { u.taken = false; });
          taken = reach[best].slice();
          got = best; perDiff = { 1: 0, 2: 0, 3: 0 };
          taken.forEach(function (u) { u.taken = true; perDiff[u.diff] += u.size; });
        }
      }
    });
    if (got < want) shortfall[skill] = want - got;
    allUnits = allUnits.concat(taken);
  });
  var ids = [];
  shuffle_(allUnits, rng).forEach(function (u) {
    u.qs.forEach(function (q) { ids.push(q.id); });
  });
  return { ids: ids, shortfall: shortfall };
}

// ---------------------------------------------------------------- ตรวจ/สรุปผล

/**
 * answers: [{subject, skill, difficulty, correct, chosen, time_spent_ms}]
 * คืน {answers: [... + is_correct (true/false/''), ], rows: ผลรายทักษะ, summary}
 */
function gradeAnswers_(answers) {
  var order = [], map = {};
  var graded = answers.map(function (a) {
    var chosen = a.chosen || '';
    var ic = chosen ? chosen === a.correct : '';
    var key = a.subject + '||' + a.skill;
    if (!map[key]) {
      map[key] = { subject: a.subject, skill: a.skill, n_total: 0, n_correct: 0, n_wrong: 0, n_skipped: 0,
        time_ms: 0, d1_n: 0, d1_correct: 0, d2_n: 0, d2_correct: 0, d3_n: 0, d3_correct: 0 };
      order.push(key);
    }
    var r = map[key];
    r.n_total++;
    r.time_ms += Number(a.time_spent_ms) || 0;
    var d = Number(a.difficulty) || 2;
    if (d < 1 || d > 3) d = 2;
    r['d' + d + '_n']++;
    if (ic === true) { r.n_correct++; r['d' + d + '_correct']++; }
    else if (ic === false) r.n_wrong++;
    else r.n_skipped++;
    return Object.assign({}, a, { is_correct: ic });
  });
  var rows = order.map(function (k) {
    var r = map[k];
    r.pct = r.n_total ? Math.round(1000 * r.n_correct / r.n_total) / 10 : 0;
    r.avg_time_sec = r.n_total ? Math.round(r.time_ms / r.n_total / 100) / 10 : 0;
    delete r.time_ms;
    return r;
  });
  var s = { n_total: 0, n_correct: 0, n_wrong: 0, n_skipped: 0 };
  rows.forEach(function (r) {
    s.n_total += r.n_total; s.n_correct += r.n_correct; s.n_wrong += r.n_wrong; s.n_skipped += r.n_skipped;
  });
  s.score_pct = s.n_total ? Math.round(1000 * s.n_correct / s.n_total) / 10 : 0;
  return { answers: graded, rows: rows, summary: s };
}

function colorFor_(pct, greenMin, yellowMin) {
  if (pct == null || isNaN(pct)) return 'none';
  if (pct >= greenMin) return 'green';
  if (pct >= yellowMin) return 'yellow';
  return 'red';
}

/**
 * rows: [{session_id, finished_ms, n_total, n_correct, <field ที่ใช้เป็น key>}]
 * ให้น้ำหนักรอบล่าสุดมากกว่า: w = decay^rank (rank 0 = ล่าสุด) ใช้ไม่เกิน maxSessions รอบต่อ key
 * ข้อที่ข้าม/ไม่ตอบ อยู่ใน n_total แล้ว (นับเป็นผิด)
 * คืน {key: {pct, n, sessions, color}} pct ปัดทศนิยม 1 ตำแหน่ง
 */
function computeStats_(rows, keyField, opts) {
  var decay = opts.decay, maxS = opts.maxSessions;
  var byKey = {};
  rows.forEach(function (r) {
    var k = r[keyField];
    var m = byKey[k] = byKey[k] || {};
    var s = m[r.session_id] = m[r.session_id] || { t: 0, c: 0, f: r.finished_ms };
    s.t += Number(r.n_total) || 0;
    s.c += Number(r.n_correct) || 0;
    s.f = Math.max(s.f, r.finished_ms);
  });
  var out = {};
  Object.keys(byKey).forEach(function (k) {
    var list = Object.keys(byKey[k]).map(function (sid) { return byKey[k][sid]; })
      .filter(function (s) { return s.t > 0; })
      .sort(function (a, b) { return b.f - a.f; })
      .slice(0, maxS);
    var num = 0, den = 0, n = 0;
    list.forEach(function (s, rank) {
      var w = Math.pow(decay, rank);
      num += w * s.c; den += w * s.t; n += s.t;
    });
    if (!den) return;
    var pct = Math.round(1000 * 100 * num / den) / 1000;
    pct = Math.round(pct * 10) / 10;
    out[k] = { pct: pct, n: n, sessions: list.length, color: colorFor_(pct, opts.greenMin, opts.yellowMin) };
  });
  return out;
}

/** ผลล่าสุดของแต่ละวิชา + ภาพรวม (ถ่วงตามจำนวนข้อ). rows = ผลรายทักษะของ Mock เท่านั้น */
function latestPerSubject_(rows, opts) {
  var best = {};
  rows.forEach(function (r) {
    var b = best[r.subject];
    if (!b || r.finished_ms > b.finished_ms) best[r.subject] = { session_id: r.session_id, finished_ms: r.finished_ms, mode: r.mode, t: 0, c: 0 };
  });
  rows.forEach(function (r) {
    var b = best[r.subject];
    if (b && b.session_id === r.session_id) { b.t += Number(r.n_total) || 0; b.c += Number(r.n_correct) || 0; }
  });
  var out = {}, T = 0, C = 0;
  Object.keys(best).forEach(function (s) {
    var b = best[s];
    if (!b.t) return;
    var pct = Math.round(1000 * b.c / b.t) / 10;
    out[s] = { session_id: b.session_id, finished_ms: b.finished_ms, mode: b.mode, n: b.t, pct: pct,
      color: colorFor_(pct, opts.greenMin, opts.yellowMin) };
    T += b.t; C += b.c;
  });
  var overall = null;
  if (T) {
    var op = Math.round(1000 * C / T) / 10;
    overall = { pct: op, n: T, color: colorFor_(op, opts.greenMin, opts.yellowMin) };
  }
  return { bySubject: out, overall: overall };
}

/**
 * Drill อัตโนมัติ: จัดสรรจำนวนข้อให้ทักษะที่ 🟡🔴 (อ่อนกว่า = ได้มากกว่า)
 * stats: {skill: {pct, color}} (ทักษะที่ยังไม่มีข้อมูลจะไม่ถูกเลือก)
 * คืน [[skill,count],...] เรียงจากอ่อนสุด
 */
function allocateDrill_(stats, total, minPer) {
  var cands = Object.keys(stats).filter(function (k) { return stats[k].color === 'yellow' || stats[k].color === 'red'; });
  if (!cands.length) {
    cands = Object.keys(stats).sort(function (a, b) { return stats[a].pct - stats[b].pct; }).slice(0, 2);
  }
  if (!cands.length || total <= 0) return [];
  cands.sort(function (a, b) { return stats[a].pct - stats[b].pct; });
  minPer = Math.max(1, minPer || 1);
  var maxSkills = Math.max(1, Math.floor(total / minPer));
  cands = cands.slice(0, maxSkills);
  var w = cands.map(function (k) { return Math.max(1, 100 - stats[k].pct); });
  var wsum = w.reduce(function (a, b) { return a + b; }, 0);
  var alloc = cands.map(function () { return minPer; });
  var left = total - minPer * cands.length;
  var quota = w.map(function (x) { return left * x / wsum; });
  var base = quota.map(Math.floor);
  var used = base.reduce(function (a, b) { return a + b; }, 0);
  var order = quota.map(function (q, i) { return { i: i, r: q - base[i] }; })
    .sort(function (a, b) { return b.r - a.r || a.i - b.i; });
  for (var j = 0; used < left; j++, used++) base[order[j % order.length].i]++;
  return cands.map(function (k, i) { return [k, alloc[i] + base[i]]; });
}

/** แบ่งจำนวนข้อให้ทักษะที่เลือกเองแบบเฉลี่ย (เศษให้ทักษะต้นๆ) */
function splitEvenly_(skills, total) {
  var n = skills.length, base = Math.floor(total / n), extra = total - base * n;
  return skills.map(function (s, i) { return [s, base + (i < extra ? 1 : 0)]; }).filter(function (x) { return x[1] > 0; });
}
