/**
 * เซิร์ฟเวอร์พรีวิวหน้าจอ (ไม่ใช้ Google): node tests/preview-server.js [port]
 * เปิด http://localhost:8765/?mode=daily&skill=fracdec  หรือ  ?mode=placement&day=0  หรือ  ?mode=benchmark
 * จำลอง google.script.run ด้วยตัวสร้างโจทย์จริงของโปรเจกต์
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), http = require('http');
const DIR = path.join(__dirname, '..', 'apps-script');
const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number, RegExp, Error });
['Core.gs', 'Generators.gs', 'Templates.gs', 'BankSeed.gs', 'Curriculum.gs', 'SetBuilder.gs'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
const G = n => vm.runInContext(n, ctx);
const port = +process.argv[2] || 8765;

function coreSrc() {
  return [G('gcd'), G('parseUser'), G('checkAnswer'), G('classifyError')].map(f => f.toString()).join('\n') + '\nvar ERR_DEFAULT=' + JSON.stringify(G('ERR_DEFAULT')) + ';';
}
function makeSet(q) {
  const bank = G('BANK_SEED_ROWS').map((r, i) => ({ code: 'F' + (i + 1), cat: r[0], level: r[1], q: r[2], ans: r[3], explain: r[4], choices: r[5] || '' }));
  const ctx2 = { levels: { addsub: +q.step || 3, mul: 1, div: 1, fracdec: +q.step || 1, tiers: { word: 2, observe: 2, analytic: 2 } }, skill: q.skill || 'addsub', usedSigs: {}, recentTpl: {}, bank, bankUsed: {}, reviews: [] };
  G('setRng')(G('mulberry32')(Date.now() % 100000));
  let set;
  if (q.mode === 'placement') set = G('buildPlacementDay')(ctx2, +q.day || 0);
  else if (q.mode === 'benchmark') set = G('buildBenchmark')(ctx2);
  else set = G('buildDailySet')(ctx2);
  if (q.tpl) { set.sections[0].items = q.tpl.split(',').map(id => { const it = G('buildTemplate')(id, +q.tier || 2); it.sig = it.key + Math.random(); return it; }); set.sections[0].kind = 'plain'; set.sections[0].recSec = 300; delete set.sections[0].mainCount; }
  // ย่อชุดเพื่อทดสอบเร็ว
  const n = +q.n || 0;
  if (n) set.sections.forEach(s => { s.items = s.items.slice(0, n); if (s.mainCount) s.mainCount = Math.min(s.mainCount, n); });
  set.status = 'ready'; set.date = '2026-11-09'; set.child = 'น้อง'; set.childName = q.name || ''; set.aMaxSec = 1200;
  return set;
}
const MOCK = q => `<script>
window.__sets = ${JSON.stringify(makeSet(q))};
window.__log = [];
window.google = { script: { run: (function () {
  function mk(ok, fail) { return new Proxy({}, { get: function (_, name) {
    if (name === 'withSuccessHandler') return function (f) { return mk(f, fail); };
    if (name === 'withFailureHandler') return function (f) { return mk(ok, f); };
    return function (arg) { setTimeout(function () {
      window.__log.push([name, arg]);
      if (name === 'getTodaySet') ok(window.__sets);
      else if (name === 'submitSession') ok({ ok: true, summary: { sections: arg.sections.map(function (s) { return { id: s.id, name: s.name, right: s.items.filter(function (i) { return i.ok1; }).length, total: s.items.length, totalSec: s.totalSec, rounds: s.rounds }; }), note: 'ทดสอบ: ผลจำลอง', drill: arg.sections[0].kind === 'drill' ? { pass: true } : null } });
      else ok({ ok: true });
    }, 120); };
  } }); }
  return mk(function () {}, function () {});
})() } };
</script>`;

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/answers') { // ช่วยทดสอบ: คืนเฉลยของชุดปัจจุบันไม่ได้เพราะสุ่มใหม่ ใช้ window.__sets ในเบราว์เซอร์แทน
    res.end('use window.__sets'); return;
  }
  let html = fs.readFileSync(path.join(DIR, 'Index.html'), 'utf8').replace('<?!= clientCore() ?>', () => coreSrc());
  html = html.replace('<div id="app">', () => MOCK(Object.fromEntries(u.searchParams)) + '<div id="app">');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
}).listen(port, () => console.log('preview on http://localhost:' + port));
